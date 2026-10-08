import { useEffect } from 'react';
import { IconClose } from './Icons.jsx';

export default function Modal({ open, onClose, children, className = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button type="button" className="modal-close icon-btn" aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
