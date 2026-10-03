import React, { useState } from 'react';
import { X, Printer, Download, Eye, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import InvoicePreview from './InvoicePreview';

export default function InvoicePreviewModal({
  isOpen,
  onClose,
  profile,
  client,
  details,
  items,
  totals,
  invoiceType,
  customTerms,
  customNotes,
  extraSections,
  invoiceOptions,
  onDownloadPdf,
  onPrint,
  saving,
}) {
  const [zoom, setZoom] = useState(100);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--card-bg, #1e293b)',
          color: 'var(--text-primary, #f8fafc)',
          borderRadius: '12px',
          width: '95vw',
          maxWidth: '1000px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          border: '1px solid var(--border, #334155)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border, #334155)',
            background: 'var(--bg-secondary, #0f172a)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Eye size={20} style={{ color: 'var(--primary, #3b82f6)' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              Invoice Preview
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginLeft: '0.5rem' }}>
              ({details?.invoiceNumber || 'Draft'})
            </span>
          </div>

          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              title="Zoom out"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '45px', textAlign: 'center' }}>
              {zoom}%
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              title="Zoom in"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => setZoom((z) => Math.min(180, z + 10))}
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              title="Reset Zoom"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', marginLeft: '0.25rem' }}
              onClick={() => setZoom(100)}
            >
              <Maximize2 size={13} style={{ marginRight: '3px' }} /> Fit
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              title="Close Preview"
              style={{ marginLeft: '1rem' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '2rem 1rem',
            background: 'var(--bg, #090d16)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              borderRadius: '4px',
              backgroundColor: '#fff',
            }}
          >
            <InvoicePreview
              profile={profile}
              client={client}
              details={details}
              items={items}
              totals={totals}
              invoiceType={invoiceType}
              customTerms={customTerms}
              customNotes={customNotes}
              extraSections={extraSections}
              options={invoiceOptions}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border, #334155)',
            background: 'var(--bg-secondary, #0f172a)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', fontSize: '0.88rem' }}
          >
            Close
          </button>
          {onPrint && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                onClose();
                onPrint();
              }}
              disabled={saving}
              style={{ padding: '0.5rem 1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Printer size={16} /> Print
            </button>
          )}
          {onDownloadPdf && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onDownloadPdf();
              }}
              disabled={saving}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Download size={16} /> {saving ? 'Generating...' : 'Download PDF'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
