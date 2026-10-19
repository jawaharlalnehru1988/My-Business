import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  Calculator, X, Plus, Trash2, Printer,
  Camera, FileText, ChevronDown, MessageCircle, ScanBarcode,
  Sparkles, UserPlus, Truck, ShieldCheck
} from 'lucide-react';
import {
  saveBill, getNextInvoiceNumber, getAllClients, saveClient,
  getAllSuppliers, saveSupplier, getAllProducts, saveProduct,
  savePurchase, getAllPurchases, getAllBills, getProfile
} from '../store';
import {
  getAllUnits
} from '../utils';
import { toast } from './Toast';
import ClientModal from './ClientModal';
import SupplierModal from './SupplierModal';
import ThermalPreviewModal from './ThermalPreviewModal';
import InvoicePreviewModal from './InvoicePreviewModal';
import { openWhatsAppShare } from '../utils/share';

const BillOCR = lazy(() => import('./BillOCR'));

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

const GST_STATE_CODE_MAP = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
};

const GST_RATES = [
  { label: 'None (0%)', value: 0 },
  { label: 'GST @ 0%', value: 0 },
  { label: 'GST @ 0.25%', value: 0.25 },
  { label: 'GST @ 3%', value: 3 },
  { label: 'GST @ 5%', value: 5 },
  { label: 'GST @ 12%', value: 12 },
  { label: 'GST @ 18%', value: 18 },
  { label: 'GST @ 28%', value: 28 },
];

const DEFAULT_UNITS = ['NONE', 'PCS', 'BOX', 'KGS', 'GMS', 'MTR', 'NOS', 'PKT', 'BAG', 'LTR', 'SET', 'ROLL', 'DOZ', 'QTL', 'TON'];

const PAYMENT_TYPES = [
  'Cash',
  'UPI / QR',
  'Bank Transfer (NEFT/RTGS/IMPS)',
  'Cheque',
  'Card'
];

const RETURN_REASONS = [
  'Damaged Goods',
  'Quality Issue',
  'Rate Difference',
  'Excess Quantity',
  'Sales / Purchase Return',
  'Expired Stock',
  'Other'
];

export default function VyaparInvoiceEditor({
  entryType = 'sale', // 'sale' | 'purchase'
  docType = 'tax-invoice',
  editingRecord = null,
  profile: propProfile = null,
  onSave = null,
  onBack = null
}) {
  const isPurchase = entryType === 'purchase';
  const isReturnDoc = docType === 'credit-note' || docType === 'purchase-return';
  const isOrderDoc = docType === 'sale-order' || docType === 'purchase-order';
  const isEstimateDoc = docType === 'estimate' || docType === 'delivery-challan';

  // Active Business Profile (props or fetched from store)
  const [activeProfile, setActiveProfile] = useState(propProfile || {});
  useEffect(() => {
    if (propProfile && Object.keys(propProfile).length > 0) {
      setActiveProfile(propProfile);
    } else {
      getProfile().then(p => {
        if (p && typeof p === 'object') setActiveProfile(p);
      }).catch(() => {});
    }
  }, [propProfile]);

  // Title calculation
  const titleText = useMemo(() => {
    if (isPurchase) {
      if (docType === 'purchase-order') return 'Purchase Order';
      if (docType === 'purchase-return') return 'Purchase Return / Debit Note';
      return 'Purchase';
    }
    if (docType === 'estimate') return 'Estimate / Quotation';
    if (docType === 'sale-order') return 'Sale Order';
    if (docType === 'delivery-challan') return 'Delivery Challan';
    if (docType === 'credit-note') return 'Credit Note / Sale Return';
    return 'Sale';
  }, [isPurchase, docType]);

  // Pill toggle: 'Credit' | 'Cash'
  const [paymentMode, setPaymentMode] = useState(() => {
    if (editingRecord?.data?.paymentMode) return editingRecord.data.paymentMode;
    if (editingRecord?.paymentMode) return editingRecord.paymentMode;
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
  const [partyGstin, setPartyGstin] = useState(() => {
    return editingRecord?.clientGstin || editingRecord?.data?.client?.gstin || editingRecord?.supplierGstin || '';
  });
  const [billingAddress, setBillingAddress] = useState(() => {
    return editingRecord?.clientAddress || editingRecord?.data?.client?.address || editingRecord?.supplierAddress || '';
  });
  const [shippingAddress, setShippingAddress] = useState(() => {
    return editingRecord?.shippingAddress || editingRecord?.data?.client?.shippingAddress || '';
  });
  const [showShippingAddress, setShowShippingAddress] = useState(() => {
    return Boolean(editingRecord?.shippingAddress || editingRecord?.data?.client?.shippingAddress);
  });
  const [partyBalance, setPartyBalance] = useState(0);

  // Lists & Modals
  const [allParties, setAllParties] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);

  // Dynamic units list merging default Vyapar units + custom user units
  const unitOptions = useMemo(() => {
    try {
      const custom = (getAllUnits() || []).map(u => String(typeof u === 'string' ? u : (u.uqc || u.label || u.code || 'PCS')).toUpperCase());
      return Array.from(new Set([...DEFAULT_UNITS, ...custom]));
    } catch {
      return DEFAULT_UNITS;
    }
  }, []);

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
    return editingRecord?.data?.details?.paymentTerms || editingRecord?.paymentTerms || 'Due on Receipt';
  });
  const [dueDate, setDueDate] = useState(() => {
    if (editingRecord?.dueDate) return editingRecord.dueDate;
    if (editingRecord?.expectedDeliveryDate) return editingRecord.expectedDeliveryDate;
    return new Date().toISOString().split('T')[0];
  });
  const [stateOfSupply, setStateOfSupply] = useState(() => {
    return editingRecord?.data?.details?.placeOfSupply || editingRecord?.stateOfSupply || propProfile?.state || 'Tamil Nadu';
  });

  // Optional PO / E-Way Bill / Return Reference Fields (Vyapar HEADER_* parity)
  const [poNumber, setPoNumber] = useState(() => {
    return editingRecord?.poNumber || editingRecord?.data?.details?.poNumber || '';
  });
  const [poDate, setPoDate] = useState(() => {
    return editingRecord?.poDate || editingRecord?.data?.details?.poDate || '';
  });
  const [ewayBillNo, setEwayBillNo] = useState(() => {
    return editingRecord?.ewayBillNo || editingRecord?.data?.details?.ewayBillNo || '';
  });
  const [showPoEwayFields, setShowPoEwayFields] = useState(() => {
    return Boolean(editingRecord?.poNumber || editingRecord?.ewayBillNo || editingRecord?.data?.details?.poNumber || editingRecord?.data?.details?.ewayBillNo);
  });

  // Return / Credit Note / Debit Note Specific Fields
  const [originalBillNo, setOriginalBillNo] = useState(() => {
    return editingRecord?.originalBillNo || editingRecord?.data?.details?.originalBillNo || '';
  });
  const [originalBillDate, setOriginalBillDate] = useState(() => {
    return editingRecord?.originalBillDate || editingRecord?.data?.details?.originalBillDate || '';
  });
  const [returnReason, setReturnReason] = useState(() => {
    return editingRecord?.returnReason || editingRecord?.data?.details?.returnReason || 'Damaged Goods';
  });
  const [reverseStock, setReverseStock] = useState(() => {
    return editingRecord?.reverseStock !== undefined ? Boolean(editingRecord.reverseStock) : true;
  });

  // Table Tax Mode (Without Tax vs With Tax) & Optional Columns
  const [taxInclusive, setTaxInclusive] = useState(() => {
    return Boolean(editingRecord?.data?.taxInclusive || editingRecord?.taxInclusive);
  });
  const [showFreeQtyCol, setShowFreeQtyCol] = useState(() => {
    const raw = editingRecord?.items || editingRecord?.data?.items || [];
    return raw.some(i => Number(i.freeQty) > 0);
  });
  const [showBarcodeBar, setShowBarcodeBar] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Items Spreadsheet
  const emptyRow = () => ({
    id: Math.random().toString(36).substring(2, 9),
    productId: null,
    name: '',
    hsn: '',
    quantity: 1,
    freeQty: 0,
    unit: 'NONE',
    rate: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 18,
    cessPercent: 0,
    taxAmount: 0,
    amount: 0
  });

  const [items, setItems] = useState(() => {
    const rawItems = editingRecord?.items || editingRecord?.data?.items;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      return rawItems.map(i => {
        const qty = Number(i.quantity) || 1;
        const rate = Number(i.rate) || 0;
        const gross = qty * rate;
        const discAmt = Number(i.discountAmount) || Number(i.discount) || 0;
        const discPct = Number(i.discountPercent) || (discAmt && gross > 0 ? Math.round(((discAmt / gross) * 100) * 100) / 100 : 0);
        const taxPct = Number(i.taxPercent) !== undefined && !isNaN(Number(i.taxPercent)) ? Number(i.taxPercent) : 18;
        const afterDisc = Math.max(0, gross - discAmt);
        const isInc = Boolean(editingRecord?.data?.taxInclusive || editingRecord?.taxInclusive);
        const rowTax = isInc && taxPct > 0
          ? afterDisc - (afterDisc / (1 + taxPct / 100))
          : (afterDisc * taxPct) / 100;
        const rowAmt = isInc && taxPct > 0 ? afterDisc : afterDisc + rowTax;

        return {
          id: i.id || Math.random().toString(36).substring(2, 9),
          productId: i.productId || null,
          name: i.name || '',
          hsn: i.hsn || '',
          quantity: qty,
          freeQty: Number(i.freeQty) || 0,
          unit: i.unit || 'NONE',
          rate,
          discountPercent: discPct,
          discountAmount: discAmt,
          taxPercent: taxPct,
          cessPercent: Number(i.cessPercent) || 0,
          taxAmount: Math.round(rowTax * 100) / 100,
          amount: Number(i.amount) || Math.round(rowAmt * 100) / 100
        };
      });
    }
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
  const [showDescription, setShowDescription] = useState(() => {
    return Boolean(editingRecord?.notes || editingRecord?.note);
  });
  const [descriptionText, setDescriptionText] = useState(() => {
    return editingRecord?.notes || editingRecord?.note || '';
  });
  const [attachedImage, setAttachedImage] = useState(null);
  const [attachedDocName, setAttachedDocName] = useState(null);

  // Payment Type, Reference & Settlement (Vyapar FOOTER_* parity)
  const [paymentType, setPaymentType] = useState(() => {
    return editingRecord?.paymentType || editingRecord?.data?.paymentType || 'Cash';
  });
  const [paymentReference, setPaymentReference] = useState(() => {
    return editingRecord?.paymentReference || editingRecord?.data?.paymentReference || '';
  });

  // Bill-level Discount & Additional / Shipping Charges
  const [billDiscountPercent, setBillDiscountPercent] = useState(() => {
    return Number(editingRecord?.billDiscountPercent || editingRecord?.data?.billDiscountPercent || 0);
  });
  const [billDiscountAmount, setBillDiscountAmount] = useState(() => {
    return Number(editingRecord?.billDiscountAmount || editingRecord?.data?.billDiscountAmount || 0);
  });
  const [additionalCharges, setAdditionalCharges] = useState(() => {
    return Number(editingRecord?.additionalCharges || editingRecord?.data?.additionalCharges || 0);
  });
  const [additionalChargesLabel, setAdditionalChargesLabel] = useState(() => {
    return editingRecord?.additionalChargesLabel || editingRecord?.data?.additionalChargesLabel || 'Shipping / Packaging';
  });

  // Purchase GST / ITC Compliance Controls
  const [itcEligibility, setItcEligibility] = useState(() => {
    return editingRecord?.itcEligibility || editingRecord?.data?.itcEligibility || 'eligible';
  });
  const [reverseCharge, setReverseCharge] = useState(() => {
    return Boolean(editingRecord?.reverseCharge || editingRecord?.data?.reverseCharge);
  });

  // Round Off & Received/Paid Amount
  const [applyRoundOff, setApplyRoundOff] = useState(() => {
    return editingRecord?.applyRoundOff !== undefined ? Boolean(editingRecord.applyRoundOff) : true;
  });
  const [isReceivedChecked, setIsReceivedChecked] = useState(() => {
    if (editingRecord) {
      const paid = Number(editingRecord.paidAmount ?? (editingRecord.paymentStatus === 'Paid' || editingRecord.status === 'paid' ? editingRecord.totalAmount : 0));
      return paid > 0;
    }
    return paymentMode === 'Cash';
  });
  const [receivedAmount, setReceivedAmount] = useState(() => {
    if (editingRecord && editingRecord.paidAmount !== undefined) {
      return Number(editingRecord.paidAmount) || 0;
    }
    if (editingRecord && (editingRecord.paymentStatus === 'Paid' || editingRecord.status === 'paid')) {
      return Number(editingRecord.totalAmount) || 0;
    }
    return 0;
  });
  const [receivedManuallyEdited, setReceivedManuallyEdited] = useState(() => {
    return Boolean(editingRecord && editingRecord.paidAmount !== undefined);
  });

  // Popups & Tools
  const [showCalc, setShowCalc] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showThermalModal, setShowThermalModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync stateOfSupply when activeProfile loads if not editing
  useEffect(() => {
    if (!editingRecord && activeProfile?.state && stateOfSupply === 'Tamil Nadu') {
      setStateOfSupply(activeProfile.state);
    }
  }, [activeProfile, editingRecord]);

  // Detect interstate supply (State of Supply !== Business Profile State)
  const isInterstate = useMemo(() => {
    if (editingRecord?.interstate !== undefined && !stateOfSupply) {
      return Boolean(editingRecord.interstate);
    }
    const bizState = (activeProfile?.state || 'Tamil Nadu').trim().toLowerCase();
    const supState = (stateOfSupply || '').trim().toLowerCase();
    return Boolean(supState && bizState && supState !== bizState);
  }, [stateOfSupply, activeProfile, editingRecord]);

  // Load parties & products & Peek Next Number on mount
  const fetchPartiesAndProducts = async () => {
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
    } catch (e) {
      console.error('Failed loading parties/products', e);
    }
  };

  useEffect(() => {
    async function loadInitialData() {
      await fetchPartiesAndProducts();
      try {
        if (!editingRecord?.invoiceNumber && !invoiceNumber) {
          const pfx = isPurchase
            ? (docType === 'purchase-order' ? 'PO' : docType === 'purchase-return' ? 'DN' : 'PUR')
            : (docType === 'estimate' ? 'EST' : docType === 'sale-order' ? 'SO' : docType === 'credit-note' ? 'CN' : 'INV');
          const nextNum = await getNextInvoiceNumber(pfx, { peek: true });
          setInvoiceNumber(nextNum);
        }
      } catch (e) {
        console.error('Failed peeking next number', e);
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
          const partyPurchases = (allP || []).filter(p =>
            p.docType !== 'purchase-order' &&
            p.docType !== 'purchase-return' &&
            (p.supplierName || '').trim().toLowerCase() === partyName.trim().toLowerCase()
          );
          const unpaid = partyPurchases.reduce((acc, p) => {
            const tot = Number(p.totalAmount || 0);
            const paid = Number(p.paidAmount ?? (p.paymentStatus === 'Paid' ? tot : 0));
            return acc + Math.max(0, tot - paid);
          }, 0);
          setPartyBalance(unpaid);
        } else {
          const allB = await getAllBills();
          const partyBills = (allB || []).filter(b =>
            (b.clientName || '').trim().toLowerCase() === partyName.trim().toLowerCase()
          );
          const unpaid = partyBills.reduce((acc, b) => {
            const tot = Number(b.totalAmount || 0);
            const paid = Number(b.paidAmount ?? (b.status === 'paid' ? tot : 0));
            return acc + Math.max(0, tot - paid);
          }, 0);
          setPartyBalance(unpaid);
        }
      } catch {
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
      if (found.gstin) setPartyGstin(found.gstin);
      const addr = [found.address, found.city, found.state, found.pin].filter(Boolean).join(', ');
      if (addr) setBillingAddress(addr);
      if (found.state) setStateOfSupply(found.state);
    }
  };

  // Auto-detect State of Supply from 15-digit GSTIN prefix
  const handleGstinChange = (val) => {
    const upper = val.toUpperCase();
    setPartyGstin(upper);
    if (upper.length >= 2) {
      const code = upper.slice(0, 2);
      if (GST_STATE_CODE_MAP[code]) {
        setStateOfSupply(GST_STATE_CODE_MAP[code]);
      }
    }
  };

  // Quick Add Party Modal Save Handler
  const handleSaveNewParty = async (formObj) => {
    try {
      if (isPurchase) {
        const saved = await saveSupplier(formObj);
        const sups = await getAllSuppliers();
        setAllParties(sups || []);
        setPartyName(saved.name || formObj.name);
      } else {
        const saved = await saveClient(formObj);
        const cls = await getAllClients();
        setAllParties(cls || []);
        setPartyName(saved.name || formObj.name);
      }
      if (formObj.phone) setPartyPhone(formObj.phone);
      if (formObj.gstin) setPartyGstin(formObj.gstin);
      const addr = [formObj.address, formObj.city, formObj.state, formObj.pin].filter(Boolean).join(', ');
      if (addr) setBillingAddress(addr);
      if (formObj.state) setStateOfSupply(formObj.state);
      setShowPartyModal(false);
      toast.success(`${isPurchase ? 'Supplier' : 'Customer'} added & selected!`);
    } catch (e) {
      toast.error('Failed to save party: ' + (e.message || 'Unknown error'));
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
    const cessRate = Number(row.cessPercent) || 0;
    const combinedRate = taxRate + cessRate;

    let rowTax = 0;
    let rowTotal = 0;

    if (isTaxInc && combinedRate > 0) {
      const taxable = afterDisc / (1 + combinedRate / 100);
      rowTax = afterDisc - taxable;
      rowTotal = afterDisc;
    } else {
      rowTax = (afterDisc * combinedRate) / 100;
      rowTotal = afterDisc + rowTax;
    }

    return {
      taxAmount: Math.round(rowTax * 100) / 100,
      amount: Math.round(rowTotal * 100) / 100
    };
  };

  // Get default rate for a product depending on Sale vs Purchase
  const getProductDefaultRate = (prod) => {
    if (!prod) return 0;
    if (isPurchase) {
      return Number(prod.purchasePrice ?? prod.costPrice ?? prod.rate ?? prod.price ?? 0);
    }
    return Number(prod.sellingPrice ?? prod.price ?? prod.rate ?? 0);
  };

  // Update item field (with Vyapar Dual-Unit Rate Conversion & Wholesale Price Tiering)
  const updateItem = (index, field, value) => {
    setItems(prev => {
      const copy = [...prev];
      const row = { ...copy[index], [field]: value };

      const matchedProd = allProducts.find(p =>
        (row.productId && String(p.id) === String(row.productId)) ||
        (p.name || '').trim().toLowerCase() === String(row.name || '').trim().toLowerCase()
      );

      // Autocomplete product when typing name
      if (field === 'name' && matchedProd) {
        row.productId = matchedProd.id || null;
        const defaultRate = getProductDefaultRate(matchedProd);
        if (defaultRate > 0) row.rate = defaultRate;
        if (matchedProd.unit) row.unit = String(matchedProd.unit).toUpperCase();
        if (matchedProd.taxPercent !== undefined && matchedProd.taxPercent !== null) row.taxPercent = Number(matchedProd.taxPercent);
        if (matchedProd.cessPercent !== undefined && matchedProd.cessPercent !== null) row.cessPercent = Number(matchedProd.cessPercent);
        if (matchedProd.hsn) row.hsn = matchedProd.hsn;
      }

      // Dual-Unit Rate Conversion when switching between Base Unit and Secondary Unit
      if (field === 'unit' && matchedProd && matchedProd.secondaryUnit && Number(matchedProd.conversionRate) > 0) {
        const conv = Number(matchedProd.conversionRate);
        const baseU = String(matchedProd.unit || '').trim().toUpperCase();
        const secU = String(matchedProd.secondaryUnit || '').trim().toUpperCase();
        const selectedU = String(value || '').trim().toUpperCase();
        const baseDefaultRate = getProductDefaultRate(matchedProd);
        if (selectedU === secU && baseDefaultRate > 0) {
          row.rate = Math.round((baseDefaultRate / conv) * 10000) / 10000;
        } else if (selectedU === baseU && baseDefaultRate > 0) {
          row.rate = baseDefaultRate;
        }
      }

      // Wholesale Price auto-tiering on Sale Invoice when quantity >= minWholesaleQty
      if ((field === 'quantity' || field === 'unit') && !isPurchase && matchedProd) {
        const wp = Number(matchedProd.wholesalePrice) || 0;
        const minWQty = Number(matchedProd.minWholesaleQty) || 0;
        if (wp > 0 && minWQty > 0) {
          const conv = (matchedProd.secondaryUnit && Number(matchedProd.conversionRate) > 0) ? Number(matchedProd.conversionRate) : 1;
          const isSec = matchedProd.secondaryUnit && String(row.unit || '').trim().toUpperCase() === String(matchedProd.secondaryUnit).trim().toUpperCase();
          const qtyInBase = isSec ? (Number(row.quantity) || 0) / conv : (Number(row.quantity) || 0);
          const targetBaseRate = qtyInBase >= minWQty ? wp : getProductDefaultRate(matchedProd);
          if (targetBaseRate > 0) {
            row.rate = isSec ? Math.round((targetBaseRate / conv) * 10000) / 10000 : targetBaseRate;
          }
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
      } else if (field === 'quantity' || field === 'rate' || field === 'name' || field === 'unit') {
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

  // Barcode / Quick Item Code Scan Handler
  const handleBarcodeScan = (e) => {
    e.preventDefault();
    const q = barcodeInput.trim().toLowerCase();
    if (!q) return;

    const match = allProducts.find(p =>
      String(p.barcode || '').toLowerCase() === q ||
      String(p.itemCode || '').toLowerCase() === q ||
      String(p.sku || '').toLowerCase() === q ||
      String(p.hsn || '').toLowerCase() === q ||
      String(p.name || '').toLowerCase() === q ||
      String(p.name || '').toLowerCase().includes(q)
    );

    if (!match) {
      toast.warning(`No item found matching "${barcodeInput}"`);
      return;
    }

    setItems(prev => {
      const copy = [...prev];
      const existingIdx = copy.findIndex(r => (r.name || '').trim().toLowerCase() === (match.name || '').trim().toLowerCase());
      if (existingIdx !== -1) {
        const row = { ...copy[existingIdx] };
        row.quantity = (Number(row.quantity) || 0) + 1;
        const gross = row.quantity * (Number(row.rate) || 0);
        row.discountAmount = Math.round(((gross * (Number(row.discountPercent) || 0)) / 100) * 100) / 100;
        const { taxAmount, amount } = calculateRowAmount(row, taxInclusive);
        row.taxAmount = taxAmount;
        row.amount = amount;
        copy[existingIdx] = row;
        return copy;
      }

      // Put into first empty row or append new row
      const emptyIdx = copy.findIndex(r => !(r.name || '').trim() && !(Number(r.rate) > 0));
      const newRow = {
        ...emptyRow(),
        productId: match.id || null,
        name: match.name,
        hsn: match.hsn || '',
        quantity: 1,
        unit: match.unit ? String(match.unit).toUpperCase() : 'PCS',
        rate: getProductDefaultRate(match),
        taxPercent: match.taxPercent !== undefined ? Number(match.taxPercent) : 18,
        cessPercent: Number(match.cessPercent) || 0
      };
      const { taxAmount, amount } = calculateRowAmount(newRow, taxInclusive);
      newRow.taxAmount = taxAmount;
      newRow.amount = amount;

      if (emptyIdx !== -1) {
        copy[emptyIdx] = newRow;
        return copy;
      }
      return [...copy, newRow];
    });

    setBarcodeInput('');
    toast.success(`Added ${match.name}`);
  };

  // Apply OCR Extracted Values (for Purchase Bills)
  const handleOcrExtracted = (extracted) => {
    setShowOcrModal(false);
    if (!extracted) return;
    if (extracted.supplierName) handleSelectParty(extracted.supplierName);
    if (extracted.supplierGstin) handleGstinChange(extracted.supplierGstin);
    if (extracted.invoiceNumber) setInvoiceNumber(extracted.invoiceNumber);
    if (extracted.date) setInvoiceDate(extracted.date);

    if (Array.isArray(extracted.items) && extracted.items.length > 0) {
      const mapped = extracted.items.map(it => {
        const r = {
          ...emptyRow(),
          productId: it._matchedProductId || null,
          name: it.name || '',
          hsn: it.hsn || '',
          quantity: Number(it.quantity) || 1,
          unit: 'PCS',
          rate: Number(it.rate) || 0,
          taxPercent: Number(it.taxPercent) || 0,
          cessPercent: 0
        };
        const { taxAmount, amount } = calculateRowAmount(r, taxInclusive);
        r.taxAmount = taxAmount;
        r.amount = amount;
        return r;
      });
      setItems(mapped);
      toast.success(`OCR populated ${mapped.length} line item(s)!`);
    } else if (Number(extracted.grandTotal) > 0) {
      const r = {
        ...emptyRow(),
        name: 'Scanned Bill Item',
        quantity: 1,
        rate: Number(extracted.grandTotal),
        taxPercent: 0
      };
      const { taxAmount, amount } = calculateRowAmount(r, taxInclusive);
      r.taxAmount = taxAmount;
      r.amount = amount;
      setItems([r]);
      toast.info('OCR header & grand total loaded — review tax rates before saving.');
    }
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

  // Totals calculations (Line totals + Bill-level Discount + Additional Charges + Round Off)
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalFreeQty = 0;
    let totalLineDiscount = 0;
    let totalTax = 0;
    let subtotal = 0;
    let lineSum = 0;

    items.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const free = Number(item.freeQty) || 0;
      const rate = Number(item.rate) || 0;
      const gross = qty * rate;
      const disc = Number(item.discountAmount) || 0;
      const afterDisc = Math.max(0, gross - disc);
      const taxRate = (Number(item.taxPercent) || 0) + (Number(item.cessPercent) || 0);

      totalQty += qty;
      totalFreeQty += free;
      totalLineDiscount += disc;

      if (taxInclusive && taxRate > 0) {
        const taxable = afterDisc / (1 + taxRate / 100);
        const tax = afterDisc - taxable;
        totalTax += tax;
        subtotal += taxable;
        lineSum += afterDisc;
      } else {
        const tax = (afterDisc * taxRate) / 100;
        totalTax += tax;
        subtotal += afterDisc;
        lineSum += afterDisc + tax;
      }
    });

    const billDisc = Math.max(0, Number(billDiscountAmount) || 0);
    const addCharges = Number(additionalCharges) || 0;
    const rawGrandTotal = Math.max(0, subtotal + totalTax - billDisc + addCharges);

    let roundOffDiff = 0;
    let grandTotal = rawGrandTotal;

    if (applyRoundOff) {
      const rounded = Math.round(rawGrandTotal);
      roundOffDiff = Math.round((rounded - rawGrandTotal) * 100) / 100;
      grandTotal = rounded;
    } else {
      grandTotal = Math.round(rawGrandTotal * 100) / 100;
    }

    const cgst = isInterstate ? 0 : Math.round((totalTax / 2) * 100) / 100;
    const sgst = isInterstate ? 0 : Math.round((totalTax - cgst) * 100) / 100;
    const igst = isInterstate ? Math.round(totalTax * 100) / 100 : 0;

    return {
      totalQty,
      totalFreeQty,
      totalDiscount: Math.round((totalLineDiscount + billDisc) * 100) / 100,
      totalLineDiscount: Math.round(totalLineDiscount * 100) / 100,
      billDisc: Math.round(billDisc * 100) / 100,
      addCharges: Math.round(addCharges * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      cgst,
      sgst,
      igst,
      subtotal: Math.round(subtotal * 100) / 100,
      lineSum: Math.round(lineSum * 100) / 100,
      roundOff: roundOffDiff,
      grandTotal
    };
  }, [items, taxInclusive, applyRoundOff, billDiscountAmount, additionalCharges, isInterstate]);

  // Sync Bill Discount % <-> Amount
  const handleBillDiscountPctChange = (val) => {
    const pct = Math.min(100, Math.max(0, Number(val) || 0));
    setBillDiscountPercent(pct);
    const amt = Math.round(((totals.lineSum * pct) / 100) * 100) / 100;
    setBillDiscountAmount(amt);
  };

  const handleBillDiscountAmtChange = (val) => {
    const amt = Math.max(0, Number(val) || 0);
    setBillDiscountAmount(amt);
    const pct = totals.lineSum > 0 ? Math.round(((amt / totals.lineSum) * 100) * 100) / 100 : 0;
    setBillDiscountPercent(pct);
  };

  // Auto-sync Received / Paid amount when paymentMode === 'Cash' or checkbox toggled
  useEffect(() => {
    if (paymentMode === 'Cash' && !receivedManuallyEdited) {
      setIsReceivedChecked(true);
      setReceivedAmount(totals.grandTotal);
    } else if (paymentMode === 'Credit' && !receivedManuallyEdited) {
      setIsReceivedChecked(false);
      setReceivedAmount(0);
    }
  }, [paymentMode, totals.grandTotal, receivedManuallyEdited]);

  const effectivePaidAmount = isReceivedChecked ? Math.min(totals.grandTotal, Math.max(0, Number(receivedAmount) || 0)) : 0;
  const balanceDue = Math.max(0, Math.round((totals.grandTotal - effectivePaidAmount) * 100) / 100);

  // Reset form for "Save & New"
  const resetFormForNewEntry = async () => {
    setPartyName('');
    setPartyPhone('');
    setPartyGstin('');
    setBillingAddress('');
    setShippingAddress('');
    setPartyBalance(0);
    setItems([emptyRow(), emptyRow()]);
    setBillDiscountPercent(0);
    setBillDiscountAmount(0);
    setAdditionalCharges(0);
    setDescriptionText('');
    setPaymentReference('');
    setReceivedManuallyEdited(false);
    setReceivedAmount(paymentMode === 'Cash' ? 0 : 0);

    try {
      const pfx = isPurchase
        ? (docType === 'purchase-order' ? 'PO' : docType === 'purchase-return' ? 'DN' : 'PUR')
        : (docType === 'estimate' ? 'EST' : docType === 'sale-order' ? 'SO' : docType === 'credit-note' ? 'CN' : 'INV');
      const nextNum = await getNextInvoiceNumber(pfx, { peek: true });
      setInvoiceNumber(nextNum);
    } catch {
      setInvoiceNumber(`${isPurchase ? 'PUR' : 'INV'}-${Date.now().toString().slice(-4)}`);
    }
  };

  // Sync Inventory Stock on Purchase Bill / Purchase Return Save (with Dual-Unit conversion)
  const syncPurchaseInventoryStock = async (validItems, currentDocType) => {
    if (currentDocType === 'purchase-order') return;
    try {
      const existingProducts = await getAllProducts();
      const byName = new Map((existingProducts || []).map(p => [(p.name || '').trim().toLowerCase(), p]));
      const byId = new Map((existingProducts || []).map(p => [p.id, p]));

      const toBaseQty = (prod, lineItem) => {
        const rawQty = (Number(lineItem.quantity) || 0) + (Number(lineItem.freeQty) || 0);
        if (prod && prod.secondaryUnit && Number(prod.conversionRate) > 0) {
          const lineU = String(lineItem.unit || '').trim().toUpperCase();
          const secU = String(prod.secondaryUnit || '').trim().toUpperCase();
          if (lineU === secU) {
            return rawQty / Number(prod.conversionRate);
          }
        }
        return rawQty;
      };

      if (currentDocType === 'purchase-return') {
        if (!reverseStock) return;
        const upserts = [];
        for (const it of validItems) {
          const match = (it.productId && byId.get(it.productId)) || byName.get((it.name || '').trim().toLowerCase());
          if (match) {
            const currentStock = Number(match.stock) || 0;
            const totalReturnQty = toBaseQty(match, it);
            const newStock = Math.round(Math.max(0, currentStock - totalReturnQty) * 1000) / 1000;
            upserts.push(saveProduct({ ...match, stock: newStock }));
          }
        }
        await Promise.all(upserts);
        return;
      }

      // Standard Purchase Bill: increment stock & update purchasePrice
      const priorLines = (editingRecord?.id && Array.isArray(editingRecord.items)) ? editingRecord.items : [];
      const priorQtyByKey = new Map();
      for (const p of priorLines) {
        const key = p.productId || `name:${(p.name || '').trim().toLowerCase()}`;
        const existingProd = (p.productId && byId.get(p.productId)) || byName.get((p.name || '').trim().toLowerCase());
        priorQtyByKey.set(key, (priorQtyByKey.get(key) || 0) + toBaseQty(existingProd, p));
      }

      const upserts = [];
      for (const it of validItems) {
        const existing = (it.productId && byId.get(it.productId)) || byName.get((it.name || '').trim().toLowerCase());
        const qty = toBaseQty(existing, it);
        if (existing) {
          const priorKey = it.productId || `name:${(it.name || '').trim().toLowerCase()}`;
          const priorQty = priorQtyByKey.get(priorKey) || 0;
          const delta = qty - priorQty;
          const newStock = Math.round(Math.max(0, (Number(existing.stock) || 0) + delta) * 1000) / 1000;
          const isSec = existing.secondaryUnit && Number(existing.conversionRate) > 0 && String(it.unit || '').trim().toUpperCase() === String(existing.secondaryUnit).trim().toUpperCase();
          const newBasePurchasePrice = isSec ? (Number(it.rate) || 0) * Number(existing.conversionRate) : (Number(it.rate) || existing.purchasePrice || 0);
          upserts.push(saveProduct({
            ...existing,
            stock: newStock,
            purchasePrice: newBasePurchasePrice,
            hsn: existing.hsn || it.hsn || '',
            taxPercent: existing.taxPercent ?? it.taxPercent ?? 18,
          }));
        } else if (it.name && it.name.trim()) {
          upserts.push(saveProduct({
            name: it.name.trim(),
            hsn: (it.hsn || '').trim(),
            purchasePrice: Number(it.rate) || 0,
            sellingPrice: Number(it.rate) || 0,
            price: Number(it.rate) || 0,
            rate: Number(it.rate) || 0,
            taxPercent: Number(it.taxPercent) || 0,
            cessPercent: Number(it.cessPercent) || 0,
            unit: it.unit && it.unit !== 'NONE' ? it.unit : 'PCS',
            stock: qty,
            description: ''
          }));
        }
      }
      await Promise.all(upserts);
    } catch (e) {
      console.warn('Inventory stock auto-sync warning:', e);
    }
  };

  // Save handler (Sale or Purchase)
  const handleSave = async (saveAndNew = false) => {
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
      const paidAmt = effectivePaidAmount;
      const isFullyPaid = paidAmt >= (totals.grandTotal - 0.01) && totals.grandTotal > 0;
      const isPartiallyPaid = paidAmt > 0 && !isFullyPaid;

      if (isPurchase) {
        const computedPaymentStatus = isFullyPaid ? 'Paid' : (isPartiallyPaid ? 'Partial' : 'Unpaid');
        const finalBillNo = invoiceNumber.trim() || `PUR-${Date.now().toString().slice(-4)}`;
        const currentDocType = docType || 'purchase-bills';

        const paymentRecords = paidAmt > 0 ? [{
          id: `POUT-${Date.now()}`,
          date: invoiceDate,
          amount: paidAmt,
          mode: paymentType,
          referenceNo: paymentReference.trim(),
          note: isFullyPaid ? 'Full settlement on entry' : 'Partial payment on entry'
        }] : [];

        const purchasePayload = {
          id: editingRecord?.id || undefined,
          date: invoiceDate,
          dueDate,
          expectedDeliveryDate: isOrderDoc ? dueDate : undefined,
          supplierName: partyName.trim(),
          supplierAddress: billingAddress.trim(),
          shippingAddress: shippingAddress.trim(),
          supplierGstin: partyGstin.trim(),
          supplierPhone: partyPhone.trim(),
          invoiceNumber: finalBillNo,
          paymentStatus: computedPaymentStatus,
          paidAmount: paidAmt,
          payments: paymentRecords,
          paymentMode,
          paymentType,
          paymentReference: paymentReference.trim(),
          paymentTerms,
          stateOfSupply,
          interstate: isInterstate,
          itcEligibility,
          reverseCharge,
          applyRoundOff,
          roundOff: totals.roundOff,
          billDiscountPercent,
          billDiscountAmount: totals.billDisc,
          additionalCharges: totals.addCharges,
          additionalChargesLabel,
          totalAmount: totals.grandTotal,
          totalTax: totals.totalTax,
          taxableAmount: totals.subtotal,
          poNumber: poNumber.trim(),
          poDate,
          ewayBillNo: ewayBillNo.trim(),
          originalBillNo: originalBillNo.trim(),
          originalBillDate,
          returnReason: isReturnDoc ? returnReason : undefined,
          reverseStock: isReturnDoc ? reverseStock : undefined,
          orderStatus: isOrderDoc ? (editingRecord?.orderStatus || 'Open') : undefined,
          linkedPoId: editingRecord?.linkedPoId || undefined,
          taxInclusive,
          note: descriptionText.trim(),
          docType: currentDocType,
          items: validItems.map(i => ({
            productId: i.productId || undefined,
            name: i.name.trim(),
            hsn: (i.hsn || '').trim(),
            quantity: Number(i.quantity) || 1,
            freeQty: Number(i.freeQty) || 0,
            unit: i.unit,
            rate: Number(i.rate) || 0,
            taxPercent: Number(i.taxPercent) || 0,
            cessPercent: Number(i.cessPercent) || 0,
            discountPercent: Number(i.discountPercent) || 0,
            discount: Number(i.discountAmount) || 0,
            amount: Number(i.amount) || 0
          }))
        };

        await savePurchase(purchasePayload);

        // Sync Inventory Stock & Product Catalog
        await syncPurchaseInventoryStock(validItems, currentDocType);

        // Record Payment-Out voucher in localStorage if payment was made on a new purchase bill
        if (!editingRecord?.id && paidAmt > 0 && currentDocType === 'purchase-bills') {
          try {
            const existingPouts = JSON.parse(localStorage.getItem('vyapar_payment_outs') || '[]');
            const poutEntry = {
              id: paymentRecords[0].id,
              supplierName: partyName.trim(),
              amount: paidAmt,
              date: invoiceDate,
              paymentMode: paymentType,
              referenceNo: paymentReference.trim(),
              notes: `Paid against Bill ${finalBillNo}`,
              settledBills: [{ billId: finalBillNo, invoiceNumber: finalBillNo, amountApplied: paidAmt }],
              createdAt: new Date().toISOString()
            };
            localStorage.setItem('vyapar_payment_outs', JSON.stringify([poutEntry, ...existingPouts]));
          } catch { /* ignore */ }
        }

        toast.success(`${titleText} saved successfully!`);
      } else {
        const computedStatus = isEstimateDoc
          ? (editingRecord?.status || 'open')
          : (isFullyPaid ? 'paid' : (isPartiallyPaid ? 'partial' : 'unpaid'));
        const finalInvNo = invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`;

        const salePayload = {
          id: editingRecord?.id || finalInvNo,
          invoiceNumber: finalInvNo,
          clientName: partyName.trim(),
          clientPhone: partyPhone.trim(),
          clientGstin: partyGstin.trim(),
          clientAddress: billingAddress.trim(),
          shippingAddress: shippingAddress.trim(),
          invoiceDate,
          dueDate,
          invoiceType: docType || 'tax-invoice',
          currency: 'INR',
          totalAmount: totals.grandTotal,
          totalTaxAmount: totals.totalTax,
          cgstAmount: totals.cgst,
          sgstAmount: totals.sgst,
          igstAmount: totals.igst,
          subtotal: totals.subtotal,
          status: computedStatus,
          paidAmount: paidAmt,
          payments: paidAmt > 0 ? [{
            id: Date.now().toString(),
            date: invoiceDate,
            amount: paidAmt,
            method: paymentType,
            reference: paymentReference.trim(),
            notes: isFullyPaid ? `${paymentType} full settlement` : `${paymentType} partial receipt`
          }] : [],
          notes: descriptionText.trim(),
          terms: termsText.trim(),
          items: validItems.map(i => ({
            productId: i.productId || undefined,
            name: i.name.trim(),
            hsn: (i.hsn || '').trim(),
            quantity: Number(i.quantity) || 1,
            freeQty: Number(i.freeQty) || 0,
            unit: i.unit,
            rate: Number(i.rate) || 0,
            taxPercent: Number(i.taxPercent) || 0,
            cessPercent: Number(i.cessPercent) || 0,
            discountPercent: Number(i.discountPercent) || 0,
            discount: Number(i.discountAmount) || 0,
            amount: Number(i.amount) || 0
          })),
          data: {
            profile: activeProfile,
            client: {
              name: partyName.trim(),
              phone: partyPhone.trim(),
              gstin: partyGstin.trim(),
              address: billingAddress.trim(),
              shippingAddress: shippingAddress.trim(),
              state: stateOfSupply
            },
            details: {
              invoiceNumber: finalInvNo,
              invoiceDate,
              dueDate,
              paymentTerms,
              placeOfSupply: stateOfSupply,
              poNumber: poNumber.trim(),
              poDate,
              ewayBillNo: ewayBillNo.trim(),
              originalBillNo: originalBillNo.trim(),
              originalBillDate,
              returnReason: isReturnDoc ? returnReason : undefined
            },
            items: validItems,
            totals: {
              subtotal: totals.subtotal,
              totalTaxAmount: totals.totalTax,
              cgst: totals.cgst,
              sgst: totals.sgst,
              igst: totals.igst,
              billDiscount: totals.billDisc,
              additionalCharges: totals.addCharges,
              roundOff: totals.roundOff,
              total: totals.grandTotal
            },
            taxInclusive,
            paymentMode,
            paymentType,
            paymentReference: paymentReference.trim(),
            billDiscountPercent,
            billDiscountAmount: totals.billDisc,
            additionalCharges: totals.addCharges,
            additionalChargesLabel,
            customTerms: {
              title: termsTitle,
              text: termsText
            }
          }
        };

        const shouldOverwrite = Boolean(editingRecord?.id);
        await saveBill(salePayload, { overwrite: shouldOverwrite });
        toast.success(`${titleText} saved successfully!`);
      }

      if (saveAndNew) {
        await resetFormForNewEntry();
        await fetchPartiesAndProducts();
        return;
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
        handleSave(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="vyapar-editor-page animate-fade-in">
      {/* 1. TOP HEADER BAR */}
      <div className="vyapar-top-header">
        <div className="vyapar-title-group">
          <h2 className="vyapar-title">{titleText}</h2>

          {/* Vyapar Pill Toggle: Credit / Cash */}
          {!isEstimateDoc && (
            <div className="vyapar-toggle-wrap">
              <span
                className={`vyapar-toggle-label ${paymentMode === 'Credit' ? 'active-credit' : ''}`}
                onClick={() => { setReceivedManuallyEdited(false); setPaymentMode('Credit'); }}
              >
                Credit
              </span>
              <div
                className={`vyapar-toggle-switch ${paymentMode === 'Cash' ? 'is-cash' : ''}`}
                onClick={() => {
                  setReceivedManuallyEdited(false);
                  setPaymentMode(prev => prev === 'Credit' ? 'Cash' : 'Credit');
                }}
              >
                <div className="vyapar-toggle-slider" />
              </div>
              <span
                className={`vyapar-toggle-label ${paymentMode === 'Cash' ? 'active-cash' : ''}`}
                onClick={() => { setReceivedManuallyEdited(false); setPaymentMode('Cash'); }}
              >
                Cash
              </span>
            </div>
          )}

          {/* GST Supply Type Badge */}
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              background: isInterstate ? '#fef3c7' : '#dcfce7',
              color: isInterstate ? '#b45309' : '#15803d',
              border: `1px solid ${isInterstate ? '#fde68a' : '#bbf7d0'}`
            }}
            title="Auto-detected by comparing State of Supply with your Business State"
          >
            {isInterstate ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}
          </span>
        </div>

        {/* Top Right Quick Utilities */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {isPurchase && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowOcrModal(true)}
              title="Scan Vendor Purchase Bill using AI OCR"
              style={{
                padding: '0.35rem 0.7rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                borderColor: '#6366f1',
                color: '#4f46e5',
                fontWeight: 600
              }}
            >
              <Sparkles size={15} /> Scan Bill (OCR)
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowPoEwayFields(prev => !prev)}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
            title="Toggle PO No., PO Date & E-Way Bill fields"
          >
            {showPoEwayFields ? 'Hide PO / E-Way' : '+ PO / E-Way Bill'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            title="Tax Inclusive / Exclusive"
            onClick={toggleTaxInclusive}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
          >
            {taxInclusive ? 'Tax: Inclusive' : 'Tax: Exclusive'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            title="Calculator"
            onClick={() => setShowCalc(prev => !prev)}
            style={{ padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center' }}
          >
            <Calculator size={17} />
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
          <div className="vyapar-party-row" style={{ gridTemplateColumns: '1.3fr 0.9fr 1fr' }}>
            {/* Customer / Supplier with Floating Label + Add Party Button */}
            <div>
              <div className="vyapar-fieldset" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="vyapar-floating-label">
                  {isPurchase ? 'Supplier / Party *' : 'Customer / Party *'}
                </span>
                <input
                  type="text"
                  className="vyapar-field-input"
                  list="vyapar-parties-datalist"
                  value={partyName}
                  onChange={e => handleSelectParty(e.target.value)}
                  placeholder="Select or Type Party"
                />
                <button
                  type="button"
                  onClick={() => setShowPartyModal(true)}
                  title={`Add New ${isPurchase ? 'Supplier' : 'Customer'}`}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    borderRadius: '4px',
                    padding: '3px 6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}
                >
                  <UserPlus size={13} /> New
                </button>
                <datalist id="vyapar-parties-datalist">
                  {allParties.map(p => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.phone ? `${p.name} (${p.phone})` : p.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                <div className="vyapar-balance-badge">
                  BAL: ₹ {Number(partyBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowShippingAddress(prev => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showShippingAddress ? 'Hide Shipping Address' : '+ Shipping Address'}
                </button>
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
                  placeholder="Phone number"
                />
              </div>
            </div>

            {/* Party GSTIN with Floating Label */}
            <div>
              <div className="vyapar-fieldset">
                <span className="vyapar-floating-label">Party GSTIN</span>
                <input
                  type="text"
                  maxLength={15}
                  className="vyapar-field-input"
                  style={{ textTransform: 'uppercase' }}
                  value={partyGstin}
                  onChange={e => handleGstinChange(e.target.value)}
                  placeholder="15-digit GSTIN"
                />
              </div>
            </div>
          </div>

          {/* Billing & Optional Shipping Address */}
          <div style={{ display: 'grid', gridTemplateColumns: showShippingAddress ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
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

            {showShippingAddress && (
              <div className="vyapar-fieldset">
                <span className="vyapar-floating-label">Shipping / Delivery Address</span>
                <textarea
                  className="vyapar-field-textarea"
                  rows={2}
                  value={shippingAddress}
                  onChange={e => setShippingAddress(e.target.value)}
                  placeholder="Enter shipping address"
                />
              </div>
            )}
          </div>

          {/* Return / Credit Note / Debit Note Specific Header Bar */}
          {isReturnDoc && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isPurchase ? '1fr 1fr 1.2fr auto' : '1fr 1fr 1.2fr',
                gap: '0.6rem',
                padding: '0.6rem 0.75rem',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: '6px',
                alignItems: 'center'
              }}
            >
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9a3412', display: 'block' }}>
                  Original {isPurchase ? 'Bill' : 'Invoice'} No.
                </label>
                <input
                  type="text"
                  className="vyapar-detail-input"
                  value={originalBillNo}
                  onChange={e => setOriginalBillNo(e.target.value)}
                  placeholder="e.g. INV-0012"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9a3412', display: 'block' }}>
                  Original Date
                </label>
                <input
                  type="date"
                  className="vyapar-detail-input"
                  value={originalBillDate}
                  onChange={e => setOriginalBillDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9a3412', display: 'block' }}>
                  Return Reason
                </label>
                <select
                  className="vyapar-detail-input"
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                >
                  {RETURN_REASONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {isPurchase && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#9a3412', cursor: 'pointer', paddingTop: '12px' }}>
                  <input
                    type="checkbox"
                    checked={reverseStock}
                    onChange={e => setReverseStock(e.target.checked)}
                  />
                  Reduce Stock
                </label>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Invoice Meta Details */}
        <div className="vyapar-details-table">
          <div className="vyapar-detail-row">
            <span className="vyapar-detail-label">
              {isReturnDoc ? (isPurchase ? 'Debit Note No.' : 'Credit Note No.') : isOrderDoc ? 'Order No.' : (isPurchase ? 'Bill Number' : 'Invoice Number')}
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
              {isOrderDoc ? 'Order Date' : (isPurchase ? 'Bill Date' : 'Invoice Date')}
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

          {!isOrderDoc && (
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
          )}

          <div className="vyapar-detail-row">
            <span className="vyapar-detail-label">{isOrderDoc ? 'Delivery Date' : 'Due Date'}</span>
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

          {showPoEwayFields && (
            <>
              <div className="vyapar-detail-row">
                <span className="vyapar-detail-label">PO Number</span>
                <div className="vyapar-detail-val-wrap">
                  <input
                    type="text"
                    className="vyapar-detail-input"
                    placeholder="Optional PO Ref"
                    value={poNumber}
                    onChange={e => setPoNumber(e.target.value)}
                  />
                </div>
              </div>
              <div className="vyapar-detail-row">
                <span className="vyapar-detail-label">PO Date</span>
                <div className="vyapar-detail-val-wrap">
                  <input
                    type="date"
                    className="vyapar-detail-input"
                    value={poDate}
                    onChange={e => setPoDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="vyapar-detail-row">
                <span className="vyapar-detail-label">E-Way Bill No.</span>
                <div className="vyapar-detail-val-wrap">
                  <input
                    type="text"
                    className="vyapar-detail-input"
                    placeholder="12-digit E-Way Bill"
                    value={ewayBillNo}
                    onChange={e => setEwayBillNo(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* BARCODE QUICK SCANNER BAR (Toggled by clicking ScanBarcode icon) */}
      {showBarcodeBar && (
        <form
          onSubmit={handleBarcodeScan}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 1rem',
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe'
          }}
        >
          <ScanBarcode size={18} style={{ color: '#2563eb' }} />
          <input
            type="text"
            className="form-input"
            style={{ maxWidth: '340px', padding: '0.3rem 0.6rem', fontSize: '0.82rem', background: '#fff' }}
            placeholder="Scan barcode, item code, HSN or type item name & press Enter..."
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>
            Add Item
          </button>
          <button
            type="button"
            onClick={() => setShowBarcodeBar(false)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            Close
          </button>
        </form>
      )}

      {/* 3. VYAPAR SPREADSHEET ITEMS TABLE */}
      <div className="vyapar-table-container">
        <table className="vyapar-grid-table">
          <thead>
            <tr>
              <th
                style={{ width: '36px', cursor: 'pointer' }}
                title="Click to toggle Barcode / Item Code Scanner"
                onClick={() => setShowBarcodeBar(prev => !prev)}
              >
                <ScanBarcode size={15} style={{ margin: '0 auto', color: showBarcodeBar ? '#2563eb' : '#64748b' }} />
              </th>
              <th style={{ width: '36px' }}>#</th>
              <th style={{ minWidth: '210px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>ITEM</span>
                  <button
                    type="button"
                    onClick={() => setShowFreeQtyCol(prev => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showFreeQtyCol ? 'Hide Free Qty' : '+ Free Qty'}
                  </button>
                </div>
              </th>
              <th style={{ width: '88px' }}>HSN/SAC</th>
              <th style={{ width: '68px' }}>QTY</th>
              {showFreeQtyCol && <th style={{ width: '68px' }}>FREE QTY</th>}
              <th style={{ width: '86px' }}>UNIT</th>
              <th style={{ width: '108px' }}>
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
              <th colSpan={2} style={{ width: '155px' }}>
                TAX
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.65rem', fontWeight: 400, color: '#64748b' }}>
                  <span>%</span>
                  <span>AMOUNT</span>
                </div>
              </th>
              <th style={{ width: '110px', textAlign: 'right' }}>AMOUNT</th>
              <th style={{ width: '34px' }}>
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
                {/* Barcode icon */}
                <td
                  style={{ textAlign: 'center', color: '#94a3b8', cursor: 'pointer' }}
                  onClick={() => setShowBarcodeBar(true)}
                  title="Scan Barcode"
                >
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
                    placeholder="Enter or select item"
                  />
                  <datalist id={`vyapar-prods-${idx}`}>
                    {allProducts.map(p => {
                      const r = getProductDefaultRate(p);
                      const stk = p.stock !== undefined ? ` | Stk: ${p.stock}` : '';
                      return (
                        <option key={p.id || p.name} value={p.name}>
                          {p.name}{r ? ` — ₹${r}` : ''}{stk}
                        </option>
                      );
                    })}
                  </datalist>
                </td>

                {/* HSN / SAC Code */}
                <td>
                  <input
                    type="text"
                    className="vyapar-cell-input"
                    style={{ textAlign: 'center' }}
                    value={row.hsn || ''}
                    onChange={e => updateItem(idx, 'hsn', e.target.value)}
                    placeholder="HSN"
                  />
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

                {/* Optional Free Qty */}
                {showFreeQtyCol && (
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="vyapar-cell-input"
                      style={{ textAlign: 'center' }}
                      value={row.freeQty || ''}
                      onChange={e => updateItem(idx, 'freeQty', e.target.value)}
                      placeholder="0"
                    />
                  </td>
                )}

                {/* Unit */}
                <td>
                  <select
                    className="vyapar-cell-select"
                    value={row.unit || 'NONE'}
                    onChange={e => updateItem(idx, 'unit', e.target.value)}
                  >
                    {unitOptions.map(u => (
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
              <td></td>
              <td style={{ textAlign: 'center' }}>{totals.totalQty}</td>
              {showFreeQtyCol && <td style={{ textAlign: 'center' }}>{totals.totalFreeQty}</td>}
              <td></td>
              <td></td>
              <td></td>
              <td style={{ textAlign: 'right' }}>{totals.totalLineDiscount.toFixed(2)}</td>
              <td></td>
              <td style={{ textAlign: 'right' }}>{totals.totalTax.toFixed(2)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                {totals.lineSum.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Row Button + Quick Barcode Trigger */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.6rem 1rem 1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={addRow}
            className="btn btn-secondary"
            style={{
              borderColor: '#2563eb',
              color: '#2563eb',
              fontSize: '0.76rem',
              fontWeight: 700,
              padding: '0.32rem 0.85rem'
            }}
          >
            + ADD ROW
          </button>
          <button
            type="button"
            onClick={() => setShowBarcodeBar(prev => !prev)}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.32rem 0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <ScanBarcode size={14} /> Scan Barcode
          </button>
        </div>

        {/* Live GST Split Summary Pill */}
        <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', gap: '1rem' }}>
          <span>Taxable: <strong>₹{totals.subtotal.toFixed(2)}</strong></span>
          {isInterstate ? (
            <span>IGST: <strong>₹{totals.igst.toFixed(2)}</strong></span>
          ) : (
            <>
              <span>CGST: <strong>₹{totals.cgst.toFixed(2)}</strong></span>
              <span>SGST: <strong>₹{totals.sgst.toFixed(2)}</strong></span>
            </>
          )}
        </div>
      </div>

      {/* 4. BOTTOM 3-COLUMN SECTION */}
      <div className="vyapar-bottom-grid">
        {/* Left: Payment Type + Terms & Conditions Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Vyapar Payment Type & Reference Selector */}
          <div className="vyapar-terms-box" style={{ padding: '0.65rem 0.8rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Payment Type
                </label>
                <select
                  className="vyapar-detail-input"
                  style={{ width: '100%', padding: '0.3rem 0.45rem' }}
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value)}
                >
                  {PAYMENT_TYPES.map(pt => (
                    <option key={pt} value={pt}>{pt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Ref / UTR / Cheque No.
                </label>
                <input
                  type="text"
                  className="vyapar-detail-input"
                  style={{ width: '100%', padding: '0.3rem 0.45rem' }}
                  placeholder="Optional reference"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="vyapar-terms-box">
            <div className="vyapar-terms-title">Terms &amp; Conditions</div>
            <div style={{ marginBottom: '0.4rem' }}>
              <select
                className="vyapar-detail-input"
                style={{ marginTop: '2px', padding: '0.25rem 0.5rem' }}
                value={termsTitle}
                onChange={e => setTermsTitle(e.target.value)}
              >
                <option value="Sale Invoice">Sale Invoice</option>
                <option value="Purchase Terms">Purchase Terms</option>
                <option value="Standard Terms">Standard Terms</option>
                <option value="Payment Terms">Payment Terms</option>
              </select>
            </div>
            <textarea
              className="vyapar-field-textarea"
              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px', minHeight: '52px' }}
              value={termsText}
              onChange={e => setTermsText(e.target.value)}
            />
          </div>
        </div>

        {/* Middle: Action Buttons Stack & Purchase GST / ITC Compliance */}
        <div className="vyapar-actions-stack">
          <button
            type="button"
            className="vyapar-action-pill-btn"
            onClick={() => setShowDescription(prev => !prev)}
          >
            <Plus size={14} /> {showDescription ? 'Hide Description' : 'Add Description / Note'}
          </button>
          {showDescription && (
            <textarea
              className="form-input"
              rows={2}
              style={{ fontSize: '0.8rem' }}
              placeholder="Enter remarks / description"
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

          {/* Purchase ITC Eligibility & Reverse Charge Controls */}
          {isPurchase && (
            <div
              style={{
                marginTop: '0.25rem',
                padding: '0.6rem 0.75rem',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                <ShieldCheck size={14} style={{ color: '#2563eb' }} /> GSTR-3B / ITC Settings
              </div>
              <div style={{ marginBottom: '0.35rem' }}>
                <select
                  className="vyapar-detail-input"
                  style={{ width: '100%', fontSize: '0.74rem', padding: '0.22rem 0.4rem' }}
                  value={itcEligibility}
                  onChange={e => setItcEligibility(e.target.value)}
                >
                  <option value="eligible">Eligible for Input Tax Credit (ITC)</option>
                  <option value="capital">Capital Goods ITC</option>
                  <option value="ineligible">Ineligible / Blocked u/s 17(5)</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={reverseCharge}
                  onChange={e => setReverseCharge(e.target.checked)}
                />
                <span>Applicable for Reverse Charge (RCM)</span>
              </label>
            </div>
          )}
        </div>

        {/* Right: Bill Adjustments, Round Off, Total, Received/Paid & Balance Card */}
        <div className="vyapar-total-card" style={{ gap: '0.55rem' }}>
          {/* Bill-level Discount Row */}
          <div className="vyapar-roundoff-row">
            <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Bill Discount</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                className="vyapar-detail-input"
                style={{ width: '58px', textAlign: 'center', padding: '0.2rem' }}
                placeholder="%"
                value={billDiscountPercent || ''}
                onChange={e => handleBillDiscountPctChange(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>%</span>
              <input
                type="number"
                min="0"
                step="any"
                className="vyapar-detail-input"
                style={{ width: '82px', textAlign: 'right', padding: '0.2rem 0.35rem' }}
                placeholder="₹ 0.00"
                value={billDiscountAmount || ''}
                onChange={e => handleBillDiscountAmtChange(e.target.value)}
              />
            </div>
          </div>

          {/* Additional / Shipping Charges Row */}
          <div className="vyapar-roundoff-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Truck size={13} style={{ color: '#64748b' }} />
              <input
                type="text"
                className="vyapar-detail-input"
                style={{ width: '125px', fontSize: '0.75rem', padding: '0.15rem 0.35rem', borderStyle: 'dashed' }}
                value={additionalChargesLabel}
                onChange={e => setAdditionalChargesLabel(e.target.value)}
              />
            </div>
            <input
              type="number"
              min="0"
              step="any"
              className="vyapar-detail-input"
              style={{ width: '90px', textAlign: 'right', padding: '0.2rem 0.35rem' }}
              placeholder="₹ 0.00"
              value={additionalCharges || ''}
              onChange={e => setAdditionalCharges(e.target.value)}
            />
          </div>

          {/* Round Off Row */}
          <div className="vyapar-roundoff-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.78rem' }}>
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
              style={{ width: '75px', textAlign: 'right', padding: '0.2rem 0.35rem' }}
              value={totals.roundOff > 0 ? `+${totals.roundOff}` : totals.roundOff}
            />
          </div>

          {/* Grand Total Row */}
          <div className="vyapar-grand-total-row">
            <span className="vyapar-grand-total-label">Total</span>
            <div className="vyapar-grand-total-box">
              ₹ {totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Vyapar Received (Sale) / Paid (Purchase) & Balance Due Section */}
          {!isEstimateDoc && !isOrderDoc && (
            <>
              <div
                className="vyapar-roundoff-row"
                style={{
                  paddingTop: '0.45rem',
                  borderTop: '1px dashed #cbd5e1'
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={isReceivedChecked}
                    onChange={e => {
                      const checked = e.target.checked;
                      setIsReceivedChecked(checked);
                      setReceivedManuallyEdited(true);
                      if (checked && (!receivedAmount || receivedAmount === 0)) {
                        setReceivedAmount(totals.grandTotal);
                      } else if (!checked) {
                        setReceivedAmount(0);
                      }
                    }}
                  />
                  <span>{isPurchase ? 'Paid Amount' : 'Received'}</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="vyapar-detail-input"
                    style={{
                      width: '125px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      padding: '0.28rem 0.45rem',
                      borderColor: isReceivedChecked ? '#2563eb' : '#cbd5e1'
                    }}
                    value={isReceivedChecked ? receivedAmount : 0}
                    onChange={e => {
                      setIsReceivedChecked(true);
                      setReceivedManuallyEdited(true);
                      setReceivedAmount(e.target.value);
                    }}
                  />
                </div>
              </div>

              {/* Balance Due Row */}
              <div
                className="vyapar-roundoff-row"
                style={{
                  background: balanceDue > 0 ? '#fef2f2' : '#f0fdf4',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: `1px solid ${balanceDue > 0 ? '#fecaca' : '#bbf7d0'}`,
                  width: '100%',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: balanceDue > 0 ? '#b91c1c' : '#15803d' }}>
                  Balance {balanceDue === 0 && totals.grandTotal > 0 ? '(PAID)' : effectivePaidAmount > 0 ? '(PARTIAL)' : '(UNPAID)'}
                </span>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: balanceDue > 0 ? '#dc2626' : '#16a34a' }}>
                  ₹ {balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 5. STICKY BOTTOM ACTION BAR */}
      <div className="vyapar-footer-bar">
        {/* Share / Print Button with Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="vyapar-share-dropdown-btn"
            onClick={() => setShowShareMenu(prev => !prev)}
          >
            Share / Print <ChevronDown size={14} />
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
                minWidth: '175px',
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
                    businessName: activeProfile?.businessName || 'Business'
                  });
                }}
              >
                <MessageCircle size={15} /> WhatsApp
              </button>
            </div>
          )}
        </div>

        {/* Save & New Button (Vyapar Native Action) */}
        {!editingRecord?.id && (
          <button
            type="button"
            className="vyapar-share-dropdown-btn"
            style={{ fontWeight: 700 }}
            disabled={isSaving}
            onClick={() => handleSave(true)}
            title="Save this transaction and immediately open a fresh entry"
          >
            Save &amp; New
          </button>
        )}

        {/* Primary Save Button */}
        <button
          type="button"
          className="vyapar-save-btn"
          disabled={isSaving}
          onClick={() => handleSave(false)}
        >
          {isSaving ? 'Saving...' : <><u>S</u>ave</>}
        </button>
      </div>

      {/* QUICK ADD CLIENT / SUPPLIER MODAL */}
      {!isPurchase && showPartyModal && (
        <ClientModal
          show={showPartyModal}
          onClose={() => setShowPartyModal(false)}
          onSave={handleSaveNewParty}
          client={null}
          isEditing={false}
          defaultCountry={activeProfile?.country || 'India'}
        />
      )}
      {isPurchase && showPartyModal && (
        <SupplierModal
          show={showPartyModal}
          onClose={() => setShowPartyModal(false)}
          onSave={handleSaveNewParty}
          supplier={null}
          isEditing={false}
          defaultCountry={activeProfile?.country || 'India'}
        />
      )}

      {/* PURCHASE BILL OCR MODAL */}
      {isPurchase && showOcrModal && (
        <Suspense fallback={null}>
          <BillOCR
            onClose={() => setShowOcrModal(false)}
            onExtracted={handleOcrExtracted}
          />
        </Suspense>
      )}

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
            data: { profile: activeProfile, items, totals }
          }}
          profile={activeProfile}
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
            clientGstin: partyGstin,
            clientAddress: billingAddress,
            items,
            totalAmount: totals.grandTotal,
            subtotal: totals.subtotal,
            totalTaxAmount: totals.totalTax,
            notes: descriptionText,
            terms: termsText,
            data: { profile: activeProfile, items, totals, details: { invoiceNumber, invoiceDate, dueDate } }
          }}
          profile={activeProfile}
        />
      )}
    </div>
  );
}
