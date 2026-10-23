import { useState, useEffect, useMemo } from 'react';
import {
  Building2, Receipt, Plus, Trash2, Search, Printer, Pencil, ArrowDownLeft,
  ArrowUpRight, Wallet, Calendar, Download, RefreshCw, X, Save, Edit3,
  CreditCard, CheckCircle2, ChevronRight, DollarSign, Layers, Filter, Clock,
  ArrowRightLeft, SlidersHorizontal, Landmark, FileCheck, AlertCircle, Check
} from 'lucide-react';
import {
  getAllReceipts, saveReceipt, deleteReceipt, getAllBills, getProfile,
  getNextInvoiceNumber, saveBill, getAllPurchases, getAllExpenses, saveProfile
} from '../store';
import { formatCurrency, getCountryConfig } from '../utils';
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
  bankAccountId: '',
  referenceNo: '',
  againstInvoice: '',
  note: '',
};

const emptyAccountForm = {
  label: '',
  bankName: '',
  accountNumber: '',
  accountHolderName: '',
  ifsc: '',
  branch: '',
  upiId: '',
  openingBalance: '0',
  asOfDate: new Date().toISOString().split('T')[0],
  printUpiQrOnInvoice: true,
  printBankOnInvoice: true,
  notes: '',
};

const emptyLoanForm = {
  accountName: '',
  lenderName: '',
  accountNumber: '',
  loanAmount: '',
  currentBalance: '',
  interestRate: '12',
  termMonths: '36',
  openingDate: new Date().toISOString().split('T')[0],
  receivedIn: 'bank',
  notes: ''
};

export default function ReceiptVoucher({ autoOpenNew }) {
  // Navigation Tabs: 'banks' | 'cash' | 'cheques' | 'loans' | 'daybook' | 'receipts'
  const [activeTab, setActiveTab] = useState('banks');

  // Core Data
  const [receipts, setReceipts] = useState([]);
  const [bills, setBills] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [paymentOuts, setPaymentOuts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [cashAdjustments, setCashAdjustments] = useState([]);
  const [bankAdjustments, setBankAdjustments] = useState([]);
  const [chequeStatuses, setChequeStatuses] = useState({});
  const [manualCheques, setManualCheques] = useState([]);
  const [loanAccounts, setLoanAccounts] = useState([]);
  const [profile, setProfile] = useState({});
  const [, setLoading] = useState(true);

  // Split-pane selection in Bank Accounts & Loan Accounts
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [bankSearch, setBankSearch] = useState('');
  const [bankTxnSearch, setBankTxnSearch] = useState('');
  const [cashTxnSearch, setCashTxnSearch] = useState('');
  const [chequeFilter, setChequeFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLEARED' | 'BOUNCED'

  // Daybook Date Filter
  const [daybookDate, setDaybookDate] = useState(new Date().toISOString().split('T')[0]);

  // Receipts View States
  const [receiptSearch, setReceiptSearch] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ ...emptyReceiptForm });
  const [editingReceiptId, setEditingReceiptId] = useState(null);

  // Bank Accounts States
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ ...emptyAccountForm });
  const [editingAccountId, setEditingAccountId] = useState(null);

  // Contra Transfer & Bank Adjustment Modal States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    type: 'CASH_TO_BANK', // 'CASH_TO_BANK' | 'BANK_TO_CASH' | 'BANK_TO_BANK' | 'BANK_ADJUST_ADD' | 'BANK_ADJUST_REDUCE'
    fromAccount: 'cash',
    toAccount: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
    notes: '',
  });

  // Cash Adjustment Modal (Vyapar kb_cash_adjustments parity)
  const [showCashAdjModal, setShowCashAdjModal] = useState(false);
  const [cashAdjForm, setCashAdjForm] = useState({
    type: 'ADD', // 'ADD' | 'REDUCE'
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Loan Account Modal & EMI Payment Modal
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState({ ...emptyLoanForm });
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [showLoanPayModal, setShowLoanPayModal] = useState(false);
  const [loanPayForm, setLoanPayForm] = useState({
    principalAmount: '',
    interestAmount: '0',
    date: new Date().toISOString().split('T')[0],
    paidFrom: 'bank',
    notes: ''
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

      const loadJson = (key, fallback) => {
        try {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch {
          return fallback;
        }
      };

      setPaymentOuts(loadJson('vyapar_payment_outs', []));
      setTransfers(loadJson('vyapar_contra_transfers', []));
      setCashAdjustments(loadJson('vyapar_cash_adjustments', []));
      setBankAdjustments(loadJson('vyapar_bank_adjustments', []));
      setChequeStatuses(loadJson('vyapar_cheque_statuses', {}));
      setManualCheques(loadJson('vyapar_manual_cheques', []));
      setLoanAccounts(loadJson('vyapar_loan_accounts', []));
    } catch {
      toast('Failed to load Cash & Bank data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (autoOpenNew) {
      setActiveTab('receipts');
      openAddReceipt();
    }
  }, [autoOpenNew]);

  // Bank Accounts List from Profile (with defaults if empty)
  const bankAccounts = useMemo(() => {
    const list = Array.isArray(profile?.paymentAccounts) ? profile.paymentAccounts : [];
    if (list.length > 0) return list;

    return [
      {
        id: 'acc-sib-01',
        label: profile?.businessName || 'Primary Business Bank A/C',
        bankName: profile?.bankName || 'SOUTH INDIAN BANK',
        accountNumber: profile?.accountNumber || '0029073000006494',
        accountHolderName: profile?.businessName || 'Sri Raani Dry Fruits Traders',
        ifsc: profile?.ifscCode || 'SIBL0000029',
        branch: profile?.branch || 'Main Branch',
        upiId: profile?.upiId || 'ganesh.cse2003-4@okaxis',
        openingBalance: 150000,
        asOfDate: '2026-04-01',
        printUpiQrOnInvoice: true,
        printBankOnInvoice: true
      }
    ];
  }, [profile]);

  useEffect(() => {
    if (bankAccounts.length > 0 && !selectedBankId) {
      setSelectedBankId(bankAccounts[0].id);
    }
  }, [bankAccounts, selectedBankId]);

  const activeBank = useMemo(() => {
    return bankAccounts.find(b => String(b.id) === String(selectedBankId)) || bankAccounts[0] || null;
  }, [bankAccounts, selectedBankId]);

  // Compute Per-Bank-Account Ledger & Live Balance + Cash-In-Hand Ledger & Live Balance
  const {
    cashInHandBalance,
    cashLedger,
    bankStatsById,
    totalBankBalance,
    allChequesList
  } = useMemo(() => {
    // 1. Initialize Bank Map
    const bMap = new Map();
    const primaryBankId = bankAccounts[0]?.id || 'acc-default';
    bankAccounts.forEach(acc => {
      const openBal = Number(acc.openingBalance) || 0;
      bMap.set(acc.id, {
        account: acc,
        balance: openBal,
        txns: openBal !== 0 ? [{
          id: `open-${acc.id}`,
          type: 'OPENING',
          typeLabel: 'Opening Balance',
          partyName: acc.bankName,
          refNo: 'OPEN-BAL',
          date: acc.asOfDate || '2026-04-01',
          inflow: openBal > 0 ? openBal : 0,
          outflow: openBal < 0 ? Math.abs(openBal) : 0,
          amount: openBal
        }] : []
      });
    });

    const resolveBankId = (specifiedId) => {
      if (specifiedId && bMap.has(specifiedId)) return specifiedId;
      return primaryBankId;
    };

    // 2. Initialize Cash Ledger
    let cashBal = Number(profile?.openingCashBalance ?? 50000);
    const cTxns = [{
      id: 'cash-open',
      type: 'OPENING',
      typeLabel: 'Opening Cash In Hand',
      partyName: 'Shop Counter Register',
      refNo: 'OPEN-CASH',
      date: '2026-04-01',
      inflow: cashBal >= 0 ? cashBal : 0,
      outflow: cashBal < 0 ? Math.abs(cashBal) : 0
    }];

    // 3. Cheques list
    const cheques = [...manualCheques];

    // 4. Process Sale Invoices
    (bills || []).forEach(b => {
      if (b.type === 'proforma' || b.type === 'estimate' || b.type === 'sale-order' || b.type === 'delivery-challan') return;
      const isCreditNote = b.type === 'credit-note' || b.docType === 'credit-note';
      const amt = Number(b.paidAmount ?? (b.status === 'paid' ? b.totalAmount : 0)) || 0;
      if (amt <= 0) return;

      const mode = (b.paymentMode || b.payments?.[0]?.mode || 'Cash').trim();
      const modeLower = mode.toLowerCase();
      const bDate = b.invoiceDate || b.date || '';

      if (modeLower.includes('cheque')) {
        const chqId = `chq-sale-${b.id || b.invoiceNumber}`;
        const stObj = chequeStatuses[chqId] || { status: 'OPEN', bankId: primaryBankId };
        cheques.push({
          id: chqId,
          partyName: b.clientName || 'Customer',
          date: bDate,
          refNo: b.paymentReference || b.invoiceNumber || 'CHQ',
          invoiceNo: b.invoiceNumber,
          type: 'RECEIVED',
          amount: amt,
          status: stObj.status || 'OPEN',
          clearedDate: stObj.clearedDate || bDate,
          bankId: stObj.bankId || primaryBankId
        });
      }

      if (modeLower.includes('cash')) {
        if (isCreditNote) {
          cashBal -= amt;
          cTxns.push({
            id: `sale-cn-${b.id || b.invoiceNumber}`,
            type: 'CREDIT_NOTE',
            typeLabel: 'Credit Note (Refund)',
            partyName: b.clientName || 'Customer',
            refNo: b.invoiceNumber || 'CN',
            date: bDate,
            inflow: 0,
            outflow: amt
          });
        } else {
          cashBal += amt;
          cTxns.push({
            id: `sale-${b.id || b.invoiceNumber}`,
            type: 'SALE',
            typeLabel: 'Cash Sale',
            partyName: b.clientName || 'Walk-in Customer',
            refNo: b.invoiceNumber || 'INV',
            date: bDate,
            inflow: amt,
            outflow: 0
          });
        }
      } else {
        const targetId = resolveBankId(b.bankAccountId);
        const bEntry = bMap.get(targetId);
        if (bEntry) {
          if (isCreditNote) {
            bEntry.balance -= amt;
            bEntry.txns.push({
              id: `bank-cn-${b.id || b.invoiceNumber}`,
              type: 'CREDIT_NOTE',
              typeLabel: `Credit Note (${mode})`,
              partyName: b.clientName || 'Customer',
              refNo: b.invoiceNumber || 'CN',
              date: bDate,
              inflow: 0,
              outflow: amt
            });
          } else {
            bEntry.balance += amt;
            bEntry.txns.push({
              id: `bank-sale-${b.id || b.invoiceNumber}`,
              type: 'SALE',
              typeLabel: `Sale (${mode})`,
              partyName: b.clientName || 'Customer',
              refNo: b.invoiceNumber || 'INV',
              date: bDate,
              inflow: amt,
              outflow: 0
            });
          }
        }
      }
    });

    // 5. Process Standalone Receipts (Payment-In)
    (receipts || []).forEach(r => {
      if (r.againstInvoice) return; // already counted on invoice paidAmount
      const amt = Number(r.amount) || 0;
      if (amt <= 0) return;
      const mode = (r.paymentMode || 'Bank Transfer').trim();
      const modeLower = mode.toLowerCase();

      if (modeLower.includes('cheque')) {
        const chqId = `chq-rcp-${r.id || r.receiptNo}`;
        const stObj = chequeStatuses[chqId] || { status: 'OPEN', bankId: r.bankAccountId || primaryBankId };
        cheques.push({
          id: chqId,
          partyName: r.clientName || 'Customer',
          date: r.date || '',
          refNo: r.referenceNo || r.receiptNo || 'CHQ',
          invoiceNo: r.receiptNo || 'Payment-In',
          type: 'RECEIVED',
          amount: amt,
          status: stObj.status || 'OPEN',
          clearedDate: stObj.clearedDate || r.date,
          bankId: stObj.bankId || primaryBankId
        });
      }

      if (modeLower.includes('cash')) {
        cashBal += amt;
        cTxns.push({
          id: `rcp-${r.id || r.receiptNo}`,
          type: 'PAYMENT_IN',
          typeLabel: 'Payment-In (Cash)',
          partyName: r.clientName || 'Customer',
          refNo: r.receiptNo || 'RCP',
          date: r.date || '',
          inflow: amt,
          outflow: 0
        });
      } else {
        const targetId = resolveBankId(r.bankAccountId);
        const bEntry = bMap.get(targetId);
        if (bEntry) {
          bEntry.balance += amt;
          bEntry.txns.push({
            id: `bank-rcp-${r.id || r.receiptNo}`,
            type: 'PAYMENT_IN',
            typeLabel: `Payment-In (${mode})`,
            partyName: r.clientName || 'Customer',
            refNo: r.receiptNo || 'RCP',
            date: r.date || '',
            inflow: amt,
            outflow: 0
          });
        }
      }
    });

    // 6. Process Purchases
    (purchases || []).forEach(p => {
      if (p.docType === 'purchase-order' || p.docType === 'payment-out') return;
      const isDebitNote = p.docType === 'purchase-return';
      const paid = Number(p.paidAmount ?? (p.paymentStatus === 'Paid' ? p.totalAmount : 0)) || 0;
      if (paid <= 0) return;

      const mode = (p.paymentMode || p.payments?.[0]?.method || 'Bank Transfer').trim();
      const modeLower = mode.toLowerCase();

      if (modeLower.includes('cheque')) {
        const chqId = `chq-pur-${p.id || p.invoiceNumber}`;
        const stObj = chequeStatuses[chqId] || { status: 'OPEN', bankId: primaryBankId };
        cheques.push({
          id: chqId,
          partyName: p.supplierName || 'Supplier',
          date: p.date || '',
          refNo: p.paymentReference || p.invoiceNumber || 'CHQ',
          invoiceNo: p.invoiceNumber || 'PUR',
          type: 'ISSUED',
          amount: paid,
          status: stObj.status || 'OPEN',
          clearedDate: stObj.clearedDate || p.date,
          bankId: stObj.bankId || primaryBankId
        });
      }

      if (modeLower.includes('cash')) {
        if (isDebitNote) {
          cashBal += paid;
          cTxns.push({
            id: `pur-dn-${p.id || p.invoiceNumber}`,
            type: 'DEBIT_NOTE',
            typeLabel: 'Debit Note (Refund)',
            partyName: p.supplierName || 'Supplier',
            refNo: p.invoiceNumber || 'DN',
            date: p.date || '',
            inflow: paid,
            outflow: 0
          });
        } else {
          cashBal -= paid;
          cTxns.push({
            id: `pur-${p.id || p.invoiceNumber}`,
            type: 'PURCHASE',
            typeLabel: 'Cash Purchase',
            partyName: p.supplierName || 'Supplier',
            refNo: p.invoiceNumber || 'PUR',
            date: p.date || '',
            inflow: 0,
            outflow: paid
          });
        }
      } else {
        const targetId = resolveBankId(p.bankAccountId);
        const bEntry = bMap.get(targetId);
        if (bEntry) {
          if (isDebitNote) {
            bEntry.balance += paid;
            bEntry.txns.push({
              id: `bank-dn-${p.id || p.invoiceNumber}`,
              type: 'DEBIT_NOTE',
              typeLabel: `Debit Note (${mode})`,
              partyName: p.supplierName || 'Supplier',
              refNo: p.invoiceNumber || 'DN',
              date: p.date || '',
              inflow: paid,
              outflow: 0
            });
          } else {
            bEntry.balance -= paid;
            bEntry.txns.push({
              id: `bank-pur-${p.id || p.invoiceNumber}`,
              type: 'PURCHASE',
              typeLabel: `Purchase (${mode})`,
              partyName: p.supplierName || 'Supplier',
              refNo: p.invoiceNumber || 'PUR',
              date: p.date || '',
              inflow: 0,
              outflow: paid
            });
          }
        }
      }
    });

    // 7. Process Standalone Payment-Outs
    (paymentOuts || []).forEach(po => {
      const amt = Number(po.amount) || 0;
      if (amt <= 0) return;
      const mode = (po.paymentMode || 'Bank Transfer').trim();
      const modeLower = mode.toLowerCase();

      if (modeLower.includes('cheque')) {
        const chqId = `chq-po-${po.id}`;
        const stObj = chequeStatuses[chqId] || { status: 'OPEN', bankId: primaryBankId };
        cheques.push({
          id: chqId,
          partyName: po.supplierName || 'Supplier',
          date: po.date || '',
          refNo: po.referenceNo || 'CHQ',
          invoiceNo: 'Payment-Out',
          type: 'ISSUED',
          amount: amt,
          status: stObj.status || 'OPEN',
          clearedDate: stObj.clearedDate || po.date,
          bankId: stObj.bankId || primaryBankId
        });
      }

      if (modeLower.includes('cash')) {
        cashBal -= amt;
        cTxns.push({
          id: `po-${po.id}`,
          type: 'PAYMENT_OUT',
          typeLabel: 'Payment-Out (Cash)',
          partyName: po.supplierName || 'Supplier',
          refNo: po.referenceNo || 'PAY-OUT',
          date: po.date || '',
          inflow: 0,
          outflow: amt
        });
      } else {
        const targetId = resolveBankId(po.bankAccountId);
        const bEntry = bMap.get(targetId);
        if (bEntry) {
          bEntry.balance -= amt;
          bEntry.txns.push({
            id: `bank-po-${po.id}`,
            type: 'PAYMENT_OUT',
            typeLabel: `Payment-Out (${mode})`,
            partyName: po.supplierName || 'Supplier',
            refNo: po.referenceNo || 'PAY-OUT',
            date: po.date || '',
            inflow: 0,
            outflow: amt
          });
        }
      }
    });

    // 8. Process Expenses
    (expenses || []).forEach(e => {
      const amt = Number(e.amount) || 0;
      if (amt <= 0) return;
      const mode = (e.paymentMode || 'Cash').trim();
      const modeLower = mode.toLowerCase();

      if (modeLower.includes('cash')) {
        cashBal -= amt;
        cTxns.push({
          id: `exp-${e.id}`,
          type: 'EXPENSE',
          typeLabel: 'Expense (Cash)',
          partyName: e.description || e.name || e.category || 'Expense',
          refNo: e.category || 'EXP',
          date: e.date || '',
          inflow: 0,
          outflow: amt
        });
      } else {
        const targetId = resolveBankId(e.bankAccountId);
        const bEntry = bMap.get(targetId);
        if (bEntry) {
          bEntry.balance -= amt;
          bEntry.txns.push({
            id: `bank-exp-${e.id}`,
            type: 'EXPENSE',
            typeLabel: `Expense (${mode})`,
            partyName: e.description || e.name || e.category || 'Expense',
            refNo: e.category || 'EXP',
            date: e.date || '',
            inflow: 0,
            outflow: amt
          });
        }
      }
    });

    // 9. Process Contra Transfers (CASH_TO_BANK, BANK_TO_CASH, BANK_TO_BANK)
    (transfers || []).forEach(ct => {
      const amt = Number(ct.amount) || 0;
      if (amt <= 0) return;

      if (ct.type === 'CASH_TO_BANK') {
        cashBal -= amt;
        const toB = bMap.get(resolveBankId(ct.toAccount));
        cTxns.push({
          id: `${ct.id}-cash`,
          type: 'CONTRA',
          typeLabel: 'Cash Deposited to Bank',
          partyName: `To: ${toB?.account?.label || 'Bank Account'}`,
          refNo: ct.referenceNo || 'CONTRA',
          date: ct.date || '',
          inflow: 0,
          outflow: amt
        });
        if (toB) {
          toB.balance += amt;
          toB.txns.push({
            id: `${ct.id}-bank`,
            type: 'CONTRA',
            typeLabel: 'Cash Deposit (Contra)',
            partyName: ct.notes || 'From Cash In Hand',
            refNo: ct.referenceNo || 'CONTRA',
            date: ct.date || '',
            inflow: amt,
            outflow: 0
          });
        }
      } else if (ct.type === 'BANK_TO_CASH') {
        cashBal += amt;
        const fromB = bMap.get(resolveBankId(ct.fromAccount));
        cTxns.push({
          id: `${ct.id}-cash`,
          type: 'CONTRA',
          typeLabel: 'Cash Withdrawn from Bank',
          partyName: `From: ${fromB?.account?.label || 'Bank Account'}`,
          refNo: ct.referenceNo || 'CONTRA',
          date: ct.date || '',
          inflow: amt,
          outflow: 0
        });
        if (fromB) {
          fromB.balance -= amt;
          fromB.txns.push({
            id: `${ct.id}-bank`,
            type: 'CONTRA',
            typeLabel: 'Cash Withdrawal (Contra)',
            partyName: ct.notes || 'To Cash In Hand',
            refNo: ct.referenceNo || 'CONTRA',
            date: ct.date || '',
            inflow: 0,
            outflow: amt
          });
        }
      } else if (ct.type === 'BANK_TO_BANK') {
        const fromB = bMap.get(resolveBankId(ct.fromAccount));
        const toB = bMap.get(resolveBankId(ct.toAccount));
        if (fromB) {
          fromB.balance -= amt;
          fromB.txns.push({
            id: `${ct.id}-from`,
            type: 'CONTRA',
            typeLabel: 'Bank to Bank Transfer (Out)',
            partyName: `To: ${toB?.account?.label || 'Bank Account'}`,
            refNo: ct.referenceNo || 'TRANSFER',
            date: ct.date || '',
            inflow: 0,
            outflow: amt
          });
        }
        if (toB) {
          toB.balance += amt;
          toB.txns.push({
            id: `${ct.id}-to`,
            type: 'CONTRA',
            typeLabel: 'Bank to Bank Transfer (In)',
            partyName: `From: ${fromB?.account?.label || 'Bank Account'}`,
            refNo: ct.referenceNo || 'TRANSFER',
            date: ct.date || '',
            inflow: amt,
            outflow: 0
          });
        }
      }
    });

    // 10. Process Manual Bank Adjustments (kb_bank_adjustments)
    (bankAdjustments || []).forEach(ba => {
      const amt = Number(ba.amount) || 0;
      if (amt <= 0) return;
      const bEntry = bMap.get(resolveBankId(ba.bankAccountId));
      if (bEntry) {
        const isAdd = ba.type === 'ADD';
        bEntry.balance += isAdd ? amt : -amt;
        bEntry.txns.push({
          id: ba.id,
          type: 'ADJUSTMENT',
          typeLabel: isAdd ? 'Bank Adjustment (+ Add)' : 'Bank Adjustment (- Reduce)',
          partyName: ba.description || 'Manual Balance Adjustment',
          refNo: 'BANK-ADJ',
          date: ba.date || '',
          inflow: isAdd ? amt : 0,
          outflow: isAdd ? 0 : amt
        });
      }
    });

    // 11. Process Manual Cash Adjustments (kb_cash_adjustments)
    (cashAdjustments || []).forEach(ca => {
      const amt = Number(ca.amount) || 0;
      if (amt <= 0) return;
      const isAdd = ca.type === 'ADD';
      cashBal += isAdd ? amt : -amt;
      cTxns.push({
        id: ca.id,
        type: 'ADJUSTMENT',
        typeLabel: isAdd ? 'Add Cash (+)' : 'Reduce Cash (-)',
        partyName: ca.description || 'Cash In Hand Adjustment',
        refNo: 'CASH-ADJ',
        date: ca.date || '',
        inflow: isAdd ? amt : 0,
        outflow: isAdd ? 0 : amt
      });
    });

    // Compute chronological running balances for Cash Ledger
    const sortedCash = [...cTxns].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    let runCash = 0;
    sortedCash.forEach(t => {
      runCash += (Number(t.inflow) || 0) - (Number(t.outflow) || 0);
      t.runningBalance = Math.round(runCash * 100) / 100;
    });

    // Compute chronological running balances for each Bank Account
    let sumBank = 0;
    const statsObj = {};
    bMap.forEach((val, key) => {
      sumBank += val.balance;
      const sortedTx = [...val.txns].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      let runB = 0;
      sortedTx.forEach(t => {
        runB += (Number(t.inflow) || 0) - (Number(t.outflow) || 0);
        t.runningBalance = Math.round(runB * 100) / 100;
      });
      statsObj[key] = {
        balance: Math.round(val.balance * 100) / 100,
        txns: sortedTx.reverse()
      };
    });

    return {
      cashInHandBalance: Math.round(cashBal * 100) / 100,
      cashLedger: sortedCash.reverse(),
      bankStatsById: statsObj,
      totalBankBalance: Math.round(sumBank * 100) / 100,
      allChequesList: cheques.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    };
  }, [bankAccounts, bills, receipts, purchases, paymentOuts, expenses, transfers, bankAdjustments, cashAdjustments, chequeStatuses, manualCheques, profile]);

  // Daily Daybook Transactions for the Selected Date
  const daybookTransactions = useMemo(() => {
    const list = [];
    const targetDate = daybookDate;

    bills.forEach(b => {
      if (b.type === 'proforma') return;
      const bDate = b.invoiceDate || b.date;
      if (bDate === targetDate) {
        const paid = Number(b.paidAmount) || (b.status === 'paid' ? Number(b.totalAmount) : 0);
        const mode = b.paymentMode || b.payments?.[0]?.mode || 'Cash';
        list.push({
          id: `sale-${b.id || b.invoiceNumber}`,
          type: 'SALE',
          typeLabel: 'Sale Invoice',
          refNo: b.invoiceNumber || 'INV',
          particulars: b.clientName || 'Walk-in Customer',
          mode,
          inflow: paid,
          outflow: 0,
          isCash: mode.toLowerCase().includes('cash')
        });
      }
    });

    receipts.forEach(r => {
      if (r.date === targetDate && !r.againstInvoice) {
        const amt = Number(r.amount) || 0;
        const mode = r.paymentMode || 'Bank Transfer';
        list.push({
          id: `rcp-${r.id || r.receiptNo}`,
          type: 'RECEIPT',
          typeLabel: 'Payment-In Receipt',
          refNo: r.receiptNo || 'RCP',
          particulars: r.clientName || 'Client',
          mode,
          inflow: amt,
          outflow: 0,
          isCash: mode.toLowerCase().includes('cash')
        });
      }
    });

    purchases.forEach(p => {
      if (p.date === targetDate && p.docType !== 'purchase-order') {
        const paid = Number(p.paidAmount) || (p.paymentStatus === 'Paid' ? Number(p.totalAmount) : 0);
        const mode = p.paymentMode || p.payments?.[0]?.method || 'Bank Transfer';
        list.push({
          id: `pur-${p.id || p.invoiceNumber}`,
          type: 'PURCHASE',
          typeLabel: 'Purchase Bill',
          refNo: p.invoiceNumber || 'PUR',
          particulars: p.supplierName || 'Vendor',
          mode,
          inflow: 0,
          outflow: paid,
          isCash: mode.toLowerCase().includes('cash')
        });
      }
    });

    paymentOuts.forEach(po => {
      if (po.date === targetDate) {
        const amt = Number(po.amount) || 0;
        const mode = po.paymentMode || 'Bank Transfer';
        list.push({
          id: po.id,
          type: 'PAYMENT_OUT',
          typeLabel: 'Payment-Out Voucher',
          refNo: po.referenceNo || 'PAY-OUT',
          particulars: po.supplierName || 'Supplier',
          mode,
          inflow: 0,
          outflow: amt,
          isCash: mode.toLowerCase().includes('cash')
        });
      }
    });

    expenses.forEach(e => {
      if (e.date === targetDate) {
        const amt = Number(e.amount) || 0;
        const mode = e.paymentMode || 'Cash';
        list.push({
          id: `exp-${e.id}`,
          type: 'EXPENSE',
          typeLabel: 'Direct Expense',
          refNo: e.category || 'Expense',
          particulars: e.description || e.name || e.category || 'Business Expense',
          mode,
          inflow: 0,
          outflow: amt,
          isCash: mode.toLowerCase().includes('cash')
        });
      }
    });

    transfers.forEach(ct => {
      if (ct.date === targetDate) {
        const amt = Number(ct.amount) || 0;
        const isDeposit = ct.type === 'CASH_TO_BANK';
        const isWithdrawal = ct.type === 'BANK_TO_CASH';
        list.push({
          id: ct.id,
          type: 'CONTRA',
          typeLabel: isDeposit ? 'Cash Deposit' : (isWithdrawal ? 'Cash Withdrawal' : 'Bank-to-Bank Transfer'),
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

  const daybookSummary = useMemo(() => {
    let moneyIn = 0, moneyOut = 0, cashIn = 0, cashOut = 0;
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

  const shiftDay = (days) => {
    const d = new Date(daybookDate);
    d.setDate(d.getDate() + days);
    setDaybookDate(d.toISOString().split('T')[0]);
  };

  // Contra Transfer & Bank Adjustment Handlers
  const openTransferModal = (presetType = 'CASH_TO_BANK') => {
    const firstId = activeBank?.id || bankAccounts[0]?.id || '';
    const secondId = bankAccounts.find(b => b.id !== firstId)?.id || firstId;
    setTransferForm({
      type: presetType,
      fromAccount: presetType === 'CASH_TO_BANK' ? 'cash' : firstId,
      toAccount: presetType === 'BANK_TO_CASH' ? 'cash' : (presetType === 'BANK_TO_BANK' ? secondId : firstId),
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
      toast('Please enter a valid amount', 'warning');
      return;
    }

    if (transferForm.type === 'BANK_ADJUST_ADD' || transferForm.type === 'BANK_ADJUST_REDUCE') {
      const newAdj = {
        id: `BA-${Date.now()}`,
        bankAccountId: transferForm.toAccount || activeBank?.id || bankAccounts[0]?.id,
        type: transferForm.type === 'BANK_ADJUST_ADD' ? 'ADD' : 'REDUCE',
        amount: amt,
        date: transferForm.date,
        description: transferForm.notes.trim() || 'Manual Bank Balance Adjustment'
      };
      const next = [newAdj, ...bankAdjustments];
      setBankAdjustments(next);
      localStorage.setItem('vyapar_bank_adjustments', JSON.stringify(next));
      toast('Bank balance adjusted successfully', 'success');
      setShowTransferModal(false);
      return;
    }

    if (transferForm.type === 'BANK_TO_BANK' && transferForm.fromAccount === transferForm.toAccount) {
      toast('Source and destination bank accounts must be different', 'warning');
      return;
    }

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
    toast(`Transfer of ${formatCurrency(amt, profileCurrency)} recorded!`, 'success');
    setShowTransferModal(false);
  };

  // Cash Adjustment Save Handler (Vyapar kb_cash_adjustments)
  const handleSaveCashAdjustment = (e) => {
    if (e) e.preventDefault();
    const amt = parseFloat(cashAdjForm.amount);
    if (!amt || amt <= 0) {
      toast('Please enter a valid amount', 'warning');
      return;
    }
    const newEntry = {
      id: `CA-${Date.now()}`,
      type: cashAdjForm.type,
      amount: amt,
      date: cashAdjForm.date,
      description: cashAdjForm.description.trim() || (cashAdjForm.type === 'ADD' ? 'Cash Added' : 'Cash Reduced'),
      createdAt: new Date().toISOString()
    };
    const next = [newEntry, ...cashAdjustments];
    setCashAdjustments(next);
    localStorage.setItem('vyapar_cash_adjustments', JSON.stringify(next));
    toast(`Cash in Hand ${cashAdjForm.type === 'ADD' ? 'increased' : 'reduced'} by ${formatCurrency(amt, profileCurrency)}`, 'success');
    setShowCashAdjModal(false);
  };

  // Cheque Status Update Handler
  const handleUpdateChequeStatus = (chequeId, newStatus) => {
    const next = {
      ...chequeStatuses,
      [chequeId]: {
        status: newStatus,
        clearedDate: new Date().toISOString().split('T')[0],
        bankId: activeBank?.id || bankAccounts[0]?.id
      }
    };
    setChequeStatuses(next);
    localStorage.setItem('vyapar_cheque_statuses', JSON.stringify(next));
    toast(`Cheque marked as ${newStatus}`, 'success');
  };

  // Loan Account Handlers
  const handleSaveLoanAccount = (e) => {
    if (e) e.preventDefault();
    if (!loanForm.accountName.trim()) {
      toast('Account Name is required', 'warning');
      return;
    }
    const amt = parseFloat(loanForm.loanAmount) || 0;
    const newLoan = {
      id: `LOAN-${Date.now()}`,
      accountName: loanForm.accountName.trim(),
      lenderName: loanForm.lenderName.trim() || 'Bank / NBFC',
      accountNumber: loanForm.accountNumber.trim(),
      loanAmount: amt,
      currentBalance: parseFloat(loanForm.currentBalance || loanForm.loanAmount) || amt,
      interestRate: parseFloat(loanForm.interestRate) || 0,
      termMonths: parseInt(loanForm.termMonths, 10) || 12,
      openingDate: loanForm.openingDate,
      receivedIn: loanForm.receivedIn,
      notes: loanForm.notes.trim(),
      transactions: [{
        id: `LT-OPEN-${Date.now()}`,
        type: 'DISBURSAL',
        date: loanForm.openingDate,
        principal: amt,
        interest: 0,
        notes: 'Loan Disbursal / Opening Balance'
      }]
    };
    const next = [newLoan, ...loanAccounts];
    setLoanAccounts(next);
    localStorage.setItem('vyapar_loan_accounts', JSON.stringify(next));
    setSelectedLoanId(newLoan.id);
    setShowLoanModal(false);
    toast('Loan Account added successfully', 'success');
  };

  const handleSaveLoanPayment = (e) => {
    if (e) e.preventDefault();
    const activeLoan = loanAccounts.find(l => l.id === (selectedLoanId || loanAccounts[0]?.id));
    if (!activeLoan) return;
    const prin = parseFloat(loanPayForm.principalAmount) || 0;
    const intr = parseFloat(loanPayForm.interestAmount) || 0;
    if (prin <= 0 && intr <= 0) {
      toast('Enter Principal or Interest amount', 'warning');
      return;
    }
    const nextLoans = loanAccounts.map(l => {
      if (l.id !== activeLoan.id) return l;
      const newBal = Math.max(0, (Number(l.currentBalance) || 0) - prin);
      return {
        ...l,
        currentBalance: newBal,
        transactions: [
          {
            id: `LT-${Date.now()}`,
            type: 'EMI_PAYMENT',
            date: loanPayForm.date,
            principal: prin,
            interest: intr,
            totalPaid: prin + intr,
            notes: loanPayForm.notes.trim() || 'EMI / Loan Installment'
          },
          ...(l.transactions || [])
        ]
      };
    });
    setLoanAccounts(nextLoans);
    localStorage.setItem('vyapar_loan_accounts', JSON.stringify(nextLoans));
    setShowLoanPayModal(false);
    toast(`EMI Payment of ${formatCurrency(prin + intr, profileCurrency)} recorded`, 'success');
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
      accountHolderName: acc.accountHolderName || acc.label || '',
      ifsc: acc.ifsc || '',
      branch: acc.branch || '',
      upiId: acc.upiId || '',
      openingBalance: String(acc.openingBalance ?? '0'),
      asOfDate: acc.asOfDate || new Date().toISOString().split('T')[0],
      printUpiQrOnInvoice: acc.printUpiQrOnInvoice !== false,
      printBankOnInvoice: acc.printBankOnInvoice !== false,
      notes: acc.notes || '',
    });
    setEditingAccountId(acc.id);
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e) => {
    if (e) e.preventDefault();
    if (!accountForm.label.trim() || !accountForm.bankName.trim()) {
      toast('Account Display Name and Bank Name are required', 'warning');
      return;
    }

    try {
      const newAcc = {
        id: editingAccountId || `acc-${Date.now()}`,
        label: accountForm.label.trim(),
        bankName: accountForm.bankName.trim(),
        accountNumber: accountForm.accountNumber.trim(),
        accountHolderName: accountForm.accountHolderName.trim() || accountForm.label.trim(),
        ifsc: accountForm.ifsc.trim(),
        branch: accountForm.branch.trim(),
        upiId: accountForm.upiId.trim(),
        openingBalance: parseFloat(accountForm.openingBalance) || 0,
        asOfDate: accountForm.asOfDate || new Date().toISOString().split('T')[0],
        printUpiQrOnInvoice: !!accountForm.printUpiQrOnInvoice,
        printBankOnInvoice: !!accountForm.printBankOnInvoice,
        notes: accountForm.notes.trim()
      };

      let existing = Array.isArray(profile.paymentAccounts) && profile.paymentAccounts.length > 0
        ? [...profile.paymentAccounts]
        : [...bankAccounts];
      if (editingAccountId) {
        existing = existing.map(a => a.id === editingAccountId ? newAcc : a);
      } else {
        existing.push(newAcc);
      }

      const updatedProfile = { ...profile, paymentAccounts: existing };
      await saveProfile(updatedProfile);
      setProfile(updatedProfile);
      setSelectedBankId(newAcc.id);

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

  // Receipt Voucher Actions
  const openAddReceipt = async () => {
    let receiptNo = '';
    try {
      receiptNo = await getNextInvoiceNumber('RCP', { peek: true });
    } catch {
      receiptNo = `RCP-${Date.now()}`;
    }
    setReceiptForm({ ...emptyReceiptForm, receiptNo, bankAccountId: activeBank?.id || '' });
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
      bankAccountId: rcp.bankAccountId || activeBank?.id || '',
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
      const marginL = 15, marginR = 195, tableW = marginR - marginL;
      const fmt = (n) => 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      let y = 18;
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('DAILY DAYBOOK STATEMENT', marginL, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(profile?.businessName || localStorage.getItem('businessName') || 'My Business', marginL, y); y += 4.5;
      if (profile?.gstin) { doc.text(`GSTIN: ${profile.gstin}`, marginL, y); y += 4.5; }
      doc.setTextColor(0);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`Date: ${new Date(daybookDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, marginR, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text(`Total Entries: ${daybookSummary.totalEntries}`, marginR, 26, { align: 'right' });

      y += 6;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.6);
      doc.line(marginL, y, marginR, y); y += 6;

      doc.setFillColor(245, 247, 250);
      doc.rect(marginL, y, tableW, 12, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text(`Total Money In: ${fmt(daybookSummary.moneyIn)}`, marginL + 5, y + 8);
      doc.text(`Total Money Out: ${fmt(daybookSummary.moneyOut)}`, marginL + 70, y + 8);
      doc.text(`Net Cash Movement: ${fmt(daybookSummary.netCash)}`, marginL + 130, y + 8);
      y += 18;

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

      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      daybookTransactions.forEach(tx => {
        if (y > 270) { doc.addPage(); y = 18; }
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
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.9rem' }}>
      
      {/* 1. TOP FINANCIAL SUMMARY STRIP (Vyapar Cash & Bank KPI Ribbon) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Bank Accounts Total */}
        <div
          onClick={() => setActiveTab('banks')}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: `1px solid ${activeTab === 'banks' ? '#93c5fd' : 'var(--border-color, #e5e7eb)'}`,
            borderRadius: '10px',
            padding: '0.85rem 1.1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            cursor: 'pointer'
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
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Bank Accounts Balance
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2563eb', lineHeight: 1.2 }}>
              {formatCurrency(totalBankBalance, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
              Across {bankAccounts.length} bank account{bankAccounts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Cash in Hand */}
        <div
          onClick={() => setActiveTab('cash')}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: `1px solid ${activeTab === 'cash' ? '#86efac' : 'var(--border-color, #e5e7eb)'}`,
            borderRadius: '10px',
            padding: '0.85rem 1.1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            cursor: 'pointer'
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
            <Wallet size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Cash In Hand
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
              {formatCurrency(cashInHandBalance, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
              Physical shop register
            </div>
          </div>
        </div>

        {/* Open Cheques */}
        <div
          onClick={() => setActiveTab('cheques')}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '10px',
            padding: '0.85rem 1.1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            cursor: 'pointer'
          }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '9px',
            background: '#fef3c7',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <FileCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Open Cheques
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#d97706', lineHeight: 1.2 }}>
              {allChequesList.filter(c => c.status === 'OPEN').length} Cheques
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
              Total tracked: {allChequesList.length}
            </div>
          </div>
        </div>

        {/* Today's Net Flow */}
        <div
          onClick={() => setActiveTab('daybook')}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '10px',
            padding: '0.85rem 1.1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            cursor: 'pointer'
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
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Liquid Balance
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#7c3aed', lineHeight: 1.2 }}>
              {formatCurrency(totalBankBalance + cashInHandBalance, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
              Bank + Cash in Hand
            </div>
          </div>
        </div>
      </div>

      {/* 2. VYAPAR CASH & BANK NAVIGATION SUB-TABS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem',
        background: 'var(--card-bg, #ffffff)',
        padding: '0.65rem 1rem',
        borderRadius: '10px',
        border: '1px solid var(--border-color, #e5e7eb)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[
            { id: 'banks', label: `Bank Accounts (${bankAccounts.length})`, icon: Building2 },
            { id: 'cash', label: 'Cash In Hand', icon: Wallet },
            { id: 'cheques', label: `Cheques (${allChequesList.length})`, icon: FileCheck },
            { id: 'loans', label: `Loan Accounts (${loanAccounts.length})`, icon: Landmark },
            { id: 'daybook', label: 'Daily Daybook', icon: Calendar },
            { id: 'receipts', label: `Payment-In Receipts (${receipts.length})`, icon: Receipt },
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
                  padding: '0.42rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.81rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: isActive ? '#2563eb' : 'var(--bg-secondary, #f3f4f6)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #4b5563)',
                  transition: 'all 0.15s ease'
                }}>
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => openTransferModal('CASH_TO_BANK')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <ArrowRightLeft size={14} /> Deposit / Withdraw
          </button>

          <button
            onClick={openAddAccount}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <Plus size={14} /> Add Bank
          </button>

          <button
            onClick={openAddReceipt}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.42rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              background: '#2563eb'
            }}>
            <Plus size={15} /> Payment-In
          </button>
        </div>
      </div>

      {/* =========================================================================================
          TAB 1: VYAPAR BANK ACCOUNTS SPLIT-PANE HUB (activeTab === 'banks')
      ========================================================================================= */}
      {activeTab === 'banks' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1rem',
          flex: 1,
          minHeight: '500px',
          alignItems: 'stretch'
        }}>
          {/* LEFT PANE: Searchable Bank Accounts List */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Search bank accounts..."
                  value={bankSearch}
                  onChange={e => setBankSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.42rem 0.7rem 0.42rem 2rem', fontSize: '0.83rem', borderRadius: '6px', border: '1px solid var(--border-color, #d1d5db)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', marginTop: '0.5rem', padding: '0 2px' }}>
                <span>ACCOUNT NAME</span>
                <span>AMOUNT</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {bankAccounts
                .filter(b => !bankSearch || (b.label || '').toLowerCase().includes(bankSearch.toLowerCase()) || (b.bankName || '').toLowerCase().includes(bankSearch.toLowerCase()))
                .map(acc => {
                  const isSel = activeBank && String(activeBank.id) === String(acc.id);
                  const liveBal = bankStatsById[acc.id]?.balance ?? (Number(acc.openingBalance) || 0);
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedBankId(acc.id)}
                      style={{
                        padding: '0.8rem 1rem',
                        borderBottom: '1px solid var(--border-color, #f3f4f6)',
                        cursor: 'pointer',
                        background: isSel ? 'var(--row-selected, #eff6ff)' : 'transparent',
                        borderLeft: isSel ? '4px solid #2563eb' : '4px solid transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary, #111827)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.label}
                        </div>
                        <div style={{ fontSize: '0.73rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.bankName} {acc.accountNumber ? `• ..${String(acc.accountNumber).slice(-4)}` : ''}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: liveBal >= 0 ? '#059669' : '#dc2626', flexShrink: 0 }}>
                        {formatCurrency(liveBal, profileCurrency)}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #f9fafb)' }}>
              <button onClick={openAddAccount} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }}>
                <Plus size={15} /> Add New Bank Account
              </button>
            </div>
          </div>

          {/* RIGHT PANE: Active Bank Account Details, Deposit/Withdraw Actions & Transactions Ledger */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {!activeBank ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Select a bank account</div>
            ) : (
              <>
                {/* Bank Header */}
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
                      <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                        {activeBank.label}
                      </h2>
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
                        {activeBank.bankName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', marginTop: '0.45rem', fontSize: '0.79rem', color: 'var(--text-secondary, #4b5563)', flexWrap: 'wrap' }}>
                      <span><strong>Account Number:</strong> {activeBank.accountNumber || 'N/A'}</span>
                      <span><strong>IFSC Code:</strong> {activeBank.ifsc || 'N/A'}</span>
                      {activeBank.upiId && <span style={{ color: '#059669', fontWeight: 600 }}><strong>UPI ID:</strong> {activeBank.upiId}</span>}
                    </div>
                  </div>

                  {/* Vyapar Deposit / Withdraw Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => openTransferModal('CASH_TO_BANK')}
                      className="btn btn-primary"
                      style={{ background: '#dc2626', borderColor: '#dc2626', fontSize: '0.8rem', padding: '0.42rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <ArrowRightLeft size={14} /> Deposit / Withdraw
                    </button>
                    <button
                      onClick={() => openTransferModal('BANK_ADJUST_ADD')}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.42rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <SlidersHorizontal size={14} /> Adjust Balance
                    </button>
                    <button
                      onClick={() => openEditAccount(activeBank)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.42rem 0.75rem' }}
                      title="Edit Bank Account">
                      <Edit3 size={14} />
                    </button>
                    {bankAccounts.length > 1 && (
                      <button
                        onClick={() => handleDeleteAccount(activeBank.id, activeBank.label)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.42rem 0.75rem', color: '#dc2626' }}
                        title="Delete Bank Account">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Transactions Header */}
                {(() => {
                  const bankTxns = (bankStatsById[activeBank.id]?.txns || []).filter(t =>
                    !bankTxnSearch ||
                    (t.partyName || '').toLowerCase().includes(bankTxnSearch.toLowerCase()) ||
                    (t.typeLabel || '').toLowerCase().includes(bankTxnSearch.toLowerCase()) ||
                    (t.refNo || '').toLowerCase().includes(bankTxnSearch.toLowerCase())
                  );
                  return (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{
                        padding: '0.65rem 1.25rem',
                        borderBottom: '1px solid var(--border-color, #e5e7eb)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg-secondary, #fafafa)'
                      }}>
                        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary, #111827)' }}>
                          TRANSACTIONS ({bankTxns.length})
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb' }}>
                            Current Balance: {formatCurrency(bankStatsById[activeBank.id]?.balance ?? 0, profileCurrency)}
                          </span>
                          <div style={{ position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                              type="text"
                              placeholder="Search ledger..."
                              value={bankTxnSearch}
                              onChange={e => setBankTxnSearch(e.target.value)}
                              style={{ padding: '0.3rem 0.6rem 0.3rem 1.65rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', width: '165px' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto' }}>
                        {bankTxns.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#6b7280' }}>
                            No bank transactions recorded yet for this account.
                          </div>
                        ) : (
                          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                                <th style={{ padding: '0.6rem 1rem' }}>TYPE</th>
                                <th style={{ padding: '0.6rem 1rem' }}>NAME / PARTICULARS</th>
                                <th style={{ padding: '0.6rem 1rem' }}>REF NO.</th>
                                <th style={{ padding: '0.6rem 1rem' }}>DATE</th>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>AMOUNT</th>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>RUNNING BALANCE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bankTxns.map(tx => {
                                const isIn = tx.inflow > 0;
                                return (
                                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                                    <td style={{ padding: '0.6rem 1rem' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.73rem',
                                        fontWeight: 600,
                                        background: isIn ? '#ecfdf5' : '#fff1f2',
                                        color: isIn ? '#047857' : '#be123c'
                                      }}>
                                        {isIn ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                                        {tx.typeLabel}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>{tx.partyName}</td>
                                    <td style={{ padding: '0.6rem 1rem', color: '#6b7280' }}>{tx.refNo}</td>
                                    <td style={{ padding: '0.6rem 1rem', color: '#4b5563' }}>{tx.date}</td>
                                    <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 700, color: isIn ? '#059669' : '#e11d48' }}>
                                      {isIn ? `+ ${formatCurrency(tx.inflow, profileCurrency)}` : `- ${formatCurrency(tx.outflow, profileCurrency)}`}
                                    </td>
                                    <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                                      {formatCurrency(tx.runningBalance, profileCurrency)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================================
          TAB 2: VYAPAR CASH IN HAND LEDGER & ADJUST CASH (activeTab === 'cash')
      ========================================================================================= */}
      {activeTab === 'cash' && (
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Top Cash Header */}
          <div style={{
            padding: '1.1rem 1.35rem',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            background: '#f0fdf4',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                CASH IN HAND BALANCE
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                {formatCurrency(cashInHandBalance, profileCurrency)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setCashAdjForm({ type: 'ADD', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
                  setShowCashAdjModal(true);
                }}
                className="btn btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                <SlidersHorizontal size={15} /> Adjust Cash
              </button>
              <button
                onClick={() => openTransferModal('CASH_TO_BANK')}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <ArrowUpRight size={15} /> Deposit Cash to Bank
              </button>
              <button
                onClick={() => openTransferModal('BANK_TO_CASH')}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <ArrowDownLeft size={15} /> Withdraw Cash from Bank
              </button>
            </div>
          </div>

          {/* Cash Transactions Toolbar */}
          <div style={{
            padding: '0.65rem 1.25rem',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary, #fafafa)'
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>
              CASH TRANSACTIONS ({cashLedger.length})
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search cash transactions..."
                value={cashTxnSearch}
                onChange={e => setCashTxnSearch(e.target.value)}
                style={{ padding: '0.3rem 0.6rem 0.3rem 1.65rem', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', width: '190px' }}
              />
            </div>
          </div>

          {/* Cash Ledger Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                  <th style={{ padding: '0.6rem 1rem' }}>TYPE</th>
                  <th style={{ padding: '0.6rem 1rem' }}>NAME / PARTICULARS</th>
                  <th style={{ padding: '0.6rem 1rem' }}>REF NO.</th>
                  <th style={{ padding: '0.6rem 1rem' }}>DATE</th>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>CASH IN (₹)</th>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>CASH OUT (₹)</th>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>RUNNING CASH</th>
                </tr>
              </thead>
              <tbody>
                {cashLedger
                  .filter(t => !cashTxnSearch || (t.partyName || '').toLowerCase().includes(cashTxnSearch.toLowerCase()) || (t.typeLabel || '').toLowerCase().includes(cashTxnSearch.toLowerCase()))
                  .map(tx => {
                    const isIn = tx.inflow > 0;
                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                        <td style={{ padding: '0.6rem 1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.73rem',
                            fontWeight: 600,
                            background: isIn ? '#ecfdf5' : '#fff1f2',
                            color: isIn ? '#047857' : '#be123c'
                          }}>
                            {tx.typeLabel}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>{tx.partyName}</td>
                        <td style={{ padding: '0.6rem 1rem', color: '#6b7280' }}>{tx.refNo}</td>
                        <td style={{ padding: '0.6rem 1rem', color: '#4b5563' }}>{tx.date}</td>
                        <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          {tx.inflow > 0 ? formatCurrency(tx.inflow, profileCurrency) : '—'}
                        </td>
                        <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>
                          {tx.outflow > 0 ? formatCurrency(tx.outflow, profileCurrency) : '—'}
                        </td>
                        <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                          {formatCurrency(tx.runningBalance, profileCurrency)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================================
          TAB 3: VYAPAR CHEQUES MANAGEMENT (activeTab === 'cheques')
      ========================================================================================= */}
      {activeTab === 'cheques' && (
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary, #f9fafb)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {[
                { id: 'ALL', label: `All Cheques (${allChequesList.length})` },
                { id: 'OPEN', label: `Open / In Hand (${allChequesList.filter(c => c.status === 'OPEN').length})` },
                { id: 'CLEARED', label: `Deposited / Cleared (${allChequesList.filter(c => c.status === 'CLEARED').length})` },
                { id: 'BOUNCED', label: `Bounced (${allChequesList.filter(c => c.status === 'BOUNCED').length})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setChequeFilter(f.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: chequeFilter === f.id ? '#2563eb' : '#e5e7eb',
                    color: chequeFilter === f.id ? '#ffffff' : '#374151'
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {allChequesList.filter(c => chequeFilter === 'ALL' || c.status === chequeFilter).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
                <FileCheck size={42} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No cheques in this status</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Any Sale Invoice, Receipt Voucher, Purchase Bill, or Payment-Out paid via <strong>Cheque</strong> automatically appears here for clearing/reconciliation.
                </div>
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <th style={{ padding: '0.65rem 1rem' }}>DIRECTION</th>
                    <th style={{ padding: '0.65rem 1rem' }}>PARTY NAME</th>
                    <th style={{ padding: '0.65rem 1rem' }}>CHEQUE / REF NO.</th>
                    <th style={{ padding: '0.65rem 1rem' }}>DATE</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ padding: '0.65rem 1rem' }}>STATUS</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {allChequesList
                    .filter(c => chequeFilter === 'ALL' || c.status === chequeFilter)
                    .map(chq => (
                      <tr key={chq.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            background: chq.type === 'RECEIVED' ? '#ecfdf5' : '#fff1f2',
                            color: chq.type === 'RECEIVED' ? '#047857' : '#be123c'
                          }}>
                            {chq.type === 'RECEIVED' ? 'Received' : 'Issued'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{chq.partyName}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>{chq.refNo} ({chq.invoiceNo})</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>{chq.date}</td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                          {formatCurrency(chq.amount, profileCurrency)}
                        </td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: chq.status === 'CLEARED' ? '#dcfce7' : (chq.status === 'BOUNCED' ? '#fee2e2' : '#fef3c7'),
                            color: chq.status === 'CLEARED' ? '#166534' : (chq.status === 'BOUNCED' ? '#991b1b' : '#92400e')
                          }}>
                            {chq.status === 'CLEARED' ? 'Deposited / Cleared' : (chq.status === 'BOUNCED' ? 'Bounced' : 'Open / In Hand')}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                          {chq.status === 'OPEN' ? (
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                onClick={() => handleUpdateChequeStatus(chq.id, 'CLEARED')}
                                className="btn btn-primary"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.73rem', background: '#059669', borderColor: '#059669' }}>
                                <Check size={12} /> Deposit / Clear
                              </button>
                              <button
                                onClick={() => handleUpdateChequeStatus(chq.id, 'BOUNCED')}
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.73rem', color: '#dc2626' }}>
                                Bounced
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleUpdateChequeStatus(chq.id, 'OPEN')}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}>
                              Re-open
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================================
          TAB 4: VYAPAR LOAN ACCOUNTS (activeTab === 'loans')
      ========================================================================================= */}
      {activeTab === 'loans' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1rem',
          flex: 1,
          minHeight: '500px'
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>LOAN ACCOUNTS ({loanAccounts.length})</span>
              <button onClick={() => { setLoanForm({ ...emptyLoanForm }); setShowLoanModal(true); }} className="btn btn-primary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.76rem' }}>
                + Add Loan A/C
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loanAccounts.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.82rem' }}>
                  No business loan / OD accounts added yet.
                </div>
              ) : (
                loanAccounts.map(loan => {
                  const isSel = (selectedLoanId || loanAccounts[0]?.id) === loan.id;
                  return (
                    <div
                      key={loan.id}
                      onClick={() => setSelectedLoanId(loan.id)}
                      style={{
                        padding: '0.8rem 1rem',
                        borderBottom: '1px solid var(--border-color, #f3f4f6)',
                        cursor: 'pointer',
                        background: isSel ? '#eff6ff' : 'transparent',
                        borderLeft: isSel ? '4px solid #2563eb' : '4px solid transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{loan.accountName}</div>
                        <div style={{ fontSize: '0.74rem', color: '#6b7280' }}>{loan.lenderName} • {loan.interestRate}% p.a.</div>
                      </div>
                      <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.88rem' }}>
                        {formatCurrency(loan.currentBalance, profileCurrency)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {(() => {
              const activeLoan = loanAccounts.find(l => l.id === (selectedLoanId || loanAccounts[0]?.id)) || loanAccounts[0];
              if (!activeLoan) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '3rem', color: '#6b7280' }}>
                    <Landmark size={46} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>Track Business Loans, OD & CC Accounts</div>
                    <div style={{ fontSize: '0.83rem', marginTop: '0.25rem' }}>Add a Loan Account to track principal balance, EMI payments, and interest expenses.</div>
                    <button onClick={() => { setLoanForm({ ...emptyLoanForm }); setShowLoanModal(true); }} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                      <Plus size={15} /> Add Loan Account
                    </button>
                  </div>
                );
              }
              return (
                <>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #f9fafb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{activeLoan.accountName}</h3>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '3px' }}>
                        Lender: <strong>{activeLoan.lenderName}</strong> • A/C: {activeLoan.accountNumber || 'N/A'} • Interest: <strong>{activeLoan.interestRate}% p.a.</strong> • Outstanding Principal: <strong style={{ color: '#dc2626' }}>{formatCurrency(activeLoan.currentBalance, profileCurrency)}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setLoanPayForm({ principalAmount: '', interestAmount: '0', date: new Date().toISOString().split('T')[0], paidFrom: 'bank', notes: '' });
                        setShowLoanPayModal(true);
                      }}
                      className="btn btn-primary"
                      style={{ background: '#2563eb' }}>
                      + Make Payment (EMI)
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary, #f9fafb)', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                          <th style={{ padding: '0.65rem 1rem' }}>TYPE</th>
                          <th style={{ padding: '0.65rem 1rem' }}>DATE</th>
                          <th style={{ padding: '0.65rem 1rem' }}>PARTICULARS</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>PRINCIPAL (₹)</th>
                          <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>INTEREST (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeLoan.transactions || []).map(tx => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)' }}>
                            <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{tx.type === 'DISBURSAL' ? 'Loan Disbursed' : 'EMI Payment'}</td>
                            <td style={{ padding: '0.65rem 1rem' }}>{tx.date}</td>
                            <td style={{ padding: '0.65rem 1rem', color: '#6b7280' }}>{tx.notes}</td>
                            <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: tx.type === 'DISBURSAL' ? '#dc2626' : '#059669' }}>
                              {formatCurrency(tx.principal, profileCurrency)}
                            </td>
                            <td style={{ padding: '0.65rem 1rem', textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                              {formatCurrency(tx.interest || 0, profileCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================================================
          TAB 5: DAILY DAYBOOK (activeTab === 'daybook')
      ========================================================================================= */}
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
              <button onClick={() => shiftDay(-1)} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}>
                ← Prev Day
              </button>
              <input
                type="date"
                value={daybookDate}
                onChange={e => setDaybookDate(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.88rem', fontWeight: 600, borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
              <button onClick={() => shiftDay(1)} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}>
                Next Day →
              </button>
              <button onClick={() => setDaybookDate(new Date().toISOString().split('T')[0])} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: '#2563eb' }}>
                Today
              </button>
            </div>

            <button onClick={exportDaybookPDF} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}>
              <Download size={15} /> Export Daybook PDF
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-color, #e5e7eb)'
          }}>
            <div style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'var(--bg-secondary, #fafafa)' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Day's Total Inflow</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>{formatCurrency(daybookSummary.moneyIn, profileCurrency)}</div>
            </div>
            <div style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'var(--bg-secondary, #fafafa)' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Day's Total Outflow</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e11d48', marginTop: '2px' }}>{formatCurrency(daybookSummary.moneyOut, profileCurrency)}</div>
            </div>
            <div style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'var(--bg-secondary, #fafafa)' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Net Cash Movement</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: daybookSummary.netCash >= 0 ? '#16a34a' : '#e11d48', marginTop: '2px' }}>
                {daybookSummary.netCash >= 0 ? `+${formatCurrency(daybookSummary.netCash, profileCurrency)}` : formatCurrency(daybookSummary.netCash, profileCurrency)}
              </div>
            </div>
            <div style={{ padding: '0.65rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'var(--bg-secondary, #fafafa)' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Total Day Transactions</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{daybookSummary.totalEntries} entries</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {daybookTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
                <Calendar size={42} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No transactions recorded on {new Date(daybookDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
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
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600,
                            background: isInflow ? '#ecfdf5' : '#fff1f2', color: isInflow ? '#047857' : '#be123c'
                          }}>
                            {isInflow ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />} {tx.typeLabel}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{tx.particulars}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#4b5563' }}>{tx.refNo}</td>
                        <td style={{ padding: '0.65rem 1rem' }}>{tx.mode}</td>
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

      {/* =========================================================================================
          TAB 6: RECEIPT VOUCHERS / PAYMENT-IN (activeTab === 'receipts')
      ========================================================================================= */}
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
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search receipts by client, number..."
                value={receiptSearch}
                onChange={e => setReceiptSearch(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.75rem 0.45rem 2rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total receipts: {receipts.length}</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {receipts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
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
                        <td style={{ padding: '0.65rem 1rem' }}>{rcp.paymentMode}</td>
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

      {/* =========================================================================================
          MODALS
      ========================================================================================= */}

      {/* MODAL 1: DEPOSIT / WITHDRAW / BANK-TO-BANK / BANK ADJUSTMENT */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                Bank & Cash Transfer / Adjustment
              </h3>
              <button onClick={() => setShowTransferModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTransfer}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Transaction Type *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  {[
                    { id: 'CASH_TO_BANK', label: 'Cash to Bank (Deposit)' },
                    { id: 'BANK_TO_CASH', label: 'Bank to Cash (Withdraw)' },
                    { id: 'BANK_TO_BANK', label: 'Bank to Bank Transfer' },
                    { id: 'BANK_ADJUST_ADD', label: 'Adjust Bank (+ Add)' },
                    { id: 'BANK_ADJUST_REDUCE', label: 'Adjust Bank (- Reduce)' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTransferForm(prev => ({
                        ...prev,
                        type: opt.id,
                        fromAccount: opt.id === 'CASH_TO_BANK' ? 'cash' : (activeBank?.id || bankAccounts[0]?.id || ''),
                        toAccount: opt.id === 'BANK_TO_CASH' ? 'cash' : (activeBank?.id || bankAccounts[0]?.id || '')
                      }))}
                      style={{
                        padding: '0.48rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.77rem',
                        fontWeight: 600,
                        border: `1.5px solid ${transferForm.type === opt.id ? '#2563eb' : '#d1d5db'}`,
                        background: transferForm.type === opt.id ? '#eff6ff' : '#ffffff',
                        color: transferForm.type === opt.id ? '#1d4ed8' : '#374151',
                        cursor: 'pointer'
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* From / To Bank selectors */}
              {(transferForm.type === 'BANK_TO_CASH' || transferForm.type === 'BANK_TO_BANK') && (
                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    From Bank Account *
                  </label>
                  <select
                    value={transferForm.fromAccount}
                    onChange={e => setTransferForm(prev => ({ ...prev, fromAccount: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#ffffff', fontSize: '0.85rem' }}>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.label} ({b.bankName})</option>)}
                  </select>
                </div>
              )}

              {(transferForm.type === 'CASH_TO_BANK' || transferForm.type === 'BANK_TO_BANK' || transferForm.type.startsWith('BANK_ADJUST')) && (
                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    {transferForm.type.startsWith('BANK_ADJUST') ? 'Select Bank Account *' : 'To Bank Account *'}
                  </label>
                  <select
                    value={transferForm.toAccount}
                    onChange={e => setTransferForm(prev => ({ ...prev, toAccount: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#ffffff', fontSize: '0.85rem' }}>
                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.label} ({b.bankName})</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    Amount ({profileCurrency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={transferForm.amount}
                    onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '1rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                    Adjustment / Transfer Date
                  </label>
                  <input
                    type="date"
                    required
                    value={transferForm.date}
                    onChange={e => setTransferForm(prev => ({ ...prev, date: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
                  Description / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Evening cash deposit or bank charges adjustment"
                  value={transferForm.notes}
                  onChange={e => setTransferForm(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VYAPAR ADJUST CASH MODAL */}
      {showCashAdjModal && (
        <div className="modal-overlay" onClick={() => setShowCashAdjModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>Adjust Cash</h3>
              <button onClick={() => setShowCashAdjModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveCashAdjustment}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setCashAdjForm(prev => ({ ...prev, type: 'ADD' }))}
                  style={{
                    padding: '0.55rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer',
                    border: `2px solid ${cashAdjForm.type === 'ADD' ? '#059669' : '#d1d5db'}`,
                    background: cashAdjForm.type === 'ADD' ? '#ecfdf5' : '#ffffff',
                    color: cashAdjForm.type === 'ADD' ? '#047857' : '#374151'
                  }}>
                  + Add Cash
                </button>
                <button
                  type="button"
                  onClick={() => setCashAdjForm(prev => ({ ...prev, type: 'REDUCE' }))}
                  style={{
                    padding: '0.55rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer',
                    border: `2px solid ${cashAdjForm.type === 'REDUCE' ? '#dc2626' : '#d1d5db'}`,
                    background: cashAdjForm.type === 'REDUCE' ? '#fef2f2' : '#ffffff',
                    color: cashAdjForm.type === 'REDUCE' ? '#dc2626' : '#374151'
                  }}>
                  - Reduce Cash
                </button>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Enter Amount ({profileCurrency}) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={cashAdjForm.amount}
                  onChange={e => setCashAdjForm(prev => ({ ...prev, amount: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '1.05rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Adjustment Date</label>
                <input
                  type="date"
                  value={cashAdjForm.date}
                  onChange={e => setCashAdjForm(prev => ({ ...prev, date: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Enter Description</label>
                <input
                  type="text"
                  placeholder="e.g. Owner capital added or petty cash drawing"
                  value={cashAdjForm.description}
                  onChange={e => setCashAdjForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCashAdjModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD / EDIT BANK ACCOUNT */}
      {showAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                {editingAccountId ? 'Edit Bank Account' : 'Add Bank Account'}
              </h3>
              <button onClick={() => setShowAccountModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveAccount}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Account Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SIB Current Account"
                    value={accountForm.label}
                    onChange={e => setAccountForm(prev => ({ ...prev, label: e.target.value }))}
                    style={{ width: '100%', padding: '0.48rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Bank Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SOUTH INDIAN BANK"
                    value={accountForm.bankName}
                    onChange={e => setAccountForm(prev => ({ ...prev, bankName: e.target.value }))}
                    style={{ width: '100%', padding: '0.48rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Opening Balance ({profileCurrency})</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={accountForm.openingBalance}
                    onChange={e => setAccountForm(prev => ({ ...prev, openingBalance: e.target.value }))}
                    style={{ width: '100%', padding: '0.48rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>As Of Date</label>
                  <input
                    type="date"
                    value={accountForm.asOfDate}
                    onChange={e => setAccountForm(prev => ({ ...prev, asOfDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.48rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 0029073000006494"
                    value={accountForm.accountNumber}
                    onChange={e => setAccountForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                    style={{ width: '100%', padding: '0.48rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SIBL0000029"
                    value={accountForm.ifsc}
                    onChange={e => setAccountForm(prev => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
                    style={{ width: '100%', padding: '0.48rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Account Holder Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sri Raani Dry Fruits Traders"
                    value={accountForm.accountHolderName}
                    onChange={e => setAccountForm(prev => ({ ...prev, accountHolderName: e.target.value }))}
                    style={{ width: '100%', padding: '0.48rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>UPI ID for QR Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ganesh.cse2003-4@okaxis"
                    value={accountForm.upiId}
                    onChange={e => setAccountForm(prev => ({ ...prev, upiId: e.target.value }))}
                    style={{ width: '100%', padding: '0.48rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.15rem', fontSize: '0.8rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={accountForm.printUpiQrOnInvoice} onChange={e => setAccountForm(prev => ({ ...prev, printUpiQrOnInvoice: e.target.checked }))} />
                  Print UPI QR Code on Invoices
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={accountForm.printBankOnInvoice} onChange={e => setAccountForm(prev => ({ ...prev, printBankOnInvoice: e.target.checked }))} />
                  Print Bank Details on Invoices
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAccountModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}><Save size={16} /> Save Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD LOAN ACCOUNT */}
      {showLoanModal && (
        <div className="modal-overlay" onClick={() => setShowLoanModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>Add Loan Account</h3>
              <button onClick={() => setShowLoanModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveLoanAccount}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Account Name *</label>
                  <input type="text" required placeholder="e.g. Business OD Loan" value={loanForm.accountName} onChange={e => setLoanForm(prev => ({ ...prev, accountName: e.target.value }))} style={{ width: '100%', padding: '0.48rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Lender Bank / NBFC</label>
                  <input type="text" placeholder="e.g. HDFC Bank" value={loanForm.lenderName} onChange={e => setLoanForm(prev => ({ ...prev, lenderName: e.target.value }))} style={{ width: '100%', padding: '0.48rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Loan Amount ({profileCurrency}) *</label>
                  <input type="number" step="any" required placeholder="0.00" value={loanForm.loanAmount} onChange={e => setLoanForm(prev => ({ ...prev, loanAmount: e.target.value, currentBalance: e.target.value }))} style={{ width: '100%', padding: '0.48rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Interest Rate (% p.a.)</label>
                  <input type="number" step="any" placeholder="12" value={loanForm.interestRate} onChange={e => setLoanForm(prev => ({ ...prev, interestRate: e.target.value }))} style={{ width: '100%', padding: '0.48rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLoanModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}>Save Loan Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: MAKE LOAN EMI PAYMENT */}
      {showLoanPayModal && (
        <div className="modal-overlay" onClick={() => setShowLoanPayModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem' }}>Make Loan EMI Payment</h3>
              <button onClick={() => setShowLoanPayModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveLoanPayment}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Principal Amount ({profileCurrency}) *</label>
                <input type="number" step="any" required placeholder="0.00" value={loanPayForm.principalAmount} onChange={e => setLoanPayForm(prev => ({ ...prev, principalAmount: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Interest Amount ({profileCurrency})</label>
                <input type="number" step="any" placeholder="0.00" value={loanPayForm.interestAmount} onChange={e => setLoanPayForm(prev => ({ ...prev, interestAmount: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem' }}>Payment Date</label>
                <input type="date" value={loanPayForm.date} onChange={e => setLoanPayForm(prev => ({ ...prev, date: e.target.value }))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLoanPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}>Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE / EDIT RECEIPT VOUCHER */}
      {showReceiptModal && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                {editingReceiptId ? 'Edit Payment Receipt' : 'Create Payment-In Receipt Voucher'}
              </h3>
              <button onClick={() => setShowReceiptModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReceipt}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Receipt No. *</label>
                  <input type="text" required value={receiptForm.receiptNo} onChange={e => setReceiptForm(prev => ({ ...prev, receiptNo: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Receipt Date *</label>
                  <input type="date" required value={receiptForm.date} onChange={e => setReceiptForm(prev => ({ ...prev, date: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Client / Customer Name *</label>
                <input type="text" required placeholder="e.g. palani or Walk-in Customer" value={receiptForm.clientName} onChange={e => setReceiptForm(prev => ({ ...prev, clientName: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Amount Received ({profileCurrency}) *</label>
                  <input type="number" step="any" min="0.01" required placeholder="0.00" value={receiptForm.amount} onChange={e => setReceiptForm(prev => ({ ...prev, amount: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '1rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Payment Mode</label>
                  <select value={receiptForm.paymentMode} onChange={e => setReceiptForm(prev => ({ ...prev, paymentMode: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#ffffff', boxSizing: 'border-box' }}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Reference / UTR / Cheque No.</label>
                  <input type="text" placeholder="e.g. UTR192830" value={receiptForm.referenceNo} onChange={e => setReceiptForm(prev => ({ ...prev, referenceNo: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Link to Invoice (Optional)</label>
                  <input type="text" placeholder="e.g. INV-0001" value={receiptForm.againstInvoice} onChange={e => setReceiptForm(prev => ({ ...prev, againstInvoice: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Notes / Particulars</label>
                <input type="text" placeholder="e.g. Advance payment for bulk dry fruits order" value={receiptForm.note} onChange={e => setReceiptForm(prev => ({ ...prev, note: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceiptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}><Save size={16} /> {editingReceiptId ? 'Update Receipt' : 'Save Receipt Voucher'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
