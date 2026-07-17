import React from 'react';

interface UpgradeCTAProps {
  reachedLimit: boolean;
}

export const UpgradeCTA: React.FC<UpgradeCTAProps> = ({ reachedLimit }) => {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-12 mb-16 animate-fadeIn">
      {reachedLimit ? (
        <div className="bg-gradient-to-br from-brand-900 via-navy-900 to-navy-950 rounded-2xl p-6 sm:p-8 text-center text-white border border-brand-800 shadow-lg relative overflow-hidden group">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500 rounded-full blur-3xl opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-brand-600 rounded-full blur-3xl opacity-25 pointer-events-none group-hover:scale-110 transition-transform duration-700" />

          <div className="relative z-10 space-y-5">
            <span className="inline-flex items-center rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300 ring-1 ring-inset ring-brand-500/30">
              Free Limit Reached
            </span>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">
                Unlock Unlimited Post Engagement Leads
              </h3>
              <p className="text-navy-300 text-sm max-w-md mx-auto font-medium">
                Want to extract hundreds of leads from any LinkedIn post, automate list building, and connect signal data?
              </p>
            </div>
            <div className="pt-2">
              <a
                href="https://app.secondbrainlabs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl text-white bg-brand-600 hover:bg-brand-500 active:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors shadow-md group/btn"
              >
                Unlock More Leads
                <svg className="ml-2 -mr-1 h-4 w-4 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 sm:p-8 text-center border border-navy-200 shadow-sm relative overflow-hidden group">
          <div className="relative z-10 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-navy-900 tracking-tight">
                Explore the Full SBL Platform
              </h3>
              <p className="text-navy-500 text-sm max-w-md mx-auto font-medium">
                Gain deep, signal-based intelligence from across LinkedIn and scale your outreach.
              </p>
            </div>
            <div className="pt-2.5">
              <a
                href="https://app.secondbrainlabs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-5 py-2.5 border border-navy-200 hover:border-brand-300 text-sm font-semibold rounded-xl text-navy-700 hover:text-brand-600 bg-white hover:bg-brand-50/50 active:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all shadow-sm group/btn"
              >
                Go to SBL.so
                <svg className="ml-2 -mr-0.5 h-4 w-4 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
