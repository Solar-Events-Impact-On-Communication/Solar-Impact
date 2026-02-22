/* =========================================================
   Solar Events — BackgroundVideos.jsx
   Ambient background video overlays — Sun & Earth
   Sits above the background image, below all UI content.
   Position/size/opacity configured per route.
   ========================================================= */

import './BackgroundVideos.css';
import { useLocation } from 'react-router-dom';

const SUN_URL =
  'https://newspaper-articles.nyc3.cdn.digitaloceanspaces.com/Background/Videos/Sun.webm';
const EARTH_URL =
  'https://newspaper-articles.nyc3.cdn.digitaloceanspaces.com/Background/Videos/Earth.webm';

/*
  Per-page config — tweak position, size, and opacity here.
  Position values are CSS (%, vh, vw etc.).
  Omit or set show: false to hide a video on a given page.
  Admin page is not listed so nothing renders there.
*/
const PAGE_CONFIG = {
  '/': {
    sun: {
      show: true,
      style: {
        top: '20px',
        right: '-15%',
        width: '55vw',
        opacity: 0.5,
        transform: 'rotate(180deg)',
      },
    },
    earth: { show: false },
  },
  '/live': {
    sun: { show: true, style: { top: '20px', right: '-10%', width: '28vw', opacity: 0.6 } },
    earth: { show: true, style: { bottom: '20px', left: '-70px', width: '20vw', opacity: 0.6 } },
  },
  '/birthday': {
    sun: { show: true, style: { top: '20px', right: '-10%', width: '28vw', opacity: 0.6 } },
    earth: { show: true, style: { bottom: '8%', left: '2%', width: '20vw', opacity: 0.6 } },
  },
};

export default function SpaceVideos() {
  const { pathname } = useLocation();
  const config = PAGE_CONFIG[pathname];

  // No config = admin or unknown route — render nothing
  if (!config) return null;

  return (
    <div className="space-videos" aria-hidden="true">
      {config.sun?.show && (
        <video
          className="space-video space-video--sun"
          style={config.sun.style}
          src={SUN_URL}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      {config.earth?.show && (
        <video
          className="space-video space-video--earth"
          style={config.earth.style}
          src={EARTH_URL}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
    </div>
  );
}
