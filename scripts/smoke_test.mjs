// End-to-End Smoke Test for Spring Boot Microservices through API Gateway
const GATEWAY_BASE = 'http://localhost:8089';

async function runTest() {
  console.log('🚀 Starting Microservices End-to-End Smoke Test through API Gateway: ' + GATEWAY_BASE);
  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      process.stdout.write(`  • ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log('❌ FAIL: ' + err.message);
      failed++;
    }
  }

  // 1. Version Check
  await check('GET /api/v1/version', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/version`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok || !data.current) throw new Error('Invalid version response: ' + JSON.stringify(data));
  });

  // 2. Atomic Counter Increment
  let nextVal;
  await check('POST /api/v1/meta/invoice_counter/increment', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/meta/invoice_counter/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (typeof data.value !== 'number') throw new Error('Expected number value: ' + JSON.stringify(data));
    nextVal = data.value;
  });

  // 3. Read Counter Value
  await check('GET /api/v1/meta/invoice_counter', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/meta/invoice_counter`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.value !== nextVal) throw new Error(`Expected ${nextVal}, got ${data.value}`);
  });

  // 4. Client CRUD with Lossless Custom Field
  let clientId;
  await check('POST /api/v1/clients (with custom dynamic field)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Test Client Ltd',
        gstin: '29ABCDE1234F1Z5',
        city: 'Bengaluru',
        custom_gst_category: 'Special Economic Zone Unit'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const client = await res.json();
    if (!client.id) throw new Error('Client id missing');
    if (client.custom_gst_category !== 'Special Economic Zone Unit') {
      throw new Error('Lossless extra field custom_gst_category was not preserved');
    }
    clientId = client.id;
  });

  // 5. Query Clients
  await check('GET /api/v1/clients', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/clients`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.some(c => c.id === clientId)) {
      throw new Error('Created client not found in list');
    }
  });

  // 6. Product in Inventory Service with dynamic SKU/Barcode
  let productId;
  await check('POST /api/v1/products (via inventory-service with dynamic fields)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Cloud Gateway Appliance',
        hsn: '8471',
        sellingPrice: 15000.00,
        purchasePrice: 10000.00,
        rate: 15000.00,
        taxPercent: 18.00,
        stock: 50.00,
        unit: 'PCS',
        barcode: '8901234567890',
        brand: 'CloudTech'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const prod = await res.json();
    if (!prod.id) throw new Error('Product id missing');
    if (prod.barcode !== '8901234567890' || prod.brand !== 'CloudTech') {
      throw new Error('Lossless extra fields barcode/brand were not preserved');
    }
    productId = prod.id;
  });

  // 7. Query Products
  await check('GET /api/v1/products', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.some(p => p.id === productId)) {
      throw new Error('Created product not found in inventory list');
    }
  });

  // 8. Create Invoice in Accounting Service
  let invoiceId;
  await check('POST /api/v1/bills (create invoice with dynamic options)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: 'INV/2026-27/' + String(nextVal).padStart(4, '0'),
        type: 'tax-invoice',
        clientName: 'Smoke Test Client Ltd',
        clientId: clientId,
        subtotal: 15000.00,
        cgstAmount: 1350.00,
        sgstAmount: 1350.00,
        igstAmount: 0.00,
        totalAmount: 17700.00,
        status: 'unpaid',
        options: {
          currency: 'INR',
          poNumber: 'PO-2026-99',
          deliveryChallanNo: 'DC-884'
        },
        items: [
          {
            productId: productId,
            name: 'Enterprise Cloud Gateway Appliance',
            hsn: '8471',
            quantity: 1,
            rate: 15000.00,
            taxPercent: 18.00,
            amount: 17700.00
          }
        ]
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const inv = await res.json();
    if (!inv.id) throw new Error('Invoice id missing');
    invoiceId = inv.id;
  });

  // 9. Query Invoices
  await check('GET /api/v1/bills', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/bills`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.some(b => b.id === invoiceId)) {
      throw new Error('Created bill not found in bills list');
    }
  });

  // 10. Soft-delete Invoice to Trash
  await check(`DELETE /api/v1/bills/${invoiceId} (soft delete)`, async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/bills/${invoiceId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
  });

  // 11. Verify Bill in Trash
  await check('GET /api/v1/trash (verify soft-deleted bill)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/trash`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const trash = await res.json();
    if (!Array.isArray(trash) || !trash.some(b => b.id === invoiceId)) {
      throw new Error('Bill not found in trash');
    }
  });

  // 12. Restore Bill from Trash
  await check(`POST /api/v1/trash/${invoiceId}/restore`, async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/trash/${invoiceId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Restore failed');
  });

  // 13. Verify Restored in Bills
  await check('GET /api/v1/bills (verify restored)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/bills`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || !list.some(b => b.id === invoiceId)) {
      throw new Error('Restored bill not found in active bills list');
    }
  });

  // 14. Trigger Snapshot Backup
  await check('POST /api/v1/backups/now', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/backups/now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Backup failed: ' + JSON.stringify(data));
  });

  // 15. Query Backups List
  await check('GET /api/v1/backups', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/backups`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) throw new Error('No backups returned');
  });

  // 16. Export All Microservice Data
  await check('GET /api/v1/export (export full JSON bundle)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/export`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bundle = await res.json();
    if (!bundle.__freegstbill_backup || !Array.isArray(bundle.bills)) {
      throw new Error('Invalid export bundle structure');
    }
  });

  // 17. Auth Service Login via Gateway
  await check('POST /api/v1/auth/login (JWT token issuance)', async () => {
    const res = await fetch(`${GATEWAY_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@system.com', password: 'admin123' })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token || !data.token.startsWith('ey')) {
      throw new Error('Valid JWT token was not returned');
    }
  });

  console.log('\n==================================================');
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('==================================================');
  if (failed > 0) process.exit(1);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
