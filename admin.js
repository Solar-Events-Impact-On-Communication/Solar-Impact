// admin.js — Admin Authentication + Event/Media/About/Team Management API

import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const BCRYPT_ROUNDS = 12;

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
 * - Optional: set CORS_ORIGIN to lock down (e.g., https://your-vercel-app.vercel.app)
 */
function buildCorsOptions() {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) return undefined; // allow all
  return { origin, credentials: true };
}

/* ---------------------- Upload helpers (DigitalOcean Spaces) ---------------------- */

function stripTrailingSlashes(s) {
  return String(s || '').replace(/\/+$/, '');
}

function buildSpacesClient() {
  const { SPACES_REGION, SPACES_ENDPOINT, SPACES_KEY, SPACES_SECRET } = process.env;

  if (!SPACES_REGION || !SPACES_ENDPOINT || !SPACES_KEY || !SPACES_SECRET) {
    throw new Error(
      'Missing Spaces env vars. Required: SPACES_REGION, SPACES_ENDPOINT, SPACES_KEY, SPACES_SECRET'
    );
  }

  return new S3Client({
    region: SPACES_REGION,
    endpoint: SPACES_ENDPOINT,
    credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
  });
}

function requireSpacesBucketAndPublicBase() {
  const bucket = process.env.SPACES_BUCKET;
  const publicBase = process.env.SPACES_ORIGIN_URL; // e.g. https://<bucket>.<region>.cdn.digitaloceanspaces.com

  if (!bucket || !publicBase) {
    throw new Error('Missing SPACES_BUCKET and/or SPACES_ORIGIN_URL in env.');
  }

  return { bucket, publicBase: stripTrailingSlashes(publicBase) };
}

function guessImageExt(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  return 'jpg';
}

function randomHex(len = 10) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Multer for multipart uploads (event media)
 * - memory storage is fine for <= ~10MB
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
});

const app = express();
app.use(cors(buildCorsOptions()));

// IMPORTANT: allow base64 JSON payloads for team photo uploads
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Admin connection pool — uses limited admin user from the SAME .env
const adminPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 25060,
  user: process.env.DB_USER_ADMIN, // solar_admin_app
  password: process.env.DB_PASSWORD_ADMIN,
  database: process.env.DB_NAME, // e.g. defaultdb
  ssl: {
    ca: getCaCert(),
    rejectUnauthorized: true,
  },
  connectionLimit: 5,
});

// ---------------------- Basic admin routes ----------------------

// Health check
app.get('/api/admin/health', (req, res) => {
  res.json({ status: 'ok', message: 'Admin Auth API running' });
});

/**
 * POST /api/admin/login
 * Body: { username, password, securityAnswer? }
 * Checks bcrypt hash stored in admin_users.password_hash
 */
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password, securityAnswer } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // 1) Look up user + optional security question
    const [rows] = await adminPool.query(
      `SELECT 
         u.id,
         u.username,
         u.password_hash,
         u.is_protected,
         u.security_question_id,
         u.security_answer_hash,
         q.question_text
       FROM admin_users u
       LEFT JOIN security_questions q
         ON u.security_question_id = q.id
       WHERE u.username = ?
       LIMIT 1`,
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];

    // 2) Check password first
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // 3) If user is_protected = 0 AND has a security question, enforce it
    const requiresSecurity = user.is_protected === 0 && user.security_question_id != null;

    if (requiresSecurity) {
      // If no answer provided yet, tell the frontend to ask the question
      if (!securityAnswer) {
        return res.status(400).json({
          error: 'Security answer required.',
          requiresSecurityAnswer: true,
          securityQuestionId: user.security_question_id,
          securityQuestionText: user.question_text,
        });
      }

      // If answer provided, compare with stored hash
      const answerOk = await bcrypt.compare(securityAnswer, user.security_answer_hash || '');

      if (!answerOk) {
        return res.status(401).json({ error: 'Incorrect security answer.' });
      }
    }

    // 4) All checks passed → success
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        is_protected: !!user.is_protected,
        securityQuestionId: user.security_question_id || null,
        requiresSecurityAnswer: false,
      },
    });
  } catch (err) {
    console.error('[ADMIN] Login error:', err);
    res.status(500).json({ error: 'Login failed due to a server error.' });
  }
});

/**
 * GET /api/admin/security-questions
 */
app.get('/api/admin/security-questions', async (req, res) => {
  try {
    const [rows] = await adminPool.query(
      `SELECT id, question_text
         FROM security_questions
         ORDER BY id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[ADMIN] Error fetching security questions:', err);
    res.status(500).json({ error: 'Failed to fetch security questions' });
  }
});

/**
 * GET /api/admin/users
 * List all admin accounts
 */
app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await adminPool.query(
      `SELECT 
         id,
         username,
         is_protected,
         security_question_id
       FROM admin_users
       ORDER BY username ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error('[ADMIN] Error fetching admin users:', err);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// Create a new admin account
app.post('/api/admin/users', async (req, res) => {
  try {
    const { username, password, securityQuestionId, securityAnswer } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);

    let answerHash = null;
    if (securityAnswer && securityAnswer.trim()) {
      answerHash = await bcrypt.hash(securityAnswer.trim(), BCRYPT_ROUNDS);
    }

    const [result] = await adminPool.query(
      `INSERT INTO admin_users
         (username, password_hash, is_protected, security_question_id, security_answer_hash)
       VALUES (?, ?, 0, ?, ?)`,
      [username.trim(), passwordHash, securityQuestionId || null, answerHash]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[ADMIN] Error creating admin user:', err);
    res.status(500).json({ error: 'Failed to create admin user.' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update an existing admin user (protected accounts cannot be edited)
 */
app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { password, securityQuestionId, securityAnswer } = req.body || {};

    // 1) Look up the account
    const [existingRows] = await adminPool.query(
      `SELECT is_protected FROM admin_users WHERE id = ?`,
      [userId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    // 2) Block edits to protected accounts
    if (existingRows[0].is_protected === 1) {
      return res.status(403).json({
        error: 'This account is protected and cannot be edited.',
      });
    }

    // 3) Build dynamic UPDATE statement
    const fields = [];
    const values = [];

    if (password && password.trim()) {
      const passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);
      fields.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (typeof securityQuestionId !== 'undefined') {
      fields.push('security_question_id = ?');
      values.push(securityQuestionId || null);
    }

    if (securityAnswer && securityAnswer.trim()) {
      const answerHash = await bcrypt.hash(securityAnswer.trim(), BCRYPT_ROUNDS);
      fields.push('security_answer_hash = ?');
      values.push(answerHash);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No changes provided to update this user.' });
    }

    values.push(userId);

    const [result] = await adminPool.query(
      `UPDATE admin_users
         SET ${fields.join(', ')}
       WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error updating admin user:', err);
    res.status(500).json({ error: 'Failed to update admin user.' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete an admin user (protected accounts cannot be deleted)
 */
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const [existingRows] = await adminPool.query(
      `SELECT is_protected FROM admin_users WHERE id = ?`,
      [userId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    if (existingRows[0].is_protected === 1) {
      return res.status(403).json({
        error: 'This account is protected and cannot be deleted.',
      });
    }

    const [result] = await adminPool.query(`DELETE FROM admin_users WHERE id = ?`, [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error deleting admin user:', err);
    res.status(500).json({ error: 'Failed to delete admin user.' });
  }
});

/**
 * PUT /api/admin/profile
 * Update the *current* admin's password and/or security question/answer.
 * Expects: { userId, password?, securityQuestionId?, securityAnswer? }
 */
app.put('/api/admin/profile', async (req, res) => {
  try {
    const { userId, password, securityQuestionId, securityAnswer } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const [existingRows] = await adminPool.query(
      `SELECT is_protected FROM admin_users WHERE id = ?`,
      [userId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    const fields = [];
    const values = [];

    if (password && password.trim()) {
      const passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);
      fields.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (typeof securityQuestionId !== 'undefined') {
      fields.push('security_question_id = ?');
      values.push(securityQuestionId || null);
    }

    if (securityAnswer && securityAnswer.trim()) {
      const answerHash = await bcrypt.hash(securityAnswer.trim(), BCRYPT_ROUNDS);
      fields.push('security_answer_hash = ?');
      values.push(answerHash);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No profile changes provided.' });
    }

    values.push(userId);

    const [result] = await adminPool.query(
      `UPDATE admin_users
         SET ${fields.join(', ')}
       WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin user not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ---------------------- Event CRUD (solar_events) ----------------------

app.get('/api/admin/events', async (req, res) => {
  try {
    const [rows] = await adminPool.query(
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
    console.error('[ADMIN] Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/api/admin/events', async (req, res) => {
  try {
    const {
      event_date,
      event_type,
      location,
      title,
      short_description,
      summary,
      impact_on_communication,
    } = req.body || {};

    if (!event_date || !title) {
      return res.status(400).json({ error: 'event_date and title are required.' });
    }

    const [result] = await adminPool.query(
      `INSERT INTO solar_events
         (event_date, event_type, location, title, short_description, summary, impact_on_communication)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event_date,
        event_type || null,
        location || null,
        title,
        short_description || null,
        summary || null,
        impact_on_communication || null,
      ]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[ADMIN] Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/admin/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    const {
      event_date,
      event_type,
      location,
      title,
      short_description,
      summary,
      impact_on_communication,
    } = req.body || {};

    if (!event_date || !title) {
      return res.status(400).json({ error: 'event_date and title are required.' });
    }

    const [result] = await adminPool.query(
      `UPDATE solar_events
         SET event_date = ?,
             event_type = ?,
             location = ?,
             title = ?,
             short_description = ?,
             summary = ?,
             impact_on_communication = ?
       WHERE id = ?`,
      [
        event_date,
        event_type || null,
        location || null,
        title,
        short_description || null,
        summary || null,
        impact_on_communication || null,
        eventId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error updating event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/admin/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;

    const [result] = await adminPool.query(`DELETE FROM solar_events WHERE id = ?`, [eventId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ---------------------- Media CRUD (media_assets) ----------------------

app.get('/api/admin/events/:eventId/media', async (req, res) => {
  try {
    const eventId = req.params.eventId;

    const [rows] = await adminPool.query(
      `SELECT id, event_id, url, caption
         FROM media_assets
         WHERE event_id = ?
         ORDER BY id ASC`,
      [eventId]
    );

    res.json(rows);
  } catch (err) {
    console.error('[ADMIN] Error fetching media assets:', err);
    res.status(500).json({ error: 'Failed to fetch media assets' });
  }
});

/**
 * POST /api/admin/events/:eventId/media
 * Supports BOTH:
 *  1) JSON body: { url, caption }  (old behavior)
 *  2) multipart/form-data: file=<image>, caption=<optional>  (NEW upload behavior)
 */
app.post('/api/admin/events/:eventId/media', upload.single('file'), async (req, res) => {
  try {
    const eventId = req.params.eventId;

    // NEW: multipart upload path
    if (req.file) {
      const spaces = buildSpacesClient();
      const { bucket, publicBase } = requireSpacesBucketAndPublicBase();

      const caption = (req.body?.caption || '').trim() || null;
      const mime = req.file.mimetype || 'image/jpeg';
      const ext = guessImageExt(mime);

      const key = `event-media/${eventId}/${Date.now()}-${randomHex(12)}.${ext}`;

      await spaces.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: mime,
          ACL: 'public-read',
        })
      );

      const url = `${publicBase}/${key}`;

      const [result] = await adminPool.query(
        `INSERT INTO media_assets (event_id, url, caption)
         VALUES (?, ?, ?)`,
        [eventId, url, caption]
      );

      return res.status(201).json({ success: true, id: result.insertId, url });
    }

    // Old JSON url path
    const { url, caption } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: 'url is required.' });
    }

    const [result] = await adminPool.query(
      `INSERT INTO media_assets (event_id, url, caption)
       VALUES (?, ?, ?)`,
      [eventId, url, caption || null]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[ADMIN] Error creating media asset:', err);
    res.status(500).json({ error: 'Failed to create media asset' });
  }
});

app.put('/api/admin/media/:id', async (req, res) => {
  try {
    const mediaId = req.params.id;
    const { url, caption } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'url is required.' });
    }

    const [result] = await adminPool.query(
      `UPDATE media_assets
         SET url = ?,
             caption = ?
       WHERE id = ?`,
      [url, caption || null, mediaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Media asset not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error updating media asset:', err);
    res.status(500).json({ error: 'Failed to update media asset' });
  }
});

app.delete('/api/admin/media/:id', async (req, res) => {
  try {
    const mediaId = req.params.id;

    const [result] = await adminPool.query(`DELETE FROM media_assets WHERE id = ?`, [mediaId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Media asset not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error deleting media asset:', err);
    res.status(500).json({ error: 'Failed to delete media asset' });
  }
});

// ---------------------- About Page CRUD (about_sections) ---------------

app.get('/api/admin/about', async (req, res) => {
  try {
    const [rows] = await adminPool.query(
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
    console.error('[ADMIN] Error fetching about_sections:', err);
    res.status(500).json({ error: 'Failed to fetch about page content' });
  }
});

app.post('/api/admin/about', async (req, res) => {
  try {
    const { display_order, title, text } = req.body || {};

    if (display_order == null || !title || !text) {
      return res.status(400).json({
        error: 'display_order, title, and text are required.',
      });
    }

    const [result] = await adminPool.query(
      `INSERT INTO about_sections (display_order, title, text)
       VALUES (?, ?, ?)`,
      [display_order, title, text]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[ADMIN] Error creating about section:', err);
    res.status(500).json({ error: 'Failed to create about section' });
  }
});

app.put('/api/admin/about/:id', async (req, res) => {
  try {
    const sectionId = req.params.id;
    const { display_order, title, text } = req.body || {};

    if (display_order == null || !title || !text) {
      return res.status(400).json({
        error: 'display_order, title, and text are required.',
      });
    }

    const [result] = await adminPool.query(
      `UPDATE about_sections
         SET display_order = ?,
             title = ?,
             text = ?
       WHERE id = ?`,
      [display_order, title, text, sectionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'About section not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error updating about section:', err);
    res.status(500).json({ error: 'Failed to update about section' });
  }
});

app.delete('/api/admin/about/:id', async (req, res) => {
  try {
    const sectionId = req.params.id;

    const [result] = await adminPool.query(`DELETE FROM about_sections WHERE id = ?`, [sectionId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'About section not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error deleting about section:', err);
    res.status(500).json({ error: 'Failed to delete about section' });
  }
});

// ---------------------- Team Members CRUD (team_members) ---------------

app.get('/api/admin/team', async (req, res) => {
  try {
    const [rows] = await adminPool.query(
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
    console.error('[ADMIN] Error fetching team_members:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

app.post('/api/admin/team', async (req, res) => {
  try {
    const { name, role, image_url } = req.body || {};

    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required.' });
    }

    const [result] = await adminPool.query(
      `INSERT INTO team_members (name, role, image_url)
       VALUES (?, ?, ?)`,
      [name, role, image_url || null]
    );

    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[ADMIN] Error creating team member:', err);
    res.status(500).json({ error: 'Failed to create team member' });
  }
});

app.put('/api/admin/team/:id', async (req, res) => {
  try {
    const memberId = req.params.id;
    const { name, role, image_url } = req.body || {};

    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required.' });
    }

    const [result] = await adminPool.query(
      `UPDATE team_members
         SET name = ?,
             role = ?,
             image_url = ?
       WHERE id = ?`,
      [name, role, image_url || null, memberId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Team member not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error updating team member:', err);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

app.delete('/api/admin/team/:id', async (req, res) => {
  try {
    const memberId = req.params.id;

    const [result] = await adminPool.query(`DELETE FROM team_members WHERE id = ?`, [memberId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Team member not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error deleting team member:', err);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

/**
 * POST /api/admin/team/:id/photo
 * Body: { imageData: "data:image/png;base64,..." }
 * Uploads to Spaces and updates team_members.image_url
 */
app.post('/api/admin/team/:id/photo', async (req, res) => {
  try {
    const memberId = req.params.id;
    const { imageData } = req.body || {};

    if (!imageData) {
      return res.status(400).json({ error: 'imageData is required.' });
    }

    const match = String(imageData).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid imageData format.' });
    }

    const mime = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');

    const spaces = buildSpacesClient();
    const { bucket, publicBase } = requireSpacesBucketAndPublicBase();

    const ext = guessImageExt(mime);
    const key = `team/member-${memberId}-${Date.now()}-${randomHex(10)}.${ext}`;

    await spaces.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
        ACL: 'public-read',
      })
    );

    const url = `${publicBase}/${key}`;

    const [result] = await adminPool.query(`UPDATE team_members SET image_url = ? WHERE id = ?`, [
      url,
      memberId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Team member not found.' });
    }

    res.json({ success: true, image_url: url });
  } catch (err) {
    console.error('[ADMIN] Error uploading team photo:', err);
    res.status(500).json({ error: 'Failed to upload team photo.' });
  }
});

/**
 * DELETE /api/admin/team/:id/photo
 * Clears team_members.image_url
 * (Optional) tries to delete previous object from Spaces if it matches SPACES_ORIGIN_URL
 */
app.delete('/api/admin/team/:id/photo', async (req, res) => {
  try {
    const memberId = req.params.id;

    // fetch current url so we can attempt delete
    const [rows] = await adminPool.query(`SELECT image_url FROM team_members WHERE id = ?`, [
      memberId,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Team member not found.' });
    }

    const currentUrl = rows[0].image_url || null;

    // clear DB first (so UI reflects removal even if Spaces delete fails)
    await adminPool.query(`UPDATE team_members SET image_url = NULL WHERE id = ?`, [memberId]);

    // attempt to delete object in Spaces only if we can infer a key
    try {
      if (currentUrl) {
        const { bucket, publicBase } = requireSpacesBucketAndPublicBase();
        const base = stripTrailingSlashes(publicBase);

        if (String(currentUrl).startsWith(base + '/')) {
          const key = String(currentUrl).slice((base + '/').length);
          const spaces = buildSpacesClient();
          await spaces.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        }
      }
    } catch (deleteErr) {
      console.warn(
        '[ADMIN] Warning: failed to delete old Spaces object:',
        deleteErr?.message || deleteErr
      );
      // not fatal
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] Error removing team photo:', err);
    res.status(500).json({ error: 'Failed to remove team photo.' });
  }
});

// -----------------------------------------------------------------------

const PORT = Number(process.env.ADMIN_PORT) || 4001;
app.listen(PORT, () => {
  console.log(`Admin Auth + Admin API listening on port ${PORT}`);
});
