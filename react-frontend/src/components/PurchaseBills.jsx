import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import {
  ShoppingCart, Plus, Edit3, Trash2, Search, X, Save, Download, Wand2,
  FileText, Eye, CreditCard, ArrowUpRight, RotateCcw, CheckCircle, Clock,
  AlertTriangle, ArrowRight, Printer, Check
} from 'lucide-react';
import HelpButton from './HelpButton';
import {
  getAllPurchases, savePurchase, deletePurchase,
  getAllProducts, saveProduct,
  getAllSuppliers, saveSupplier
} from '../store';
import { formatCurrency, calculateRoundOff, getFYOptions, numberToWords } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { toast } from './Toast';
import { confirmAction, promptAction } from './ConfirmModal';
import SupplierModal from './SupplierModal';

// Brand accent RGB helper for PDF export
function getAccentRGB() {
  try {
    const ps = getPrintSettings();
    if (ps.userColorsEnabled && ps.pdfAccent) {
      const hex = String(ps.pdfAccent).replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    }
  } catch { /* ignore */ }
  return [30, 64, 175];
}

// Purchase-bill OCR modal (lazy loaded)
const BillOCR = lazy(() => import('./BillOCR'));

const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Partial'];
const PO_STATUSES = ['Open', 'Fulfilled', 'Cancelled'];
const RETURN_REASONS = [
  'Damaged Goods',
  'Defective Product',
  'Excess Stock Received',
  'Specification Mismatch',
  'Price Difference',
  'Other'
];
const PAYMENT_MODES = [
  'Bank Transfer / NEFT',
  'UPI / QR',
  'Cash',
  'Cheque',
  'RTGS',
  'Credit / Debit Card'
];

const emptyItem = { name: '', hsn: '', quantity: 1, rate: 0, taxPercent: 18, cessPercent: 0 };

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  supplierName: '',
  supplierAddress: '',
  supplierGstin: '',
  invoiceNumber: '',
  items: [{ ...emptyItem }],
  paymentStatus: 'Unpaid',
  interstate: false,
  applyRoundOff: false,
  note: '',
  docType: 'purchase-bills',
  linkedPoId: null,
};

const emptyPoForm = {
  date: new Date().toISOString().split('T')[0],
  expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  supplierName: '',
  supplierAddress: '',
  supplierGstin: '',
  invoiceNumber: '',
  items: [{ ...emptyItem }],
  orderStatus: 'Open',
  interstate: false,
  note: '',
  docType: 'purchase-order',
};

const emptyReturnForm = {
  date: new Date().toISOString().split('T')[0],
  supplierName: '',
  supplierAddress: '',
  supplierGstin: '',
  invoiceNumber: '',
  originalBillNo: '',
  returnReason: 'Damaged Goods',
  items: [{ ...emptyItem }],
  reverseStock: true,
  interstate: false,
  note: '',
  docType: 'purchase-return',
};

const emptyPaymentOutForm = {
  supplierId: '',
  supplierName: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  paymentMode: 'Bank Transfer / NEFT',
  referenceNo: '',
  linkedBillId: '__fifo__',
  notes: ''
};

function calcItemTax(item) {
  const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
  const tax = (amount * (Number(item.taxPercent) || 0)) / 100;
  const cess = (amount * (Number(item.cessPercent) || 0)) / 100;
  return { amount, tax, cess, total: amount + tax + cess };
}

function calcPurchaseTotal(items, applyRoundOff = false) {
  const raw = (items || []).reduce((acc, item) => {
    const { amount, tax, cess, total } = calcItemTax(item);
    return {
      taxable: acc.taxable + amount,
      tax: acc.tax + tax,
      cess: acc.cess + cess,
      total: acc.total + total,
    };
  }, { taxable: 0, tax: 0, cess: 0, total: 0 });
  const roundOff = applyRoundOff ? calculateRoundOff(raw.total) : 0;
  return { ...raw, roundOff, finalTotal: raw.total + roundOff };
}

export default function PurchaseBills({
  initialDocType = 'purchase-bills',
  autoOpenNew = false,
  onDocTypeChange,
  onResetAutoNew
}) {
  // Active sub-section tab: 'purchase-bills' | 'payment-out' | 'purchase-order' | 'purchase-return'
  const [activeTab, setActiveTab] = useState(initialDocType || 'purchase-bills');

  // Core Data
  const [purchases, setPurchases] = useState([]);
  const [savedSuppliers, setSavedSuppliers] = useState([]);
  const [paymentOuts, setPaymentOuts] = useState([]);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [fyFilter, setFyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [poStatusFilter, setPoStatusFilter] = useState('ALL');

  // Modals state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, items: [{ ...emptyItem }] });

  const [showPoForm, setShowPoForm] = useState(false);
  const [poForm, setPoForm] = useState({ ...emptyPoForm, items: [{ ...emptyItem }] });

  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnForm, setReturnForm] = useState({ ...emptyReturnForm, items: [{ ...emptyItem }] });

  const [showPaymentOutModal, setShowPaymentOutModal] = useState(false);
  const [paymentOutForm, setPaymentOutForm] = useState({ ...emptyPaymentOutForm });

  const [showOCR, setShowOCR] = useState(false);
  const [viewPurchase, setViewPurchase] = useState(null);
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);

  // Quick Pay for single purchase bill
  const [quickPayPurchase, setQuickPayPurchase] = useState(null);
  const [quickPayForm, setQuickPayForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'Bank Transfer / NEFT',
    reference: '',
    notes: ''
  });

  const fyOptions = getFYOptions();

  // Keep active tab in sync with prop from sidebar
  useEffect(() => {
    if (initialDocType && initialDocType !== activeTab) {
      setActiveTab(initialDocType);
    }
  }, [initialDocType]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearch('');
    if (onDocTypeChange) onDocTypeChange(tab);
  };

  // Load Data
  const loadPurchases = async () => {
    try {
      const data = await getAllPurchases();
      setPurchases(Array.isArray(data) ? data : []);
    } catch {
      toast('Failed to load purchases', 'error');
    }
  };

  const loadSuppliers = async () => {
    try {
      const sups = await getAllSuppliers();
      setSavedSuppliers(Array.isArray(sups) ? sups : []);
    } catch { /* ignore */ }
  };

  const loadPaymentOuts = () => {
    try {
      const saved = localStorage.getItem('vyapar_payment_outs');
      if (saved) {
        setPaymentOuts(JSON.parse(saved));
      } else {
        setPaymentOuts([]);
      }
    } catch {
      setPaymentOuts([]);
    }
  };

  useEffect(() => {
    if (fyOptions[0]) setFyFilter(fyOptions[0].value);
    loadPurchases();
    loadSuppliers();
    loadPaymentOuts();
  }, []);

  // Listen for storage events (e.g. from SuppliersView payments)
  useEffect(() => {
    const handleStorage = () => loadPaymentOuts();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Auto Open New based on sidebar "+" click
  useEffect(() => {
    if (autoOpenNew) {
      if (activeTab === 'purchase-bills') {
        openAdd();
      } else if (activeTab === 'payment-out') {
        openPaymentOutModal();
      } else if (activeTab === 'purchase-order') {
        openAddPo();
      } else if (activeTab === 'purchase-return') {
        openAddReturn();
      }
      if (onResetAutoNew) onResetAutoNew();
    }
  }, [autoOpenNew, activeTab]);

  // Derived Document Sets
  const purchaseBillsList = useMemo(() => {
    return purchases.filter(p => !p.docType || p.docType === 'purchase-bills');
  }, [purchases]);

  const purchaseOrdersList = useMemo(() => {
    return purchases.filter(p => p.docType === 'purchase-order');
  }, [purchases]);

  const purchaseReturnsList = useMemo(() => {
    return purchases.filter(p => p.docType === 'purchase-return');
  }, [purchases]);

  // Payment Out aggregated list
  const combinedPaymentOuts = useMemo(() => {
    // Collect from localStorage 'vyapar_payment_outs'
    const list = [...paymentOuts];
    // Also include any payments saved inside purchase bills that might not have a POUT id
    const knownIds = new Set(list.map(x => x.id));
    purchaseBillsList.forEach(pb => {
      (pb.payments || []).forEach(pmt => {
        if (pmt.id && !knownIds.has(pmt.id)) {
          list.push({
            id: pmt.id,
            supplierName: pb.supplierName,
            amount: pmt.amount,
            date: pmt.date,
            paymentMode: pmt.method || 'Bank Transfer',
            referenceNo: pmt.reference || '',
            linkedBillId: pb.id,
            linkedBillInvoice: pb.invoiceNumber,
            notes: pmt.notes || `Paid against Bill ${pb.invoiceNumber}`
          });
          knownIds.add(pmt.id);
        }
      });
    });
    return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [paymentOuts, purchaseBillsList]);

  // Tab Counts for Badges
  const counts = useMemo(() => ({
    bills: purchaseBillsList.length,
    paymentOut: combinedPaymentOuts.length,
    orders: purchaseOrdersList.length,
    returns: purchaseReturnsList.length
  }), [purchaseBillsList, combinedPaymentOuts, purchaseOrdersList, purchaseReturnsList]);

  // Tab 1: Filtered Purchase Bills
  const filteredBills = useMemo(() => {
    return purchaseBillsList.filter(p => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(p.supplierName || '').toLowerCase().includes(q) &&
            !(p.invoiceNumber || '').toLowerCase().includes(q) &&
            !(p.supplierGstin || '').toLowerCase().includes(q)) return false;
      }
      if (fyFilter) {
        const fy = fyOptions.find(f => f.value === fyFilter);
        if (fy && p.date) {
          if (p.date < fy.from || p.date > fy.to) return false;
        }
      }
      if (statusFilter !== 'ALL') {
        const pStat = (p.paymentStatus || 'Unpaid').toUpperCase();
        if (statusFilter === 'UNPAID' && pStat !== 'UNPAID') return false;
        if (statusFilter === 'PARTIAL' && pStat !== 'PARTIAL') return false;
        if (statusFilter === 'PAID' && pStat !== 'PAID') return false;
      }
      return true;
    });
  }, [purchaseBillsList, search, fyFilter, statusFilter, fyOptions]);

  // Tab 2: Filtered Payment Outs
  const filteredPaymentOuts = useMemo(() => {
    return combinedPaymentOuts.filter(pmt => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(pmt.supplierName || '').toLowerCase().includes(q) &&
            !(pmt.referenceNo || '').toLowerCase().includes(q) &&
            !(pmt.id || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [combinedPaymentOuts, search]);

  // Tab 3: Filtered Purchase Orders
  const filteredOrders = useMemo(() => {
    return purchaseOrdersList.filter(po => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(po.supplierName || '').toLowerCase().includes(q) &&
            !(po.invoiceNumber || '').toLowerCase().includes(q)) return false;
      }
      if (poStatusFilter !== 'ALL') {
        const st = (po.orderStatus || 'Open').toUpperCase();
        if (poStatusFilter === 'OPEN' && st !== 'OPEN') return false;
        if (poStatusFilter === 'FULFILLED' && st !== 'FULFILLED') return false;
        if (poStatusFilter === 'CANCELLED' && st !== 'CANCELLED') return false;
      }
      return true;
    });
  }, [purchaseOrdersList, search, poStatusFilter]);

  // Tab 4: Filtered Purchase Returns
  const filteredReturns = useMemo(() => {
    return purchaseReturnsList.filter(ret => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(ret.supplierName || '').toLowerCase().includes(q) &&
            !(ret.invoiceNumber || '').toLowerCase().includes(q) &&
            !(ret.originalBillNo || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [purchaseReturnsList, search]);

  // Stats Calculations
  const billsStats = useMemo(() => {
    return filteredBills.reduce((acc, p) => {
      const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
      const paid = Number(p.paidAmount) || (p.paymentStatus === 'Paid' ? t.finalTotal : 0);
      const due = Math.max(0, t.finalTotal - paid);
      return {
        taxable: acc.taxable + t.taxable,
        tax: acc.tax + t.tax,
        total: acc.total + t.finalTotal,
        unpaid: acc.unpaid + due
      };
    }, { taxable: 0, tax: 0, total: 0, unpaid: 0 });
  }, [filteredBills]);

  const paymentOutStats = useMemo(() => {
    const totalPaid = combinedPaymentOuts.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    // Calculate total unpaid bills across all suppliers
    let totalDues = 0;
    const dueSuppliers = new Set();
    purchaseBillsList.forEach(pb => {
      const t = calcPurchaseTotal(pb.items, !!pb.applyRoundOff);
      const paid = Number(pb.paidAmount) || (pb.paymentStatus === 'Paid' ? t.finalTotal : 0);
      const due = Math.max(0, t.finalTotal - paid);
      if (due > 0.01) {
        totalDues += due;
        if (pb.supplierName) dueSuppliers.add(pb.supplierName.trim().toLowerCase());
      }
    });
    return {
      totalPaid,
      totalDues,
      suppliersWithDues: dueSuppliers.size
    };
  }, [combinedPaymentOuts, purchaseBillsList]);

  const poStats = useMemo(() => {
    return filteredOrders.reduce((acc, po) => {
      const t = calcPurchaseTotal(po.items, false);
      const isOpen = (po.orderStatus || 'Open').toLowerCase() === 'open';
      return {
        totalValue: acc.totalValue + t.finalTotal,
        openCount: acc.openCount + (isOpen ? 1 : 0),
        openValue: acc.openValue + (isOpen ? t.finalTotal : 0)
      };
    }, { totalValue: 0, openCount: 0, openValue: 0 });
  }, [filteredOrders]);

  const returnStats = useMemo(() => {
    return filteredReturns.reduce((acc, r) => {
      const t = calcPurchaseTotal(r.items, false);
      return {
        totalValue: acc.totalValue + t.finalTotal,
        totalTax: acc.totalTax + t.tax
      };
    }, { totalValue: 0, totalTax: 0 });
  }, [filteredReturns]);

  // ==========================================
  // PURCHASE BILL HANDLERS
  // ==========================================
  const openAdd = () => {
    setForm({
      ...emptyForm,
      invoiceNumber: `PB-${Date.now().toString().slice(-4)}`,
      items: [{ ...emptyItem }]
    });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (purchase) => {
    setForm({
      date: purchase.date || '',
      supplierName: purchase.supplierName || '',
      supplierAddress: purchase.supplierAddress || '',
      supplierGstin: purchase.supplierGstin || '',
      invoiceNumber: purchase.invoiceNumber || '',
      items: purchase.items && purchase.items.length > 0 ? purchase.items.map(i => ({ ...i })) : [{ ...emptyItem }],
      paymentStatus: purchase.paymentStatus || 'Unpaid',
      interstate: !!purchase.interstate,
      applyRoundOff: !!purchase.applyRoundOff || (typeof purchase.roundOff === 'number' && purchase.roundOff !== 0),
      note: purchase.note || '',
      docType: 'purchase-bills',
      linkedPoId: purchase.linkedPoId || null,
    });
    setEditingId(purchase.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
  };

  const updateField = (field, val) => setForm(prev => ({ ...prev, [field]: val }));
  const updateItem = (index, field, val) => {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: val };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    const focusKey = `item-${Date.now()}`;
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...emptyItem, _focusKey: focusKey }]
    }));
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleSavePurchaseBill = async () => {
    if (!form.supplierName.trim()) { toast('Supplier name is required', 'warning'); return; }
    if (!form.invoiceNumber.trim()) { toast('Invoice number is required', 'warning'); return; }

    try {
      const totals = calcPurchaseTotal(form.items, form.applyRoundOff);
      const purchase = {
        ...(editingId ? { id: editingId } : {}),
        date: form.date,
        supplierName: form.supplierName.trim(),
        supplierAddress: (form.supplierAddress || '').trim(),
        supplierGstin: form.supplierGstin.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        items: form.items.map(i => ({
          name: (i.name || '').trim(),
          hsn: (i.hsn || '').trim(),
          quantity: parseFloat(i.quantity) || 0,
          rate: parseFloat(i.rate) || 0,
          taxPercent: parseFloat(i.taxPercent) || 0,
          cessPercent: parseFloat(i.cessPercent) || 0,
        })),
        totalAmount: totals.finalTotal,
        totalTax: totals.tax,
        taxableAmount: totals.taxable,
        applyRoundOff: !!form.applyRoundOff,
        roundOff: totals.roundOff,
        paymentStatus: form.paymentStatus,
        interstate: !!form.interstate,
        note: form.note.trim(),
        docType: 'purchase-bills',
        linkedPoId: form.linkedPoId || null,
      };

      const savedBill = await savePurchase(purchase);

      // If linked to a PO, mark that PO as Fulfilled!
      if (form.linkedPoId) {
        const po = purchaseOrdersList.find(o => String(o.id) === String(form.linkedPoId));
        if (po) {
          await savePurchase({
            ...po,
            orderStatus: 'Fulfilled',
            note: (po.note ? po.note + ' | ' : '') + `Converted to Purchase Bill ${form.invoiceNumber}`
          });
        }
      }

      // Sync inventory stock (increment)
      try {
        const existingProducts = await getAllProducts();
        const byName = new Map(existingProducts.map(p => [(p.name || '').trim().toLowerCase(), p]));
        const byId = new Map(existingProducts.map(p => [p.id, p]));

        const priorLines = editingId
          ? (purchases.find(p => p.id === editingId)?.items || [])
          : [];
        const priorQtyByKey = new Map();
        for (const p of priorLines) {
          const key = p.productId || `name:${(p.name || '').trim().toLowerCase()}`;
          priorQtyByKey.set(key, (priorQtyByKey.get(key) || 0) + (Number(p.quantity) || 0));
        }

        const stockDeltaById = new Map();
        const productsToUpsert = new Map();

        for (const it of purchase.items.filter(x => x.name)) {
          const qty = Number(it.quantity) || 0;
          let existing = it.productId ? byId.get(it.productId) : null;
          if (!existing) {
            const key = it.name.trim().toLowerCase();
            existing = byName.get(key);
          }
          if (existing) {
            const priorKey = it.productId
              ? it.productId
              : `name:${(it.name || '').trim().toLowerCase()}`;
            const priorQty = priorQtyByKey.get(priorKey) || 0;
            const delta = qty - priorQty;
            stockDeltaById.set(existing.id, (stockDeltaById.get(existing.id) || 0) + delta);
            productsToUpsert.set(existing.id, {
              ...existing,
              purchasePrice: it.rate,
              hsn: existing.hsn || it.hsn,
              taxPercent: existing.taxPercent || it.taxPercent,
              cessPercent: existing.cessPercent || it.cessPercent || 0,
              _placeholderId: existing.id,
            });
          } else {
            productsToUpsert.set(`__new__::${it.name.trim().toLowerCase()}`, {
              name: it.name.trim(),
              hsn: it.hsn || '',
              purchasePrice: it.rate,
              sellingPrice: it.rate,
              rate: it.rate,
              taxPercent: it.taxPercent || 0,
              cessPercent: it.cessPercent || 0,
              unit: 'Nos',
              stock: qty,
              description: '',
            });
          }
        }

        const upserts = [];
        for (const [, prod] of productsToUpsert) {
          if (prod._placeholderId) {
            const existing = byId.get(prod._placeholderId);
            const delta = stockDeltaById.get(prod._placeholderId) || 0;
            const newStock = Math.max(0, (Number(existing.stock) || 0) + delta);
            upserts.push(saveProduct({ ...prod, stock: newStock, _placeholderId: undefined }));
          } else {
            upserts.push(saveProduct(prod));
          }
        }
        await Promise.all(upserts);
      } catch (e) {
        console.warn('Products auto-sync from purchase failed:', e);
      }

      toast(editingId ? 'Purchase Bill updated' : 'Purchase Bill added & inventory stock updated', 'success');
      closeForm();
      await loadPurchases();
    } catch {
      toast('Failed to save purchase bill', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!await confirmAction({ title: 'Delete Entry?', message: 'Are you sure you want to delete this purchase entry?' })) return;
    try {
      await deletePurchase(id);
      toast('Purchase entry deleted', 'success');
      loadPurchases();
    } catch {
      toast('Failed to delete purchase entry', 'error');
    }
  };

  // Quick Pay for single bill
  const openQuickPay = (purchase) => {
    const t = calcPurchaseTotal(purchase.items, !!purchase.applyRoundOff);
    const paid = Number(purchase.paidAmount) || 0;
    const due = Math.max(0, t.finalTotal - paid);
    setQuickPayPurchase(purchase);
    setQuickPayForm({
      amount: due > 0 ? String(due) : String(t.finalTotal),
      date: new Date().toISOString().split('T')[0],
      method: 'Bank Transfer / NEFT',
      reference: '',
      notes: `Payment for Bill ${purchase.invoiceNumber}`
    });
  };

  const handleSaveQuickPay = async (e) => {
    if (e) e.preventDefault();
    if (!quickPayPurchase) return;
    const amt = parseFloat(quickPayForm.amount);
    if (!amt || amt <= 0) {
      toast('Please enter a valid payment amount', 'warning');
      return;
    }

    try {
      const t = calcPurchaseTotal(quickPayPurchase.items, !!quickPayPurchase.applyRoundOff);
      const currentPaid = Number(quickPayPurchase.paidAmount) || 0;
      const newPaid = currentPaid + amt;
      const nextStatus = newPaid >= (t.finalTotal - 0.01) ? 'Paid' : 'Partial';

      const pmtId = `POUT-${Date.now()}`;
      const newPayment = {
        id: pmtId,
        date: quickPayForm.date,
        amount: amt,
        method: quickPayForm.method,
        reference: quickPayForm.reference.trim(),
        notes: quickPayForm.notes.trim()
      };

      const newPayments = [...(quickPayPurchase.payments || []), newPayment];

      await savePurchase({
        ...quickPayPurchase,
        paidAmount: newPaid,
        paymentStatus: nextStatus,
        payments: newPayments
      });

      // Also persist to vyapar_payment_outs
      const newPayOutRecord = {
        id: pmtId,
        supplierName: quickPayPurchase.supplierName,
        amount: amt,
        date: quickPayForm.date,
        paymentMode: quickPayForm.method,
        referenceNo: quickPayForm.reference.trim(),
        linkedBillId: quickPayPurchase.id,
        linkedBillInvoice: quickPayPurchase.invoiceNumber,
        notes: quickPayForm.notes.trim()
      };
      const updatedList = [newPayOutRecord, ...paymentOuts];
      setPaymentOuts(updatedList);
      localStorage.setItem('vyapar_payment_outs', JSON.stringify(updatedList));

      toast(`Payment of ${formatCurrency(amt)} recorded for Bill ${quickPayPurchase.invoiceNumber}`, 'success');
      setQuickPayPurchase(null);
      await loadPurchases();
    } catch {
      toast('Failed to record payment', 'error');
    }
  };

  // OCR Apply
  const applyOCR = (extracted) => {
    setEditingId(null);
    let items;
    if (Array.isArray(extracted.items) && extracted.items.length > 0) {
      items = extracted.items.map(it => ({
        name: it.name || '',
        hsn: it.hsn || '',
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate) || 0,
        taxPercent: Number(it.taxPercent) || 0,
        cessPercent: 0,
      }));
    } else if (extracted.grandTotal > 0) {
      items = [{ name: 'From OCR — split into real items', hsn: '', quantity: 1, rate: extracted.grandTotal, taxPercent: 0, cessPercent: 0 }];
    } else {
      items = [{ ...emptyItem }];
    }
    setForm({
      ...emptyForm,
      date: extracted.date || emptyForm.date,
      supplierName: extracted.supplierName || '',
      supplierGstin: extracted.supplierGstin || '',
      invoiceNumber: extracted.invoiceNumber || '',
      items,
      docType: 'purchase-bills'
    });
    setShowForm(true);
    const msg = Array.isArray(extracted.items) && extracted.items.length > 0
      ? `OCR loaded ${extracted.items.length} line items — review HSN + tax rates before saving.`
      : 'OCR values loaded — please review, then break the total into line items with correct GST.';
    toast(msg, 'info');
  };

  // ==========================================
  // PAYMENT-OUT HANDLERS
  // ==========================================
  const openPaymentOutModal = (supplier = null) => {
    setPaymentOutForm({
      ...emptyPaymentOutForm,
      supplierId: supplier?.id || '',
      supplierName: supplier?.name || '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowPaymentOutModal(true);
  };

  const handleSavePaymentOut = async (e) => {
    if (e) e.preventDefault();
    const amt = parseFloat(paymentOutForm.amount);
    if (!amt || amt <= 0) {
      toast('Please enter a valid payment amount', 'warning');
      return;
    }
    if (!paymentOutForm.supplierName.trim()) {
      toast('Please select or enter a supplier name', 'warning');
      return;
    }

    try {
      const pmtId = `POUT-${Date.now()}`;
      const supName = paymentOutForm.supplierName.trim();

      // 1. Create Payment-Out record
      const payOutEntry = {
        id: pmtId,
        supplierName: supName,
        amount: amt,
        date: paymentOutForm.date,
        paymentMode: paymentOutForm.paymentMode,
        referenceNo: paymentOutForm.referenceNo.trim(),
        linkedBillId: paymentOutForm.linkedBillId,
        notes: paymentOutForm.notes.trim(),
        createdAt: new Date().toISOString()
      };

      // 2. Auto-settle against unpaid bills
      const supBills = purchaseBillsList.filter(
        p => (p.supplierName || '').trim().toLowerCase() === supName.toLowerCase()
      );

      let remaining = amt;
      if (paymentOutForm.linkedBillId && paymentOutForm.linkedBillId !== '__fifo__') {
        const targetBill = supBills.find(p => String(p.id) === String(paymentOutForm.linkedBillId));
        if (targetBill) {
          const currentPaid = Number(targetBill.paidAmount) || 0;
          const billTotal = calcPurchaseTotal(targetBill.items, !!targetBill.applyRoundOff).finalTotal;
          const apply = Math.min(remaining, Math.max(0, billTotal - currentPaid));
          const newPaid = currentPaid + apply;
          const nextStatus = newPaid >= (billTotal - 0.01) ? 'Paid' : 'Partial';

          const newPayments = [...(targetBill.payments || []), {
            id: pmtId,
            date: paymentOutForm.date,
            amount: apply,
            method: paymentOutForm.paymentMode,
            reference: paymentOutForm.referenceNo.trim(),
            notes: paymentOutForm.notes || `Payment-Out ${paymentOutForm.referenceNo}`
          }];

          await savePurchase({
            ...targetBill,
            paidAmount: newPaid,
            paymentStatus: nextStatus,
            payments: newPayments
          });
          payOutEntry.linkedBillInvoice = targetBill.invoiceNumber;
        }
      } else {
        // FIFO auto-allocation
        const unpaidBills = supBills
          .filter(p => p.paymentStatus !== 'Paid')
          .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

        for (const bill of unpaidBills) {
          if (remaining <= 0) break;
          const currentPaid = Number(bill.paidAmount) || 0;
          const billTotal = calcPurchaseTotal(bill.items, !!bill.applyRoundOff).finalTotal;
          const due = Math.max(0, billTotal - currentPaid);
          if (due <= 0) continue;

          const apply = Math.min(remaining, due);
          const newPaid = currentPaid + apply;
          const nextStatus = newPaid >= (billTotal - 0.01) ? 'Paid' : 'Partial';

          const newPayments = [...(bill.payments || []), {
            id: `${pmtId}-${bill.id}`,
            date: paymentOutForm.date,
            amount: apply,
            method: paymentOutForm.paymentMode,
            reference: paymentOutForm.referenceNo.trim(),
            notes: `Auto-settled Payment-Out ${payOutEntry.id}`
          }];

          await savePurchase({
            ...bill,
            paidAmount: newPaid,
            paymentStatus: nextStatus,
            payments: newPayments
          });
          remaining -= apply;
        }
      }

      // Update payment out records list
      const updatedList = [payOutEntry, ...paymentOuts];
      setPaymentOuts(updatedList);
      localStorage.setItem('vyapar_payment_outs', JSON.stringify(updatedList));

      toast(`Payment-Out of ${formatCurrency(amt)} recorded for ${supName}`, 'success');
      setShowPaymentOutModal(false);
      await loadPurchases();
    } catch {
      toast('Failed to record Payment-Out', 'error');
    }
  };

  const handleDeletePaymentOut = async (pmtId) => {
    if (!await confirmAction({ title: 'Delete Payment-Out?', message: 'Are you sure you want to remove this payment voucher? This will also revert settled bill amounts.' })) return;

    try {
      const updatedList = paymentOuts.filter(p => p.id !== pmtId);
      setPaymentOuts(updatedList);
      localStorage.setItem('vyapar_payment_outs', JSON.stringify(updatedList));

      // Remove from any bill payments
      for (const bill of purchaseBillsList) {
        if (bill.payments && bill.payments.some(p => p.id && (p.id === pmtId || p.id.startsWith(pmtId)))) {
          const filteredPmts = bill.payments.filter(p => !p.id || (!p.id.startsWith(pmtId) && p.id !== pmtId));
          const newPaid = filteredPmts.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
          const billTotal = calcPurchaseTotal(bill.items, !!bill.applyRoundOff).finalTotal;
          const nextStatus = newPaid >= (billTotal - 0.01) ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Unpaid');

          await savePurchase({
            ...bill,
            paidAmount: newPaid,
            paymentStatus: nextStatus,
            payments: filteredPmts
          });
        }
      }

      toast('Payment-Out voucher deleted', 'success');
      await loadPurchases();
    } catch {
      toast('Failed to delete payment', 'error');
    }
  };

  // ==========================================
  // PURCHASE ORDER (PO) HANDLERS
  // ==========================================
  const openAddPo = () => {
    setPoForm({
      ...emptyPoForm,
      invoiceNumber: `PO-${Date.now().toString().slice(-4)}`,
      items: [{ ...emptyItem }]
    });
    setEditingId(null);
    setShowPoForm(true);
  };

  const openEditPo = (po) => {
    setPoForm({
      date: po.date || '',
      expectedDeliveryDate: po.expectedDeliveryDate || '',
      supplierName: po.supplierName || '',
      supplierAddress: po.supplierAddress || '',
      supplierGstin: po.supplierGstin || '',
      invoiceNumber: po.invoiceNumber || '',
      items: po.items && po.items.length > 0 ? po.items.map(i => ({ ...i })) : [{ ...emptyItem }],
      orderStatus: po.orderStatus || 'Open',
      interstate: !!po.interstate,
      note: po.note || '',
      docType: 'purchase-order',
    });
    setEditingId(po.id);
    setShowPoForm(true);
  };

  const handleSavePo = async () => {
    if (!poForm.supplierName.trim()) { toast('Supplier name is required', 'warning'); return; }
    if (!poForm.invoiceNumber.trim()) { toast('PO number is required', 'warning'); return; }

    try {
      const totals = calcPurchaseTotal(poForm.items, false);
      const poData = {
        ...(editingId ? { id: editingId } : {}),
        date: poForm.date,
        expectedDeliveryDate: poForm.expectedDeliveryDate,
        supplierName: poForm.supplierName.trim(),
        supplierAddress: (poForm.supplierAddress || '').trim(),
        supplierGstin: poForm.supplierGstin.trim(),
        invoiceNumber: poForm.invoiceNumber.trim(),
        items: poForm.items.map(i => ({
          name: (i.name || '').trim(),
          hsn: (i.hsn || '').trim(),
          quantity: parseFloat(i.quantity) || 0,
          rate: parseFloat(i.rate) || 0,
          taxPercent: parseFloat(i.taxPercent) || 0,
          cessPercent: parseFloat(i.cessPercent) || 0,
        })),
        totalAmount: totals.finalTotal,
        totalTax: totals.tax,
        taxableAmount: totals.taxable,
        orderStatus: poForm.orderStatus,
        interstate: !!poForm.interstate,
        note: poForm.note.trim(),
        docType: 'purchase-order',
      };

      await savePurchase(poData);
      toast(editingId ? 'Purchase Order updated' : 'Purchase Order created', 'success');
      setShowPoForm(false);
      setEditingId(null);
      await loadPurchases();
    } catch {
      toast('Failed to save Purchase Order', 'error');
    }
  };

  // Convert PO to Purchase Bill (Vyapar core feature)
  const handleConvertToPurchaseBill = (po) => {
    // Populate the Purchase Bill form
    setForm({
      ...emptyForm,
      date: new Date().toISOString().split('T')[0],
      supplierName: po.supplierName || '',
      supplierAddress: po.supplierAddress || '',
      supplierGstin: po.supplierGstin || '',
      invoiceNumber: `BILL-${po.invoiceNumber}`,
      items: (po.items || []).map(i => ({ ...i })),
      interstate: !!po.interstate,
      note: `Converted from Purchase Order ${po.invoiceNumber}`,
      docType: 'purchase-bills',
      linkedPoId: po.id
    });
    setEditingId(null);
    switchTab('purchase-bills');
    setShowForm(true);
    toast(`PO ${po.invoiceNumber} items loaded. Save to convert to a Purchase Bill & update stock!`, 'info');
  };

  // ==========================================
  // PURCHASE RETURN / DEBIT NOTE HANDLERS
  // ==========================================
  const openAddReturn = () => {
    setReturnForm({
      ...emptyReturnForm,
      invoiceNumber: `DN-${Date.now().toString().slice(-4)}`,
      items: [{ ...emptyItem }]
    });
    setEditingId(null);
    setShowReturnForm(true);
  };

  const openEditReturn = (ret) => {
    setReturnForm({
      date: ret.date || '',
      supplierName: ret.supplierName || '',
      supplierAddress: ret.supplierAddress || '',
      supplierGstin: ret.supplierGstin || '',
      invoiceNumber: ret.invoiceNumber || '',
      originalBillNo: ret.originalBillNo || '',
      returnReason: ret.returnReason || 'Damaged Goods',
      items: ret.items && ret.items.length > 0 ? ret.items.map(i => ({ ...i })) : [{ ...emptyItem }],
      reverseStock: ret.reverseStock !== false,
      interstate: !!ret.interstate,
      note: ret.note || '',
      docType: 'purchase-return',
    });
    setEditingId(ret.id);
    setShowReturnForm(true);
  };

  const handleSaveReturn = async () => {
    if (!returnForm.supplierName.trim()) { toast('Supplier name is required', 'warning'); return; }
    if (!returnForm.invoiceNumber.trim()) { toast('Debit Note number is required', 'warning'); return; }

    try {
      const totals = calcPurchaseTotal(returnForm.items, false);
      const returnData = {
        ...(editingId ? { id: editingId } : {}),
        date: returnForm.date,
        supplierName: returnForm.supplierName.trim(),
        supplierAddress: (returnForm.supplierAddress || '').trim(),
        supplierGstin: returnForm.supplierGstin.trim(),
        invoiceNumber: returnForm.invoiceNumber.trim(),
        originalBillNo: returnForm.originalBillNo.trim(),
        returnReason: returnForm.returnReason,
        reverseStock: !!returnForm.reverseStock,
        items: returnForm.items.map(i => ({
          name: (i.name || '').trim(),
          hsn: (i.hsn || '').trim(),
          quantity: parseFloat(i.quantity) || 0,
          rate: parseFloat(i.rate) || 0,
          taxPercent: parseFloat(i.taxPercent) || 0,
          cessPercent: parseFloat(i.cessPercent) || 0,
        })),
        totalAmount: totals.finalTotal,
        totalTax: totals.tax,
        taxableAmount: totals.taxable,
        interstate: !!returnForm.interstate,
        note: returnForm.note.trim(),
        docType: 'purchase-return',
      };

      await savePurchase(returnData);

      // If reverseStock is checked, reduce product stock
      if (returnForm.reverseStock) {
        try {
          const prods = await getAllProducts();
          for (const it of returnData.items) {
            const match = prods.find(p => (p.name || '').trim().toLowerCase() === it.name.toLowerCase());
            if (match) {
              const currentStock = Number(match.stock) || 0;
              const newStock = Math.max(0, currentStock - (Number(it.quantity) || 0));
              await saveProduct({ ...match, stock: newStock });
            }
          }
        } catch (e) {
          console.warn('Stock reversal failed:', e);
        }
      }

      toast(editingId ? 'Debit Note updated' : 'Purchase Return recorded & Debit Note created', 'success');
      setShowReturnForm(false);
      setEditingId(null);
      await loadPurchases();
    } catch {
      toast('Failed to save Debit Note', 'error');
    }
  };

  // ==========================================
  // PDF GENERATION SUITE
  // ==========================================
  // 1. Generic Purchase/PO/Return PDF
  const viewAsPdf = async (docObj, title = 'PURCHASE BILL') => {
    try {
      const { jsPDF } = await import('jspdf');
      const t = calcPurchaseTotal(docObj.items, !!docObj.applyRoundOff);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195;
      let y = 20;
      const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(title, marginL, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);

      const numLabel = title.includes('ORDER') ? 'PO #' : title.includes('DEBIT') ? 'Debit Note #' : 'Invoice #';
      doc.text(`${numLabel}: ${docObj.invoiceNumber || '-'}`, marginL, y); y += 5;
      doc.text(`Date: ${docObj.date ? new Date(docObj.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}`, marginL, y); y += 5;

      if (docObj.expectedDeliveryDate) {
        doc.text(`Expected Delivery: ${new Date(docObj.expectedDeliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, marginL, y); y += 5;
      }
      if (docObj.originalBillNo) {
        doc.text(`Original Bill Ref: ${docObj.originalBillNo}   ·   Reason: ${docObj.returnReason || 'Goods Return'}`, marginL, y); y += 5;
      }
      if (docObj.orderStatus) {
        doc.text(`Order Status: ${docObj.orderStatus}`, marginL, y); y += 5;
      }
      if (docObj.paymentStatus) {
        doc.text(`Payment: ${docObj.paymentStatus}   ·   ${docObj.interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}`, marginL, y); y += 5;
      }

      y += 3;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 8;

      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('Supplier / Vendor', marginL, y); y += 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(docObj.supplierName || '-', marginL, y); y += 5;
      if (docObj.supplierAddress) {
        const wrapped = doc.splitTextToSize(docObj.supplierAddress, 110);
        wrapped.forEach(line => { doc.text(line, marginL, y); y += 5; });
      }
      if (docObj.supplierGstin) { doc.text(`GSTIN: ${docObj.supplierGstin}`, marginL, y); y += 5; }
      y += 4;

      // Table Header
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('#', marginL, y);
      doc.text('Description', marginL + 8, y);
      doc.text('HSN', marginL + 80, y);
      doc.text('Qty', marginL + 100, y, { align: 'right' });
      doc.text('Rate', marginL + 122, y, { align: 'right' });
      doc.text('GST%', marginL + 140, y, { align: 'right' });
      doc.text('Amount', marginR, y, { align: 'right' });
      y += 2; doc.setLineWidth(0.2); doc.line(marginL, y, marginR, y); y += 5;

      // Rows
      doc.setFont('helvetica', 'normal');
      (docObj.items || []).forEach((item, idx) => {
        if (y > 265) { doc.addPage(); y = 20; }
        const lineTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
        const withTax = lineTotal * (1 + (Number(item.taxPercent) || 0) / 100);
        const nameLines = doc.splitTextToSize(String(item.name || '-'), 70);
        const rowH = Math.max(6, nameLines.length * 4.5);
        if (y + rowH > 275) { doc.addPage(); y = 20; }
        doc.text(String(idx + 1), marginL, y);
        nameLines.forEach((line, lineIdx) => {
          doc.text(line, marginL + 8, y + lineIdx * 4.5);
        });
        doc.text(String(item.hsn || '-'), marginL + 80, y);
        doc.text(String(item.quantity || 0), marginL + 100, y, { align: 'right' });
        doc.text(fmt(item.rate), marginL + 122, y, { align: 'right' });
        doc.text(String(item.taxPercent || 0) + '%', marginL + 140, y, { align: 'right' });
        doc.text(fmt(withTax), marginR, y, { align: 'right' });
        y += rowH;
      });

      // Totals
      y += 4; doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.4);
      doc.line(marginL + 100, y, marginR, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
      doc.text('Taxable', marginL + 100, y); doc.text(fmt(t.taxable), marginR, y, { align: 'right' }); y += 5;
      doc.text('Tax (GST)', marginL + 100, y); doc.text(fmt(t.tax), marginR, y, { align: 'right' }); y += 5;
      if (t.cess > 0.005) { doc.text('Cess', marginL + 100, y); doc.text(fmt(t.cess), marginR, y, { align: 'right' }); y += 5; }
      if (Math.abs(t.roundOff) > 0.005) { doc.text('Round-off', marginL + 100, y); doc.text((t.roundOff > 0 ? '+' : '') + fmt(t.roundOff), marginR, y, { align: 'right' }); y += 5; }
      y += 2; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(marginL + 100, y, marginR, y); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
      doc.text('TOTAL', marginL + 100, y); doc.text(fmt(t.finalTotal), marginR, y, { align: 'right' });

      if (docObj.note) {
        y += 14; doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(90);
        doc.text('Note: ' + docObj.note, marginL, y);
      }

      const safeInv = String(docObj.invoiceNumber || 'doc').replace(/[^A-Za-z0-9._-]/g, '_');
      doc.save(`${title.replace(/[^A-Za-z0-9]/g, '_')}-${safeInv}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast('Could not generate PDF', 'error');
    }
  };

  // 2. Payment-Out Voucher PDF
  const downloadPaymentVoucher = async (pmt) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginL = 20, marginR = 190;
      let y = 25;
      const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.setFontSize(20); doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT OUT VOUCHER', marginL, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(`Voucher No: ${pmt.id}`, marginL, y); y += 5;
      doc.text(`Date: ${pmt.date ? new Date(pmt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}`, marginL, y); y += 8;

      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.8);
      doc.line(marginL, y, marginR, y); y += 12;

      // Paid To Box
      doc.setFillColor(248, 250, 252);
      doc.rect(marginL, y, marginR - marginL, 32, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginL, y, marginR - marginL, 32, 'S');

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105);
      doc.text('PAID TO (SUPPLIER / VENDOR)', marginL + 5, y + 8);
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text(pmt.supplierName || '—', marginL + 5, y + 16);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      if (pmt.linkedBillInvoice) {
        doc.text(`Settled Against Purchase Bill: ${pmt.linkedBillInvoice}`, marginL + 5, y + 24);
      } else {
        doc.text('Settlement: Auto-allocation / On-Account', marginL + 5, y + 24);
      }
      y += 42;

      // Payment Details Table
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('Payment Information', marginL, y); y += 6;
      doc.setLineWidth(0.2); doc.line(marginL, y, marginR, y); y += 6;

      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
      doc.text('Payment Mode:', marginL, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text(pmt.paymentMode || 'Bank Transfer', marginL + 45, y); y += 7;

      if (pmt.referenceNo) {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
        doc.text('Reference / UTR / Cheque No:', marginL, y);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
        doc.text(pmt.referenceNo, marginL + 60, y); y += 7;
      }

      if (pmt.notes) {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
        doc.text('Notes / Remarks:', marginL, y);
        doc.setFont('helvetica', 'italic'); doc.setTextColor(0);
        doc.text(pmt.notes, marginL + 45, y); y += 7;
      }

      y += 8;
      // Amount Banner
      doc.setFillColor(236, 253, 245);
      doc.rect(marginL, y, marginR - marginL, 26, 'F');
      doc.setDrawColor(167, 243, 208);
      doc.rect(marginL, y, marginR - marginL, 26, 'S');

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(4, 120, 87);
      doc.text('TOTAL AMOUNT PAID', marginL + 8, y + 9);
      doc.setFontSize(16); doc.setTextColor(5, 150, 105);
      doc.text(`₹ ${fmt(pmt.amount)}`, marginL + 8, y + 19);

      try {
        const words = numberToWords(Math.round(Number(pmt.amount) || 0));
        doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(71, 85, 105);
        doc.text(`(${words} Rupees Only)`, marginL + 75, y + 18);
      } catch { /* ignore */ }

      y += 45;
      // Signature Blocks
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.line(marginL, y + 15, marginL + 50, y + 15);
      doc.text('Receiver / Vendor Signature', marginL, y + 20);

      doc.line(marginR - 50, y + 15, marginR, y + 15);
      doc.text('Authorized Signatory', marginR - 50, y + 20);

      doc.save(`Payment_Out_${pmt.id}.pdf`);
      toast('Payment Voucher downloaded', 'success');
    } catch (err) {
      console.error('Voucher PDF failed:', err);
      toast('Could not download payment voucher', 'error');
    }
  };

  // CSV Export for active tab
  const exportActiveCSV = () => {
    let headers = [];
    let rows = [];
    let filename = '';

    const escape = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    if (activeTab === 'purchase-bills') {
      if (filteredBills.length === 0) { toast('No purchase bills to export', 'warning'); return; }
      headers = ['Date', 'Supplier', 'GSTIN', 'Invoice No', 'Taxable Amount', 'Tax', 'Round-off', 'Total', 'Status', 'Note'];
      filteredBills.forEach(p => {
        const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
        rows.push([p.date, p.supplierName, p.supplierGstin, p.invoiceNumber, t.taxable.toFixed(2), t.tax.toFixed(2), t.roundOff.toFixed(2), t.finalTotal.toFixed(2), p.paymentStatus, p.note].map(escape).join(','));
      });
      filename = 'Purchase_Bills.csv';
    } else if (activeTab === 'payment-out') {
      if (filteredPaymentOuts.length === 0) { toast('No payment-out records to export', 'warning'); return; }
      headers = ['Date', 'Voucher ID', 'Supplier', 'Payment Mode', 'Reference No', 'Amount', 'Settled Bill', 'Notes'];
      filteredPaymentOuts.forEach(pmt => {
        rows.push([pmt.date, pmt.id, pmt.supplierName, pmt.paymentMode, pmt.referenceNo, pmt.amount, pmt.linkedBillInvoice || pmt.linkedBillId || 'FIFO', pmt.notes].map(escape).join(','));
      });
      filename = 'Payment_Outs.csv';
    } else if (activeTab === 'purchase-order') {
      if (filteredOrders.length === 0) { toast('No purchase orders to export', 'warning'); return; }
      headers = ['Date', 'PO Number', 'Supplier', 'Expected Delivery', 'Total Value', 'Status', 'Notes'];
      filteredOrders.forEach(po => {
        const t = calcPurchaseTotal(po.items, false);
        rows.push([po.date, po.invoiceNumber, po.supplierName, po.expectedDeliveryDate, t.finalTotal.toFixed(2), po.orderStatus, po.note].map(escape).join(','));
      });
      filename = 'Purchase_Orders.csv';
    } else if (activeTab === 'purchase-return') {
      if (filteredReturns.length === 0) { toast('No debit notes to export', 'warning'); return; }
      headers = ['Date', 'Debit Note #', 'Original Bill #', 'Supplier', 'Reason', 'Return Value', 'Reversed GST', 'Notes'];
      filteredReturns.forEach(ret => {
        const t = calcPurchaseTotal(ret.items, false);
        rows.push([ret.date, ret.invoiceNumber, ret.originalBillNo, ret.supplierName, ret.returnReason, t.finalTotal.toFixed(2), t.tax.toFixed(2), ret.note].map(escape).join(','));
      });
      filename = 'Debit_Notes_Purchase_Returns.csv';
    }

    const lines = [headers.map(escape).join(','), ...rows];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast(`${filename} downloaded`, 'success');
  };

  const formTotals = calcPurchaseTotal(form.items, form.applyRoundOff);
  const poFormTotals = calcPurchaseTotal(poForm.items, false);
  const returnFormTotals = calcPurchaseTotal(returnForm.items, false);

  return (
    <div className="dashboard-container">
      {/* Vyapar 4-Part Top Tab Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '2px solid var(--border, #e2e8f0)',
        marginBottom: '1.25rem',
        paddingBottom: '0.25rem',
        overflowX: 'auto'
      }}>
        {[
          { id: 'purchase-bills', label: 'Purchase Bills', count: counts.bills, icon: ShoppingCart },
          { id: 'payment-out', label: 'Payment-Out', count: counts.paymentOut, icon: ArrowUpRight },
          { id: 'purchase-order', label: 'Purchase Order', count: counts.orders, icon: FileText },
          { id: 'purchase-return', label: 'Purchase Return (Debit Note)', count: counts.returns, icon: RotateCcw }
        ].map(t => {
          const isActive = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                border: 'none',
                background: isActive ? 'var(--primary, #2563eb)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary, #475569)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.9rem',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none'
              }}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              <span style={{
                fontSize: '0.72rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-secondary, #e2e8f0)',
                color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                fontWeight: 700
              }}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Page Header & Action Buttons */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              {activeTab === 'purchase-bills' && 'Purchase Bills'}
              {activeTab === 'payment-out' && 'Payment-Out (Vendor Settlements)'}
              {activeTab === 'purchase-order' && 'Purchase Orders'}
              {activeTab === 'purchase-return' && 'Purchase Return / Debit Notes'}
            </h1>
            <p className="page-subtitle" style={{ margin: 0, marginTop: 3 }}>
              {activeTab === 'purchase-bills' && 'Track supplier invoices for ITC claims in GSTR-3B & update product stock'}
              {activeTab === 'payment-out' && 'Record vendor payments, cheque/bank transfers, and auto-settle supplier bills'}
              {activeTab === 'purchase-order' && 'Issue purchase orders to suppliers and convert to purchase bills in 1 click'}
              {activeTab === 'purchase-return' && 'Issue debit notes for returned goods and reverse GST ITC'}
            </p>
          </div>
          <HelpButton title="Vyapar Purchase Management Suite">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Purchase Bills:</strong> Vendor tax invoices that build Input Tax Credit (ITC) and increment inventory stock.</li>
              <li><strong>Payment-Out:</strong> Direct payments to suppliers (Cash, Bank, UPI, Cheque) with FIFO auto-settlement against bills.</li>
              <li><strong>Purchase Order (PO):</strong> Place orders with suppliers. Click <em>Convert to Purchase Bill</em> once goods arrive!</li>
              <li><strong>Purchase Return (Debit Note):</strong> Return damaged/excess items, reverse GST ITC, and adjust product stock.</li>
            </ul>
          </HelpButton>
        </div>

        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={exportActiveCSV}>
            <Download size={16} /> Export CSV
          </button>

          {activeTab === 'purchase-bills' && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowOCR(true)} title="Extract fields from bill photo/scan">
                <Wand2 size={16} /> Import from image (OCR)
              </button>
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus size={18} /> Add Purchase Bill
              </button>
            </>
          )}

          {activeTab === 'payment-out' && (
            <button className="btn btn-primary" onClick={() => openPaymentOutModal()} style={{ background: '#059669', borderColor: '#059669' }}>
              <Plus size={18} /> Record Payment-Out
            </button>
          )}

          {activeTab === 'purchase-order' && (
            <button className="btn btn-primary" onClick={openAddPo}>
              <Plus size={18} /> New Purchase Order
            </button>
          )}

          {activeTab === 'purchase-return' && (
            <button className="btn btn-primary" onClick={openAddReturn} style={{ background: '#dc2626', borderColor: '#dc2626' }}>
              <Plus size={18} /> New Purchase Return / Debit Note
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PURCHASE BILLS                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'purchase-bills' && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple"><ShoppingCart size={22} /></div>
              <div><p className="stat-label">Total Purchases</p><h2 className="stat-value stat-value-purple">{formatCurrency(billsStats.total)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green"><ShoppingCart size={22} /></div>
              <div><p className="stat-label">GST (ITC Eligible)</p><h2 className="stat-value stat-value-green">{formatCurrency(billsStats.tax)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-amber"><AlertTriangle size={22} /></div>
              <div><p className="stat-label">Unpaid Dues</p><h2 className="stat-value stat-value-amber">{formatCurrency(billsStats.unpaid)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue"><ShoppingCart size={22} /></div>
              <div><p className="stat-label">Bills Count</p><h2 className="stat-value">{filteredBills.length}</h2></div>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-panel p-4 mb-6">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-box" style={{ maxWidth: '300px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search supplier, invoice..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
                {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                {['ALL', 'UNPAID', 'PARTIAL', 'PAID'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: statusFilter === s ? 'var(--primary, #2563eb)' : 'var(--bg-secondary, #f3f4f6)',
                      color: statusFilter === s ? '#ffffff' : 'var(--text-secondary, #4b5563)',
                      transition: 'all 0.15s ease'
                    }}>
                    {s === 'ALL' ? 'All Bills' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              {search && (
                <button className="icon-btn icon-btn-red" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Bills Table */}
          <div className="glass-panel">
            <div className="table-header"><h3>Purchase Records</h3></div>
            {filteredBills.length === 0 ? (
              <div className="empty-state">
                <ShoppingCart size={48} />
                <p>{purchaseBillsList.length === 0 ? 'No purchase bills recorded yet.' : 'No purchases match your filters.'}</p>
                {purchaseBillsList.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Purchase Bill</button>}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Supplier</th>
                      <th>GSTIN</th>
                      <th>Invoice No</th>
                      <th style={{ textAlign: 'right' }}>Taxable</th>
                      <th style={{ textAlign: 'right' }}>Tax</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map(p => {
                      const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
                      return (
                        <tr key={p.id}>
                          <td className="text-muted">{p.date ? new Date(p.date).toLocaleDateString('en-IN') : ''}</td>
                          <td className="font-medium">{p.supplierName}</td>
                          <td className="text-muted" style={{ fontSize: '0.78rem' }}>{p.supplierGstin || '-'}</td>
                          <td><span className="invoice-badge">{p.invoiceNumber}</span></td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</td>
                          <td style={{ textAlign: 'right' }} className="text-muted">{formatCurrency(t.tax)}</td>
                          <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(t.finalTotal)}</td>
                          <td>
                            <span style={{
                              padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                              background: p.paymentStatus === 'Paid' ? '#ecfdf5' : p.paymentStatus === 'Partial' ? '#f5f3ff' : '#fffbeb',
                              color: p.paymentStatus === 'Paid' ? '#059669' : p.paymentStatus === 'Partial' ? '#8b5cf6' : '#f59e0b',
                            }}>{p.paymentStatus || 'Unpaid'}</span>
                          </td>
                          <td>
                            <div className="table-actions">
                              {p.paymentStatus !== 'Paid' && (
                                <button
                                  className="icon-btn"
                                  style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5' }}
                                  onClick={() => openQuickPay(p)}
                                  title="Record Payment for this bill">
                                  <CreditCard size={15} />
                                </button>
                              )}
                              <button className="icon-btn" onClick={() => setViewPurchase(p)} title="View details"><Eye size={15} /></button>
                              <button className="icon-btn icon-btn-blue" onClick={() => openEdit(p)} title="Edit"><Edit3 size={15} /></button>
                              <button className="icon-btn icon-btn-red" onClick={() => handleDelete(p.id)} title="Delete"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={4}>Total</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(billsStats.taxable)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(billsStats.tax)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(billsStats.total)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PAYMENT-OUT                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'payment-out' && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green"><ArrowUpRight size={22} /></div>
              <div><p className="stat-label">Total Paid Out</p><h2 className="stat-value stat-value-green">{formatCurrency(paymentOutStats.totalPaid)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-amber"><AlertTriangle size={22} /></div>
              <div><p className="stat-label">Pending Supplier Bills</p><h2 className="stat-value stat-value-amber">{formatCurrency(paymentOutStats.totalDues)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple"><ShoppingCart size={22} /></div>
              <div><p className="stat-label">Suppliers with Dues</p><h2 className="stat-value stat-value-purple">{paymentOutStats.suppliersWithDues}</h2></div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="glass-panel p-4 mb-6">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-box" style={{ maxWidth: '350px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search supplier, voucher #, UTR..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              {search && (
                <button className="icon-btn icon-btn-red" onClick={() => setSearch('')} title="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Payment-Out Table */}
          <div className="glass-panel">
            <div className="table-header"><h3>Payment-Out Vouchers</h3></div>
            {filteredPaymentOuts.length === 0 ? (
              <div className="empty-state">
                <ArrowUpRight size={48} />
                <p>No payment-out vouchers recorded yet.</p>
                <button className="btn btn-primary" onClick={() => openPaymentOutModal()} style={{ background: '#059669', borderColor: '#059669' }}>
                  <Plus size={18} /> Record First Payment-Out
                </button>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher #</th>
                      <th>Supplier</th>
                      <th>Payment Mode</th>
                      <th>Reference / UTR</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                      <th>Settlement</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPaymentOuts.map(pmt => (
                      <tr key={pmt.id}>
                        <td className="text-muted">{pmt.date ? new Date(pmt.date).toLocaleDateString('en-IN') : '-'}</td>
                        <td><span className="invoice-badge">{pmt.id}</span></td>
                        <td className="font-medium">{pmt.supplierName}</td>
                        <td>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: 'var(--bg-secondary, #f1f5f9)',
                            color: 'var(--text-secondary, #334155)'
                          }}>
                            {pmt.paymentMode || 'Bank Transfer'}
                          </span>
                        </td>
                        <td className="text-muted" style={{ fontSize: '0.82rem' }}>{pmt.referenceNo || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          {formatCurrency(pmt.amount)}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {pmt.linkedBillInvoice ? `Bill ${pmt.linkedBillInvoice}` : 'FIFO Auto-settle'}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="icon-btn"
                              style={{ color: '#2563eb' }}
                              onClick={() => downloadPaymentVoucher(pmt)}
                              title="Download Payment Voucher PDF">
                              <Download size={15} />
                            </button>
                            <button
                              className="icon-btn icon-btn-red"
                              onClick={() => handleDeletePaymentOut(pmt.id)}
                              title="Delete Payment Voucher">
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
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PURCHASE ORDERS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'purchase-order' && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue"><FileText size={22} /></div>
              <div><p className="stat-label">Total Orders Value</p><h2 className="stat-value">{formatCurrency(poStats.totalValue)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-amber"><Clock size={22} /></div>
              <div><p className="stat-label">Open POs Pending</p><h2 className="stat-value stat-value-amber">{poStats.openCount} ({formatCurrency(poStats.openValue)})</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple"><CheckCircle size={22} /></div>
              <div><p className="stat-label">Total Purchase Orders</p><h2 className="stat-value stat-value-purple">{filteredOrders.length}</h2></div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="glass-panel p-4 mb-6">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-box" style={{ maxWidth: '300px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search PO #, supplier..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                {['ALL', 'OPEN', 'FULFILLED', 'CANCELLED'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPoStatusFilter(s)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: poStatusFilter === s ? 'var(--primary, #2563eb)' : 'var(--bg-secondary, #f3f4f6)',
                      color: poStatusFilter === s ? '#ffffff' : 'var(--text-secondary, #4b5563)',
                      transition: 'all 0.15s ease'
                    }}>
                    {s === 'ALL' ? 'All Orders' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              {search && (
                <button className="icon-btn icon-btn-red" onClick={() => setSearch('')} title="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Purchase Orders Table */}
          <div className="glass-panel">
            <div className="table-header"><h3>Purchase Orders</h3></div>
            {filteredOrders.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <p>No purchase orders found.</p>
                <button className="btn btn-primary" onClick={openAddPo}>
                  <Plus size={18} /> Create First Purchase Order
                </button>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <th>PO Date</th>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Expected Delivery</th>
                      <th style={{ textAlign: 'right' }}>Items</th>
                      <th style={{ textAlign: 'right' }}>Total Value</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(po => {
                      const t = calcPurchaseTotal(po.items, false);
                      const isFulfilled = (po.orderStatus || 'Open').toLowerCase() === 'fulfilled';
                      const isCancelled = (po.orderStatus || 'Open').toLowerCase() === 'cancelled';
                      return (
                        <tr key={po.id}>
                          <td className="text-muted">{po.date ? new Date(po.date).toLocaleDateString('en-IN') : '-'}</td>
                          <td><span className="invoice-badge">{po.invoiceNumber}</span></td>
                          <td className="font-medium">{po.supplierName}</td>
                          <td className="text-muted">
                            {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>{(po.items || []).length} items</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(t.finalTotal)}</td>
                          <td>
                            <span style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: isFulfilled ? '#ecfdf5' : isCancelled ? '#fef2f2' : '#eff6ff',
                              color: isFulfilled ? '#059669' : isCancelled ? '#dc2626' : '#2563eb'
                            }}>
                              {po.orderStatus || 'Open'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              {!isFulfilled && !isCancelled && (
                                <button
                                  className="btn btn-secondary"
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.55rem',
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    borderColor: '#bfdbfe'
                                  }}
                                  onClick={() => handleConvertToPurchaseBill(po)}
                                  title="1-Click Convert to Purchase Bill (Vyapar)">
                                  ⚡ Convert to Bill
                                </button>
                              )}
                              <button className="icon-btn" onClick={() => viewAsPdf(po, 'PURCHASE ORDER')} title="Download PO PDF">
                                <Download size={15} />
                              </button>
                              <button className="icon-btn icon-btn-blue" onClick={() => openEditPo(po)} title="Edit PO">
                                <Edit3 size={15} />
                              </button>
                              <button className="icon-btn icon-btn-red" onClick={() => handleDelete(po.id)} title="Delete PO">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PURCHASE RETURN / DEBIT NOTE                                       */}
      {/* ========================================================================= */}
      {activeTab === 'purchase-return' && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-icon stat-icon-amber"><RotateCcw size={22} /></div>
              <div><p className="stat-label">Total Returned Value</p><h2 className="stat-value stat-value-amber">{formatCurrency(returnStats.totalValue)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple"><AlertTriangle size={22} /></div>
              <div><p className="stat-label">Reversed GST ITC</p><h2 className="stat-value stat-value-purple">{formatCurrency(returnStats.totalTax)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue"><FileText size={22} /></div>
              <div><p className="stat-label">Debit Notes Count</p><h2 className="stat-value">{filteredReturns.length}</h2></div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="glass-panel p-4 mb-6">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-box" style={{ maxWidth: '350px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search debit note #, bill #, supplier..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              {search && (
                <button className="icon-btn icon-btn-red" onClick={() => setSearch('')} title="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Debit Notes Table */}
          <div className="glass-panel">
            <div className="table-header"><h3>Debit Notes / Purchase Returns</h3></div>
            {filteredReturns.length === 0 ? (
              <div className="empty-state">
                <RotateCcw size={48} />
                <p>No purchase return or debit notes recorded yet.</p>
                <button className="btn btn-primary" onClick={openAddReturn} style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                  <Plus size={18} /> Create Debit Note
                </button>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '850px' }}>
                  <thead>
                    <tr>
                      <th>Return Date</th>
                      <th>Debit Note #</th>
                      <th>Original Bill #</th>
                      <th>Supplier</th>
                      <th>Return Reason</th>
                      <th style={{ textAlign: 'right' }}>Tax Reversal</th>
                      <th style={{ textAlign: 'right' }}>Total Return</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.map(ret => {
                      const t = calcPurchaseTotal(ret.items, false);
                      return (
                        <tr key={ret.id}>
                          <td className="text-muted">{ret.date ? new Date(ret.date).toLocaleDateString('en-IN') : '-'}</td>
                          <td><span className="invoice-badge" style={{ color: '#dc2626', background: '#fef2f2' }}>{ret.invoiceNumber}</span></td>
                          <td className="font-medium">{ret.originalBillNo || '—'}</td>
                          <td className="font-medium">{ret.supplierName}</td>
                          <td>
                            <span style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: '#fef3c7',
                              color: '#b45309'
                            }}>
                              {ret.returnReason || 'Damaged Goods'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>{formatCurrency(t.tax)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(t.finalTotal)}</td>
                          <td>
                            <div className="table-actions">
                              <button className="icon-btn" onClick={() => viewAsPdf(ret, 'DEBIT NOTE / PURCHASE RETURN')} title="Download Debit Note PDF">
                                <Download size={15} />
                              </button>
                              <button className="icon-btn icon-btn-blue" onClick={() => openEditReturn(ret)} title="Edit Debit Note">
                                <Edit3 size={15} />
                              </button>
                              <button className="icon-btn icon-btn-red" onClick={() => handleDelete(ret.id)} title="Delete Debit Note">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PURCHASE BILL                                           */}
      {/* ========================================================================= */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <h3 className="section-title">{editingId ? 'Edit Purchase Bill' : 'Add Purchase Bill'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select className="form-input" value={form.paymentStatus} onChange={e => updateField('paymentStatus', e.target.value)}>
                  {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Supplier Name *</label>
                  <button type="button" style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setShowQuickSupplierModal(true)}>
                    + Quick Add
                  </button>
                </div>
                <input
                  type="text"
                  className="form-input"
                  list="pb-suppliers-list"
                  value={form.supplierName}
                  onChange={e => {
                    const val = e.target.value;
                    updateField('supplierName', val);
                    const matched = savedSuppliers.find(s => s.name && s.name.toLowerCase() === val.toLowerCase());
                    if (matched) {
                      if (matched.gstin) updateField('supplierGstin', matched.gstin);
                      if (matched.address || matched.city || matched.state) {
                        const fullAddr = [matched.address, matched.city, matched.state, matched.pin].filter(Boolean).join(', ');
                        updateField('supplierAddress', fullAddr);
                      }
                    }
                  }}
                  placeholder="Vendor / Supplier name"
                />
                <datalist id="pb-suppliers-list">
                  {savedSuppliers.map(s => (
                    <option key={s.id || s.name} value={s.name}>{s.gstin ? `${s.name} (${s.gstin})` : s.name}</option>
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Supplier GSTIN</label>
                <input type="text" className="form-input" value={form.supplierGstin}
                  onChange={e => updateField('supplierGstin', e.target.value.toUpperCase())} placeholder="15-digit GSTIN" maxLength={15} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Supplier Address (optional)</label>
                <input type="text" className="form-input" value={form.supplierAddress || ''}
                  onChange={e => updateField('supplierAddress', e.target.value)}
                  placeholder="Street, City, State — printed on the Purchase Bill PDF" />
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Number *</label>
                <input type="text" className="form-input" value={form.invoiceNumber}
                  onChange={e => updateField('invoiceNumber', e.target.value)} placeholder="Supplier invoice no." />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={form.note}
                  onChange={e => updateField('note', e.target.value)} placeholder="Any note..." />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.interstate}
                    onChange={e => updateField('interstate', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <span>
                    <strong>Inter-state purchase</strong> — supplier charged IGST (different state)
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                      Routes ITC to IGST in GSTR-3B instead of CGST + SGST.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Line Items */}
            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 2, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Name</label>}
                  <input type="text" className="form-input" value={item.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name" />
                </div>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  {idx === 0 && <label className="form-label">HSN</label>}
                  <input type="text" className="form-input" value={item.hsn}
                    onChange={e => updateItem(idx, 'hsn', e.target.value)} placeholder="HSN" />
                </div>
                <div className="form-group" style={{ flex: 0.7, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Qty</label>}
                  <input type="number" className="form-input" value={item.quantity} min="0" step="any"
                    onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Rate</label>}
                  <input type="number" className="form-input" value={item.rate} min="0" step="any"
                    onChange={e => updateItem(idx, 'rate', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 0.75, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Tax %</label>}
                  <select className="form-input" value={String(item.taxPercent)} onChange={e => updateItem(idx, 'taxPercent', e.target.value)}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 0.7, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Cess %</label>}
                  <input type="number" className="form-input" value={item.cessPercent ?? 0} min="0" step="any"
                    onChange={e => updateItem(idx, 'cessPercent', e.target.value)} />
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  {form.items.length > 1 && (
                    <button className="icon-btn icon-btn-red" onClick={() => removeItem(idx)} title="Remove"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}
              onClick={addItem}><Plus size={14} /> Add Item</button>

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Taxable: <strong>{formatCurrency(formTotals.taxable)}</strong></span>
                <span>Tax: <strong>{formatCurrency(formTotals.tax)}</strong></span>
                {formTotals.cess > 0 && <span>Cess: <strong>{formatCurrency(formTotals.cess)}</strong></span>}
                {form.applyRoundOff && (
                  <span style={{ color: '#475569' }}>Round-off: <strong>{(formTotals.roundOff >= 0 ? '+' : '') + formatCurrency(formTotals.roundOff)}</strong></span>
                )}
                <span>Total: <strong>{formatCurrency(formTotals.finalTotal)}</strong></span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', cursor: 'pointer', marginTop: '0.6rem', color: '#475569' }}>
                <input type="checkbox" checked={!!form.applyRoundOff}
                  onChange={e => updateField('applyRoundOff', e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                <span><strong>Apply round-off</strong> — round grand total to nearest rupee</span>
              </label>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePurchaseBill}><Save size={16} /> {editingId ? 'Update Bill' : 'Save Bill'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD PAYMENT-OUT                                                 */}
      {/* ========================================================================= */}
      {showPaymentOutModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentOutModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>Record Payment-Out</h3>
              <button onClick={() => setShowPaymentOutModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePaymentOut}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Supplier / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  list="pout-suppliers-list"
                  placeholder="Select or enter supplier"
                  value={paymentOutForm.supplierName}
                  onChange={e => setPaymentOutForm(prev => ({ ...prev, supplierName: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    fontSize: '0.95rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <datalist id="pout-suppliers-list">
                  {savedSuppliers.map(s => (
                    <option key={s.id || s.name} value={s.name} />
                  ))}
                </datalist>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Amount Paid (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={paymentOutForm.amount}
                  onChange={e => setPaymentOutForm(prev => ({ ...prev, amount: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    outline: 'none',
                    boxSizing: 'border-box',
                    color: '#059669'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentOutForm.date}
                    onChange={e => setPaymentOutForm(prev => ({ ...prev, date: e.target.value }))}
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Payment Mode
                  </label>
                  <select
                    value={paymentOutForm.paymentMode}
                    onChange={e => setPaymentOutForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Bill Allocation
                </label>
                <select
                  value={paymentOutForm.linkedBillId}
                  onChange={e => setPaymentOutForm(prev => ({ ...prev, linkedBillId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}>
                  <option value="__fifo__">Auto FIFO (Oldest unpaid bills first)</option>
                  {purchaseBillsList
                    .filter(b => !paymentOutForm.supplierName || (b.supplierName || '').trim().toLowerCase() === paymentOutForm.supplierName.trim().toLowerCase())
                    .filter(b => b.paymentStatus !== 'Paid')
                    .map(b => {
                      const t = calcPurchaseTotal(b.items, !!b.applyRoundOff);
                      const due = Math.max(0, t.finalTotal - (Number(b.paidAmount) || 0));
                      return (
                        <option key={b.id} value={b.id}>
                          Bill {b.invoiceNumber} ({b.date}) - Due: {formatCurrency(due)}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Reference No. (UTR / Cheque No.)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR8912384 / CHQ-10492"
                  value={paymentOutForm.referenceNo}
                  onChange={e => setPaymentOutForm(prev => ({ ...prev, referenceNo: e.target.value }))}
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

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Notes / Remarks (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid from HDFC Current Account"
                  value={paymentOutForm.notes}
                  onChange={e => setPaymentOutForm(prev => ({ ...prev, notes: e.target.value }))}
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

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentOutModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>
                  <Save size={16} /> Save Payment-Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PURCHASE ORDER                                          */}
      {/* ========================================================================= */}
      {showPoForm && (
        <div className="modal-overlay" onClick={() => setShowPoForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <h3 className="section-title">{editingId ? 'Edit Purchase Order' : 'New Purchase Order'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">PO Date *</label>
                <input type="date" className="form-input" value={poForm.date}
                  onChange={e => setPoForm(prev => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Delivery Date</label>
                <input type="date" className="form-input" value={poForm.expectedDeliveryDate}
                  onChange={e => setPoForm(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier Name *</label>
                <input
                  type="text"
                  className="form-input"
                  list="po-suppliers-list"
                  value={poForm.supplierName}
                  onChange={e => {
                    const val = e.target.value;
                    const matched = savedSuppliers.find(s => s.name && s.name.toLowerCase() === val.toLowerCase());
                    setPoForm(prev => ({
                      ...prev,
                      supplierName: val,
                      ...(matched?.gstin ? { supplierGstin: matched.gstin } : {}),
                      ...(matched?.address ? { supplierAddress: matched.address } : {})
                    }));
                  }}
                  placeholder="Select or enter supplier"
                />
                <datalist id="po-suppliers-list">
                  {savedSuppliers.map(s => <option key={s.id || s.name} value={s.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Supplier GSTIN</label>
                <input type="text" className="form-input" value={poForm.supplierGstin}
                  onChange={e => setPoForm(prev => ({ ...prev, supplierGstin: e.target.value.toUpperCase() }))}
                  placeholder="15-digit GSTIN" maxLength={15} />
              </div>
              <div className="form-group">
                <label className="form-label">PO Number *</label>
                <input type="text" className="form-input" value={poForm.invoiceNumber}
                  onChange={e => setPoForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  placeholder="e.g. PO-2026-001" />
              </div>
              <div className="form-group">
                <label className="form-label">Order Status</label>
                <select className="form-input" value={poForm.orderStatus}
                  onChange={e => setPoForm(prev => ({ ...prev, orderStatus: e.target.value }))}>
                  {PO_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Terms / Notes</label>
                <input type="text" className="form-input" value={poForm.note}
                  onChange={e => setPoForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Delivery terms, payment milestones, etc." />
              </div>
            </div>

            {/* PO Line Items */}
            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Ordered Items</h4>
            {poForm.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 2, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Item Name</label>}
                  <input type="text" className="form-input" value={item.name}
                    onChange={e => {
                      const items = [...poForm.items];
                      items[idx].name = e.target.value;
                      setPoForm(prev => ({ ...prev, items }));
                    }} placeholder="Item name" />
                </div>
                <div className="form-group" style={{ flex: 0.8, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Qty</label>}
                  <input type="number" className="form-input" value={item.quantity} min="0" step="any"
                    onChange={e => {
                      const items = [...poForm.items];
                      items[idx].quantity = e.target.value;
                      setPoForm(prev => ({ ...prev, items }));
                    }} />
                </div>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Estimated Rate</label>}
                  <input type="number" className="form-input" value={item.rate} min="0" step="any"
                    onChange={e => {
                      const items = [...poForm.items];
                      items[idx].rate = e.target.value;
                      setPoForm(prev => ({ ...prev, items }));
                    }} />
                </div>
                <div className="form-group" style={{ flex: 0.8, margin: 0 }}>
                  {idx === 0 && <label className="form-label">GST %</label>}
                  <select className="form-input" value={String(item.taxPercent)}
                    onChange={e => {
                      const items = [...poForm.items];
                      items[idx].taxPercent = e.target.value;
                      setPoForm(prev => ({ ...prev, items }));
                    }}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  {poForm.items.length > 1 && (
                    <button className="icon-btn icon-btn-red" onClick={() => {
                      setPoForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
                    }}><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}
              onClick={() => {
                setPoForm(prev => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
              }}><Plus size={14} /> Add Item</button>

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.85rem', display: 'flex', gap: '1.5rem', justifyContent: 'flex-end' }}>
              <span>Taxable: <strong>{formatCurrency(poFormTotals.taxable)}</strong></span>
              <span>Tax: <strong>{formatCurrency(poFormTotals.tax)}</strong></span>
              <span>Total PO Value: <strong style={{ color: '#2563eb', fontSize: '1rem' }}>{formatCurrency(poFormTotals.finalTotal)}</strong></span>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setShowPoForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePo}><Save size={16} /> {editingId ? 'Update PO' : 'Save Purchase Order'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PURCHASE RETURN / DEBIT NOTE                             */}
      {/* ========================================================================= */}
      {showReturnForm && (
        <div className="modal-overlay" onClick={() => setShowReturnForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <h3 className="section-title">{editingId ? 'Edit Debit Note' : 'New Purchase Return / Debit Note'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Return Date *</label>
                <input type="date" className="form-input" value={returnForm.date}
                  onChange={e => setReturnForm(prev => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Debit Note Number *</label>
                <input type="text" className="form-input" value={returnForm.invoiceNumber}
                  onChange={e => setReturnForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  placeholder="e.g. DN-2026-001" />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier Name *</label>
                <input
                  type="text"
                  className="form-input"
                  list="ret-suppliers-list"
                  value={returnForm.supplierName}
                  onChange={e => {
                    const val = e.target.value;
                    const matched = savedSuppliers.find(s => s.name && s.name.toLowerCase() === val.toLowerCase());
                    setReturnForm(prev => ({
                      ...prev,
                      supplierName: val,
                      ...(matched?.gstin ? { supplierGstin: matched.gstin } : {}),
                      ...(matched?.address ? { supplierAddress: matched.address } : {})
                    }));
                  }}
                  placeholder="Select or enter supplier"
                />
                <datalist id="ret-suppliers-list">
                  {savedSuppliers.map(s => <option key={s.id || s.name} value={s.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Original Bill Reference</label>
                <input type="text" className="form-input" value={returnForm.originalBillNo}
                  onChange={e => setReturnForm(prev => ({ ...prev, originalBillNo: e.target.value }))}
                  placeholder="e.g. BILL-9821" />
              </div>
              <div className="form-group">
                <label className="form-label">Return Reason</label>
                <select className="form-input" value={returnForm.returnReason}
                  onChange={e => setReturnForm(prev => ({ ...prev, returnReason: e.target.value }))}>
                  {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={returnForm.reverseStock}
                    onChange={e => setReturnForm(prev => ({ ...prev, reverseStock: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: '#dc2626' }}
                  />
                  <span><strong>Reverse Stock:</strong> Deduct returned items from inventory</span>
                </label>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Note / Remarks</label>
                <input type="text" className="form-input" value={returnForm.note}
                  onChange={e => setReturnForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Details of defects or vendor return authorization" />
              </div>
            </div>

            {/* Returned Items */}
            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Returned Items</h4>
            {returnForm.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 2, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Item Name</label>}
                  <input type="text" className="form-input" value={item.name}
                    onChange={e => {
                      const items = [...returnForm.items];
                      items[idx].name = e.target.value;
                      setReturnForm(prev => ({ ...prev, items }));
                    }} placeholder="Item name" />
                </div>
                <div className="form-group" style={{ flex: 0.8, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Qty Returned</label>}
                  <input type="number" className="form-input" value={item.quantity} min="0" step="any"
                    onChange={e => {
                      const items = [...returnForm.items];
                      items[idx].quantity = e.target.value;
                      setReturnForm(prev => ({ ...prev, items }));
                    }} />
                </div>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  {idx === 0 && <label className="form-label">Rate</label>}
                  <input type="number" className="form-input" value={item.rate} min="0" step="any"
                    onChange={e => {
                      const items = [...returnForm.items];
                      items[idx].rate = e.target.value;
                      setReturnForm(prev => ({ ...prev, items }));
                    }} />
                </div>
                <div className="form-group" style={{ flex: 0.8, margin: 0 }}>
                  {idx === 0 && <label className="form-label">GST %</label>}
                  <select className="form-input" value={String(item.taxPercent)}
                    onChange={e => {
                      const items = [...returnForm.items];
                      items[idx].taxPercent = e.target.value;
                      setReturnForm(prev => ({ ...prev, items }));
                    }}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  {returnForm.items.length > 1 && (
                    <button className="icon-btn icon-btn-red" onClick={() => {
                      setReturnForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
                    }}><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}
              onClick={() => {
                setReturnForm(prev => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
              }}><Plus size={14} /> Add Item</button>

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.85rem', display: 'flex', gap: '1.5rem', justifyContent: 'flex-end' }}>
              <span>Taxable Return: <strong>{formatCurrency(returnFormTotals.taxable)}</strong></span>
              <span>Reversed GST: <strong>{formatCurrency(returnFormTotals.tax)}</strong></span>
              <span>Total Debit Value: <strong style={{ color: '#dc2626', fontSize: '1rem' }}>{formatCurrency(returnFormTotals.finalTotal)}</strong></span>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setShowReturnForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveReturn} style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                <Save size={16} /> {editingId ? 'Update Debit Note' : 'Save Debit Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW PURCHASE BILL (NO DOWNLOAD)                                  */}
      {/* ========================================================================= */}
      {viewPurchase && (() => {
        const p = viewPurchase;
        const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
        return (
          <div className="modal-overlay" onClick={() => setViewPurchase(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Purchase Bill · {p.invoiceNumber || '—'}</h3>
                <button className="icon-btn" onClick={() => setViewPurchase(null)} title="Close"><X size={18} /></button>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''} · {p.paymentStatus || 'Unpaid'} · {p.interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Supplier</div>
                <div style={{ fontWeight: 600 }}>{p.supplierName || '—'}</div>
                {p.supplierAddress && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.supplierAddress}</div>}
                {p.supplierGstin && <div style={{ fontSize: '0.82rem' }}>GSTIN: <strong>{p.supplierGstin}</strong></div>}
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '1rem' }}>
                <table className="data-table" style={{ fontSize: '0.82rem', width: '100%', minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>HSN</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>GST%</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(p.items || []).map((it, idx) => {
                      const line = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
                      const withTax = line * (1 + (Number(it.taxPercent) || 0) / 100);
                      return (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.name || '—'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{it.hsn || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{it.quantity || 0}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(it.rate || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{it.taxPercent || 0}%</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(withTax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.35rem 1rem', fontSize: '0.9rem', maxWidth: 320, marginLeft: 'auto' }}>
                <span style={{ color: 'var(--text-muted)' }}>Taxable</span>
                <span style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</span>
                <span style={{ color: 'var(--text-muted)' }}>Tax</span>
                <span style={{ textAlign: 'right' }}>{formatCurrency(t.tax)}</span>
                {t.cess > 0.005 && <><span style={{ color: 'var(--text-muted)' }}>Cess</span><span style={{ textAlign: 'right' }}>{formatCurrency(t.cess)}</span></>}
                {Math.abs(t.roundOff) > 0.005 && <><span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Round-off</span><span style={{ textAlign: 'right', fontStyle: 'italic' }}>{(t.roundOff > 0 ? '+' : '') + formatCurrency(t.roundOff)}</span></>}
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, fontWeight: 700 }}>TOTAL</span>
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{formatCurrency(t.finalTotal)}</span>
              </div>
              {p.note && <p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '1rem' }}>Note: {p.note}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary" onClick={() => setViewPurchase(null)}>Close</button>
                <button className="btn btn-secondary" onClick={() => { openEdit(p); setViewPurchase(null); }}><Edit3 size={14} /> Edit</button>
                <button className="btn btn-primary" onClick={() => viewAsPdf(p, 'PURCHASE BILL')}><Download size={14} /> Download PDF</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL: QUICK PAY FOR SINGLE BILL                                          */}
      {/* ========================================================================= */}
      {quickPayPurchase && (
        <div className="modal-overlay" onClick={() => setQuickPayPurchase(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>Record Bill Payment</h3>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                  Bill: <strong>{quickPayPurchase.invoiceNumber}</strong> • Supplier: <strong>{quickPayPurchase.supplierName}</strong>
                </div>
              </div>
              <button onClick={() => setQuickPayPurchase(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPay}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Amount Paid (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={quickPayForm.amount}
                  onChange={e => setQuickPayForm(prev => ({ ...prev, amount: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={quickPayForm.date}
                    onChange={e => setQuickPayForm(prev => ({ ...prev, date: e.target.value }))}
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Payment Mode
                  </label>
                  <select
                    value={quickPayForm.method}
                    onChange={e => setQuickPayForm(prev => ({ ...prev, method: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}>
                    <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                    <option value="UPI / QR">UPI / QR</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Reference No. (UTR / Cheque No.)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR8912384"
                  value={quickPayForm.reference}
                  onChange={e => setQuickPayForm(prev => ({ ...prev, reference: e.target.value }))}
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

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared via current account"
                  value={quickPayForm.notes}
                  onChange={e => setQuickPayForm(prev => ({ ...prev, notes: e.target.value }))}
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

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setQuickPayPurchase(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>
                  <Save size={16} /> Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OCR Modal */}
      {showOCR && (
        <Suspense fallback={<div className="modal-overlay"><div className="modal-content" style={{ maxWidth: 320, textAlign: 'center' }}>Loading OCR…</div></div>}>
          <BillOCR onClose={() => setShowOCR(false)} onExtracted={applyOCR} />
        </Suspense>
      )}

      {/* Quick Add Supplier Modal */}
      <SupplierModal
        show={showQuickSupplierModal}
        onClose={() => setShowQuickSupplierModal(false)}
        onSave={async (newSup) => {
          try {
            const saved = await saveSupplier(newSup);
            toast('Supplier saved successfully', 'success');
            setShowQuickSupplierModal(false);
            await loadSuppliers();
            if (saved?.name) {
              updateField('supplierName', saved.name);
              if (saved.gstin) updateField('supplierGstin', saved.gstin);
              if (saved.address || saved.city || saved.state) {
                const fullAddr = [saved.address, saved.city, saved.state, saved.pin].filter(Boolean).join(', ');
                updateField('supplierAddress', fullAddr);
              }
            }
          } catch {
            toast('Failed to save supplier', 'error');
          }
        }}
        isEditing={false}
      />
    </div>
  );
}
