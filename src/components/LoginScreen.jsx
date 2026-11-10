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

/* Google's mark, drawn inline. Four separate paths, not an emoji, so it looks
   the same on every platform. */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
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

export default function LoginScreen({ onBack }) {
  const { login, loginWithAuth0, loginWithGoogle, auth0Error } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // '' | 'google' | 'auth0' — which redirect is in flight, so only that button
  // changes to its "Opening…" label.
  const [authBusy, setAuthBusy] = useState('');

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

  /* The redirect leaves the page, so these only resolve without navigating when
     the provider could not be reached — the reason is then shown above. */
  const handleGoogle = async () => {
    if (authBusy || isSubmitting) return;
    setAuthBusy('google');
    await loginWithGoogle();
    setAuthBusy('');
  };

  const handleAuth0 = async () => {
    if (authBusy || isSubmitting) return;
    setAuthBusy('auth0');
    await loginWithAuth0();
    setAuthBusy('');
  };

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
              {!error && auth0Error && <p className="k-error">{auth0Error}</p>}
            </div>

            <button
              type="submit"
              className={`k-submit ${ready ? 'is-ready' : ''}`}
              disabled={isSubmitting || !ready}
            >
              {isSubmitting ? 'Verifying account…' : 'Sign in'}
            </button>
          </form>

          <div className="k-divider" role="separator" aria-label="or">
            <span>or</span>
          </div>

          {/* Both of these prove identity only. The role still comes from the
              account an administrator linked to the verified email, so neither
              button can grant more than that account already has. */}
          <button
            type="button"
            className="k-google"
            onClick={handleGoogle}
            disabled={Boolean(authBusy) || isSubmitting}
          >
            <GoogleIcon />
            <span>{authBusy === 'google' ? 'Opening Google…' : 'Continue with Google'}</span>
          </button>

          <button
            type="button"
            className="k-auth0"
            onClick={handleAuth0}
            disabled={Boolean(authBusy) || isSubmitting}
          >
            {authBusy === 'auth0' ? 'Opening Auth0…' : 'Continue with Auth0'}
          </button>

          <p className="k-auth0-note">
            Use the verified email an administrator linked to your account.
          </p>

          <p className="k-note">
            Accounts are created by an administrator. If you need access, ask the person who
            set up your workspace.
          </p>

          {/* Optional escape hatch back to the public landing page. Renders nothing
              (and changes nothing) when no onBack callback is passed. */}
          {onBack && (
            <button type="button" className="k-back" onClick={onBack}>
              ← Back
            </button>
          )}
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