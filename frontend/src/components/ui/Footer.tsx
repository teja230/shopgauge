import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Footer: React.FC = () => {
  const location = useLocation();

  // Admin area has its own layout chrome
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} ShopGauge. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
          <Link
            to="/privacy-policy"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Privacy Policy
          </Link>
          <a
            href="mailto:support@shopgauge.app"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
