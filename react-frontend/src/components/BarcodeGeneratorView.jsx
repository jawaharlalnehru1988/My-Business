import { useState, useEffect, useMemo, useRef } from 'react';
import { Barcode, Printer, Plus, Trash2, Edit3, Eye, Download, Info, Check, RefreshCw, Layers } from 'lucide-react';
import HelpButton from './HelpButton';
import { getAllProducts, getProfile } from '../store';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

// Code 128 Pure SVG Barcode Renderer
const Code128Svg = ({ text, width = 200, height = 45 }) => {
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
    const w = parseInt(patternStr[i], 10) || 1;
    if (i % 2 === 0) {
      rects.push(<rect key={i} x={x} y={0} width={w * 2} height={height} fill="black" />);
    }
    x += w * 2;
  }
  const totalWidth = x + 10;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${totalWidth} ${height}`} style={{ width: '100%', height: `${height}px`, display: 'block', margin: '0 auto' }}>
      {rects}
    </svg>
  );
};

const LABEL_SIZES = [
  { id: '50x25', name: 'Size 1 Label (50×25mm)', widthMm: 50, heightMm: 25, cols: 1 },
  { id: '38x25', name: 'Size 2 Label (38×25mm)', widthMm: 38, heightMm: 25, cols: 1 },
  { id: '100x50', name: 'Size 3 Label (100×50mm)', widthMm: 100, heightMm: 50, cols: 1 },
  { id: 'a4_24', name: 'A4 Sheet — 24 Labels (70×37mm)', widthMm: 70, heightMm: 37, cols: 3, perSheet: 24 },
  { id: 'a4_40', name: 'A4 Sheet — 40 Labels (52.5×29.7mm)', widthMm: 52.5, heightMm: 29.7, cols: 4, perSheet: 40 },
  { id: 'a4_65', name: 'A4 Sheet — 65 Labels (38×21.2mm)', widthMm: 38, heightMm: 21.2, cols: 5, perSheet: 65 },
];

export default function BarcodeGeneratorView() {
  const [products, setProducts] = useState([]);
  const [printerType, setPrinterType] = useState('label'); // 'label' | 'standard'
  const [selectedLabelSize, setSelectedLabelSize] = useState('50x25');
  const [businessName, setBusinessName] = useState('');

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [noOfLabels, setNoOfLabels] = useState(5);
  const [header, setHeader] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [line3, setLine3] = useState('');
  const [line4, setLine4] = useState('');

  // Queue of Barcode Items to Print
  const [queue, setQueue] = useState([]);
  const [editingQueueIndex, setEditingQueueIndex] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    getAllProducts().then(p => setProducts(Array.isArray(p) ? p : [])).catch(() => {});
    getProfile().then(prof => {
      if (prof?.businessName) {
        setBusinessName(prof.businessName);
        setHeader(prof.businessName);
      }
    }).catch(() => {});
  }, []);

  const handleProductSelect = (productId) => {
    setSelectedProductId(productId);
    if (!productId) return;
    const prod = products.find(p => String(p.id) === String(productId));
    if (prod) {
      const code = prod.sku || prod.barcode || `PRD-${Math.floor(10000 + Math.random() * 90000)}`;
      setItemName(prod.name || '');
      setItemCode(code);
      if (!header && businessName) setHeader(businessName);
      setLine1(prod.name || '');
      setLine2(prod.salesPrice ? `Sale Price: ₹${prod.salesPrice}` : prod.mrp ? `MRP: ₹${prod.mrp}` : '');
      setLine3(prod.hsn ? `HSN: ${prod.hsn}` : '');
      setLine4('');
    }
  };

  const handleAutoGenerateCode = () => {
    const randomCode = String(Math.floor(100000000000 + Math.random() * 900000000000));
    setItemCode(randomCode);
  };

  const handleAddForBarcode = () => {
    if (!itemCode.trim()) {
      toast('Please enter or generate an Item Code / Barcode', 'warning');
      return;
    }
    const newItem = {
      id: Date.now() + Math.random(),
      itemName: itemName.trim() || 'Product Label',
      itemCode: itemCode.trim(),
      noOfLabels: Math.max(1, parseInt(noOfLabels, 10) || 1),
      header: header.trim(),
      line1: line1.trim(),
      line2: line2.trim(),
      line3: line3.trim(),
      line4: line4.trim(),
    };

    if (editingQueueIndex !== null) {
      setQueue(prev => {
        const next = [...prev];
        next[editingQueueIndex] = newItem;
        return next;
      });
      setEditingQueueIndex(null);
      toast('Barcode item updated in queue', 'success');
    } else {
      setQueue(prev => [...prev, newItem]);
      toast('Added for barcode generation', 'success');
    }
  };

  const handleEditQueueItem = (idx) => {
    const q = queue[idx];
    if (!q) return;
    setItemName(q.itemName);
    setItemCode(q.itemCode);
    setNoOfLabels(q.noOfLabels);
    setHeader(q.header);
    setLine1(q.line1);
    setLine2(q.line2);
    setLine3(q.line3);
    setLine4(q.line4);
    setEditingQueueIndex(idx);
  };

  const handleRemoveQueueItem = (idx) => {
    setQueue(prev => prev.filter((_, i) => i !== idx));
    toast('Item removed from queue', 'info');
  };

  const handleClearAll = async () => {
    const confirmed = await confirmAction({
      title: 'Clear Barcode Queue',
      message: 'Are you sure you want to clear all queued barcode labels?',
      confirmLabel: 'Clear All',
      danger: true
    });
    if (confirmed) {
      setQueue([]);
      toast('Queue cleared', 'info');
    }
  };

  const currentLabelConfig = LABEL_SIZES.find(l => l.id === selectedLabelSize) || LABEL_SIZES[0];

  // Total label count in queue
  const totalLabelsCount = queue.reduce((sum, item) => sum + (Number(item.noOfLabels) || 0), 0);

  // Print Barcode Sheet Handler
  const handlePrintBarcodes = () => {
    if (queue.length === 0) {
      toast('Please add at least one item to the barcode queue', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast('Popup blocked by browser. Please allow popups to print barcodes.', 'error');
      return;
    }

    // Expand queue items by noOfLabels count
    const labelList = [];
    queue.forEach(item => {
      const count = Math.max(1, parseInt(item.noOfLabels, 10) || 1);
      for (let i = 0; i < count; i++) {
        labelList.push(item);
      }
    });

    const isA4 = selectedLabelSize.startsWith('a4_');
    const cols = currentLabelConfig.cols || 1;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes - ${currentLabelConfig.name}</title>
        <style>
          @page {
            size: ${isA4 ? 'A4 portrait' : `${currentLabelConfig.widthMm}mm ${currentLabelConfig.heightMm}mm`};
            margin: ${isA4 ? '10mm' : '0mm'};
          }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
          }
          .label-grid {
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            gap: ${isA4 ? '4mm' : '0mm'};
            page-break-inside: avoid;
          }
          .barcode-label {
            box-sizing: border-box;
            width: ${isA4 ? '100%' : `${currentLabelConfig.widthMm}mm`};
            height: ${currentLabelConfig.heightMm}mm;
            padding: 4px 6px;
            border: ${isA4 ? '1px dashed #ccc' : 'none'};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .header-text {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .code-container {
            width: 100%;
            margin: 2px 0;
          }
          .code-text {
            font-size: 10px;
            font-weight: 700;
            font-family: monospace;
            margin-top: 1px;
          }
          .info-line {
            font-size: 8.5px;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .line-bold {
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="label-grid">
          ${labelList.map(lbl => `
            <div class="barcode-label">
              ${lbl.header ? `<div class="header-text">${lbl.header}</div>` : ''}
              <div class="code-container">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 45" style="width: 85%; height: 28px; display: block; margin: 0 auto;">
                  ${generateSvgRects(lbl.itemCode)}
                </svg>
                <div class="code-text">${lbl.itemCode}</div>
              </div>
              ${lbl.line1 ? `<div class="info-line line-bold">${lbl.line1}</div>` : ''}
              ${lbl.line2 ? `<div class="info-line">${lbl.line2}</div>` : ''}
              ${lbl.line3 ? `<div class="info-line">${lbl.line3}</div>` : ''}
              ${lbl.line4 ? `<div class="info-line">${lbl.line4}</div>` : ''}
            </div>
          `).join('')}
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const generateSvgRects = (text) => {
    if (!text) return '';
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
    let res = '';
    for (let i = 0; i < patternStr.length; i++) {
      const w = parseInt(patternStr[i], 10) || 1;
      if (i % 2 === 0) {
        res += `<rect x="${x}" y="0" width="${w * 2}" height="45" fill="black" />`;
      }
      x += w * 2;
    }
    return res;
  };

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title" style={{ margin: 0 }}>Barcode Generator</h1>
            <HelpButton topic="barcodes" />
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Generate and print barcode sticker labels for items and stock inventory
          </p>
        </div>

        {/* Printer & Label Size Selection Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2" style={{ background: 'var(--bg-subtle)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Printer:</span>
            <select
              className="form-input"
              style={{ padding: '2px 8px', fontSize: '0.82rem', width: 'auto', border: 'none', background: 'transparent', fontWeight: 600 }}
              value={printerType}
              onChange={e => setPrinterType(e.target.value)}
            >
              <option value="label">Label Printer (Thermal Roll)</option>
              <option value="standard">Standard Desktop Printer (A4 Sheet)</option>
            </select>
          </div>

          <div className="flex items-center gap-2" style={{ background: 'var(--bg-subtle)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Label Size:</span>
            <select
              className="form-input"
              style={{ padding: '2px 8px', fontSize: '0.82rem', width: 'auto', border: 'none', background: 'transparent', fontWeight: 600 }}
              value={selectedLabelSize}
              onChange={e => setSelectedLabelSize(e.target.value)}
            >
              {LABEL_SIZES.map(ls => (
                <option key={ls.id} value={ls.id}>{ls.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Item Entry Form + Live Label Preview */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Left Column (2 cols): Input Form */}
        <div className="card grid-cols-2" style={{ gridColumn: 'span 2', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Enter item details to add for barcode</span>
            {products.length > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                {products.length} inventory item{products.length === 1 ? '' : 's'} available
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Item Name Dropdown / Input */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Item Name *</label>
              <input
                type="text"
                className="form-input"
                list="bg-products-list"
                value={itemName}
                onChange={e => {
                  setItemName(e.target.value);
                  const matched = products.find(p => p.name && p.name.toLowerCase() === e.target.value.toLowerCase());
                  if (matched) handleProductSelect(matched.id);
                }}
                placeholder="Select or type item name..."
              />
              <datalist id="bg-products-list">
                {products.map(p => (
                  <option key={p.id} value={p.name}>{p.sku || p.barcode ? `${p.name} (Code: ${p.sku || p.barcode})` : p.name}</option>
                ))}
              </datalist>
            </div>

            {/* Item Code */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Item Code / Barcode *</label>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}
                  onClick={handleAutoGenerateCode}
                  title="Generate random 12-digit code"
                >
                  <RefreshCw size={11} /> Auto-Generate
                </button>
              </div>
              <input
                type="text"
                className="form-input"
                style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                value={itemCode}
                onChange={e => setItemCode(e.target.value)}
                placeholder="38676483186 or SKU"
              />
            </div>

            {/* No. of Labels */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>No. of Labels *</label>
              <input
                type="number"
                min="1"
                max="500"
                className="form-input"
                value={noOfLabels}
                onChange={e => setNoOfLabels(e.target.value)}
              />
            </div>

            {/* Header */}
            <div className="form-group">
              <label className="form-label">Header (Business / Brand Name)</label>
              <input
                type="text"
                className="form-input"
                value={header}
                onChange={e => setHeader(e.target.value)}
                placeholder="e.g. Sri Raani Dry Fruits Traders"
              />
            </div>

            {/* Line 1 */}
            <div className="form-group">
              <label className="form-label">Line 1 (Product Title / Size)</label>
              <input
                type="text"
                className="form-input"
                value={line1}
                onChange={e => setLine1(e.target.value)}
                placeholder="e.g. Cashew W240 250G"
              />
            </div>

            {/* Line 2 */}
            <div className="form-group">
              <label className="form-label">Line 2 (Price / MRP)</label>
              <input
                type="text"
                className="form-input"
                value={line2}
                onChange={e => setLine2(e.target.value)}
                placeholder="e.g. Sale Price: ₹278"
              />
            </div>

            {/* Line 3 */}
            <div className="form-group">
              <label className="form-label">Line 3 (Batch / Exp Date / Custom)</label>
              <input
                type="text"
                className="form-input"
                value={line3}
                onChange={e => setLine3(e.target.value)}
                placeholder="e.g. Batch: B-102 / Exp: 12/2026"
              />
            </div>

            {/* Line 4 */}
            <div className="form-group">
              <label className="form-label">Line 4 (Custom Note / FSSAI / Storage)</label>
              <input
                type="text"
                className="form-input"
                value={line4}
                onChange={e => setLine4(e.target.value)}
                placeholder="e.g. Store in a cool dry place"
              />
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Live Barcode Label Preview */}
        <div className="card flex flex-col justify-between" style={{ padding: '1.25rem', background: 'var(--card-bg)' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Eye size={15} /> Preview
            </div>

            {/* Simulated Label Sticker Box */}
            <div style={{
              background: '#ffffff',
              color: '#000000',
              border: '2px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '12px 10px',
              textAlign: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              {/* Header */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontStyle: 'italic', color: '#334155' }}>
                {header || 'Your Business Name'}
              </div>

              {/* Barcode SVG + Number */}
              <div style={{ margin: '6px 0' }}>
                {itemCode ? (
                  <>
                    <Code128Svg text={itemCode} height={40} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '1px', marginTop: 2 }}>
                      {itemCode}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.75rem', border: '1px dashed #e2e8f0', borderRadius: '4px' }}>
                    [ Barcode Graphic ]
                  </div>
                )}
              </div>

              {/* Lines 1 to 4 */}
              <div style={{ fontSize: '0.75rem', lineHeight: '1.25' }}>
                {line1 && <div style={{ fontWeight: 600, color: '#0f172a' }}>{line1}</div>}
                {line2 && <div style={{ color: '#334155', fontSize: '0.72rem' }}>{line2}</div>}
                {line3 && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{line3}</div>}
                {line4 && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{line4}</div>}
                {!line1 && !line2 && !line3 && !line4 && (
                  <div style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.7rem' }}>Line details preview</div>
                )}
              </div>
            </div>
          </div>

          {/* Add for Barcode Button */}
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.9rem', fontWeight: 700, background: editingQueueIndex !== null ? '#2563eb' : '#dc2626', borderColor: editingQueueIndex !== null ? '#2563eb' : '#dc2626' }}
              onClick={handleAddForBarcode}
            >
              {editingQueueIndex !== null ? 'Update Barcode Item' : 'Add for Barcode'}
            </button>
          </div>
        </div>
      </div>

      {/* Item Details Table (Queued Barcode Items for Printing) */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="section-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Item Details (Print Queue)</h3>
            <span style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
              {totalLabelsCount} Total Label{totalLabelsCount === 1 ? '' : 's'}
            </span>
          </div>

          {queue.length > 0 && (
            <button className="btn btn-secondary" style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '0.3rem 0.65rem' }} onClick={handleClearAll}>
              <Trash2 size={14} /> Clear Queue
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <Barcode size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No barcode labels in print queue</div>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              Fill in item details above and click <strong>"Add for Barcode"</strong> to start generating label stickers.
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Item Name</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Item Code</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>No. of Labels</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Header</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Line 1</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Line 2</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Line 3</th>
                  <th style={{ padding: '0.6rem 0.75rem' }}>Line 4</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: editingQueueIndex === idx ? 'var(--primary-bg)' : 'transparent' }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{item.itemName}</td>
                    <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{item.itemCode}</td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                      <span style={{ background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{item.noOfLabels}</span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)' }}>{item.header || '-'}</td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>{item.line1 || '-'}</td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>{item.line2 || '-'}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)' }}>{item.line3 || '-'}</td>
                    <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)' }}>{item.line4 || '-'}</td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                      <div className="flex gap-1 justify-end">
                        <button type="button" className="icon-btn" title="Edit" onClick={() => handleEditQueueItem(idx)}>
                          <Edit3 size={15} />
                        </button>
                        <button type="button" className="icon-btn text-danger" title="Remove" onClick={() => handleRemoveQueueItem(idx)}>
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

        {/* Bottom Print Action Buttons */}
        <div className="flex justify-end gap-3 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            style={{ padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.95rem' }}
            onClick={handlePrintBarcodes}
            disabled={queue.length === 0}
          >
            <Printer size={18} /> Generate & Print Barcodes ({totalLabelsCount} Sticker{totalLabelsCount === 1 ? '' : 's'})
          </button>
        </div>
      </div>
    </div>
  );
}
