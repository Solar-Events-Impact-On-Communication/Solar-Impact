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

import OpenAI from 'openai';

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
       05.6 AI — Tell Me More
       05.7 AI — Birthday Solar Events
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
  const allowed = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowed.length) return undefined;

  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true);

      if (allowed.includes(origin)) return cb(null, true);

      const isVercelPreview =
        /^https:\/\/solar-events(-[a-z0-9-]+)?-okeefevs-projects\.vercel\.app$/i.test(origin);

      if (isVercelPreview) return cb(null, true);

      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
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
   05.6 AI — Tell Me More
   ============================================================================ */

/* Simple in-memory rate limiter: max N requests per window per IP */
function createRateLimiter(maxRequests, windowMs) {
  const store = new Map();
  return function isRateLimited(ip) {
    const now = Date.now();
    const entry = store.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    store.set(ip, entry);
    return entry.count > maxRequests;
  };
}

const tellMeMoreLimiter = createRateLimiter(5, 60_000); // 5 req/min per IP
const birthdayLimiter = createRateLimiter(3, 60_000); // 3 req/min per IP

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post(
  '/api/ai/tell-me-more',
  asyncRoute(async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (tellMeMoreLimiter(ip)) {
      return res
        .status(429)
        .json({ error: 'rate_limit', message: 'Too many requests. Please try again shortly.' });
    }

    const { title, date, type, location, summary, impact } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Missing event title.' });

    const prompt = `You are a scientific historian specializing in solar events and their documented impact on human communications.

You have been provided with a database record for the following historical solar event. Expand on this record with additional historical context, scientific detail about the solar phenomenon, and specific documented examples of how it disrupted or affected communications technology of that era. Be accurate and measured — do not invent specific facts. If certain details are uncertain, note that. Write in 3–4 clear paragraphs.

Event details:
- Title: ${title}
- Date: ${date || 'Unknown'}
- Type: ${type || 'Unknown'}
- Location: ${location || 'Unknown'}
- Summary: ${summary || 'Not provided'}
- Impact on Communications: ${impact || 'Not provided'}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 700,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = completion.choices?.[0]?.message?.content?.trim() || '';
      return res.json({ result: text });
    } catch (err) {
      console.error('[AI] tell-me-more error:', err);
      if (err?.status === 429) {
        return res
          .status(429)
          .json({ error: 'rate_limit', message: 'AI service is busy. Please try again later.' });
      }
      return res
        .status(500)
        .json({ error: 'ai_error', message: 'AI request failed. Please try again later.' });
    }
  })
);

/* ============================================================================
   05.7 AI — Birthday Solar Events
   ============================================================================ */

app.post(
  '/api/ai/birthday-events',
  asyncRoute(async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (birthdayLimiter(ip)) {
      return res
        .status(429)
        .json({ error: 'rate_limit', message: 'Too many requests. Please try again shortly.' });
    }

    const { month, day } = req.body || {};
    if (!month || !day) return res.status(400).json({ error: 'Missing month or day.' });

    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (
      isNaN(monthNum) ||
      isNaN(dayNum) ||
      monthNum < 1 ||
      monthNum > 12 ||
      dayNum < 1 ||
      dayNum > 31
    ) {
      return res.status(400).json({ error: 'Invalid month or day.' });
    }

    const monthNames = [
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
    const monthName = monthNames[monthNum - 1];

    const prompt = `You are a scientific historian specializing in solar events and their documented impact on human communications.

List up to 10 of the most historically significant solar events (solar flares, geomagnetic storms, coronal mass ejections, notable aurora sightings, sunspot observations, etc.) that occurred on ${monthName} ${dayNum} throughout recorded history.

Rules:
- Only include events you are highly confident about. Do not fabricate or guess specific dates.
- If fewer than 10 well-documented events exist for this exact date, list only those you are confident about.
- If no documented solar events are found for this date, return an empty events array.
- For each event, include the specific year, a clear event title, the event type, and a 2–3 sentence description focused on how it impacted communications technology of that time period.

Respond ONLY with valid JSON in this exact format, no other text:
{
  "events": [
    {
      "year": 1859,
      "title": "Event title",
      "type": "Solar Flare / Geomagnetic Storm / etc",
      "description": "2–3 sentence description of the event and its impact on communications."
    }
  ]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = completion.choices?.[0]?.message?.content?.trim() || '';
      // Strip markdown code fences if present
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error('[AI] birthday-events JSON parse error. Raw:', raw);
        return res
          .status(500)
          .json({
            error: 'ai_parse_error',
            message: 'AI returned an unexpected response. Please try again.',
          });
      }

      return res.json({ events: parsed.events || [] });
    } catch (err) {
      console.error('[AI] birthday-events error:', err);
      if (err?.status === 429) {
        return res
          .status(429)
          .json({ error: 'rate_limit', message: 'AI service is busy. Please try again later.' });
      }
      return res
        .status(500)
        .json({ error: 'ai_error', message: 'AI request failed. Please try again later.' });
    }
  })
);

/* ============================================================================
   05.8 AI — Year Solar Events
   ============================================================================ */

const yearEventsLimiter = createRateLimiter(3, 60_000); // 3 req/min per IP

app.post(
  '/api/ai/year-events',
  asyncRoute(async (req, res) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (yearEventsLimiter(ip)) {
      return res
        .status(429)
        .json({ error: 'rate_limit', message: 'Too many requests. Please try again shortly.' });
    }

    const { year } = req.body || {};
    const yearNum = parseInt(year, 10);
    if (!year || isNaN(yearNum) || yearNum < 1 || yearNum > new Date().getFullYear()) {
      return res.status(400).json({ error: 'Invalid year.' });
    }

    const prompt = `You are a scientific historian specializing in solar events and their documented impact on human communications.

List up to 10 of the most historically significant solar events (solar flares, geomagnetic storms, coronal mass ejections, notable aurora sightings, sunspot activity, etc.) that occurred during the year ${yearNum}.

Rules:
- Only include events that are well-documented in scientific literature, historical records, or verified scientific databases (such as NOAA, NASA, or peer-reviewed publications). Do not fabricate or estimate events.
- If fewer than 10 well-documented solar events exist for this year, list only those you are confident about.
- If no documented solar events are found for this year, return an empty events array.
- For each event, include the specific date (as precise as the record allows), a clear event title, the event type, and a 2–3 sentence description focused on how it impacted communications technology of that time period.
- Order events chronologically within the year.

Respond ONLY with valid JSON in this exact format, no other text:
{
  "events": [
    {
      "date": "March 13",
      "title": "Event title",
      "type": "Solar Flare / Geomagnetic Storm / etc",
      "description": "2–3 sentence description of the event and its impact on communications."
    }
  ]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = completion.choices?.[0]?.message?.content?.trim() || '';
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error('[AI] year-events JSON parse error. Raw:', raw);
        return res
          .status(500)
          .json({
            error: 'ai_parse_error',
            message: 'AI returned an unexpected response. Please try again.',
          });
      }

      return res.json({ events: parsed.events || [] });
    } catch (err) {
      console.error('[AI] year-events error:', err);
      if (err?.status === 429) {
        return res
          .status(429)
          .json({ error: 'rate_limit', message: 'AI service is busy. Please try again later.' });
      }
      return res
        .status(500)
        .json({ error: 'ai_error', message: 'AI request failed. Please try again later.' });
    }
  })
);

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
