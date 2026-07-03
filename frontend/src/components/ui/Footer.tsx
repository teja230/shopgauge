import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Footer: React.FC = () => {
  const location = useLocation();

  // Admin area has its own layout chrome
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="border-t border-[#e4e7eb] bg-transparent">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-[#5f6b76]">
          © {new Date().getFullYear()} ShopGauge. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
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
