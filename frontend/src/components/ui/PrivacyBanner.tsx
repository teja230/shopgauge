import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PrivacyBannerProps {
  onAccept?: () => void;
  onDecline?: () => void;
}

export const PrivacyBanner: React.FC<PrivacyBannerProps> = ({ onAccept, onDecline }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has already interacted with privacy banner
    const privacyAccepted = localStorage.getItem('shopgauge-privacy-accepted');
    const privacyDeclined = localStorage.getItem('shopgauge-privacy-declined');
    
    if (!privacyAccepted && !privacyDeclined) {
      // Show banner after 2 seconds
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('shopgauge-privacy-accepted', 'true');
    localStorage.setItem('shopgauge-privacy-timestamp', new Date().toISOString());
    setHasInteracted(true);
    setIsVisible(false);
    onAccept?.();
  };

  const handleDecline = () => {
    localStorage.setItem('shopgauge-privacy-declined', 'true');
    localStorage.setItem('shopgauge-privacy-timestamp', new Date().toISOString());
    setHasInteracted(true);
    setIsVisible(false);
    onDecline?.();
  };

  const handleViewPrivacy = () => {
    navigate('/privacy-policy');
  };

  if (!isVisible || hasInteracted) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-900 text-white p-4 shadow-lg z-50 border-t-4 border-blue-500">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className="text-blue-300 text-xl">🔒</div>
            <div>
              <h3 className="font-semibold text-white mb-1">Privacy & Data Processing Notice</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                StoreSignt processes <strong>minimal order data</strong> (totals, dates, status) for analytics purposes only. 
                We use <strong>60-day retention</strong>, <strong>AES-256 encryption</strong>, and provide full 
                <strong> GDPR/CCPA compliance</strong> with data export and deletion rights.
              </p>
              <div className="mt-2 text-xs text-blue-200">
                📊 Data: Order analytics only • 🗓️ Retention: 60 days max • 🔐 Security: End-to-end encrypted
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 min-w-fit">
          <button
            onClick={handleViewPrivacy}
            className="px-3 py-2 text-xs font-medium text-blue-200 border border-blue-400 rounded hover:bg-blue-800 transition-colors"
          >
            📋 View Privacy Policy
          </button>
          
          <button
            onClick={handleDecline}
            className="px-3 py-2 text-xs font-medium text-blue-200 border border-blue-400 rounded hover:bg-blue-800 transition-colors"
          >
            ❌ Decline Analytics
          </button>
          
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            ✅ Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyBanner; 