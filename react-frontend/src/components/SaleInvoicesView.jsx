import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Download, Printer, Settings, Filter, X, ChevronDown, AlertTriangle, Eye, Pencil, Copy, Trash2, CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';
import { getAllBills, saveBill, deleteBill, getProfile, getAllProfiles } from '../store';
import { formatCurrency, INVOICE_TYPES } from '../utils';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

export default function SaleInvoicesView({ docType = 'tax-invoice', onNew, onEdit, onDuplicate, onConvert }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSearchBox, setShowSearchBox] = useState(false);
  
  // Date Quick Filter presets: 'this_month', 'today', 'this_week', 'this_quarter', 'this_financial_year', 'custom', 'all'
  const [periodFilter, setPeriodFilter] = useState('this_month');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Calculate initial date range for 'this_month'
  const getInitialDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { from: firstDay, to: lastDay };
  };

  const [dateFrom, setDateFrom] = useState(() => getInitialDates().from);
  const [dateTo, setDateTo] = useState(() => getInitialDates().to);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [firms, setFirms] = useState([]);
  
  // Column filter states
  const [colFilters, setColFilters] = useState({
    date: '',
    invoiceNo: '',
    partyName: '',
    transaction: '',
    paymentType: '',
    status: '',
  });

  const [activeColFilter, setActiveColFilter] = useState(null);

  // Load Bills and Profiles
  const loadData = async () => {
    setLoading(true);
    try {
      const [allBillsData, currentProfile, allProfilesData] = await Promise.all([
        getAllBills(),
        getProfile(),
        getAllProfiles(),
      ]);
      setBills(allBillsData);
      const profileList = allProfilesData.length > 0 ? allProfilesData : (currentProfile ? [currentProfile] : []);
      setFirms(profileList);
    } catch (err) {
      console.error(err);
      toast('Failed to load sales data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [docType]);

  // Update date range when periodFilter changes
  useEffect(() => {
    const now = new Date();
    if (periodFilter === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (periodFilter === 'this_week') {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday)).toISOString().split('T')[0];
      const sunday = new Date(now.setDate(diffToMonday + 6)).toISOString().split('T')[0];
      setDateFrom(monday);
      setDateTo(sunday);
    } else if (periodFilter === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setDateFrom(firstDay);
      setDateTo(lastDay);
    } else if (periodFilter === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0).toISOString().split('T')[0];
      setDateFrom(firstDay);
      setDateTo(lastDay);
    } else if (periodFilter === 'this_financial_year') {
      const currentYear = now.getFullYear();
      const isAfterApril = now.getMonth() >= 3;
      const startYear = isAfterApril ? currentYear : currentYear - 1;
      setDateFrom(`${startYear}-04-01`);
      setDateTo(`${startYear + 1}-03-31`);
    } else if (periodFilter === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  }, [periodFilter]);

  // Current document type configuration
  const currentTypeConfig = INVOICE_TYPES[docType] || {
    label: 'Sale Invoices',
    prefix: 'INV',
    title: 'SALE INVOICES',
  };

  // Filter bills by docType, date range, search query, firm, and column filters
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      // 1. Doc Type filter
      const bType = bill.invoiceType || 'tax-invoice';
      if (docType === 'tax-invoice') {
        // 'tax-invoice' view shows tax invoices & standard sales
        if (bType !== 'tax-invoice' && bType !== 'bill-of-supply' && bType !== 'composition') return false;
      } else if (bType !== docType) {
        return false;
      }

      // 2. Date Range filter
      const bDate = bill.data?.details?.invoiceDate || bill.createdAt?.split('T')[0] || '';
      if (dateFrom && bDate < dateFrom) return false;
      if (dateTo && bDate > dateTo) return false;

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const party = (bill.data?.client?.name || '').toLowerCase();
        const invNo = (bill.invoiceNumber || '').toLowerCase();
        const total = String(bill.data?.totals?.total || bill.amount || '');
        if (!party.includes(q) && !invNo.includes(q) && !total.includes(q)) {
          return false;
        }
      }

      // 4. Firm filter
      if (selectedFirm !== 'all' && bill.profileId && String(bill.profileId) !== String(selectedFirm)) {
        return false;
      }

      // 5. Column filters
      if (colFilters.date && !bDate.includes(colFilters.date)) return false;
      if (colFilters.invoiceNo && !(bill.invoiceNumber || '').toLowerCase().includes(colFilters.invoiceNo.toLowerCase())) return false;
      if (colFilters.partyName && !(bill.data?.client?.name || '').toLowerCase().includes(colFilters.partyName.toLowerCase())) return false;
      if (colFilters.status && bill.status !== colFilters.status) return false;

      return true;
    });
  }, [bills, docType, dateFrom, dateTo, search, selectedFirm, colFilters]);

  // Calculate Totals for top card
  const stats = useMemo(() => {
    let totalSales = 0;
    let received = 0;
    let balance = 0;

    for (const b of filteredBills) {
      const tot = Number(b.data?.totals?.total || b.amount || 0);
      const p = Number(b.paidAmount || (b.status === 'paid' ? tot : 0));
      const bal = Number(b.balanceAmount !== undefined ? b.balanceAmount : (tot - p));

      totalSales += tot;
      received += p;
      balance += Math.max(0, bal);
    }

    return { totalSales, received, balance, count: filteredBills.length };
  }, [filteredBills]);

  // Format date helper (e.g. 01/10/2025)
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Delete invoice
  const handleDelete = async (bill) => {
    const ok = await confirmAction({
      title: 'Delete Invoice?',
      message: `Are you sure you want to delete invoice ${bill.invoiceNumber}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });

    if (!ok) return;

    try {
      await deleteBill(bill.id);
      toast('Invoice deleted successfully', 'success');
      loadData();
    } catch {
      toast('Failed to delete invoice', 'error');
    }
  };

  // Export to CSV / Excel
  const handleExportCSV = () => {
    if (filteredBills.length === 0) {
      toast('No data to export', 'error');
      return;
    }

    const headers = ['Date', 'Invoice No', 'Party Name', 'Transaction Type', 'Payment Type', 'Amount (INR)', 'Balance (INR)', 'Due Date', 'Status'];
    const rows = filteredBills.map(b => [
      b.data?.details?.invoiceDate || '',
      b.invoiceNumber || '',
      `"${(b.data?.client?.name || '').replace(/"/g, '""')}"`,
      INVOICE_TYPES[b.invoiceType || 'tax-invoice']?.label || 'Sale',
      b.data?.invoiceOptions?.paymentMode || 'Cash/Bank',
      (b.data?.totals?.total || b.amount || 0).toFixed(2),
      (b.balanceAmount !== undefined ? b.balanceAmount : 0).toFixed(2),
      b.data?.details?.dueDate || '',
      b.status || 'unpaid',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${docType}_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Exported sales data to CSV', 'success');
  };

  // Print list
  const handlePrintList = () => {
    window.print();
  };

  return (
    <div style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-main, #f8fafc)', minHeight: '100vh', color: 'var(--text-main, #0f172a)' }}>
      {/* 1. TOP HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {currentTypeConfig.label === 'Tax Invoice' ? 'Sale Invoices' : currentTypeConfig.label}
            <ChevronDown size={18} style={{ opacity: 0.6, cursor: 'pointer' }} />
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn"
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              padding: '0.55rem 1.4rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
              cursor: 'pointer',
              transition: 'transform 0.15s, background 0.15s',
            }}
            onClick={() => onNew && onNew(docType)}
          >
            <Plus size={18} /> Add Sale
          </button>
          <button
            type="button"
            className="icon-btn"
            style={{ border: '1px solid var(--border, #e2e8f0)', padding: '0.55rem', borderRadius: '50%', background: '#ffffff' }}
            title="Invoice Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* 2. FILTER BAR */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>Filter by :</span>

        {/* Period Filter Dropdown */}
        <select
          value={periodFilter}
          onChange={e => setPeriodFilter(e.target.value)}
          style={{
            width: 'auto',
            padding: '0.45rem 2rem 0.45rem 0.85rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: '20px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="this_month" style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>This Month</option>
          <option value="today" style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>Today</option>
          <option value="this_week" style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>This Week</option>
          <option value="this_quarter" style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>This Quarter</option>
          <option value="this_financial_year" style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>This Financial Year</option>
          <option value="all" style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>All Time</option>
          {periodFilter === 'custom' && <option value="custom" style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>Custom Range</option>}
        </select>

        {/* Date Range Display Box with Popover */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '0.45rem 0.85rem',
              borderRadius: '20px',
              fontSize: '0.83rem',
              fontWeight: 700,
              color: '#0f172a',
              cursor: 'pointer',
            }}
            onClick={() => setShowDatePicker(v => !v)}
          >
            <span>📅 {formatDateDisplay(dateFrom) || 'Start'}</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}>To</span>
            <span>{formatDateDisplay(dateTo) || 'End'}</span>
            <ChevronDown size={14} style={{ color: '#64748b' }} />
          </button>

          {showDatePicker && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 100,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              minWidth: '280px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>Select Custom Dates</span>
                <X size={15} style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => setShowDatePicker(false)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>From Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateFrom}
                    onChange={e => {
                      setDateFrom(e.target.value);
                      setPeriodFilter('custom');
                    }}
                    style={{ width: '100%', fontSize: '0.83rem', color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>To Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateTo}
                    onChange={e => {
                      setDateTo(e.target.value);
                      setPeriodFilter('custom');
                    }}
                    style={{ width: '100%', fontSize: '0.83rem', color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, background: '#2563eb' }}
                    onClick={() => setShowDatePicker(false)}
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Firm Filter Dropdown */}
        <select
          value={selectedFirm}
          onChange={e => setSelectedFirm(e.target.value)}
          style={{
            width: 'auto',
            padding: '0.45rem 2rem 0.45rem 0.85rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            borderRadius: '20px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="all" style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>All Firms</option>
          {firms.map((f, i) => (
            <option key={f.id || i} value={f.id} style={{ color: '#0f172a', background: '#ffffff', fontWeight: 600 }}>{f.businessName || `Firm ${i + 1}`}</option>
          ))}
        </select>
      </div>

      {/* 3. TOTAL SALES KPI CARD CONTAINER */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        maxWidth: '380px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Total Sales Amount</span>
          <span style={{
            background: '#f1f5f9',
            color: '#475569',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}>
            0% ↗ vs last month
          </span>
        </div>

        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem' }}>
          {formatCurrency(stats.totalSales, 'INR')}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border, #f1f5f9)',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}>
          <div>
            <span style={{ color: 'var(--text-muted, #64748b)' }}>Received: </span>
            <span style={{ color: '#059669', fontWeight: 700 }}>{formatCurrency(stats.received, 'INR')}</span>
          </div>
          <div style={{ height: '14px', width: '1px', background: '#cbd5e1' }} />
          <div>
            <span style={{ color: 'var(--text-muted, #64748b)' }}>Balance: </span>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>{formatCurrency(stats.balance, 'INR')}</span>
          </div>
        </div>
      </div>

      {/* 4. TRANSACTIONS SECTION */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      }}>
        {/* Section Header Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Transactions</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Search Input Toggle */}
            {showSearchBox ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search invoice or party..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: '2rem', paddingRight: '2rem', height: '34px', fontSize: '0.83rem', width: '220px' }}
                  autoFocus
                />
                <X size={14} style={{ position: 'absolute', right: '10px', cursor: 'pointer', color: '#94a3b8' }} onClick={() => { setSearch(''); setShowSearchBox(false); }} />
              </div>
            ) : (
              <button type="button" className="icon-btn" title="Search Transactions" onClick={() => setShowSearchBox(true)}>
                <Search size={18} />
              </button>
            )}

            {/* Excel Export Button */}
            <button
              type="button"
              className="btn"
              style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onClick={handleExportCSV}
              title="Export to Excel / CSV"
            >
              <Download size={15} /> XLS
            </button>

            {/* Print Button */}
            <button
              type="button"
              className="icon-btn"
              title="Print Transactions List"
              onClick={handlePrintList}
            >
              <Printer size={18} />
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        {filteredBills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted, #64748b)' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <AlertTriangle size={28} />
            </div>
            <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>No Transaction Found</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>We could not find any transactions for the selected filters.</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Date <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Invoice no <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Party Name <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Transaction <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Payment Type <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                      Amount <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem' }}>
                      Balance <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Due date <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      Status <Filter size={13} style={{ opacity: 0.5, cursor: 'pointer' }} />
                    </div>
                  </th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => {
                  const total = Number(bill.data?.totals?.total || bill.amount || 0);
                  const paid = Number(bill.paidAmount || (bill.status === 'paid' ? total : 0));
                  const balance = Number(bill.balanceAmount !== undefined ? bill.balanceAmount : (total - paid));
                  const status = bill.status || 'unpaid';

                  return (
                    <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                        {formatDateDisplay(bill.data?.details?.invoiceDate || bill.createdAt?.split('T')[0])}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--primary, #2563eb)' }}>
                        {bill.invoiceNumber || 'INV-0001'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        {bill.data?.client?.name || 'Walk-in Client'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                        {INVOICE_TYPES[bill.invoiceType || 'tax-invoice']?.label || 'Sale Invoice'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {bill.data?.invoiceOptions?.paymentMode || 'Cash / Online'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(total, bill.currency || 'INR')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: balance > 0 ? '#dc2626' : '#059669' }}>
                        {formatCurrency(Math.max(0, balance), bill.currency || 'INR')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {formatDateDisplay(bill.data?.details?.dueDate) || '-'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: status === 'paid' ? '#dcfce7' : status === 'overdue' ? '#fee2e2' : '#fef3c7',
                          color: status === 'paid' ? '#166534' : status === 'overdue' ? '#991b1b' : '#92400e',
                        }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit Invoice"
                            onClick={() => onEdit && onEdit(bill)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Duplicate"
                            onClick={() => onDuplicate && onDuplicate(bill)}
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn text-danger"
                            title="Delete"
                            onClick={() => handleDelete(bill)}
                          >
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
    </div>
  );
}
