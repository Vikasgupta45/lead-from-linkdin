import React, { useState } from 'react';
import { Lead } from '../types/lead';

type ExportFormat = 'csv' | 'pdf' | 'docx';

const labels: Record<ExportFormat, string> = { csv: 'CSV', pdf: 'PDF', docx: 'Word' };
const extensions: Record<ExportFormat, string> = { csv: 'csv', pdf: 'pdf', docx: 'docx' };

interface LeadExportActionsProps {
  leads: Lead[];
}

export const LeadExportActions: React.FC<LeadExportActionsProps> = ({ leads }) => {
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (format: ExportFormat) => {
    setDownloading(format);
    setError(null);
    try {
      const visitorId = localStorage.getItem('sbl_visitor_id') || '';
      const response = await fetch('/api/leads/export', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Visitor-Id': visitorId
        },
        body: JSON.stringify({ format, leads }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
          ? payload.error : 'Unable to create this download. Please try again.';
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sbl-linkedin-leads.${extensions[format]}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Unable to create this download. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-navy-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-navy-900">Download your leads</h3>
          <p className="mt-0.5 text-xs font-medium text-navy-500">Export these {leads.length} results as CSV, PDF, or Word.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(labels) as ExportFormat[]).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => download(format)}
              disabled={downloading !== null}
              className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-xs font-bold text-navy-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloading === format ? 'Preparing…' : labels[format]}
            </button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
};
