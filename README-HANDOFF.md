# Solar Events — Complete Project Handoff Documentation

**Last Updated:** February 2026  
**Project URL:** https://www.solarimpacts.org  
**Admin URL:** https://www.solarimpacts.org/admin  
**GitHub:** https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [Infrastructure Details](#4-infrastructure-details)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema](#6-database-schema)
7. [API Documentation](#7-api-documentation)
   - 7.1 [Public API — database.js](#71-public-api--databasejs-port-4000)
   - 7.2 [Admin API — admin.js](#72-admin-api--adminjs-port-4001)
   - 7.3 [AI API — OpenAI Integration](#73-ai-api--openai-integration)
8. [Authentication & Password Hashing](#8-authentication--password-hashing)
9. [Frontend Structure](#9-frontend-structure)
   - 9.1 [Project File Structure](#91-project-file-structure)
   - 9.2 [Component Map](#92-component-map)
   - 9.3 [Dependencies Explained](#93-dependencies-explained)
10. [File Storage (DigitalOcean Spaces)](#10-file-storage-digitalocean-spaces)
11. [How vercel.json Works](#11-how-verceljson-works)
12. [Deployment & Git Workflow](#12-deployment--git-workflow)
13. [Local Development](#13-local-development)
14. [Server Setup Guide](#14-server-setup-guide)
15. [Common Tasks & Maintenance](#15-common-tasks--maintenance)
16. [Troubleshooting](#16-troubleshooting)
17. [Security Considerations](#17-security-considerations)
18. [Cost Summary](#18-cost-summary)

---

## 1. Project Overview

Solar Events is a web application that documents historical solar events (solar flares, geomagnetic storms, etc.) and their impacts on communication systems throughout history. It consists of a public-facing site, an AI-powered features layer, and a protected admin panel for managing all content.

### Pages

- **`/` — Home (Timeline):** Interactive timeline displaying solar events grouped by year. Users can search by year or browse by decade. Clicking an event opens a detail overlay with a summary, impact on communications, and an AI "Tell Me More" button. From the overlay, users can also open scanned historical newspaper articles linked to the event.
- **`/live` — Live Data:** Dashboard showing current solar activity metrics (solar flare class, geomagnetic storm level, etc.). Currently displays static placeholder data — intended for future integration with a live solar data API (e.g., NOAA SWPC).
- **`/birthday` — Events on My Birthday:** Lets users enter a birth date (MM/DD) or birth year (YYYY) and get a list of AI-generated solar events from that date or year.
- **`/about` — About:** Dynamic content sections about the project plus team member profiles. All content is managed through the admin panel.
- **`/admin` — Admin Panel:** Password-protected interface for managing all database content — events, newspaper article media, about page sections, and team members. Also supports admin user account management.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE                                      │
│                         (DNS + SSL + Proxy)                                  │
│                     solarimpacts.org → Vercel                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               VERCEL                                         │
│                        (Frontend Hosting)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     React App (React Router)                         │   │
│  │  • /           → HomePage (timeline)                                 │   │
│  │  • /about      → AboutPage                                           │   │
│  │  • /live       → LivePage                                            │   │
│  │  • /birthday   → BirthdayPage                                        │   │
│  │  • /admin      → AdminPage                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│   vercel.json proxies /api/* → https://api.solarimpacts.org/api/*          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DIGITALOCEAN DROPLET                                     │
│                   ubuntu-s-1vcpu-1gb-nyc3-01                                 │
│                        (API Server)                                          │
│                                                                              │
│  ┌──────────────────────┐    ┌──────────────────────┐                       │
│  │   database.js        │    │     admin.js         │                       │
│  │   (Public API)       │    │   (Admin API)        │                       │
│  │   Port: 4000         │    │   Port: 4001         │                       │
│  │                      │    │                      │                       │
│  │   /api/health        │    │   /api/admin/health  │                       │
│  │   /api/events        │    │   /api/admin/login   │                       │
│  │   /api/events/:id/   │    │   /api/admin/events  │                       │
│  │     media            │    │   /api/admin/media   │                       │
│  │   /api/about         │    │   /api/admin/about   │                       │
│  │   /api/team          │    │   /api/admin/team    │                       │
│  │   /api/ai/*          │    │   /api/admin/users   │                       │
│  └──────────────────────┘    └──────────────────────┘                       │
│            │                           │                                     │
└────────────┼───────────────────────────┼─────────────────────────────────────┘
             │                           │
             ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIGITALOCEAN MANAGED MySQL                                │
│                      solar-events-db-mysql                                   │
│                                                                              │
│  solar_events │ media_assets │ about_sections │ team_members                │
│  admin_users  │ security_questions                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIGITALOCEAN SPACES                                       │
│                     newspaper-articles                                       │
│               newspaper-articles.nyc3.digitaloceanspaces.com                │
│                                                                              │
│  /articles/event-{id}-{timestamp}-{hash}.{ext}   (newspaper scans)          │
│  /team/member-{id}-{timestamp}-{hash}.{ext}       (team photos)             │
│  /Background/Videos/Sun.webm                      (SpaceVideos component)   │
│  /Background/Videos/Earth.webm                    (SpaceVideos component)   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPENAI API                                           │
│                    (external, pay-per-use)                                   │
│                                                                              │
│  Used by database.js for three AI endpoints:                                │
│  /api/ai/tell-me-more  /api/ai/birthday-events  /api/ai/year-events         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend

| Technology       | Version | Purpose                            |
| ---------------- | ------- | ---------------------------------- |
| React            | 19.x    | UI Framework                       |
| react-router-dom | 6.x     | Client-side routing                |
| Vite             | 7.x     | Build tool & dev server            |
| react-easy-crop  | 5.x     | Team photo crop-to-circle in admin |
| Prettier         | 3.x     | Code formatter (dev tool)          |

### Backend

| Technology         | Version  | Purpose                                                    |
| ------------------ | -------- | ---------------------------------------------------------- |
| Node.js            | 20.x LTS | Runtime                                                    |
| Express            | 5.x      | Web framework                                              |
| mysql2             | 3.x      | MySQL driver with promise support                          |
| bcryptjs           | 3.x      | Password & security answer hashing                         |
| multer             | 2.x      | Multipart file uploads (event media)                       |
| formidable         | 3.x      | Form parsing library (installed, available for future use) |
| @aws-sdk/client-s3 | 3.x      | DigitalOcean Spaces file storage                           |
| openai             | 6.x      | GPT-4o AI features                                         |
| dotenv             | Latest   | Load .env variables                                        |
| concurrently       | Latest   | Run both API servers in one terminal                       |

### Infrastructure

| Service          | Provider                   | Purpose                          |
| ---------------- | -------------------------- | -------------------------------- |
| Frontend Hosting | Vercel                     | Serves the React build           |
| API Server       | DigitalOcean Droplet       | Runs database.js and admin.js    |
| Database         | DigitalOcean Managed MySQL | All application data             |
| File Storage     | DigitalOcean Spaces        | Images and newspaper scans       |
| DNS / SSL        | Cloudflare                 | Domain management and HTTPS      |
| AI               | OpenAI (GPT-4o)            | Tell Me More + Birthday features |

---

## 4. Infrastructure Details

### DigitalOcean Droplet (API Server)

- **Name:** `ubuntu-s-1vcpu-1gb-nyc3-01`
- **OS:** Ubuntu 24.04 (LTS) x64
- **Specs:** 1 GB Memory / 1 vCPU / 25 GB Disk
- **Region:** NYC3
- **IP:** Check DigitalOcean dashboard

### DigitalOcean Managed MySQL

- **Name:** `solar-events-db-mysql`
- **Engine:** MySQL 8
- **Specs:** 1 GB RAM / 1 vCPU / 10 GB Disk
- **Region:** NYC3
- **Port:** 25060
- **Connection:** SSL required — certificate stored in `.env` as `DB_CA_CERT`

### DigitalOcean Spaces

- **Bucket name:** `newspaper-articles`
- **Public URL base:** `https://newspaper-articles.nyc3.digitaloceanspaces.com`
- **Region:** NYC3
- **Cost:** $5/month (250 GB storage, 1 TB bandwidth)

### Cloudflare

- **Domain:** solarimpacts.org
- **Proxy:** Enabled (orange cloud) — hides origin IP, provides DDoS protection
- **SSL mode:** Full (strict)

### Vercel

- **Project:** solar-events
- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Auto-deploy:** Pushes to `main` branch trigger an automatic rebuild and deploy

---

## 5. Environment Variables

Create a `.env` file in the project root (same directory as `admin.js` and `database.js`). This file must **never** be committed to git — it is listed in `.gitignore`.

```bash
# =========================
# Database Connection
# =========================
DB_HOST=solar-events-db-mysql-do-user-XXXXXXX-0.d.db.ondigitalocean.com
DB_PORT=25060
DB_NAME=defaultdb

# Read-only user — used by database.js (public API)
DB_USER_PUBLIC=solar_public
DB_PASSWORD_PUBLIC=<public_user_password>

# Admin user — used by admin.js (full CRUD)
DB_USER_ADMIN=solar_admin_app
DB_PASSWORD_ADMIN=<admin_user_password>

# =========================
# DigitalOcean Spaces
# =========================
SPACES_KEY=<your_spaces_access_key>
SPACES_SECRET=<your_spaces_secret_key>
SPACES_BUCKET=newspaper-articles
SPACES_REGION=nyc3
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_ORIGIN_URL=https://newspaper-articles.nyc3.digitaloceanspaces.com

# =========================
# SSL Certificate (for MySQL over SSL)
# =========================
# Paste the entire CA certificate as a single-line string with \n for line breaks.
# The server code automatically converts \n back to real newlines.
# Alternatively, place ca-certificate.crt in the project root for local dev.
DB_CA_CERT="-----BEGIN CERTIFICATE-----\n<certificate_content>\n-----END CERTIFICATE-----"

# =========================
# Server Ports
# =========================
PUBLIC_PORT=4000    # database.js (public API)
ADMIN_PORT=4001     # admin.js (admin API)

# =========================
# CORS
# =========================
# Comma-separated list of allowed origins.
# For LOCAL DEV: include http://localhost:5173 so the admin API accepts Vite dev server requests.
# For PRODUCTION: omit localhost — use only the live domains.
# Vercel preview URLs (*.vercel.app) are automatically allowed by the CORS logic in code.
CORS_ORIGIN=http://localhost:5173,https://www.solarimpacts.org,https://solarimpacts.org

# =========================
# OpenAI (AI features)
# =========================
OPENAI_API_KEY=<your_openai_api_key>
```

### How the CA Certificate Works

DigitalOcean's managed MySQL requires an SSL connection. The CA certificate verifies the server's identity. There are two ways to provide it:

**Production (recommended):** Store the certificate content in `DB_CA_CERT` in `.env`, replacing all real newlines with `\n`. The server calls `fromEnv.replace(/\\n/g, '\n')` to convert them back to real newlines before connecting.

**Local dev fallback:** If `DB_CA_CERT` is not set, the server looks for a file called `ca-certificate.crt` in the project root. Download this file from the DigitalOcean database dashboard under Connection Details.

### Vercel Environment Variables

Set these in the Vercel dashboard under Settings → Environment Variables:

| Variable              | Value                          |
| --------------------- | ------------------------------ |
| `VITE_ADMIN_API_BASE` | `https://api.solarimpacts.org` |

This tells the admin panel where to send API write requests. Without it, all admin API calls will fail in production because `ADMIN_API_BASE` will fall back to an empty string.

---

## 6. Database Schema

The database is hosted on DigitalOcean Managed MySQL. The database name is `defaultdb`.

### Table: `solar_events`

The primary content table. Every event on the public timeline comes from here.

```sql
CREATE TABLE `solar_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_date` date NOT NULL,
  `event_type` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `short_description` varchar(500) DEFAULT NULL,
  `summary` text NOT NULL,
  `impact_on_communication` text,
  PRIMARY KEY (`id`),
  KEY `idx_solar_events_date` (`event_date`)
);
```

| Column                    | Type            | Notes                                                                         |
| ------------------------- | --------------- | ----------------------------------------------------------------------------- |
| `id`                      | bigint unsigned | Auto-increment primary key                                                    |
| `event_date`              | date            | Stored as `YYYY-MM-DD`. The frontend extracts the year for timeline grouping. |
| `event_type`              | varchar(255)    | e.g. "Solar Flare", "Geomagnetic Storm"                                       |
| `location`                | varchar(255)    | Nullable. Geographic location affected.                                       |
| `title`                   | varchar(255)    | Required. Displayed as the event heading.                                     |
| `short_description`       | varchar(500)    | Nullable. Short blurb shown on timeline cards.                                |
| `summary`                 | text            | Required. Full description shown in the event overlay.                        |
| `impact_on_communication` | text            | Nullable. How this event affected communications technology.                  |

### Table: `media_assets`

Newspaper article images linked to events. A single event can have many media assets.

```sql
CREATE TABLE `media_assets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint unsigned NOT NULL,
  `url` varchar(500) NOT NULL,
  `object_key` varchar(512) DEFAULT NULL,
  `caption` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_media_assets_event` (`event_id`),
  CONSTRAINT `fk_media_assets_event` FOREIGN KEY (`event_id`)
    REFERENCES `solar_events` (`id`) ON DELETE CASCADE
);
```

| Column       | Type            | Notes                                                                                                      |
| ------------ | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `event_id`   | bigint unsigned | Foreign key to `solar_events`. Deleting an event cascades and deletes all its media records automatically. |
| `url`        | varchar(500)    | Full public URL to the image in Spaces.                                                                    |
| `object_key` | varchar(512)    | The Spaces object key (path within the bucket). Used for deletion.                                         |
| `caption`    | varchar(255)    | Optional caption displayed below the newspaper image.                                                      |

**Important:** `ON DELETE CASCADE` means deleting an event automatically removes its media rows from the database. However, the actual image files in Spaces are deleted separately by the API. If that step fails (e.g., network error), orphaned files may remain in the bucket.

### Table: `about_sections`

Dynamic content sections for the public About page.

```sql
CREATE TABLE `about_sections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `display_order` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `text` text NOT NULL,
  PRIMARY KEY (`id`)
);
```

| Column          | Notes                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| `display_order` | Lower numbers appear first on the public about page. Set manually in the admin panel. |
| `text`          | Plain text — no HTML markup.                                                          |

### Table: `team_members`

Team profiles shown on the About page.

```sql
CREATE TABLE `team_members` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `role` varchar(200) NOT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
);
```

| Column          | Notes                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------- |
| `image_url`     | Nullable. Full public URL to profile photo in Spaces. Null if no photo has been uploaded. |
| `display_order` | Controls the display order on the about page. Default is 1.                               |

### Table: `admin_users`

Admin portal accounts. All passwords and security answers are stored as bcrypt hashes — never plaintext.

```sql
CREATE TABLE `admin_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `security_question_id` bigint unsigned DEFAULT NULL,
  `security_answer_hash` varchar(255) DEFAULT NULL,
  `is_protected` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`username`),
  CONSTRAINT `fk_admin_users_sec_question` FOREIGN KEY (`security_question_id`)
    REFERENCES `security_questions` (`id`) ON DELETE RESTRICT
);
```

| Column                 | Notes                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- |
| `username`             | Unique. Used to log in.                                                      |
| `password_hash`        | bcrypt hash (12 salt rounds). Never stored as plaintext.                     |
| `security_question_id` | FK to `security_questions`. If set, user must answer this question at login. |
| `security_answer_hash` | bcrypt hash of the security answer. Case-sensitive.                          |
| `is_protected`         | If `1`, this is a super admin — cannot be edited or deleted via the API.     |

### Table: `security_questions`

A predefined list of security questions for admin accounts to choose from.

```sql
CREATE TABLE `security_questions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `question_text` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
);
```

Questions are managed directly in the database — there is no admin UI to add/edit them.

### Entity Relationship Diagram

```
solar_events (1) ────< (many) media_assets
  ON DELETE CASCADE — deleting an event removes all linked media rows

admin_users (many) >──── (1) security_questions
  ON DELETE RESTRICT — cannot delete a security question if any user references it

about_sections    — standalone, no relationships
team_members      — standalone, no relationships
```

### Database Users & Permissions

Two separate MySQL users are used for security isolation:

**`solar_public`** — Read-only, used by `database.js`:

```sql
GRANT SELECT ON defaultdb.solar_events TO 'solar_public'@'%';
GRANT SELECT ON defaultdb.media_assets TO 'solar_public'@'%';
GRANT SELECT ON defaultdb.about_sections TO 'solar_public'@'%';
GRANT SELECT ON defaultdb.team_members TO 'solar_public'@'%';
```

**`solar_admin_app`** — Full CRUD, used by `admin.js`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON defaultdb.* TO 'solar_admin_app'@'%';
```

This means even if the public API server (`database.js`) were compromised, the attacker could only read data — they could not modify or delete anything.

---

## 7. API Documentation

### 7.1. Public API — `database.js` (Port 4000)

Read-only server using the `solar_public` database user. Serves all content for the public-facing pages, plus the three AI endpoints. All queries use parameterized statements (`?` placeholders) to prevent SQL injection.

#### `GET /api/health`

```json
{ "status": "ok", "message": "Solar Events API is running" }
```

#### `GET /api/events`

Returns all events ordered by `event_date ASC`. The frontend uses this to build the entire timeline on page load.

```json
[
  {
    "id": 1,
    "event_date": "1859-09-01",
    "event_type": "Solar Flare",
    "location": "Worldwide",
    "title": "Carrington Event",
    "short_description": "The most intense geomagnetic storm on record.",
    "summary": "Full description...",
    "impact_on_communication": "Telegraph systems failed across North America..."
  }
]
```

#### `GET /api/events/:id/media`

Returns all newspaper article images linked to a specific event, ordered by `id ASC`.

```json
[
  {
    "id": 5,
    "event_id": 1,
    "url": "https://newspaper-articles.nyc3.digitaloceanspaces.com/articles/...",
    "caption": "New York Times, September 2 1859"
  }
]
```

#### `GET /api/about`

Returns all about sections ordered by `display_order ASC, id ASC`.

```json
[{ "id": 1, "display_order": 1, "title": "Our Mission", "text": "..." }]
```

#### `GET /api/team`

Returns all team members ordered by `id ASC`.

```json
[{ "id": 1, "name": "Jane Smith", "role": "Lead Researcher", "image_url": "https://..." }]
```

---

### 7.2. Admin API — `admin.js` (Port 4001)

Handles all write operations using the `solar_admin_app` database user. There is no session/token-based authentication — the login endpoint validates credentials and returns user info. The frontend stores this in React state only. **If the admin page is refreshed, the user is logged out** and must log in again.

#### `GET /api/admin/health`

```json
{ "status": "ok", "message": "Admin Auth API running" }
```

#### `POST /api/admin/login`

See [Section 8](#8-authentication--password-hashing) for the full authentication flow.

Request body:

```json
{
  "username": "admin",
  "password": "MyPassword123!",
  "securityAnswer": "optional — only needed if account has a security question"
}
```

Success response:

```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "is_protected": true,
    "securityQuestionId": null,
    "requiresSecurityAnswer": false
  }
}
```

If the user has a security question but didn't provide an answer yet (two-step login):

```json
{
  "error": "Security answer required.",
  "requiresSecurityAnswer": true,
  "securityQuestionId": 3,
  "securityQuestionText": "What was the name of your first pet?"
}
```

#### `GET /api/admin/security-questions`

Returns all available security questions for the account setup form.

#### Admin User Management

```
GET    /api/admin/users          — List all admin users
POST   /api/admin/users          — Create new admin user (username, password, securityQuestionId, securityAnswer)
PUT    /api/admin/users/:id      — Update password/security question (blocked if is_protected = 1)
DELETE /api/admin/users/:id      — Delete user (blocked if is_protected = 1)
PUT    /api/admin/profile        — Non-super-admin self-update (userId, password, securityQuestionId, securityAnswer)
```

Note: `is_protected = 1` accounts return HTTP 403 on edit or delete attempts.

#### Events CRUD

```
GET    /api/admin/events          — List all events
POST   /api/admin/events          — Create event (event_date and title required)
PUT    /api/admin/events/:id      — Update event (event_date and title required)
DELETE /api/admin/events/:id      — Delete event (cascades to media_assets in DB)
```

#### Media CRUD

Accepts either a multipart file upload (via `multer`, 12 MB limit) or a JSON body with a URL to link an external image.

```
GET    /api/admin/events/:eventId/media            — List media for an event
POST   /api/admin/events/:eventId/media            — Upload image (multipart) OR link URL (JSON)
PUT    /api/admin/events/:eventId/media/:mediaId   — Update caption only
DELETE /api/admin/events/:eventId/media/:mediaId   — Delete DB record + best-effort delete from Spaces
PUT    /api/admin/media/:id                        — Update url + caption (flat route)
DELETE /api/admin/media/:id                        — Delete record only (does NOT clean up Spaces)
```

When deleting via the nested route (`/events/:eventId/media/:mediaId`), the server attempts to delete the file from Spaces. If that fails, the DB record is still removed and only a warning is logged — the request still returns success.

#### About Sections CRUD

```
GET    /api/admin/about           — List all sections (ordered by display_order)
POST   /api/admin/about           — Create section (display_order, title, text all required)
PUT    /api/admin/about/:id       — Update section (display_order, title, text all required)
DELETE /api/admin/about/:id       — Delete section
```

#### Team Members CRUD

```
GET    /api/admin/team            — List all members
POST   /api/admin/team            — Create member (name and role required)
PUT    /api/admin/team/:id        — Update name, role, image_url
DELETE /api/admin/team/:id        — Delete member (does NOT auto-clean Spaces photo)
POST   /api/admin/team/:id/photo  — Upload cropped photo as base64 data URI
DELETE /api/admin/team/:id/photo  — Remove photo (sets image_url = NULL, deletes from Spaces)
```

The photo upload endpoint (`POST /api/admin/team/:id/photo`) expects:

```json
{ "imageData": "data:image/jpeg;base64,/9j/4AAQ..." }
```

The server parses the MIME type, decodes base64 to a binary buffer, uploads to Spaces, and updates `image_url` in the database.

---

### 7.3. AI API — OpenAI Integration

Three AI-powered endpoints are served by `database.js`. All three use **GPT-4o** via the OpenAI Node.js SDK and are rate-limited per IP using a custom in-memory rate limiter.

#### How the Rate Limiter Works

`createRateLimiter(maxRequests, windowMs)` in `database.js` tracks request counts per IP in a `Map`. Each IP gets a counter that resets after `windowMs` milliseconds. If it exceeds `maxRequests`, the endpoint returns HTTP 429.

**Known limitation:** State is in-memory, so it resets on every server restart and does not scale across multiple server instances. For production hardening, consider Redis-backed rate limiting.

| Endpoint                  | Limit                    |
| ------------------------- | ------------------------ |
| `/api/ai/tell-me-more`    | 5 requests / minute / IP |
| `/api/ai/birthday-events` | 3 requests / minute / IP |
| `/api/ai/year-events`     | 3 requests / minute / IP |

---

#### Endpoint 1: Tell Me More (`POST /api/ai/tell-me-more`)

**Used by:** The "Tell Me More" button in `EventDetailOverlay` on the homepage.

**What it does:** Takes an existing event record and asks GPT-4o to expand on it with additional historical context, scientific detail, and documented communication impacts. It enriches what's already in the database rather than generating new event data independently.

**Request body:**

```json
{
  "title": "Carrington Event",
  "date": "September 1, 1859",
  "type": "Solar Flare",
  "location": "Worldwide",
  "summary": "The most intense geomagnetic storm on record...",
  "impact": "Telegraph systems failed across North America..."
}
```

**Response:** `{ "result": "3–4 paragraphs of expanded plain text..." }`

**GPT-4o settings:** `model: gpt-4o`, `max_tokens: 700`, `temperature: 0.4`

Temperature 0.4 balances factual accuracy with readable prose. The prompt explicitly instructs the model not to invent specific facts and to note when details are uncertain.

**Frontend caching:** Results are cached in a module-level `Map` called `tellMeMoreCache` (keyed by `event.id`) inside `HomePage.jsx`. This means clicking "Tell Me More" on the same event only makes one API call per session — subsequent clicks serve the cached result instantly. Cache resets on page reload.

**UI flow:**

1. User clicks "Tell Me More" → frontend checks `tellMeMoreCache`
2. Cache hit → display result immediately, no API call
3. Cache miss → POST to `/api/ai/tell-me-more` with event data
4. Button shows spinner and "Researching…" while loading
5. On success → overlay switches to "AI Expanded Detail" panel with the text
6. A disclaimer is displayed: _"Generated by GPT-4o. Verify significant details with primary scientific sources."_
7. "← Back to Summary" returns to the normal event view

---

#### Endpoint 2: Birthday Events (`POST /api/ai/birthday-events`)

**Used by:** `BirthdayPage.jsx` in "Month / Day" search mode.

**What it does:** Given a calendar date (month + day), GPT-4o returns up to 10 of the most historically significant solar events that occurred on that date across all of history. This draws from GPT-4o's training knowledge — it does **not** query the project's MySQL database.

**Request body:** `{ "month": 9, "day": 1 }`

**Response:**

```json
{
  "events": [
    {
      "year": 1859,
      "title": "Carrington Event",
      "type": "Solar Flare",
      "description": "2–3 sentence description focused on communication impact."
    }
  ]
}
```

**GPT-4o settings:** `model: gpt-4o`, `max_tokens: 1500`, `temperature: 0.2`

Temperature 0.2 maximizes factual accuracy. The prompt instructs the model to only include events it is highly confident about, return an empty array if none exist, and respond in strict JSON only.

**JSON parsing:** GPT-4o sometimes wraps responses in markdown code fences. The server strips ` ```json ` fences before calling `JSON.parse()` to prevent parse failures.

---

#### Endpoint 3: Year Events (`POST /api/ai/year-events`)

**Used by:** `BirthdayPage.jsx` in "Birth Year" search mode.

**What it does:** Given a year, GPT-4o returns up to 10 significant solar events from that year, ordered chronologically. Like the birthday endpoint, this uses GPT-4o's training knowledge — not the MySQL database.

**Request body:** `{ "year": 1989 }`

**Response:**

```json
{
  "events": [
    {
      "date": "March 13",
      "title": "Great Geomagnetic Storm",
      "type": "Geomagnetic Storm",
      "description": "2–3 sentence description focused on communication impact."
    }
  ]
}
```

**GPT-4o settings:** `model: gpt-4o`, `max_tokens: 1500`, `temperature: 0.2`

---

#### AI Error Handling

All three endpoints share the same error response structure:

| Scenario                                 | HTTP Status | `error` field      |
| ---------------------------------------- | ----------- | ------------------ |
| Server-side rate limit exceeded          | 429         | `"rate_limit"`     |
| OpenAI API rate limit (429 from OpenAI)  | 429         | `"rate_limit"`     |
| JSON parse failure (malformed AI output) | 500         | `"ai_parse_error"` |
| Any other failure                        | 500         | `"ai_error"`       |

The frontend handles all of these cases and shows appropriate user-facing messages without crashing.

#### Developer Notes on AI Features

- **Cost:** All endpoints call GPT-4o, billed per token. Tell Me More uses up to 700 output tokens; birthday/year endpoints up to 1,500. Monitor at [platform.openai.com](https://platform.openai.com).
- **No storage:** AI results are never saved to the database. Birthday/year results are not cached. Tell Me More caches only in browser memory for the session.
- **Model swap:** To reduce costs, replace `'gpt-4o'` with `'gpt-4o-mini'` in the three `openai.chat.completions.create()` calls in `database.js`.
- **Accuracy disclaimer:** Both the Birthday page and Tell Me More panel display a disclaimer that results are AI-generated and should be verified against primary sources.

---

## 8. Authentication & Password Hashing

### How Passwords Are Stored

The project uses **bcrypt** (via the `bcryptjs` package) to hash all passwords and security answers before storing them in the database. Bcrypt is a deliberately slow one-way hashing algorithm that includes a random salt, making brute-force and rainbow table attacks computationally impractical.

The `BCRYPT_ROUNDS` constant in `admin.js` is set to `12`. This means bcrypt runs 2^12 = 4,096 iterations internally. Higher values are more secure but slower to compute. 12 rounds is considered a solid standard for web applications. Hashes look like: `$2b$12$<22-char-salt><31-char-hash>`.

**Passwords are never stored in plaintext anywhere** — not in the database, not in logs, not in memory beyond the instant of verification.

### The Login Flow in Detail

Login involves up to two bcrypt checks depending on the account type.

**Step 1 — Password check:**

1. Client sends `{ username, password }` to `POST /api/admin/login`
2. Server looks up the user by username
3. `bcrypt.compare(password, user.password_hash)` — this re-hashes the provided password using the salt embedded in `password_hash` and compares results
4. If it fails, a 401 is returned with the generic message "Invalid username or password" — intentionally vague so it doesn't reveal whether the username exists

**Step 2 — Security question (conditional):**

- If `security_question_id` is set AND `is_protected = 0`, the user requires a security answer
- If no `securityAnswer` was in the request, the server returns 400 with `requiresSecurityAnswer: true` and the question text
- The frontend then shows the question field and the user re-submits with the answer
- `bcrypt.compare(securityAnswer, user.security_answer_hash)` is called — answers are case-sensitive

**Super admin accounts** (`is_protected = 1`) skip the security question check entirely.

### The `hash-password.js` Utility Script

When adding a new admin user directly to the database (bypassing the admin UI), you need a bcrypt hash. The `hash-password.js` script generates one.

**How to use it:**

1. Open `hash-password.js` and set `plainPassword`:

```javascript
const plainPassword = 'MyNewSecurePassword123!';
const ROUNDS = 12;
```

2. Run it:

```bash
node hash-password.js
```

3. Copy the printed hash (starts with `$2b$12$...`)

4. Insert directly into the database:

```sql
INSERT INTO admin_users (username, password_hash, is_protected)
VALUES ('newadmin', '$2b$12$...your_hash_here...', 0);
```

**Important:** Always revert `plainPassword` to a placeholder after use. Do not commit the file with a real password inside it.

The same process applies to hashing security answers — just run the script with the answer text as `plainPassword` and use the resulting hash for `security_answer_hash`.

### The `is_protected` Flag

One account in `admin_users` should have `is_protected = 1`. The API enforces two hard protections on it:

- `PUT /api/admin/users/:id` returns 403 if `is_protected = 1`
- `DELETE /api/admin/users/:id` returns 403 if `is_protected = 1`

This prevents the super admin account from being accidentally deleted or locked out via the admin panel UI. Only a direct database operation can modify a protected account. This is especially important because there is no "forgot password" flow — if the super admin account were deleted, recovery would require direct database access.

---

## 9. Frontend Structure

The frontend is a React 19 application using React Router for client-side routing. It is structured as a multi-page component architecture — each route has its own page component and CSS file. `App.jsx` serves as the application shell only.

### 9.1. Project File Structure

```
solar-events/
│
├── App.jsx              # App shell: topbar, nav drawer, routing, footer, SpaceVideos
├── App.css              # Global styles + topbar styles
├── main.jsx             # Entry point — mounts App inside BrowserRouter + StrictMode
├── index.css            # Base/reset styles
├── index.html           # HTML entry point (Vite)
├── utils.js             # Shared utility functions and API URL constants
├── SpaceVideos.jsx      # Ambient background video overlay component (Sun + Earth)
├── SpaceVideos.css      # Styles, animations, and responsive rules for space videos
│
├── Pages/
│   ├── Home/
│   │   ├── HomePage.jsx     # Timeline, event detail overlay, media overlay (~634 lines)
│   │   └── HomePage.css
│   ├── About/
│   │   ├── AboutPage.jsx    # About page: dynamic sections + team profiles (~124 lines)
│   │   └── AboutPage.css
│   ├── Live/
│   │   ├── LivePage.jsx     # Live data dashboard — flip-card metrics (~107 lines)
│   │   └── LivePage.css
│   ├── Birthday/
│   │   ├── BirthdayPage.jsx # Birthday solar event lookup — AI-powered (~344 lines)
│   │   └── BirthdayPage.css
│   └── Admin/
│       ├── AdminPage.jsx    # Full admin portal (~3,327 lines)
│       └── AdminPage.css
│
├── admin.js             # Admin API server — CRUD + auth, port 4001
├── database.js          # Public API server — read-only + AI endpoints, port 4000
├── hash-password.js     # Utility: generate bcrypt hash for direct DB insertion
├── package.json         # All dependencies and npm scripts
├── vite_config.js       # Vite config — dev proxy rules
├── vercel.json          # Vercel: API proxy + SPA fallback routing
├── eslint_config.js     # ESLint configuration
└── .env                 # Credentials — DO NOT COMMIT
```

> **Important:** Page components live in `Pages/<PageName>/` subdirectories, not the project root. Import paths in `App.jsx` reflect this, e.g. `import HomePage from './Pages/Home/HomePage'`. The `utils.js` import inside each page component therefore uses `../../utils` (two levels up) rather than `./utils`.

### 9.2. Component Map

#### `main.jsx` — Entry Point

Wraps `App` in `<StrictMode>` and `<BrowserRouter>`. React's `StrictMode` intentionally renders components twice in development to surface side effects — this is normal and does not happen in production builds.

#### `App.jsx` — Application Shell (~450 lines)

Owns the topbar, navigation drawer, year-search functionality, and the `<Routes>`. Events are fetched here on mount and passed as props to `HomePage`. Also renders the `<SpaceVideos />` component as a persistent background layer across all routes (except admin, which `SpaceVideos` self-excludes).

**Topbar behavior:** On the timeline page (`/`), the topbar includes the year search form. On other pages, it hides the search form. A `ResizeObserver` detects when topbar elements overflow their container and switches to a "stacked" two-row layout automatically.

**Year search:** Accepts a 4-digit year. If the exact year has no events, it finds the closest year with events and shows an info banner (auto-hides after 5 seconds). The "Browse" button opens a decade popover with clickable year buttons.

**`document.title`:** The page title switches between `"Solar Impacts"` (all public routes) and `"Solar Impacts Admin"` when on `/admin`, controlled by a `useEffect` watching `isAdmin`.

**Key state:**

```javascript
(events, loadingEvents, eventsError); // All solar events fetched from /api/events on mount
menuOpen; // Nav drawer open/closed
topbarStacked; // True when topbar wraps to two rows
(yearQuery, scrollToYear); // Year search input + scroll target for timeline
(showYearPicker, pickerDecade); // Decade browse popover
(searchInfo, searchError); // Banner messages (auto-hide after 5 seconds)
```

**Routes:**

```
/           → HomePage     (receives events, loading, loadError, scrollToYear props)
/about      → AboutPage
/live       → LivePage
/birthday   → BirthdayPage
/admin      → AdminPage
```

#### `SpaceVideos.jsx` — Ambient Background Videos

A purely decorative component that renders looping `.webm` video files of the Sun and Earth as a fixed background layer behind all UI. It is rendered once inside `App.jsx` and appears on all routes except `/admin` (which has no config entry).

**How it works:**

- Uses `useLocation()` from React Router to get the current pathname
- Looks up the pathname in a `PAGE_CONFIG` object that defines per-route visibility and positioning for the Sun and Earth videos
- If no config exists for the current route (e.g. `/admin`), the component returns `null` — nothing renders
- Both videos are tagged `autoPlay loop muted playsInline` and have `aria-hidden="true"` on the container so screen readers ignore them

**CSS layering:** The `.space-videos` container is `position: fixed; inset: 0; z-index: -1; pointer-events: none`. This places it above the CSS `body::before` background image but below all page UI, and `pointer-events: none` ensures it never intercepts any clicks.

**Video source files:** Hosted in DigitalOcean Spaces at:

```
https://newspaper-articles.nyc3.cdn.digitaloceanspaces.com/Background/Videos/Sun.webm
https://newspaper-articles.nyc3.cdn.digitaloceanspaces.com/Background/Videos/Earth.webm
```

Note this uses the **CDN subdomain** (`nyc3.cdn.digitaloceanspaces.com`), not the origin URL (`nyc3.digitaloceanspaces.com`). The CDN URL delivers files faster via edge caching.

**Per-route config (editable in `SpaceVideos.jsx`):**

| Route          | Sun                                                | Earth                                  |
| -------------- | -------------------------------------------------- | -------------------------------------- |
| `/` (timeline) | Shown — top-right, 55vw, 50% opacity, rotated 180° | Hidden                                 |
| `/live`        | Shown — top-right, 28vw, 60% opacity               | Shown — bottom-left, 20vw, 60% opacity |
| `/birthday`    | Shown — top-right, 28vw, 60% opacity               | Shown — bottom-left, 20vw, 60% opacity |
| `/about`       | Not in config — nothing rendered                   | Not in config                          |
| `/admin`       | Not in config — nothing rendered                   | Not in config                          |

**Animations (defined in `SpaceVideos.css`):**

- Both videos fade in on load (`spaceVideoFadeIn` — opacity 0→1, scale 0.93→1)
- Sun floats gently on a 14-second cycle (`spaceFloatSun`)
- Earth floats on an 18-second cycle (`spaceFloatEarth`) with a slightly different drift pattern
- `mix-blend-mode: screen` on each video removes the black background from the `.webm` file, leaving only the bright planet visible against the page background
- `border-radius: 50%` keeps the circular planet shape

**Responsive rules:** At <900px, both videos scale down via `!important` overrides. At <600px, opacity drops to 0.3 to reduce visual distraction on small screens.

**To add a new route or adjust positioning:** Edit the `PAGE_CONFIG` object at the top of `SpaceVideos.jsx`. Each route key maps to `{ sun: { show, style }, earth: { show, style } }` where `style` is any valid inline CSS object.

#### `utils.js` — Shared Helpers

```javascript
API_BASE; // '' (empty) — API calls use relative URLs, proxied by vercel.json in prod
ADMIN_API_BASE; // import.meta.env.VITE_ADMIN_API_BASE || '' — set to https://api.solarimpacts.org in prod

joinUrl(base, path); // Safely joins URL base + path, handling trailing slashes
formatEventDateLabel(dateStr); // "September 1"
formatEventDateLabelWithYear(dateStr); // "September 1, 1859"
formatFullDateLong(dateStr); // "September 1, 1859"
extractYear(dateStr); // "1859"
parseMonthDay(str); // { monthIndex: 9, day: 1 } — used for within-year sorting
sortEventsByDate(events); // Sorts events chronologically within a year by month/day
getEventYear(dateStr); // "1859" or null
```

**Why `API_BASE` is empty:** In production, `vercel.json` proxies all `/api/*` requests to `https://api.solarimpacts.org`. In local dev, Vite's proxy does the same. This means the frontend never needs the API's actual domain in code — it always calls relative paths like `/api/events`.

#### `HomePage.jsx` — Timeline Page (~634 lines)

Receives events from App and renders the timeline. Manages both the event detail overlay and media overlay.

**Timeline structure:** Events are grouped by year into `{ [year]: [...events] }`. Each year renders as a `TimelineYearRow` — a clickable row with the year and event count that expands to show event cards. Only one year is expanded at a time. Scroll hints (arrows) appear when the user is idle and content exists above/below the viewport.

**EventDetailOverlay:** Shows event metadata, full summary, and impact. Contains the "Tell Me More" AI button and "View Newspaper Articles" button.

**MediaOverlay:** Full-screen newspaper image viewer with caption, prev/next navigation (if multiple articles), and "← Back to Summary".

**AI caching:** `tellMeMoreCache` is a `Map` at module scope (outside the component). It survives component remount cycles during the session. Keyed by `event.id`.

#### `AboutPage.jsx` (~124 lines)

Fetches `/api/about` and `/api/team` in parallel via `Promise.all()` on mount. Uses a `cancelled` flag in the `useEffect` cleanup to prevent state updates if the component unmounts before fetches complete (prevents React memory leak warnings).

Renders dynamic text sections and team member photo cards. If a member has no `image_url`, a **fallback initials avatar** is shown — it extracts the first letter of each word in the member's name, takes the first two characters, and uppercases them (e.g. "Jane Smith" → "JS"). If the name is missing, it shows "?".

#### `LivePage.jsx` (~107 lines)

Displays four metric cards for solar activity: Latest Solar Flare, Geomagnetic Storm, Solar Wind Speed, and Sunspot Number. All values are **static placeholders** — live integration with NASA/NOAA APIs is not yet implemented.

Each card has a **flip interaction**: on hover the card rotates 180° to reveal a back face with a plain-English explanation of what that metric means and how to interpret its scale. This is implemented entirely with CSS hover states — no JavaScript state is involved.

No API calls are made. All metric values and descriptions are hardcoded in the `LIVE_METRICS` array at the top of the component.

#### `BirthdayPage.jsx` (~344 lines)

Two search modes toggled by the user: "Month / Day" (MM/DD) and "Birth Year" (YYYY). Each mode has its own input, validation, and API call. A `lastSearchRef` prevents duplicate API calls if the user submits the same input while results are already showing. The `/` character is auto-inserted after the month digits in the MM/DD input for convenience.

#### `AdminPage.jsx` (~3,327 lines)

The entire admin interface in one file.

**`ErrorBoundary` class component:** Wraps the admin event modal. If the modal crashes due to bad data, it renders the error stack trace instead of crashing the whole admin page.

**`AvatarCropModal`:** Uses `react-easy-crop` to let users crop a team photo to a circular area before uploading. The canvas clips the image to a circle at `image/jpeg` quality 0.9, converts to a base64 data URI, and sends it to the server. The original full-size file is never uploaded. Maximum output size is 2 MB (`MAX_PHOTO_BYTES` constant).

**Login UI flow:**

1. User enters username + password → submitted
2. If the account has a security question, the response contains the question text and the UI shows the security question field
3. User submits again with the security answer → logged in on success
4. `adminUser` state is set and the dashboard replaces the login form

**Admin tabs:**

- **Events:** Searchable table of all events filterable by year. Clicking a row opens `AdminEventModal`. There are two modes within the modal:
  - **Edit mode** — opens an existing event; article images load immediately from the API and uploads go to the server in real time.
  - **Create mode** — opens a blank form; article images added during create are **queued locally** (stored in `createQueuedMedia` state with a local object URL for preview) and only uploaded to the server after the event is saved and a real event ID exists. This prevents orphaned media uploads for events that are cancelled before saving.
- **About Page:** Inline editing of about sections. `display_order` controls the order on the public about page.
- **Team:** Add/edit/remove team members with photo upload and crop workflow.
- **Accounts** _(super admin only)_: Add/edit/delete admin user accounts. All fields (username, password, security question, security answer) are required when creating a new account.
- **Profile** _(non-super admins)_: Update own password and security question/answer independently.

**Add Article Modal:** Article uploads are handled through a dedicated modal (`addArticleOpen` state) that requires both a file and a caption before allowing submission — both fields show validation errors if missing. In create mode the file is stored locally; in edit mode it uploads immediately to the server.

**Global blocker overlay:** While `isSaving` / `teamBlocking` / `mediaUploadBusy` is true, a full-screen semi-transparent overlay prevents double-submission. Each section has its own blocking state with a text label (e.g. "Saving team member…", "Uploading article image 2 of 3…").

### 9.3. Dependencies Explained

#### Frontend (bundled by Vite for the browser)

| Package                         | Why it's needed                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `react` + `react-dom`           | The UI framework (v19)                                                                 |
| `react-router-dom`              | Client-side routing — `BrowserRouter`, `Routes`, `Route`, `useNavigate`, `useLocation` |
| `react-easy-crop`               | Used only in `AdminPage.jsx` for team photo crop-to-circle before upload               |
| `vite` + `@vitejs/plugin-react` | Build tool — compiles JSX, bundles assets, runs dev server with HMR                    |

#### Backend (Node.js runtime — not bundled)

| Package               | Why it's needed                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `express`             | HTTP server and routing (v5)                                                                                                                   |
| `cors`                | Sets `Access-Control-Allow-Origin` headers so the Vercel frontend can call the API                                                             |
| `mysql2`              | MySQL client with promise-based API for all database queries                                                                                   |
| `dotenv`              | Loads `.env` file into `process.env` at server startup                                                                                         |
| `bcrypt` / `bcryptjs` | Bcrypt password hashing. Both packages installed; `admin.js` uses `bcryptjs`                                                                   |
| `multer`              | Parses `multipart/form-data` requests for article uploads. Uses `memoryStorage()` — files held in RAM, not written to disk                     |
| `formidable`          | Form parsing library — installed as a dependency but not currently used directly in the main API files; may be used in future file upload work |
| `@aws-sdk/client-s3`  | AWS S3-compatible SDK. DigitalOcean Spaces uses the S3 API, so this package works directly                                                     |
| `openai`              | Official OpenAI Node.js SDK for GPT-4o calls                                                                                                   |
| `concurrently`        | Dev convenience — runs both `database.js` and `admin.js` simultaneously via `npm run start:api`                                                |

#### Dev Tools

| Package                  | Why it's needed                                              |
| ------------------------ | ------------------------------------------------------------ |
| `eslint` + plugins       | Lints React JSX, hooks rules, and refresh safety             |
| `eslint-config-prettier` | Disables ESLint rules that conflict with Prettier formatting |
| `prettier`               | Code formatter — run manually or integrate with your editor  |

---

## 10. File Storage (DigitalOcean Spaces)

DigitalOcean Spaces is an S3-compatible object storage service. The project uses `@aws-sdk/client-s3` (`PutObjectCommand` and `DeleteObjectCommand`) to manage files.

### Bucket Structure

```
newspaper-articles/          ← bucket name
├── articles/
│   └── event-{eventId}-{timestamp}-{12-char-hex}.{ext}
├── team/
│   └── member-{memberId}-{timestamp}-{10-char-hex}.{ext}
└── Background/
    └── Videos/
        ├── Sun.webm       ← ambient background video for SpaceVideos component
        └── Earth.webm     ← ambient background video for SpaceVideos component
```

**Two Spaces URL formats — important distinction:**

| Format     | Example                                                          | Used for                                                                                                            |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Origin URL | `https://newspaper-articles.nyc3.digitaloceanspaces.com/...`     | Stored in the database (`media_assets.url`, `team_members.image_url`). Used by the API for deletion key extraction. |
| CDN URL    | `https://newspaper-articles.nyc3.cdn.digitaloceanspaces.com/...` | Hardcoded in `SpaceVideos.jsx` for the background videos. Delivers files via edge cache for faster load times.      |

The CDN URL (`nyc3.cdn.digitaloceanspaces.com`) is not used for dynamically uploaded content because the API builds URLs from `SPACES_ORIGIN_URL`. If you want CDN delivery for article images in the future, you would update `SPACES_ORIGIN_URL` in `.env` to use the CDN subdomain — but be aware this changes all URLs stored in the database going forward.

### How Article Uploads Work (Multer → Spaces)

1. Frontend sends a `multipart/form-data` POST with a `file` field
2. `multer` with `memoryStorage()` holds the file buffer in RAM (not written to disk). Max: 12 MB
3. Server builds a unique key: `articles/event-{id}-{Date.now()}-{randomHex(12)}.{ext}`
4. File is uploaded to Spaces with `PutObjectCommand`, `ACL: 'public-read'`
5. Full public URL is constructed as `${SPACES_ORIGIN_URL}/${key}` and stored in `media_assets.url`

### How Team Photo Uploads Work (Base64 → Spaces)

1. User crops a photo in `AvatarCropModal` → frontend gets a base64 data URI from the canvas
2. JSON body `{ imageData: "data:image/jpeg;base64,..." }` is sent to `POST /api/admin/team/:id/photo`
3. Server extracts MIME type and base64 payload, then `Buffer.from(base64, 'base64')` converts to binary
4. Uploaded to Spaces under `team/member-{id}-{Date.now()}-{randomHex(10)}.{ext}`, `ACL: 'public-read'`
5. `team_members.image_url` is updated with the new URL

### How Deletions Work

1. Server fetches the current `url` from the database
2. Extracts the object key by stripping the `SPACES_ORIGIN_URL` prefix: `url.slice((publicBase + '/').length)`
3. Sends `DeleteObjectCommand` to Spaces
4. This deletion is in a nested `try/catch` — if it fails, a warning is logged but the DB record is still removed and the request still returns success ("best-effort" deletion)

### Access Control

All files are uploaded with `ACL: 'public-read'`. They are publicly accessible by URL with no authentication. Do not upload sensitive files to this bucket.

### File Naming

`randomHex()` suffixes prevent filename collisions and make URLs non-guessable. The `Date.now()` timestamp prefix makes the upload order visible in the Spaces dashboard.

---

## 11. How `vercel.json` Works

```json
{
  "routes": [
    { "src": "/api/(.*)", "dest": "https://api.solarimpacts.org/api/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

This file does two essential things:

**Rule 1 — API proxy:** Any request matching `/api/*` (e.g., `/api/events`, `/api/ai/tell-me-more`) is proxied to `https://api.solarimpacts.org/api/*`. The `(.*)` capture group and `$1` backreference preserve the rest of the path. This is how the React frontend (on Vercel) communicates with the Node.js backend (on DigitalOcean) using only relative URLs in the code.

**Rule 2 — SPA fallback routing:** `{ "handle": "filesystem" }` tells Vercel to serve actual static files from the build (JS, CSS, images) when they exist. The final catch-all `{ "src": "/(.*)", "dest": "/index.html" }` means any URL that doesn't match a static file gets served `index.html`. This is required for React Router to work correctly — without it, navigating directly to `/about` or refreshing any page except `/` would return a 404 from Vercel because there is no physical `/about/index.html` file in the build.

---

## 12. Deployment & Git Workflow

### Repository

- **URL:** https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact
- **Production branch:** `main`

### Deployment Flow

```
git push origin main
      │
      ├──▶ VERCEL (automatic — no action needed)
      │     Detects push, runs: npm run build
      │     Deploys /dist to CDN
      │     Live in ~1–2 minutes
      │
      └──▶ DIGITALOCEAN DROPLET (manual — SSH required)
            ssh root@<droplet-ip>
            cd /var/www/solar-events
            git pull origin main
            npm install       ← only if package.json changed
            pm2 restart all
```

### What Requires a Backend Deployment

You must SSH in and restart whenever you change:

- `admin.js` or `database.js`
- `package.json` (new or updated packages)
- `.env` values (edit the file on the server directly, then `pm2 restart all`)

You do **not** need to SSH in for changes to `.jsx`, `.css`, `utils.js`, `vercel.json`, or `vite_config.js` — these are all frontend-only and Vercel handles them automatically.

### Step-by-Step: Deploying Frontend Changes

```bash
git add .
git commit -m "Update timeline card styling"
git push origin main
# Vercel auto-deploys — monitor at vercel.com/dashboard
```

### Step-by-Step: Deploying Backend Changes

```bash
# 1. Push to GitHub
git add .
git commit -m "Fix media upload endpoint"
git push origin main

# 2. SSH into the server
ssh root@<droplet-ip>

# 3. Pull latest code
cd /var/www/solar-events
git pull origin main

# 4. Install dependencies (only if package.json changed)
npm install

# 5. Restart both API servers
pm2 restart all

# 6. Verify everything is running
pm2 status
```

---

## 13. Local Development

### Prerequisites

- Node.js 20.x LTS
- npm 9+
- A `.env` file with valid credentials (or connect to a local MySQL instance)

### Setup

```bash
# Clone the repository
git clone https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact.git
cd Solar-Impact

# Install all dependencies
npm install

# Create your .env file
cp .env.example .env
# Edit .env with your actual credentials — never commit this file
```

### Running Locally

Three things need to run simultaneously:

```bash
# Terminal 1 — Start both API servers
npm run start:api
# Uses concurrently to run:
#   node database.js  → port 4000
#   node admin.js     → port 4001

# Terminal 2 — Start the Vite frontend dev server
npm run dev
# App available at http://localhost:5173
```

### How Local API Routing Works

In dev, the frontend makes calls to relative URLs like `/api/events`. Vite's proxy config intercepts these:

```javascript
// vite_config.js
proxy: {
  '/api/admin': { target: 'http://localhost:4001' },  // admin.js
  '/api':        { target: 'http://localhost:4000' },  // database.js
}
```

The `/api/admin` rule must come first — if `/api` came first, it would match admin requests too since they also start with `/api`.

### Available Scripts

```bash
npm run dev           # Start Vite dev server (frontend only)
npm run build         # Production build → /dist
npm run preview       # Preview the production build locally
npm run start:main    # Start public API server only (port 4000)
npm run start:admin   # Start admin API server only (port 4001)
npm run start:api     # Start both API servers simultaneously
npm run lint          # Run ESLint
```

---

## 14. Server Setup Guide

How to set up a fresh DigitalOcean droplet from scratch.

### Initial System Setup

```bash
ssh root@<droplet-ip>

apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 globally
npm install -g pm2

apt install -y git
```

### Deploy the Application

```bash
mkdir -p /var/www
cd /var/www

git clone https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact.git solar-events
cd solar-events

npm install

# Create and populate the .env file
nano .env
```

### Start with PM2

```bash
pm2 start database.js --name solar-public
pm2 start admin.js --name solar-admin

# Save PM2 config so processes restart on reboot
pm2 save

# Register PM2 as a system startup service
pm2 startup
# ↑ Run the exact command that PM2 prints

pm2 status    # Verify both are running
```

### Optional: Nginx Reverse Proxy

If `api.solarimpacts.org` should resolve to the droplet:

```bash
apt install -y nginx
nano /etc/nginx/sites-available/solar-api
```

```nginx
server {
    listen 80;
    server_name api.solarimpacts.org;

    # Admin API — more specific rule must come first
    location /api/admin {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Public API
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/solar-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

SSL for `api.solarimpacts.org` is handled by Cloudflare.

---

## 15. Common Tasks & Maintenance

### Viewing Logs

```bash
pm2 logs solar-public --lines 50    # Public API + AI endpoint logs
pm2 logs solar-admin --lines 50     # Admin API logs
pm2 logs --lines 100                # All processes combined
pm2 monit                           # Real-time log + CPU/memory dashboard
```

Log prefixes: `[PUBLIC]` = database.js, `[ADMIN]` = admin.js, `[AI]` = AI endpoints.

### Restarting Services

```bash
pm2 restart all             # Restart both servers
pm2 restart solar-public    # Restart public API only
pm2 restart solar-admin     # Restart admin API only
pm2 status                  # Verify after restart
```

### Updating Environment Variables on the Server

```bash
ssh root@<droplet-ip>
cd /var/www/solar-events
nano .env            # Edit the variable
pm2 restart all      # Restart to pick up changes
```

### Creating a New Admin User

**Option A — Via the Admin Panel (recommended):**
Log in as super admin → Accounts tab → Add new user. Hashing is handled automatically.

**Option B — Directly via database:**

```bash
# 1. Generate a hash
node hash-password.js   # Edit plainPassword in the file first, then run

# 2. Connect to the database
mysql -h <db-host> -P 25060 -u solar_admin_app -p --ssl-ca=ca-certificate.crt

# 3. Insert the user
INSERT INTO admin_users (username, password_hash, is_protected)
VALUES ('newuser', '$2b$12$...your_hash_here...', 0);
```

### Database Backup

```bash
mysqldump \
  -h <db-host> \
  -P 25060 \
  -u solar_admin_app \
  -p \
  --ssl-ca=ca-certificate.crt \
  defaultdb > backup-$(date +%Y%m%d-%H%M).sql
```

### Checking Server Resources

```bash
free -h         # Memory usage
df -h           # Disk usage
pm2 monit       # CPU/memory per process in real time
```

---

## 16. Troubleshooting

### API Not Responding

```bash
pm2 status                          # Are both processes listed as "online"?
pm2 logs solar-public --lines 50    # Any startup errors?
pm2 logs solar-admin --lines 50
netstat -tlnp | grep 400            # Are ports 4000 and 4001 listening?
pm2 restart all                     # Try restarting
```

### Database Connection Failed

1. Verify `DB_HOST`, `DB_USER_PUBLIC`, `DB_PASSWORD_PUBLIC` (and admin equivalents) in `.env`
2. Check `DB_CA_CERT` — `\n` sequences must be literal backslash-n in the `.env` file, not real newlines
3. Test manually: `mysql -h <host> -P 25060 -u solar_admin_app -p --ssl-ca=ca-certificate.crt`
4. In DigitalOcean dashboard → database → Settings → Trusted Sources: verify the droplet's IP is listed

### CORS Errors in the Browser

1. Check `CORS_ORIGIN` in `.env` — must include the exact origin the browser reports (e.g., `https://www.solarimpacts.org` — `www` matters)
2. The code also allows all `*.vercel.app` URLs for Vercel preview deployments
3. Check the browser console for the specific blocked origin message

### Background Videos Not Showing

The `SpaceVideos` component loads `.webm` files from the CDN URL in Spaces. If they don't appear:

1. Check the browser console for 403/404 errors on the `.webm` URLs
2. Verify the files exist in Spaces under `Background/Videos/Sun.webm` and `Background/Videos/Earth.webm`
3. Confirm the files have `public-read` ACL in the Spaces dashboard
4. The videos only appear on `/`, `/live`, and `/birthday` — they intentionally don't render on `/about` or `/admin`
5. On mobile (<600px) the videos render at 30% opacity — this is intentional per the CSS

### Images Not Loading

1. Verify `SPACES_KEY`, `SPACES_SECRET`, `SPACES_BUCKET`, `SPACES_ORIGIN_URL` in `.env`
2. In DigitalOcean → Spaces → `newspaper-articles`, confirm the file exists and its path matches the URL in the database
3. Check the file has `public-read` ACL — files without it return 403

### Admin Login Not Working

```bash
# Check the user exists
mysql> SELECT id, username, is_protected FROM admin_users;

# Check login attempt logs
pm2 logs solar-admin | grep -i login
```

Common causes: wrong password (case-sensitive), wrong security answer (also case-sensitive), or a hash mismatch if the account was created with a different bcrypt library version. Hashes should always start with `$2b$12$` — if they start with something else, regenerate using `hash-password.js`.

### Page Returns 404 on Direct Navigation or Browser Refresh

`vercel.json` is either missing, malformed, or wasn't deployed. Verify the file is in the project root with the correct SPA fallback rule and redeploy by pushing to `main`.

### AI Features Not Working

```bash
pm2 logs solar-public | grep '\[AI\]'
```

- `401 / invalid_api_key` → `OPENAI_API_KEY` in `.env` is wrong or revoked
- `429` errors from OpenAI → your account has hit OpenAI's rate limits; check usage at platform.openai.com
- Server-side 429 during testing → you've hit the in-memory rate limiter (5 req/min for Tell Me More, 3 req/min for birthday/year). Wait a minute and retry.

### Frontend Build Fails on Vercel

1. Check the Vercel build logs in the dashboard
2. Reproduce locally with `npm run build`
3. Common causes: missing `VITE_ADMIN_API_BASE` environment variable in Vercel settings, a JSX syntax error, or an import that works locally but fails in CI

---

## 17. Security Considerations

### Credentials

- **Never commit `.env` to git** — it is in `.gitignore`
- Rotate the OpenAI API key, Spaces access keys, and database passwords periodically
- Use strong passwords: 16+ characters, mixed case, numbers, symbols
- Always revert `hash-password.js` to a placeholder password before committing

### Database Security

- `solar_public` has SELECT-only access — the public API cannot write to the database even if compromised
- All connections use SSL (`rejectUnauthorized: true`) — plain-text connections are rejected
- "Trusted Sources" in DigitalOcean should be restricted to only the droplet's IP

### API Security

- CORS is restricted to listed origins via `CORS_ORIGIN` — requests from unknown origins are blocked
- `*.vercel.app` origins are allowed for Vercel preview deployments — tighten this for production-only use
- Admin endpoints have no per-request token — security relies on CORS + credentials not being exposed
- All passwords and security answers are hashed with bcrypt (12 rounds) — never plaintext
- `is_protected = 1` super admin accounts cannot be deleted or modified via the API

### File Upload Security

- Multer enforces a 12 MB file size limit for article uploads
- MIME type is used for file extension guessing — consider adding server-side magic number validation for stricter enforcement
- All uploaded files are `public-read` — do not upload anything sensitive
- Random hex suffixes make file URLs non-guessable

### AI Security

- The in-memory rate limiter prevents a single IP from making excessive GPT-4o calls (cost protection)
- User-provided inputs (month, day, year) are validated before being interpolated into prompts
- No unvalidated user input is passed directly to OpenAI

### Recommendations

1. Enable 2FA on all DigitalOcean, Vercel, Cloudflare, and OpenAI accounts
2. Periodically audit `admin_users` — remove stale accounts
3. Monitor OpenAI API usage for unexpected cost spikes
4. Keep Node.js, npm packages, and Ubuntu packages up to date
5. Consider adding rate limiting to the admin login endpoint to prevent brute-force attacks

---

## 18. Cost Summary

| Service              | Monthly Cost            | Notes                                                                       |
| -------------------- | ----------------------- | --------------------------------------------------------------------------- |
| DigitalOcean Droplet | ~$6                     | 1 GB RAM, 1 vCPU, 25 GB SSD                                                 |
| DigitalOcean MySQL   | ~$15                    | Managed, 1 GB RAM, automatic backups included                               |
| DigitalOcean Spaces  | $5                      | 250 GB storage, 1 TB bandwidth                                              |
| Vercel               | $0                      | Free hobby tier                                                             |
| Cloudflare           | $0                      | Free tier                                                                   |
| OpenAI API           | Variable                | GPT-4o pay-per-use. Low traffic: ~$1–5/month. Scales with AI feature usage. |
| **Total**            | **~$26/month + OpenAI** |                                                                             |

---

## Quick Reference Card

### URLs

- **Website:** https://www.solarimpacts.org
- **Admin:** https://www.solarimpacts.org/admin
- **API (public + AI):** https://api.solarimpacts.org → port 4000 on droplet
- **API (admin):** https://api.solarimpacts.org → port 4001 on droplet
- **GitHub:** https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact
- **Spaces bucket:** https://newspaper-articles.nyc3.digitaloceanspaces.com

### SSH Access

```bash
ssh root@<droplet-ip>
# Find current IP in DigitalOcean dashboard
```

### PM2 Quick Commands

```bash
pm2 status                   # All running processes
pm2 restart all              # Restart both API servers
pm2 logs --lines 100         # Recent logs (all processes)
pm2 logs solar-public        # Public API + AI endpoint logs
pm2 logs solar-admin         # Admin API logs
pm2 monit                    # Real-time CPU/memory + logs dashboard
```

### Deploy Backend Changes

```bash
ssh root@<droplet-ip>
cd /var/www/solar-events
git pull origin main
npm install          # Only if package.json changed
pm2 restart all
pm2 status           # Confirm both online
```

### Key Server Files

```
/var/www/solar-events/
├── database.js        # Public API (port 4000) — events, media, about, team, AI
├── admin.js           # Admin API (port 4001) — auth, all CRUD, file uploads
├── hash-password.js   # Utility: generate bcrypt hash for direct DB insertion
├── package.json
└── .env               # ALL credentials — NEVER commit this file
```

### Key Frontend Files

```
SpaceVideos.jsx        # Ambient background videos — edit PAGE_CONFIG to adjust per-route
Pages/Home/HomePage.jsx    # Timeline + overlays
Pages/Admin/AdminPage.jsx  # Full admin portal
utils.js               # API constants + shared date/sort helpers
vercel.json            # API proxy rules + SPA fallback — must exist for routing to work
```

### Port Map

| Port | Server          | Purpose                             |
| ---- | --------------- | ----------------------------------- |
| 4000 | `database.js`   | Public read-only API + AI endpoints |
| 4001 | `admin.js`      | Admin CRUD API + authentication     |
| 5173 | Vite dev server | Local development only              |

---

## Support Contacts

| Role                 | Contact                  |
| -------------------- | ------------------------ |
| Original Developer   | [Your contact info]      |
| DigitalOcean Support | support.digitalocean.com |
| Vercel Support       | vercel.com/support       |
| Cloudflare Support   | support.cloudflare.com   |
| OpenAI Support       | help.openai.com          |

---

_Document Version: 4.0 — February 2026_
