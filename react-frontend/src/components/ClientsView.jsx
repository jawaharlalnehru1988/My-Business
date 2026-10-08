import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users, Search, FileText, ChevronDown, ChevronUp, Trash2, X, MessageCircle, Mail, Plus,
  Edit3, Copy, Upload, Download, ArrowRight, IndianRupee, Phone, MapPin, Receipt, Check,
  AlertCircle, Clock
} from 'lucide-react';
import HelpButton from './HelpButton';
import {
  getAllClients, getAllBills, deleteClient, saveClient, deleteBill, saveBill,
  getProfile, getAllReceipts, saveReceipt, getNextInvoiceNumber
} from '../store';
import { formatCurrency, INVOICE_TYPES } from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { openWhatsAppShare } from '../utils/share';
import { confirmAction } from './ConfirmModal';
import { toast } from './Toast';
import ClientModal from './ClientModal';

// Shared helper to resolve the user's accent color as an RGB tuple for jsPDF
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

const STATUS_COLORS = {
  unpaid: { label: 'Unpaid', color: '#f59e0b', bg: '#fffbeb' },
  partial: { label: 'Partial', color: '#8b5cf6', bg: '#f5f3ff' },
  paid: { label: 'Paid', color: '#059669', bg: '#ecfdf5' },
  overdue: { label: 'Overdue', color: '#dc2626', bg: '#fef2f2' },
};

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

export default function ClientsView({ onEdit, onDuplicate, onNew }) {
  const [clients, setClients] = useState([]);
  const [bills, setBills] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [profile, setProfile] = useState({});
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'receivable' | 'payable' | 'zero'
  const [selectedPartyName, setSelectedPartyName] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [modalClient, setModalClient] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [profileCountry, setProfileCountry] = useState('');

  // Payment-In Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    partyName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
    referenceNo: '',
    linkedInvoice: '__fifo__',
    notes: '',
  });

  const loadData = async () => {
    try {
      const [c, b, r, p] = await Promise.all([
        getAllClients(),
        getAllBills(),
        getAllReceipts().catch(() => []),
        getProfile().catch(() => ({}))
      ]);
      setClients(c || []);
      setBills(b || []);
      setReceipts(r || []);
      setProfile(p || {});
      if (p?.country) setProfileCountry(p.country);

      // Auto-select first party if none selected
      if (!selectedPartyName && c && c.length > 0) {
        setSelectedPartyName(c[0].name);
      }
    } catch {
      toast('Failed to load data', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter bills by client name
  const getClientBills = (clientName) => {
    if (!clientName) return [];
    return bills.filter(b => (b.clientName || '').toLowerCase() === clientName.toLowerCase())
      .sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));
  };

  // Filter receipts by client name
  const getClientReceipts = (clientName) => {
    if (!clientName) return [];
    return receipts.filter(r => (r.clientName || '').toLowerCase() === clientName.toLowerCase())
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Get Party Outstanding and Statistics
  const getClientStats = (clientName) => {
    const cBills = getClientBills(clientName);
    const savedClient = clients.find(c => (c.name || '').toLowerCase() === clientName.toLowerCase());
    const openingBal = Number(savedClient?.openingBalance) || 0;

    const totalSales = cBills.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
    const totalPaid = cBills.reduce((s, b) => {
      const fromPayments = (b.payments || []).reduce((ps, p) => ps + (Number(p.amount) || 0), 0);
      if (fromPayments > 0) return s + fromPayments;
      if (typeof b.paidAmount === 'number' && b.paidAmount > 0) return s + b.paidAmount;
      if (b.status === 'paid') return s + (Number(b.totalAmount) || 0);
      return s;
    }, 0);

    const unpaid = openingBal + (totalSales - totalPaid);
    return {
      total: totalSales,
      paid: totalPaid,
      unpaid,
      openingBalance: openingBal,
      count: cBills.length
    };
  };

  // Aging Analysis for Party
  const bucketAge = (days) => {
    if (days <= 30) return 'current';
    if (days <= 60) return 'd31_60';
    if (days <= 90) return 'd61_90';
    return 'd90plus';
  };

  const getClientAging = (clientName) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = { current: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
    const unpaidBills = [];
    for (const b of getClientBills(clientName)) {
      const outstanding = (Number(b.totalAmount) || 0) - (Number(b.paidAmount) || 0);
      if (outstanding <= 0.01) continue;
      const ref = b.data?.details?.dueDate || b.invoiceDate;
      const dueDate = ref ? new Date(ref) : today;
      const ageDays = Math.max(0, Math.floor((today - dueDate) / 86400000));
      const bucket = bucketAge(ageDays);
      buckets[bucket] += outstanding;
      buckets.total += outstanding;
      unpaidBills.push({ bill: b, ageDays, outstanding });
    }
    return { buckets, unpaidBills };
  };

  // All unique client names
  const allClientNames = useMemo(() => {
    return [...new Set([
      ...clients.map(c => c.name),
      ...bills.map(b => b.clientName).filter(Boolean)
    ])];
  }, [clients, bills]);

  // Overall KPI sums across all parties
  const partyKPIs = useMemo(() => {
    let totalReceivable = 0;
    let totalPayable = 0;
    let receivableCount = 0;
    let payableCount = 0;

    for (const name of allClientNames) {
      const stats = getClientStats(name);
      if (stats.unpaid > 0.01) {
        totalReceivable += stats.unpaid;
        receivableCount++;
      } else if (stats.unpaid < -0.01) {
        totalPayable += Math.abs(stats.unpaid);
        payableCount++;
      }
    }
    return {
      totalReceivable,
      totalPayable,
      receivableCount,
      payableCount,
      totalParties: allClientNames.length
    };
  }, [allClientNames, bills, clients]);

  // Filtered and sorted parties
  const filteredAndSortedParties = useMemo(() => {
    let list = allClientNames;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(name => {
        const c = clients.find(cli => cli.name.toLowerCase() === name.toLowerCase());
        return name.toLowerCase().includes(q) ||
          (c?.phone && c.phone.includes(q)) ||
          (c?.city && c.city.toLowerCase().includes(q)) ||
          (c?.gstin && c.gstin.toLowerCase().includes(q));
      });
    }

    if (filterTab === 'receivable') {
      list = list.filter(name => getClientStats(name).unpaid > 0.01);
    } else if (filterTab === 'payable') {
      list = list.filter(name => getClientStats(name).unpaid < -0.01);
    } else if (filterTab === 'zero') {
      list = list.filter(name => Math.abs(getClientStats(name).unpaid) <= 0.01);
    }

    // Sort by largest outstanding balance first
    return [...list].sort((a, b) => {
      const sa = getClientStats(a);
      const sb = getClientStats(b);
      return sb.unpaid - sa.unpaid;
    });
  }, [allClientNames, search, filterTab, clients, bills]);

  // Selected party object
  const activeParty = useMemo(() => {
    if (!selectedPartyName && filteredAndSortedParties.length > 0) {
      return filteredAndSortedParties[0];
    }
    return selectedPartyName;
  }, [selectedPartyName, filteredAndSortedParties]);

  const activeSavedClient = useMemo(() => {
    if (!activeParty) return null;
    return clients.find(c => c.name.toLowerCase() === activeParty.toLowerCase()) || { name: activeParty };
  }, [activeParty, clients]);

  const activeStats = useMemo(() => {
    if (!activeParty) return { total: 0, paid: 0, unpaid: 0, count: 0 };
    return getClientStats(activeParty);
  }, [activeParty, bills, clients]);

  // Unified Chronological Ledger Entries
  const ledgerTransactions = useMemo(() => {
    if (!activeParty) return [];
    const partyBills = getClientBills(activeParty);
    const partyReceipts = getClientReceipts(activeParty);

    const txns = [];

    // Opening balance entry if any
    const opBal = Number(activeSavedClient?.openingBalance) || 0;
    if (opBal !== 0) {
      txns.push({
        id: 'opening-bal',
        date: '—',
        type: 'Opening Balance',
        ref: 'OPENING',
        debit: opBal > 0 ? opBal : 0,
        credit: opBal < 0 ? Math.abs(opBal) : 0,
        status: 'recorded',
        isOpening: true,
      });
    }

    // Add Sales Invoices
    for (const b of partyBills) {
      const isCreditNote = b.invoiceType === 'credit-note';
      const debit = isCreditNote ? 0 : (Number(b.totalAmount) || 0);
      const credit = isCreditNote ? (Number(b.totalAmount) || 0) : 0;
      txns.push({
        id: b.id,
        date: b.invoiceDate,
        type: isCreditNote ? 'Credit Note' : (INVOICE_TYPES[b.invoiceType]?.label || 'Sale Invoice'),
        ref: b.invoiceNumber,
        debit,
        credit,
        status: b.status || 'unpaid',
        bill: b,
      });

      // If bill has payments embedded in payments array
      if (b.payments && b.payments.length > 0) {
        for (const p of b.payments) {
          txns.push({
            id: `p-${p.id || p.date}-${Math.random()}`,
            date: p.date || b.invoiceDate,
            type: `Payment Received (${p.method || 'Cash'})`,
            ref: `Against ${b.invoiceNumber}`,
            debit: 0,
            credit: Number(p.amount) || 0,
            status: 'paid',
            isPayment: true,
          });
        }
      } else if (b.paidAmount > 0 && !isCreditNote) {
        txns.push({
          id: `paid-${b.id}`,
          date: b.invoiceDate,
          type: 'Payment Received',
          ref: `Against ${b.invoiceNumber}`,
          debit: 0,
          credit: Number(b.paidAmount) || 0,
          status: 'paid',
          isPayment: true,
        });
      }
    }

    // Sort chronologically
    return txns.sort((a, b) => {
      if (a.isOpening) return -1;
      if (b.isOpening) return 1;
      return new Date(a.date) - new Date(b.date);
    });
  }, [activeParty, bills, receipts, activeSavedClient]);

  // Compute running balance for ledger table
  const ledgerWithRunningBalance = useMemo(() => {
    let balance = 0;
    return ledgerTransactions.map(tx => {
      balance += (tx.debit - tx.credit);
      return {
        ...tx,
        runningBalance: balance
      };
    });
  }, [ledgerTransactions]);

  // WhatsApp Payment Reminder Generator
  const sendWhatsAppReminder = (partyName) => {
    const savedClient = clients.find(c => c.name.toLowerCase() === partyName.toLowerCase());
    const stats = getClientStats(partyName);
    const cBills = getClientBills(partyName).filter(b => b.status !== 'paid');
    const businessName = profile?.businessName || localStorage.getItem('businessName') || 'My Business';
    const upiId = profile?.upiId || profile?.paymentAccounts?.[0]?.upiId || '';

    const invoiceLines = cBills.slice(0, 5).map(b => {
      const due = Math.max(0, (Number(b.totalAmount) || 0) - (Number(b.paidAmount) || 0));
      return `• *${b.invoiceNumber}* (${new Date(b.invoiceDate).toLocaleDateString('en-IN')}): ₹${due.toLocaleString('en-IN')}`;
    }).join('\n');

    const text = [
      `*Payment Reminder from ${businessName}*`,
      ``,
      `Dear *${partyName}*,`,
      `This is a friendly reminder that your current outstanding balance is:`,
      `*${formatCurrency(stats.unpaid)}*`,
      ``,
      cBills.length > 0 ? `*Pending Invoices:*\n${invoiceLines}${cBills.length > 5 ? `\n...and ${cBills.length - 5} more` : ''}\n` : '',
      upiId ? `*UPI ID for Payment:* ${upiId}\n` : '',
      `Kindly arrange the payment at your earliest convenience. If already paid, please ignore this message.`,
      ``,
      `Thank you!`,
      `— ${businessName}`
    ].filter(Boolean).join('\n');

    openWhatsAppShare(savedClient?.phone, text);
  };

  // Open Record Payment Modal
  const openRecordPayment = (prefillInvoice = null) => {
    if (!activeParty) return;
    const unpaidAmt = Math.max(0, activeStats.unpaid);
    setPaymentForm({
      partyName: activeParty,
      amount: prefillInvoice ? Math.max(0, (prefillInvoice.totalAmount || 0) - (prefillInvoice.paidAmount || 0)) : (unpaidAmt > 0 ? unpaidAmt : ''),
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'Cash',
      referenceNo: '',
      linkedInvoice: prefillInvoice?.invoiceNumber || '__fifo__',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  // Save Recorded Payment-In
  const handleSavePaymentIn = async (e) => {
    e.preventDefault();
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) {
      toast('Please enter a valid payment amount', 'warning');
      return;
    }

    try {
      const receiptNo = await getNextInvoiceNumber('RCP', { peek: false }).catch(() => `RCP-${Date.now()}`);

      // 1. Create Receipt Record
      const receipt = {
        receiptNo,
        date: paymentForm.date,
        clientName: activeParty,
        amount: amt,
        paymentMode: paymentForm.paymentMode,
        referenceNo: paymentForm.referenceNo || '',
        againstInvoice: paymentForm.linkedInvoice === '__fifo__' ? '' : paymentForm.linkedInvoice,
        note: paymentForm.notes || 'Counter Payment-In',
      };
      await saveReceipt(receipt);

      // 2. Propagate to invoices
      const partyBills = getClientBills(activeParty);
      if (paymentForm.linkedInvoice && paymentForm.linkedInvoice !== '__fifo__') {
        // Specific invoice payment
        const targetBill = partyBills.find(b => b.invoiceNumber === paymentForm.linkedInvoice || b.id === paymentForm.linkedInvoice);
        if (targetBill) {
          const newPaid = (Number(targetBill.paidAmount) || 0) + amt;
          const nextStatus = newPaid >= (Number(targetBill.totalAmount) || 0) - 0.005 ? 'paid' : 'partial';
          const newPayments = [...(targetBill.payments || []), {
            id: Date.now().toString(),
            date: paymentForm.date,
            amount: amt,
            method: paymentForm.paymentMode,
            notes: `Receipt ${receiptNo}`
          }];
          await saveBill({ ...targetBill, paidAmount: newPaid, status: nextStatus, payments: newPayments }, { overwrite: true });
        }
      } else {
        // FIFO allocation across unpaid bills
        let remaining = amt;
        const unpaidBills = partyBills
          .filter(b => b.status !== 'paid')
          .sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));

        for (const b of unpaidBills) {
          if (remaining <= 0.005) break;
          const due = Math.max(0, (Number(b.totalAmount) || 0) - (Number(b.paidAmount) || 0));
          const apply = Math.min(due, remaining);
          const newPaid = (Number(b.paidAmount) || 0) + apply;
          const nextStatus = newPaid >= (Number(b.totalAmount) || 0) - 0.005 ? 'paid' : 'partial';
          const newPayments = [...(b.payments || []), {
            id: Date.now().toString() + Math.random(),
            date: paymentForm.date,
            amount: apply,
            method: paymentForm.paymentMode,
            notes: `Payment-In ${receiptNo}`
          }];
          await saveBill({ ...b, paidAmount: newPaid, status: nextStatus, payments: newPayments }, { overwrite: true });
          remaining -= apply;
        }
      }

      toast(`Payment of ${formatCurrency(amt)} recorded for ${activeParty}!`, 'success');
      setShowPaymentModal(false);
      loadData();
    } catch (err) {
      console.error('Save Payment-In failed:', err);
      toast('Failed to record payment', 'error');
    }
  };

  // Generate Indian Dr/Cr Ledger Statement PDF
  const generateClientStatement = async (clientName) => {
    const clientBills = getClientBills(clientName);
    if (clientBills.length === 0) {
      toast('No invoices for this client', 'warning');
      return;
    }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const savedClient = clients.find(c => c.name === clientName) || { name: clientName };
      const stats = getClientStats(clientName);
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
      doc.text('STATEMENT OF ACCOUNT', marginL, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(profile?.businessName || localStorage.getItem('businessName') || 'My Business', marginL, y); y += 4.5;
      if (profile?.address) { doc.text(profile.address, marginL, y); y += 4.5; }
      if (profile?.gstin) { doc.text(`GSTIN: ${profile.gstin}`, marginL, y); y += 4.5; }
      doc.setTextColor(0);

      // Client Box
      doc.text(`Statement Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, marginR, 18, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`Billed To: ${clientName}`, marginR, 24, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      if (savedClient?.phone) doc.text(`Phone: ${savedClient.phone}`, marginR, 29, { align: 'right' });
      if (savedClient?.gstin) doc.text(`GSTIN: ${savedClient.gstin}`, marginR, 34, { align: 'right' });

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
      doc.text('Particulars', col.dateEnd + 2, y + 5.5);
      doc.text('Debit (Rs.)', col.debitEnd, y + 5.5, { align: 'right' });
      doc.text('Credit (Rs.)', col.creditEnd, y + 5.5, { align: 'right' });
      doc.text('Balance (Rs.)', col.balanceEnd, y + 5.5, { align: 'right' });
      doc.setTextColor(0);
      y += 10;

      // Rows
      let runningBalance = Number(savedClient?.openingBalance) || 0;
      doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(90);
      doc.text('Opening Balance', col.dateEnd + 2, y);
      doc.text(fmt(runningBalance), col.balanceEnd, y, { align: 'right' });
      doc.setTextColor(0); doc.setFont('helvetica', 'normal');
      y += 6;

      const sortedBills = clientBills.slice().sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));
      for (const bill of sortedBills) {
        if (y > 270) { doc.addPage(); y = 20; }
        const isCreditNote = bill.invoiceType === 'credit-note';
        const debit = isCreditNote ? 0 : (Number(bill.totalAmount) || 0);
        const credit = isCreditNote ? (Number(bill.totalAmount) || 0) : 0;
        runningBalance += debit - credit;

        const dt = bill.invoiceDate ? new Date(bill.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
        doc.text(dt, marginL + 2, y);
        doc.text(`${bill.invoiceNumber} (${isCreditNote ? 'Credit Note' : 'Sale'})`, col.dateEnd + 2, y);
        if (debit > 0) doc.text(fmt(debit), col.debitEnd, y, { align: 'right' });
        if (credit > 0) doc.text(fmt(credit), col.creditEnd, y, { align: 'right' });
        doc.text(fmt(runningBalance) + (runningBalance > 0.01 ? ' Dr' : (runningBalance < -0.01 ? ' Cr' : '')), col.balanceEnd, y, { align: 'right' });
        y += 5.5;

        // Payment row if paid
        const paid = Number(bill.paidAmount) || 0;
        if (paid > 0 && !isCreditNote) {
          if (y > 270) { doc.addPage(); y = 20; }
          runningBalance -= paid;
          doc.setFont('helvetica', 'italic'); doc.setTextColor(80);
          doc.text(`   Payment recd against ${bill.invoiceNumber}`, col.dateEnd + 2, y);
          doc.text(fmt(paid), col.creditEnd, y, { align: 'right' });
          doc.text(fmt(runningBalance) + (runningBalance > 0.01 ? ' Dr' : ''), col.balanceEnd, y, { align: 'right' });
          doc.setTextColor(0); doc.setFont('helvetica', 'normal');
          y += 5.5;
        }
      }

      // Closing summary
      y += 4;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('CLOSING OUTSTANDING BALANCE', marginL, y);
      doc.setTextColor(runningBalance > 0.01 ? 220 : 5, runningBalance > 0.01 ? 38 : 150, runningBalance > 0.01 ? 38 : 105);
      doc.text(fmt(Math.abs(runningBalance)) + (runningBalance > 0.01 ? ' Dr (Due)' : (runningBalance < -0.01 ? ' Cr (Advance)' : ' Nil')), col.balanceEnd, y, { align: 'right' });

      doc.save(`Statement-${clientName.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
      toast(`Statement downloaded for ${clientName}`, 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to generate statement', 'error');
    }
  };

  // Generate Aging Report PDF
  const generateAgingReport = async (clientName) => {
    try {
      const { jsPDF } = await import('jspdf');
      const { unpaidBills, buckets } = getClientAging(clientName);
      if (unpaidBills.length === 0) {
        toast(`${clientName} has no outstanding balance.`, 'info');
        return;
      }
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195;
      let y = 20;

      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('AGING REPORT', marginL, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(profile?.businessName || localStorage.getItem('businessName') || 'My Business', marginL, y); y += 5;
      doc.setTextColor(0);
      doc.text(`As of: ${new Date().toLocaleDateString('en-IN')}`, marginR, 20, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`Party: ${clientName}`, marginR, 26, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 8;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 8;

      // Table
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('Invoice #', marginL, y);
      doc.text('Date', marginL + 40, y);
      doc.text('Age (Days)', marginL + 80, y);
      doc.text('Total', marginL + 120, y, { align: 'right' });
      doc.text('Outstanding Due', marginR, y, { align: 'right' });
      y += 6;
      doc.setLineWidth(0.2); doc.line(marginL, y - 2, marginR, y - 2);

      doc.setFont('helvetica', 'normal');
      const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      for (const { bill, ageDays, outstanding } of unpaidBills) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(String(bill.invoiceNumber || '—'), marginL, y);
        doc.text(bill.invoiceDate || '—', marginL + 40, y);
        doc.text(`${ageDays} days`, marginL + 80, y);
        doc.text(fmt(bill.totalAmount), marginL + 120, y, { align: 'right' });
        doc.setTextColor(ageDays > 60 ? 220 : 0, ageDays > 60 ? 38 : 0, ageDays > 60 ? 38 : 0);
        doc.text(fmt(outstanding), marginR, y, { align: 'right' });
        doc.setTextColor(0);
        y += 6;
      }

      y += 6;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('TOTAL OUTSTANDING DUE', marginL, y);
      doc.setTextColor(220, 38, 38);
      doc.text(`Rs. ${fmt(buckets.total)}`, marginR, y, { align: 'right' });

      doc.save(`Aging-${clientName.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
      toast(`Aging report downloaded for ${clientName}`, 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to generate aging report', 'error');
    }
  };

  const handleDeleteClient = async (id) => {
    if (await confirmAction({
      title: 'Remove this saved client?',
      message: 'Their existing invoices stay untouched — this only removes them from your saved clients list.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })) {
      await deleteClient(id);
      toast('Party removed', 'success');
      loadData();
    }
  };

  const handleDeleteBill = async (id) => {
    if (await confirmAction({
      title: 'Delete this invoice?',
      message: 'The invoice will be moved to Trash for 30 days. Can be restored from Settings → Trash.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        await deleteBill(id);
        toast('Invoice deleted', 'success');
        loadData();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  const changeStatus = async (bill, newStatus) => {
    const updated = { ...bill, status: newStatus };
    if (newStatus === 'paid') updated.paidAmount = bill.totalAmount;
    await saveBill(updated, { overwrite: true });
    toast(`Marked as ${STATUS_COLORS[newStatus]?.label || newStatus}`, 'info');
    loadData();
  };

  const openAddClient = () => {
    setModalClient(null);
    setEditingClientId(null);
    setShowForm(true);
  };

  const openEditClient = (cli) => {
    setModalClient(cli);
    setEditingClientId(cli.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setModalClient(null);
    setEditingClientId(null);
  };

  const handleModalSave = async (formData) => {
    if (!formData.name.trim()) { toast('Party name is required', 'warning'); return; }
    try {
      const data = { ...formData };
      if (editingClientId) data.id = editingClientId;
      await saveClient(data);
      toast(editingClientId ? 'Party updated' : 'Party added', 'success');
      closeForm();
      loadData();
    } catch {
      toast('Failed to save party', 'error');
    }
  };

  const csvInputRef = useRef(null);
  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { toast('CSV file is empty', 'warning'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length === 0) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        const name = row.name || row.client || row['client name'] || '';
        if (!name) continue;
        await saveClient({
          name,
          address: row.address || '',
          state: row.state || '',
          gstin: row.gstin || '',
          email: row.email || '',
          phone: row.phone || '',
        });
        imported++;
      }
      toast(`Imported ${imported} parties`, 'success');
      loadData();
    } catch {
      toast('Failed to parse CSV file', 'error');
    }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Header Bar */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.6rem', fontWeight: 800 }}>Parties &amp; Customer Ledger</h1>
            <p className="page-subtitle">Track receivables, party statements, and payment settlements</p>
          </div>
          <HelpButton title="Parties & Ledger — how to use">
            <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li><strong>Select any party</strong> on the left to see their live outstanding balance and full Dr/Cr account statement.</li>
              <li><strong>+ Record Payment-In</strong> — record cash, UPI, or bank collections and auto-settle unpaid invoices.</li>
              <li><strong>Send WhatsApp Reminder</strong> — pre-composed collection reminder with balance breakdown and UPI ID.</li>
              <li><strong>Statement PDF &amp; Aging PDF</strong> — generate CA-ready statements in 1 click.</li>
              <li><strong>+ Add Sale</strong> — jump straight to invoice billing with the customer pre-filled.</li>
            </ul>
          </HelpButton>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={csvInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />
          <button className="btn btn-secondary" onClick={() => csvInputRef.current?.click()} title="Import parties from CSV">
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn btn-primary" onClick={openAddClient} style={{ fontWeight: 700 }}>
            <Plus size={18} /> + Add Party
          </button>
        </div>
      </div>

      {/* Top Vyapar KPI Summary Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* KPI 1: Total Parties */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Parties</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{partyKPIs.totalParties}</div>
          </div>
        </div>

        {/* KPI 2: Total Receivables (You'll Receive) */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
            <IndianRupee size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>
              You'll Receive ({partyKPIs.receivableCount} parties)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>
              {formatCurrency(partyKPIs.totalReceivable)}
            </div>
          </div>
        </div>

        {/* KPI 3: Total Payables (You'll Pay) */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
            <Check size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
              You'll Pay / Advance ({partyKPIs.payableCount} parties)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
              {formatCurrency(partyKPIs.totalPayable)}
            </div>
          </div>
        </div>
      </div>

      {/* Master-Detail 2-Column Vyapar Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* LEFT COLUMN: Parties List & Fast Search */}
        <div className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
          {/* Search Box */}
          <div className="search-box" style={{ width: '100%', marginBottom: '0.75rem' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by party, phone, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
            {search && <button className="icon-btn" onClick={() => setSearch('')}><X size={14} /></button>}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
            {[
              { id: 'all', label: `All (${allClientNames.length})` },
              { id: 'receivable', label: `To Receive` },
              { id: 'payable', label: `To Pay` },
              { id: 'zero', label: `Zero Bal` },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: filterTab === tab.id ? 700 : 500,
                  background: filterTab === tab.id ? '#2563eb' : '#f8fafc',
                  color: filterTab === tab.id ? '#ffffff' : '#64748b',
                  border: filterTab === tab.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Parties Scroll List */}
          <div style={{ maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredAndSortedParties.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.85rem' }}>No matching parties found.</p>
              </div>
            ) : (
              filteredAndSortedParties.map(partyName => {
                const stats = getClientStats(partyName);
                const savedClient = clients.find(c => c.name.toLowerCase() === partyName.toLowerCase());
                const isSelected = activeParty === partyName;
                const isDue = stats.unpaid > 0.01;
                const isAdv = stats.unpaid < -0.01;

                return (
                  <div
                    key={partyName}
                    onClick={() => setSelectedPartyName(partyName)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: '8px',
                      marginBottom: '0.4rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                      borderTop: '1px solid',
                      borderRight: '1px solid',
                      borderBottom: '1px solid',
                      borderColor: isSelected ? '#bfdbfe' : '#f1f5f9',
                      boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.08)' : 'none',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: isSelected ? '#2563eb' : '#e2e8f0',
                        color: isSelected ? '#ffffff' : '#475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.85rem'
                      }}>
                        {partyName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: isSelected ? 700 : 600, fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.2 }}>
                          {partyName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                          {savedClient?.phone || savedClient?.city || `${stats.count} bills`}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: isDue ? '#dc2626' : (isAdv ? '#059669' : '#64748b')
                      }}>
                        {formatCurrency(Math.abs(stats.unpaid))}
                      </div>
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: 800,
                        background: isDue ? '#fee2e2' : (isAdv ? '#d1fae5' : '#f1f5f9'),
                        color: isDue ? '#dc2626' : (isAdv ? '#059669' : '#64748b')
                      }}>
                        {isDue ? 'To Receive' : (isAdv ? 'To Pay' : 'Settled')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Party Detailed Ledger & Action Hub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {activeParty ? (
            <>
              {/* Party Profile Hero Card */}
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        {activeParty}
                      </h2>
                      {activeSavedClient?.gstin && (
                        <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, color: '#475569', fontWeight: 600 }}>
                          GSTIN: {activeSavedClient.gstin}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.4rem', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap' }}>
                      {activeSavedClient?.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={14} /> {activeSavedClient.phone}
                        </span>
                      )}
                      {activeSavedClient?.address && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={14} /> {[activeSavedClient.address, activeSavedClient.city, activeSavedClient.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {activeSavedClient?.email && <span>✉ {activeSavedClient.email}</span>}
                    </div>
                  </div>

                  {/* Prominent Outstanding Balance Display */}
                  <div style={{
                    textAlign: 'right',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '10px',
                    background: activeStats.unpaid > 0.01 ? '#fef2f2' : (activeStats.unpaid < -0.01 ? '#ecfdf5' : '#f8fafc'),
                    border: `1px solid ${activeStats.unpaid > 0.01 ? '#fecaca' : (activeStats.unpaid < -0.01 ? '#a7f3d0' : '#e2e8f0')}`
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: activeStats.unpaid > 0.01 ? '#dc2626' : (activeStats.unpaid < -0.01 ? '#059669' : '#64748b'), textTransform: 'uppercase' }}>
                      {activeStats.unpaid > 0.01 ? 'Total Balance Due (Receivable)' : (activeStats.unpaid < -0.01 ? 'Advance Balance (Payable)' : 'Current Balance')}
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: activeStats.unpaid > 0.01 ? '#dc2626' : (activeStats.unpaid < -0.01 ? '#059669' : '#0f172a'), marginTop: 2 }}>
                      {formatCurrency(Math.abs(activeStats.unpaid))}
                    </div>
                  </div>
                </div>

                {/* Party Action Button Bar */}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openRecordPayment()}
                    style={{ background: '#059669', borderColor: '#059669', fontWeight: 700, padding: '0.45rem 1rem' }}
                    title="Record payment collected from this party"
                  >
                    <Receipt size={16} /> + Record Payment-In
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => sendWhatsAppReminder(activeParty)}
                    style={{ background: '#25d366', color: '#ffffff', borderColor: '#25d366', fontWeight: 700, padding: '0.45rem 1rem' }}
                    title="Send payment reminder with outstanding balance & UPI details via WhatsApp"
                  >
                    <MessageCircle size={16} /> Send Reminder (WhatsApp)
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => generateClientStatement(activeParty)}
                    style={{ fontWeight: 600, padding: '0.45rem 0.9rem' }}
                    title="Download Indian Dr/Cr account statement PDF"
                  >
                    <Download size={15} /> Statement PDF
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => generateAgingReport(activeParty)}
                    style={{ fontWeight: 600, padding: '0.45rem 0.9rem' }}
                    title="Download overdue aging analysis"
                  >
                    <Clock size={15} /> Aging PDF
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onNew && onNew({ invoiceType: 'tax-invoice', clientName: activeParty, data: { client: activeSavedClient } })}
                    style={{ fontWeight: 600, padding: '0.45rem 0.9rem' }}
                    title="Create new invoice for this party"
                  >
                    <FileText size={15} /> + Add Sale
                  </button>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                    {activeSavedClient?.id && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openEditClient(activeSavedClient)}
                        style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                        title="Edit party details"
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Aging Breakdown Inline Strip */}
              {(() => {
                const { buckets } = getClientAging(activeParty);
                if (buckets.total <= 0.01) return null;
                const cells = [
                  { label: '0–30 Days (Current)', val: buckets.current, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
                  { label: '31–60 Days', val: buckets.d31_60, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                  { label: '61–90 Days', val: buckets.d61_90, color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
                  { label: '90+ Days (Overdue)', val: buckets.d90plus, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                ];
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    {cells.map(c => (
                      <div key={c.label} style={{ padding: '0.65rem 0.85rem', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{c.label}</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: c.color, marginTop: 2 }}>
                          {formatCurrency(c.val)}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Detailed Transactions Ledger Table */}
              <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt size={18} color="#2563eb" /> Account Transactions Ledger (Dr / Cr)
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {ledgerWithRunningBalance.length} transaction{ledgerWithRunningBalance.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {ledgerWithRunningBalance.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>No transactions recorded for {activeParty} yet.</p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onNew && onNew({ invoiceType: 'tax-invoice', clientName: activeParty, data: { client: activeSavedClient } })}
                    >
                      <Plus size={16} /> Create First Invoice
                    </button>
                  </div>
                ) : (
                  <div className="table-scroll" style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.75rem' }}>Date</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.75rem' }}>Type</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontSize: '0.75rem' }}>Txn / Ref #</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.75rem' }}>Debit (Sale)</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.75rem' }}>Credit (Received)</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.75rem' }}>Balance</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontSize: '0.75rem' }}>Status</th>
                          <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontSize: '0.75rem' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerWithRunningBalance.map((tx, idx) => {
                          const isDr = tx.runningBalance > 0.01;
                          const isCr = tx.runningBalance < -0.01;

                          return (
                            <tr key={tx.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: tx.isPayment ? '#fafafa' : '#ffffff' }}>
                              <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                {tx.date === '—' ? '—' : new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', fontWeight: 600 }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: tx.isOpening ? '#f1f5f9' : (tx.isPayment ? '#ecfdf5' : '#eff6ff'),
                                  color: tx.isOpening ? '#475569' : (tx.isPayment ? '#059669' : '#2563eb')
                                }}>
                                  {tx.type}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                                {tx.ref}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: tx.debit > 0 ? '#0f172a' : '#cbd5e1' }}>
                                {tx.debit > 0 ? formatCurrency(tx.debit) : '—'}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: tx.credit > 0 ? '#059669' : '#cbd5e1' }}>
                                {tx.credit > 0 ? formatCurrency(tx.credit) : '—'}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: isDr ? '#dc2626' : (isCr ? '#059669' : '#64748b') }}>
                                {formatCurrency(Math.abs(tx.runningBalance))} {isDr ? 'Dr' : (isCr ? 'Cr' : '')}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                                {tx.bill ? (
                                  <select
                                    value={tx.status}
                                    style={{
                                      background: STATUS_COLORS[tx.status]?.bg || '#f1f5f9',
                                      color: STATUS_COLORS[tx.status]?.color || '#475569',
                                      border: `1px solid ${STATUS_COLORS[tx.status]?.color || '#cbd5e1'}44`,
                                      fontSize: '0.72rem',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                    onChange={(e) => changeStatus(tx.bill, e.target.value)}
                                  >
                                    {Object.entries(STATUS_COLORS).map(([k, v]) => (
                                      <option key={k} value={k}>{v.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Settled</span>
                                )}
                              </td>
                              <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                                  {tx.bill && (
                                    <>
                                      <button className="icon-btn icon-btn-blue" onClick={() => onEdit && onEdit(tx.bill)} title="Edit Invoice">
                                        <Edit3 size={13} />
                                      </button>
                                      <button className="icon-btn icon-btn-green" onClick={() => {
                                        const msg = `*Invoice ${tx.bill.invoiceNumber}*\nAmount: ${formatCurrency(tx.bill.totalAmount)}\nDate: ${new Date(tx.bill.invoiceDate).toLocaleDateString('en-IN')}\nStatus: ${(tx.bill.status || 'unpaid').toUpperCase()}`;
                                        openWhatsAppShare(activeSavedClient?.phone, msg);
                                      }} title="Share via WhatsApp">
                                        <MessageCircle size={13} />
                                      </button>
                                      <button className="icon-btn icon-btn-red" onClick={() => handleDeleteBill(tx.bill.id)} title="Delete Invoice">
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                  {tx.isPayment && (
                                    <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Payment-In</span>
                                  )}
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
          ) : (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
              <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1.2rem', color: '#475569' }}>Select a party from the left</h3>
              <p style={{ fontSize: '0.85rem' }}>View their ledger, recorded transactions, and send payment reminders.</p>
            </div>
          )}
        </div>
      </div>

      {/* Record Payment-In Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)} style={{ zIndex: 1000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Receipt size={18} color="#059669" /> Record Payment-In
              </h3>
              <button className="icon-btn" onClick={() => setShowPaymentModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSavePaymentIn}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Party Name</label>
                <input type="text" className="form-input" value={paymentForm.partyName} disabled style={{ background: '#f8fafc', fontWeight: 700 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={paymentForm.date}
                    onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-input"
                    value={paymentForm.paymentMode}
                    onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  >
                    {PAYMENT_MODES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Amount Received (₹)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    className="form-input"
                    style={{ fontSize: '1.15rem', fontWeight: 800, paddingLeft: '2rem' }}
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                  />
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#64748b' }}>₹</span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Link to Invoice (Settlement)</label>
                <select
                  className="form-input"
                  value={paymentForm.linkedInvoice}
                  onChange={e => setPaymentForm({ ...paymentForm, linkedInvoice: e.target.value })}
                >
                  <option value="__fifo__">⚡ Auto-settle oldest unpaid invoices (FIFO)</option>
                  {getClientBills(activeParty).filter(b => b.status !== 'paid').map(b => (
                    <option key={b.invoiceNumber} value={b.invoiceNumber}>
                      {b.invoiceNumber} (Pending: {formatCurrency(Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0)))})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Reference / Transaction ID (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UPI UTR, Cheque #, Bank Ref"
                  value={paymentForm.referenceNo}
                  onChange={e => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Notes / Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Received via PhonePe / cash at counter"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}>
                  Save Payment-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Client Modal */}
      <ClientModal
        show={showForm}
        onClose={closeForm}
        onSave={handleModalSave}
        client={modalClient}
        isEditing={!!editingClientId}
        defaultCountry={profileCountry}
      />
    </div>
  );
}
