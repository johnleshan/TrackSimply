/**
 * CSV export and print. Entirely client-side — no server, no database write.
 *
 * Export is built to survive a spreadsheet round trip: values that a
 * spreadsheet would otherwise coerce (a leading apostrophe, a formula, a
 * date) are quoted and escaped so a description like "=SUM(A1:A9)" cannot be
 * executed when the file is opened.
 */

const RISKY_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);

  // Neutralise spreadsheet formula injection.
  if (RISKY_PREFIX.test(text)) text = `'${text}`;

  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','));
  return [header, ...body].join('\r\n');
}

export function downloadCsv(filename, columns, rows) {
  if (!rows.length) return false;

  // BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(['﻿' + toCsv(columns, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/** Strips the icons and controls that are meaningless outside the app. */
export function printableTitle(scope, rangeLabel) {
  const stamp = new Date().toLocaleString('en-GB');
  return `TrackSimply ${scope} — ${rangeLabel} — generated ${stamp}`;
}

export function ReportActions({ onExport, exportLabel = 'Export CSV', onPrint = true, disabled = false }) {
  return (
    <>
      {onExport && (
        <button type="button" className="rk-btn rk-btn-primary" onClick={onExport} disabled={disabled}>
          ⬇ {exportLabel}
        </button>
      )}
      {onPrint && (
        <button type="button" className="rk-btn" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      )}
    </>
  );
}