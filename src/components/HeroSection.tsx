import React from 'react';

export const HeroSection: React.FC = () => {
  return (
    <section className="text-center py-12 sm:py-16 max-w-3xl mx-auto px-4">
      <h1 className="text-4xl sm:text-5xl font-black text-navy-900 tracking-tight leading-tight">
        Turn LinkedIn Post Engagement <br className="hidden sm:inline" />
        <span className="bg-gradient-to-r from-brand-600 to-brand-800 bg-clip-text text-transparent">
          Into Quality Leads.
        </span>
      </h1>
      <p className="mt-4 text-base sm:text-lg text-navy-600 max-w-xl mx-auto leading-relaxed">
        Discover the people who liked any LinkedIn post. Paste the post URL below to instantly download up to 50 high-value targets.
      </p>
    </section>
  );
};
