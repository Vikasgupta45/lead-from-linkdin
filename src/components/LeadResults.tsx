import React from 'react';
import { Lead } from '../types/lead';
import { LeadCard } from './LeadCard';
import { UpgradeCTA } from './UpgradeCTA';
import { LeadExportActions } from './LeadExportActions';

interface LeadResultsProps {
  leads: Lead[];
}

export const LeadResults: React.FC<LeadResultsProps> = ({ leads }) => {
  const hasLeads = leads.length > 0;
  
  // The tool limit is 50 leads. If we have 50 leads, we show the hard limit upgrade banner.
  const reachedLimit = leads.length === 50;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-12 animate-fadeIn">
      {hasLeads ? (
        <>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-navy-900 tracking-tight">
              People Who Liked This Post
            </h2>
            <p className="text-sm font-semibold text-navy-500 mt-1">
              Showing {leads.length} lead{leads.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {leads.map((lead, idx) => (
              <LeadCard key={idx} lead={lead} />
            ))}
          </div>
          <LeadExportActions leads={leads} />
        </>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl border border-navy-200 shadow-sm max-w-2xl mx-auto">
          <svg className="w-12 h-12 text-navy-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-bold text-navy-900">
            No leads found for this post
          </h3>
          <p className="mt-1.5 text-sm text-navy-500 max-w-xs mx-auto font-medium">
            Try a different post URL that has likes and engagement.
          </p>
        </div>
      )}

      {/* Upgrade CTA is always shown at the bottom, styled differently based on result count */}
      <UpgradeCTA reachedLimit={reachedLimit} />
    </div>
  );
};
