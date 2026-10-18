import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calculator, Settings, X, Plus, Trash2, Printer, Download,
  Camera, FileText, Check, ChevronDown, MessageCircle, ScanBarcode,
  RotateCcw, Sparkles
} from 'lucide-react';
import {
  saveBill, getNextInvoiceNumber, getAllClients, saveClient,
  getAllSuppliers, saveSupplier, getAllProducts, saveProduct,
  savePurchase, getAllPurchases, getAllBills
} from '../store';
import {
  formatCurrency, calculateRoundOff, getStatesForCountry,
  getAllUnits, computeInvoiceTotals
} from '../utils';
import { toast } from './Toast';
import ClientModal from './ClientModal';
import SupplierModal from './SupplierModal';
import ThermalPreviewModal from './ThermalPreviewModal';
import InvoicePreviewModal from './InvoicePreviewModal';
import { openWhatsAppShare } from '../utils/share';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal'
];

const GST_RATES = [
  { label: 'None (0%)', value: 0 },
  { label: 'GST @ 0%', value: 0 },
  { label: 'GST @ 5%', value: 5 },
  { label: 'GST @ 12%', value: 12 },
  { label: 'GST @ 18%', value: 18 },
  { label: 'GST @ 28%', value: 28 },
];

const DEFAULT_UNITS = ['NONE', 'PCS', 'BOX', 'KGS', 'MTR', 'NOS', 'PKT', 'BAG', 'LTR', 'SET', 'ROLL'];

export default function VyaparInvoiceEditor({
  entryType = 'sale', // 'sale' | 'purchase'
  docType = 'tax-invoice',
  editingRecord = null,
  profile = null,
  onSave = null,
  onBack = null
}) {
  const isPurchase = entryType === 'purchase';

  // Title calculation
  const titleText = useMemo(() => {
    if (isPurchase) {
      if (docType === 'purchase-order') return 'Purchase Order';
      if (docType === 'purchase-return') return 'Debit Note / Return';
      return 'Purchase';
    }
    if (docType === 'estimate') return 'Estimate / Quotation';
    if (docType === 'sale-order') return 'Sale Order';
    if (docType === 'delivery-challan') return 'Delivery Challan';
    if (docType === 'credit-note') return 'Credit Note';
    return 'Sale';
  }, [isPurchase, docType]);

  // Pill toggle: 'Credit' | 'Cash'
  const [paymentMode, setPaymentMode] = useState(() => {
    if (editingRecord?.data?.paymentMode) return editingRecord.data.paymentMode;
    if (editingRecord?.paymentStatus === 'Paid') return 'Cash';
    if (editingRecord?.status === 'paid') return 'Cash';
    return 'Credit';
  });

  // Party (Customer / Supplier)
  const [partyName, setPartyName] = useState(() => {
    return editingRecord?.clientName || editingRecord?.supplierName || '';
  });
  const [partyPhone, setPartyPhone] = useState(() => {
    return editingRecord?.clientPhone || editingRecord?.data?.client?.phone || editingRecord?.supplierPhone || '';
  });
  const [billingAddress, setBillingAddress] = useState(() => {
    return editingRecord?.clientAddress || editingRecord?.data?.client?.address || editingRecord?.supplierAddress || '';
  });
  const [partyBalance, setPartyBalance] = useState(0);

  // Lists
  const [allParties, setAllParties] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [showPartyModal, setShowPartyModal] = useState(false);

  // Invoice Details (Right Side)
  const [invoiceNumber, setInvoiceNumber] = useState(() => {
    return editingRecord?.invoiceNumber || '';
  });
  const [invoiceDate, setInvoiceDate] = useState(() => {
    if (editingRecord?.invoiceDate) return editingRecord.invoiceDate;
    if (editingRecord?.date) return editingRecord.date;
    return new Date().toISOString().split('T')[0];
  });
  const [paymentTerms, setPaymentTerms] = useState(() => {
    return editingRecord?.data?.details?.paymentTerms || 'Due on Receipt';
  });
  const [dueDate, setDueDate] = useState(() => {
    if (editingRecord?.dueDate) return editingRecord.dueDate;
    return new Date().toISOString().split('T')[0];
  });
  const [stateOfSupply, setStateOfSupply] = useState(() => {
    return editingRecord?.data?.details?.placeOfSupply || profile?.state || 'Tamil Nadu';
  });

  // Table Tax Mode (Without Tax vs With Tax)
  const [taxInclusive, setTaxInclusive] = useState(() => {
    return !!editingRecord?.data?.taxInclusive;
  });

  // Items Spreadsheet
  const emptyRow = () => ({
    id: Math.random().toString(36).substring(2, 9),
    name: '',
    hsn: '',
    quantity: 1,
    unit: 'NONE',
    rate: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 18,
    cessPercent: 0,
    amount: 0
  });

  const [items, setItems] = useState(() => {
    const rawItems = editingRecord?.items || editingRecord?.data?.items;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      return rawItems.map(i => ({
        id: i.id || Math.random().toString(36).substring(2, 9),
        name: i.name || '',
        hsn: i.hsn || '',
        quantity: Number(i.quantity) || 1,
        unit: i.unit || 'NONE',
        rate: Number(i.rate) || 0,
        discountPercent: Number(i.discountPercent) || (Number(i.discount) && Number(i.rate) ? (Number(i.discount) / (Number(i.rate) * (Number(i.quantity) || 1))) * 100 : 0),
        discountAmount: Number(i.discountAmount) || Number(i.discount) || 0,
        taxPercent: Number(i.taxPercent) !== undefined ? Number(i.taxPercent) : 18,
        cessPercent: Number(i.cessPercent) || 0,
        amount: Number(i.amount) || 0
      }));
    }
    // Vyapar default has 2 empty rows ready
    return [emptyRow(), emptyRow()];
  });

  // Terms & Conditions
  const [termsTitle, setTermsTitle] = useState(() => {
    return editingRecord?.data?.customTerms?.title || (isPurchase ? 'Purchase Terms' : 'Sale Invoice');
  });
  const [termsText, setTermsText] = useState(() => {
    return editingRecord?.terms || editingRecord?.data?.customTerms?.text || 'Thanks for doing business with us!';
  });

  // Description & Attachments
  const [showDescription, setShowDescription] = useState(false);
  const [descriptionText, setDescriptionText] = useState(() => {
    return editingRecord?.notes || editingRecord?.note || '';
  });
  const [attachedImage, setAttachedImage] = useState(null);
  const [attachedDocName, setAttachedDocName] = useState(null);

  // Round Off & Total
  const [applyRoundOff, setApplyRoundOff] = useState(true);
  const [roundOffManual, setRoundOffManual] = useState(0);

  // Popups & Tools
  const [showCalc, setShowCalc] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showThermalModal, setShowThermalModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load parties & products & Peek Next Number on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        if (isPurchase) {
          const sups = await getAllSuppliers();
          setAllParties(sups || []);
        } else {
          const cls = await getAllClients();
          setAllParties(cls || []);
        }

        const prods = await getAllProducts();
        setAllProducts(prods || []);

        if (!editingRecord && !invoiceNumber) {
          const pfx = isPurchase ? 'PUR' : (docType === 'estimate' ? 'EST' : 'INV');
          const nextNum = await getNextInvoiceNumber(pfx, { peek: true });
          setInvoiceNumber(nextNum);
        }
      } catch (e) {
        console.error('Failed loading initial data', e);
      }
    }
    loadInitialData();
  }, [isPurchase, docType, editingRecord]);

  // Compute party outstanding balance when partyName changes
  useEffect(() => {
    if (!partyName) {
      setPartyBalance(0);
      return;
    }
    async function computeBalance() {
      try {
        if (isPurchase) {
          const allP = await getAllPurchases();
          const partyPurchases = (allP || []).filter(p => (p.supplierName || '').trim().toLowerCase() === partyName.trim().toLowerCase());
          const unpaid = partyPurchases.reduce((acc, p) => {
            const tot = Number(p.totalAmount || 0);
            return p.paymentStatus === 'Paid' ? acc : acc + tot;
          }, 0);
          setPartyBalance(unpaid);
        } else {
          const allB = await getAllBills();
          const partyBills = (allB || []).filter(b => (b.clientName || '').trim().toLowerCase() === partyName.trim().toLowerCase());
          const unpaid = partyBills.reduce((acc, b) => {
            const tot = Number(b.totalAmount || 0);
            const paid = Number(b.paidAmount || (b.status === 'paid' ? tot : 0));
            return acc + Math.max(0, tot - paid);
          }, 0);
          setPartyBalance(unpaid);
        }
      } catch (err) {
        // ignore
      }
    }
    computeBalance();
  }, [partyName, isPurchase]);

  // Auto-calculate Due Date when Payment Terms changes
  useEffect(() => {
    if (!invoiceDate) return;
    const base = new Date(invoiceDate);
    if (isNaN(base.getTime())) return;
    let daysToAdd = 0;
    if (paymentTerms === 'Net 15') daysToAdd = 15;
    else if (paymentTerms === 'Net 30') daysToAdd = 30;
    else if (paymentTerms === 'Net 45') daysToAdd = 45;
    else if (paymentTerms === 'Net 60') daysToAdd = 60;
    base.setDate(base.getDate() + daysToAdd);
    setDueDate(base.toISOString().split('T')[0]);
  }, [paymentTerms, invoiceDate]);

  // Party Selection Handler
  const handleSelectParty = (selectedName) => {
    setPartyName(selectedName);
    const found = allParties.find(p => (p.name || '').trim().toLowerCase() === selectedName.trim().toLowerCase());
    if (found) {
      if (found.phone) setPartyPhone(found.phone);
      const addr = [found.address, found.city, found.state, found.pin].filter(Boolean).join(', ');
      if (addr) setBillingAddress(addr);
      if (found.state) setStateOfSupply(found.state);
    }
  };

  // Recalculate row amounts
  const calculateRowAmount = (row, isTaxInc = taxInclusive) => {
    const qty = Number(row.quantity) || 0;
    const rate = Number(row.rate) || 0;
    const gross = qty * rate;
    const disc = Number(row.discountAmount) || 0;
    const afterDisc = Math.max(0, gross - disc);
    const taxRate = Number(row.taxPercent) || 0;

    let rowTax = 0;
    let rowTotal = 0;

    if (isTaxInc && taxRate > 0) {
      const taxable = afterDisc / (1 + taxRate / 100);
      rowTax = afterDisc - taxable;
      rowTotal = afterDisc;
    } else {
      rowTax = (afterDisc * taxRate) / 100;
      rowTotal = afterDisc + rowTax;
    }

    return {
      taxAmount: Math.round(rowTax * 100) / 100,
      amount: Math.round(rowTotal * 100) / 100
    };
  };

  // Update item field
  const updateItem = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      const row = { ...copy[index], [field]: value };

      // Autocomplete product when typing name
      if (field === 'name') {
        const prod = allProducts.find(p => (p.name || '').trim().toLowerCase() === String(value).trim().toLowerCase());
        if (prod) {
          if (prod.price) row.rate = Number(prod.price);
          if (prod.unit) row.unit = prod.unit;
          if (prod.taxPercent !== undefined) row.taxPercent = Number(prod.taxPercent);
          if (prod.hsn) row.hsn = prod.hsn;
        }
      }

      // Handle Discount % vs Amount sync
      const qty = Number(row.quantity) || 0;
      const rate = Number(row.rate) || 0;
      const gross = qty * rate;

      if (field === 'discountPercent') {
        const pct = Math.min(100, Math.max(0, Number(value) || 0));
        row.discountPercent = pct;
        row.discountAmount = Math.round(((gross * pct) / 100) * 100) / 100;
      } else if (field === 'discountAmount') {
        const amt = Math.max(0, Number(value) || 0);
        row.discountAmount = amt;
        row.discountPercent = gross > 0 ? Math.round(((amt / gross) * 100) * 100) / 100 : 0;
      } else if (field === 'quantity' || field === 'rate') {
        // Re-apply discount percent on changed gross
        const pct = Number(row.discountPercent) || 0;
        row.discountAmount = Math.round(((gross * pct) / 100) * 100) / 100;
      }

      const { taxAmount, amount } = calculateRowAmount(row, taxInclusive);
      row.amount = amount;
      row.taxAmount = taxAmount;

      copy[index] = row;
      return copy;
    });
  };

  const addRow = () => {
    setItems(prev => [...prev, emptyRow()]);
  };

  const removeRow = (index) => {
    setItems(prev => {
      if (prev.length <= 1) return [emptyRow()];
      return prev.filter((_, i) => i !== index);
    });
  };

  // Re-calculate all items when taxInclusive changes
  const toggleTaxInclusive = () => {
    const nextInc = !taxInclusive;
    setTaxInclusive(nextInc);
    setItems(prev => prev.map(row => {
      const { taxAmount, amount } = calculateRowAmount(row, nextInc);
      return { ...row, taxAmount, amount };
    }));
  };

  // Totals calculations
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let subtotal = 0;

    items.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const gross = qty * rate;
      const disc = Number(item.discountAmount) || 0;
      const afterDisc = Math.max(0, gross - disc);
      const taxRate = Number(item.taxPercent) || 0;

      totalQty += qty;
      totalDiscount += disc;

      if (taxInclusive && taxRate > 0) {
        const taxable = afterDisc / (1 + taxRate / 100);
        const tax = afterDisc - taxable;
        totalTax += tax;
        subtotal += taxable;
      } else {
        const tax = (afterDisc * taxRate) / 100;
        totalTax += tax;
        subtotal += afterDisc;
      }
    });

    const rawGrandTotal = subtotal + totalTax;
    let roundOffDiff = 0;
    let grandTotal = rawGrandTotal;

    if (applyRoundOff) {
      const rounded = Math.round(rawGrandTotal);
      roundOffDiff = Math.round((rounded - rawGrandTotal) * 100) / 100;
      grandTotal = rounded;
    } else {
      grandTotal = Math.round(rawGrandTotal * 100) / 100;
    }

    return {
      totalQty,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      roundOff: roundOffDiff,
      grandTotal
    };
  }, [items, taxInclusive, applyRoundOff]);

  // Save handler (Sale or Purchase)
  const handleSave = async () => {
    if (!partyName.trim()) {
      toast.error(`Please specify a ${isPurchase ? 'Supplier' : 'Customer'} name`);
      return;
    }

    const validItems = items.filter(i => (i.name || '').trim() !== '' || (Number(i.rate) > 0));
    if (validItems.length === 0) {
      toast.error('Please enter at least one item');
      return;
    }

    setIsSaving(true);
    try {
      if (isPurchase) {
        const purchasePayload = {
          id: editingRecord?.id || undefined,
          date: invoiceDate,
          supplierName: partyName.trim(),
          supplierAddress: billingAddress.trim(),
          supplierPhone: partyPhone.trim(),
          invoiceNumber: invoiceNumber.trim() || `PUR-${Date.now().toString().slice(-4)}`,
          paymentStatus: paymentMode === 'Cash' ? 'Paid' : 'Unpaid',
          applyRoundOff,
          roundOff: totals.roundOff,
          totalAmount: totals.grandTotal,
          totalTax: totals.totalTax,
          taxableAmount: totals.subtotal,
          note: descriptionText.trim(),
          docType: docType || 'purchase-bills',
          items: validItems.map(i => ({
            name: i.name.trim(),
            hsn: i.hsn.trim(),
            quantity: Number(i.quantity) || 1,
            unit: i.unit,
            rate: Number(i.rate) || 0,
            taxPercent: Number(i.taxPercent) || 0,
            cessPercent: Number(i.cessPercent) || 0,
            discount: Number(i.discountAmount) || 0,
            amount: Number(i.amount) || 0
          }))
        };
        await savePurchase(purchasePayload);
        toast.success(`${titleText} saved successfully!`);
      } else {
        const isPaid = paymentMode === 'Cash';
        const salePayload = {
          id: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
          invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
          clientName: partyName.trim(),
          clientPhone: partyPhone.trim(),
          clientAddress: billingAddress.trim(),
          invoiceDate,
          dueDate,
          invoiceType: docType || 'tax-invoice',
          currency: 'INR',
          totalAmount: totals.grandTotal,
          totalTaxAmount: totals.totalTax,
          subtotal: totals.subtotal,
          status: isPaid ? 'paid' : 'unpaid',
          paidAmount: isPaid ? totals.grandTotal : 0,
          payments: isPaid ? [{
            id: Date.now().toString(),
            date: invoiceDate,
            amount: totals.grandTotal,
            method: 'Cash',
            notes: 'Counter Cash settlement'
          }] : [],
          notes: descriptionText.trim(),
          terms: termsText.trim(),
          items: validItems.map(i => ({
            name: i.name.trim(),
            hsn: i.hsn.trim(),
            quantity: Number(i.quantity) || 1,
            unit: i.unit,
            rate: Number(i.rate) || 0,
            taxPercent: Number(i.taxPercent) || 0,
            discount: Number(i.discountAmount) || 0,
            amount: Number(i.amount) || 0
          })),
          data: {
            profile,
            client: {
              name: partyName.trim(),
              phone: partyPhone.trim(),
              address: billingAddress.trim(),
              state: stateOfSupply
            },
            details: {
              invoiceNumber: invoiceNumber.trim(),
              invoiceDate,
              dueDate,
              paymentTerms,
              placeOfSupply: stateOfSupply
            },
            items: validItems,
            totals: {
              subtotal: totals.subtotal,
              totalTaxAmount: totals.totalTax,
              roundOff: totals.roundOff,
              total: totals.grandTotal
            },
            taxInclusive,
            paymentMode,
            customTerms: {
              title: termsTitle,
              text: termsText
            }
          }
        };

        const shouldOverwrite = !!editingRecord;
        await saveBill(salePayload, { overwrite: shouldOverwrite });
        toast.success(`${titleText} saved successfully!`);
      }

      if (onSave) onSave();
      if (onBack) onBack();
    } catch (err) {
      console.error('Failed to save record:', err);
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Alt+S or Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [partyName, items, totals, invoiceNumber, invoiceDate, paymentMode]);

  return (
    <div className="vyapar-editor-page animate-fade-in">
      {/* 1. TOP HEADER BAR */}
      <div className="vyapar-top-header">
        <div className="vyapar-title-group">
          <h2 className="vyapar-title">{titleText}</h2>

          {/* Vyapar Pill Toggle: Credit / Cash */}
          <div className="vyapar-toggle-wrap">
            <span
              className={`vyapar-toggle-label ${paymentMode === 'Credit' ? 'active-credit' : ''}`}
              onClick={() => setPaymentMode('Credit')}
            >
              Credit
            </span>
            <div
              className={`vyapar-toggle-switch ${paymentMode === 'Cash' ? 'is-cash' : ''}`}
              onClick={() => setPaymentMode(prev => prev === 'Credit' ? 'Cash' : 'Credit')}
            >
              <div className="vyapar-toggle-slider" />
            </div>
            <span
              className={`vyapar-toggle-label ${paymentMode === 'Cash' ? 'active-cash' : ''}`}
              onClick={() => setPaymentMode('Cash')}
            >
              Cash
            </span>
          </div>
        </div>

        {/* Top Right Quick Utilities */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            title="Calculator"
            onClick={() => setShowCalc(prev => !prev)}
            style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center' }}
          >
            <Calculator size={17} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            title="Tax Inclusive / Exclusive"
            onClick={toggleTaxInclusive}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
          >
            {taxInclusive ? 'Tax: Inclusive' : 'Tax: Exclusive'}
          </button>
          {onBack && (
            <button
              type="button"
              className="btn btn-secondary"
              title="Close"
              onClick={onBack}
              style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center' }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 2. TOP METADATA GRID */}
      <div className="vyapar-meta-grid">
        {/* Left Column: Party Details */}
        <div className="vyapar-party-col">
          <div className="vyapar-party-row">
            {/* Customer / Supplier with Floating Label */}
            <div>
              <div className="vyapar-fieldset">
                <span className="vyapar-floating-label">
                  {isPurchase ? 'Supplier *' : 'Customer *'}
                </span>
                <input
                  type="text"
                  className="vyapar-field-input"
                  list="vyapar-parties-datalist"
                  value={partyName}
                  onChange={e => handleSelectParty(e.target.value)}
                  placeholder="Select or Type Name"
                />
                <datalist id="vyapar-parties-datalist">
                  {allParties.map(p => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.phone ? `${p.name} (${p.phone})` : p.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="vyapar-balance-badge">
                BAL: ₹ {Number(partyBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Phone No with Floating Label */}
            <div>
              <div className="vyapar-fieldset">
                <span className="vyapar-floating-label">Phone No.</span>
                <input
                  type="text"
                  className="vyapar-field-input"
                  value={partyPhone}
                  onChange={e => setPartyPhone(e.target.value)}
                  placeholder="Enter phone"
                />
              </div>
            </div>
          </div>

          {/* Billing Address Fieldset */}
          <div className="vyapar-fieldset">
            <span className="vyapar-floating-label">Billing Address</span>
            <textarea
              className="vyapar-field-textarea"
              rows={2}
              value={billingAddress}
              onChange={e => setBillingAddress(e.target.value)}
              placeholder="Enter billing address"
            />
          </div>
        </div>

        {/* Right Column: Invoice Meta Details */}
        <div className="vyapar-details-table">
          <div className="vyapar-detail-row">
            <span className="vyapar-detail-label">
              {isPurchase ? 'Bill Number' : 'Invoice Number'}
            </span>
            <div className="vyapar-detail-val-wrap">
              <input
                type="text"
                className="vyapar-detail-input"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="vyapar-detail-row">
            <span className="vyapar-detail-label">
              {isPurchase ? 'Bill Date' : 'Invoice Date'}
            </span>
            <div className="vyapar-detail-val-wrap">
              <input
                type="date"
                className="vyapar-detail-input"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>

          <div className="vyapar-detail-row">
            <span className="vyapar-detail-label">Payment Terms</span>
            <div className="vyapar-detail-val-wrap">
              <select
                className="vyapar-detail-input"
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
              >
                <option value="Due on Receipt">Due on Receipt</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 45">Net 45 Days</option>
                <option value="Net 60">Net 60 Days</option>
              </select>
            </div>
          </div>

          <div className="vyapar-detail-row">
            <span className="vyapar-detail-label">Due Date</span>
            <div className="vyapar-detail-val-wrap">
              <input
                type="date"
                className="vyapar-detail-input"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="vyapar-detail-row">
            <span className="vyapar-detail-label">State of supply</span>
            <div className="vyapar-detail-val-wrap">
              <select
                className="vyapar-detail-input"
                value={stateOfSupply}
                onChange={e => setStateOfSupply(e.target.value)}
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. VYAPAR SPREADSHEET ITEMS TABLE */}
      <div className="vyapar-table-container">
        <table className="vyapar-grid-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }} title="Scan Barcode">
                <ScanBarcode size={15} style={{ margin: '0 auto', color: '#64748b' }} />
              </th>
              <th style={{ width: '40px' }}>#</th>
              <th style={{ minWidth: '220px', textAlign: 'left' }}>ITEM</th>
              <th style={{ width: '70px' }}>QTY</th>
              <th style={{ width: '90px' }}>UNIT</th>
              <th style={{ width: '110px' }}>
                <span onClick={toggleTaxInclusive} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  PRICE/UNIT <ChevronDown size={12} />
                </span>
                <div style={{ fontSize: '0.65rem', fontWeight: 400, color: '#64748b' }}>
                  {taxInclusive ? 'With Tax' : 'Without Tax'}
                </div>
              </th>
              <th colSpan={2} style={{ width: '130px' }}>
                DISCOUNT
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.65rem', fontWeight: 400, color: '#64748b' }}>
                  <span>%</span>
                  <span>AMOUNT</span>
                </div>
              </th>
              <th colSpan={2} style={{ width: '160px' }}>
                TAX
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.65rem', fontWeight: 400, color: '#64748b' }}>
                  <span>%</span>
                  <span>AMOUNT</span>
                </div>
              </th>
              <th style={{ width: '110px', textAlign: 'right' }}>AMOUNT</th>
              <th style={{ width: '36px' }}>
                <button
                  type="button"
                  onClick={addRow}
                  title="Add Row"
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}
                >
                  <Plus size={16} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={row.id}>
                {/* Barcode icon placeholder */}
                <td style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <ScanBarcode size={13} style={{ margin: '0 auto' }} />
                </td>

                {/* Row Index */}
                <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>

                {/* Item Name */}
                <td>
                  <input
                    type="text"
                    className="vyapar-cell-input"
                    list={`vyapar-prods-${idx}`}
                    value={row.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)}
                    placeholder="Enter item name"
                  />
                  <datalist id={`vyapar-prods-${idx}`}>
                    {allProducts.map(p => (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name} {p.price ? `- ₹${p.price}` : ''}
                      </option>
                    ))}
                  </datalist>
                </td>

                {/* Qty */}
                <td>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className="vyapar-cell-input"
                    style={{ textAlign: 'center' }}
                    value={row.quantity || ''}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                  />
                </td>

                {/* Unit */}
                <td>
                  <select
                    className="vyapar-cell-select"
                    value={row.unit || 'NONE'}
                    onChange={e => updateItem(idx, 'unit', e.target.value)}
                  >
                    {DEFAULT_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </td>

                {/* Rate */}
                <td>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="vyapar-cell-input"
                    style={{ textAlign: 'right' }}
                    value={row.rate || ''}
                    onChange={e => updateItem(idx, 'rate', e.target.value)}
                    placeholder="0.00"
                  />
                </td>

                {/* Discount % */}
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    className="vyapar-cell-input"
                    style={{ textAlign: 'center' }}
                    value={row.discountPercent || ''}
                    onChange={e => updateItem(idx, 'discountPercent', e.target.value)}
                    placeholder="0"
                  />
                </td>

                {/* Discount Amount */}
                <td>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="vyapar-cell-input"
                    style={{ textAlign: 'right' }}
                    value={row.discountAmount || ''}
                    onChange={e => updateItem(idx, 'discountAmount', e.target.value)}
                    placeholder="0.00"
                  />
                </td>

                {/* Tax % */}
                <td>
                  <select
                    className="vyapar-cell-select"
                    value={row.taxPercent}
                    onChange={e => updateItem(idx, 'taxPercent', Number(e.target.value))}
                  >
                    {GST_RATES.map(r => (
                      <option key={r.label} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </td>

                {/* Tax Amount (Display) */}
                <td style={{ textAlign: 'right', padding: '0 6px', color: '#475569' }}>
                  {Number(row.taxAmount || 0).toFixed(2)}
                </td>

                {/* Line Total Amount */}
                <td style={{ textAlign: 'right', padding: '0 8px', fontWeight: 600, color: '#0f172a' }}>
                  {Number(row.amount || 0).toFixed(2)}
                </td>

                {/* Delete row */}
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    title="Delete row"
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                  >
                    <Trash2 size={14} className="hover:text-red-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Table Summary Footer Row */}
          <tfoot>
            <tr className="vyapar-table-summary-row">
              <td colSpan={2}></td>
              <td style={{ textAlign: 'left', fontWeight: 700, paddingLeft: '8px' }}>TOTAL</td>
              <td style={{ textAlign: 'center' }}>{totals.totalQty}</td>
              <td></td>
              <td></td>
              <td></td>
              <td style={{ textAlign: 'right' }}>{totals.totalDiscount.toFixed(2)}</td>
              <td></td>
              <td style={{ textAlign: 'right' }}>{totals.totalTax.toFixed(2)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                {totals.grandTotal.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Row Button */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={addRow}
          className="btn btn-secondary"
          style={{
            borderColor: '#2563eb',
            color: '#2563eb',
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '0.35rem 0.85rem'
          }}
        >
          ADD ROW
        </button>
      </div>

      {/* 4. BOTTOM 3-COLUMN SECTION */}
      <div className="vyapar-bottom-grid">
        {/* Left: Terms & Conditions Card */}
        <div className="vyapar-terms-box">
          <div className="vyapar-terms-title">Terms &amp; Conditions</div>
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Title</span>
            <select
              className="vyapar-detail-input"
              style={{ marginTop: '2px', padding: '0.25rem 0.5rem' }}
              value={termsTitle}
              onChange={e => setTermsTitle(e.target.value)}
            >
              <option value="Sale Invoice">Sale Invoice</option>
              <option value="Standard Terms">Standard Terms</option>
              <option value="Payment Terms">Payment Terms</option>
            </select>
          </div>
          <textarea
            className="vyapar-field-textarea"
            style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px', minHeight: '60px' }}
            value={termsText}
            onChange={e => setTermsText(e.target.value)}
          />
        </div>

        {/* Middle: Action Buttons Stack */}
        <div className="vyapar-actions-stack">
          <button
            type="button"
            className="vyapar-action-pill-btn"
            onClick={() => setShowDescription(prev => !prev)}
          >
            <Plus size={14} /> Add Description
          </button>
          {showDescription && (
            <textarea
              className="form-input"
              rows={2}
              style={{ fontSize: '0.8rem' }}
              placeholder="Enter notes / description"
              value={descriptionText}
              onChange={e => setDescriptionText(e.target.value)}
            />
          )}

          <label className="vyapar-action-pill-btn" style={{ margin: 0, cursor: 'pointer' }}>
            <Camera size={14} /> {attachedImage ? 'Change Image' : 'Add Image'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setAttachedImage(URL.createObjectURL(e.target.files[0]));
                  toast.info('Image attached');
                }
              }}
            />
          </label>
          {attachedImage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img src={attachedImage} alt="attachment" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
              <button type="button" onClick={() => setAttachedImage(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button>
            </div>
          )}

          <label className="vyapar-action-pill-btn" style={{ margin: 0, cursor: 'pointer' }}>
            <FileText size={14} /> {attachedDocName ? 'Change Document' : 'Add Document'}
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setAttachedDocName(e.target.files[0].name);
                  toast.info('Document attached');
                }
              }}
            />
          </label>
          {attachedDocName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#475569' }}>
              <span>{attachedDocName}</span>
              <button type="button" onClick={() => setAttachedDocName(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Remove</button>
            </div>
          )}
        </div>

        {/* Right: Round Off & Grand Total Card */}
        <div className="vyapar-total-card">
          <div className="vyapar-roundoff-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={applyRoundOff}
                onChange={e => setApplyRoundOff(e.target.checked)}
              />
              <span>Round Off</span>
            </label>
            <input
              type="text"
              readOnly
              className="vyapar-detail-input"
              style={{ width: '70px', textAlign: 'center', padding: '0.2rem' }}
              value={totals.roundOff > 0 ? `+${totals.roundOff}` : totals.roundOff}
            />
          </div>

          <div className="vyapar-grand-total-row">
            <span className="vyapar-grand-total-label">Total</span>
            <div className="vyapar-grand-total-box">
              ₹ {totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. STICKY BOTTOM ACTION BAR */}
      <div className="vyapar-footer-bar">
        {/* Share Button with Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="vyapar-share-dropdown-btn"
            onClick={() => setShowShareMenu(prev => !prev)}
          >
            Share <ChevronDown size={14} />
          </button>
          {showShareMenu && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: '170px',
                zIndex: 100,
                overflow: 'hidden'
              }}
            >
              <button
                type="button"
                className="btn-link"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.84rem', cursor: 'pointer' }}
                onClick={() => { setShowShareMenu(false); setShowPrintModal(true); }}
              >
                <Printer size={15} /> Print (A4)
              </button>
              <button
                type="button"
                className="btn-link"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.84rem', cursor: 'pointer' }}
                onClick={() => { setShowShareMenu(false); setShowThermalModal(true); }}
              >
                <Printer size={15} /> Thermal Print
              </button>
              <button
                type="button"
                className="btn-link"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.84rem', cursor: 'pointer', color: '#16a34a' }}
                onClick={() => {
                  setShowShareMenu(false);
                  openWhatsAppShare({
                    clientPhone: partyPhone,
                    invoiceNumber,
                    totalAmount: totals.grandTotal,
                    dueDate,
                    businessName: profile?.businessName || 'Business'
                  });
                }}
              >
                <MessageCircle size={15} /> WhatsApp
              </button>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          type="button"
          className="vyapar-save-btn"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? 'Saving...' : <><u>S</u>ave</>}
        </button>
      </div>

      {/* QUICK FLOATING CALCULATOR MODAL */}
      {showCalc && (
        <div className="vyapar-calc-modal animate-scale-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Calculator</span>
            <button type="button" onClick={() => setShowCalc(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '6px', textAlign: 'right', fontSize: '1.2rem', fontWeight: 700, minHeight: '36px', marginBottom: '8px' }}>
            {calcInput || '0'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {['C', '(', ')', '/'].map(k => (
              <button key={k} type="button" className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.85rem' }} onClick={() => k === 'C' ? setCalcInput('') : setCalcInput(prev => prev + k)}>{k}</button>
            ))}
            {['7', '8', '9', '*'].map(k => (
              <button key={k} type="button" className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.85rem' }} onClick={() => setCalcInput(prev => prev + k)}>{k}</button>
            ))}
            {['4', '5', '6', '-'].map(k => (
              <button key={k} type="button" className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.85rem' }} onClick={() => setCalcInput(prev => prev + k)}>{k}</button>
            ))}
            {['1', '2', '3', '+'].map(k => (
              <button key={k} type="button" className="btn btn-secondary" style={{ padding: '6px', fontSize: '0.85rem' }} onClick={() => setCalcInput(prev => prev + k)}>{k}</button>
            ))}
            {['0', '.', '=', '⌫'].map(k => (
              <button
                key={k}
                type="button"
                className={`btn ${k === '=' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px', fontSize: '0.85rem' }}
                onClick={() => {
                  if (k === '⌫') setCalcInput(prev => prev.slice(0, -1));
                  else if (k === '=') {
                    try {
                      // Safe arithmetic evaluation
                      const res = Function(`'use strict'; return (${calcInput})`)();
                      setCalcInput(String(Math.round(res * 100) / 100));
                    } catch {
                      setCalcInput('Error');
                    }
                  } else {
                    setCalcInput(prev => prev + k);
                  }
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* THERMAL PREVIEW MODAL */}
      {showThermalModal && (
        <ThermalPreviewModal
          show={showThermalModal}
          onClose={() => setShowThermalModal(false)}
          bill={{
            invoiceNumber,
            invoiceDate,
            clientName: partyName,
            clientPhone: partyPhone,
            items,
            totalAmount: totals.grandTotal,
            subtotal: totals.subtotal,
            totalTaxAmount: totals.totalTax,
            data: { profile, items, totals }
          }}
          profile={profile}
        />
      )}

      {/* A4 PRINT PREVIEW MODAL */}
      {showPrintModal && (
        <InvoicePreviewModal
          show={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          bill={{
            invoiceNumber,
            invoiceDate,
            clientName: partyName,
            clientPhone: partyPhone,
            clientAddress: billingAddress,
            items,
            totalAmount: totals.grandTotal,
            subtotal: totals.subtotal,
            totalTaxAmount: totals.totalTax,
            notes: descriptionText,
            terms: termsText,
            data: { profile, items, totals, details: { invoiceNumber, invoiceDate, dueDate } }
          }}
          profile={profile}
        />
      )}
    </div>
  );
}
