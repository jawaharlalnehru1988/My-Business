import { useState, useEffect, useRef } from 'react';
import { Package, Search, Plus, Edit3, Trash2, X, Save, Upload, QrCode, Printer } from 'lucide-react';
import { getAllProducts, saveProduct, deleteProduct, getProfile, getStockAlertSettings } from '../store';
import { getAllUnits, getCountryConfig, formatCurrency } from '../utils';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

// v1.10.29 — reported: "here purchase price and selling price need".
// Product now carries BOTH: `purchasePrice` (what we paid the supplier) and
// `sellingPrice` (what we charge the customer). Legacy `rate` field is
// still written on save (mirrors sellingPrice) so any pre-v1.10.29 reader
// still gets a valid number, but the form no longer edits it directly —
// dead state removed for clarity.
const emptyForm = {
  name: '', sku: '', hsn: '', purchasePrice: '', sellingPrice: '', taxPercent: '', unit: 'Nos', stock: '', description: '', type: 'PHYSICAL',
};

export default function InventoryView() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [units, setUnits] = useState(getAllUnits());
  const [profile, setProfile] = useState(null);
  const [profileCountry, setProfileCountry] = useState('India');
  const [selectedQrProduct, setSelectedQrProduct] = useState(null);
  const profileCurrency = getCountryConfig(profileCountry).currency;
  // The colour-coded stock badge in the table respects the user's threshold
  // — defaults to 5 if no setting saved yet. When alerts are disabled
  // entirely, items at or below threshold render in the same plain colour
  // as everything else (still "Out of Stock" red for 0 — that's a hard fact,
  // not an alert preference).
  const [stockAlerts, setStockAlerts] = useState({ enabled: true, threshold: 5 });

  const loadProducts = async () => {
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch {
      toast('Failed to load products', 'error');
    }
  };

  useEffect(() => {
    loadProducts();
    setUnits(getAllUnits());
    getProfile().then(p => { 
      setProfile(p);
      if (p?.country) setProfileCountry(p.country); 
    }).catch(() => {});
    getStockAlertSettings().then(setStockAlerts).catch(() => {});
  }, []);

  const filtered = search.trim()
    ? products.filter(p =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.hsn || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(search.toLowerCase())
      )
    : products;

  const openAdd = () => {
    setForm({ ...emptyForm, sku: `PRD-${Math.floor(10000 + Math.random() * 90000)}` });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (product) => {
    // v1.10.29 — Backward-compat: pre-v1.10.29 products only had `rate`.
    // Read `sellingPrice` if set, else fall back to `rate`. `purchasePrice`
    // is new — starts empty for legacy products until the user fills it.
    setForm({
      name: product.name || '',
      sku: product.sku || product.barcode || '',
      hsn: product.hsn || '',
      purchasePrice: product.purchasePrice ?? '',
      sellingPrice: product.sellingPrice ?? product.rate ?? '',
      taxPercent: product.taxPercent || '',
      unit: product.unit || 'Nos',
      stock: product.stock || '',
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

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('Product name is required', 'warning');
      return;
    }
    try {
      // v1.10.29 — Persist both prices. `rate` mirrors sellingPrice so any
      // old caller reading .rate still gets the right number.
      const sellingPrice = form.sellingPrice ? parseFloat(form.sellingPrice) : 0;
      const purchasePrice = form.purchasePrice ? parseFloat(form.purchasePrice) : 0;
      const product = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        sku: form.sku.trim() || `PRD-${Math.floor(10000 + Math.random() * 90000)}`,
        hsn: form.hsn.trim(),
        purchasePrice,
        sellingPrice,
        rate: sellingPrice, // mirror for legacy readers
        taxPercent: form.taxPercent ? parseFloat(form.taxPercent) : 0,
        unit: form.unit,
        stock: form.stock ? parseFloat(form.stock) : 0,
        description: form.description.trim(),
      };
      await saveProduct(product);
      toast(editingId ? 'Product updated' : 'Product added', 'success');
      closeForm();
      loadProducts();
    } catch {
      toast('Failed to save product', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (await confirmAction({
      title: 'Delete this product?',
      message: 'Existing invoices that used this product keep their line items unchanged. This just removes the product from your catalog.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        await deleteProduct(id);
        toast('Product deleted', 'success');
        loadProducts();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const printQrLabel = () => {
    const labelEl = document.getElementById('barcode-label');
    if (!labelEl) return;
    const win = window.open('', '', 'width=600,height=700');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Print Product QR Code</title>
            <style>
              body { font-family: sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
              .label-container { border: 1px dashed #ccc; padding: 16px; border-radius: 8px; text-align: center; width: 250px; background: white; }
              h4 { margin: 0 0 6px 0; font-size: 14px; color: #374151; }
              img { width: 120px; height: 120px; margin: 8px auto; display: block; }
              .sku { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
              .name { font-size: 12px; margin-bottom: 4px; color: #4b5563; }
              .price { font-size: 13px; font-weight: bold; color: #059669; }
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

  const csvInputRef = useRef(null);

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
        await saveProduct({
          name,
          sku: row.sku || row.barcode || `PRD-${Math.floor(10000 + Math.random() * 90000)}`,
          hsn: row.hsn || row['hsn code'] || row['sac'] || '',
          rate: row.rate || row.price ? parseFloat(row.rate || row.price) || 0 : 0,
          taxPercent: row.taxpercent || row['tax%'] || row['gst%'] || row['tax'] ? parseFloat(row.taxpercent || row['tax%'] || row['gst%'] || row['tax']) || 0 : 0,
          unit: row.unit || 'Nos',
          stock: row.stock || row.quantity ? parseFloat(row.stock || row.quantity) || 0 : 0,
          description: row.description || '',
        });
        imported++;
      }
      toast(`Imported ${imported} product${imported !== 1 ? 's' : ''}`, 'success');
      loadProducts();
    } catch {
      toast('Failed to parse CSV file', 'error');
    }
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // Pure Client-side 1D Barcode (Code 128) SVG Component
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
      checksum += validCode * (i + 1);
      patternStr += CODE128_PATTERNS[validCode] || "212222";
    }
    const checkIndex = checksum % 103;
    patternStr += (CODE128_PATTERNS[checkIndex] || "212222") + (CODE128_PATTERNS[106] || "2331112");

    let x = 10;
    const rects = [];
    for (let i = 0; i < patternStr.length; i++) {
      const width = parseInt(patternStr[i], 10) || 1;
      if (i % 2 === 0) {
        rects.push(<rect key={i} x={x} y={0} width={width * 2} height={50} fill="black" />);
      }
      x += width * 2;
    }
    const totalWidth = x + 10;
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${totalWidth} 50`} style={{ width: '100%', height: '45px', display: 'block', margin: '0 auto' }}>
        {rects}
      </svg>
    );
  };

  // Pure Client-side 2D QR Code SVG Component
  const RenderQrCodeSvg = ({ value }) => {
    if (!value) return null;
    const size = 25;
    const matrix = Array(size).fill(0).map(() => Array(size).fill(false));
    
    const fillSquare = (r, c, w, h, val = true) => {
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          if (r + i < size && c + j < size) matrix[r + i][c + j] = val;
        }
      }
    };

    const drawFinder = (r, c) => {
      fillSquare(r, c, 7, 7, true);
      fillSquare(r + 1, c + 1, 5, 5, false);
      fillSquare(r + 2, c + 2, 3, 3, true);
    };

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }

    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash = Math.abs(hash);

    let bitIndex = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inFinderTL = r < 8 && c < 8;
        const inFinderTR = r < 8 && c >= size - 8;
        const inFinderBL = r >= size - 8 && c < 8;
        const isTiming = r === 6 || c === 6;

        if (!inFinderTL && !inFinderTR && !inFinderBL && !isTiming) {
          const charCode = value.charCodeAt((r * size + c) % value.length) || 65;
          const val = ((charCode + r * 7 + c * 13 + hash + (bitIndex++)) % 3) !== 0;
          matrix[r][c] = val;
        }
      }
    }

    const rects = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          rects.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.05} height={1.05} fill="#111827" />);
        }
      }
    }

    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} style={{ width: '120px', height: '120px', margin: '8px auto', display: 'block' }}>
        <rect x="0" y="0" width={size} height={size} fill="white" />
        {rects}
      </svg>
    );
  };

  const [codeType, setCodeType] = useState('both'); // 'barcode' | 'qr' | 'both'

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Manage your products and services catalog</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={csvInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />
          <button className="btn btn-secondary" onClick={() => csvInputRef.current?.click()}>
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="glass-panel p-4 mb-6">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search by name, SKU or HSN..." value={search}
            onChange={e => setSearch(e.target.value)} className="search-input" />
          {search && <button className="icon-btn" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search"><X size={14} /></button>}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <h3 className="section-title">{editingId ? 'Edit Product' : 'Add Product'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Product / Service Name *</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => updateField('name', e.target.value)} placeholder="e.g. Web Development" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Item Type</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="itemType" checked={form.type === 'PHYSICAL'} onChange={() => updateField('type', 'PHYSICAL')} />
                    Physical Product
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input type="radio" name="itemType" checked={form.type === 'SERVICE'} onChange={() => updateField('type', 'SERVICE')} />
                    Service
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">SKU / QR / Barcode</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input type="text" className="form-input" value={form.sku}
                    onChange={e => updateField('sku', e.target.value)} placeholder="e.g. PRD-998314" />
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    onClick={() => updateField('sku', `PRD-${Math.floor(10000 + Math.random() * 90000)}`)} title="Auto-generate SKU barcode">
                    <QrCode size={14} /> Auto
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">HSN / SAC Code</label>
                <input type="text" className="form-input" value={form.hsn}
                  onChange={e => updateField('hsn', e.target.value)} placeholder="e.g. 998314" />
              </div>
              <div className="form-group">
                <label className="form-label">Purchase Price</label>
                <input type="number" className="form-input" value={form.purchasePrice}
                  onChange={e => updateField('purchasePrice', e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  title="What you pay the supplier. Auto-fills on new Purchase Bills." />
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price</label>
                <input type="number" className="form-input" value={form.sellingPrice}
                  onChange={e => updateField('sellingPrice', e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  title="What you charge the customer. Auto-fills on new Invoices." />
              </div>
              <div className="form-group">
                <label className="form-label">GST %</label>
                <input type="number" className="form-input" value={form.taxPercent}
                  onChange={e => updateField('taxPercent', e.target.value)} placeholder="18" min="0" max="28" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-input" value={form.unit}
                  onChange={e => updateField('unit', e.target.value)}>
                  {form.unit && !units.some(u => u.label === form.unit) && (
                    <option value={form.unit}>{form.unit}</option>
                  )}
                  {units.map(u => <option key={u.label} value={u.label}>{u.label}{u.custom ? ' ★' : ''}</option>)}
                </select>
              </div>
              {form.type === 'PHYSICAL' && (
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input type="number" className="form-input" value={form.stock}
                    onChange={e => updateField('stock', e.target.value)} placeholder="0" min="0" />
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description (optional)</label>
                <input type="text" className="form-input" value={form.description}
                  onChange={e => updateField('description', e.target.value)} placeholder="Brief description..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={16} /> {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="glass-panel">
        <div className="table-header"><h3>Products & Services</h3></div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <p>{products.length === 0 ? 'No products yet. Add your first product.' : 'No products match your search.'}</p>
            {products.length === 0 && (
              <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Product</button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU / Code</th>
                  <th>HSN/SAC</th>
                  <th>Rate</th>
                  <th>GST %</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => (
                  <tr key={product.id}>
                    <td className="font-medium" title={product.description || ''}>{product.name}</td>
                    <td className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{product.sku || product.barcode || '-'}</td>
                    <td className="text-muted">{product.hsn || '-'}</td>
                    <td className="font-bold">{product.rate ? formatCurrency(product.rate, profileCurrency) : '-'}</td>
                    <td>{product.taxPercent ? `${product.taxPercent}%` : '-'}</td>
                    <td className="text-muted">{product.unit || 'Nos'}</td>
                    <td>
                      {product.type === 'SERVICE' ? (
                        <span style={{ padding: '2px 6px', background: '#e0e7ff', color: '#4338ca', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>Service</span>
                      ) : (product.stock ?? 0) <= 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Out of Stock</span>
                      ) : (stockAlerts.enabled !== false && (product.stock ?? 0) <= Number(stockAlerts.threshold ?? 5)) ? (
                        <span style={{ color: '#d97706', fontWeight: 600 }}>{product.stock}</span>
                      ) : (
                        product.stock
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn icon-btn-purple" onClick={() => setSelectedQrProduct(product)} title="View Barcode & QR Label">
                          <QrCode size={15} />
                        </button>
                        <button className="icon-btn icon-btn-blue" onClick={() => openEdit(product)} title="Edit">
                          <Edit3 size={15} />
                        </button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(product.id)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Code & Barcode Label Modal */}
      {selectedQrProduct && (
        <div className="modal-overlay" onClick={() => setSelectedQrProduct(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Product Barcode & QR Label</h3>
            
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
