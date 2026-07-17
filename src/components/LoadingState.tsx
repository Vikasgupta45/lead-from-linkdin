import React from 'react';

export const LoadingState: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 mt-12 animate-pulse">
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-navy-800">
          Analyzing post engagement...
        </h2>
        <p className="text-sm text-navy-500 mt-1">
          Securely connecting to the SBL lead service
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i} 
            className="bg-white rounded-xl border border-navy-200 p-5 space-y-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-navy-200 rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-navy-200 rounded w-2/3" />
                <div className="h-3 bg-navy-200 rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-3 bg-navy-100 rounded w-5/6" />
              <div className="h-3 bg-navy-100 rounded w-4/6" />
            </div>
            <div className="pt-2 border-t border-navy-100 flex justify-end">
              <div className="h-4 bg-navy-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
