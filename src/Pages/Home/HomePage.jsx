/* =========================================================
   Solar Events — HomePage.jsx
   Timeline view + Event Detail Overlay + Media Overlay
   ========================================================= */

import './HomePage.css';
import React, { useState, useEffect, useRef } from 'react';
import { API_BASE, sortEventsByDate } from '../../utils';

/* ---- AI response cache (persists across overlay open/close) ---- */
const tellMeMoreCache = new Map();

/* ================================================================
   HomePage
   ================================================================ */

export default function HomePage({
  events,
  loading,
  loadError,
  scrollToYear,
  onScrollToYearHandled,
}) {
  // ---- Overlay state ----
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showMediaOverlay, setShowMediaOverlay] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');

  // ---- Timeline UI state ----
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [expandedYear, setExpandedYear] = useState(null);
  const [idle, setIdle] = useState(false);
  const railRef = useRef(null);
  const idleTimer = useRef(null);

  // ---- Overlay handlers ----
  const openEventDetails = (event) => {
    setSelectedEvent(event);
    setShowMediaOverlay(false);
    setMediaItems([]);
  };

  const closeEventDetails = () => {
    setSelectedEvent(null);
    setShowMediaOverlay(false);
    setMediaItems([]);
  };

  const handleMediaNext = () => {
    if (!mediaItems.length) return;
    setMediaIndex((prev) => (prev + 1) % mediaItems.length);
  };

  const handleMediaPrev = () => {
    if (!mediaItems.length) return;
    setMediaIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  };

  const handleViewArticles = async (event) => {
    setMediaLoading(true);
    setMediaError('');
    setShowMediaOverlay(true);
    setMediaItems([]);
    setMediaIndex(0);
    try {
      const res = await fetch(`${API_BASE}/api/events/${event.id}/media`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMediaItems(data || []);
      if (!data || !data.length)
        setMediaError('No newspaper articles are linked to this event yet.');
    } catch (err) {
      console.error('Error loading media assets:', err);
      setMediaError('Unable to load newspaper articles right now.');
    } finally {
      setMediaLoading(false);
    }
  };

  const handleCloseMediaCompletely = () => {
    setShowMediaOverlay(false);
    setMediaItems([]);
    setMediaIndex(0);
    setSelectedEvent(null);
  };

  // ---- Click outside expanded year ----
  useEffect(() => {
    if (!expandedYear) return;
    const handleClickOutside = (e) => {
      if (railRef.current && !railRef.current.contains(e.target)) setExpandedYear(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedYear]);

  // ---- Idle detection ----
  useEffect(() => {
    const IDLE_MS = 3000;
    function resetIdle() {
      setIdle(false);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
    }
    const evts = ['mousemove', 'mousedown', 'scroll', 'keydown', 'touchstart'];
    evts.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
    return () => {
      evts.forEach((e) => window.removeEventListener(e, resetIdle));
      clearTimeout(idleTimer.current);
    };
  }, []);

  // ---- Scroll state ----
  useEffect(() => {
    let timeoutId;
    const updateScrollState = () => {
      if (!railRef.current) {
        setCanScrollUp(false);
        setCanScrollDown(false);
        return;
      }
      const rows = railRef.current.querySelectorAll('.tl-row');
      if (!rows.length) {
        setCanScrollUp(false);
        setCanScrollDown(false);
        return;
      }
      const firstRect = rows[0].getBoundingClientRect();
      const lastRect = rows[rows.length - 1].getBoundingClientRect();
      const vh = window.innerHeight;
      setCanScrollUp(!(firstRect.top >= 0 && firstRect.bottom <= vh));
      setCanScrollDown(!(lastRect.top >= 0 && lastRect.bottom <= vh));
    };
    const handleScroll = () => {
      setShowHints(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateScrollState();
        setShowHints(true);
      }, 600);
    };
    updateScrollState();
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', updateScrollState);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollState);
      clearTimeout(timeoutId);
    };
  }, []);

  // ---- Scroll to year ----
  useEffect(() => {
    if (!scrollToYear) return;
    const targetYear = scrollToYear;
    const timer = setTimeout(() => {
      const el = document.getElementById(`year-${targetYear}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        window.scrollTo({
          top: rect.top + window.scrollY - 120,
          left: window.scrollX,
          behavior: 'smooth',
        });
        setExpandedYear(targetYear);
      }
      if (onScrollToYearHandled) onScrollToYearHandled();
    }, 0);
    return () => clearTimeout(timer);
  }, [scrollToYear, onScrollToYearHandled]);

  const groupedByYear = (events || []).reduce((acc, ev) => {
    if (!acc[ev.year]) acc[ev.year] = [];
    acc[ev.year].push(ev);
    return acc;
  }, {});
  const years = Object.keys(groupedByYear).sort((a, b) => Number(a) - Number(b));

  const showScrollHints = !selectedEvent && !showMediaOverlay;
  const showTopHint = idle && showScrollHints && showHints && canScrollUp;
  const showBottomHint = idle && showScrollHints && showHints && canScrollDown;

  return (
    <section className="tl-screen">
      <header className="tl-header">
        <div className="tl-header-inner">
          <div className="tl-header-label">SOLAR EVENTS DATABASE</div>
          <h1 className="tl-header-title">Historical Timeline</h1>
          <p className="tl-header-desc">
            Explore documented solar events and their impact on global communications across
            recorded history.
          </p>
        </div>
        {loading && (
          <div className="tl-status tl-status--loading">
            <span className="tl-status-dot" />
            Fetching records from database…
          </div>
        )}
        {loadError && !loading && <div className="tl-status tl-status--error">{loadError}</div>}
      </header>

      {!loading && !loadError && !years.length && (
        <div className="tl-empty">
          <span className="tl-empty-icon">◎</span>
          <p>No event records are available yet.</p>
        </div>
      )}

      {!loading && !loadError && years.length > 0 && (
        <>
          <div className="tl-rail" ref={railRef}>
            {years.map((year) => (
              <TimelineYearRow
                key={year}
                year={year}
                events={groupedByYear[year]}
                isExpanded={expandedYear === year}
                onToggle={() => setExpandedYear((prev) => (prev === year ? null : year))}
                onOpenEvent={openEventDetails}
              />
            ))}
          </div>

          {showTopHint && (
            <div className="tl-scroll-hint tl-scroll-hint--top">
              <span className="tl-scroll-arrow">↑</span>
              <span>Earlier Records Above</span>
            </div>
          )}
          {showBottomHint && (
            <div className="tl-scroll-hint tl-scroll-hint--bottom">
              <span>More Records Below</span>
              <span className="tl-scroll-arrow">↓</span>
            </div>
          )}
        </>
      )}

      {/* ---- Event Detail Overlay ---- */}
      {selectedEvent && !showMediaOverlay && (
        <EventDetailOverlay
          event={selectedEvent}
          onClose={closeEventDetails}
          onViewArticles={handleViewArticles}
        />
      )}

      {/* ---- Media / Newspaper Overlay ---- */}
      {selectedEvent && showMediaOverlay && (
        <MediaOverlay
          event={selectedEvent}
          items={mediaItems}
          index={mediaIndex}
          loading={mediaLoading}
          error={mediaError}
          onNext={handleMediaNext}
          onPrev={handleMediaPrev}
          onBackToSummary={() => setShowMediaOverlay(false)}
          onCloseAll={handleCloseMediaCompletely}
        />
      )}
    </section>
  );
}

/* ================================================================
   TimelineYearRow
   ================================================================ */
function TimelineYearRow({ year, events, isExpanded, onToggle, onOpenEvent }) {
  const sortedEvents = sortEventsByDate(events);
  return (
    <div id={`year-${year}`} className={`tl-row ${isExpanded ? 'tl-row--open' : ''}`}>
      <div className="tl-spine">
        <div className="tl-spine-line-top" />
        <div className="tl-spine-node" />
        <div className="tl-spine-line" />
      </div>
      <button className="tl-year-btn" onClick={onToggle} type="button">
        <div className="tl-year-main">
          <span className="tl-year-num">{year}</span>
          <span className="tl-year-count">
            {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
          </span>
        </div>
      </button>
      {isExpanded && (
        <div className="tl-events">
          {sortedEvents.map((ev) => (
            <button
              key={ev.id}
              className="tl-event-card"
              onClick={() => onOpenEvent(ev)}
              type="button"
            >
              <div className="tl-event-meta">
                <span className="tl-event-date">{ev.date}</span>
                {ev.type && <span className="tl-event-type">{ev.type}</span>}
                {ev.location && <span className="tl-event-location">{ev.location}</span>}
              </div>
              <div className="tl-event-title">{ev.title}</div>
              {ev.shortDescription && <div className="tl-event-desc">{ev.shortDescription}</div>}
              <div className="tl-event-cta">View details →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   EventDetailOverlay
   ================================================================ */
function EventDetailOverlay({ event, onClose, onViewArticles }) {
  const [aiState, setAiState] = useState('idle'); // idle | loading | error | rate_limit
  const [aiText, setAiText] = useState('');
  const [aiError, setAiError] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    if (!event) return;
    setAiState('idle');
    setAiText('');
    setAiError('');
    setShowAiPanel(false);
  }, [event?.id]);

  if (!event) return null;

  const handleTellMeMore = async () => {
    if (aiState === 'loading') return;
    if (tellMeMoreCache.has(event.id)) {
      setAiText(tellMeMoreCache.get(event.id));
      setShowAiPanel(true);
      return;
    }
    setAiState('loading');
    setAiError('');
    try {
      const res = await fetch('/api/ai/tell-me-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: event.title,
          date: event.fullDate,
          type: event.type,
          location: event.location,
          summary: event.summary,
          impact: event.impact,
        }),
      });
      const data = await res.json();
      if (res.status === 429 || data.error === 'rate_limit') {
        setAiState('rate_limit');
        setAiError(data.message || 'Too many requests. Please try again shortly.');
        return;
      }
      if (!res.ok) {
        setAiState('error');
        setAiError(data.message || 'Something went wrong. Please try again.');
        return;
      }
      tellMeMoreCache.set(event.id, data.result);
      setAiText(data.result);
      setAiState('idle');
      setShowAiPanel(true);
    } catch {
      setAiState('error');
      setAiError('Unable to reach the AI service. Please check your connection and try again.');
    }
  };

  // AI panel view
  if (showAiPanel) {
    return (
      <div className="ev-backdrop" onClick={onClose}>
        <div className="ev-card ev-card--ai" onClick={(e) => e.stopPropagation()}>
          <div className="ev-ai-panel-toprow">
            <button
              className="ev-ai-panel-back"
              onClick={() => setShowAiPanel(false)}
              type="button"
            >
              ← Back to Summary
            </button>
            <button className="ev-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="ev-ai-panel-header">
            <div className="ev-ai-panel-label">
              <span className="ev-ai-label-icon">✦</span> AI EXPANDED DETAIL
            </div>
            <div className="ev-ai-panel-event-title">{event.title}</div>
            <div className="ev-ai-panel-event-date">{event.fullDate}</div>
          </div>
          <div className="ev-ai-panel-body">
            <p>{aiText}</p>
          </div>
          <div className="ev-ai-panel-disclaimer">
            ✦ Generated by GPT-4o. Verify significant details with primary scientific sources.
          </div>
        </div>
      </div>
    );
  }

  // Main event view
  return (
    <div className="ev-backdrop" onClick={onClose}>
      <div className="ev-card" onClick={(e) => e.stopPropagation()}>
        <button className="ev-close" onClick={onClose} aria-label="Close details">
          ✕
        </button>

        <div className="ev-meta">
          <span className="ev-meta-date">{event.fullDate}</span>
          {event.type && <span className="ev-meta-type">{event.type}</span>}
          {event.location && <span className="ev-meta-location">{event.location}</span>}
        </div>

        <h1 className="ev-title">{event.title}</h1>
        {event.shortDescription && <p className="ev-short">{event.shortDescription}</p>}

        <div className="ev-sections">
          <div className="ev-section">
            <div className="ev-section-label">EVENT SUMMARY</div>
            <div className="ev-section-scroll">
              <p>{event.summary}</p>
            </div>
          </div>
          <div className="ev-section">
            <div className="ev-section-label">IMPACT ON COMMUNICATIONS</div>
            <div className="ev-section-scroll">
              <p>{event.impact}</p>
            </div>
          </div>
          {(aiState === 'rate_limit' || aiState === 'error') && (
            <div className="ev-ai-message ev-ai-message--error">
              <span className="ev-ai-message-icon">⚠</span>
              <span>{aiError}</span>
            </div>
          )}
        </div>

        <div className="ev-footer">
          <div className="ev-ai-btn-wrap">
            <button
              className={`ev-ai-btn ${aiState === 'loading' ? 'ev-ai-btn--loading' : ''}`}
              onClick={handleTellMeMore}
              disabled={aiState === 'loading'}
              type="button"
            >
              {aiState === 'loading' ? (
                <>
                  <span className="ev-ai-btn-spinner" />
                  Researching…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                    <path
                      d="M8 5v4M8 10.5v.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  Tell Me More
                </>
              )}
            </button>
            {aiState !== 'loading' && (
              <div className="ev-ai-tooltip">
                <span className="ev-ai-tooltip-icon">✦</span>
                Ask AI for more details about this event
              </div>
            )}
          </div>

          <button
            className="ev-articles-btn"
            onClick={() => onViewArticles && onViewArticles(event)}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect
                x="2"
                y="3"
                width="14"
                height="12"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M5 7H13M5 10H10"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            View Newspaper Articles
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MediaOverlay
   ================================================================ */
function MediaOverlay({
  event,
  items,
  index,
  loading,
  error,
  onNext,
  onPrev,
  onBackToSummary,
  onCloseAll,
}) {
  const hasItems = Array.isArray(items) && items.length > 0;
  const multipleItems = hasItems && items.length > 1;
  const safeIndex = hasItems ? Math.min(Math.max(index ?? 0, 0), items.length - 1) : 0;
  const current = hasItems ? items[safeIndex] : null;

  const scrollRef = useRef(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      setNeedsScroll(el.scrollHeight > el.clientHeight + 1);
    }, 0);
    return () => clearTimeout(t);
  }, [safeIndex, items?.length, loading]);

  return (
    <div className="media-backdrop" onClick={onCloseAll}>
      <div className="media-card" onClick={(e) => e.stopPropagation()}>
        <button className="media-close" onClick={onCloseAll} aria-label="Close">
          ✕
        </button>

        <div className="media-toprow">
          <button type="button" className="media-back-btn" onClick={onBackToSummary}>
            <span className="media-back-arrow">←</span>
            <span className="media-back-label"> Back to Summary</span>
          </button>
          <div className="media-header-info">
            <div className="media-header-title">{event?.title || 'Event'} — Newspaper Articles</div>
            <div className="media-header-date">{event?.fullDate || ''}</div>
          </div>
          {hasItems && (
            <div className="media-counter">
              {safeIndex + 1} / {items.length}
            </div>
          )}
        </div>

        {loading && <p className="media-state">Loading articles…</p>}
        {!loading && error && <p className="media-state media-state--error">{error}</p>}
        {!loading && !error && !hasItems && (
          <p className="media-state">No newspaper articles are linked to this event yet.</p>
        )}

        {!loading && hasItems && (
          <>
            <div className="media-body">
              {multipleItems && (
                <button
                  type="button"
                  className="media-nav media-nav--left"
                  onClick={onPrev}
                  disabled={loading}
                  aria-label="Previous article"
                >
                  <span>‹</span>
                  <span className="media-nav-label">Prev</span>
                </button>
              )}
              <div className="media-image-wrap">
                <div
                  ref={scrollRef}
                  className={`media-image-scroll ${needsScroll ? 'is-scrollable' : 'is-centered'}`}
                >
                  <img
                    src={current?.url}
                    alt={current?.caption || 'Newspaper article'}
                    className="media-img"
                    onLoad={() => {
                      const el = scrollRef.current;
                      if (!el) return;
                      setNeedsScroll(el.scrollHeight > el.clientHeight + 1);
                    }}
                  />
                </div>
              </div>
              {multipleItems && (
                <button
                  type="button"
                  className="media-nav media-nav--right"
                  onClick={onNext}
                  disabled={loading}
                  aria-label="Next article"
                >
                  <span>›</span>
                  <span className="media-nav-label">Next</span>
                </button>
              )}
            </div>
            <div className="media-caption">{current?.caption || 'No caption provided.'}</div>
          </>
        )}
      </div>
    </div>
  );
}
