import sqlite3
import json
import urllib.request
import urllib.error
import sys

VYAPAR_DB = r'C:\Users\91638\AppData\Roaming\Vyaparapp\BusinessNames\SriRaaniDryFruitsTraders__t_2026_04_21_12_33_06_w9oz.vyp'
API_BASE = 'http://localhost:8088/api/v1'

def post_json(endpoint, payload):
    url = f"{API_BASE}/{endpoint}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"Error {e.code} on {endpoint}: {err_msg[:200]}")
        return None
    except Exception as e:
        print(f"Connection error on {endpoint}: {e}")
        return None

def migrate():
    print(f"Connecting to Vyapar DB: {VYAPAR_DB}")
    conn = sqlite3.connect(VYAPAR_DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # 1. Migrate Business Profile
    print("\n--- 1. Migrating Business Profile ---")
    c.execute("SELECT * FROM kb_firms LIMIT 1")
    firm = c.fetchone()
    if firm:
        profile_data = {
            "businessName": firm["firm_name"] or "Sri Raani Dry Fruits Traders",
            "gstin": firm["firm_gstin_number"] or "",
            "pan": firm["firm_gstin_number"][2:12] if firm["firm_gstin_number"] and len(firm["firm_gstin_number"]) >= 12 else "",
            "phone": firm["firm_phone"] or "",
            "email": firm["firm_email"] or "",
            "address": firm["firm_address"] or "",
            "state": firm["firm_state"] or "Tamil Nadu"
        }
        res = post_json("profile", profile_data)
        print(f"Business Profile Migrated: {profile_data['businessName']} (Result: {res is not None})")

    # 2. Cache Units
    units_map = {}
    c.execute("SELECT unit_id, unit_short_name FROM kb_item_units")
    for r in c.fetchall():
        units_map[r["unit_id"]] = r["unit_short_name"]

    # 3. Cache Tax Rates
    tax_rates = {}
    c.execute("SELECT tax_code_id, tax_rate FROM kb_tax_code")
    for r in c.fetchall():
        tax_rates[r["tax_code_id"]] = r["tax_rate"]

    # 4. Migrate Products (kb_items)
    print("\n--- 2. Migrating Inventory Items ---")
    c.execute("SELECT * FROM kb_items WHERE item_is_active = 1")
    items = c.fetchall()
    print(f"Found {len(items)} active items")
    item_id_map = {}
    item_name_cache = {}
    migrated_items = 0

    for itm in items:
        unit = units_map.get(itm["base_unit_id"], "Kg")
        tax_pct = tax_rates.get(itm["item_tax_id"], 5.0) if itm["item_tax_id"] else 5.0
        
        prod_payload = {
            "name": itm["item_name"],
            "hsn": itm["item_hsn_sac_code"] or "",
            "purchasePrice": float(itm["item_purchase_unit_price"] or 0),
            "sellingPrice": float(itm["item_sale_unit_price"] or 0),
            "rate": float(itm["item_sale_unit_price"] or 0),
            "taxPercent": float(tax_pct),
            "unit": unit,
            "stock": float(itm["item_stock_quantity"] or 0),
            "description": itm["item_description"] or ""
        }
        res = post_json("products", prod_payload)
        if res and "id" in res:
            item_id_map[itm["item_id"]] = res["id"]
            migrated_items += 1
        item_name_cache[itm["item_id"]] = {
            "name": itm["item_name"],
            "hsn": itm["item_hsn_sac_code"] or "",
            "unit": unit,
            "rate": float(itm["item_sale_unit_price"] or 0)
        }

    print(f"Successfully migrated {migrated_items}/{len(items)} products.")

    # 5. Migrate Parties (kb_names)
    print("\n--- 3. Migrating Parties (Clients & Suppliers) ---")
    c.execute("SELECT * FROM kb_names WHERE name_is_active = 1")
    names = c.fetchall()
    client_name_map = {}
    migrated_clients = 0

    for nm in names:
        if nm["name_type"] == 1: # Party
            party_name = nm["full_name"]
            client_payload = {
                "name": party_name,
                "phone": nm["phone_number"] or "",
                "email": nm["email"] or "",
                "address": nm["address"] or "",
                "pin": nm["pincode"] or "",
                "state": nm["name_state"] or "Tamil Nadu",
                "gstin": nm["name_gstin_number"] or ""
            }
            res = post_json("clients", client_payload)
            if res and "id" in res:
                client_name_map[nm["name_id"]] = {
                    "id": res["id"],
                    "name": party_name,
                    "phone": nm["phone_number"] or "",
                    "gstin": nm["name_gstin_number"] or ""
                }
                migrated_clients += 1
            else:
                client_name_map[nm["name_id"]] = {
                    "id": None,
                    "name": party_name,
                    "phone": nm["phone_number"] or "",
                    "gstin": nm["name_gstin_number"] or ""
                }

    print(f"Successfully migrated {migrated_clients} clients.")

    # 6. Migrate Transactions (Sales & Purchases)
    print("\n--- 4. Migrating Transactions & Invoices ---")
    c.execute("SELECT * FROM kb_transactions ORDER BY txn_id ASC")
    txns = c.fetchall()
    print(f"Found {len(txns)} transactions")

    migrated_sales = 0
    migrated_purchases = 0

    for t in txns:
        txn_id = t["txn_id"]
        txn_type = t["txn_type"]
        party = client_name_map.get(t["txn_name_id"], {"name": "Walk-in Customer", "id": None})
        party_name = party["name"]
        
        # Get lineitems
        c.execute("SELECT * FROM kb_lineitems WHERE lineitem_txn_id = ?", (txn_id,))
        lines = c.fetchall()
        
        items_payload = []
        calc_subtotal = 0.0
        calc_tax = 0.0

        for l in lines:
            i_info = item_name_cache.get(l["item_id"], {"name": "Dry Fruit", "hsn": "", "unit": "Kg", "rate": 0})
            qty = float(l["quantity"] or 0)
            rate = float(l["priceperunit"] or i_info["rate"])
            amt = float(l["total_amount"] or (qty * rate))
            tax_amt = float(l["lineitem_tax_amount"] or 0)
            disc_pct = float(l["lineitem_discount_percent"] or 0)
            
            calc_subtotal += (amt - tax_amt)
            calc_tax += tax_amt

            items_payload.append({
                "productId": item_id_map.get(l["item_id"]),
                "name": i_info["name"],
                "hsn": i_info["hsn"],
                "quantity": qty,
                "rate": rate,
                "taxPercent": round((tax_amt / (amt - tax_amt) * 100), 1) if (amt - tax_amt) > 0 else 5.0,
                "discount": disc_pct,
                "amount": amt
            })

        cash_amt = float(t["txn_cash_amount"] or 0)
        bal_amt = float(t["txn_balance_amount"] or 0)
        total_amt = cash_amt + bal_amt
        if total_amt <= 0 and items_payload:
            total_amt = sum(x["amount"] for x in items_payload)

        status = "paid" if bal_amt <= 0.05 else ("partial" if cash_amt > 0 else "unpaid")
        txn_date_str = (t["txn_date"] or "")[:10]
        if not txn_date_str:
            txn_date_str = (t["txn_date_created"] or "")[:10]

        due_date_str = (t["txn_due_date"] or "")[:10]
        if not due_date_str:
            due_date_str = txn_date_str

        ref_no = t["txn_ref_number_char"] or str(t["txn_id"])
        inv_no = f"INV-{ref_no.zfill(4)}" if ref_no.isdigit() else f"INV-{ref_no}"

        if txn_type == 1: # Sale Invoice
            invoice_payload = {
                "invoiceNumber": inv_no,
                "type": "tax-invoice",
                "invoiceDate": txn_date_str,
                "dueDate": due_date_str,
                "clientName": party_name,
                "clientId": party["id"],
                "subtotal": round(calc_subtotal, 2) if calc_subtotal > 0 else round(total_amt * 0.952, 2),
                "cgstAmount": round(calc_tax / 2, 2) if calc_tax > 0 else round(total_amt * 0.024, 2),
                "sgstAmount": round(calc_tax / 2, 2) if calc_tax > 0 else round(total_amt * 0.024, 2),
                "igstAmount": 0.0,
                "totalAmount": round(total_amt, 2),
                "status": status,
                "notes": t["txn_description"] or "",
                "items": items_payload,
                "options": {
                    "paidAmount": round(cash_amt, 2),
                    "status": status,
                    "currency": "INR",
                    "invoiceType": "tax-invoice"
                }
            }
            res = post_json("bills", invoice_payload)
            if res:
                migrated_sales += 1

        elif txn_type == 2: # Purchase
            purchase_payload = {
                "billNumber": f"PUR-{ref_no.zfill(4)}" if ref_no.isdigit() else f"PUR-{ref_no}",
                "vendorName": party_name,
                "purchaseDate": txn_date_str,
                "dueDate": due_date_str,
                "totalAmount": round(total_amt, 2),
                "paidAmount": round(cash_amt, 2),
                "status": status,
                "notes": t["txn_description"] or "",
                "paymentMode": "cash" if cash_amt > 0 else "bank-transfer"
            }
            res = post_json("purchases", purchase_payload)
            if res:
                migrated_purchases += 1

    print(f"\nMigration Completed!")
    print(f"  - Company Profile: Sri Raani Dry Fruits Traders")
    print(f"  - Inventory Items: {migrated_items} products imported")
    print(f"  - Parties: {migrated_clients} clients imported")
    print(f"  - Sales Invoices: {migrated_sales} invoices imported")
    print(f"  - Purchases: {migrated_purchases} purchases imported")

    conn.close()

if __name__ == "__main__":
    migrate()
