# WanderPath — Travel Website + Authentication System

This project has two parts:

- **`/site`** — the existing WanderPath travel website (Home, Destinations,
  Tours, Experiences, Gallery, About, Contact + all 14 destination and 15
  tour detail pages). Design, animations and content are untouched.
- **`/server`** — a real Node.js/Express backend that adds registration,
  login, sessions, a user dashboard, profile management, and an admin
  panel, and serves the site above as static files.

Nothing in `/site`'s original pages, layout or styling was redesigned —
the authentication UI (navbar login/register or dashboard/profile/logout,
new pages, favorites/booking hooks) was added on top of the existing
markup.

## Latest improvements (navigation clarity + visual polish)

- **Home hero** is a full-screen crossfading slideshow (6 s, dots, caption) using your hero photos
  (Hunza, Dubai, Maldives, Istanbul, Skardu), with a dark overlay so text stays readable.
- **Destination pages** now have a journey indicator (Explore > Choose Tour > Book), a sticky tab bar
  (Overview | Places | Things to Do | Weather & Budget | Tours) that highlights while scrolling, top-5 places,
  tips in an accordion, a sticky price card with one button ("View Tours"), and a single
  "What's next?" block (max 3 tours, each with its own photo, nearby-destination links) followed by
  Previous / Next destination links.
- **Tour pages** have a "Back to <destination>" link, the same journey indicator, a sticky booking card
  (form is pre-filled for logged-in users), one closing call to action, and Previous / Next tour links.
- **Mobile**: sticky bottom "Book Now" bar on destination and tour pages; uncluttered navbar.
- **Images**: every image is now a local file in `site/assets/images` (no external links). If an image
  ever fails to load, a soft gradient with the place name is shown instead of broken alt text.
  Naming: `<destination-slug>-hero.jpg` / `<destination-slug>-1.jpg ...` and `tour-<tour-slug>-...jpg`.
  To change a photo, overwrite that file (keep the name).
- 8px spacing grid, max 3 cards per row, identical card image ratio, one hover style for all cards/buttons.

## Quick Start

```bash
cd server
npm install
cp .env.example .env      # then edit .env and set a real JWT_SECRET
npm start
```

Open **http://localhost:3000** — the whole site (including the new auth
pages) is served from this one server. There's nothing to configure on
the frontend side; `site/assets/auth.js` talks to `/api/...` on the same
origin.

> A working `.env` with a randomly generated `JWT_SECRET` is already
> included so the project runs immediately for evaluation. **Generate a
> new secret before deploying anywhere real** — see `.env.example`.

## How authentication works

- **Passwords** are hashed with `bcryptjs` (12 salt rounds) before they
  ever touch disk. The plain password is never stored, logged, or
  returned in any API response.
- **Sessions** are a JWT stored in an `httpOnly`, `SameSite=Lax` cookie
  (`wp_session`). Checking "Remember me" issues a 30-day token instead of
  the default 2-hour one. JavaScript cannot read this cookie — there is
  no token or password anywhere in `localStorage`/`sessionStorage`.
- **Rate limiting** — 10 login attempts / 15 min and 5 registrations /
  hour per IP, via `express-rate-limit`.
- **First registered account becomes an admin automatically** (so you can
  test the admin panel immediately). Every account after that is a normal
  `user`.
- **Login activity** is recorded on every attempt (successful, failed, or
  blocked) with email, timestamp, status, and a truncated user-agent
  string — enough for the admin activity log, nothing more sensitive.

## Data storage

The backend ships with a small embedded JSON-file datastore
(`server/db/index.js` + `server/db/data/*.json`) so the whole system runs
with zero external database setup — no Postgres/MySQL/SQLite install
required to try it out.

- `users.json` — id, name, email, **passwordHash** (never the plain
  password), role, status, createdAt, updatedAt, lastLoginAt,
  lastLoginStatus.
- `login_activity.json` — userId, email, loginTime, status, userAgent.
- `favorites.json`, `saved_tours.json`, `bookings.json` — one row per
  saved destination / saved tour / booking, keyed by userId.

The access layer (`Table` class in `server/db/index.js`) exposes
`all() / find() / findOne() / insert() / update() / remove()` — the same
shape a real SQL wrapper would expose. **To move to Postgres/MySQL/SQLite
in production**, reimplement `Table`'s internals against your driver of
choice; nothing in `routes/` or `middleware/` needs to change.

`server/db/data/` starts empty and is created/populated automatically the
first time you register a user.

## API Reference

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account |
| POST | `/api/auth/login` | — | Log in, sets session cookie |
| POST | `/api/auth/logout` | — | Clears session cookie |
| GET | `/api/auth/me` | user | Current session's user |
| PUT | `/api/auth/profile` | user | Update name/email |
| PUT | `/api/auth/change-password` | user | Change password (verifies current) |
| POST | `/api/auth/forgot-password` | — | Always returns a generic message |
| GET/POST/DELETE | `/api/favorites` | user | Save/list/remove favorite destinations |
| GET/POST/DELETE | `/api/saved-tours` | user | Save/list/remove saved tours |
| GET/POST/DELETE | `/api/bookings` | user | Create/list/cancel bookings |
| GET | `/api/admin/stats` | admin | Dashboard totals + recent activity |
| GET | `/api/admin/users` | admin | All users (no password data) |
| PUT | `/api/admin/users/:id/status` | admin | Enable/disable an account |
| PUT | `/api/admin/users/:id/role` | admin | Promote/demote user↔admin |
| GET | `/api/admin/login-activity` | admin | Full login activity log |
| GET | `/api/admin/bookings` | admin | All bookings across all users |

## Pages added

`login.html`, `register.html`, `forgot-password.html`, `dashboard.html`,
`profile.html`, `admin.html` — all built with the same fonts, colors,
card/button styles and hover animations as the rest of the site
(`assets/style.css` is untouched; `assets/auth.css` extends it).

## What's connected to the existing site

- Every destination detail page has a working **Save to Favorites**
  button (visible to everyone; clicking it while logged out redirects to
  login with a "Please log in to continue." message, then back).
- Every tour detail page's booking form now creates a **real booking**
  via `/api/bookings` instead of the old cosmetic demo submit handler.
- The navbar on all 42 pages swaps **Login/Register** for a **user menu
  (Dashboard / Profile / Admin Panel if applicable / Logout)** the moment
  a session is detected — checked client-side via `GET /api/auth/me` on
  every page load.
- `dashboard.html` and `profile.html` are hard-gated: `assets/auth.js`
  checks the session before rendering anything and redirects guests to
  `login.html`. `admin.html` is additionally gated to the `admin` role.

## Tested flow

The full flow below was run end-to-end against this exact codebase:

1. Register → account created, password stored as a bcrypt hash (never
   plain text, never returned to the client)
2. Duplicate email → rejected with a clear message
3. Login with wrong password → rejected, attempt logged as `failed`
4. Login with correct credentials → session cookie issued, attempt logged
   as `successful`
5. `GET /api/auth/me` → returns the authenticated user
6. `PUT /api/auth/profile` → name updated
7. `PUT /api/auth/change-password` → verifies current password, re-hashes
   the new one
8. Create a booking while authenticated → succeeds and appears in
   `/api/bookings`
9. Logout → cookie cleared
10. `GET /api/auth/me` and `GET /api/bookings` after logout → both return
    `401 Your session has expired. Please log in again.`
11. Second registered account defaults to `role: "user"` and receives
    `403 Forbidden` on `/api/admin/*` routes, while its own routes work
    normally.

## Production checklist

- [ ] Set a fresh, long `JWT_SECRET` in `.env` (never reuse the one
      shipped for local testing)
- [ ] Set `NODE_ENV=production` so cookies get `Secure` (requires HTTPS)
- [ ] Put a real reverse proxy / HTTPS in front of the app
- [ ] Swap `server/db` for a real database if you expect concurrent
      writers at scale
- [ ] Wire a real mail provider into `POST /api/auth/forgot-password` if
      you want password-reset emails to actually send
