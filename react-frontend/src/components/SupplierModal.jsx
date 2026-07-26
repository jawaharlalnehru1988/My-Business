import { useState, useEffect } from 'react';
import { X, Building2, CreditCard, FileText } from 'lucide-react';
import { getCountryConfig, getStatesForCountry, validateTaxId, detectCountryFromBrowser, getCountriesForRegion } from '../utils';
import { getRegionMode } from '../store';

export default function SupplierModal({ show, onClose, onSave, supplier, isEditing, defaultCountry }) {
  const fallbackCountry = defaultCountry || detectCountryFromBrowser();
  const emptyForm = {
    name: '', gstin: '', phone: '', email: '',
    address: '', city: '', state: '', pin: '', country: fallbackCountry,
    bankName: '', accountNumber: '', ifscCode: '', notes: ''
  };

  const [form, setForm] = useState({ ...emptyForm });
  const [taxIdWarning, setTaxIdWarning] = useState('');

  useEffect(() => {
    if (show && supplier) {
      setForm({
        name: supplier.name || '',
        gstin: supplier.gstin || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        city: supplier.city || '',
        state: supplier.state || '',
        pin: supplier.pin || '',
        country: supplier.country || fallbackCountry,
        bankName: supplier.bankName || '',
        accountNumber: supplier.accountNumber || '',
        ifscCode: supplier.ifscCode || '',
        notes: supplier.notes || '',
      });
    } else if (show) {
      setForm({ ...emptyForm });
    }
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

    // Auto-detect Indian state from 2-digit GSTIN state code if state is not set
    if (form.country === 'India' && uppercaseVal.length >= 2 && !form.state) {
      const stateCode = uppercaseVal.slice(0, 2);
      const stateMap = {
        '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
        '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
        '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
        '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
        '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
        '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
        '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
        '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
        '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
        '37': 'Andhra Pradesh (New)', '38': 'Ladakh'
      };
      if (stateMap[stateCode]) {
        updatedState = stateMap[stateCode];
      }
    }

    setForm(prev => ({ ...prev, gstin: uppercaseVal, state: updatedState }));
    if (taxIdWarning) setTaxIdWarning('');
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px', borderRadius: '12px', padding: '1.5rem' }}>
        <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Building2 className="text-primary" size={22} />
            <h3 className="section-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
              {isEditing ? 'Edit Supplier' : 'Add New Supplier'}
            </h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
          {/* Supplier Name */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Supplier / Business Name *</label>
            <input type="text" className="form-input" value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Apex Traders Pvt Ltd" autoFocus />
          </div>

          {/* GSTIN / Tax ID */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>{cc.taxIdLabel} (GST Number)</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>15-digit GSTIN</span>
            </label>
            <input type="text" className="form-input"
              style={taxIdWarning ? { borderColor: '#f59e0b', fontFamily: 'monospace', letterSpacing: '1px' } : { fontFamily: 'monospace', letterSpacing: '1px' }}
              value={form.gstin}
              onChange={e => handleGstinChange(e.target.value)}
              onBlur={handleTaxIdBlur}
              placeholder="27AAAAA0000A1Z5" maxLength={20} />
            {taxIdWarning && (
              <small style={{ color: '#d97706', fontSize: '0.75rem', display: 'block', marginTop: '0.2rem' }}>
                ⚠ {taxIdWarning}
              </small>
            )}
          </div>

          {/* Phone & Email */}
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="tel" className="form-input" value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="supplier@example.com" />
          </div>

          {/* Address */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Address</label>
            <input type="text" className="form-input" value={form.address}
              onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Building, Street address, Locality" />
          </div>

          {/* Country */}
          <div className="form-group">
            <label className="form-label">Country</label>
            <select className="form-input" value={form.country}
              onChange={e => setForm(prev => ({ ...prev, country: e.target.value, state: '' }))}>
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

          {/* State */}
          <div className="form-group">
            <label className="form-label">{cc.stateLabel}</label>
            {stateOptions.length > 0 ? (
              <select className="form-input" value={form.state}
                onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}>
                <option value="">Select {cc.stateLabel}</option>
                {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input type="text" className="form-input" value={form.state}
                onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}
                placeholder={cc.stateLabel} />
            )}
          </div>

          {/* City & PIN */}
          <div className="form-group">
            <label className="form-label">City</label>
            <input type="text" className="form-input" value={form.city}
              onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
              placeholder="e.g. Mumbai" />
          </div>
          <div className="form-group">
            <label className="form-label">{cc.postalLabel}</label>
            <input type="text" className="form-input" value={form.pin}
              onChange={e => setForm(prev => ({ ...prev, pin: e.target.value }))}
              placeholder={cc.postalLabel} />
          </div>

          {/* Bank Details Section */}
          <div style={{ gridColumn: 'span 2', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <CreditCard size={14} />
              <span>Bank Details for Payouts (Optional)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Bank Name</label>
                <input type="text" className="form-input" style={{ fontSize: '0.8rem' }} value={form.bankName}
                  onChange={e => setForm(prev => ({ ...prev, bankName: e.target.value }))} placeholder="HDFC / SBI" />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Account No.</label>
                <input type="text" className="form-input" style={{ fontSize: '0.8rem' }} value={form.accountNumber}
                  onChange={e => setForm(prev => ({ ...prev, accountNumber: e.target.value }))} placeholder="Account Number" />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>IFSC Code</label>
                <input type="text" className="form-input" style={{ fontSize: '0.8rem', textTransform: 'uppercase' }} value={form.ifscCode}
                  onChange={e => setForm(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))} placeholder="HDFC0001234" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Notes / Payment Terms</label>
            <input type="text" className="form-input" value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. Net 30 days, Preferred vendor for raw material" />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>
            {isEditing ? 'Update Supplier' : 'Save Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}
