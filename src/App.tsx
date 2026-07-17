import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { PostUrlForm } from './components/PostUrlForm';
import { LoadingState } from './components/LoadingState';
import { ErrorMessage } from './components/ErrorMessage';
import { LeadResults } from './components/LeadResults';
import { Lead, FetchStatus } from './types/lead';
import { PostLikesService } from './services/postLikesService';
import { trackClick } from './utils/analytics';

let memoryVisitorId: string | null = null;
const getVisitorId = (): string => {
  try {
    let id = localStorage.getItem('sbl_visitor_id');
    if (!id) {
      id = (window.crypto && window.crypto.randomUUID) 
        ? window.crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('sbl_visitor_id', id);
    }
    return id;
  } catch (e) {
    if (!memoryVisitorId) {
      memoryVisitorId = (window.crypto && window.crypto.randomUUID) 
        ? window.crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    return memoryVisitorId;
  }
};

const App: React.FC = () => {
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [visitorStatus, setVisitorStatus] = useState<'AVAILABLE' | 'RESERVED' | 'USED' | 'LOADING'>('LOADING');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch status on initial component mounting
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const visitorId = getVisitorId();
        const res = await fetch('/api/leads/status', {
          headers: {
            'X-Visitor-Id': visitorId
          }
        });
        const data = await res.json();
        if (data.success && data.status) {
          setVisitorStatus(data.status);
        } else {
          setVisitorStatus('AVAILABLE');
        }
      } catch (err) {
        console.error('[Visitor Status Check Error]', err);
        setVisitorStatus('AVAILABLE');
      }
    };
    checkStatus();
  }, []);

  const handleSearch = async (postUrl: string) => {
    setStatus('loading');
    setErrorMessage(null);
    setLeads([]);

    const response = await PostLikesService.findLeads(postUrl);

    if (response.success) {
      setLeads(response.leads);
      setStatus('success');
      setVisitorStatus('USED'); // Search consumed successfully
    } else {
      setErrorMessage(response.error || "We couldn't retrieve leads right now. Please try again.");
      setStatus('error');
      
      // If backend reports they have already used their search limit, sync visitor status
      if (response.code === 'FREE_USAGE_ALREADY_USED') {
        setVisitorStatus('USED');
      } else if (response.code === 'FREE_USAGE_PROCESSING') {
        setVisitorStatus('RESERVED');
      }
    }
  };



  return (
    <div className="flex flex-col min-h-screen bg-navy-50 text-navy-900 font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Navigation */}
      <Header />

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-start">
        {/* Marketing Hero Section */}
        <HeroSection />

        {/* Multi-layer conditional display */}
        {visitorStatus === 'LOADING' ? (
          <div className="w-full max-w-2xl mx-auto px-4 flex items-center justify-center py-10">
            <svg className="animate-spin h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : visitorStatus === 'USED' && status !== 'success' ? (
          /* Blocked State for visitors who already consumed their single free query */
          <div className="w-full max-w-2xl mx-auto px-4 animate-fadeIn">
            <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 rounded-2xl p-9 text-center text-white border border-brand-400 shadow-xl shadow-brand-500/10 relative overflow-hidden group">
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-white rounded-full blur-3xl opacity-20 pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-brand-400 rounded-full blur-3xl opacity-30 pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white ring-1 ring-inset ring-white/30">
                  Free Search Consumed
                </span>
                <div className="space-y-2.5">
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    You've already used your free search
                  </h3>
                  <p className="text-brand-50 text-sm sm:text-base max-w-md mx-auto font-medium opacity-95">
                    Want to discover more people engaging with LinkedIn content? Unlock the full SBL platform for unlimited lead generation.
                  </p>
                </div>
                <div className="pt-2">
                  <a
                    href="https://sbl.so"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackClick('upgrade_cta')}
                    className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-extrabold rounded-xl text-brand-700 bg-white hover:bg-brand-50 active:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all shadow-md hover:shadow-lg group/btn"
                  >
                    Unlock More Leads
                    <svg className="ml-2 -mr-1 h-4 w-4 text-brand-700 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Search Interface (AVAILABLE or RESERVED) */
          <>
            <PostUrlForm 
              onSubmit={handleSearch} 
              isLoading={status === 'loading'} 
            />

            {/* Loading Indicator */}
            {status === 'loading' && <LoadingState />}

            {/* Error Notification */}
            {status === 'error' && errorMessage && (
              <ErrorMessage message={errorMessage} />
            )}

            {/* Successful Results Grid */}
            {status === 'success' && (
              <LeadResults leads={leads} />
            )}
          </>
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="w-full border-t border-navy-200 bg-white py-8 text-center text-xs font-semibold text-navy-400">
        <div className="max-w-6xl mx-auto px-4 space-y-3">
          <p>© {new Date().getFullYear()} SBL.so. All rights reserved.</p>
          <p className="space-x-4">
            <a 
              href="https://sbl.so" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={() => trackClick('footer_terms')}
              className="hover:text-brand-600 transition-colors"
            >
              Terms of Service
            </a>
            <span>•</span>
            <a 
              href="https://sbl.so" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={() => trackClick('footer_privacy')}
              className="hover:text-brand-600 transition-colors"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a 
              href="https://sbl.so" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={() => trackClick('footer_explore')}
              className="hover:text-brand-600 transition-colors"
            >
              Explore SBL.so
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
