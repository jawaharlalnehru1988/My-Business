import { useState, useEffect } from 'react';
import { X, Package, Plus, Sparkles, Check } from 'lucide-react';
import { saveProduct } from '../store';
import { toast } from './Toast';

const GST_RATES = [
  { label: 'None (0%)', value: 0 },
  { label: 'GST @ 0%', value: 0 },
  { label: 'GST @ 0.25%', value: 0.25 },
  { label: 'GST @ 3%', value: 3 },
  { label: 'GST @ 5%', value: 5 },
  { label: 'GST @ 12%', value: 12 },
  { label: 'GST @ 18%', value: 18 },
  { label: 'GST @ 28%', value: 28 },
];

const DEFAULT_UNITS = [
  'PCS', 'BOX', 'KGS', 'GMS', 'MTR', 'NOS', 'PKT', 'BAG',
  'LTR', 'SET', 'ROLL', 'DOZ', 'QTL', 'TON', 'NONE'
];

export default function ItemModal({
  show = true,
  onClose,
  onSave,
  initialName = '',
  entryType = 'sale',
  defaultTaxPercent = 18
}) {
  const isPurchase = entryType === 'purchase';

  const emptyForm = {
    name: '',
    type: 'PHYSICAL', // 'PHYSICAL' (Product/Goods) | 'SERVICE'
    sku: '',
    category: '',
    hsn: '',
    unit: 'PCS',
    sellingPrice: '',
    purchasePrice: '',
    taxPercent: defaultTaxPercent,
    cessPercent: '',
    openingStock: '',
    minStock: '5',
    description: ''
  };

  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setForm({
        ...emptyForm,
        name: initialName || '',
        taxPercent: defaultTaxPercent
      });
    }
  }, [show, initialName, defaultTaxPercent]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.warning('Please enter an item name');
      return;
    }

    setIsSaving(true);
    try {
      const sellingPrice = form.sellingPrice !== '' ? parseFloat(form.sellingPrice) || 0 : 0;
      const purchasePrice = form.purchasePrice !== '' ? parseFloat(form.purchasePrice) || 0 : 0;
      const rate = isPurchase ? (purchasePrice || sellingPrice) : (sellingPrice || purchasePrice);
      const stock = form.type === 'SERVICE' ? 0 : (form.openingStock !== '' ? parseFloat(form.openingStock) || 0 : 0);

      const productPayload = {
        name: trimmedName,
        type: form.type || 'PHYSICAL',
        sku: form.sku.trim() || `ITEM-${Math.floor(10000 + Math.random() * 90000)}`,
        category: form.category.trim(),
        hsn: form.hsn.trim(),
        unit: (form.unit || 'PCS').toUpperCase(),
        sellingPrice,
        purchasePrice,
        rate,
        taxPercent: parseFloat(form.taxPercent) || 0,
        cessPercent: form.cessPercent !== '' ? parseFloat(form.cessPercent) || 0 : 0,
        stock,
        openingStock: stock,
        minStock: form.minStock !== '' ? parseFloat(form.minStock) || 5 : 5,
        description: form.description.trim()
      };

      const saved = await saveProduct(productPayload);
      toast.success(`Item "${trimmedName}" created successfully!`);
      if (onSave) {
        onSave(saved || productPayload);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to create product:', err);
      toast.error('Failed to save item: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-content animate-scale-up"
        style={{
          maxWidth: '560px',
          width: '94%',
          borderRadius: '12px',
          padding: '1.4rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center mb-3 pb-2"
          style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Package size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                Add New Item
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Add item to catalog & auto-select in current entry
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Item Type Switcher */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, type: 'PHYSICAL' }))}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '6px',
                border: form.type === 'PHYSICAL' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: form.type === 'PHYSICAL' ? '#eff6ff' : '#f8fafc',
                color: form.type === 'PHYSICAL' ? '#1d4ed8' : '#475569',
                fontWeight: form.type === 'PHYSICAL' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Package size={14} /> Product (Goods)
            </button>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, type: 'SERVICE' }))}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: '6px',
                border: form.type === 'SERVICE' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: form.type === 'SERVICE' ? '#eff6ff' : '#f8fafc',
                color: form.type === 'SERVICE' ? '#1d4ed8' : '#475569',
                fontWeight: form.type === 'SERVICE' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={14} /> Service
            </button>
          </div>

          {/* Row 1: Item Name & HSN/SAC */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                Item Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Wireless Mouse, Cotton Shirt"
                autoFocus
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                {form.type === 'SERVICE' ? 'SAC Code' : 'HSN Code'}
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                value={form.hsn}
                onChange={e => setForm(prev => ({ ...prev, hsn: e.target.value }))}
                placeholder={form.type === 'SERVICE' ? '998311' : '84716060'}
              />
            </div>
          </div>

          {/* Row 2: Unit & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                Primary Unit
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                value={form.unit}
                onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
              >
                {DEFAULT_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                Category
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                value={form.category}
                onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g. Electronics, Clothing"
              />
            </div>
          </div>

          {/* Row 3: Pricing (Sales Price, Purchase Price) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                Sale Price (₹) {!isPurchase && <span style={{ color: '#2563eb', fontSize: '0.7rem' }}>(Default)</span>}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="form-input"
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                value={form.sellingPrice}
                onChange={e => setForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                Purchase Price (₹) {isPurchase && <span style={{ color: '#2563eb', fontSize: '0.7rem' }}>(Default)</span>}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="form-input"
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                value={form.purchasePrice}
                onChange={e => setForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Row 4: Tax Rate & Cess */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                GST Tax Rate
              </label>
              <select
                className="form-input"
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                value={form.taxPercent}
                onChange={e => setForm(prev => ({ ...prev, taxPercent: e.target.value }))}
              >
                {GST_RATES.map(r => (
                  <option key={r.label} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                Cess (%)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="form-input"
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                value={form.cessPercent}
                onChange={e => setForm(prev => ({ ...prev, cessPercent: e.target.value }))}
                placeholder="0 %"
              />
            </div>
          </div>

          {/* Row 5: Stock (Only for Products) */}
          {form.type === 'PHYSICAL' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                  Opening Stock
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-input"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  value={form.openingStock}
                  onChange={e => setForm(prev => ({ ...prev, openingStock: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>
                  Low Stock Alert At
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-input"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  value={form.minStock}
                  onChange={e => setForm(prev => ({ ...prev, minStock: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '1.25rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid var(--border, #e2e8f0)'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '7px 18px',
                borderRadius: '6px',
                border: 'none',
                background: isSaving ? '#93c5fd' : '#2563eb',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check size={16} /> Save & Select Item
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
