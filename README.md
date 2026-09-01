# PagerSlack

A MERN-stack fuses Slack-style team chat with PagerDuty-style incident escalation. Team members message in channels, tag each other, and turn messages into incidents. Incidents carry severity, get assigned, must be acknowledged, and **automatically escalate** — `EMPLOYEE → TEAM_LEAD → MANAGER` — if nobody acknowledges them in time. Everything updates live over Socket.IO, and a built-in demo panel flips a fake "Order API" between healthy and failing so the whole incident story can be demoed without a real monitoring stack.

proof-of-concept: one seeded team, one user per role, deterministic escalation targeting. It's built to reliably demonstrate the core communication + incident-lifecycle loop, not to be a multi-tenant product — see [DECISIONS.md](DECISIONS.md#future-scope-out-of-bounds-for-this-poc-noted-for-a-real-version) for what a production version would add.

## Features

- User authentication (JWT + httpOnly cookie)
- Teams and channels
- Real-time messaging with @mentions and toast notifications
- Incident creation, assignment, acknowledgement, and resolution
- Automatic incident escalation with a live worker
- Full incident timeline, derived from an immutable event log
- Demo service panel (flips a simulated API between 200 / 500)
- Playwright end-to-end tests covering auth, the incident lifecycle, and escalation

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React (Vite), React Router, Axios, Socket.IO client, Bootstrap 5 (CSS only) |
| Backend | Node.js, Express, Socket.IO, Mongoose, JWT, bcrypt |
| Database | MongoDB Atlas (free M0 tier) |
| API docs | swagger-jsdoc + swagger-ui-express, served at `/api-docs` |
| Testing | Playwright (3 end-to-end specs) |
| Hosting | Render (backend) + Vercel (frontend) + Atlas (database) |

## Incident state model

Two orthogonal fields describe where an incident stands — a status and a rung on the escalation ladder — never combined into one enum:

```
status:          OPEN ──────► ACKNOWLEDGED ──────► RESOLVED
escalationLevel: EMPLOYEE ──► TEAM_LEAD ──► MANAGER
```

`status` moves forward only (acknowledge, then resolve) and stops escalation the moment it leaves `OPEN`. `escalationLevel` climbs on its own — driven by the backend, never the frontend — as long as `status` stays `OPEN`.

## Incident lifecycle, end to end

```
                    ┌─────────────────────┐
                    │   Incident reported  │
                    └──────────┬───────────┘
                               │
                 reporter == EMPLOYEE (John)?
                               │
             ┌─────────yes─────┴─────no──────────┐
             ▼                                    ▼
   self-assigned to John                incident created UNASSIGNED
   instantly, clock starts              (reporter is TEAM_LEAD/MANAGER)
             │                                    │
             │                     reporter manually assigns to John
             │                     ── or, after AUTO_ASSIGN_WINDOW_MS (10s) ──
             │                     escalation worker auto-assigns to John,
             │                     posts an @John channel mention, logs
             │                     an AUTO_ASSIGNED event
             │                                    │
             └───────────────┬────────────────────┘
                              ▼
                 ┌────────────────────────┐
                 │  assigned to EMPLOYEE   │  ◄── levelChangedAt resets here
                 └────────────┬────────────┘
                               │
                 acknowledged within ESCALATION_ACK_WINDOW_MS (15s)?
                               │
                yes ───────────┴─────────────── no
                 │                               │
                 ▼                               ▼
     ┌─────────────────────┐        escalation worker reassigns to
     │  ACKNOWLEDGED         │      TEAM_LEAD (Sarah), ESCALATED event
     │  escalation frozen    │      logged, both her channel and
     │  for good, at         │      user:<id> room notified
     │  whatever level it's  │                    │
     │  currently at         │       acknowledged within window?
     └──────────┬────────────┘                    │
                │                   yes ───────────┴────────── no
                │                    │                          │
                │                    ▼                          ▼
                │        (frozen, same as above)     escalates again to
                │                                     MANAGER (Mike) —
                │                                     ladder ends here,
                │                                     no further escalation
                │                                                │
                └──────────────────────┬─────────────────────────┘
                                        ▼
                              ┌───────────────────┐
                              │      RESOLVED       │
                              │  (by whoever holds  │
                              │   assignedTo, or a   │
                              │   higher-ranked role) │
                              └───────────────────┘
```

Every arrow above writes an `IncidentEvent` — the timeline shown in the UI is derived entirely from that log, never from frontend state. A separate 5-second worker tick (`backend/src/jobs/escalationWorker.js`, business rules in `services/escalationService.js`) drives every automatic transition; the frontend only requests actions and renders whatever the backend reports back.

## Architecture

```
┌──────────────────┐        HTTPS (Axios, withCredentials)       ┌───────────────────────┐
│   React (Vite)     │ ───────────────────────────────────────►  │   Express API           │
│   Vercel            │ ◄─────────────────────────────────────── │   Render                 │
│                     │        Socket.IO (withCredentials)        │                          │
│                     │ ◄────────────────────────────────────►   │                          │
└──────────────────┘                                            └───────────┬─────────────┘
                                                                              │
                                                                              │ Mongoose
                                                                              ▼
                                                                   ┌───────────────────┐
                                                                   │  MongoDB Atlas (M0) │
                                                                   └───────────────────┘
```

The backend is the sole source of truth: it decides escalation timing, authorization, and incident history. Controllers stay thin and delegate to `services/`; every incident state transition is validated at the API boundary and written to the `IncidentEvent` collection before anything is broadcast. Socket.IO has exactly two room types — `channel:<channelId>` for chat/incident updates scoped to a channel, and `user:<userId>` for personal notifications and incident events aimed at one person — plus a single deliberate global broadcast, `service:health_changed`, for the demo panel.

Full phase-by-phase build notes live in `ARCHITECTURE.md` (local reference, not checked in); the reasoning behind every non-obvious choice — including tradeoffs, bugs found and fixed, and explicitly out-of-scope future work — lives in [DECISIONS.md](DECISIONS.md).

## Prerequisites

- Node.js and npm
- A MongoDB Atlas connection string (free M0 tier is enough — nothing runs locally, no Docker needed)

## Local setup

```
git clone <repository-url>
cd PagerSlack

cd backend
cp .env.example .env        # fill in MONGO_URI and JWT_SECRET
npm install
npm run seed
npm run dev                 # backend on :5000

cd ../frontend
npm install
npm run dev                 # frontend on :5173, proxies /api to the backend
```

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Employee | employee@pagerslack.dev | PagerSlack2026! |
| Team Lead | lead@pagerslack.dev | PagerSlack2026! |
| Manager | manager@pagerslack.dev | PagerSlack2026! |

New registrations always join the seeded "Engineering" team as `EMPLOYEE` — there's no role picker and no invite/join flow (see [DECISIONS.md](DECISIONS.md#future-scope-out-of-bounds-for-this-poc-noted-for-a-real-version)).

## Testing

With the backend and frontend both running (or let Playwright start them for you):

```
npm install
npx playwright install chromium
npm test
```

Three specs: `auth.spec.js` (seeded login), `incident.spec.js` (create → acknowledge → resolve → timeline), `escalation.spec.js` (create → don't acknowledge → verify auto-escalation to the team lead). Escalation timing is overridden to a few seconds in test mode via `playwright.config.js` rather than waiting out the full 15s demo window.

## API docs

Once the backend is running: `GET /api-docs` (Swagger UI, generated from `swagger-jsdoc` annotations on each route).

## Deployment

```
Render (backend)  ──  Express API + Socket.IO server, Node web service
Vercel (frontend) ──  static Vite build, SPA rewrite to index.html
Atlas (database)  ──  already hosted, shared by both local dev and production
```

Backend and frontend end up on different domains, so cross-origin auth needs explicit handling: the JWT cookie is `sameSite:'none', secure:true` in production, CORS whitelists the exact Vercel origin (never `*`), and both the Axios client and the Socket.IO client set `withCredentials: true`.

**Render environment variables:**
```
MONGO_URI=<atlas connection string>
JWT_SECRET=<random string>
CLIENT_URL=<your vercel URL>
NODE_ENV=production
```

**Vercel environment variables:**
```
VITE_API_URL=<your render backend URL>/api/v1
VITE_SOCKET_URL=<your render backend URL>
```

Atlas's Network Access list needs `0.0.0.0/0` allowed, since Render's free tier has no static outbound IP. Render's free tier also spins down on inactivity — send a couple of warm-up requests before any live demo, since the first request after idle can take 30–50s.

## Project structure

```
PagerSlack/
├── backend/     Express API, Socket.IO server, escalation worker, Mongoose models
├── frontend/    React app (Vite)
├── e2e/         Playwright specs
├── scripts/     seed.js
├── ARCHITECTURE.md   phase-by-phase build notes (local reference)
└── DECISIONS.md      why things are built the way they are, and what's deliberately out of scope
```
