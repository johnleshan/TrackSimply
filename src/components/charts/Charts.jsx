import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import './Charts.css';
import { formatCompact } from '../../lib/format';

/* ------------------------------------------------------------------ *
 * Shared pointer tooltip
 * ------------------------------------------------------------------ */

/**
 * Charts are used on phones as well as desktops, so pointer-driven state is
 * tracked centrally rather than through mouseenter/mouseleave. A tap reveals the
 * same detail a hover does, and tapping elsewhere dismisses it.
 */
function usePointerTooltip() {
  const containerRef = useRef(null);
  const [tip, setTip] = useState(null);

  const show = useCallback((event, content, anchor) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      content,
      anchor,
    });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  useEffect(() => {
    if (!tip) return undefined;
    const onDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setTip(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [tip]);

  return { containerRef, tip, show, hide };
}

function Tooltip({ tip, containerRef, offsetY = 14 }) {
  if (!tip) return null;

  // Clamp so the bubble never leaves the panel it belongs to.
  const width = containerRef.current?.clientWidth || 320;
  const half = 90;
  const x = Math.min(Math.max(tip.x, half), Math.max(half, width - half));

  return (
    <div className="chart-tooltip" style={{ left: x, top: Math.max(tip.y - offsetY, 0) }} role="status">
      {tip.content}
    </div>
  );
}

function TipRow({ swatch, label, value, strong }) {
  return (
    <div className={`chart-tip-row ${strong ? 'is-strong' : ''}`}>
      {swatch && <span className="chart-tip-swatch" style={{ background: swatch }} />}
      <span className="chart-tip-label">{label}</span>
      <span className="chart-tip-value">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sparkline
 * ------------------------------------------------------------------ */

export function Sparkline({ data = [], width = 120, height = 34, color = 'var(--accent-teal)', showArea = true }) {
  const values = data.map((d) => Number(d) || 0);
  if (values.length < 2) return <div className="chart-sparkline" style={{ width, height }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 3;

  const points = values.map((value, i) => {
    const x = i * stepX;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y];
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg className="chart-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {showArea && <path d={areaPath} fill={color} opacity="0.12" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Trend chart
 * ------------------------------------------------------------------ */

const PLOT = { left: 58, right: 14, top: 16, bottom: 28 };

export function TrendChart({
  labels = [],
  series = [],
  height = 260,
  area = false,
  showZeroLine = true,
  valueFormat = formatCompact,
}) {
  const [width, setWidth] = useState(720);
  // The hook's ref must be the one attached to the DOM: `show` measures
  // against it, and the Tooltip clamps to it. A separate local ref would leave
  // the hook's ref null, and `show` would return without doing anything.
  const { containerRef, tip, show, hide } = usePointerTooltip();

  // Measured with an observer rather than a callback ref. An inline ref that
  // calls setState runs on every render, and the state change triggers another
  // render — which spins React into an infinite loop and locks the tab.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => setWidth(node.clientWidth || 720);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  const ready = useMemo(
    () => labels.length > 0 && series.some((s) => s.values.some((v) => Number(v) !== 0)),
    [labels, series]
  );

  if (!ready) {
    return <div className="chart-empty" style={{ height }}>No activity in this period</div>;
  }

  const plotW = Math.max(120, width - PLOT.left - PLOT.right);
  const plotH = Math.max(60, height - PLOT.top - PLOT.bottom);

  const allValues = series.flatMap((s) => s.values.map((v) => Number(v) || 0));
  let min = Math.min(0, ...allValues);
  let max = Math.max(0, ...allValues);
  if (min === max) max = min + 1;
  const padRange = (max - min) * 0.08;
  min -= padRange;
  max += padRange;

  const xAt = (i) => PLOT.left + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
  const yAt = (v) => PLOT.top + plotH - ((Number(v) || 0) - min) / (max - min) * plotH;

  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4).reverse();
  const labelStep = Math.max(1, Math.ceil(labels.length / 7));

  const hoveredIndex = tip?.anchor ?? null;
  const hovered = hoveredIndex !== null ? labels[hoveredIndex] : null;

  const buildContent = (index) => (
    <>
      <strong className="chart-tip-title">{labels[index]}</strong>
      {series.map((s) => (
        <TipRow key={s.key} swatch={s.color} label={s.label} value={valueFormat(s.values[index] ?? 0)} />
      ))}
    </>
  );

  const onMove = (event) => {
    const overlay = event.currentTarget;
    const rect = overlay.getBoundingClientRect();
    // The overlay spans the plot area, so its own width is the correct
    // denominator. Subtracting PLOT.left again skewed every reading.
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.min(labels.length - 1, Math.max(0, Math.round(ratio * (labels.length - 1))));
    show(event, buildContent(index), index);
  };

  return (
    <div className="chart-trend" ref={containerRef}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img"
        aria-label={`Trend across ${labels.length} periods`}>
        {ticks.map((tick, i) => (
          <g key={i}>
            <line x1={PLOT.left} x2={width - PLOT.right} y1={yAt(tick)} y2={yAt(tick)} className="chart-gridline" />
            <text x={PLOT.left - 8} y={yAt(tick) + 4} className="chart-axis-label" textAnchor="end">
              {formatCompact(tick)}
            </text>
          </g>
        ))}

        {showZeroLine && min < 0 && max > 0 && (
          <line x1={PLOT.left} x2={width - PLOT.right} y1={yAt(0)} y2={yAt(0)} className="chart-zeroline" />
        )}

        {labels.map((label, i) => (
          (i % labelStep === 0 || i === labels.length - 1) && (
            <text key={`${i}-${label}`} x={xAt(i)} y={height - 8} className="chart-axis-label" textAnchor="middle">
              {label}
            </text>
          )
        ))}

        {area && series.map((s) => {
          const path = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
          const filled = `${path} L${xAt(s.values.length - 1)},${yAt(0)} L${xAt(0)},${yAt(0)} Z`;
          return <path key={`${s.key}-area`} d={filled} fill={s.color} opacity="0.1" />;
        })}

        {series.map((s) => {
          const path = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
          return (
            <path key={s.key} d={path} fill="none" stroke={s.color} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
          );
        })}

        {hoveredIndex !== null && (
          <line x1={xAt(hoveredIndex)} x2={xAt(hoveredIndex)} y1={PLOT.top} y2={PLOT.top + plotH} className="chart-guide" />
        )}

        {hoveredIndex !== null && series.map((s) => (
          <circle key={`${s.key}-dot`} cx={xAt(hoveredIndex)} cy={yAt(s.values[hoveredIndex])} r="4.5"
            fill="var(--bg-secondary)" stroke={s.color} strokeWidth="2.5" />
        ))}

        <rect x={PLOT.left} y={PLOT.top} width={plotW} height={plotH} fill="transparent"
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={hide}
          style={{ cursor: 'crosshair', touchAction: 'none' }} />
      </svg>

      <Tooltip tip={tip} containerRef={containerRef} />

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      {hovered && <span className="chart-sr-only">Showing {hovered}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ranked bar list
 * ------------------------------------------------------------------ */

/**
 * HTML rather than SVG: it reflows on a phone, stays selectable and printable,
 * and needs no axis maths.
 */
export function BarList({
  items = [],
  formatValue = formatCompact,
  max: providedMax,
  emptyLabel = 'Nothing recorded',
  total,
}) {
  const { containerRef, tip, show, hide } = usePointerTooltip();

  const max = providedMax ?? Math.max(0, ...items.map((i) => Math.abs(Number(i.value) || 0)));
  const sum = total ?? items.reduce((acc, i) => acc + (Number(i.value) || 0), 0);

  if (!items.length) return <div className="chart-empty">{emptyLabel}</div>;

  return (
    <div className="chart-barlist" ref={containerRef}>
      {items.map((item) => {
        const value = Number(item.value) || 0;
        const pct = max > 0 ? (Math.abs(value) / max) * 100 : 0;
        const share = sum > 0 ? (value / sum) * 100 : 0;

        const content = (
          <>
            <strong className="chart-tip-title">{item.label}</strong>
            <TipRow swatch={item.color} label="Amount" value={formatValue(value)} strong />
            {sum > 0 && <TipRow label="Share of total" value={`${share.toFixed(1)}%`} />}
            {item.count !== undefined && <TipRow label="Entries" value={item.count} />}
            {item.detail && <TipRow label={item.detail.label} value={item.detail.value} />}
          </>
        );

        return (
          <div
            className="chart-barlist-row chart-hoverable"
            key={item.label}
            onPointerMove={(e) => show(e, content)}
            onPointerDown={(e) => show(e, content)}
            onPointerLeave={hide}
            tabIndex={0}
            onFocus={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              show({ clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }, content);
            }}
            onBlur={hide}
            role="button"
            aria-label={`${item.label}: ${formatValue(value)}`}
          >
            <div className="chart-barlist-head">
              <span className="chart-barlist-label" title={item.label}>{item.label}</span>
              <span className="chart-barlist-value">{formatValue(value)}</span>
            </div>
            <div className="chart-barlist-track">
              <div className="chart-barlist-fill"
                style={{ width: `${pct}%`, background: item.color || 'var(--accent-teal)' }} />
            </div>
            {item.meta ? <div className="chart-barlist-meta">{item.meta}</div> : null}
          </div>
        );
      })}
      <Tooltip tip={tip} containerRef={containerRef} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Donut
 * ------------------------------------------------------------------ */

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Donut({
  segments = [],
  size = 150,
  thickness = 16,
  centerLabel,
  centerSub,
  formatValue = formatCompact,
}) {
  const [active, setActive] = useState(null);
  const { containerRef, tip, show, hide } = usePointerTooltip();

  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return <div className="chart-empty">No spend to break down</div>;

  let offset = 0;
  const arcs = segments.map((segment) => {
    const value = Number(segment.value) || 0;
    const length = (value / total) * CIRCUMFERENCE;
    const arc = { segment, value, length, dashOffset: -offset, pct: (value / total) * 100 };
    offset += length;
    return arc;
  });

  const contentFor = (arc) => (
    <>
      <strong className="chart-tip-title">{arc.segment.label}</strong>
      <TipRow swatch={arc.segment.color} label="Amount" value={formatValue(arc.value)} strong />
      <TipRow label="Share of spend" value={`${arc.pct.toFixed(1)}%`} />
    </>
  );

  return (
    <div className="chart-donut-wrap" ref={containerRef}>
      <div className="chart-donut" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Spend breakdown">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--glass-border)" strokeWidth={thickness} />
          {arcs.map((arc) => (
            <circle
              key={arc.segment.label}
              cx="50" cy="50" r={RADIUS} fill="none"
              stroke={arc.segment.color}
              strokeWidth={active === arc.segment.label ? thickness + 5 : thickness}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={arc.dashOffset}
              transform="rotate(-90 50 50)"
              className="chart-donut-arc"
              onPointerMove={(e) => { setActive(arc.segment.label); show(e, contentFor(arc)); }}
              onPointerDown={(e) => { setActive(arc.segment.label); show(e, contentFor(arc)); }}
              onPointerLeave={() => { setActive(null); hide(); }}
            />
          ))}
        </svg>
        <div className="chart-donut-center">
          <strong>{active ?? centerLabel}</strong>
          <span>{active ? `${
            (arcs.find((a) => a.segment.label === active)?.pct ?? 0).toFixed(1)
          }% of spend` : centerSub}</span>
        </div>
      </div>

      {/* A donut without a legend cannot be read; the legend doubles as the
          accessible list of what each colour represents. */}
      <ul className="chart-donut-legend">
        {arcs.map((arc) => (
          <li
            key={arc.segment.label}
            className={`chart-donut-legend-item ${active === arc.segment.label ? 'is-active' : ''}`}
            onPointerEnter={() => setActive(arc.segment.label)}
            onPointerLeave={() => setActive(null)}
          >
            <span className="chart-legend-swatch" style={{ background: arc.segment.color }} />
            <span className="chart-donut-legend-label">{arc.segment.label}</span>
            <span className="chart-donut-legend-value">{formatValue(arc.value)}</span>
            <span className="chart-donut-legend-pct">{arc.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
      <Tooltip tip={tip} containerRef={containerRef} offsetY={26} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Activity strip
 * ------------------------------------------------------------------ */

export function ActivityStrip({ buckets = [], max: providedMax, formatValue = formatCompact }) {
  const { containerRef, tip, show, hide } = usePointerTooltip();

  const max = providedMax ?? Math.max(0, ...buckets.map((b) => Math.max(b.income || 0, b.expense || 0)));
  if (!buckets.length) return <div className="chart-empty">No activity in this period</div>;

  return (
    <div className="chart-strip-wrap" ref={containerRef}>
      <div className="chart-strip">
        {buckets.map((bucket, index) => {
          const intensity = max > 0 ? Math.max(bucket.income || 0, bucket.expense || 0) / max : 0;
          const net = (bucket.income || 0) - (bucket.expense || 0);

          const content = (
            <>
              <strong className="chart-tip-title">{bucket.label ?? bucket.date}</strong>
              <TipRow swatch="#059669" label="Income" value={formatValue(bucket.income || 0)} />
              <TipRow swatch="#dc2626" label="Expense" value={formatValue(bucket.expense || 0)} />
              <TipRow label="Net" value={formatValue(net)} strong />
              {bucket.count !== undefined && <TipRow label="Entries" value={bucket.count} />}
            </>
          );

          return (
            <div
              className="chart-strip-cell"
              key={`${index}-${bucket.date ?? ''}`}
              onPointerMove={(e) => show(e, content)}
              onPointerDown={(e) => show(e, content)}
              onPointerLeave={hide}
            >
              <div className="chart-strip-bar"
                style={{
                  height: `${Math.max(4, intensity * 100)}%`,
                  background: net >= 0 ? 'var(--success)' : 'var(--danger)',
                  opacity: 0.35 + intensity * 0.65,
                }} />
            </div>
          );
        })}
      </div>
      <Tooltip tip={tip} containerRef={containerRef} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Gauge
 * ------------------------------------------------------------------ */

export function Gauge({ value = 0, max = 100, tone, height = 8, label }) {
  const { containerRef, tip, show, hide } = usePointerTooltip();

  const ratio = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  const resolved = tone || (ratio >= 100 ? 'var(--danger)' : ratio >= 85 ? 'var(--warning)' : 'var(--accent-teal)');

  const content = (
    <>
      <strong className="chart-tip-title">{label ?? 'Utilisation'}</strong>
      <TipRow label="Used" value={`${ratio.toFixed(1)}%`} strong />
      <TipRow label="Remaining" value={`${Math.max(0, 100 - ratio).toFixed(1)}%`} />
    </>
  );

  return (
    <div className="chart-gauge" ref={containerRef} style={{ height }}
      onPointerMove={(e) => show(e, content)}
      onPointerDown={(e) => show(e, content)}
      onPointerLeave={hide}>
      <div className="chart-gauge-fill" style={{ width: `${ratio}%`, background: resolved }} />
      <Tooltip tip={tip} containerRef={containerRef} />
    </div>
  );
}