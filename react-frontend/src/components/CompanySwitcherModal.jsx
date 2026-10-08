import { useState, useMemo } from 'react';
import {
  Building2, Plus, Check, ChevronRight, X, Settings,
  Trash2, ShieldCheck, MapPin, Phone, Mail, Sparkles,
  ExternalLink, Search
} from 'lucide-react';
import { saveBusinessProfile, deleteBusinessProfile, saveProfile } from '../store';
import { INDIAN_STATES, formatCurrency } from '../utils';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';

const emptyNewCompanyForm = {
  businessName: '',
  tradeName: '',
  gstin: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: 'Tamil Nadu',
  pin: '',
  country: 'India',
  currency: 'INR',
};

export default function CompanySwitcherModal({
  isOpen,
  onClose,
  profile,
  allProfiles = [],
  onSwitchProfile,
  onProfilesUpdated,
  onOpenSettings
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...emptyNewCompanyForm });
  const [saving, setSaving] = useState(false);

  // Compute merged list of companies
  const companyList = useMemo(() => {
    const list = [...allProfiles];
    // If active profile is not present in allProfiles, include it
    if (profile?.businessName) {
      const exists = list.some(
        p => (p.businessName || '').trim().toLowerCase() === (profile.businessName || '').trim().toLowerCase()
      );
      if (!exists) {
        list.unshift({ ...profile, id: profile.id || 'primary-active' });
      }
    }
    return list;
  }, [allProfiles, profile]);

  // Filtered list
  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companyList;
    const q = search.toLowerCase();
    return companyList.filter(c =>
      (c.businessName || '').toLowerCase().includes(q) ||
      (c.gstin || '').toLowerCase().includes(q) ||
      (c.state || '').toLowerCase().includes(q)
    );
  }, [companyList, search]);

  if (!isOpen) return null;

  const handleSelectCompany = async (targetCompany) => {
    const isCurrent = (targetCompany.businessName || '').trim().toLowerCase() === (profile?.businessName || '').trim().toLowerCase();
    if (isCurrent) {
      onClose();
      return;
    }

    try {
      if (onSwitchProfile) {
        await onSwitchProfile(targetCompany);
      } else {
        const loaded = { ...targetCompany };
        delete loaded.id;
        await saveProfile(loaded);
      }
      toast(`Switched active firm to "${targetCompany.businessName}"`, 'success');
      onClose();
    } catch {
      toast('Failed to switch business profile', 'error');
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      toast('Business Name is required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const newFirm = {
        id: `profile-${Date.now()}`,
        businessName: form.businessName.trim(),
        tradeName: form.tradeName.trim(),
        gstin: form.gstin.trim().toUpperCase(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pin: form.pin.trim(),
        country: form.country || 'India',
        currency: form.currency || 'INR',
        createdAt: new Date().toISOString()
      };

      // Save to persistent multi-profiles store
      await saveBusinessProfile(newFirm);

      // Automatically switch to this newly created company
      if (onSwitchProfile) {
        await onSwitchProfile(newFirm);
      } else {
        await saveProfile(newFirm);
      }

      if (onProfilesUpdated) {
        await onProfilesUpdated();
      }

      toast(`Company "${newFirm.businessName}" created and activated!`, 'success');
      setShowAddForm(false);
      setForm({ ...emptyNewCompanyForm });
      onClose();
    } catch {
      toast('Failed to create new company profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async (e, comp) => {
    e.stopPropagation();
    const isCurrent = (comp.businessName || '').trim().toLowerCase() === (profile?.businessName || '').trim().toLowerCase();
    if (isCurrent && companyList.length <= 1) {
      toast('Cannot remove the only existing business profile.', 'warning');
      return;
    }

    const ok = await confirmAction({
      title: 'Remove Sister Firm?',
      message: `Are you sure you want to remove "${comp.businessName}" from your switchable profiles? Invoices created under this firm remain safe.`,
      confirmLabel: 'Remove Firm',
      tone: 'danger'
    });

    if (!ok) return;

    try {
      if (comp.id) {
        await deleteBusinessProfile(comp.id);
      }
      if (onProfilesUpdated) {
        await onProfilesUpdated();
      }
      toast(`Removed firm "${comp.businessName}"`, 'info');
    } catch {
      toast('Failed to delete firm profile', 'error');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '4.5rem',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.1rem 1.4rem',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                Switch Company / Firm
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                {companyList.length} registered business profile{companyList.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => {
                onClose();
                if (onOpenSettings) onOpenSettings();
              }}
              className="icon-btn"
              title="Manage Company Settings"
              style={{ padding: '0.4rem', borderRadius: '6px' }}
            >
              <Settings size={17} />
            </button>
            <button
              onClick={onClose}
              className="icon-btn"
              title="Close"
              style={{ padding: '0.4rem', borderRadius: '6px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Search Bar (if > 2 companies) */}
          {companyList.length > 2 && !showAddForm && (
            <div className="search-box" style={{ width: '100%' }}>
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search firm by name, GSTIN, or state..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
                autoFocus
              />
              {search && (
                <button className="icon-btn" onClick={() => setSearch('')}>
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Companies List */}
          {!showAddForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredCompanies.map((comp, idx) => {
                const isCurrent = (comp.businessName || '').trim().toLowerCase() === (profile?.businessName || '').trim().toLowerCase();
                return (
                  <div
                    key={comp.id || idx}
                    onClick={() => handleSelectCompany(comp)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.9rem 1.1rem',
                      borderRadius: '10px',
                      border: '1.5px solid ' + (isCurrent ? '#2563eb' : 'var(--border-color, #e5e7eb)'),
                      background: isCurrent ? '#eff6ff' : 'var(--card-bg, #ffffff)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isCurrent ? '0 2px 6px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: isCurrent ? '#2563eb' : 'var(--bg-secondary, #f3f4f6)',
                        color: isCurrent ? '#ffffff' : 'var(--text-secondary, #4b5563)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        flexShrink: 0
                      }}>
                        {comp.businessName ? comp.businessName.charAt(0).toUpperCase() : 'B'}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isCurrent ? '#1e40af' : 'var(--text-primary, #0f172a)' }}>
                            {comp.businessName}
                          </span>
                          {isCurrent && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: '#2563eb',
                              color: '#ffffff'
                            }}>
                              <Check size={11} /> Active
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '3px', flexWrap: 'wrap' }}>
                          {comp.gstin ? (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>
                              GSTIN: <span style={{ fontFamily: 'monospace' }}>{comp.gstin}</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Non-GST / Unregistered</span>
                          )}
                          {comp.state && (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                              • {comp.state}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {!isCurrent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCompany(comp);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 600 }}
                        >
                          Switch
                        </button>
                      )}

                      {!isCurrent && (
                        <button
                          onClick={(e) => handleDeleteCompany(e, comp)}
                          className="icon-btn text-danger"
                          title="Remove firm"
                          style={{ padding: '0.35rem' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add New Company Form */}
          {showAddForm && (
            <form onSubmit={handleCreateCompany} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{
                background: '#f8fafc',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1e293b' }}>Enter Sister Firm Details</span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.78rem' }}
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="form-label">Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Agro Traders"
                  value={form.businessName}
                  onChange={e => setForm(prev => ({ ...prev, businessName: e.target.value }))}
                  className="form-input"
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    value={form.gstin}
                    onChange={e => setForm(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">State</label>
                  <select
                    value={form.state}
                    onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}
                    className="form-input"
                  >
                    {INDIAN_STATES.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    placeholder="billing@business.com"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Address & City</label>
                <textarea
                  rows={2}
                  placeholder="Shop #12, Market Road, City, PIN"
                  value={form.address}
                  onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={15} /> {saving ? 'Creating Firm...' : 'Create & Switch Now'}
                </button>
              </div>
            </form>
          )}

          {/* Toggle Add Company Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn btn-secondary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.6rem',
                fontSize: '0.84rem',
                fontWeight: 600,
                borderStyle: 'dashed'
              }}
            >
              <Plus size={16} /> + Add Another Company / Sister Firm
            </button>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '0.85rem 1.4rem',
          borderTop: '1px solid var(--border-color, #e5e7eb)',
          background: 'var(--bg-secondary, #f8fafc)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Each firm maintains its own invoices, GSTIN, and letterhead.
          </span>
          <button
            onClick={() => {
              onClose();
              if (onOpenSettings) onOpenSettings();
            }}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Settings size={14} /> Full Company Settings
          </button>
        </div>

      </div>
    </div>
  );
}
