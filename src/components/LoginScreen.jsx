import React, { useState, useEffect, useRef, useCallback } from 'react';
import './LoginScreen.css';
import { useAuth } from '../context/AuthContext';

/* ------------------------------------------------------------------ *
 * Icons
 * ------------------------------------------------------------------ */

/* Inline SVG rather than emoji. The eye glyphs previously used were a ZWJ
   emoji sequence that renders as a different picture — or an empty box — across
   platforms and fonts. */
const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const BrandMark = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="tsBrand" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#37e0c4" />
        <stop offset="1" stopColor="#4a7bff" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="22" height="22" rx="7" fill="url(#tsBrand)" />
    <path d="M7.5 9.2h9M12 9.2V17" stroke="#0d0804" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ *
 * Showcase slides
 * ------------------------------------------------------------------ */

/* The reference's right panel is an onboarding carousel. Its content was
   generic CRM copy, so it is replaced with what this application actually does
   — and, importantly, with what it does NOT do, since a login screen is where a
   new user forms their expectations. */
const SLIDES = [
  {
    title: 'Know where the money went',
    body: 'Profit and loss, cash flow and category breakdowns, calculated from the transactions you already record. No spreadsheets, no month-end scramble.',
  },
  {
    title: 'See trouble before it arrives',
    body: 'Budget burn rate, projected overspend, debt payoff dates and unusual spending — surfaced while there is still time to act on them.',
  },
  {
    title: 'One record of the business',
    body: 'Stock, vehicles, liabilities and daily takings in a single place, shared across your team and always current.',
  },
];

const SlideDots = ({ index, onSelect }) => {
  const shapes = ['dot-tri', 'dot-circle', 'dot-square'];
  const labels = ['Overview', 'Insight', 'Records'];
  return (
    <div className="k-dots" role="tablist" aria-label="Showcase">
      {SLIDES.map((slide, i) => (
        <button
          key={slide.title}
          type="button"
          role="tab"
          aria-selected={i === index}
          aria-label={labels[i]}
          className={`k-dot ${shapes[i]} ${i === index ? 'is-active' : ''}`}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Login
 * ------------------------------------------------------------------ */

export default function LoginScreen() {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usernameRef = useRef(null);

  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  // Advance the showcase slowly, and stop while it is being read or the tab is
  // in the background.
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 7000);
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [paused]);

  /* Clearing the error as soon as the user edits either field. Previously it
     stayed on screen until the next submit, so a corrected password still sat
     under an error message. */
  const onUsername = (e) => {
    setUsername(e.target.value);
    if (error) setError('');
  };
  const onPassword = (e) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    const result = await login(username, password);
    if (!result.success) {
      setError(result.reason);
      setIsSubmitting(false);
    }
    // On success the provider swaps this screen out, so isSubmitting is
    // deliberately left true to keep the button inert during the transition.
  }, [isSubmitting, login, username, password]);

  const ready = username.trim().length > 0 && password.length > 0;

  return (
    <div className="k-page">
      {/* ---------------- Auth column ---------------- */}
      <section className="k-auth">
        <div className="k-auth__inner">
          <div className="k-logo-row">
            <span className="k-logo">
              <BrandMark />
              TrackSimply
            </span>
          </div>

          <h1 className="k-headline">Sign in to TrackSimply</h1>

          <form onSubmit={handleLogin} className="k-form" noValidate>
            <label className="k-field-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              ref={usernameRef}
              className="k-field"
              type="text"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Your username"
              value={username}
              onChange={onUsername}
              disabled={isSubmitting}
              required
            />

            <label className="k-field-label" htmlFor="login-password">Password</label>
            <div className="k-password">
              <input
                id="login-password"
                className="k-field"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={onPassword}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="k-reveal"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>

            {/* aria-live so a failed attempt is announced, not just shown. */}
            <div className="k-error-slot" role="alert" aria-live="polite">
              {error && <p className="k-error">{error}</p>}
            </div>

            <button
              type="submit"
              className={`k-submit ${ready ? 'is-ready' : ''}`}
              disabled={isSubmitting || !ready}
            >
              {isSubmitting ? 'Verifying account…' : 'Sign in'}
            </button>
          </form>

          <p className="k-note">
            Accounts are created by an administrator. If you need access, ask the person who
            set up your workspace.
          </p>
        </div>
      </section>

      {/* ---------------- Showcase column ---------------- */}
      <section
        className="k-showcase"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="k-decor" aria-hidden="true">
          <span className="k-shape k-square-outline" />
          <span className="k-shape k-triangle" />
          <span className="k-shape k-pentagon" />
          <span className="k-shape k-blob k-blob-1" />
          <span className="k-shape k-badge"><span className="k-badge-text">TS</span></span>
          <span className="k-shape k-blob k-blob-2" />
          <span className="k-shape k-quarter" />
          <span className="k-shape k-diamond-outline" />
        </div>

        <div className="k-welcome" aria-live="polite">
          <h2>{SLIDES[slide].title}</h2>
          <p>{SLIDES[slide].body}</p>
        </div>

        <SlideDots index={slide} onSelect={setSlide} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

export function LoadingScreen() {
  return (
    <div className="k-page k-page--center">
      <div className="k-loading">
        <div className="k-spinner" />
        <p>Connecting to your workspace…</p>
      </div>
    </div>
  );
}