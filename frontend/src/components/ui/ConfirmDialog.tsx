import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  size = 'md'
}) => {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      buttonBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      IconComponent: AlertCircle
    },
    warning: {
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      buttonBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
      IconComponent: AlertTriangle
    },
    info: {
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      buttonBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      IconComponent: Info
    },
    success: {
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
      IconComponent: CheckCircle
    }
  };

  const sizeConfig = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl'
  };

  const config = typeConfig[type];
  const IconComponent = config.IconComponent;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4">
      {/* Enhanced backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-all duration-300" 
        onClick={onCancel} 
      />
      
      {/* Modern glassmorphism dialog */}
      <div className={`relative ${sizeConfig[size]} w-full transform transition-all duration-300 scale-100`}>
        <div className="bg-gradient-to-br from-white/95 to-gray-50/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with modern design */}
          <div className="flex items-start justify-between p-6 pb-4">
            <div className="flex items-center gap-4">
              <div className={`
                flex items-center justify-center w-11 h-11 rounded-xl
                ${config.iconColor} ${config.bgColor} ${config.borderColor} border
                shadow-sm
              `}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 leading-6">{title}</h3>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100/80"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Enhanced content area */}
          <div className="px-6 pb-6">
            <div className={`
              ${config.bgColor} ${config.borderColor} border rounded-xl p-4
              backdrop-blur-sm shadow-sm
            `}>
              <div className="flex items-start gap-3">
                <div className={`${config.iconColor} mt-0.5 flex-shrink-0`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed font-medium">
                    {message}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Modern action buttons */}
          <div className="flex gap-3 justify-end px-6 pb-6 pt-2">
            <button
              onClick={onCancel}
              className="
                px-6 py-2.5 text-sm font-medium text-gray-700 
                bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl 
                hover:bg-gray-50/90 hover:border-gray-300
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 
                transition-all duration-200 shadow-sm
                hover:shadow-md hover:-translate-y-0.5
              "
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`
                px-6 py-2.5 text-sm font-semibold text-white 
                ${config.buttonBg} rounded-xl shadow-lg
                focus:outline-none focus:ring-2 focus:ring-offset-2 
                transition-all duration-200
                hover:shadow-xl hover:-translate-y-0.5
                backdrop-blur-sm
              `}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 