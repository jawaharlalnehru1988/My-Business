import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, Clock, Search, X,
  Users, Package, FileText, Download, Percent, AlertTriangle,
  CheckCircle2, MessageCircle, Filter, ArrowUpRight, ArrowDownLeft,
  ChevronDown, ChevronUp, RefreshCw, ShoppingCart, Truck, Layers
} from 'lucide-react';
import {
  getAllBills, getAllExpenses, getAllPurchases, getAllProducts,
  getAllClients, getAllSuppliers, getProfile
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

export default function ReportsView() {
  // Core Data
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);

  // Active Tab: 'pl' | 'bill-profit' | 'item-profit' | 'aging' | 'stock-valuation'
  const [activeTab, setActiveTab] = useState('pl');

  // Filter States
  const [filterMode, setFilterMode] = useState('fy');
  const [fyFilter, setFyFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('INR');

  // Tab-Specific Filter States
  const [billProfitSearch, setBillProfitSearch] = useState('');
  const [billProfitFilter, setBillProfitFilter] = useState('all'); // 'all' | 'high' | 'med' | 'low'
  const [expandedBillId, setExpandedBillId] = useState(null);

  const [itemProfitSearch, setItemProfitSearch] = useState('');
  const [itemProfitSort, setItemProfitSort] = useState('profit'); // 'profit' | 'margin' | 'qty'

  const [agingTab, setAgingTab] = useState('receivables'); // 'receivables' | 'payables'
  const [agingSearch, setAgingSearch] = useState('');

  const [stockSearch, setStockSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('all'); // 'all' | 'low' | 'out'

  const fyOptions = getFYOptions();
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  const profileCurrency = getCountryConfig(profile?.country || 'India').currency;

  const loadData = async () => {
    setLoading(true);
    try {
      const [billData, expData, purData, prodData, clData, supData, profData] = await Promise.all([
        getAllBills().catch(() => []),
        getAllExpenses().catch(() => []),
        getAllPurchases().catch(() => []),
        getAllProducts().catch(() => []),
        getAllClients().catch(() => []),
        getAllSuppliers().catch(() => []),
        getProfile().catch(() => ({})),
      ]);
      setBills(Array.isArray(billData) ? billData : []);
      setExpenses(Array.isArray(expData) ? expData : []);
      setPurchases(Array.isArray(purData) ? purData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
      setClients(Array.isArray(clData) ? clData : []);
      setSuppliers(Array.isArray(supData) ? supData : []);
      if (profData) setProfile(profData);
    } catch {
      toast('Failed to load financial records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const fy = fyOptions[0];
    if (fy) setFyFilter(fy.value);
    setYearFilter(String(now.getFullYear()));
    setMonthFilter(String(now.getMonth()));
    loadData();
  }, []);

  // Filter By Period helper
  const filterByPeriod = (date) => {
    if (!date) return false;
    if (filterMode === 'all') return true;
    if (filterMode === 'fy') {
      const fy = fyOptions.find(f => f.value === fyFilter);
      return fy ? date >= fy.from && date <= fy.to : true;
    } else {
      const d = new Date(date);
      return d.getFullYear() === parseInt(yearFilter) && d.getMonth() === parseInt(monthFilter);
    }
  };

  // Filtered dataset for active period
  const allFilteredBills = useMemo(() => {
    return bills.filter(bill => bill.type !== 'proforma' && filterByPeriod(bill.invoiceDate || bill.date));
  }, [bills, filterMode, fyFilter, yearFilter, monthFilter]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => filterByPeriod(p.date));
  }, [purchases, filterMode, fyFilter, yearFilter, monthFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => filterByPeriod(exp.date) && ((exp.currency || 'INR') === currencyFilter));
  }, [expenses, filterMode, fyFilter, yearFilter, monthFilter, currencyFilter]);

  // Product purchase price lookup map
  const productCostMap = useMemo(() => {
    const map = new Map();
    // 1. Seed from product catalog
    products.forEach(p => {
      const nameKey = (p.name || '').trim().toLowerCase();
      const cost = Number(p.purchasePrice) || Number(p.rate) || Number(p.weightedAverageCost) || 0;
      if (nameKey && cost > 0) map.set(nameKey, cost);
      if (p.id) map.set(String(p.id), cost);
    });
    // 2. Supplement from purchase bills items
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

  // All distinct currencies in filtered period
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
    return allFilteredBills.filter(b => getBillCurrency(b) === currencyFilter);
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
        // If no purchase cost found, estimate at 75% or 0
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

  // Filtered Bill-Wise Profit
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
  // 2. ITEM-WISE PROFIT & LOSS COMPUTATION
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

  // Monthly Breakdown
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

  // Receivables Aging (Unpaid Sales Invoices)
  const receivablesAging = useMemo(() => {
    return bills.filter(b => b.status !== 'paid' && b.type !== 'proforma').map(b => {
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

  // Payables Aging (Unpaid Purchase Bills)
  const payablesAging = useMemo(() => {
    return purchases.filter(p => p.paymentStatus !== 'Paid').map(p => {
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

  // WhatsApp Reminder handler
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
      const costValuation = stock * purchasePrice;
      const sellValuation = stock * sellingPrice;
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
  // PDF EXPORT FUNCTIONS
  // ============================================================
  // 1. Export P&L Statement PDF
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

      // Period
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`Period: ${filterMode === 'fy' ? (fyOptions.find(f => f.value === fyFilter)?.label || 'Current FY') : 'Custom Period'}`, marginR, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, marginR, 26, { align: 'right' });

      y += 6;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.6);
      doc.line(marginL, y, marginR, y); y += 6;

      // Executive Summary Card
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

      // Trading & P&L Statement Table
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

        if (r.big) doc.setFontSize(10);
        else doc.setFontSize(8.5);

        doc.text(r.label, marginL + 4, y);
        doc.text(r.val, marginR - 4, y, { align: 'right' });
        doc.setTextColor(0);
        y += r.big ? 8 : 6.5;
      });

      doc.save(`Profit_Loss_Statement_${filterMode}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast('Profit & Loss statement exported to PDF', 'success');
    } catch {
      toast('Failed to generate P&L PDF', 'error');
    }
  };

  // 2. Export Stock Valuation PDF
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

      // Table Header
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
        if (y > 275) {
          doc.addPage();
          y = 18;
        }

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

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
      {/* 1. TOP EXECUTIVE PERFORMANCE RIBBON (Vyapar Business Health KPI Strip) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Total Net Revenue */}
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
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Net Sales Revenue
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb', lineHeight: 1.2 }}>
              {formatCurrency(plSummary.netRevenue, currencyFilter)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Excl. GST ({plBills.length} invoices)
            </div>
          </div>
        </div>

        {/* Cost of Goods Sold (COGS) */}
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
            background: '#fff7ed',
            color: '#ea580c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ShoppingCart size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Cost of Goods (COGS)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ea580c', lineHeight: 1.2 }}>
              {formatCurrency(plSummary.totalCOGS, currencyFilter)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Cost of items billed
            </div>
          </div>
        </div>

        {/* Gross Profit & Margin */}
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
            <Percent size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Gross Profit ({plSummary.grossMarginPct.toFixed(1)}%)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
              {formatCurrency(plSummary.grossProfit, currencyFilter)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Revenue minus COGS
            </div>
          </div>
        </div>

        {/* Net Profit & Margin */}
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
            background: plSummary.netProfit >= 0 ? '#f0fdf4' : '#fff1f2',
            color: plSummary.netProfit >= 0 ? '#16a34a' : '#e11d48',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Wallet size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: plSummary.netProfit >= 0 ? '#166534' : '#9f1239', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Net {plSummary.netProfit >= 0 ? 'Profit' : 'Loss'} ({plSummary.netMarginPct.toFixed(1)}%)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: plSummary.netProfit >= 0 ? '#16a34a' : '#e11d48', lineHeight: 1.2 }}>
              {formatCurrency(Math.abs(plSummary.netProfit), currencyFilter)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              After {formatCurrency(plSummary.netOperatingExpenses, currencyFilter)} expenses
            </div>
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROLS & GLOBAL PERIOD / CURRENCY SELECTOR */}
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
            { id: 'pl', label: 'Profit & Loss Statement', icon: BarChart3 },
            { id: 'bill-profit', label: `Bill-wise Profit (${billProfitList.length})`, icon: FileText },
            { id: 'item-profit', label: `Item-wise Profit (${itemProfitList.length})`, icon: Package },
            { id: 'aging', label: `Party Aging Analysis (${receivablesAging.length + payablesAging.length})`, icon: Clock },
            { id: 'stock-valuation', label: `Stock Summary & Valuation (${products.length})`, icon: Layers },
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

        {/* Global Period & Currency Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', height: '34px', width: 'auto' }}
            value={filterMode}
            onChange={e => setFilterMode(e.target.value)}>
            <option value="fy">Fiscal Year</option>
            <option value="month">Month / Year</option>
            <option value="all">All-Time</option>
          </select>

          {filterMode === 'fy' && (
            <select
              className="form-input"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', height: '34px', width: 'auto' }}
              value={fyFilter}
              onChange={e => setFyFilter(e.target.value)}>
              {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
            </select>
          )}

          {filterMode === 'month' && (
            <>
              <select
                className="form-input"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', height: '34px', width: 'auto' }}
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}>
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                className="form-input"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', height: '34px', width: 'auto' }}
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}

          {allCurrencies.length > 1 && (
            <select
              className="form-input"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', height: '34px', width: 'auto' }}
              value={currencyFilter}
              onChange={e => setCurrencyFilter(e.target.value)}>
              {allCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <button
            onClick={loadData}
            title="Refresh Data"
            className="icon-btn"
            style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid var(--border-color, #e5e7eb)' }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: PROFIT & LOSS STATEMENT (TRADING & P&L) */}
      {/* ============================================================ */}
      {activeTab === 'pl' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) minmax(360px, 1.2fr)', gap: '1rem', flex: 1, minHeight: 0 }}>
          
          {/* Left: Trading & P&L Statement Account */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Trading & Profit & Loss Account
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Computed according to GAAP / Standard Accounting rules
                </p>
              </div>
              <button
                onClick={exportPLPdf}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem', fontWeight: 600 }}>
                <Download size={14} /> Export P&L PDF
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <tbody>
                  {/* TRADING SECTION */}
                  <tr style={{ background: 'var(--bg-secondary, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <td colSpan={2} style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#2563eb', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      I. Trading Account (Gross Profit)
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)' }}>Gross Sales Billings</td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(plSummary.totalRevenue, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)' }}>Less: GST Collected on Invoices</td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(plSummary.totalTaxCollected, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1.5px solid var(--border-color, #e5e7eb)', background: '#f8fafc' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Net Sales Revenue (Turnover)</td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(plSummary.netRevenue, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)' }}>Less: Cost of Goods Sold (COGS)</td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(plSummary.totalCOGS, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid #059669', background: '#ecfdf5' }}>
                    <td style={{ padding: '0.75rem 0.75rem', fontWeight: 800, color: '#065f46' }}>
                      GROSS PROFIT (Margin: {plSummary.grossMarginPct.toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', color: '#059669' }}>
                      {formatCurrency(plSummary.grossProfit, currencyFilter)}
                    </td>
                  </tr>

                  {/* PROFIT & LOSS SECTION */}
                  <tr style={{ background: 'var(--bg-secondary, #f9fafb)', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <td colSpan={2} style={{ padding: '0.75rem 0.75rem 0.5rem', fontWeight: 700, color: '#7c3aed', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      II. Operating & Indirect Expenses
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)' }}>Total Direct & Operating Expenses</td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(plSummary.totalExpenseAmount, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                    <td style={{ padding: '0.55rem 0.75rem', color: 'var(--text-secondary)' }}>Less: GST on Expenses (Input Tax Credit)</td>
                    <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: '#059669' }}>-{formatCurrency(plSummary.totalExpenseGST, currencyFilter)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1.5px solid var(--border-color, #e5e7eb)', background: '#f8fafc' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>Net Operating Expenses</td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(plSummary.netOperatingExpenses, currencyFilter)}</td>
                  </tr>

                  {/* FINAL NET PROFIT / LOSS */}
                  <tr style={{ background: plSummary.netProfit >= 0 ? '#f0fdf4' : '#fff1f2', borderTop: '2px solid' + (plSummary.netProfit >= 0 ? '#16a34a' : '#e11d48') }}>
                    <td style={{ padding: '0.9rem 0.75rem', fontWeight: 800, fontSize: '1.1rem', color: plSummary.netProfit >= 0 ? '#166534' : '#9f1239' }}>
                      NET {plSummary.netProfit >= 0 ? 'PROFIT' : 'LOSS'} (PAT)
                    </td>
                    <td style={{ padding: '0.9rem 0.75rem', textAlign: 'right', fontWeight: 800, fontSize: '1.3rem', color: plSummary.netProfit >= 0 ? '#16a34a' : '#e11d48' }}>
                      {formatCurrency(Math.abs(plSummary.netProfit), currencyFilter)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Monthly Performance Breakdown */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Monthly Profit & Loss Breakdown
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Monthly revenue, COGS, and net profitability trend
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {monthlyPL.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p>No transactions recorded in this period.</p>
                </div>
              ) : (
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
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(m.expenses, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: m.netProfit >= 0 ? '#059669' : '#dc2626' }}>
                          {formatCurrency(Math.abs(m.netProfit), currencyFilter)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: m.marginPct >= 15 ? 'rgba(5,150,105,0.12)' : (m.marginPct >= 0 ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.12)'),
                            color: m.marginPct >= 15 ? '#059669' : (m.marginPct >= 0 ? '#d97706' : '#dc2626')
                          }}>
                            {m.marginPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: BILL-WISE PROFIT & LOSS */}
      {/* ============================================================ */}
      {activeTab === 'bill-profit' && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '1.25rem' }}>
          
          {/* Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div className="search-box" style={{ width: '280px' }}>
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search invoice or customer..."
                  value={billProfitSearch}
                  onChange={e => setBillProfitSearch(e.target.value)}
                  className="search-input"
                />
                {billProfitSearch && (
                  <button className="icon-btn" onClick={() => setBillProfitSearch('')}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Profit Status Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid ' + (billProfitFilter === p.id ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: billProfitFilter === p.id ? '#eff6ff' : 'var(--card-bg, #ffffff)',
                      color: billProfitFilter === p.id ? '#2563eb' : 'var(--text-secondary, #4b5563)'
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Showing {filteredBillProfit.length} of {billProfitList.length} invoices
            </div>
          </div>

          {/* Bill-Wise Profit Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredBillProfit.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <FileText size={42} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>No invoices matched your filter criteria.</p>
              </div>
            ) : (
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
                      <>
                        <tr
                          key={bill.id}
                          onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                          style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-secondary, #f9fafb)' : 'transparent' }}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </td>
                          <td className="font-medium">
                            <span className="invoice-badge">{bill.invoiceNumber}</span>
                          </td>
                          <td className="text-muted">{bill.date ? new Date(bill.date).toLocaleDateString('en-IN') : '—'}</td>
                          <td className="font-medium">{bill.clientName}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(bill.revenue, currencyFilter)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(bill.netSales, currencyFilter)}</td>
                          <td style={{ textAlign: 'right', color: '#ea580c' }}>{formatCurrency(bill.cogs, currencyFilter)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isProfit ? '#059669' : '#dc2626' }}>
                            {formatCurrency(Math.abs(bill.grossProfit), currencyFilter)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              background: bill.marginPct >= 20 ? '#ecfdf5' : (bill.marginPct >= 5 ? '#fef3c7' : '#fee2e2'),
                              color: bill.marginPct >= 20 ? '#059669' : (bill.marginPct >= 5 ? '#d97706' : '#dc2626')
                            }}>
                              {bill.marginPct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>

                        {/* Expandable Line Item Margin Breakdown */}
                        {isExpanded && (
                          <tr key={`${bill.id}-expanded`} style={{ background: '#f8fafc' }}>
                            <td></td>
                            <td colSpan={8} style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
                                Item Margin Breakdown for Invoice #{bill.invoiceNumber}
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', background: '#ffffff', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                <thead>
                                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>Item Description</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Qty</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Selling Rate</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Unit Cost</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Total Revenue</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Total Cost</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Item Profit</th>
                                    <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Margin %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bill.items.map((it, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{it.name}</td>
                                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{it.qty} {it.unit}</td>
                                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{formatCurrency(it.sellRate, currencyFilter)}</td>
                                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: '#ea580c' }}>{formatCurrency(it.unitCost, currencyFilter)}</td>
                                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{formatCurrency(it.sellTotal, currencyFilter)}</td>
                                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{formatCurrency(it.totalCost, currencyFilter)}</td>
                                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, color: it.profit >= 0 ? '#059669' : '#dc2626' }}>
                                        {formatCurrency(Math.abs(it.profit), currencyFilter)}
                                      </td>
                                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 600, color: it.marginPct >= 20 ? '#059669' : (it.marginPct >= 5 ? '#d97706' : '#dc2626') }}>
                                        {it.marginPct.toFixed(1)}%
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: ITEM-WISE PROFIT & LOSS */}
      {/* ============================================================ */}
      {activeTab === 'item-profit' && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '1.25rem' }}>
          
          {/* Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div className="search-box" style={{ width: '280px' }}>
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search item name or HSN..."
                  value={itemProfitSearch}
                  onChange={e => setItemProfitSearch(e.target.value)}
                  className="search-input"
                />
                {itemProfitSearch && (
                  <button className="icon-btn" onClick={() => setItemProfitSearch('')}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sort by:</span>
                {[
                  { id: 'profit', label: 'Highest Profit' },
                  { id: 'margin', label: 'Highest Margin %' },
                  { id: 'qty', label: 'Units Sold' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setItemProfitSort(s.id)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid ' + (itemProfitSort === s.id ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: itemProfitSort === s.id ? '#eff6ff' : 'var(--card-bg, #ffffff)',
                      color: itemProfitSort === s.id ? '#2563eb' : 'var(--text-secondary, #4b5563)'
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {filteredItemProfit.length} unique items sold in period
            </div>
          </div>

          {/* Item Profit Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredItemProfit.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <Package size={42} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>No product sales recorded in this period.</p>
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>HSN</th>
                    <th style={{ textAlign: 'right' }}>Units Sold</th>
                    <th style={{ textAlign: 'right' }}>Avg Selling Price</th>
                    <th style={{ textAlign: 'right' }}>Avg Purchase Cost</th>
                    <th style={{ textAlign: 'right' }}>Total Revenue</th>
                    <th style={{ textAlign: 'right' }}>Total Cost</th>
                    <th style={{ textAlign: 'right' }}>Gross Profit</th>
                    <th style={{ textAlign: 'right' }}>Margin %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItemProfit.map((it, idx) => {
                    const isTopContributor = idx < 3 && it.grossProfit > 0;
                    const isLowMargin = it.marginPct < 10;
                    return (
                      <tr key={it.name}>
                        <td className="font-medium">{it.name}</td>
                        <td className="text-muted" style={{ fontSize: '0.78rem' }}>{it.hsn || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.qty} {it.unit}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(it.avgSellRate, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', color: '#ea580c' }}>{formatCurrency(it.avgCostRate, currencyFilter)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(it.revenue, currencyFilter)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(it.cost, currencyFilter)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: it.grossProfit >= 0 ? '#059669' : '#dc2626' }}>
                          {formatCurrency(Math.abs(it.grossProfit), currencyFilter)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: it.marginPct >= 20 ? '#ecfdf5' : (it.marginPct >= 10 ? '#fef3c7' : '#fee2e2'),
                            color: it.marginPct >= 20 ? '#059669' : (it.marginPct >= 10 ? '#d97706' : '#dc2626')
                          }}>
                            {it.marginPct.toFixed(1)}%
                          </span>
                        </td>
                        <td>
                          {isTopContributor && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: '#eff6ff', color: '#2563eb' }}>
                              ⭐ Top Star
                            </span>
                          )}
                          {isLowMargin && !isTopContributor && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: '#fff1f2', color: '#e11d48' }}>
                              ⚠️ Low Margin
                            </span>
                          )}
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

      {/* ============================================================ */}
      {/* TAB 4: PARTY AGING ANALYSIS (RECEIVABLES & PAYABLES) */}
      {/* ============================================================ */}
      {activeTab === 'aging' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: 0 }}>
          
          {/* Sub-Switch: Receivables vs. Payables */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => setAgingTab('receivables')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid ' + (agingTab === 'receivables' ? '#059669' : 'var(--border-color, #e5e7eb)'),
                  background: agingTab === 'receivables' ? '#ecfdf5' : 'var(--card-bg, #ffffff)',
                  color: agingTab === 'receivables' ? '#065f46' : 'var(--text-secondary, #4b5563)'
                }}>
                <ArrowDownLeft size={16} /> Receivables Aging (You'll Receive: {formatCurrency(receivablesAging.reduce((s, r) => s + r.outstanding, 0), currencyFilter)})
              </button>

              <button
                onClick={() => setAgingTab('payables')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid ' + (agingTab === 'payables' ? '#e11d48' : 'var(--border-color, #e5e7eb)'),
                  background: agingTab === 'payables' ? '#fff1f2' : 'var(--card-bg, #ffffff)',
                  color: agingTab === 'payables' ? '#9f1239' : 'var(--text-secondary, #4b5563)'
                }}>
                <ArrowUpRight size={16} /> Payables Aging (You'll Pay: {formatCurrency(payablesAging.reduce((s, r) => s + r.outstanding, 0), currencyFilter)})
              </button>
            </div>

            <div className="search-box" style={{ width: '280px' }}>
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder={`Search ${agingTab === 'receivables' ? 'customer' : 'supplier'} or document...`}
                value={agingSearch}
                onChange={e => setAgingSearch(e.target.value)}
                className="search-input"
              />
              {agingSearch && (
                <button className="icon-btn" onClick={() => setAgingSearch('')}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Aging 4-Bucket Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
            <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
              <p className="stat-label">Total Outstanding</p>
              <h3 className="stat-value" style={{ fontSize: '1.25rem' }}>{formatCurrency(agingBuckets.total, currencyFilter)}</h3>
            </div>
            <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
              <p className="stat-label">Current (0–30 Days)</p>
              <h3 className="stat-value stat-value-green" style={{ fontSize: '1.25rem' }}>{formatCurrency(agingBuckets.current, currencyFilter)}</h3>
            </div>
            <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
              <p className="stat-label">31–60 Days</p>
              <h3 className="stat-value stat-value-amber" style={{ fontSize: '1.25rem' }}>{formatCurrency(agingBuckets['31to60'], currencyFilter)}</h3>
            </div>
            <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
              <p className="stat-label">61–90 Days</p>
              <h3 className="stat-value stat-value-purple" style={{ fontSize: '1.25rem' }}>{formatCurrency(agingBuckets['61to90'], currencyFilter)}</h3>
            </div>
            <div className="stat-card" style={{ padding: '0.8rem 1rem' }}>
              <p className="stat-label">90+ Days (Critical)</p>
              <h3 className="stat-value" style={{ fontSize: '1.25rem', color: '#dc2626' }}>{formatCurrency(agingBuckets['90plus'], currencyFilter)}</h3>
            </div>
          </div>

          {/* Aging Party Breakdown Table */}
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredAging.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={42} style={{ color: '#059669', opacity: 0.6, marginBottom: '0.5rem' }} />
                  <p>All accounts are settled and up to date! 🎉</p>
                </div>
              ) : (
                <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>{agingTab === 'receivables' ? 'Customer Name' : 'Supplier Name'}</th>
                      <th>Ref Number</th>
                      <th>Date</th>
                      <th>Due Date</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                      <th style={{ textAlign: 'right' }}>Paid Amount</th>
                      <th style={{ textAlign: 'right' }}>Outstanding</th>
                      <th style={{ textAlign: 'right' }}>Days Overdue</th>
                      {agingTab === 'receivables' && <th style={{ textAlign: 'center' }}>WhatsApp Reminder</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAging.map((r, i) => (
                      <tr key={i} className={r.daysOverdue > 90 ? 'row-overdue' : r.daysOverdue > 30 ? 'row-warning' : ''}>
                        <td className="font-medium">{r.partyName}</td>
                        <td><span className="invoice-badge">{r.docNumber}</span></td>
                        <td className="text-muted">{r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="text-muted">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(r.totalAmount, r.currency)}</td>
                        <td style={{ textAlign: 'right' }} className="text-muted">{r.paidAmount > 0 ? formatCurrency(r.paidAmount, r.currency) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(r.outstanding, r.currency)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: r.daysOverdue > 90 ? '#fee2e2' : (r.daysOverdue > 60 ? '#ede9fe' : (r.daysOverdue > 30 ? '#fef3c7' : '#ecfdf5')),
                            color: r.daysOverdue > 90 ? '#dc2626' : (r.daysOverdue > 60 ? '#7c3aed' : (r.daysOverdue > 30 ? '#d97706' : '#059669'))
                          }}>
                            {r.daysOverdue === 0 ? 'Current' : `${r.daysOverdue} days`}
                          </span>
                        </td>
                        {agingTab === 'receivables' && (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleWhatsAppReminder(r)}
                              className="btn btn-secondary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>
                              <MessageCircle size={14} /> Send Reminder
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: STOCK SUMMARY & VALUATION AUDIT */}
      {/* ============================================================ */}
      {activeTab === 'stock-valuation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: 0 }}>
          
          {/* Top Stock Valuation KPI Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
            <div className="stat-card" style={{ padding: '0.9rem 1.1rem' }}>
              <p className="stat-label">Total Catalog SKUs</p>
              <h3 className="stat-value" style={{ fontSize: '1.35rem' }}>{stockValuation.totalItems} Items</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{stockValuation.totalStockUnits.toLocaleString('en-IN')} units in stock</p>
            </div>

            <div className="stat-card" style={{ padding: '0.9rem 1.1rem' }}>
              <p className="stat-label">Inventory Asset Value (Cost)</p>
              <h3 className="stat-value" style={{ fontSize: '1.35rem', color: '#2563eb' }}>{formatCurrency(stockValuation.totalCostValuation, profileCurrency)}</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Valued at Purchase Price</p>
            </div>

            <div className="stat-card" style={{ padding: '0.9rem 1.1rem' }}>
              <p className="stat-label">Retail Market Value (Sales)</p>
              <h3 className="stat-value" style={{ fontSize: '1.35rem', color: '#059669' }}>{formatCurrency(stockValuation.totalSellingValuation, profileCurrency)}</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Valued at Selling Price</p>
            </div>

            <div className="stat-card" style={{ padding: '0.9rem 1.1rem' }}>
              <p className="stat-label">Potential Gross Profit</p>
              <h3 className="stat-value" style={{ fontSize: '1.35rem', color: '#16a34a' }}>{formatCurrency(stockValuation.potentialProfit, profileCurrency)}</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inventory margin potential</p>
            </div>
          </div>

          {/* Table Container */}
          <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
            
            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div className="search-box" style={{ width: '280px' }}>
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search product name or SKU..."
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    className="search-input"
                  />
                  {stockSearch && (
                    <button className="icon-btn" onClick={() => setStockSearch('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {[
                    { id: 'all', label: `All Items (${products.length})` },
                    { id: 'low', label: `Low Stock (${stockValuation.lowStockCount})` },
                    { id: 'out', label: `Out of Stock (${stockValuation.outOfStockCount})` },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStockStatusFilter(s.id)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: '1px solid ' + (stockStatusFilter === s.id ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                        background: stockStatusFilter === s.id ? '#eff6ff' : 'var(--card-bg, #ffffff)',
                        color: stockStatusFilter === s.id ? '#2563eb' : 'var(--text-secondary, #4b5563)'
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={exportStockValuationPdf}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.82rem', fontWeight: 600 }}>
                <Download size={14} /> Export Stock Valuation PDF
              </button>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredStock.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <Package size={42} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p>No products found matching your filter criteria.</p>
                </div>
              ) : (
                <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Product Description</th>
                      <th>HSN</th>
                      <th style={{ textAlign: 'right' }}>Stock On Hand</th>
                      <th style={{ textAlign: 'right' }}>Purchase Price</th>
                      <th style={{ textAlign: 'right' }}>Selling Price</th>
                      <th style={{ textAlign: 'right' }}>Asset Value (At Cost)</th>
                      <th style={{ textAlign: 'right' }}>Retail Value (At Sales)</th>
                      <th style={{ textAlign: 'right' }}>Potential Profit</th>
                      <th style={{ textAlign: 'center' }}>Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map(p => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-muted" style={{ fontSize: '0.78rem' }}>{p.hsn || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.stock} {p.unit}</td>
                        <td style={{ textAlign: 'right', color: '#ea580c' }}>{formatCurrency(p.purchasePrice, profileCurrency)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.sellingPrice, profileCurrency)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.costValuation, profileCurrency)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.sellValuation, profileCurrency)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{formatCurrency(p.potentialProfit, profileCurrency)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: p.status === 'ok' ? '#ecfdf5' : (p.status === 'low' ? '#fef3c7' : '#fee2e2'),
                            color: p.status === 'ok' ? '#059669' : (p.status === 'low' ? '#d97706' : '#dc2626')
                          }}>
                            {p.status === 'ok' ? 'In Stock' : (p.status === 'low' ? 'Low Stock' : 'Out of Stock')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
