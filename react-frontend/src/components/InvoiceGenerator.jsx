import { useEffect } from 'react';
import VyaparInvoiceEditor from './VyaparInvoiceEditor';

export default function InvoiceGenerator({ onBack, profile, editingBill }) {
  useEffect(() => {
    localStorage.removeItem('gst_entry_mode');
  }, []);

  const handleBack = () => {
    sessionStorage.removeItem('gst_invoiceDraft');
    if (onBack) onBack();
  };

  const sanitizeType = (t) => (typeof t === 'string' && t.trim() ? t.trim() : 'tax-invoice');
  const invoiceType = sanitizeType(editingBill?.invoiceType || editingBill?.docType);

  return (
    <div style={{ padding: '0 0.5rem' }}>
      <VyaparInvoiceEditor
        entryType="sale"
        docType={invoiceType}
        editingRecord={editingBill}
        profile={profile}
        onSave={handleBack}
        onBack={handleBack}
      />
    </div>
  );
}
