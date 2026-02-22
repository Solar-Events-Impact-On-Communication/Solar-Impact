/* =========================================================
   Solar Events — utils.js
   Shared helpers, constants, and API base URLs
   ========================================================= */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_ORDER = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};

export const API_BASE = '';
export const ADMIN_API_BASE = import.meta.env.VITE_ADMIN_API_BASE || '';

export function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(path || '').replace(/^\/+/, '');
  return b ? `${b}/${p}` : `/${p}`;
}

export function formatEventDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatEventDateLabelWithYear(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatFullDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function extractYear(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getUTCFullYear());
}

export function parseMonthDay(str) {
  if (!str) return { monthIndex: 13, day: 0 };
  const parts = str.split(' ');
  const month = parts[0];
  const day = parseInt(parts[1], 10) || 0;
  return { monthIndex: MONTH_ORDER[month] || 13, day };
}

export function sortEventsByDate(events) {
  return [...events].sort((a, b) => {
    const aMD = parseMonthDay(a.date);
    const bMD = parseMonthDay(b.date);
    if (aMD.monthIndex !== bMD.monthIndex) return aMD.monthIndex - bMD.monthIndex;
    return aMD.day - bMD.day;
  });
}

export function getEventYear(dateStr) {
  if (!dateStr) return null;
  const year = String(dateStr).slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}
