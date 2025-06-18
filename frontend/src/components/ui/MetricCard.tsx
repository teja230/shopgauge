import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: 'up' | 'down' | 'neutral';
}

const deltaColors = {
  up: 'text-green-600',
  down: 'text-red-600',
  neutral: 'text-gray-500',
};

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, delta, deltaType = 'neutral' }) => (
  <div className="bg-white rounded-lg shadow p-4 flex flex-col items-start w-full min-w-[150px] max-w-xs">
    <span className="text-sm text-gray-500 mb-1">{label}</span>
    <span className="text-2xl font-bold text-gray-900">{value}</span>
    {delta && (
      <span className={`text-xs mt-1 font-medium ${deltaColors[deltaType]}`}>{delta}</span>
    )}
  </div>
); 