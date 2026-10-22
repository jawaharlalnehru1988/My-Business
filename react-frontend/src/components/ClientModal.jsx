import { useState, useEffect } from 'react';
import { X, Building2, IndianRupee, Sliders, ShieldAlert } from 'lucide-react';
import { getCountryConfig, getStatesForCountry, validateTaxId, detectCountryFromBrowser, getCountriesForRegion, PAPER_SIZES } from '../utils';
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

const PARTY_GROUPS = ['General', 'Wholesale', 'Retail', 'VIP', 'Distributor', 'Government / B2G'];

export default function ClientModal({ show, onClose, onSave, client, isEditing, defaultCountry }) {
  const fallbackCountry = defaultCountry || client?.country || 'India';
  const todayStr = new Date().toISOString().split('T')[0];

  const emptyForm = {
    name: '',
    phone: '',
    email: '',
    gstType: 'Unregistered/Consumer',
    gstin: '',
    panNumber: '',
    partyGroup: 'General',
    address: '',
    shippingAddress: '',
    city: '',
    pin: '',
    state: '',
    country: fallbackCountry,
    isSEZ: false,
    // Vyapar Credit & Balance tab fields
    openingBalanceAmount: '',
    openingBalanceType: 'to_receive', // 'to_receive' (positive) | 'to_pay' (negative)
    openingBalanceDate: todayStr,
    creditLimitEnabled: false,
    creditLimit: '',
    paymentReminderDays: 7,
    // Print preferences
    preferredPaperSize: '',
    preferredCurrency: '',
    autoPrint: false,
  };

  const [activeTab, setActiveTab] = useState('gst_address'); // 'gst_address' | 'credit_balance' | 'additional'
  const [showShipping, setShowShipping] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [taxIdWarning, setTaxIdWarning] = useState('');

  useEffect(() => {
    if (show && client) {
      const rawOpening = Number(client.openingBalance) || 0;
      setForm({
        name: client.name || '',
        phone: client.phone || '',
        email: client.email || '',
        gstType: client.gstType || (client.gstin ? 'Registered Business - Regular' : 'Unregistered/Consumer'),
        gstin: client.gstin || '',
        panNumber: client.panNumber || '',
        partyGroup: client.partyGroup || 'General',
        address: client.address || '',
        shippingAddress: client.shippingAddress || '',
        city: client.city || '',
        pin: client.pin || '',
        state: client.state || '',
        country: client.country || fallbackCountry,
        isSEZ: !!client.isSEZ,
        openingBalanceAmount: rawOpening !== 0 ? String(Math.abs(rawOpening)) : '',
        openingBalanceType: rawOpening < 0 ? 'to_pay' : 'to_receive',
        openingBalanceDate: client.openingBalanceDate || todayStr,
        creditLimitEnabled: !!client.creditLimitEnabled,
        creditLimit: client.creditLimit ? String(client.creditLimit) : '',
        paymentReminderDays: client.paymentReminderDays ?? 7,
        preferredPaperSize: client.preferredPaperSize || '',
        preferredCurrency: client.preferredCurrency || '',
        autoPrint: !!client.autoPrint,
      });
      setShowShipping(Boolean(client.shippingAddress));
    } else if (show) {
      setForm({ ...emptyForm });
      setShowShipping(false);
    }
    setActiveTab('gst_address');
    setTaxIdWarning('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, client]);

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
    const upper = val.toUpperCase();
    let nextState = form.state;
    let nextGstType = form.gstType;
    let nextPan = form.panNumber;

    if (upper.length >= 2 && form.country === 'India') {
      const code = upper.slice(0, 2);
      if (GST_STATE_MAP[code] && !form.state) {
        nextState = GST_STATE_MAP[code];
      }
      if (nextGstType === 'Unregistered/Consumer') {
        nextGstType = 'Registered Business - Regular';
      }
    }
    if (upper.length >= 12 && !form.panNumber) {
      nextPan = upper.slice(2, 12);
    }

    setForm(prev => ({
      ...prev,
      gstin: upper,
      state: nextState,
      gstType: nextGstType,
      panNumber: nextPan
    }));
    if (taxIdWarning) setTaxIdWarning('');
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const rawAmt = Math.abs(parseFloat(form.openingBalanceAmount) || 0);
    const signedOpeningBalance = form.openingBalanceType === 'to_pay' ? -rawAmt : rawAmt;

    const payload = {
      ...form,
      name: form.name.trim(),
      openingBalance: signedOpeningBalance,
      creditLimit: form.creditLimitEnabled ? (parseFloat(form.creditLimit) || 0) : 0,
    };
    onSave(payload);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '620px', borderRadius: '12px', padding: '1.4rem' }}>
        {/* Header */}
        <div className="flex justify-between items-center mb-3 pb-2" style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={20} style={{ color: '#2563eb' }} />
            <h3 className="section-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              {isEditing ? 'Edit Party / Customer' : 'Add Party / Customer'}
            </h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        {/* Top Row: Party Name, Phone, Party Group (Always visible like Vyapar) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>Party Name *</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Sri Raani Traders"
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
            <label className="form-label" style={{ fontWeight: 600 }}>Party Group</label>
            <select
              className="form-input"
              value={form.partyGroup}
              onChange={e => setForm(prev => ({ ...prev, partyGroup: e.target.value }))}
            >
              {PARTY_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Vyapar 3-Tab Navigation Bar */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem', gap: '0.25rem' }}>
          {[
            { id: 'gst_address', label: 'GST & Address', icon: Building2 },
            { id: 'credit_balance', label: 'Credit & Balance', icon: IndianRupee },
            { id: 'additional', label: 'Additional & Print', icon: Sliders },
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
                <option value="Unregistered/Consumer">Unregistered / Consumer</option>
                <option value="Registered Business - Regular">Registered Business - Regular</option>
                <option value="Registered Business - Composition">Registered Business - Composition</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{cc.taxIdLabel}</label>
              <input
                type="text"
                className="form-input"
                style={taxIdWarning ? { borderColor: '#f59e0b', fontFamily: 'monospace' } : { fontFamily: 'monospace' }}
                value={form.gstin}
                onChange={e => handleGstinChange(e.target.value)}
                onBlur={handleTaxIdBlur}
                placeholder={cc.taxIdPlaceholder}
                maxLength={20}
              />
              {taxIdWarning && <small style={{ color: '#d97706', fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>⚠ {taxIdWarning}</small>}
            </div>

            <div className="form-group">
              <label className="form-label">Country</label>
              <select
                className="form-input"
                value={form.country || 'India'}
                onChange={e => setForm(prev => ({ ...prev, country: e.target.value, state: '' }))}
              >
                {(() => {
                  const visible = getCountriesForRegion(getRegionMode());
                  const out = [];
                  if (form.country && !visible.some(c => c.name === form.country)) {
                    out.push(<option key={form.country} value={form.country}>{form.country}</option>);
                  }
                  visible.forEach(c => out.push(<option key={c.code} value={c.name}>{c.name}</option>));
                  return out;
                })()}
              </select>
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
              <label className="form-label">Email ID</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="party@example.com" />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0 }}>Billing Address</label>
                <button
                  type="button"
                  onClick={() => setShowShipping(prev => !prev)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {showShipping ? '− Hide Shipping Address' : '+ Enable Shipping Address'}
                </button>
              </div>
              <textarea
                rows={2}
                className="form-input"
                style={{ marginTop: '4px' }}
                value={form.address}
                onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Street address, building, locality"
              />
            </div>

            {showShipping && (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Shipping / Delivery Address</label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={form.shippingAddress}
                  onChange={e => setForm(prev => ({ ...prev, shippingAddress: e.target.value }))}
                  placeholder="Warehouse / delivery address if different from billing"
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

            {form.country === 'India' && (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!form.isSEZ}
                    onChange={e => setForm(prev => ({ ...prev, isSEZ: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}
                  />
                  <span><strong>SEZ Unit / Developer</strong> — supplies attract IGST regardless of state.</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREDIT & BALANCE (Vyapar Signature Tab) */}
        {activeTab === 'credit_balance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
            {/* Opening Balance Section */}
            <div style={{ padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.65rem' }}>
                Opening Balance
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Amount (₹)</label>
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

              {/* To Receive vs To Pay Radio Toggle */}
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#15803d' }}>
                  <input
                    type="radio"
                    name="openingBalanceType"
                    checked={form.openingBalanceType === 'to_receive'}
                    onChange={() => setForm(prev => ({ ...prev, openingBalanceType: 'to_receive' }))}
                  />
                  <span>To Receive (Customer owes you)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#dc2626' }}>
                  <input
                    type="radio"
                    name="openingBalanceType"
                    checked={form.openingBalanceType === 'to_pay'}
                    onChange={() => setForm(prev => ({ ...prev, openingBalanceType: 'to_pay' }))}
                  />
                  <span>To Pay (Advance / You owe party)</span>
                </label>
              </div>
            </div>

            {/* Credit Limit Section */}
            <div style={{ padding: '1rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  <ShieldAlert size={16} style={{ color: '#d97706' }} /> Credit Limit Alert
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
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Maximum Credit Allowed (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 50000"
                    value={form.creditLimit}
                    onChange={e => setForm(prev => ({ ...prev, creditLimit: e.target.value }))}
                  />
                  <small style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '4px' }}>
                    Highlights an alert badge in the Parties Hub whenever this party&apos;s receivable exceeds this limit.
                  </small>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ADDITIONAL & PRINT PREFERENCES */}
        {activeTab === 'additional' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">PAN Number</label>
              <input
                type="text"
                className="form-input"
                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                maxLength={10}
                value={form.panNumber}
                onChange={e => setForm(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                placeholder="ABCDE1234F"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Country</label>
              <select className="form-input" value={form.country} onChange={e => setForm(prev => ({ ...prev, country: e.target.value, state: '' }))}>
                {(() => {
                  const visible = getCountriesForRegion(getRegionMode());
                  const out = [];
                  if (form.country && !visible.some(c => c.name === form.country)) {
                    out.push(<option key={form.country} value={form.country}>{form.country}</option>);
                  }
                  return out.concat(visible.map(c => <option key={c.code} value={c.name}>{c.name}</option>));
                })()}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Paper Size</label>
              <select
                className="form-input"
                value={form.preferredPaperSize}
                onChange={e => setForm(prev => ({ ...prev, preferredPaperSize: e.target.value }))}
              >
                <option value="">Use app default</option>
                {Object.entries(PAPER_SIZES).map(([key, ps]) => (
                  <option key={key} value={key}>{ps.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Currency</label>
              <select
                className="form-input"
                value={form.preferredCurrency}
                onChange={e => setForm(prev => ({ ...prev, preferredCurrency: e.target.value }))}
              >
                <option value="">Use invoice default</option>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!form.autoPrint}
                  onChange={e => setForm(prev => ({ ...prev, autoPrint: e.target.checked }))}
                  style={{ width: 15, height: 15, accentColor: 'var(--primary)' }}
                />
                <span><strong>Auto-print on save for this party</strong> — overrides global setting</span>
              </label>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-2 justify-end mt-4 pt-3" style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>
            {isEditing ? 'Update Party' : 'Save Party'}
          </button>
        </div>
      </div>
    </div>
  );
}
