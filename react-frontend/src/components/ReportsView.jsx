import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, Clock, Search, X,
  Users, Package, FileText, Download, Percent, AlertTriangle,
  CheckCircle2, MessageCircle, ArrowUpRight, ArrowDownLeft,
  ChevronDown, ChevronUp, RefreshCw, ShoppingCart, Layers,
  BookOpen, Landmark, Receipt, ShieldCheck, PieChart, Calendar,
  FolderOpen, ChevronRight
} from 'lucide-react';
import {
  getAllBills, getAllExpenses, getAllPurchases, getAllProducts,
  getAllClients, getAllSuppliers, getAllReceipts, getProfile
} from '../store';
import { formatCurrency, getFYOptions, getCountryConfig } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { openWhatsAppShare } from '../utils/share';
import { toast } from './Toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

const getBillCurrency = (b) => b.currency || b.data?.invoiceOptions?.currency || 'INR';

// CSV Export Utility
function downloadCSV(filename, headers, rows) {
  const escapeCell = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(r => r.map(escapeCell).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${filename}`, 'success');
}

// Vyapar Left-Tree Report Categories
const REPORT_TREE = [
  {
    group: 'Transaction Reports',
    icon: FileText,
    items: [
      { id: 'sale-report', label: 'Sale Report' },
      { id: 'purchase-report', label: 'Purchase Report' },
      { id: 'day-book', label: 'Day Book' },
      { id: 'all-txns', label: 'All Transactions' },
      { id: 'pl', label: 'Profit And Loss' },
      { id: 'bill-profit', label: 'Bill Wise Profit' },
      { id: 'cash-flow', label: 'Cash Flow' },
      { id: 'balance-sheet', label: 'Balance Sheet' },
    ]
  },
  {
    group: 'Party Reports',
    icon: Users,
    items: [
      { id: 'party-statement', label: 'Party Statement (Ledger)' },
      { id: 'all-parties', label: 'All Parties' },
      { id: 'party-profit', label: 'Party Wise Profit & Loss' },
      { id: 'aging', label: 'Party Aging (Due)' },
    ]
  },
  {
    group: 'GST Reports',
    icon: ShieldCheck,
    items: [
      { id: 'gstr-1', label: 'GSTR-1 (Sales)' },
      { id: 'gstr-2', label: 'GSTR-2 (Purchase ITC)' },
      { id: 'gstr-3b', label: 'GSTR-3B Summary' },
      { id: 'gst-rate-report', label: 'GST Rate Wise Summary' },
      { id: 'hsn-summary', label: 'SAC / HSN Summary' },
    ]
  },
  {
    group: 'Item / Stock Reports',
    icon: Package,
    items: [
      { id: 'stock-valuation', label: 'Stock Summary' },
      { id: 'item-profit', label: 'Item Wise Profit & Loss' },
      { id: 'sale-purchase-item', label: 'Sale / Purchase By Item' },
      { id: 'low-stock', label: 'Low Stock Summary' },
    ]
  },
  {
    group: 'Expense Reports',
    icon: Wallet,
    items: [
      { id: 'expense-category', label: 'Expense Category Report' },
    ]
  }
];

export default function ReportsView() {
  // Core Data
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [profile, setProfile] = useState({});
  const [, setLoading] = useState(true);

  // Active Report in Left-Tree Explorer
  const [activeTab, setActiveTab] = useState('pl');
  const [treeSearch, setTreeSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Global Period & Currency Filters
  const [filterMode, setFilterMode] = useState('fy'); // 'fy' | 'month' | 'custom' | 'all'
  const [fyFilter, setFyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('INR');

  // Report-Specific Filter States
  const [billProfitSearch, setBillProfitSearch] = useState('');
  const [billProfitFilter, setBillProfitFilter] = useState('all');
  const [expandedBillId, setExpandedBillId] = useState(null);

  const [itemProfitSearch, setItemProfitSearch] = useState('');
  const [itemProfitSort, setItemProfitSort] = useState('profit');

  const [agingTab, setAgingTab] = useState('receivables');
  const [agingSearch, setAgingSearch] = useState('');

  const [stockSearch, setStockSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');

  // New Vyapar Report Filters
  const [saleReportSearch, setSaleReportSearch] = useState('');
  const [saleStatusFilter, setSaleStatusFilter] = useState('all'); // 'all' | 'paid' | 'unpaid'

  const [purchaseReportSearch, setPurchaseReportSearch] = useState('');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState('all'); // 'all' | 'Paid' | 'Unpaid'

  const [dayBookDate, setDayBookDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dayBookAllDates, setDayBookAllDates] = useState(false);

  const [allTxnTypeFilter, setAllTxnTypeFilter] = useState('ALL');
  const [allTxnSearch, setAllTxnSearch] = useState('');

  const [selectedPartyName, setSelectedPartyName] = useState('');
  const [partyTypeFilter, setPartyTypeFilter] = useState('ALL'); // 'ALL' | 'RECEIVABLE' | 'PAYABLE'
  const [allPartiesSearch, setAllPartiesSearch] = useState('');

  const [gstr1SubTab, setGstr1SubTab] = useState('ALL'); // 'ALL' | 'B2B' | 'B2CL' | 'B2CS' | 'CDNR'

  const fyOptions = getFYOptions();
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  const profileCurrency = getCountryConfig(profile?.country || 'India').currency;

  const loadData = async () => {
    setLoading(true);
    try {
      const [billData, expData, purData, prodData, clData, supData, recData, profData] = await Promise.all([
        getAllBills().catch(() => []),
        getAllExpenses().catch(() => []),
        getAllPurchases().catch(() => []),
        getAllProducts().catch(() => []),
        getAllClients().catch(() => []),
        getAllSuppliers().catch(() => []),
        getAllReceipts().catch(() => []),
        getProfile().catch(() => ({})),
      ]);
      const validBills = Array.isArray(billData) ? billData : [];
      const validClients = Array.isArray(clData) ? clData : [];
      const validSuppliers = Array.isArray(supData) ? supData : [];
      setBills(validBills);
      setExpenses(Array.isArray(expData) ? expData : []);
      setPurchases(Array.isArray(purData) ? purData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
      setClients(validClients);
      setSuppliers(validSuppliers);
      setReceipts(Array.isArray(recData) ? recData : []);
      if (profData) setProfile(profData);
      if (!selectedPartyName && validClients.length > 0) {
        setSelectedPartyName(validClients[0].name);
      } else if (!selectedPartyName && validSuppliers.length > 0) {
        setSelectedPartyName(validSuppliers[0].name);
      }
    } catch {
      toast('Failed to load financial records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const fy = fyOptions[0];
    if (fy) {
      setFyFilter(fy.value);
      setCustomFrom(fy.from);
      setCustomTo(fy.to);
    }
    setYearFilter(String(now.getFullYear()));
    setMonthFilter(String(now.getMonth()));
    loadData();
  }, []);

  // Filter By Period helper
  const filterByPeriod = (date) => {
    if (!date) return false;
    const dStr = String(date).split('T')[0];
    if (filterMode === 'all') return true;
    if (filterMode === 'fy') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      return fy ? dStr >= fy.from && dStr <= fy.to : true;
    }
    if (filterMode === 'custom') {
      if (customFrom && dStr < customFrom) return false;
      if (customTo && dStr > customTo) return false;
      return true;
    }
    const d = new Date(date);
    return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === parseInt(monthFilter);
  };

  // Filtered datasets for active period
  const allFilteredBills = useMemo(() => {
    return bills.filter(bill => bill.type !== 'proforma' && bill.type !== 'estimate' && bill.type !== 'sale-order' && bill.type !== 'delivery-challan' && filterByPeriod(bill.invoiceDate || bill.date));
  }, [bills, filterMode, fyFilter, yearFilter, monthFilter, customFrom, customTo]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => (p.docType || 'purchase-bills') === 'purchase-bills' && filterByPeriod(p.date));
  }, [purchases, filterMode, fyFilter, yearFilter, monthFilter, customFrom, customTo]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => filterByPeriod(exp.date) && ((exp.currency || 'INR') === currencyFilter));
  }, [expenses, filterMode, fyFilter, yearFilter, monthFilter, customFrom, customTo, currencyFilter]);

  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => filterByPeriod(r.date));
  }, [receipts, filterMode, fyFilter, yearFilter, monthFilter, customFrom, customTo]);

  // Product purchase price lookup map
  const productCostMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => {
      const nameKey = (p.name || '').trim().toLowerCase();
      const cost = Number(p.purchasePrice) || Number(p.rate) || Number(p.weightedAverageCost) || 0;
      if (nameKey && cost > 0) map.set(nameKey, cost);
      if (p.id) map.set(String(p.id), cost);
    });
    purchases.forEach(pb => {
      (pb.items || []).forEach(it => {
        const itKey = (it.name || it.description || '').trim().toLowerCase();
        const itRate = Number(it.rate) || Number(it.price) || 0;
        if (itKey && itRate > 0 && !map.has(itKey)) {
          map.set(itKey, itRate);
        }
      });
    });
    return map;
  }, [products, purchases]);

  const allCurrencies = useMemo(() => {
    const currs = [...new Set(allFilteredBills.map(getBillCurrency))].filter(Boolean);
    return currs.length > 0 ? currs.sort() : ['INR'];
  }, [allFilteredBills]);

  useEffect(() => {
    if (allCurrencies.length > 0 && !allCurrencies.includes(currencyFilter)) {
      setCurrencyFilter(allCurrencies[0]);
    }
  }, [allCurrencies, currencyFilter]);

  const plBills = useMemo(() => {
    return allFilteredBills.filter(b => getBillCurrency(b) === currencyFilter && b.type !== 'creditnote');
  }, [allFilteredBills, currencyFilter]);

  // ============================================================
  // 1. BILL-WISE PROFIT & LOSS COMPUTATION
  // ============================================================
  const billProfitList = useMemo(() => {
    return plBills.map(bill => {
      const items = bill.data?.items || bill.items || [];
      let billCOGS = 0;
      const itemBreakdown = items.map(it => {
        const name = (it.name || it.description || 'Item').trim();
        const qty = Number(it.quantity) || 1;
        const sellRate = Number(it.rate) || 0;
        const sellTotal = qty * sellRate;
        const lookupCost = productCostMap.get(name.toLowerCase()) || 0;
        const unitCost = lookupCost > 0 ? lookupCost : (sellRate > 0 ? sellRate * 0.75 : 0);
        const totalCost = qty * unitCost;
        const profit = sellTotal - totalCost;
        const marginPct = sellTotal > 0 ? (profit / sellTotal) * 100 : 0;

        billCOGS += totalCost;
        return {
          name,
          qty,
          unit: it.unit || 'Unit',
          sellRate,
          sellTotal,
          unitCost,
          totalCost,
          profit,
          marginPct
        };
      });

      const revenue = Number(bill.totalAmount) || 0;
      const taxAmount = Number(bill.totalTaxAmount) || 0;
      const netSales = revenue - taxAmount;
      const grossProfit = netSales - billCOGS;
      const marginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

      return {
        id: bill.id || bill.invoiceNumber,
        invoiceNumber: bill.invoiceNumber || 'INV',
        date: bill.invoiceDate || bill.date,
        clientName: bill.clientName || 'Cash Sale',
        revenue,
        taxAmount,
        netSales,
        cogs: billCOGS,
        grossProfit,
        marginPct,
        status: bill.status || 'paid',
        items: itemBreakdown
      };
    });
  }, [plBills, productCostMap]);

  const filteredBillProfit = useMemo(() => {
    return billProfitList.filter(b => {
      const matchesSearch = !billProfitSearch.trim() ||
        b.invoiceNumber.toLowerCase().includes(billProfitSearch.toLowerCase()) ||
        b.clientName.toLowerCase().includes(billProfitSearch.toLowerCase());

      let matchesFilter = true;
      if (billProfitFilter === 'high') matchesFilter = b.marginPct >= 20;
      else if (billProfitFilter === 'med') matchesFilter = b.marginPct >= 5 && b.marginPct < 20;
      else if (billProfitFilter === 'low') matchesFilter = b.marginPct < 5;

      return matchesSearch && matchesFilter;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [billProfitList, billProfitSearch, billProfitFilter]);

  // ============================================================
  // 2. ITEM-WISE PROFIT & LOSS & SALE/PURCHASE BY ITEM
  // ============================================================
  const itemProfitList = useMemo(() => {
    const map = {};
    plBills.forEach(b => {
      const items = b.data?.items || b.items || [];
      items.forEach(it => {
        const name = (it.name || it.description || 'Unnamed Product').trim();
        if (!name || name === 'Unnamed Product') return;
        const qty = Number(it.quantity) || 0;
        const sellRate = Number(it.rate) || 0;
        const revenue = qty * sellRate;
        const unitCost = productCostMap.get(name.toLowerCase()) || (sellRate * 0.75);
        const cost = qty * unitCost;

        if (!map[name]) {
          map[name] = {
            name,
            hsn: it.hsn || '',
            unit: it.unit || 'Pcs',
            qty: 0,
            revenue: 0,
            cost: 0,
            txns: 0,
            lastSold: ''
          };
        }
        map[name].qty += qty;
        map[name].revenue += revenue;
        map[name].cost += cost;
        map[name].txns += 1;
        if (!map[name].lastSold || (b.invoiceDate || b.date) > map[name].lastSold) {
          map[name].lastSold = b.invoiceDate || b.date;
        }
        if (it.hsn && !map[name].hsn) map[name].hsn = it.hsn;
      });
    });

    return Object.values(map).map(p => {
      const grossProfit = p.revenue - p.cost;
      const marginPct = p.revenue > 0 ? (grossProfit / p.revenue) * 100 : 0;
      const avgSellRate = p.qty > 0 ? p.revenue / p.qty : 0;
      const avgCostRate = p.qty > 0 ? p.cost / p.qty : 0;
      return {
        ...p,
        grossProfit,
        marginPct,
        avgSellRate,
        avgCostRate
      };
    });
  }, [plBills, productCostMap]);

  const filteredItemProfit = useMemo(() => {
    return itemProfitList.filter(p => {
      return !itemProfitSearch.trim() ||
        p.name.toLowerCase().includes(itemProfitSearch.toLowerCase()) ||
        p.hsn.toLowerCase().includes(itemProfitSearch.toLowerCase());
    }).sort((a, b) => {
      if (itemProfitSort === 'profit') return b.grossProfit - a.grossProfit;
      if (itemProfitSort === 'margin') return b.marginPct - a.marginPct;
      if (itemProfitSort === 'qty') return b.qty - a.qty;
      return b.revenue - a.revenue;
    });
  }, [itemProfitList, itemProfitSearch, itemProfitSort]);

  // Sale / Purchase By Item
  const salePurchaseByItem = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const key = (p.name || '').trim();
      if (!key) return;
      map[key] = {
        name: key,
        hsn: p.hsn || '',
        unit: p.unit || 'Pcs',
        saleQty: 0,
        saleAmt: 0,
        purchaseQty: 0,
        purchaseAmt: 0,
        currentStock: Number(p.stock) || 0,
      };
    });

    plBills.forEach(b => {
      (b.data?.items || b.items || []).forEach(it => {
        const key = (it.name || it.description || '').trim();
        if (!key) return;
        if (!map[key]) {
          map[key] = { name: key, hsn: it.hsn || '', unit: it.unit || 'Pcs', saleQty: 0, saleAmt: 0, purchaseQty: 0, purchaseAmt: 0, currentStock: 0 };
        }
        const qty = Number(it.quantity) || 0;
        const amt = qty * (Number(it.rate) || 0);
        map[key].saleQty += qty;
        map[key].saleAmt += amt;
      });
    });

    filteredPurchases.forEach(pb => {
      (pb.items || []).forEach(it => {
        const key = (it.name || it.description || '').trim();
        if (!key) return;
        if (!map[key]) {
          map[key] = { name: key, hsn: it.hsn || '', unit: it.unit || 'Pcs', saleQty: 0, saleAmt: 0, purchaseQty: 0, purchaseAmt: 0, currentStock: 0 };
        }
        const qty = Number(it.quantity) || 0;
        const amt = qty * (Number(it.rate) || Number(it.price) || 0);
        map[key].purchaseQty += qty;
        map[key].purchaseAmt += amt;
      });
    });

    return Object.values(map)
      .filter(i => i.saleQty > 0 || i.purchaseQty > 0 || i.currentStock > 0)
      .sort((a, b) => b.saleAmt - a.saleAmt);
  }, [products, plBills, filteredPurchases]);

  // ============================================================
  // 3. EXECUTIVE P&L FINANCIAL TOTALS
  // ============================================================
  const plSummary = useMemo(() => {
    const totalRevenue = plBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const totalTaxCollected = plBills.reduce((s, b) => s + (b.totalTaxAmount || 0), 0);
    const netRevenue = totalRevenue - totalTaxCollected;
    const totalCOGS = billProfitList.reduce((s, b) => s + (b.cogs || 0), 0);
    const grossProfit = netRevenue - totalCOGS;
    const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    const totalExpenseAmount = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpenseGST = filteredExpenses.reduce((s, e) => s + (e.gstAmount || 0), 0);
    const netOperatingExpenses = totalExpenseAmount - totalExpenseGST;
    const netProfit = grossProfit - netOperatingExpenses;
    const netMarginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalTaxCollected,
      netRevenue,
      totalCOGS,
      grossProfit,
      grossMarginPct,
      totalExpenseAmount,
      totalExpenseGST,
      netOperatingExpenses,
      netProfit,
      netMarginPct
    };
  }, [plBills, billProfitList, filteredExpenses]);

  const monthlyPL = useMemo(() => {
    const map = {};
    plBills.forEach(b => {
      const dt = b.invoiceDate || b.date;
      if (!dt) return;
      const key = dt.substring(0, 7);
      if (!map[key]) map[key] = { revenue: 0, tax: 0, cogs: 0, expense: 0, expGst: 0 };
      map[key].revenue += Number(b.totalAmount) || 0;
      map[key].tax += Number(b.totalTaxAmount) || 0;
    });

    billProfitList.forEach(b => {
      if (!b.date) return;
      const key = b.date.substring(0, 7);
      if (map[key]) map[key].cogs += b.cogs;
    });

    filteredExpenses.forEach(e => {
      if (!e.date) return;
      const key = e.date.substring(0, 7);
      if (!map[key]) map[key] = { revenue: 0, tax: 0, cogs: 0, expense: 0, expGst: 0 };
      map[key].expense += Number(e.amount) || 0;
      map[key].expGst += Number(e.gstAmount) || 0;
    });

    return Object.keys(map).sort().map(key => {
      const m = map[key];
      const netRev = m.revenue - m.tax;
      const gross = netRev - m.cogs;
      const netExp = m.expense - m.expGst;
      const netProf = gross - netExp;
      const [y, mo] = key.split('-');
      return {
        key,
        label: `${MONTHS[parseInt(mo) - 1]} ${y}`,
        revenue: netRev,
        cogs: m.cogs,
        grossProfit: gross,
        expenses: netExp,
        netProfit: netProf,
        marginPct: netRev > 0 ? (netProf / netRev) * 100 : 0
      };
    });
  }, [plBills, billProfitList, filteredExpenses]);

  // ============================================================
  // 4. PARTY AGING ANALYSIS (RECEIVABLES & PAYABLES)
  // ============================================================
  const today = new Date();

  const receivablesAging = useMemo(() => {
    return bills.filter(b => b.status !== 'paid' && b.type !== 'proforma' && b.type !== 'estimate' && b.type !== 'sale-order' && b.type !== 'delivery-challan' && b.type !== 'creditnote').map(b => {
      const dueDate = b.data?.details?.dueDate || b.dueDate || b.invoiceDate;
      const due = dueDate ? new Date(dueDate) : null;
      const daysOverdue = (due && !isNaN(due.getTime()))
        ? Math.max(0, Math.floor((today - due) / 86400000))
        : 0;
      const outstanding = (Number(b.totalAmount) || 0) - (Number(b.paidAmount) || 0);

      let bucket = 'current';
      if (daysOverdue > 90) bucket = '90plus';
      else if (daysOverdue > 60) bucket = '61to90';
      else if (daysOverdue > 30) bucket = '31to60';

      const clientObj = clients.find(c => c.name?.toLowerCase() === (b.clientName || '').toLowerCase());
      const phone = clientObj?.phone || clientObj?.mobile || b.clientPhone || '';

      return {
        id: b.id || b.invoiceNumber,
        partyName: b.clientName || 'Unknown Customer',
        phone,
        docNumber: b.invoiceNumber || 'INV',
        date: b.invoiceDate || b.date,
        dueDate,
        totalAmount: Number(b.totalAmount) || 0,
        paidAmount: Number(b.paidAmount) || 0,
        outstanding,
        daysOverdue,
        bucket,
        currency: getBillCurrency(b)
      };
    }).filter(r => r.outstanding > 0);
  }, [bills, clients]);

  const payablesAging = useMemo(() => {
    return purchases.filter(p => (p.docType || 'purchase-bills') === 'purchase-bills' && p.paymentStatus !== 'Paid').map(p => {
      const dueDate = p.dueDate || p.date;
      const due = dueDate ? new Date(dueDate) : null;
      const daysOverdue = (due && !isNaN(due.getTime()))
        ? Math.max(0, Math.floor((today - due) / 86400000))
        : 0;
      const totalAmt = Number(p.totalAmount) || 0;
      const paidAmt = Number(p.paidAmount) || 0;
      const outstanding = totalAmt - paidAmt;

      let bucket = 'current';
      if (daysOverdue > 90) bucket = '90plus';
      else if (daysOverdue > 60) bucket = '61to90';
      else if (daysOverdue > 30) bucket = '31to60';

      const supObj = suppliers.find(s => s.name?.toLowerCase() === (p.supplierName || '').toLowerCase());
      const phone = supObj?.phone || supObj?.mobile || '';

      return {
        id: p.id || p.invoiceNumber,
        partyName: p.supplierName || 'Unknown Vendor',
        phone,
        docNumber: p.invoiceNumber || 'PUR',
        date: p.date,
        dueDate,
        totalAmount: totalAmt,
        paidAmount: paidAmt,
        outstanding,
        daysOverdue,
        bucket,
        currency: p.currency || 'INR'
      };
    }).filter(r => r.outstanding > 0);
  }, [purchases, suppliers]);

  const activeAgingData = agingTab === 'receivables' ? receivablesAging : payablesAging;

  const filteredAging = useMemo(() => {
    return activeAgingData.filter(r => {
      return !agingSearch.trim() ||
        r.partyName.toLowerCase().includes(agingSearch.toLowerCase()) ||
        r.docNumber.toLowerCase().includes(agingSearch.toLowerCase());
    }).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [activeAgingData, agingSearch]);

  const agingBuckets = useMemo(() => {
    const summary = { total: 0, current: 0, '31to60': 0, '61to90': 0, '90plus': 0 };
    activeAgingData.forEach(r => {
      summary.total += r.outstanding;
      summary[r.bucket] += r.outstanding;
    });
    return summary;
  }, [activeAgingData]);

  const handleWhatsAppReminder = (r) => {
    const msg = `Dear *${r.partyName}*,\n\nThis is a friendly payment reminder from *${profile?.businessName || 'our business'}*.\n\n` +
      `Invoice: *${r.docNumber}*\n` +
      `Due Date: *${r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : 'Immediate'}*\n` +
      `Overdue by: *${r.daysOverdue} days*\n` +
      `Outstanding Balance: *${formatCurrency(r.outstanding, r.currency)}*\n\n` +
      `Kindly arrange the settlement at your earliest convenience. Thank you!`;

    openWhatsAppShare(r.phone, msg);
    toast(`Opening WhatsApp reminder for ${r.partyName}`, 'info');
  };

  // ============================================================
  // 5. STOCK SUMMARY & VALUATION AUDIT
  // ============================================================
  const stockValuation = useMemo(() => {
    let totalItems = 0;
    let totalStockUnits = 0;
    let totalCostValuation = 0;
    let totalSellingValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const list = products.map(p => {
      const stock = Number(p.stock) || 0;
      const minStock = Number(p.minStock) || 5;
      const purchasePrice = Number(p.purchasePrice) || Number(p.rate) || 0;
      const sellingPrice = Number(p.sellingPrice) || Number(p.rate) || (purchasePrice * 1.25);
      const costValuation = Math.max(0, stock) * purchasePrice;
      const sellValuation = Math.max(0, stock) * sellingPrice;
      const potentialProfit = sellValuation - costValuation;
      const marginPct = sellValuation > 0 ? (potentialProfit / sellValuation) * 100 : 0;

      totalItems += 1;
      totalStockUnits += stock;
      totalCostValuation += costValuation;
      totalSellingValuation += sellValuation;

      if (stock <= 0) outOfStockCount += 1;
      else if (stock <= minStock) lowStockCount += 1;

      return {
        id: p.id,
        name: p.name || 'Unnamed Item',
        hsn: p.hsn || '',
        category: p.category || 'General',
        stock,
        unit: p.unit || 'Unit',
        minStock,
        purchasePrice,
        sellingPrice,
        costValuation,
        sellValuation,
        potentialProfit,
        marginPct,
        status: stock <= 0 ? 'out' : (stock <= minStock ? 'low' : 'ok')
      };
    });

    return {
      list,
      totalItems,
      totalStockUnits,
      totalCostValuation,
      totalSellingValuation,
      potentialProfit: totalSellingValuation - totalCostValuation,
      lowStockCount,
      outOfStockCount
    };
  }, [products]);

  const filteredStock = useMemo(() => {
    return stockValuation.list.filter(p => {
      const matchesSearch = !stockSearch.trim() ||
        p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
        p.hsn.toLowerCase().includes(stockSearch.toLowerCase());

      let matchesStatus = true;
      if (stockStatusFilter === 'low') matchesStatus = p.status === 'low';
      else if (stockStatusFilter === 'out') matchesStatus = p.status === 'out';

      return matchesSearch && matchesStatus;
    }).sort((a, b) => b.costValuation - a.costValuation);
  }, [stockValuation, stockSearch, stockStatusFilter]);

  // ============================================================
  // 6. VYAPAR TRANSACTION REPORTS (SALE, PURCHASE, DAY BOOK, ALL TXNS, CASH FLOW, BALANCE SHEET)
  // ============================================================
  const filteredSaleReport = useMemo(() => {
    return plBills.filter(b => {
      const q = saleReportSearch.trim().toLowerCase();
      const matchQ = !q ||
        (b.invoiceNumber || '').toLowerCase().includes(q) ||
        (b.clientName || '').toLowerCase().includes(q);
      const isPaid = b.status === 'paid' || ((Number(b.paidAmount) || 0) >= (Number(b.totalAmount) || 0));
      const matchStatus = saleStatusFilter === 'all' ||
        (saleStatusFilter === 'paid' && isPaid) ||
        (saleStatusFilter === 'unpaid' && !isPaid);
      return matchQ && matchStatus;
    }).sort((a, b) => String(b.invoiceDate || b.date || '').localeCompare(String(a.invoiceDate || a.date || '')));
  }, [plBills, saleReportSearch, saleStatusFilter]);

  const filteredPurchaseReport = useMemo(() => {
    return filteredPurchases.filter(p => {
      const q = purchaseReportSearch.trim().toLowerCase();
      const matchQ = !q ||
        (p.invoiceNumber || '').toLowerCase().includes(q) ||
        (p.supplierName || '').toLowerCase().includes(q);
      const matchStatus = purchaseStatusFilter === 'all' ||
        (purchaseStatusFilter === 'Paid' && p.paymentStatus === 'Paid') ||
        (purchaseStatusFilter === 'Unpaid' && p.paymentStatus !== 'Paid');
      return matchQ && matchStatus;
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [filteredPurchases, purchaseReportSearch, purchaseStatusFilter]);

  // Master Unified Transactions List (for Day Book & All Transactions)
  const masterTransactions = useMemo(() => {
    const list = [];
    bills.filter(b => b.type !== 'proforma' && b.type !== 'estimate' && b.type !== 'sale-order' && b.type !== 'delivery-challan').forEach(b => {
      const isCN = b.type === 'creditnote';
      const total = Number(b.totalAmount) || 0;
      const paid = b.status === 'paid' ? total : (Number(b.paidAmount) || 0);
      list.push({
        id: `sale-${b.id}`,
        date: (b.invoiceDate || b.date || '').split('T')[0],
        type: isCN ? 'Credit Note' : 'Sale',
        refNo: b.invoiceNumber || 'INV',
        partyName: b.clientName || 'Cash Sale',
        paymentMode: b.paymentMode || 'Cash',
        totalAmount: total,
        moneyIn: isCN ? 0 : paid,
        moneyOut: isCN ? paid : 0,
        balance: Math.max(0, total - paid)
      });
    });

    purchases.filter(p => (p.docType || 'purchase-bills') === 'purchase-bills').forEach(p => {
      const total = Number(p.totalAmount) || 0;
      const paid = p.paymentStatus === 'Paid' ? total : (Number(p.paidAmount) || 0);
      list.push({
        id: `pur-${p.id}`,
        date: (p.date || '').split('T')[0],
        type: 'Purchase',
        refNo: p.invoiceNumber || 'PUR',
        partyName: p.supplierName || 'Vendor',
        paymentMode: p.paymentMode || 'Cash',
        totalAmount: total,
        moneyIn: 0,
        moneyOut: paid,
        balance: Math.max(0, total - paid)
      });
    });

    receipts.forEach(r => {
      const amt = Number(r.amount) || 0;
      list.push({
        id: `rec-${r.id}`,
        date: (r.date || '').split('T')[0],
        type: 'Payment-In',
        refNo: r.receiptNumber || 'REC',
        partyName: r.clientName || 'Customer',
        paymentMode: r.paymentMode || 'Cash',
        totalAmount: amt,
        moneyIn: amt,
        moneyOut: 0,
        balance: 0
      });
    });

    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      list.push({
        id: `exp-${e.id}`,
        date: (e.date || '').split('T')[0],
        type: 'Expense',
        refNo: e.category || 'EXP',
        partyName: e.partyName || e.description || e.category || 'Expense',
        paymentMode: e.paymentMode || 'Cash',
        totalAmount: amt,
        moneyIn: 0,
        moneyOut: amt,
        balance: 0
      });
    });

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [bills, purchases, receipts, expenses]);

  const dayBookEntries = useMemo(() => {
    return masterTransactions.filter(t => dayBookAllDates ? filterByPeriod(t.date) : t.date === dayBookDate);
  }, [masterTransactions, dayBookDate, dayBookAllDates, filterMode, fyFilter, yearFilter, monthFilter, customFrom, customTo]);

  const allTransactionsFiltered = useMemo(() => {
    return masterTransactions.filter(t => {
      if (!filterByPeriod(t.date)) return false;
      if (allTxnTypeFilter !== 'ALL' && t.type !== allTxnTypeFilter) return false;
      const q = allTxnSearch.trim().toLowerCase();
      if (q && !t.partyName.toLowerCase().includes(q) && !t.refNo.toLowerCase().includes(q) && !t.type.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [masterTransactions, allTxnTypeFilter, allTxnSearch, filterMode, fyFilter, yearFilter, monthFilter, customFrom, customTo]);

  // Cash Flow Statement Computation
  const cashFlowSummary = useMemo(() => {
    const openingCash = Number(profile?.openingCashInHand) || 0;
    const openingBank = (Array.isArray(profile?.paymentAccounts) ? profile.paymentAccounts : []).reduce((s, a) => s + (Number(a.openingBalance) || 0), 0);
    const openingTotal = openingCash + openingBank;

    const saleCashIn = plBills.reduce((s, b) => {
      const total = Number(b.totalAmount) || 0;
      return s + (b.status === 'paid' ? total : (Number(b.paidAmount) || 0));
    }, 0);
    const receiptCashIn = filteredReceipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalInflows = saleCashIn + receiptCashIn;

    const purchaseCashOut = filteredPurchases.reduce((s, p) => {
      const total = Number(p.totalAmount) || 0;
      return s + (p.paymentStatus === 'Paid' ? total : (Number(p.paidAmount) || 0));
    }, 0);
    const expenseCashOut = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalOutflows = purchaseCashOut + expenseCashOut;

    const netCashFlow = totalInflows - totalOutflows;
    const closingLiquidBalance = openingTotal + netCashFlow;

    return {
      openingCash,
      openingBank,
      openingTotal,
      saleCashIn,
      receiptCashIn,
      totalInflows,
      purchaseCashOut,
      expenseCashOut,
      totalOutflows,
      netCashFlow,
      closingLiquidBalance
    };
  }, [profile, plBills, filteredReceipts, filteredPurchases, filteredExpenses]);

  // Balance Sheet Computation
  const balanceSheetData = useMemo(() => {
    const accountsReceivable = receivablesAging.reduce((s, r) => s + r.outstanding, 0);
    const accountsPayable = payablesAging.reduce((s, p) => s + p.outstanding, 0);
    const inventoryAsset = stockValuation.totalCostValuation;
    const cashAndBank = Math.max(0, cashFlowSummary.closingLiquidBalance);
    const loanLiabilities = (Array.isArray(profile?.loanAccounts) ? profile.loanAccounts : []).reduce((s, l) => s + (Number(l.currentBalance ?? l.openingBalance) || 0), 0);

    const totalAssets = cashAndBank + accountsReceivable + inventoryAsset;
    const retainedProfit = plSummary.netProfit;
    const ownerCapital = totalAssets - (accountsPayable + loanLiabilities + retainedProfit);
    const totalLiabilitiesAndEquity = accountsPayable + loanLiabilities + retainedProfit + ownerCapital;

    return {
      cashAndBank,
      accountsReceivable,
      inventoryAsset,
      totalAssets,
      accountsPayable,
      loanLiabilities,
      retainedProfit,
      ownerCapital,
      totalLiabilitiesAndEquity
    };
  }, [receivablesAging, payablesAging, stockValuation, cashFlowSummary, profile, plSummary]);

  // ============================================================
  // 7. PARTY REPORTS (STATEMENT LEDGER, ALL PARTIES, PARTY WISE P&L)
  // ============================================================
  const allPartiesSummary = useMemo(() => {
    const map = {};
    clients.forEach(c => {
      const name = (c.name || '').trim();
      if (!name) return;
      const openBal = Number(c.openingBalance) || 0;
      const initNet = c.balanceType === 'to_pay' ? -openBal : openBal; // positive = Receivable
      map[name.toLowerCase()] = {
        name,
        partyRole: 'Customer',
        gstin: c.gstin || '',
        phone: c.phone || c.mobile || '',
        creditLimit: Number(c.creditLimit) || 0,
        saleTotal: 0,
        purchaseTotal: 0,
        netBalance: initNet,
      };
    });

    suppliers.forEach(s => {
      const name = (s.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const openBal = Number(s.openingBalance) || 0;
      const initNet = s.balanceType === 'to_collect' ? openBal : -openBal; // negative = Payable
      if (!map[key]) {
        map[key] = {
          name,
          partyRole: 'Supplier',
          gstin: s.gstin || '',
          phone: s.phone || s.mobile || '',
          creditLimit: Number(s.creditLimit) || 0,
          saleTotal: 0,
          purchaseTotal: 0,
          netBalance: initNet,
        };
      } else {
        map[key].partyRole = 'Customer & Supplier';
        map[key].netBalance += initNet;
      }
    });

    bills.filter(b => b.type !== 'proforma' && b.type !== 'estimate' && b.type !== 'sale-order' && b.type !== 'delivery-challan').forEach(b => {
      const name = (b.clientName || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map[key]) {
        map[key] = { name, partyRole: 'Customer', gstin: b.clientGstin || '', phone: '', creditLimit: 0, saleTotal: 0, purchaseTotal: 0, netBalance: 0 };
      }
      const total = Number(b.totalAmount) || 0;
      const paid = b.status === 'paid' ? total : (Number(b.paidAmount) || 0);
      const due = Math.max(0, total - paid);
      if (b.type === 'creditnote') {
        map[key].netBalance -= due;
      } else {
        map[key].saleTotal += total;
        map[key].netBalance += due;
      }
    });

    receipts.forEach(r => {
      const name = (r.clientName || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (map[key] && !r.invoiceNumber) {
        map[key].netBalance -= (Number(r.amount) || 0);
      }
    });

    purchases.filter(p => (p.docType || 'purchase-bills') === 'purchase-bills').forEach(p => {
      const name = (p.supplierName || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map[key]) {
        map[key] = { name, partyRole: 'Supplier', gstin: p.supplierGstin || '', phone: '', creditLimit: 0, saleTotal: 0, purchaseTotal: 0, netBalance: 0 };
      }
      const total = Number(p.totalAmount) || 0;
      const paid = p.paymentStatus === 'Paid' ? total : (Number(p.paidAmount) || 0);
      const due = Math.max(0, total - paid);
      map[key].purchaseTotal += total;
      map[key].netBalance -= due;
    });

    return Object.values(map).sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
  }, [clients, suppliers, bills, receipts, purchases]);

  const filteredAllParties = useMemo(() => {
    return allPartiesSummary.filter(p => {
      const q = allPartiesSearch.trim().toLowerCase();
      if (q && !p.name.toLowerCase().includes(q) && !p.gstin.toLowerCase().includes(q) && !p.phone.toLowerCase().includes(q)) return false;
      if (partyTypeFilter === 'RECEIVABLE' && p.netBalance <= 0) return false;
      if (partyTypeFilter === 'PAYABLE' && p.netBalance >= 0) return false;
      return true;
    });
  }, [allPartiesSummary, allPartiesSearch, partyTypeFilter]);

  // Party Statement Ledger for selectedPartyName
  const partyStatementData = useMemo(() => {
    if (!selectedPartyName) return { entries: [], openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 };
    const target = selectedPartyName.trim().toLowerCase();
    const clientObj = clients.find(c => (c.name || '').trim().toLowerCase() === target);
    const supObj = suppliers.find(s => (s.name || '').trim().toLowerCase() === target);

    let openingBalance = 0;
    if (clientObj) {
      const ob = Number(clientObj.openingBalance) || 0;
      openingBalance += clientObj.balanceType === 'to_pay' ? -ob : ob;
    }
    if (supObj) {
      const ob = Number(supObj.openingBalance) || 0;
      openingBalance += supObj.balanceType === 'to_collect' ? ob : -ob;
    }

    const raw = [];
    bills.filter(b => (b.clientName || '').trim().toLowerCase() === target && b.type !== 'proforma' && b.type !== 'estimate').forEach(b => {
      const total = Number(b.totalAmount) || 0;
      const paid = b.status === 'paid' ? total : (Number(b.paidAmount) || 0);
      const dt = (b.invoiceDate || b.date || '').split('T')[0];
      if (b.type === 'creditnote') {
        raw.push({ date: dt, type: 'Credit Note', refNo: b.invoiceNumber || 'CN', debit: 0, credit: total });
      } else {
        raw.push({ date: dt, type: 'Sale Invoice', refNo: b.invoiceNumber || 'INV', debit: total, credit: paid });
      }
    });

    receipts.filter(r => (r.clientName || '').trim().toLowerCase() === target).forEach(r => {
      raw.push({
        date: (r.date || '').split('T')[0],
        type: 'Payment-In',
        refNo: r.receiptNumber || 'REC',
        debit: 0,
        credit: Number(r.amount) || 0
      });
    });

    purchases.filter(p => (p.supplierName || '').trim().toLowerCase() === target && (p.docType || 'purchase-bills') === 'purchase-bills').forEach(p => {
      const total = Number(p.totalAmount) || 0;
      const paid = p.paymentStatus === 'Paid' ? total : (Number(p.paidAmount) || 0);
      raw.push({
        date: (p.date || '').split('T')[0],
        type: 'Purchase Bill',
        refNo: p.invoiceNumber || 'PUR',
        debit: paid,
        credit: total
      });
    });

    raw.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    let running = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    const entries = raw.map((e, idx) => {
      running += (e.debit - e.credit);
      totalDebit += e.debit;
      totalCredit += e.credit;
      return { ...e, id: idx, runningBalance: running };
    });

    return { entries, openingBalance, totalDebit, totalCredit, closingBalance: running, phone: clientObj?.phone || supObj?.phone || '' };
  }, [selectedPartyName, clients, suppliers, bills, receipts, purchases]);

  // Party Wise Profit & Loss
  const partyProfitList = useMemo(() => {
    const map = {};
    billProfitList.forEach(b => {
      const key = b.clientName || 'Cash Sale';
      if (!map[key]) {
        map[key] = { partyName: key, invoiceCount: 0, revenue: 0, netSales: 0, cogs: 0, grossProfit: 0 };
      }
      map[key].invoiceCount += 1;
      map[key].revenue += b.revenue;
      map[key].netSales += b.netSales;
      map[key].cogs += b.cogs;
      map[key].grossProfit += b.grossProfit;
    });
    return Object.values(map).map(p => ({
      ...p,
      marginPct: p.netSales > 0 ? (p.grossProfit / p.netSales) * 100 : 0
    })).sort((a, b) => b.grossProfit - a.grossProfit);
  }, [billProfitList]);

  // ============================================================
  // 8. GST REPORTS (GSTR-1, GSTR-2, GSTR-3B, GST RATE WISE, HSN SUMMARY)
  // ============================================================
  const gstr1Rows = useMemo(() => {
    return allFilteredBills.filter(b => b.type !== 'proforma').map(b => {
      const gstin = (b.clientGstin || b.data?.client?.gstin || '').trim();
      const total = Number(b.totalAmount) || 0;
      const tax = Number(b.totalTaxAmount) || 0;
      const taxable = total - tax;
      const cgst = Number(b.cgstAmount) || (b.isIgst ? 0 : tax / 2);
      const sgst = Number(b.sgstAmount) || (b.isIgst ? 0 : tax / 2);
      const igst = Number(b.igstAmount) || (b.isIgst ? tax : 0);
      let section = 'B2CS';
      if (b.type === 'creditnote') section = 'CDNR';
      else if (gstin.length >= 15) section = 'B2B';
      else if (total > 250000) section = 'B2CL';

      return {
        id: b.id || b.invoiceNumber,
        invoiceNumber: b.invoiceNumber || 'INV',
        date: (b.invoiceDate || b.date || '').split('T')[0],
        partyName: b.clientName || 'Cash Customer',
        gstin: gstin || 'Unregistered',
        section,
        taxable,
        cgst,
        sgst,
        igst,
        totalTax: tax,
        totalAmount: total
      };
    }).filter(r => gstr1SubTab === 'ALL' || r.section === gstr1SubTab);
  }, [allFilteredBills, gstr1SubTab]);

  const gstr2Rows = useMemo(() => {
    const rows = [];
    filteredPurchases.forEach(p => {
      const total = Number(p.totalAmount) || 0;
      const tax = Number(p.gstAmount) || Number(p.taxAmount) || 0;
      const taxable = total - tax;
      rows.push({
        id: `p-${p.id}`,
        docNo: p.invoiceNumber || 'PUR',
        date: (p.date || '').split('T')[0],
        supplierName: p.supplierName || 'Supplier',
        gstin: p.supplierGstin || 'Registered / ITC',
        source: 'Purchase Bill',
        taxable,
        cgst: tax / 2,
        sgst: tax / 2,
        igst: 0,
        totalTax: tax,
        totalAmount: total
      });
    });

    filteredExpenses.filter(e => (Number(e.gstAmount) || 0) > 0).forEach(e => {
      const total = Number(e.amount) || 0;
      const tax = Number(e.gstAmount) || 0;
      rows.push({
        id: `e-${e.id}`,
        docNo: e.reference || 'EXP-ITC',
        date: (e.date || '').split('T')[0],
        supplierName: e.partyName || e.category || 'GST Expense',
        gstin: e.gstin || 'Expense ITC',
        source: 'Business Expense',
        taxable: total - tax,
        cgst: tax / 2,
        sgst: tax / 2,
        igst: 0,
        totalTax: tax,
        totalAmount: total
      });
    });

    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [filteredPurchases, filteredExpenses]);

  // GST Rate-Wise Summary & HSN Summary
  const { gstRateSummary, hsnSummaryList } = useMemo(() => {
    const rateMap = {
      0: { rate: 0, saleTaxable: 0, saleTax: 0, purTaxable: 0, purTax: 0 },
      5: { rate: 5, saleTaxable: 0, saleTax: 0, purTaxable: 0, purTax: 0 },
      12: { rate: 12, saleTaxable: 0, saleTax: 0, purTaxable: 0, purTax: 0 },
      18: { rate: 18, saleTaxable: 0, saleTax: 0, purTaxable: 0, purTax: 0 },
      28: { rate: 28, saleTaxable: 0, saleTax: 0, purTaxable: 0, purTax: 0 },
    };
    const hsnMap = {};

    plBills.forEach(b => {
      const items = b.data?.items || b.items || [];
      items.forEach(it => {
        const qty = Number(it.quantity) || 0;
        const rate = Number(it.rate) || 0;
        const taxable = qty * rate;
        const gstPct = Number(it.gstRate ?? it.taxRate ?? b.gstRate ?? 18);
        const tax = (taxable * gstPct) / 100;

        const slabKey = [0, 5, 12, 18, 28].includes(gstPct) ? gstPct : 18;
        rateMap[slabKey].saleTaxable += taxable;
        rateMap[slabKey].saleTax += tax;

        const hsn = (it.hsn || 'N/A').trim() || 'N/A';
        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            hsn,
            description: it.name || it.description || 'Goods',
            unit: it.unit || 'NOS',
            qty: 0,
            taxable: 0,
            gstPct,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0
          };
        }
        hsnMap[hsn].qty += qty;
        hsnMap[hsn].taxable += taxable;
        hsnMap[hsn].cgst += tax / 2;
        hsnMap[hsn].sgst += tax / 2;
        hsnMap[hsn].totalTax += tax;
      });
    });

    filteredPurchases.forEach(p => {
      const items = p.items || [];
      if (items.length > 0) {
        items.forEach(it => {
          const qty = Number(it.quantity) || 0;
          const rate = Number(it.rate) || Number(it.price) || 0;
          const taxable = qty * rate;
          const gstPct = Number(it.gstRate ?? it.taxRate ?? 18);
          const tax = (taxable * gstPct) / 100;
          const slabKey = [0, 5, 12, 18, 28].includes(gstPct) ? gstPct : 18;
          rateMap[slabKey].purTaxable += taxable;
          rateMap[slabKey].purTax += tax;
        });
      } else {
        const total = Number(p.totalAmount) || 0;
        const tax = Number(p.gstAmount) || 0;
        rateMap[18].purTaxable += (total - tax);
        rateMap[18].purTax += tax;
      }
    });

    return {
      gstRateSummary: Object.values(rateMap),
      hsnSummaryList: Object.values(hsnMap).sort((a, b) => b.taxable - a.taxable)
    };
  }, [plBills, filteredPurchases]);

  // Expense Category Breakdown
  const expenseCategoryList = useMemo(() => {
    const map = {};
    const totalAll = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    filteredExpenses.forEach(e => {
      const cat = e.category || 'Uncategorized';
      if (!map[cat]) map[cat] = { category: cat, count: 0, amount: 0, gst: 0 };
      map[cat].count += 1;
      map[cat].amount += Number(e.amount) || 0;
      map[cat].gst += Number(e.gstAmount) || 0;
    });
    return Object.values(map).map(c => ({
      ...c,
      sharePct: totalAll > 0 ? (c.amount / totalAll) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // ============================================================
  // PDF EXPORT FUNCTIONS
  // ============================================================
  const exportPLPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195, tableW = marginR - marginL;
      const fmt = (n) => 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      let y = 18;
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('PROFIT & LOSS STATEMENT', marginL, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(profile?.businessName || 'Business Enterprise', marginL, y); y += 4.5;
      if (profile?.gstin) { doc.text(`GSTIN: ${profile.gstin}`, marginL, y); y += 4.5; }
      doc.setTextColor(0);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`Period: ${filterMode === 'fy' ? (fyOptions.find(f => f.value === fyFilter)?.label || 'Current FY') : 'Selected Period'}`, marginR, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, marginR, 26, { align: 'right' });

      y += 6;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.6);
      doc.line(marginL, y, marginR, y); y += 6;

      doc.setFillColor(245, 247, 250);
      doc.rect(marginL, y, tableW, 14, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      doc.text(`Gross Revenue: ${fmt(plSummary.netRevenue)}`, marginL + 4, y + 6);
      doc.text(`COGS: ${fmt(plSummary.totalCOGS)}`, marginL + 65, y + 6);
      doc.text(`Gross Profit: ${fmt(plSummary.grossProfit)} (${plSummary.grossMarginPct.toFixed(1)}%)`, marginL + 120, y + 6);

      doc.text(`Operating Exp: ${fmt(plSummary.netOperatingExpenses)}`, marginL + 4, y + 11);
      doc.setTextColor(plSummary.netProfit >= 0 ? 5 : 220, plSummary.netProfit >= 0 ? 150 : 38, plSummary.netProfit >= 0 ? 105 : 38);
      doc.text(`Net Profit: ${fmt(plSummary.netProfit)} (${plSummary.netMarginPct.toFixed(1)}%)`, marginL + 120, y + 11);
      doc.setTextColor(0);
      y += 20;

      doc.setFillColor(...getAccentRGB());
      doc.rect(marginL, y, tableW, 8, 'F');
      doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('Account Particulars', marginL + 4, y + 5.5);
      doc.text('Amount (Rs.)', marginR - 4, y + 5.5, { align: 'right' });
      doc.setTextColor(0);
      y += 10;

      const rows = [
        { label: 'Sales Revenue (Gross Billings)', val: fmt(plSummary.totalRevenue), bold: false },
        { label: 'Less: GST Collected on Sales', val: `-${fmt(plSummary.totalTaxCollected)}`, bold: false, red: true },
        { label: 'Net Sales Revenue (Trading Inward)', val: fmt(plSummary.netRevenue), bold: true },
        { label: 'Less: Cost of Goods Sold (COGS - Purchase Cost)', val: `-${fmt(plSummary.totalCOGS)}`, bold: false, red: true },
        { label: 'GROSS PROFIT', val: fmt(plSummary.grossProfit), bold: true, green: plSummary.grossProfit >= 0 },
        { label: 'Less: Operating Business Expenses', val: `-${fmt(plSummary.totalExpenseAmount)}`, bold: false },
        { label: 'Less: GST on Expenses (Input Tax Credit)', val: `+${fmt(plSummary.totalExpenseGST)}`, bold: false, green: true },
        { label: 'Net Indirect Expenses', val: `-${fmt(plSummary.netOperatingExpenses)}`, bold: false, red: true },
        { label: `NET ${plSummary.netProfit >= 0 ? 'PROFIT' : 'LOSS'} (PAT)`, val: fmt(plSummary.netProfit), bold: true, big: true, green: plSummary.netProfit >= 0, red: plSummary.netProfit < 0 }
      ];

      doc.setFontSize(8.5);
      rows.forEach(r => {
        doc.setFont('helvetica', r.bold ? 'bold' : 'normal');
        if (r.green) doc.setTextColor(5, 150, 105);
        else if (r.red) doc.setTextColor(220, 38, 38);
        else doc.setTextColor(0);

        doc.setFontSize(r.big ? 10 : 8.5);
        doc.text(r.label, marginL + 4, y);
        doc.text(r.val, marginR - 4, y, { align: 'right' });
        doc.setTextColor(0);
        y += r.big ? 8 : 6.5;
      });

      doc.save(`Profit_Loss_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
      toast('Profit & Loss statement exported to PDF', 'success');
    } catch {
      toast('Failed to generate P&L PDF', 'error');
    }
  };

  const exportStockValuationPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195, tableW = marginR - marginL;
      const fmt = (n) => 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      let y = 18;
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('STOCK VALUATION & INVENTORY REPORT', marginL, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(profile?.businessName || 'Business Enterprise', marginL, y); y += 4.5;
      doc.setTextColor(0);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text(`Total SKU Items: ${stockValuation.totalItems}`, marginR, 20, { align: 'right' });
      doc.text(`Asset Value: ${fmt(stockValuation.totalCostValuation)}`, marginR, 26, { align: 'right' });

      y += 6;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.6);
      doc.line(marginL, y, marginR, y); y += 6;

      doc.setFillColor(...getAccentRGB());
      doc.rect(marginL, y, tableW, 8, 'F');
      doc.setTextColor(255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('Item Name', marginL + 2, y + 5.5);
      doc.text('Stock Qty', marginL + 60, y + 5.5);
      doc.text('Cost Rate', marginL + 85, y + 5.5, { align: 'right' });
      doc.text('Selling Rate', marginL + 115, y + 5.5, { align: 'right' });
      doc.text('Asset Value (Cost)', marginL + 155, y + 5.5, { align: 'right' });
      doc.text('Profit Pot.', marginR - 2, y + 5.5, { align: 'right' });
      doc.setTextColor(0);
      y += 10;

      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      stockValuation.list.forEach(p => {
        if (y > 275) { doc.addPage(); y = 18; }
        doc.text(p.name, marginL + 2, y, { maxWidth: 55 });
        doc.text(`${p.stock} ${p.unit}`, marginL + 60, y);
        doc.text(fmt(p.purchasePrice), marginL + 85, y, { align: 'right' });
        doc.text(fmt(p.sellingPrice), marginL + 115, y, { align: 'right' });
        doc.text(fmt(p.costValuation), marginL + 155, y, { align: 'right' });
        doc.text(fmt(p.potentialProfit), marginR - 2, y, { align: 'right' });
        y += 5.5;
      });

      doc.save(`Stock_Valuation_${new Date().toISOString().split('T')[0]}.pdf`);
      toast('Stock Valuation PDF exported successfully', 'success');
    } catch {
      toast('Failed to generate Stock Valuation PDF', 'error');
    }
  };

  // Find active report metadata
  const activeReportMeta = useMemo(() => {
    for (const grp of REPORT_TREE) {
      const found = grp.items.find(i => i.id === activeTab);
      if (found) return { ...found, group: grp.group };
    }
    return { id: activeTab, label: 'Report', group: 'Reports' };
  }, [activeTab]);

  return (
    <div className="view-container" style={{ display: 'flex', height: 'calc(100vh - 28px)', gap: '0.85rem', overflow: 'hidden', padding: '0.75rem' }}>

      {/* ============================================================ */}
      {/* LEFT PANE: VYAPAR REPORT EXPLORER TREE SIDEBAR */}
      {/* ============================================================ */}
      <div style={{
        width: '255px',
        flexShrink: 0,
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {/* Tree Header & Quick Search */}
        <div style={{ padding: '0.85rem', borderBottom: '1px solid var(--border-color, #e5e7eb)', background: 'var(--bg-secondary, #f8fafc)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
            <FolderOpen size={17} color="#2563eb" />
            <span>Reports Hub</span>
          </div>
          <div className="search-box" style={{ width: '100%' }}>
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Find report (e.g. GSTR, P&L)..."
              value={treeSearch}
              onChange={e => setTreeSearch(e.target.value)}
              className="search-input"
              style={{ height: '31px', fontSize: '0.78rem' }}
            />
            {treeSearch && (
              <button className="icon-btn" onClick={() => setTreeSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Category Tree */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {REPORT_TREE.map(group => {
            const GroupIcon = group.icon;
            const matchingItems = group.items.filter(it =>
              !treeSearch.trim() ||
              it.label.toLowerCase().includes(treeSearch.toLowerCase()) ||
              group.group.toLowerCase().includes(treeSearch.toLowerCase())
            );
            if (matchingItems.length === 0) return null;
            const isCollapsed = !!collapsedGroups[group.group] && !treeSearch.trim();

            return (
              <div key={group.group} style={{ marginBottom: '0.45rem' }}>
                <button
                  onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.group]: !prev[group.group] }))}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.55rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary, #475569)',
                    fontSize: '0.73rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <GroupIcon size={14} color="#2563eb" />
                    {group.group}
                  </span>
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>

                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', paddingLeft: '0.35rem' }}>
                    {matchingItems.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '7px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.81rem',
                            fontWeight: isActive ? 700 : 500,
                            background: isActive ? '#eff6ff' : 'transparent',
                            color: isActive ? '#1d4ed8' : 'var(--text-primary, #334155)',
                            borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.12s ease'
                          }}>
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT PANE: ACTIVE REPORT WORKSPACE */}
      {/* ============================================================ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0, overflow: 'hidden' }}>

        {/* 1. TOP REPORT HEADER & GLOBAL PERIOD SELECTOR */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'var(--card-bg, #ffffff)',
          padding: '0.75rem 1.1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e5e7eb)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {activeReportMeta.group}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {activeReportMeta.label}
            </h2>
          </div>

          {/* Global Period & Currency Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', height: '33px', width: 'auto', fontWeight: 600 }}
              value={filterMode}
              onChange={e => setFilterMode(e.target.value)}>
              <option value="fy">Fiscal Year</option>
              <option value="month">Month / Year</option>
              <option value="custom">Custom Date Range</option>
              <option value="all">All-Time</option>
            </select>

            {filterMode === 'fy' && (
              <select
                className="form-input"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', height: '33px', width: 'auto' }}
                value={fyFilter}
                onChange={e => setFyFilter(e.target.value)}>
                {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
              </select>
            )}

            {filterMode === 'month' && (
              <>
                <select
                  className="form-input"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', height: '33px', width: 'auto' }}
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select
                  className="form-input"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', height: '33px', width: 'auto' }}
                  value={yearFilter}
                  onChange={e => setYearFilter(e.target.value)}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}

            {filterMode === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="date"
                  className="form-input"
                  style={{ height: '33px', fontSize: '0.78rem', padding: '0.2rem 0.5rem', width: 'auto' }}
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ height: '33px', fontSize: '0.78rem', padding: '0.2rem 0.5rem', width: 'auto' }}
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                />
              </div>
            )}

            {allCurrencies.length > 1 && (
              <select
                className="form-input"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', height: '33px', width: 'auto' }}
                value={currencyFilter}
                onChange={e => setCurrencyFilter(e.target.value)}>
                {allCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            <button
              onClick={loadData}
              title="Refresh Data"
              className="icon-btn"
              style={{ width: '33px', height: '33px', borderRadius: '6px', border: '1px solid var(--border-color, #e5e7eb)' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* REPORT 1: SALE REPORT */}
        {/* ============================================================ */}
        {activeTab === 'sale-report' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Total Sales ({filteredSaleReport.length} Bills)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#2563eb' }}>
                  {formatCurrency(filteredSaleReport.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0), currencyFilter)}
                </h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Received Amount</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#059669' }}>
                  {formatCurrency(filteredSaleReport.reduce((s, b) => {
                    const tot = Number(b.totalAmount) || 0;
                    return s + (b.status === 'paid' ? tot : (Number(b.paidAmount) || 0));
                  }, 0), currencyFilter)}
                </h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Balance Due</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#dc2626' }}>
                  {formatCurrency(filteredSaleReport.reduce((s, b) => {
                    const tot = Number(b.totalAmount) || 0;
                    const paid = b.status === 'paid' ? tot : (Number(b.paidAmount) || 0);
                    return s + Math.max(0, tot - paid);
                  }, 0), currencyFilter)}
                </h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Output GST Collected</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem' }}>
                  {formatCurrency(filteredSaleReport.reduce((s, b) => s + (Number(b.totalTaxAmount) || 0), 0), currencyFilter)}
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="search-box" style={{ width: '260px' }}>
                  <Search size={14} className="search-icon" />
                  <input className="search-input" placeholder="Search party or invoice no..." value={saleReportSearch} onChange={e => setSaleReportSearch(e.target.value)} />
                </div>
                {['all', 'paid', 'unpaid'].map(st => (
                  <button
                    key={st}
                    onClick={() => setSaleStatusFilter(st)}
                    style={{
                      padding: '0.35rem 0.7rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (saleStatusFilter === st ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: saleStatusFilter === st ? '#eff6ff' : 'transparent',
                      color: saleStatusFilter === st ? '#2563eb' : 'var(--text-secondary)'
                    }}>
                    {st === 'all' ? 'All' : st === 'paid' ? 'Paid' : 'Unpaid / Partial'}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `Sale_Report_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Date', 'Invoice No', 'Party Name', 'Payment Mode', 'Tax Amount', 'Total Amount', 'Received', 'Balance Due'],
                  filteredSaleReport.map(b => {
                    const tot = Number(b.totalAmount) || 0;
                    const paid = b.status === 'paid' ? tot : (Number(b.paidAmount) || 0);
                    return [b.invoiceDate || b.date, b.invoiceNumber, b.clientName, b.paymentMode || 'Cash', b.totalTaxAmount || 0, tot, paid, Math.max(0, tot - paid)];
                  })
                )}>
                <Download size={14} /> Export Excel / CSV
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice No</th>
                    <th>Party Name</th>
                    <th>Payment Type</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th style={{ textAlign: 'right' }}>Received</th>
                    <th style={{ textAlign: 'right' }}>Balance Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSaleReport.map(b => {
                    const tot = Number(b.totalAmount) || 0;
                    const paid = b.status === 'paid' ? tot : (Number(b.paidAmount) || 0);
                    const due = Math.max(0, tot - paid);
                    return (
                      <tr key={b.id || b.invoiceNumber}>
                        <td className="text-muted">{(b.invoiceDate || b.date || '').split('T')[0]}</td>
                        <td><span className="invoice-badge">{b.invoiceNumber}</span></td>
                        <td className="font-medium">{b.clientName || 'Cash Sale'}</td>
                        <td>{b.paymentMode || 'Cash'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(tot, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(paid, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: due > 0 ? '#dc2626' : 'var(--text-muted)' }}>{formatCurrency(due, currencyFilter)}</td>
                        <td>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 700,
                            background: due <= 0 ? '#ecfdf5' : '#fee2e2',
                            color: due <= 0 ? '#059669' : '#dc2626'
                          }}>
                            {due <= 0 ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 2: PURCHASE REPORT */}
        {/* ============================================================ */}
        {activeTab === 'purchase-report' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Total Purchases ({filteredPurchaseReport.length} Bills)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#2563eb' }}>
                  {formatCurrency(filteredPurchaseReport.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0), currencyFilter)}
                </h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Paid Amount</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#059669' }}>
                  {formatCurrency(filteredPurchaseReport.reduce((s, p) => {
                    const tot = Number(p.totalAmount) || 0;
                    return s + (p.paymentStatus === 'Paid' ? tot : (Number(p.paidAmount) || 0));
                  }, 0), currencyFilter)}
                </h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Balance Payable</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#dc2626' }}>
                  {formatCurrency(filteredPurchaseReport.reduce((s, p) => {
                    const tot = Number(p.totalAmount) || 0;
                    const paid = p.paymentStatus === 'Paid' ? tot : (Number(p.paidAmount) || 0);
                    return s + Math.max(0, tot - paid);
                  }, 0), currencyFilter)}
                </h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Input GST (ITC)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem' }}>
                  {formatCurrency(filteredPurchaseReport.reduce((s, p) => s + (Number(p.gstAmount) || 0), 0), currencyFilter)}
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div className="search-box" style={{ width: '260px' }}>
                  <Search size={14} className="search-icon" />
                  <input className="search-input" placeholder="Search supplier or bill no..." value={purchaseReportSearch} onChange={e => setPurchaseReportSearch(e.target.value)} />
                </div>
                {['all', 'Paid', 'Unpaid'].map(st => (
                  <button
                    key={st}
                    onClick={() => setPurchaseStatusFilter(st)}
                    style={{
                      padding: '0.35rem 0.7rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (purchaseStatusFilter === st ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: purchaseStatusFilter === st ? '#eff6ff' : 'transparent',
                      color: purchaseStatusFilter === st ? '#2563eb' : 'var(--text-secondary)'
                    }}>
                    {st === 'all' ? 'All' : st}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `Purchase_Report_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Date', 'Bill No', 'Supplier Name', 'Payment Mode', 'GST ITC', 'Total Amount', 'Paid', 'Balance'],
                  filteredPurchaseReport.map(p => {
                    const tot = Number(p.totalAmount) || 0;
                    const paid = p.paymentStatus === 'Paid' ? tot : (Number(p.paidAmount) || 0);
                    return [p.date, p.invoiceNumber, p.supplierName, p.paymentMode || 'Cash', p.gstAmount || 0, tot, paid, Math.max(0, tot - paid)];
                  })
                )}>
                <Download size={14} /> Export Excel / CSV
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bill No</th>
                    <th>Supplier Name</th>
                    <th>Payment Mode</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th style={{ textAlign: 'right' }}>Paid Amount</th>
                    <th style={{ textAlign: 'right' }}>Balance Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchaseReport.map(p => {
                    const tot = Number(p.totalAmount) || 0;
                    const paid = p.paymentStatus === 'Paid' ? tot : (Number(p.paidAmount) || 0);
                    const due = Math.max(0, tot - paid);
                    return (
                      <tr key={p.id || p.invoiceNumber}>
                        <td className="text-muted">{(p.date || '').split('T')[0]}</td>
                        <td><span className="invoice-badge">{p.invoiceNumber}</span></td>
                        <td className="font-medium">{p.supplierName || 'Vendor'}</td>
                        <td>{p.paymentMode || 'Cash'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(tot, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(paid, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: due > 0 ? '#dc2626' : 'var(--text-muted)' }}>{formatCurrency(due, currencyFilter)}</td>
                        <td>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 700,
                            background: due <= 0 ? '#ecfdf5' : '#fee2e2',
                            color: due <= 0 ? '#059669' : '#dc2626'
                          }}>
                            {due <= 0 ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 3: DAY BOOK */}
        {/* ============================================================ */}
        {activeTab === 'day-book' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Select Date:</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 'auto', height: '34px', fontSize: '0.82rem' }}
                  value={dayBookDate}
                  disabled={dayBookAllDates}
                  onChange={e => setDayBookDate(e.target.value)}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={dayBookAllDates} onChange={e => setDayBookAllDates(e.target.checked)} />
                  Show Full Period ({dayBookEntries.length} txns)
                </label>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `DayBook_${dayBookDate}.csv`,
                  ['Date', 'Ref No', 'Party Name', 'Type', 'Payment Mode', 'Total Amount', 'Money In', 'Money Out'],
                  dayBookEntries.map(e => [e.date, e.refNo, e.partyName, e.type, e.paymentMode, e.totalAmount, e.moneyIn, e.moneyOut])
                )}>
                <Download size={14} /> Export Day Book CSV
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Total Money In</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#059669' }}>
                  {formatCurrency(dayBookEntries.reduce((s, e) => s + e.moneyIn, 0), currencyFilter)}
                </h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Total Money Out</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#dc2626' }}>
                  {formatCurrency(dayBookEntries.reduce((s, e) => s + e.moneyOut, 0), currencyFilter)}
                </h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Net Cash Movement</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#2563eb' }}>
                  {formatCurrency(dayBookEntries.reduce((s, e) => s + (e.moneyIn - e.moneyOut), 0), currencyFilter)}
                </h3>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ref No</th>
                    <th>Party / Particulars</th>
                    <th>Type</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Money In (+)</th>
                    <th style={{ textAlign: 'right' }}>Money Out (-)</th>
                  </tr>
                </thead>
                <tbody>
                  {dayBookEntries.map(e => (
                    <tr key={e.id}>
                      <td className="text-muted">{e.date}</td>
                      <td><span className="invoice-badge">{e.refNo}</span></td>
                      <td className="font-medium">{e.partyName}</td>
                      <td>{e.type}</td>
                      <td>{e.paymentMode}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(e.totalAmount, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{e.moneyIn > 0 ? formatCurrency(e.moneyIn, currencyFilter) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{e.moneyOut > 0 ? formatCurrency(e.moneyOut, currencyFilter) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 4: ALL TRANSACTIONS */}
        {/* ============================================================ */}
        {activeTab === 'all-txns' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ width: '240px' }}>
                  <Search size={14} className="search-icon" />
                  <input className="search-input" placeholder="Search party or voucher..." value={allTxnSearch} onChange={e => setAllTxnSearch(e.target.value)} />
                </div>
                {['ALL', 'Sale', 'Purchase', 'Payment-In', 'Expense', 'Credit Note'].map(tp => (
                  <button
                    key={tp}
                    onClick={() => setAllTxnTypeFilter(tp)}
                    style={{
                      padding: '0.32rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (allTxnTypeFilter === tp ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: allTxnTypeFilter === tp ? '#eff6ff' : 'transparent',
                      color: allTxnTypeFilter === tp ? '#2563eb' : 'var(--text-secondary)'
                    }}>
                    {tp}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `All_Transactions_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Date', 'Type', 'Ref No', 'Party Name', 'Payment Mode', 'Total Amount', 'Balance'],
                  allTransactionsFiltered.map(t => [t.date, t.type, t.refNo, t.partyName, t.paymentMode, t.totalAmount, t.balance])
                )}>
                <Download size={14} /> Export CSV
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Txn Type</th>
                    <th>Ref No</th>
                    <th>Party Name</th>
                    <th>Payment Mode</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {allTransactionsFiltered.map(t => (
                    <tr key={t.id}>
                      <td className="text-muted">{t.date}</td>
                      <td className="font-medium">{t.type}</td>
                      <td><span className="invoice-badge">{t.refNo}</span></td>
                      <td className="font-medium">{t.partyName}</td>
                      <td>{t.paymentMode}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(t.totalAmount, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', color: t.balance > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                        {t.balance > 0 ? formatCurrency(t.balance, currencyFilter) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 5: PROFIT & LOSS STATEMENT (TRADING & P&L) */}
        {/* ============================================================ */}
        {activeTab === 'pl' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 1fr) minmax(360px, 1.2fr)', gap: '1rem', flex: 1, minHeight: 0 }}>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Trading & Profit & Loss Account</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>GAAP Standard Trading Account</p>
                </div>
                <button onClick={exportPLPdf} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>
                  <Download size={14} /> Export P&L PDF
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <tbody>
                    <tr style={{ background: 'var(--bg-secondary, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                      <td colSpan={2} style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#2563eb', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                        I. Trading Account (Gross Profit)
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                      <td style={{ padding: '0.55rem 0.75rem' }}>Gross Sales Billings</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(plSummary.totalRevenue, currencyFilter)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                      <td style={{ padding: '0.55rem 0.75rem' }}>Less: GST Collected on Invoices</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(plSummary.totalTaxCollected, currencyFilter)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1.5px solid var(--border-color, #e5e7eb)', background: '#f8fafc' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Net Sales Revenue (Turnover)</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(plSummary.netRevenue, currencyFilter)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                      <td style={{ padding: '0.55rem 0.75rem' }}>Less: Cost of Goods Sold (COGS)</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(plSummary.totalCOGS, currencyFilter)}</td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #059669', background: '#ecfdf5' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 800, color: '#065f46' }}>
                        GROSS PROFIT ({plSummary.grossMarginPct.toFixed(1)}%)
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', color: '#059669' }}>
                        {formatCurrency(plSummary.grossProfit, currencyFilter)}
                      </td>
                    </tr>
                    <tr style={{ background: 'var(--bg-secondary, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                      <td colSpan={2} style={{ padding: '0.75rem 0.75rem 0.5rem', fontWeight: 700, color: '#7c3aed', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                        II. Operating & Indirect Expenses
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                      <td style={{ padding: '0.55rem 0.75rem' }}>Total Operating Expenses</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(plSummary.totalExpenseAmount, currencyFilter)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                      <td style={{ padding: '0.55rem 0.75rem' }}>Less: GST Input Credit on Expenses</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: '#059669' }}>-{formatCurrency(plSummary.totalExpenseGST, currencyFilter)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1.5px solid var(--border-color, #e5e7eb)', background: '#f8fafc' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Net Operating Expenses</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(plSummary.netOperatingExpenses, currencyFilter)}</td>
                    </tr>
                    <tr style={{ background: plSummary.netProfit >= 0 ? '#f0fdf4' : '#fff1f2', borderTop: '2px solid ' + (plSummary.netProfit >= 0 ? '#16a34a' : '#e11d48') }}>
                      <td style={{ padding: '0.9rem 0.75rem', fontWeight: 800, fontSize: '1.05rem', color: plSummary.netProfit >= 0 ? '#166534' : '#9f1239' }}>
                        NET {plSummary.netProfit >= 0 ? 'PROFIT' : 'LOSS'}
                      </td>
                      <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', color: plSummary.netProfit >= 0 ? '#16a34a' : '#e11d48' }}>
                        {formatCurrency(Math.abs(plSummary.netProfit), currencyFilter)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.85rem', fontSize: '1.05rem', fontWeight: 700 }}>Monthly Profit & Loss Breakdown</h3>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>COGS</th>
                      <th style={{ textAlign: 'right' }}>Expenses</th>
                      <th style={{ textAlign: 'right' }}>Net Profit</th>
                      <th style={{ textAlign: 'right' }}>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyPL.map(m => (
                      <tr key={m.key}>
                        <td className="font-medium">{m.label}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(m.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: '#ea580c' }}>{formatCurrency(m.cogs, currencyFilter)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(m.expenses, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: m.netProfit >= 0 ? '#059669' : '#dc2626' }}>
                          {formatCurrency(Math.abs(m.netProfit), currencyFilter)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{m.marginPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 6: BILL-WISE PROFIT & LOSS */}
        {/* ============================================================ */}
        {activeTab === 'bill-profit' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ width: '260px' }}>
                  <Search size={15} className="search-icon" />
                  <input type="text" placeholder="Search invoice or customer..." value={billProfitSearch} onChange={e => setBillProfitSearch(e.target.value)} className="search-input" />
                </div>
                {[
                  { id: 'all', label: 'All Invoices' },
                  { id: 'high', label: 'High Margin (≥20%)' },
                  { id: 'med', label: 'Moderate (5-20%)' },
                  { id: 'low', label: 'Low / Loss (<5%)' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setBillProfitFilter(p.id)}
                    style={{
                      padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (billProfitFilter === p.id ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: billProfitFilter === p.id ? '#eff6ff' : 'transparent',
                      color: billProfitFilter === p.id ? '#2563eb' : 'var(--text-secondary)'
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `Bill_Wise_Profit_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Invoice No', 'Date', 'Customer Name', 'Invoice Amount', 'Net Sales', 'COGS', 'Gross Profit', 'Margin %'],
                  filteredBillProfit.map(b => [b.invoiceNumber, b.date, b.clientName, b.revenue, b.netSales, b.cogs, b.grossProfit.toFixed(2), b.marginPct.toFixed(1)])
                )}>
                <Download size={14} /> Export CSV
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}></th>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th style={{ textAlign: 'right' }}>Invoice Amount</th>
                    <th style={{ textAlign: 'right' }}>Net Sales</th>
                    <th style={{ textAlign: 'right' }}>Cost (COGS)</th>
                    <th style={{ textAlign: 'right' }}>Gross Profit</th>
                    <th style={{ textAlign: 'right' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBillProfit.map(bill => {
                    const isExpanded = expandedBillId === bill.id;
                    const isProfit = bill.grossProfit >= 0;
                    return (
                      <React.Fragment key={bill.id}>
                        <tr onClick={() => setExpandedBillId(isExpanded ? null : bill.id)} style={{ cursor: 'pointer' }}>
                          <td style={{ textAlign: 'center' }}>{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</td>
                          <td><span className="invoice-badge">{bill.invoiceNumber}</span></td>
                          <td className="text-muted">{(bill.date || '').split('T')[0]}</td>
                          <td className="font-medium">{bill.clientName}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(bill.revenue, currencyFilter)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(bill.netSales, currencyFilter)}</td>
                          <td style={{ textAlign: 'right', color: '#ea580c' }}>{formatCurrency(bill.cogs, currencyFilter)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isProfit ? '#059669' : '#dc2626' }}>
                            {formatCurrency(Math.abs(bill.grossProfit), currencyFilter)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{bill.marginPct.toFixed(1)}%</td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: '#f8fafc' }}>
                            <td></td>
                            <td colSpan={8} style={{ padding: '0.75rem 1rem' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', background: '#fff', border: '1px solid #e2e8f0' }}>
                                <thead>
                                  <tr style={{ background: '#f1f5f9' }}>
                                    <th style={{ padding: '0.35rem 0.6rem', textAlign: 'left' }}>Item</th>
                                    <th style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>Qty</th>
                                    <th style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>Sell Rate</th>
                                    <th style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>Cost Rate</th>
                                    <th style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>Profit</th>
                                    <th style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>Margin %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bill.items.map((it, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600 }}>{it.name}</td>
                                      <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>{it.qty} {it.unit}</td>
                                      <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>{formatCurrency(it.sellRate, currencyFilter)}</td>
                                      <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', color: '#ea580c' }}>{formatCurrency(it.unitCost, currencyFilter)}</td>
                                      <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right', fontWeight: 700, color: it.profit >= 0 ? '#059669' : '#dc2626' }}>{formatCurrency(it.profit, currencyFilter)}</td>
                                      <td style={{ padding: '0.35rem 0.6rem', textAlign: 'right' }}>{it.marginPct.toFixed(1)}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 7: CASH FLOW STATEMENT */}
        {/* ============================================================ */}
        {activeTab === 'cash-flow' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '1rem', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
              <div className="stat-card" style={{ padding: '0.85rem 1rem' }}>
                <p className="stat-label">Opening Cash & Bank</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem' }}>{formatCurrency(cashFlowSummary.openingTotal, currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.85rem 1rem' }}>
                <p className="stat-label">Total Cash Inflows (+)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#059669' }}>+{formatCurrency(cashFlowSummary.totalInflows, currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.85rem 1rem' }}>
                <p className="stat-label">Total Cash Outflows (-)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#dc2626' }}>-{formatCurrency(cashFlowSummary.totalOutflows, currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.85rem 1rem' }}>
                <p className="stat-label">Closing Liquid Balance</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#2563eb' }}>{formatCurrency(cashFlowSummary.closingLiquidBalance, currencyFilter)}</h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px', padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', color: '#059669', fontSize: '0.92rem', fontWeight: 800 }}>CASH INFLOWS (MONEY IN)</h4>
                <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                  <tbody>
                    <tr>
                      <td>Collections from Sale Invoices</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(cashFlowSummary.saleCashIn, currencyFilter)}</td>
                    </tr>
                    <tr>
                      <td>Payment-In Receipts & Advances</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(cashFlowSummary.receiptCashIn, currencyFilter)}</td>
                    </tr>
                    <tr style={{ background: '#ecfdf5', fontWeight: 800 }}>
                      <td>Total Cash Inflow</td>
                      <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(cashFlowSummary.totalInflows, currencyFilter)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px', padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', color: '#dc2626', fontSize: '0.92rem', fontWeight: 800 }}>CASH OUTFLOWS (MONEY OUT)</h4>
                <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                  <tbody>
                    <tr>
                      <td>Payments for Purchase Bills</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(cashFlowSummary.purchaseCashOut, currencyFilter)}</td>
                    </tr>
                    <tr>
                      <td>Operating & Indirect Expenses Paid</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(cashFlowSummary.expenseCashOut, currencyFilter)}</td>
                    </tr>
                    <tr style={{ background: '#fff1f2', fontWeight: 800 }}>
                      <td>Total Cash Outflow</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{formatCurrency(cashFlowSummary.totalOutflows, currencyFilter)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 8: BALANCE SHEET (VYAPAR HORIZONTAL T-ACCOUNT) */}
        {/* ============================================================ */}
        {activeTab === 'balance-sheet' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '1rem', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', flex: 1 }}>
              {/* Left Column: Liabilities & Capital */}
              <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', background: '#fff1f2', borderBottom: '1px solid #fecdd3', fontWeight: 800, color: '#9f1239', display: 'flex', justifyContent: 'space-between' }}>
                  <span>LIABILITIES & EQUITY</span>
                  <span>AMOUNT</span>
                </div>
                <div style={{ padding: '0.75rem 1rem', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0', fontWeight: 600 }}>Sundry Creditors (Accounts Payable)</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(balanceSheetData.accountsPayable, currencyFilter)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0', fontWeight: 600 }}>Loan & OD Accounts Payable</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(balanceSheetData.loanLiabilities, currencyFilter)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0', fontWeight: 600 }}>Net Profit (Retained Earnings)</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(balanceSheetData.retainedProfit, currencyFilter)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0', fontWeight: 600 }}>Owner Capital & Opening Equity Adj.</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(balanceSheetData.ownerCapital, currencyFilter)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                  <span>Total Liabilities & Equity</span>
                  <span>{formatCurrency(balanceSheetData.totalLiabilitiesAndEquity, currencyFilter)}</span>
                </div>
              </div>

              {/* Right Column: Assets */}
              <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', borderBottom: '1px solid #a7f3d0', fontWeight: 800, color: '#065f46', display: 'flex', justifyContent: 'space-between' }}>
                  <span>ASSETS (PROPERTIES & RECEIVABLES)</span>
                  <span>AMOUNT</span>
                </div>
                <div style={{ padding: '0.75rem 1rem', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0', fontWeight: 600 }}>Cash-in-Hand & Bank Balances</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(balanceSheetData.cashAndBank, currencyFilter)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0', fontWeight: 600 }}>Sundry Debtors (Accounts Receivable)</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(balanceSheetData.accountsReceivable, currencyFilter)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0', fontWeight: 600 }}>Closing Inventory (Valued at Cost)</td>
                        <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{formatCurrency(balanceSheetData.inventoryAsset, currencyFilter)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                  <span>Total Assets</span>
                  <span>{formatCurrency(balanceSheetData.totalAssets, currencyFilter)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 9: PARTY STATEMENT (LEDGER) */}
        {/* ============================================================ */}
        {activeTab === 'party-statement' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Select Party:</label>
                <select
                  className="form-input"
                  style={{ width: '280px', height: '35px', fontWeight: 700 }}
                  value={selectedPartyName}
                  onChange={e => setSelectedPartyName(e.target.value)}>
                  <option value="">-- Choose Customer or Supplier --</option>
                  {allPartiesSummary.map(p => (
                    <option key={p.name} value={p.name}>{p.name} ({p.partyRole})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {selectedPartyName && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', color: '#059669' }}
                    onClick={() => {
                      const msg = `Dear *${selectedPartyName}*,\nStatement Summary from *${profile?.businessName || 'us'}*:\nTotal Debit: ${formatCurrency(partyStatementData.totalDebit, currencyFilter)}\nTotal Credit: ${formatCurrency(partyStatementData.totalCredit, currencyFilter)}\nClosing Balance: *${formatCurrency(Math.abs(partyStatementData.closingBalance), currencyFilter)} (${partyStatementData.closingBalance >= 0 ? 'Receivable' : 'Payable'})*`;
                      openWhatsAppShare(partyStatementData.phone, msg);
                    }}>
                    <MessageCircle size={14} /> Share Statement on WhatsApp
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => downloadCSV(
                    `Party_Statement_${selectedPartyName || 'Party'}.csv`,
                    ['Date', 'Txn Type', 'Ref No', 'Debit (+)', 'Credit (-)', 'Running Balance'],
                    partyStatementData.entries.map(e => [e.date, e.type, e.refNo, e.debit, e.credit, e.runningBalance])
                  )}>
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Opening Balance</p>
                <h3 className="stat-value" style={{ fontSize: '1.15rem' }}>{formatCurrency(partyStatementData.openingBalance, currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Total Billed / Debit</p>
                <h3 className="stat-value" style={{ fontSize: '1.15rem', color: '#2563eb' }}>{formatCurrency(partyStatementData.totalDebit, currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Total Received / Credit</p>
                <h3 className="stat-value" style={{ fontSize: '1.15rem', color: '#059669' }}>{formatCurrency(partyStatementData.totalCredit, currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                <p className="stat-label">Closing Balance</p>
                <h3 className="stat-value" style={{ fontSize: '1.15rem', color: partyStatementData.closingBalance >= 0 ? '#059669' : '#dc2626' }}>
                  {formatCurrency(Math.abs(partyStatementData.closingBalance), currencyFilter)} ({partyStatementData.closingBalance >= 0 ? 'To Collect' : 'To Pay'})
                </h3>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction Type</th>
                    <th>Ref / Voucher No</th>
                    <th style={{ textAlign: 'right' }}>Debit (+)</th>
                    <th style={{ textAlign: 'right' }}>Credit (-)</th>
                    <th style={{ textAlign: 'right' }}>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {partyStatementData.entries.map(e => (
                    <tr key={e.id}>
                      <td className="text-muted">{e.date}</td>
                      <td className="font-medium">{e.type}</td>
                      <td><span className="invoice-badge">{e.refNo}</span></td>
                      <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>{e.debit > 0 ? formatCurrency(e.debit, currencyFilter) : '—'}</td>
                      <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>{e.credit > 0 ? formatCurrency(e.credit, currencyFilter) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: e.runningBalance >= 0 ? '#059669' : '#dc2626' }}>
                        {formatCurrency(Math.abs(e.runningBalance), currencyFilter)} {e.runningBalance >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 10: ALL PARTIES REPORT */}
        {/* ============================================================ */}
        {activeTab === 'all-parties' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                <div className="search-box" style={{ width: '250px' }}>
                  <Search size={14} className="search-icon" />
                  <input className="search-input" placeholder="Search party, GSTIN, phone..." value={allPartiesSearch} onChange={e => setAllPartiesSearch(e.target.value)} />
                </div>
                {[
                  { id: 'ALL', label: `All Parties (${allPartiesSummary.length})` },
                  { id: 'RECEIVABLE', label: 'To Collect (Receivable)' },
                  { id: 'PAYABLE', label: 'To Pay (Payable)' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setPartyTypeFilter(f.id)}
                    style={{
                      padding: '0.35rem 0.7rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (partyTypeFilter === f.id ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: partyTypeFilter === f.id ? '#eff6ff' : 'transparent',
                      color: partyTypeFilter === f.id ? '#2563eb' : 'var(--text-secondary)'
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `All_Parties_Report_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Party Name', 'Role', 'GSTIN', 'Phone', 'Credit Limit', 'Net Balance', 'Type'],
                  filteredAllParties.map(p => [p.name, p.partyRole, p.gstin, p.phone, p.creditLimit, Math.abs(p.netBalance), p.netBalance >= 0 ? 'Receivable' : 'Payable'])
                )}>
                <Download size={14} /> Export CSV
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Party Name</th>
                    <th>Category</th>
                    <th>GSTIN</th>
                    <th>Phone</th>
                    <th style={{ textAlign: 'right' }}>Credit Limit</th>
                    <th style={{ textAlign: 'right' }}>Closing Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllParties.map(p => (
                    <tr key={p.name} onClick={() => { setSelectedPartyName(p.name); setActiveTab('party-statement'); }} style={{ cursor: 'pointer' }}>
                      <td className="font-medium" style={{ color: '#2563eb' }}>{p.name}</td>
                      <td>{p.partyRole}</td>
                      <td className="text-muted">{p.gstin || '—'}</td>
                      <td className="text-muted">{p.phone || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{p.creditLimit > 0 ? formatCurrency(p.creditLimit, currencyFilter) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: p.netBalance >= 0 ? '#059669' : '#dc2626' }}>
                        {formatCurrency(Math.abs(p.netBalance), currencyFilter)}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 700,
                          background: p.netBalance > 0 ? '#ecfdf5' : p.netBalance < 0 ? '#fff1f2' : '#f1f5f9',
                          color: p.netBalance > 0 ? '#059669' : p.netBalance < 0 ? '#e11d48' : '#64748b'
                        }}>
                          {p.netBalance > 0 ? 'To Collect' : p.netBalance < 0 ? 'To Pay' : 'Settled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 11: PARTY WISE PROFIT & LOSS */}
        {/* ============================================================ */}
        {activeTab === 'party-profit' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Showing profitability across {partyProfitList.length} customers</span>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `Party_Wise_Profit_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Customer Name', 'Invoices', 'Gross Billings', 'Net Sales', 'COGS', 'Gross Profit', 'Margin %'],
                  partyProfitList.map(p => [p.partyName, p.invoiceCount, p.revenue, p.netSales, p.cogs, p.grossProfit.toFixed(2), p.marginPct.toFixed(1)])
                )}>
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th style={{ textAlign: 'right' }}>Invoices</th>
                    <th style={{ textAlign: 'right' }}>Total Sales</th>
                    <th style={{ textAlign: 'right' }}>Net Sales (Ex-Tax)</th>
                    <th style={{ textAlign: 'right' }}>COGS (Purchase Cost)</th>
                    <th style={{ textAlign: 'right' }}>Gross Profit</th>
                    <th style={{ textAlign: 'right' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {partyProfitList.map(p => (
                    <tr key={p.partyName}>
                      <td className="font-medium">{p.partyName}</td>
                      <td style={{ textAlign: 'right' }}>{p.invoiceCount}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(p.revenue, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(p.netSales, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', color: '#ea580c' }}>{formatCurrency(p.cogs, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: p.grossProfit >= 0 ? '#059669' : '#dc2626' }}>
                        {formatCurrency(Math.abs(p.grossProfit), currencyFilter)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 12: PARTY AGING ANALYSIS (RECEIVABLES & PAYABLES) */}
        {/* ============================================================ */}
        {activeTab === 'aging' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={() => setAgingTab('receivables')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                    border: '1px solid ' + (agingTab === 'receivables' ? '#059669' : 'var(--border-color, #e5e7eb)'),
                    background: agingTab === 'receivables' ? '#ecfdf5' : 'var(--card-bg, #ffffff)',
                    color: agingTab === 'receivables' ? '#065f46' : 'var(--text-secondary)'
                  }}>
                  <ArrowDownLeft size={15} /> Receivables ({formatCurrency(receivablesAging.reduce((s, r) => s + r.outstanding, 0), currencyFilter)})
                </button>
                <button
                  onClick={() => setAgingTab('payables')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                    border: '1px solid ' + (agingTab === 'payables' ? '#e11d48' : 'var(--border-color, #e5e7eb)'),
                    background: agingTab === 'payables' ? '#fff1f2' : 'var(--card-bg, #ffffff)',
                    color: agingTab === 'payables' ? '#9f1239' : 'var(--text-secondary)'
                  }}>
                  <ArrowUpRight size={15} /> Payables ({formatCurrency(payablesAging.reduce((s, r) => s + r.outstanding, 0), currencyFilter)})
                </button>
              </div>
              <div className="search-box" style={{ width: '260px' }}>
                <Search size={14} className="search-icon" />
                <input type="text" placeholder="Search party or bill..." value={agingSearch} onChange={e => setAgingSearch(e.target.value)} className="search-input" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.65rem' }}>
              <div className="stat-card" style={{ padding: '0.7rem 0.9rem' }}>
                <p className="stat-label">Total Outstanding</p>
                <h3 className="stat-value" style={{ fontSize: '1.15rem' }}>{formatCurrency(agingBuckets.total, currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.7rem 0.9rem' }}>
                <p className="stat-label">0–30 Days</p>
                <h3 className="stat-value stat-value-green" style={{ fontSize: '1.15rem' }}>{formatCurrency(agingBuckets.current, currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.7rem 0.9rem' }}>
                <p className="stat-label">31–60 Days</p>
                <h3 className="stat-value stat-value-amber" style={{ fontSize: '1.15rem' }}>{formatCurrency(agingBuckets['31to60'], currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.7rem 0.9rem' }}>
                <p className="stat-label">61–90 Days</p>
                <h3 className="stat-value stat-value-purple" style={{ fontSize: '1.15rem' }}>{formatCurrency(agingBuckets['61to90'], currencyFilter)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.7rem 0.9rem' }}>
                <p className="stat-label">90+ Days</p>
                <h3 className="stat-value" style={{ fontSize: '1.15rem', color: '#dc2626' }}>{formatCurrency(agingBuckets['90plus'], currencyFilter)}</h3>
              </div>
            </div>

            <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Party Name</th>
                      <th>Ref Number</th>
                      <th>Date</th>
                      <th>Due Date</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                      <th style={{ textAlign: 'right' }}>Outstanding</th>
                      <th style={{ textAlign: 'right' }}>Days Overdue</th>
                      {agingTab === 'receivables' && <th style={{ textAlign: 'center' }}>Reminder</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAging.map((r, i) => (
                      <tr key={i}>
                        <td className="font-medium">{r.partyName}</td>
                        <td><span className="invoice-badge">{r.docNumber}</span></td>
                        <td className="text-muted">{(r.date || '').split('T')[0]}</td>
                        <td className="text-muted">{(r.dueDate || '').split('T')[0]}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.totalAmount, r.currency)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(r.outstanding, r.currency)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.daysOverdue === 0 ? 'Current' : `${r.daysOverdue}d`}</td>
                        {agingTab === 'receivables' && (
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => handleWhatsAppReminder(r)} className="btn btn-secondary" style={{ padding: '0.2rem 0.55rem', fontSize: '0.73rem', color: '#059669' }}>
                              <MessageCircle size={13} /> WhatsApp
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 13: GSTR-1 (OUTWARD SUPPLIES RETURN) */}
        {/* ============================================================ */}
        {activeTab === 'gstr-1' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[
                  { id: 'ALL', label: 'All Supplies' },
                  { id: 'B2B', label: 'B2B (Registered)' },
                  { id: 'B2CL', label: 'B2C Large (>2.5L)' },
                  { id: 'B2CS', label: 'B2C Small' },
                  { id: 'CDNR', label: 'Credit Notes' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setGstr1SubTab(t.id)}
                    style={{
                      padding: '0.35rem 0.7rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer',
                      border: '1px solid ' + (gstr1SubTab === t.id ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: gstr1SubTab === t.id ? '#eff6ff' : 'transparent',
                      color: gstr1SubTab === t.id ? '#2563eb' : 'var(--text-secondary)'
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `GSTR1_Report_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Date', 'Invoice No', 'Party Name', 'GSTIN', 'Table', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Invoice Total'],
                  gstr1Rows.map(r => [r.date, r.invoiceNumber, r.partyName, r.gstin, r.section, r.taxable.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), r.igst.toFixed(2), r.totalTax.toFixed(2), r.totalAmount.toFixed(2)])
                )}>
                <Download size={14} /> Export GSTR-1 CSV
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice No</th>
                    <th>Customer Name</th>
                    <th>GSTIN</th>
                    <th>Section</th>
                    <th style={{ textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST</th>
                    <th style={{ textAlign: 'right' }}>IGST</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {gstr1Rows.map(r => (
                    <tr key={r.id}>
                      <td className="text-muted">{r.date}</td>
                      <td><span className="invoice-badge">{r.invoiceNumber}</span></td>
                      <td className="font-medium">{r.partyName}</td>
                      <td className="text-muted" style={{ fontSize: '0.78rem' }}>{r.gstin}</td>
                      <td><span className="invoice-badge">{r.section}</span></td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgst, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgst, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.igst, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(r.totalAmount, currencyFilter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 14: GSTR-2 (INWARD PURCHASE ITC REPORT) */}
        {/* ============================================================ */}
        {activeTab === 'gstr-2' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                Total Eligible Input Tax Credit (ITC): <strong style={{ color: '#059669' }}>{formatCurrency(gstr2Rows.reduce((s, r) => s + r.totalTax, 0), currencyFilter)}</strong>
              </span>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `GSTR2_Purchase_ITC_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Date', 'Bill No', 'Supplier Name', 'Source', 'Taxable Value', 'CGST ITC', 'SGST ITC', 'Total ITC', 'Total Bill Amount'],
                  gstr2Rows.map(r => [r.date, r.docNo, r.supplierName, r.source, r.taxable.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), r.totalTax.toFixed(2), r.totalAmount.toFixed(2)])
                )}>
                <Download size={14} /> Export GSTR-2 CSV
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bill / Ref No</th>
                    <th>Supplier / Expense</th>
                    <th>Source</th>
                    <th style={{ textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST</th>
                    <th style={{ textAlign: 'right' }}>Total ITC</th>
                    <th style={{ textAlign: 'right' }}>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {gstr2Rows.map(r => (
                    <tr key={r.id}>
                      <td className="text-muted">{r.date}</td>
                      <td><span className="invoice-badge">{r.docNo}</span></td>
                      <td className="font-medium">{r.supplierName}</td>
                      <td>{r.source}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxable, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgst, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgst, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(r.totalTax, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(r.totalAmount, currencyFilter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 15: GSTR-3B MONTHLY SUMMARY */}
        {/* ============================================================ */}
        {activeTab === 'gstr-3b' && (() => {
          const outTaxable = gstr1Rows.reduce((s, r) => s + (r.section === 'CDNR' ? -r.taxable : r.taxable), 0);
          const outTax = gstr1Rows.reduce((s, r) => s + (r.section === 'CDNR' ? -r.totalTax : r.totalTax), 0);
          const inTaxable = gstr2Rows.reduce((s, r) => s + r.taxable, 0);
          const inITC = gstr2Rows.reduce((s, r) => s + r.totalTax, 0);
          const netPayable = outTax - inITC;
          return (
            <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '1.1rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
                <div className="stat-card" style={{ padding: '0.9rem 1rem' }}>
                  <p className="stat-label">3.1 Outward Output Tax</p>
                  <h3 className="stat-value" style={{ fontSize: '1.3rem', color: '#dc2626' }}>{formatCurrency(outTax, currencyFilter)}</h3>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>On {formatCurrency(outTaxable, currencyFilter)} taxable sales</p>
                </div>
                <div className="stat-card" style={{ padding: '0.9rem 1rem' }}>
                  <p className="stat-label">4. Eligible Input Tax Credit (ITC)</p>
                  <h3 className="stat-value" style={{ fontSize: '1.3rem', color: '#059669' }}>{formatCurrency(inITC, currencyFilter)}</h3>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>On {formatCurrency(inTaxable, currencyFilter)} inward supplies</p>
                </div>
                <div className="stat-card" style={{ padding: '0.9rem 1rem' }}>
                  <p className="stat-label">6.1 Net GST {netPayable >= 0 ? 'Payable' : 'ITC Carryforward'}</p>
                  <h3 className="stat-value" style={{ fontSize: '1.3rem', color: netPayable >= 0 ? '#2563eb' : '#059669' }}>
                    {formatCurrency(Math.abs(netPayable), currencyFilter)}
                  </h3>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{netPayable >= 0 ? 'Net Liability in Cash Ledger' : 'Surplus Credit Balance'}</p>
                </div>
              </div>

              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>GSTR-3B Table Section</th>
                    <th style={{ textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST / UTGST</th>
                    <th style={{ textAlign: 'right' }}>IGST</th>
                    <th style={{ textAlign: 'right' }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium">3.1(a) Outward Taxable Supplies (Other than zero rated, nil rated and exempted)</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(outTaxable, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(outTax / 2, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(outTax / 2, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(0, currencyFilter)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(outTax, currencyFilter)}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">4(A)(5) All Other Eligible ITC (Purchases & Business Expenses)</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(inTaxable, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(inITC / 2, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(inITC / 2, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(0, currencyFilter)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(inITC, currencyFilter)}</td>
                  </tr>
                  <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                    <td>Net Tax Payable (Output Tax minus Eligible ITC)</td>
                    <td style={{ textAlign: 'right' }}>—</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency((outTax - inITC) / 2, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency((outTax - inITC) / 2, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(0, currencyFilter)}</td>
                    <td style={{ textAlign: 'right', color: netPayable >= 0 ? '#dc2626' : '#059669' }}>{formatCurrency(netPayable, currencyFilter)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* REPORT 16: GST RATE WISE TAX SUMMARY */}
        {/* ============================================================ */}
        {activeTab === 'gst-rate-report' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>GST Slab Rate</th>
                  <th style={{ textAlign: 'right' }}>Sale Taxable Amount</th>
                  <th style={{ textAlign: 'right' }}>Output Tax (Sale)</th>
                  <th style={{ textAlign: 'right' }}>Purchase Taxable Amount</th>
                  <th style={{ textAlign: 'right' }}>Input Tax (Purchase)</th>
                  <th style={{ textAlign: 'right' }}>Net GST Payable</th>
                </tr>
              </thead>
              <tbody>
                {gstRateSummary.map(r => (
                  <tr key={r.rate}>
                    <td className="font-medium">GST @ {r.rate}%</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(r.saleTaxable, currencyFilter)}</td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{formatCurrency(r.saleTax, currencyFilter)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(r.purTaxable, currencyFilter)}</td>
                    <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>{formatCurrency(r.purTax, currencyFilter)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(r.saleTax - r.purTax, currencyFilter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 17: SAC / HSN SUMMARY */}
        {/* ============================================================ */}
        {activeTab === 'hsn-summary' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Grouped across {hsnSummaryList.length} HSN / SAC codes</span>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `HSN_Summary_${new Date().toISOString().split('T')[0]}.csv`,
                  ['HSN/SAC', 'Description', 'UQC', 'Total Qty', 'Taxable Value', 'Rate %', 'CGST', 'SGST', 'Total Tax'],
                  hsnSummaryList.map(h => [h.hsn, h.description, h.unit, h.qty, h.taxable.toFixed(2), h.gstPct, h.cgst.toFixed(2), h.sgst.toFixed(2), h.totalTax.toFixed(2)])
                )}>
                <Download size={14} /> Export HSN CSV
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>HSN / SAC</th>
                    <th>Description</th>
                    <th>UQC (Unit)</th>
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th style={{ textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right' }}>Rate %</th>
                    <th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST</th>
                    <th style={{ textAlign: 'right' }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnSummaryList.map(h => (
                    <tr key={h.hsn}>
                      <td><span className="invoice-badge">{h.hsn}</span></td>
                      <td className="font-medium">{h.description}</td>
                      <td>{h.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{h.qty}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(h.taxable, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{h.gstPct}%</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(h.cgst, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(h.sgst, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(h.totalTax, currencyFilter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 18: STOCK SUMMARY & VALUATION */}
        {/* ============================================================ */}
        {activeTab === 'stock-valuation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
                <p className="stat-label">Total Catalog SKUs</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem' }}>{stockValuation.totalItems} Items</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
                <p className="stat-label">Inventory Value (At Cost)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#2563eb' }}>{formatCurrency(stockValuation.totalCostValuation, profileCurrency)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
                <p className="stat-label">Retail Value (At Sale Price)</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#059669' }}>{formatCurrency(stockValuation.totalSellingValuation, profileCurrency)}</h3>
              </div>
              <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
                <p className="stat-label">Potential Gross Profit</p>
                <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#16a34a' }}>{formatCurrency(stockValuation.potentialProfit, profileCurrency)}</h3>
              </div>
            </div>

            <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div className="search-box" style={{ width: '250px' }}>
                    <Search size={14} className="search-icon" />
                    <input type="text" placeholder="Search product or HSN..." value={stockSearch} onChange={e => setStockSearch(e.target.value)} className="search-input" />
                  </div>
                  {[
                    { id: 'all', label: `All Items (${products.length})` },
                    { id: 'low', label: `Low Stock (${stockValuation.lowStockCount})` },
                    { id: 'out', label: `Out of Stock (${stockValuation.outOfStockCount})` },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStockStatusFilter(s.id)}
                      style={{
                        padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        border: '1px solid ' + (stockStatusFilter === s.id ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                        background: stockStatusFilter === s.id ? '#eff6ff' : 'transparent',
                        color: stockStatusFilter === s.id ? '#2563eb' : 'var(--text-secondary)'
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <button onClick={exportStockValuationPdf} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>
                  <Download size={14} /> Export Stock PDF
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>HSN</th>
                      <th style={{ textAlign: 'right' }}>Stock On Hand</th>
                      <th style={{ textAlign: 'right' }}>Purchase Price</th>
                      <th style={{ textAlign: 'right' }}>Selling Price</th>
                      <th style={{ textAlign: 'right' }}>Stock Value (Cost)</th>
                      <th style={{ textAlign: 'right' }}>Potential Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map(p => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-muted">{p.hsn || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: p.stock <= 0 ? '#dc2626' : 'inherit' }}>{p.stock} {p.unit}</td>
                        <td style={{ textAlign: 'right', color: '#ea580c' }}>{formatCurrency(p.purchasePrice, profileCurrency)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.sellingPrice, profileCurrency)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.costValuation, profileCurrency)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(p.potentialProfit, profileCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 19: ITEM-WISE PROFIT & LOSS */}
        {/* ============================================================ */}
        {activeTab === 'item-profit' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="search-box" style={{ width: '250px' }}>
                  <Search size={14} className="search-icon" />
                  <input type="text" placeholder="Search item or HSN..." value={itemProfitSearch} onChange={e => setItemProfitSearch(e.target.value)} className="search-input" />
                </div>
                {[
                  { id: 'profit', label: 'Highest Profit' },
                  { id: 'margin', label: 'Highest Margin %' },
                  { id: 'qty', label: 'Units Sold' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setItemProfitSort(s.id)}
                    style={{
                      padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      border: '1px solid ' + (itemProfitSort === s.id ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: itemProfitSort === s.id ? '#eff6ff' : 'transparent',
                      color: itemProfitSort === s.id ? '#2563eb' : 'var(--text-secondary)'
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `Item_Wise_Profit_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Item Name', 'HSN', 'Units Sold', 'Avg Selling Price', 'Avg Cost', 'Total Revenue', 'Total Cost', 'Gross Profit', 'Margin %'],
                  filteredItemProfit.map(it => [it.name, it.hsn, it.qty, it.avgSellRate.toFixed(2), it.avgCostRate.toFixed(2), it.revenue.toFixed(2), it.cost.toFixed(2), it.grossProfit.toFixed(2), it.marginPct.toFixed(1)])
                )}>
                <Download size={14} /> Export CSV
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>HSN</th>
                    <th style={{ textAlign: 'right' }}>Units Sold</th>
                    <th style={{ textAlign: 'right' }}>Avg Sell Rate</th>
                    <th style={{ textAlign: 'right' }}>Avg Cost</th>
                    <th style={{ textAlign: 'right' }}>Total Revenue</th>
                    <th style={{ textAlign: 'right' }}>Total Cost</th>
                    <th style={{ textAlign: 'right' }}>Gross Profit</th>
                    <th style={{ textAlign: 'right' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItemProfit.map(it => (
                    <tr key={it.name}>
                      <td className="font-medium">{it.name}</td>
                      <td className="text-muted">{it.hsn || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.qty} {it.unit}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(it.avgSellRate, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', color: '#ea580c' }}>{formatCurrency(it.avgCostRate, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(it.revenue, currencyFilter)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(it.cost, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: it.grossProfit >= 0 ? '#059669' : '#dc2626' }}>
                        {formatCurrency(Math.abs(it.grossProfit), currencyFilter)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{it.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 20: SALE / PURCHASE BY ITEM */}
        {/* ============================================================ */}
        {activeTab === 'sale-purchase-item' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Item-wise inward & outward movement summary</span>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={() => downloadCSV(
                  `Sale_Purchase_By_Item_${new Date().toISOString().split('T')[0]}.csv`,
                  ['Item Name', 'Sale Qty', 'Sale Value', 'Purchase Qty', 'Purchase Value', 'Closing Stock'],
                  salePurchaseByItem.map(i => [i.name, i.saleQty, i.saleAmt.toFixed(2), i.purchaseQty, i.purchaseAmt.toFixed(2), i.currentStock])
                )}>
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th style={{ textAlign: 'right' }}>Sale Qty</th>
                    <th style={{ textAlign: 'right' }}>Sale Amount</th>
                    <th style={{ textAlign: 'right' }}>Purchase Qty</th>
                    <th style={{ textAlign: 'right' }}>Purchase Amount</th>
                    <th style={{ textAlign: 'right' }}>Current Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {salePurchaseByItem.map(i => (
                    <tr key={i.name}>
                      <td className="font-medium">{i.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{i.saleQty} {i.unit}</td>
                      <td style={{ textAlign: 'right', color: '#059669', fontWeight: 600 }}>{formatCurrency(i.saleAmt, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{i.purchaseQty} {i.unit}</td>
                      <td style={{ textAlign: 'right', color: '#ea580c', fontWeight: 600 }}>{formatCurrency(i.purchaseAmt, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{i.currentStock} {i.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* REPORT 21: LOW STOCK SUMMARY */}
        {/* ============================================================ */}
        {activeTab === 'low-stock' && (() => {
          const lowItems = stockValuation.list.filter(p => p.stock <= p.minStock);
          return (
            <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#dc2626' }}>
                  {lowItems.length} items are at or below minimum stock level
                </span>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => downloadCSV(
                    `Low_Stock_Reorder_${new Date().toISOString().split('T')[0]}.csv`,
                    ['Item Name', 'Current Stock', 'Min Stock Level', 'Deficit Qty', 'Purchase Price', 'Est Reorder Cost'],
                    lowItems.map(p => {
                      const def = Math.max(1, p.minStock - p.stock);
                      return [p.name, p.stock, p.minStock, def, p.purchasePrice, def * p.purchasePrice];
                    })
                  )}>
                  <Download size={14} /> Export Reorder CSV
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th style={{ textAlign: 'right' }}>Current Stock</th>
                      <th style={{ textAlign: 'right' }}>Min Stock Level</th>
                      <th style={{ textAlign: 'right' }}>Shortfall / Deficit</th>
                      <th style={{ textAlign: 'right' }}>Purchase Price</th>
                      <th style={{ textAlign: 'right' }}>Est. Reorder Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowItems.map(p => {
                      const deficit = Math.max(1, p.minStock - p.stock);
                      return (
                        <tr key={p.id}>
                          <td className="font-medium">{p.name}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{p.stock} {p.unit}</td>
                          <td style={{ textAlign: 'right' }}>{p.minStock} {p.unit}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{deficit} {p.unit}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(p.purchasePrice, profileCurrency)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(deficit * p.purchasePrice, profileCurrency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* REPORT 22: EXPENSE CATEGORY REPORT */}
        {/* ============================================================ */}
        {activeTab === 'expense-category' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.1rem', gap: '0.9rem' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Expense Category</th>
                    <th style={{ textAlign: 'right' }}>Transactions</th>
                    <th style={{ textAlign: 'right' }}>Total Spent</th>
                    <th style={{ textAlign: 'right' }}>GST Input Credit</th>
                    <th style={{ textAlign: 'right' }}>Share of Spend %</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseCategoryList.map(c => (
                    <tr key={c.category}>
                      <td className="font-medium">{c.category}</td>
                      <td style={{ textAlign: 'right' }}>{c.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(c.amount, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(c.gst, currencyFilter)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.sharePct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
