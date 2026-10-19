import { useState, useEffect } from 'react';
import { X, Building2, CreditCard, IndianRupee, ShieldAlert } from 'lucide-react';
import { getCountryConfig, getStatesForCountry, validateTaxId, detectCountryFromBrowser, getCountriesForRegion } from '../utils';
import { getRegionMode } from '../store';

const GST_STATE_MAP = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh'
};

const PARTY_GROUPS = ['General', 'Raw Material Vendor', 'Wholesale Distributor', 'Manufacturer', 'Logistics / Transport', 'Services'];

export default function SupplierModal({ show = true, onClose, onSave, supplier, isEditing, defaultCountry }) {
  const fallbackCountry = defaultCountry || detectCountryFromBrowser();
  const todayStr = new Date().toISOString().split('T')[0];

  const emptyForm = {
    name: '',
    phone: '',
    email: '',
    gstType: 'Registered Business - Regular',
    gstin: '',
    partyGroup: 'General',
    address: '',
    shippingAddress: '',
    city: '',
    state: '',
    pin: '',
    country: fallbackCountry,
    // Credit & Balance
    openingBalanceAmount: '',
    openingBalanceType: 'to_pay', // 'to_pay' (positive payable to supplier) | 'to_receive' (negative advance)
    openingBalanceDate: todayStr,
    creditLimitEnabled: false,
    creditLimit: '',
    // Bank & Payout Details
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    notes: ''
  };

  const [activeTab, setActiveTab] = useState('gst_address'); // 'gst_address' | 'credit_balance' | 'bank_details'
  const [showShipping, setShowShipping] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [taxIdWarning, setTaxIdWarning] = useState('');

  useEffect(() => {
    if (show && supplier) {
      const rawOpening = Number(supplier.openingBalance) || 0;
      setForm({
        name: supplier.name || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        gstType: supplier.gstType || (supplier.gstin ? 'Registered Business - Regular' : 'Unregistered/Consumer'),
        gstin: supplier.gstin || '',
        partyGroup: supplier.partyGroup || 'General',
        address: supplier.address || '',
        shippingAddress: supplier.shippingAddress || '',
        city: supplier.city || '',
        state: supplier.state || '',
        pin: supplier.pin || '',
        country: supplier.country || fallbackCountry,
        openingBalanceAmount: rawOpening !== 0 ? String(Math.abs(rawOpening)) : '',
        openingBalanceType: rawOpening < 0 ? 'to_receive' : 'to_pay',
        openingBalanceDate: supplier.openingBalanceDate || todayStr,
        creditLimitEnabled: !!supplier.creditLimitEnabled,
        creditLimit: supplier.creditLimit ? String(supplier.creditLimit) : '',
        bankName: supplier.bankName || '',
        accountNumber: supplier.accountNumber || '',
        ifscCode: supplier.ifscCode || '',
        upiId: supplier.upiId || '',
        notes: supplier.notes || '',
      });
      setShowShipping(Boolean(supplier.shippingAddress));
    } else if (show) {
      setForm({ ...emptyForm });
      setShowShipping(false);
    }
    setActiveTab('gst_address');
    setTaxIdWarning('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, supplier]);

  if (!show) return null;

  const cc = getCountryConfig(form.country);
  const stateOptions = getStatesForCountry(form.country);

  const handleTaxIdBlur = () => {
    if (!form.gstin) {
      setTaxIdWarning('');
      return;
    }
    const result = validateTaxId(form.country, form.gstin);
    setTaxIdWarning(result.ok ? '' : result.message);
  };

  const handleGstinChange = (val) => {
    const uppercaseVal = val.toUpperCase();
    let updatedState = form.state;
    let updatedGstType = form.gstType;

    if (form.country === 'India' && uppercaseVal.length >= 2) {
      const stateCode = uppercaseVal.slice(0, 2);
      if (GST_STATE_MAP[stateCode] && !form.state) {
        updatedState = GST_STATE_MAP[stateCode];
      }
      if (updatedGstType === 'Unregistered/Consumer') {
        updatedGstType = 'Registered Business - Regular';
      }
    }

    setForm(prev => ({ ...prev, gstin: uppercaseVal, state: updatedState, gstType: updatedGstType }));
    if (taxIdWarning) setTaxIdWarning('');
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const rawAmt = Math.abs(parseFloat(form.openingBalanceAmount) || 0);
    // For suppliers, positive openingBalance = To Pay (we owe supplier), negative = To Receive (advance paid to supplier)
    const signedOpening = form.openingBalanceType === 'to_receive' ? -rawAmt : rawAmt;

    onSave({
      ...form,
      name: form.name.trim(),
      openingBalance: signedOpening,
      creditLimit: form.creditLimitEnabled ? (parseFloat(form.creditLimit) || 0) : 0,
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '620px', borderRadius: '12px', padding: '1.4rem' }}>
        <div className="flex justify-between items-center mb-3 pb-2" style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
          <div className="flex items-center gap-2">
            <Building2 className="text-primary" size={21} style={{ color: '#2563eb' }} />
            <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              {isEditing ? 'Edit Supplier / Party' : 'Add New Supplier / Party'}
            </h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        {/* Top Row: Supplier Name, Phone, Party Group */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Supplier / Business Name *</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Haleem Dry Fruits"
              autoFocus
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Phone Number</label>
            <input
              type="tel"
              className="form-input"
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="9876543210"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Category / Group</label>
            <select
              className="form-input"
              value={form.partyGroup}
              onChange={e => setForm(prev => ({ ...prev, partyGroup: e.target.value }))}
            >
              {PARTY_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Vyapar 3-Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem', gap: '0.25rem' }}>
          {[
            { id: 'gst_address', label: 'GST & Address', icon: Building2 },
            { id: 'credit_balance', label: 'Credit & Balance', icon: IndianRupee },
            { id: 'bank_details', label: 'Bank & Payout Info', icon: CreditCard },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: active ? 700 : 600,
                  color: active ? '#2563eb' : '#64748b',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  marginBottom: '-2px',
                  cursor: 'pointer'
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: GST & ADDRESS */}
        {activeTab === 'gst_address' && (
          <div className="grid grid-cols-2 gap-3" style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
            <div className="form-group">
              <label className="form-label">GST Type</label>
              <select
                className="form-input"
                value={form.gstType}
                onChange={e => setForm(prev => ({ ...prev, gstType: e.target.value }))}
              >
                <option value="Registered Business - Regular">Registered Business - Regular</option>
                <option value="Registered Business - Composition">Registered Business - Composition</option>
                <option value="Unregistered/Consumer">Unregistered / Non-GST Vendor</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{cc.taxIdLabel} (15-digit GSTIN)</label>
              <input
                type="text"
                className="form-input"
                style={taxIdWarning ? { borderColor: '#f59e0b', fontFamily: 'monospace' } : { fontFamily: 'monospace' }}
                value={form.gstin}
                onChange={e => handleGstinChange(e.target.value)}
                onBlur={handleTaxIdBlur}
                placeholder="33AAAAA0000A1Z5"
                maxLength={20}
              />
              {taxIdWarning && <small style={{ color: '#d97706', fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>⚠ {taxIdWarning}</small>}
            </div>

            <div className="form-group">
              <label className="form-label">{cc.stateLabel}</label>
              {stateOptions.length > 0 ? (
                <select className="form-input" value={form.state} onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}>
                  <option value="">Select {cc.stateLabel}</option>
                  {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input type="text" className="form-input" value={form.state} onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))} placeholder={cc.stateLabel} />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="supplier@example.com" />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0 }}>Billing Address</label>
                <button
                  type="button"
                  onClick={() => setShowShipping(prev => !prev)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {showShipping ? '− Hide Dispatch Address' : '+ Add Dispatch / Warehouse Address'}
                </button>
              </div>
              <textarea
                rows={2}
                className="form-input"
                style={{ marginTop: '4px' }}
                value={form.address}
                onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Building, street address, market"
              />
            </div>

            {showShipping && (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Dispatch / Warehouse Address</label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={form.shippingAddress}
                  onChange={e => setForm(prev => ({ ...prev, shippingAddress: e.target.value }))}
                  placeholder="Godown / dispatch address"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" className="form-input" value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} placeholder="e.g. Chennai" />
            </div>

            <div className="form-group">
              <label className="form-label">{cc.postalLabel}</label>
              <input type="text" className="form-input" value={form.pin} onChange={e => setForm(prev => ({ ...prev, pin: e.target.value }))} placeholder={cc.postalLabel} />
            </div>
          </div>
        )}

        {/* TAB 2: CREDIT & BALANCE */}
        {activeTab === 'credit_balance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
            <div style={{ padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.65rem' }}>
                Opening Balance
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Opening Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="form-input"
                    placeholder="0.00"
                    value={form.openingBalanceAmount}
                    onChange={e => setForm(prev => ({ ...prev, openingBalanceAmount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>As of Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.openingBalanceDate}
                    onChange={e => setForm(prev => ({ ...prev, openingBalanceDate: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#dc2626' }}>
                  <input
                    type="radio"
                    name="supOpeningType"
                    checked={form.openingBalanceType === 'to_pay'}
                    onChange={() => setForm(prev => ({ ...prev, openingBalanceType: 'to_pay' }))}
                  />
                  <span>To Pay (You owe supplier)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#15803d' }}>
                  <input
                    type="radio"
                    name="supOpeningType"
                    checked={form.openingBalanceType === 'to_receive'}
                    onChange={() => setForm(prev => ({ ...prev, openingBalanceType: 'to_receive' }))}
                  />
                  <span>To Receive (Advance paid to supplier)</span>
                </label>
              </div>
            </div>

            <div style={{ padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  <ShieldAlert size={16} style={{ color: '#d97706' }} /> Credit Limit from Supplier
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', fontWeight: 600 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={!form.creditLimitEnabled}
                      onChange={() => setForm(prev => ({ ...prev, creditLimitEnabled: false }))}
                    />
                    No Limit
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#2563eb' }}>
                    <input
                      type="radio"
                      checked={!!form.creditLimitEnabled}
                      onChange={() => setForm(prev => ({ ...prev, creditLimitEnabled: true }))}
                    />
                    Custom Limit
                  </label>
                </div>
              </div>

              {form.creditLimitEnabled && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Credit Limit Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 100000"
                    value={form.creditLimit}
                    onChange={e => setForm(prev => ({ ...prev, creditLimit: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BANK & PAYOUT DETAILS */}
        {activeTab === 'bank_details' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Bank Name</label>
              <input type="text" className="form-input" value={form.bankName}
                onChange={e => setForm(prev => ({ ...prev, bankName: e.target.value }))} placeholder="e.g. HDFC Bank / SBI" />
            </div>
            <div className="form-group">
              <label className="form-label">Account Number</label>
              <input type="text" className="form-input" value={form.accountNumber}
                onChange={e => setForm(prev => ({ ...prev, accountNumber: e.target.value }))} placeholder="Account No." />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input type="text" className="form-input" style={{ textTransform: 'uppercase', fontFamily: 'monospace' }} value={form.ifscCode}
                onChange={e => setForm(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))} placeholder="HDFC0001234" />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier UPI ID</label>
              <input type="text" className="form-input" value={form.upiId}
                onChange={e => setForm(prev => ({ ...prev, upiId: e.target.value }))} placeholder="vendor@okaxis" />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Notes / Payment Terms</label>
              <input type="text" className="form-input" value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g. Net 30 days, preferred dry fruits wholesaler" />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4 pt-3" style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>
            {isEditing ? 'Update Supplier' : 'Save Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}
