import React from 'react';

interface InsightBannerProps {
  message: string;
}

export const InsightBanner: React.FC<InsightBannerProps> = ({ message }) => (
  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-4 w-full">
    <p className="text-blue-900 text-sm">{message}</p>
  </div>
); 