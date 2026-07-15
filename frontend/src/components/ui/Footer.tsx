import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Footer: React.FC = () => {
  const location = useLocation();

  // Admin has its own layout chrome; ShopGPT is a full-viewport workspace
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/business-intelligence')) {
    return null;
  }

  return (
    <footer className="border-t border-[#e4e7eb] bg-transparent">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6">
        <p className="text-center text-sm text-[#5f6b76] sm:text-left">
          © {new Date().getFullYear()} ShopGauge. All rights reserved.
        </p>
        <nav aria-label="Footer navigation" className="flex items-center gap-6">
          <Link
            to="/privacy-policy"
            className="text-sm text-[#5f6b76] hover:text-[#101820] transition-colors"
          >
            Privacy Policy
          </Link>
          <a
            href="mailto:support@shopgauge.app"
            className="text-sm text-[#5f6b76] hover:text-[#101820] transition-colors"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
