import { useState, useEffect, useMemo } from 'react';
import { Building2, Search, Plus, Edit3, Trash2, Phone, Mail, MapPin, CreditCard, Download, Upload, ChevronDown, ChevronUp, FileText, CheckCircle2 } from 'lucide-react';
import HelpButton from './HelpButton';
import { getAllSuppliers, saveSupplier, deleteSupplier, getAllPurchases, getProfile } from '../store';
import { formatCurrency } from '../utils';
import { confirmAction } from './ConfirmModal';
import { toast } from './Toast';
import SupplierModal from './SupplierModal';

export default function SuppliersView({ onNewPurchase }) {
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSupplier, setModalSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState(null);
  const [profileCountry, setProfileCountry] = useState('');

  useEffect(() => {
    getProfile().then(p => { if (p?.country) setProfileCountry(p.country); }).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const [s, p] = await Promise.all([getAllSuppliers(), getAllPurchases()]);
      setSuppliers(Array.isArray(s) ? s : []);
      setPurchases(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error(err);
      toast('Failed to load suppliers data', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.gstin || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      (s.state || '').toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const supplierStats = useMemo(() => {
    const totalCount = suppliers.length;
    const gstRegistered = suppliers.filter(s => s.gstin && s.gstin.trim().length >= 10).length;

    // Calculate total purchases and unpaid balances per supplier
    let totalPurchasesAmount = 0;
    let totalUnpaidPayable = 0;

    purchases.forEach(p => {
      const amt = Number(p.totalAmount) || 0;
      totalPurchasesAmount += amt;
      if (p.paymentStatus === 'unpaid') {
        totalUnpaidPayable += amt;
      } else if (p.paymentStatus === 'partial') {
        totalUnpaidPayable += amt / 2; // approximation if partial
      }
    });

    return { totalCount, gstRegistered, totalPurchasesAmount, totalUnpaidPayable };
  }, [suppliers, purchases]);

  const getSupplierPurchases = (supplierName, supplierGstin) => {
    return purchases.filter(p => {
      if (supplierGstin && p.supplierGstin) {
        return p.supplierGstin.toUpperCase() === supplierGstin.toUpperCase();
      }
      return (p.supplierName || '').trim().toLowerCase() === (supplierName || '').trim().toLowerCase();
    });
  };

  const handleAddSupplier = () => {
    setModalSupplier(null);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEditSupplier = (supplier) => {
    setModalSupplier(supplier);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSaveSupplier = async (formData) => {
    try {
      const payload = isEditing && modalSupplier?.id ? { ...formData, id: modalSupplier.id } : formData;
      await saveSupplier(payload);
      toast(isEditing ? 'Supplier updated successfully' : 'Supplier added successfully', 'success');
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      toast('Failed to save supplier', 'error');
    }
  };

  const handleDeleteSupplier = async (id, name) => {
    const confirmed = await confirmAction({
      title: 'Delete Supplier',
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) return;

    try {
      await deleteSupplier(id);
      toast('Supplier deleted', 'info');
      loadData();
    } catch (err) {
      console.error(err);
      toast('Failed to delete supplier', 'error');
    }
  };

  const exportSuppliersCSV = () => {
    if (suppliers.length === 0) {
      toast('No suppliers to export', 'warning');
      return;
    }
    const headers = ['Name', 'GSTIN', 'Phone', 'Email', 'Address', 'City', 'State', 'PIN', 'Country', 'Bank Name', 'Account No', 'IFSC', 'Notes'];
    const rows = suppliers.map(s => [
      s.name, s.gstin, s.phone, s.email, s.address, s.city, s.state, s.pin, s.country,
      s.bankName, s.accountNumber, s.ifscCode, s.notes
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `suppliers_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Suppliers exported to CSV', 'success');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title" style={{ margin: 0 }}>Suppliers & Vendors</h1>
            <HelpButton topic="suppliers" />
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Manage supplier directory, GSTIN details, and track purchase histories
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary flex items-center gap-1" onClick={exportSuppliersCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn btn-primary flex items-center gap-1" onClick={handleAddSupplier}>
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="card" style={{ padding: '1rem', background: 'var(--card-bg)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Suppliers</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>{supplierStats.totalCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem', background: 'var(--card-bg)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>GST Registered</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>{supplierStats.gstRegistered}</div>
        </div>
        <div className="card" style={{ padding: '1rem', background: 'var(--card-bg)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Purchases</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>{formatCurrency(supplierStats.totalPurchasesAmount)}</div>
        </div>
        <div className="card" style={{ padding: '1rem', background: 'var(--card-bg)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Payable</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>{formatCurrency(supplierStats.totalUnpaidPayable)}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card mb-4" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search suppliers by name, GSTIN, phone, or city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Suppliers Table / List */}
      {filteredSuppliers.length === 0 ? (
        <div className="card text-center" style={{ padding: '3rem 1rem' }}>
          <Building2 size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <h3>No suppliers found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            {search ? 'No supplier matching your search criteria.' : 'Add your first supplier to start tracking purchases and GSTIN information.'}
          </p>
          {!search && (
            <button className="btn btn-primary" onClick={handleAddSupplier}>
              <Plus size={16} /> Add First Supplier
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Supplier Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>GSTIN</th>
                <th style={{ padding: '0.75rem 1rem' }}>Contact</th>
                <th style={{ padding: '0.75rem 1rem' }}>Location</th>
                <th style={{ padding: '0.75rem 1rem' }}>Bills & Purchases</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(supplier => {
                const sPurchases = getSupplierPurchases(supplier.name, supplier.gstin);
                const sTotalPurchases = sPurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
                const isExpanded = expandedSupplier === supplier.id;

                return (
                  <>
                    <tr key={supplier.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>{supplier.name}</div>
                        {supplier.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{supplier.notes}</div>}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {supplier.gstin ? (
                          <span style={{
                            display: 'inline-block',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            border: '1px solid #bfdbfe'
                          }}>
                            {supplier.gstin}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Unregistered</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {supplier.phone && (
                          <div style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                        {supplier.email && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Mail size={13} />
                            <span>{supplier.email}</span>
                          </div>
                        )}
                        {!supplier.phone && !supplier.email && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                        {supplier.city || supplier.state ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                            <span>{[supplier.city, supplier.state].filter(Boolean).join(', ')}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{formatCurrency(sTotalPurchases)}</div>
                        <button
                          type="button"
                          style={{
                            background: 'none', border: 'none', color: 'var(--primary)',
                            fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginTop: 2,
                            display: 'flex', alignItems: 'center', gap: 2
                          }}
                          onClick={() => setExpandedSupplier(isExpanded ? null : supplier.id)}
                        >
                          <span>{sPurchases.length} bill{sPurchases.length === 1 ? '' : 's'}</span>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit Supplier"
                            onClick={() => handleEditSupplier(supplier)}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn text-danger"
                            title="Delete Supplier"
                            onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Purchase Bills Drawer */}
                    {isExpanded && (
                      <tr key={`exp-${supplier.id}`} style={{ background: 'var(--bg-subtle)' }}>
                        <td colSpan={6} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Purchase History for {supplier.name}</span>
                            {onNewPurchase && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={() => onNewPurchase(supplier)}
                              >
                                + New Purchase Bill
                              </button>
                            )}
                          </div>

                          {sPurchases.length === 0 ? (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              No purchase bills recorded for this supplier yet.
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gap: '0.4rem' }}>
                              {sPurchases.map(p => (
                                <div key={p.id} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  background: 'var(--card-bg)', padding: '0.5rem 0.75rem', borderRadius: '6px',
                                  fontSize: '0.82rem', border: '1px solid var(--border)'
                                }}>
                                  <div>
                                    <span style={{ fontWeight: 600, marginRight: '0.75rem' }}>Inv #{p.invoiceNumber || p.id}</span>
                                    <span style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }}>{p.date}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{
                                      padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700,
                                      background: p.paymentStatus === 'paid' ? '#ecfdf5' : '#fffbeb',
                                      color: p.paymentStatus === 'paid' ? '#059669' : '#d97706'
                                    }}>
                                      {p.paymentStatus || 'unpaid'}
                                    </span>
                                    <span style={{ fontWeight: 700 }}>{formatCurrency(p.totalAmount)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Supplier Modal */}
      <SupplierModal
        show={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveSupplier}
        supplier={modalSupplier}
        isEditing={isEditing}
        defaultCountry={profileCountry}
      />
    </div>
  );
}
