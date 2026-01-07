//
// database.js — Public read-only API (events, media, about, team)
//

import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

/* ============================================================================
   TABLE OF CONTENTS
   01. Environment + Paths
   02. Helpers (CA cert, CORS)
   03. Express App + Middleware
   04. MySQL Connection Pool (public read-only)
   05. Routes
       05.1 Health
       05.2 Events
       05.3 Event Media
       05.4 About Page
       05.5 Team Members
   06. Server Bootstrap
   ============================================================================ */

/* ============================================================================
   01. Environment + Paths
   ============================================================================ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ============================================================================
   02. Helpers (CA cert, CORS)
   ============================================================================ */

function getCaCert() {
  const fromEnv = process.env.DB_CA_CERT;

  // If provided via .env, convert \n into real newlines
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\\n/g, '\n');
  }

  // Fallback for local/dev environments
  const caCertPath = path.join(__dirname, 'ca-certificate.crt');
  return fs.readFileSync(caCertPath, 'utf8');
}

function buildCorsOptions() {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) return undefined; // allow all
  return { origin, credentials: true };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * 500 response helper
 */
function sendServerError(res, message) {
  return res.status(500).json({ error: message });
}

/* ============================================================================
   03. Express App + Middleware
   ============================================================================ */

const app = express();
app.use(cors(buildCorsOptions()));
app.use(express.json());

/* ============================================================================
   04. MySQL Connection Pool (public read-only)
   ============================================================================ */

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 25060,
  user: process.env.DB_USER_PUBLIC, // solar_public
  password: process.env.DB_PASSWORD_PUBLIC,
  database: process.env.DB_NAME,
  ssl: {
    ca: getCaCert(),
    rejectUnauthorized: true,
  },
  connectionLimit: 10,
});

/* ============================================================================
   05. Routes
   ============================================================================ */

/* 05.1 Health -------------------------------------------------------------- */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Solar Events API is running' });
});

/* 05.2 Events -------------------------------------------------------------- */

app.get(
  '/api/events',
  asyncRoute(async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
           id,
           event_date,
           event_type,
           location,
           title,
           short_description,
           summary,
           impact_on_communication
         FROM solar_events
         ORDER BY event_date ASC`
      );
      res.json(rows);
    } catch (err) {
      console.error('[PUBLIC] Error fetching events from DB:', err);
      return sendServerError(res, 'Failed to fetch events');
    }
  })
);

/* 05.3 Event Media --------------------------------------------------------- */

app.get(
  '/api/events/:id/media',
  asyncRoute(async (req, res) => {
    try {
      const eventId = req.params.id;

      const [rows] = await pool.query(
        `SELECT 
           id,
           event_id,
           url,
           caption
         FROM media_assets
         WHERE event_id = ?
         ORDER BY id ASC`,
        [eventId]
      );

      res.json(rows);
    } catch (err) {
      console.error('[PUBLIC] Error fetching media assets:', err);
      return sendServerError(res, 'Failed to fetch media assets');
    }
  })
);

/* 05.4 About Page ---------------------------------------------------------- */

app.get(
  '/api/about',
  asyncRoute(async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT
           id,
           display_order,
           title,
           text
         FROM about_sections
         ORDER BY display_order ASC, id ASC`
      );
      res.json(rows);
    } catch (err) {
      console.error('[PUBLIC] Error fetching about_sections:', err);
      return sendServerError(res, 'Failed to fetch about page content');
    }
  })
);

/* 05.5 Team Members -------------------------------------------------------- */

app.get(
  '/api/team',
  asyncRoute(async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT
           id,
           name,
           role,
           image_url
         FROM team_members
         ORDER BY id ASC`
      );
      res.json(rows);
    } catch (err) {
      console.error('[PUBLIC] Error fetching team_members:', err);
      return sendServerError(res, 'Failed to fetch team members');
    }
  })
);

/* ============================================================================
   Global Error Handler (keeps behavior safe + predictable)
   NOTE: This is a backstop for unexpected failures.
   ============================================================================ */

app.use((err, req, res, next) => {
  console.error('[PUBLIC] Unhandled error:', err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Server error' });
});

/* ============================================================================
   06. Server Bootstrap
   ============================================================================ */

const PORT = Number(process.env.PUBLIC_PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Public API server listening on port ${PORT}`);
});
