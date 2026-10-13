import React, { useState, useRef, useEffect } from 'react';

/**
 * An inline explanation toggle.
 *
 * Deliberately click-driven rather than hover-driven: the app is used on
 * phones, where hover does not exist, and a metric that only explains itself to
 * a mouse is a metric most users cannot read. Dismisses on any outside tap.
 */
export default function Info({ title, children, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="rk-info" ref={ref}>
      <button
        type="button"
        className={`rk-info-btn ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-label={label || `What does ${title || 'this'} mean?`}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <span className="rk-info-pop" role="note">
          {title && <strong>{title}</strong>}
          <span>{children}</span>
        </span>
      )}
    </span>
  );
}