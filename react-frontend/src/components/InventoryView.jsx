import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Package, Search, Plus, Edit3, Trash2, X, Save, Upload, QrCode, Printer, 
  SlidersHorizontal, AlertTriangle, TrendingUp, TrendingDown, Layers, 
  Calendar, DollarSign, CheckCircle, FileText, ArrowUpRight, ArrowDownLeft, 
  Download, RefreshCw, Filter, Tag, Info
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
  sellingPrice: '', 
  taxPercent: '18', 
  unit: 'Nos', 
  stock: '0', 
  minStock: '5',
  description: '', 
  type: 'PHYSICAL'
};

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
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name_asc'); // 'name_asc', 'stock_asc', 'stock_desc', 'value_desc'

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedQrProduct, setSelectedQrProduct] = useState(null);
  const [codeType, setCodeType] = useState('barcode'); // 'barcode', 'qr', 'both'

  // Stock Adjustment Form
  const [adjType, setAdjType] = useState('ADD'); // 'ADD' | 'REDUCE'
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState(ADJUSTMENT_REASONS[0]);
  const [adjDate, setAdjDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjRemarks, setAdjRemarks] = useState('');

  // Settings & Profile
  const [units, setUnits] = useState(getAllUnits());
  const [profile, setProfile] = useState(null);
  const [profileCountry, setProfileCountry] = useState('India');
  const [stockAlerts, setStockAlerts] = useState({ enabled: true, threshold: 5 });
  const [loading, setLoading] = useState(true);

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

      // Default select first product if none selected
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
    setUnits(getAllUnits());
  }, []);

  // Selected Product
  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(selectedProductId)) || products[0] || null;
  }, [products, selectedProductId]);

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set();
    products.forEach(p => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return Array.from(cats);
  }, [products]);

  // Summary Metrics
  const summary = useMemo(() => {
    const threshold = Number(stockAlerts.threshold ?? 5);
    let totalStockValPurchase = 0;
    let totalStockValSelling = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach(p => {
      const qty = Number(p.stock) || 0;
      const pPrice = Number(p.purchasePrice) || Number(p.rate) || 0;
      const sPrice = Number(p.sellingPrice) || Number(p.rate) || 0;

      totalStockValPurchase += (qty > 0 ? qty * pPrice : 0);
      totalStockValSelling += (qty > 0 ? qty * sPrice : 0);

      if (qty <= 0) {
        outOfStockCount++;
      } else if (stockAlerts.enabled !== false && qty <= threshold) {
        lowStockCount++;
        inStockCount++;
      } else {
        inStockCount++;
      }
    });

    return {
      totalItems: products.length,
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
      // Search text
      const matchesSearch = !q || (
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.hsn || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && (p.category || '').trim() !== categoryFilter) {
        return false;
      }

      // Status filter
      const qty = Number(p.stock) || 0;
      if (statusFilter === 'IN_STOCK') return qty > 0;
      if (statusFilter === 'LOW_STOCK') return qty > 0 && qty <= threshold;
      if (statusFilter === 'OUT_OF_STOCK') return qty <= 0;

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
  }, [products, search, statusFilter, categoryFilter, sortBy, stockAlerts]);

  // Stock Transactions for Selected Product
  const itemTransactions = useMemo(() => {
    if (!selectedProduct) return [];
    const txns = [];
    const prodName = (selectedProduct.name || '').trim().toLowerCase();
    const prodSku = (selectedProduct.sku || '').trim().toLowerCase();
    const prodId = String(selectedProduct.id);

    // 1. Sales from Invoices
    (bills || []).forEach(bill => {
      if (bill.type === 'proforma') return;
      (bill.items || []).forEach(item => {
        const iName = (item.name || item.description || '').trim().toLowerCase();
        const iSku = (item.sku || '').trim().toLowerCase();
        if (iName === prodName || (prodSku && iSku === prodSku)) {
          const qty = Number(item.quantity) || 0;
          const rate = Number(item.rate) || 0;
          txns.push({
            id: `sale-${bill.id || bill.invoiceNumber}-${item.name}`,
            type: 'SALE',
            typeLabel: 'Sale Invoice',
            date: bill.invoiceDate || bill.date || '',
            refNo: bill.invoiceNumber || 'INV',
            partyName: bill.clientName || 'Walk-in Customer',
            qtyChange: -qty,
            rate: rate,
            amount: Number(item.amount) || (qty * rate),
            status: bill.status || 'paid'
          });
        }
      });
    });

    // 2. Purchases from Purchase Bills
    (purchases || []).forEach(pur => {
      (pur.items || []).forEach(item => {
        const iName = (item.name || '').trim().toLowerCase();
        if (iName === prodName) {
          const qty = Number(item.quantity) || 0;
          const rate = Number(item.rate) || 0;
          txns.push({
            id: `pur-${pur.id || pur.invoiceNumber}-${item.name}`,
            type: 'PURCHASE',
            typeLabel: 'Purchase Bill',
            date: pur.date || '',
            refNo: pur.invoiceNumber || 'PUR',
            partyName: pur.supplierName || 'Supplier',
            qtyChange: +qty,
            rate: rate,
            amount: (qty * rate),
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
        const rate = Number(selectedProduct.purchasePrice || selectedProduct.rate || 0);
        txns.push({
          id: adj.id,
          type: 'ADJUSTMENT',
          typeLabel: `Adjustment (${isAdd ? '+ Inward' : '- Outward'})`,
          date: adj.date || '',
          refNo: adj.reason || 'Manual Adjustment',
          partyName: adj.remarks ? `Note: ${adj.remarks}` : adj.reason,
          qtyChange: isAdd ? +qty : -qty,
          rate: rate,
          amount: qty * rate,
          status: 'Recorded'
        });
      }
    });

    // Sort newest first
    return txns.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [selectedProduct, bills, purchases, adjustments]);

  // Form Handlers
  const openAdd = () => {
    setForm({ 
      ...emptyForm, 
      sku: `PRD-${Math.floor(10000 + Math.random() * 90000)}`,
      minStock: String(stockAlerts.threshold ?? 5)
    });
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
      sellingPrice: product.sellingPrice != null ? String(product.sellingPrice) : (product.rate != null ? String(product.rate) : ''),
      taxPercent: product.taxPercent != null ? String(product.taxPercent) : '18',
      unit: product.unit || 'Nos',
      stock: product.stock != null ? String(product.stock) : '0',
      minStock: product.minStock != null ? String(product.minStock) : String(stockAlerts.threshold ?? 5),
      description: product.description || '',
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      toast('Product name is required', 'warning');
      return;
    }

    try {
      const sellingPrice = form.sellingPrice ? parseFloat(form.sellingPrice) : 0;
      const purchasePrice = form.purchasePrice ? parseFloat(form.purchasePrice) : 0;
      const product = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        sku: form.sku.trim() || `PRD-${Math.floor(10000 + Math.random() * 90000)}`,
        category: form.category.trim(),
        hsn: form.hsn.trim(),
        purchasePrice,
        sellingPrice,
        rate: sellingPrice,
        taxPercent: form.taxPercent ? parseFloat(form.taxPercent) : 0,
        unit: form.unit || 'Nos',
        stock: form.stock ? parseFloat(form.stock) : 0,
        minStock: form.minStock ? parseFloat(form.minStock) : 5,
        description: form.description.trim(),
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

  // Stock Adjustment Handlers
  const openAdjustStock = () => {
    if (!selectedProduct) return;
    setAdjType('ADD');
    setAdjQty('');
    setAdjReason(ADJUSTMENT_REASONS[0]);
    setAdjDate(new Date().toISOString().split('T')[0]);
    setAdjRemarks('');
    setShowAdjustModal(true);
  };

  const handleSaveAdjustment = async (e) => {
    if (e) e.preventDefault();
    const qtyVal = parseFloat(adjQty);
    if (!qtyVal || qtyVal <= 0) {
      toast('Please enter a valid positive quantity', 'warning');
      return;
    }

    try {
      const currentStock = Number(selectedProduct.stock) || 0;
      const isAdd = adjType === 'ADD';
      const newStock = isAdd ? (currentStock + qtyVal) : Math.max(0, currentStock - qtyVal);

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
        quantity: qtyVal,
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

      // 3. Update local product state
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? updatedProduct : p));

      toast(`Stock adjusted successfully! New stock: ${newStock} ${selectedProduct.unit || 'Nos'}`, 'success');
      setShowAdjustModal(false);
    } catch {
      toast('Failed to record stock adjustment', 'error');
    }
  };

  // CSV Export & Import
  const exportStockCSV = () => {
    if (!products.length) {
      toast('No products to export', 'warning');
      return;
    }

    const headers = ['Product Name', 'SKU / Barcode', 'Category', 'HSN / SAC', 'Stock Qty', 'Unit', 'Purchase Price', 'Sale Price', 'GST %', 'Stock Valuation (Purchase)', 'Stock Valuation (Sale)'];
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
        `"${p.unit || 'Nos'}"`,
        pPrice,
        sPrice,
        p.taxPercent || 0,
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
        const name = row.name || row.product || row['product name'] || '';
        if (!name) continue;
        const sellingPrice = parseFloat(row.sellingprice || row.rate || row.price || 0) || 0;
        const purchasePrice = parseFloat(row.purchaseprice || row.cost || 0) || 0;
        await saveProduct({
          name,
          sku: row.sku || row.barcode || `PRD-${Math.floor(10000 + Math.random() * 90000)}`,
          category: row.category || '',
          hsn: row.hsn || row['hsn code'] || row['sac'] || '',
          sellingPrice,
          purchasePrice,
          rate: sellingPrice,
          taxPercent: parseFloat(row.taxpercent || row['tax%'] || row['gst%'] || row['tax'] || 18) || 18,
          unit: row.unit || 'Nos',
          stock: parseFloat(row.stock || row.quantity || 0) || 0,
          description: row.description || '',
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
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
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
          padding: '0.9rem 1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '9px',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Package size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Products
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary, #111827)', lineHeight: 1.2 }}>
              {summary.totalItems}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 500, marginTop: '2px' }}>
              {summary.inStockCount} In Stock
            </div>
          </div>
        </div>

        {/* Stock Valuation (Purchase) */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '10px',
          padding: '0.9rem 1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '9px',
            background: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stock Value (Purchase)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
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
          padding: '0.9rem 1.1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.9rem'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '9px',
            background: '#f5f3ff',
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stock Value (Sale)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#7c3aed', lineHeight: 1.2 }}>
              {formatCurrency(summary.totalStockValSelling, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
              Est. sales realization
            </div>
          </div>
        </div>

        {/* Low / Out of Stock Alert Card */}
        <div 
          onClick={() => setStatusFilter(summary.lowStockCount > 0 ? 'LOW_STOCK' : (summary.outOfStockCount > 0 ? 'OUT_OF_STOCK' : 'ALL'))}
          style={{
            background: summary.lowStockCount > 0 || summary.outOfStockCount > 0 ? '#fffbeb' : 'var(--card-bg, #ffffff)',
            border: `1px solid ${summary.lowStockCount > 0 ? '#fde68a' : 'var(--border-color, #e5e7eb)'}`,
            borderRadius: '10px',
            padding: '0.9rem 1.1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '9px',
            background: summary.lowStockCount > 0 ? '#fef3c7' : '#fef2f2',
            color: summary.lowStockCount > 0 ? '#d97706' : '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stock Alerts
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 700, color: summary.lowStockCount > 0 ? '#d97706' : '#111827', lineHeight: 1.2 }}>
                {summary.lowStockCount}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 600 }}>Low</span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#dc2626' }}>
                {summary.outOfStockCount}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>Out</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 500, marginTop: '2px' }}>
              Click to filter critical items
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP ACTION & CONTROLS TOOLBAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: 'var(--card-bg, #ffffff)',
        padding: '0.75rem 1rem',
        borderRadius: '10px',
        border: '1px solid var(--border-color, #e5e7eb)'
      }}>
        {/* Left: Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${products.length})` },
            { id: 'IN_STOCK', label: `In Stock (${summary.inStockCount})` },
            { id: 'LOW_STOCK', label: `Low Stock (${summary.lowStockCount})`, alert: summary.lowStockCount > 0 },
            { id: 'OUT_OF_STOCK', label: `Out of Stock (${summary.outOfStockCount})`, danger: summary.outOfStockCount > 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: statusFilter === tab.id 
                  ? '#2563eb' 
                  : (tab.danger && tab.danger ? '#fee2e2' : (tab.alert ? '#fef3c7' : 'var(--bg-secondary, #f3f4f6)')),
                color: statusFilter === tab.id 
                  ? '#ffffff' 
                  : (tab.danger && tab.danger ? '#b91c1c' : (tab.alert ? '#b45309' : 'var(--text-secondary, #4b5563)')),
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
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 500,
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

        {/* Right: Actions (Add Item, CSV Import, CSV Export) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={exportStockCSV}
            className="btn btn-secondary"
            title="Download full inventory CSV report"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}>
            <Download size={15} /> Export CSV
          </button>

          <label
            className="btn btn-secondary"
            title="Import products from Excel/CSV"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', margin: 0 }}>
            <Upload size={15} /> Bulk Import
            <input
              type="file"
              ref={csvInputRef}
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCSVImport}
            />
          </label>

          <button
            onClick={openAdd}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: '#2563eb',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}>
            <Plus size={16} /> + Add New Item
          </button>
        </div>
      </div>

      {/* 3. MASTER-DETAIL 2-COLUMN SPLIT VIEW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '380px 1fr',
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
                placeholder="Search items, SKU, HSN..."
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
              <span>Showing {filteredProducts.length} items</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem' }}>Sort:</span>
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
                const isOut = stockQty <= 0;
                const isLow = !isOut && stockAlerts.enabled !== false && stockQty <= threshold;
                const salePrice = Number(product.sellingPrice || product.rate || 0);

                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    style={{
                      padding: '0.75rem 1rem',
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
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827', flexShrink: 0 }}>
                        {formatCurrency(salePrice, profileCurrency)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {product.category && (
                          <span style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem' }}>
                            {product.category}
                          </span>
                        )}
                        <span>{product.sku || 'No SKU'}</span>
                      </div>

                      {/* Stock Badge */}
                      <div>
                        {isOut ? (
                          <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '0.72rem' }}>
                            0 {product.unit || 'Nos'} [OUT]
                          </span>
                        ) : isLow ? (
                          <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '0.72rem' }}>
                            {stockQty} {product.unit || 'Nos'} [LOW]
                          </span>
                        ) : (
                          <span style={{ background: '#ecfdf5', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '0.72rem' }}>
                            {stockQty} {product.unit || 'Nos'}
                          </span>
                        )}
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
              <button onClick={openAdd} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                <Plus size={16} /> Add Item
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Item Header & Quick Action Buttons */}
              <div style={{
                padding: '1.1rem 1.25rem',
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
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                      {selectedProduct.name}
                    </h2>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                      Unit: {selectedProduct.unit || 'Nos'}
                    </span>
                    {selectedProduct.category && (
                      <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}>
                        {selectedProduct.category}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)', flexWrap: 'wrap' }}>
                    <span><strong>SKU:</strong> {selectedProduct.sku || 'N/A'}</span>
                    <span><strong>HSN/SAC:</strong> {selectedProduct.hsn || 'N/A'}</span>
                    <span><strong>Tax Slab:</strong> {selectedProduct.taxPercent ? `${selectedProduct.taxPercent}% GST` : '0% (Exempt)'}</span>
                  </div>
                </div>

                {/* Vyapar Action Toolbar for Active Item */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={openAdjustStock}
                    className="btn btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: '#059669',
                      borderColor: '#059669',
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      boxShadow: '0 1px 3px rgba(5,150,105,0.2)'
                    }}
                    title="Add or Reduce stock with audit reason">
                    <SlidersHorizontal size={15} /> + Adjust Stock
                  </button>

                  <button
                    onClick={() => setSelectedQrProduct(selectedProduct)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}
                    title="Print Barcode & QR Label">
                    <QrCode size={15} /> Barcode
                  </button>

                  <button
                    onClick={() => openEdit(selectedProduct)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}
                    title="Edit Item details">
                    <Edit3 size={15} /> Edit
                  </button>

                  <button
                    onClick={() => handleDelete(selectedProduct.id)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem', color: '#dc2626' }}
                    title="Delete Item">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Key Metrics Grid (4 Cards) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                padding: '0.9rem 1.25rem',
                borderBottom: '1px solid var(--border-color, #e5e7eb)',
                background: '#ffffff'
              }}>
                {/* 1. Current Stock */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Current Stock</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: (Number(selectedProduct.stock) || 0) <= 0 ? '#dc2626' : '#111827', marginTop: '2px' }}>
                    {selectedProduct.stock ?? 0} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{selectedProduct.unit || 'Nos'}</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                    Min alert: {selectedProduct.minStock || stockAlerts.threshold || 5} {selectedProduct.unit || 'Nos'}
                  </div>
                </div>

                {/* 2. Sale Price */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Sale Price</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                    {formatCurrency(selectedProduct.sellingPrice || selectedProduct.rate || 0, profileCurrency)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                    {selectedProduct.taxPercent ? `Incl. ${selectedProduct.taxPercent}% GST` : 'Exempt'}
                  </div>
                </div>

                {/* 3. Purchase Price */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Purchase Price</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
                    {formatCurrency(selectedProduct.purchasePrice || 0, profileCurrency)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                    Cost to business
                  </div>
                </div>

                {/* 4. Margin % */}
                {(() => {
                  const sPrice = Number(selectedProduct.sellingPrice || selectedProduct.rate || 0);
                  const pPrice = Number(selectedProduct.purchasePrice || 0);
                  const margin = pPrice > 0 ? (((sPrice - pPrice) / pPrice) * 100).toFixed(1) : (sPrice > 0 ? '100.0' : '0.0');
                  const isPositive = Number(margin) >= 0;
                  return (
                    <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Gross Margin</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isPositive ? '#059669' : '#dc2626', marginTop: '2px' }}>
                        {isPositive ? `+${margin}%` : `${margin}%`}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                        Spread: {formatCurrency(Math.max(0, sPrice - pPrice), profileCurrency)}
                      </div>
                    </div>
                  );
                })()}

                {/* 5. Total Stock Value */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Stock Valuation</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#7c3aed', marginTop: '2px' }}>
                    {formatCurrency((Number(selectedProduct.stock) || 0) * (Number(selectedProduct.purchasePrice) || Number(selectedProduct.rate) || 0), profileCurrency)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                    At purchase rate
                  </div>
                </div>
              </div>

              {/* Stock Movement History Table (Vyapar Stock Ledger) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  padding: '0.75rem 1.25rem',
                  borderBottom: '1px solid var(--border-color, #e5e7eb)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-secondary, #fafafa)'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary, #111827)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={16} style={{ color: '#2563eb' }} />
                    Stock Transactions & Movements
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>
                    Total movements recorded: {itemTransactions.length}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {itemTransactions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary, #6b7280)' }}>
                      <Layers size={40} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>No stock movements recorded yet</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Transactions appear automatically when you create a Sale Invoice, record a Purchase Bill, or use <strong>+ Adjust Stock</strong>.
                      </div>
                      <button onClick={openAdjustStock} className="btn btn-secondary" style={{ marginTop: '1rem', fontSize: '0.82rem' }}>
                        <SlidersHorizontal size={14} /> Record Opening Stock / Adjustment
                      </button>
                    </div>
                  ) : (
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                          <th style={{ padding: '0.65rem 1rem' }}>Type</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Date</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Ref / Invoice</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Party / Details</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Qty Change</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Rate</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemTransactions.map((txn) => {
                          const isInward = txn.qtyChange > 0;
                          return (
                            <tr key={txn.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: txn.type === 'SALE' ? '#fef2f2' : (txn.type === 'PURCHASE' ? '#ecfdf5' : '#eff6ff'),
                                  color: txn.type === 'SALE' ? '#b91c1c' : (txn.type === 'PURCHASE' ? '#047857' : '#1d4ed8')
                                }}>
                                  {txn.type === 'SALE' && <ArrowDownLeft size={12} />}
                                  {txn.type === 'PURCHASE' && <ArrowUpRight size={12} />}
                                  {txn.type === 'ADJUSTMENT' && <SlidersHorizontal size={12} />}
                                  {txn.typeLabel}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>
                                {txn.date || '—'}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>
                                {txn.refNo}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', color: '#374151' }}>
                                {txn.partyName}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: isInward ? '#059669' : '#dc2626' }}>
                                {isInward ? `+ ${txn.qtyChange}` : `${txn.qtyChange}`} {selectedProduct.unit || 'Nos'}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', color: '#6b7280' }}>
                                {formatCurrency(txn.rate, profileCurrency)}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                                {formatCurrency(txn.amount, profileCurrency)}
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

      {/* 4. MODAL: ADJUST STOCK (Vyapar Signature Feature) */}
      {showAdjustModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                  Adjust Stock
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '2px' }}>
                  Item: <strong>{selectedProduct.name}</strong> ({selectedProduct.sku || 'No SKU'})
                </div>
              </div>
              <button onClick={() => setShowAdjustModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment}>
              {/* Type: Add Stock vs Reduce Stock */}
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                  Adjustment Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setAdjType('ADD')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      border: `2px solid ${adjType === 'ADD' ? '#059669' : '#e5e7eb'}`,
                      background: adjType === 'ADD' ? '#ecfdf5' : '#ffffff',
                      color: adjType === 'ADD' ? '#059669' : '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s ease'
                    }}>
                    <ArrowUpRight size={18} /> (+) Add Stock
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjType('REDUCE')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      border: `2px solid ${adjType === 'REDUCE' ? '#dc2626' : '#e5e7eb'}`,
                      background: adjType === 'REDUCE' ? '#fef2f2' : '#ffffff',
                      color: adjType === 'REDUCE' ? '#dc2626' : '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s ease'
                    }}>
                    <ArrowDownLeft size={18} /> (-) Reduce Stock
                  </button>
                </div>
              </div>

              {/* Quantity Input with Live Stock Preview */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Quantity to Adjust ({selectedProduct.unit || 'Nos'}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  placeholder={`e.g. 5 ${selectedProduct.unit || 'Nos'}`}
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />

                {/* Live Preview calculation */}
                {(() => {
                  const current = Number(selectedProduct.stock) || 0;
                  const qtyVal = parseFloat(adjQty) || 0;
                  const preview = adjType === 'ADD' ? (current + qtyVal) : Math.max(0, current - qtyVal);
                  return (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.55rem 0.8rem',
                      borderRadius: '6px',
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem'
                    }}>
                      <span style={{ color: '#64748b' }}>Current: <strong>{current}</strong></span>
                      <span style={{ color: adjType === 'ADD' ? '#059669' : '#dc2626', fontWeight: 600 }}>
                        {adjType === 'ADD' ? `+ ${qtyVal}` : `- ${qtyVal}`}
                      </span>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>
                        New Stock: <strong style={{ color: preview <= 0 ? '#dc2626' : '#059669' }}>{preview.toFixed(2)} {selectedProduct.unit || 'Nos'}</strong>
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Reason Dropdown */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Reason for Adjustment *
                </label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}>
                  {ADJUSTMENT_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Adjustment Date */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Adjustment Date
                </label>
                <input
                  type="date"
                  value={adjDate}
                  onChange={(e) => setAdjDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.8rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Optional Remarks */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Remarks / Notes (Optional)
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
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>
                  <Save size={16} /> Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: ADD / EDIT PRODUCT */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>
                {editingId ? 'Edit Product Details' : 'Add New Item to Catalog'}
              </h3>
              <button onClick={closeForm} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                {/* Item Name */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dry papaya or Almonds California"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.8rem',
                      fontSize: '0.88rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* SKU / Barcode */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>SKU / Barcode</label>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, sku: `PRD-${Math.floor(10000 + Math.random() * 90000)}` }))}
                      style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                      Auto Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. PRD-10291"
                    value={form.sku}
                    onChange={(e) => setForm(prev => ({ ...prev, sku: e.target.value }))}
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

                {/* Category */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dry Fruits, Spices, Grocery"
                    value={form.category}
                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
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

                {/* HSN / SAC Code */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 20089300"
                    value={form.hsn}
                    onChange={(e) => setForm(prev => ({ ...prev, hsn: e.target.value }))}
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

                {/* Unit of Measurement */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Unit of Measurement
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm(prev => ({ ...prev, unit: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.8rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}>
                    {units.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & GST Section */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem',
                marginBottom: '0.85rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0.75rem'
              }}>
                {/* Selling Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#047857', marginBottom: '0.35rem' }}>
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
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #a7f3d0',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Purchase Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#1d4ed8', marginBottom: '0.35rem' }}>
                    Purchase Price ({profileCurrency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={form.purchasePrice}
                    onChange={(e) => setForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* GST Rate % */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                    GST Tax Rate
                  </label>
                  <select
                    value={form.taxPercent}
                    onChange={(e) => setForm(prev => ({ ...prev, taxPercent: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}>
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>
              </div>

              {/* Stock & Alert Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    {editingId ? 'Current Stock' : 'Opening Stock'} ({form.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={form.stock}
                    onChange={(e) => setForm(prev => ({ ...prev, stock: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.8rem',
                      fontSize: '0.88rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#b45309', marginBottom: '0.35rem' }}>
                    Low Stock Alert Level
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="5"
                    value={form.minStock}
                    onChange={(e) => setForm(prev => ({ ...prev, minStock: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.8rem',
                      fontSize: '0.88rem',
                      borderRadius: '6px',
                      border: '1px solid #fde68a',
                      background: '#fffbeb',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Item Description / Notes
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Optional details, batch size, manufacturer..."
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
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
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}>
                  <Save size={16} /> {editingId ? 'Update Item' : 'Save Item'}
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
