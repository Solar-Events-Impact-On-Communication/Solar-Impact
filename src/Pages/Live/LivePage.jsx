import './LivePage.css';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { NOAA_API_URL } from '../../utils';

export default function LivePage() {
  const [hoveredId, setHoveredId] = useState(null);
  const [nasaData, setNasaData] = useState({
    flare: {
      id: 'flare',
      label: 'LATEST SOLAR FLARE',
      value: 'Data Not Available',
      sub: 'N/A',
      status: 'normal',
      statusLabel: 'N/A',
      description:
        "Solar flares are sudden bursts of radiation from the Sun's surface, rated A, B, C, M, or X with each letter being 10x stronger than the last. X is the most powerful class. They reach Earth in about 8 minutes and can disrupt radio communications, GPS accuracy, and power grids with a possibility for aurora displays.",
    },
    storm: {
      id: 'storm',
      label: 'GEOMAGNETIC STORM',
      value: 'Data Not Available',
      sub: 'N/A',
      status: 'normal',
      statusLabel: 'N/A',
      description:
        "Geomagnetic storms occur when energy from the solar wind interacts with Earth's magnetic field.They are rated G1 through G5 with G5 being the highest. G1 and G2 storms can affect satellite operations and cause auroras visible at high latitudes. G3 and above can disrupt power grids and degrade GPS accuracy.",
    },
    wind: {
      id: 'wind',
      label: 'SOLAR WIND SPEED',
      value: 'Data Not Available',
      sub: 'N/A',
      status: 'normal',
      statusLabel: 'N/A',
      description:
        "Solar wind is a constant stream of charged particles flowing outward from the Sun, measured in km/s. Typical speeds range from 300 to 500 km/s. Speeds above 700 km/s are considered high and can compress Earth's magnetic field, triggering geomagnetic storms.",
    },
    sunspot: {
      id: 'sunspot',
      label: 'SUNSPOT NUMBER',
      value: 'Data Not Available',
      sub: 'N/A',
      status: 'normal',
      statusLabel: 'N/A',
      description:
        "Sunspots are temporary dark regions on the Sun's surface caused by intense magnetic activity. Their daily count ranges from 0 during solar minimum to over 200 at solar maximum. The Sun follows an 11-year activity cycle, with more sunspots meaning more flares and solar storms.",
    },
  });

  const flareStatus = (cls) => {
    if (!cls || cls === 'N/A') return { status: 'normal', statusLabel: 'No Activity' };
    const l = cls.charAt(0).toUpperCase();
    if (['A', 'B', 'C'].includes(l)) return { status: 'normal', statusLabel: 'Minor Activity' };
    if (l === 'M') return { status: 'moderate', statusLabel: 'Moderate Activity' };
    if (l === 'X') return { status: 'elevated', statusLabel: 'Severe Activity' };
    return { status: 'normal', statusLabel: 'Unknown Activity' };
  };

  const stormStatus = (scale) => {
    const n = Number(scale);
    if (n >= 4) return 'extreme';
    if (n >= 3) return 'strong';
    if (n >= 2) return 'moderate';
    if (n >= 1) return 'minor';
    return 'normal';
  };

  const stormLabel = (scale) =>
    ({ 0: 'Quiet', 1: 'Minor', 2: 'Moderate', 3: 'Strong', 4: 'Severe', 5: 'Extreme' })[scale] ||
    'Quiet';

  const statusClass = (s) => {
    if (['slow', 'quiet', 'normal'].includes(s)) return 'live-card-status--normal';
    if (['active', 'moderate'].includes(s)) return 'live-card-status--moderate';
    if (['very-active', 'fast', 'elevated'].includes(s)) return 'live-card-status--elevated';
    return 'live-card-status--normal';
  };

  const updateMetric = (key, newData) =>
    setNasaData((prev) => ({ ...prev, [key]: { ...prev[key], ...newData } }));

  useEffect(() => {
    // Flare
    axios
      .get(NOAA_API_URL + 'json/goes/primary/xray-flares-latest.json')
      .then((res) => {
        const f = res.data[0];
        const flareClass = f?.max_class ?? 'N/A';
        let flareDate = 'Unknown';
        if (f?.max_time) {
          try {
            const raw = f.max_time.replace(' ', 'T').replace(/Z?$/, 'Z');
            const d = new Date(raw);
            if (!isNaN(d.getTime())) {
              flareDate = d.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              });
            }
          } catch (_) {}
        }
        updateMetric('flare', { value: flareClass, sub: flareDate, ...flareStatus(flareClass) });
      })
      .catch(console.error);

    // Geomagnetic storm
    axios
      .get(NOAA_API_URL + 'products/noaa-scales.json')
      .then((res) => {
        const entry = Object.values(res.data)[1]?.G;
        if (entry)
          updateMetric('storm', {
            value: entry.Scale === '0' ? 'Quiet' : `G${entry.Scale}`,
            sub: entry.Text ? entry.Text.charAt(0).toUpperCase() + entry.Text.slice(1) : 'None',
            status: stormStatus(entry.Scale),
            statusLabel: stormLabel(entry.Scale),
          });
      })
      .catch(console.error);

    // Solar wind
    axios
      .get(NOAA_API_URL + 'products/solar-wind/plasma-1-day.json')
      .then((res) => {
        const headers = res.data[0];
        const latest = res.data[res.data.length - 1];
        const item = headers.reduce((acc, k, i) => ({ ...acc, [k]: latest[i] }), {});
        const speed = item.speed ?? 'N/A';
        updateMetric('wind', {
          value: speed,
          sub: 'km/s',
          status: speed < 400 ? 'slow' : speed < 700 ? 'normal' : 'fast',
          statusLabel: speed < 400 ? 'Below Normal' : speed < 700 ? 'Normal Range' : 'High Speed',
        });
      })
      .catch(console.error);

    // Sunspot
    axios
      .get(NOAA_API_URL + 'json/solar-cycle/observed-solar-cycle-indices.json')
      .then((res) => {
        const latest = res.data[res.data.length - 1];
        const ssn = latest?.ssn ?? 0;
        const ssnDate = latest?.time_tag
          ? new Date(latest.time_tag).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })
          : 'Latest Reading';
        updateMetric('sunspot', {
          value: ssn,
          sub: ssnDate,
          status: ssn < 50 ? 'quiet' : ssn < 150 ? 'active' : 'very-active',
          statusLabel:
            ssn < 50 ? 'Solar Minimum' : ssn < 150 ? 'Normal Activity' : 'Solar Maximum Cycle',
        });
      })
      .catch(console.error);
  }, []);

  return (
    <div className="live-page">
      <div className="live-page-header">
        <div className="live-page-label">
          <span className="live-indicator" />
          LIVE DATA FEED
        </div>
        <h1 className="live-page-title">Solar Activity Monitor</h1>
        <p className="live-page-desc">Real-time solar weather data sourced from NASA & NOAA</p>
        <div className="live-page-rule" />
      </div>
      <div className="live-grid">
        {Object.values(nasaData).map((metric) => (
          <div
            key={metric.id}
            className={`live-card live-card--${metric.status} ${hoveredId === metric.id ? 'live-card--hovered' : ''}`}
            onMouseEnter={() => setHoveredId(metric.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="live-card-front">
              <div className="live-card-label">{metric.label}</div>
              <div className="live-card-value">{metric.value}</div>
              <div className="live-card-unit">{metric.sub}</div>
              <div className="live-card-footer">
                <span className={`live-card-status ${statusClass(metric.status)}`} />
                <span className="live-card-status-label">{metric.statusLabel}</span>
                <span className="live-card-hint">Hover for info</span>
              </div>
            </div>
            <div className="live-card-back">
              <div className="live-card-back-label">{metric.label}</div>
              <p className="live-card-back-desc">{metric.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="live-notice">
        <div className="live-notice-icon">⚠</div>
        <div className="live-notice-text">
          <strong>Data is sourced live from NASA & NOAA</strong> — Values may be unavailable during
          periods of API downtime.
        </div>
      </div>
    </div>
  );
}
