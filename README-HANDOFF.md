# Solar Events — Complete Project Handoff Documentation

**Last Updated:** January 2026  
**Project URL:** https://www.solarimpacts.org  
**Admin URL:** https://www.solarimpacts.org/admin

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [Infrastructure Details](#4-infrastructure-details)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema](#6-database-schema)
7. [API Documentation](#7-api-documentation)
8. [Frontend Structure](#8-frontend-structure)
   - 8.1 [App.jsx Component Map](#81-appjsx-component-map-5295-lines)
   - 8.2 [Dependencies Explained](#82-dependencies-explained)
   - 8.3 [Project File Structure](#83-project-file-structure)
9. [File Storage (DigitalOcean Spaces)](#9-file-storage-digitalocean-spaces)
10. [Deployment & Git Workflow](#10-deployment--git-workflow)
11. [Local Development](#11-local-development)
12. [Server Setup Guide](#12-server-setup-guide)
13. [Common Tasks & Maintenance](#13-common-tasks--maintenance)
14. [Troubleshooting](#14-troubleshooting)
15. [Security Considerations](#15-security-considerations)
16. [Cost Summary](#16-cost-summary)
16. [Cost Summary](#16-cost-summary)

---

## 1. Project Overview

Solar Events is a web application that displays a timeline of historical solar events (solar flares, geomagnetic storms, etc.) and their impacts on communication systems throughout history. The project consists of:

- **Public Timeline** — Interactive timeline showing solar events by year, with detailed event information and historical newspaper articles
- **About Page** — Dynamic content sections about the project
- **Team Page** — Team member profiles with photos
- **Admin Panel** — Protected interface for managing events, articles, about content, and team members

### Key Features

- Year-based timeline navigation with search and browse functionality
- Event detail overlays with summaries and impact information
- Newspaper article viewer for historical media
- Full CRUD admin panel for all content
- Image upload/cropping for team photos
- Responsive design for mobile and desktop

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
│  │                         React App (App.jsx)                          │   │
│  │  • Public Timeline View                                              │   │
│  │  • About Page                                                        │   │
│  │  • Admin Panel (/admin)                                              │   │
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
│  │   Port: 4000         │    │   Port: 4000         │                       │
│  │   READ-ONLY          │    │   CRUD Operations    │                       │
│  │                      │    │                      │                       │
│  │   /api/events        │    │   /api/admin/login   │                       │
│  │   /api/events/:id/   │    │   /api/admin/events  │                       │
│  │     media            │    │   /api/admin/media   │                       │
│  │   /api/about         │    │   /api/admin/about   │                       │
│  │   /api/team          │    │   /api/admin/team    │                       │
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
│   ┌─────────────┐                                                           │
│   │admin_users  │                                                           │
│   └─────────────┘                                                           │
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
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| Vite | 5.x | Build tool & dev server |
| react-easy-crop | Latest | Avatar image cropping |
| CSS | Custom | Styling (App.css) |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| Express | 4.x | Web framework |
| mysql2 | Latest | Database driver |
| bcryptjs | Latest | Password hashing |
| multer | Latest | File upload handling |
| @aws-sdk/client-s3 | Latest | Spaces file storage |
| PM2 | Latest | Process manager |

### Infrastructure
| Service | Provider | Purpose |
|---------|----------|---------|
| Frontend Hosting | Vercel | Static site + serverless |
| API Server | DigitalOcean Droplet | Node.js API hosting |
| Database | DigitalOcean Managed MySQL | Data storage |
| File Storage | DigitalOcean Spaces | Images & documents |
| DNS/SSL | Cloudflare | Domain management |

---

## 4. Infrastructure Details

### DigitalOcean Droplet (API Server)
- **Name:** `ubuntu-s-1vcpu-1gb-nyc3-01`
- **OS:** Ubuntu 24.04 (LTS) x64
- **Specs:** 1 GB Memory / 1 vCPU / 25 GB Disk
- **Region:** NYC3
- **IP:** (Check DigitalOcean dashboard)

### DigitalOcean Managed MySQL
- **Name:** `solar-events-db-mysql`
- **Engine:** MySQL 8
- **Specs:** 1 GB RAM / 1 vCPU / 10 GB Disk
- **Region:** NYC3
- **Port:** 25060
- **Connection:** SSL Required (CA certificate in .env)

### DigitalOcean Spaces
- **Name:** `newspaper-articles`
- **URL:** https://newspaper-articles.nyc3.digitaloceanspaces.com
- **Region:** NYC3
- **Plan:** $5/month (250 GB storage, 1 TB bandwidth)

### Cloudflare
- **Domain:** solarimpacts.org
- **Proxy:** Enabled (orange cloud)
- **SSL:** Full (strict)

### Vercel
- **Project:** solar-events
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

---

## 5. Environment Variables

Create a `.env` file in the server directory with these variables:

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

# =========================
# Server Config
# =========================
ADMIN_PORT=4000

# CORS (comma-separated allowed origins)
CORS_ORIGIN=https://www.solarimpacts.org,https://solarimpacts.org
```

### Vercel Environment Variables
Set these in Vercel dashboard (Settings → Environment Variables):

| Variable | Value |
|----------|-------|
| `VITE_ADMIN_API_BASE` | `https://api.solarimpacts.org` (or your API subdomain) |

---

## 6. Database Schema

### Table: `solar_events`
Primary table for solar event data.

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

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint unsigned | Auto-increment primary key |
| `event_date` | date | Date of the solar event |
| `event_type` | varchar(255) | Type (e.g., "Solar Flare", "Geomagnetic Storm") |
| `location` | varchar(255) | Geographic location affected (nullable) |
| `title` | varchar(255) | Event title |
| `short_description` | varchar(500) | Brief description for timeline cards |
| `summary` | text | Full event description |
| `impact_on_communication` | text | How it affected communications |

### Table: `media_assets`
Newspaper articles/images linked to events.

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

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint unsigned | Auto-increment primary key |
| `event_id` | bigint unsigned | Foreign key to solar_events |
| `url` | varchar(500) | Full public URL to image in Spaces |
| `object_key` | varchar(512) | Spaces object key (for deletion) |
| `caption` | varchar(255) | Image caption |

**Note:** `ON DELETE CASCADE` means deleting an event automatically deletes its media.

### Table: `about_sections`
Dynamic content sections for the About page.

```sql
CREATE TABLE `about_sections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `display_order` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `text` text NOT NULL,
  PRIMARY KEY (`id`)
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | int unsigned | Auto-increment primary key |
| `display_order` | int | Order to display sections (lower = first) |
| `title` | varchar(255) | Section heading |
| `text` | text | Section content |

### Table: `team_members`
Team member profiles.

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

| Column | Type | Description |
|--------|------|-------------|
| `id` | int unsigned | Auto-increment primary key |
| `name` | varchar(150) | Team member's name |
| `role` | varchar(200) | Their role/title |
| `image_url` | varchar(500) | URL to profile photo in Spaces |
| `display_order` | int | Order to display (default: 1) |

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
  KEY `fk_admin_users_sec_question` (`security_question_id`),
  CONSTRAINT `fk_admin_users_sec_question` FOREIGN KEY (`security_question_id`) 
    REFERENCES `security_questions` (`id`) ON DELETE RESTRICT
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint unsigned | Auto-increment primary key |
| `username` | varchar(255) | Unique username |
| `password_hash` | varchar(255) | Bcrypt hashed password |
| `security_question_id` | bigint unsigned | Foreign key to security_questions |
| `security_answer_hash` | varchar(255) | Bcrypt hashed security answer |
| `is_protected` | tinyint(1) | If 1, account cannot be deleted (super admin) |

### Table: `security_questions`
Predefined security questions for admin accounts.

```sql
CREATE TABLE `security_questions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `question_text` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint unsigned | Auto-increment primary key |
| `question_text` | varchar(255) | The security question text |

### Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────┐
│   solar_events      │       │   media_assets      │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │───┐   │ id (PK)             │
│ event_date          │   │   │ event_id (FK)       │──┘
│ event_type          │   └──▶│ url                 │
│ location            │       │ object_key          │
│ title               │       │ caption             │
│ short_description   │       └─────────────────────┘
│ summary             │
│ impact_on_communication│
└─────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│   admin_users       │       │ security_questions  │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │       │ id (PK)             │
│ username            │       │ question_text       │
│ password_hash       │       └─────────────────────┘
│ security_question_id│───────────────┘
│ security_answer_hash│
│ is_protected        │
└─────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│   about_sections    │       │   team_members      │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │       │ id (PK)             │
│ display_order       │       │ name                │
│ title               │       │ role                │
│ text                │       │ image_url           │
└─────────────────────┘       │ display_order       │
                              └─────────────────────┘
```

### Database Users & Permissions

**`solar_public`** (Read-only for public API):
```sql
GRANT SELECT ON defaultdb.solar_events TO 'solar_public'@'%';
GRANT SELECT ON defaultdb.media_assets TO 'solar_public'@'%';
GRANT SELECT ON defaultdb.about_sections TO 'solar_public'@'%';
GRANT SELECT ON defaultdb.team_members TO 'solar_public'@'%';
```

**`solar_admin_app`** (CRUD for admin API):
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON defaultdb.* TO 'solar_admin_app'@'%';
```

---

## 7. API Documentation

### Public API (database.js) — Port 4000

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
    "caption": "New York Times coverage..."
  },
  ...
]
```

#### Get About Sections
```
GET /api/about
Response: [
  {
    "id": 1,
    "display_order": 1,
    "title": "Our Mission",
    "text": "Content..."
  },
  ...
]
```

#### Get Team Members
```
GET /api/team
Response: [
  {
    "id": 1,
    "name": "John Doe",
    "role": "Lead Researcher",
    "image_url": "https://newspaper-articles.nyc3.digitaloceanspaces.com/team/..."
  },
  ...
]
```

### Admin API (admin.js) — Port 4000

All admin endpoints require authentication via username/password login.

#### Authentication
```
POST /api/admin/login
Body: { "username": "...", "password": "...", "securityAnswer": "..." }
Response: { "success": true, "user": { "id": 1, "username": "..." } }
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
POST   /api/admin/events/:id/media     — Upload new media (multipart)
PUT    /api/admin/media/:id/caption    — Update caption
DELETE /api/admin/media/:id            — Delete media
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
POST   /api/admin/team/:id/photo  — Upload photo (base64)
DELETE /api/admin/team/:id/photo  — Remove photo
```

---

## 8. Frontend Structure

### App.jsx (5,295 lines)
Single-file React application containing all components and logic.

#### Main Components
| Component/Section | Description |
|-------------------|-------------|
| `App()` | Main component, handles routing and state |
| `ErrorBoundary` | Catches rendering errors in admin modal |
| Timeline View | Home page with year-grouped events |
| About View | Dynamic about page content |
| Admin View | Protected admin panel |
| Event Detail Overlay | Modal showing event details |
| Media Overlay | Newspaper article viewer |
| Year Search/Browse | Search by year functionality |

#### State Management
- Uses React hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
- No external state management (Redux, etc.)
- All state local to `App` component

#### Key State Variables
```javascript
// Events data
const [events, setEvents] = useState([]);
const [loadingEvents, setLoadingEvents] = useState(true);

// Navigation
const [view, setView] = useState('home'); // 'home' | 'about' | 'admin'
const [menuOpen, setMenuOpen] = useState(false);

// Event details
const [selectedEvent, setSelectedEvent] = useState(null);

// Media overlay
const [showMediaOverlay, setShowMediaOverlay] = useState(false);
const [mediaItems, setMediaItems] = useState([]);

// Year search
const [yearQuery, setYearQuery] = useState('');
const [showYearPicker, setShowYearPicker] = useState(false);

// Admin state
const [adminUser, setAdminUser] = useState(null);
const [adminTab, setAdminTab] = useState('events');
```

### App.css (4,950 lines)
Comprehensive stylesheet with organized sections (see Navigation Index in file header).

#### Key CSS Classes
| Class | Purpose |
|-------|---------|
| `.app` | Main container |
| `.topbar` | Fixed header |
| `.timeline-*` | Timeline components |
| `.event-detail-*` | Event detail overlay |
| `.media-overlay-*` | Article viewer |
| `.admin-*` | Admin panel styles |
| `.year-search-*` | Year search/browse |

#### Responsive Breakpoints
- `max-width: 1024px` — Tablet
- `max-width: 900px` — Mobile (main breakpoint)
- `max-width: 768px` — Small screens
- `max-width: 640px` — Extra small
- `max-width: 520px` — Tiny
- `max-width: 400px` — Micro

---

## 8.1. App.jsx Component Map (5,295 lines)

The entire React application is in a single file. Use this map to navigate:

### Utility Functions (Lines 1-143)
| Line | Function | Purpose |
|------|----------|---------|
| 9-33 | `ErrorBoundary` | Class component that catches rendering errors in admin |
| 37 | `joinUrl()` | Safely joins URL base + path |
| 58 | `formatEventDateLabel()` | Formats date as "Month Day" |
| 68 | `formatEventDateLabelWithYear()` | Formats date as "Month Day, Year" |
| 84 | `formatFullDateLong()` | Full date for overlays |
| 95 | `extractYear()` | Gets year from date string |
| 118 | `parseMonthDay()` | Parses "Month Day" for sorting |
| 129 | `sortEventsByDate()` | Sorts events chronologically |
| 141-142 | `API_BASE`, `ADMIN_API_BASE` | API endpoint constants |

### Main App Component (Lines 146-703)
| Line Range | Section | Description |
|------------|---------|-------------|
| 146-260 | State declarations | All useState hooks for app state |
| 261-302 | `useEffect` - Fetch events | Loads events from API on mount |
| 304-366 | Navigation handlers | Menu open/close, view switching |
| 368-402 | Event detail handlers | Open/close event overlays |
| 403-485 | Media overlay handlers | Load and navigate newspaper articles |
| 486-498 | Year search logic | Search/browse year functionality |
| 499-703 | **Main JSX return** | App shell, topbar, navigation drawer |

### View Components (Lines 704-1207)
| Line | Component | Purpose |
|------|-----------|---------|
| 708-887 | `HomeView` | Timeline with year-grouped events |
| 888-933 | `TimelineYearRow` | Individual year row with expandable events |
| 934-954 | `BirthdayView` | Birthday feature (placeholder) |
| 955-1072 | `AboutView` | Public about page with team section |
| 1073-1103 | `LiveView` | Live data feature (placeholder) |
| 1104-1207 | `AvatarCropModal` | Image cropping modal for team photos |

### Admin Panel (Lines 1208-4517)
| Line Range | Section | Description |
|------------|---------|-------------|
| 1208-2926 | `AdminView` function | State, handlers, API calls |
| 2929-2994 | **Login form** | Username/password/security question |
| 2995-3109 | **Logged-in header** | Welcome message, logout, tabs |
| 3110-3350 | **Events tab** | Event list table, edit/delete buttons |
| 3351-3497 | **Edit Event Modal trigger** | Opens AdminEventModal |
| 3498-3577 | **Accounts tab** | Super admin only - manage users |
| 3578-3785 | **Profile tab** | Non-super admins - view/edit own profile |
| 3786-4047 | **Team tab** | Add/edit/remove team members |
| 4048-4202 | **About Page tab** | Edit about sections |
| 4203-4380 | **Account Modal** | Add/edit admin user modal |
| 4381-4420 | **Delete Confirm Modal** | Confirmation dialog |
| 4421-4517 | **Global Blocker** | Loading overlay during saves |

### Admin Event Modal (Lines 4518-5103)
| Line Range | Section | Description |
|------------|---------|-------------|
| 4518-4662 | State & handlers | Form state, validation, API calls |
| 4663-5103 | **JSX return** | Event form fields, article viewer |
| 4700-4800 | Header + save/cancel | Modal header with actions |
| 4801-4900 | Basic fields | Date, type, location, title |
| 4901-5000 | Text areas | Short description, summary, impact |
| 5001-5103 | **Article viewer** | Upload, view, delete newspaper images |

### Public Overlays (Lines 5104-5295)
| Line | Component | Purpose |
|------|-----------|---------|
| 5104 | `getEventYear()` | Helper to extract year |
| 5112-5164 | `EventDetailOverlay` | Event details popup (public) |
| 5166-5295 | `MediaOverlay` | Newspaper article viewer (public) |

### Key State Variables in App()
```javascript
// Core data
events                  // Array of all solar events
loadingEvents          // Boolean - loading state
eventsError            // String - error message

// Navigation
view                   // 'home' | 'about' | 'admin'
menuOpen               // Boolean - nav drawer open
topbarStacked          // Boolean - 2-row topbar mode

// Event detail overlay
selectedEvent          // Currently viewed event object
showMediaOverlay       // Boolean - article viewer open
mediaItems             // Array of articles for current event
mediaIndex             // Current article index

// Year search
yearQuery              // Search input value
showYearPicker         // Boolean - decade picker open
scrollToYear           // Year to scroll timeline to
```

### Key State Variables in AdminView()
```javascript
// Auth
adminUser              // Logged in user object
loginError             // Login error message

// UI
adminTab               // 'events' | 'accounts' | 'profile' | 'team' | 'about'
isSaving               // Boolean - show loading blocker

// Events management
adminEvents            // Array of events for admin table
editingEvent           // Event being edited (opens modal)

// Team management  
teamMembers            // Array of team members
newMemberName/Role     // New member form inputs
pendingPhoto           // Photo waiting to be uploaded

// About management
aboutSections          // Array of about sections
```

---

## 8.2. Dependencies Explained

### Frontend Dependencies (React App)

| Package | Purpose | Used For |
|---------|---------|----------|
| `react` | UI framework | All components, state management, effects |
| `react-dom` | React renderer | Mounting app to DOM |
| `react-easy-crop` | Image cropping | Team member photo upload - lets users crop to circle |
| `vite` | Build tool | Dev server, production builds, env variables |

### Backend Dependencies (Server)

| Package | Purpose | Used For |
|---------|---------|----------|
| `express` | Web framework | HTTP server, routing, middleware |
| `cors` | CORS middleware | Allow frontend to call API from different domain |
| `mysql2` | MySQL driver | Database connections with promise support |
| `dotenv` | Environment vars | Load .env file into process.env |
| `bcryptjs` | Password hashing | Secure admin password storage (12 rounds) |
| `multer` | File uploads | Handle multipart form data for article images |
| `@aws-sdk/client-s3` | S3/Spaces client | Upload/delete files in DigitalOcean Spaces |

### Built-in Node.js Modules Used
| Module | Purpose |
|--------|---------|
| `fs` | Read CA certificate file |
| `path` | Construct file paths |
| `url` | ESM __dirname equivalent |

---

## 8.3. Project File Structure

```
solar-events/
├── src/
│   ├── App.jsx              # Main React application (5,295 lines)
│   ├── App.css              # All styles (4,950 lines)
│   └── main.jsx             # React entry point
├── server/
│   ├── admin.js             # Admin API server (CRUD operations)
│   ├── database.js          # Public API server (read-only)
│   ├── .env                 # Environment variables (DO NOT COMMIT)
│   └── ca-certificate.crt   # MySQL SSL certificate (optional, can use env)
├── lib/                     # ⚠️ LEGACY - can be deleted
│   ├── db.js                # Old serverless DB pool (not used)
│   └── admindb.js           # Old serverless admin pool (not used)
├── api/                     # ⚠️ LEGACY - can be deleted if exists
│   └── (old serverless routes)
├── public/                  # Static assets
├── index.html               # HTML entry point
├── package.json             # Dependencies
├── vite.config.js           # Vite configuration
└── README.md                # This documentation
```

**Note:** The `lib/` folder contains legacy code from when the project used Vercel serverless functions. It is no longer used since switching to dedicated server files (`admin.js` and `database.js`). You can safely delete the `lib/` folder.

---

## 9. File Storage (DigitalOcean Spaces)

### Bucket Structure
```
newspaper-articles/
├── articles/
│   └── event-{eventId}-{timestamp}-{randomHex}.{ext}
└── team/
    └── member-{memberId}-{timestamp}-{randomHex}.{ext}
```

### File Naming Convention
- **Articles:** `event-{eventId}-{timestamp}-{10-char-hex}.{jpg|png|webp}`
- **Team Photos:** `member-{memberId}-{timestamp}-{10-char-hex}.{jpg|png|webp}`

### Access Control
- All uploaded files are set to `public-read` ACL
- Direct access via: `https://newspaper-articles.nyc3.digitaloceanspaces.com/{key}`

### Upload Size Limits
- Event media: 12 MB max
- Team photos: 15 MB max (base64 in JSON body)

---

## 10. Deployment & Git Workflow

### Repository
- **URL:** https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact
- **Branch:** `main` (production)

### How Deployments Work

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR LOCAL MACHINE                           │
│                                                                     │
│   1. Make changes to code                                          │
│   2. git add . && git commit -m "description"                      │
│   3. git push origin main                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│        VERCEL           │     │   DIGITALOCEAN DROPLET  │
│   (Auto-deploys on push)│     │   (Manual update needed)│
│                         │     │                         │
│ • Watches GitHub repo   │     │ • SSH into server       │
│ • Builds automatically  │     │ • cd /var/www/solar-... │
│ • Deploys frontend      │     │ • git pull origin main  │
│                         │     │ • pm2 restart all       │
└─────────────────────────┘     └─────────────────────────┘
```

### Deploying Frontend Changes (Automatic)

Any push to `main` branch triggers Vercel auto-deploy:

```bash
# Make your changes, then:
git add .
git commit -m "Update homepage styling"
git push origin main

# Vercel automatically builds and deploys
# Check status at: https://vercel.com/dashboard
```

### Deploying Backend/API Changes (Manual)

Server files (`admin.js`, `database.js`) require manual deployment:

```bash
# 1. Push to GitHub first
git add .
git commit -m "Add new API endpoint"
git push origin main

# 2. SSH into DigitalOcean droplet
ssh root@167.71.164.27

# 3. Navigate to project directory
cd /var/www/solar-events

# 4. Pull latest changes
git pull origin main

# 5. Install any new dependencies (if package.json changed)
npm install

# 6. Restart the servers
pm2 restart all

# 7. Verify they're running
pm2 status
```

### Git Commands Quick Reference

```bash
# Check current status
git status

# Pull latest changes before starting work
git pull origin main

# Stage all changes
git add .

# Commit with message
git commit -m "Your descriptive message"

# Push to GitHub
git push origin main

# View recent commits
git log --oneline -10

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes
git checkout -- .
```

---

## 11. Local Development

### Can This Run Locally?

**Frontend: YES** — You can run the React app locally for UI development.

**Backend: LIMITED** — The API servers require:
- Access to DigitalOcean managed MySQL (external)
- Valid SSL certificate for database connection
- DigitalOcean Spaces credentials

### Running Frontend Locally

```bash
# 1. Clone the repository
git clone https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact.git
cd Solar-Impact

# 2. Install dependencies
npm install

# 3. Create .env file for Vite (optional - for API connection)
echo "VITE_ADMIN_API_BASE=https://api.solarimpacts.org" > .env

# 4. Start development server
npm run dev

# 5. Open in browser
# http://localhost:5173
```

**Note:** Without the backend running locally, the app will:
- ✅ Display the UI correctly
- ✅ Allow navigation between views
- ❌ Not load events (API calls will fail)
- ❌ Not allow admin login

For full functionality during local development, the frontend connects to the production API at `api.solarimpacts.org`.

### Running Backend Locally (Advanced)

To run the API servers locally, you need:

1. **Create local `.env` file** with all credentials (copy from server)
2. **Ensure your IP is in MySQL "Trusted Sources"** (DigitalOcean dashboard)
3. **Run the servers:**
   ```bash
   node admin.js    # Runs on port 4000
   node database.js # Also wants port 4000 - conflict!
   ```

**Port Conflict:** Both servers default to port 4000. For local development, change one:
```bash
# Option 1: Run only admin.js (has all routes)
node admin.js

# Option 2: Change port in .env
ADMIN_PORT=4001
PUBLIC_PORT=4000
```

### Recommended Development Workflow

1. **UI/CSS changes:** Run frontend locally (`npm run dev`), use production API
2. **API changes:** Edit code locally, push to GitHub, SSH to server to deploy
3. **Database changes:** Use MySQL client to connect to DigitalOcean directly

---

## 12. Server Setup Guide

### Initial Server Setup (DigitalOcean Droplet)

```bash
# 1. SSH into droplet
ssh root@167.71.164.27

# 2. Update system
apt update && apt upgrade -y

# 3. Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# 4. Install PM2 globally
npm install -g pm2

# 5. Install Git
apt install -y git

# 6. Clone repository
mkdir -p /var/www
cd /var/www
git clone https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact.git solar-events
cd solar-events

# 7. Install dependencies
npm install

# 8. Create .env file (get contents from secure location)
nano .env

# 9. Start servers with PM2
pm2 start admin.js --name solar-admin
pm2 start database.js --name solar-public

# 10. Save PM2 config & enable startup on boot
pm2 save
pm2 startup
```

### Nginx Configuration (if using reverse proxy)

```nginx
server {
    listen 80;
    server_name api.solarimpacts.org;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Vercel Deployment

1. **Connect Repository:** Link GitHub repo to Vercel
2. **Set Build Settings:**
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Environment Variables:** Add `VITE_ADMIN_API_BASE`
4. **Deploy:** Push to main branch triggers automatic deployment

### Cloudflare DNS Setup

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | Vercel IP | Proxied |
| A | www | Vercel IP | Proxied |
| A | api | Droplet IP | Proxied |
| CNAME | @ | cname.vercel-dns.com | Proxied |

---

## 13. Common Tasks & Maintenance

### Restarting the API Server

```bash
# SSH into server
ssh root@167.71.164.27

# Check status
pm2 status

# Restart specific service
pm2 restart solar-admin
pm2 restart solar-public

# Restart all
pm2 restart all

# View logs
pm2 logs solar-admin
pm2 logs solar-public

# View logs for last 100 lines
pm2 logs --lines 100
```

### Updating Code

```bash
# SSH into server
cd /var/www/solar-events

# Pull latest code (if using git)
git pull origin main

# Or upload files manually via SFTP

# Install any new dependencies
npm install

# Restart services
pm2 restart all
```

### Database Backups

DigitalOcean Managed MySQL includes automatic daily backups. To create manual backup:

```bash
# From local machine with MySQL client
mysqldump -h <db-host> -P 25060 -u solar_admin_app -p \
  --ssl-ca=ca-certificate.crt \
  defaultdb > backup-$(date +%Y%m%d).sql
```

### Adding a New Admin User

```bash
# Connect to database
mysql -h <db-host> -P 25060 -u solar_admin_app -p --ssl-ca=ca-certificate.crt

# Generate password hash (use bcrypt with 12 rounds)
# In Node.js: bcrypt.hashSync('password', 12)

INSERT INTO admin_users (username, password_hash, security_question, security_answer_hash)
VALUES ('newuser', '<bcrypt_hash>', 'What is your favorite color?', '<answer_hash>');
```

### Checking Server Resources

```bash
# Memory usage
free -h

# Disk usage
df -h

# CPU/Process usage
htop

# PM2 specific
pm2 monit
```

### SSL Certificate Renewal

Cloudflare handles SSL automatically. If using Let's Encrypt on the droplet:

```bash
# Check certificate status
certbot certificates

# Renew manually
certbot renew

# Auto-renewal should be set up via cron
```

---

## 14. Troubleshooting

### API Not Responding

1. **Check if services are running:**
   ```bash
   pm2 status
   ```

2. **Check logs for errors:**
   ```bash
   pm2 logs solar-admin --lines 50
   ```

3. **Check if port is open:**
   ```bash
   netstat -tlnp | grep 4000
   ```

4. **Restart services:**
   ```bash
   pm2 restart all
   ```

### Database Connection Failed

1. **Verify credentials in .env**

2. **Test connection manually:**
   ```bash
   mysql -h <host> -P 25060 -u solar_admin_app -p --ssl-ca=ca-certificate.crt
   ```

3. **Check if database is accessible:**
   - Login to DigitalOcean dashboard
   - Check database status
   - Verify "Trusted Sources" includes droplet IP

### CORS Errors

1. **Check CORS_ORIGIN in .env** — must include requesting domain

2. **Verify Cloudflare settings** — ensure proxy is working

3. **Check browser console** — look for specific blocked origin

### Images Not Loading

1. **Check Spaces credentials in .env**

2. **Verify file exists in Spaces:**
   - Login to DigitalOcean
   - Navigate to Spaces → newspaper-articles
   - Check if file path matches URL

3. **Check file permissions** — should be `public-read`

### Admin Login Not Working

1. **Check username/password in database:**
   ```sql
   SELECT username FROM admin_users;
   ```

2. **Verify security answer** — case-sensitive, stored as hash

3. **Check API logs:**
   ```bash
   pm2 logs solar-admin | grep login
   ```

### Frontend Build Errors

1. **Clear node_modules and reinstall:**
   ```bash
   rm -rf node_modules
   npm install
   ```

2. **Check for missing dependencies** — especially `react-easy-crop`

3. **Verify environment variables in Vercel**

---

## 15. Security Considerations

### Credentials Management
- **Never commit .env to git** — add to .gitignore
- Rotate passwords periodically
- Use strong passwords (16+ characters, mixed case, numbers, symbols)

### Database Security
- Two separate users with different permissions (public read-only, admin CRUD)
- SSL required for all connections
- Trusted Sources configured in DigitalOcean

### API Security
- CORS restricted to specific origins
- Vercel preview URLs allowed via regex pattern
- Admin endpoints require authentication
- Passwords hashed with bcrypt (12 rounds)

### File Upload Security
- File type validation (images only)
- Size limits enforced (12MB events, 15MB team photos)
- Unique filenames prevent collisions
- Files stored with public-read ACL

### Recommendations
1. Enable 2FA on all DigitalOcean, Vercel, and Cloudflare accounts
2. Review admin_users table periodically
3. Monitor PM2 logs for suspicious activity
4. Keep Node.js and dependencies updated

---

## 16. Cost Summary

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| DigitalOcean Droplet | ~$6 | 1GB RAM, 1 vCPU |
| DigitalOcean MySQL | ~$15 | 1GB RAM, managed |
| DigitalOcean Spaces | $5 | 250GB storage, 1TB bandwidth |
| Vercel | $0 | Free tier (hobby) |
| Cloudflare | $0 | Free tier |
| **Total** | **~$26/month** | |

---

## Quick Reference Card

### URLs
- **Website:** https://www.solarimpacts.org
- **Admin:** https://www.solarimpacts.org/admin
- **API:** https://api.solarimpacts.org
- **GitHub:** https://github.com/Solar-Events-Impact-On-Communication/Solar-Impact
- **Spaces:** https://newspaper-articles.nyc3.digitaloceanspaces.com

### SSH Access
```bash
ssh root@167.71.164.27
```

### Key Commands
```bash
# Server management
pm2 status              # Check service status
pm2 restart all         # Restart all services
pm2 logs --lines 100    # View recent logs
pm2 monit               # Real-time monitoring

# Deploy backend changes
cd /var/www/solar-events
git pull origin main
npm install             # If dependencies changed
pm2 restart all

# Deploy frontend (automatic on push)
git push origin main    # Vercel auto-deploys
```

### Key Files on Server
```
/var/www/solar-events/
├── admin.js            # Admin API server (port 4000)
├── database.js         # Public API server (port 4000)
├── package.json        # Dependencies
└── .env                # Environment variables (DO NOT COMMIT)
```

### Port Configuration
Both servers run on port 4000 (configured in `.env` as `ADMIN_PORT`). They can run simultaneously if on different ports, or you can run just `admin.js` which contains all necessary routes.

---

## Support Contacts

| Role | Contact |
|------|---------|
| Original Developer | [Your contact info] |
| DigitalOcean Support | support.digitalocean.com |
| Vercel Support | vercel.com/support |
| Cloudflare Support | support.cloudflare.com |

---

*Document Version: 1.0 — January 2026*
