/* =========================================================
   Solar Events — App.jsx
   Application shell: topbar, navigation, routing, footer
   ========================================================= */

import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { API_BASE, extractYear, formatEventDateLabel, formatFullDateLong } from './utils';

import HomePage from './Pages/Home/HomePage';
import AboutPage from './Pages/About/AboutPage';
import LivePage from './Pages/Live/LivePage';
import BirthdayPage from './Pages/Birthday/BirthdayPage';
import AdminPage from './Pages/Admin/AdminPage';
import BackgroundVideos from './BackgroundVideos';

/* ---- Derived YEAR helpers for the topbar search ---- */
function buildYearData(events) {
  const years = Array.from(new Set(events.map((e) => e.year))).sort(
    (a, b) => Number(a) - Number(b)
  );
  const decades = Array.from(new Set(years.map((y) => Math.floor(Number(y) / 10) * 10))).sort(
    (a, b) => a - b
  );
  return { years, decades };
}

/* ================================================================
   App — shell only
   ================================================================ */

export default function App() {
  // ---- Events (fetched here, passed down to HomePage) ----
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  // ---- Topbar stacking ----
  const [topbarStacked, setTopbarStacked] = useState(false);
  const topbarInnerRef = useRef(null);
  const brandRef = useRef(null);
  const menuRef = useRef(null);
  const yearToolsRef = useRef(null);
  const toolsRowRef = useRef(null);

  useEffect(() => {
    function computeStacked() {
      if (pathname !== '/') {
        setTopbarStacked(false);
        return;
      }
      const inner = topbarInnerRef.current;
      const brand = brandRef.current;
      const toolsRow = toolsRowRef.current;
      if (!inner || !brand || !toolsRow) return;
      setTopbarStacked(brand.offsetWidth + 16 + toolsRow.offsetWidth > inner.clientWidth);
    }
    computeStacked();
    const ro = new ResizeObserver(() => computeStacked());
    [topbarInnerRef, brandRef, menuRef, yearToolsRef, toolsRowRef].forEach(
      (r) => r.current && ro.observe(r.current)
    );
    window.addEventListener('resize', computeStacked);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', computeStacked);
    };
  }, [pathname]);

  // ---- Menu ----
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const navDrawerRef = useRef(null);

  // ---- Year search ----
  const [yearQuery, setYearQuery] = useState('');
  const [scrollToYear, setScrollToYear] = useState(null);
  const [searchInfo, setSearchInfo] = useState('');
  const [searchError, setSearchError] = useState('');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [pickerDecade, setPickerDecade] = useState(null);
  const yearSearchRef = useRef(null);

  const isTimeline = pathname === '/';
  const isAbout = pathname === '/about';
  const isAdmin = pathname === '/admin';

  useEffect(() => {
    document.title = isAdmin ? 'Solar Impacts Admin' : 'Solar Impacts';
  }, [isAdmin]);

  // ---- Fetch events ----
  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoadingEvents(true);
        setEventsError('');
        const res = await fetch(`${API_BASE}/api/events`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEvents(
          data.map((row) => ({
            id: row.id,
            year: extractYear(row.event_date),
            date: formatEventDateLabel(row.event_date),
            fullDate: formatFullDateLong(row.event_date),
            title: row.title,
            type: row.event_type,
            shortDescription: row.short_description,
            summary: row.summary,
            impact: row.impact_on_communication,
            location: row.location || '',
          }))
        );
      } catch (err) {
        console.error('Error loading events:', err);
        setEventsError('Unable to load events right now. Please try again later.');
      } finally {
        setLoadingEvents(false);
      }
    }
    fetchEvents();
  }, []);

  // Auto-hide search notifications
  useEffect(() => {
    if (!searchInfo && !searchError) return;
    const id = setTimeout(() => {
      setSearchInfo('');
      setSearchError('');
    }, 5000);
    return () => clearTimeout(id);
  }, [searchInfo, searchError]);

  // Set initial picker decade
  const { years: YEARS, decades: DECADES } = buildYearData(events);
  useEffect(() => {
    if (DECADES.length && pickerDecade === null) setPickerDecade(DECADES[0]);
  }, [DECADES, pickerDecade]);

  // Click-outside: close menu + year picker
  useEffect(() => {
    function handleDocumentClick(e) {
      if (menuOpen) {
        const inside =
          menuButtonRef.current?.contains(e.target) || navDrawerRef.current?.contains(e.target);
        if (!inside) setMenuOpen(false);
      }
      if (showYearPicker && !yearSearchRef.current?.contains(e.target)) {
        setShowYearPicker(false);
      }
    }
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [menuOpen, showYearPicker]);

  const handleNavClick = (path) => {
    navigate(path);
    setMenuOpen(false);
    setShowYearPicker(false);
  };

  const handleYearSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = (yearQuery || '').trim();
    if (!/^\d{4}$/.test(trimmed)) {
      setSearchError('Please enter a 4-digit year (for example, 1989).');
      setSearchInfo('');
      navigate('/');
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
      closest = YEARS.reduce(
        (prev, curr) => (Math.abs(Number(curr) - num) < Math.abs(Number(prev) - num) ? curr : prev),
        YEARS[0]
      );
      setSearchInfo(`No events for ${targetYear}. Showing closest year: ${closest}.`);
    } else {
      setSearchInfo('');
    }
    navigate('/');
    setMenuOpen(false);
    setScrollToYear(closest);
  };

  const handleYearPickerSelect = (year) => {
    setYearQuery(String(year));
    setSearchError('');
    setSearchInfo('');
    navigate('/');
    setMenuOpen(false);
    setScrollToYear(String(year));
    setShowYearPicker(false);
  };

  return (
    <div className="app">
      {/* ---- SPACE VIDEOS (ambient background layer) ---- */}
      <BackgroundVideos />

      {/* ---- TOPBAR ---- */}
      <header
        className={`topbar ${isTimeline ? 'topbar--timeline' : ''} ${isTimeline && topbarStacked ? 'topbar--stacked' : ''}`}
      >
        <div ref={topbarInnerRef} className="topbar-inner">
          <button
            ref={brandRef}
            className="brand brand-button topbar-brand"
            onClick={() => handleNavClick('/')}
            type="button"
          >
            <span className="brand-text">SPACE WEATHER HISTORY</span>
          </button>

          <div
            ref={toolsRowRef}
            className={`topbar-tools-row ${isTimeline ? 'topbar-tools-row--timeline' : 'topbar-tools-row--simple'}`}
          >
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

            {isTimeline ? (
              <form
                ref={(el) => {
                  yearSearchRef.current = el;
                  yearToolsRef.current = el;
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
                  onChange={(e) => setYearQuery(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
                            className={`year-search-decade ${pickerDecade === d ? 'is-active' : ''}`}
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

      {/* ---- SEARCH BANNER ---- */}
      {!isAdmin && (searchInfo || searchError) && (
        <div
          className={`global-banner ${searchError ? 'global-banner--error' : 'global-banner--info'}`}
        >
          <span className="global-banner-icon">{searchError ? '⚠' : 'ℹ'}</span>
          {searchError || searchInfo}
        </div>
      )}

      {/* ---- NAV DRAWER ---- */}
      <nav ref={navDrawerRef} className={`nav-drawer ${menuOpen ? 'nav-drawer--open' : ''}`}>
        <button className="nav-item" onClick={() => handleNavClick('/')} type="button">
          <span className="nav-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 6L8 1L14 6V14H10V10H6V14H2V6Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
          </span>
          <span>Home</span>
        </button>
        <button className="nav-item" onClick={() => handleNavClick('/live')} type="button">
          <span className="nav-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M8 1V3M8 13V15M1 8H3M13 8H15M3.22 3.22L4.64 4.64M11.36 11.36L12.78 12.78M3.22 12.78L4.64 11.36M11.36 4.64L12.78 3.22"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </span>
          <span>Live Data</span>
        </button>
        <button className="nav-item" onClick={() => handleNavClick('/birthday')} type="button">
          <span className="nav-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect
                x="2"
                y="5"
                width="12"
                height="9"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M5 5V4A3 3 0 0 1 11 4V5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 2V5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
          <span>Events on My Birthday</span>
        </button>
        <button className="nav-item" onClick={() => handleNavClick('/about')} type="button">
          <span className="nav-icon-wrap">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M8 7V11M8 5.5V5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span>About</span>
        </button>
      </nav>

      {/* ---- MAIN CONTENT ---- */}
      <main
        className={`main ${isTimeline ? 'main--timeline' : ''} ${isAbout ? 'main--about' : ''} ${isAdmin ? 'main--admin' : ''}`}
      >
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                events={events}
                loading={loadingEvents}
                loadError={eventsError}
                scrollToYear={scrollToYear}
                onScrollToYearHandled={() => setScrollToYear(null)}
              />
            }
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/live" element={<LivePage />} />
          <Route path="/birthday" element={<BirthdayPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>

      {/* ---- FOOTER ---- */}
      <footer className="footer">
        <span className="footer-copy">© {new Date().getFullYear()} Space Weather History</span>
        <span className="footer-divider">·</span>
        <span className="footer-tagline">
          Documenting the sun's impact on communication throughout human history
        </span>
      </footer>
    </div>
  );
}
