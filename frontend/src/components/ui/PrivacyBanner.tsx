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
    <div className="fixed bottom-4 left-4 right-4 z-[1200] mx-auto max-w-5xl rounded-lg border border-white/10 bg-[#101820] p-4 text-white shadow-[0_28px_70px_-44px_rgba(16,24,32,0.9)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <h3 className="text-sm font-black text-white">Privacy & data processing</h3>
          <p className="mt-1 text-sm leading-6 text-[#c3ccd5]">
            ShopGauge uses minimal order analytics data for reporting, forecasting, and compliance workflows.
            Data is encrypted, retained for a limited period, and can be exported or deleted.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={handleViewPrivacy}
            className="rounded-md border border-white/20 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            Privacy policy
          </button>

          <button
            onClick={handleDecline}
            className="rounded-md border border-white/20 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            Decline
          </button>

          <button
            onClick={handleAccept}
            className="rounded-md bg-[#2f5bea] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#244bd4]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyBanner;
