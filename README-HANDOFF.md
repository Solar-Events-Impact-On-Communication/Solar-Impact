# Solar Events — Complete Project Handoff Documentation

**Last Updated:** February 2026
**Project URL:** https://www.solarimpacts.org
**Admin URL:** https://www.solarimpacts.org/admin
**API URL:** https://api.solarimpacts.org

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [Repository & Git Workflow](#4-repository--git-workflow)
5. [Local Development](#5-local-development)
6. [Backend — In-Depth Explanation](#6-backend--in-depth-explanation)
7. [Frontend — In-Depth Explanation](#7-frontend--in-depth-explanation)
8. [Environment Variables](#8-environment-variables)
9. [Database Schema](#9-database-schema)
10. [API Documentation](#10-api-documentation)
11. [File Storage (DigitalOcean Spaces)](#11-file-storage-digitalocean-spaces)
12. [Infrastructure Details](#12-infrastructure-details)
13. [DigitalOcean Droplet — Server Operations](#13-digitalocean-droplet--server-operations)
    - 13.1 [Accessing the Droplet (Browser Console & SSH)](#accessing-the-droplet--two-options)
    - 13.2 [Adding a New Developer's SSH Key](#adding-a-new-developers-ssh-key-to-the-droplet)
14. [Deployment Workflow](#14-deployment-workflow)
15. [Server Setup Guide (Fresh Start)](#15-server-setup-guide-fresh-start)
16. [Common Tasks & Maintenance](#16-common-tasks--maintenance)
17. [Troubleshooting](#17-troubleshooting)
18. [Security Considerations](#18-security-considerations)
19. [Cost Summary](#19-cost-summary)
20. [Quick Reference Card](#20-quick-reference-card)

---

## 1. Project Overview

Solar Events is a web application that displays a timeline of historical solar events — solar flares, geomagnetic storms, and other space weather phenomena — along with their impacts on communication systems throughout history. The goal is to make this complex scientific history accessible and visually engaging to a general audience.

### Pages & Features

- **Public Timeline** (`/`) — The core feature. An interactive, year-based timeline showing solar events with detailed overlays, historical newspaper articles, and an AI-powered "Tell Me More" feature per event.
- **Birthday Lookup** (`/birthday`) — Users enter their birthday (month and day) and are shown all solar events that occurred on that date throughout history, powered by an AI-generated narrative summary.
- **Live Data** (`/live`) — Dashboard displaying live solar activity metrics (currently static placeholder data; intended for future NOAA SWPC integration).
- **About** (`/about`) — Dynamically managed content sections about the project, along with team member profiles, all editable via the admin panel.
- **Admin Panel** (`/admin`) — Protected interface for full content management: events, media, about sections, team members, and admin accounts.

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
│              VITE_ADMIN_API_BASE = https://api.solarimpacts.org             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DIGITALOCEAN DROPLET                                     │
│                   ubuntu-s-1vcpu-1gb-nyc3-01                                 │
│                        (API Server)                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐                       │
│  │   database.js        │    │     admin.js         │                       │
│  │   (Public API)       │    │   (Admin API)        │                       │
│  │   Port: 4000         │    │   Port: 4001         │                       │
│  │   READ-ONLY          │    │   CRUD Operations    │                       │
│  │                      │    │                      │                       │
│  │   /api/events        │    │   /api/admin/login   │                       │
│  │   /api/events/:id/   │    │   /api/admin/events  │                       │
│  │     media            │    │   /api/admin/media   │                       │
│  │   /api/about         │    │   /api/admin/about   │                       │
│  │   /api/team          │    │   /api/admin/team    │                       │
│  │   /api/ai/tell-me/   │    │   /api/admin/users   │                       │
│  │   /api/ai/birthday/  │    │                      │                       │
│  └──────────────────────┘    └──────────────────────┘                       │
│            │                           │                                     │
└────────────┼───────────────────────────┼─────────────────────────────────────┘
             │                           │
             ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIGITALOCEAN MANAGED MySQL                                │
│                      solar-events-db-mysql                                   │
│                                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │solar_events │  │media_assets │  │about_       │  │team_members │       │
│   │             │  │             │  │sections     │  │             │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                              │
│   ┌─────────────┐  ┌─────────────────┐                                      │
│   │admin_users  │  │security_questions│                                      │
│   └─────────────┘  └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIGITALOCEAN SPACES                                       │
│                     newspaper-articles                                       │
│               newspaper-articles.nyc3.digitaloceanspaces.com                │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  /articles/event-{id}-{timestamp}-{hash}.{ext}  (newspaper scans)   │   │
│   │  /team/member-{id}-{timestamp}-{hash}.{ext}     (team photos)       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend

| Technology       | Version           | Purpose                               |
| ---------------- | ----------------- | ------------------------------------- |
| React            | 19.x              | UI Framework                          |
| react-router-dom | 6.x               | Client-side routing (multi-page SPA)  |
| Vite             | 7.x               | Build tool & dev server               |
| react-easy-crop  | 5.x               | Avatar image cropping for team photos |
| CSS              | Custom (per-page) | Styling                               |

### Backend

| Technology         | Version  | Purpose                               |
| ------------------ | -------- | ------------------------------------- |
| Node.js            | 20.x LTS | Runtime                               |
| Express            | 5.x      | Web framework                         |
| mysql2             | 3.x      | Database driver with promise support  |
| bcrypt / bcryptjs  | Latest   | Password hashing (12 rounds)          |
| multer             | 2.x      | File upload handling                  |
| @aws-sdk/client-s3 | 3.x      | Spaces file storage (S3-compatible)   |
| openai             | 6.x      | AI "Tell Me More" + Birthday features |
| concurrently       | Latest   | Run both API servers simultaneously   |
| PM2                | Latest   | Process manager on the droplet        |

### Infrastructure

| Service          | Provider                   | Purpose             |
| ---------------- | -------------------------- | ------------------- |
| Frontend Hosting | Vercel                     | Static site hosting |
| API Server       | DigitalOcean Droplet       | Node.js API hosting |
| Database         | DigitalOcean Managed MySQL | Data storage        |
| File Storage     | DigitalOcean Spaces        | Images & documents  |
| DNS/SSL          | Cloudflare                 | Domain & HTTPS      |

---

## 4. Repository & Git Workflow

### Repositories

There are **two separate GitHub repositories**:

| Repo              | URL                                                                  | Purpose                            |
| ----------------- | -------------------------------------------------------------------- | ---------------------------------- |
| **Production**    | https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact | Deployed to Vercel and the droplet |
| **Dev (Private)** | https://github.com/Solar-Events-Impact-On-Communication/Dev          | Active development work            |

**Important:** Day-to-day development happens in the **Dev** repository. Work is moved to the production repository when ready to deploy. The Dev repo is private — contributors must be granted access in GitHub.

### Branch Strategy

- `main` on the production repo is what Vercel watches and what the droplet pulls from.
- The Dev repo is used for feature work, experiments, and testing before merging into production.

---

## 5. Local Development

### What's Not Included in the Repo

Two folders are intentionally excluded from the repository — you must generate them yourself before the project will run:

| Folder          | How to generate | Why it's excluded                                      |
| --------------- | --------------- | ------------------------------------------------------ |
| `node_modules/` | `npm install`   | Hundreds of MB, OS-specific, always regenerated        |
| `dist/`         | `npm run build` | Auto-generated build output, recreated on every deploy |

You do **not** need to manually create or copy these — the commands below handle it.

### Prerequisites

- Node.js 20.x LTS
- npm 9+
- Access to the production DB credentials (already included in the repo's `.env`)

### Setup

```bash
# Clone the Dev repository (not the production repo)
git clone https://github.com/Solar-Events-Impact-On-Communication/Dev.git
cd Dev

# Install all dependencies — this generates node_modules/
npm install

# The .env file is already included in this repo with real credentials
# Do not overwrite it unless you know what you're changing
```

If you ever need to generate the production build locally (e.g. to test it):

```bash
# This generates the dist/ folder
npm run build
```

In normal development you won't need this — `npm run dev` runs the app directly from source without needing a build.

### Running Locally

The project requires **both backend API servers AND the Vite frontend dev server** running at the same time. The Vite dev server proxies API calls to the backends automatically via `vite.config.js`, so no CORS configuration is needed locally.

```bash
# Start BOTH backend servers simultaneously (recommended)
npm run start:api
# This uses `concurrently` to run:
#   database.js on port 4000 (public API)
#   admin.js on port 4001 (admin API)

# In a second terminal, start the frontend
npm run dev
# App available at http://localhost:5173
```

If you need to run the servers separately:

```bash
npm run start:main    # Public API only (port 4000)
npm run start:admin   # Admin API only (port 4001)
```

### Vite Proxy Rules

The Vite config (`vite.config.js`) routes requests so the frontend doesn't need to know about backend ports:

- `/api/admin/*` → proxied to `http://localhost:4001`
- `/api/*` → proxied to `http://localhost:4000`

In production, the frontend uses `VITE_ADMIN_API_BASE` to make cross-origin requests to `api.solarimpacts.org` directly.

---

## 6. Backend — In-Depth Explanation

The backend consists of **two completely separate Node.js/Express servers**, each running as its own process. This separation keeps the public-facing read API isolated from the admin write API both in terms of code and database credentials.

### Why Two Servers?

Separating the public and admin APIs provides security and clarity:

- The public server (`database.js`) only connects to the database as `solar_public`, a read-only user. Even if this server were compromised, it cannot write to the database.
- The admin server (`admin.js`) connects as `solar_admin_app` with full CRUD access, but is only used by authenticated admin users.
- Nginx on the droplet routes `/api/admin/*` to port 4001 and all other `/api/*` to port 4000.

---

### `database.js` — Public API (Port 4000)

This is the read-only server that powers the public-facing site.

**Sections of the file:**

**01. Environment + Paths** — Loads `.env` and resolves `__dirname` (required when using ES Modules).

**02. Helpers** — Two key helpers:

- `getCaCert()` — Reads the MySQL SSL CA certificate. In production this comes from the `DB_CA_CERT` environment variable (with escaped `\n` characters converted to real newlines). In local dev, it falls back to reading a `ca-certificate.crt` file from disk.
- `buildCorsOptions()` — Reads `CORS_ORIGIN` from `.env` (comma-separated list of allowed origins) and returns a CORS config. This means allowed origins are controlled entirely via environment variable — no code changes needed to add a new domain.

**03. Express App + Middleware** — Standard Express setup: JSON body parser, CORS middleware using the options built above.

**04. MySQL Connection Pool** — Creates a `mysql2` connection pool using the `solar_public` database credentials with SSL enabled. A pool is used (rather than a single connection) so the server can handle multiple concurrent requests without waiting for a single connection to free up.

**05. Routes:**

- `GET /api/health` — Simple health check. Returns `{ status: "ok" }`. Useful for verifying the server is alive.
- `GET /api/events` — Returns all events from `solar_events` ordered by date. This is the primary data source for the homepage timeline.
- `GET /api/events/:id/media` — Returns all newspaper/image assets associated with a specific event from `media_assets`.
- `GET /api/about` — Returns all about sections ordered by `display_order`.
- `GET /api/team` — Returns all team members ordered by `display_order`.
- `POST /api/ai/tell-me-more` — Accepts an event object in the request body and calls the OpenAI API to generate an expanded, engaging explanation of that solar event. Returns a text narrative. Responses are NOT cached on the server; caching happens in the frontend.
- `POST /api/ai/birthday` — Accepts a month/day and a list of matching events, then calls OpenAI to generate a personalized birthday narrative summarizing what happened in solar history on that date.

**06. Server Bootstrap** — Starts the server on `PUBLIC_PORT` (default 4000).

---

### `admin.js` — Admin API (Port 4001)

This server handles all create, update, and delete operations. It requires authentication on every protected route.

**Key Differences from `database.js`:**

- Connects to MySQL as `solar_admin_app` (full CRUD access).
- Uses `multer` for multipart file uploads (newspaper articles).
- Uses `@aws-sdk/client-s3` to upload/delete files in DigitalOcean Spaces.
- Has session-like authentication: login verifies username + password + security answer, then the client stores a simple auth state. All admin routes check this auth state.
- Uses `bcrypt`/`bcryptjs` to verify hashed passwords and security answers.

**Authentication Flow:**

1. `POST /api/admin/login` — Client sends `{ username, password, securityAnswer }`.
2. Server fetches the user from `admin_users`, verifies the bcrypt password hash, then verifies the bcrypt security answer hash.
3. On success, returns user info. The frontend stores auth state in React state. There is no JWT or cookie — the admin panel must log in again on refresh.

**File Upload Flow (Event Media):**

1. Admin uploads a file via the admin panel.
2. `multer` buffers the file in memory.
3. The file is uploaded to DigitalOcean Spaces under `articles/event-{id}-{timestamp}-{hex}.{ext}` with `public-read` ACL.
4. The resulting public URL and object key are saved to `media_assets` in the database.
5. On delete, the record is removed from `media_assets` AND the file is deleted from Spaces.

**File Upload Flow (Team Photos):**

1. Admin crops the photo in the browser using `react-easy-crop`, which produces a base64 data URL.
2. The base64 string is sent as JSON in the request body (not multipart).
3. The server decodes the base64 to a buffer and uploads to Spaces under `team/member-{id}-{timestamp}-{hex}.{ext}`.
4. The URL is saved to `team_members.image_url`.

---

### `hash-password.js` — Utility Script

A standalone Node.js script that interactively prompts for a plain-text password and outputs a bcrypt hash (12 rounds). Used when creating new admin users manually. Run with `node hash-password.js`.

---

### `package.json` Scripts Reference

```json
"start:api"   → concurrently "node database.js" "node admin.js"
"start:main"  → node database.js
"start:admin" → node admin.js
"dev"         → vite
"build"       → vite build
"preview"     → vite preview
```

---

## 7. Frontend — In-Depth Explanation

The frontend is a React single-page application (SPA) built with Vite. React Router handles all navigation client-side — there is no server-side rendering. Each page has its own `.jsx` component file and a paired `.css` file for styles.

### File Structure

```
solar-events/
├── App.jsx                   # App shell: topbar, nav drawer, router, footer
├── App.css                   # Global styles, topbar, nav drawer
├── main.jsx                  # React entry point (wraps in BrowserRouter)
├── index.html                # HTML entry point (Vite)
├── utils.js                  # Shared helpers, API base URLs, date formatters
│
├── HomePage.jsx              # Timeline view, event overlay, media overlay
├── HomePage.css
├── AboutPage.jsx             # About sections + team member cards
├── AboutPage.css
├── LivePage.jsx              # Live solar data dashboard (placeholder)
├── LivePage.css
├── BirthdayPage.jsx          # Birthday solar event lookup
├── BirthdayPage.css
├── AdminPage.jsx             # Full admin portal (~3,300+ lines)
├── AdminPage.css
├── BackgroundVideos.jsx      # Background video component
├── BackgroundVideos.css
│
├── admin.js                  # Backend: Admin API server (port 4001)
├── database.js               # Backend: Public API server (port 4000)
├── hash-password.js          # Utility: bcrypt password hasher
├── package.json
├── vite_config.js            # Vite config with proxy rules
├── vercel.json               # Vercel SPA rewrite config
└── .env                      # Environment variables (DO NOT COMMIT)
```

---

### `main.jsx` — Entry Point

Wraps the entire app in React's `<BrowserRouter>` so that React Router can manage navigation. Renders `<App />` into the `#root` div in `index.html`.

---

### `App.jsx` — Application Shell

`App.jsx` is the top-level wrapper. It handles everything that persists across all pages: the topbar, the nav drawer, the route definitions, and the footer. It also fetches the master events list on mount and passes it down to `HomePage` as props — this means events are fetched once and not re-fetched when navigating away and back.

**Key responsibilities:**

- **Event data fetching** — `GET /api/events` is called on mount. Events, loading state, and error state are stored in `App` and passed to `HomePage`. This avoids re-fetching on every navigation.
- **Topbar** — Displays the site title and solar activity icon. On the timeline page, the topbar adapts its layout when the viewport is narrow (stacked vs. inline), ensuring usability on small screens.
- **Year Search** — A text input on the topbar lets users type a year to jump to it on the timeline. A decade browse popover allows clicking through decades. Both communicate with `HomePage` via the `scrollToYear` prop.
- **Nav Drawer** — A slide-in side menu with links to all pages. Closes automatically on navigation.
- **Footer** — Copyright and tagline, shown on all pages.

**Key state in `App()`:**

```javascript
[events, loadingEvents, eventsError]; // Master event list from /api/events
menuOpen; // Nav drawer open/closed
topbarStacked[(yearQuery, scrollToYear)][(showYearPicker, pickerDecade)][(searchInfo, searchError)]; // Whether topbar uses 2-row layout // Year search input and active scroll target // Decade browse popover state // Feedback banners for year search
```

**Routes:**

```
/           → <HomePage />
/about      → <AboutPage />
/live       → <LivePage />
/birthday   → <BirthdayPage />
/admin      → <AdminPage />
```

---

### `HomePage.jsx` — Timeline

The core of the application. Receives the `events` array from `App` and renders the main year-grouped timeline.

**Timeline structure:** Events are grouped by year. Each year renders as a labeled section on the timeline. Events within a year are displayed as clickable cards showing the event title and type.

**`EventDetailOverlay`** — A slide-in panel that opens when the user clicks an event. Displays the event date, type, title, summary, and impact on communication. Contains the "Tell Me More" button which triggers an OpenAI call. Contains a "View Articles" button if the event has associated newspaper scans.

**AI "Tell Me More" feature:** When clicked, the frontend calls `POST /api/ai/tell-me-more` with the event data. The response is displayed in the overlay. Results are cached in a module-level `Map` called `tellMeMoreCache` keyed by event ID — meaning repeat opens of the same event don't make duplicate API calls, and the cache persists for the lifetime of the browser session.

**`MediaOverlay`** — A full-screen newspaper image viewer. Loads media from `GET /api/events/:id/media`. Supports previous/next navigation between multiple articles for the same event.

---

### `BirthdayPage.jsx` — Birthday Lookup

Allows users to enter a birthday (month and day, or full date) and discover solar events from history that occurred on that date.

**Flow:**

1. User enters a month/day combination.
2. The frontend filters the `events` array (passed from `App`) by matching month and day.
3. Matching events are displayed as result cards.
4. An AI summary is generated via `POST /api/ai/birthday`, sending the matched events to OpenAI for a narrative about "your birthday in solar history."

---

### `AboutPage.jsx` — About + Team

Fetches both `/api/about` and `/api/team` in parallel on component mount using `Promise.all`. Renders the dynamic content sections followed by team member photo cards. Both the text sections and team roster are manageable through the admin panel without code changes.

---

### `LivePage.jsx` — Live Data Dashboard

Currently a placeholder. Displays static mock values for solar flare class, geomagnetic storm level, and other space weather indicators with styled status badges. Intended for future integration with a real-time solar data API such as NOAA's SWPC (Space Weather Prediction Center).

---

### `AdminPage.jsx` — Admin Portal

The largest file in the project (~3,300+ lines). Contains the entire admin interface as a self-contained component tree. All admin interaction — from login to content editing — happens here.

**`ErrorBoundary`** — A class component wrapping the admin modal. If a render crash occurs inside a modal, it catches the error and displays a fallback rather than crashing the entire page.

**`AvatarCropModal`** — Uses `react-easy-crop` to let admins crop a team member photo to a circle before uploading. The crop result is a base64 data URL that gets sent to the server.

**Login form** — Three-field login: username, password, and a security question/answer. All three must match records in the database. There is no persistent session — the admin must log in again after a page refresh.

**Tabs after login:**

| Tab      | Who sees it       | Description                                                  |
| -------- | ----------------- | ------------------------------------------------------------ |
| Events   | All admins        | Table of all events with edit/delete; opens full event modal |
| About    | All admins        | Add/edit/delete about page content sections; drag-to-reorder |
| Team     | All admins        | Add/edit/remove team members with photo upload and crop      |
| Accounts | Super admins only | Full admin user management (add, edit, delete)               |
| Profile  | Non-super admins  | View and edit their own admin profile                        |

**`AdminEventModal`** — Full event editing form: date, event type, location, title, short description, full summary, impact on communication. Also manages associated newspaper article images (upload new, view existing, delete).

**`AccountModal`** — Add or edit an admin user: username, password, security question, security answer. Password is hashed server-side on save.

**Global blocker** — A full-screen loading overlay (`isGlobalLoading` state) is shown while save/delete operations are in-flight to prevent accidental duplicate submissions.

---

### `utils.js` — Shared Helpers

Centralized constants and utility functions used across components.

```javascript
// API base URLs
API_BASE; // '' — empty string; in dev, Vite proxies; in prod, same-origin-ish
ADMIN_API_BASE; // import.meta.env.VITE_ADMIN_API_BASE || ''
// In production this is https://api.solarimpacts.org

// URL helper
joinUrl(base, path); // Safely joins base + path without double slashes

// Date formatting
formatEventDateLabel(dateStr); // "September 1"
formatEventDateLabelWithYear(dateStr); // "September 1, 1859"
formatFullDateLong(dateStr); // "September 1, 1859"
extractYear(dateStr); // "1859"
parseMonthDay(str); // { monthIndex: 8, day: 1 }
sortEventsByDate(events); // Sorts events within a year chronologically
getEventYear(dateStr); // "1859" or null
```

---

### `vercel.json` — SPA Routing Fix

This file is **critical** and must not be removed. Because this is a React Router SPA, URLs like `/about` or `/admin` don't correspond to real files. If a user navigates directly to one of these URLs or refreshes the page, Vercel would return a 404. The rewrite rule in `vercel.json` tells Vercel to serve `index.html` for all routes, allowing React Router to handle them:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 8. Environment Variables

### Droplet `.env` File

The `.env` file lives at `/var/www/solar-events/.env` on the droplet. It is **not committed to Git** (listed in `.gitignore`). It is not visible in a standard `ls` directory listing but is present — use `nano .env` to view or edit it.

**Important:** Any time a new environment variable is added to the codebase, it must be **manually added to the `.env` file on the droplet** via SSH. Changes to `.env` on the droplet require a PM2 restart to take effect (`pm2 restart all`).

```bash
# =========================
# Database Connection
# =========================
DB_HOST=solar-events-db-mysql-do-user-XXXXXXX-0.d.db.ondigitalocean.com
DB_PORT=25060
DB_NAME=defaultdb

# Public API (READ-ONLY access)
DB_USER_PUBLIC=solar_public
DB_PASSWORD_PUBLIC=<public_user_password>

# Admin API (CRUD access)
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
# SSL Certificate (MySQL)
# =========================
DB_CA_CERT="-----BEGIN CERTIFICATE-----\n<certificate_content>\n-----END CERTIFICATE-----"
# Note: \n must be literal backslash-n in the .env file, not real newlines.
# The server converts them automatically.

# =========================
# Server Config
# =========================
ADMIN_PORT=4001
PUBLIC_PORT=4000

# CORS (comma-separated allowed origins — no spaces between entries)
CORS_ORIGIN=https://www.solarimpacts.org,https://solarimpacts.org

# =========================
# OpenAI (Tell Me More + Birthday features)
# =========================
OPENAI_API_KEY=<your_openai_api_key>
```

### Vercel Environment Variables

Set these in the Vercel dashboard under **Settings → Environment Variables**. Vercel rebuilds automatically when these change.

| Variable              | Value                          |
| --------------------- | ------------------------------ |
| `VITE_ADMIN_API_BASE` | `https://api.solarimpacts.org` |

---

## 9. Database Schema

### Table: `solar_events`

Primary table for all solar event data.

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

| Column                    | Type            | Description                             |
| ------------------------- | --------------- | --------------------------------------- |
| `id`                      | bigint unsigned | Auto-increment primary key              |
| `event_date`              | date            | Date of the solar event                 |
| `event_type`              | varchar(255)    | e.g. "Solar Flare", "Geomagnetic Storm" |
| `location`                | varchar(255)    | Geographic location affected (nullable) |
| `title`                   | varchar(255)    | Event title                             |
| `short_description`       | varchar(500)    | Brief description for timeline cards    |
| `summary`                 | text            | Full event description                  |
| `impact_on_communication` | text            | How the event affected communications   |

### Table: `media_assets`

Newspaper articles and images linked to events.

```sql
CREATE TABLE `media_assets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint unsigned NOT NULL,
  `url` varchar(500) NOT NULL,
  `object_key` varchar(512) DEFAULT NULL,
  `caption` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_media_assets_event` (`event_id`),
  KEY `idx_media_assets_object_key` (`object_key`),
  CONSTRAINT `fk_media_assets_event` FOREIGN KEY (`event_id`)
    REFERENCES `solar_events` (`id`) ON DELETE CASCADE
);
```

**Note:** `ON DELETE CASCADE` means deleting an event automatically deletes all of its associated media records. The actual files in Spaces must still be deleted separately by the admin API before or after.

### Table: `about_sections`

Dynamic text content for the About page.

```sql
CREATE TABLE `about_sections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `display_order` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `text` text NOT NULL,
  PRIMARY KEY (`id`)
);
```

### Table: `team_members`

Team member profiles displayed on the About page.

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

### Table: `admin_users`

Admin authentication accounts.

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

`is_protected = 1` marks a super admin account that cannot be deleted through the admin UI. This prevents accidental lockout.

### Table: `security_questions`

Predefined security questions selectable during account creation.

```sql
CREATE TABLE `security_questions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `question_text` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
);
```

### Database Users & Permissions

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

---

## 10. API Documentation

### Public API (`database.js`) — Port 4000

#### Health Check

```
GET /api/health
Response: { "status": "ok", "message": "Solar Events API is running" }
```

#### Get All Events

```
GET /api/events
Response: [
  {
    "id": 1,
    "event_date": "1859-09-01",
    "event_type": "Solar Flare",
    "location": "Worldwide",
    "title": "Carrington Event",
    "short_description": "Most intense geomagnetic storm...",
    "summary": "Full description...",
    "impact_on_communication": "Telegraph systems failed..."
  },
  ...
]
```

#### Get Media for Event

```
GET /api/events/:id/media
Response: [
  {
    "id": 1,
    "event_id": 1,
    "url": "https://newspaper-articles.nyc3.digitaloceanspaces.com/articles/...",
    "object_key": "articles/event-1-...",
    "caption": "New York Times coverage..."
  }
]
```

#### Get About Sections

```
GET /api/about
Response: [
  { "id": 1, "display_order": 1, "title": "Our Mission", "text": "Content..." },
  ...
]
```

#### Get Team Members

```
GET /api/team
Response: [
  { "id": 1, "name": "John Doe", "role": "Lead Researcher", "image_url": "..." },
  ...
]
```

#### AI — Tell Me More

```
POST /api/ai/tell-me-more
Body: { event object }
Response: { "narrative": "Extended AI-generated explanation..." }
```

#### AI — Birthday Events

```
POST /api/ai/birthday
Body: { "monthDay": "09-01", "events": [ ...matching events ] }
Response: { "narrative": "Here's what happened in solar history on your birthday..." }
```

---

### Admin API (`admin.js`) — Port 4001

All admin endpoints require prior authentication via the login endpoint.

#### Authentication

```
POST /api/admin/login
Body: { "username": "...", "password": "...", "securityAnswer": "..." }
Response (success): { "success": true, "user": { "id": 1, "username": "...", "is_protected": 0 } }
Response (failure): { "success": false, "message": "Invalid credentials" }
```

#### Security Questions

```
GET /api/admin/security-questions
Response: [{ "id": 1, "question_text": "..." }, ...]
```

#### Events CRUD

```
GET    /api/admin/events          — List all events
POST   /api/admin/events          — Create event
PUT    /api/admin/events/:id      — Update event
DELETE /api/admin/events/:id      — Delete event
```

#### Media CRUD

```
GET    /api/admin/events/:id/media     — Get media for event
POST   /api/admin/events/:id/media     — Upload new media (multipart/form-data)
PUT    /api/admin/media/:id/caption    — Update caption
DELETE /api/admin/media/:id            — Delete media (removes from DB and Spaces)
```

#### About Sections CRUD

```
GET    /api/admin/about           — List all sections
POST   /api/admin/about           — Create section
PUT    /api/admin/about/:id       — Update section
DELETE /api/admin/about/:id       — Delete section
```

#### Team Members CRUD

```
GET    /api/admin/team            — List all members
POST   /api/admin/team            — Create member
PUT    /api/admin/team/:id        — Update member
DELETE /api/admin/team/:id        — Delete member
POST   /api/admin/team/:id/photo  — Upload photo (base64 JSON body)
DELETE /api/admin/team/:id/photo  — Remove photo (removes from DB and Spaces)
```

#### Admin Users CRUD (Super Admin Only)

```
GET    /api/admin/users           — List all admin accounts
POST   /api/admin/users           — Create account
PUT    /api/admin/users/:id       — Update account
DELETE /api/admin/users/:id       — Delete account
```

---

## 11. File Storage (DigitalOcean Spaces)

### Bucket Structure

```
newspaper-articles/
├── articles/
│   └── event-{eventId}-{timestamp}-{randomHex}.{ext}
└── team/
    └── member-{memberId}-{timestamp}-{randomHex}.{ext}
```

### Access Control

All uploaded files are set to `public-read` ACL. They are directly accessible by URL without authentication:

```
https://newspaper-articles.nyc3.digitaloceanspaces.com/{object_key}
```

### Upload Size Limits

- Event media (newspaper scans): 12 MB max per file
- Team photos: 2 MB max per photo (after browser-side crop)

---

## 12. Infrastructure Details

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
- **Connection:** SSL required (CA certificate provided via `.env`)

### DigitalOcean Spaces

- **Bucket Name:** `newspaper-articles`
- **URL:** https://newspaper-articles.nyc3.digitaloceanspaces.com
- **Region:** NYC3
- **Plan:** $5/month (250 GB storage, 1 TB bandwidth)

### Cloudflare

- **Domain:** solarimpacts.org
- **Proxy:** Enabled (orange cloud — Cloudflare proxies traffic)
- **SSL Mode:** Full (strict)

### Vercel

- **Project Name:** solar-events
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Auto-deploy:** Yes, on push to `main` branch of the production GitHub repo

---

## 13. DigitalOcean Droplet — Server Operations

### Accessing the Droplet — Two Options

There are two ways to get into the droplet: via the **DigitalOcean browser console** (no setup required) or via **SSH from your local terminal** (requires your SSH key to be added first).

---

#### Option A — DigitalOcean Browser Console (Easiest, No Setup)

This is the quickest way in, especially for a new developer who hasn't set up SSH yet. It runs a terminal directly in your browser.

1. Log in to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. In the left sidebar, click **Droplets**
3. Click on the droplet named **`ubuntu-s-1vcpu-1gb-nyc3-01`**
4. In the top right of the droplet detail page, click **Console**
5. A terminal window will open in your browser — you are logged in as `root` automatically

The browser console works for everything: editing files, running PM2 commands, pulling code, etc. The only limitation is it can be slightly slower than a local SSH connection and will time out if left idle.

---

#### Option B — SSH from Your Local Terminal (Recommended for Regular Use)

SSH from your local machine is faster and more comfortable for regular work. It requires your SSH public key to be added to the droplet first.

**Step 1 — Generate an SSH key on your local machine** (skip if you already have one):

```bash
# Check if you already have a key
ls ~/.ssh/id_ed25519.pub

# If not, generate one
ssh-keygen -t ed25519 -C "your_email@example.com"
# Press Enter to accept the default location
# Optionally set a passphrase (recommended)
```

**Step 2 — Get your public key:**

```bash
cat ~/.ssh/id_ed25519.pub
# Copy the entire output — it starts with "ssh-ed25519 ..."
```

**Step 3 — Send your public key to the project owner.** They will add it to the droplet via the DigitalOcean dashboard:

1. DigitalOcean dashboard → **Settings** → **Security** → **SSH Keys** → **Add SSH Key**
2. Paste the public key and give it a name
3. Then on the droplet: the key needs to be added to `/root/.ssh/authorized_keys`

The project owner can add it directly on the droplet:

```bash
echo "ssh-ed25519 AAAA... your_email@example.com" >> /root/.ssh/authorized_keys
```

**Step 4 — Connect:**

```bash
ssh root@<droplet-ip>
# Find the droplet IP in the DigitalOcean dashboard → Droplets → droplet detail page
```

---

### Adding a New Developer's SSH Key to the Droplet

If you are the project owner and need to grant a new developer SSH access:

1. Have the developer send you their public key (`~/.ssh/id_ed25519.pub`)
2. SSH into the droplet (or use the browser console)
3. Add their key:

```bash
echo "ssh-ed25519 AAAA...their-key... their_email" >> /root/.ssh/authorized_keys
```

4. Verify it was added:

```bash
cat /root/.ssh/authorized_keys
```

To revoke access later, open `authorized_keys` with `nano` and delete their line:

```bash
nano /root/.ssh/authorized_keys
```

---

### Application Directory

The application lives at:

```bash
/var/www/solar-events
```

Navigate there with:

```bash
cd /var/www/solar-events
```

### The `.env` File

The `.env` file is in `/var/www/solar-events/` but is **hidden** (dotfile — won't show in `ls`). To view it:

```bash
ls -la            # Shows hidden files including .env
nano .env         # Open and edit in nano
```

**After editing `.env`, always restart PM2:**

```bash
pm2 restart all
```

**Important:** Any new environment variables added to the codebase must be manually added to this file. Pulling new code from Git does NOT update the `.env` — it must be done manually each time.

### PM2 Process Manager

PM2 keeps both backend servers running continuously and restarts them if they crash. The current running processes are:

```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 1  │ solar-admin        │ fork     │ 5    │ online    │ 0%       │ 12.3mb   │
│ 0  │ solar-public       │ fork     │ 1420 │ online    │ 0%       │ 45.1mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

- `solar-public` (ID 0) → runs `database.js` on port 4000
- `solar-admin` (ID 1) → runs `admin.js` on port 4001

The high restart count (`↺ 1420`) on `solar-public` is expected and is not an active problem — it reflects the history of the process.

### Common PM2 Commands

```bash
pm2 status                        # View all processes and their state
pm2 logs                          # Stream all logs (Ctrl+C to exit)
pm2 logs solar-public --lines 100 # Last 100 lines from public API
pm2 logs solar-admin --lines 100  # Last 100 lines from admin API
pm2 restart all                   # Restart both servers
pm2 restart solar-public          # Restart only the public API
pm2 restart solar-admin           # Restart only the admin API
pm2 stop all                      # Stop all processes
pm2 monit                         # Real-time CPU/memory monitor
pm2 save                          # Save current process list (survives reboots)
```

### Checking Server Resources

```bash
free -h            # Memory usage
df -h              # Disk usage
top                # Live process list
netstat -tlnp | grep 400    # Verify ports 4000 and 4001 are listening
```

---

## 14. Deployment Workflow

### How It Works

```
Developer pushes code
       │
       ├──▶ PRODUCTION REPO (main branch)
       │         │
       │         ├──▶ VERCEL (automatic)
       │         │    Detects push, builds with `npm run build`,
       │         │    deploys dist/ — no action needed.
       │         │
       │         └──▶ DIGITALOCEAN DROPLET (manual)
       │              SSH in → git pull → pm2 restart
       │
       └──▶ DEV REPO
                 Used during development — does NOT auto-deploy
```

### Deploying Frontend Changes (Automatic)

Push to the `main` branch of the production repo. Vercel detects the push and automatically builds and deploys. Check progress at vercel.com/dashboard.

```bash
git add .
git commit -m "description of change"
git push origin main
```

### Deploying Backend/API Changes (Manual)

After pushing to the production repo, SSH into the droplet and pull the new code:

```bash
# 1. Push to GitHub production repo
git push origin main

# 2. SSH into droplet
ssh root@<droplet-ip>

# 3. Navigate to app directory
cd /var/www/solar-events

# 4. Pull latest code
git pull origin main

# 5. Install new dependencies (only if package.json changed)
npm install

# 6. If new environment variables were added, update .env
nano .env
# Add the new variables, save and exit

# 7. Restart the servers
pm2 restart all

# 8. Verify both are online
pm2 status
```

---

## 15. Server Setup Guide (Fresh Start)

This covers setting up a brand new DigitalOcean droplet from scratch.

### Initial System Setup

```bash
ssh root@<new-droplet-ip>

# Update packages
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install git
apt install -y git
```

### Deploy the Application

```bash
mkdir -p /var/www
cd /var/www

# Clone from the production repo
git clone https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact.git solar-events
cd solar-events

# Install dependencies
npm install

# Create the .env file with all required variables
nano .env
```

### Start with PM2

```bash
pm2 start database.js --name solar-public
pm2 start admin.js --name solar-admin

# Verify both are running
pm2 status

# Save process list so it survives reboots
pm2 save

# Generate and run the startup script
pm2 startup
# Copy and run the command that PM2 outputs
```

### Nginx Reverse Proxy Config

If Nginx is managing routing from `api.solarimpacts.org` to the local ports:

```nginx
server {
    listen 80;
    server_name api.solarimpacts.org;

    location /api/admin {
        proxy_pass http://localhost:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 16. Common Tasks & Maintenance

### Hashing a New Password

```bash
cd /var/www/solar-events
node hash-password.js
# Enter the password at the prompt — it outputs a bcrypt hash to paste into the DB
```

### Adding a New Admin User via Database

```bash
# Connect to the database
mysql -h <db-host> -P 25060 -u solar_admin_app -p --ssl-ca=ca-certificate.crt

# Hash the password first using hash-password.js (see above)
INSERT INTO admin_users (username, password_hash, security_question_id, security_answer_hash, is_protected)
VALUES ('newuser', '<bcrypt_hash>', 1, '<answer_hash>', 0);
```

Alternatively, create admin users through the Accounts tab in the admin panel UI if you already have a super admin account.

### Database Backup

```bash
mysqldump -h <db-host> -P 25060 -u solar_admin_app -p \
  --ssl-ca=ca-certificate.crt \
  defaultdb > backup-$(date +%Y%m%d).sql
```

### Checking Server Resources

```bash
free -h        # Memory
df -h          # Disk
pm2 monit      # Real-time PM2 monitoring
pm2 logs --lines 100
```

---

## 17. Troubleshooting

### API Not Responding

```bash
pm2 status                         # Are both processes online?
pm2 logs solar-admin --lines 50    # Check admin API logs
pm2 logs solar-public --lines 50   # Check public API logs
netstat -tlnp | grep 400           # Confirm ports 4000 and 4001 are bound
pm2 restart all                    # Restart everything
```

### Changes to `.env` Not Taking Effect

After editing `.env` on the droplet, the servers must be restarted:

```bash
pm2 restart all
```

### New Environment Variable Not Working

If a variable was added to the codebase but isn't in the droplet's `.env`, the server will silently get `undefined`. Always:

1. `nano .env` and add the new variable
2. `pm2 restart all`
3. Check `pm2 logs` to confirm no errors on startup

### Database Connection Failed

1. Verify credentials in `.env` with `nano .env`
2. Test manually: `mysql -h <host> -P 25060 -u solar_admin_app -p --ssl-ca=ca-certificate.crt`
3. In DigitalOcean dashboard → Managed Databases → Trusted Sources → verify the droplet IP is allowed

### CORS Errors

1. Check `CORS_ORIGIN` in `.env` — must include the requesting domain (exact match, no trailing slash)
2. After changing `CORS_ORIGIN`, run `pm2 restart all`
3. Check browser console for the exact blocked origin

### Images Not Loading

1. Check Spaces credentials in `.env`
2. In DigitalOcean → Spaces → `newspaper-articles` — verify the file exists and the path matches the URL
3. Confirm the file has `public-read` ACL set

### Admin Login Not Working

```bash
# Check users exist in the database
# Connect to DB then run:
SELECT id, username, is_protected FROM admin_users;

# Check login attempt logs
pm2 logs solar-admin | grep login
```

Note: Security answers are **case-sensitive** and stored as bcrypt hashes. There is no "forgot password" — reset via direct DB update using a hash from `hash-password.js`.

### Frontend Build Errors on Vercel

```bash
rm -rf node_modules
npm install
npm run build   # Test the build locally first
```

Check the Vercel dashboard for build logs. Verify all required Vercel environment variables (`VITE_ADMIN_API_BASE`) are set.

### Page Returns 404 on Hard Refresh

Verify `vercel.json` is present in the repository root and contains the SPA rewrite rule. Without this, React Router routes like `/about` or `/admin` will 404 on direct navigation or refresh.

---

## 18. Security Considerations

### Credentials Management

- **Never commit `.env` to Git** — it is listed in `.gitignore` and must stay that way
- Rotate credentials periodically, especially if team members change
- Use strong passwords (16+ characters, mixed case, numbers, symbols)

### Database Security

- Two separate DB users: `solar_public` (SELECT only) and `solar_admin_app` (full CRUD)
- SSL is required for all database connections
- In DigitalOcean dashboard, restrict "Trusted Sources" to the droplet's IP only

### API Security

- CORS is restricted to specific origins via the `CORS_ORIGIN` env var
- All admin endpoints require authenticated state (username + password + security answer)
- Passwords and security answers are hashed with bcrypt (12 rounds)
- Admin login does not use JWT or cookies — the session only persists in React state during the current browser session

### File Upload Security

- File type validation is enforced server-side (images only)
- Size limits are enforced: 12 MB for event media, 2 MB for team photos
- Unique filenames (with timestamp + random hex) prevent collisions and path prediction
- All uploaded content is publicly accessible by URL (public-read ACL) — do not upload sensitive files

### Recommendations

1. Enable 2FA on all DigitalOcean, Vercel, Cloudflare, and GitHub accounts
2. Review the `admin_users` table periodically and remove stale accounts
3. Monitor PM2 logs regularly for unexpected errors
4. Keep Node.js and all npm dependencies up to date

---

## 19. Cost Summary

| Service              | Monthly Cost                  | Notes                                    |
| -------------------- | ----------------------------- | ---------------------------------------- |
| DigitalOcean Droplet | ~$6                           | 1 GB RAM, 1 vCPU                         |
| DigitalOcean MySQL   | ~$15                          | 1 GB RAM, managed                        |
| DigitalOcean Spaces  | $5                            | 250 GB storage, 1 TB bandwidth           |
| Vercel               | $0                            | Free tier (hobby)                        |
| Cloudflare           | $0                            | Free tier                                |
| OpenAI API           | Variable                      | Pay-per-use (Tell Me More + Birthday AI) |
| **Total**            | **~$26/month + OpenAI usage** |                                          |

---

## 20. Quick Reference Card

### URLs

- **Website:** https://www.solarimpacts.org
- **Admin:** https://www.solarimpacts.org/admin
- **API:** https://api.solarimpacts.org
- **GitHub (Production):** https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact
- **GitHub (Dev):** https://github.com/Solar-Events-Impact-On-Communication/Dev
- **Spaces:** https://newspaper-articles.nyc3.digitaloceanspaces.com

### SSH Access

```bash
ssh root@<droplet-ip>
# IP is available in the DigitalOcean dashboard
```

### Application on the Droplet

```bash
cd /var/www/solar-events   # App directory
nano .env                  # Edit environment variables (hidden file)
pm2 restart all            # Apply .env changes or deploy new code
```

### PM2 Status (Expected)

```
│ id │ name               │ mode  │ status │
│ 1  │ solar-admin        │ fork  │ online │  ← admin.js on port 4001
│ 0  │ solar-public       │ fork  │ online │  ← database.js on port 4000
```

### Key Server Commands

```bash
pm2 status               # Check service status
pm2 restart all          # Restart all services
pm2 logs --lines 100     # View recent logs from all processes
pm2 monit                # Real-time monitoring

# Deploy backend changes
cd /var/www/solar-events
git pull origin main
npm install              # Only if package.json changed
nano .env                # If new env vars were added
pm2 restart all
pm2 status               # Confirm both are online
```

### Local Development Commands

```bash
# Clone the Dev repo (not production)
git clone https://github.com/Solar-Events-Impact-On-Communication/Dev.git

npm run start:api   # Start BOTH backend servers (ports 4000 + 4001)
npm run dev         # Start Vite frontend (port 5173)
```

### Key Files on Server

```
/var/www/solar-events/
├── admin.js            # Admin API server (port 4001)
├── database.js         # Public API server (port 4000)
├── hash-password.js    # Utility: hash a password for DB insertion
├── package.json
└── .env                # Environment variables — hidden, use: nano .env
```

### Port Reference

| Port | Process                      | Script      |
| ---- | ---------------------------- | ----------- |
| 4000 | solar-public                 | database.js |
| 4001 | solar-admin                  | admin.js    |
| 5173 | Vite dev server (local only) | npm run dev |

---

_Document Version: 3.0 — February 2026_
