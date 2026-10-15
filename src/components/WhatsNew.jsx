import React, { useState } from 'react';
import { APP_VERSION, RELEASES, markAllSeen } from '../lib/whatsNew';

/**
 * Update announcements, shown in the app itself.
 *
 * Composition: a trailing "What's New" button in the header with an unread
 * badge, opening a panel that lists releases newest-first. The panel opens
 * once by itself when there is something unread; only ever auto-opened, never
 * suddenly opened twice in one session.
 */

const KIND_META = {
  new: { label: 'New', className: 'whats-new__badge-item--new' },
  improved: { label: 'Improved', className: 'whats-new__badge-item--improved' },
  fixed: { label: 'Fixed', className: 'whats-new__badge-item--fixed' },
  security: { label: 'Security', className: 'whats-new__badge-item--security' },
};

const KindBadge = ({ kind }) => {
  const meta = KIND_META[kind];
  if (!meta) return null;
  return (
    <span className={`whats-new__badge-item ${meta.className}`}>{meta.label}</span>
  );
};

/**
 * @param {string[]} unseenVersions — unseen versions; non-empty shows the badge
 * @param {boolean} open
 * @param {() => void} onClose
 */
export default function WhatsNew({ unseenVersions, open, onClose }) {
  if (!open) return null;

  const handleDismiss = () => {
    markAllSeen();
    onClose();
  };

  return (
    <div className="whats-new" onClick={handleDismiss}>
      <div
        className="whats-new__panel"
        role="dialog"
        aria-modal="true"
        aria-label="What's new in TrackSimply"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="whats-new__panel-head">
          <div>
            <h2 className="whats-new__title">What's new</h2>
            <p className="whats-new__subtitle">
              TrackSimply v{APP_VERSION} — the updates, straight from us, in case you
              are curious about what moved.
            </p>
          </div>
          <button className="whats-new__close" onClick={handleDismiss} aria-label="Close What's new panel">×</button>
        </div>

        <div className="whats-new__releases">
          {RELEASES.map((release, i) => (
            <section key={release.version} className="whats-new__release">
              <header className="whats-new__release-head">
                <h3 className="whats-new__release-title">
                  {'v' + release.version}
                  {i === 0 && release.version === APP_VERSION && (
                    <span className="whats-new__current">current</span>
                  )}
                </h3>
                <span className="whats-new__release-date">{release.date}</span>
              </header>
              <p className="whats-new__release-summary">{release.title}</p>
              <ul className="whats-new__items">
                {release.items.map((item, j) => (
                  <li key={j} className="whats-new__item">
                    <KindBadge kind={item.kind} />
                    <span className="whats-new__item-text">{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="whats-new__panel-foot">
          <button className="whats-new__got-it" onClick={handleDismiss}>Got it</button>
        </footer>
      </div>
    </div>
  );
}

/** Trailing header button that opens the panel. Shows an unread count. */
export function WhatsNewButton({ unseenCount, onOpen }) {
  return (
    <button
      className="app-header-btn whats-new-trigger"
      onClick={onOpen}
      aria-label="What's new"
      title="What's new"
    >
      {'✨'}
      {unseenCount > 0 && (
        <span className="whats-new-trigger__badge">{unseenCount > 9 ? '9+' : unseenCount}</span>
      )}
    </button>
  );
}
