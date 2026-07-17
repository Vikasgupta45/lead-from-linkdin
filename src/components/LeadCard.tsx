import React from 'react';
import { Lead } from '../types/lead';

interface LeadCardProps {
  lead: Lead;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead }) => {
  const profileUrl = /^https:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\//i.test(lead.profileUrl) ? lead.profileUrl : undefined;
  // Extract initials if avatarUrl is missing
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="bg-white rounded-xl border border-navy-200 hover:border-brand-400 hover:shadow-md transition-all duration-300 p-5 flex flex-col justify-between group">
      <div>
        <div className="flex items-center gap-3.5">
          {lead.avatarUrl ? (
            <img
              src={lead.avatarUrl}
              alt={`${lead.name}'s profile photo`}
              className="w-12 h-12 rounded-full object-cover border border-navy-100 group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                // Fallback to avatar letters if image fails to load
                (e.target as HTMLImageElement).style.display = 'none';
                const nextSibling = (e.target as HTMLImageElement).nextElementSibling;
                if (nextSibling) {
                  nextSibling.classList.remove('hidden');
                }
              }}
            />
          ) : null}
          <div
            className={`w-12 h-12 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm tracking-wide ${
              lead.avatarUrl ? 'hidden' : ''
            }`}
          >
            {getInitials(lead.name)}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-navy-900 truncate">
              {lead.name}
            </h3>
            {lead.location && (
              <p className="text-xs text-navy-500 font-medium truncate flex items-center gap-1">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {lead.location}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-1">
          {lead.title && (
            <p className="text-sm font-semibold text-navy-800 line-clamp-1">
              {lead.title}
            </p>
          )}
          {lead.company && (
            <p className="text-xs font-medium text-navy-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {lead.company}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 pt-3.5 border-t border-navy-100 flex justify-end">
        {profileUrl ? <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:outline-none rounded py-1 px-1.5 transition-colors"
        >
          View Profile
          <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a> : <span className="text-xs font-bold text-navy-400">Profile unavailable</span>}
      </div>
    </div>
  );
};
