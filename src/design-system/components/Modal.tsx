import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-[#252525]/30 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Surface */}
      <div 
        className={`relative w-full ${maxWidthClasses[maxWidth]} bg-white rounded-lg shadow-modal border border-[#E8E8E5] overflow-hidden flex flex-col max-h-[90vh] z-10`}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-5 border-b border-[#E8E8E5] bg-[#FAF9F7]">
            <div>
              {title && (
                <h3 className="text-sm font-semibold text-[#252525] tracking-tight">{title}</h3>
              )}
              {description && (
                <p className="text-xs text-[#777777] mt-0.5">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[#777777] hover:text-[#252525] p-1 rounded hover:bg-[#EFEFEA] transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content body */}
        <div className="p-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Optional footer */}
        {footer && (
          <div className="p-4 bg-[#FAF9F7] border-t border-[#E8E8E5] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
