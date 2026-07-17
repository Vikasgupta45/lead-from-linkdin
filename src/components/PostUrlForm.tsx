import React, { useState } from 'react';
import { postUrlSchema } from '../schemas/postLikesSchema';

interface PostUrlFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export const PostUrlForm: React.FC<PostUrlFormProps> = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();

    // 1. Zod client-side validation
    const result = postUrlSchema.safeParse(trimmedUrl);
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Invalid URL");
      return;
    }

    onSubmit(trimmedUrl);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="bg-white rounded-2xl border border-navy-200 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="post-url" className="sr-only">
              LinkedIn Post URL
            </label>
            <div className="relative flex flex-col sm:flex-row gap-3">
              <input
                id="post-url"
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Paste a LinkedIn post URL..."
                disabled={isLoading}
                className={`flex-1 min-w-0 block w-full px-4 py-3.5 text-base text-navy-900 placeholder-navy-400 bg-white border rounded-xl shadow-inner focus:outline-none transition-colors ${
                  error
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                    : 'border-navy-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
                }`}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-semibold rounded-xl text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2.5 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    Download Leads
                    <svg className="ml-2 -mr-1 h-5 w-5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="mt-2.5 text-sm text-red-600 font-medium flex items-center gap-1.5 animate-fadeIn">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
          </div>
        </form>
        
        <div className="mt-5 pt-5 border-t border-navy-100 flex items-center justify-center gap-2 text-xs font-semibold text-navy-500">
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Secure lookup</span>
          <span className="text-navy-300">•</span>
          <span>No LinkedIn credentials required</span>
        </div>
      </div>
    </div>
  );
};
