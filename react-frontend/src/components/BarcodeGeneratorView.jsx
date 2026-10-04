import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Barcode, Printer, Plus, Trash2, Edit3, Eye, Download, Info, Check, RefreshCw,
  Layers, QrCode, FileText, Settings, Sliders, CheckCircle2, Copy, Sparkles, AlertCircle,
  Scissors, Tag, Store, Smartphone, Receipt, CheckSquare, ShieldCheck
} from 'lucide-react';
import QRCode from 'qrcode';
import HelpButton from './HelpButton';
import { getAllProducts, getProfile } from '../store';
import { getPrintSettings, savePrintSettings, DEFAULT_PRINT_SETTINGS } from '../utils/printSettings';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

// ============================================================================
// Code 128 Pure SVG Barcode Renderer
// ============================================================================
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

// Helper to generate SVG inner string for printable HTML
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

// ============================================================================
// Supported Barcode & Sticker Dimensions
// ============================================================================
const LABEL_SIZES = [
  { id: '50x25', name: 'Standard Thermal Roll (50×25mm)', widthMm: 50, heightMm: 25, cols: 1, type: 'roll' },
  { id: '38x25', name: 'Compact / Jewelry Roll (38×25mm)', widthMm: 38, heightMm: 25, cols: 1, type: 'roll' },
  { id: '100x50', name: 'Carton / Shipping Roll (100×50mm)', widthMm: 100, heightMm: 50, cols: 1, type: 'roll' },
  { id: '50x50', name: 'Square QR Roll (50×50mm)', widthMm: 50, heightMm: 50, cols: 1, type: 'roll' },
  { id: 'a4_24', name: 'A4 Sheet — 24 Labels (70×37mm, 3×8 grid)', widthMm: 70, heightMm: 37, cols: 3, perSheet: 24, type: 'sheet' },
  { id: 'a4_40', name: 'A4 Sheet — 40 Labels (52.5×29.7mm, 4×10 grid)', widthMm: 52.5, heightMm: 29.7, cols: 4, perSheet: 40, type: 'sheet' },
  { id: 'a4_65', name: 'A4 Sheet — 65 Labels (38×21.2mm, 5×13 grid)', widthMm: 38, heightMm: 21.2, cols: 5, perSheet: 65, type: 'sheet' },
  { id: 'a4_84', name: 'A4 Sheet — 84 Labels (46×11.1mm, 4×21 grid)', widthMm: 46, heightMm: 11.1, cols: 4, perSheet: 84, type: 'sheet' },
];

export default function BarcodeGeneratorView() {
  const [activeTab, setActiveTab] = useState('barcodes'); // 'barcodes' | 'thermal'
  const [products, setProducts] = useState([]);
  const [profile, setProfile] = useState(null);

  // Tab 1: Barcode Generator State
  const [printerType, setPrinterType] = useState('label'); // 'label' | 'standard'
  const [selectedLabelSize, setSelectedLabelSize] = useState('50x25');
  const [symbology, setSymbology] = useState('code128'); // 'code128' | 'qr'
  const [borderStyle, setBorderStyle] = useState('dashed'); // 'dashed' | 'solid' | 'none'
  const [showBusinessName, setShowBusinessName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCodeText, setShowCodeText] = useState(true);

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
  const [liveQrDataUrl, setLiveQrDataUrl] = useState('');

  // Queue of Barcode Items
  const [queue, setQueue] = useState([]);
  const [editingQueueIndex, setEditingQueueIndex] = useState(null);

  // Tab 2: Thermal Slip Designer State
  const [printSettings, setPrintSettings] = useState(getPrintSettings);
  const [thermalWidth, setThermalWidth] = useState('80mm'); // '80mm' | '58mm'
  const [thermalTitle, setThermalTitle] = useState('TAX INVOICE');
  const [thermalTagline, setThermalTagline] = useState('Wholesale & Retail Groceries');
  const [thermalFooterNote, setThermalFooterNote] = useState('Thank you for shopping with us! Visit again.');
  const [thermalTerms, setThermalTerms] = useState('1. Goods once sold will not be taken back without original bill.\n2. Exchange permitted within 7 days in original condition.\n3. Warranty claims subject to manufacturer terms.');
  const [showThermalLogo, setShowThermalLogo] = useState(false);
  const [showThermalHSN, setShowThermalHSN] = useState(true);
  const [showThermalRateLine, setShowThermalRateLine] = useState(true);
  const [showThermalUpiQR, setShowThermalUpiQR] = useState(true);
  const [showThermalCutMark, setShowThermalCutMark] = useState(true);
  const [thermalFontFamily, setThermalFontFamily] = useState('mono');
  const [thermalContrast, setThermalContrast] = useState('high');
  const [thermalAllCaps, setThermalAllCaps] = useState(false);
  const [thermalUpiQrUrl, setThermalUpiQrUrl] = useState('');

  // Sample Thermal Receipt Data
  const sampleItems = [
    { name: 'Basmati Rice Premium 1kg', hsn: '1006', qty: 2, unit: 'kg', rate: 110, gst: 5, amount: 231 },
    { name: 'Sunflower Cooking Oil 1L', hsn: '1512', qty: 1, unit: 'ltr', rate: 145, gst: 5, amount: 152.25 },
    { name: 'Aashirvaad Whole Wheat Atta 5kg', hsn: '1101', qty: 1, unit: 'bag', rate: 260, gst: 0, amount: 260 },
  ];
  const sampleSubtotal = 615;
  const sampleGST = 28.25;
  const sampleTotal = 643.25;
  const sampleRoundOff = -0.25;
  const sampleNetPayable = 643.00;
  const sampleSavedAmount = 65.00;

  // Load Initial Data
  useEffect(() => {
    getAllProducts().then(p => setProducts(Array.isArray(p) ? p : [])).catch(() => {});
    getProfile().then(prof => {
      if (prof) {
        setProfile(prof);
        if (prof.businessName) {
          setHeader(prof.businessName);
        }
        if (prof.tagline) {
          setThermalTagline(prof.tagline);
        }
      }
    }).catch(() => {});

    const ps = getPrintSettings();
    setPrintSettings(ps);
    if (ps.paperSize === 'thermal58') setThermalWidth('58mm');
    if (ps.fontFamily) setThermalFontFamily(ps.fontFamily);
    if (ps.contrast) setThermalContrast(ps.contrast);
    if (ps.allCaps) setThermalAllCaps(ps.allCaps);
    if (ps.showLogo !== undefined) setShowThermalLogo(ps.showLogo);
    if (ps.showHSN !== undefined) setShowThermalHSN(ps.showHSN);
    if (ps.showRateLine !== undefined) setShowThermalRateLine(ps.showRateLine);
    if (ps.showUPI !== undefined) setShowThermalUpiQR(ps.showUPI);
    if (ps.cutMark !== undefined) setShowThermalCutMark(ps.cutMark);
    if (ps.footerMessage) setThermalFooterNote(ps.footerMessage);
  }, []);

  // Generate live QR code for barcode preview when symbology is QR
  useEffect(() => {
    if (symbology === 'qr' && itemCode) {
      QRCode.toDataURL(itemCode, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
        .then(url => setLiveQrDataUrl(url))
        .catch(() => setLiveQrDataUrl(''));
    } else {
      setLiveQrDataUrl('');
    }
  }, [symbology, itemCode]);

  // Generate Thermal UPI QR
  useEffect(() => {
    const upiId = profile?.upiId || 'merchant@upi';
    const bName = encodeURIComponent(profile?.businessName || 'Business Counter');
    const upiPayload = `upi://pay?pa=${upiId}&pn=${bName}&am=${sampleNetPayable}&cu=INR&tn=Invoice%20Sample`;
    QRCode.toDataURL(upiPayload, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
      .then(url => setThermalUpiQrUrl(url))
      .catch(() => setThermalUpiQrUrl(''));
  }, [profile, sampleNetPayable]);

  // Handle Product Select
  const handleProductSelect = (productId) => {
    setSelectedProductId(productId);
    if (!productId) return;
    const prod = products.find(p => String(p.id) === String(productId));
    if (prod) {
      const code = prod.sku || prod.barcode || `PRD-${Math.floor(10000 + Math.random() * 90000)}`;
      setItemName(prod.name || '');
      setItemCode(code);
      if (!header && profile?.businessName) setHeader(profile.businessName);
      setLine1(prod.name || '');
      setLine2(prod.salesPrice ? `Sale Price: ₹${prod.salesPrice}` : prod.mrp ? `MRP: ₹${prod.mrp}` : '');
      setLine3(prod.hsn ? `HSN: ${prod.hsn}` : '');
      setLine4(prod.mrp && prod.salesPrice ? `MRP: ₹${prod.mrp}` : '');
    }
  };

  const handleAutoGenerateCode = () => {
    const randomCode = String(Math.floor(100000000000 + Math.random() * 900000000000));
    setItemCode(randomCode);
  };

  // Add for Barcode
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
      header: showBusinessName ? (header.trim() || profile?.businessName || '') : '',
      line1: line1.trim(),
      line2: showPrice ? line2.trim() : '',
      line3: line3.trim(),
      line4: line4.trim(),
      symbology,
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
      toast('Added to barcode print queue', 'success');
    }
  };

  // Batch Imports
  const handleAddLowStockItems = () => {
    const lowStock = products.filter(p => {
      const stock = Number(p.currentStock) || 0;
      const min = Number(p.minStockAlert) || 5;
      return stock <= min;
    });

    if (lowStock.length === 0) {
      toast('No low stock items found in inventory.', 'info');
      return;
    }

    const batch = lowStock.map(p => ({
      id: Date.now() + Math.random(),
      itemName: p.name || 'Product',
      itemCode: p.sku || p.barcode || `PRD-${p.id}`,
      noOfLabels: 5,
      header: showBusinessName ? (profile?.businessName || '') : '',
      line1: p.name || '',
      line2: p.salesPrice ? `Sale Price: ₹${p.salesPrice}` : '',
      line3: p.hsn ? `HSN: ${p.hsn}` : '',
      line4: p.mrp ? `MRP: ₹${p.mrp}` : '',
      symbology: 'code128',
    }));

    setQueue(prev => [...prev, ...batch]);
    toast(`Queued ${batch.length} low-stock items for label printing`, 'success');
  };

  const handleAddAllInventory = () => {
    if (products.length === 0) {
      toast('No products found in inventory.', 'warning');
      return;
    }

    const batch = products.slice(0, 100).map(p => ({
      id: Date.now() + Math.random(),
      itemName: p.name || 'Product',
      itemCode: p.sku || p.barcode || `PRD-${p.id}`,
      noOfLabels: 2,
      header: showBusinessName ? (profile?.businessName || '') : '',
      line1: p.name || '',
      line2: p.salesPrice ? `Sale Price: ₹${p.salesPrice}` : '',
      line3: p.hsn ? `HSN: ${p.hsn}` : '',
      line4: p.mrp ? `MRP: ₹${p.mrp}` : '',
      symbology: 'code128',
    }));

    setQueue(prev => [...prev, ...batch]);
    toast(`Added ${batch.length} catalog items to queue (2 labels each)`, 'success');
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
    if (q.symbology) setSymbology(q.symbology);
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
  const totalLabelsCount = queue.reduce((sum, item) => sum + (Number(item.noOfLabels) || 0), 0);

  // Direct Browser Print for Barcodes
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

    const labelList = [];
    queue.forEach(item => {
      const count = Math.max(1, parseInt(item.noOfLabels, 10) || 1);
      for (let i = 0; i < count; i++) {
        labelList.push(item);
      }
    });

    const isA4 = selectedLabelSize.startsWith('a4_');
    const cols = currentLabelConfig.cols || 1;
    const borderCss = borderStyle === 'dashed' ? '1px dashed #94a3b8' : borderStyle === 'solid' ? '1px solid #334155' : 'none';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes - ${currentLabelConfig.name}</title>
        <style>
          @page {
            size: ${isA4 ? 'A4 portrait' : `${currentLabelConfig.widthMm}mm ${currentLabelConfig.heightMm}mm`};
            margin: ${isA4 ? '8mm' : '0mm'};
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
            gap: ${isA4 ? '3mm' : '0mm'};
            page-break-inside: avoid;
          }
          .barcode-label {
            box-sizing: border-box;
            width: ${isA4 ? '100%' : `${currentLabelConfig.widthMm}mm`};
            height: ${currentLabelConfig.heightMm}mm;
            padding: 4px 6px;
            border: ${borderCss};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .header-text {
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
            font-size: 9.5px;
            font-weight: 700;
            font-family: monospace;
            margin-top: 1px;
          }
          .info-line {
            font-size: 8px;
            line-height: 1.15;
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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 45" style="width: 85%; height: 26px; display: block; margin: 0 auto;">
                  ${generateSvgRects(lbl.itemCode)}
                </svg>
                ${showCodeText ? `<div class="code-text">${lbl.itemCode}</div>` : ''}
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

  // Download PDF Sheet for Barcode Labels
  const handleDownloadBarcodePDF = async () => {
    if (queue.length === 0) {
      toast('Please add at least one item to the barcode queue', 'warning');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const isA4 = selectedLabelSize.startsWith('a4_');
      const cfg = currentLabelConfig;

      const labelList = [];
      queue.forEach(item => {
        const count = Math.max(1, parseInt(item.noOfLabels, 10) || 1);
        for (let i = 0; i < count; i++) {
          labelList.push(item);
        }
      });

      if (isA4) {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const cols = cfg.cols || 3;
        const rows = Math.floor(280 / cfg.heightMm);
        const marginX = 10;
        const marginY = 10;

        let curCol = 0;
        let curRow = 0;

        for (let i = 0; i < labelList.length; i++) {
          const item = labelList[i];
          const x = marginX + curCol * (cfg.widthMm + 2);
          const y = marginY + curRow * (cfg.heightMm + 2);

          // Draw label box outline
          if (borderStyle !== 'none') {
            doc.setDrawColor(200, 200, 200);
            doc.setLineDashPattern(borderStyle === 'dashed' ? [1, 1] : [], 0);
            doc.rect(x, y, cfg.widthMm, cfg.heightMm);
          }

          // Header
          let textY = y + 4;
          if (item.header) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(50, 50, 50);
            doc.text(item.header.slice(0, 28), x + cfg.widthMm / 2, textY, { align: 'center' });
            textY += 3.5;
          }

          // Code text
          doc.setFont('courier', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(0, 0, 0);
          doc.text(item.itemCode, x + cfg.widthMm / 2, textY + 5, { align: 'center' });
          textY += 8.5;

          // Product details
          if (item.line1) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.text(item.line1.slice(0, 30), x + cfg.widthMm / 2, textY, { align: 'center' });
            textY += 3;
          }
          if (item.line2) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text(item.line2.slice(0, 30), x + cfg.widthMm / 2, textY, { align: 'center' });
            textY += 3;
          }

          curCol++;
          if (curCol >= cols) {
            curCol = 0;
            curRow++;
            if (curRow >= rows && i < labelList.length - 1) {
              doc.addPage();
              curRow = 0;
            }
          }
        }

        doc.save(`Barcode_Labels_A4_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast('A4 Barcode PDF downloaded successfully', 'success');
      } else {
        // Roll format: 1 page per label
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [cfg.heightMm, cfg.widthMm] });
        for (let i = 0; i < labelList.length; i++) {
          if (i > 0) doc.addPage([cfg.heightMm, cfg.widthMm], 'landscape');
          const item = labelList[i];
          let textY = 4;
          if (item.header) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(item.header.slice(0, 26), cfg.widthMm / 2, textY, { align: 'center' });
            textY += 4;
          }
          doc.setFont('courier', 'bold');
          doc.setFontSize(9);
          doc.text(item.itemCode, cfg.widthMm / 2, textY + 5, { align: 'center' });
          textY += 9;
          if (item.line1) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(item.line1.slice(0, 28), cfg.widthMm / 2, textY, { align: 'center' });
            textY += 3.5;
          }
          if (item.line2) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text(item.line2.slice(0, 28), cfg.widthMm / 2, textY, { align: 'center' });
          }
        }
        doc.save(`Barcode_Labels_Roll_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast('Thermal Roll Barcode PDF downloaded successfully', 'success');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to download barcode PDF', 'error');
    }
  };

  // Save Thermal Settings
  const handleSaveThermalSettings = () => {
    const updated = {
      ...printSettings,
      paperSize: thermalWidth === '58mm' ? 'thermal58' : 'thermal80',
      fontFamily: thermalFontFamily,
      contrast: thermalContrast,
      allCaps: thermalAllCaps,
      showLogo: showThermalLogo,
      showHSN: showThermalHSN,
      showRateLine: showThermalRateLine,
      showUPI: showThermalUpiQR,
      cutMark: showThermalCutMark,
      footerMessage: thermalFooterNote,
      tagline: thermalTagline,
      showTagline: !!thermalTagline,
    };
    setPrintSettings(updated);
    savePrintSettings(updated);
    toast('Thermal Slip settings saved & synchronized app-wide', 'success');
  };

  // Direct Vector Test Print for Thermal Slip
  const handleThermalTestPrint = () => {
    const widthMm = thermalWidth === '58mm' ? 58 : 80;
    const isCaps = thermalAllCaps;
    const fontFam = thermalFontFamily === 'mono' ? '"Courier New", Courier, monospace' : 'system-ui, sans-serif';

    const slipHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Thermal Test Print</title>
        <style>
          @page { size: ${widthMm}mm auto; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: ${fontFam};
            font-size: ${thermalWidth === '58mm' ? '11px' : '12px'};
            line-height: 1.25;
            ${isCaps ? 'text-transform: uppercase;' : ''}
          }
          .receipt-box {
            width: ${widthMm}mm;
            padding: 4mm;
            box-sizing: border-box;
            margin: 0 auto;
          }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .dotted-line {
            border-bottom: 1px dashed #000;
            margin: 5px 0;
          }
          .double-line {
            border-bottom: 2px solid #000;
            margin: 6px 0;
          }
          .flex-between {
            display: flex;
            justify-content: space-between;
          }
          table { width: 100%; border-collapse: collapse; margin: 4px 0; }
          th { text-align: left; border-bottom: 1px solid #000; padding: 3px 0; font-size: 10.5px; }
          td { padding: 3px 0; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="center bold" style="font-size: 14px;">${profile?.businessName || 'MY BUSINESS STORE'}</div>
          ${thermalTagline ? `<div class="center" style="font-size: 10.5px;">${thermalTagline}</div>` : ''}
          ${profile?.address ? `<div class="center" style="font-size: 10px;">${profile.address}</div>` : ''}
          ${profile?.phone ? `<div class="center" style="font-size: 10px;">Phone: ${profile.phone}</div>` : ''}
          ${profile?.gstin ? `<div class="center bold" style="font-size: 10px;">GSTIN: ${profile.gstin}</div>` : ''}
          
          <div class="dotted-line"></div>
          <div class="center bold">${thermalTitle}</div>
          <div class="flex-between" style="font-size: 10px;">
            <span>Inv: #INV-2026-0042</span>
            <span>Date: ${new Date().toLocaleDateString('en-IN')}</span>
          </div>
          <div class="flex-between" style="font-size: 10px;">
            <span>Cashier: Counter-1</span>
            <span>Mode: CASH / UPI</span>
          </div>

          <div class="dotted-line"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Rate</th>
                <th style="text-align:right;">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${sampleItems.map(item => `
                <tr>
                  <td colspan="4" class="bold">${item.name}</td>
                </tr>
                <tr>
                  <td style="font-size: 9.5px; color: #444;">${showThermalHSN ? `HSN:${item.hsn}` : ''}</td>
                  <td style="text-align:center;">${item.qty} ${item.unit}</td>
                  <td style="text-align:right;">₹${item.rate}</td>
                  <td style="text-align:right;" class="bold">₹${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="dotted-line"></div>
          <div class="flex-between">
            <span>Subtotal:</span>
            <span>₹${sampleSubtotal.toFixed(2)}</span>
          </div>
          <div class="flex-between">
            <span>CGST + SGST:</span>
            <span>₹${sampleGST.toFixed(2)}</span>
          </div>
          <div class="flex-between">
            <span>Round Off:</span>
            <span>₹${sampleRoundOff.toFixed(2)}</span>
          </div>
          <div class="double-line"></div>
          <div class="flex-between bold" style="font-size: 13.5px;">
            <span>NET TOTAL:</span>
            <span>₹${sampleNetPayable.toFixed(2)}</span>
          </div>
          <div class="double-line"></div>

          <div class="center bold" style="font-size: 10.5px; margin: 4px 0;">
            ✨ YOU SAVED ₹${sampleSavedAmount.toFixed(2)} ON THIS BILL! ✨
          </div>

          ${showThermalUpiQR && thermalUpiQrUrl ? `
            <div class="center" style="margin: 8px 0;">
              <img src="${thermalUpiQrUrl}" style="width: 90px; height: 90px;" alt="UPI QR" />
              <div style="font-size: 9.5px; font-weight: 700;">SCAN TO PAY VIA ANY UPI APP</div>
            </div>
          ` : ''}

          ${thermalTerms ? `
            <div class="dotted-line"></div>
            <div style="font-size: 9px; white-space: pre-wrap; line-height: 1.2;">${thermalTerms}</div>
          ` : ''}

          <div class="dotted-line"></div>
          <div class="center bold" style="font-size: 11px;">${thermalFooterNote}</div>

          ${showThermalCutMark ? `
            <div class="center" style="margin-top: 10px; font-size: 9.5px; letter-spacing: 1px;">
              ✂ - - - - - cut here - - - - -
            </div>
          ` : ''}
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    let frame = document.getElementById('thermal-direct-print-frame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'thermal-direct-print-frame';
      frame.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:0;height:0;border:0;';
      document.body.appendChild(frame);
    }
    frame.srcdoc = slipHtml;
    toast('Test slip sent to default thermal printer', 'success');
  };

  return (
    <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Header & Tab Switcher */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>
              Thermal Slip & Barcode Designer
            </h1>
            <HelpButton topic="barcodes" />
            <span style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
              Vyapar Desktop Parity
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Design high-speed POS thermal slips (80mm/58mm), configure counter payment QR, and print sticker labels
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-subtle, rgba(0,0,0,0.05))', padding: '4px', borderRadius: '10px', gap: '4px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'barcodes' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '8px' }}
            onClick={() => setActiveTab('barcodes')}
          >
            <Tag size={16} /> Barcode & Sticker Labels
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'thermal' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '8px' }}
            onClick={() => setActiveTab('thermal')}
          >
            <Receipt size={16} /> POS Thermal Slip Designer (80/58mm)
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: BARCODE & STICKER LABELS DESIGNER */}
      {/* ==================================================================== */}
      {activeTab === 'barcodes' && (
        <>
          {/* Top Quick Actions & Sizing Strip */}
          <div className="card mb-4" style={{ padding: '0.9rem 1.25rem', background: 'var(--card-bg)' }}>
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2" style={{ background: 'var(--bg-subtle)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Printer Type:</span>
                  <select
                    className="form-input"
                    style={{ padding: '2px 8px', fontSize: '0.82rem', width: 'auto', border: 'none', background: 'transparent', fontWeight: 700 }}
                    value={printerType}
                    onChange={e => setPrinterType(e.target.value)}
                  >
                    <option value="label">Label Printer (Thermal Roll)</option>
                    <option value="standard">Standard Desktop Printer (A4 Sheet)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2" style={{ background: 'var(--bg-subtle)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Sticker Size:</span>
                  <select
                    className="form-input"
                    style={{ padding: '2px 8px', fontSize: '0.82rem', width: 'auto', border: 'none', background: 'transparent', fontWeight: 700 }}
                    value={selectedLabelSize}
                    onChange={e => setSelectedLabelSize(e.target.value)}
                  >
                    {LABEL_SIZES.map(ls => (
                      <option key={ls.id} value={ls.id}>{ls.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2" style={{ background: 'var(--bg-subtle)', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Symbology:</span>
                  <select
                    className="form-input"
                    style={{ padding: '2px 8px', fontSize: '0.82rem', width: 'auto', border: 'none', background: 'transparent', fontWeight: 700 }}
                    value={symbology}
                    onChange={e => setSymbology(e.target.value)}
                  >
                    <option value="code128">Code 128 (Standard Barcode)</option>
                    <option value="qr">QR Code (2D Matrix)</option>
                  </select>
                </div>
              </div>

              {/* Batch Inventory Loaders */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', fontWeight: 600 }}
                  onClick={handleAddLowStockItems}
                  title="Import items with stock at or below reorder level"
                >
                  <AlertCircle size={14} style={{ color: '#eab308' }} /> + Low Stock Items
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', fontWeight: 600 }}
                  onClick={handleAddAllInventory}
                  title="Add all active items from stock catalog"
                >
                  <Layers size={14} /> + All Inventory Items
                </button>
              </div>
            </div>
          </div>

          {/* Main Grid: Item Entry Form + Live Label Preview */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Left Column (2 cols): Input Form */}
            <div className="card" style={{ gridColumn: 'span 2', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Item Details for Barcode Label</span>
                {products.length > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                    📦 {products.length} Products Available in Inventory
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Item Name Dropdown / Input */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Select Product from Catalog *</label>
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
                    placeholder="Type or select product name..."
                  />
                  <datalist id="bg-products-list">
                    {products.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.sku || p.barcode ? `${p.name} (Code: ${p.sku || p.barcode})` : p.name}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Item Code */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Item Code / Barcode *</label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}
                      onClick={handleAutoGenerateCode}
                      title="Generate random 12-digit code"
                    >
                      <RefreshCw size={11} /> Auto-Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontFamily: 'monospace', letterSpacing: '1px', fontWeight: 700 }}
                    value={itemCode}
                    onChange={e => setItemCode(e.target.value)}
                    placeholder="e.g. 8901030456123 or SKU"
                  />
                </div>

                {/* No. of Labels */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>No. of Labels to Print *</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    className="form-input"
                    value={noOfLabels}
                    onChange={e => setNoOfLabels(e.target.value)}
                  />
                </div>

                {/* Header (Business Name) */}
                <div className="form-group">
                  <label className="form-label">Top Header (Company / Store Name)</label>
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
                  <label className="form-label">Line 1 (Product Title / Pack Size)</label>
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
                  <label className="form-label">Line 2 (Sale Price / MRP)</label>
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
                  <label className="form-label">Line 3 (Batch / Exp Date / HSN)</label>
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
                  <label className="form-label">Line 4 (Custom Note / MRP / Storage)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={line4}
                    onChange={e => setLine4(e.target.value)}
                    placeholder="e.g. MRP: ₹320 (Incl. of all taxes)"
                  />
                </div>
              </div>

              {/* Toggles Strip */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showBusinessName} onChange={e => setShowBusinessName(e.target.checked)} />
                  Show Business Header
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} />
                  Show Price Line
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showCodeText} onChange={e => setShowCodeText(e.target.checked)} />
                  Show Human-Readable Code Text
                </label>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Border:</span>
                  <select
                    className="form-input"
                    style={{ padding: '2px 6px', fontSize: '0.78rem', width: 'auto' }}
                    value={borderStyle}
                    onChange={e => setBorderStyle(e.target.value)}
                  >
                    <option value="dashed">Dashed Guide</option>
                    <option value="solid">Solid Line</option>
                    <option value="none">Borderless</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column (1 col): Live Barcode Label Preview */}
            <div className="card flex flex-col justify-between" style={{ padding: '1.25rem', background: 'var(--card-bg)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="flex items-center gap-1"><Eye size={15} /> Label Sticker Preview</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>
                    {currentLabelConfig.widthMm} × {currentLabelConfig.heightMm} mm
                  </span>
                </div>

                {/* Simulated Label Sticker Box */}
                <div style={{
                  background: '#ffffff',
                  color: '#000000',
                  border: borderStyle === 'dashed' ? '2px dashed #94a3b8' : borderStyle === 'solid' ? '2px solid #334155' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '12px 10px',
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  minHeight: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  {/* Header */}
                  {showBusinessName && (
                    <div style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e293b' }}>
                      {header || profile?.businessName || 'MY STORE'}
                    </div>
                  )}

                  {/* Symbology Graphic (Barcode or QR) */}
                  <div style={{ margin: '6px 0' }}>
                    {symbology === 'qr' ? (
                      liveQrDataUrl ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <img src={liveQrDataUrl} style={{ width: '80px', height: '80px', display: 'block' }} alt="QR Preview" />
                          {showCodeText && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', marginTop: 2 }}>
                              {itemCode}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem' }}>[ QR Code ]</div>
                      )
                    ) : itemCode ? (
                      <>
                        <Code128Svg text={itemCode} height={38} />
                        {showCodeText && (
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '1px', marginTop: 2 }}>
                            {itemCode}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.75rem', border: '1px dashed #cbd5e1', borderRadius: '4px' }}>
                        [ Barcode Graphic ]
                      </div>
                    )}
                  </div>

                  {/* Lines 1 to 4 */}
                  <div style={{ fontSize: '0.74rem', lineHeight: '1.25' }}>
                    {line1 && <div style={{ fontWeight: 700, color: '#0f172a' }}>{line1}</div>}
                    {showPrice && line2 && <div style={{ color: '#1e293b', fontWeight: 600 }}>{line2}</div>}
                    {line3 && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{line3}</div>}
                    {line4 && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{line4}</div>}
                    {!line1 && !line2 && !line3 && !line4 && (
                      <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>Line details preview</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Add for Barcode Button */}
              <div style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.65rem', fontSize: '0.92rem', fontWeight: 700 }}
                  onClick={handleAddForBarcode}
                >
                  <Plus size={16} /> {editingQueueIndex !== null ? 'Update Barcode Item' : 'Add to Print Queue'}
                </button>
              </div>
            </div>
          </div>

          {/* Queued Barcode Items Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="section-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Print Queue ({queue.length} Item{queue.length === 1 ? '' : 's'})
                </h3>
                <span style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                  {totalLabelsCount} Total Sticker{totalLabelsCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {queue.length > 0 && (
                  <button className="btn btn-secondary" style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '0.3rem 0.65rem' }} onClick={handleClearAll}>
                    <Trash2 size={14} /> Clear Queue
                  </button>
                )}
              </div>
            </div>

            {queue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <Barcode size={44} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No barcode labels in print queue</div>
                <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                  Pick products from inventory or click <strong>"+ Low Stock Items"</strong> above to queue stickers.
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Item Name</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Code</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>No. of Labels</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Header</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Line 1 (Title)</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Line 2 (Price)</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Line 3 (Batch/Exp)</th>
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

            {/* Bottom Actions: Print & Download PDF */}
            <div className="flex justify-end gap-3 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary flex items-center gap-2"
                style={{ padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.9rem' }}
                onClick={handleDownloadBarcodePDF}
                disabled={queue.length === 0}
              >
                <Download size={16} /> Download Sticker Sheet PDF
              </button>
              <button
                type="button"
                className="btn btn-primary flex items-center gap-2"
                style={{ padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '0.95rem' }}
                onClick={handlePrintBarcodes}
                disabled={queue.length === 0}
              >
                <Printer size={18} /> Print Barcodes ({totalLabelsCount} Sticker{totalLabelsCount === 1 ? '' : 's'})
              </button>
            </div>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: THERMAL SLIP & POS RECEIPT DESIGNER */}
      {/* ==================================================================== */}
      {activeTab === 'thermal' && (
        <div className="grid grid-cols-3 gap-5">
          {/* Left Column (2 cols): Controls & Customization */}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Quick Sizing & Preset Toolbar */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={18} style={{ color: 'var(--primary)' }} /> Thermal Roll & Format
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div
                  style={{
                    border: thermalWidth === '80mm' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    background: thermalWidth === '80mm' ? 'rgba(37,99,235,0.06)' : 'var(--bg-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onClick={() => setThermalWidth('80mm')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>80mm (3-Inch Standard POS)</span>
                    {thermalWidth === '80mm' && <CheckCircle2 size={16} color="var(--primary)" />}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Standard retail & supermarket receipt printers (Epson, TVS, NGX, Star, POS-80). Max column width.
                  </p>
                </div>

                <div
                  style={{
                    border: thermalWidth === '58mm' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    background: thermalWidth === '58mm' ? 'rgba(37,99,235,0.06)' : 'var(--bg-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onClick={() => setThermalWidth('58mm')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>58mm (2-Inch Mini / Bluetooth)</span>
                    {thermalWidth === '58mm' && <CheckCircle2 size={16} color="var(--primary)" />}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Compact portable printers, Sunmi mobile terminals, handheld Bluetooth receipt rolls.
                  </p>
                </div>
              </div>
            </div>

            {/* Header & Store Branding Controls */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={18} style={{ color: 'var(--primary)' }} /> Store Header & Branding
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Receipt Title</label>
                  <select
                    className="form-input"
                    value={thermalTitle}
                    onChange={e => setThermalTitle(e.target.value)}
                  >
                    <option value="TAX INVOICE">TAX INVOICE (GST Compliant)</option>
                    <option value="CASH MEMO">CASH MEMO (Retail Counter)</option>
                    <option value="RETAIL RECEIPT">RETAIL RECEIPT</option>
                    <option value="ESTIMATE / QUOTE">ESTIMATE / QUOTE</option>
                    <option value="DELIVERY CHALLAN">DELIVERY CHALLAN</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Tagline / Specialization</label>
                  <input
                    type="text"
                    className="form-input"
                    value={thermalTagline}
                    onChange={e => setThermalTagline(e.target.value)}
                    placeholder="e.g. Fresh Groceries & Dairy Products"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showThermalLogo} onChange={e => setShowThermalLogo(e.target.checked)} />
                  Show Business Logo
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={thermalAllCaps} onChange={e => setThermalAllCaps(e.target.checked)} />
                  ALL CAPS Mode (Supermarket Style)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showThermalHSN} onChange={e => setShowThermalHSN(e.target.checked)} />
                  Show HSN Code per Item
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showThermalRateLine} onChange={e => setShowThermalRateLine(e.target.checked)} />
                  Show Qty × Rate Line
                </label>
              </div>
            </div>

            {/* Payment QR & Footer Customizer */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone size={18} style={{ color: 'var(--primary)' }} /> Counter Payment QR & Footer Policies
              </h3>

              <div className="form-group mb-3">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 700, marginBottom: '0.4rem' }}>
                  <input type="checkbox" checked={showThermalUpiQR} onChange={e => setShowThermalUpiQR(e.target.checked)} />
                  Print Dynamic UPI QR Code for Desk Payments
                </label>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Generates an authentic UPI QR code directly on the bottom of the thermal slip so customers can scan and pay via PhonePe, GPay, Paytm, or BHIM.
                </p>
              </div>

              <div className="form-group mb-3">
                <label className="form-label" style={{ fontWeight: 600 }}>Custom Terms & Conditions / Return Policy</label>
                <textarea
                  className="form-input"
                  rows="3"
                  value={thermalTerms}
                  onChange={e => setThermalTerms(e.target.value)}
                  placeholder="Enter return policies, warranty terms, or exchange rules..."
                  style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Footer Greeting Note</label>
                  <input
                    type="text"
                    className="form-input"
                    value={thermalFooterNote}
                    onChange={e => setThermalFooterNote(e.target.value)}
                    placeholder="e.g. Thank you for your business!"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Paper Cut Mark & Feed</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600, marginTop: '8px' }}>
                    <input type="checkbox" checked={showThermalCutMark} onChange={e => setShowThermalCutMark(e.target.checked)} />
                    Print "✂ cut here" tear line guide
                  </label>
                </div>
              </div>
            </div>

            {/* Save & Instant Test Print Actions */}
            <div className="flex justify-end gap-3" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary flex items-center gap-2"
                style={{ padding: '0.65rem 1.25rem', fontWeight: 700 }}
                onClick={handleThermalTestPrint}
              >
                <Printer size={16} /> Instant Thermal Test Print
              </button>
              <button
                type="button"
                className="btn btn-primary flex items-center gap-2"
                style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}
                onClick={handleSaveThermalSettings}
              >
                <Check size={16} /> Save as App-Wide Default
              </button>
            </div>
          </div>

          {/* Right Column (1 col): Live Authentic Thermal Receipt Preview */}
          <div>
            <div style={{ position: 'sticky', top: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Receipt size={16} /> Live Slip Preview ({thermalWidth})
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                  Interactive POS Simulation
                </span>
              </div>

              {/* Thermal Paper Roll Container */}
              <div style={{
                background: '#ffffff',
                color: '#000000',
                borderRadius: '8px',
                padding: '1.25rem 1rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05)',
                fontFamily: thermalFontFamily === 'mono' ? '"Courier New", Courier, monospace' : 'system-ui, sans-serif',
                fontSize: thermalWidth === '58mm' ? '0.72rem' : '0.8rem',
                lineHeight: 1.25,
                textTransform: thermalAllCaps ? 'uppercase' : 'none',
                maxWidth: thermalWidth === '58mm' ? '280px' : '360px',
                margin: '0 auto',
                borderTop: '6px solid #cbd5e1',
                borderBottom: '6px solid #cbd5e1',
              }}>
                {/* Store Header */}
                <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                  {showThermalLogo && profile?.logo && (
                    <img src={profile.logo} alt="Logo" style={{ maxHeight: '40px', margin: '0 auto 4px', display: 'block' }} />
                  )}
                  <div style={{ fontWeight: 800, fontSize: thermalWidth === '58mm' ? '0.92rem' : '1.05rem', letterSpacing: '0.5px' }}>
                    {profile?.businessName || 'MY BUSINESS STORE'}
                  </div>
                  {thermalTagline && (
                    <div style={{ fontSize: '0.72rem', color: '#334155' }}>{thermalTagline}</div>
                  )}
                  {profile?.address && (
                    <div style={{ fontSize: '0.68rem', color: '#475569' }}>{profile.address}</div>
                  )}
                  {profile?.phone && (
                    <div style={{ fontSize: '0.68rem', color: '#475569' }}>Tel: {profile.phone}</div>
                  )}
                  {profile?.gstin && (
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, marginTop: '2px' }}>GSTIN: {profile.gstin}</div>
                  )}
                </div>

                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

                {/* Receipt Title & Meta */}
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.85rem' }}>{thermalTitle}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginTop: '2px' }}>
                  <span>Inv: #INV-2026-0042</span>
                  <span>{new Date().toLocaleDateString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                  <span>Counter: POS-01</span>
                  <span>Mode: CASH / UPI</span>
                </div>

                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

                {/* Items Table */}
                <div style={{ margin: '4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderBottom: '1px solid #000', paddingBottom: '2px', fontSize: '0.72rem' }}>
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Rate</span>
                    <span>Amt</span>
                  </div>
                  {sampleItems.map((item, i) => (
                    <div key={i} style={{ padding: '3px 0', borderBottom: '1px dotted #e2e8f0' }}>
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                        <span style={{ color: '#475569' }}>{showThermalHSN ? `HSN: ${item.hsn}` : ''}</span>
                        <span>{item.qty} {item.unit}</span>
                        <span>₹{item.rate}</span>
                        <span style={{ fontWeight: 700 }}>₹{item.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

                {/* Totals & Net Payable */}
                <div style={{ fontSize: '0.74rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span>
                    <span>₹{sampleSubtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>CGST (2.5%) + SGST (2.5%):</span>
                    <span>₹{sampleGST.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Round Off:</span>
                    <span>₹{sampleRoundOff.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ borderBottom: '2px solid #000', margin: '5px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: thermalWidth === '58mm' ? '0.92rem' : '1.05rem' }}>
                  <span>NET PAYABLE:</span>
                  <span>₹{sampleNetPayable.toFixed(2)}</span>
                </div>
                <div style={{ borderBottom: '2px solid #000', margin: '5px 0' }} />

                {/* Savings Banner */}
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.72rem', margin: '6px 0', background: '#f1f5f9', padding: '3px', borderRadius: '4px' }}>
                  ✨ YOU SAVED ₹{sampleSavedAmount.toFixed(2)} ON THIS BILL! ✨
                </div>

                {/* UPI QR Code */}
                {showThermalUpiQR && thermalUpiQrUrl && (
                  <div style={{ textAlign: 'center', margin: '8px 0', padding: '6px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <img src={thermalUpiQrUrl} alt="UPI QR" style={{ width: '85px', height: '85px', margin: '0 auto', display: 'block' }} />
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, marginTop: '2px' }}>
                      SCAN TO PAY VIA ANY UPI APP
                    </div>
                    <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                      {profile?.upiId || 'merchant@upi'}
                    </div>
                  </div>
                )}

                {/* Terms & Conditions */}
                {thermalTerms && (
                  <>
                    <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                    <div style={{ fontSize: '0.64rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.2 }}>
                      {thermalTerms}
                    </div>
                  </>
                )}

                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', marginTop: '4px' }}>
                  {thermalFooterNote}
                </div>

                {showThermalCutMark && (
                  <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.68rem', letterSpacing: '1px', color: '#64748b' }}>
                    ✂ - - - - - cut here - - - - -
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
