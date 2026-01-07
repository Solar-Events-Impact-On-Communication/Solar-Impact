//
// admin.js — Admin Authentication + Event/Media/About/Team Management API
//

// =========================================================
// TABLE OF CONTENTS
// 01) Imports + App Bootstrap
// 02) Config + Constants
// 03) Shared Helpers (CORS, CA cert, Spaces/S3 helpers)
// 04) Middleware
// 05) Database Pool (adminPool)
// 06) Route Registration
//    6.1 Health
//    6.2 Auth + Admin Users + Profile
//    6.3 Events (solar_events)
//    6.4 Media (media_assets)
//    6.5 About Page (about_sections)
//    6.6 Team Members (team_members + photo upload/removal)
// 07) Server Listen
// =========================================================

/* =========================================================
   01) Imports + App Bootstrap
   ========================================================= */

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

const app = express();

/* =========================================================
   02) Config + Constants
   ========================================================= */

const BCRYPT_ROUNDS = 12;

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   03) Shared Helpers
   ========================================================= */

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
  if (!origin) return undefined;
  return { origin, credentials: true };
}

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

// Consistent API responses (keeps your existing status codes/messages)
function sendBadRequest(res, error) {
  return res.status(400).json({ error });
}

function sendUnauthorized(res, error) {
  return res.status(401).json({ error });
}

function sendForbidden(res, error) {
  return res.status(403).json({ error });
}

function sendNotFound(res, error) {
  return res.status(404).json({ error });
}

function sendServerError(res, error, logLabel, err) {
  if (logLabel) console.error(logLabel, err);
  return res.status(500).json({ error });
}

/**
 * wrapper to remove repetitive try/catch blocks.
 */
function asyncRoute(fn) {
  return (req, res) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error('[ADMIN] Unhandled route error:', err);
      res.status(500).json({ error: 'Server error.' });
    });
}

/* =========================================================
   04) Middleware
   ========================================================= */

app.use(cors(buildCorsOptions()));

// allow base64 JSON payloads for team photo uploads
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

/**
 * Multer for multipart uploads (event media)
 * - memory storage is fine for <= ~10MB
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
});

/* =========================================================
   05) Database Pool (adminPool)
   ========================================================= */

const adminPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 25060,
  user: process.env.DB_USER_ADMIN,
  password: process.env.DB_PASSWORD_ADMIN,
  database: process.env.DB_NAME,
  ssl: {
    ca: getCaCert(),
    rejectUnauthorized: true,
  },
  connectionLimit: 5,
});

/* =========================================================
   06) Route Registration
   ========================================================= */

registerHealthRoutes(app);
registerAuthAndAdminUserRoutes(app, adminPool);
registerEventRoutes(app, adminPool);
registerMediaRoutes(app, adminPool, upload);
registerAboutRoutes(app, adminPool);
registerTeamRoutes(app, adminPool);

/* =========================================================
   6.1 Health
   ========================================================= */

function registerHealthRoutes(appInstance) {
  appInstance.get('/api/admin/health', (req, res) => {
    res.json({ status: 'ok', message: 'Admin Auth API running' });
  });
}

/* =========================================================
   6.2 Auth + Admin Users + Profile
   ========================================================= */

function registerAuthAndAdminUserRoutes(appInstance, pool) {
  appInstance.post(
    '/api/admin/login',
    asyncRoute(async (req, res) => {
      try {
        const { username, password, securityAnswer } = req.body || {};

        if (!username || !password) {
          return sendBadRequest(res, 'Username and password are required.');
        }

        const [rows] = await pool.query(
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
          return sendUnauthorized(res, 'Invalid username or password.');
        }

        const user = rows[0];

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
          return sendUnauthorized(res, 'Invalid username or password.');
        }

        const requiresSecurity = user.is_protected === 0 && user.security_question_id != null;

        if (requiresSecurity) {
          if (!securityAnswer) {
            return res.status(400).json({
              error: 'Security answer required.',
              requiresSecurityAnswer: true,
              securityQuestionId: user.security_question_id,
              securityQuestionText: user.question_text,
            });
          }

          const answerOk = await bcrypt.compare(securityAnswer, user.security_answer_hash || '');
          if (!answerOk) {
            return sendUnauthorized(res, 'Incorrect security answer.');
          }
        }

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
    })
  );

  appInstance.get(
    '/api/admin/security-questions',
    asyncRoute(async (req, res) => {
      try {
        const [rows] = await pool.query(
          `SELECT id, question_text
             FROM security_questions
             ORDER BY id ASC`
        );
        res.json(rows);
      } catch (err) {
        console.error('[ADMIN] Error fetching security questions:', err);
        res.status(500).json({ error: 'Failed to fetch security questions' });
      }
    })
  );

  appInstance.get(
    '/api/admin/users',
    asyncRoute(async (req, res) => {
      try {
        const [rows] = await pool.query(
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
    })
  );

  appInstance.post(
    '/api/admin/users',
    asyncRoute(async (req, res) => {
      try {
        const { username, password, securityQuestionId, securityAnswer } = req.body || {};

        if (!username || !password) {
          return sendBadRequest(res, 'Username and password are required.');
        }

        const passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);

        let answerHash = null;
        if (securityAnswer && securityAnswer.trim()) {
          answerHash = await bcrypt.hash(securityAnswer.trim(), BCRYPT_ROUNDS);
        }

        const [result] = await pool.query(
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
    })
  );

  appInstance.put(
    '/api/admin/users/:id',
    asyncRoute(async (req, res) => {
      try {
        const userId = req.params.id;
        const { password, securityQuestionId, securityAnswer } = req.body || {};

        const [existingRows] = await pool.query(
          `SELECT is_protected FROM admin_users WHERE id = ?`,
          [userId]
        );

        if (!existingRows.length) {
          return sendNotFound(res, 'Admin user not found.');
        }

        if (existingRows[0].is_protected === 1) {
          return sendForbidden(res, 'This account is protected and cannot be edited.');
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
          return sendBadRequest(res, 'No changes provided to update this user.');
        }

        values.push(userId);

        const [result] = await pool.query(
          `UPDATE admin_users
             SET ${fields.join(', ')}
           WHERE id = ?`,
          values
        );

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Admin user not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error updating admin user:', err);
        res.status(500).json({ error: 'Failed to update admin user.' });
      }
    })
  );

  appInstance.delete(
    '/api/admin/users/:id',
    asyncRoute(async (req, res) => {
      try {
        const userId = req.params.id;

        const [existingRows] = await pool.query(
          `SELECT is_protected FROM admin_users WHERE id = ?`,
          [userId]
        );

        if (!existingRows.length) {
          return sendNotFound(res, 'Admin user not found.');
        }

        if (existingRows[0].is_protected === 1) {
          return sendForbidden(res, 'This account is protected and cannot be deleted.');
        }

        const [result] = await pool.query(`DELETE FROM admin_users WHERE id = ?`, [userId]);

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Admin user not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error deleting admin user:', err);
        res.status(500).json({ error: 'Failed to delete admin user.' });
      }
    })
  );

  appInstance.put(
    '/api/admin/profile',
    asyncRoute(async (req, res) => {
      try {
        const { userId, password, securityQuestionId, securityAnswer } = req.body || {};

        if (!userId) {
          return sendBadRequest(res, 'userId is required.');
        }

        const [existingRows] = await pool.query(
          `SELECT is_protected FROM admin_users WHERE id = ?`,
          [userId]
        );

        if (!existingRows.length) {
          return sendNotFound(res, 'Admin user not found.');
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
          return sendBadRequest(res, 'No profile changes provided.');
        }

        values.push(userId);

        const [result] = await pool.query(
          `UPDATE admin_users
             SET ${fields.join(', ')}
           WHERE id = ?`,
          values
        );

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Admin user not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error updating profile:', err);
        res.status(500).json({ error: 'Failed to update profile.' });
      }
    })
  );
}

/* =========================================================
   6.3 Events (solar_events)
   ========================================================= */

function registerEventRoutes(appInstance, pool) {
  appInstance.get(
    '/api/admin/events',
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
        console.error('[ADMIN] Error fetching events:', err);
        res.status(500).json({ error: 'Failed to fetch events' });
      }
    })
  );

  appInstance.post(
    '/api/admin/events',
    asyncRoute(async (req, res) => {
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
          return sendBadRequest(res, 'event_date and title are required.');
        }

        const [result] = await pool.query(
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
    })
  );

  appInstance.put(
    '/api/admin/events/:id',
    asyncRoute(async (req, res) => {
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
          return sendBadRequest(res, 'event_date and title are required.');
        }

        const [result] = await pool.query(
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
          return sendNotFound(res, 'Event not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error updating event:', err);
        res.status(500).json({ error: 'Failed to update event' });
      }
    })
  );

  appInstance.delete(
    '/api/admin/events/:id',
    asyncRoute(async (req, res) => {
      try {
        const eventId = req.params.id;

        const [result] = await pool.query(`DELETE FROM solar_events WHERE id = ?`, [eventId]);

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Event not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error deleting event:', err);
        res.status(500).json({ error: 'Failed to delete event' });
      }
    })
  );
}

/* =========================================================
   6.4 Media (media_assets)
   ========================================================= */

function registerMediaRoutes(appInstance, pool, uploadInstance) {
  appInstance.get(
    '/api/admin/events/:eventId/media',
    asyncRoute(async (req, res) => {
      try {
        const eventId = req.params.eventId;

        const [rows] = await pool.query(
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
    })
  );

  appInstance.post(
    '/api/admin/events/:eventId/media',
    uploadInstance.single('file'),
    asyncRoute(async (req, res) => {
      try {
        const eventId = req.params.eventId;

        // multipart upload path
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

          const [result] = await pool.query(
            `INSERT INTO media_assets (event_id, url, caption)
             VALUES (?, ?, ?)`,
            [eventId, url, caption]
          );

          return res.status(201).json({ success: true, id: result.insertId, url });
        }

        // JSON { url, caption } path
        const { url, caption } = req.body || {};
        if (!url) {
          return sendBadRequest(res, 'url is required.');
        }

        const [result] = await pool.query(
          `INSERT INTO media_assets (event_id, url, caption)
           VALUES (?, ?, ?)`,
          [eventId, url, caption || null]
        );

        res.status(201).json({ success: true, id: result.insertId });
      } catch (err) {
        console.error('[ADMIN] Error creating media asset:', err);
        res.status(500).json({ error: 'Failed to create media asset' });
      }
    })
  );

  appInstance.put(
    '/api/admin/media/:id',
    asyncRoute(async (req, res) => {
      try {
        const mediaId = req.params.id;
        const { url, caption } = req.body || {};

        if (!url) {
          return sendBadRequest(res, 'url is required.');
        }

        const [result] = await pool.query(
          `UPDATE media_assets
             SET url = ?,
                 caption = ?
           WHERE id = ?`,
          [url, caption || null, mediaId]
        );

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Media asset not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error updating media asset:', err);
        res.status(500).json({ error: 'Failed to update media asset' });
      }
    })
  );

  appInstance.delete(
    '/api/admin/media/:id',
    asyncRoute(async (req, res) => {
      try {
        const mediaId = req.params.id;

        const [result] = await pool.query(`DELETE FROM media_assets WHERE id = ?`, [mediaId]);

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Media asset not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error deleting media asset:', err);
        res.status(500).json({ error: 'Failed to delete media asset' });
      }
    })
  );
}

/* =========================================================
   6.5 About Page (about_sections)
   ========================================================= */

function registerAboutRoutes(appInstance, pool) {
  appInstance.get(
    '/api/admin/about',
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
        console.error('[ADMIN] Error fetching about_sections:', err);
        res.status(500).json({ error: 'Failed to fetch about page content' });
      }
    })
  );

  appInstance.post(
    '/api/admin/about',
    asyncRoute(async (req, res) => {
      try {
        const { display_order, title, text } = req.body || {};

        if (display_order == null || !title || !text) {
          return sendBadRequest(res, 'display_order, title, and text are required.');
        }

        const [result] = await pool.query(
          `INSERT INTO about_sections (display_order, title, text)
           VALUES (?, ?, ?)`,
          [display_order, title, text]
        );

        res.status(201).json({ success: true, id: result.insertId });
      } catch (err) {
        console.error('[ADMIN] Error creating about section:', err);
        res.status(500).json({ error: 'Failed to create about section' });
      }
    })
  );

  appInstance.put(
    '/api/admin/about/:id',
    asyncRoute(async (req, res) => {
      try {
        const sectionId = req.params.id;
        const { display_order, title, text } = req.body || {};

        if (display_order == null || !title || !text) {
          return sendBadRequest(res, 'display_order, title, and text are required.');
        }

        const [result] = await pool.query(
          `UPDATE about_sections
             SET display_order = ?,
                 title = ?,
                 text = ?
           WHERE id = ?`,
          [display_order, title, text, sectionId]
        );

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'About section not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error updating about section:', err);
        res.status(500).json({ error: 'Failed to update about section' });
      }
    })
  );

  appInstance.delete(
    '/api/admin/about/:id',
    asyncRoute(async (req, res) => {
      try {
        const sectionId = req.params.id;

        const [result] = await pool.query(`DELETE FROM about_sections WHERE id = ?`, [sectionId]);

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'About section not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error deleting about section:', err);
        res.status(500).json({ error: 'Failed to delete about section' });
      }
    })
  );
}

/* =========================================================
   6.6 Team Members (team_members + photo)
   ========================================================= */

function registerTeamRoutes(appInstance, pool) {
  appInstance.get(
    '/api/admin/team',
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
        console.error('[ADMIN] Error fetching team_members:', err);
        res.status(500).json({ error: 'Failed to fetch team members' });
      }
    })
  );

  appInstance.post(
    '/api/admin/team',
    asyncRoute(async (req, res) => {
      try {
        const { name, role, image_url } = req.body || {};

        if (!name || !role) {
          return sendBadRequest(res, 'name and role are required.');
        }

        const [result] = await pool.query(
          `INSERT INTO team_members (name, role, image_url)
           VALUES (?, ?, ?)`,
          [name, role, image_url || null]
        );

        res.status(201).json({ success: true, id: result.insertId });
      } catch (err) {
        console.error('[ADMIN] Error creating team member:', err);
        res.status(500).json({ error: 'Failed to create team member' });
      }
    })
  );

  appInstance.put(
    '/api/admin/team/:id',
    asyncRoute(async (req, res) => {
      try {
        const memberId = req.params.id;
        const { name, role, image_url } = req.body || {};

        if (!name || !role) {
          return sendBadRequest(res, 'name and role are required.');
        }

        const [result] = await pool.query(
          `UPDATE team_members
             SET name = ?,
                 role = ?,
                 image_url = ?
           WHERE id = ?`,
          [name, role, image_url || null, memberId]
        );

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Team member not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error updating team member:', err);
        res.status(500).json({ error: 'Failed to update team member' });
      }
    })
  );

  appInstance.delete(
    '/api/admin/team/:id',
    asyncRoute(async (req, res) => {
      try {
        const memberId = req.params.id;

        const [result] = await pool.query(`DELETE FROM team_members WHERE id = ?`, [memberId]);

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Team member not found.');
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error deleting team member:', err);
        res.status(500).json({ error: 'Failed to delete team member' });
      }
    })
  );

  appInstance.post(
    '/api/admin/team/:id/photo',
    asyncRoute(async (req, res) => {
      try {
        const memberId = req.params.id;
        const { imageData } = req.body || {};

        if (!imageData) {
          return sendBadRequest(res, 'imageData is required.');
        }

        const match = String(imageData).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) {
          return sendBadRequest(res, 'Invalid imageData format.');
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

        const [result] = await pool.query(`UPDATE team_members SET image_url = ? WHERE id = ?`, [
          url,
          memberId,
        ]);

        if (result.affectedRows === 0) {
          return sendNotFound(res, 'Team member not found.');
        }

        res.json({ success: true, image_url: url });
      } catch (err) {
        console.error('[ADMIN] Error uploading team photo:', err);
        res.status(500).json({ error: 'Failed to upload team photo.' });
      }
    })
  );

  appInstance.delete(
    '/api/admin/team/:id/photo',
    asyncRoute(async (req, res) => {
      try {
        const memberId = req.params.id;

        const [rows] = await pool.query(`SELECT image_url FROM team_members WHERE id = ?`, [
          memberId,
        ]);

        if (!rows.length) {
          return sendNotFound(res, 'Team member not found.');
        }

        const currentUrl = rows[0].image_url || null;

        await pool.query(`UPDATE team_members SET image_url = NULL WHERE id = ?`, [memberId]);

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
        }

        res.json({ success: true });
      } catch (err) {
        console.error('[ADMIN] Error removing team photo:', err);
        res.status(500).json({ error: 'Failed to remove team photo.' });
      }
    })
  );
}

/* =========================================================
   07) Server Listen
   ========================================================= */

const PORT = Number(process.env.ADMIN_PORT) || 4001;
app.listen(PORT, () => {
  console.log(`Admin Auth + Admin API listening on port ${PORT}`);
});
