import React from 'react';
import { trackClick } from '../utils/analytics';

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-navy-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a
          href="https://app.secondbrainlabs.com/signup?utm_source=tools&utm_medium=leads+by+likes&utm_campaign=leads+by+likes"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackClick('header_logo')}
          className="flex items-center gap-2 group focus:outline-none"
        >
          <span className="text-xl font-extrabold text-navy-900 tracking-tight flex items-center gap-1.5">
            SBL<span className="text-brand-600">.so</span>
          </span>
        </a>

        <a
          href="https://app.secondbrainlabs.com/signup?utm_source=tools&utm_medium=leads+by+likes&utm_campaign=leads+by+likes"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackClick('header_explore')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-navy-600 hover:text-brand-600 transition-colors focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:outline-none rounded px-2 py-1"
        >
          Explore SBL
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </header>
  );
};
