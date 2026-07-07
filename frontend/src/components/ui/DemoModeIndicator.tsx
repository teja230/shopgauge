import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface DemoModeIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

const DemoModeIndicator: React.FC<DemoModeIndicatorProps> = ({
  className = '',
  showDetails = true,
}) => {
  const { isDemoMode } = useAuth();

  if (!isDemoMode) return null;

  return (
    <div className={`rounded-md border border-[#2f5bea]/25 bg-[#2f5bea]/10 px-3 py-2 text-[#1d3db8] ${className}`}>
      <span className="text-sm font-black">Demo mode</span>
      {showDetails && (
        <span className="ml-2 text-sm font-medium text-[#5f6b76]">
          Exploring with realistic sample data
        </span>
      )}
    </div>
  );
};

export const DemoModeBanner: React.FC = () => null;

export const DemoModeChip: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isDemoMode } = useAuth();

  if (!isDemoMode) return null;

  return (
    <span className={`inline-flex items-center rounded-full border border-[#2f5bea]/25 bg-[#2f5bea]/10 px-2.5 py-1 text-xs font-black text-[#1d3db8] ${className}`}>
      Demo
    </span>
  );
};

export default DemoModeIndicator;
