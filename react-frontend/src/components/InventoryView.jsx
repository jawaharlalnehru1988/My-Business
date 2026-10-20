import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Package, Search, Plus, Edit3, Trash2, X, Save, Upload, QrCode, Printer, 
  SlidersHorizontal, AlertTriangle, TrendingUp, TrendingDown, Layers, 
  Calendar, DollarSign, CheckCircle, FileText, ArrowUpRight, ArrowDownLeft, 
  Download, RefreshCw, Filter, Tag, Info, MapPin, Briefcase, Scale, ArrowRightLeft
} from 'lucide-react';
import { 
  getAllProducts, saveProduct, deleteProduct, getProfile, 
  getStockAlertSettings, getAllBills, getAllPurchases 
} from '../store';
import { getAllUnits, getCountryConfig, formatCurrency } from '../utils';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

const emptyForm = {
  name: '', 
  sku: '', 
  hsn: '', 
  category: '',
  purchasePrice: '', 
  purchasePriceTaxType: 'without_tax',
  sellingPrice: '', 
  salePriceTaxType: 'without_tax',
  wholesalePrice: '',
   wholesalePriceTaxType: 'without_tax',
  minWholesaleQty: '',
  mrp: '',
  taxPercent: '18', 
  cessPercent: '0',
  unit: 'Kg', 
  secondaryUnit: '',
  conversionRate: '',
  stock: '0', 
  openingStock: '0',
  openingStockPrice: '',
  openingStockDate: new Date().toISOString().split('T')[0],
  minStock: '5',
  location: '',
  description: '', 
  type: 'PHYSICAL' // 'PHYSICAL' | 'SERVICE'
};

// Smart default conversion rates matching Vyapar's kb_item_units_mapping
const DEFAULT_UNIT_CONVERSIONS = {
  'KG_GM': 1000,
  'KGS_GMS': 1000,
  'GM_KG': 0.001,
  'LTR_ML': 1000,
  'ML_LTR': 0.001,
  'QTL_KG': 100,
  'TON_KG': 1000,
  'DZN_NOS': 12,
  'DZN_PCS': 12,
  'BOX_PCS': 10,
  'BOX_NOS': 10,
  'CTN_BOX': 12,
  'BAG_KG': 50,
  'PAC_GM': 250,
};

function getSmartConversionRate(baseU, secU) {
  if (!baseU || !secU) return '';
  const b = String(baseU).trim().toUpperCase();
  const s = String(secU).trim().toUpperCase();
  if (b === s) return '1';
  const key = `${b}_${s}`;
  if (DEFAULT_UNIT_CONVERSIONS[key]) return String(DEFAULT_UNIT_CONVERSIONS[key]);
  if ((b.startsWith('KG') && s.startsWith('GM')) || (b.startsWith('KILO') && s.startsWith('GRAM'))) return '1000';
  if ((b.startsWith('LTR') && s.startsWith('ML')) || (b.startsWith('LIT') && s.startsWith('MIL'))) return '1000';
  if (b.startsWith('DZN') || b.startsWith('DOZ')) return '12';
  if (b.startsWith('QTL') && s.startsWith('KG')) return '100';
  return '10';
}

const ADJUSTMENT_REASONS = [
  'Physical Stock Count / Audit Difference',
  'Damaged / Broken Goods',
  'Expired / Spoiled Goods',
  'Theft / Lost in Transit',
  'Returned to Vendor (Scrap)',
  'Internal / Office Consumption',
  'Opening Stock Correction',
  'Sample / Promotional Giveaway',
  'Other'
];

export default function InventoryView() {
  const [products, setProducts] = useState([]);
  const [bills, setBills] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  
  // Top Vyapar Hub Mode: 'PRODUCTS' | 'SERVICES' | 'CATEGORIES' | 'UNITS'
  const [hubTab, setHubTab] = useState('PRODUCTS');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name_asc'); // 'name_asc', 'stock_asc', 'stock_desc', 'value_desc'

  // Right-pane Stock Ledger filters
  const [txnSearch, setTxnSearch] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState('ALL'); // 'ALL' | 'SALE' | 'PURCHASE' | 'RETURN' | 'ADJUSTMENT'

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [formModalTab, setFormModalTab] = useState('pricing'); // 'pricing' | 'stock'
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedQrProduct, setSelectedQrProduct] = useState(null);
  const [codeType, setCodeType] = useState('barcode'); // 'barcode', 'qr', 'both'

  // Stock Adjustment Form (Vyapar kb_item_adjustments parity)
  const [adjType, setAdjType] = useState('ADD'); // 'ADD' | 'REDUCE'
  const [adjQty, setAdjQty] = useState('');
  const [adjUnit, setAdjUnit] = useState(''); // Base or Secondary unit
  const [adjAtPrice, setAdjAtPrice] = useState('');
  const [adjReason, setAdjReason] = useState(ADJUSTMENT_REASONS[0]);
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjRemarks, setAdjRemarks] = useState('');

  // Custom Category / Unit Quick Creation in Hub Tabs
  const [selectedCategoryMaster, setSelectedCategoryMaster] = useState(null);
  const [selectedUnitMaster, setSelectedUnitMaster] = useState(null);

  // Settings & Profile
  const [units, setUnits] = useState(() =>
    (getAllUnits() || []).map(u => typeof u === 'string' ? u : (u.label || u.uqc || u.code || 'Nos'))
  );
  const [profile, setProfile] = useState(null);
  const [profileCountry, setProfileCountry] = useState('India');
  const [stockAlerts, setStockAlerts] = useState({ enabled: true, threshold: 5 });
  const [, setLoading] = useState(true);

  const csvInputRef = useRef(null);
  const profileCurrency = getCountryConfig(profileCountry).currency;

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodData, billData, purData, profData, alertData] = await Promise.all([
        getAllProducts().catch(() => []),
        getAllBills().catch(() => []),
        getAllPurchases().catch(() => []),
        getProfile().catch(() => null),
        getStockAlertSettings().catch(() => ({ enabled: true, threshold: 5 }))
      ]);

      const prods = Array.isArray(prodData) ? prodData : [];
      setProducts(prods);
      setBills(Array.isArray(billData) ? billData : []);
      setPurchases(Array.isArray(purData) ? purData : []);
      if (profData) {
        setProfile(profData);
        if (profData.country) setProfileCountry(profData.country);
      }
      if (alertData) setStockAlerts(alertData);

      // Load persistent stock adjustments
      const savedAdj = localStorage.getItem('vyapar_stock_adjustments');
      if (savedAdj) {
        try { setAdjustments(JSON.parse(savedAdj)); } catch { setAdjustments([]); }
      }

      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id);
      }
    } catch {
      toast('Failed to load inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const baseUnits = (getAllUnits() || []).map(u => typeof u === 'string' ? u : (u.label || u.uqc || u.code || 'Nos'));
    const vyaparUnits = ['Kg', 'Gm', 'Nos', 'Pcs', 'Pac', 'Box', 'Bag', 'Btl', 'Ctn', 'Dzn', 'Ltr', 'Ml', 'Qtl', 'Ton', 'Mtr', 'Set'];
    const merged = Array.from(new Set([...vyaparUnits, ...baseUnits]));
    setUnits(merged);
  }, []);

  // Selected Product
  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(selectedProductId)) || products[0] || null;
  }, [products, selectedProductId]);

  // Categories list with stats
  const categories = useMemo(() => {
    const cats = new Set(['Dry Fruits', 'Seeds', 'Spices', 'Snacks', 'Sweets / Burfi', 'Chocolates', 'Ghee & Oils', 'Gift Packs']);
    products.forEach(p => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats);
  }, [products]);

  const categorySummaryList = useMemo(() => {
    const map = new Map();
    categories.forEach(c => map.set(c, { name: c, count: 0, stockValue: 0, items: [] }));
    const uncategorized = { name: 'Uncategorized', count: 0, stockValue: 0, items: [] };

    products.forEach(p => {
      const cat = (p.category || '').trim();
      const qty = Math.max(0, Number(p.stock) || 0);
      const cost = Number(p.purchasePrice) || Number(p.rate) || 0;
      if (cat && map.has(cat)) {
        const entry = map.get(cat);
        entry.count += 1;
        entry.stockValue += qty * cost;
        entry.items.push(p);
      } else {
        uncategorized.count += 1;
        uncategorized.stockValue += qty * cost;
        uncategorized.items.push(p);
      }
    });

    const list = Array.from(map.values()).filter(c => c.count > 0 || ['Dry Fruits', 'Seeds', 'Snacks', 'Chocolates'].includes(c.name));
    if (uncategorized.count > 0) list.push(uncategorized);
    return list;
  }, [products, categories]);

  // Units summary for UNITS Hub tab
  const unitSummaryList = useMemo(() => {
    const map = new Map();
    units.forEach(u => map.set(u.toUpperCase(), { unit: u, count: 0, conversions: new Set(), items: [] }));
    products.forEach(p => {
      const u = (p.unit || 'Nos').trim().toUpperCase();
      if (!map.has(u)) map.set(u, { unit: p.unit || 'Nos', count: 0, conversions: new Set(), items: [] });
      const entry = map.get(u);
      entry.count += 1;
      entry.items.push(p);
      if (p.secondaryUnit && Number(p.conversionRate) > 0) {
        entry.conversions.add(`1 ${p.unit} = ${p.conversionRate} ${p.secondaryUnit}`);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [products, units]);

  // Summary Metrics
  const summary = useMemo(() => {
    const threshold = Number(stockAlerts.threshold ?? 5);
    let totalStockValPurchase = 0;
    let totalStockValSelling = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let serviceCount = 0;
    let physicalCount = 0;

    products.forEach(p => {
      const isService = p.type === 'SERVICE';
      if (isService) {
        serviceCount++;
        return;
      }
      physicalCount++;
      const qty = Number(p.stock) || 0;
      const itemMin = Number(p.minStock ?? threshold);
      const pPrice = Number(p.purchasePrice) || Number(p.rate) || 0;
      const sPrice = Number(p.sellingPrice) || Number(p.rate) || 0;

      totalStockValPurchase += (qty > 0 ? qty * pPrice : 0);
      totalStockValSelling += (qty > 0 ? qty * sPrice : 0);

      if (qty <= 0) {
        outOfStockCount++;
      } else if (stockAlerts.enabled !== false && qty <= itemMin) {
        lowStockCount++;
        inStockCount++;
      } else {
        inStockCount++;
      }
    });

    return {
      totalItems: products.length,
      physicalCount,
      serviceCount,
      totalStockValPurchase,
      totalStockValSelling,
      inStockCount,
      lowStockCount,
      outOfStockCount
    };
  }, [products, stockAlerts]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const threshold = Number(stockAlerts.threshold ?? 5);

    let list = products.filter(p => {
      const isService = p.type === 'SERVICE';
      if (hubTab === 'SERVICES' && !isService) return false;
      if (hubTab === 'PRODUCTS' && isService) return false;

      // Search text
      const matchesSearch = !q || (
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.hsn || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && (p.category || '').trim() !== categoryFilter) {
        return false;
      }

      // Status filter (only for physical products)
      if (!isService) {
        const qty = Number(p.stock) || 0;
        const itemMin = Number(p.minStock ?? threshold);
        if (statusFilter === 'IN_STOCK') return qty > 0;
        if (statusFilter === 'LOW_STOCK') return qty > 0 && qty <= itemMin;
        if (statusFilter === 'OUT_OF_STOCK') return qty <= 0;
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'stock_asc') return (Number(a.stock) || 0) - (Number(b.stock) || 0);
      if (sortBy === 'stock_desc') return (Number(b.stock) || 0) - (Number(a.stock) || 0);
      if (sortBy === 'value_desc') {
        const valA = (Number(a.stock) || 0) * (Number(a.sellingPrice || a.rate) || 0);
        const valB = (Number(b.stock) || 0) * (Number(b.sellingPrice || b.rate) || 0);
        return valB - valA;
      }
      return 0;
    });

    return list;
  }, [products, search, statusFilter, categoryFilter, sortBy, stockAlerts, hubTab]);

  // Stock Transactions & Item-Wise Profit for Selected Product
  const { itemTransactions, itemProfitStats } = useMemo(() => {
    if (!selectedProduct) return { itemTransactions: [], itemProfitStats: { soldQty: 0, salesRevenue: 0, estProfit: 0 } };
    const txns = [];
    const prodName = (selectedProduct.name || '').trim().toLowerCase();
    const prodSku = (selectedProduct.sku || '').trim().toLowerCase();
    const prodId = String(selectedProduct.id);
    const baseUnit = (selectedProduct.unit || 'Nos').trim();
    const secUnit = (selectedProduct.secondaryUnit || '').trim();
    const convRate = Number(selectedProduct.conversionRate) || 0;
    const avgCost = Number(selectedProduct.purchasePrice) || 0;

    let soldQtyBase = 0;
    let salesRevenue = 0;
    let estProfit = 0;

    // Helper: convert line item qty to Base Unit if billed in Secondary Unit
    const toBaseQty = (qty, lineUnit) => {
      const q = Number(qty) || 0;
      if (secUnit && convRate > 0 && String(lineUnit || '').trim().toUpperCase() === secUnit.toUpperCase()) {
        return q / convRate;
      }
      return q;
    };

    // 0. Opening Stock Entry (if configured)
    const openQty = Number(selectedProduct.openingStock) || 0;
    if (openQty > 0) {
      const openRate = Number(selectedProduct.openingStockPrice || selectedProduct.purchasePrice || 0);
      txns.push({
        id: `open-${prodId}`,
        type: 'ADJUSTMENT',
        typeLabel: 'Opening Stock',
        date: selectedProduct.openingStockDate || '2026-04-01',
        refNo: 'OPEN-STK',
        partyName: selectedProduct.location ? `Location: ${selectedProduct.location}` : 'Opening Inventory',
        qtyChange: +openQty,
        displayQty: `+ ${openQty} ${baseUnit}`,
        rate: openRate,
        amount: openQty * openRate,
        status: 'Recorded'
      });
    }

    // 1. Sales & Credit Notes from Invoices
    (bills || []).forEach(bill => {
      if (bill.type === 'proforma' || bill.type === 'estimate' || bill.type === 'delivery-challan') return;
      const isCreditNote = bill.type === 'credit-note' || bill.docType === 'credit-note';
      (bill.items || []).forEach((item, idx) => {
        const iName = (item.name || item.description || '').trim().toLowerCase();
        const iSku = (item.sku || '').trim().toLowerCase();
        if (iName === prodName || (prodSku && iSku === prodSku) || (item.productId && String(item.productId) === prodId)) {
          const rawQty = Number(item.quantity) || 0;
          const lineUnit = item.unit || baseUnit;
          const baseQty = toBaseQty(rawQty, lineUnit);
          const rate = Number(item.rate) || 0;
          const lineTotal = Number(item.amount) || (rawQty * rate);

          if (!isCreditNote) {
            soldQtyBase += baseQty;
            salesRevenue += lineTotal;
            estProfit += (lineTotal - (baseQty * avgCost));
          } else {
            soldQtyBase = Math.max(0, soldQtyBase - baseQty);
            salesRevenue -= lineTotal;
            estProfit -= (lineTotal - (baseQty * avgCost));
          }

          txns.push({
            id: `sale-${bill.id || bill.invoiceNumber}-${idx}`,
            type: isCreditNote ? 'RETURN' : 'SALE',
            typeLabel: isCreditNote ? 'Credit Note (Return)' : 'Sale Invoice',
            date: bill.invoiceDate || bill.date || '',
            refNo: bill.invoiceNumber || 'INV',
            partyName: bill.clientName || 'Walk-in Customer',
            qtyChange: isCreditNote ? +baseQty : -baseQty,
            displayQty: `${isCreditNote ? '+' : '-'} ${rawQty} ${lineUnit}${lineUnit.toUpperCase() !== baseUnit.toUpperCase() ? ` (${baseQty.toFixed(3)} ${baseUnit})` : ''}`,
            rate: rate,
            amount: lineTotal,
            status: bill.status || 'paid'
          });
        }
      });
    });

    // 2. Purchases & Debit Notes from Purchase Bills
    (purchases || []).forEach(pur => {
      if (pur.docType === 'purchase-order' || pur.docType === 'payment-out') return;
      const isDebitNote = pur.docType === 'purchase-return';
      (pur.items || []).forEach((item, idx) => {
        const iName = (item.name || '').trim().toLowerCase();
        if (iName === prodName || (item.productId && String(item.productId) === prodId)) {
          const rawQty = Number(item.quantity) || 0;
          const lineUnit = item.unit || baseUnit;
          const baseQty = toBaseQty(rawQty, lineUnit);
          const rate = Number(item.rate) || 0;
          txns.push({
            id: `pur-${pur.id || pur.invoiceNumber}-${idx}`,
            type: isDebitNote ? 'RETURN' : 'PURCHASE',
            typeLabel: isDebitNote ? 'Debit Note (Return)' : 'Purchase Bill',
            date: pur.date || '',
            refNo: pur.invoiceNumber || 'PUR',
            partyName: pur.supplierName || 'Supplier',
            qtyChange: isDebitNote ? -baseQty : +baseQty,
            displayQty: `${isDebitNote ? '-' : '+'} ${rawQty} ${lineUnit}${lineUnit.toUpperCase() !== baseUnit.toUpperCase() ? ` (${baseQty.toFixed(3)} ${baseUnit})` : ''}`,
            rate: rate,
            amount: (rawQty * rate),
            status: pur.paymentStatus || 'Paid'
          });
        }
      });
    });

    // 3. Stock Adjustments
    (adjustments || []).forEach(adj => {
      const adjProdName = (adj.productName || '').trim().toLowerCase();
      if (String(adj.productId) === prodId || adjProdName === prodName) {
        const isAdd = adj.type === 'ADD';
        const qty = Number(adj.quantity) || 0;
        const rate = Number(adj.atPrice ?? selectedProduct.purchasePrice ?? selectedProduct.rate ?? 0);
        txns.push({
          id: adj.id,
          type: 'ADJUSTMENT',
          typeLabel: `Adjustment (${isAdd ? '+ Add' : '- Reduce'})`,
          date: adj.date || '',
          refNo: adj.reason || 'Manual Adjustment',
          partyName: adj.remarks ? `Note: ${adj.remarks}` : adj.reason,
          qtyChange: isAdd ? +qty : -qty,
          displayQty: `${isAdd ? '+' : '-'} ${qty} ${adj.displayUnit || baseUnit}`,
          rate: rate,
          amount: qty * rate,
          status: 'Recorded'
        });
      }
    });

    // Sort oldest first to compute chronological running stock balance, then reverse
    const chronological = [...txns].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    let runningStock = 0;
    chronological.forEach(t => {
      runningStock += Number(t.qtyChange) || 0;
      t.runningStock = Math.round(runningStock * 1000) / 1000;
    });

    return {
      itemTransactions: chronological.reverse(),
      itemProfitStats: {
        soldQty: Math.round(soldQtyBase * 1000) / 1000,
        salesRevenue,
        estProfit
      }
    };
  }, [selectedProduct, bills, purchases, adjustments]);

  const filteredItemTransactions = useMemo(() => {
    const q = txnSearch.trim().toLowerCase();
    return itemTransactions.filter(t => {
      if (txnTypeFilter !== 'ALL' && t.type !== txnTypeFilter) return false;
      if (!q) return true;
      return (
        (t.refNo || '').toLowerCase().includes(q) ||
        (t.partyName || '').toLowerCase().includes(q) ||
        (t.typeLabel || '').toLowerCase().includes(q) ||
        (t.date || '').toLowerCase().includes(q)
      );
    });
  }, [itemTransactions, txnSearch, txnTypeFilter]);

  // Form Handlers
  const openAdd = (defaultType = 'PHYSICAL', presetCategory = '') => {
    setForm({ 
      ...emptyForm, 
      type: defaultType,
      category: presetCategory || '',
      sku: `ITEM-${Math.floor(10000 + Math.random() * 90000)}`,
      minStock: String(stockAlerts.threshold ?? 5)
    });
    setFormModalTab('pricing');
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (product) => {
    setForm({
      name: product.name || '',
      sku: product.sku || product.barcode || '',
      category: product.category || '',
      hsn: product.hsn || '',
      purchasePrice: product.purchasePrice != null ? String(product.purchasePrice) : '',
      purchasePriceTaxType: product.purchasePriceTaxType || 'without_tax',
      sellingPrice: product.sellingPrice != null ? String(product.sellingPrice) : (product.rate != null ? String(product.rate) : ''),
      salePriceTaxType: product.salePriceTaxType || 'without_tax',
      wholesalePrice: product.wholesalePrice != null ? String(product.wholesalePrice) : '',
      wholesalePriceTaxType: product.wholesalePriceTaxType || 'without_tax',
      minWholesaleQty: product.minWholesaleQty != null ? String(product.minWholesaleQty) : '',
      mrp: product.mrp != null ? String(product.mrp) : '',
      taxPercent: product.taxPercent != null ? String(product.taxPercent) : '18',
      cessPercent: product.cessPercent != null ? String(product.cessPercent) : '0',
      unit: product.unit || 'Kg',
      secondaryUnit: product.secondaryUnit || '',
      conversionRate: product.conversionRate != null ? String(product.conversionRate) : '',
      stock: product.stock != null ? String(product.stock) : '0',
      openingStock: product.openingStock != null ? String(product.openingStock) : (product.stock != null ? String(product.stock) : '0'),
      openingStockPrice: product.openingStockPrice != null ? String(product.openingStockPrice) : (product.purchasePrice != null ? String(product.purchasePrice) : ''),
      openingStockDate: product.openingStockDate || new Date().toISOString().split('T')[0],
      minStock: product.minStock != null ? String(product.minStock) : String(stockAlerts.threshold ?? 5),
      location: product.location || '',
      description: product.description || '',
      type: product.type || 'PHYSICAL'
    });
    setFormModalTab('pricing');
    setEditingId(product.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setShowUnitModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      toast('Item name is required', 'warning');
      return;
    }

    try {
      const sellingPrice = form.sellingPrice ? parseFloat(form.sellingPrice) : 0;
      const purchasePrice = form.purchasePrice ? parseFloat(form.purchasePrice) : 0;
      const wholesalePrice = form.wholesalePrice ? parseFloat(form.wholesalePrice) : 0;
      const minWholesaleQty = form.minWholesaleQty ? parseFloat(form.minWholesaleQty) : 0;
      const mrp = form.mrp ? parseFloat(form.mrp) : 0;
      const conversionRate = form.secondaryUnit && form.conversionRate ? parseFloat(form.conversionRate) : 0;

      const product = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        sku: form.sku.trim() || `ITEM-${Math.floor(10000 + Math.random() * 90000)}`,
        category: form.category.trim(),
        hsn: form.hsn.trim(),
        purchasePrice,
        purchasePriceTaxType: form.purchasePriceTaxType || 'without_tax',
        sellingPrice,
        salePriceTaxType: form.salePriceTaxType || 'without_tax',
        wholesalePrice,
        wholesalePriceTaxType: form.wholesalePriceTaxType || 'without_tax',
        minWholesaleQty,
        mrp,
        rate: sellingPrice,
        taxPercent: form.taxPercent ? parseFloat(form.taxPercent) : 0,
        cessPercent: form.cessPercent ? parseFloat(form.cessPercent) : 0,
        unit: form.unit || 'Kg',
        secondaryUnit: form.secondaryUnit || '',
        conversionRate,
        stock: form.type === 'SERVICE' ? 0 : (form.stock ? parseFloat(form.stock) : 0),
        openingStock: form.type === 'SERVICE' ? 0 : (form.openingStock ? parseFloat(form.openingStock) : 0),
        openingStockPrice: form.openingStockPrice ? parseFloat(form.openingStockPrice) : purchasePrice,
        openingStockDate: form.openingStockDate || new Date().toISOString().split('T')[0],
        minStock: form.minStock ? parseFloat(form.minStock) : 5,
        location: form.location.trim(),
        description: form.description.trim(),
        type: form.type || 'PHYSICAL'
      };

      const saved = await saveProduct(product);
      toast(editingId ? 'Item updated successfully' : 'Item added to catalog', 'success');
      closeForm();
      await loadData();
      if (saved?.id) setSelectedProductId(saved.id);
    } catch {
      toast('Failed to save item', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (await confirmAction({
      title: 'Delete this item?',
      message: 'Past invoices and purchases that included this item will retain their line items. This removes the item from your live catalog.',
      confirmLabel: 'Delete Item',
      tone: 'danger',
    })) {
      try {
        await deleteProduct(id);
        toast('Item removed from catalog', 'success');
        await loadData();
      } catch {
        toast('Failed to delete item', 'error');
      }
    }
  };

  // Stock Adjustment Handlers (Supports Base or Secondary Unit + At Price)
  const openAdjustStock = () => {
    if (!selectedProduct) return;
    setAdjType('ADD');
    setAdjQty('');
    setAdjUnit(selectedProduct.unit || 'Kg');
    setAdjAtPrice(String(selectedProduct.purchasePrice || selectedProduct.rate || 0));
    setAdjReason(ADJUSTMENT_REASONS[0]);
    setAdjDate(new Date().toISOString().split('T')[0]);
    setAdjRemarks('');
    setShowAdjustModal(true);
  };

  const handleSaveAdjustment = async (e) => {
    if (e) e.preventDefault();
    const rawQty = parseFloat(adjQty);
    if (!rawQty || rawQty <= 0) {
      toast('Please enter a valid positive quantity', 'warning');
      return;
    }

    try {
      const currentStock = Number(selectedProduct.stock) || 0;
      const isAdd = adjType === 'ADD';
      const isSecUnit = selectedProduct.secondaryUnit &&
        Number(selectedProduct.conversionRate) > 0 &&
        adjUnit === selectedProduct.secondaryUnit;
      const qtyInBaseUnit = isSecUnit
        ? rawQty / Number(selectedProduct.conversionRate)
        : rawQty;

      const newStock = Math.round((isAdd ? (currentStock + qtyInBaseUnit) : Math.max(0, currentStock - qtyInBaseUnit)) * 1000) / 1000;

      // 1. Update Product in store
      const updatedProduct = {
        ...selectedProduct,
        stock: newStock
      };
      await saveProduct(updatedProduct);

      // 2. Log Adjustment Record
      const newAdjEntry = {
        id: `ADJ-${Date.now()}`,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        type: adjType,
        quantity: qtyInBaseUnit,
        rawQuantity: rawQty,
        displayUnit: adjUnit || selectedProduct.unit || 'Kg',
        atPrice: parseFloat(adjAtPrice) || Number(selectedProduct.purchasePrice || 0),
        previousStock: currentStock,
        newStock: newStock,
        reason: adjReason,
        remarks: adjRemarks.trim(),
        date: adjDate,
        createdAt: new Date().toISOString()
      };

      const updatedAdjustments = [newAdjEntry, ...adjustments];
      setAdjustments(updatedAdjustments);
      localStorage.setItem('vyapar_stock_adjustments', JSON.stringify(updatedAdjustments));

      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? updatedProduct : p));

      toast(`Stock adjusted! New stock: ${newStock} ${selectedProduct.unit || 'Kg'}`, 'success');
      setShowAdjustModal(false);
    } catch {
      toast('Failed to record stock adjustment', 'error');
    }
  };

  // Export Active Item Stock Ledger CSV
  const exportItemLedgerCSV = () => {
    if (!selectedProduct || !filteredItemTransactions.length) {
      toast('No stock transactions to export for this item', 'warning');
      return;
    }
    const headers = ['Type', 'Date', 'Ref / Invoice No', 'Party / Details', 'Qty Change', 'Unit Price', 'Total Value', 'Running Stock'];
    const rows = filteredItemTransactions.map(t => [
      `"${t.typeLabel}"`,
      `"${t.date || ''}"`,
      `"${(t.refNo || '').replace(/"/g, '""')}"`,
      `"${(t.partyName || '').replace(/"/g, '""')}"`,
      `"${t.displayQty || t.qtyChange}"`,
      Number(t.rate || 0).toFixed(2),
      Number(t.amount || 0).toFixed(2),
      `${t.runningStock ?? ''} ${selectedProduct.unit || ''}`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(selectedProduct.name || 'Item').replace(/\s+/g, '_')}_Stock_Ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Item Stock Ledger CSV downloaded', 'success');
  };

  // CSV Export & Import
  const exportStockCSV = () => {
    if (!products.length) {
      toast('No products to export', 'warning');
      return;
    }

    const headers = [
      'Product Name', 'Item Code / SKU', 'Category', 'HSN / SAC', 'Stock Qty', 'Base Unit',
      'Secondary Unit', 'Conversion Rate', 'Purchase Price', 'Sale Price', 'Wholesale Price',
      'Min Wholesale Qty', 'MRP', 'GST %', 'Location / Rack', 'Stock Valuation (Purchase)', 'Stock Valuation (Sale)'
    ];
    const rows = products.map(p => {
      const qty = Number(p.stock) || 0;
      const pPrice = Number(p.purchasePrice) || Number(p.rate) || 0;
      const sPrice = Number(p.sellingPrice) || Number(p.rate) || 0;
      return [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${p.sku || ''}"`,
        `"${(p.category || '').replace(/"/g, '""')}"`,
        `"${p.hsn || ''}"`,
        qty,
        `"${p.unit || 'Kg'}"`,
        `"${p.secondaryUnit || ''}"`,
        p.conversionRate || '',
        pPrice,
        sPrice,
        p.wholesalePrice || 0,
        p.minWholesaleQty || 0,
        p.mrp || 0,
        p.taxPercent || 0,
        `"${(p.location || '').replace(/"/g, '""')}"`,
        (qty * pPrice).toFixed(2),
        (qty * sPrice).toFixed(2)
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Stock_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Stock Summary CSV downloaded', 'success');
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('CSV file is empty or has no data rows', 'warning'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
        const name = row.name || row.product || row['product name'] || row['item name'] || '';
        if (!name) continue;
        const sellingPrice = parseFloat(row.sellingprice || row['sale price'] || row.rate || row.price || 0) || 0;
        const purchasePrice = parseFloat(row.purchaseprice || row['purchase price'] || row.cost || 0) || 0;
        const wholesalePrice = parseFloat(row.wholesaleprice || row['wholesale price'] || 0) || 0;
        const minWholesaleQty = parseFloat(row.minwholesaleqty || row['min wholesale qty'] || 0) || 0;
        const mrp = parseFloat(row.mrp || 0) || 0;
        const baseUnit = row.unit || row['base unit'] || 'Kg';
        const secondaryUnit = row.secondaryunit || row['secondary unit'] || '';
        const conversionRate = parseFloat(row.conversionrate || row['conversion rate'] || 0) || 0;

        await saveProduct({
          name,
          sku: row.sku || row['item code / sku'] || row.barcode || `ITEM-${Math.floor(10000 + Math.random() * 90000)}`,
          category: row.category || '',
          hsn: row.hsn || row['hsn / sac'] || row['hsn code'] || row['sac'] || '',
          sellingPrice,
          purchasePrice,
          wholesalePrice,
          minWholesaleQty,
          mrp,
          rate: sellingPrice,
          taxPercent: parseFloat(row.taxpercent || row['tax%'] || row['gst %'] || row['gst%'] || row['tax'] || 18) || 18,
          unit: baseUnit,
          secondaryUnit,
          conversionRate,
          stock: parseFloat(row.stock || row['stock qty'] || row.quantity || 0) || 0,
          location: row.location || row['location / rack'] || '',
          description: row.description || '',
          type: 'PHYSICAL'
        });
        imported++;
      }
      toast(`Imported ${imported} items successfully`, 'success');
      loadData();
    } catch {
      toast('Failed to parse CSV file', 'error');
    }
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // Barcode / QR Label Printing
  const printQrLabel = () => {
    const labelEl = document.getElementById('barcode-label');
    if (!labelEl) return;
    const win = window.open('', '', 'width=600,height=700');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Print Item Barcode Label</title>
            <style>
              body { font-family: sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
              .label-container { border: 1px dashed #ccc; padding: 16px; border-radius: 8px; text-align: center; width: 260px; background: white; }
              h4 { margin: 0 0 6px 0; font-size: 14px; color: #374151; }
              img { width: 120px; height: 120px; margin: 8px auto; display: block; }
              .sku { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
              .name { font-size: 12px; margin-bottom: 4px; color: #4b5563; }
              .price { font-size: 14px; font-weight: bold; color: #059669; }
            </style>
          </head>
          <body>
            ${labelEl.outerHTML}
            <script>
              setTimeout(() => { window.print(); window.close(); }, 500);
            </script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  // Code 128 Barcode Generator
  const RenderCode128Svg = ({ text }) => {
    if (!text) return null;
    const CODE128_PATTERNS = [
      "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
      "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
      "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
      "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
      "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
      "231131","312113","312311","332111","314111","221411","431111","111224","111422","121124",
      "121421","141122","141221","112214","112412","122114","122411","142112","142211","241211",
      "221114","411211","421112","421211","212141","214121","412121","111143","111341","131141",
      "114113","114311","411113","411311","113141","114131","311141","411131","211412","211214",
      "211232","2331112","211133","213113","213311","213131","311123","311321","313112","313311",
      "331112","331311","112141","114121","211141","214111","2331112"
    ];
    let checksum = 104;
    let patternStr = CODE128_PATTERNS[104] || "211141";
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i) - 32;
      const validCode = (code >= 0 && code <= 94) ? code : 0;
      patternStr += CODE128_PATTERNS[validCode] || "211141";
      checksum += validCode * (i + 1);
    }
    const checkDigit = checksum % 103;
    patternStr += CODE128_PATTERNS[checkDigit] || "211141";
    patternStr += "2331112";

    const barWidth = 1.8;
    const barHeight = 44;
    let currentX = 10;
    const rects = [];
    for (let i = 0; i < patternStr.length; i++) {
      const width = parseInt(patternStr[i], 10) * barWidth;
      if (i % 2 === 0) {
        rects.push(<rect key={i} x={currentX} y={0} width={width} height={barHeight} fill="#000" />);
      }
      currentX += width;
    }
    return (
      <svg width={currentX + 10} height={barHeight} viewBox={`0 0 ${currentX + 10} ${barHeight}`} style={{ maxWidth: '100%', height: 'auto' }}>
        {rects}
      </svg>
    );
  };

  const RenderQrCodeSvg = ({ value }) => {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <img 
          src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(value)}`} 
          alt="Item QR" 
          width="110" 
          height="110"
          style={{ borderRadius: '4px' }}
        />
      </div>
    );
  };

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.9rem' }}>
      
      {/* 0. VYAPAR DESKTOP TOP SUB-TABS: PRODUCTS | SERVICES | CATEGORIES | UNITS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '10px',
        border: '1px solid var(--border-color, #e5e7eb)',
        padding: '0 1rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {[
            { id: 'PRODUCTS', label: `PRODUCTS (${summary.physicalCount})`, icon: Package },
            { id: 'SERVICES', label: `SERVICES (${summary.serviceCount})`, icon: Briefcase },
            { id: 'CATEGORIES', label: `CATEGORIES (${categorySummaryList.length})`, icon: Tag },
            { id: 'UNITS', label: `UNITS (${unitSummaryList.length})`, icon: Scale },
          ].map(t => {
            const Icon = t.icon;
            const active = hubTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setHubTab(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.85rem 1.15rem',
                  border: 'none',
                  borderBottom: active ? '3px solid #dc2626' : '3px solid transparent',
                  background: 'transparent',
                  color: active ? '#dc2626' : 'var(--text-secondary, #4b5563)',
                  fontWeight: active ? 700 : 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  letterSpacing: '0.3px',
                  transition: 'all 0.15s ease'
                }}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0' }}>
          <button
            onClick={exportStockCSV}
            className="btn btn-secondary"
            title="Download full inventory CSV report"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            <Download size={14} /> Export Excel/CSV
          </button>

          <label
            className="btn btn-secondary"
            title="Import products from Excel/CSV"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
            <Upload size={14} /> Import Items
            <input
              type="file"
              ref={csvInputRef}
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCSVImport}
            />
          </label>

          <button
            onClick={() => openAdd(hubTab === 'SERVICES' ? 'SERVICE' : 'PHYSICAL')}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              fontSize: '0.83rem',
              fontWeight: 600,
              background: '#f59e0b',
              borderColor: '#f59e0b',
              color: '#ffffff',
              boxShadow: '0 2px 4px rgba(245,158,11,0.25)'
            }}>
            <Plus size={16} /> + Add {hubTab === 'SERVICES' ? 'Service' : 'Item'}
          </button>
        </div>
      </div>

      {/* 1. TOP SUMMARY RIBBON (Vyapar Desktop KPI Row) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Total Items */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '10px',
          padding: '0.85rem 1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '9px',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Catalog Items
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary, #111827)', lineHeight: 1.2 }}>
              {summary.totalItems}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 500, marginTop: '2px' }}>
              {summary.inStockCount} In Stock • {summary.serviceCount} Services
            </div>
          </div>
        </div>

        {/* Stock Valuation (Purchase) */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '10px',
          padding: '0.85rem 1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '9px',
            background: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stock Value (Purchase)
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
              {formatCurrency(summary.totalStockValPurchase, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
              Total inventory cost
            </div>
          </div>
        </div>

        {/* Stock Valuation (Selling) */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '10px',
          padding: '0.85rem 1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '9px',
            background: '#f5f3ff',
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stock Value (Sale)
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#7c3aed', lineHeight: 1.2 }}>
              {formatCurrency(summary.totalStockValSelling, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
              Est. sales realization
            </div>
          </div>
        </div>

        {/* Low / Out of Stock Alert Card */}
        <div 
          onClick={() => {
            setHubTab('PRODUCTS');
            setStatusFilter(summary.lowStockCount > 0 ? 'LOW_STOCK' : (summary.outOfStockCount > 0 ? 'OUT_OF_STOCK' : 'ALL'));
          }}
          style={{
            background: summary.lowStockCount > 0 || summary.outOfStockCount > 0 ? '#fffbeb' : 'var(--card-bg, #ffffff)',
            border: `1px solid ${summary.lowStockCount > 0 ? '#fde68a' : 'var(--border-color, #e5e7eb)'}`,
            borderRadius: '10px',
            padding: '0.85rem 1.1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '9px',
            background: summary.lowStockCount > 0 ? '#fef3c7' : '#fef2f2',
            color: summary.lowStockCount > 0 ? '#d97706' : '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stock Alerts
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: summary.lowStockCount > 0 ? '#d97706' : '#111827', lineHeight: 1.2 }}>
                {summary.lowStockCount}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600 }}>Low</span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#dc2626' }}>
                {summary.outOfStockCount}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>Out</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 500, marginTop: '2px' }}>
              Click to filter critical items
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================================
          CATEGORIES MASTER VIEW (When hubTab === 'CATEGORIES')
      ========================================================================================= */}
      {hubTab === 'CATEGORIES' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1rem',
          flex: 1,
          minHeight: '500px'
        }}>
          {/* Left: Category List */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>ITEM CATEGORIES ({categorySummaryList.length})</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {categorySummaryList.map(cat => {
                const active = (selectedCategoryMaster || categorySummaryList[0]?.name) === cat.name;
                return (
                  <div
                    key={cat.name}
                    onClick={() => setSelectedCategoryMaster(cat.name)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-color, #f3f4f6)',
                      cursor: 'pointer',
                      background: active ? '#eff6ff' : 'transparent',
                      borderLeft: active ? '4px solid #2563eb' : '4px solid transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary, #111827)' }}>{cat.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#6b7280' }}>Stock Value: {formatCurrency(cat.stockValue, profileCurrency)}</div>
                    </div>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {cat.count} items
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Items in Selected Category */}
          {(() => {
            const activeCatObj = categorySummaryList.find(c => c.name === (selectedCategoryMaster || categorySummaryList[0]?.name)) || categorySummaryList[0];
            return (
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #e5e7eb)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary, #f9fafb)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{activeCatObj?.name || 'Category'}</h3>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
                      {activeCatObj?.count || 0} items • Total Stock Valuation: <strong>{formatCurrency(activeCatObj?.stockValue || 0, profileCurrency)}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => openAdd('PHYSICAL', activeCatObj?.name === 'Uncategorized' ? '' : activeCatObj?.name)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>
                    <Plus size={14} /> + Add Item to {activeCatObj?.name}
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                        <th style={{ padding: '0.65rem 1rem' }}>Item Name</th>
                        <th style={{ padding: '0.65rem 1rem' }}>SKU / HSN</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Current Stock</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Sale Price</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Stock Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeCatObj?.items || []).map(item => (
                        <tr
                          key={item.id}
                          onClick={() => { setSelectedProductId(item.id); setHubTab('PRODUCTS'); }}
                          style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', cursor: 'pointer' }}>
                          <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#2563eb' }}>{item.name}</td>
                          <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>{item.sku || '—'} {item.hsn ? `• HSN: ${item.hsn}` : ''}</td>
                          <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 600 }}>{item.stock ?? 0} {item.unit || 'Kg'}</td>
                          <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>{formatCurrency(item.sellingPrice || item.rate || 0, profileCurrency)}</td>
                          <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency((Number(item.stock) || 0) * (Number(item.purchasePrice) || 0), profileCurrency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================================
          UNITS & DUAL-UNIT CONVERSION MASTER VIEW (When hubTab === 'UNITS')
      ========================================================================================= */}
      {hubTab === 'UNITS' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1rem',
          flex: 1,
          minHeight: '500px'
        }}>
          {/* Left: Units List */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', fontWeight: 700, fontSize: '0.85rem' }}>
              UNITS OF MEASUREMENT ({unitSummaryList.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {unitSummaryList.map(uObj => {
                const active = (selectedUnitMaster || unitSummaryList[0]?.unit) === uObj.unit;
                return (
                  <div
                    key={uObj.unit}
                    onClick={() => setSelectedUnitMaster(uObj.unit)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-color, #f3f4f6)',
                      cursor: 'pointer',
                      background: active ? '#eff6ff' : 'transparent',
                      borderLeft: active ? '4px solid #2563eb' : '4px solid transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary, #111827)' }}>{uObj.unit}</div>
                      {uObj.conversions.size > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                          {Array.from(uObj.conversions).join(', ')}
                        </div>
                      )}
                    </div>
                    <span style={{ background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {uObj.count} items
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Unit Conversion Reference & Items using this Unit */}
          {(() => {
            const activeUnitObj = unitSummaryList.find(u => u.unit === (selectedUnitMaster || unitSummaryList[0]?.unit)) || unitSummaryList[0];
            return (
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #e5e7eb)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #f9fafb)' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Unit: {activeUnitObj?.unit}</h3>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>
                    Dual-Unit Conversion allows buying in bulk (e.g., <strong>Kg</strong> or <strong>Box</strong>) and selling in retail quantities (e.g., <strong>Gm</strong> or <strong>Pcs</strong>) with automatic price & stock conversion.
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                        <th style={{ padding: '0.65rem 1rem' }}>Item Name</th>
                        <th style={{ padding: '0.65rem 1rem' }}>Base Unit</th>
                        <th style={{ padding: '0.65rem 1rem' }}>Secondary Unit & Conversion</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Base Stock</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Secondary Equivalent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeUnitObj?.items || []).map(item => {
                        const conv = Number(item.conversionRate) || 0;
                        const hasSec = item.secondaryUnit && conv > 0;
                        const stockQty = Number(item.stock) || 0;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => { setSelectedProductId(item.id); setHubTab('PRODUCTS'); }}
                            style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', cursor: 'pointer' }}>
                            <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#2563eb' }}>{item.name}</td>
                            <td style={{ padding: '0.65rem 1rem' }}>{item.unit}</td>
                            <td style={{ padding: '0.65rem 1rem', color: hasSec ? '#059669' : '#9ca3af', fontWeight: hasSec ? 600 : 400 }}>
                              {hasSec ? `1 ${item.unit} = ${conv} ${item.secondaryUnit}` : 'Single Unit'}
                            </td>
                            <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 600 }}>{stockQty} {item.unit}</td>
                            <td style={{ padding: '0.65rem 1rem', textAlign: 'right', color: '#4b5563' }}>
                              {hasSec ? `${(stockQty * conv).toLocaleString('en-IN')} ${item.secondaryUnit}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================================
          PRODUCTS & SERVICES SPLIT-PANE HUB (When hubTab === 'PRODUCTS' || hubTab === 'SERVICES')
      ========================================================================================= */}
      {(hubTab === 'PRODUCTS' || hubTab === 'SERVICES') && (
        <>
          {/* 2. TOP ACTION & CONTROLS TOOLBAR */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'var(--card-bg, #ffffff)',
            padding: '0.65rem 1rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e5e7eb)'
          }}>
            {/* Left: Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: `All (${hubTab === 'SERVICES' ? summary.serviceCount : summary.physicalCount})` },
                ...(hubTab === 'PRODUCTS' ? [
                  { id: 'IN_STOCK', label: `In Stock (${summary.inStockCount})` },
                  { id: 'LOW_STOCK', label: `Low Stock (${summary.lowStockCount})`, alert: summary.lowStockCount > 0 },
                  { id: 'OUT_OF_STOCK', label: `Out of Stock (${summary.outOfStockCount})`, danger: summary.outOfStockCount > 0 },
                ] : [])
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    padding: '0.38rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: statusFilter === tab.id 
                      ? '#2563eb' 
                      : (tab.danger ? '#fee2e2' : (tab.alert ? '#fef3c7' : 'var(--bg-secondary, #f3f4f6)')),
                    color: statusFilter === tab.id 
                      ? '#ffffff' 
                      : (tab.danger ? '#b91c1c' : (tab.alert ? '#b45309' : 'var(--text-secondary, #4b5563)')),
                    transition: 'all 0.15s ease'
                  }}>
                  {tab.label}
                </button>
              ))}

              {/* Category Dropdown */}
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    padding: '0.38rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid var(--border-color, #d1d5db)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-primary, #111827)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}>
                  <option value="ALL">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 3. MASTER-DETAIL 2-COLUMN SPLIT VIEW */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '370px 1fr',
            gap: '1rem',
            flex: 1,
            minHeight: '520px',
            alignItems: 'stretch'
          }}>
            
            {/* LEFT COLUMN: Searchable Item List */}
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e5e7eb)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Search & Sort Bar */}
              <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Search items, SKU, HSN, rack..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.75rem 0.45rem 2rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>
                  <span style={{ fontWeight: 600 }}>ITEM ({filteredProducts.length})</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.72rem' }}>QUANTITY / SORT:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#2563eb',
                        cursor: 'pointer',
                        outline: 'none'
                      }}>
                      <option value="name_asc">Name (A-Z)</option>
                      <option value="name_desc">Name (Z-A)</option>
                      <option value="stock_asc">Stock (Low-High)</option>
                      <option value="stock_desc">Stock (High-Low)</option>
                      <option value="value_desc">Valuation (High-Low)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Scrollable Items List */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary, #6b7280)' }}>
                    <Package size={36} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No items found</div>
                    <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Try clearing filters or add a new item</div>
                  </div>
                ) : (
                  filteredProducts.map(product => {
                    const isSelected = selectedProduct && String(selectedProduct.id) === String(product.id);
                    const stockQty = Number(product.stock) || 0;
                    const threshold = Number(product.minStock || stockAlerts.threshold || 5);
                    const isOut = product.type !== 'SERVICE' && stockQty <= 0;
                    const isLow = product.type !== 'SERVICE' && !isOut && stockAlerts.enabled !== false && stockQty <= threshold;
                    const salePrice = Number(product.sellingPrice || product.rate || 0);
                    const hasSecUnit = product.secondaryUnit && Number(product.conversionRate) > 0;

                    return (
                      <div
                        key={product.id}
                        onClick={() => setSelectedProductId(product.id)}
                        style={{
                          padding: '0.7rem 1rem',
                          borderBottom: '1px solid var(--border-color, #f3f4f6)',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--row-selected, #eff6ff)' : 'transparent',
                          borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                          transition: 'all 0.1s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary, #111827)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {product.name}
                          </div>
                          {/* Stock Badge in right column just like Vyapar left pane */}
                          <div style={{ flexShrink: 0 }}>
                            {product.type === 'SERVICE' ? (
                              <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '0.7rem' }}>
                                Service
                              </span>
                            ) : isOut ? (
                              <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.84rem' }}>
                                {stockQty} {product.unit || 'Kg'}
                              </span>
                            ) : isLow ? (
                              <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.84rem' }}>
                                {stockQty} {product.unit || 'Kg'} ⚠
                              </span>
                            ) : (
                              <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.84rem' }}>
                                {stockQty} {product.unit || 'Kg'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.73rem', color: 'var(--text-secondary, #6b7280)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {product.category && (
                              <span style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600 }}>
                                {product.category}
                              </span>
                            )}
                            {hasSecUnit && (
                              <span style={{ background: '#ecfdf5', color: '#047857', padding: '1px 5px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: 600 }}>
                                1 {product.unit}={product.conversionRate} {product.secondaryUnit}
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary, #374151)' }}>
                            Sale: {formatCurrency(salePrice, profileCurrency)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Active Item Deep-Dive & Movements */}
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e5e7eb)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {!selectedProduct ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
                  <Package size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Select an item to view stock timeline</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>Choose an item from the left list or create a new one</div>
                  <button onClick={() => openAdd('PHYSICAL')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                    <Plus size={16} /> Add Item
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  
                  {/* Item Header & Quick Action Buttons */}
                  <div style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid var(--border-color, #e5e7eb)',
                    background: 'var(--bg-secondary, #f9fafb)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                          {selectedProduct.name}
                        </h2>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
                          Base Unit: {selectedProduct.unit || 'Kg'}
                        </span>
                        {selectedProduct.secondaryUnit && Number(selectedProduct.conversionRate) > 0 && (
                          <span style={{ background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <ArrowRightLeft size={12} /> 1 {selectedProduct.unit} = {selectedProduct.conversionRate} {selectedProduct.secondaryUnit}
                          </span>
                        )}
                        {selectedProduct.category && (
                          <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
                            {selectedProduct.category}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary, #6b7280)', flexWrap: 'wrap' }}>
                        <span><strong>ITEM CODE:</strong> {selectedProduct.sku || 'N/A'}</span>
                        <span><strong>HSN/SAC:</strong> {selectedProduct.hsn || 'N/A'}</span>
                        <span><strong>GST:</strong> {selectedProduct.taxPercent ? `${selectedProduct.taxPercent}% GST` : '0% (Exempt)'}</span>
                        {Number(selectedProduct.mrp) > 0 && (
                          <span><strong>MRP:</strong> {formatCurrency(selectedProduct.mrp, profileCurrency)}</span>
                        )}
                        {Number(selectedProduct.wholesalePrice) > 0 && (
                          <span style={{ color: '#047857', fontWeight: 600 }}>
                            <strong>WHOLESALE:</strong> {formatCurrency(selectedProduct.wholesalePrice, profileCurrency)} {Number(selectedProduct.minWholesaleQty) > 0 ? `(Min ${selectedProduct.minWholesaleQty} ${selectedProduct.unit})` : ''}
                          </span>
                        )}
                        {selectedProduct.location && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: '#4338ca', fontWeight: 600 }}>
                            <MapPin size={12} /> Location: {selectedProduct.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vyapar Action Toolbar for Active Item */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {selectedProduct.type !== 'SERVICE' && (
                        <button
                          onClick={openAdjustStock}
                          className="btn btn-primary"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: '#2563eb',
                            borderColor: '#2563eb',
                            padding: '0.45rem 0.9rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                          }}
                          title="Add or Reduce stock with audit reason">
                          <SlidersHorizontal size={14} /> ADJUST ITEM
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedQrProduct(selectedProduct)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.42rem 0.75rem', fontSize: '0.8rem' }}
                        title="Print Barcode & QR Label">
                        <QrCode size={14} /> Barcode
                      </button>

                      <button
                        onClick={() => openEdit(selectedProduct)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.42rem 0.75rem', fontSize: '0.8rem' }}
                        title="Edit Item details">
                        <Edit3 size={14} /> Edit
                      </button>

                      <button
                        onClick={() => handleDelete(selectedProduct.id)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.42rem 0.75rem', fontSize: '0.8rem', color: '#dc2626' }}
                        title="Delete Item">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Vyapar Key Metrics Bar (Sale Price, Purchase Price, Stock Qty + Dual Unit, Stock Value, Realized Profit) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0.7rem',
                    padding: '0.85rem 1.25rem',
                    borderBottom: '1px solid var(--border-color, #e5e7eb)',
                    background: 'var(--card-bg, #ffffff)'
                  }}>
                    {/* 1. Sale Price */}
                    <div style={{ padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #fafafa)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>SALE PRICE</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                        {formatCurrency(selectedProduct.sellingPrice || selectedProduct.rate || 0, profileCurrency)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '2px' }}>
                        {selectedProduct.salePriceTaxType === 'with_tax' ? 'Incl. Tax' : 'Excl. Tax'} ({selectedProduct.taxPercent || 0}% GST)
                      </div>
                    </div>

                    {/* 2. Purchase Price */}
                    <div style={{ padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #fafafa)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>PURCHASE PRICE</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
                        {formatCurrency(selectedProduct.purchasePrice || 0, profileCurrency)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '2px' }}>
                        {selectedProduct.purchasePriceTaxType === 'with_tax' ? 'Incl. Tax' : 'Excl. Tax'}
                      </div>
                    </div>

                    {/* 3. Stock Quantity (with Secondary Unit conversion) */}
                    <div style={{ padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #fafafa)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>STOCK QUANTITY</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: (Number(selectedProduct.stock) || 0) <= 0 ? '#dc2626' : 'var(--text-primary, #111827)', marginTop: '2px' }}>
                        {selectedProduct.stock ?? 0} <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{selectedProduct.unit || 'Kg'}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 600, marginTop: '2px' }}>
                        {selectedProduct.secondaryUnit && Number(selectedProduct.conversionRate) > 0
                          ? `= ${((Number(selectedProduct.stock) || 0) * Number(selectedProduct.conversionRate)).toLocaleString('en-IN')} ${selectedProduct.secondaryUnit}`
                          : `Min stock: ${selectedProduct.minStock || 5} ${selectedProduct.unit || 'Kg'}`}
                      </div>
                    </div>

                    {/* 4. Stock Value */}
                    <div style={{ padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #fafafa)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>STOCK VALUE</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#7c3aed', marginTop: '2px' }}>
                        {formatCurrency(Math.max(0, Number(selectedProduct.stock) || 0) * (Number(selectedProduct.purchasePrice) || Number(selectedProduct.rate) || 0), profileCurrency)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '2px' }}>
                        At purchase cost
                      </div>
                    </div>

                    {/* 5. Item-Wise Realized Profit */}
                    <div style={{ padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #fafafa)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>ITEM-WISE PROFIT</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: itemProfitStats.estProfit >= 0 ? '#059669' : '#dc2626', marginTop: '2px' }}>
                        {formatCurrency(itemProfitStats.estProfit, profileCurrency)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '2px' }}>
                        Sold: {itemProfitStats.soldQty} {selectedProduct.unit || 'Kg'}
                      </div>
                    </div>
                  </div>

                  {/* Stock Movement History Table (Vyapar Transactions Section) */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{
                      padding: '0.65rem 1.25rem',
                      borderBottom: '1px solid var(--border-color, #e5e7eb)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      background: 'var(--bg-secondary, #fafafa)'
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary, #111827)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Layers size={16} style={{ color: '#2563eb' }} />
                        TRANSACTIONS ({filteredItemTransactions.length})
                      </div>

                      {/* Right-Pane Vyapar Transaction Search, Type Filter & CSV Export */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <select
                          value={txnTypeFilter}
                          onChange={(e) => setTxnTypeFilter(e.target.value)}
                          style={{
                            padding: '0.3rem 0.55rem',
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color, #d1d5db)',
                            background: 'var(--card-bg, #ffffff)',
                            color: 'var(--text-primary, #374151)'
                          }}>
                          <option value="ALL">All Types</option>
                          <option value="SALE">Sales</option>
                          <option value="PURCHASE">Purchases</option>
                          <option value="RETURN">Returns (Cr/Dr Note)</option>
                          <option value="ADJUSTMENT">Stock Adjustments</option>
                        </select>

                        <div style={{ position: 'relative' }}>
                          <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                          <input
                            type="text"
                            placeholder="Filter transactions..."
                            value={txnSearch}
                            onChange={(e) => setTxnSearch(e.target.value)}
                            style={{
                              padding: '0.3rem 0.6rem 0.3rem 1.65rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color, #d1d5db)',
                              width: '160px',
                              outline: 'none'
                            }}
                          />
                        </div>

                        <button
                          onClick={exportItemLedgerCSV}
                          className="btn btn-secondary"
                          style={{ padding: '0.28rem 0.6rem', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          title="Export this item's stock ledger to CSV">
                          <Download size={12} /> Ledger CSV
                        </button>
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {filteredItemTransactions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary, #6b7280)' }}>
                          <Layers size={40} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>No stock movements matching filter</div>
                          <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            Transactions appear automatically when you create a Sale Invoice, record a Purchase Bill, or use <strong>ADJUST ITEM</strong>.
                          </div>
                          {selectedProduct.type !== 'SERVICE' && (
                            <button onClick={openAdjustStock} className="btn btn-secondary" style={{ marginTop: '1rem', fontSize: '0.82rem' }}>
                              <SlidersHorizontal size={14} /> Record Opening Stock / Adjustment
                            </button>
                          )}
                        </div>
                      ) : (
                        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                              <th style={{ padding: '0.6rem 0.9rem' }}>TYPE</th>
                              <th style={{ padding: '0.6rem 0.9rem' }}>INVOICE / REF</th>
                              <th style={{ padding: '0.6rem 0.9rem' }}>NAME / PARTY</th>
                              <th style={{ padding: '0.6rem 0.9rem' }}>DATE</th>
                              <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>QUANTITY</th>
                              <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>PRICE / UNIT</th>
                              <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>RUNNING STOCK</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredItemTransactions.map((txn) => {
                              const isInward = txn.qtyChange > 0;
                              return (
                                <tr key={txn.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                                  <td style={{ padding: '0.6rem 0.9rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.73rem',
                                      fontWeight: 600,
                                      background: txn.type === 'SALE' ? '#fef2f2' : (txn.type === 'PURCHASE' ? '#ecfdf5' : '#eff6ff'),
                                      color: txn.type === 'SALE' ? '#b91c1c' : (txn.type === 'PURCHASE' ? '#047857' : '#1d4ed8')
                                    }}>
                                      <span style={{
                                        width: '7px',
                                        height: '7px',
                                        borderRadius: '50%',
                                        background: isInward ? '#10b981' : '#ef4444'
                                      }} />
                                      {txn.typeLabel}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600 }}>
                                    {txn.refNo}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-primary, #374151)' }}>
                                    {txn.partyName}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.9rem', color: '#4b5563' }}>
                                    {txn.date || '—'}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: isInward ? '#059669' : '#dc2626' }}>
                                    {txn.displayQty || `${isInward ? '+' : ''}${txn.qtyChange} ${selectedProduct.unit || 'Kg'}`}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', color: '#4b5563' }}>
                                    {formatCurrency(txn.rate, profileCurrency)}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                                    {txn.runningStock} {selectedProduct.unit || 'Kg'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 4. MODAL: ADJUST STOCK (Vyapar Signature Feature with Unit Choice & At Price) */}
      {showAdjustModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                  Stock Adjustment
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '2px' }}>
                  Item Name: <strong>{selectedProduct.name}</strong>
                </div>
              </div>
              <button onClick={() => setShowAdjustModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment}>
              {/* Type: Add Stock vs Reduce Stock */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setAdjType('ADD')}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      border: `2px solid ${adjType === 'ADD' ? '#2563eb' : '#e5e7eb'}`,
                      background: adjType === 'ADD' ? '#eff6ff' : '#ffffff',
                      color: adjType === 'ADD' ? '#1d4ed8' : '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}>
                    <ArrowUpRight size={16} /> (+) Add Stock
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjType('REDUCE')}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      border: `2px solid ${adjType === 'REDUCE' ? '#dc2626' : '#e5e7eb'}`,
                      background: adjType === 'REDUCE' ? '#fef2f2' : '#ffffff',
                      color: adjType === 'REDUCE' ? '#dc2626' : '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}>
                    <ArrowDownLeft size={16} /> (-) Reduce Stock
                  </button>
                </div>
              </div>

              {/* Total Qty + Unit Selector + At Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    Total Qty *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    placeholder="0"
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    Unit
                  </label>
                  <select
                    value={adjUnit}
                    onChange={(e) => setAdjUnit(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.52rem 0.6rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}>
                    <option value={selectedProduct.unit || 'Kg'}>{selectedProduct.unit || 'Kg'} (Base)</option>
                    {selectedProduct.secondaryUnit && Number(selectedProduct.conversionRate) > 0 && (
                      <option value={selectedProduct.secondaryUnit}>{selectedProduct.secondaryUnit} (Sec)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    At Price (₹/{selectedProduct.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={adjAtPrice}
                    onChange={(e) => setAdjAtPrice(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      fontSize: '0.9rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Live Preview calculation */}
              {(() => {
                const current = Number(selectedProduct.stock) || 0;
                const rawVal = parseFloat(adjQty) || 0;
                const isSec = selectedProduct.secondaryUnit && Number(selectedProduct.conversionRate) > 0 && adjUnit === selectedProduct.secondaryUnit;
                const baseDelta = isSec ? (rawVal / Number(selectedProduct.conversionRate)) : rawVal;
                const preview = adjType === 'ADD' ? (current + baseDelta) : Math.max(0, current - baseDelta);
                return (
                  <div style={{
                    marginBottom: '1rem',
                    padding: '0.55rem 0.8rem',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem'
                  }}>
                    <span style={{ color: '#64748b' }}>Current: <strong>{current} {selectedProduct.unit}</strong></span>
                    <span style={{ color: adjType === 'ADD' ? '#059669' : '#dc2626', fontWeight: 600 }}>
                      {adjType === 'ADD' ? `+ ${baseDelta.toFixed(3)}` : `- ${baseDelta.toFixed(3)}`} {selectedProduct.unit}
                    </span>
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>
                      New Stock: <strong style={{ color: preview <= 0 ? '#dc2626' : '#059669' }}>{preview.toFixed(3)} {selectedProduct.unit}</strong>
                    </span>
                  </div>
                );
              })()}

              {/* Reason & Adjustment Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    Reason *
                  </label>
                  <select
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      fontSize: '0.83rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}>
                    {ADJUSTMENT_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    Adjustment Date
                  </label>
                  <input
                    type="date"
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.48rem 0.65rem',
                      fontSize: '0.83rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Optional Details */}
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                  Details / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Audit conducted by store manager"
                  value={adjRemarks}
                  onChange={(e) => setAdjRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.8rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb', borderColor: '#2563eb' }}>
                  <Save size={16} /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. VYAPAR DESKTOP ADD / EDIT ITEM MODAL (Product/Service Toggle, Select Unit Conversion, Pricing & Stock Tabs) */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px', padding: 0, overflow: 'hidden' }}>
            {/* Modal Header with Product / Service Toggle */}
            <div style={{
              padding: '1rem 1.35rem',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-secondary, #f8fafc)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                  {editingId ? 'Edit Item' : 'Add Item'}
                </h3>

                {/* Product vs Service Switch */}
                <div style={{
                  display: 'inline-flex',
                  background: '#e2e8f0',
                  padding: '3px',
                  borderRadius: '999px',
                  gap: '2px'
                }}>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, type: 'PHYSICAL' }))}
                    style={{
                      padding: '0.25rem 0.85rem',
                      borderRadius: '999px',
                      border: 'none',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: form.type !== 'SERVICE' ? '#2563eb' : 'transparent',
                      color: form.type !== 'SERVICE' ? '#ffffff' : '#475569'
                    }}>
                    Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, type: 'SERVICE' }))}
                    style={{
                      padding: '0.25rem 0.85rem',
                      borderRadius: '999px',
                      border: 'none',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: form.type === 'SERVICE' ? '#2563eb' : 'transparent',
                      color: form.type === 'SERVICE' ? '#ffffff' : '#475569'
                    }}>
                    Service
                  </button>
                </div>
              </div>

              <button onClick={closeForm} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '1.25rem 1.35rem' }}>
              {/* Top Row: Item Name, HSN/SAC, Select Unit Button */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    {form.type === 'SERVICE' ? 'Service Name *' : 'Item Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Almond California or Pista Premium"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.88rem',
                      borderRadius: '6px',
                      border: '1px solid #2563eb',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    {form.type === 'SERVICE' ? 'SAC Code' : 'Item HSN'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 08021100"
                    value={form.hsn}
                    onChange={(e) => setForm(prev => ({ ...prev, hsn: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Vyapar Select Unit Button */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowUnitModal(true)}
                    style={{
                      padding: '0.52rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid #93c5fd',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      whiteSpace: 'nowrap'
                    }}>
                    <Scale size={15} />
                    {form.secondaryUnit && Number(form.conversionRate) > 0
                      ? `${form.unit} → ${form.secondaryUnit} (1=${form.conversionRate})`
                      : `Select Unit (${form.unit || 'Kg'})`}
                  </button>
                </div>
              </div>

              {/* Second Row: Category & Item Code / Barcode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    list="vyapar-category-options"
                    placeholder="Select or type category (e.g. Dry Fruits)"
                    value={form.category}
                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.48rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box'
                    }}
                  />
                  <datalist id="vyapar-category-options">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Item Code / Barcode</label>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, sku: `${Math.floor(1000000000 + Math.random() * 9000000000)}` }))}
                      style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}>
                      Assign Code
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 8901234567"
                    value={form.sku}
                    onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.48rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Vyapar Dual-Unit Conversion Inline Box (when open) */}
              {showUnitModal && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.9rem 1rem',
                  background: '#eff6ff',
                  border: '1px solid #93c5fd',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <ArrowRightLeft size={15} /> Select Unit & Conversion Rate (Dual-Unit)
                    </span>
                    <button type="button" onClick={() => setShowUnitModal(false)} style={{ border: 'none', background: 'transparent', color: '#1e3a8a', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
                      Done ✓
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.25rem' }}>
                        BASE UNIT
                      </label>
                      <select
                        value={form.unit}
                        onChange={(e) => {
                          const newBase = e.target.value;
                          setForm(prev => ({
                            ...prev,
                            unit: newBase,
                            conversionRate: prev.secondaryUnit ? getSmartConversionRate(newBase, prev.secondaryUnit) : prev.conversionRate
                          }));
                        }}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #93c5fd', background: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.25rem' }}>
                        SECONDARY UNIT (Optional)
                      </label>
                      <select
                        value={form.secondaryUnit}
                        onChange={(e) => {
                          const newSec = e.target.value;
                          setForm(prev => ({
                            ...prev,
                            secondaryUnit: newSec,
                            conversionRate: newSec ? getSmartConversionRate(prev.unit, newSec) : ''
                          }));
                        }}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #93c5fd', background: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
                        <option value="">None (Single Unit)</option>
                        {units.filter(u => u !== form.unit).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  {form.secondaryUnit && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px dashed #93c5fd', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a' }}>
                      <span>Conversion Rate:</span>
                      <span style={{ background: '#ffffff', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                        1 {form.unit} =
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        value={form.conversionRate}
                        onChange={(e) => setForm(prev => ({ ...prev, conversionRate: e.target.value }))}
                        style={{ width: '95px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #2563eb', fontWeight: 700, fontSize: '0.88rem', textAlign: 'center' }}
                      />
                      <span>{form.secondaryUnit}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Vyapar 2-Tab Navigation: Pricing | Stock */}
              <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '1rem', gap: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setFormModalTab('pricing')}
                  style={{
                    padding: '0.5rem 0.25rem',
                    border: 'none',
                    borderBottom: formModalTab === 'pricing' ? '3px solid #dc2626' : '3px solid transparent',
                    background: 'transparent',
                    color: formModalTab === 'pricing' ? '#dc2626' : '#6b7280',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    marginBottom: '-2px'
                  }}>
                  Pricing
                </button>
                {form.type !== 'SERVICE' && (
                  <button
                    type="button"
                    onClick={() => setFormModalTab('stock')}
                    style={{
                      padding: '0.5rem 0.25rem',
                      border: 'none',
                      borderBottom: formModalTab === 'stock' ? '3px solid #dc2626' : '3px solid transparent',
                      background: 'transparent',
                      color: formModalTab === 'stock' ? '#dc2626' : '#6b7280',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      marginBottom: '-2px'
                    }}>
                    Stock
                  </button>
                )}
              </div>

              {/* TAB 1: PRICING (Sale Price, Wholesale Price, Purchase Price, MRP, Taxes) */}
              {formModalTab === 'pricing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
                  {/* Sale Price & Wholesale Price Box */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                      Sale & Wholesale Price
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#047857', marginBottom: '0.25rem' }}>
                          Sale Price ({profileCurrency}) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          placeholder="0.00"
                          value={form.sellingPrice}
                          onChange={(e) => setForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
                          style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #a7f3d0', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                          Tax Type
                        </label>
                        <select
                          value={form.salePriceTaxType}
                          onChange={(e) => setForm(prev => ({ ...prev, salePriceTaxType: e.target.value }))}
                          style={{ width: '100%', padding: '0.48rem 0.5rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}>
                          <option value="without_tax">Without Tax</option>
                          <option value="with_tax">With Tax</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                          MRP ({profileCurrency})
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Optional MRP"
                          value={form.mrp}
                          onChange={(e) => setForm(prev => ({ ...prev, mrp: e.target.value }))}
                          style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    {/* Wholesale Price Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: '0.65rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          Wholesale Price ({profileCurrency})
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={form.wholesalePrice}
                          onChange={(e) => setForm(prev => ({ ...prev, wholesalePrice: e.target.value }))}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                          Tax Type
                        </label>
                        <select
                          value={form.wholesalePriceTaxType}
                          onChange={(e) => setForm(prev => ({ ...prev, wholesalePriceTaxType: e.target.value }))}
                          style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}>
                          <option value="without_tax">Without Tax</option>
                          <option value="with_tax">With Tax</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                          Min Wholesale Qty ({form.unit})
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="e.g. 10"
                          value={form.minWholesaleQty}
                          onChange={(e) => setForm(prev => ({ ...prev, minWholesaleQty: e.target.value }))}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Purchase Price & Taxes Box */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                        Purchase Price
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.5rem' }}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Purchase Price"
                          value={form.purchasePrice}
                          onChange={(e) => setForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                          style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.88rem', fontWeight: 600, borderRadius: '6px', border: '1px solid #bfdbfe', boxSizing: 'border-box' }}
                        />
                        <select
                          value={form.purchasePriceTaxType}
                          onChange={(e) => setForm(prev => ({ ...prev, purchasePriceTaxType: e.target.value }))}
                          style={{ width: '100%', padding: '0.48rem 0.45rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}>
                          <option value="without_tax">Without Tax</option>
                          <option value="with_tax">With Tax</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                        Taxes (GST & Cess)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.5rem' }}>
                        <select
                          value={form.taxPercent}
                          onChange={(e) => setForm(prev => ({ ...prev, taxPercent: e.target.value }))}
                          style={{ width: '100%', padding: '0.48rem 0.5rem', fontSize: '0.84rem', fontWeight: 600, borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}>
                          <option value="0">GST @ 0% (Exempt)</option>
                          <option value="0.25">GST @ 0.25%</option>
                          <option value="3">GST @ 3%</option>
                          <option value="5">GST @ 5%</option>
                          <option value="12">GST @ 12%</option>
                          <option value="18">GST @ 18%</option>
                          <option value="28">GST @ 28%</option>
                        </select>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Cess %"
                          title="Additional Cess %"
                          value={form.cessPercent}
                          onChange={(e) => setForm(prev => ({ ...prev, cessPercent: e.target.value }))}
                          style={{ width: '100%', padding: '0.48rem 0.5rem', fontSize: '0.82rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: STOCK (Opening Stock, At Price, As Of Date, Min Stock Alert, Location/Rack) */}
              {formModalTab === 'stock' && form.type !== 'SERVICE' && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                        {editingId ? 'Current Stock' : 'Opening Quantity'} ({form.unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={form.stock}
                        onChange={(e) => setForm(prev => ({ ...prev, stock: e.target.value, openingStock: editingId ? prev.openingStock : e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.88rem', fontWeight: 600, borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                        At Price ({profileCurrency}/{form.unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Cost per unit"
                        value={form.openingStockPrice}
                        onChange={(e) => setForm(prev => ({ ...prev, openingStockPrice: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.88rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                        As Of Date
                      </label>
                      <input
                        type="date"
                        value={form.openingStockDate}
                        onChange={(e) => setForm(prev => ({ ...prev, openingStockDate: e.target.value }))}
                        style={{ width: '100%', padding: '0.48rem 0.7rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#b45309', marginBottom: '0.3rem' }}>
                        Min Stock To Maintain ({form.unit})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="5"
                        value={form.minStock}
                        onChange={(e) => setForm(prev => ({ ...prev, minStock: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.88rem', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                        Location / Rack / Shelf
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rack A-2, Main Godown"
                        value={form.location}
                        onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}>
                  <Save size={16} /> {editingId ? 'Update Item' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: BARCODE & QR LABEL */}
      {selectedQrProduct && (
        <div className="modal-overlay" onClick={() => setSelectedQrProduct(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Item Barcode & QR Label</h3>
              <button onClick={() => setSelectedQrProduct(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>
            
            {/* Format Toggle */}
            <div style={{ display: 'inline-flex', background: 'var(--bg-secondary, #f3f4f6)', padding: '3px', borderRadius: '6px', marginBottom: '1rem', gap: '3px' }}>
              <button 
                type="button" 
                className={`btn ${codeType === 'barcode' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }} 
                onClick={() => setCodeType('barcode')}>
                1D Barcode
              </button>
              <button 
                type="button" 
                className={`btn ${codeType === 'qr' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }} 
                onClick={() => setCodeType('qr')}>
                2D QR Code
              </button>
              <button 
                type="button" 
                className={`btn ${codeType === 'both' ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }} 
                onClick={() => setCodeType('both')}>
                Both
              </button>
            </div>

            <div id="barcode-label" style={{
              border: '1px dashed var(--border-color, #ccc)',
              padding: '1.25rem',
              borderRadius: '8px',
              textAlign: 'center',
              width: '280px',
              margin: '0 auto',
              background: 'white',
              color: '#111827'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                {profile?.businessName || 'My Business'}
              </h4>

              {/* 1D Linear Barcode Strip */}
              {(codeType === 'barcode' || codeType === 'both') && (
                <div style={{ margin: '8px 0' }}>
                  <RenderCode128Svg text={selectedQrProduct.sku || `PRD-${selectedQrProduct.id}`} />
                </div>
              )}

              {/* 2D QR Code */}
              {(codeType === 'qr' || codeType === 'both') && (
                <div style={{ margin: '8px 0' }}>
                  <RenderQrCodeSvg value={selectedQrProduct.sku || `PRD-${selectedQrProduct.id}`} />
                </div>
              )}

              <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px', color: '#1f2937', fontFamily: 'monospace' }}>
                {selectedQrProduct.sku || `PRD-${selectedQrProduct.id}`}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: '#4b5563' }}>
                {selectedQrProduct.name}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#059669' }}>
                Price: {formatCurrency(selectedQrProduct.sellingPrice || selectedQrProduct.rate || 0, profileCurrency)}
                {selectedQrProduct.taxPercent ? ` (+${selectedQrProduct.taxPercent}% GST)` : ''}
              </div>
              {selectedQrProduct.hsn && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                  HSN/SAC: {selectedQrProduct.hsn}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }} onClick={printQrLabel}>
                <Printer size={16} /> Print Label
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedQrProduct(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
