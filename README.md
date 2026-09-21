# PagerSlack

A MERN-stack app that fuses Slack-style team chat with PagerDuty-style incident escalation. Team members message in channels, tag each other, and raise incidents from any channel. Incidents carry severity, get assigned, must be acknowledged, and **automatically escalate** — `EMPLOYEE → TEAM_LEAD → MANAGER` — if nobody acknowledges them in time. Everything updates live over Socket.IO, and a built-in demo panel flips a fake "Order API" between healthy and failing so the whole incident story can be demoed without a real monitoring stack.

This is a proof-of-concept: one seeded team, self-chosen roles, deterministic round-robin escalation targeting. It's built to reliably demonstrate the core communication + incident-lifecycle loop, not to be a multi-tenant product — see [DECISIONS.md](DECISIONS.md#future-scope-out-of-bounds-for-this-poc-noted-for-a-real-version) for what a production version would add.

## Links

| What | URL |
|---|---|
| Live app | [pager-slack-nuaq.vercel.app](https://pager-slack-nuaq.vercel.app/login) |
| API docs (local) | [localhost:5000/api-docs](http://localhost:5000/api-docs/#/) — start the backend first |
| API docs (live) | [pagerslack.onrender.com/api-docs](https://pagerslack.onrender.com/api-docs) |
| Demo video | [GitHub Releases](https://github.com/Jesicawdgit/PagerSlack/releases) |

The backend runs on Render's free tier, which sleeps when idle — the first request after a quiet spell can take 30–50 seconds. See [Known limitations](#known-limitations) for a browser caveat on the live link.

## Features

- User authentication (bcrypt-hashed passwords, JWT in an httpOnly cookie) with a role chosen at registration
- Teams and channels
- Real-time messaging with @mentions and toast notifications
- Incident creation, assignment, acknowledgement, and resolution — only the assignee, or someone in a strictly higher role, can acknowledge or resolve
- Automatic incident escalation with a live worker, round-robin across everyone at each level
- Full incident timeline, derived from an immutable event log
- Demo service panel (flips a simulated API between 200 / 500)
- Swagger API documentation
- Playwright end-to-end tests covering auth, the incident lifecycle, and escalation, plus backend unit tests for the round-robin picker and the permission rule

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19 (Vite), React Router 7, Axios, Socket.IO client, Bootstrap 5 (CSS only) |
| Backend | Node.js, Express 5, Socket.IO 4, Mongoose 9, JWT, bcrypt |
| Database | MongoDB Atlas (free M0 tier) |
| API docs | swagger-jsdoc + swagger-ui-express, served at `/api-docs` |
| Testing | Playwright (3 end-to-end specs) + Node's built-in test runner (backend unit tests) |
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
                   reporter is an EMPLOYEE?
                               │
             ┌─────────yes─────┴─────no──────────┐
             ▼                                    ▼
   self-assigned to the reporter        incident created UNASSIGNED
   instantly, clock starts              (reporter is TEAM_LEAD/MANAGER)
             │                                    │
             │                     reporter manually assigns an employee
             │                     ── or, after AUTO_ASSIGN_WINDOW_MS (10s) ──
             │                     the worker auto-assigns the next EMPLOYEE
             │                     in the rotation, posts an @mention in the
             │                     channel, logs an AUTO_ASSIGNED event
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
     ┌─────────────────────┐        worker reassigns to the next
     │  ACKNOWLEDGED         │      TEAM_LEAD in the rotation,
     │  escalation frozen    │      ESCALATED event logged, both
     │  for good, at         │      their channel and user:<id>
     │  whatever level it's  │      room notified
     │  currently at         │                    │
     └──────────┬────────────┘       acknowledged within window?
                │                                 │
                │                   yes ───────────┴────────── no
                │                    │                          │
                │                    ▼                          ▼
                │        (frozen, same as above)     escalates again to the
                │                                     next MANAGER in the
                │                                     rotation — ladder ends
                │                                     here, nothing further
                └──────────────────────┬─────────────────────────┘
                                        ▼
                              ┌───────────────────┐
                              │      RESOLVED       │
                              │  (by the assignee,  │
                              │   or a strictly      │
                              │   higher role)       │
                              └───────────────────┘
```

Every arrow above writes an `IncidentEvent` — the timeline shown in the UI is derived entirely from that log, never from frontend state. A separate 5-second worker tick (`backend/src/jobs/escalationWorker.js`, business rules in `services/escalationService.js`) drives every automatic transition; the frontend only requests actions and renders whatever the backend reports back.

## Round-robin escalation

Escalation only ever moves **up** the ladder, never sideways to a peer: if an employee doesn't acknowledge, the incident goes to a team lead, not to another employee — a peer has no more authority than the person who missed it.

Several people can hold the same role, so the worker picks among them round-robin. At each level the team's users with that role are ordered by sign-up time and cycled through, using a cursor stored on the team (`Team.rotation`, the last user assigned at that level):

```json
{ "name": "Engineering",
  "rotation": { "EMPLOYEE": "<userId>", "TEAM_LEAD": "<userId>", "MANAGER": null } }
```

- The next person is the one after the cursor, and the rotation wraps around. A missing cursor starts at the first user.
- The current assignee is never picked, so an incident is never "escalated" to whoever already holds it.
- If nobody holds the next level, the picker skips up to the next level that has someone. If nobody is above, the worker logs a warning and leaves the incident alone.
- Auto-assign of an unassigned incident uses the same picker at the `EMPLOYEE` level. Manual assignment never advances the rotation.

The picker is `pickAssigneeForLevel` in `backend/src/services/escalationService.js`.

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

The backend is the sole source of truth: it decides escalation timing, authorization, and incident history. Controllers stay thin and delegate to `services/`; every incident state transition is validated at the API boundary and written to the `IncidentEvent` collection before anything is broadcast. Acknowledge and resolve are allowed for the current assignee or for someone in a strictly higher role than the incident's escalation level, so a peer can't silently stop a colleague's escalation. Socket.IO has exactly two room types — `channel:<channelId>` for chat/incident updates scoped to a channel, and `user:<userId>` for personal notifications and incident events aimed at one person — plus a single deliberate global broadcast, `service:health_changed`, for the demo panel.

Full phase-by-phase build notes live in [ARCHITECTURE.md](ARCHITECTURE.md); the reasoning behind every non-obvious choice — including tradeoffs, bugs found and fixed, and explicitly out-of-scope future work — lives in [DECISIONS.md](DECISIONS.md).

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

Optional backend environment variables tune the escalation timing (defaults match the demo):

| Variable | Default | Meaning |
|---|---|---|
| `ESCALATION_POLL_INTERVAL_MS` | 5000 | How often the worker checks for work |
| `ESCALATION_ACK_WINDOW_MS` | 15000 | Time each level gets to acknowledge before escalating |
| `AUTO_ASSIGN_WINDOW_MS` | 10000 | Time a lead/manager-reported incident waits for a manual assignment before auto-assign |

## Demo accounts

`npm run seed` creates one team ("Engineering"), four channels, the "Order API" demo service, and three optional demo accounts:

| Role | Email | Password |
|---|---|---|
| Employee | employee@pagerslack.dev | PagerSlack2026! |
| Team Lead | lead@pagerslack.dev | PagerSlack2026! |
| Manager | manager@pagerslack.dev | PagerSlack2026! |

These are just convenience accounts. Anyone can also register: new users join "Engineering" with the role they pick (Employee, Team Lead or Manager). There's no invite/join flow, so anyone can pick any role — a demo trade-off, see [DECISIONS.md](DECISIONS.md#dynamic-roles--round-robin-escalation). First names must be unique on the team so `@mentions` stay unambiguous. The seeded accounts are the oldest at each level, so they start each round-robin rotation; to see escalation cycle through people, register a second team lead or employee.

## Testing

**End-to-end** — with the backend and frontend both running (or let Playwright start them for you):

```
npm install
npx playwright install chromium
npm test
```

Three specs: `auth.spec.js` (seeded login), `incident.spec.js` (create → acknowledge → resolve → timeline), `escalation.spec.js` (create → don't acknowledge → verify it escalates away from the employee). Escalation timing is overridden to a few seconds in test mode via `playwright.config.js` rather than waiting out the full 15s demo window.

**Backend unit tests** — Node's built-in test runner, no extra dependencies:

```
cd backend
npm test
```

They cover the round-robin picker (wrap-around, missing cursor, skipped empty level, excluded current assignee, no candidates) and the acknowledge/resolve permission rule.

## API docs

Interactive Swagger UI, generated from `swagger-jsdoc` annotations: [local](http://localhost:5000/api-docs/#/) (backend running) or [live](https://pagerslack.onrender.com/api-docs).

All routes live under `/api/v1` and return one of two shapes:

```json
{ "success": true, "data": {} }
{ "success": false, "error": { "code": "INCIDENT_NOT_FOUND", "message": "..." } }
```

## Deployment

```
Render (backend)  ──  Express API + Socket.IO server, Node web service
Vercel (frontend) ──  static Vite build, SPA rewrite to index.html
Atlas (database)  ──  already hosted, shared by both local dev and production
```

Live app: <https://pager-slack-nuaq.vercel.app/login>

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

## Known limitations

- **Roles are self-chosen.** With no invitation flow, anyone can register as a Manager. Fine for a demo, not for production.
- **No refresh-token rotation.** The JWT cookie lasts 7 days and logout only clears the client's cookie.
- **Third-party cookies on the live link.** Because the frontend (Vercel) and backend (Render) are different sites, the login cookie is a cross-site cookie. Browsers that block third-party cookies by default — incognito windows, Safari, Brave — can log in but then get 401s on every following request. Use a regular Chrome or Edge window for the live app; local development is unaffected because the Vite proxy makes everything same-origin.

## Project structure

```
PagerSlack/
├── backend/     Express API, Socket.IO server, escalation worker, Mongoose models
│   └── tests/unit/   backend unit tests (node:test)
├── frontend/    React app (Vite)
├── e2e/         Playwright specs
├── scripts/     seed.js
├── ARCHITECTURE.md   phase-by-phase build notes
└── DECISIONS.md      why things are built the way they are, and what's deliberately out of scope
```
