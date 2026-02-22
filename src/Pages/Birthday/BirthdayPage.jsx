/* =========================================================
   Solar Events — BirthdayPage.jsx
   Solar events on your birthday — search by MM/DD or Year
   ========================================================= */

import './BirthdayPage.css';
import React, { useState, useRef } from 'react';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CURRENT_YEAR = new Date().getFullYear();

export default function BirthdayPage() {
  const [mode, setMode] = useState('date'); // 'date' | 'year'

  const [dateInput, setDateInput] = useState('');
  const [dateInputError, setDateInputError] = useState('');

  const [yearInput, setYearInput] = useState('');
  const [yearInputError, setYearInputError] = useState('');

  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [results, setResults] = useState([]);
  const [searchedLabel, setSearchedLabel] = useState('');

  const lastSearchRef = useRef('');

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setStatus('idle');
    setResults([]);
    setErrorMessage('');
    setDateInputError('');
    setYearInputError('');
    lastSearchRef.current = '';
  };

  const handleDateInput = (e) => {
    let val = e.target.value.replace(/[^\d/]/g, '');
    if (val.length === 2 && !val.includes('/') && dateInput.length < 2) val = val + '/';
    if (val.length > 5) val = val.slice(0, 5);
    setDateInput(val);
    setDateInputError('');
  };

  const handleYearInput = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYearInput(val);
    setYearInputError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'date') await submitDate();
    else await submitYear();
  };

  const submitDate = async () => {
    const match = dateInput.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!match) {
      setDateInputError('Please enter a valid date in MM/DD format, e.g. 09/01');
      return;
    }
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      setDateInputError('Please enter a valid month (01–12) and day (01–31).');
      return;
    }

    const key = `date:${month}/${day}`;
    if (key === lastSearchRef.current && status === 'success') return;

    setStatus('loading');
    setResults([]);
    setErrorMessage('');

    try {
      const res = await fetch('/api/ai/birthday-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, day }),
      });
      const data = await res.json();
      if (res.status === 429 || data.error === 'rate_limit') {
        setStatus('rate_limit');
        setErrorMessage(data.message || 'Too many requests. Please try again shortly.');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.message || 'Something went wrong. Please try again.');
        return;
      }
      const events = data.events || [];
      lastSearchRef.current = key;
      setSearchedLabel(`${MONTH_NAMES[month - 1]} ${day}`);
      setStatus(events.length === 0 ? 'empty' : 'success');
      setResults(events);
    } catch {
      setStatus('error');
      setErrorMessage(
        'Unable to reach the AI service. Please check your connection and try again.'
      );
    }
  };

  const submitYear = async () => {
    const yearNum = parseInt(yearInput, 10);
    if (!yearInput || isNaN(yearNum) || yearNum < 1 || yearNum > CURRENT_YEAR) {
      setYearInputError(`Please enter a valid year between 1 and ${CURRENT_YEAR}.`);
      return;
    }

    const key = `year:${yearNum}`;
    if (key === lastSearchRef.current && status === 'success') return;

    setStatus('loading');
    setResults([]);
    setErrorMessage('');

    try {
      const res = await fetch('/api/ai/year-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: yearNum }),
      });
      const data = await res.json();
      if (res.status === 429 || data.error === 'rate_limit') {
        setStatus('rate_limit');
        setErrorMessage(data.message || 'Too many requests. Please try again shortly.');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.message || 'Something went wrong. Please try again.');
        return;
      }
      const events = data.events || [];
      lastSearchRef.current = key;
      setSearchedLabel(String(yearNum));
      setStatus(events.length === 0 ? 'empty' : 'success');
      setResults(events);
    } catch {
      setStatus('error');
      setErrorMessage(
        'Unable to reach the AI service. Please check your connection and try again.'
      );
    }
  };

  const isLoading = status === 'loading';
  const activeError = mode === 'date' ? dateInputError : yearInputError;

  return (
    <div className="birthday-page">
      <div className="birthday-page-header">
        <div className="about-page-label">PERSONAL HISTORY</div>
        <h1 className="birthday-page-title">Events on Your Birthday</h1>
        <p className="birthday-page-desc">
          Discover which solar events occurred on your birth date or birth year throughout recorded
          history.
        </p>
        <div className="about-page-rule" />
      </div>

      <div className="birthday-body">
        <div className="birthday-form-card">
          <div className="birthday-mode-toggle">
            <button
              className={`birthday-mode-btn ${mode === 'date' ? 'birthday-mode-btn--active' : ''}`}
              onClick={() => handleModeSwitch('date')}
              type="button"
            >
              Month / Day
            </button>
            <button
              className={`birthday-mode-btn ${mode === 'year' ? 'birthday-mode-btn--active' : ''}`}
              onClick={() => handleModeSwitch('year')}
              type="button"
            >
              Birth Year
            </button>
          </div>

          <div className="birthday-form-label">
            {mode === 'date' ? 'ENTER YOUR BIRTH DATE' : 'ENTER YOUR BIRTH YEAR'}
          </div>

          <form className="birthday-form" onSubmit={handleSubmit}>
            <div className="birthday-input-row">
              <div className="birthday-input-wrap">
                {mode === 'date' ? (
                  <input
                    key="date"
                    type="text"
                    placeholder="MM/DD"
                    className={`birthday-input ${dateInputError ? 'birthday-input--error' : ''}`}
                    aria-label="Birthday month and day"
                    maxLength={5}
                    value={dateInput}
                    onChange={handleDateInput}
                    disabled={isLoading}
                  />
                ) : (
                  <input
                    key="year"
                    type="text"
                    placeholder="YYYY"
                    className={`birthday-input ${yearInputError ? 'birthday-input--error' : ''}`}
                    aria-label="Birth year"
                    maxLength={4}
                    value={yearInput}
                    onChange={handleYearInput}
                    disabled={isLoading}
                    inputMode="numeric"
                  />
                )}
              </div>
              <button
                className={`birthday-btn ${isLoading ? 'birthday-btn--loading' : ''}`}
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="birthday-btn-spinner" />
                    Searching…
                  </>
                ) : (
                  'Search Records'
                )}
              </button>
            </div>
            {activeError && <p className="birthday-input-error">{activeError}</p>}
            {!activeError && (
              <p className="birthday-hint">
                {mode === 'date'
                  ? 'Enter month and day — e.g. 09/01'
                  : 'Enter a 4-digit year — e.g. 1989'}
              </p>
            )}
          </form>
        </div>

        <div className="birthday-results">
          {status === 'idle' && (
            <div className="birthday-results-empty">
              <div className="birthday-results-icon">☀</div>
              <div className="birthday-results-text">Results will appear here.</div>
              <div className="birthday-results-sub">
                {mode === 'date'
                  ? 'Enter your birth date above to find solar events on that day throughout history.'
                  : 'Enter your birth year above to find the top solar events from that year.'}
              </div>
            </div>
          )}
          {status === 'loading' && (
            <div className="birthday-results-empty">
              <div className="birthday-results-icon birthday-results-icon--spin">☀</div>
              <div className="birthday-results-text">Searching solar records…</div>
              <div className="birthday-results-sub">This may take a moment.</div>
            </div>
          )}
          {status === 'empty' && (
            <div className="birthday-results-empty">
              <div className="birthday-results-icon">◎</div>
              <div className="birthday-results-text">
                No recorded solar events found for {searchedLabel}.
              </div>
              <div className="birthday-results-sub">
                No well-documented solar events are known for this{' '}
                {mode === 'date' ? 'date' : 'year'}. Try another {mode === 'date' ? 'date' : 'year'}
                .
              </div>
            </div>
          )}
          {status === 'rate_limit' && (
            <div className="birthday-results-empty birthday-results-empty--error">
              <div className="birthday-results-icon">⚠</div>
              <div className="birthday-results-text">Too many requests</div>
              <div className="birthday-results-sub">{errorMessage}</div>
            </div>
          )}
          {status === 'error' && (
            <div className="birthday-results-empty birthday-results-empty--error">
              <div className="birthday-results-icon">⚠</div>
              <div className="birthday-results-text">Something went wrong</div>
              <div className="birthday-results-sub">{errorMessage}</div>
            </div>
          )}
          {status === 'success' && results.length > 0 && (
            <div className="birthday-events-list">
              <div className="birthday-events-header">
                <span className="birthday-events-title-label">
                  {mode === 'date'
                    ? `SOLAR EVENTS ON ${searchedLabel.toUpperCase()}`
                    : `SOLAR EVENTS IN ${searchedLabel}`}
                </span>
                <span className="birthday-events-count">
                  {results.length} event{results.length !== 1 ? 's' : ''} found
                </span>
              </div>
              {results.map((ev, i) => (
                <div key={i} className="birthday-event-card">
                  <div className="birthday-event-year">
                    {mode === 'date' ? ev.year : ev.date || '—'}
                  </div>
                  <div className="birthday-event-body">
                    <div className="birthday-event-meta">
                      <span className="birthday-event-title">{ev.title}</span>
                      {ev.type && <span className="birthday-event-type">{ev.type}</span>}
                    </div>
                    <p className="birthday-event-desc">{ev.description}</p>
                  </div>
                </div>
              ))}
              <div className="birthday-events-disclaimer">
                ✦ Results generated by GPT-4o using historically verified sources. Verify
                significant events with primary scientific records.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
