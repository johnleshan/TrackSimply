import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/landing.css';

/* ==================================================================== *
 * TrackSimply landing — adapted from the "Vesper" editorial design.
 *
 * A near-black, gallery-style page presented before sign-in. All motion is
 * hand-rolled (IntersectionObserver reveals, rAF lerp pointer parallax,
 * scroll-bound word reveal, count-ups) — no animation dependencies.
 *
 * Every effect below registers its cleanup; when the landing unmounts the
 * grain/vignette overlays and all listeners go with it.
 * ==================================================================== */

const LOADER_KEY = 'tl_loader_seen';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ *
 * Shared atoms
 * ------------------------------------------------------------------ */

const utcClock = () => new Date().toISOString().slice(11, 19);

/* Live mono clock, ticks every second. Used in the hero footbar and footer. */
function Clock({ className = '' }) {
  const [now, setNow] = useState(utcClock);
  useEffect(() => {
    const id = setInterval(() => setNow(utcClock()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{now}</span>;
}

/* Mono label with the pulsing 6px accent dot. */
function Eyebrow({ children }) {
  return (
    <p className="tl-eyebrow">
      <span className="tl-eyebrow__dot" aria-hidden="true" />
      <span className="tl-eyebrow__text">{children}</span>
    </p>
  );
}

/* Headline words wrapped for the clip-rise entrance (triggered by
   `.is-ready` on the root once the loader has faded). */
function RiseWords({ text, italic = false, base = 0 }) {
  const words = text.split(' ');
  return (
    <span className={`tl-rise${italic ? ' tl-rise--italic' : ''}`} aria-label={text}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="tl-rise__word" aria-hidden="true">
          <span className="tl-rise__inner" style={{ transitionDelay: `${base + i * 90}ms` }}>
            {word}
          </span>
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Overlays: film grain + breathing vignette (mounted with the landing,
 * gone when it unmounts)
 * ------------------------------------------------------------------ */

function FilmGrain() {
  return (
    <>
      <svg className="tl-grain" aria-hidden="true" focusable="false">
        <filter id="tl-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#tl-grain-filter)" />
      </svg>
      <div className="tl-vignette" aria-hidden="true" />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Loader — counts 00 → 100 on first visit per browser session
 * ------------------------------------------------------------------ */

function Loader({ onDone }) {
  const [count, setCount] = useState(0);
  const [coords, setCoords] = useState('0.00000 · 0.00000 · KES');
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const reduced = prefersReduced();
    const duration = reduced ? 60 : 2200;
    const fadeAfter = reduced ? 120 : 1100;
    let raf = 0;
    let scrambler = 0;
    let doneTimer = 0;
    const start = performance.now();
    /* ease-out cubic — a close match for cubic-bezier(0.22, 1, 0.36, 1) */
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setCount(Math.round(ease(t) * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setFading(true);
        doneTimer = setTimeout(onDone, fadeAfter);
      }
    };

    if (!reduced) {
      scrambler = setInterval(() => {
        const seed = () => (Math.random() * (Math.random() < 0.5 ? 3.5 : 45)).toFixed(5);
        const tags = ['KES', 'NAIROBI', 'UTC+3', 'LEDGER'];
        setCoords(`${seed()} · ${seed()} · ${tags[Math.floor(Math.random() * tags.length)]}`);
      }, 85);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(scrambler);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className={`tl-loader${fading ? ' is-fading' : ''}`} aria-hidden="true">
      <div className="tl-loader__inner">
        <span className="tl-loader__label">— Locating —</span>
        <span className="tl-loader__count">{String(count).padStart(2, '0')}</span>
        <div className="tl-loader__track">
          <span className="tl-loader__fill" style={{ width: `${count}%` }} />
        </div>
        <span className="tl-loader__coords">{coords}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: 'Platform', target: 'tl-platform' },
  { label: 'Method', target: 'tl-method' },
];

function Hero({ onStepInside }) {
  const goto = (e, target) => {
    e.preventDefault();
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReduced() ? 'instant' : 'smooth', block: 'start' });
  };

  return (
    <section className="tl-hero">
      <header className="tl-hero__topbar">
        <div className="tl-topbar__brand tl-wordmark">TrackSimply</div>
        <div className="tl-topbar__edition tl-label">Edition 001 · V 1.1.0</div>
        <nav className="tl-topbar__nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              className="tl-nav__link"
              href={`#${link.target}`}
              onClick={(e) => goto(e, link.target)}
            >
              {link.label}
            </a>
          ))}
          <button type="button" className="tl-nav__link tl-nav__link--begin" onClick={onStepInside}>
            Begin
          </button>
        </nav>
      </header>

      <div className="tl-hero__mid">
        <Eyebrow>Designation · Small Business Ledgers · KES</Eyebrow>

        <h1 className="tl-hero__headline tl-display">
          <span className="tl-hero__line">
            <RiseWords text="Not records." base={0} />
          </span>
          <span className="tl-hero__line tl-hero__line--italic">
            <RiseWords text="Reports." base={260} italic />
          </span>
        </h1>

        <div className="tl-hero__stage">
          <div className="tl-frame" aria-hidden="true">
            <span className="tl-frame__tick tl-frame__tick--tl" />
            <span className="tl-frame__tick tl-frame__tick--tr" />
            <span className="tl-frame__tick tl-frame__tick--bl" />
            <span className="tl-frame__tick tl-frame__tick--br" />
          </div>
          {/* Porthole on a moonlit business horizon — pure CSS gradients. */}
          <div className="tl-port" aria-hidden="true">
            <div className="tl-port__art" data-tl-drift>
              <span className="tl-port__sky" />
              <span className="tl-port__haze" />
              <span className="tl-port__glow" data-tl-parallax data-tl-depth="4" />
              <span className="tl-port__moon" data-tl-parallax data-tl-depth="8" />
              <span className="tl-port__ridge" data-tl-parallax data-tl-depth="12" />
              <span className="tl-port__hills" data-tl-parallax data-tl-depth="17" />
              <span className="tl-port__fog" />
              <span className="tl-port__grid" />
            </div>
          </div>
        </div>

        <p className="tl-hero__sub tl-body">
          A bookkeeping desk that keeps your numbers: transactions, debts, budgets, stock and a fleet
          in one place — with an assistant that answers in plain speech.
        </p>

        <button type="button" className="tl-cta" onClick={onStepInside}>
          Step inside <span className="tl-cta__arrow">→</span>
        </button>
      </div>

      <footer className="tl-hero__footbar">
        <span className="tl-label">−0.29213 · 36.08030 · Nairobi</span>
        <span className="tl-label">
          Real-time · <Clock className="tl-clock" /> UTC
        </span>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Manifesto — scroll-bound per-word reveal over a 250vh runway
 * ------------------------------------------------------------------ */

const MANIFESTO =
  'A ledger should behave like a ledger. Every number traceable, every entry exactly once, no row hidden behind a pagination cap. TrackSimply is built to be trusted with the client’s money — so it counts everything and shows its work.';

function Manifesto() {
  return (
    <section className="tl-manifesto">
      <div className="tl-manifesto__pin">
        <p className="tl-manifesto__text tl-manifesto-type" aria-label={MANIFESTO}>
          {MANIFESTO.split(' ').map((word, i) => (
            <span key={`${word}-${i}`} className="tl-word--m" aria-hidden="true">
              {word}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Selected works → "The Instruments" (five asymmetric plates)
 * ------------------------------------------------------------------ */

const PLATES = [
  {
    numeral: 'I',
    title: 'Bookkeeping',
    desc: 'Every shilling accounted — income, expense, source and fleet on one line.',
    meta: 'Plate 01 · MMXXVI · REST + POSTGRES',
    span: 'p1',
  },
  {
    numeral: 'II',
    title: 'Analytics',
    desc: 'Charts that explain themselves — pulse tooltips, print-ready.',
    meta: 'Plate 02 · MMXXVI · SVG CHARTS',
    span: 'p2',
  },
  {
    numeral: 'III',
    title: 'Budget Planner',
    desc: 'Spending against targets while it happens.',
    meta: 'Plate 03 · MMXXVI · BURN RATE',
    span: 'p3',
  },
  {
    numeral: 'IV',
    title: 'Debt Tracker',
    desc: 'What is owed, and when it clears.',
    meta: 'Plate 04 · MMXXVI · RECONCILE',
    span: 'p4',
  },
  {
    numeral: 'V',
    title: 'Inventory & Fleet',
    desc: 'Stock and vehicles in the same breath.',
    meta: 'Plate 05 · MMXXVI · MOVEMENT',
    span: 'p5',
  },
];

function Plate({ plate, i, onStepInside }) {
  return (
    <div className={`tl-plate-row tl-row--${plate.span}`}>
      <article
        className={`tl-plate tl-plate--${plate.span}`}
        data-reveal
        style={{ '--tl-delay': `${80 + i * 135}ms` }}
      >
        <div className="tl-plate__artbox">
          <div className="tl-plate__art" data-tl-drift>
            <span className={`tl-plate__artfill tl-art--${plate.span}`} aria-hidden="true" />
          </div>
          {/* Numeral sits on the artbox (not the drifting art) so the ±6%
              scroll drift never carries it out of the clipped frame. */}
          <span className="tl-plate__numeral" aria-hidden="true">
            {plate.numeral}
          </span>
        </div>
        <div className="tl-plate__meta">
          <span className="tl-label tl-plate__meta-line">{plate.meta}</span>
          <h3 className="tl-plate__title">{plate.title}</h3>
          <p className="tl-plate__desc tl-body">{plate.desc}</p>
          <button type="button" className="tl-plate__view" onClick={onStepInside}>
            View <span className="tl-plate__view-arrow">→</span>
          </button>
        </div>
      </article>
    </div>
  );
}

function PlatesSection({ onStepInside }) {
  return (
    <section id="tl-platform" className="tl-plates">
      <div className="tl-section">
        <div className="tl-section__head" data-reveal>
          <Eyebrow>Selected Works · The Instruments</Eyebrow>
        </div>
        <div className="tl-plates__stack">
          {PLATES.map((plate, i) => (
            <Plate key={plate.numeral} plate={plate} i={i} onStepInside={onStepInside} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Method / studio
 * ------------------------------------------------------------------ */

const METHOD_NOTES = ['180+ assertions', 'Snapshot before · after', 'Read-only live mode', 'AI keys server-side'];

function Method() {
  return (
    <section id="tl-method" className="tl-method">
      <div className="tl-section tl-method__grid">
        <div className="tl-method__side" data-reveal>
          <span className="tl-label tl-method__corner">Studio Note · 001</span>
        </div>
        <div className="tl-method__main">
          <h2 className="tl-method__title tl-display-italic" data-reveal>
            Testable by construction.
          </h2>
          <p className="tl-method__body tl-body" data-reveal style={{ '--tl-delay': '120ms' }}>
            No test framework ceremony. The desk is held up by 180+ assertions that run before
            anything ships, and a snapshot of the books is verified before and after every change —
            if any number moves without a reason, the change is thrown away.
          </p>
          <p className="tl-method__body tl-body" data-reveal style={{ '--tl-delay': '240ms' }}>
            Live mode opens read-only, so you can browse real accounts in the confidence that nothing
            is touched. And the assistant is proxied server-side: its key never rides to your
            browser.
          </p>
        </div>
        <div className="tl-method__notes" data-reveal style={{ '--tl-delay': '180ms' }}>
          {METHOD_NOTES.map((note, i) => (
            <span key={note} className="tl-method__note">
              <span className="tl-method__note-index">{`${'I'.repeat(i + 1)}.`}</span>
              {note}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Numbers — count up on scroll into view
 * ------------------------------------------------------------------ */

const NUMBERS = [
  { index: 'I.', value: 6, label: 'Tools, one place' },
  { index: 'II.', value: 100, suffix: '%', label: 'Every row read, not the first thousand' },
  { index: 'III.', value: 45, label: 'Account rules asserted' },
  { index: '∞', value: null, label: 'In progress', open: true },
];

function NumberItem({ item }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (item.value == null) return undefined;
    if (prefersReduced()) {
      setDisplay(item.value);
      return undefined;
    }
    let raf = 0;
    let io;
    const duration = 1600;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const start = () => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        setDisplay(Math.round(ease(t) * item.value));
        if (t < 1) raf = window.requestAnimationFrame(step);
      };
      raf = window.requestAnimationFrame(step);
    };
    io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            io.disconnect();
            start();
          }
        });
      },
      { threshold: 0.4 },
    );
    if (ref.current) io.observe(ref.current);
    return () => {
      if (io) io.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [item.value]);

  return (
    <div ref={ref} className={`tl-num__item${item.open ? ' tl-num__item--open' : ''}`}>
      <span className="tl-num__index tl-label">{item.index}</span>
      <span className="tl-num__value tl-numeral">
        {item.value == null ? '∞' : display}
        {item.value != null && item.suffix ? item.suffix : ''}
      </span>
      <span className="tl-num__label tl-label">{item.label}</span>
    </div>
  );
}

function Numbers() {
  return (
    <section className="tl-numbers">
      <div className="tl-section">
        <div className="tl-numbers__row">
          {NUMBERS.map((item) => (
            <NumberItem key={item.index} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Closing + footer
 * ------------------------------------------------------------------ */

const CLOSING_META = ['Edition 001 — MMXXVI', 'Hand-built', 'No frameworks on the surface', 'Every row, accounted'];

function Closing({ onStepInside }) {
  return (
    <section id="tl-begin" className="tl-closing">
      <div className="tl-section">
        <div className="tl-closing__grid">
          <div className="tl-closing__left" data-reveal>
            <Eyebrow>Begin</Eyebrow>
            <h2 className="tl-closing__title tl-display-italic">Open the books.</h2>
            <p className="tl-closing__body tl-body">
              The desk is ready. Your ledgers keep themselves the moment you sign in — and answer
              back, quietly, when asked.
            </p>
            <button type="button" className="tl-cta" onClick={onStepInside}>
              Open the books <span className="tl-cta__arrow">→</span>
            </button>
          </div>
          <div className="tl-closing__meta" data-reveal style={{ '--tl-delay': '140ms' }}>
            {CLOSING_META.map((line) => (
              <span key={line} className="tl-closing__meta-line tl-label">
                {line}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="tl-close__wordmark" aria-hidden="true">
        TrackSimply
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="tl-footer">
      <span className="tl-label">— : —</span>
      <span className="tl-label">
        <Clock className="tl-clock" /> · UTC
      </span>
      <span className="tl-label">Hand-built · One ledger, held still</span>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * Landing root — owns the shared motion loops
 * ------------------------------------------------------------------ */

export default function Landing({ onStepInside }) {
  const rootRef = useRef(null);
  const [showLoader, setShowLoader] = useState(() => {
    try {
      return !window.sessionStorage.getItem(LOADER_KEY);
    } catch {
      return true; /* storage unavailable — play the loader anyway */
    }
  });
  const [loaderDone, setLoaderDone] = useState(!showLoader);

  /* Stable: the Loader holds it across a rAF loop. */
  const handleLoaderDone = useCallback(() => {
    try {
      window.sessionStorage.setItem(LOADER_KEY, '1');
    } catch {
      /* ignore — the loader simply replays next session */
    }
    setLoaderDone(true);
    setShowLoader(false);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reduced = prefersReduced();

    /* --- Section reveals ------------------------------------------- */
    const revealEls = root.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    revealEls.forEach((el) => io.observe(el));

    let cleanups = [];

    if (reduced) {
      /* Everything is shown straight away; no loops are spun. */
      revealEls.forEach((el) => el.classList.add('is-revealed'));
      root.querySelectorAll('.tl-word--m').forEach((w) => w.classList.add('is-lit'));
    } else {
      /* --- Pointer parallax (hero layers, rAF-lerped) ---------------- */
      const parallaxEls = root.querySelectorAll('[data-tl-parallax]');
      let tx = 0;
      let ty = 0;
      let px = 0;
      let py = 0;
      let pointerRaf = 0;
      const onPointerMove = (e) => {
        tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      const pointerLoop = () => {
        px += (tx - px) * 0.065;
        py += (ty - py) * 0.065;
        parallaxEls.forEach((el) => {
          const depth = Number(el.dataset.tlDepth) || 8;
          el.style.transform = `translate3d(${(-px * depth).toFixed(2)}px, ${(-py * depth).toFixed(2)}px, 0)`;
        });
        pointerRaf = window.requestAnimationFrame(pointerLoop);
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      pointerRaf = window.requestAnimationFrame(pointerLoop);
      cleanups.push(() => {
        window.removeEventListener('pointermove', onPointerMove);
        window.cancelAnimationFrame(pointerRaf);
      });

      /* --- Scroll loops: art drift + manifesto words ----------------- */
      const driftEls = root.querySelectorAll('[data-tl-drift]');
      const manifesto = root.querySelector('.tl-manifesto');
      const manifestoWords = root.querySelectorAll('.tl-word--m');
      let scrollRaf = 0;
      let ticking = false;

      const onScrollFrame = () => {
        ticking = false;
        const vh = window.innerHeight;

        /* Art drifts ±6% of its own travel across the viewport. */
        driftEls.forEach((box) => {
          const rect = box.getBoundingClientRect();
          const center = rect.top + rect.height / 2 - vh / 2;
          const range = vh / 2 + rect.height / 2;
          const p = Math.max(-1, Math.min(1, center / range));
          box.style.setProperty('--tl-drift', `${(-p * 6).toFixed(2)}%`);
        });

        /* Manifesto: per-word opacity across the sticky runway. */
        if (manifesto) {
          const total = manifesto.offsetHeight - vh;
          const scrolled = Math.max(0, Math.min(-manifesto.getBoundingClientRect().top, total));
          const progress = total > 0 ? scrolled / total : 1;
          const lit = Math.round(progress * (manifestoWords.length + 3));
          manifestoWords.forEach((word, i) => {
            word.classList.toggle('is-lit', i < lit);
          });
        }
      };
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        scrollRaf = window.requestAnimationFrame(onScrollFrame);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      onScroll();
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        window.cancelAnimationFrame(scrollRaf);
      });
    }

    /* Landing unmounted → drop the reader at the top of the next screen. */
    return () => {
      io.disconnect();
      cleanups.forEach((fn) => fn());
      cleanups = [];
    };
  }, []);

  /* Return the reader to the top of the next screen when the landing goes. */
  useEffect(() => {
    return () => {
      window.scrollTo(0, 0);
    };
  }, []);

  return (
    <div ref={rootRef} className={`tl-root${loaderDone ? ' is-ready' : ''}`}>
      <FilmGrain />
      {showLoader && <Loader onDone={handleLoaderDone} />}
      <main className="tl-page">
        <Hero onStepInside={onStepInside} />
        <div className="tl-rule tl-rule--flush" aria-hidden="true" />
        <Manifesto />
        <div className="tl-rule" aria-hidden="true" />
        <PlatesSection onStepInside={onStepInside} />
        <div className="tl-rule" aria-hidden="true" />
        <Method />
        <div className="tl-rule" aria-hidden="true" />
        <Numbers />
        <div className="tl-rule" aria-hidden="true" />
        <Closing onStepInside={onStepInside} />
        <Footer />
      </main>
    </div>
  );
}
