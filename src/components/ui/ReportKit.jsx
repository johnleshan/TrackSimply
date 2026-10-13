import React from 'react';
import './ReportKit.css';

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

export function Panel({ title, subtitle, actions, children, className = '', dense = false }) {
  return (
    <section className={`rk-panel ${dense ? 'rk-panel-dense' : ''} ${className}`}>
      {(title || actions) && (
        <header className="rk-panel-head">
          <div>
            {title && <h3 className="rk-panel-title">{title}</h3>}
            {subtitle && <p className="rk-panel-sub">{subtitle}</p>}
          </div>
          {actions && <div className="rk-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="rk-panel-body">{children}</div>
    </section>
  );
}

export function Grid({ children, min = 260, className = '' }) {
  return (
    <div className={`rk-grid ${className}`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="rk-section-title">
      <h2>{children}</h2>
      {hint && <p>{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon = '📊', title, hint }) {
  return (
    <div className="rk-empty">
      <span className="rk-empty-icon">{icon}</span>
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function Note({ children, tone = 'info' }) {
  return <p className={`rk-note rk-note-${tone}`}>{children}</p>;
}

/* ------------------------------------------------------------------ *
 * Stat tile
 * ------------------------------------------------------------------ */

export function StatTile({ label, value, sub, tone, trend, trendLabel }) {
  const trendTone = trend === null || trend === undefined || !Number.isFinite(trend)
    ? null
    : trend > 0.5 ? 'up' : trend < -0.5 ? 'down' : 'flat';

  return (
    <div className={`rk-stat ${tone ? `rk-stat-${tone}` : ''}`}>
      <span className="rk-stat-label">{label}</span>
      <span className="rk-stat-value">{value}</span>
      {sub && <span className="rk-stat-sub">{sub}</span>}
      {trendTone && (
        <span className={`rk-stat-trend rk-trend-${trendTone}`}>
          {trendTone === 'up' ? '▲' : trendTone === 'down' ? '▼' : '■'} {trendLabel}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Verdict badge
 * ------------------------------------------------------------------ */

const VERDICTS = {
  'on-track': { label: 'On track', className: 'ok' },
  watch: { label: 'Watch', className: 'warn' },
  'projected-overshoot': { label: 'Projected overshoot', className: 'warn' },
  overspent: { label: 'Overspent', className: 'bad' },
  'no-target': { label: 'No target set', className: 'muted' },
  comfortable: { label: 'Comfortable', className: 'ok' },
  adequate: { label: 'Adequate', className: 'ok' },
  strained: { label: 'Strained', className: 'warn' },
  deficit: { label: 'Deficit', className: 'bad' },
  'no-debt': { label: 'No debt', className: 'muted' },
  cleared: { label: 'Clears', className: 'ok' },
  'never-clears': { label: 'Never clears', className: 'bad' },
  'no-payment': { label: 'No payment set', className: 'warn' },
  'over-term': { label: 'Beyond 50 years', className: 'warn' },
  'no-balance': { label: 'Settled', className: 'muted' },
};

export function Verdict({ value }) {
  const meta = VERDICTS[value];
  if (!meta) return null;
  return <span className={`rk-verdict rk-verdict-${meta.className}`}>{meta.label}</span>;
}

/* ------------------------------------------------------------------ *
 * Data table
 * ------------------------------------------------------------------ */

/**
 * Replaces `alert()` for anything analytical. Tables carry `data-label` so the
 * existing responsive card layout in index.css applies without extra CSS.
 */
export function DataTable({ columns, rows, keyField = 'id', emptyLabel = 'Nothing to show', renderEmpty }) {
  if (!rows.length) {
    return renderEmpty || <div className="chart-empty">{emptyLabel}</div>;
  }
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.align ? { textAlign: column.align } : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row[keyField] ?? index}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}
                  style={column.align ? { textAlign: column.align } : undefined}>
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Definition list
 * ------------------------------------------------------------------ */

export function Facts({ items }) {
  return (
    <dl className="rk-facts">
      {items.map((item) => (
        <div className="rk-fact" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}