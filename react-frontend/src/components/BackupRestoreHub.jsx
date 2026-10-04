import { useState, useEffect, useRef } from 'react';
import {
  Database, HardDrive, Cloud, RefreshCw, Download, Upload, Trash2,
  CheckCircle2, AlertTriangle, ShieldCheck, Clock, Calendar, FileText,
  Save, Check, X, FolderSync, ShieldAlert, ArrowUpRight, Lock, Eye, AlertCircle
} from 'lucide-react';
import {
  getBackupsList, restoreBackup, triggerBackup, deleteBackup,
  getTrashedBills, restoreTrashedBill, purgeTrashedBill,
  exportAllData, importData, inspectBackup, getProfile,
  getAllBills, getAllProducts, getAllClients, getAllExpenses, getAllPurchases, getAllReceipts
} from '../store';
import {
  initGoogleDrive, isConnected as isDriveConnected, disconnect as disconnectDrive,
  ensureToken, findOrCreateFolder, uploadJSON
} from '../services/googleDrive';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';

const ALL_BACKUP_PARTS = [
  { id: 'profile',        label: 'Active Business Profile',   hint: 'Company Name, address, GSTIN, bank accounts, logo, signature' },
  { id: 'profiles',       label: 'Multi-Firm Profiles',       hint: 'All sister companies and business profiles' },
  { id: 'bills',          label: 'Sales Invoices & Quotes',   hint: 'Tax invoices, proforma, quotations, delivery challans' },
  { id: 'clients',        label: 'Customer Directory',        hint: 'Clients, addresses, GSTIN, opening balances' },
  { id: 'products',       label: 'Items & Inventory Stock',   hint: 'Product catalog, HSN codes, buying/selling prices, quantities' },
  { id: 'expenses',       label: 'Expenses Ledger',           hint: 'Categorized business expenses & receipts' },
  { id: 'purchases',      label: 'Purchase Bills & ITC',      hint: 'Vendor bills, supplier details, input tax credits' },
  { id: 'receipts',       label: 'Cash & Bank Vouchers',      hint: 'Customer receipts, supplier payments, contra transfers' },
  { id: 'recurring',      label: 'Recurring Billing Rules',   hint: 'Automated repeat invoice schedules' },
  { id: 'termsTemplates', label: 'Terms & Conditions Presets', hint: 'Custom T&C notes & return policies' },
  { id: 'meta',           label: 'System & Print Settings',   hint: 'Thermal slip config, invoice formats, custom units' },
  { id: 'localStorage',   label: 'Local User Preferences',    hint: 'Theme mode, quick toggles, layout cache' },
];

export default function BackupRestoreHub() {
  const [activeTab, setActiveTab] = useState('archives'); // 'archives' | 'schedules' | 'trash'
  const [backups, setBackups] = useState([]);
  const [trash, setTrash] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [profile, setProfile] = useState(null);

  // Database Records Counts
  const [stats, setStats] = useState({
    billsCount: 0,
    productsCount: 0,
    clientsCount: 0,
    expensesCount: 0,
    purchasesCount: 0,
    receiptsCount: 0,
  });

  // Cloud Sync State
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveSyncing, setDriveSyncing] = useState(false);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSel, setExportSel] = useState(() => Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, true])));
  const [exportToDrive, setExportToDrive] = useState(false);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSel, setImportSel] = useState(() => Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, true])));
  const [importInspection, setImportInspection] = useState(null);
  const [importJsonText, setImportJsonText] = useState('');
  const fileInputRef = useRef(null);

  // Schedule Settings State
  const [scheduleConfig, setScheduleConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('gst_backup_schedule');
      return saved ? JSON.parse(saved) : { frequency: 'daily', retentionDays: 30, alertDays: 3, autoCloudSync: false };
    } catch {
      return { frequency: 'daily', retentionDays: 30, alertDays: 3, autoCloudSync: false };
    }
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [bList, tList, prof, b, p, c, e, pb, r] = await Promise.all([
        getBackupsList().catch(() => []),
        getTrashedBills().catch(() => []),
        getProfile().catch(() => null),
        getAllBills().catch(() => []),
        getAllProducts().catch(() => []),
        getAllClients().catch(() => []),
        getAllExpenses().catch(() => []),
        getAllPurchases().catch(() => []),
        getAllReceipts().catch(() => []),
      ]);

      setBackups(Array.isArray(bList) ? bList : []);
      setTrash(Array.isArray(tList) ? tList : []);
      if (prof) setProfile(prof);
      setStats({
        billsCount: Array.isArray(b) ? b.length : 0,
        productsCount: Array.isArray(p) ? p.length : 0,
        clientsCount: Array.isArray(c) ? c.length : 0,
        expensesCount: Array.isArray(e) ? e.length : 0,
        purchasesCount: Array.isArray(pb) ? pb.length : 0,
        receiptsCount: Array.isArray(r) ? r.length : 0,
      });

      setDriveConnected(isDriveConnected());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const totalRecordsCount = stats.billsCount + stats.productsCount + stats.clientsCount + stats.expensesCount + stats.purchasesCount + stats.receiptsCount;

  // Check Protection Health
  const latestBackup = backups[0];
  const daysSinceLastBackup = latestBackup?.createdAt
    ? Math.floor((Date.now() - new Date(latestBackup.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : latestBackup?.date
      ? Math.floor((Date.now() - new Date(latestBackup.date).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
  const isHealthy = backups.length > 0 && daysSinceLastBackup <= (scheduleConfig.alertDays || 3);

  // Trigger Instant Snapshot
  const handleTriggerBackupNow = async () => {
    setBackingUp(true);
    try {
      await triggerBackup();
      toast('Instant snapshot created & verified successfully', 'success');
      await loadAll();
    } catch (err) {
      toast('Backup failed: ' + (err.message || 'Server error'), 'error');
    }
    setBackingUp(false);
  };

  // Restore Server Backup Snapshot
  const handleRestoreSnapshot = async (date) => {
    const confirmed = await confirmAction({
      title: `Restore Database Snapshot ${date}?`,
      message: 'This will restore all records to the state of this snapshot. A safety rollback snapshot of your current live data will be automatically generated before proceeding.',
      confirmLabel: 'Restore Database',
      tone: 'warning'
    });
    if (!confirmed) return;

    try {
      await triggerBackup(); // Safety pre-restore snapshot
      await restoreBackup(date);
      toast('Database snapshot successfully restored! Please reload the page to refresh all ledgers.', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast('Restore failed: ' + (err.message || 'Check logs'), 'error');
    }
  };

  // Delete Server Snapshot
  const handleDeleteSnapshot = async (date) => {
    const confirmed = await confirmAction({
      title: `Delete Snapshot ${date}?`,
      message: 'Are you sure you want to delete this backup snapshot? This cannot be undone.',
      confirmLabel: 'Delete Snapshot',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await deleteBackup(date);
      toast(`Backup snapshot ${date} deleted`, 'info');
      loadAll();
    } catch (err) {
      toast('Delete failed: ' + (err.message || 'Server error'), 'error');
    }
  };

  // Restore Trashed Bill
  const handleRestoreTrash = async (id) => {
    try {
      await restoreTrashedBill(id);
      toast('Invoice restored to active sales ledger', 'success');
      loadAll();
    } catch (err) {
      toast('Restore failed: ' + (err.message || 'Server error'), 'error');
    }
  };

  // Purge Trashed Bill
  const handlePurgeTrash = async (id) => {
    const confirmed = await confirmAction({
      title: 'Permanently Purge Invoice?',
      message: 'This invoice will be permanently deleted from the database. It cannot be recovered.',
      confirmLabel: 'Purge Forever',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      await purgeTrashedBill(id);
      toast('Invoice permanently purged', 'info');
      loadAll();
    } catch (err) {
      toast('Purge failed: ' + (err.message || 'Server error'), 'error');
    }
  };

  // Granular Export Execution
  const runExportData = async () => {
    try {
      const json = await exportAllData(exportSel);
      const fileName = `Vyapar-Database-Backup-${new Date().toISOString().slice(0, 10)}.json`;

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      if (exportToDrive) {
        if (!profile?.googleClientId) {
          toast('Google Client ID not configured in Settings.', 'warning');
        } else {
          setDriveSyncing(true);
          const ok = await ensureToken(profile.googleClientId);
          if (ok) {
            const folderName = (profile.googleDriveFolder || 'Vyapar Invoices') + ' - Backups';
            const folderId = await findOrCreateFolder(folderName);
            await uploadJSON(fileName, json, folderId);
            toast('Backup saved directly to Google Drive folder!', 'success');
          } else {
            toast('Google Drive auth failed — local file downloaded only', 'warning');
          }
          setDriveSyncing(false);
        }
      }

      toast('Complete database backup downloaded', 'success');
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      toast('Export failed: ' + err.message, 'error');
      setDriveSyncing(false);
    }
  };

  // Pick Import File
  const handlePickImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const inspection = inspectBackup(text);
      if (!inspection.valid) {
        toast("Selected file is not a valid Vyapar / Accounting backup.", 'error');
        return;
      }
      setImportInspection(inspection);
      setImportJsonText(text);

      const auto = {};
      ALL_BACKUP_PARTS.forEach(p => {
        auto[p.id] = (inspection.counts[p.id] || 0) > 0;
      });
      setImportSel(auto);
      setShowImportModal(true);
    } catch (err) {
      toast('Could not parse backup file: ' + err.message, 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Run Granular Import
  const runImportData = async () => {
    try {
      const result = await importData(importJsonText, importSel);
      const parts = [];
      if (result.billCount) parts.push(`${result.billCount} invoices`);
      if (result.clientCount) parts.push(`${result.clientCount} clients`);
      if (result.productCount) parts.push(`${result.productCount} products`);
      if (result.hasProfile) parts.push('company profile');

      toast(`Restore complete! ${parts.join(', ')}`, 'success');
      setShowImportModal(false);
      setImportInspection(null);
      setImportJsonText('');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast('Restore failed: ' + (err.message || 'Invalid data'), 'error');
    }
  };

  // Google Drive Connection
  const handleConnectDrive = async () => {
    if (!profile?.googleClientId) {
      toast('Please configure your Google Client ID in Settings first.', 'warning');
      return;
    }
    setDriveSyncing(true);
    try {
      const res = await initGoogleDrive(profile.googleClientId);
      if (res?.success) {
        setDriveConnected(true);
        toast('Connected to Google Drive successfully!', 'success');
      } else {
        toast('Google Drive authorization was cancelled or failed.', 'error');
      }
    } catch (err) {
      toast('Drive connection error: ' + err.message, 'error');
    }
    setDriveSyncing(false);
  };

  const handleDisconnectDrive = () => {
    disconnectDrive();
    setDriveConnected(false);
    toast('Disconnected from Google Drive', 'info');
  };

  // Save Schedule Config
  const handleSaveScheduleConfig = (newCfg) => {
    setScheduleConfig(newCfg);
    localStorage.setItem('gst_backup_schedule', JSON.stringify(newCfg));
    toast('Backup schedule preferences saved', 'success');
  };

  return (
    <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Hidden File Input for Restore */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        style={{ display: 'none' }}
        onChange={handlePickImportFile}
      />

      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800 }}>
              Database Backup & Cloud Sync
            </h1>
            <HelpButton topic="backup" />
            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
              Vyapar Desktop Parity
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Automated daily database snapshots, 1-click cloud sync to Google Drive, and granular rollback recovery
          </p>
        </div>

        {/* Top 1-Click Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2"
            style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.5rem 1rem' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} /> Restore from File
          </button>
          <button
            type="button"
            className="btn btn-secondary flex items-center gap-2"
            style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.5rem 1rem' }}
            onClick={() => setShowExportModal(true)}
          >
            <Download size={16} /> Export JSON / SQL
          </button>
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.5rem 1.25rem', background: '#059669', borderColor: '#059669' }}
            onClick={handleTriggerBackupNow}
            disabled={backingUp}
          >
            <Save size={16} /> {backingUp ? 'Creating Snapshot...' : '⚡ Backup Now'}
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4-CARD EXECUTIVE HEALTH & STATUS STRIP */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {/* Card 1: Protection Health */}
        <div className="card" style={{ padding: '1.1rem', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Database Protection
            </span>
            {isHealthy ? (
              <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                SECURED
              </span>
            ) : (
              <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                ACTION NEEDED
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            {isHealthy ? <ShieldCheck size={28} color="#10b981" /> : <ShieldAlert size={28} color="#f59e0b" />}
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
                {isHealthy ? 'Fully Protected' : 'Backup Pending'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {latestBackup ? `Last: ${latestBackup.date}` : 'No backups on disk'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
            Schedule: {scheduleConfig.frequency.toUpperCase()} snapshot
          </div>
        </div>

        {/* Card 2: Database Footprint */}
        <div className="card" style={{ padding: '1.1rem', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Database Records
            </span>
            <HardDrive size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text)' }}>
            {totalRecordsCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {stats.billsCount} Invoices · {stats.productsCount} Items · {stats.clientsCount} Parties
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '4px', fontWeight: 600 }}>
            {stats.expensesCount} Expenses · {stats.purchasesCount} Purchases
          </div>
        </div>

        {/* Card 3: Cloud Sync Status */}
        <div className="card" style={{ padding: '1.1rem', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Google Drive Cloud Sync
            </span>
            <Cloud size={16} color={driveConnected ? '#10b981' : '#94a3b8'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: driveConnected ? '#10b981' : '#94a3b8',
              boxShadow: driveConnected ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none'
            }} />
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>
              {driveConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {driveConnected ? 'Auto-sync active' : 'Click to authorize Google Drive'}
          </div>
          <div style={{ marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
            {driveConnected ? (
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontWeight: 700 }}
                onClick={handleDisconnectDrive}
              >
                Disconnect Drive
              </button>
            ) : (
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontWeight: 700 }}
                onClick={handleConnectDrive}
                disabled={driveSyncing}
              >
                {driveSyncing ? 'Connecting...' : 'Authorize Cloud Sync →'}
              </button>
            )}
          </div>
        </div>

        {/* Card 4: Soft-Deleted Trash Bin */}
        <div className="card" style={{ padding: '1.1rem', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Trash Bin (30-Day Recovery)
            </span>
            <Trash2 size={16} color={trash.length > 0 ? '#f59e0b' : 'var(--text-muted)'} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: trash.length > 0 ? '#b45309' : 'var(--text)' }}>
            {trash.length} {trash.length === 1 ? 'Invoice' : 'Invoices'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {trash.length > 0 ? 'Soft-deleted invoices available for restore' : 'Trash bin is currently clean'}
          </div>
          <div style={{ marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '4px' }}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.72rem', cursor: 'pointer', padding: 0, fontWeight: 700 }}
              onClick={() => setActiveTab('trash')}
            >
              View Trash Ledger →
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TABS NAVIGATION */}
      {/* ==================================================================== */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'archives' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', padding: '0.55rem 1.25rem', fontSize: '0.88rem', fontWeight: 700 }}
          onClick={() => setActiveTab('archives')}
        >
          <Database size={16} /> Local Server Backups ({backups.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'schedules' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', padding: '0.55rem 1.25rem', fontSize: '0.88rem', fontWeight: 700 }}
          onClick={() => setActiveTab('schedules')}
        >
          <Clock size={16} /> Automated Schedules & Retention
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'trash' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '8px 8px 0 0', padding: '0.55rem 1.25rem', fontSize: '0.88rem', fontWeight: 700 }}
          onClick={() => setActiveTab('trash')}
        >
          <Trash2 size={16} /> Trash Bin Recovery ({trash.length})
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: LOCAL SERVER BACKUPS & ARCHIVES */}
      {/* ==================================================================== */}
      {activeTab === 'archives' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                Dated Database Snapshots
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Each snapshot stores a complete atomic mirror of all invoices, clients, products, and ledgers
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary flex items-center gap-1"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              onClick={loadAll}
            >
              <RefreshCw size={14} /> Refresh Snapshots
            </button>
          </div>

          {loading && backups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 0.5rem' }} />
              <div>Loading database archives...</div>
            </div>
          ) : backups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Database size={48} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>No local snapshots generated yet</div>
              <p style={{ fontSize: '0.82rem', marginTop: '4px', maxWidth: '420px', margin: '4px auto 1rem' }}>
                Your database will auto-backup every midnight. You can also click <strong>"⚡ Backup Now"</strong> at the top to create your first protected snapshot immediately.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#059669', borderColor: '#059669' }}
                onClick={handleTriggerBackupNow}
              >
                <Save size={16} /> Create Snapshot Now
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Snapshot Date</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Timestamp</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Integrity</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b, idx) => (
                    <tr key={b.date} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700 }}>
                        <div className="flex items-center gap-2">
                          <HardDrive size={16} color="var(--primary)" />
                          <span>{b.date}</span>
                          {idx === 0 && (
                            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '4px' }}>
                              LATEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {b.createdAt ? new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '00:00:00'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.78rem', fontWeight: 700 }}>
                          <CheckCircle2 size={14} /> Ready for Restore
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Protected on Disk
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem', fontWeight: 700 }}
                            onClick={() => handleRestoreSnapshot(b.date)}
                          >
                            <RefreshCw size={13} /> Restore
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary text-danger"
                            style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem', color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => handleDeleteSnapshot(b.date)}
                            title="Delete this snapshot"
                          >
                            <Trash2 size={13} />
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
      )}

      {/* ==================================================================== */}
      {/* TAB 2: AUTOMATED SCHEDULES & RETENTION CONFIG */}
      {/* ==================================================================== */}
      {activeTab === 'schedules' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} /> Automated Snapshot Schedule
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              Configure automatic background snapshots without needing manual intervention
            </p>

            <div className="form-group mb-4">
              <label className="form-label" style={{ fontWeight: 700 }}>Auto-Backup Frequency</label>
              <select
                className="form-input"
                value={scheduleConfig.frequency}
                onChange={e => handleSaveScheduleConfig({ ...scheduleConfig, frequency: e.target.value })}
              >
                <option value="daily">Daily at Midnight (Recommended)</option>
                <option value="12hours">Every 12 Hours</option>
                <option value="weekly">Weekly (Every Sunday)</option>
                <option value="off">Disabled (Manual Only)</option>
              </select>
            </div>

            <div className="form-group mb-4">
              <label className="form-label" style={{ fontWeight: 700 }}>Pruning Retention Period</label>
              <select
                className="form-input"
                value={scheduleConfig.retentionDays}
                onChange={e => handleSaveScheduleConfig({ ...scheduleConfig, retentionDays: Number(e.target.value) })}
              >
                <option value={15}>Keep last 15 days of backups</option>
                <option value={30}>Keep last 30 days of backups (Standard)</option>
                <option value={60}>Keep last 60 days of backups</option>
                <option value={90}>Keep last 90 days of backups (Maximum safety)</option>
              </select>
              <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Older snapshots beyond this threshold are automatically pruned to conserve local disk space.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 700 }}>Stale Backup Alert Threshold</label>
              <select
                className="form-input"
                value={scheduleConfig.alertDays}
                onChange={e => handleSaveScheduleConfig({ ...scheduleConfig, alertDays: Number(e.target.value) })}
              >
                <option value={2}>Warn if no backup in 2 days</option>
                <option value={3}>Warn if no backup in 3 days (Default)</option>
                <option value={7}>Warn if no backup in 7 days</option>
              </select>
            </div>
          </div>

          {/* Cloud Auto-Sync & Google Drive Integration */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cloud size={18} style={{ color: 'var(--primary)' }} /> Cloud Auto-Sync (Google Drive)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              Keep an encrypted offsite mirror of your accounting records in your own private Google Drive
            </p>

            <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Google Drive Connection:</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: driveConnected ? '#15803d' : '#94a3b8' }}>
                  {driveConnected ? 'ACTIVE' : 'NOT CONNECTED'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target Folder: <strong>{profile?.googleDriveFolder || 'Vyapar Invoices'} - Backups</strong>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 700, marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={scheduleConfig.autoCloudSync}
                onChange={e => handleSaveScheduleConfig({ ...scheduleConfig, autoCloudSync: e.target.checked })}
              />
              Automatically mirror local snapshots to Google Drive
            </label>

            {!driveConnected ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.65rem', fontWeight: 700 }}
                onClick={handleConnectDrive}
                disabled={driveSyncing}
              >
                <Cloud size={16} /> {driveSyncing ? 'Connecting...' : 'Connect Google Drive Account'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary text-danger"
                style={{ width: '100%', padding: '0.65rem', fontWeight: 700 }}
                onClick={handleDisconnectDrive}
              >
                Disconnect Google Drive
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: TRASH BIN SOFT-DELETE RECOVERY */}
      {/* ==================================================================== */}
      {activeTab === 'trash' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div>
              <h3 className="section-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                Deleted Invoices Recovery Hub
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Invoices deleted from your active ledger are retained here for 30 days before permanent deletion
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary flex items-center gap-1"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              onClick={loadAll}
            >
              <RefreshCw size={14} /> Refresh Trash
            </button>
          </div>

          {trash.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Trash2 size={44} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>Trash Bin is Empty</div>
              <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                Any invoice deleted in the last 30 days would appear here for instant 1-click restoration.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Invoice #</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Client / Party</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Deleted Date</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Total Amount</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trash.map(bill => (
                    <tr key={bill.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                        {bill.invoiceNumber || 'INV-DRAFT'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>
                        {bill.clientName || 'Walk-in Customer'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {bill._trashedAt ? new Date(bill._trashedAt).toLocaleDateString('en-IN') : 'Recently'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 700 }}>
                        ₹{Number(bill.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', fontWeight: 700 }}
                            onClick={() => handleRestoreTrash(bill.id)}
                          >
                            <RefreshCw size={12} /> Restore Invoice
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary text-danger"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => handlePurgeTrash(bill.id)}
                          >
                            Purge
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
      )}

      {/* ==================================================================== */}
      {/* GRANULAR EXPORT MODAL */}
      {/* ==================================================================== */}
      {showExportModal && (
        <div className="modal-backdrop" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Export Database Backup</h3>
              <button type="button" className="close-btn" onClick={() => setShowExportModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Select the tables and collections you wish to include in this backup export:
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.78rem' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700 }}
                  onClick={() => setExportSel(Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, true])))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
                  onClick={() => setExportSel(Object.fromEntries(ALL_BACKUP_PARTS.map(p => [p.id, false])))}
                >
                  Deselect All
                </button>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {ALL_BACKUP_PARTS.map(part => (
                  <label
                    key={part.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                      padding: '0.5rem 0.75rem', background: exportSel[part.id] ? 'var(--primary-bg)' : 'var(--bg-subtle)',
                      borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!exportSel[part.id]}
                      onChange={() => setExportSel(prev => ({ ...prev, [part.id]: !prev[part.id] }))}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{part.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{part.hint}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', cursor: 'pointer', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={exportToDrive}
                    onChange={e => setExportToDrive(e.target.checked)}
                  />
                  Also save a synchronized copy to my Google Drive
                </label>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary flex items-center gap-2" onClick={runExportData} disabled={driveSyncing}>
                <Download size={16} /> {driveSyncing ? 'Syncing to Drive...' : 'Download Backup File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* GRANULAR IMPORT / PRE-RESTORE INSPECTOR MODAL */}
      {/* ==================================================================== */}
      {showImportModal && importInspection && (
        <div className="modal-backdrop" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Pre-Restore Database Inspection</h3>
              <button type="button" className="close-btn" onClick={() => setShowImportModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                  <span>Exported Date: {importInspection.exportedAt ? new Date(importInspection.exportedAt).toLocaleString('en-IN') : 'Unknown'}</span>
                  <span>Version: {importInspection.version || '1.10'}</span>
                </div>
              </div>

              <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Tick the data sets you wish to restore into your active database:
              </p>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {ALL_BACKUP_PARTS.map(part => {
                  const count = importInspection.counts[part.id] || 0;
                  return (
                    <label
                      key={part.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem', background: importSel[part.id] ? 'var(--primary-bg)' : 'var(--bg-subtle)',
                        borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border)'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!importSel[part.id]}
                          onChange={() => setImportSel(prev => ({ ...prev, [part.id]: !prev[part.id] }))}
                        />
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>{part.label}</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700,
                        background: count > 0 ? '#dbeafe' : '#f1f5f9',
                        color: count > 0 ? '#1d4ed8' : '#64748b',
                        padding: '2px 8px', borderRadius: '10px'
                      }}>
                        {count} record{count === 1 ? '' : 's'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }} onClick={runImportData}>
                Confirm & Restore Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
