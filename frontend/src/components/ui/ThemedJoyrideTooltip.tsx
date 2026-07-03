import React from 'react';
import type { TooltipRenderProps } from 'react-joyride';
import { AcademicCapIcon } from '@heroicons/react/24/outline';

interface ThemedJoyrideTooltipProps extends TooltipRenderProps {
  icon?: React.ReactNode;
  accentColor?: string;
}

const ThemedJoyrideTooltip: React.FC<ThemedJoyrideTooltipProps> = ({
  step,
  index,
  size,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  icon,
  accentColor = '#2f5bea',
}) => (
  <div
    {...tooltipProps}
    className="bg-white rounded-xl shadow-xl max-w-md p-6 border"
    style={{
      fontFamily: 'Inter, sans-serif',
      boxShadow: '0 8px 32px 0 rgba(37,99,235,0.10)',
      borderRadius: 16,
      borderColor: accentColor,
      borderWidth: 1,
    }}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon || <AcademicCapIcon className="h-8 w-8" style={{ color: accentColor }} />}
        <span className="text-lg font-semibold" style={{ color: accentColor }}>{step.title}</span>
      </div>
      <button {...closeProps} className="text-gray-400 hover:text-gray-600 text-xl font-bold focus:outline-none">×</button>
    </div>
    <div className="text-gray-700 text-base mb-6">{step.content}</div>
    <div className="flex items-center justify-between mt-2">
      <button {...skipProps} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded focus:outline-none">Skip</button>
      <div className="flex gap-2">
        {index > 0 && (
          <button 
            {...backProps} 
            className="px-4 py-2 text-sm font-medium" 
            style={{ color: accentColor, background: '#e0e7ff', borderRadius: 8, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}
            onClick={(e) => {
              console.log('Previous button clicked, index:', index, 'backProps:', backProps);
              if (backProps.onClick) {
                backProps.onClick(e);
              }
            }}
          >
            Previous
          </button>
        )}
        <button
          {...primaryProps}
          className="px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: accentColor, borderRadius: 8, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}
        >
          {isLastStep ? 'Finish' : `Next (Step ${index + 1} of ${size})`}
        </button>
      </div>
    </div>
  </div>
);

export default ThemedJoyrideTooltip; 