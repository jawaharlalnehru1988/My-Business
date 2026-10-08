import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Download, Printer, Settings, Filter, X,
  ChevronDown, AlertTriangle, Eye, Pencil, Copy, Trash2,
  CheckCircle, Clock, AlertCircle, FileText, Zap, MessageCircle,
  Truck, ArrowRight, ArrowUpRight, CheckCircle2, RefreshCw,
  ShoppingCart, Send, Calendar, Check, Ban
} from 'lucide-react';
import { getAllBills, saveBill, deleteBill, getProfile, getAllProfiles } from '../store';
import { formatCurrency, INVOICE_TYPES, getCountryConfig } from '../utils';
import { openWhatsAppShare } from '../utils/share';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

// Extended definitions and lifecycle statuses for each commercial document type
const EXTENDED_DOC_CONFIGS = {
  'estimate': {
    id: 'estimate',
    label: 'Estimates / Quotations',
    prefix: 'EST',
    title: 'ESTIMATE / QUOTATION',
    singular: 'Quotation',
    verb: 'Quotation',
    icon: FileText,
    accent: '#2563eb',
    statusOptions: [
      { id: 'open', label: 'Open / Pending', color: '#2563eb', bg: '#eff6ff' },
      { id: 'accepted', label: 'Accepted', color: '#059669', bg: '#ecfdf5' },
      { id: 'converted', label: 'Converted to Sale', color: '#16a34a', bg: '#f0fdf4' },
      { id: 'rejected', label: 'Declined', color: '#dc2626', bg: '#fee2e2' },
      { id: 'expired', label: 'Expired', color: '#6b7280', bg: '#f3f4f6' },
    ]
  },
  'sale-order': {
    id: 'sale-order',
    label: 'Sale Orders',
    prefix: 'SO',
    title: 'SALE ORDER',
    singular: 'Sale Order',
    verb: 'Sale Order',
    icon: ShoppingCart,
    accent: '#ea580c',
    statusOptions: [
      { id: 'open', label: 'Active Order', color: '#ea580c', bg: '#fff7ed' },
      { id: 'in_progress', label: 'Packing / In-Progress', color: '#d97706', bg: '#fef3c7' },
      { id: 'delivered', label: 'Dispatched / Delivered', color: '#0284c7', bg: '#f0f9ff' },
      { id: 'completed', label: 'Fulfilled & Invoiced', color: '#16a34a', bg: '#f0fdf4' },
      { id: 'cancelled', label: 'Cancelled', color: '#dc2626', bg: '#fee2e2' },
    ]
  },
  'delivery-challan': {
    id: 'delivery-challan',
    label: 'Delivery Challans',
    prefix: 'DC',
    title: 'DELIVERY CHALLAN',
    singular: 'Delivery Challan',
    verb: 'Challan',
    icon: Truck,
    accent: '#0284c7',
    statusOptions: [
      { id: 'open', label: 'Dispatched', color: '#0284c7', bg: '#f0f9ff' },
      { id: 'in_transit', label: 'In-Transit', color: '#7c3aed', bg: '#f5f3ff' },
      { id: 'delivered', label: 'Delivered to Party', color: '#059669', bg: '#ecfdf5' },
      { id: 'invoiced', label: 'Converted to Invoice', color: '#16a34a', bg: '#f0fdf4' },
      { id: 'returned', label: 'Goods Returned', color: '#dc2626', bg: '#fee2e2' },
    ]
  },
  'proforma': {
    id: 'proforma',
    label: 'Proforma Invoices',
    prefix: 'PI',
    title: 'PROFORMA INVOICE',
    singular: 'Proforma Invoice',
    verb: 'Proforma',
    icon: FileText,
    accent: '#7c3aed',
    statusOptions: [
      { id: 'open', label: 'Pending Payment', color: '#7c3aed', bg: '#f5f3ff' },
      { id: 'converted', label: 'Converted to Tax Invoice', color: '#16a34a', bg: '#f0fdf4' },
      { id: 'cancelled', label: 'Cancelled', color: '#dc2626', bg: '#fee2e2' },
    ]
  },
  'tax-invoice': {
    id: 'tax-invoice',
    label: 'Sale Invoices',
    prefix: 'INV',
    title: 'TAX INVOICE',
    singular: 'Tax Invoice',
    verb: 'Sale Invoice',
    icon: FileText,
    accent: '#059669',
    statusOptions: [
      { id: 'paid', label: 'Paid', color: '#166534', bg: '#dcfce7' },
      { id: 'partial', label: 'Partially Paid', color: '#92400e', bg: '#fef3c7' },
      { id: 'unpaid', label: 'Unpaid', color: '#991b1b', bg: '#fee2e2' },
      { id: 'overdue', label: 'Overdue', color: '#dc2626', bg: '#fee2e2' },
    ]
  }
};

export default function SaleInvoicesView({ docType = 'tax-invoice', onNew, onEdit, onDuplicate, onConvert }) {
  // Current Active Document Tab
  const [currentTab, setCurrentTab] = useState(docType || 'tax-invoice');

  const [bills, setBills] = useState([]);
  const [profile, setProfile] = useState({});
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | specific status

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

  // Preview Modal State
  const [previewBill, setPreviewBill] = useState(null);

  // Sync internal tab if incoming docType prop changes
  useEffect(() => {
    if (docType && EXTENDED_DOC_CONFIGS[docType]) {
      setCurrentTab(docType);
    }
  }, [docType]);

  // Load Bills and Business Profiles
  const loadData = async () => {
    setLoading(true);
    try {
      const [allBillsData, currentProfile, allProfilesData] = await Promise.all([
        getAllBills().catch(() => []),
        getProfile().catch(() => ({})),
        getAllProfiles().catch(() => []),
      ]);
      setBills(Array.isArray(allBillsData) ? allBillsData : []);
      if (currentProfile) setProfile(currentProfile);
      const profileList = allProfilesData.length > 0 ? allProfilesData : (currentProfile ? [currentProfile] : []);
      setFirms(profileList);
    } catch {
      toast('Failed to load document records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentTab]);

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

  const activeConfig = EXTENDED_DOC_CONFIGS[currentTab] || EXTENDED_DOC_CONFIGS['tax-invoice'];
  const profileCurrency = getCountryConfig(profile?.country || 'India').currency;

  // Filter bills by active document type, date range, search query, firm, and status
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      // 1. Doc Type filter
      const bType = bill.invoiceType || bill.data?.invoiceType || (bill.type === 'proforma' ? 'proforma' : 'tax-invoice');
      if (currentTab === 'tax-invoice') {
        if (bType !== 'tax-invoice' && bType !== 'bill-of-supply' && bType !== 'composition') return false;
      } else if (bType !== currentTab) {
        return false;
      }

      // 2. Date Range filter
      const bDate = bill.invoiceDate || bill.data?.details?.invoiceDate || bill.createdAt?.split('T')[0] || '';
      if (dateFrom && bDate < dateFrom) return false;
      if (dateTo && bDate > dateTo) return false;

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const party = (bill.clientName || bill.data?.client?.name || '').toLowerCase();
        const invNo = (bill.invoiceNumber || '').toLowerCase();
        const total = String(bill.totalAmount || bill.data?.totals?.total || bill.amount || '');
        const items = (bill.data?.items || bill.items || []).map(it => (it.name || '').toLowerCase()).join(' ');
        if (!party.includes(q) && !invNo.includes(q) && !total.includes(q) && !items.includes(q)) {
          return false;
        }
      }

      // 4. Firm filter
      if (selectedFirm !== 'all' && bill.profileId && String(bill.profileId) !== String(selectedFirm)) {
        return false;
      }

      // 5. Status filter
      if (statusFilter !== 'all') {
        const bStatus = bill.status || (bill.paidAmount >= bill.totalAmount ? 'paid' : 'open');
        if (bStatus !== statusFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.invoiceDate || a.data?.details?.invoiceDate || a.createdAt || '';
      const dateB = b.invoiceDate || b.data?.details?.invoiceDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [bills, currentTab, dateFrom, dateTo, search, selectedFirm, statusFilter]);

  // Dynamic KPI Stats calculated specifically for the active document type
  const kpiStats = useMemo(() => {
    let totalValue = 0;
    let receivedOrAdvance = 0;
    let pendingBalance = 0;
    let openCount = 0;
    let convertedCount = 0;
    let totalItemsQty = 0;

    filteredBills.forEach(b => {
      const tot = Number(b.totalAmount || b.data?.totals?.total || b.amount || 0);
      const paid = Number(b.paidAmount || (b.status === 'paid' ? tot : 0));
      const bal = Number(b.balanceAmount !== undefined ? b.balanceAmount : Math.max(0, tot - paid));
      const bStatus = (b.status || 'open').toLowerCase();

      totalValue += tot;
      receivedOrAdvance += paid;
      pendingBalance += bal;

      if (bStatus === 'open' || bStatus === 'active' || bStatus === 'in_progress' || bStatus === 'in_transit') {
        openCount += 1;
      }
      if (bStatus === 'converted' || bStatus === 'completed' || bStatus === 'invoiced') {
        convertedCount += 1;
      }

      const items = b.data?.items || b.items || [];
      items.forEach(it => {
        totalItemsQty += Number(it.quantity) || 1;
      });
    });

    const conversionRate = filteredBills.length > 0 ? (convertedCount / filteredBills.length) * 100 : 0;

    return {
      totalValue,
      receivedOrAdvance,
      pendingBalance,
      openCount,
      convertedCount,
      conversionRate,
      totalItemsQty,
      count: filteredBills.length
    };
  }, [filteredBills]);

  // Status Quick-Toggle Handler
  const handleUpdateStatus = async (bill, newStatus) => {
    try {
      const updated = { ...bill, status: newStatus };
      await saveBill(updated, { overwrite: true });
      setBills(prev => prev.map(b => b.id === bill.id ? updated : b));
      toast(`Status updated to "${newStatus.replace('_', ' ').toUpperCase()}"`, 'success');
    } catch {
      toast('Failed to update status', 'error');
    }
  };

  // 1-Click Convert to Tax Invoice
  const handleConvertClick = async (bill) => {
    if (bill.status === 'converted') {
      const reConvert = await confirmAction({
        title: 'Already Converted',
        message: `This ${activeConfig.singular} (${bill.invoiceNumber}) was already converted. Do you wish to generate another Tax Invoice from it?`,
        confirmLabel: 'Convert Again',
        tone: 'primary'
      });
      if (!reConvert) return;
    }

    // Automatically mark the current document as converted in the background
    try {
      await saveBill({ ...bill, status: 'converted' }, { overwrite: true });
      setBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'converted' } : b));
    } catch { /* proceed with conversion anyway */ }

    toast(`Converting ${activeConfig.singular} #${bill.invoiceNumber} to Tax Invoice...`, 'info');
    if (onConvert) {
      onConvert(bill);
    }
  };

  // WhatsApp Share Handler
  const handleWhatsAppShare = (bill) => {
    const partyName = bill.clientName || bill.data?.client?.name || 'Valued Customer';
    const phone = bill.data?.client?.phone || bill.clientPhone || bill.phone || '';
    const docNo = bill.invoiceNumber || 'DOC';
    const docDate = bill.invoiceDate || bill.data?.details?.invoiceDate || 'Today';
    const total = Number(bill.totalAmount || bill.data?.totals?.total || bill.amount || 0);
    const busName = profile?.businessName || localStorage.getItem('businessName') || 'My Business';

    let msg = `Dear *${partyName}*,\n\n`;

    if (currentTab === 'estimate') {
      msg += `Thank you for your interest! Here is your Quotation *#${docNo}* from *${busName}*:\n\n` +
        `Quotation Date: *${docDate}*\n` +
        `Estimated Total: *${formatCurrency(total, profileCurrency)}*\n\n` +
        `Please let us know if you approve this quotation so we can schedule delivery.\nThank you!`;
    } else if (currentTab === 'sale-order') {
      const adv = Number(bill.paidAmount || 0);
      const bal = Math.max(0, total - adv);
      msg += `Your Sale Order *#${docNo}* has been confirmed by *${busName}*!\n\n` +
        `Order Date: *${docDate}*\n` +
        `Total Order Value: *${formatCurrency(total, profileCurrency)}*\n` +
        `Advance Received: *${formatCurrency(adv, profileCurrency)}*\n` +
        `Balance Due: *${formatCurrency(bal, profileCurrency)}*\n\n` +
        `We are preparing your items for dispatch. Thank you for your business!`;
    } else if (currentTab === 'delivery-challan') {
      msg += `Your goods have been dispatched under Delivery Challan *#${docNo}* from *${busName}*.\n\n` +
        `Dispatch Date: *${docDate}*\n` +
        `Challan Total: *${formatCurrency(total, profileCurrency)}*\n\n` +
        `Please inspect the packages upon arrival and confirm receipt. Thank you!`;
    } else {
      msg += `Please find details for Tax Invoice *#${docNo}* from *${busName}*:\n\n` +
        `Invoice Date: *${docDate}*\n` +
        `Invoice Amount: *${formatCurrency(total, profileCurrency)}*\n\n` +
        `Thank you for your prompt settlement!`;
    }

    openWhatsAppShare(phone, msg);
    toast(`Opening WhatsApp share for ${partyName}`, 'info');
  };

  // Delete document
  const handleDelete = async (bill) => {
    const ok = await confirmAction({
      title: `Delete ${activeConfig.singular}?`,
      message: `Are you sure you want to delete ${activeConfig.singular} #${bill.invoiceNumber}? This action cannot be undone.`,
      confirmLabel: 'Delete Document',
      tone: 'danger',
    });

    if (!ok) return;

    try {
      await deleteBill(bill.id);
      toast(`${activeConfig.singular} deleted successfully`, 'success');
      loadData();
    } catch {
      toast('Failed to delete document', 'error');
    }
  };

  // Export to CSV / Excel
  const handleExportCSV = () => {
    if (filteredBills.length === 0) {
      toast('No records to export', 'warning');
      return;
    }

    const headers = ['Date', 'Document No', 'Party Name', 'Document Type', 'Amount (INR)', 'Balance (INR)', 'Due Date', 'Status'];
    const rows = filteredBills.map(b => [
      b.invoiceDate || b.data?.details?.invoiceDate || '',
      b.invoiceNumber || '',
      `"${(b.clientName || b.data?.client?.name || '').replace(/"/g, '""')}"`,
      activeConfig.singular,
      Number(b.totalAmount || b.data?.totals?.total || b.amount || 0).toFixed(2),
      Number(b.balanceAmount !== undefined ? b.balanceAmount : 0).toFixed(2),
      b.dueDate || b.data?.details?.dueDate || '',
      b.status || 'open',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentTab}_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast(`Exported ${filteredBills.length} records to CSV`, 'success');
  };

  // Format date helper
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="view-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      
      {/* 1. DOCUMENT TABS SWITCHER (Quotations, Sale Orders, Challans, Proforma, Invoices) */}
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
        {/* Document Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          {Object.values(EXTENDED_DOC_CONFIGS).map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setCurrentTab(tab.id);
                  setStatusFilter('all');
                }}
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
                  background: isActive ? tab.accent : 'var(--bg-secondary, #f3f4f6)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #4b5563)',
                  transition: 'all 0.15s ease'
                }}>
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Create New Document Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => onNew && onNew(currentTab)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1.1rem',
              fontWeight: 700,
              fontSize: '0.84rem',
              background: activeConfig.accent,
              borderColor: activeConfig.accent
            }}>
            <Plus size={16} /> + Create {activeConfig.singular}
          </button>
        </div>
      </div>

      {/* 2. TOP DYNAMIC KPI SUMMARY STRIP */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Total Document Value */}
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
            color: activeConfig.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total {activeConfig.singular} Value
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: activeConfig.accent, lineHeight: 1.2 }}>
              {formatCurrency(kpiStats.totalValue, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Across {kpiStats.count} {activeConfig.label.toLowerCase()}
            </div>
          </div>
        </div>

        {/* Dynamic Card 2: Open / Pending */}
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
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {currentTab === 'sale-order' ? 'Active Orders' : (currentTab === 'delivery-challan' ? 'In-Transit / Open' : 'Open / Pending')}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ea580c', lineHeight: 1.2 }}>
              {kpiStats.openCount} {activeConfig.singular}s
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              Awaiting fulfillment or approval
            </div>
          </div>
        </div>

        {/* Dynamic Card 3: Converted to Invoice / Delivered */}
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
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {currentTab === 'tax-invoice' ? 'Amount Received' : 'Converted to Tax Invoice'}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>
              {currentTab === 'tax-invoice'
                ? formatCurrency(kpiStats.receivedOrAdvance, profileCurrency)
                : `${kpiStats.convertedCount} Converted (${kpiStats.conversionRate.toFixed(0)}%)`}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              {currentTab === 'tax-invoice' ? 'Settled payments' : 'Successfully invoiced'}
            </div>
          </div>
        </div>

        {/* Dynamic Card 4: Pending Balance / Shipped Qty */}
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
            background: currentTab === 'delivery-challan' ? '#eff6ff' : '#fff1f2',
            color: currentTab === 'delivery-challan' ? '#2563eb' : '#e11d48',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {currentTab === 'delivery-challan' ? <Truck size={22} /> : <Zap size={22} />}
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: currentTab === 'delivery-challan' ? '#1e40af' : '#9f1239', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {currentTab === 'delivery-challan' ? 'Total Units Dispatched' : 'Balance Pending Settlement'}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: currentTab === 'delivery-challan' ? '#2563eb' : '#e11d48', lineHeight: 1.2 }}>
              {currentTab === 'delivery-challan'
                ? `${kpiStats.totalItemsQty.toLocaleString('en-IN')} Units`
                : formatCurrency(kpiStats.pendingBalance, profileCurrency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
              {currentTab === 'delivery-challan' ? 'Goods in movement' : 'Due from customers'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR CONTROLS: PERIOD, SEARCH, STATUS FILTER, EXPORT */}
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div className="search-box" style={{ width: '260px' }}>
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder={`Search ${activeConfig.singular.toLowerCase()} or party...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button className="icon-btn" onClick={() => setSearch('')}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Period Filter Dropdown */}
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value)}
            className="form-input"
            style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.82rem', height: '34px' }}
          >
            <option value="this_month">This Month</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_financial_year">This Financial Year</option>
            <option value="all">All Time</option>
            {periodFilter === 'custom' && <option value="custom">Custom Range</option>}
          </select>

          {/* Date Picker Button */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', fontSize: '0.82rem', height: '34px' }}
            onClick={() => setShowDatePicker(v => !v)}
          >
            <Calendar size={14} />
            <span>{formatDateDisplay(dateFrom)} – {formatDateDisplay(dateTo)}</span>
            <ChevronDown size={13} />
          </button>

          {/* Custom Date Modal / Popover */}
          {showDatePicker && (
            <div style={{
              position: 'absolute',
              top: '240px',
              left: '320px',
              zIndex: 100,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              minWidth: '260px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Select Custom Range</span>
                <X size={15} style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => setShowDatePicker(false)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>From Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPeriodFilter('custom'); }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '2px' }}>To Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPeriodFilter('custom'); }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: '0.4rem', fontSize: '0.8rem', padding: '0.35rem' }}
                  onClick={() => setShowDatePicker(false)}
                >
                  Apply Dates
                </button>
              </div>
            </div>
          )}

          {/* Status Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid ' + (statusFilter === 'all' ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                background: statusFilter === 'all' ? '#eff6ff' : 'var(--card-bg, #ffffff)',
                color: statusFilter === 'all' ? '#2563eb' : 'var(--text-secondary, #4b5563)'
              }}>
              All
            </button>
            {activeConfig.statusOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setStatusFilter(opt.id)}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid ' + (statusFilter === opt.id ? opt.color : 'var(--border-color, #e5e7eb)'),
                  background: statusFilter === opt.id ? opt.bg : 'var(--card-bg, #ffffff)',
                  color: statusFilter === opt.id ? opt.color : 'var(--text-secondary, #4b5563)'
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Tools: Export CSV, Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <Download size={14} /> Export CSV
          </button>

          <button
            onClick={loadData}
            title="Refresh List"
            className="icon-btn"
            style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid var(--border-color, #e5e7eb)' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 4. MAIN DOCUMENTS TABLE */}
      <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredBills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: activeConfig.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <FileText size={28} />
              </div>
              <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                No {activeConfig.label} Found
              </h3>
              <p style={{ margin: 0, fontSize: '0.84rem' }}>
                There are no {activeConfig.label.toLowerCase()} matching your filter criteria.
              </p>
              <button
                onClick={() => onNew && onNew(currentTab)}
                className="btn btn-primary"
                style={{ marginTop: '1rem', background: activeConfig.accent, borderColor: activeConfig.accent }}>
                <Plus size={15} /> Create First {activeConfig.singular}
              </button>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>{activeConfig.singular} No</th>
                  <th>Party Name</th>
                  <th>Items Summary</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                  <th>Valid / Delivery Date</th>
                  <th>Lifecycle Status</th>
                  <th style={{ textAlign: 'center' }}>1-Click Convert</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map(bill => {
                  const total = Number(bill.totalAmount || bill.data?.totals?.total || bill.amount || 0);
                  const paid = Number(bill.paidAmount || (bill.status === 'paid' ? total : 0));
                  const balance = Number(bill.balanceAmount !== undefined ? bill.balanceAmount : Math.max(0, total - paid));
                  const bStatus = bill.status || 'open';
                  const statusObj = activeConfig.statusOptions.find(o => o.id === bStatus) || { label: bStatus, color: '#4b5563', bg: '#f3f4f6' };
                  const isConverted = bStatus === 'converted' || bStatus === 'completed' || bStatus === 'invoiced';

                  const items = bill.data?.items || bill.items || [];
                  const itemsSummary = items.length > 0
                    ? items.map(it => `${it.name || it.description} (${it.quantity || 1})`).slice(0, 2).join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '')
                    : '—';

                  return (
                    <tr key={bill.id}>
                      <td className="text-muted">
                        {formatDateDisplay(bill.invoiceDate || bill.data?.details?.invoiceDate || bill.createdAt?.split('T')[0])}
                      </td>
                      <td className="font-medium">
                        <span className="invoice-badge" style={{ color: activeConfig.accent, borderColor: activeConfig.accent }}>
                          {bill.invoiceNumber || 'DOC-001'}
                        </span>
                      </td>
                      <td className="font-medium">
                        <div>{bill.clientName || bill.data?.client?.name || 'Walk-in Customer'}</div>
                        {(bill.data?.client?.phone || bill.clientPhone) && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            📞 {bill.data?.client?.phone || bill.clientPhone}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {itemsSummary}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(total, profileCurrency)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: balance > 0 ? '#dc2626' : '#059669' }}>
                        {formatCurrency(balance, profileCurrency)}
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {formatDateDisplay(bill.dueDate || bill.data?.details?.dueDate || bill.deliveryDate)}
                      </td>
                      <td>
                        {/* Status Dropdown Pill */}
                        <select
                          value={bStatus}
                          onChange={e => handleUpdateStatus(bill, e.target.value)}
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            border: '1px solid ' + statusObj.color,
                            background: statusObj.bg,
                            color: statusObj.color,
                            cursor: 'pointer',
                            outline: 'none'
                          }}>
                          {activeConfig.statusOptions.map(opt => (
                            <option key={opt.id} value={opt.id} style={{ background: '#ffffff', color: '#0f172a' }}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 1-Click Convert to Tax Invoice Column */}
                      <td style={{ textAlign: 'center' }}>
                        {currentTab !== 'tax-invoice' ? (
                          <button
                            onClick={() => handleConvertClick(bill)}
                            className="btn btn-secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.25rem 0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              background: isConverted ? '#f0fdf4' : '#eff6ff',
                              borderColor: isConverted ? '#86efac' : '#bfdbfe',
                              color: isConverted ? '#16a34a' : '#2563eb'
                            }}>
                            <Zap size={13} /> {isConverted ? 'Re-Convert' : 'Convert to Invoice'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Official Invoice</span>
                        )}
                      </td>

                      {/* Action Shortcuts */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* WhatsApp Share */}
                          <button
                            type="button"
                            className="icon-btn"
                            title="Share on WhatsApp"
                            onClick={() => handleWhatsAppShare(bill)}
                            style={{ color: '#059669' }}
                          >
                            <MessageCircle size={15} />
                          </button>

                          {/* Quick View / Preview */}
                          <button
                            type="button"
                            className="icon-btn"
                            title="Quick Preview"
                            onClick={() => setPreviewBill(bill)}
                          >
                            <Eye size={15} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit"
                            onClick={() => onEdit && onEdit(bill)}
                          >
                            <Pencil size={15} />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            className="icon-btn"
                            title="Duplicate"
                            onClick={() => onDuplicate && onDuplicate(bill)}
                          >
                            <Copy size={15} />
                          </button>

                          {/* Delete */}
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
          )}
        </div>
      </div>

      {/* 5. FAST VIEW / PREVIEW MODAL */}
      {previewBill && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
              background: 'var(--bg-secondary, #f8fafc)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  {activeConfig.singular} #{previewBill.invoiceNumber}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Date: {formatDateDisplay(previewBill.invoiceDate || previewBill.data?.details?.invoiceDate)}
                </span>
              </div>
              <button className="icon-btn" onClick={() => setPreviewBill(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Party Information */}
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Customer / Client Details
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, marginTop: '2px' }}>
                  {previewBill.clientName || previewBill.data?.client?.name || 'Walk-in Customer'}
                </div>
                {(previewBill.data?.client?.phone || previewBill.clientPhone) && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Phone: {previewBill.data?.client?.phone || previewBill.clientPhone}
                  </div>
                )}
                {(previewBill.data?.client?.address || previewBill.clientAddress) && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Address: {previewBill.data?.client?.address || previewBill.clientAddress}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(previewBill.data?.items || previewBill.items || []).map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 600 }}>{it.name || it.description}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{it.quantity || 1} {it.unit || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatCurrency(it.rate || it.price || 0, profileCurrency)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency((it.quantity || 1) * (it.rate || it.price || 0), profileCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div style={{ alignSelf: 'flex-end', width: '240px', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(previewBill.totalAmount || previewBill.amount || 0, profileCurrency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #cbd5e1', paddingTop: '0.35rem', fontSize: '1rem', fontWeight: 800 }}>
                  <span>Total:</span>
                  <span style={{ color: activeConfig.accent }}>{formatCurrency(previewBill.totalAmount || previewBill.amount || 0, profileCurrency)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid var(--border-color, #e5e7eb)',
              background: 'var(--bg-secondary, #f8fafc)'
            }}>
              <button
                onClick={() => handleWhatsAppShare(previewBill)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontSize: '0.82rem' }}>
                <MessageCircle size={15} /> WhatsApp
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {currentTab !== 'tax-invoice' && (
                  <button
                    onClick={() => {
                      const b = previewBill;
                      setPreviewBill(null);
                      handleConvertClick(b);
                    }}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', background: '#2563eb' }}>
                    <Zap size={14} /> Convert to Invoice
                  </button>
                )}
                <button
                  onClick={() => setPreviewBill(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
