// database.js — Public read-only API (events, media, about, team)

import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Prefer DB_CA_CERT from env (best for cloud/server).
 * Fall back to local ca-certificate.crt for dev.
 */
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

/**
 * CORS:
 * - Default: allow all (matches your current behavior).
 * - Optional: set CORS_ORIGIN to lock down.
 */
function buildCorsOptions() {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) return undefined; // allow all
  return { origin, credentials: true };
}

const app = express();
app.use(cors(buildCorsOptions()));
app.use(express.json());

// Connection pool with proper SSL using the CA
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Solar Events API is running' });
});

// Events route
app.get('/api/events', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get all media assets linked to a specific event
app.get('/api/events/:id/media', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch media assets' });
  }
});

// About page content
app.get('/api/about', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch about page content' });
  }
});

// Team members
app.get('/api/team', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

const PORT = Number(process.env.PUBLIC_PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Public API server listening on port ${PORT}`);
});
