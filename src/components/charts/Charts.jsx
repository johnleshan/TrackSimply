import React, { useState, useMemo, useRef, useEffect } from 'react';
import './Charts.css';
import { formatCompact } from '../../lib/format';

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
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg className="chart-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {showArea && <path d={area} fill={color} opacity="0.12" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Trend chart
 * ------------------------------------------------------------------ */

const PLOT = { left: 58, right: 12, top: 14, bottom: 28 };

/**
 * Income / expense / cumulative over time.
 *
 * `series` is [{ key, label, color, values: number[], area?: boolean }].
 * Categories and labels are aligned to `labels`.
 */
export function TrendChart({ labels = [], series = [], height = 260, area = false, showZeroLine = true }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(720);

  // Measured with an observer rather than a callback ref. An inline ref that
  // calls setState runs on every render, and the state change triggers another
  // render — which spins React into an infinite loop and locks the tab.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => setWidth(node.clientWidth || 720);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  // Show at most ~7 x labels so they never collide on a phone.
  const labelStep = Math.max(1, Math.ceil(labels.length / 7));

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = (x - PLOT.left) / plotW;
    const index = Math.round(ratio * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, index)));
  };

  const hovered = hover !== null ? labels[hover] : null;

  return (
    <div className="chart-trend" ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img"
        aria-label={`Trend chart across ${labels.length} periods`}>
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
            <text key={label} x={xAt(i)} y={height - 8} className="chart-axis-label" textAnchor="middle">
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

        {hover !== null && (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={PLOT.top} y2={PLOT.top + plotH} className="chart-guide" />
        )}

        {hover !== null && series.map((s) => (
          <circle key={`${s.key}-dot`} cx={xAt(hover)} cy={yAt(s.values[hover])} r="4.5"
            fill="var(--bg-secondary)" stroke={s.color} strokeWidth="2.5" />
        ))}

        <rect x={PLOT.left} y={PLOT.top} width={plotW} height={plotH} fill="transparent"
          onMouseMove={handleMove} onMouseLeave={() => setHover(null)} style={{ cursor: 'crosshair' }} />
      </svg>

      {hovered && (
        <div className="chart-tooltip" style={{
          left: `${(xAt(hover) / width) * 100}%`,
          top: 8,
        }}>
          <strong>{hovered}</strong>
          {series.map((s) => (
            <div key={s.key} className="chart-tooltip-row">
              <span className="chart-tooltip-swatch" style={{ background: s.color }} />
              <span>{s.label}</span>
              <span className="chart-tooltip-value">{formatCompact(s.values[hover] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ranked bar list
 * ------------------------------------------------------------------ */

/**
 * Rendered as HTML rather than SVG: it reflows properly on a phone, stays
 * selectable and printable, and needs no axis maths.
 */
export function BarList({ items = [], formatValue = formatCompact, max: providedMax, emptyLabel = 'Nothing recorded' }) {
  const max = providedMax ?? Math.max(0, ...items.map((i) => Math.abs(Number(i.value) || 0)));
  if (!items.length) return <div className="chart-empty">{emptyLabel}</div>;

  return (
    <div className="chart-barlist">
      {items.map((item) => {
        const value = Number(item.value) || 0;
        const pct = max > 0 ? (Math.abs(value) / max) * 100 : 0;
        return (
          <div className="chart-barlist-row" key={item.label}>
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
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Donut
 * ------------------------------------------------------------------ */

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Donut({ segments = [], size = 150, thickness = 16, centerLabel, centerSub }) {
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return <div className="chart-empty">No spend to break down</div>;

  let offset = 0;
  return (
    <div className="chart-donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Breakdown">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--glass-border)" strokeWidth={thickness} />
        {segments.map((segment) => {
          const value = Number(segment.value) || 0;
          const length = (value / total) * CIRCUMFERENCE;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle key={segment.label} cx="50" cy="50" r={RADIUS} fill="none"
              stroke={segment.color || 'var(--accent-teal)'} strokeWidth={thickness}
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)">
              <title>{`${segment.label}: ${formatCompact(value)}`}</title>
            </circle>
          );
        })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="chart-donut-center">
          {centerLabel && <strong>{centerLabel}</strong>}
          {centerSub && <span>{centerSub}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Activity strip
 * ------------------------------------------------------------------ */

export function ActivityStrip({ buckets = [], max: providedMax, formatLabel = (b) => b.label }) {
  const max = providedMax ?? Math.max(0, ...buckets.map((b) => Math.max(b.income || 0, b.expense || 0)));
  if (!buckets.length) return <div className="chart-empty">No activity in this period</div>;

  return (
    <div className="chart-strip">
      {buckets.map((bucket, index) => {
        const intensity = max > 0
          ? Math.max(bucket.income || 0, bucket.expense || 0) / max
          : 0;
        const net = (bucket.income || 0) - (bucket.expense || 0);
        return (
          // Indexed into the key: bucket labels collide across years once the
          // range is long enough (e.g. two "5 Jan" columns).
          <div className="chart-strip-cell" key={`${index}-${bucket.date ?? ''}`}
            title={`${formatLabel(bucket)}\nIn ${formatCompact(bucket.income)}\nOut ${formatCompact(bucket.expense)}`}>
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
  );
}

/* ------------------------------------------------------------------ *
 * Gauge
 * ------------------------------------------------------------------ */

export function Gauge({ value = 0, max = 100, tone, height = 8 }) {
  const ratio = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  const resolved = tone || (ratio >= 100 ? 'var(--danger)' : ratio >= 85 ? 'var(--warning)' : 'var(--accent-teal)');
  return (
    <div className="chart-gauge" style={{ height }}>
      <div className="chart-gauge-fill" style={{ width: `${ratio}%`, background: resolved }} />
    </div>
  );
}