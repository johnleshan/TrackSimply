import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/landing.css';

/* ==================================================================== *
 * TrackSimply landing — zine / brutalist editorial.
 *
 * Loud, flat, square. Poster-scale Bebas Neue against Space Grotesk, four
 * "voltage" colours on a near-black canvas, hard offset shadows and a
 * 0-radius geometry throughout.
 *
 * Motion is GSAP 3.12.5 + ScrollTrigger, loaded from a CDN in index.html.
 * If the CDN is unreachable, or the visitor prefers reduced motion, the page
 * falls back to a static, fully-legible layout rather than a broken one.
 *
 * Everything lives under `.tl-root` with `tl-` classes so nothing leaks into
 * the signed-in app. The grain overlay and every listener are mounted with
 * this component and removed with it.
 * ==================================================================== */

/* ------------------------------------------------------------------ *
 * Tokens / small helpers
 * ------------------------------------------------------------------ */

const VOLT = {
  orange: '#FF6B1A',
  pink: '#FF2D78',
  lime: '#BFFF00',
  blue: '#0057FF',
};

const INK = '#F5F0E8';
const BLACK = '#0D0D0D';

/* Bright voltages take black type (highest contrast); the deep blue takes
   off-white. This keeps every block legible rather than merely loud. */
const onVoltage = (key) => (key === 'blue' ? INK : BLACK);

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* A die-cut starburst as a percentage clip-path. */
function starClip(points = 18, inner = 0.62) {
  const pts = [];
  const total = points * 2;
  for (let i = 0; i < total; i += 1) {
    const r = i % 2 === 0 ? 50 : 50 * inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`);
  }
  return `polygon(${pts.join(', ')})`;
}

const STICKER_CLIP = starClip(20, 0.64);

const utcClock = () => new Date().toISOString().slice(11, 19);

/* Live UTC clock, ticks every second. */
function Clock({ className = '' }) {
  const [now, setNow] = useState(utcClock);
  useEffect(() => {
    const id = setInterval(() => setNow(utcClock()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{now}</span>;
}

/* ------------------------------------------------------------------ *
 * Overlays — grain + vignette, mounted/unmounted with the landing
 * ------------------------------------------------------------------ */

function Overlays() {
  return (
    <>
      <svg className="tl-grain" aria-hidden="true" focusable="false">
        <filter id="tl-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#tl-grain-filter)" />
      </svg>
      <div className="tl-vignette" aria-hidden="true" />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Nav — transparent over the hero, glass after the first scroll
 * ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: 'Platform', target: 'tl-platform' },
  { label: 'Method', target: 'tl-method' },
];

function Nav({ glass, ink, onBegin, onJump }) {
  return (
    <header
      className={`tl-nav${glass ? ' is-glass' : ''}`}
      style={{ '--nav-ink': glass ? INK : ink }}
    >
      <span className="tl-nav__logo tl-display">TrackSimply</span>
      <nav className="tl-nav__links" aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            className="tl-nav__link"
            href={`#${link.target}`}
            onClick={(e) => {
              e.preventDefault();
              onJump(link.target);
            }}
          >
            {link.label}
          </a>
        ))}
        <button type="button" className="tl-nav__link tl-nav__link--begin" onClick={onBegin}>
          Begin
        </button>
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * Hero — four voltage slides, scroll-hijacked
 * ------------------------------------------------------------------ */

/*
 * Each slide carries its OWN screenshot of the real app.
 *
 * The porthole previously rendered /screenshots/dashboard.png on all four
 * slides, so the colour and the copy changed while the product never did — the
 * one thing a product page exists to avoid. The slide is about a different
 * claim, so it shows a different screen.
 */
const SLIDES = [
  {
    key: 'orange',
    tag: 'Business bookkeeping, plainly.',
    kicker: 'One ledger, held still',
    btn: 'Shop Now',
    img: '/screenshots/bookkeeping.png',
    view: 'Bookkeeping',
  },
  {
    key: 'pink',
    tag: 'Every shilling, every row. No page left behind.',
    kicker: 'Books that behave like books',
    btn: 'Get Started →',
    img: '/screenshots/analytics.png',
    view: 'Analytics',
  },
  {
    key: 'lime',
    tag: 'Snapshot before. Snapshot after. Nothing moves without a reason.',
    kicker: 'Verified by construction',
    btn: 'Get Started →',
    img: '/screenshots/dashboard.png',
    view: 'Dashboard',
  },
  {
    key: 'blue',
    tag: 'Live mode is read-only. The AI key never reaches your browser.',
    kicker: 'Safe to look, safe to leave',
    btn: 'Get Started →',
    img: '/screenshots/inventory.png',
    view: 'Inventory & Fleet',
  },
];

/*
 * Slide pacing.
 *
 * The hero used to advance on a single wheel tick and unlocked the instant the
 * tween finished, so one flick of a trackpad scrolled past two or three slides
 * and nothing was legible. Worse, the copy and the colour changed while the
 * screenshot stayed on Dashboard, so the product looked identical across four
 * different claims.
 *
 * Two changes: each slide now shows the screen it is talking about, and
 * advancing now costs deliberate effort and then holds.
 *
 *   SLIDE_MS     how long the wipe takes. Longer than the flick that triggers
 *                it, so input during a transition is ignored rather than queued.
 *   DWELL_MS     after a transition settles, the hero refuses further input.
 *                This is the read time — the whole point of the hijack is that
 *                each slide is seen, not skimmed.
 *   WHEEL_GATE   accumulated wheel delta needed to commit a move. A trackpad
 *                emits many small deltas per flick, so without a threshold one
 *                gesture equals several slides.
 */
const SLIDE_MS = 0.95;
const DWELL_MS = 1100;
const WHEEL_GATE = 140;

function Hero({ onStepInside }) {
  const [index, setIndex] = useState(0);
  const [glass, setGlass] = useState(false);
  const indexRef = useRef(0);
  const lockedRef = useRef(false);
  const slideRefs = useRef([]);
  const gateRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  /* Nav glass after the first scroll. */
  useEffect(() => {
    const onScroll = () => setGlass(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const animateTo = useCallback((next, dir) => {
    const from = slideRefs.current[indexRef.current];
    const to = slideRefs.current[next];
    if (!from || !to) return;

    const gsap = window.gsap;
    if (!gsap || prefersReduced()) {
      slideRefs.current.forEach((el, i) => {
        if (!el) return;
        el.style.visibility = i === next ? 'visible' : 'hidden';
        el.style.clipPath = 'none';
        el.style.zIndex = i === next ? 3 : 1;
      });
      indexRef.current = next;
      setIndex(next);
      return;
    }

    lockedRef.current = true;
    const enterFrom = dir >= 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
    gsap.set(to, { visibility: 'visible', zIndex: 3, clipPath: enterFrom });
    gsap.set(from, { zIndex: 2, clipPath: 'inset(0 0 0 0)' });

    const dwellTimer = setTimeout(() => {
      lockedRef.current = false;
    }, SLIDE_MS * 1000 + DWELL_MS);

    gsap
      .timeline({
        defaults: { duration: SLIDE_MS, ease: 'power3.inOut' },
        onComplete: () => {
          gsap.set(from, { visibility: 'hidden', clipPath: 'inset(0 0 0 0)' });
          gsap.set(to, { clipPath: 'inset(0 0 0 0)' });
        },
        onInterrupt: () => clearTimeout(dwellTimer),
      })
      .to(to, { clipPath: 'inset(0 0 0 0)' }, 0);

    indexRef.current = next;
    setIndex(next);
  }, []);

  const goNext = useCallback(() => {
    if (lockedRef.current || indexRef.current >= SLIDES.length - 1) return;
    animateTo(indexRef.current + 1, 1);
  }, [animateTo]);

  const goPrev = useCallback(() => {
    if (lockedRef.current || indexRef.current <= 0) return;
    animateTo(indexRef.current - 1, -1);
  }, [animateTo]);

  /* Body lock while the hijack is engaged (everything but the last slide). */
  useEffect(() => {
    if (prefersReduced()) return undefined;
    const locked = index < SLIDES.length - 1;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [index]);

  /* Wheel / touch / keys. Cleaned up on unmount. */
  useEffect(() => {
    if (prefersReduced()) return undefined;

    const atTop = () => window.scrollY <= 4;

    const onWheel = (e) => {
      if (!atTop()) return;

      const atLast = indexRef.current >= SLIDES.length - 1;
      const atFirst = indexRef.current <= 0;

      /* Past the last slide (or back up from the first) the hero has nothing
         left to say, so the page must scroll normally again. Swallowing the
         event here would strand the visitor at the end of the hijack. */
      if ((e.deltaY > 0 && atLast) || (e.deltaY < 0 && atFirst)) {
        gateRef.current = 0;
        return;
      }

      /* A trackpad flick arrives as a burst of small deltas. Sum them and only
         commit once the gesture has clearly been made, so one flick is one
         slide instead of three. */
      gateRef.current += e.deltaY;
      e.preventDefault();

      if (Math.abs(gateRef.current) < WHEEL_GATE) return;

      const dir = gateRef.current > 0 ? 1 : -1;
      gateRef.current = 0;

      if (dir > 0) goNext();
      else goPrev();
    };

    let touchY = 0;
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (!atTop()) return;
      const dy = touchY - e.touches[0].clientY;
      /* 110px, not 32: on touch the same flick that skipped three slides on a
         trackpad does it here, and a swipe that short is not a decision. */
      if (Math.abs(dy) < 110) return;
      if (dy > 0 && indexRef.current < SLIDES.length - 1) {
        e.preventDefault();
        touchY = e.touches[0].clientY;
        goNext();
      } else if (dy < 0 && indexRef.current > 0) {
        e.preventDefault();
        touchY = e.touches[0].clientY;
        goPrev();
      }
    };

    const onKey = (e) => {
      if (!atTop()) return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key) && indexRef.current < SLIDES.length - 1) {
        e.preventDefault();
        goNext();
      } else if (['ArrowUp', 'PageUp'].includes(e.key) && indexRef.current > 0) {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [goNext, goPrev]);

  /* Snap out of the hijack so a nav jump can scroll freely. */
  const exitHero = useCallback((target) => {
    const last = SLIDES.length - 1;
    slideRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transition = 'none';
      el.style.clipPath = 'none';
      el.style.visibility = i === last ? 'visible' : 'hidden';
      el.style.zIndex = i === last ? 3 : 1;
    });
    indexRef.current = last;
    setIndex(last);
    document.body.style.overflow = '';
    window.requestAnimationFrame(() => {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
    });
  }, []);

  const activeInk = onVoltage(SLIDES[index].key);

  return (
    <section className="tl-hero" aria-roledescription="carousel" aria-label="TrackSimply">
      <Nav glass={glass} ink={activeInk} onBegin={onStepInside} onJump={exitHero} />

      <div className="tl-slides">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.key}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className={`tl-slide tl-slide--${slide.key}${i === 0 ? ' is-active' : ''}`}
            style={{ '--slide-c': VOLT[slide.key], '--slide-ink': onVoltage(slide.key) }}
            aria-hidden={i !== index}
          >
            <div className="tl-slide__text">
              <p className="tl-slide__index">
                <span>{slide.kicker}</span>
                <span className="tl-slide__index-sep">· {String(i + 1).padStart(2, '0')}/04</span>
              </p>
              <h1 className="tl-slide__brand tl-display">TrackSimply</h1>
              <p className="tl-slide__tag">{slide.tag}</p>
              <button type="button" className="tl-btn" onClick={onStepInside}>
                {slide.btn}
              </button>
            </div>

            <div className="tl-slide__port">
              <div className="tl-frame" aria-hidden="true">
                <span className="tl-frame__tick tl-frame__tick--tl" />
                <span className="tl-frame__tick tl-frame__tick--tr" />
                <span className="tl-frame__tick tl-frame__tick--bl" />
                <span className="tl-frame__tick tl-frame__tick--br" />
              </div>
              <div className="tl-port">
                <img
                  className="tl-port__img"
                  src={slide.img}
                  alt={`TrackSimply ${slide.view} in dark mode`}
                  decoding="async"
                  fetchpriority={i === 0 ? 'high' : 'low'}
                />
              </div>
              <span className="tl-slide__caption">{slide.view} · Dark mode</span>
            </div>
          </div>
        ))}
      </div>

      {/* progress dots */}
      <div className="tl-dots" role="tablist" aria-label="Hero slides">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.key}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to ${slide.key} slide`}
            className={`tl-dot${i === index ? ' is-active' : ''}`}
            style={{ '--dot-c': VOLT[slide.key] }}
            onClick={() => {
              if (i !== indexRef.current) animateTo(i, i > indexRef.current ? 1 : -1);
            }}
          />
        ))}
      </div>

      {/* vertical scroll cue */}
      <div className="tl-cue" aria-hidden="true">
        <span className="tl-cue__label">Scroll</span>
        <span className="tl-cue__line" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Marquee
 * ------------------------------------------------------------------ */

const MARQUEE = ['Bookkeeping', 'Analytics', 'Debts', 'Budgets', 'Inventory', 'Fleet'];
const MARQUEE_VOLTS = ['orange', 'pink', 'lime', 'blue'];

function Marquee() {
  const group = (
    <div className="tl-marquee__group" aria-hidden="true">
      {MARQUEE.map((word, i) => (
        <React.Fragment key={word}>
          <span className="tl-marquee__word">{word}</span>
          <span className="tl-marquee__star" style={{ color: VOLT[MARQUEE_VOLTS[i % 4]] }}>
            ✦
          </span>
        </React.Fragment>
      ))}
    </div>
  );
  return (
    <div className="tl-marquee" role="presentation">
      <div className="tl-marquee__track">
        {group}
        {group}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * "The Instruments" — five voltage strips
 * ------------------------------------------------------------------ */

const STRIPS = [
  { n: '01', roman: 'I', title: 'Bookkeeping', tag: 'Ledger', volt: 'orange', img: '/screenshots/bookkeeping.png', specs: ['Every row read', 'Sources & fleet on one line'], label: 'In the suite' },
  { n: '02', roman: 'II', title: 'Analytics', tag: 'Insight', volt: 'pink', img: '/screenshots/analytics.png', specs: ['Charts that explain', 'Print-ready reports'], label: 'In the suite' },
  { n: '03', roman: 'III', title: 'Budget Planner', tag: 'Targets', volt: 'lime', img: '/screenshots/budget.png', specs: ['Spend vs target', 'While it happens'], label: 'In the suite' },
  { n: '04', roman: 'IV', title: 'Debt Tracker', tag: 'Liabilities', volt: 'blue', img: '/screenshots/debt.png', specs: ['What is owed', 'When it clears'], label: 'In the suite' },
  { n: '05', roman: 'V', title: 'Inventory & Fleet', tag: 'Stock', volt: 'orange', img: '/screenshots/inventory.png', specs: ['Stock and vehicles', 'In the same breath'], label: 'In the suite' },
];

function Instruments({ onStepInside }) {
  return (
    <section id="tl-platform" className="tl-instruments">
      <div className="tl-section-head" data-reveal>
        <p className="tl-kicker">Selected works · The suite</p>
        <h2 className="tl-display-section">The Instruments</h2>
      </div>

      <div className="tl-strips">
        {STRIPS.map((s) => (
          <article
            key={s.title}
            className={`tl-strip tl-strip--${s.volt}`}
            style={{ '--strip-c': VOLT[s.volt], '--strip-ink': onVoltage(s.volt) }}
            data-reveal
          >
            <div className="tl-strip__rail">
              <span className="tl-strip__num">{s.n}</span>
              <span className="tl-strip__roman">{s.roman}</span>
            </div>

            <div className="tl-strip__media">
              <img
                className="tl-strip__img"
                src={s.img}
                alt={`${s.title} — screenshot of the ${s.title} view in dark mode`}
                loading="lazy"
                decoding="async"
              />
              <span className="tl-strip__ghost tl-display" aria-hidden="true">
                {s.roman}
              </span>
            </div>

            <div className="tl-strip__info">
              <span className="tl-chip">{s.tag}</span>
              <h3 className="tl-strip__title">{s.title}</h3>
              <ul className="tl-strip__specs">
                {s.specs.map((spec) => (
                  <li key={spec}>{spec}</li>
                ))}
              </ul>
              <div className="tl-strip__foot">
                <span className="tl-strip__label tl-display">{s.label}</span>
                <button type="button" className="tl-strip__shop" onClick={onStepInside}>
                  Shop <span className="tl-strip__shop-arrow">→</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Method — pinned horizontal scrub across three voltage stages
 * ------------------------------------------------------------------ */

function Wavelength() {
  return (
    <div className="tl-wave" aria-hidden="true">
      {Array.from({ length: 26 }).map((_, i) => (
        <span key={i} className="tl-wave__bar" style={{ '--i': i }} />
      ))}
    </div>
  );
}

function Gauge() {
  return (
    <div className="tl-gauge" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="tl-gauge__svg">
        <circle className="tl-gauge__track" cx="50" cy="50" r="42" />
        <circle className="tl-gauge__arc" cx="50" cy="50" r="42" />
      </svg>
      <span className="tl-gauge__value tl-display">100%</span>
      <span className="tl-gauge__cap">rows checked</span>
    </div>
  );
}

const STAGES = [
  {
    roman: 'I',
    volt: 'orange',
    kicker: 'Counting',
    title: 'Every row, counted.',
    body: 'Most desks read the first thousand rows and total the rest by hope. TrackSimply walks the whole ledger — all of it — before a single number is printed.',
    anim: 'wave',
  },
  {
    roman: 'II',
    volt: 'pink',
    kicker: 'Verifying',
    title: 'Snapshot before · after.',
    body: 'A snapshot of the books is taken and verified either side of every change. If a figure moves without a reason, the change is thrown away.',
    anim: 'gauge',
  },
  {
    roman: 'III',
    volt: 'lime',
    kicker: 'Serving',
    title: 'Live, read-only.',
    body: 'Browse real accounts knowing nothing is touched, and know the assistant is proxied server-side.',
    anim: 'list',
  },
];

function Method() {
  return (
    <section id="tl-method" className="tl-craft">
      <div className="tl-craft__intro" aria-hidden="true">
        <span className="tl-craft__intro-label">Method</span>
      </div>
      <div className="tl-craft__track">
        {STAGES.map((stage, i) => (
          <article
            key={stage.roman}
            className={`tl-craft__stage tl-craft__stage--${stage.volt}`}
            style={{ '--stage-c': VOLT[stage.volt], '--stage-ink': onVoltage(stage.volt) }}
            data-stage={i}
          >
            <span className="tl-craft__roman tl-display" aria-hidden="true">
              {stage.roman}.
            </span>
            <p className="tl-craft__kicker">{stage.kicker}</p>
            <h3 className="tl-craft__title tl-display-section">{stage.title}</h3>
            <p className="tl-craft__body">{stage.body}</p>

            <div className="tl-craft__viz">
              {stage.anim === 'wave' && <Wavelength />}
              {stage.anim === 'gauge' && <Gauge />}
              {stage.anim === 'list' && (
                <ul className="tl-craft__list">
                  <li>
                    <span className="tl-craft__list-roman">III.</span>
                    Read-only live mode
                  </li>
                  <li>
                    <span className="tl-craft__list-roman">IV.</span>
                    AI keys server-side
                  </li>
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="tl-craft__rail" aria-hidden="true">
        {STAGES.map((s) => (
          <span key={s.roman} className="tl-craft__rail-tick" style={{ '--stage-c': VOLT[s.volt] }} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * CTA — scattered words, sticker, coupon, social chips
 * ------------------------------------------------------------------ */

const SCATTER = [
  { text: 'One ledger', x: '6%', y: '16%', r: -3, speed: 7, volt: 'blue', face: 'display' },
  { text: 'held still', x: '68%', y: '10%', r: 2, speed: 9, volt: 'pink', face: 'display' },
  { text: 'no spreadsheet', x: '12%', y: '74%', r: 3, speed: 6, volt: 'orange', face: 'sans' },
  { text: 'no month-end', x: '72%', y: '70%', r: -2, speed: 8, volt: 'lime', face: 'sans' },
  { text: 'every row', x: '40%', y: '88%', r: -1, speed: 5, volt: 'blue', face: 'display' },
];

const CHIPS = [
  { label: '@tracksimply', volt: 'orange', r: -2.5 },
  { label: 'The Ledger', volt: 'pink', r: 2 },
  { label: 'Edition 001', volt: 'lime', r: -1.5 },
  { label: 'Built by hand', volt: 'blue', r: 3 },
];

function CTA({ onStepInside }) {
  const [joined, setJoined] = useState(false);

  return (
    <section className="tl-cta">
      {SCATTER.map((w) => (
        <span
          key={w.text}
          className={`tl-cta-word tl-cta-word--${w.face}`}
          data-speed={w.speed}
          style={{ left: w.x, top: w.y, '--r': `${w.r}deg`, color: VOLT[w.volt] }}
          aria-hidden="true"
        >
          {w.text}
        </span>
      ))}

      <div className="tl-cta__inner">
        <button
          type="button"
          className="tl-sticker"
          style={{ clipPath: STICKER_CLIP }}
          onClick={onStepInside}
        >
          <span className="tl-sticker__text tl-display">Grab A Pair →</span>
        </button>

        <div className="tl-coupon" data-reveal>
          <div className="tl-coupon__head">
            <span className="tl-coupon__brand tl-display">TrackSimply</span>
            <span className="tl-coupon__code">LEDGER · 001</span>
          </div>

          <div className="tl-coupon__tear" aria-hidden="true">
            <span className="tl-coupon__scissors">✂</span>
          </div>

          <h2 className="tl-coupon__title tl-display-section">
            Keep the <em>books</em> you already keep.
          </h2>
          <p className="tl-coupon__body">
            Drop your email and we will open the door. No card, no ceremony — just the desk.
          </p>

          <form
            className="tl-coupon__form"
            onSubmit={(e) => {
              e.preventDefault();
              setJoined(true);
            }}
          >
            <input
              type="email"
              className="tl-coupon__input"
              placeholder="you@business.com"
              aria-label="Email address"
              required
            />
            <button type="submit" className="tl-coupon__join">
              {joined ? "You're in" : 'Join'}
            </button>
          </form>

          <div className="tl-chips">
            {CHIPS.map((chip) => (
              <span
                key={chip.label}
                className="tl-chip-social tl-display"
                style={{ '--chip-c': VOLT[chip.volt], '--chip-r': `${chip.r}deg`, color: onVoltage(chip.volt) }}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */

const FOOTER_COLS = [
  { head: 'Platform', volt: 'orange', links: ['Bookkeeping', 'Analytics', 'Budget Planner'] },
  { head: 'Instruments', volt: 'pink', links: ['Debt Tracker', 'Inventory', 'Fleet Registry'] },
  { head: 'Method', volt: 'lime', links: ['All rows', 'Snapshots', 'Live read-only'] },
  { head: 'Company', volt: 'blue', links: ['Colophon', 'Changelog', 'Contact'] },
];

function Footer() {
  return (
    <footer className="tl-footer">
      <div className="tl-colophon">
        <span className="tl-colophon__item">
          Real-time · <Clock className="tl-clock" /> UTC
        </span>
        <span className="tl-colophon__item">Hand-built · One ledger, held still</span>
      </div>

      <div className="tl-footer__cols">
        {FOOTER_COLS.map((col) => (
          <div key={col.head} className="tl-footer__col" data-c={col.volt}>
            <h4 className="tl-footer__head">{col.head}</h4>
            <ul>
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#tl-platform" className="tl-footer__link">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="tl-footer__wordmark-wrap" aria-hidden="true">
        <span className="tl-footer__wordmark tl-display">TrackSimply</span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * Landing root — GSAP reveals, pin/scrub and parallax
 * ------------------------------------------------------------------ */

export default function Landing({ onStepInside }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    /* Reduced motion: reveal everything, spin up no loops. */
    if (prefersReduced()) {
      root.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
      root.querySelectorAll('.tl-craft__stage').forEach((el) => el.classList.add('is-in'));
      return () => {
        window.scrollTo(0, 0);
      };
    }

    let killed = false;
    let pollId = 0;
    let ctx = null;
    let refreshHandler = null;
    let fallbackId = 0;

    /* If GSAP never arrives, expose the content rather than hiding it. */
    const staticFallback = () => {
      root.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
      const craft = root.querySelector('.tl-craft');
      if (craft) craft.classList.add('is-static');
      root.querySelectorAll('.tl-craft__stage').forEach((el) => el.classList.add('is-in'));
    };

    const build = () => {
      const gsap = window.gsap;
      const ScrollTrigger = window.ScrollTrigger;
      if (!gsap || !ScrollTrigger) return false;

      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        /* --- ScrollTrigger reveals --- */
        gsap.utils.toArray('[data-reveal]', root).forEach((el) => {
          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 42 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 1,
              ease: 'power3.out',
              scrollTrigger: { trigger: el, start: 'top 86%' },
              /* Hand the transform back to the stylesheet so the strips'
                 :hover indent and the coupon's rotation are not overridden
                 by GSAP's inline transform. */
              onComplete: () => gsap.set(el, { clearProps: 'transform' }),
            },
          );
        });

        /* --- Method: pinned horizontal scrub --- */
        const craft = root.querySelector('.tl-craft');
        const track = root.querySelector('.tl-craft__track');
        const stages = gsap.utils.toArray('.tl-craft__stage', root);
        if (craft && track && stages.length > 1) {
          /*
           * Travel must be derived from the track's CONTENT width, not its
           * element box.
           *
           * The track is a block-level flex container: its border-box is one
           * viewport wide (1440px) while its children overflow to three
           * viewports (4320px). xPercent resolves against the border-box, so
           * the old -66.67% travelled 960px when the stages needed 2880px. The
           * scrub ran a third of its distance: stage two slid halfway into
           * view, stage three never appeared at all, and the section looked
           * broken from end to end.
           *
           * Measured in pixels from the real stage width, and re-measured on
           * every ScrollTrigger.refresh so a resize or font load cannot leave
           * it short again.
           */
          const travel = () => stages[0].getBoundingClientRect().width * (stages.length - 1);

          const tween = gsap.to(track, {
            x: () => -travel(),
            ease: 'none',
            scrollTrigger: {
              trigger: craft,
              start: 'top top',
              /* ~1.15 screens of scroll per transition: enough to read a
                 stage, short enough that the section does not feel stuck. */
              end: () => `+=${Math.round(window.innerHeight * (stages.length - 1) * 1.15)}`,
              pin: true,
              scrub: 0.6,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });
          stages.forEach((stage) => {
            ScrollTrigger.create({
              trigger: stage,
              containerAnimation: tween,
              start: 'left center',
              onEnter: () => stage.classList.add('is-in'),
              onEnterBack: () => stage.classList.add('is-in'),
            });
          });
        }

        /* --- Footer wordmark parallax --- */
        const footer = root.querySelector('.tl-footer');
        const wordmark = root.querySelector('.tl-footer__wordmark');
        if (footer && wordmark) {
          gsap.fromTo(
            wordmark,
            { xPercent: 0 },
            {
              xPercent: -3,
              ease: 'none',
              scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          );
        }

        /* --- Scattered CTA words parallax --- */
        const cta = root.querySelector('.tl-cta');
        if (cta) {
          gsap.utils.toArray('.tl-cta-word', root).forEach((word) => {
            const speed = parseFloat(word.dataset.speed || '6');
            gsap.fromTo(
              word,
              { yPercent: speed },
              {
                yPercent: -speed,
                ease: 'none',
                scrollTrigger: { trigger: cta, start: 'top bottom', end: 'bottom top', scrub: true },
              },
            );
          });
        }
      }, root);

      /* Refresh once fonts and images have settled. */
      refreshHandler = () => ScrollTrigger.refresh();
      window.addEventListener('load', refreshHandler);
      setTimeout(() => ScrollTrigger.refresh(), 400);
      return true;
    };

    if (!build()) {
      pollId = window.setInterval(() => {
        if (killed) {
          window.clearInterval(pollId);
          return;
        }
        if (build()) window.clearInterval(pollId);
      }, 120);
      fallbackId = window.setTimeout(() => {
        if (!ctx) {
          if (pollId) window.clearInterval(pollId);
          staticFallback();
        }
      }, 3000);
    }

    return () => {
      killed = true;
      if (pollId) window.clearInterval(pollId);
      if (fallbackId) window.clearTimeout(fallbackId);
      if (refreshHandler) window.removeEventListener('load', refreshHandler);
      if (ctx) ctx.revert();
      window.scrollTo(0, 0);
    };
  }, []);

  return (
    <div ref={rootRef} className="tl-root">
      <Overlays />
      <main className="tl-page">
        <Hero onStepInside={onStepInside} />
        <Marquee />
        <Instruments onStepInside={onStepInside} />
        <Method />
        <CTA onStepInside={onStepInside} />
        <Footer />
      </main>
    </div>
  );
}
