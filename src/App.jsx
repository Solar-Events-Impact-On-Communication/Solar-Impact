/* =========================================================
   Solar Events — App.jsx
   ========================================================= */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import './App.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error('ErrorBoundary caught:', err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="helper" style={{ padding: 16, color: '#ffb3b3' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Admin modal crashed:</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {String(this.state.err?.stack || this.state.err)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* --- Helpers for DB events --- */

function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(path || '').replace(/^\/+/, '');
  return b ? `${b}/${p}` : `/${p}`;
}

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

function formatEventDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  const monthName = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  return `${monthName} ${day}`;
}

function formatEventDateLabelWithYear(dateStr) {
  if (!dateStr) return '—';

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);

  const MONTHS = MONTH_NAMES;

  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();

  return `${month} ${day}, ${year}`;
}

// Full date like "September 1, 1859" for detail + media overlays
function formatFullDateLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  const monthName = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${monthName} ${day}, ${year}`;
}

function extractYear(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getUTCFullYear());
}

// helper to sort events within a year by month/day
const MONTH_ORDER = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

function parseMonthDay(str) {
  if (!str) return { monthIndex: 13, day: 0 };
  const parts = str.split(' ');
  const month = parts[0];
  const day = parseInt(parts[1], 10) || 0;
  return {
    monthIndex: MONTH_ORDER[month] || 13,
    day,
  };
}

function sortEventsByDate(events) {
  return [...events].sort((a, b) => {
    const aMD = parseMonthDay(a.date);
    const bMD = parseMonthDay(b.date);
    if (aMD.monthIndex !== bMD.monthIndex) {
      return aMD.monthIndex - bMD.monthIndex;
    }
    return aMD.day - bMD.day;
  });
}

// Base URLs (Vercel uses env vars; local/dev can fall back to same-origin)
const API_BASE = '';
const ADMIN_API_BASE = import.meta.env.VITE_ADMIN_API_BASE || '';

/* === App === */

function App() {
  // ---- Events from API ----
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState('');

  // main view & nav
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
      return 'admin';
    }
    return 'home';
  });

  const [topbarStacked, setTopbarStacked] = useState(false);
  const topbarInnerRef = useRef(null);
  const brandRef = useRef(null);
  const menuRef = useRef(null);
  const yearToolsRef = useRef(null);
  const toolsRowRef = useRef(null);

  useEffect(() => {
    function computeStacked() {
      // Only the homepage has the year tools, so only the homepage should ever stack.
      if (view !== 'home') {
        setTopbarStacked(false);
        return;
      }

      const inner = topbarInnerRef.current;
      const brand = brandRef.current;
      const toolsRow = toolsRowRef.current;

      if (!inner || !brand || !toolsRow) return;

      const gap = 16; // match your CSS gap
      const innerWidth = inner.clientWidth;

      const required = brand.offsetWidth + gap + toolsRow.offsetWidth;
      setTopbarStacked(required > innerWidth);
    }

    computeStacked();

    const ro = new ResizeObserver(() => computeStacked());

    if (topbarInnerRef.current) ro.observe(topbarInnerRef.current);
    if (brandRef.current) ro.observe(brandRef.current);
    if (menuRef.current) ro.observe(menuRef.current);
    if (yearToolsRef.current) ro.observe(yearToolsRef.current);
    if (toolsRowRef.current) ro.observe(toolsRowRef.current);

    window.addEventListener('resize', computeStacked);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', computeStacked);
    };
  }, [view]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const isTimeline = view === 'home';
  const isAbout = view === 'about';
  const isAdmin = view === 'admin';

  useEffect(() => {
    document.title = isAdmin ? 'Solar Impacts Admin' : 'Solar Impacts';
  }, [isAdmin]);

  // media overlay state
  const [showMediaOverlay, setShowMediaOverlay] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');

  // search-related state
  const [yearQuery, setYearQuery] = useState('');
  const [scrollToYear, setScrollToYear] = useState(null);
  const [searchInfo, setSearchInfo] = useState('');
  const [searchError, setSearchError] = useState('');

  const handleMediaNext = () => {
    if (!mediaItems.length) return;
    setMediaIndex((prev) => (prev + 1) % mediaItems.length);
  };

  const handleMediaPrev = () => {
    if (!mediaItems.length) return;
    setMediaIndex((prev) => {
      if (mediaItems.length === 0) return 0;
      return (prev - 1 + mediaItems.length) % mediaItems.length;
    });
  };

  // Derived YEARS and DECADES from loaded events
  const YEARS = Array.from(new Set(events.map((e) => e.year))).sort(
    (a, b) => Number(a) - Number(b)
  );

  const DECADES = Array.from(new Set(YEARS.map((y) => Math.floor(Number(y) / 10) * 10))).sort(
    (a, b) => a - b
  );

  // decade/year picker
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [pickerDecade, setPickerDecade] = useState(null);

  // refs for click-outside detection
  const menuButtonRef = useRef(null);
  const navDrawerRef = useRef(null);
  const yearSearchRef = useRef(null);

  // ---- Fetch events from API once on mount ----
  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoadingEvents(true);
        setEventsError('');
        const res = await fetch(joinUrl(API_BASE, 'api/events'));
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();

        // normalize DB rows to shape used by the UI
        const normalized = data.map((row) => {
          const year = extractYear(row.event_date);
          const dateLabel = formatEventDateLabel(row.event_date);
          const fullDate = formatFullDateLong(row.event_date);
          return {
            id: row.id,
            year,
            date: dateLabel, // "Month Day" for timeline
            fullDate, // full date for overlays
            title: row.title,
            type: row.event_type,
            shortDescription: row.short_description,
            summary: row.summary,
            impact: row.impact_on_communication,
            location: row.location || '',
          };
        });

        setEvents(normalized);
      } catch (err) {
        console.error('Error loading events:', err);
        setEventsError('Unable to load events right now. Please try again later.');
      } finally {
        setLoadingEvents(false);
      }
    }

    fetchEvents();
  }, []);

  // auto-hide search notifications after 5 seconds
  useEffect(() => {
    if (!searchInfo && !searchError) return;
    const id = setTimeout(() => {
      setSearchInfo('');

      setSearchError('');
    }, 5000);

    return () => clearTimeout(id);
  }, [searchInfo, searchError]);

  // Whenever decades are available for the first time, set initial picker decade
  useEffect(() => {
    if (DECADES.length && pickerDecade === null) {
      setPickerDecade(DECADES[0]);
    }
  }, [DECADES, pickerDecade]);

  // click-outside to close menu + year picker
  useEffect(() => {
    function handleDocumentClick(event) {
      const target = event.target;

      if (menuOpen) {
        const menuBtnEl = menuButtonRef.current;
        const navEl = navDrawerRef.current;

        const clickInsideMenu =
          (menuBtnEl && menuBtnEl.contains(target)) || (navEl && navEl.contains(target));

        if (!clickInsideMenu) {
          setMenuOpen(false);
        }
      }

      if (showYearPicker) {
        const yearSearchEl = yearSearchRef.current;
        const clickInsideYearSearch = yearSearchEl && yearSearchEl.contains(target);

        if (!clickInsideYearSearch) {
          setShowYearPicker(false);
        }
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [menuOpen, showYearPicker]);

  const handleNavClick = (nextView) => {
    setView(nextView);
    setMenuOpen(false);
    setShowYearPicker(false);

    if (nextView !== 'home') {
      setSelectedEvent(null);
      setShowMediaOverlay(false);
      setMediaItems([]);
    }
  };

  const openEventDetails = (event) => {
    setView('home');
    setSelectedEvent(event);
    setShowMediaOverlay(false);
    setMediaItems([]);
  };

  const closeEventDetails = () => {
    setSelectedEvent(null);
    setShowMediaOverlay(false);
    setMediaItems([]);
  };

  // Load media for an event + open media overlay
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
      if (!data || !data.length) {
        setMediaError('No newspaper articles are linked to this event yet.');
      }
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

  const handleYearSearchSubmit = (e) => {
    e.preventDefault();

    const trimmed = (yearQuery || '').trim();
    const isFourDigits = /^\d{4}$/.test(trimmed);

    if (!isFourDigits) {
      setSearchError('Please enter a 4-digit year (for example, 1989).');
      setSearchInfo('');
      setView('home');
      setMenuOpen(false);
      return;
    }

    if (!YEARS.length) {
      setSearchError('Events are still loading. Please try again in a moment.');
      setSearchInfo('');
      return;
    }

    setSearchError('');
    const num = parseInt(trimmed, 10);
    const targetYear = String(num);

    let closest = YEARS[0];
    let hasExact = false;

    YEARS.forEach((y) => {
      if (y === targetYear) {
        hasExact = true;
        closest = y;
      }
    });

    if (!hasExact) {
      closest = YEARS.reduce((prev, curr) => {
        const diffPrev = Math.abs(Number(prev) - num);
        const diffCurr = Math.abs(Number(curr) - num);
        return diffCurr < diffPrev ? curr : prev;
      }, YEARS[0]);

      setSearchInfo(`No events for ${targetYear}. Showing closest year: ${closest}.`);
    } else {
      setSearchInfo('');
    }

    setView('home');
    setMenuOpen(false);
    setScrollToYear(closest);
  };

  const handleYearPickerSelect = (year) => {
    setYearQuery(String(year));
    setSearchError('');
    setSearchInfo('');
    setView('home');
    setMenuOpen(false);
    setScrollToYear(String(year));
    setShowYearPicker(false);
  };

  const renderView = () => {
    switch (view) {
      case 'birthday':
        return <BirthdayView />;
      case 'about':
        return <AboutView />;
      case 'live':
        return <LiveView />;
      case 'admin':
        return <AdminView />;
      case 'home':
      default:
        return (
          <HomeView
            events={events}
            loading={loadingEvents}
            loadError={eventsError}
            onOpenEvent={openEventDetails}
            showScrollHints={!selectedEvent && !showMediaOverlay}
            scrollToYear={scrollToYear}
            onScrollToYearHandled={() => setScrollToYear(null)}
          />
        );
    }
  };

  return (
    <div className="app">
      <header
        className={`topbar ${view === 'home' ? 'topbar--timeline' : ''} ${
          view === 'home' && topbarStacked ? 'topbar--stacked' : ''
        }`}
      >
        <div ref={topbarInnerRef} className="topbar-inner">
          {/* BRAND */}
          <button
            ref={brandRef}
            className="brand brand-button topbar-brand"
            onClick={() => handleNavClick('home')}
            type="button"
          >
            SOLAR EVENTS
          </button>

          {/* TOOLS ROW (MENU + YEAR) */}
          <div
            ref={toolsRowRef}
            className={`topbar-tools-row ${view === 'home' ? 'topbar-tools-row--timeline' : 'topbar-tools-row--simple'}`}
          >
            {/* MENU */}
            <div ref={menuRef} className="topbar-menu">
              <button
                ref={menuButtonRef}
                className={`menu-button ${menuOpen ? 'is-open' : ''}`}
                onClick={() => {
                  if (!menuOpen) setShowYearPicker(false);
                  setMenuOpen(!menuOpen);
                }}
                aria-label="Toggle menu"
                type="button"
              >
                <span className="menu-icon">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="menu-text">MENU</span>
              </button>
            </div>

            {/* YEAR TOOLS */}
            {view === 'home' ? (
              <form
                ref={(el) => {
                  yearSearchRef.current = el; // click-outside logic
                  yearToolsRef.current = el; // keep if you want, but toolsRow is what matters now
                }}
                className="year-search"
                onSubmit={handleYearSearchSubmit}
                noValidate
              >
                <input
                  type="text"
                  name="year"
                  className="year-search-input"
                  placeholder="YEAR"
                  inputMode="numeric"
                  maxLength={4}
                  value={yearQuery}
                  onFocus={() => {
                    if (menuOpen) setMenuOpen(false);
                  }}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setYearQuery(cleaned);
                  }}
                />

                <button className="year-search-button" type="submit">
                  Search
                </button>

                <button
                  className="year-search-browse"
                  type="button"
                  onClick={() => {
                    if (menuOpen) setMenuOpen(false);
                    setShowYearPicker((prev) => !prev);
                  }}
                  aria-expanded={showYearPicker}
                  title="Browse timeline years by decade"
                >
                  Browse
                </button>

                {showYearPicker && (
                  <div className="year-search-popover">
                    <div className="year-search-popover-section">
                      <div className="year-search-popover-label">Decades</div>
                      <div className="year-search-decade-list">
                        {DECADES.map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={
                              'year-search-decade ' + (pickerDecade === d ? 'is-active' : '')
                            }
                            onClick={() => setPickerDecade(d)}
                          >
                            {d}s
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="year-search-popover-section">
                      <div className="year-search-popover-label">Years</div>
                      <div className="year-search-year-list">
                        {YEARS.filter((y) => Math.floor(y / 10) * 10 === pickerDecade).map((y) => (
                          <button
                            key={y}
                            type="button"
                            className="year-search-year"
                            onClick={() => handleYearPickerSelect(y)}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </form>
            ) : (
              <div
                ref={yearToolsRef}
                style={{ width: 0, height: 0, overflow: 'hidden' }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      </header>

      {view !== 'admin' && (searchInfo || searchError) && (
        <div
          className={
            'global-banner ' + (searchError ? 'global-banner--error' : 'global-banner--info')
          }
        >
          {searchError || searchInfo}
        </div>
      )}

      <nav ref={navDrawerRef} className={`nav-drawer ${menuOpen ? 'nav-drawer--open' : ''}`}>
        <button className="nav-item" onClick={() => handleNavClick('home')}>
          <span className="nav-icon">🏠</span>
          <span>Home</span>
        </button>
        <button className="nav-item" onClick={() => handleNavClick('live')}>
          <span className="nav-icon">📡</span>
          <span>Live Data</span>
        </button>
        <button className="nav-item" onClick={() => handleNavClick('birthday')}>
          <span className="nav-icon">🎂</span>
          <span>Events On My Birthday</span>
        </button>
        <button className="nav-item" onClick={() => handleNavClick('about')}>
          <span className="nav-icon">ℹ️</span>
          <span>About</span>
        </button>
      </nav>

      <main
        className={`main ${isTimeline ? 'main--timeline' : ''} ${
          isAbout ? 'main--about' : ''
        } ${isAdmin ? 'main--admin' : ''}`}
      >
        {renderView()}

        {/* 1) Event details overlay – shown when an event is selected
        and the media overlay is NOT currently open */}
        {selectedEvent && !showMediaOverlay && (
          <EventDetailOverlay
            event={selectedEvent}
            onClose={closeEventDetails}
            onViewArticles={handleViewArticles}
          />
        )}

        {/* 2) Newspaper article overlay – shown when showMediaOverlay is true */}
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
      </main>

      <footer className="footer">© {new Date().getFullYear()} Solar Events</footer>
    </div>
  );
}

/* --- Views --- */

/* Home / Timeline */

function HomeView({
  events,
  loading,
  loadError,
  onOpenEvent,
  showScrollHints = true,
  scrollToYear,
  onScrollToYearHandled,
}) {
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [expandedYear, setExpandedYear] = useState(null);
  const railRef = useRef(null);
  const [hintWindowActive, setHintWindowActive] = useState(false);

  const groupedByYear = (events || []).reduce((acc, ev) => {
    if (!acc[ev.year]) acc[ev.year] = [];
    acc[ev.year].push(ev);
    return acc;
  }, {});

  const years = Object.keys(groupedByYear).sort((a, b) => Number(a) - Number(b));

  // Delay showing scroll hints, then hide them permanently after a while
  useEffect(() => {
    const delayMs = 1000;
    const visibleMs = 8000;

    const delayId = setTimeout(() => {
      setHintWindowActive(true);
    }, delayMs);

    const hideId = setTimeout(() => {
      setHintWindowActive(false);
    }, delayMs + visibleMs);

    return () => {
      clearTimeout(delayId);
      clearTimeout(hideId);
    };
  }, []);

  useEffect(() => {
    let timeoutId;

    const updateScrollState = () => {
      if (!railRef.current) {
        setCanScrollUp(false);
        setCanScrollDown(false);
        return;
      }

      const rows = railRef.current.querySelectorAll('.timeline-row');
      if (!rows.length) {
        setCanScrollUp(false);
        setCanScrollDown(false);
        return;
      }

      const firstRect = rows[0].getBoundingClientRect();
      const lastRect = rows[rows.length - 1].getBoundingClientRect();
      const vh = window.innerHeight;

      const firstFullyVisible = firstRect.top >= 0 && firstRect.bottom <= vh;
      const lastFullyVisible = lastRect.top >= 0 && lastRect.bottom <= vh;

      setCanScrollUp(!firstFullyVisible);
      setCanScrollDown(!lastFullyVisible);
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

  useEffect(() => {
    if (!scrollToYear) return;

    const targetYear = scrollToYear;

    const timer = setTimeout(() => {
      const el = document.getElementById(`year-${targetYear}`);
      if (el) {
        const headerOffset = 120;

        const rect = el.getBoundingClientRect();
        const elementY = rect.top + window.scrollY;
        const targetY = elementY - headerOffset;

        window.scrollTo({
          top: targetY,
          left: window.scrollX,
          behavior: 'smooth',
        });

        setExpandedYear(targetYear);
      }

      if (onScrollToYearHandled) onScrollToYearHandled();
    }, 0);

    return () => clearTimeout(timer);
  }, [scrollToYear, onScrollToYearHandled]);

  const showTopHint = hintWindowActive && showScrollHints && showHints && canScrollUp;

  const showBottomHint = hintWindowActive && showScrollHints && showHints && canScrollDown;

  return (
    <section className="timeline-screen">
      <header className="timeline-header">
        <h1>Timeline</h1>
        <p>Scroll through key years and expand them to explore individual solar events.</p>

        {loading && (
          <div className="timeline-alert timeline-alert--info">
            Loading events from the database…
          </div>
        )}
        {loadError && !loading && (
          <div className="timeline-alert timeline-alert--error">{loadError}</div>
        )}
      </header>

      {!loading && !loadError && !years.length && (
        <div style={{ padding: '24px' }}>
          <p>No events are available yet.</p>
        </div>
      )}

      {!loading && !loadError && years.length > 0 && (
        <>
          <div className="timeline-rail" ref={railRef}>
            {years.map((year) => (
              <TimelineYearRow
                key={year}
                year={year}
                events={groupedByYear[year]}
                isExpanded={expandedYear === year}
                onToggle={() => setExpandedYear((prev) => (prev === year ? null : year))}
                onOpenEvent={onOpenEvent}
              />
            ))}
          </div>

          {showTopHint && (
            <div className="scroll-indicator scroll-indicator--top">
              <span className="scroll-arrow scroll-arrow--up">↑</span>
              <span>Scroll up for earlier years</span>
            </div>
          )}

          {showBottomHint && (
            <div className="scroll-indicator scroll-indicator--bottom">
              <span>Scroll to explore more years</span>
              <span className="scroll-arrow">↓</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TimelineYearRow({ year, events, isExpanded, onToggle, onOpenEvent }) {
  const sortedEvents = sortEventsByDate(events);

  return (
    <div
      id={`year-${year}`}
      className={`timeline-row timeline-row--year ${isExpanded ? 'is-expanded' : ''}`}
    >
      <div className="timeline-dot" />
      <button className="timeline-year-header" onClick={onToggle}>
        <div className="timeline-year-text">
          <div className="timeline-year-main">
            <div className="timeline-year">{year}</div>
            <div className="timeline-year-count">
              {sortedEvents.length} event{sortedEvents.length > 1 ? 's' : ''}
            </div>
          </div>

          <div className="timeline-year-subtitle">
            {isExpanded ? 'Click To Close' : 'Click To View Event'}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="timeline-year-events">
          {sortedEvents.map((ev) => (
            <button key={ev.id} className="timeline-year-event" onClick={() => onOpenEvent(ev)}>
              <div className="timeline-year-event-date">{ev.date}</div>
              {ev.type && <div className="timeline-year-event-type">{ev.type}</div>}
              {ev.location && <div className="timeline-year-event-location">{ev.location}</div>}
              <div className="timeline-year-event-title">{ev.title}</div>
              {ev.shortDescription && (
                <div className="timeline-year-event-description">{ev.shortDescription}</div>
              )}
              <div className="timeline-year-event-hint">Click For More Details</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Simple views */

function BirthdayView() {
  return (
    <section className="panel">
      <h1>Events On My Birthday</h1>
      <p className="helper">Enter your birthday to find solar events that happened on that date.</p>
      <form className="birthday-form" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          placeholder="MM/DD"
          className="input"
          aria-label="Birthday month and day"
        />
        <button className="primary">Search</button>
      </form>
      <div className="results helper">
        Results will appear here. (Later this will be AI-powered.)
      </div>
    </section>
  );
}

function AboutView() {
  const [sections, setSections] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadAbout() {
      try {
        setLoading(true);
        setError('');

        const [aboutRes, teamRes] = await Promise.all([
          fetch(`${API_BASE}/api/about`),
          fetch(`${API_BASE}/api/team`),
        ]);

        if (!aboutRes.ok || !teamRes.ok) {
          throw new Error('HTTP error when loading about data');
        }

        const aboutData = await aboutRes.json();
        const teamData = await teamRes.json();

        if (cancelled) return;

        setSections(aboutData || []);
        setTeam(teamData || []);
      } catch (err) {
        console.error('Error loading about/team data:', err);
        if (!cancelled) {
          setError('Unable to load About page content right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAbout();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="panel panel--wide">
      <h1>About This Project</h1>

      {loading && !error && <p className="helper">Loading About page content…</p>}

      {error && (
        <p className="helper" style={{ color: '#ffb3b3' }}>
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          {/* Dynamic sections from about_sections */}
          <div className="about-sections">
            {sections.length === 0 && (
              <p className="helper">No About content has been added yet.</p>
            )}

            {sections.map((section) => (
              <article key={section.id} className="about-section">
                {section.title && <h2 className="about-section-title">{section.title}</h2>}
                {section.text && <p className="about-section-text">{section.text}</p>}
              </article>
            ))}
          </div>

          {/* Team from team_members */}
          <div className="about-team">
            <h2>Meet The Team</h2>

            {team.length === 0 ? (
              <p className="helper">Team members will appear here once they are added.</p>
            ) : (
              <div className="about-team-grid">
                {team.map((member) => (
                  <div key={member.id} className="about-team-member">
                    <div className="about-team-photo-wrapper">
                      {member.image_url ? (
                        <img
                          src={member.image_url}
                          alt={member.name}
                          className="about-team-photo"
                        />
                      ) : (
                        <div className="about-team-photo-fallback">
                          {member.name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 3)
                            .toUpperCase() || '?'}
                        </div>
                      )}
                    </div>

                    <div className="about-team-info">
                      <div className="about-team-name">{member.name}</div>
                      <div className="about-team-role">{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function LiveView() {
  return (
    <section className="panel">
      <h1>Live Data (Placeholder)</h1>
      <p className="helper">
        These values are static for now. Later, they’ll come from NASA/NOAA APIs.
      </p>
      <div className="cards">
        <div className="card">
          <h2>Latest Solar Flare</h2>
          <p>April 5th, 2024 — X1.2</p>
        </div>
        <div className="card">
          <h2>Geomagnetic Storms</h2>
          <p>G2 (Moderate)</p>
        </div>
        <div className="card">
          <h2>Solar Wind Speed</h2>
          <p>532 km/s</p>
        </div>
        <div className="card">
          <h2>Sunspot Number</h2>
          <p>79</p>
        </div>
      </div>
    </section>
  );
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

function AvatarCropModal({ isOpen, imageSrc, onClose, onSave, onLoaded }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  if (!isOpen || !imageSrc) return null;

  const handleSaveClick = async () => {
    if (!croppedAreaPixels) return;

    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const diameter = Math.min(croppedAreaPixels.width, croppedAreaPixels.height);
    const canvas = document.createElement('canvas');
    canvas.width = diameter;
    canvas.height = diameter;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, diameter, diameter);

    // Circular mask
    ctx.beginPath();
    ctx.arc(diameter / 2, diameter / 2, diameter / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      diameter,
      diameter,
      0,
      0,
      diameter,
      diameter
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    await onSave(dataUrl);
  };

  return (
    <div className="avatar-modal-backdrop">
      <div className="avatar-modal">
        <h3>Adjust Profile Photo</h3>

        <div className="avatar-crop-container">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={() => {
              if (onLoaded) onLoaded();
            }}
          />
        </div>

        <div className="avatar-modal-controls">
          <div className="avatar-modal-zoom">
            <span>Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>

          <div className="avatar-modal-buttons">
            <button
              type="button"
              className="admin-about-edit-button admin-about-edit-button--ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="button" className="admin-about-edit-button" onClick={handleSaveClick}>
              Save Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminView() {
  // --- Login state ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [needsSecurity, setNeedsSecurity] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // --- Events table state ---
  const [adminEvents, setAdminEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');

  // --- Edit Event modal state ---
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  const [createQueuedMedia, setCreateQueuedMedia] = useState([]);
  const [createMediaIndex, setCreateMediaIndex] = useState(0);

  const [eventForm, setEventForm] = useState({
    date: '',
    event_type: '',
    location: '',
    title: '',
    short_description: '',
    summary: '',
    impact_on_communication: '',
  });
  const [eventSaving, setEventSaving] = useState(false);

  const [eventMedia, setEventMedia] = useState([]);
  const [eventMediaIndex, setEventMediaIndex] = useState(0);
  const [eventMediaLoading, setEventMediaLoading] = useState(false);
  const [eventMediaError, setEventMediaError] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaCaption, setNewMediaCaption] = useState('');

  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [deleteEventTarget, setDeleteEventTarget] = useState(null);
  const [deleteEventBusy, setDeleteEventBusy] = useState(false);

  const openDeleteEventDialog = (evt) => {
    setDeleteEventTarget(evt);
    setDeleteEventOpen(true);
  };

  const closeDeleteEventDialog = () => {
    if (deleteEventBusy) return;
    setDeleteEventOpen(false);
    setDeleteEventTarget(null);
  };

  const confirmDeleteEvent = async () => {
    if (!deleteEventTarget?.id) return;

    try {
      setDeleteEventBusy(true);

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/events/${deleteEventTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();

      if (!res.ok) {
        const msg =
          (body && typeof body === 'object' && (body.error || body.details)) ||
          (typeof body === 'string' && body) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      await loadAdminEvents();
      closeDeleteEventDialog();
    } catch (err) {
      console.error('[ADMIN] Delete event failed:', err);
      alert(err.message || 'Failed to delete event.');
    } finally {
      setDeleteEventBusy(false);
    }
  };

  // Admin media delete confirmation
  const [mediaDeleteOpen, setMediaDeleteOpen] = useState(false);
  const [mediaDeleteTarget, setMediaDeleteTarget] = useState(null);
  const [mediaDeleteBusy, setMediaDeleteBusy] = useState(false);

  const [mediaUploadBusy, setMediaUploadBusy] = useState(false);
  const [mediaUploadError, setMediaUploadError] = useState('');

  const [cropperBlocking, setCropperBlocking] = useState(false);

  const [createMediaUploading, setCreateMediaUploading] = useState(false);
  const [createMediaUploadingText, setCreateMediaUploadingText] = useState('');

  // Add-article modal state
  const [addArticleOpen, setAddArticleOpen] = useState(false);
  const [addArticleCaption, setAddArticleCaption] = useState('');
  const [addArticleFile, setAddArticleFile] = useState(null);

  // Add-article validation state (per-field)
  const [addArticleErrors, setAddArticleErrors] = useState({
    file: '',
    caption: '',
  });
  const [addArticleTriedSubmit, setAddArticleTriedSubmit] = useState(false);

  // open the modal from the "+" button
  const openAddArticleModal = () => {
    setMediaUploadError('');
    setAddArticleCaption('');
    setAddArticleFile(null);
    setAddArticleErrors({ file: '', caption: '' });
    setAddArticleTriedSubmit(false);
    setAddArticleOpen(true);
  };

  const closeAddArticleModal = () => {
    if (mediaUploadBusy) return;

    setAddArticleOpen(false);
    setAddArticleCaption('');
    setAddArticleFile(null);

    setAddArticleErrors({ file: '', caption: '' });
    setAddArticleTriedSubmit(false);
    setMediaUploadError('');
  };

  const uploadAddArticle = async () => {
    setAddArticleTriedSubmit(true);

    const caption = (addArticleCaption || '').trim();
    const nextErrors = {
      file: addArticleFile ? '' : '* Required field missing',
      caption: caption ? '' : '* Required field missing',
    };

    setAddArticleErrors(nextErrors);

    // Stop if validation fails
    if (nextErrors.file || nextErrors.caption) return;

    // CREATE MODE: queue locally only
    if (isCreatingEvent) {
      const localId = `local-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(addArticleFile);

      setCreateQueuedMedia((prev) => {
        const next = [...prev, { localId, file: addArticleFile, previewUrl, caption }];
        setCreateMediaIndex(next.length - 1);
        return next;
      });

      closeAddArticleModal();
      return;
    }

    // EDIT MODE: upload immediately to server
    if (!editingEvent) return;

    try {
      setMediaUploadBusy(true);
      setMediaUploadError('');

      const fd = new FormData();
      fd.append('file', addArticleFile);
      fd.append('caption', caption);

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/events/${editingEvent.id}/media`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });

      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : await res.text();

      if (!res.ok) {
        const msg =
          (data && typeof data === 'object' && (data.error || data.details)) ||
          (typeof data === 'string' && data) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      // If API returns the inserted row, append; otherwise reload list
      if (data && typeof data === 'object' && data.url) {
        setEventMedia((prev) => {
          const next = [...prev, data];
          setEventMediaIndex(next.length - 1);
          return next;
        });
      } else {
        const reload = await fetch(`${ADMIN_API_BASE}/api/admin/events/${editingEvent.id}/media`, {
          credentials: 'include',
        });
        const rows = await reload.json();
        setEventMedia(Array.isArray(rows) ? rows : []);
        setEventMediaIndex(0);
      }

      closeAddArticleModal();
    } catch (err) {
      setMediaUploadError(err.message || 'Failed to upload article.');
    } finally {
      setMediaUploadBusy(false);
    }
  };

  const handleCaptionSaveForModal = async (currentMedia, captionDraft) => {
    // CREATE MODE: update queued media caption locally
    if (isCreatingEvent) {
      if (!currentMedia?.localId) return true;

      setCreateQueuedMedia((prev) =>
        prev.map((m) =>
          m.localId === currentMedia.localId ? { ...m, caption: (captionDraft || '').trim() } : m
        )
      );

      return true;
    }

    // EDIT MODE: server PATCH
    if (!editingEvent || !currentMedia?.id) return false;
    return await handleUpdateMediaCaption(currentMedia.id, captionDraft);
  };

  const requestDeleteCurrentMedia = (currentMedia) => {
    if (!currentMedia) return;
    setMediaDeleteTarget(currentMedia);
    setMediaDeleteOpen(true);
  };

  const closeMediaDeleteDialog = () => {
    if (mediaDeleteBusy) return;
    setMediaDeleteOpen(false);
    setMediaDeleteTarget(null);
  };

  const confirmDeleteMedia = async () => {
    if (!editingEvent || !mediaDeleteTarget) return;

    try {
      setMediaDeleteBusy(true);

      const res = await fetch(
        `${ADMIN_API_BASE}/api/admin/events/${editingEvent.id}/media/${mediaDeleteTarget.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      let body;
      const contentType = res.headers.get('content-type') || '';
      try {
        body = contentType.includes('application/json') ? await res.json() : await res.text();
      } catch {
        body = null;
      }

      if (!res.ok) {
        console.error('[ADMIN] Delete failed:', res.status, body);
        const msg =
          (body && typeof body === 'object' && (body.error || body.details)) ||
          (typeof body === 'string' && body) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setEventMedia((prev) => {
        const next = prev.filter((m) => m.id !== mediaDeleteTarget.id);

        if (next.length === 0) {
          setEventMediaIndex(0);
        } else {
          setEventMediaIndex((idx) => (idx >= next.length ? next.length - 1 : idx));
        }

        return next;
      });

      closeMediaDeleteDialog();
    } catch (err) {
      console.error('[ADMIN] Error deleting media:', err);
      alert(err.message || 'Failed to delete article. Please try again.');
    } finally {
      setMediaDeleteBusy(false);
    }
  };

  const [adminYearQuery, setAdminYearQuery] = useState('');
  const [adminYearFilter, setAdminYearFilter] = useState(null);
  const [showAdminYearPicker, setShowAdminYearPicker] = useState(false);
  const [adminPickerDecade, setAdminPickerDecade] = useState(null);

  // --- Admin accounts (super admin only) ---
  const [adminUsers, setAdminUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  // --- Security questions (for accounts & profile) ---
  const [securityQuestions, setSecurityQuestions] = useState([]);

  // --- Tabs ---
  // events | accounts | profile | about
  const [adminTab, setAdminTab] = useState('events');

  const isSuperAdmin = loggedInUser?.username === 'admin';

  const adminUniqueYears = Array.from(
    new Set(adminEvents.map((evt) => getEventYear(evt.event_date)).filter(Boolean))
  ).sort();

  // Group admin event years into decades (1850s, 1860s, etc.)
  const adminDecades = Array.from(
    new Set(adminUniqueYears.map((y) => Math.floor(Number(y) / 10) * 10))
  ).sort((a, b) => a - b);

  useEffect(() => {
    if (adminTab !== 'events') return;
    if (adminDecades.length && adminPickerDecade === null) {
      setAdminPickerDecade(adminDecades[0]);
    }
  }, [adminDecades, adminPickerDecade, adminTab]);

  // --- About page state ---
  const [aboutSections, setAboutSections] = useState([]);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [aboutError, setAboutError] = useState('');
  const [aboutEditMode, setAboutEditMode] = useState(false);
  const [aboutSaving, setAboutSaving] = useState(false);

  // --- Team admin state ---
  const [adminTeam, setAdminTeam] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamPhotoError, setTeamPhotoError] = useState('');
  const [newMember, setNewMember] = useState({ name: '', role: '' });
  const [newMemberPhotoFile, setNewMemberPhotoFile] = useState(null);
  const [newMemberPhotoPreview, setNewMemberPhotoPreview] = useState('');
  const [newMemberCroppedDataUrl, setNewMemberCroppedDataUrl] = useState('');
  const newMemberFileInputRef = useRef(null);
  const [savingMemberId, setSavingMemberId] = useState(null);
  const [addingMember, setAddingMember] = useState(false);

  const [editingMemberId, setEditingMemberId] = useState(null);

  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarTargetId, setAvatarTargetId] = useState(null);
  const [avatarImageSrc, setAvatarImageSrc] = useState('');

  /* NEW: global team-blocking overlay state */
  const [teamBlocking, setTeamBlocking] = useState(false);
  const [teamBlockingText, setTeamBlockingText] = useState('');

  const openAvatarModalFor = (memberId, file) => {
    if (!file) return;

    if (file.size > MAX_PHOTO_BYTES) {
      setTeamPhotoError('Images must be 2 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarImageSrc(reader.result.toString());
      setAvatarTargetId(memberId);
      setCropperBlocking(true);
      setAvatarModalOpen(true);
      setTeamPhotoError('');
    };
    reader.readAsDataURL(file);
  };

  const closeAvatarModal = () => {
    setAvatarModalOpen(false);
    setCropperBlocking(false);
    setAvatarTargetId(null);
    setAvatarImageSrc('');
  };

  const handlePhotoUpload = async (memberId, imageData) => {
    try {
      setTeamBlocking(true);
      setTeamBlockingText('Uploading profile photo…');

      const res = await fetch(`/api/admin/team/${memberId}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageData }),
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }

      const data = await res.json(); // { image_url }
      setAdminTeam((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, image_url: data.image_url } : m))
      );
    } catch (err) {
      console.error('Error uploading team photo:', err);
      setTeamPhotoError('Failed to upload photo. Please try again.');
    } finally {
      setTeamBlocking(false);
      setTeamBlockingText('');
    }
  };

  const handleAvatarSave = async (croppedDataUrl) => {
    if (!avatarTargetId || !croppedDataUrl) {
      closeAvatarModal();
      return;
    }

    // New member store cropped image locally
    if (avatarTargetId === '__NEW__') {
      setNewMemberCroppedDataUrl(croppedDataUrl);
      closeAvatarModal();
      return;
    }

    // Existing member upload immediately
    await handlePhotoUpload(avatarTargetId, croppedDataUrl);
    closeAvatarModal();
  };

  // Photo delete handler
  const handlePhotoDelete = async (memberId) => {
    try {
      setTeamBlocking(true);
      setTeamBlockingText('Removing profile photo…');

      const res = await fetch(`/api/admin/team/${memberId}/photo`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status}`);
      }

      setAdminTeam((prev) => prev.map((m) => (m.id === memberId ? { ...m, image_url: null } : m)));
    } catch (err) {
      console.error('Error deleting team photo:', err);
    } finally {
      setTeamBlocking(false);
      setTeamBlockingText('');
    }
  };

  const loadAdminTeam = async () => {
    try {
      setTeamLoading(true);
      setTeamError('');
      const res = await fetch('/api/admin/team', {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to load team: ${res.status}`);
      }

      const data = await res.json();
      setAdminTeam(data);
    } catch (err) {
      console.error('Error loading admin team:', err);
      setTeamError('Failed to load team members.');
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (adminTab === 'team') {
      loadAdminTeam();
    }
  }, [adminTab]);

  const handleAddTeamMember = async () => {
    if (!newMember.name.trim() || !newMember.role.trim()) {
      return;
    }

    try {
      setAddingMember(true);
      setTeamBlocking(true);
      setTeamBlockingText('Adding team member…');

      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newMember.name.trim(),
          role: newMember.role.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to add member: ${res.status}`);
      }

      const createdRaw = await res.json();

      const created = {
        id: createdRaw.id,
        name: createdRaw.name ?? createdRaw.full_name ?? newMember.name.trim(),
        role: createdRaw.role ?? createdRaw.title ?? createdRaw.position ?? newMember.role.trim(),
        image_url: createdRaw.image_url ?? createdRaw.photo_url ?? createdRaw.imageUrl ?? null,
      };

      setAdminTeam((prev) => [...prev, created]);

      setNewMember({ name: '', role: '' });

      // If we already cropped a photo for the new member, upload it now
      if (newMemberCroppedDataUrl) {
        await handlePhotoUpload(created.id, newMemberCroppedDataUrl);
      }

      // clear local photo selection UI
      setNewMemberPhotoFile(null);
      setNewMemberCroppedDataUrl('');
      if (newMemberPhotoPreview) {
        try {
          URL.revokeObjectURL(newMemberPhotoPreview);
        } catch {}
      }
      setNewMemberPhotoPreview('');
      if (newMemberFileInputRef.current) newMemberFileInputRef.current.value = '';
    } catch (err) {
      console.error('Error adding team member:', err);
      setTeamError('Failed to add team member.');
    } finally {
      setAddingMember(false);
      setTeamBlocking(false);
      setTeamBlockingText('');
    }
  };

  const handleMemberFieldChange = (id, field, value) => {
    setAdminTeam((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleSaveTeamMember = async (member) => {
    const payload = {
      name: member.name.trim(),
      role: member.role.trim(),
      image_url: member.image_url ?? null,
    };

    if (!payload.name || !payload.role) {
      return;
    }

    try {
      setSavingMemberId(member.id);
      setTeamBlocking(true);
      setTeamBlockingText('Saving team member…');

      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to save member: ${res.status}`);
      }

      await res.json();
      setEditingMemberId(null);
    } catch (err) {
      console.error('Error saving team member:', err);
      setTeamError('Failed to save team member.');
    } finally {
      setSavingMemberId(null);
      setTeamBlocking(false);
      setTeamBlockingText('');
    }
  };

  const handleDeleteTeamMember = async (id) => {
    if (!window.confirm('Are you sure you want to delete this team member?')) {
      return;
    }

    try {
      setTeamBlocking(true);
      setTeamBlockingText('Deleting team member…');

      const res = await fetch(`/api/admin/team/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Failed to delete member: ${res.status}`);
      }

      setAdminTeam((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Error deleting team member:', err);
      setTeamError('Failed to delete team member.');
    } finally {
      setTeamBlocking(false);
      setTeamBlockingText('');
    }
  };

  const [aboutScrollTarget, setAboutScrollTarget] = useState(null);
  const aboutSectionRefs = useRef({});

  // --- Account modal (Add/Edit) ---
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState('edit'); // 'edit' | 'create'
  const [editingAccount, setEditingAccount] = useState(null);

  const [accountForm, setAccountForm] = useState({
    username: '',
    password: '',
    securityQuestionId: '',
    securityAnswer: '',
  });

  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showAccountAnswer, setShowAccountAnswer] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [accountModalError, setAccountModalError] = useState('');
  const [accountValidationAttempted, setAccountValidationAttempted] = useState(false);

  // --- Delete confirm modal ---
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState(null);

  // --- Profile editing (non-super admins) ---
  const [profileForm, setProfileForm] = useState({
    securityQuestionId: '',
    securityAnswer: '',
    password: '',
  });

  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [editingSecurity, setEditingSecurity] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  const [profileQuestionMissing, setProfileQuestionMissing] = useState(false);
  const [profileAnswerMissing, setProfileAnswerMissing] = useState(false);
  const [profilePasswordMissing, setProfilePasswordMissing] = useState(false);

  // --- Derived flags for Account modal validation ---
  const isCreateMode = accountModalMode === 'create';
  const showValidation = accountValidationAttempted;

  const usernameMissing = isCreateMode && showValidation && !accountForm.username.trim();
  const passwordMissing = isCreateMode && showValidation && !accountForm.password.trim();
  const questionMissing = isCreateMode && showValidation && !accountForm.securityQuestionId;
  const answerMissing = isCreateMode && showValidation && !accountForm.securityAnswer.trim();

  const filteredAdminEvents = adminYearFilter
    ? adminEvents.filter((evt) => getEventYear(evt.event_date) === adminYearFilter)
    : adminEvents;

  const activeTitle =
    adminTab === 'events'
      ? 'Events'
      : adminTab === 'accounts'
        ? 'Accounts'
        : adminTab === 'profile'
          ? 'Profile'
          : adminTab === 'team'
            ? 'Team'
            : 'About Page';

  const handleCancelAboutEdit = () => {
    setAboutEditMode(false);
    loadAdminAbout();
  };

  const changeAdminTab = (nextTab) => {
    // If we're currently on About and editing, cancel + reload
    if (adminTab === 'about' && aboutEditMode && nextTab !== 'about') {
      handleCancelAboutEdit();
    }
    setAdminTab(nextTab);
  };

  const currentProfileQuestionText =
    securityQuestions.find((q) => String(q.id) === String(loggedInUser?.security_question_id))
      ?.question_text || 'None set';

  const openAddEventModal = () => {
    setIsCreatingEvent(true);
    setEditingEvent(null);

    setEventForm({
      date: '',
      event_type: '',
      location: '',
      title: '',
      short_description: '',
      summary: '',
      impact_on_communication: '',
    });

    // server media empty (no id yet)
    setEventMedia([]);
    setEventMediaIndex(0);
    setEventMediaError('');

    // local queued media reset
    // (revoke any previous preview URLs just in case)
    createQueuedMedia.forEach((m) => {
      if (m?.previewUrl) {
        try {
          URL.revokeObjectURL(m.previewUrl);
        } catch {}
      }
    });
    setCreateQueuedMedia([]);
    setCreateMediaIndex(0);

    // add-article modal + validation reset
    setMediaUploadError('');
    setAddArticleOpen(false);
    setAddArticleCaption('');
    setAddArticleFile(null);
    setAddArticleErrors({ file: '', caption: '' });
    setAddArticleTriedSubmit(false);

    setEventModalOpen(true);
  };

  const openEventModal = async (evt) => {
    if (!evt) return;

    setIsCreatingEvent(false);

    const iso = evt.event_date ? String(evt.event_date).slice(0, 10) : '';
    let displayDate = '';
    if (iso) {
      const [yyyy, mm, dd] = iso.split('-');
      displayDate = `${mm}/${dd}/${yyyy}`;
    }

    setEditingEvent(evt);
    setEventForm({
      date: displayDate,
      event_type: evt.event_type || '',
      location: evt.location || '',
      title: evt.title || '',
      short_description: evt.short_description || '',
      summary: evt.summary || '',
      impact_on_communication: evt.impact_on_communication || '',
    });
    setEventModalOpen(true);

    // Load media for this event
    try {
      setEventMedia([]);
      setEventMediaIndex(0);
      setEventMediaLoading(true);
      setEventMediaError('');

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/events/${evt.id}/media`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEventMedia(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ADMIN] Error loading event media:', err);
      setEventMediaError('Unable to load linked articles for this event.');
    } finally {
      setEventMediaLoading(false);
    }
  };

  const closeEventModal = () => {
    // Creating and had queued local media, revoke previews
    if (isCreatingEvent && Array.isArray(createQueuedMedia) && createQueuedMedia.length) {
      createQueuedMedia.forEach((m) => {
        if (m?.previewUrl) {
          try {
            URL.revokeObjectURL(m.previewUrl);
          } catch {}
        }
      });
    }

    setEventModalOpen(false);
    setEditingEvent(null);
    setIsCreatingEvent(false);

    // server media
    setEventMedia([]);
    setEventMediaIndex(0);
    setEventMediaError('');

    setNewMediaUrl('');
    setNewMediaCaption('');

    // local queued media reset
    setCreateQueuedMedia([]);
    setCreateMediaIndex(0);

    // close add-article modal if open
    setAddArticleOpen(false);

    // clear any upload UI errors
    setMediaUploadError('');
    setMediaUploadBusy(false);

    // clear delete confirm if open
    setMediaDeleteOpen(false);
    setMediaDeleteTarget(null);
  };

  const handleSaveEvent = async () => {
    // Build ISO date from MM/DD/YYYY
    let isoDate = null;

    if (eventForm.date && eventForm.date.length === 10) {
      const [mm, dd, yyyy] = eventForm.date.split('/');
      if (mm && dd && yyyy && yyyy.length === 4) {
        isoDate = `${yyyy}-${mm}-${dd}`;
      }
    }

    const payload = {
      event_date: isoDate,
      event_type: eventForm.event_type || null,
      location: (eventForm.location || '').trim(),
      title: (eventForm.title || '').trim(),
      short_description: (eventForm.short_description || '').trim(),
      summary: (eventForm.summary || '').trim(),
      impact_on_communication: (eventForm.impact_on_communication || '').trim(),
    };

    // required fields (photo/articles are optional)
    const missing =
      !payload.event_date ||
      !String(payload.event_type || '').trim() ||
      !String(payload.location || '').trim() ||
      !String(payload.title || '').trim() ||
      !String(payload.short_description || '').trim() ||
      !String(payload.summary || '').trim() ||
      !String(payload.impact_on_communication || '').trim();

    if (missing) {
      alert('Please fill in all required event fields (all except photo/articles).');
      return;
    }

    try {
      setEventSaving(true);

      // CREATE
      if (isCreatingEvent) {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const ct = res.headers.get('content-type') || '';
        const data = ct.includes('application/json') ? await res.json() : await res.text();

        if (!res.ok) {
          const msg =
            (data && typeof data === 'object' && (data.error || data.details)) ||
            (typeof data === 'string' && data) ||
            `HTTP ${res.status}`;
          throw new Error(msg);
        }

        const createdId = data?.id;

        // upload queued articles (CREATE)
        if (createdId && createQueuedMedia.length) {
          setCreateMediaUploading(true);

          for (let i = 0; i < createQueuedMedia.length; i++) {
            const m = createQueuedMedia[i];
            setCreateMediaUploadingText(
              `Uploading article image ${i + 1} of ${createQueuedMedia.length}…`
            );

            const fd = new FormData();
            fd.append('file', m.file);
            fd.append('caption', (m.caption || '').trim());

            const upRes = await fetch(`${ADMIN_API_BASE}/api/admin/events/${createdId}/media`, {
              method: 'POST',
              body: fd,
              credentials: 'include',
            });

            if (!upRes.ok) {
              const ct2 = upRes.headers.get('content-type') || '';
              const body2 = ct2.includes('application/json')
                ? await upRes.json()
                : await upRes.text();
              throw new Error(
                (body2 && typeof body2 === 'object' && (body2.error || body2.details)) ||
                  (typeof body2 === 'string' && body2) ||
                  `Media upload failed (HTTP ${upRes.status})`
              );
            }

            // after each success, release preview URL
            if (m.previewUrl) {
              try {
                URL.revokeObjectURL(m.previewUrl);
              } catch {}
            }
          }

          setCreateQueuedMedia([]);
          setCreateMediaIndex(0);

          setCreateMediaUploading(false);
          setCreateMediaUploadingText('');
        }

        const rows = await loadAdminEvents(); // returns array of updated loader

        await loadAdminEvents(); // refresh table
        closeEventModal(); // close modal and return to list
        return;
      }

      // EDIT
      if (!editingEvent) return;

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : await res.text();

      if (!res.ok) {
        const msg =
          (data && typeof data === 'object' && (data.error || data.details)) ||
          (typeof data === 'string' && data) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      await loadAdminEvents();
      closeEventModal();
    } catch (err) {
      console.error('[ADMIN] Error saving event:', err);
      alert(err.message || 'Failed to save event. Please try again.');
    } finally {
      setEventSaving(false);
      setCreateMediaUploading(false);
      setCreateMediaUploadingText('');
    }
  };

  const handleAddMedia = async () => {
    if (!editingEvent || !newMediaUrl.trim()) return;

    try {
      setEventMediaLoading(true);
      setEventMediaError('');

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/events/${editingEvent.id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: newMediaUrl.trim(),
          caption: newMediaCaption.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json(); // { id, url, caption }

      setEventMedia((prev) => [...prev, created]);
      setNewMediaUrl('');
      setNewMediaCaption('');
      setEventMediaIndex((prev) => (prev === 0 && prev === eventMedia.length ? 0 : prev));
    } catch (err) {
      console.error('[ADMIN] Error adding media:', err);
      setEventMediaError('Failed to add newspaper article.');
    } finally {
      setEventMediaLoading(false);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    if (!editingEvent) return;

    try {
      setEventMediaLoading(true);
      setEventMediaError('');

      const res = await fetch(
        `${ADMIN_API_BASE}/api/admin/events/${editingEvent.id}/media/${mediaId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setEventMedia((prev) => {
        const filtered = prev.filter((m) => m.id !== mediaId);
        setEventMediaIndex((idx) => (filtered.length ? Math.min(idx, filtered.length - 1) : 0));
        return filtered;
      });
    } catch (err) {
      console.error('[ADMIN] Error deleting media:', err);
      setEventMediaError('Failed to delete newspaper article.');
    } finally {
      setEventMediaLoading(false);
    }
  };

  const [mediaCaptionBusy, setMediaCaptionBusy] = useState(false);
  const [mediaCaptionError, setMediaCaptionError] = useState('');

  const handleUpdateMediaCaption = async (mediaId, newCaption) => {
    if (!editingEvent || !mediaId) return;

    try {
      setMediaCaptionBusy(true);
      setMediaCaptionError('');

      const res = await fetch(
        `${ADMIN_API_BASE}/api/admin/events/${editingEvent.id}/media/${mediaId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            caption: newCaption?.trim() ? newCaption.trim() : null,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setMediaCaptionError(data.error || 'Failed to update caption.');
        return false;
      }

      // Update UI state immediately
      setEventMedia((prev) =>
        prev.map((m) => (m.id === mediaId ? { ...m, caption: data.caption } : m))
      );

      return true;
    } catch (err) {
      console.error('Error updating caption:', err);
      setMediaCaptionError('Failed to update caption.');
      return false;
    } finally {
      setMediaCaptionBusy(false);
    }
  };

  // --- Loaders ---
  const loadAdminEvents = async () => {
    try {
      setEventsLoading(true);
      setEventsError('');

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/events`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];

      setAdminEvents(rows);
      return rows;
    } catch (err) {
      console.error('[ADMIN] Error loading events:', err);
      setEventsError('Unable to load events from the database.');
      return [];
    } finally {
      setEventsLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError('');
      const res = await fetch(`${ADMIN_API_BASE}/api/admin/users`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAdminUsers(data || []);
    } catch (err) {
      console.error('[ADMIN] Error loading admin users:', err);
      setUsersError('Unable to load admin accounts from the database.');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadSecurityQuestions = async () => {
    try {
      const res = await fetch(`${ADMIN_API_BASE}/api/admin/security-questions`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSecurityQuestions(data || []);
    } catch (err) {
      console.error('[ADMIN] Error loading security questions:', err);
    }
  };

  const loadAdminAbout = async () => {
    try {
      setAboutLoading(true);
      setAboutError('');

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/about`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      const rows = (data || []).map((row) => ({
        localId: `existing-${row.id}`,
        id: row.id,
        title: row.title || '',
        text: row.text || '',
        displayOrder: row.display_order ?? 1,
        isNew: false,
        isDeleted: false,
      }));

      rows.sort((a, b) => a.displayOrder - b.displayOrder);
      setAboutSections(rows);
    } catch (err) {
      console.error('[ADMIN] Failed to load About sections:', err);
      setAboutError('Unable to load About page sections.');
    } finally {
      setAboutLoading(false);
    }
  };

  // When logged in, load admin data
  useEffect(() => {
    if (!loggedInUser) return;
    loadAdminEvents();
    loadSecurityQuestions();
    loadAdminAbout();
    if (isSuperAdmin) {
      loadAdminUsers();
    }
  }, [loggedInUser, isSuperAdmin]);

  // Scroll to about section when aboutScrollTarget changes
  useEffect(() => {
    if (!aboutScrollTarget) return;
    const el = aboutSectionRefs.current[aboutScrollTarget];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setAboutScrollTarget(null);
  }, [aboutScrollTarget]);

  // --- About helpers ---

  const applyAboutOrderChange = (localId, newOrderRaw) => {
    const newOrder = parseInt(newOrderRaw, 10);
    if (!Number.isFinite(newOrder) || newOrder <= 0) return;

    setAboutSections((prev) => {
      const active = prev.filter((s) => !s.isDeleted).slice();
      const deleted = prev.filter((s) => s.isDeleted);

      active.sort((a, b) => a.displayOrder - b.displayOrder);

      const idx = active.findIndex((s) => s.localId === localId);
      if (idx === -1) return prev;

      const item = active.splice(idx, 1)[0];
      const clamped = Math.max(1, Math.min(newOrder, active.length + 1));
      active.splice(clamped - 1, 0, item);

      active.forEach((s, i) => {
        s.displayOrder = i + 1;
      });

      return [...active, ...deleted];
    });
  };

  const handleAboutFieldChange = (localId, field, value) => {
    setAboutSections((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, [field]: value } : s))
    );
  };

  const handleAboutDelete = (localId) => {
    setAboutSections((prev) => {
      const keptActive = [];
      const keptDeleted = [];

      for (const s of prev) {
        if (s.localId === localId) {
          // If it exists in DB, keep it but mark as deleted
          if (s.id) {
            keptDeleted.push({ ...s, isDeleted: true });
          }
          // If it's a brand-new section (no id), drop it entirely
        } else {
          if (s.isDeleted) {
            keptDeleted.push(s);
          } else {
            keptActive.push(s);
          }
        }
      }

      // Re-index the remaining *active* sections
      const reindexedActive = keptActive
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s, index) => ({
          ...s,
          displayOrder: index + 1,
        }));

      return [...reindexedActive, ...keptDeleted];
    });
  };

  const handleAddAboutSection = () => {
    setAboutSections((prev) => {
      const active = prev.filter((s) => !s.isDeleted);
      const maxOrder = active.reduce((max, s) => Math.max(max, s.displayOrder || 0), 0);
      const nextOrder = maxOrder + 1;

      const newSection = {
        localId: `new-${Date.now()}-${Math.random()}`,
        id: null,
        title: '',
        text: '',
        displayOrder: nextOrder,
        isNew: true,
        isDeleted: false,
      };

      return [...prev, newSection];
    });
  };

  const handleSaveAboutChanges = async () => {
    try {
      setAboutSaving(true);
      setAboutError('');

      const active = aboutSections
        .filter((s) => !s.isDeleted)
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder);

      active.forEach((s, i) => {
        s.displayOrder = i + 1;
      });

      const orderMap = new Map(active.map((s) => [s.localId, s.displayOrder]));

      const sectionsToSave = aboutSections.map((s) => ({
        ...s,
        displayOrder: orderMap.has(s.localId) ? orderMap.get(s.localId) : s.displayOrder,
      }));

      for (const sec of sectionsToSave) {
        if (sec.isDeleted && sec.id) {
          await fetch(`${ADMIN_API_BASE}/api/admin/about/${sec.id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          continue;
        }

        if (sec.isDeleted && !sec.id) continue;

        const payload = {
          display_order: sec.displayOrder,
          title: sec.title.trim(),
          text: sec.text.trim(),
        };

        if (!sec.id && !payload.title && !payload.text) {
          continue;
        }

        if (sec.id) {
          await fetch(`${ADMIN_API_BASE}/api/admin/about/${sec.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
        } else {
          await fetch(`${ADMIN_API_BASE}/api/admin/about`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          });
        }
      }

      await loadAdminAbout();
      setAboutEditMode(false);
    } catch (err) {
      console.error('[ADMIN] Error saving About sections:', err);
      setAboutError('Failed to save About page changes.');
    } finally {
      setAboutSaving(false);
    }
  };

  // --- Profile: Security section ---

  const startSecurityEdit = () => {
    setProfileError('');
    setProfileQuestionMissing(false);
    setProfileAnswerMissing(false);
    setEditingSecurity(true);

    setProfileForm((prev) => ({
      ...prev,
      securityQuestionId: loggedInUser?.security_question_id || '',
      securityAnswer: '',
    }));
  };

  const cancelSecurityEdit = () => {
    setEditingSecurity(false);
    setProfileError('');
    setProfileQuestionMissing(false);
    setProfileAnswerMissing(false);

    setProfileForm((prev) => ({
      ...prev,
      securityQuestionId: loggedInUser?.security_question_id || '',
      securityAnswer: '',
    }));
  };

  const saveSecurityEdit = async () => {
    const questionId = profileForm.securityQuestionId || '';
    const answer = profileForm.securityAnswer.trim();

    const missingQ = !questionId;
    const missingA = !answer;

    setProfileQuestionMissing(missingQ);
    setProfileAnswerMissing(missingA);

    if (missingQ || missingA) return;

    try {
      setProfileSaving(true);
      setProfileError('');

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: loggedInUser.id,
          securityQuestionId: questionId,
          securityAnswer: answer,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || 'Failed to update security question.');
        return;
      }

      setLoggedInUser((prev) =>
        prev
          ? {
              ...prev,
              security_question_id: questionId || null,
            }
          : prev
      );

      cancelSecurityEdit();
    } catch (err) {
      console.error('[ADMIN] Error updating security info:', err);
      setProfileError('An unexpected error occurred while saving.');
    } finally {
      setProfileSaving(false);
    }
  };

  // --- Profile: Password section ---

  const startPasswordEdit = () => {
    setProfileError('');
    setProfilePasswordMissing(false);
    setEditingPassword(true);

    setProfileForm((prev) => ({
      ...prev,
      password: '',
    }));
  };

  const cancelPasswordEdit = () => {
    setEditingPassword(false);
    setProfileError('');
    setProfilePasswordMissing(false);

    setProfileForm((prev) => ({
      ...prev,
      password: '',
    }));
  };

  const savePasswordEdit = async () => {
    const pwd = profileForm.password.trim();
    const missing = !pwd;

    setProfilePasswordMissing(missing);
    if (missing) return;

    try {
      setProfileSaving(true);
      setProfileError('');

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: loggedInUser.id,
          password: pwd,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || 'Failed to update password.');
        return;
      }

      cancelPasswordEdit();
    } catch (err) {
      console.error('[ADMIN] Error updating password:', err);
      setProfileError('An unexpected error occurred while saving.');
    } finally {
      setProfileSaving(false);
    }
  };

  // --- Account modal open/close/save/delete ---

  const openCreateAccountModal = () => {
    setAccountModalMode('create');
    setEditingAccount(null);
    setAccountForm({
      username: '',
      password: '',
      securityQuestionId: '',
      securityAnswer: '',
    });
    setShowAccountPassword(false);
    setShowAccountAnswer(false);
    setAccountModalError('');
    setAccountValidationAttempted(false);
    setAccountModalOpen(true);
  };

  const openEditAccountModal = (userRow) => {
    setAccountModalMode('edit');
    setEditingAccount(userRow || null);
    setAccountForm({
      username: userRow?.username || '',
      password: '',
      securityQuestionId: userRow?.security_question_id || '',
      securityAnswer: '',
    });
    setShowAccountPassword(false);
    setShowAccountAnswer(false);
    setAccountModalError('');
    setAccountValidationAttempted(false);
    setAccountModalOpen(true);
  };

  const closeAccountModal = () => {
    setAccountModalOpen(false);
    setEditingAccount(null);
    setAccountForm({
      username: '',
      password: '',
      securityQuestionId: '',
      securityAnswer: '',
    });
    setAccountModalError('');
    setAccountSaving(false);
    setAccountValidationAttempted(false);
  };

  const handleSaveAccount = async () => {
    try {
      setAccountModalError('');
      setAccountSaving(true);
      setAccountValidationAttempted(true);

      const isCreate = accountModalMode === 'create';

      const usernameEmpty = !accountForm.username.trim();
      const passwordEmpty = !accountForm.password.trim();
      const questionEmpty = !accountForm.securityQuestionId;
      const answerEmpty = !accountForm.securityAnswer.trim();

      if (isCreate && (usernameEmpty || passwordEmpty || questionEmpty || answerEmpty)) {
        setAccountModalError('Please fill in all required fields highlighted in red.');
        setAccountSaving(false);
        return;
      }

      const payload = {
        username: accountForm.username.trim(),
        password: accountForm.password.trim() || undefined,
        securityQuestionId: accountForm.securityQuestionId || null,
        securityAnswer: accountForm.securityAnswer.trim() || undefined,
      };

      if (isCreate) {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });

        const data = await res.json();
        if (!res.ok) {
          setAccountModalError(data.error || 'Failed to create account.');
          setAccountSaving(false);
          return;
        }
      } else if (accountModalMode === 'edit' && editingAccount) {
        const body = {
          securityQuestionId: payload.securityQuestionId,
        };

        if (payload.password) {
          body.password = payload.password;
        }
        if (payload.securityAnswer) {
          body.securityAnswer = payload.securityAnswer;
        }

        const res = await fetch(`${ADMIN_API_BASE}/api/admin/users/${editingAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          setAccountModalError(data.error || 'Failed to update account.');
          setAccountSaving(false);
          return;
        }
      }

      await loadAdminUsers();
      closeAccountModal();
    } catch (err) {
      console.error('[ADMIN] Error saving admin account:', err);
      setAccountModalError('An unexpected error occurred while saving.');
    } finally {
      setAccountSaving(false);
    }
  };

  const handleDeleteAccount = async (accountToDelete) => {
    const target = accountToDelete || editingAccount;
    if (!target) return;

    try {
      setAccountModalError('');
      setAccountSaving(true);
      setAccountDeleting(true);

      const res = await fetch(`${ADMIN_API_BASE}/api/admin/users/${target.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        setAccountModalError(data.error || 'Failed to delete account.');
        setAccountSaving(false);
        return;
      }

      await loadAdminUsers();
      closeAccountModal();
      setDeleteConfirmOpen(false);
      setPendingDeleteAccount(null);
    } catch (err) {
      console.error('[ADMIN] Error deleting admin account:', err);
      setAccountModalError('An unexpected error occurred while deleting.');
    } finally {
      setAccountSaving(false);
      setAccountDeleting(false);
    }
  };

  const handleConfirmDeleteClick = () => {
    if (!pendingDeleteAccount) return;
    handleDeleteAccount(pendingDeleteAccount);
  };

  // --- Login submit ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }

    if (needsSecurity && !String(securityAnswer || '').trim()) {
      setError('Security answer is required.');
      return;
    }

    try {
      setLoading(true);

      const body = { username, password };
      if (needsSecurity && securityAnswer) {
        body.securityAnswer = securityAnswer;
      }

      const res = await fetch(joinUrl(ADMIN_API_BASE, 'api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.requiresSecurityAnswer) {
          setNeedsSecurity(true);
          setSecurityQuestion(data.securityQuestionText || 'Please answer your security question.');

          if (needsSecurity) {
            setError(data?.error || 'Incorrect security answer.');
          } else {
            setError('');
          }

          setLoading(false);
          return;
        }

        setError(data?.error || 'Login failed.');
        setLoading(false);
        return;
      }

      setLoggedInUser(data.user || { username });
      setNeedsSecurity(false);
      setSecurityQuestion('');
      setSecurityAnswer('');
      setError('');
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Login failed due to a network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="view-panel admin-view">
      {/* --- LOGIN STATE --- */}
      {!loggedInUser && (
        <div className="panel">
          <h1>Admin Portal</h1>
          <p className="helper">Sign in to manage solar events and linked newspaper articles.</p>

          <div className="admin-layout">
            <form className="admin-login" onSubmit={handleSubmit}>
              <h2>Login</h2>

              <label>
                <span>Username</span>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {needsSecurity && (
                <label>
                  <span>{securityQuestion}</span>
                  <input
                    type="password"
                    className="input"
                    value={securityAnswer}
                    onChange={(e) => {
                      setSecurityAnswer(e.target.value);
                      if (error) setError('');
                    }}
                  />
                </label>
              )}

              {error && (
                <p className="helper" style={{ color: '#ffb3b3' }}>
                  {error}
                </p>
              )}

              <button className="primary" disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <div className="admin-dashboard">
              <h2>Events Preview</h2>
              <p className="helper">
                After you log in, this area will show a table of events with add/edit/delete actions
                and media links.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- LOGGED-IN STATE --- */}
      {loggedInUser && (
        <div className="panel admin-panel">
          <div className="admin-events-header">
            <div className="admin-header-top">
              <h1 className="admin-events-title">{activeTitle}</h1>

              <div className="admin-tabs">
                <button
                  type="button"
                  className={'admin-tab-button' + (adminTab === 'events' ? ' is-active' : '')}
                  onClick={() => changeAdminTab('events')}
                >
                  Events
                </button>

                {isSuperAdmin ? (
                  <button
                    type="button"
                    className={'admin-tab-button' + (adminTab === 'accounts' ? ' is-active' : '')}
                    onClick={() => changeAdminTab('accounts')}
                  >
                    Accounts
                  </button>
                ) : (
                  <button
                    type="button"
                    className={'admin-tab-button' + (adminTab === 'profile' ? ' is-active' : '')}
                    onClick={() => changeAdminTab('profile')}
                  >
                    Profile
                  </button>
                )}

                <button
                  type="button"
                  className={'admin-tab-button' + (adminTab === 'about' ? ' is-active' : '')}
                  onClick={() => changeAdminTab('about')}
                >
                  About
                </button>

                <button
                  type="button"
                  className={'admin-tab-button' + (adminTab === 'team' ? ' is-active' : '')}
                  onClick={() => {
                    changeAdminTab('team');
                  }}
                >
                  Team
                </button>
              </div>

              <div className="admin-header-actions">
                {adminTab === 'events' && (
                  <button type="button" className="admin-add-button" onClick={openAddEventModal}>
                    Add Event <span className="admin-add-plus">＋</span>
                  </button>
                )}

                {adminTab === 'accounts' && isSuperAdmin && (
                  <button
                    type="button"
                    className="admin-add-button"
                    onClick={openCreateAccountModal}
                  >
                    Add Account <span className="admin-add-plus">＋</span>
                  </button>
                )}

                {/* ABOUT TAB: Edit / Cancel + Save */}
                {adminTab === 'about' && !aboutEditMode && (
                  <button
                    type="button"
                    className="admin-about-edit-button"
                    onClick={() => {
                      if (!aboutSections.length) {
                        loadAdminAbout();
                      }
                      setAboutEditMode(true);
                    }}
                  >
                    <span className="admin-edit-icon">✎</span>
                    Edit About Page
                  </button>
                )}

                {adminTab === 'about' && aboutEditMode && (
                  <>
                    <button
                      type="button"
                      className="admin-about-edit-button admin-about-edit-button--ghost"
                      onClick={handleCancelAboutEdit}
                      disabled={aboutSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-about-edit-button"
                      onClick={handleSaveAboutChanges}
                      disabled={aboutSaving}
                    >
                      {aboutSaving ? 'Saving…' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="admin-logged-in">
              Logged in as <strong>{loggedInUser.username}</strong>
            </p>
          </div>

          {/* ---- EVENTS TAB ---- */}
          {adminTab === 'events' && (
            <>
              <div className="admin-locate-bar">
                <form
                  className="admin-year-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = adminYearQuery.trim();
                    if (!trimmed) {
                      setAdminYearFilter(null);
                      return;
                    }
                    const cleaned = trimmed.replace(/\D/g, '').slice(0, 4);
                    if (!cleaned) {
                      setAdminYearFilter(null);
                      return;
                    }
                    setAdminYearFilter(cleaned);
                  }}
                  noValidate
                >
                  <label className="admin-year-label">
                    <span>Filter by Year</span>
                    <input
                      type="text"
                      className="year-search-input"
                      placeholder="YYYY"
                      inputMode="numeric"
                      maxLength={4}
                      pattern="\d{4}"
                      value={adminYearQuery}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setAdminYearQuery(cleaned);
                      }}
                    />
                  </label>
                  <button type="submit" className="year-search-button">
                    Search
                  </button>
                  <button
                    type="button"
                    className="year-search-browse-button"
                    onClick={() => setShowAdminYearPicker((prev) => !prev)}
                  >
                    Browse
                  </button>
                </form>

                {showAdminYearPicker && (
                  <div className="admin-year-search-popover">
                    <div className="admin-year-search-popover-section">
                      <div className="admin-year-search-popover-label">Select Decade</div>
                      <div className="admin-year-decade-list">
                        {adminDecades.map((decade) => (
                          <button
                            key={decade}
                            type="button"
                            className={
                              'admin-year-decade-pill' +
                              (adminPickerDecade === decade ? ' is-active' : '')
                            }
                            onClick={() => setAdminPickerDecade(decade)}
                          >
                            {decade}s
                          </button>
                        ))}

                        {adminDecades.length === 0 && (
                          <span className="helper">No events available yet.</span>
                        )}
                      </div>
                    </div>

                    <div className="admin-year-search-popover-section">
                      <div className="admin-year-search-popover-label">Select Year</div>
                      <div className="admin-year-year-list">
                        {adminUniqueYears
                          .filter(
                            (y) =>
                              adminPickerDecade !== null &&
                              Math.floor(Number(y) / 10) * 10 === adminPickerDecade
                          )
                          .map((y) => (
                            <button
                              key={y}
                              type="button"
                              className={
                                'admin-year-year-pill' +
                                (adminYearFilter === y ? ' is-selected' : '')
                              }
                              onClick={() => {
                                setAdminYearFilter(y);
                                setAdminYearQuery(y);
                                setShowAdminYearPicker(false);
                              }}
                            >
                              {y}
                            </button>
                          ))}

                        {adminPickerDecade !== null &&
                          adminUniqueYears.filter(
                            (y) => Math.floor(Number(y) / 10) * 10 === adminPickerDecade
                          ).length === 0 && (
                            <span className="helper">No years in this decade yet.</span>
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {adminYearFilter && (
                <p className="helper">
                  Showing events for year <strong>{adminYearFilter}</strong>. Clear the search to
                  see all events.
                </p>
              )}

              {eventsLoading && <p className="helper">Loading events…</p>}

              {eventsError && (
                <p className="helper" style={{ color: '#ffb3b3' }}>
                  {eventsError}
                </p>
              )}

              {!eventsLoading && !eventsError && (
                <div className="admin-table-wrapper">
                  <table className="admin-events-table">
                    <thead>
                      <tr>
                        <th className="admin-events-th-edit">Actions</th>
                        <th>Date</th>
                        <th>Event Type</th>
                        <th>Short Description</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredAdminEvents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="admin-empty-cell">
                            No events found for the current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredAdminEvents.map((evt) => (
                          <tr key={evt.id}>
                            {/* Actions */}
                            <td className="admin-events-edit-cell">
                              <div className="admin-events-actions">
                                <button
                                  type="button"
                                  className="admin-edit-button"
                                  onClick={() => openEventModal(evt)}
                                >
                                  <span className="admin-edit-icon">✎</span>
                                  <span className="admin-edit-text">Edit Event</span>
                                </button>

                                <button
                                  type="button"
                                  className="admin-edit-button admin-edit-button--danger"
                                  onClick={() => openDeleteEventDialog(evt)}
                                >
                                  <span className="admin-edit-icon">🗑</span>
                                  <span className="admin-edit-text">Delete Event</span>
                                </button>
                              </div>
                            </td>

                            {/* Date */}
                            <td>{formatEventDateLabelWithYear(evt.event_date)}</td>

                            {/* Event Type */}
                            <td>{evt.event_type || '—'}</td>

                            {/* Short Description */}
                            <td>{evt.short_description || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {deleteEventOpen && deleteEventTarget && (
            <div className="delete-media-backdrop" onClick={closeDeleteEventDialog}>
              <div className="delete-media-dialog" onClick={(e) => e.stopPropagation()}>
                <h3 className="delete-media-title">Delete Event?</h3>
                <p className="delete-media-text">
                  This will permanently delete:
                  <br />• the event
                  <br />• all linked newspaper articles
                  <br />• the article images in DigitalOcean Spaces
                </p>

                <div className="delete-media-preview">
                  <div className="helper" style={{ color: '#fff' }}>
                    <strong>{deleteEventTarget.title}</strong>
                    <br />
                    {formatEventDateLabelWithYear(deleteEventTarget.event_date)}
                  </div>
                </div>

                <div className="delete-media-actions">
                  <button
                    type="button"
                    className="delete-dialog-btn delete-dialog-btn-cancel"
                    onClick={closeDeleteEventDialog}
                    disabled={deleteEventBusy}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="delete-dialog-btn delete-dialog-btn-confirm"
                    onClick={confirmDeleteEvent}
                    disabled={deleteEventBusy}
                  >
                    {deleteEventBusy ? (
                      <>
                        <span className="delete-dialog-spinner" />
                        Deleting…
                      </>
                    ) : (
                      'Delete Event'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---- EDIT EVENT MODAL ---- */}
          {eventModalOpen && (
            <ErrorBoundary>
              <AdminEventModal
                event={editingEvent}
                form={eventForm}
                setForm={setEventForm}
                saving={eventSaving}
                media={isCreatingEvent ? createQueuedMedia : eventMedia}
                mediaIndex={isCreatingEvent ? createMediaIndex : eventMediaIndex}
                setMediaIndex={isCreatingEvent ? setCreateMediaIndex : setEventMediaIndex}
                mediaLoading={eventMediaLoading}
                mediaError={eventMediaError}
                onClose={closeEventModal}
                onSave={handleSaveEvent}
                uploadBusy={mediaUploadBusy}
                uploadError={mediaUploadError}
                onUpdateMediaCaption={handleUpdateMediaCaption}
                mediaCaptionBusy={mediaCaptionBusy}
                mediaCaptionError={mediaCaptionError}
                onOpenAddArticleModal={openAddArticleModal}
                isCreating={isCreatingEvent}
                onUpdateQueuedCaption={(localId, newCaption) => {
                  setCreateQueuedMedia((prev) =>
                    prev.map((m) => (m.localId === localId ? { ...m, caption: newCaption } : m))
                  );
                }}
                onDeleteMedia={(item) => {
                  if (isCreatingEvent) {
                    setCreateQueuedMedia((prev) => {
                      const next = prev.filter((m) => m.localId !== item.localId);
                      // revoke preview URL
                      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                      // keep index safe
                      setCreateMediaIndex((idx) =>
                        next.length ? Math.min(idx, next.length - 1) : 0
                      );
                      return next;
                    });
                    return;
                  }
                  requestDeleteCurrentMedia(item); // existing behavior
                }}
                onSaveCaption={handleCaptionSaveForModal}
              />
            </ErrorBoundary>
          )}

          {addArticleOpen && (
            <div className="admin-modal-backdrop" onClick={closeAddArticleModal}>
              <div
                className="admin-modal admin-modal--add-article"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="admin-modal-header">
                  <h2 className="admin-modal-title admin-modal-title--small">
                    Add Newspaper Article
                  </h2>
                  <div className="admin-modal-actions">
                    <button
                      type="button"
                      className="admin-modal-button admin-modal-button--ghost"
                      onClick={closeAddArticleModal}
                      disabled={mediaUploadBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-modal-button"
                      onClick={uploadAddArticle}
                      disabled={mediaUploadBusy}
                    >
                      {mediaUploadBusy ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                </div>

                {/* Article Image FIRST */}
                <div
                  className={
                    'admin-field admin-field--large ' +
                    (addArticleTriedSubmit && addArticleErrors.file ? 'admin-field--error' : '')
                  }
                >
                  <label className="admin-field-label admin-field-label--big">
                    Article Image <span className="admin-field-required">*</span>
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    className="admin-file-input-large"
                    onChange={(e) => {
                      setAddArticleFile(e.target.files?.[0] || null);

                      // clear error as soon as user picks a file
                      setAddArticleErrors((prev) => ({ ...prev, file: '' }));
                    }}
                    disabled={mediaUploadBusy}
                  />

                  {addArticleTriedSubmit && addArticleErrors.file && (
                    <span className="admin-field-error-text">{addArticleErrors.file}</span>
                  )}
                </div>

                {/* Caption SECOND */}
                <div
                  className={
                    'admin-field admin-field--large ' +
                    (addArticleTriedSubmit && addArticleErrors.caption ? 'admin-field--error' : '')
                  }
                >
                  <label className="admin-field-label admin-field-label--big">
                    Caption <span className="admin-field-required">*</span>
                  </label>

                  <textarea
                    className={
                      'admin-textarea admin-textarea--caption ' +
                      (addArticleTriedSubmit && addArticleErrors.caption ? 'input--error' : '')
                    }
                    value={addArticleCaption}
                    onChange={(e) => {
                      setAddArticleCaption(e.target.value);

                      // clear error as soon as user types
                      setAddArticleErrors((prev) => ({ ...prev, caption: '' }));

                      // auto-grow
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    placeholder="Enter a caption for this article"
                    rows={2}
                    disabled={mediaUploadBusy}
                  />

                  {addArticleTriedSubmit && addArticleErrors.caption && (
                    <span className="admin-field-error-text">{addArticleErrors.caption}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---- ACCOUNTS TAB (super admin only) ---- */}
          {adminTab === 'accounts' && isSuperAdmin && (
            <>
              <p className="helper" style={{ marginTop: 8 }}>
                Manage admin accounts. Use the edit button to update passwords and security
                questions.
              </p>

              <div className="admin-table-wrapper">
                <table className="admin-accounts-table">
                  <thead>
                    <tr>
                      <th className="admin-events-th-edit"></th>
                      <th>Username</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading && (
                      <tr>
                        <td colSpan={2} className="admin-empty-cell">
                          Loading accounts…
                        </td>
                      </tr>
                    )}

                    {!usersLoading && usersError && (
                      <tr>
                        <td colSpan={2} className="admin-empty-cell">
                          {usersError}
                        </td>
                      </tr>
                    )}

                    {!usersLoading && !usersError && adminUsers.length === 0 && (
                      <tr>
                        <td colSpan={2} className="admin-empty-cell">
                          No admin accounts found.
                        </td>
                      </tr>
                    )}

                    {!usersLoading &&
                      !usersError &&
                      adminUsers.length > 0 &&
                      adminUsers.map((u) => {
                        const isProtected = !!u.is_protected;
                        return (
                          <tr key={u.id}>
                            <td className="admin-events-edit-cell">
                              {!isProtected ? (
                                <button
                                  type="button"
                                  className="admin-edit-button"
                                  onClick={() => openEditAccountModal(u)}
                                >
                                  <span className="admin-edit-icon">✎</span>
                                  <span className="admin-edit-text">Edit Account</span>
                                </button>
                              ) : (
                                <span
                                  className="helper"
                                  style={{
                                    fontSize: '0.8rem',
                                    color: 'black',
                                  }}
                                >
                                  Protected
                                </span>
                              )}
                            </td>
                            <td>{u.username}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ---- PROFILE TAB (non-super admins) ---- */}
          {adminTab === 'profile' && !isSuperAdmin && (
            <div className="admin-subpanel admin-subpanel--profile">
              <h2>My Profile</h2>
              <p className="helper">
                Update your admin password and security question/answer. For security, your current
                password and answer are never shown.
              </p>

              <div className="admin-field" style={{ marginTop: 16 }}>
                <div className="admin-field-label">
                  <span>Username</span>
                </div>
                <input className="input" value={loggedInUser.username} disabled />
              </div>

              <hr className="profile-divider" />

              {/* Security Q/A section */}
              <div className="profile-section-header">
                <h3 className="profile-section-title">Security Question &amp; Answer</h3>

                {!editingSecurity ? (
                  <button type="button" className="admin-modal-button" onClick={startSecurityEdit}>
                    Edit
                  </button>
                ) : (
                  <div className="profile-section-actions">
                    <button
                      type="button"
                      className="admin-modal-button admin-modal-button--danger"
                      onClick={cancelSecurityEdit}
                      disabled={profileSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-modal-button"
                      onClick={saveSecurityEdit}
                      disabled={profileSaving}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {!editingSecurity ? (
                <>
                  <div className="admin-field">
                    <div className="admin-field-label">
                      <span>Security Question</span>
                    </div>
                    <div className="profile-static-value">{currentProfileQuestionText}</div>
                  </div>

                  <div className="admin-field">
                    <div className="admin-field-label">
                      <span>Security Answer</span>
                    </div>
                    <div className="profile-static-value">
                      <span className="profile-obscured">********</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={
                      'admin-field ' + (profileQuestionMissing ? 'admin-field--error' : '')
                    }
                  >
                    <div className="admin-field-label">
                      <span>
                        Security Question
                        <span className="admin-field-required"> *</span>
                      </span>
                    </div>
                    <select
                      className={`input ${profileQuestionMissing ? 'input--error' : ''}`}
                      value={profileForm.securityQuestionId || ''}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          securityQuestionId: e.target.value || '',
                        }))
                      }
                    >
                      <option value="">None</option>
                      {securityQuestions.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.question_text}
                        </option>
                      ))}
                    </select>
                    {profileQuestionMissing && (
                      <span className="admin-field-error-text">* Required field missing</span>
                    )}
                  </div>

                  <div
                    className={'admin-field ' + (profileAnswerMissing ? 'admin-field--error' : '')}
                  >
                    <div className="admin-field-label">
                      <span>
                        New Security Answer
                        <span className="admin-field-required"> *</span>
                      </span>
                    </div>
                    <div className="admin-password-wrapper">
                      <input
                        className={`input ${profileAnswerMissing ? 'input--error' : ''}`}
                        type="password"
                        value={profileForm.securityAnswer}
                        onChange={(e) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            securityAnswer: e.target.value,
                          }))
                        }
                      />
                    </div>
                    {profileAnswerMissing && (
                      <span className="admin-field-error-text">* Required field missing</span>
                    )}
                  </div>
                </>
              )}

              <hr className="profile-divider" />

              {/* Password section */}
              <div className="profile-section-header">
                <h3 className="profile-section-title">Password</h3>

                {!editingPassword ? (
                  <button type="button" className="admin-modal-button" onClick={startPasswordEdit}>
                    Edit
                  </button>
                ) : (
                  <div className="profile-section-actions">
                    <button
                      type="button"
                      className="admin-modal-button admin-modal-button--danger"
                      onClick={cancelPasswordEdit}
                      disabled={profileSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-modal-button"
                      onClick={savePasswordEdit}
                      disabled={profileSaving}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {!editingPassword ? (
                <div className="admin-field">
                  <div className="admin-field-label">
                    <span>Password</span>
                  </div>
                  <div className="profile-static-value">
                    <span className="profile-obscured">********</span>
                  </div>
                </div>
              ) : (
                <div
                  className={'admin-field ' + (profilePasswordMissing ? 'admin-field--error' : '')}
                >
                  <div className="admin-field-label">
                    <span>
                      New Password
                      <span className="admin-field-required"> *</span>
                    </span>
                  </div>
                  <div className="admin-password-wrapper">
                    <input
                      className={`input ${profilePasswordMissing ? 'input--error' : ''}`}
                      type="password"
                      value={profileForm.password}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                    />
                  </div>
                  {profilePasswordMissing && (
                    <span className="admin-field-error-text">* Required field missing</span>
                  )}
                </div>
              )}

              {profileError && (
                <p className="helper" style={{ color: '#ffb3b3', marginTop: 10 }}>
                  {profileError}
                </p>
              )}
            </div>
          )}

          {/* ---- TEAM TAB ---- */}
          {adminTab === 'team' && (
            <div className="admin-panel-section">
              <h2>Team Members</h2>

              <p className="helper">
                Add researchers and developers, then upload a profile photo for each person. Photos
                are stored as circular avatars on the public About page.
              </p>

              {teamLoading && <p>Loading team members…</p>}
              {teamError && <p className="error">{teamError}</p>}
              {teamPhotoError && (
                <p className="error" style={{ marginTop: 6 }}>
                  {teamPhotoError}
                </p>
              )}

              {/* Add new member form */}
              <div className="admin-team-add">
                <h3>Add New Member</h3>
                <div className="admin-team-add-row">
                  <input
                    type="text"
                    className="input"
                    placeholder="Name"
                    value={newMember.name}
                    onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Role (e.g., Lead Researcher)"
                    value={newMember.role}
                    onChange={(e) => setNewMember((prev) => ({ ...prev, role: e.target.value }))}
                  />

                  {!newMemberPhotoPreview && !newMemberCroppedDataUrl && (
                    <label className="admin-team-photo-upload">
                      <span>Select Photo</span>
                      <input
                        ref={newMemberFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if (file.size > MAX_PHOTO_BYTES) {
                            setTeamPhotoError('Images must be 2 MB or smaller.');
                            if (newMemberFileInputRef.current) {
                              newMemberFileInputRef.current.value = '';
                            }
                            return;
                          }

                          setTeamPhotoError('');

                          const previewUrl = URL.createObjectURL(file);
                          setNewMemberPhotoPreview(previewUrl);
                          setNewMemberPhotoFile(file);

                          // open crop immediately
                          openAvatarModalFor('__NEW__', file);
                        }}
                      />
                    </label>
                  )}

                  {newMemberPhotoPreview && !avatarModalOpen && (
                    <div className="admin-new-member-photo-chip">
                      <img src={newMemberPhotoPreview} alt="Selected" />

                      <span>
                        {newMemberCroppedDataUrl ? 'Photo ready' : 'Photo selected (crop pending)'}
                      </span>

                      <button
                        type="button"
                        className="admin-team-remove-button"
                        onClick={() => {
                          setNewMemberPhotoFile(null);
                          setNewMemberCroppedDataUrl('');

                          if (newMemberPhotoPreview) {
                            try {
                              URL.revokeObjectURL(newMemberPhotoPreview);
                            } catch {}
                          }

                          setNewMemberPhotoPreview('');

                          if (newMemberFileInputRef.current) {
                            newMemberFileInputRef.current.value = '';
                          }
                        }}
                      >
                        Remove Photo
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="admin-add-button"
                    onClick={handleAddTeamMember}
                    disabled={addingMember}
                  >
                    {addingMember ? 'Adding…' : 'Add Member'}
                  </button>
                </div>

                <p className="helper admin-team-photo-note">
                  Recommended: square images at least 512×512, JPG/PNG. You’ll be able to crop them
                  into a circle.
                </p>
              </div>

              {/* Existing members list */}
              {adminTeam.length === 0 && !teamLoading ? (
                <p className="helper" style={{ marginTop: 16 }}>
                  No team members found.
                </p>
              ) : (
                <div className="admin-team-list">
                  {adminTeam.map((member) => {
                    const isEditing = editingMemberId === member.id;

                    return (
                      <div key={member.id} className="admin-team-row">
                        <div className="admin-team-photo-cell">
                          {member.image_url ? (
                            <img
                              src={member.image_url}
                              alt={member.name}
                              className="admin-team-photo-thumb"
                            />
                          ) : (
                            <div className="admin-team-photo-placeholder">
                              <div className="admin-team-photo-inner">
                                <div className="admin-team-photo-circle" />
                                <div className="admin-team-photo-bar" />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="admin-team-info">
                          <input
                            type="text"
                            className={
                              'input admin-team-name-input' + (!isEditing ? ' input--readonly' : '')
                            }
                            value={member.name || ''}
                            readOnly={!isEditing}
                            onChange={(e) =>
                              handleMemberFieldChange(member.id, 'name', e.target.value)
                            }
                          />
                          <input
                            type="text"
                            className={
                              'input admin-team-role-input' + (!isEditing ? ' input--readonly' : '')
                            }
                            value={member.role || ''}
                            readOnly={!isEditing}
                            onChange={(e) =>
                              handleMemberFieldChange(member.id, 'role', e.target.value)
                            }
                          />
                        </div>

                        <div className="admin-team-actions">
                          <label className="admin-team-photo-upload">
                            <span>{member.image_url ? 'Change Photo' : 'Add Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                openAvatarModalFor(member.id, file);
                              }}
                            />
                          </label>

                          {member.image_url && (
                            <button
                              type="button"
                              className="admin-team-remove-button"
                              onClick={() => handlePhotoDelete(member.id)}
                            >
                              Remove Photo
                            </button>
                          )}

                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                className="primary-button"
                                onClick={() => setEditingMemberId(member.id)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => handleDeleteTeamMember(member.id)}
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="primary-button"
                                onClick={() => handleSaveTeamMember(member)}
                                disabled={savingMemberId === member.id}
                              >
                                {savingMemberId === member.id ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="cancel-button"
                                onClick={() => {
                                  // reload from server to discard edits
                                  loadAdminTeam();
                                  setEditingMemberId(null);
                                }}
                                disabled={savingMemberId === member.id}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => handleDeleteTeamMember(member.id)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Avatar cropper modal */}
              <AvatarCropModal
                isOpen={avatarModalOpen}
                imageSrc={avatarImageSrc}
                onClose={closeAvatarModal}
                onSave={handleAvatarSave}
                onLoaded={() => setCropperBlocking(false)}
              />
            </div>
          )}

          {/* ---- ABOUT PAGE TAB ---- */}
          {adminTab === 'about' && (
            <div className="admin-subpanel admin-subpanel--about">
              <h2>About Page Content</h2>
              <p className="helper" style={{ marginTop: 12, color: '#000000' }}>
                Use the “Edit About Page” button above to add, reorder, or remove sections. Sections
                are shown on the public About page in order.
              </p>
              {!aboutEditMode && (
                <>
                  <div className="admin-about-content">
                    {aboutSections.length === 0 && (
                      <p className="helper">
                        No sections have been added yet. Use “Edit About Page” above to create them.
                      </p>
                    )}

                    {aboutSections
                      .filter((s) => !s.isDeleted)
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((sec) => (
                        <div key={sec.id ?? sec.localId} className="admin-about-section">
                          <div className="admin-about-section-label">
                            Section {sec.displayOrder}
                          </div>
                          <div className="admin-about-section-title">
                            {sec.title || 'Untitled section'}
                          </div>
                          <p className="admin-about-section-text">
                            {sec.text || 'No text has been added yet.'}
                          </p>
                        </div>
                      ))}
                  </div>
                </>
              )}

              {aboutEditMode && (
                <div className="admin-about-edit-list">
                  {aboutSections
                    .filter((s) => !s.isDeleted)
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((sec) => {
                      const activeCount = aboutSections.filter((s) => !s.isDeleted).length;

                      return (
                        <div
                          key={sec.localId}
                          ref={(el) => {
                            if (el) aboutSectionRefs.current[sec.localId] = el;
                          }}
                          className="admin-about-edit-item"
                        >
                          <div className="admin-about-edit-header">
                            <span className="admin-about-edit-label">
                              Section {sec.displayOrder}
                            </span>

                            <label className="admin-about-order-control">
                              Position:
                              <select
                                className="input admin-about-order-select"
                                value={sec.displayOrder}
                                onChange={(e) => {
                                  applyAboutOrderChange(sec.localId, e.target.value);
                                  setAboutScrollTarget(sec.localId);
                                }}
                              >
                                {Array.from({ length: activeCount }, (_, i) => i + 1).map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="admin-field admin-about-edit-field">
                            <label className="admin-field-label">
                              <span>Section Title</span>
                            </label>
                            <input
                              className="input admin-about-input"
                              value={sec.title}
                              onChange={(e) =>
                                handleAboutFieldChange(sec.localId, 'title', e.target.value)
                              }
                            />
                          </div>

                          <div className="admin-field admin-about-edit-field">
                            <label className="admin-field-label">
                              <span>Section Text</span>
                            </label>
                            <textarea
                              className="input admin-about-textarea"
                              rows={4}
                              value={sec.text}
                              onChange={(e) =>
                                handleAboutFieldChange(sec.localId, 'text', e.target.value)
                              }
                            />
                          </div>

                          <div className="admin-about-edit-actions">
                            <button
                              type="button"
                              className="admin-modal-button admin-modal-button--danger"
                              onClick={() => handleAboutDelete(sec.localId)}
                            >
                              Delete Section
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  <div className="admin-about-footer-actions">
                    <button
                      type="button"
                      className="admin-modal-button"
                      onClick={handleAddAboutSection}
                    >
                      Add Section
                    </button>
                    <button
                      type="button"
                      className="admin-modal-button admin-modal-button--ghost"
                      onClick={handleCancelAboutEdit}
                      disabled={aboutSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="admin-modal-button"
                      onClick={handleSaveAboutChanges}
                      disabled={aboutSaving}
                    >
                      {aboutSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {aboutError && (
                <p className="helper" style={{ color: '#ffb3b3', marginTop: 10 }}>
                  {aboutError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- ACCOUNT MODAL (Add / Edit) ---- */}
      {accountModalOpen && (
        <div className="admin-modal-backdrop" onClick={closeAccountModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {accountModalMode === 'create' ? 'Add Admin Account' : 'Edit Admin Account'}
              </h2>

              <div className="admin-modal-actions">
                {accountModalMode === 'edit' && (
                  <button
                    type="button"
                    className="admin-modal-button admin-modal-button--danger"
                    onClick={() => {
                      setPendingDeleteAccount(editingAccount);
                      setDeleteConfirmOpen(true);
                    }}
                    disabled={accountSaving}
                  >
                    Delete
                  </button>
                )}

                <button
                  type="button"
                  className="admin-modal-button admin-modal-button--ghost"
                  onClick={closeAccountModal}
                  disabled={accountSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-modal-button"
                  onClick={handleSaveAccount}
                  disabled={accountSaving}
                >
                  {accountSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {accountModalError && (
              <p className="helper" style={{ color: '#ffb3b3', marginBottom: 10 }}>
                {accountModalError}
              </p>
            )}

            {/* Username */}
            <div className={'admin-field ' + (usernameMissing ? 'admin-field--error' : '')}>
              <div className="admin-field-label">
                <span>
                  Username
                  {isCreateMode && <span className="admin-field-required"> *</span>}
                </span>
              </div>
              <input
                className={`input ${usernameMissing ? 'input--error' : ''}`}
                value={accountForm.username}
                onChange={(e) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                disabled={accountModalMode === 'edit'}
              />
              {usernameMissing && (
                <span className="admin-field-error-text">* Required field missing</span>
              )}
            </div>

            {/* Password */}
            <div className={'admin-field ' + (passwordMissing ? 'admin-field--error' : '')}>
              <div className="admin-field-label">
                <span>
                  {isCreateMode ? 'Password' : 'New Password'}
                  {isCreateMode && <span className="admin-field-required"> *</span>}
                </span>
                {accountModalMode === 'edit' && (
                  <span className="admin-field-note">Leave blank to keep the current password</span>
                )}
              </div>
              <div className="admin-password-wrapper">
                <input
                  className={`input ${passwordMissing ? 'input--error' : ''}`}
                  type={showAccountPassword ? 'text' : 'password'}
                  value={accountForm.password}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowAccountPassword((prev) => !prev)}
                >
                  {showAccountPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {passwordMissing && (
                <span className="admin-field-error-text">* Required field missing</span>
              )}
            </div>

            {/* Security question */}
            <div className={'admin-field ' + (questionMissing ? 'admin-field--error' : '')}>
              <div className="admin-field-label">
                <span>
                  Security Question
                  {isCreateMode && <span className="admin-field-required"> *</span>}
                </span>
              </div>
              <select
                className={`input ${questionMissing ? 'input--error' : ''}`}
                value={accountForm.securityQuestionId || ''}
                onChange={(e) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    securityQuestionId: e.target.value || '',
                  }))
                }
              >
                <option value="">None</option>
                {securityQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.question_text}
                  </option>
                ))}
              </select>
              {questionMissing && (
                <span className="admin-field-error-text">* Required field missing</span>
              )}
            </div>

            {/* Security answer */}
            <div className={'admin-field ' + (answerMissing ? 'admin-field--error' : '')}>
              <div className="admin-field-label">
                <span>
                  {isCreateMode ? 'Security Answer' : 'New Security Answer'}
                  {isCreateMode && <span className="admin-field-required"> *</span>}
                </span>
                {accountModalMode === 'edit' && (
                  <span className="admin-field-note">Leave blank to keep the current answer</span>
                )}
              </div>
              <div className="admin-password-wrapper">
                <input
                  className={`input ${answerMissing ? 'input--error' : ''}`}
                  type={showAccountAnswer ? 'text' : 'password'}
                  value={accountForm.securityAnswer}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      securityAnswer: e.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowAccountAnswer((prev) => !prev)}
                >
                  {showAccountAnswer ? 'Hide' : 'Show'}
                </button>
              </div>
              {answerMissing && (
                <span className="admin-field-error-text">* Required field missing</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- DELETE CONFIRM MODAL ---- */}
      {deleteConfirmOpen && (
        <div
          className="admin-modal-backdrop admin-modal-backdrop--confirm"
          onClick={() => {
            setDeleteConfirmOpen(false);
            setPendingDeleteAccount(null);
          }}
        >
          <div className="admin-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-confirm-title">
              Delete account "{pendingDeleteAccount?.username}"?
            </h3>
            <p className="admin-confirm-text">This action cannot be undone.</p>

            <div className="admin-confirm-actions">
              <button
                type="button"
                className="admin-modal-button admin-modal-button--danger"
                onClick={handleConfirmDeleteClick}
                disabled={accountSaving}
              >
                Delete
              </button>
              <button
                type="button"
                className="admin-modal-button admin-modal-button--outline"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setPendingDeleteAccount(null);
                }}
                disabled={accountSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- GLOBAL SAVE / UPLOAD BLOCKER ---- */}
      {(eventSaving ||
        createMediaUploading ||
        accountSaving ||
        profileSaving ||
        cropperBlocking ||
        aboutSaving ||
        accountDeleting ||
        teamBlocking ||
        mediaUploadBusy ||
        mediaDeleteBusy ||
        deleteEventBusy) && (
        <div className="admin-blocker">
          <div className="admin-blocker-inner">
            <div className="admin-blocker-spinner" />
            <div className="admin-blocker-text">
              {deleteEventBusy
                ? 'Deleting event…'
                : mediaDeleteBusy
                  ? 'Deleting article…'
                  : mediaUploadBusy
                    ? 'Uploading article…'
                    : createMediaUploading
                      ? createMediaUploadingText || 'Uploading article image…'
                      : eventSaving
                        ? 'Saving event…'
                        : teamBlocking
                          ? teamBlockingText || 'Working on team updates…'
                          : accountDeleting
                            ? 'Deleting Account'
                            : accountSaving
                              ? 'Saving account changes…'
                              : cropperBlocking
                                ? 'Loading photo editor...'
                                : profileSaving
                                  ? 'Updating your profile…'
                                  : aboutSaving
                                    ? 'Saving About page…'
                                    : 'Working…'}
            </div>
          </div>
        </div>
      )}

      {/* 3) Delete-article confirmation dialog */}
      {mediaDeleteOpen && mediaDeleteTarget && (
        <div className="delete-media-backdrop" onClick={closeMediaDeleteDialog}>
          <div className="delete-media-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="delete-media-title">Delete Article?</h3>
            <p className="delete-media-text">
              Are you sure you want to delete this newspaper article? This action cannot be undone.
            </p>

            <div className="delete-media-preview">
              {mediaDeleteTarget?.url ? (
                <img
                  src={mediaDeleteTarget.url}
                  alt={mediaDeleteTarget.caption || 'Article preview'}
                />
              ) : (
                <div className="helper">No preview available.</div>
              )}
            </div>

            <div className="delete-media-actions">
              <button
                type="button"
                className="delete-dialog-btn delete-dialog-btn-cancel"
                onClick={closeMediaDeleteDialog}
                disabled={mediaDeleteBusy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-dialog-btn delete-dialog-btn-confirm"
                onClick={confirmDeleteMedia}
                disabled={mediaDeleteBusy}
              >
                {mediaDeleteBusy ? (
                  <>
                    <span className="delete-dialog-spinner" />
                    Deleting…
                  </>
                ) : (
                  'Delete Article'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminEventModal({
  event,
  form,
  setForm,
  saving,
  media,
  mediaIndex,
  setMediaIndex,
  mediaLoading,
  mediaError,
  newMediaUrl,
  setNewMediaUrl,
  newMediaCaption,
  setNewMediaCaption,
  onClose,
  onSave,
  onAddMedia,
  onDeleteMedia,
  onUpdateMediaCaption,
  mediaCaptionBusy,
  mediaCaptionError,
  uploadBusy,
  uploadError,
  onOpenAddArticleModal,
  isCreating,
  onSaveCaption,
  onUpdateQueuedCaption,
}) {
  const hasMedia = Array.isArray(media) && media.length > 0;
  const multipleMedia = Array.isArray(media) && media.length > 1;

  const safeIndex = hasMedia ? Math.min(mediaIndex ?? 0, media.length - 1) : 0;
  const currentMedia = hasMedia ? media[safeIndex] : null;

  const currentMediaSrc = currentMedia ? currentMedia.url || currentMedia.previewUrl || '' : '';

  const [captionEditing, setCaptionEditing] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const captionReadOnlyValue = currentMedia?.caption || '';

  // --- Required-field validation (Create + Save) ---
  const [eventTriedSubmit, setEventTriedSubmit] = useState(false);
  const [eventErrors, setEventErrors] = useState({
    date: '',
    event_type: '',
    location: '',
    title: '',
    short_description: '',
    summary: '',
    impact_on_communication: '',
  });

  const isValidDate = (val) => /^\d{2}\/\d{2}\/\d{4}$/.test((val || '').trim());

  const validateEventForm = () => {
    const next = {
      date: '',
      event_type: '',
      location: '',
      title: '',
      short_description: '',
      summary: '',
      impact_on_communication: '',
    };

    // Date must be MM/DD/YYYY
    if (!isValidDate(form.date)) next.date = '* Required field missing';

    // All other fields required
    if (!(form.event_type || '').trim()) next.event_type = '* Required field missing';
    if (!(form.location || '').trim()) next.location = '* Required field missing';
    if (!(form.title || '').trim()) next.title = '* Required field missing';
    if (!(form.short_description || '').trim()) next.short_description = '* Required field missing';
    if (!(form.summary || '').trim()) next.summary = '* Required field missing';
    if (!(form.impact_on_communication || '').trim())
      next.impact_on_communication = '* Required field missing';

    setEventErrors(next);

    // return true only if no errors
    return !Object.values(next).some(Boolean);
  };

  const handlePrimarySaveClick = () => {
    setEventTriedSubmit(true);
    const ok = validateEventForm();
    if (!ok) return;
    onSave?.();
  };

  // Keep mediaIndex in range whenever media changes
  useEffect(() => {
    if (!Array.isArray(media)) return;

    setMediaIndex((idx) => {
      if (media.length === 0) return 0;
      if (idx < 0) return 0;
      if (idx >= media.length) return media.length - 1;
      return idx;
    });
  }, [media, setMediaIndex]);

  // When switching images, reset caption editing/draft
  useEffect(() => {
    setCaptionEditing(false);
    setCaptionDraft(currentMedia?.caption || '');
  }, [currentMedia?.id]);

  const handleBackdropClick = () => {
    if (!saving && !uploadBusy) onClose();
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateInputChange = (raw) => {
    const previous = form.date || '';

    // Digits before this change
    const prevDigits = previous.replace(/\D/g, '');
    // Digits after this change
    let digits = raw.replace(/\D/g, '');

    // If we already had 8+ digits and user tries to add more, ignore (prevents shifting behavior)
    if (prevDigits.length >= 8 && digits.length > prevDigits.length) {
      handleChange('date', previous);
      return;
    }

    // Allow paste but truncate to 8 digits (MMDDYYYY)
    if (digits.length > 8) digits = digits.slice(0, 8);

    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);

    let formatted = '';
    if (mm) formatted = mm;
    if (dd) formatted += (formatted ? '/' : '') + dd;
    if (yyyy) formatted += (formatted ? '/' : '') + yyyy;

    handleChange('date', formatted);
  };

  return (
    <div className="admin-modal-backdrop admin-modal-backdrop--event" onClick={handleBackdropClick}>
      <div className="admin-modal admin-event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-event-modal-header">
          <h2 className="admin-modal-title">{isCreating ? 'Add Event' : 'Edit Event'}</h2>

          <div className="admin-event-modal-actions">
            <button
              type="button"
              className="admin-modal-button"
              onClick={handlePrimarySaveClick}
              disabled={saving}
            >
              {saving ? 'Saving…' : isCreating ? 'Create ✓' : 'Save ✓'}
            </button>

            <button
              type="button"
              className="admin-modal-button admin-modal-button--ghost"
              onClick={onClose}
              disabled={saving || uploadBusy}
            >
              Cancel ✕
            </button>
          </div>
        </div>

        <div className="admin-event-modal-body">
          {/* LEFT: form fields */}
          <div className="admin-event-modal-form">
            <div
              className={
                'admin-field ' + (eventTriedSubmit && eventErrors.date ? 'admin-field--error' : '')
              }
            >
              <div className="admin-field-label">
                <span>
                  Date <span className="admin-field-required"> *</span>
                </span>
              </div>

              <input
                type="text"
                className={`input ${eventTriedSubmit && eventErrors.date ? 'input--error' : ''}`}
                inputMode="numeric"
                maxLength={10}
                placeholder="MM/DD/YYYY"
                value={form.date || ''}
                onChange={(e) => {
                  handleDateInputChange(e.target.value);
                  if (eventTriedSubmit) {
                    // live-clear error as user fixes it
                    setEventErrors((prev) => ({
                      ...prev,
                      date: isValidDate(e.target.value) ? '' : prev.date,
                    }));
                  }
                }}
              />

              {eventTriedSubmit && eventErrors.date && (
                <span className="admin-field-error-text">{eventErrors.date}</span>
              )}
            </div>

            <div
              className={
                'admin-field ' +
                (eventTriedSubmit && eventErrors.event_type ? 'admin-field--error' : '')
              }
            >
              <div className="admin-field-label">
                <span>
                  Event Type <span className="admin-field-required"> *</span>
                </span>
              </div>

              <input
                className={`input ${eventTriedSubmit && eventErrors.event_type ? 'input--error' : ''}`}
                value={form.event_type || ''}
                onChange={(e) => {
                  const v = e.target.value || '';
                  setForm((prev) => ({ ...prev, event_type: v }));
                  if (eventTriedSubmit) {
                    setEventErrors((prev) => ({
                      ...prev,
                      event_type: v.trim() ? '' : prev.event_type,
                    }));
                  }
                }}
              />

              {eventTriedSubmit && eventErrors.event_type && (
                <span className="admin-field-error-text">{eventErrors.event_type}</span>
              )}
            </div>

            <div
              className={
                'admin-field ' +
                (eventTriedSubmit && eventErrors.location ? 'admin-field--error' : '')
              }
            >
              <div className="admin-field-label">
                <span>
                  Location <span className="admin-field-required"> *</span>
                </span>
              </div>

              <input
                className={`input ${eventTriedSubmit && eventErrors.location ? 'input--error' : ''}`}
                value={form.location || ''}
                onChange={(e) => {
                  const v = e.target.value || '';
                  setForm((prev) => ({ ...prev, location: v }));
                  if (eventTriedSubmit) {
                    setEventErrors((prev) => ({
                      ...prev,
                      location: v.trim() ? '' : prev.location,
                    }));
                  }
                }}
              />

              {eventTriedSubmit && eventErrors.location && (
                <span className="admin-field-error-text">{eventErrors.location}</span>
              )}
            </div>

            <div
              className={
                'admin-field ' + (eventTriedSubmit && eventErrors.title ? 'admin-field--error' : '')
              }
            >
              <div className="admin-field-label">
                <span>
                  Title <span className="admin-field-required"> *</span>
                </span>
              </div>

              <input
                className={`input ${eventTriedSubmit && eventErrors.title ? 'input--error' : ''}`}
                value={form.title || ''}
                onChange={(e) => {
                  const v = e.target.value || '';
                  setForm((prev) => ({ ...prev, title: v }));
                  if (eventTriedSubmit) {
                    setEventErrors((prev) => ({ ...prev, title: v.trim() ? '' : prev.title }));
                  }
                }}
              />

              {eventTriedSubmit && eventErrors.title && (
                <span className="admin-field-error-text">{eventErrors.title}</span>
              )}
            </div>

            <div
              className={
                'admin-field ' +
                (eventTriedSubmit && eventErrors.short_description ? 'admin-field--error' : '')
              }
            >
              <div className="admin-field-label">
                <span>
                  Short Description <span className="admin-field-required"> *</span>
                </span>
              </div>

              <textarea
                className={`input ${eventTriedSubmit && eventErrors.short_description ? 'input--error' : ''}`}
                rows={3}
                value={form.short_description || ''}
                onChange={(e) => {
                  const v = e.target.value || '';
                  setForm((prev) => ({ ...prev, short_description: v }));
                  if (eventTriedSubmit) {
                    setEventErrors((prev) => ({
                      ...prev,
                      short_description: v.trim() ? '' : prev.short_description,
                    }));
                  }
                }}
              />

              {eventTriedSubmit && eventErrors.short_description && (
                <span className="admin-field-error-text">{eventErrors.short_description}</span>
              )}
            </div>

            <div
              className={
                'admin-field ' +
                (eventTriedSubmit && eventErrors.summary ? 'admin-field--error' : '')
              }
            >
              <div className="admin-field-label">
                <span>
                  Summary <span className="admin-field-required"> *</span>
                </span>
              </div>

              <textarea
                className={`input ${eventTriedSubmit && eventErrors.summary ? 'input--error' : ''}`}
                rows={8}
                value={form.summary || ''}
                onChange={(e) => {
                  const v = e.target.value || '';
                  setForm((prev) => ({ ...prev, summary: v }));
                  if (eventTriedSubmit) {
                    setEventErrors((prev) => ({ ...prev, summary: v.trim() ? '' : prev.summary }));
                  }
                }}
              />

              {eventTriedSubmit && eventErrors.summary && (
                <span className="admin-field-error-text">{eventErrors.summary}</span>
              )}
            </div>

            <div
              className={
                'admin-field ' +
                (eventTriedSubmit && eventErrors.impact_on_communication
                  ? 'admin-field--error'
                  : '')
              }
            >
              <div className="admin-field-label">
                <span>
                  Impact on Communication <span className="admin-field-required"> *</span>
                </span>
              </div>

              <textarea
                className={`input ${
                  eventTriedSubmit && eventErrors.impact_on_communication ? 'input--error' : ''
                }`}
                rows={8}
                value={form.impact_on_communication || ''}
                onChange={(e) => {
                  const v = e.target.value || '';
                  setForm((prev) => ({ ...prev, impact_on_communication: v }));
                  if (eventTriedSubmit) {
                    setEventErrors((prev) => ({
                      ...prev,
                      impact_on_communication: v.trim() ? '' : prev.impact_on_communication,
                    }));
                  }
                }}
              />

              {eventTriedSubmit && eventErrors.impact_on_communication && (
                <span className="admin-field-error-text">
                  {eventErrors.impact_on_communication}
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: media */}
          <div className="admin-event-modal-media">
            <h3 className="admin-event-media-title">Newspaper Articles</h3>

            {mediaLoading && <p className="helper">Loading articles…</p>}

            {mediaError && (
              <p className="helper" style={{ color: '#ffb3b3' }}>
                {mediaError}
              </p>
            )}

            {!mediaLoading && !hasMedia && !mediaError && (
              <div className="admin-event-media-empty">
                <p className="helper">No newspaper articles are linked to this event yet.</p>

                <button
                  type="button"
                  className="admin-add-button"
                  onClick={() => onOpenAddArticleModal && onOpenAddArticleModal()}
                  disabled={uploadBusy}
                  title="Add a new newspaper article image"
                >
                  + Add Article
                </button>
              </div>
            )}

            {!mediaLoading && hasMedia && (
              <div className="admin-event-media-viewer">
                {/* LEFT SIDE: previous + delete */}
                <div className="admin-event-media-side admin-event-media-side--left">
                  {multipleMedia && (
                    <div className="admin-event-media-side-block">
                      <button
                        type="button"
                        className="admin-event-media-circle"
                        onClick={() =>
                          setMediaIndex((prev) => (prev - 1 + media.length) % media.length)
                        }
                        disabled={mediaLoading}
                      >
                        ‹
                      </button>
                      <span className="admin-event-media-side-label">Previous Article</span>
                    </div>
                  )}

                  <div className="admin-event-media-side-block">
                    <button
                      type="button"
                      className="admin-event-media-circle admin-event-media-circle--danger"
                      onClick={() => currentMedia && onDeleteMedia && onDeleteMedia(currentMedia)}
                      disabled={mediaLoading || !currentMedia}
                    >
                      🗑
                    </button>
                    <span className="admin-event-media-side-label">Delete Article</span>
                  </div>
                </div>

                {/* CENTER: article image */}
                <div className="admin-event-media-image-wrap">
                  {currentMedia ? (
                    <img
                      src={currentMediaSrc}
                      alt={currentMedia.caption || 'Newspaper article'}
                      className="admin-event-media-image"
                    />
                  ) : (
                    <p className="helper">No article selected.</p>
                  )}
                </div>

                {/* RIGHT SIDE: next + add */}
                <div className="admin-event-media-side admin-event-media-side--right">
                  {multipleMedia && (
                    <div className="admin-event-media-side-block">
                      <button
                        type="button"
                        className="admin-event-media-circle"
                        onClick={() => setMediaIndex((prev) => (prev + 1) % media.length)}
                        disabled={mediaLoading}
                      >
                        ›
                      </button>
                      <span className="admin-event-media-side-label">Next Article</span>
                    </div>
                  )}

                  <div className="admin-event-media-side-block">
                    <button
                      type="button"
                      className="admin-event-media-circle admin-event-media-circle--add"
                      onClick={() => onOpenAddArticleModal && onOpenAddArticleModal()}
                      disabled={mediaLoading || uploadBusy}
                      title="Add a new newspaper article image"
                    >
                      +
                    </button>
                    <span className="admin-event-media-side-label">Add Article</span>
                  </div>
                </div>
              </div>
            )}

            {hasMedia && (
              <div className="admin-field admin-event-caption-field">
                {/* Header row: left title, right actions */}
                <div className="admin-event-caption-header">
                  <span className="admin-event-caption-title">Caption</span>

                  {!captionEditing ? (
                    <button
                      type="button"
                      className="admin-modal-button admin-modal-button--outline"
                      onClick={() => {
                        setCaptionDraft(captionReadOnlyValue);
                        setCaptionEditing(true);
                      }}
                      disabled={mediaCaptionBusy || uploadBusy}
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="admin-event-caption-actions">
                      <button
                        type="button"
                        className="admin-modal-button"
                        onClick={async () => {
                          const ok = await onSaveCaption?.(currentMedia, captionDraft);
                          if (ok) setCaptionEditing(false);
                        }}
                        disabled={mediaCaptionBusy}
                      >
                        {mediaCaptionBusy ? 'Saving…' : 'Save'}
                      </button>

                      <button
                        type="button"
                        className="admin-modal-button admin-modal-button--ghost"
                        onClick={() => {
                          setCaptionDraft(captionReadOnlyValue);
                          setCaptionEditing(false);
                        }}
                        disabled={mediaCaptionBusy || uploadBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Caption textarea */}
                <textarea
                  className={`input admin-event-caption-input ${
                    captionEditing ? 'is-editing' : 'is-readonly'
                  }`}
                  rows={3}
                  value={captionEditing ? captionDraft : captionReadOnlyValue}
                  readOnly={!captionEditing}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  placeholder="No caption set."
                  disabled={mediaCaptionBusy}
                />

                {mediaCaptionError && (
                  <div className="admin-field-error-text" style={{ marginTop: 8 }}>
                    {mediaCaptionError}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* end media column */}
        </div>
      </div>
    </div>
  );
}

function getEventYear(dateStr) {
  if (!dateStr) return null;
  const year = String(dateStr).slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

/* === Event Detail Overlay === */

function EventDetailOverlay({ event, onClose, onViewArticles }) {
  if (!event) return null;

  return (
    <div className="event-overlay-backdrop" onClick={onClose}>
      <div className="event-detail-card" onClick={(e) => e.stopPropagation()}>
        <button className="event-detail-close" onClick={onClose} aria-label="Close details">
          ✕
        </button>

        <div className="event-detail-meta">
          <strong>{event.fullDate}</strong>
          {event.type && <span className="event-detail-meta-type"> - {event.type}</span>}
        </div>

        <h1 className="event-detail-title">{event.title}</h1>

        <h1 className="event-detail-location">{event.location}</h1>

        {event.shortDescription && <p className="event-detail-short">{event.shortDescription}</p>}

        <div className="event-detail-section">
          <h2>Event Summary:</h2>
          <div className="event-detail-scrollbox">
            <p>{event.summary}</p>
          </div>
        </div>

        <div className="event-detail-section">
          <h2>Impact on Communication:</h2>
          <div className="event-detail-scrollbox">
            <p>{event.impact}</p>
          </div>
        </div>

        <div className="event-detail-side-action">
          <button
            className="event-detail-circle-button"
            onClick={() => onViewArticles && onViewArticles(event)}
          >
            <span className="event-detail-articles-icon">📰</span>
          </button>
          <span className="event-detail-circle-label">View Newspaper Articles</span>
        </div>

        <div className="event-detail-footer">
          <button className="event-detail-cta">Tell Me More</button>
        </div>
      </div>
    </div>
  );
}

/* === Media Overlay === */
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
    // re-check when index/items change
    const el = scrollRef.current;
    if (!el) return;

    // wait a tick so layout is correct
    const t = setTimeout(() => {
      setNeedsScroll(el.scrollHeight > el.clientHeight + 1);
    }, 0);

    return () => clearTimeout(t);
  }, [safeIndex, items?.length, loading]);

  return (
    <div className="media-overlay-backdrop" onClick={onCloseAll}>
      <div className="media-overlay-card" onClick={(e) => e.stopPropagation()}>
        <button className="media-overlay-close" onClick={onCloseAll} aria-label="Close">
          ✕
        </button>

        <button type="button" className="media-overlay-back" onClick={onBackToSummary}>
          ← Back to Summary
        </button>

        <div className="media-overlay-header">
          <div className="media-overlay-title">{event?.title || 'Event'} — Newspaper Articles</div>
          <div className="media-overlay-subtitle">{event?.fullDate || ''}</div>
        </div>

        {loading && <p className="helper">Loading articles…</p>}

        {!loading && error && (
          <p className="helper" style={{ color: '#ffb3b3' }}>
            {error}
          </p>
        )}

        {!loading && !error && !hasItems && (
          <p className="helper">No newspaper articles are linked to this event yet.</p>
        )}

        {!loading && hasItems && (
          <>
            <div className="media-overlay-body">
              {multipleItems ? (
                <button
                  type="button"
                  className="media-nav-button media-nav-button--left"
                  onClick={onPrev}
                  disabled={loading}
                  aria-label="Previous article"
                >
                  <div className="media-nav-inner">
                    <div className="media-nav-arrow">‹</div>
                    <div className="media-nav-label">Prev</div>
                  </div>
                </button>
              ) : (
                <div className="media-nav-button media-nav-button--left" aria-hidden="true" />
              )}

              <div className="media-image-wrapper">
                <div
                  ref={scrollRef}
                  className={`media-image-scroll ${needsScroll ? 'is-scrollable' : 'is-centered'}`}
                >
                  <img
                    src={current?.url}
                    alt={current?.caption || 'Newspaper article'}
                    className="media-image"
                    onLoad={() => {
                      const el = scrollRef.current;
                      if (!el) return;
                      setNeedsScroll(el.scrollHeight > el.clientHeight + 1);
                    }}
                  />
                </div>
              </div>

              {multipleItems ? (
                <button
                  type="button"
                  className="media-nav-button media-nav-button--right"
                  onClick={onNext}
                  disabled={loading}
                  aria-label="Next article"
                >
                  <div className="media-nav-inner">
                    <div className="media-nav-arrow">›</div>
                    <div className="media-nav-label">Next</div>
                  </div>
                </button>
              ) : (
                <div className="media-nav-button media-nav-button--right" aria-hidden="true" />
              )}
            </div>

            <div className="media-overlay-caption">
              {current?.caption || 'No caption provided.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
