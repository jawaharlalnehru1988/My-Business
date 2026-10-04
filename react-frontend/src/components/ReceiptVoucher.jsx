import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Building2, Receipt, Plus, Trash2, Search, Printer, Pencil, ArrowDownLeft,
  ArrowUpRight, Wallet, Calendar, Download, RefreshCw, X, Save, Edit3,
  CreditCard, CheckCircle2, ChevronRight, DollarSign, Layers, Filter, Clock
} from 'lucide-react';
import {
  getAllReceipts, saveReceipt, deleteReceipt, getAllBills, getProfile,
  getNextInvoiceNumber, saveBill, getAllPurchases, getAllExpenses, saveProfile
} from '../store';
import { formatCurrency, numberToWords, getCountryConfig } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

// Accent helper for PDF exports
function getAccentRGB() {
  try {
    const ps = getPrintSettings();
    if (ps.userColorsEnabled && ps.pdfAccent) {
      const hex = String(ps.pdfAccent).replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    }
  } catch { /* default */ }
  return [30, 64, 175];
}

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'];

const emptyReceiptForm = {
  date: new Date().toISOString().split('T')[0],
  receiptNo: '',
  clientName: '',
  clientAddress: '',
  amount: '',
  paymentMode: 'Bank Transfer',
  referenceNo: '',
  againstInvoice: '',
  note: '',
};

const emptyAccountForm = {
  label: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  branch: '',
  upiId: '',
  openingBalance: '0',
  notes: '',
};

export default function ReceiptVoucher({ autoOpenNew }) {
  // Navigation Tabs: 'daybook' | 'banks' | 'cash' | 'receipts'
  const [activeTab, setActiveTab] = useState('daybook');

  // Core Data
  const [receipts, setReceipts] = useState([]);
  const [bills, setBills] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [paymentOuts, setPaymentOuts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);

  // Daybook Date Filter
  const [daybookDate, setDaybookDate] = useState(new Date().toISOString().split('T')[0]);

  // Receipts View States
  const [receiptSearch, setReceiptSearch] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ ...emptyReceiptForm });
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const receiptRef = useRef(null);

  // Bank Accounts States
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ ...emptyAccountForm });
  const [editingAccountId, setEditingAccountId] = useState(null);

  // Contra Transfer Modal States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    type: 'CASH_TO_BANK', // 'CASH_TO_BANK' | 'BANK_TO_CASH' | 'BANK_TO_BANK'
    fromAccount: 'cash',
    toAccount: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    notes: '',
  });

  const profileCurrency = getCountryConfig(profile?.country || 'India').currency;

  const loadData = async () => {
    setLoading(true);
    try {
      const [recs, bls, purs, exps, prof] = await Promise.all([
        getAllReceipts().catch(() => []),
        getAllBills().catch(() => []),
        getAllPurchases().catch(() => []),
        getAllExpenses().catch(() => []),
        getProfile().catch(() => ({})),
      ]);

      setReceipts(Array.isArray(recs) ? recs : []);
      setBills(Array.isArray(bls) ? bls : []);
      setPurchases(Array.isArray(purs) ? purs : []);
      setExpenses(Array.isArray(exps) ? exps : []);
      if (prof) setProfile(prof);

      // Load persistent Payment-Outs
      const savedPayOuts = localStorage.getItem('vyapar_payment_outs');
      if (savedPayOuts) {
        try { setPaymentOuts(JSON.parse(savedPayOuts)); } catch { setPaymentOuts([]); }
      }

      // Load persistent Contra Transfers
      const savedTransfers = localStorage.getItem('vyapar_contra_transfers');
      if (savedTransfers) {
        try { setTransfers(JSON.parse(savedTransfers)); } catch { setTransfers([]); }
      }
    } catch {
      toast('Failed to load Cash & Bank data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (autoOpenNew) {
      openAddReceipt();
    }
  }, [autoOpenNew]);

  // Bank Accounts List from Profile (with defaults if empty)
  const bankAccounts = useMemo(() => {
    const list = Array.isArray(profile?.paymentAccounts) ? profile.paymentAccounts : [];
    if (list.length > 0) return list;

    // Default accounts for demonstration if none configured
    return [
      {
        id: 'acc-hdfc-01',
        label: 'HDFC Business Account',
        bankName: 'HDFC Bank',
        accountNumber: '50200019283011',
        ifsc: 'HDFC0001234',
        branch: 'Main Commercial Branch',
        upiId: profile?.upiId || 'business@hdfcbank',
        openingBalance: 250000,
      },
      {
        id: 'acc-sbi-02',
        label: 'SBI Current Account',
        bankName: 'State Bank of India',
        accountNumber: '38192039102',
        ifsc: 'SBIN0004567',
        branch: 'City Plaza Branch',
        upiId: '',
        openingBalance: 120000,
      }
    ];
  }, [profile]);

  // Compute Live Balances (Cash in Hand & Bank Balances)
  const financialTotals = useMemo(() => {
    let cashInHand = 50000; // default initial cash register opening
    let totalBank = 0;

    // Sum initial bank opening balances
    bankAccounts.forEach(acc => {
      totalBank += Number(acc.openingBalance) || 0;
    });

    // 1. Inflows from Bills
    bills.forEach(b => {
      if (b.type === 'proforma') return;
      const amt = Number(b.paidAmount) || 0;
      const mode = (b.paymentMode || b.payments?.[0]?.mode || '').toLowerCase();
      if (mode.includes('cash')) {
        cashInHand += amt;
      } else {
        totalBank += amt;
      }
    });

    // 2. Inflows from standalone Receipts (not tied to bill or extra)
    receipts.forEach(r => {
      if (!r.againstInvoice) {
        const amt = Number(r.amount) || 0;
        const mode = (r.paymentMode || '').toLowerCase();
        if (mode.includes('cash')) {
          cashInHand += amt;
        } else {
          totalBank += amt;
        }
      }
    });

    // 3. Outflows from Purchases
    purchases.forEach(p => {
      const paid = Number(p.paidAmount) || (p.paymentStatus === 'Paid' ? Number(p.totalAmount) : 0);
      const mode = (p.payments?.[0]?.method || '').toLowerCase();
      if (mode.includes('cash')) {
        cashInHand -= paid;
      } else {
        totalBank -= paid;
      }
    });

    // 4. Outflows from standalone Payment-Outs
    paymentOuts.forEach(po => {
      const amt = Number(po.amount) || 0;
      const mode = (po.paymentMode || '').toLowerCase();
      if (mode.includes('cash')) {
        cashInHand -= amt;
      } else {
        totalBank -= amt;
      }
    });

    // 5. Outflows from Expenses
    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      const mode = (e.paymentMode || '').toLowerCase();
      if (mode.includes('cash')) {
        cashInHand -= amt;
      } else {
        totalBank -= amt;
      }
    });

    // 6. Contra Transfers
    transfers.forEach(ct => {
      const amt = Number(ct.amount) || 0;
      if (ct.type === 'CASH_TO_BANK') {
        cashInHand -= amt;
        totalBank += amt;
      } else if (ct.type === 'BANK_TO_CASH') {
        cashInHand += amt;
        totalBank -= amt;
      }
    });

    return {
      cashInHand,
      totalBank,
      totalLiquid: cashInHand + totalBank
    };
  }, [bills, receipts, purchases, paymentOuts, expenses, transfers, bankAccounts]);

  // Daily Daybook Transactions for the Selected Date
  const daybookTransactions = useMemo(() => {
    const list = [];
    const targetDate = daybookDate;

    // 1. Sales Invoices on targetDate
    bills.forEach(b => {
      if (b.type === 'proforma') return;
      const bDate = b.invoiceDate || b.date;
      if (bDate === targetDate) {
        const paid = Number(b.paidAmount) || (b.status === 'paid' ? Number(b.totalAmount) : 0);
        const mode = b.paymentMode || b.payments?.[0]?.mode || 'Cash';
        const isCash = mode.toLowerCase().includes('cash');

        list.push({
          id: `sale-${b.id || b.invoiceNumber}`,
          time: 'Day Sale',
          type: 'SALE',
          typeLabel: 'Sale Invoice',
          refNo: b.invoiceNumber || 'INV',
          particulars: b.clientName || 'Walk-in Customer',
          mode: mode,
          inflow: paid,
          outflow: 0,
          isCash: isCash,
          totalBill: Number(b.totalAmount) || 0
        });
      }
    });

    // 2. Standalone Receipts on targetDate
    receipts.forEach(r => {
      if (r.date === targetDate && !r.againstInvoice) {
        const amt = Number(r.amount) || 0;
        const isCash = (r.paymentMode || '').toLowerCase().includes('cash');

        list.push({
          id: `rcp-${r.id || r.receiptNo}`,
          time: 'Payment-In',
          type: 'RECEIPT',
          typeLabel: 'Customer Receipt',
          refNo: r.receiptNo || 'RCP',
          particulars: r.clientName || 'Client',
          mode: r.paymentMode || 'Bank Transfer',
          inflow: amt,
          outflow: 0,
          isCash: isCash
        });
      }
    });

    // 3. Purchases on targetDate
    purchases.forEach(p => {
      if (p.date === targetDate) {
        const paid = Number(p.paidAmount) || (p.paymentStatus === 'Paid' ? Number(p.totalAmount) : 0);
        const mode = p.payments?.[0]?.method || 'Bank Transfer';
        const isCash = mode.toLowerCase().includes('cash');

        list.push({
          id: `pur-${p.id || p.invoiceNumber}`,
          time: 'Purchase',
          type: 'PURCHASE',
          typeLabel: 'Purchase Bill',
          refNo: p.invoiceNumber || 'PUR',
          particulars: p.supplierName || 'Vendor',
          mode: mode,
          inflow: 0,
          outflow: paid,
          isCash: isCash
        });
      }
    });

    // 4. Payment-Outs on targetDate
    paymentOuts.forEach(po => {
      if (po.date === targetDate) {
        const amt = Number(po.amount) || 0;
        const isCash = (po.paymentMode || '').toLowerCase().includes('cash');

        list.push({
          id: po.id,
          time: 'Payment-Out',
          type: 'PAYMENT_OUT',
          typeLabel: 'Vendor Payment',
          refNo: po.referenceNo || 'Payment Voucher',
          particulars: po.supplierName || 'Supplier',
          mode: po.paymentMode || 'Bank Transfer',
          inflow: 0,
          outflow: amt,
          isCash: isCash
        });
      }
    });

    // 5. Expenses on targetDate
    expenses.forEach(e => {
      if (e.date === targetDate) {
        const amt = Number(e.amount) || 0;
        const isCash = (e.paymentMode || '').toLowerCase().includes('cash');

        list.push({
          id: `exp-${e.id}`,
          time: 'Expense',
          type: 'EXPENSE',
          typeLabel: 'Direct Expense',
          refNo: e.category || 'Expense',
          particulars: e.description || e.name || e.category || 'Business Expense',
          mode: e.paymentMode || 'Cash',
          inflow: 0,
          outflow: amt,
          isCash: isCash
        });
      }
    });

    // 6. Contra Transfers on targetDate
    transfers.forEach(ct => {
      if (ct.date === targetDate) {
        const amt = Number(ct.amount) || 0;
        const isDeposit = ct.type === 'CASH_TO_BANK';
        const isWithdrawal = ct.type === 'BANK_TO_CASH';

        list.push({
          id: ct.id,
          time: 'Transfer',
          type: 'CONTRA',
          typeLabel: isDeposit ? 'Cash Deposit' : (isWithdrawal ? 'Cash Withdrawal' : 'Bank Transfer'),
          refNo: ct.referenceNo || 'Contra',
          particulars: ct.notes || (isDeposit ? 'Deposit to Bank' : 'Withdrawal to Register'),
          mode: 'Contra',
          inflow: isWithdrawal ? amt : 0,
          outflow: isDeposit ? amt : 0,
          isCash: true
        });
      }
    });

    return list;
  }, [daybookDate, bills, receipts, purchases, paymentOuts, expenses, transfers]);

  // Daybook Summary Metrics for Selected Date
  const daybookSummary = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;
    let cashIn = 0;
    let cashOut = 0;

    daybookTransactions.forEach(tx => {
      moneyIn += tx.inflow;
      moneyOut += tx.outflow;
      if (tx.isCash) {
        cashIn += tx.inflow;
        cashOut += tx.outflow;
      }
    });

    return {
      moneyIn,
      moneyOut,
      netMovement: moneyIn - moneyOut,
      cashIn,
      cashOut,
      netCash: cashIn - cashOut,
      totalEntries: daybookTransactions.length
    };
  }, [daybookTransactions]);

  // Day Navigation
  const shiftDay = (days) => {
    const d = new Date(daybookDate);
    d.setDate(d.getDate() + days);
    setDaybookDate(d.toISOString().split('T')[0]);
  };

  // Contra Transfer Handlers
  const openTransferModal = () => {
    setTransferForm({
      type: 'CASH_TO_BANK',
      fromAccount: 'cash',
      toAccount: bankAccounts[0]?.id || '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      referenceNo: '',
      notes: '',
    });
    setShowTransferModal(true);
  };

  const handleSaveTransfer = (e) => {
    if (e) e.preventDefault();
    const amt = parseFloat(transferForm.amount);
    if (!amt || amt <= 0) {
      toast('Please enter a valid transfer amount', 'warning');
      return;
    }

    try {
      const newEntry = {
        id: `CT-${Date.now()}`,
        type: transferForm.type,
        fromAccount: transferForm.fromAccount,
        toAccount: transferForm.toAccount,
        amount: amt,
        date: transferForm.date,
        referenceNo: transferForm.referenceNo.trim(),
        notes: transferForm.notes.trim(),
        createdAt: new Date().toISOString()
      };

      const updated = [newEntry, ...transfers];
      setTransfers(updated);
      localStorage.setItem('vyapar_contra_transfers', JSON.stringify(updated));

      toast(`Transfer of ${formatCurrency(amt, profileCurrency)} recorded successfully!`, 'success');
      setShowTransferModal(false);
    } catch {
      toast('Failed to record transfer', 'error');
    }
  };

  // Bank Account Add / Edit Handlers
  const openAddAccount = () => {
    setAccountForm({ ...emptyAccountForm });
    setEditingAccountId(null);
    setShowAccountModal(true);
  };

  const openEditAccount = (acc) => {
    setAccountForm({
      label: acc.label || '',
      bankName: acc.bankName || '',
      accountNumber: acc.accountNumber || '',
      ifsc: acc.ifsc || '',
      branch: acc.branch || '',
      upiId: acc.upiId || '',
      openingBalance: String(acc.openingBalance ?? '0'),
      notes: acc.notes || '',
    });
    setEditingAccountId(acc.id);
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e) => {
    if (e) e.preventDefault();
    if (!accountForm.label.trim() || !accountForm.bankName.trim()) {
      toast('Account Label and Bank Name are required', 'warning');
      return;
    }

    try {
      const newAcc = {
        id: editingAccountId || `acc-${Date.now()}`,
        label: accountForm.label.trim(),
        bankName: accountForm.bankName.trim(),
        accountNumber: accountForm.accountNumber.trim(),
        ifsc: accountForm.ifsc.trim(),
        branch: accountForm.branch.trim(),
        upiId: accountForm.upiId.trim(),
        openingBalance: parseFloat(accountForm.openingBalance) || 0,
        notes: accountForm.notes.trim()
      };

      let existing = Array.isArray(profile.paymentAccounts) ? [...profile.paymentAccounts] : [...bankAccounts];
      if (editingAccountId) {
        existing = existing.map(a => a.id === editingAccountId ? newAcc : a);
      } else {
        existing.push(newAcc);
      }

      const updatedProfile = { ...profile, paymentAccounts: existing };
      await saveProfile(updatedProfile);
      setProfile(updatedProfile);

      toast(editingAccountId ? 'Bank account updated' : 'Bank account added', 'success');
      setShowAccountModal(false);
    } catch {
      toast('Failed to save bank account', 'error');
    }
  };

  const handleDeleteAccount = async (accId, label) => {
    if (await confirmAction({
      title: 'Remove Bank Account?',
      message: `Are you sure you want to remove "${label}"? Historical transactions will be retained.`,
      confirmLabel: 'Remove Account',
      tone: 'danger'
    })) {
      try {
        const existing = (profile.paymentAccounts || bankAccounts).filter(a => a.id !== accId);
        const updatedProfile = { ...profile, paymentAccounts: existing };
        await saveProfile(updatedProfile);
        setProfile(updatedProfile);
        toast('Bank account removed', 'info');
      } catch {
        toast('Failed to delete account', 'error');
      }
    }
  };

  // Receipt Voucher Actions (from legacy ReceiptVoucher)
  const openAddReceipt = async () => {
    let receiptNo = '';
    try {
      receiptNo = await getNextInvoiceNumber('RCP', { peek: true });
    } catch {
      receiptNo = `RCP-${Date.now()}`;
    }
    setReceiptForm({ ...emptyReceiptForm, receiptNo });
    setEditingReceiptId(null);
    setShowReceiptModal(true);
  };

  const openEditReceipt = (rcp) => {
    setReceiptForm({
      date: rcp.date || new Date().toISOString().split('T')[0],
      receiptNo: rcp.receiptNo || '',
      clientName: rcp.clientName || '',
      clientAddress: rcp.clientAddress || '',
      amount: String(rcp.amount ?? ''),
      paymentMode: rcp.paymentMode || 'Bank Transfer',
      referenceNo: rcp.referenceNo || '',
      againstInvoice: rcp.againstInvoice || '',
      note: rcp.note || '',
    });
    setEditingReceiptId(rcp.id);
    setShowReceiptModal(true);
  };

  const handleSaveReceipt = async (e) => {
    if (e) e.preventDefault();
    if (!receiptForm.clientName.trim()) { toast('Client name required', 'warning'); return; }
    if (!receiptForm.amount || parseFloat(receiptForm.amount) <= 0) { toast('Enter valid amount', 'warning'); return; }

    try {
      let receiptNo = receiptForm.receiptNo;
      if (!editingReceiptId) {
        try { receiptNo = await getNextInvoiceNumber('RCP'); } catch { /* fall through */ }
      }

      const receipt = {
        ...receiptForm,
        receiptNo,
        amount: parseFloat(receiptForm.amount),
      };
      if (editingReceiptId) receipt.id = editingReceiptId;
      await saveReceipt(receipt);

      // Auto-propagate to invoice if specified
      if (receiptForm.againstInvoice && receiptForm.againstInvoice.trim()) {
        const bill = bills.find(b => b.invoiceNumber === receiptForm.againstInvoice.trim());
        if (bill) {
          const priorPayments = bill.payments || [];
          const nextPayments = [...priorPayments, {
            id: `pay-${Date.now()}`,
            amount: parseFloat(receiptForm.amount),
            date: receiptForm.date,
            method: receiptForm.paymentMode,
            notes: `Receipt ${receiptNo}`
          }];
          const newTotal = nextPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const nextStatus = newTotal >= (Number(bill.totalAmount) || 0) ? 'paid' : 'partial';
          await saveBill({ ...bill, paidAmount: newTotal, status: nextStatus, payments: nextPayments }, { overwrite: true });
        }
      }

      toast('Receipt voucher saved successfully', 'success');
      setShowReceiptModal(false);
      await loadData();
    } catch {
      toast('Failed to save receipt', 'error');
    }
  };

  const handleDeleteReceipt = async (id) => {
    if (await confirmAction({
      title: 'Delete this receipt?',
      message: 'The receipt voucher will be removed from your records.',
      confirmLabel: 'Delete Receipt',
      tone: 'danger',
    })) {
      try {
        await deleteReceipt(id);
        toast('Receipt deleted', 'info');
        await loadData();
      } catch {
        toast('Failed to delete receipt', 'error');
      }
    }
  };

  // Export Daybook PDF
  const exportDaybookPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210, marginL = 15, marginR = 195, tableW = marginR - marginL;

      const fmt = (n) => {
        const v = Number(n) || 0;
        return 'Rs. ' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // Header
      let y = 18;
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('DAILY DAYBOOK STATEMENT', marginL, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(profile?.businessName || 'Sri Raani Dry Fruits Traders', marginL, y); y += 4.5;
      if (profile?.gstin) { doc.text(`GSTIN: ${profile.gstin}`, marginL, y); y += 4.5; }
      doc.setTextColor(0);

      // Date
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`Date: ${new Date(daybookDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, marginR, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text(`Total Entries: ${daybookSummary.totalEntries}`, marginR, 26, { align: 'right' });

      y += 6;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.6);
      doc.line(marginL, y, marginR, y); y += 6;

      // Summary Strip
      doc.setFillColor(245, 247, 250);
      doc.rect(marginL, y, tableW, 12, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(`Total Money In: ${fmt(daybookSummary.moneyIn)}`, marginL + 5, y + 8);
      doc.text(`Total Money Out: ${fmt(daybookSummary.moneyOut)}`, marginL + 70, y + 8);
      doc.text(`Net Cash Movement: ${fmt(daybookSummary.netCash)}`, marginL + 130, y + 8);
      y += 18;

      // Table Header
      doc.setFillColor(...getAccentRGB());
      doc.rect(marginL, y, tableW, 8, 'F');
      doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      doc.text('Type', marginL + 2, y + 5.5);
      doc.text('Particulars / Party', marginL + 40, y + 5.5);
      doc.text('Ref / Voucher', marginL + 95, y + 5.5);
      doc.text('Mode', marginL + 130, y + 5.5);
      doc.text('In (Rs.)', marginL + 155, y + 5.5, { align: 'right' });
      doc.text('Out (Rs.)', marginR - 2, y + 5.5, { align: 'right' });
      doc.setTextColor(0);
      y += 10;

      // Table Rows
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      daybookTransactions.forEach(tx => {
        if (y > 270) {
          doc.addPage();
          y = 18;
        }

        doc.text(tx.typeLabel, marginL + 2, y);
        doc.text(tx.particulars, marginL + 40, y, { maxWidth: 50 });
        doc.text(tx.refNo, marginL + 95, y);
        doc.text(tx.mode, marginL + 130, y);
        if (tx.inflow > 0) doc.text(fmt(tx.inflow), marginL + 155, y, { align: 'right' });
        if (tx.outflow > 0) doc.text(fmt(tx.outflow), marginR - 2, y, { align: 'right' });

        y += 6;
      });

      doc.save(`Daybook_${daybookDate}.pdf`);
      toast('Daybook PDF exported successfully', 'success');
    } catch {
      toast('Failed to generate Daybook PDF', 'error');
    }
  };

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
      {/* 1. TOP FINANCIAL SUMMARY STRIP (Vyapar Cash & Bank KPI Ribbon) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Cash in Hand */}
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
            <Wallet size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Cash in Hand
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
              {formatCurrency(financialTotals.cashInHand, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Physical register drawer
            </div>
          </div>
        </div>

        {/* Bank Accounts Total */}
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
              Total Bank Balance
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#2563eb', lineHeight: 1.2 }}>
              {formatCurrency(financialTotals.totalBank, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Across {bankAccounts.length} bank account{bankAccounts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Today's Inflow (Money In) */}
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
            background: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ArrowDownLeft size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Today's Money In
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#16a34a', lineHeight: 1.2 }}>
              {formatCurrency(daybookSummary.moneyIn, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Collections & cash sales
            </div>
          </div>
        </div>

        {/* Today's Outflow (Money Out) */}
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
            background: '#fff1f2',
            color: '#e11d48',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ArrowUpRight size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Today's Money Out
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#e11d48', lineHeight: 1.2 }}>
              {formatCurrency(daybookSummary.moneyOut, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Expenses & settlements
            </div>
          </div>
        </div>
      </div>

      {/* 2. TABBED NAVIGATION & ACTION CONTROLS */}
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
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'daybook', label: 'Daily Daybook', icon: Calendar },
            { id: 'banks', label: `Bank Accounts (${bankAccounts.length})`, icon: Building2 },
            { id: 'cash', label: 'Cash in Hand', icon: Wallet },
            { id: 'receipts', label: `Receipt Vouchers (${receipts.length})`, icon: Receipt },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: isActive ? '#2563eb' : 'var(--bg-secondary, #f3f4f6)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #4b5563)',
                  transition: 'all 0.15s ease'
                }}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={openTransferModal}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.82rem', fontWeight: 600 }}>
            <RefreshCw size={15} /> + Record Transfer (Contra)
          </button>

          <button
            onClick={openAddAccount}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
            <Plus size={15} /> + Add Bank Account
          </button>

          <button
            onClick={openAddReceipt}
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
            <Plus size={16} /> + New Receipt Voucher
          </button>
        </div>
      </div>

      {/* 3. ACTIVE TAB CONTENT AREA */}

      {/* TAB A: DAILY DAYBOOK */}
      {activeTab === 'daybook' && (
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Daybook Date Selector & Quick Day Controls */}
          <div style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            background: 'var(--bg-secondary, #f9fafb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button
                onClick={() => shiftDay(-1)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                title="Previous Day">
                ← Prev Day
              </button>
              <input
                type="date"
                value={daybookDate}
                onChange={e => setDaybookDate(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
              <button
                onClick={() => shiftDay(1)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                title="Next Day">
                Next Day →
              </button>
              <button
                onClick={() => setDaybookDate(new Date().toISOString().split('T')[0])}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: '#2563eb' }}>
                Today
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={exportDaybookPDF}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
                <Download size={15} /> Export Daybook PDF
              </button>
            </div>
          </div>

          {/* Daybook Metric Strip for Chosen Date */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            background: '#ffffff'
          }}>
            <div style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Day's Total Inflow</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                {formatCurrency(daybookSummary.moneyIn, profileCurrency)}
              </div>
            </div>

            <div style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Day's Total Outflow</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e11d48', marginTop: '2px' }}>
                {formatCurrency(daybookSummary.moneyOut, profileCurrency)}
              </div>
            </div>

            <div style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Net Cash Movement</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: daybookSummary.netCash >= 0 ? '#16a34a' : '#e11d48', marginTop: '2px' }}>
                {daybookSummary.netCash >= 0 ? `+${formatCurrency(daybookSummary.netCash, profileCurrency)}` : formatCurrency(daybookSummary.netCash, profileCurrency)}
              </div>
            </div>

            <div style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Total Day Transactions</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginTop: '2px' }}>
                {daybookSummary.totalEntries} entries
              </div>
            </div>
          </div>

          {/* Daybook Line Item Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {daybookTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary, #6b7280)' }}>
                <Calendar size={42} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No transactions recorded on {new Date(daybookDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Transactions recorded in Sales, Purchases, Receipts, Expenses, or Transfers on this date will appear here automatically.
                </div>
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <th style={{ padding: '0.65rem 1rem' }}>Type</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Particulars / Party</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Ref / Invoice</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Payment Mode</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Money In (₹)</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Money Out (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {daybookTransactions.map(tx => {
                    const isInflow = tx.inflow > 0;
                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            background: isInflow ? '#ecfdf5' : '#fff1f2',
                            color: isInflow ? '#047857' : '#be123c'
                          }}>
                            {isInflow ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                            {tx.typeLabel}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                          {tx.particulars}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>
                          {tx.refNo}
                        </td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}>
                            {tx.mode}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {tx.inflow > 0 ? formatCurrency(tx.inflow, profileCurrency) : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>
                          {tx.outflow > 0 ? formatCurrency(tx.outflow, profileCurrency) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB B: BANK ACCOUNTS */}
      {activeTab === 'banks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1rem'
          }}>
            {bankAccounts.map(acc => {
              const bal = Number(acc.openingBalance) || 0;
              return (
                <div
                  key={acc.id}
                  style={{
                    background: 'var(--card-bg, #ffffff)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    padding: '1.25rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                          {acc.label}
                        </h3>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                          {acc.bankName} {acc.branch ? `• ${acc.branch}` : ''}
                        </div>
                      </div>
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                        Active
                      </span>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: '#4b5563' }}>
                      <div><strong>A/C No:</strong> {acc.accountNumber || 'N/A'}</div>
                      <div><strong>IFSC Code:</strong> {acc.ifsc || 'N/A'}</div>
                      {acc.upiId && <div><strong>UPI ID:</strong> <span style={{ color: '#059669', fontWeight: 600 }}>{acc.upiId}</span></div>}
                    </div>
                  </div>

                  <div style={{
                    borderTop: '1px solid #f3f4f6',
                    paddingTop: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Current Balance</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2563eb' }}>
                        {formatCurrency(bal, profileCurrency)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => openEditAccount(acc)}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                        title="Edit Bank Details">
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.id, acc.label)}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: '#dc2626' }}
                        title="Delete Bank Account">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB C: CASH IN HAND */}
      {activeTab === 'cash' && (
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e7eb)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          flex: 1
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: '1.25rem 1.5rem',
            borderRadius: '10px'
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Physical Cash In Hand
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                {formatCurrency(financialTotals.cashInHand, profileCurrency)}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#166534', marginTop: '4px' }}>
                Expected currency & coin balance in physical shop counter
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={openTransferModal}
                className="btn btn-primary"
                style={{ background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowUpRight size={16} /> Deposit Cash to Bank
              </button>
              <button
                onClick={openTransferModal}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowDownLeft size={16} /> Withdraw Cash from Bank
              </button>
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700 }}>Cash Reconciliation Notes</h3>
            <p style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5, margin: 0 }}>
              Physical cash automatically increments whenever a Sale Invoice is marked Paid via Cash, or when a Payment-In voucher is recorded in Cash mode.
              It decrements whenever expenses or vendor payments are paid out from the register. Use <strong>+ Record Transfer (Contra)</strong> whenever cash is deposited to or withdrawn from your bank account.
            </p>
          </div>
        </div>
      )}

      {/* TAB D: RECEIPT VOUCHERS */}
      {activeTab === 'receipts' && (
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search receipts by client, number..."
                value={receiptSearch}
                onChange={e => setReceiptSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2rem',
                  fontSize: '0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Total receipts: {receipts.length}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {receipts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary, #6b7280)' }}>
                <Receipt size={42} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No payment receipts recorded yet</div>
                <button onClick={openAddReceipt} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  <Plus size={16} /> Create Receipt Voucher
                </button>
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <th style={{ padding: '0.65rem 1rem' }}>Receipt No</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Date</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Client Name</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Payment Mode</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Against Invoice</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts
                    .filter(r => !receiptSearch || (r.clientName || '').toLowerCase().includes(receiptSearch.toLowerCase()) || (r.receiptNo || '').toLowerCase().includes(receiptSearch.toLowerCase()))
                    .map(rcp => (
                      <tr key={rcp.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{rcp.receiptNo}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>{rcp.date}</td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{rcp.clientName}</td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                            {rcp.paymentMode}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>{rcp.againstInvoice || 'Direct'}</td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          {formatCurrency(rcp.amount, profileCurrency)}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button className="icon-btn" onClick={() => openEditReceipt(rcp)} title="Edit Receipt"><Edit3 size={15} /></button>
                            <button className="icon-btn icon-btn-red" onClick={() => handleDeleteReceipt(rcp.id)} title="Delete Receipt"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 4. MODAL: RECORD CONTRA TRANSFER (Cash/Bank) */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                Record Cash & Bank Transfer (Contra)
              </h3>
              <button onClick={() => setShowTransferModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTransfer}>
              {/* Transfer Type */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Transfer Type *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setTransferForm(prev => ({ ...prev, type: 'CASH_TO_BANK', fromAccount: 'cash', toAccount: bankAccounts[0]?.id || '' }))}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: `1.5px solid ${transferForm.type === 'CASH_TO_BANK' ? '#2563eb' : '#d1d5db'}`,
                      background: transferForm.type === 'CASH_TO_BANK' ? '#eff6ff' : '#ffffff',
                      color: transferForm.type === 'CASH_TO_BANK' ? '#1d4ed8' : '#374151',
                      cursor: 'pointer'
                    }}>
                    Deposit (Cash ➔ Bank)
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferForm(prev => ({ ...prev, type: 'BANK_TO_CASH', fromAccount: bankAccounts[0]?.id || '', toAccount: 'cash' }))}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: `1.5px solid ${transferForm.type === 'BANK_TO_CASH' ? '#059669' : '#d1d5db'}`,
                      background: transferForm.type === 'BANK_TO_CASH' ? '#ecfdf5' : '#ffffff',
                      color: transferForm.type === 'BANK_TO_CASH' ? '#047857' : '#374151',
                      cursor: 'pointer'
                    }}>
                    Withdrawal (Bank ➔ Cash)
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Transfer Amount ({profileCurrency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={transferForm.amount}
                  onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
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

              {/* Bank Account Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  {transferForm.type === 'CASH_TO_BANK' ? 'Deposit To Bank Account *' : 'Withdraw From Bank Account *'}
                </label>
                <select
                  value={transferForm.type === 'CASH_TO_BANK' ? transferForm.toAccount : transferForm.fromAccount}
                  onChange={e => setTransferForm(prev => transferForm.type === 'CASH_TO_BANK' ? ({ ...prev, toAccount: e.target.value }) : ({ ...prev, fromAccount: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.label} ({b.bankName} - {b.accountNumber})</option>
                  ))}
                </select>
              </div>

              {/* Date & Ref */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Transfer Date
                  </label>
                  <input
                    type="date"
                    required
                    value={transferForm.date}
                    onChange={e => setTransferForm(prev => ({ ...prev, date: e.target.value }))}
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
                    Ref / Cheque / UTR No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CHQ-92810"
                    value={transferForm.referenceNo}
                    onChange={e => setTransferForm(prev => ({ ...prev, referenceNo: e.target.value }))}
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
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Remarks / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Counter cash deposit at evening close"
                  value={transferForm.notes}
                  onChange={e => setTransferForm(prev => ({ ...prev, notes: e.target.value }))}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}>
                  <Save size={16} /> Save Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: ADD / EDIT BANK ACCOUNT */}
      {showAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                {editingAccountId ? 'Edit Bank Account' : 'Add Bank Account'}
              </h3>
              <button onClick={() => setShowAccountModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Account Display Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Current A/C"
                  value={accountForm.label}
                  onChange={e => setAccountForm(prev => ({ ...prev, label: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Bank"
                    value={accountForm.bankName}
                    onChange={e => setAccountForm(prev => ({ ...prev, bankName: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50200019283011"
                    value={accountForm.accountNumber}
                    onChange={e => setAccountForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC0001234"
                    value={accountForm.ifsc}
                    onChange={e => setAccountForm(prev => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Branch Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MG Road Branch"
                    value={accountForm.branch}
                    onChange={e => setAccountForm(prev => ({ ...prev, branch: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    UPI ID for QR Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. name@okhdfcbank"
                    value={accountForm.upiId}
                    onChange={e => setAccountForm(prev => ({ ...prev, upiId: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Opening Balance ({profileCurrency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={accountForm.openingBalance}
                    onChange={e => setAccountForm(prev => ({ ...prev, openingBalance: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAccountModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}>
                  <Save size={16} /> Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: CREATE / EDIT RECEIPT VOUCHER */}
      {showReceiptModal && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                {editingReceiptId ? 'Edit Payment Receipt' : 'Create Payment Receipt Voucher'}
              </h3>
              <button onClick={() => setShowReceiptModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReceipt}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Receipt No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={receiptForm.receiptNo}
                    onChange={e => setReceiptForm(prev => ({ ...prev, receiptNo: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={receiptForm.date}
                    onChange={e => setReceiptForm(prev => ({ ...prev, date: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Client / Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. palani or Walk-in Customer"
                  value={receiptForm.clientName}
                  onChange={e => setReceiptForm(prev => ({ ...prev, clientName: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Amount Received ({profileCurrency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={receiptForm.amount}
                    onChange={e => setReceiptForm(prev => ({ ...prev, amount: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '1rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Payment Mode
                  </label>
                  <select
                    value={receiptForm.paymentMode}
                    onChange={e => setReceiptForm(prev => ({ ...prev, paymentMode: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#ffffff', boxSizing: 'border-box' }}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Reference / UTR / Cheque No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR192830"
                    value={receiptForm.referenceNo}
                    onChange={e => setReceiptForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    Link to Invoice (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-0001"
                    value={receiptForm.againstInvoice}
                    onChange={e => setReceiptForm(prev => ({ ...prev, againstInvoice: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Notes / Particulars
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advance payment for bulk dry fruits order"
                  value={receiptForm.note}
                  onChange={e => setReceiptForm(prev => ({ ...prev, note: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceiptModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}>
                  <Save size={16} /> {editingReceiptId ? 'Update Receipt' : 'Save Receipt Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
