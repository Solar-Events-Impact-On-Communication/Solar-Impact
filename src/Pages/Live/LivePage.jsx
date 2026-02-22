/* =========================================================
   Solar Events — LivePage.jsx
   Live Solar Data Dashboard
   ========================================================= */

import './LivePage.css';
import React, { useState } from 'react';

const LIVE_METRICS = [
  {
    id: 'flare',
    label: 'LATEST SOLAR FLARE',
    value: 'X1.2',
    sub: 'April 5, 2024',
    status: 'elevated',
    statusLabel: 'Elevated Activity',
    description:
      'Solar flares are rated A, B, C, M, or X — each letter is 10× stronger than the last. X is the most powerful class. Within each class, a number from 1–9 gives more detail (X2 is twice as strong as X1). Flares can disrupt radio communications, GPS, and power grids on Earth.',
  },
  {
    id: 'storm',
    label: 'GEOMAGNETIC STORM',
    value: 'G2',
    sub: 'Moderate',
    status: 'moderate',
    statusLabel: 'Moderate',
    description:
      "Geomagnetic storms are rated G1 through G5. G1 is minor, G5 is extreme. Higher ratings mean stronger disruptions to Earth's magnetic field, wider auroras, and greater risk to power grids, satellites, and navigation systems.",
  },
  {
    id: 'wind',
    label: 'SOLAR WIND SPEED',
    value: '532',
    sub: 'km/s',
    status: 'normal',
    statusLabel: 'Normal Range',
    description:
      "Solar wind speed is measured in km/s. Typical speeds range from 300–800 km/s. Below 400 is calm, 400–600 is normal, and above 600 is considered fast. Very high speeds can compress Earth's magnetic field and trigger geomagnetic storms.",
  },
  {
    id: 'sunspot',
    label: 'SUNSPOT NUMBER',
    value: '79',
    sub: 'Daily count',
    status: 'normal',
    statusLabel: 'Solar Maximum Cycle',
    description:
      'Sunspot counts vary from 0 (solar minimum, quiet Sun) to over 200 (solar maximum, very active Sun). The Sun follows an 11-year cycle. Higher counts mean more solar flares and storms are likely. Solar minimum and maximum each last a few years.',
  },
];

export default function LivePage() {
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div className="live-page">
      <div className="live-page-header">
        <div className="live-page-label">
          <span className="live-indicator" />
          LIVE DATA FEED
        </div>
        <h1 className="live-page-title">Solar Activity Monitor</h1>
        <p className="live-page-desc">
          Real-time solar weather data. Values shown are static placeholders — live integration with
          NASA/NOAA APIs is coming soon.
        </p>
        <div className="live-page-rule" />
      </div>

      <div className="live-grid">
        {LIVE_METRICS.map((metric) => (
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
                <span className={`live-card-status live-card-status--${metric.status}`} />
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
          <strong>Placeholder Data</strong> — These values are static for demonstration purposes.
          Live data will be sourced directly from NASA Space Weather APIs and NOAA's Space Weather
          Prediction Center once integration is complete.
        </div>
      </div>
    </div>
  );
}
