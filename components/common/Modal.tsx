
import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  closeOnBackdropClick?: boolean; // New prop to control closing behavior
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', closeOnBackdropClick = true }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={closeOnBackdropClick ? onClose : undefined} // Conditionally handle backdrop click
    >
      <div 
        className={`bg-white rounded-xl shadow-2xl w-full ${sizeClasses[size]} flex flex-col max-h-[95vh] transform transition-all duration-300 ease-out scale-95 opacity-0 animate-modal-appear`}
        onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        {/* Modal Header (Fixed) */}
        <div className="flex-shrink-0 flex justify-between items-center p-5 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors rounded-full p-1 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content (Scrollable) */}
        <div className="flex-grow p-6 overflow-y-auto">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes modal-appear {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-modal-appear {
          animation: modal-appear 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
};
