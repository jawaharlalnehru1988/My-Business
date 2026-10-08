import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2, Search, Plus, Edit3, Trash2, Phone, Mail, MapPin, CreditCard,
  Download, Upload, ChevronDown, ChevronUp, FileText, CheckCircle2,
  ArrowDownLeft, ArrowUpRight, DollarSign, Send, MessageCircle, AlertCircle,
  Clock, X, Save, RefreshCw, Filter
} from 'lucide-react';
import HelpButton from './HelpButton';
import {
  getAllSuppliers, saveSupplier, deleteSupplier, getAllPurchases, savePurchase,
  getProfile
} from '../store';
import { formatCurrency } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { openWhatsAppShare } from '../utils/share';
import { confirmAction } from './ConfirmModal';
import { toast } from './Toast';
import SupplierModal from './SupplierModal';

// Helper to resolve user's accent color for jsPDF
function getAccentRGB() {
  try {
    const ps = getPrintSettings();
    if (ps.userColorsEnabled && ps.pdfAccent) {
      const hex = String(ps.pdfAccent).replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    }
  } catch { /* fall through to default */ }
  return [30, 64, 175];
}

const PAYMENT_MODES = ['Cash', 'Bank Transfer / NEFT', 'UPI / QR', 'Cheque'];

export default function SuppliersView({ onNewPurchase }) {
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [paymentOuts, setPaymentOuts] = useState([]);
  const [profile, setProfile] = useState({});
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'to_pay' | 'zero'
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  // Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [modalSupplier, setModalSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Payment-Out Form
  const [paymentForm, setPaymentForm] = useState({
    supplierName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'Bank Transfer / NEFT',
    referenceNo: '',
    linkedBillId: '__fifo__',
    notes: '',
  });

  const loadData = async () => {
    try {
      const [sData, pData, profData] = await Promise.all([
        getAllSuppliers().catch(() => []),
        getAllPurchases().catch(() => []),
        getProfile().catch(() => ({})),
      ]);

      const sups = Array.isArray(sData) ? sData : [];
      setSuppliers(sups);
      setPurchases(Array.isArray(pData) ? pData : []);
      if (profData) setProfile(profData);

      // Load persistent Payment-Out records
      const savedPayOuts = localStorage.getItem('vyapar_payment_outs');
      if (savedPayOuts) {
        try { setPaymentOuts(JSON.parse(savedPayOuts)); } catch { setPaymentOuts([]); }
      }

      // Default select first supplier if none selected
      if (sups.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(sups[0].id);
      }
    } catch (err) {
      console.error(err);
      toast('Failed to load supplier records', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Selected Active Supplier
  const activeSupplier = useMemo(() => {
    return suppliers.find(s => String(s.id) === String(selectedSupplierId)) || suppliers[0] || null;
  }, [suppliers, selectedSupplierId]);

  // Purchases for a specific supplier
  const getSupplierPurchases = (supplier) => {
    if (!supplier) return [];
    const sName = (supplier.name || '').trim().toLowerCase();
    const sGstin = (supplier.gstin || '').trim().toUpperCase();

    return purchases.filter(p => {
      if (sGstin && p.supplierGstin && p.supplierGstin.trim().toUpperCase() === sGstin) {
        return true;
      }
      return (p.supplierName || '').trim().toLowerCase() === sName;
    });
  };

  // Payment-Out records for a specific supplier
  const getSupplierPaymentOuts = (supplier) => {
    if (!supplier) return [];
    const sName = (supplier.name || '').trim().toLowerCase();
    const sId = String(supplier.id);

    return paymentOuts.filter(po => {
      return String(po.supplierId) === sId || (po.supplierName || '').trim().toLowerCase() === sName;
    });
  };

  // Supplier Financial Stats Calculation
  const getSupplierStats = (supplier) => {
    if (!supplier) return { totalPurchases: 0, paid: 0, pendingPayable: 0, billCount: 0 };
    const sPurchases = getSupplierPurchases(supplier);
    const sPayOuts = getSupplierPaymentOuts(supplier);

    let totalPurchases = 0;
    let paidFromBills = 0;
    let pendingPayable = 0;

    sPurchases.forEach(p => {
      const amt = Number(p.totalAmount) || 0;
      const paid = Number(p.paidAmount) || (p.paymentStatus === 'Paid' ? amt : 0);
      totalPurchases += amt;
      paidFromBills += paid;

      if (p.paymentStatus === 'Unpaid' || !p.paymentStatus) {
        pendingPayable += (amt - paid);
      } else if (p.paymentStatus === 'Partial') {
        pendingPayable += Math.max(0, amt - paid);
      }
    });

    // Also factor in ad-hoc Payment-Out records not yet mapped to bills
    const adHocPaid = sPayOuts.filter(po => po.linkedBillId === '__fifo__' || !po.linkedBillId)
      .reduce((sum, po) => sum + (Number(po.amount) || 0), 0);

    const netPayable = Math.max(0, pendingPayable - (adHocPaid > paidFromBills ? (adHocPaid - paidFromBills) : 0));

    return {
      totalPurchases,
      paid: paidFromBills,
      pendingPayable: netPayable,
      billCount: sPurchases.length
    };
  };

  // Top KPI Summary Bar
  const summaryKPI = useMemo(() => {
    let totalVendors = suppliers.length;
    let totalPurchases = 0;
    let totalPayables = 0;
    let toPayCount = 0;
    let zeroBalCount = 0;

    suppliers.forEach(s => {
      const stats = getSupplierStats(s);
      totalPurchases += stats.totalPurchases;
      totalPayables += stats.pendingPayable;

      if (stats.pendingPayable > 0.01) {
        toPayCount++;
      } else {
        zeroBalCount++;
      }
    });

    return {
      totalVendors,
      totalPurchases,
      totalPayables,
      toPayCount,
      zeroBalCount
    };
  }, [suppliers, purchases, paymentOuts]);

  // Filtered Suppliers List
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return suppliers.filter(s => {
      const matchesSearch = !q || (
        (s.name || '').toLowerCase().includes(q) ||
        (s.gstin || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.state || '').toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;

      const stats = getSupplierStats(s);
      if (filterTab === 'to_pay') return stats.pendingPayable > 0.01;
      if (filterTab === 'zero') return stats.pendingPayable <= 0.01;

      return true;
    });
  }, [suppliers, search, filterTab, purchases, paymentOuts]);

  // Chronological Dr / Cr Transactions Ledger for Active Supplier
  const activeLedgerTransactions = useMemo(() => {
    if (!activeSupplier) return [];
    const txns = [];
    const sPurchases = getSupplierPurchases(activeSupplier);
    const sPayOuts = getSupplierPaymentOuts(activeSupplier);

    // 1. Credit entries: Purchase Bills (increases amount we owe vendor)
    sPurchases.forEach(p => {
      const billAmt = Number(p.totalAmount) || 0;
      txns.push({
        id: `pur-${p.id || p.invoiceNumber}`,
        date: p.date || '',
        type: 'PURCHASE_BILL',
        typeLabel: 'Purchase Bill',
        refNo: p.invoiceNumber || 'PUR',
        debit: 0,
        credit: billAmt,
        notes: p.note || 'Vendor Invoice',
        status: p.paymentStatus || 'Unpaid'
      });

      // If bill has recorded payments directly in its payments array
      if (Array.isArray(p.payments) && p.payments.length > 0) {
        p.payments.forEach((pay, idx) => {
          txns.push({
            id: `pay-${p.id}-${idx}`,
            date: pay.date || p.date,
            type: 'PAYMENT_OUT',
            typeLabel: 'Payment-Out',
            refNo: `Against ${p.invoiceNumber}`,
            debit: Number(pay.amount) || 0,
            credit: 0,
            notes: pay.notes || pay.method || 'Vendor Payment',
            status: 'Settled'
          });
        });
      }
    });

    // 2. Debit entries: External Payment-Out vouchers (decreases amount we owe)
    sPayOuts.forEach(po => {
      txns.push({
        id: po.id,
        date: po.date || '',
        type: 'PAYMENT_OUT',
        typeLabel: 'Payment-Out',
        refNo: po.referenceNo ? `Ref: ${po.referenceNo}` : 'Payment Voucher',
        debit: Number(po.amount) || 0,
        credit: 0,
        notes: po.notes || `${po.paymentMode}`,
        status: 'Settled'
      });
    });

    // Sort chronologically ascending
    txns.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    // Calculate running balance (Credit - Debit = You'll Pay balance)
    let running = 0;
    return txns.map(t => {
      running += (t.credit - t.debit);
      return {
        ...t,
        runningBalance: running
      };
    });
  }, [activeSupplier, purchases, paymentOuts]);

  // Form Handlers
  const handleAddSupplier = () => {
    setModalSupplier(null);
    setIsEditing(false);
    setShowSupplierModal(true);
  };

  const handleEditSupplier = (supplier) => {
    setModalSupplier(supplier);
    setIsEditing(true);
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async (formData) => {
    try {
      const payload = isEditing && modalSupplier?.id ? { ...formData, id: modalSupplier.id } : formData;
      const saved = await saveSupplier(payload);
      toast(isEditing ? 'Supplier updated' : 'Supplier added', 'success');
      setShowSupplierModal(false);
      await loadData();
      if (saved?.id) setSelectedSupplierId(saved.id);
    } catch {
      toast('Failed to save supplier', 'error');
    }
  };

  const handleDeleteSupplier = async (id, name) => {
    const confirmed = await confirmAction({
      title: 'Delete Supplier',
      message: `Are you sure you want to delete "${name}"? Past purchase bills will remain in your records.`,
      confirmLabel: 'Delete Supplier',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await deleteSupplier(id);
      toast('Supplier removed', 'info');
      await loadData();
    } catch {
      toast('Failed to delete supplier', 'error');
    }
  };

  // Open Payment-Out Modal
  const openRecordPaymentOut = () => {
    if (!activeSupplier) return;
    const stats = getSupplierStats(activeSupplier);
    const sPurchases = getSupplierPurchases(activeSupplier).filter(p => p.paymentStatus !== 'Paid');

    setPaymentForm({
      supplierName: activeSupplier.name,
      amount: stats.pendingPayable > 0 ? String(stats.pendingPayable) : '',
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'Bank Transfer / NEFT',
      referenceNo: '',
      linkedBillId: sPurchases.length > 0 ? sPurchases[0].id : '__fifo__',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  // Save Recorded Payment-Out
  const handleSavePaymentOut = async (e) => {
    if (e) e.preventDefault();
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) {
      toast('Please enter a valid payment amount', 'warning');
      return;
    }

    try {
      // 1. Create Payment-Out record
      const payOutEntry = {
        id: `POUT-${Date.now()}`,
        supplierId: activeSupplier.id,
        supplierName: activeSupplier.name,
        amount: amt,
        date: paymentForm.date,
        paymentMode: paymentForm.paymentMode,
        referenceNo: paymentForm.referenceNo.trim(),
        linkedBillId: paymentForm.linkedBillId,
        notes: paymentForm.notes.trim(),
        createdAt: new Date().toISOString()
      };

      const updatedPayOuts = [payOutEntry, ...paymentOuts];
      setPaymentOuts(updatedPayOuts);
      localStorage.setItem('vyapar_payment_outs', JSON.stringify(updatedPayOuts));

      // 2. Auto-settle against unpaid purchase bills (FIFO or specific bill)
      const sPurchases = getSupplierPurchases(activeSupplier);
      let remaining = amt;

      if (paymentForm.linkedBillId && paymentForm.linkedBillId !== '__fifo__') {
        // Specific bill selected
        const targetBill = sPurchases.find(p => String(p.id) === String(paymentForm.linkedBillId));
        if (targetBill) {
          const currentPaid = Number(targetBill.paidAmount) || 0;
          const billTotal = Number(targetBill.totalAmount) || 0;
          const apply = Math.min(remaining, Math.max(0, billTotal - currentPaid));
          const newPaid = currentPaid + apply;
          const nextStatus = newPaid >= (billTotal - 0.01) ? 'Paid' : 'Partial';

          const newPayments = [...(targetBill.payments || []), {
            id: `pay-${Date.now()}`,
            date: paymentForm.date,
            amount: apply,
            method: paymentForm.paymentMode,
            notes: paymentForm.notes || `Payment-Out ${paymentForm.referenceNo}`
          }];

          await savePurchase({
            ...targetBill,
            paidAmount: newPaid,
            paymentStatus: nextStatus,
            payments: newPayments
          });
        }
      } else {
        // FIFO auto-allocation: sort oldest unpaid purchase bills first
        const unpaidBills = sPurchases
          .filter(p => p.paymentStatus !== 'Paid')
          .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

        for (const bill of unpaidBills) {
          if (remaining <= 0) break;
          const currentPaid = Number(bill.paidAmount) || 0;
          const billTotal = Number(bill.totalAmount) || 0;
          const due = Math.max(0, billTotal - currentPaid);
          if (due <= 0) continue;

          const apply = Math.min(remaining, due);
          const newPaid = currentPaid + apply;
          const nextStatus = newPaid >= (billTotal - 0.01) ? 'Paid' : 'Partial';

          const newPayments = [...(bill.payments || []), {
            id: `pay-${Date.now()}-${Math.random()}`,
            date: paymentForm.date,
            amount: apply,
            method: paymentForm.paymentMode,
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

      toast(`Payment of ${formatCurrency(amt)} recorded for ${activeSupplier.name}!`, 'success');
      setShowPaymentModal(false);
      await loadData();
    } catch (err) {
      console.error(err);
      toast('Failed to record Payment-Out', 'error');
    }
  };

  // WhatsApp Supplier Settlement Message
  const sendWhatsAppSettlement = (supplier) => {
    if (!supplier) return;
    const stats = getSupplierStats(supplier);
    const businessName = profile?.businessName || localStorage.getItem('businessName') || 'My Business';

    const text = [
      `*Payment / Ledger Notice from ${businessName}*`,
      ``,
      `Dear *${supplier.name}*,`,
      `Here is your ledger statement summary with us:`,
      `• *Total Purchases:* ${formatCurrency(stats.totalPurchases)}`,
      `• *Current Balance Due:* *${formatCurrency(stats.pendingPayable)}*`,
      ``,
      supplier.bankName ? `*Bank on Record:* ${supplier.bankName} (A/C: ${supplier.accountNumber || 'N/A'})\n` : '',
      `Please let us know if any invoice reconciliation is needed.`,
      ``,
      `Thank you!`,
      `— ${businessName}`
    ].filter(Boolean).join('\n');

    openWhatsAppShare(supplier.phone, text);
  };

  // Generate Indian Dr/Cr Ledger Statement PDF for Supplier
  const generateSupplierStatementPDF = async (supplier) => {
    if (!supplier) return;
    const sPurchases = getSupplierPurchases(supplier);
    if (sPurchases.length === 0) {
      toast('No purchase bills on file for this supplier', 'warning');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const stats = getSupplierStats(supplier);
      const pageW = 210, marginL = 15, marginR = 195, tableW = marginR - marginL;

      const fmt = (n) => {
        const v = Number(n) || 0;
        const abs = Math.abs(v);
        const rounded = abs.toFixed(2);
        const parts = rounded.split('.');
        const intPart = parts[0];
        const last3 = intPart.slice(-3);
        const rest = intPart.slice(0, -3);
        const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
        return (v < 0 ? '-' : '') + 'Rs. ' + grouped + '.' + parts[1];
      };

      // Header Band
      let y = 18;
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('SUPPLIER STATEMENT OF ACCOUNT', marginL, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(profile?.businessName || localStorage.getItem('businessName') || 'My Business', marginL, y); y += 4.5;
      if (profile?.address) { doc.text(profile.address, marginL, y); y += 4.5; }
      if (profile?.gstin) { doc.text(`GSTIN: ${profile.gstin}`, marginL, y); y += 4.5; }
      doc.setTextColor(0);

      // Supplier Info Box
      doc.text(`Statement Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, marginR, 18, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`Supplier: ${supplier.name}`, marginR, 24, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      if (supplier.phone) doc.text(`Phone: ${supplier.phone}`, marginR, 29, { align: 'right' });
      if (supplier.gstin) doc.text(`GSTIN: ${supplier.gstin}`, marginR, 34, { align: 'right' });

      y += 8;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.6);
      doc.line(marginL, y, marginR, y); y += 6;

      // Table Columns
      const col = {
        dateEnd: 38,
        particEnd: 105,
        debitEnd: 135,
        creditEnd: 165,
        balanceEnd: marginR - 2,
      };

      // Header row
      doc.setFillColor(...getAccentRGB());
      doc.rect(marginL, y, tableW, 8, 'F');
      doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      doc.text('Date', marginL + 2, y + 5.5);
      doc.text('Particulars / Ref', col.dateEnd + 2, y + 5.5);
      doc.text('Debit (Paid)', col.debitEnd, y + 5.5, { align: 'right' });
      doc.text('Credit (Bill)', col.creditEnd, y + 5.5, { align: 'right' });
      doc.text('Balance Owed', col.balanceEnd, y + 5.5, { align: 'right' });
      doc.setTextColor(0);
      y += 10;

      // Rows
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      activeLedgerTransactions.forEach((tx) => {
        if (y > 270) {
          doc.addPage();
          y = 18;
        }

        const dateStr = tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
        doc.text(dateStr, marginL + 2, y);
        doc.text(`${tx.typeLabel} (${tx.refNo})`, col.dateEnd + 2, y, { maxWidth: 65 });
        if (tx.debit > 0) doc.text(fmt(tx.debit), col.debitEnd, y, { align: 'right' });
        if (tx.credit > 0) doc.text(fmt(tx.credit), col.creditEnd, y, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(fmt(tx.runningBalance), col.balanceEnd, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        y += 6;
      });

      // Total Summary Box
      y += 4;
      doc.setDrawColor(200); doc.line(marginL, y, marginR, y); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text('Closing Payable Balance:', marginR - 70, y);
      doc.setTextColor(185, 28, 28);
      doc.text(fmt(stats.pendingPayable), marginR - 2, y, { align: 'right' });
      doc.setTextColor(0);

      doc.save(`Supplier_Statement_${supplier.name.replace(/\s+/g, '_')}.pdf`);
      toast('Supplier Statement PDF generated', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to generate PDF', 'error');
    }
  };

  // CSV Export
  const exportSuppliersCSV = () => {
    if (suppliers.length === 0) {
      toast('No suppliers to export', 'warning');
      return;
    }
    const headers = ['Name', 'GSTIN', 'Phone', 'Email', 'Address', 'City', 'State', 'Bank Name', 'Account No', 'IFSC', 'Total Purchases', 'You\'ll Pay'];
    const rows = suppliers.map(s => {
      const stats = getSupplierStats(s);
      return [
        s.name, s.gstin, s.phone, s.email, s.address, s.city, s.state,
        s.bankName, s.accountNumber, s.ifscCode,
        stats.totalPurchases, stats.pendingPayable
      ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `suppliers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Suppliers exported to CSV', 'success');
  };

  const activeStats = activeSupplier ? getSupplierStats(activeSupplier) : { totalPurchases: 0, pendingPayable: 0 };

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
      {/* 1. TOP KPI SUMMARY STRIP (Vyapar Style) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Total Vendors */}
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
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Suppliers / Vendors
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary, #111827)', lineHeight: 1.2 }}>
              {summaryKPI.totalVendors}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              {summaryKPI.toPayCount} with pending dues
            </div>
          </div>
        </div>

        {/* You'll Pay (Total Payables) */}
        <div style={{
          background: '#fff1f2',
          border: '1px solid #fecdd3',
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
            background: '#ffe4e6',
            color: '#e11d48',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ArrowDownLeft size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              You'll Pay (Total Payables)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#e11d48', lineHeight: 1.2 }}>
              {formatCurrency(summaryKPI.totalPayables)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#be123c', fontWeight: 500, marginTop: '2px' }}>
              Money owed to suppliers
            </div>
          </div>
        </div>

        {/* Total Purchases */}
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
            <CreditCard size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Purchases Amount
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
              {formatCurrency(summaryKPI.totalPurchases)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Lifetime procurement value
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTROLS & FILTER TOOLBAR */}
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
        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Suppliers (${suppliers.length})` },
            { id: 'to_pay', label: `To Pay (${summaryKPI.toPayCount})`, alert: summaryKPI.toPayCount > 0 },
            { id: 'zero', label: `Zero Balance (${summaryKPI.zeroBalCount})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: filterTab === tab.id 
                  ? '#2563eb' 
                  : (tab.alert ? '#ffe4e6' : 'var(--bg-secondary, #f3f4f6)'),
                color: filterTab === tab.id 
                  ? '#ffffff' 
                  : (tab.alert ? '#e11d48' : 'var(--text-secondary, #4b5563)'),
                transition: 'all 0.15s ease'
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={exportSuppliersCSV}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}>
            <Download size={15} /> Export CSV
          </button>

          {onNewPurchase && (
            <button
              onClick={onNewPurchase}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}>
              <Plus size={15} /> + Add Purchase Bill
            </button>
          )}

          <button
            onClick={handleAddSupplier}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: '#2563eb'
            }}>
            <Plus size={16} /> + Add New Supplier
          </button>
        </div>
      </div>

      {/* 3. MASTER-DETAIL 2-COLUMN SPLIT LAYOUT */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gap: '1rem',
        flex: 1,
        minHeight: '520px',
        alignItems: 'stretch'
      }}>
        
        {/* LEFT COLUMN: Searchable Suppliers List */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Search Box */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search by name, GSTIN, phone..."
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
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.4rem', paddingLeft: '2px' }}>
              Showing {filteredSuppliers.length} suppliers
            </div>
          </div>

          {/* Supplier Cards List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredSuppliers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary, #6b7280)' }}>
                <Building2 size={36} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No suppliers found</div>
                <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Try clearing filters or add a new supplier</div>
              </div>
            ) : (
              filteredSuppliers.map(supplier => {
                const isSelected = activeSupplier && String(activeSupplier.id) === String(supplier.id);
                const stats = getSupplierStats(supplier);
                const hasPending = stats.pendingPayable > 0.01;

                return (
                  <div
                    key={supplier.id}
                    onClick={() => setSelectedSupplierId(supplier.id)}
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
                        {supplier.name}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: hasPending ? '#e11d48' : '#059669', flexShrink: 0 }}>
                        {hasPending ? formatCurrency(stats.pendingPayable) : '₹ 0.00'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {supplier.phone && <span>{supplier.phone}</span>}
                        {supplier.city && <span>• {supplier.city}</span>}
                      </div>
                      <div>
                        {hasPending ? (
                          <span style={{ background: '#ffe4e6', color: '#be123c', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                            You'll Pay
                          </span>
                        ) : (
                          <span style={{ background: '#ecfdf5', color: '#047857', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                            Settled
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

        {/* RIGHT COLUMN: Active Supplier Dashboard & Dr/Cr Ledger */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {!activeSupplier ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '3rem', color: 'var(--text-secondary, #6b7280)' }}>
              <Building2 size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Select a supplier to view account ledger</div>
              <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>Choose from the left list or create a new supplier profile</div>
              <button onClick={handleAddSupplier} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                <Plus size={16} /> Add Supplier
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Supplier Header & Action Toolbar */}
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
                      {activeSupplier.name}
                    </h2>
                    {activeSupplier.gstin && (
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        GSTIN: {activeSupplier.gstin}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)', flexWrap: 'wrap' }}>
                    {activeSupplier.phone && <span><strong>Phone:</strong> {activeSupplier.phone}</span>}
                    {activeSupplier.email && <span><strong>Email:</strong> {activeSupplier.email}</span>}
                    {activeSupplier.city && <span><strong>City:</strong> {activeSupplier.city}, {activeSupplier.state || ''}</span>}
                    {activeSupplier.bankName && (
                      <span style={{ color: '#047857', fontWeight: 500 }}>
                        🏦 {activeSupplier.bankName} (A/C: {activeSupplier.accountNumber || 'N/A'}, IFSC: {activeSupplier.ifscCode || 'N/A'})
                      </span>
                    )}
                  </div>
                </div>

                {/* Vyapar Actions for Active Supplier */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={openRecordPaymentOut}
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
                    title="Record money paid to this vendor">
                    <ArrowDownLeft size={16} /> + Record Payment-Out
                  </button>

                  {onNewPurchase && (
                    <button
                      onClick={onNewPurchase}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}
                      title="Add a purchase bill for this vendor">
                      <Plus size={15} /> + Add Bill
                    </button>
                  )}

                  <button
                    onClick={() => generateSupplierStatementPDF(activeSupplier)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}
                    title="Download Statement of Accounts PDF">
                    <FileText size={15} /> Statement PDF
                  </button>

                  <button
                    onClick={() => sendWhatsAppSettlement(activeSupplier)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem', color: '#15803d' }}
                    title="Send ledger balance message via WhatsApp">
                    <MessageCircle size={15} /> WhatsApp
                  </button>

                  <button
                    onClick={() => handleEditSupplier(activeSupplier)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}
                    title="Edit Supplier profile">
                    <Edit3 size={15} /> Edit
                  </button>

                  <button
                    onClick={() => handleDeleteSupplier(activeSupplier.id, activeSupplier.name)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.8rem', fontSize: '0.82rem', color: '#dc2626' }}
                    title="Delete Supplier">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Net Balance & Metrics Bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border-color, #e5e7eb)',
                background: '#ffffff'
              }}>
                {/* Outstanding Payable */}
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `1px solid ${activeStats.pendingPayable > 0.01 ? '#fecdd3' : '#e5e7eb'}`,
                  background: activeStats.pendingPayable > 0.01 ? '#fff1f2' : '#fafafa'
                }}>
                  <div style={{ fontSize: '0.72rem', color: activeStats.pendingPayable > 0.01 ? '#9f1239' : '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
                    You'll Pay (Balance Due)
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: activeStats.pendingPayable > 0.01 ? '#e11d48' : '#059669', marginTop: '2px' }}>
                    {formatCurrency(activeStats.pendingPayable)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                    {activeStats.pendingPayable > 0.01 ? 'Pending vendor payment' : 'Account is fully settled'}
                  </div>
                </div>

                {/* Total Purchases */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total Purchases
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', marginTop: '2px' }}>
                    {formatCurrency(activeStats.totalPurchases)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                    Across {activeStats.billCount} purchase bill{activeStats.billCount !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Total Amount Paid */}
                <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total Paid Out
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                    {formatCurrency(activeStats.paid)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                    Cleared payments to date
                  </div>
                </div>
              </div>

              {/* Supplier Transactions & Dr / Cr Ledger Table */}
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
                    <CreditCard size={16} style={{ color: '#2563eb' }} />
                    Transactions & Dr / Cr Ledger
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)' }}>
                    Total entries: {activeLedgerTransactions.length}
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {activeLedgerTransactions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary, #6b7280)' }}>
                      <FileText size={40} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>No transactions recorded for this supplier</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Record your first purchase bill or payment-out voucher to start tracking this ledger.
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                        {onNewPurchase && (
                          <button onClick={onNewPurchase} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
                            <Plus size={14} /> + Record Purchase Bill
                          </button>
                        )}
                        <button onClick={openRecordPaymentOut} className="btn btn-primary" style={{ fontSize: '0.82rem', background: '#059669', borderColor: '#059669' }}>
                          <ArrowDownLeft size={14} /> + Record Payment-Out
                        </button>
                      </div>
                    </div>
                  ) : (
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                          <th style={{ padding: '0.65rem 1rem' }}>Type</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Date</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Ref / Bill No.</th>
                          <th style={{ padding: '0.65rem 1rem' }}>Notes / Mode</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Debit (Paid ₹)</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Credit (Bill ₹)</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Balance Due (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeLedgerTransactions.map((tx) => {
                          const isPayment = tx.debit > 0;
                          return (
                            <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: isPayment ? '#ecfdf5' : '#fff1f2',
                                  color: isPayment ? '#047857' : '#be123c'
                                }}>
                                  {isPayment ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                                  {tx.typeLabel}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>
                                {tx.date ? new Date(tx.date).toLocaleDateString('en-IN') : '—'}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>
                                {tx.refNo}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>
                                {tx.notes}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                {tx.debit > 0 ? formatCurrency(tx.debit) : '—'}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>
                                {tx.credit > 0 ? formatCurrency(tx.credit) : '—'}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: tx.runningBalance > 0.01 ? '#e11d48' : '#059669' }}>
                                {formatCurrency(tx.runningBalance)}
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

      {/* 4. MODAL: RECORD PAYMENT-OUT (Vyapar Signature Feature) */}
      {showPaymentModal && activeSupplier && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                  Record Payment-Out
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '2px' }}>
                  Vendor: <strong>{activeSupplier.name}</strong> • Current Due: <strong style={{ color: '#e11d48' }}>{formatCurrency(activeStats.pendingPayable)}</strong>
                </div>
              </div>
              <button onClick={() => setShowPaymentModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePaymentOut}>
              {/* Amount to Pay */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Amount Paid (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
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
                  {activeStats.pendingPayable > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentForm(prev => ({ ...prev, amount: String(activeStats.pendingPayable) }))}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}>
                      Full Due
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Date & Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
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
                    value={paymentForm.paymentMode}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      boxSizing: 'border-box'
                    }}>
                    {PAYMENT_MODES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference / UTR Number */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Reference No. (UTR / Cheque No. / Transaction ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR1928301928"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNo: e.target.value }))}
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

              {/* Link against Bill / Allocation */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Bill Allocation
                </label>
                <select
                  value={paymentForm.linkedBillId}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, linkedBillId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}>
                  <option value="__fifo__">FIFO (Auto-clear oldest unpaid purchase bills)</option>
                  {getSupplierPurchases(activeSupplier).filter(p => p.paymentStatus !== 'Paid').map(p => {
                    const due = Math.max(0, (Number(p.totalAmount) || 0) - (Number(p.paidAmount) || 0));
                    return (
                      <option key={p.id} value={p.id}>
                        {p.invoiceNumber} ({p.date}) — Due: {formatCurrency(due)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared via HDFC Current Account"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
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

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
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

      {/* 5. MODAL: ADD / EDIT SUPPLIER */}
      {showSupplierModal && (
        <SupplierModal
          supplier={modalSupplier}
          isEditing={isEditing}
          onSave={handleSaveSupplier}
          onClose={() => setShowSupplierModal(false)}
        />
      )}

    </div>
  );
}
