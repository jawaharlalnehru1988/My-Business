import { useState, useEffect, useMemo } from 'react';
import { FileText, Trash2, Plus, IndianRupee, Receipt, Edit3, TrendingUp, Search, Copy, X, CheckCircle, Clock, AlertTriangle, MessageCircle, Mail, StickyNote, Send, Package, Download, Printer, ArrowDown, ArrowUp, ChevronRight, ChevronDown, ShoppingCart, CreditCard, Building2, BarChart2 } from 'lucide-react';
import HelpButton from './HelpButton';
import { getAllBills, deleteBill, saveBill, getAllProducts, saveProduct, getProfile, getAllClients, getAllSuppliers, getAllPurchases, getAllExpenses, getStockAlertSettings, saveReceipt, deleteReceipt } from '../store';
import { formatCurrency, INVOICE_TYPES, getFYOptions, numberToWords } from '../utils';
import { openWhatsAppShare } from '../utils/share';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

// v1.10.13 — `bg` values switched from opaque tints (#fffbeb / #f5f3ff /
// etc.) to translucent alpha versions of the accent color. Reason:
// prior hex backgrounds were LIGHT-MODE ONLY. In dark mode the status
// pills appeared as pale rectangles on the dark row background — the
// user reported "NEW ISSUE IN CASE OF DARK MODE". rgba() with 12%
// alpha lets the underlying row bg show through and works in both
// themes.
const STATUS_CONFIG = {
  unpaid:  { label: 'Unpaid',  icon: Clock,          color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' },
  partial: { label: 'Partial', icon: Clock,          color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' },
  paid:    { label: 'Paid',    icon: CheckCircle,    color: '#059669', bg: 'rgba(5, 150, 105, 0.14)'  },
  overdue: { label: 'Overdue', icon: AlertTriangle,  color: '#dc2626', bg: 'rgba(220, 38, 38, 0.14)'  },
};

// v1.10.6 — audit L4: was a local copy of getFYOptions. Now imported
// from ../utils so a bugfix touches one file, not five.

// v1.10.9 — Payment Receipt modal. Renders a printable receipt for a
// specific payment against a specific invoice. Print button uses
// window.print() and the CSS injected on mount hides everything else so
// only the receipt shows on paper.
function ReceiptModal({ target, onClose }) {
  const { bill, payment, remaining } = target;
  const currency = bill.currency || bill.data?.invoiceOptions?.currency || 'INR';
  const businessName = bill.data?.profile?.businessName || 'Your Business';
  const businessAddress = bill.data?.profile?.address || '';
  const businessGstin = bill.data?.profile?.gstin || '';
  const businessPhone = bill.data?.profile?.phone || '';
  const businessEmail = bill.data?.profile?.email || '';
  const clientName = bill.data?.client?.name || bill.clientName || 'Client';
  const clientAddress = bill.data?.client?.address || '';
  const clientPhone = bill.data?.client?.phone || '';
  const receiptNo = `RCPT-${(payment.id || '').replace('pay_', '').toUpperCase().slice(0, 10)}`;
  const paymentModeLabel = {
    'bank-transfer': 'Bank Transfer', 'upi': 'UPI', 'cash': 'Cash',
    'cheque': 'Cheque', 'card': 'Card', 'other': 'Other',
  }[payment.mode] || payment.mode;

  const doPrint = () => {
    let styleEl = document.getElementById('fgsb-receipt-print-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'fgsb-receipt-print-css';
      styleEl.textContent = `
        @media print {
          body * { visibility: hidden !important; }
          .fgsb-receipt-page, .fgsb-receipt-page * { visibility: visible !important; }
          .fgsb-receipt-page { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: #fff !important; color: #000 !important; }
          .fgsb-receipt-noprint { display: none !important; }
          @page { size: A5; margin: 12mm; }
        }
      `;
      document.head.appendChild(styleEl);
    }
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="fgsb-receipt-noprint" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Payment Receipt</h3>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <div className="fgsb-receipt-page" style={{
          background: '#fff', color: '#111', padding: '1.5rem 1.75rem',
          border: '1px solid #e5e7eb', borderRadius: 6, fontFamily: 'Helvetica, Arial, sans-serif',
        }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.05em' }}>{businessName}</div>
            {businessAddress && <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 3 }}>{businessAddress}</div>}
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 3 }}>
              {businessGstin && <>GSTIN: <strong>{businessGstin}</strong> · </>}
              {businessPhone && <>Ph: {businessPhone} · </>}
              {businessEmail}
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            PAYMENT RECEIPT
          </div>
          <table style={{ width: '100%', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <tbody>
              <tr><td style={{ padding: '3px 0', color: '#475569' }}>Receipt No.</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{receiptNo}</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#475569' }}>Payment Date</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{payment.date ? new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#475569' }}>Against Invoice</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{bill.invoiceNumber}</td></tr>
              <tr><td style={{ padding: '3px 0', color: '#475569' }}>Payment Mode</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{paymentModeLabel}</td></tr>
              {payment.note && <tr><td style={{ padding: '3px 0', color: '#475569' }}>Ref / Note</td><td style={{ textAlign: 'right' }}>{payment.note}</td></tr>}
            </tbody>
          </table>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#475569' }}>Received with thanks from</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 3 }}>{clientName}</div>
            {clientAddress && <div style={{ fontSize: '0.72rem', color: '#475569' }}>{clientAddress}</div>}
            {clientPhone && <div style={{ fontSize: '0.72rem', color: '#475569' }}>Ph: {clientPhone}</div>}
          </div>
          <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.85rem', color: '#334155' }}>Amount Received</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(payment.amount, currency)}</span>
            </div>
            {currency === 'INR' && (
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
                In words: {numberToWords(Number(payment.amount) || 0)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#334155', marginBottom: '1rem' }}>
            <span>Invoice Total: <strong>{formatCurrency(Number(bill.totalAmount) || 0, currency)}</strong></span>
            <span>Total Paid: <strong>{formatCurrency(Number(bill.paidAmount) || 0, currency)}</strong></span>
            {/* v1.10.22 — surface overpayments explicitly. Was previously
                clamped to zero via Math.max, silently swallowing the
                "customer paid extra by ₹X" case. */}
            <span>
              {remaining < -0.005
                ? <>Overpaid: <strong style={{ color: '#059669' }}>{formatCurrency(Math.abs(remaining), currency)}</strong></>
                : <>Balance: <strong style={{ color: remaining > 0.005 ? '#dc2626' : '#059669' }}>{formatCurrency(Math.max(0, remaining), currency)}</strong></>}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', fontSize: '0.75rem', color: '#475569' }}>
            <div><div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, minWidth: 140, textAlign: 'center' }}>Customer Signature</div></div>
            <div><div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, minWidth: 140, textAlign: 'center' }}>For {businessName}</div></div>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.75rem' }}>
            This is a computer-generated receipt. Recorded on {new Date(payment.recordedAt || Date.now()).toLocaleString('en-IN')}.
          </div>
        </div>
        <div className="fgsb-receipt-noprint" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={doPrint}><Printer size={16} /> Print Receipt</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onNew, onEdit, onDuplicate, onConvert, initialTypeFilter, onNavigate }) {
  const [bills, setBills] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [stats, setStats] = useState({ byCurrency: {}, count: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fyFilter, setFyFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Vyapar-Specific State
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [chartPeriod, setChartPeriod] = useState('this-month');
  const [hoverDataPoint, setHoverDataPoint] = useState(null);
  const [showAllLowStock, setShowAllLowStock] = useState(false);

  useEffect(() => {
    if (initialTypeFilter) setTypeFilter(initialTypeFilter);
  }, [initialTypeFilter]);
  // Bulk-selection state. Stores a Set of bill IDs (not the bills themselves)
  // so we don't hold stale references when the underlying bill is edited
  // elsewhere. Cleared whenever filters change so the user doesn't accidentally
  // bulk-act on bills they can no longer see.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // v1.9.4 — column picker. Persist to localStorage. Default set matches
  // the pre-v1.9.4 hardcoded columns so no visual change on upgrade.
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gst_dashboardColumns') || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch { /* ignore */ }
    return {
      date: true, invoice: true, type: true, client: true, amount: true,
      status: true, actions: true, printed: false, currency: false, dueDate: false,
    };
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  useEffect(() => {
    try { localStorage.setItem('gst_dashboardColumns', JSON.stringify(visibleColumns)); } catch { /* ignore */ }
  }, [visibleColumns]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null);
  // v1.10.9 — receipt modal state. Opens automatically after
  // recordPayment succeeds; can also be opened via openReceiptFor(...)
  // for reprints.
  const [receiptTarget, setReceiptTarget] = useState(null); // { bill, payment, remaining }

  // v1.10.13 — full-edit payment modal. { bill, idx, form: { amount, date, mode, note } }
  const [editPaymentModal, setEditPaymentModal] = useState(null);
  const [paymentInput, setPaymentInput] = useState({ amount: '', date: '', mode: 'bank-transfer', note: '' });
  const [showRemindAll, setShowRemindAll] = useState(false);
  const [profile, setProfileState] = useState(null);
  const [clients, setClients] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [inventoryValuation, setInventoryValuation] = useState(0);

  // v1.10.4 — audit M14. getFYOptions is date-based (only changes across
  // April-1 boundary); memoize with an empty dep so we run it once per
  // component mount, not on every render.
  const fyOptions = useMemo(() => getFYOptions(), []);

  const loadBills = async () => {
    try {
      const data = await getAllBills();
      const today = new Date().toISOString().split('T')[0];

      // Auto-detect overdue: if due date passed and not paid, mark as overdue.
      // Previously this did sequential `await saveBill(bill)` inside a for-loop,
      // which (a) made N round-trips serialised and (b) silently stopped on the
      // first failure. Now we collect dirty bills and save them concurrently via
      // allSettled so one slow save can't block the rest.
      const dirty = data.filter(bill => {
        const dueDate = bill.data?.details?.dueDate;
        return dueDate && dueDate < today && bill.status !== 'paid' && bill.status !== 'overdue';
      });
      if (dirty.length > 0) {
        const updates = dirty.map(bill => { bill.status = 'overdue'; return saveBill(bill, { overwrite: true }); });
        await Promise.allSettled(updates);
      }

      setBills(data);

      // Group totals by currency
      const byCurrency = {};
      const productSales = {};
      for (const b of data) {
        const cur = b.currency || b.data?.invoiceOptions?.currency || 'INR';
        if (!byCurrency[cur]) byCurrency[cur] = { total: 0, tax: 0, unpaid: 0 };
        byCurrency[cur].total += b.totalAmount || 0;
        byCurrency[cur].tax += b.totalTaxAmount || 0;
        if (b.status !== 'paid') byCurrency[cur].unpaid += (b.totalAmount || 0) - (b.paidAmount || 0);

        if (b.invoiceType !== 'proforma' && b.data?.items) {
           for (const item of b.data.items) {
               if (item.name) {
                   productSales[item.name] = (productSales[item.name] || 0) + Number(item.quantity || 0);
               }
           }
        }
      }
      setStats({ byCurrency, count: data.length });
      
      const sortedProducts = Object.entries(productSales).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
      setTopProducts(sortedProducts);
    } catch {
      toast('Failed to load invoices', 'error');
    }
  };

  useEffect(() => {
    loadBills();
    getProfile().then(p => setProfileState(p)).catch(() => {});
    getAllClients().then(c => setClients(c)).catch(() => {});
    getAllSuppliers().then(s => setSuppliers(s || [])).catch(() => {});
    getAllPurchases().then(pur => setPurchases(pur || [])).catch(() => {});
    getAllExpenses().then(exp => setExpenses(exp || [])).catch(() => {});
    // Pull the stock-alert config alongside products so the Dashboard's
    // low-stock card honours the user's threshold + on/off preference.
    Promise.all([
      getAllProducts().catch(() => []),
      getStockAlertSettings().catch(() => ({ enabled: true, threshold: 5 })),
    ]).then(([prods, cfg]) => {
      setAllProducts(prods);
      const val = prods
        .filter(p => p.type !== 'SERVICE')
        .reduce((sum, p) => sum + (p.stock || 0) * (p.weightedAverageCost || p.purchasePrice || p.rate || 0), 0);
      setInventoryValuation(val);
      
      if (cfg?.enabled === false) { setLowStockProducts([]); return; }
      const threshold = Number(cfg?.threshold ?? 5);
      setLowStockProducts(prods.filter(p => p.type !== 'SERVICE' && (p.stock ?? 0) <= threshold));
    });
  }, []);

  // Vyapar KPI: Total Receivable (Unpaid Invoices from Clients)
  const receivableData = useMemo(() => {
    let total = 0;
    const clientMap = new Set();
    bills.forEach(b => {
      if (b.invoiceType !== 'proforma' && b.status !== 'paid') {
        const remaining = (Number(b.totalAmount) || 0) - (Number(b.paidAmount) || 0);
        if (remaining > 0) {
          total += remaining;
          if (b.clientName) clientMap.add(b.clientName);
        }
      }
    });
    return { total, count: clientMap.size };
  }, [bills]);

  // Vyapar KPI: Total Payable (Unpaid Purchases to Suppliers)
  const payableData = useMemo(() => {
    let total = 0;
    const supplierMap = new Set();
    purchases.forEach(p => {
      if (p.status !== 'paid') {
        const remaining = (Number(p.totalAmount) || 0) - (Number(p.paidAmount) || 0);
        if (remaining > 0) {
          total += remaining;
          const sName = p.vendorName || p.supplierName || p.supplier;
          if (sName) supplierMap.add(sName);
        }
      }
    });
    return { total, count: supplierMap.size };
  }, [purchases]);

  // Vyapar Right-Panel Financial Metrics (Purchases, Expenses, Cash, Bank)
  const financialSnapshot = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const purchasesThisMonth = purchases
      .filter(p => {
        const dStr = p.purchaseDate || p.date;
        if (!dStr) return false;
        const d = new Date(dStr);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
      })
      .reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);

    const expensesThisMonth = expenses
      .filter(e => {
        const dStr = e.date || e.expenseDate;
        if (!dStr) return false;
        const d = new Date(dStr);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    let cashInHand = 0;
    let bankBalance = 0;

    bills.forEach(b => {
      if (b.data?.payments && Array.isArray(b.data.payments)) {
        b.data.payments.forEach(pay => {
          const amt = Number(pay.amount) || 0;
          if (pay.mode === 'cash') cashInHand += amt;
          else bankBalance += amt;
        });
      } else if (b.paidAmount) {
        bankBalance += Number(b.paidAmount) || 0;
      }
    });

    purchases.forEach(p => {
      const paid = Number(p.paidAmount) || (p.status === 'paid' ? Number(p.totalAmount) || 0 : 0);
      if (p.paymentMode === 'cash') cashInHand -= paid;
      else bankBalance -= paid;
    });

    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      if (e.paymentMode === 'cash') cashInHand -= amt;
      else bankBalance -= amt;
    });

    return { purchasesThisMonth, expensesThisMonth, cashInHand, bankBalance };
  }, [bills, purchases, expenses]);

  // Vyapar Center-Panel Sales Trend Chart Data
  const chartData = useMemo(() => {
    const now = new Date();
    const points = [];
    let periodTotal = 0;

    if (chartPeriod === 'this-month') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let dayTotal = 0;
        bills.forEach(b => {
          if (b.invoiceType === 'proforma') return;
          if (b.invoiceDate === dayStr) {
            dayTotal += Number(b.totalAmount) || 0;
          }
        });
        periodTotal += dayTotal;
        points.push({ label: `${day} ${now.toLocaleString('default', { month: 'short' })}`, day, value: dayTotal });
      }
    } else if (chartPeriod === 'last-30') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStr = d.toISOString().split('T')[0];
        let dayTotal = 0;
        bills.forEach(b => {
          if (b.invoiceType === 'proforma') return;
          if (b.invoiceDate === dayStr) {
            dayTotal += Number(b.totalAmount) || 0;
          }
        });
        periodTotal += dayTotal;
        points.push({ label: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`, value: dayTotal });
      }
    } else {
      // this-year
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 0; m < 12; m++) {
        let mTotal = 0;
        bills.forEach(b => {
          if (b.invoiceType === 'proforma') return;
          if (!b.invoiceDate) return;
          const d = new Date(b.invoiceDate);
          if (d.getFullYear() === now.getFullYear() && d.getMonth() === m) {
            mTotal += Number(b.totalAmount) || 0;
          }
        });
        periodTotal += mTotal;
        points.push({ label: monthNames[m], value: mTotal });
      }
    }

    const maxValue = Math.max(...points.map(p => p.value), 1);
    return { points, periodTotal, maxValue };
  }, [bills, chartPeriod]);

  useEffect(() => {
    let result = bills;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        (b.clientName || '').toLowerCase().includes(q) ||
        (b.invoiceNumber || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') result = result.filter(b => (b.invoiceType || 'tax-invoice') === typeFilter);
    if (statusFilter !== 'all') result = result.filter(b => (b.status || 'unpaid') === statusFilter);
    if (fyFilter !== 'all') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy) result = result.filter(b => b.invoiceDate >= fy.from && b.invoiceDate <= fy.to);
    }
    if (dateFrom) result = result.filter(b => b.invoiceDate >= dateFrom);
    if (dateTo) result = result.filter(b => b.invoiceDate <= dateTo);
    setFiltered(result);
  }, [bills, search, typeFilter, statusFilter, fyFilter, dateFrom, dateTo]);

  const handleDelete = async (bill) => {
    const ok = await confirmAction({
      title: 'Delete this invoice?',
      message: `Invoice ${bill.invoiceNumber} for ${bill.clientName} will be soft-deleted (moved to Trash for 30 days). Stock will be restored for any products in this invoice.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) {
      try {
        // Restore stock for products used in this invoice
        if (bill.data?.items) {
          const products = await getAllProducts();
          for (const item of bill.data.items) {
            if (!item.productId) continue;
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;
            await saveProduct({ ...product, stock: (product.stock || 0) + (item.quantity || 0) });
          }
        }
        await deleteBill(bill.id);

        // Move saved PDF to Trash folder
        const prefix = { 'tax-invoice': 'INV', 'proforma': 'PRO', 'credit-note': 'CN', 'bill-of-supply': 'BOS', 'delivery-challan': 'DC' }[bill.invoiceType || 'tax-invoice'] || 'INV';
        const pdfName = `${prefix}_${(bill.invoiceNumber || '').replace(/\//g, '-')}.pdf`;
        const clientName = bill.clientName || bill.data?.client?.name || 'General';
        fetch('/api/trash-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: pdfName, clientName }) }).catch(err => console.warn('Could not trash PDF:', err));

        toast('Invoice deleted & stock restored', 'success');
        loadBills();
      } catch { toast('Failed to delete', 'error'); }
    }
  };

  const handleView = (bill) => {
    if (bill.data) onEdit(bill);
    else toast('No editable data saved for this invoice', 'warning');
  };

  const changeStatus = async (bill, newStatus) => {
    const updated = { ...bill, status: newStatus };
    if (newStatus === 'paid') {
      updated.paidAmount = bill.totalAmount;
      // When flipping to paid via the row menu, also push a synthetic payment
      // so the payment-history modal and ReportsView cashflow both reflect
      // it. Without this, "Mark as Paid" left `payments: []` and the two
      // reports disagreed with the bill's status.
      const already = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const outstanding = Math.max(0, Number(bill.totalAmount) - already);
      if (outstanding > 0) {
        updated.payments = [...(bill.payments || []), {
          amount: outstanding,
          date: new Date().toISOString().split('T')[0],
          mode: 'other',
          note: 'Marked paid',
          recordedAt: new Date().toISOString(),
        }];
      }
    }
    await saveBill(updated, { overwrite: true });
    toast(`Marked as ${STATUS_CONFIG[newStatus].label}`, 'info');
    loadBills();
  };

  const openPaymentModal = (bill) => {
    setPaymentModal(bill);
    setPaymentInput({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'bank-transfer', note: '' });
  };

  const recordPayment = async () => {
    const amount = parseFloat(paymentInput.amount);
    if (!isFinite(amount) || amount <= 0) {
      toast('Enter a positive payment amount', 'warning'); return;
    }
    const bill = paymentModal;
    const billTotal = Number(bill.totalAmount) || 0;
    const alreadyPaid = Number(bill.paidAmount) || 0;
    const outstanding = Math.max(0, billTotal - alreadyPaid);
    if (amount > outstanding + 0.01) {
      const proceed = await confirmAction({
        title: 'Record as overpayment?',
        message: `This payment (${formatCurrency(amount, bill.currency)}) is more than the outstanding balance (${formatCurrency(outstanding, bill.currency)}).\n\nThe extra will be saved as client credit and can be applied to future invoices.`,
        confirmLabel: 'Yes, record overpayment',
        tone: 'warning',
      });
      if (!proceed) return;
    }
    const paymentEntry = {
      id: 'pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      amount, date: paymentInput.date, mode: paymentInput.mode,
      note: paymentInput.note, recordedAt: new Date().toISOString(),
    };
    const payments = [...(bill.payments || []), paymentEntry];
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const updatedBill = {
      ...bill, payments, paidAmount: totalPaid,
      status: totalPaid >= billTotal ? 'paid' : 'partial',
    };
    await saveBill(updatedBill, { overwrite: true });
    // v1.10.10 — Also persist a Receipt record so this payment shows up
    // in the Receipts view. Prior code only appended to bill.payments —
    // the standalone Receipts page saw "No receipts generated yet"
    // even after multiple payments were recorded, which was the user's
    // exact complaint. `saveReceipt` writes to data/receipts/*.json.
    try {
      await saveReceipt({
        id: paymentEntry.id,
        date: paymentEntry.date,
        receiptNo: `RCPT-${paymentEntry.id.replace('pay_', '').toUpperCase().slice(0, 10)}`,
        clientName: bill.data?.client?.name || bill.clientName || '',
        clientAddress: bill.data?.client?.address || '',
        amount: paymentEntry.amount,
        paymentMode: paymentEntry.mode,
        referenceNo: paymentEntry.note || '',
        againstInvoice: bill.invoiceNumber || bill.id || '',
        note: paymentEntry.note || '',
        currency: bill.currency || bill.data?.invoiceOptions?.currency || 'INR',
        source: 'auto-from-payment',
        billId: bill.id,
      });
    } catch { /* non-fatal — receipt is still viewable from the invoice's Payment History */ }
    toast(`Payment of ${formatCurrency(amount, bill.currency)} recorded`, 'success');
    setPaymentModal(null);
    // v1.10.22 — reported: "Balance should be 1 but calculating zero" —
    // ₹649 invoice + ₹650 paid was hiding the ₹1 overpayment because the
    // remaining calc used Math.max(0, …). Now: send the signed value so
    // the receipt can show "Overpaid ₹1" instead of silently rounding away.
    setReceiptTarget({ bill: updatedBill, payment: paymentEntry, remaining: billTotal - totalPaid });
    loadBills();
  };

  // v1.10.9 — Reprint / view an existing payment's receipt.
  const openReceiptFor = (bill, payment) => {
    const totalPaid = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    // v1.10.22 — signed remaining; see setReceiptTarget above for context.
    setReceiptTarget({ bill, payment, remaining: Number(bill.totalAmount || 0) - totalPaid });
  };

  // v1.10.10 — Delete/Edit a specific payment BY INDEX.
  // Prior code used `p.id === paymentId`, but legacy payments (recorded
  // before v1.10.9 which added `pay_<base36>` ids) don't have ids —
  // `(p.id || '') === undefined` matched EVERY legacy row, so editing
  // one silently edited none (or all). Now the caller passes the row
  // index directly. Modern rows still have ids for the receipt modal
  // to reference, but mutation is index-based.
  const deletePaymentAt = async (bill, idx) => {
    if (!await confirmAction({
      title: 'Delete this payment?',
      message: 'The invoice will revert to unpaid/partial if the sum drops below the total.',
      confirmLabel: 'Delete payment',
      tone: 'danger',
    })) return;
    const target = (bill.payments || [])[idx];
    const payments = (bill.payments || []).filter((_, i) => i !== idx);
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const total = Number(bill.totalAmount) || 0;
    const updated = { ...bill, payments, paidAmount: totalPaid, status: totalPaid >= total && total > 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid') };
    await saveBill(updated, { overwrite: true });
    // v1.10.10 — Also remove the linked Receipt record so the Receipts
    // page stays in sync. Silently skips if this was a legacy payment
    // that never had a receipt written (pre-v1.10.10 recordings).
    if (target?.id) {
      try { await deleteReceipt(target.id); } catch { /* ignore */ }
    }
    toast('Payment deleted', 'success');
    setPaymentModal(updated);
    loadBills();
  };

  // v1.10.13 — reported: "receipt edit option edit only enables to add
  // notes to that should give option to edit the amount too because by
  // mistake if wrong amount entered, customer without delete can edit
  // directly". Now opens a proper edit modal (see editPaymentModal
  // state + JSX below) that lets the user change amount, date, mode,
  // and note together — with the same "cannot exceed outstanding"
  // guard that recordPayment already enforces.
  const editPaymentAt = (bill, idx) => {
    const target = (bill.payments || [])[idx];
    if (!target) return;
    setEditPaymentModal({
      bill, idx,
      form: {
        amount: String(target.amount || ''),
        date: target.date || new Date().toISOString().split('T')[0],
        mode: target.mode || 'bank-transfer',
        note: target.note || '',
      },
    });
  };

  const saveEditedPayment = async () => {
    if (!editPaymentModal) return;
    const { bill, idx, form } = editPaymentModal;
    const newAmount = parseFloat(form.amount);
    if (!isFinite(newAmount) || newAmount <= 0) {
      toast('Enter a positive amount', 'warning'); return;
    }
    // Check the new total doesn't exceed the invoice unless user confirms.
    const others = (bill.payments || []).filter((_, i) => i !== idx);
    const othersSum = others.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const newTotal = othersSum + newAmount;
    const billTotal = Number(bill.totalAmount) || 0;
    if (newTotal > billTotal + 0.01) {
      const ok = await confirmAction({
        title: 'Save as overpayment?',
        message: `This edit brings the total received (${formatCurrency(newTotal, bill.currency)}) above the invoice total (${formatCurrency(billTotal, bill.currency)}).`,
        confirmLabel: 'Save overpayment',
        tone: 'warning',
      });
      if (!ok) return;
    }
    const target = (bill.payments || [])[idx];
    const withId = target.id || ('pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const payments = (bill.payments || []).map((p, i) => i === idx
      ? { ...p, id: withId, amount: newAmount, date: form.date, mode: form.mode, note: form.note }
      : p);
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const status = totalPaid >= billTotal && billTotal > 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');
    const updated = { ...bill, payments, paidAmount: totalPaid, status };
    await saveBill(updated, { overwrite: true });
    // Also update the linked Receipt record so the Receipts page reflects the edit.
    try {
      await saveReceipt({
        id: withId,
        date: form.date,
        receiptNo: `RCPT-${withId.replace('pay_', '').toUpperCase().slice(0, 10)}`,
        clientName: bill.data?.client?.name || bill.clientName || '',
        clientAddress: bill.data?.client?.address || '',
        amount: newAmount,
        paymentMode: form.mode,
        referenceNo: form.note || '',
        againstInvoice: bill.invoiceNumber || bill.id || '',
        note: form.note || '',
        currency: bill.currency || bill.data?.invoiceOptions?.currency || 'INR',
        source: 'auto-from-payment',
        billId: bill.id,
      });
    } catch { /* non-fatal */ }
    toast('Payment updated', 'success');
    setPaymentModal(updated);
    setEditPaymentModal(null);
    loadBills();
  };

  // ---- Bulk operations ----
  // All bulk handlers fan out concurrently via Promise.allSettled so one
  // failure can't strand the rest. After every bulk action we refresh the
  // bills list and clear the selection.
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSelectAllVisible = () => setSelectedIds(prev => {
    const allVisible = filtered.every(b => prev.has(b.id));
    if (allVisible) {
      // Deselect only the visible ones, leave any off-screen selections alone
      const next = new Set(prev);
      filtered.forEach(b => next.delete(b.id));
      return next;
    }
    const next = new Set(prev);
    filtered.forEach(b => next.add(b.id));
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());
  const getSelectedBills = () => bills.filter(b => selectedIds.has(b.id));

  const bulkMarkStatus = async (newStatus) => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    if (!await confirmAction({
      title: `Mark ${sel.length} invoice${sel.length !== 1 ? 's' : ''} as ${newStatus}?`,
      message: newStatus === 'paid'
        ? 'A synthetic payment will be recorded for each so payment history + cashflow stay consistent.'
        : 'The status change is reversible — you can flip it back any time.',
      confirmLabel: `Mark as ${newStatus}`,
    })) return;
    setBulkBusy(true);
    try {
      // Bulk mark-paid must push synthetic payments per bill so payment
       // history and cashflow stay consistent — see changeStatus above for
       // the same fix on the single-row path (P1 #18).
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const updates = sel.map(b => {
        const patch = { ...b, status: newStatus };
        if (newStatus === 'paid') {
          patch.paidAmount = b.totalAmount || 0;
          const already = (b.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const outstanding = Math.max(0, Number(b.totalAmount) - already);
          if (outstanding > 0) {
            patch.payments = [...(b.payments || []), {
              amount: outstanding, date: today, mode: 'other',
              note: 'Marked paid (bulk)', recordedAt: nowIso,
            }];
          }
        }
        return saveBill(patch, { overwrite: true });
      });
      const results = await Promise.allSettled(updates);
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) toast(`${sel.length - failed} updated, ${failed} failed`, 'warning');
      else toast(`Marked ${sel.length} as ${newStatus}`, 'success');
      clearSelection();
      loadBills();
    } catch (err) { toast('Bulk update failed: ' + err.message, 'error'); }
    setBulkBusy(false);
  };

  const bulkDelete = async () => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    if (!await confirmAction({
      title: `Delete ${sel.length} invoice${sel.length !== 1 ? 's' : ''}?`,
      message: 'The invoices will be moved to Trash for 30 days. The PDF copies in Saved Invoices/ stay untouched.',
      confirmLabel: `Delete ${sel.length}`,
      tone: 'danger',
    })) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(sel.map(b => deleteBill(b.id)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) toast(`${sel.length - failed} deleted, ${failed} failed`, 'warning');
      else toast(`Deleted ${sel.length} invoice${sel.length !== 1 ? 's' : ''}`, 'success');
      clearSelection();
      loadBills();
    } catch (err) { toast('Bulk delete failed: ' + err.message, 'error'); }
    setBulkBusy(false);
  };

  const bulkExportJSON = () => {
    const sel = getSelectedBills();
    if (sel.length === 0) return;
    // Lightweight "give me these N bills as a portable file". Different from
    // the full Settings → Export Backup — this is a per-selection share, e.g.
    // for sending a CA only Q1 invoices. Could be re-imported via the
    // existing Import Backup modal (which only restores ticked sections).
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      __freegstbill_backup: true,
      __selection: true,
      bills: sel,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freegstbill-bills-${sel.length}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${sel.length} invoice${sel.length !== 1 ? 's' : ''} as JSON`, 'success');
  };

  // Bulk PDF export — feature C from the v1.6.7 audit ("All March invoices
   // as one zip"). Renders each selected bill through the existing
   // InvoicePreview → jsPDF pipeline (see openBillPDF in this file's edit
   // handler) and stitches them into a single multi-page PDF. Zip would be
   // cleaner but pulling in JSZip inflates the bundle by ~140KB; one big
   // PDF is what CAs want anyway (one file to archive).
  // v1.10.35 — `billsOverride` skips the selectedIds read entirely. Used
  // by the "Quick print" filter buttons (bulkPrintByFilter) which need
  // to export a computed set WITHOUT waiting for a React state commit
  // — the old code called `setSelectedIds(new Set(target))` then
  // `setTimeout(bulkExportPDF, 20)`, but the setTimeout captured the
  // stale bulkExportPDF closure whose getSelectedBills read the OLD
  // (empty) selectedIds → silent no-op. Reported: "Paid button blinks,
  // shows nothing."
  const bulkExportPDF = async (billsOverride = null) => {
    const sel = billsOverride || getSelectedBills();
    if (sel.length === 0) return;
    if (sel.length > 100 && !await confirmAction({
      title: `Export ${sel.length} invoices?`,
      message: `This may take a minute and produce a large PDF file.`,
      confirmLabel: 'Continue',
      tone: 'warning',
    })) return;
    setBulkBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      // Build each bill in a hidden container, snap it, add as a page.
      // Reuses InvoicePreview via a dynamic import so its CSS + fonts
      // are hydrated once, then reused for each iteration.
      const InvoicePreviewMod = await import('./InvoicePreview');
      const { createRoot } = await import('react-dom/client');
      const { createElement } = await import('react');
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;background:#fff;';
      document.body.appendChild(container);
      const root = createRoot(container);
      // v1.10.3 — Audit H18/H19: bulk export used to freeze the tab
      // silently (no progress UI). On a 3× DPR Android, scale went to
      // 4.5× → 16MP canvas per invoice × 50 invoices retained as JPEG
      // data URLs = OOM before doc.save() fired. Now: capped scale,
      // per-invoice progress toast, immediate abort via
      // window.__fgsbBulkAbort.
      const capScale = Math.min(4, Math.max(2, Math.round((window.devicePixelRatio || 1) * 1.2)));
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch { /* non-fatal */ }
      }
      window.__fgsbBulkAbort = false;
      let ok = 0;
      for (let i = 0; i < sel.length; i++) {
        if (window.__fgsbBulkAbort) break;
        const bill = sel[i];
        const data = bill.data || {};
        // Progress every 5 invoices (or every one for very small batches).
        if (sel.length > 5 && (i % 5 === 0)) {
          toast(`Exporting ${i + 1} of ${sel.length}…`, 'info', 1500);
        }
        await new Promise((resolve) => {
          root.render(createElement(InvoicePreviewMod.default, {
            profile: data.profile, client: data.client, details: data.details, items: data.items,
            totals: data.totals, invoiceType: data.invoiceType, customTerms: data.customTerms,
            customNotes: data.customNotes, extraSections: data.extraSections, options: data.invoiceOptions,
          }));
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)));
        });
        try {
          const canvas = await html2canvas(container.firstElementChild || container, {
            scale: capScale,
            backgroundColor: '#ffffff', useCORS: false, logging: false,
          });
          const img = canvas.toDataURL('image/jpeg', 0.92);
          const w = 210, h = (canvas.height * 210) / canvas.width;
          if (ok > 0) doc.addPage();
          doc.addImage(img, 'JPEG', 0, 0, w, Math.min(h, 297), undefined, 'FAST');
          ok++;
        } catch (e) { /* skip broken bill silently */ }
        // Yield to the event loop between invoices so the browser can
        // paint the progress toast and handle any user click on Abort.
        await new Promise(r => setTimeout(r, 0));
      }
      root.unmount();
      document.body.removeChild(container);
      if (window.__fgsbBulkAbort) { toast(`Aborted after ${ok} of ${sel.length}`, 'warning'); }
      window.__fgsbBulkAbort = false;
      if (ok === 0) { toast('Could not generate any PDFs', 'error'); return; }
      const filename = `freegstbill-invoices-${ok}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      toast(`Exported ${ok} of ${sel.length} invoices`, 'success');
    } catch (e) {
      toast('Bulk PDF export failed — see console', 'error');
      console.error('bulkExportPDF', e);
    }
    setBulkBusy(false);
  };

  // v1.9.1 — Quick bulk-print by filter. Reuses the existing bulkExportPDF
  // engine by temporarily overriding the selection with a computed set.
  // Selection is restored afterwards.
  const bulkPrintByFilter = async (filterKind) => {
    const targetBills = filterKind === 'all'
      ? filtered
      : filtered.filter(b => (filterKind === 'unpaid' ? (b.status || 'unpaid') === 'unpaid' : b.status === filterKind));
    if (targetBills.length === 0) {
      toast(`No ${filterKind === 'all' ? '' : filterKind + ' '}invoices to print`, 'warning');
      return;
    }
    // v1.10.35 — Pass the computed bill set directly. Prior code briefly
    // mutated selectedIds via setState then setTimeout(...bulkExportPDF)
    // which read stale state through the setTimeout closure and printed
    // nothing. Now the export runs immediately with the correct set and
    // the user's selection is left untouched.
    await bulkExportPDF(targetBills);
  };

  // v1.10.22 — Generate a single-bill PDF as a Blob. Split out of the
  // bulk-export path so the WhatsApp / native share flows can attach the
  // actual PDF via navigator.share (with a text-only URL fallback on
  // desktop / browsers that don't support file sharing yet).
  const generateSingleBillPdfBlob = async (bill) => {
    const data = bill.data || {};
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;
    const InvoicePreviewMod = await import('./InvoicePreview');
    const { createRoot } = await import('react-dom/client');
    const { createElement } = await import('react');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;background:#fff;';
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await new Promise((resolve) => {
        root.render(createElement(InvoicePreviewMod.default, {
          profile: data.profile, client: data.client, details: data.details, items: data.items,
          totals: data.totals, invoiceType: data.invoiceType, customTerms: data.customTerms,
          customNotes: data.customNotes, extraSections: data.extraSections, options: data.invoiceOptions,
        }));
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)));
      });
      const capScale = Math.min(4, Math.max(2, Math.round((window.devicePixelRatio || 1) * 1.2)));
      const canvas = await html2canvas(container.firstElementChild || container, {
        scale: capScale, backgroundColor: '#ffffff', useCORS: false, logging: false,
      });
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const h = (canvas.height * 210) / canvas.width;
      doc.addImage(img, 'JPEG', 0, 0, 210, Math.min(h, 297), undefined, 'FAST');
      return doc.output('blob');
    } finally {
      root.unmount();
      document.body.removeChild(container);
    }
  };

  // v1.10.24 — Build a rich WhatsApp / Email caption that carries the full
  // payment status. Reported: "please forward with text message too with
  // status op payment." On mobile the message rides as WhatsApp caption
  // alongside the PDF; on desktop (where PDF can't attach via Web Share)
  // this text is ALL the client sees, so we want it to stand alone.
  const buildShareMessage = (bill) => {
    const currency = bill.currency || bill.data?.invoiceOptions?.currency || 'INR';
    const fmt = (n) => formatCurrency(Number(n) || 0, currency);
    const total = Number(bill.totalAmount) || 0;
    const paidFromArr = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const paid = paidFromArr > 0 ? paidFromArr : (Number(bill.paidAmount) || 0);
    const outstanding = total - paid;
    const dueDate = bill.data?.details?.dueDate ? new Date(bill.data.details.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const invDate = bill.invoiceDate ? new Date(bill.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const businessName = profile?.businessName || '';
    const status = (bill.status || 'unpaid').toUpperCase();

    // Payment line adapts to state: fully paid / overpaid / partial / unpaid.
    let paymentLine;
    if (outstanding < -0.005) {
      paymentLine = `Paid: ${fmt(paid)}  (Overpaid by ${fmt(Math.abs(outstanding))})`;
    } else if (outstanding <= 0.005) {
      paymentLine = `Paid: ${fmt(paid)}  ✅ FULLY PAID`;
    } else if (paid > 0.005) {
      paymentLine = `Paid: ${fmt(paid)}  ·  *Outstanding: ${fmt(outstanding)}*`;
    } else {
      paymentLine = `*Amount Due: ${fmt(total)}*`;
    }

    const lines = [
      `*Invoice: ${bill.invoiceNumber}*`,
      `Date: ${invDate}${dueDate ? `   ·   Due: ${dueDate}` : ''}`,
      `Client: ${bill.clientName}`,
      `Total: ${fmt(total)}`,
      paymentLine,
      `Status: ${status}`,
    ];
    if (businessName) lines.push('', `— ${businessName}`);
    return lines.join('\n');
  };

  const shareWhatsApp = async (bill) => {
    const msg = buildShareMessage(bill);
    // v1.10.22 — try the native Web Share API first, with the actual PDF
    // attached. On mobile Chrome / Safari the share sheet lets the user
    // pick WhatsApp (or any other target). Falls through to the text-only
    // wa.me URL on desktop and older browsers.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        toast('Preparing PDF for share…', 'info', 1500);
        const blob = await generateSingleBillPdfBlob(bill);
        const file = new File([blob], `${bill.invoiceNumber}.pdf`, { type: 'application/pdf' });
        const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
        if (canShareFile) {
          await navigator.share({
            title: `Invoice ${bill.invoiceNumber}`,
            text: msg,
            files: [file],
          });
          return;
        }
      } catch (e) {
        // AbortError = user dismissed the share sheet; not an error.
        if (e?.name !== 'AbortError') console.warn('Web Share failed, falling back to WhatsApp URL:', e);
        else return;
      }
    }
    // Fallback: text-only WhatsApp URL (existing behaviour).
    // v1.10.24 — Explain WHY the PDF didn't attach the first time a
    // desktop user hits this path. Once per session, then silent — no
    // one wants a toast on every share. Framed as a browser limitation
    // (which is what it is) so users don't blame the app.
    try {
      if (!sessionStorage.getItem('fgsb_whatsappDesktopExplained')) {
        toast('Desktop browsers can\'t attach PDF to WhatsApp Web (a browser security rule). Sharing invoice details as text — download PDF and drop it into WhatsApp Web manually if you need the file. On phone the PDF attaches automatically.', 'info', 7000);
        sessionStorage.setItem('fgsb_whatsappDesktopExplained', '1');
      }
    } catch { /* sessionStorage sandboxed — skip */ }
    openWhatsAppShare(bill.clientPhone, msg);
  };

  const shareEmail = (bill) => {
    // v1.10.24 — same rich payment status as the WhatsApp share (strip
    // markdown asterisks since mailto: doesn't render them).
    const subject = `Invoice ${bill.invoiceNumber} - ${formatCurrency(bill.totalAmount, bill.currency)}`;
    const richBody = buildShareMessage(bill).replace(/\*/g, '');
    const body = `Dear ${bill.clientName},\n\n${richBody}\n\nRegards`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const clearFilters = () => {
    setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setFyFilter('all'); setDateFrom(''); setDateTo('');
  };

  // v1.10.4 — trivial boolean, still cheap but consistent with the rest.
  const hasFilters = useMemo(
    () => Boolean(search || typeFilter !== 'all' || statusFilter !== 'all' || fyFilter !== 'all' || dateFrom || dateTo),
    [search, typeFilter, statusFilter, fyFilter, dateFrom, dateTo]);

  const sendReminder = (bill) => {
    const clientPhone = bill.clientPhone || bill.data?.client?.phone || '';
    const clientName = bill.clientName || 'Sir/Madam';
    const dueDate = bill.data?.details?.dueDate ? new Date(bill.data.details.dueDate).toLocaleDateString('en-IN') : 'N/A';
    const businessName = profile?.businessName || 'Our Company';
    const outstanding = (bill.totalAmount || 0) - (bill.paidAmount || 0);
    // v1.10.23 — don't send a payment reminder for overpaid or already-paid
    // bills. The old message read "Hi X, kindly arrange the payment of -₹1"
    // which is obviously wrong.
    if (outstanding <= 0.005) {
      toast('This invoice has no outstanding balance — no reminder to send.', 'info');
      return;
    }
    const outstandingStr = formatCurrency(outstanding, bill.currency);
    const totalStr = formatCurrency(bill.totalAmount || 0, bill.currency);
    // v1.10.12 — Status-aware message. Prior code said "due on X" even
    // for partial invoices, which read oddly ("paid Rs. 5000 was due
    // on...") to clients. Now the wording matches the actual state.
    const isPartial = (bill.paidAmount || 0) > 0.01 && outstanding > 0.01;
    const isOverdueDate = bill.data?.details?.dueDate && new Date(bill.data.details.dueDate) < new Date();
    const msg = isPartial
      ? `Hi ${clientName}, this is a gentle reminder that a balance of ${outstandingStr} is pending on Invoice ${bill.invoiceNumber} (total ${totalStr}). Kindly clear the remaining amount at your earliest convenience. Thank you! - ${businessName}`
      : isOverdueDate
        ? `Hi ${clientName}, this is a gentle reminder that Invoice ${bill.invoiceNumber} for ${outstandingStr} was due on ${dueDate}. Kindly arrange the payment at your earliest convenience. Thank you! - ${businessName}`
        : `Hi ${clientName}, this is a gentle reminder about the pending payment of ${outstandingStr} on Invoice ${bill.invoiceNumber}. Kindly arrange the payment at your earliest convenience. Thank you! - ${businessName}`;
    openWhatsAppShare(clientPhone, msg);
  };

  const getClientPhone = (bill) => {
    if (bill.clientPhone) return bill.clientPhone;
    if (bill.data?.client?.phone) return bill.data.client.phone;
    const savedClient = clients.find(c => c.name === bill.clientName);
    return savedClient?.phone || '';
  };

  // v1.10.4 — audit M14. Both were rebuilt every render even though
  // they only change when `bills` changes.
  const overdueBills = useMemo(() => bills.filter(b => b.status === 'overdue'), [bills]);
  const overdueByCurrency = useMemo(() => {
    const acc = {};
    for (const b of overdueBills) {
      const cur = b.currency || b.data?.invoiceOptions?.currency || 'INR';
      acc[cur] = (acc[cur] || 0) + (b.totalAmount || 0) - (b.paidAmount || 0);
    }
    return acc;
  }, [overdueBills]);
  const overdueStr = Object.entries(overdueByCurrency).map(([cur, amt]) => formatCurrency(amt, cur)).join(' + ');

  return (
    <div className="dashboard-container">
      {/* Vyapar Top Action Header */}
      <div className="vyapar-dashboard-header">
        <div className="vyapar-search-box">
          <Search size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search Transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="vyapar-search-input"
          />
        </div>

        <div className="vyapar-actions-group">
          <button className="vyapar-btn-sale" onClick={() => onNew && onNew('tax-invoice')} title="Create New Sale Invoice">
            <Plus size={16} /> Add Sale
          </button>
          <button className="vyapar-btn-purchase" onClick={() => onNavigate ? onNavigate('purchases') : null} title="Record Purchase Bill">
            <Plus size={16} /> Add Purchase
          </button>
          <HelpButton title="Dashboard — how to use">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Add Sale</strong> — start a fresh tax invoice / estimate / credit note.</li>
              <li><strong>Add Purchase</strong> — log purchase bills from suppliers.</li>
              <li><strong>Filter row</strong> — search by client name, invoice #, or GSTIN; filter by type / status / date range.</li>
            </ul>
          </HelpButton>
        </div>
      </div>

      {overdueBills.length > 0 && (
        <div className="overdue-banner" onClick={() => { setStatusFilter('overdue'); }}
          style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-light)', borderRadius: 10, padding: '0.85rem 1.25rem', marginBottom: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: '#dc2626' }}>
              {overdueBills.length} overdue invoice{overdueBills.length > 1 ? 's' : ''}
            </span>
            <span style={{ color: '#991b1b', marginLeft: 8, fontSize: '0.85rem' }}>
              — {overdueStr} outstanding
            </span>
          </div>
          <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}
            onClick={(e) => { e.stopPropagation(); setShowRemindAll(true); }}>
            <Send size={13} /> Remind All
          </button>
          <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 500 }}>View all &rarr;</span>
        </div>
      )}

      {/* Remind All Modal */}
      {showRemindAll && (
        <div className="modal-overlay" onClick={() => setShowRemindAll(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h3 className="section-title">Send Payment Reminders</h3>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Click on a client below to send a WhatsApp payment reminder.
            </p>
            {overdueBills.length === 0 ? (
              <p className="text-muted">No overdue invoices.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {overdueBills.map(bill => {
                  const phone = getClientPhone(bill);
                  return (
                    <div key={bill.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <span className="font-medium">{bill.clientName}</span>
                        <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.8rem' }}>{bill.invoiceNumber}</span>
                        {(() => {
                          const outCur = bill.currency || bill.data?.invoiceOptions?.currency;
                          const out = bill.totalAmount - (bill.paidAmount || 0);
                          if (out < -0.005) {
                            return <span style={{ marginLeft: 8, fontWeight: 600, color: '#0369a1', fontSize: '0.85rem' }}>
                              Overpaid {formatCurrency(Math.abs(out), outCur)}
                            </span>;
                          }
                          return <span style={{ marginLeft: 8, fontWeight: 600, color: '#dc2626', fontSize: '0.85rem' }}>
                            {formatCurrency(Math.max(0, out), outCur)}
                          </span>;
                        })()}
                        {phone && <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.75rem' }}>{phone}</span>}
                      </div>
                      <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                        onClick={() => sendReminder({ ...bill, clientPhone: phone })}>
                        <MessageCircle size={13} /> Remind
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setShowRemindAll(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Vyapar 2-Column Responsive Layout Grid */}
      <div className="vyapar-layout-grid">
        {/* Left Column: Metrics, Chart, Quick Reports, and Invoices Table */}
        <div className="vyapar-main-col">
          {/* Top 2 Vyapar KPI Cards */}
          <div className="vyapar-kpi-row">
            <div className="vyapar-kpi-card">
              <div>
                <div className="vyapar-kpi-title">Total Receivable</div>
                <div className="vyapar-kpi-val">
                  {formatCurrency(receivableData.total, profile?.currency || 'INR')}
                </div>
                <div className="vyapar-kpi-sub">
                  From {receivableData.count} {receivableData.count === 1 ? 'Party' : 'Parties'}
                </div>
              </div>
              <div className="vyapar-kpi-badge vyapar-badge-down">
                <ArrowDown size={22} />
              </div>
            </div>

            <div className="vyapar-kpi-card">
              <div>
                <div className="vyapar-kpi-title">Total Payable</div>
                <div className="vyapar-kpi-val">
                  {formatCurrency(payableData.total, profile?.currency || 'INR')}
                </div>
                <div className="vyapar-kpi-sub">
                  From {payableData.count} {payableData.count === 1 ? 'Party' : 'Parties'}
                </div>
              </div>
              <div className="vyapar-kpi-badge vyapar-badge-up">
                <ArrowUp size={22} />
              </div>
            </div>
          </div>

          {/* Vyapar Sales Trend Graph Card */}
          <div className="vyapar-card">
            <div className="vyapar-chart-header">
              <div>
                <div className="vyapar-chart-title">Total Sale</div>
                <div className="vyapar-chart-val">
                  {formatCurrency(chartData.periodTotal, profile?.currency || 'INR')}
                </div>
              </div>
              <select
                className="vyapar-period-select"
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value)}
              >
                <option value="this-month">This Month</option>
                <option value="last-30">Last 30 Days</option>
                <option value="this-year">This Year</option>
              </select>
            </div>

            {/* Smooth SVG Line Chart */}
            <div style={{ position: 'relative', width: '100%', height: 210 }}>
              {(() => {
                const W = 680;
                const H = 200;
                const padL = 40;
                const padR = 20;
                const padT = 20;
                const padB = 30;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;
                const maxVal = chartData.maxValue > 0 ? chartData.maxValue : 1;
                const pts = chartData.points;
                
                const coords = pts.map((p, idx) => {
                  const x = padL + (idx / Math.max(pts.length - 1, 1)) * plotW;
                  const norm = p.value / maxVal;
                  const y = padT + plotH - (norm * plotH);
                  return { x, y, label: p.label, value: p.value };
                });

                let pathD = coords.length ? `M ${coords[0].x} ${coords[0].y}` : '';
                for (let i = 0; i < coords.length - 1; i++) {
                  const p0 = coords[i];
                  const p1 = coords[i + 1];
                  const cx = (p0.x + p1.x) / 2;
                  pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
                }
                const areaD = coords.length ? `${pathD} L ${coords[coords.length - 1].x} ${padT + plotH} L ${coords[0].x} ${padT + plotH} Z` : '';

                const gridLevels = [0, 0.25, 0.5, 0.75, 1];

                return (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="vyaparChartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {gridLevels.map((lvl, idx) => {
                      const y = padT + plotH - lvl * plotH;
                      const yVal = Math.round(lvl * maxVal);
                      return (
                        <g key={idx}>
                          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
                          <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                            {yVal >= 1000 ? `${(yVal / 1000).toFixed(0)}k` : yVal}
                          </text>
                        </g>
                      );
                    })}

                    {areaD && <path d={areaD} fill="url(#vyaparChartGrad)" />}
                    {pathD && <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />}

                    {coords.map((c, i) => (
                      <circle
                        key={i}
                        cx={c.x}
                        cy={c.y}
                        r={hoverDataPoint?.index === i ? 5 : 2.5}
                        fill="#2563eb"
                        stroke="#ffffff"
                        strokeWidth={hoverDataPoint?.index === i ? 2 : 1}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={() => setHoverDataPoint({ ...c, index: i })}
                        onMouseLeave={() => setHoverDataPoint(null)}
                      />
                    ))}

                    {coords.filter((_, i) => i % Math.max(1, Math.floor(coords.length / 7)) === 0 || i === coords.length - 1).map((c, i) => (
                      <text key={i} x={c.x} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                        {c.label}
                      </text>
                    ))}
                  </svg>
                );
              })()}

              {hoverDataPoint && (
                <div style={{
                  position: 'absolute',
                  left: `${(hoverDataPoint.x / 680) * 100}%`,
                  top: `${(hoverDataPoint.y / 200) * 100}%`,
                  transform: 'translate(-50%, -120%)',
                  background: '#1e293b',
                  color: '#ffffff',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 10,
                }}>
                  <div>{hoverDataPoint.label}</div>
                  <div style={{ color: '#60a5fa' }}>{formatCurrency(hoverDataPoint.value, profile?.currency || 'INR')}</div>
                </div>
              )}
            </div>
          </div>

          {/* Most Used Reports Row */}
          <div className="vyapar-card">
            <div className="vyapar-reports-header">
              <span className="vyapar-reports-title">Most Used Reports</span>
              <button className="vyapar-reports-viewall" onClick={() => onNavigate ? onNavigate('reports') : null}>
                View All <ChevronRight size={14} />
              </button>
            </div>
            <div className="vyapar-reports-grid">
              <div className="vyapar-report-tile" onClick={() => onNavigate ? onNavigate('reports') : null}>
                <span>Sale Report</span>
                <ChevronRight size={16} style={{ color: '#2563eb' }} />
              </div>
              <div className="vyapar-report-tile" onClick={() => onNavigate ? onNavigate('reports') : null}>
                <span>All Transactions</span>
                <ChevronRight size={16} style={{ color: '#2563eb' }} />
              </div>
              <div className="vyapar-report-tile" onClick={() => onNavigate ? onNavigate('reports') : null}>
                <span>Daybook Report</span>
                <ChevronRight size={16} style={{ color: '#2563eb' }} />
              </div>
              <div className="vyapar-report-tile" onClick={() => onNavigate ? onNavigate('clients') : null}>
                <span>Party Statement</span>
                <ChevronRight size={16} style={{ color: '#2563eb' }} />
              </div>
            </div>
          </div>


      <div className="glass-panel">
        <div className="table-header"><h3>Invoices</h3></div>
        <div className="filters-bar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search client or invoice..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            <option value="all">All Years</option>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {Object.entries(INVOICE_TYPES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
          </select>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <input type="date" className="filter-date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From" />
          <input type="date" className="filter-date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To" />
          {hasFilters && <button className="icon-btn icon-btn-red" onClick={clearFilters} title="Clear" aria-label="Clear filters"><X size={15} /></button>}
          <button type="button" className="btn btn-secondary" onClick={() => setShowColumnPicker(v => !v)}
            title="Choose which columns to show" aria-label="Column picker"
            style={{ marginLeft: 'auto', fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
            <FileText size={15} /> Columns
          </button>
        </div>

        {/* v1.9.4 — column picker popover */}
        {showColumnPicker && (
          <div style={{
            padding: '0.75rem 1rem', margin: '0.5rem 0',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Pick columns to show
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {[
                ['date', 'Date'], ['invoice', 'Invoice #'], ['type', 'Type'],
                ['client', 'Client'], ['amount', 'Amount'], ['currency', 'Currency'],
                ['status', 'Status'], ['dueDate', 'Due date'],
                ['printed', 'Print count'], ['actions', 'Actions'],
              ].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!visibleColumns[key]}
                    onChange={e => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                    style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* v1.9.1 — Quick bulk-print filters. One-click "print everything
             matching X" without needing to manually tick rows. Useful for
             month-end filing, wholesale reminders, CA handoffs. */}
        <div style={{
          padding: '0.5rem 0.85rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
          alignItems: 'center', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick print:
          </span>
          <button type="button" className="btn btn-secondary" disabled={bulkBusy}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            onClick={() => bulkPrintByFilter('all')}
            title="Combine all filtered invoices into one PDF">
            <Download size={12} /> All shown ({filtered.length})
          </button>
          <button type="button" className="btn btn-secondary" disabled={bulkBusy}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            onClick={() => bulkPrintByFilter('unpaid')}>
            <Clock size={12} /> Unpaid ({filtered.filter(b => (b.status || 'unpaid') === 'unpaid').length})
          </button>
          <button type="button" className="btn btn-secondary" disabled={bulkBusy}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            onClick={() => bulkPrintByFilter('overdue')}>
            <AlertTriangle size={12} /> Overdue ({filtered.filter(b => b.status === 'overdue').length})
          </button>
          <button type="button" className="btn btn-secondary" disabled={bulkBusy}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
            onClick={() => bulkPrintByFilter('paid')}>
            <CheckCircle size={12} /> Paid ({filtered.filter(b => b.status === 'paid').length})
          </button>
        </div>

        {/* Bulk-action toolbar — only renders when at least one row is ticked. */}
        {selectedIds.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            padding: '0.6rem 0.85rem', marginBottom: '0.6rem',
            background: 'var(--info-bg)', border: '1px solid var(--info-border)',
            borderRadius: '8px', color: 'var(--info-text)',
          }}>
            <strong style={{ fontSize: '0.88rem' }}>{selectedIds.size} selected</strong>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('paid')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><CheckCircle size={13} /> Mark paid</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('unpaid')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><Clock size={13} /> Mark unpaid</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={() => bulkMarkStatus('overdue')}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><AlertTriangle size={13} /> Mark overdue</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkExportJSON}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}><FileText size={13} /> Export JSON</button>
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkExportPDF}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} title="Combine selected invoices into one multi-page PDF — CAs love this for filing archives"><Download size={13} /> Bulk PDF</button>
            {/* v1.10.7 — Cancel button for the in-flight bulk export. The
                 underlying abort flag was wired in v1.10.3; this is the
                 UI surface promised by that changelog. Setting the flag
                 stops the export loop after the current invoice, so
                 whatever's already assembled still gets saved. */}
            {bulkBusy && (
              <button type="button" className="btn btn-secondary"
                onClick={() => { window.__fgsbBulkAbort = true; }}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--warn-text)', borderColor: 'var(--warn-border)' }}
                title="Stop the bulk export after the current invoice — partial results still get saved."><X size={13} /> Cancel</button>
            )}
            <button type="button" className="btn btn-secondary" disabled={bulkBusy} onClick={bulkDelete}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              <Trash2 size={13} /> Delete
            </button>
            <button type="button" className="icon-btn" onClick={clearSelection} title="Clear selection" style={{ marginLeft: 'auto' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <p>{bills.length === 0 ? 'No invoices yet.' : 'No invoices match your filters.'}</p>
            {bills.length === 0 && <button className="btn btn-primary" onClick={() => onNew && onNew('tax-invoice')}><Plus size={18} /> Create Invoice</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '32px', padding: '0.5rem 0.25rem 0.5rem 0.75rem' }}>
                    <input type="checkbox"
                      checked={filtered.length > 0 && filtered.every(b => selectedIds.has(b.id))}
                      onChange={toggleSelectAllVisible}
                      title="Select all visible"
                      style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  </th>
                  {visibleColumns.date && <th>Date</th>}
                  {visibleColumns.invoice && <th>Invoice No.</th>}
                  {visibleColumns.type && <th>Type</th>}
                  {visibleColumns.client && <th>Client</th>}
                  {visibleColumns.amount && <th>Amount</th>}
                  {visibleColumns.currency && <th>Currency</th>}
                  {visibleColumns.dueDate && <th>Due Date</th>}
                  {visibleColumns.printed && <th>Printed</th>}
                  <th>Paid</th>
                  {visibleColumns.status && <th>Status</th>}
                  {visibleColumns.actions && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(bill => {
                  const status = bill.status || 'unpaid';
                  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;
                  const isOverdue = status !== 'paid' && bill.data?.details?.dueDate && new Date(bill.data.details.dueDate) < new Date();
                  const daysOverdue = isOverdue ? Math.floor((new Date() - new Date(bill.data.details.dueDate)) / 86400000) : 0;
                  const billCurrency = bill.currency || bill.data?.invoiceOptions?.currency || 'INR';
                  return (
                    <tr key={bill.id} className={isOverdue || status === 'overdue' ? 'row-overdue' : ''}
                      style={selectedIds.has(bill.id) ? { background: 'var(--info-bg)' } : undefined}>
                      <td style={{ padding: '0.5rem 0.25rem 0.5rem 0.75rem' }}>
                        <input type="checkbox" checked={selectedIds.has(bill.id)} onChange={() => toggleSelect(bill.id)}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                      </td>
                      {visibleColumns.date && <td className="text-muted">{new Date(bill.invoiceDate).toLocaleDateString('en-IN')}</td>}
                      {visibleColumns.invoice && <td><span className="invoice-badge">{bill.invoiceNumber}</span></td>}
                      {visibleColumns.type && <td><span className="type-badge">{(INVOICE_TYPES[bill.invoiceType || 'tax-invoice'])?.label}</span></td>}
                      {visibleColumns.client && <td className="font-medium td-client" title={bill.clientName}>
                        {bill.clientName}
                        {bill.data?.internalNote && (
                          <span title={bill.data.internalNote} style={{ marginLeft: 4, cursor: 'help', verticalAlign: 'middle' }}>
                            <StickyNote size={13} style={{ color: '#ca8a04' }} />
                          </span>
                        )}
                      </td>}
                      {visibleColumns.amount && <td className="font-bold">
                        {formatCurrency(bill.totalAmount, billCurrency)}
                        {billCurrency !== 'INR' && !visibleColumns.currency && <span className="currency-chip">{billCurrency}</span>}
                      </td>}
                      {visibleColumns.currency && <td className="text-muted">{billCurrency}</td>}
                      {visibleColumns.dueDate && <td className="text-muted">{bill.data?.details?.dueDate ? new Date(bill.data.details.dueDate).toLocaleDateString('en-IN') : <span className="cell-empty">—</span>}</td>}
                      {visibleColumns.printed && <td className="text-muted" style={{ textAlign: 'center' }}>{Number(bill.printedCount) || 0}×</td>}
                      <td className="text-muted">{(bill.paidAmount || 0) > 0 ? formatCurrency(bill.paidAmount, billCurrency) : <span className="cell-empty">—</span>}</td>
                      {visibleColumns.status && <td>
                        <select className="status-select" value={isOverdue && status !== 'overdue' ? 'overdue' : status}
                          style={{ background: sc.bg, color: sc.color, borderColor: sc.color + '44' }}
                          onChange={e => changeStatus(bill, e.target.value)}>
                          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                        {daysOverdue > 0 && <span style={{ fontSize: '0.7rem', color: '#dc2626', display: 'block', marginTop: 2 }}>{daysOverdue}d overdue</span>}
                      </td>}
                      {visibleColumns.actions && <td>
                        <div className="table-actions">
                          <button className="icon-btn icon-btn-blue" onClick={() => handleView(bill)} title="Edit"><Edit3 size={15} /></button>
                          <button className="icon-btn icon-btn-blue" onClick={() => onDuplicate(bill)} title="Duplicate"><Copy size={15} /></button>
                          {(bill.invoiceType === 'proforma' || bill.invoiceType === 'delivery-challan') && (
                            <button className="icon-btn icon-btn-green" onClick={() => onConvert(bill)} title="Convert to Tax Invoice"><FileText size={15} /></button>
                          )}
                          <button className="icon-btn icon-btn-green" onClick={() => openPaymentModal(bill)} title="Payment"><IndianRupee size={15} /></button>
                          <button className="icon-btn icon-btn-green" onClick={() => shareWhatsApp(bill)}
                            title="Share via WhatsApp — PDF attaches on mobile Chrome/Safari. On desktop it sends the invoice as text only (browser can't attach files to WhatsApp Web — security limitation, not our app).">
                            <MessageCircle size={15} />
                          </button>
                          {/* v1.10.12 — Payment-reminder button now shows for
                               UNPAID, PARTIAL, and OVERDUE bills (not just
                               overdue). Reported: "amount pending towards
                               customer should give option to send via
                               whatsapp or email as reminder predefined side
                               of every invoice. also for partial pending too". */}
                          {(isOverdue || status === 'overdue' || status === 'unpaid' || status === 'partial') && (bill.totalAmount || 0) - (bill.paidAmount || 0) > 0.01 && (
                            <button className="icon-btn icon-btn-green"
                              onClick={() => sendReminder({ ...bill, clientPhone: getClientPhone(bill) })}
                              title={status === 'partial' ? 'Send reminder — partial pending' : (status === 'overdue' || isOverdue ? 'Send reminder — overdue' : 'Send reminder — unpaid')}
                              style={{ color: status === 'partial' ? '#0284c7' : '#d97706' }}>
                              <Send size={15} />
                            </button>
                          )}
                          <button className="icon-btn icon-btn-blue" onClick={() => shareEmail(bill)} title="Email"><Mail size={15} /></button>
                          <button className="icon-btn icon-btn-red" onClick={() => handleDelete(bill)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* Right Column: Vyapar Financial Summary & Widgets */}
      <div className="vyapar-side-col">
        <div className="vyapar-side-card">
          {/* Purchases */}
          <div className="vyapar-side-metric-item" onClick={() => onNavigate ? onNavigate('purchases') : null} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>
            <div className="vyapar-side-metric-row">
              <span className="vyapar-side-metric-label">Purchases</span>
              <span className="vyapar-side-metric-tag">(This Month)</span>
            </div>
            <div className="vyapar-side-metric-val">
              {formatCurrency(financialSnapshot.purchasesThisMonth, profile?.currency || 'INR')}
            </div>
          </div>

          {/* Expenses */}
          <div className="vyapar-side-metric-item" onClick={() => onNavigate ? onNavigate('expenses') : null} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>
            <div className="vyapar-side-metric-row">
              <span className="vyapar-side-metric-label">Expenses</span>
              <span className="vyapar-side-metric-tag">(This Month)</span>
            </div>
            <div className="vyapar-side-metric-val">
              {formatCurrency(financialSnapshot.expensesThisMonth, profile?.currency || 'INR')}
            </div>
          </div>

          {/* Stock Value */}
          <div className="vyapar-side-metric-item" onClick={() => onNavigate ? onNavigate('products') : null} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>
            <div className="vyapar-side-metric-row">
              <span className="vyapar-side-metric-label">Stock Value</span>
              <span className="vyapar-side-metric-tag">(As of Now)</span>
            </div>
            <div className="vyapar-side-metric-val">
              {formatCurrency(inventoryValuation, profile?.currency || 'INR')}
            </div>
          </div>

          {/* Cash In Hand */}
          <div className="vyapar-side-metric-item">
            <div className="vyapar-side-metric-row">
              <span className="vyapar-side-metric-label">Cash In Hand</span>
              <span className="vyapar-side-metric-tag">(As of Now)</span>
            </div>
            <div className="vyapar-side-metric-val">
              {formatCurrency(financialSnapshot.cashInHand, profile?.currency || 'INR')}
            </div>
          </div>

          {/* Total Bank Balance */}
          <div className="vyapar-side-metric-item" onClick={() => onNavigate ? onNavigate('banking') : null} style={{ cursor: onNavigate ? 'pointer' : 'default' }}>
            <div className="vyapar-side-metric-row">
              <span className="vyapar-side-metric-label">Total Bank Balance</span>
              <span className="vyapar-side-metric-tag">(As of Now)</span>
            </div>
            <div className="vyapar-side-metric-val">
              {formatCurrency(financialSnapshot.bankBalance, profile?.currency || 'INR')}
            </div>
          </div>

          {/* Low Stocks Items */}
          <div className="vyapar-side-metric-item" style={{ borderBottom: 'none' }}>
            <div className="vyapar-side-metric-row">
              <span className="vyapar-side-metric-label">Low Stocks Items</span>
              <span className="vyapar-side-metric-tag" style={{ color: lowStockProducts.length > 0 ? '#ef4444' : undefined, fontWeight: 600 }}>
                ({lowStockProducts.length} Items)
              </span>
            </div>
            {lowStockProducts.length > 0 ? (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {(showAllLowStock ? lowStockProducts : lowStockProducts.slice(0, 3)).map((item, idx) => (
                  <div key={item.id || idx} className="vyapar-low-stock-item">
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>{item.name}</span>
                    <span style={{ fontWeight: 600, color: '#ef4444' }}>{Number(item.stock || 0).toFixed(2)} {item.unit || 'PCS'}</span>
                  </div>
                ))}
                {lowStockProducts.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllLowStock(v => !v)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '0.25rem 0',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {showAllLowStock ? 'See Less ∧' : `See More (${lowStockProducts.length - 3}) ∨`}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>No low stock alerts</div>
            )}
          </div>
        </div>

        {/* Add Widget Button */}
        <button className="vyapar-add-widget-btn" onClick={() => toast('Custom widgets configurable in settings', 'info')}>
          <span>+ Add Widget of Your Choice</span>
          <ChevronRight size={14} />
        </button>
      </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="section-title">Record Payment</h3>
            <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Invoice: <strong>{paymentModal.invoiceNumber}</strong> | Total: <strong>{formatCurrency(paymentModal.totalAmount, paymentModal.currency)}</strong>
              {(paymentModal.paidAmount || 0) > 0 && <> | Paid: <strong>{formatCurrency(paymentModal.paidAmount, paymentModal.currency)}</strong></>}
              {' '}| {(() => {
                // v1.10.23 — signed remaining so overpayments surface here too.
                const rem = paymentModal.totalAmount - (paymentModal.paidAmount || 0);
                if (rem < -0.005) {
                  return <>Overpaid: <strong style={{ color: '#0369a1' }}>{formatCurrency(Math.abs(rem), paymentModal.currency)}</strong></>;
                }
                return <>Balance: <strong style={{ color: rem > 0.005 ? '#dc2626' : '#059669' }}>{formatCurrency(Math.max(0, rem), paymentModal.currency)}</strong></>;
              })()}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Amount Received</label>
                <input type="number" className="form-input" value={paymentInput.amount}
                  onChange={e => setPaymentInput(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder={String(paymentModal.totalAmount - (paymentModal.paidAmount || 0))} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date</label>
                <input type="date" className="form-input" value={paymentInput.date}
                  onChange={e => setPaymentInput(prev => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="form-input" value={paymentInput.mode}
                  onChange={e => setPaymentInput(prev => ({ ...prev, mode: e.target.value }))}>
                  <option value="bank-transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={paymentInput.note}
                  onChange={e => setPaymentInput(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Transaction ID, ref..." />
              </div>
            </div>
            {paymentModal.payments?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <label className="form-label">Payment History</label>
                <div className="payment-history">
                  {/* v1.10.9 — each row now has View Receipt / Edit Note /
                      Delete actions. Prior code showed values only with no
                      way to reprint or fix a typo. */}
                  {paymentModal.payments.map((p, i) => (
                    <div key={p.id || i} className="payment-row" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ minWidth: 90 }}>{p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—'}</span>
                      <span className="font-bold" style={{ minWidth: 100 }}>{formatCurrency(p.amount, paymentModal.currency)}</span>
                      <span className="text-muted" style={{ minWidth: 90 }}>{p.mode}</span>
                      {p.note && <span className="text-muted" style={{ flex: 1 }}>· {p.note}</span>}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => openReceiptFor(paymentModal, p)}
                          title="View / Print receipt for this payment"><Receipt size={12} /> Receipt</button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => editPaymentAt(paymentModal, i)}
                          title="Edit amount / date / mode / note"><Edit3 size={12} /></button>
                        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => deletePaymentAt(paymentModal, i)}
                          title="Delete this payment"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setPaymentModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={recordPayment}>Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* v1.10.13 — Payment Edit modal. Lets the user fix a wrong amount
           without having to delete + re-record. Recomputes bill status
           on save; keeps the Receipts store in sync. */}
      {editPaymentModal && (
        <div className="modal-overlay" onClick={() => setEditPaymentModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Edit Payment</h3>
              <button className="icon-btn" onClick={() => setEditPaymentModal(null)} title="Close"><X size={18} /></button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              Invoice: <strong>{editPaymentModal.bill.invoiceNumber}</strong>
              {' '}| Total: <strong>{formatCurrency(editPaymentModal.bill.totalAmount, editPaymentModal.bill.currency)}</strong>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input type="number" className="form-input" value={editPaymentModal.form.amount}
                  onChange={e => setEditPaymentModal(prev => ({ ...prev, form: { ...prev.form, amount: e.target.value } }))}
                  min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={editPaymentModal.form.date}
                  onChange={e => setEditPaymentModal(prev => ({ ...prev, form: { ...prev.form, date: e.target.value } }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select className="form-input" value={editPaymentModal.form.mode}
                  onChange={e => setEditPaymentModal(prev => ({ ...prev, form: { ...prev.form, mode: e.target.value } }))}>
                  <option value="bank-transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Note / reference</label>
                <input type="text" className="form-input" value={editPaymentModal.form.note}
                  onChange={e => setEditPaymentModal(prev => ({ ...prev, form: { ...prev.form, note: e.target.value } }))}
                  placeholder="Transaction ID, ref..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={() => setEditPaymentModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEditedPayment}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* v1.10.9 — Payment Receipt modal. */}
      {receiptTarget && (
        <ReceiptModal target={receiptTarget} onClose={() => setReceiptTarget(null)} />
      )}
    </div>
  );
}
