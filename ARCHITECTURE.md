# Architecture

This doc is built up phase by phase (see `CLAUDE.md`'s phase order) — each section documents what that phase added, file by file, down to what individual lines/blocks do. Start here if you're picking the project back up cold.

---

## Phase 0 — Skeleton

**What it proves:** a real, live round trip — browser → Vite dev proxy → Express → MongoDB Atlas — with nothing faked. The frontend shows "Backend Online" only if the backend actually booted, actually connected to Atlas, and actually answered an HTTP request. No deploy yet (see `DECISIONS.md` — deferred to Phase 10 per project decision).

### Request flow

```
Browser (localhost:5173)
   │  GET /api/v1/health
   ▼
Vite dev server proxy  ──────────────►  Express server (localhost:5000)
   (rewrites /api/* to                      │  app.js: cors → cookieParser → json → route
    http://localhost:5000/*)                ▼
                                        GET /api/v1/health handler
                                        returns {success:true, data:{...}}
   ▲                                        │
   └────────────────────────────────────────┘
   React state updates → "Backend Online" card renders
```

### Boot sequence

```
node src/server.js
  → require('./app')            // builds Express app (routes, middleware) — does NOT listen yet
  → http.createServer(app)      // wraps app in a raw Node HTTP server
  → await connectDB()           // blocks until Mongoose connects to Atlas, or exits process
  → server.listen(env.PORT)     // only starts accepting requests once Mongo is confirmed up
```
This ordering matters: the server never accepts traffic while the database is unreachable, so a request can never hit a route that assumes a DB connection exists but doesn't have one.

---

### Backend files

#### `backend/src/config/environment.js`

```js
const dotenv = require('dotenv');
dotenv.config();
```
Loads `backend/.env` into `process.env`. This must run before anything else reads env vars, which is why every other file gets its env values *through this module* (`require('./config/environment')`) rather than calling `dotenv.config()` themselves or reading `process.env` directly — one place owns "has the environment been loaded," so there's no ordering bug where a file reads `process.env.MONGO_URI` before `dotenv.config()` has run.

```js
const REQUIRED_KEYS = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'CLIENT_URL', 'NODE_ENV'];
const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
```
Fails loud and immediately if `.env` is missing a key, instead of letting the app boot into a half-configured state (e.g. `JWT_SECRET` being `undefined` would silently make Phase 1's auth insecure). `process.exit(1)` is deliberate — a misconfigured server should never come up "successfully."

```js
const env = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL,
  NODE_ENV: process.env.NODE_ENV,
};

module.exports = env;
```
Exports a plain, flat object (not `process.env` itself) — so callers get exactly the five known keys, nothing else leaks through, and it reads cleanly as `env.PORT` etc. everywhere else in the codebase.

#### `backend/src/utils/logger.js`

```js
function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (...args) => console.log(`[${timestamp()}] INFO:`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] WARN:`, ...args),
  error: (...args) => console.error(`[${timestamp()}] ERROR:`, ...args),
};

module.exports = logger;
```
A thin wrapper around `console.*`, not a new dependency (no winston/pino — not needed for a demo app). The only value it adds over raw `console.log` is a consistent ISO timestamp prefix and a consistent severity label, so backend logs are scannable. `database.js` and `server.js` use this instead of `console.log` directly so log output stays uniform as more files start logging in later phases.

#### `backend/src/config/database.js`

```js
const mongoose = require('mongoose');
const env = require('./environment');
const logger = require('../utils/logger');

async function connectDB() {
  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
```
Registers listeners on Mongoose's *shared* connection object before connecting, so any error or disconnect *after* the initial successful connect (e.g. Atlas hiccups mid-demo) gets logged instead of failing silently. This is separate from the try/catch below, which only covers the *initial* connection attempt.

```js
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB initial connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
```
`mongoose.connect()` returns a promise that rejects if the *first* connection attempt fails (this is what surfaced the `querySrv ETIMEOUT` DNS issue during setup — see `DECISIONS.md`/session history). On that failure we exit the process rather than let `server.js` call `.listen()` against a server with no working database — per CLAUDE.md's "the backend is the source of truth" principle, a backend that can't reach its data shouldn't pretend to be up.

#### `backend/src/middleware/errorMiddleware.js`

```js
function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}
```
Express middleware mounted *after* all real routes in `app.js` — if a request falls through to here, nothing matched it, so it's a 404. Uses CLAUDE.md's mandated error shape (`{success:false, error:{code, message}}`) so every error response, from Phase 0 onward, has the same shape the frontend can rely on parsing uniformly.

```js
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Something went wrong',
    },
  });
}

module.exports = { notFound, errorHandler };
```
Express recognizes this as an *error-handling* middleware specifically because it declares **four** parameters (`err, req, res, next`) — that's not stylistic, Express's internal dispatch checks the function's arity to decide whether to treat it as a normal or error-handling middleware. It reads `err.status`/`err.code` if present (which later phases' `ApiError` class — Phase 1 — will set) and falls back to generic 500/`INTERNAL_ERROR` for anything unexpected, so a thrown error anywhere in the app can never leak a raw stack trace to the client.

#### `backend/src/app.js`

```js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/environment');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
```
Builds the Express app but deliberately does **not** call `app.listen()` here — that's `server.js`'s job. Keeping app construction separate from "start listening" means `app` is an importable, testable value (useful for Phase 9's tests, which can exercise routes without binding a real port), and it's also what lets Phase 3 wrap this same `app` in an `http.Server` that Socket.IO attaches to, without restructuring anything.

```js
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());
```
Three global middleware, in order:
- `cors(...)` — restricts which origins can call this API with credentials. `origin: env.CLIENT_URL` (not `'*'`) plus `credentials: true` is required per CLAUDE.md's auth rules — a wildcard origin silently breaks cookie-based auth, and Phase 1 needs cookies to work.
- `cookieParser()` — parses the `Cookie` header into `req.cookies`. Not used by anything yet in Phase 0, but auth (Phase 1) reads the JWT from a cookie, so this needs to already be in the middleware chain.
- `express.json()` — parses JSON request bodies into `req.body`. Nothing in Phase 0 has a body, but every POST route from Phase 1 onward needs this.

```js
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});
```
The one real route in Phase 0. Mounted at `/api/v1/health` — the `/api/v1` prefix matches CLAUDE.md's deployment section (`VITE_API_URL=<backend>/api/v1`), even though CLAUDE.md's endpoint list shows unprefixed paths like `POST /auth/register` — all of Phase 1+'s routes will be understood as relative to this same `/api/v1` base (see `DECISIONS.md`). Returns the standard success envelope with a few debug-useful fields — this is intentionally the *only* piece of state the frontend checks to decide "is the backend alive."

```js
app.use(notFound);
app.use(errorHandler);

module.exports = app;
```
These two must be registered **last** — Express middleware runs in registration order, so anything not matched by an earlier route falls through to `notFound`, and any error thrown/passed to `next(err)` anywhere above gets caught by `errorHandler` at the bottom of the chain.

#### `backend/src/server.js`

```js
const http = require('http');
const app = require('./app');
const env = require('./config/environment');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

const server = http.createServer(app);
```
Wraps the Express `app` in a plain Node `http.Server`. Functionally near-identical to `app.listen()` at this stage, but this is the object Phase 3 needs a handle on (`new Server(server)` from `socket.io`) — deciding this now avoids a refactor later.

```js
async function start() {
  await connectDB();
  server.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`);
  });
}

start();
```
The actual boot sequence, as an `async` function so `connectDB()` can be awaited before `listen()` runs — see "Boot sequence" above. If `connectDB()` throws or exits the process (it does the latter internally on failure), `server.listen` is simply never reached.

#### `backend/.env.example`

```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/pagerslack?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```
Mirrors the five keys `environment.js` requires, with placeholder (not real) values, committed to git so any contributor knows the exact shape of `.env` they need to create locally. The real `backend/.env` stays gitignored and untracked — never commit it, it has live Atlas credentials.

#### `backend/package.json` (edited)

```json
"main": "src/server.js",
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  ...
}
```
`main` now points at the real entry file (was `index.js`, which never existed). `npm run dev` uses `nodemon` (already an installed devDependency) to auto-restart on file changes during development; `npm start` is the plain, no-watch production-style entry point Phase 10's deploy will use.

---

### Frontend files

#### `frontend/vite.config.js`

```js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
```
`server.proxy` makes the Vite dev server forward any request whose path starts with `/api` to `http://localhost:5000` instead of trying to serve it itself. `changeOrigin: true` rewrites the request's `Host` header to match the target, which some backends require. Practical effect: frontend code can call `client.get('/health')` against a *relative* `/api/v1/health` path and it "just works" in dev — no hardcoded backend URL, no CORS preflight to reason about locally. This proxy only exists in dev; the built/deployed frontend (Phase 10) talks to the real backend URL directly over real CORS, which is why `app.js`'s `cors()` config still matters even though dev traffic never technically crosses an origin boundary right now.

#### `frontend/src/api/client.js`

```js
import axios from 'axios';

const client = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

export default client;
```
A single shared axios instance instead of calling `axios.get(...)` ad hoc from components. `baseURL: '/api/v1'` means every call site just writes the path *after* that (e.g. `/health`, and in Phase 1, `/auth/login`) — matches the backend's `/api/v1` mount prefix exactly. `withCredentials: true` tells the browser to include cookies on requests to this instance, which does nothing yet in Phase 0 (no cookies are set) but is required for Phase 1's cookie-based JWT auth to work at all — set once here rather than remembered per-call later.

#### `frontend/src/App.jsx`

```jsx
import { useEffect, useState } from 'react';
import client from './api/client';
import './App.css';

function App() {
  const [status, setStatus] = useState('checking');
  const [details, setDetails] = useState(null);
```
Two pieces of state: `status` is one of `'checking' | 'online' | 'offline'` and drives which message/color renders; `details` holds the payload from a successful health check (so the UI can show `env`/`timestamp`, proving the response is real data, not a hardcoded string).

```jsx
  useEffect(() => {
    let cancelled = false;

    client
      .get('/health')
      .then((res) => {
        if (cancelled) return;
        setStatus('online');
        setDetails(res.data.data);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('offline');
        setDetails(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);
```
Runs once on mount (`[]` dependency array) and fires the health check. `res.data.data` — the outer `.data` is axios's response body, the inner `.data` is the `data` field of the backend's `{success, data}` envelope, so this is literally unwrapping the standard response shape down to the payload. The `cancelled` flag guards against calling `setState` after the component has unmounted (React warns/leaks otherwise) — not strictly necessary for a single top-level component that never unmounts in Phase 0, but it's the correct pattern to have in place before this logic gets reused/moved in later phases.

```jsx
  return (
    <div className="status-page">
      <h1>PagerSlack</h1>
      <div className={`status-card status-${status}`}>
        {status === 'checking' && <p>Checking backend...</p>}
        {status === 'online' && (
          <>
            <p className="status-label">Backend Online</p>
            <p className="status-meta">
              env: {details?.env} · {details?.timestamp}
            </p>
          </>
        )}
        {status === 'offline' && <p className="status-label">Backend Offline</p>}
      </div>
    </div>
  );
}

export default App;
```
Plain conditional rendering, no library. `status-${status}` interpolates into the class name (`status-online` / `status-offline` / `status-checking`) so `App.css` can color each state without JS branching on style. `details?.env` uses optional chaining because `details` is `null` until the first successful response resolves — this whole component is the entirety of Phase 0's UI; routing, layout, and real pages start Phase 1.

#### `frontend/src/App.css` / `frontend/src/index.css`

`App.css` is scoped to this one status page (centered flex column, a bordered card, green/red label colors per state) and gets fully replaced once real UI exists from Phase 1 onward. `index.css` was trimmed down from the stock Vite template — kept the CSS custom properties for text/background/border colors (light + dark via `prefers-color-scheme`, since those are cheap to keep and other components can reuse the same tokens) and a `box-sizing: border-box` reset, but removed the template's hero/counter/docs-link styling that no longer has matching markup.

#### `frontend/index.html`

Single change: `<title>frontend</title>` → `<title>PagerSlack</title>` — the only remaining stock-template artifact in this file besides the favicon.

---

### Root

#### `package.json`

```json
{
  "name": "pagerslack",
  "private": true,
  "version": "0.1.0",
  "scripts": {}
}
```
Placeholder matching CLAUDE.md's target folder tree, which expects a root `package.json`. Empty `scripts` for now — this is where Phase 9's Playwright config/scripts and Phase 10's deploy-related scripts will eventually live. Deliberately **not** an npm workspaces root (see `DECISIONS.md`) — `backend/` and `frontend/` keep independent `node_modules`.

#### `DECISIONS.md`

Not code, but worth noting here: this is where every non-obvious tradeoff from each phase gets logged as it's made (not deferred to a Phase 9 writing pass), so the "why" behind choices like the `/api/v1` prefix or skipping workspaces stays attached to the decision instead of being re-derived later.

---

## Phase 1 — Auth

**What it proves:** register, login, logout, and session-restore-on-refresh all work end-to-end against the live Atlas-backed API, with the backend as the sole source of truth for who's authenticated — the frontend's `ProtectedRoute` is a UX convenience, never the real authorization boundary (that's `protect` on the backend).

**Verified before building:** Express 5.2.1 (via its `router@2.2.0` dependency) auto-detects when a route handler returns a Promise and forwards rejections to `next(err)` — confirmed by grepping `node_modules/router/lib/layer.js` for `isPromise`. So every controller below is a plain `async` function that `throw`s on error, with zero manual `try/catch`/`next(err)` — Express catches the rejection and routes it straight to Phase 0's `errorHandler`.

### Backend files

#### `backend/src/utils/ApiError.js`

```js
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
module.exports = ApiError;
```
A plain `Error` subclass carrying an HTTP `status` and a machine-readable `code`. This is the missing piece Phase 0's `errorHandler` was already written to consume (`err.status`/`err.code`) — no edits needed there. Every "expected" failure from here on (`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `NO_TOKEN`, ...) is a `throw new ApiError(...)`, not a hand-rolled `res.status().json()` — one code path for every route to report a clean error.

#### `backend/src/models/User.js`

```js
const ROLES = ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'EMPLOYEE' },
}, { timestamps: true });
```
`select: false` on `password` means a plain `User.findOne({email})` never returns the hash at all — you have to explicitly opt in with `.select('+password')` (see `authService.loginUser` below). This is defense-in-depth: even a future bug that accidentally serializes a raw Mongoose document can't leak a password hash, because the field isn't there unless asked for by name. The `email` regex is a second line of defense behind `express-validator`'s boundary check — it protects any caller that skips the HTTP layer entirely, like Phase 9's `scripts/seed.js` will.

```js
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});
```
Belt-and-suspenders alongside `select:false`: even if a document *was* fetched with the password included, `res.json({user})` (which calls `JSON.stringify` → `toJSON()` under the hood) strips it unconditionally.

```js
module.exports = User;
module.exports.ROLES = ROLES;
```
Mongoose models are functions (constructors), so attaching `.ROLES` directly onto the exported model works exactly like a static property — `authRoutes.js` imports `{ ROLES }` from `'../models/User'` so the registration validation checks against the *same* array the schema's `enum` uses, instead of two hand-typed lists that could silently drift apart.

#### `backend/src/services/authService.js`

```js
async function registerUser({ name, email, password, role }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, password: hashed, role });
  return user;
}
```
The email-uniqueness check is an explicit query, not a caught `E11000` duplicate-key error from the schema's `unique: true` index. Reason: a raw MongoDB duplicate-key error doesn't have `.status`/`.code` in the shape `errorHandler` expects, so letting it bubble up unhandled would fall through to a generic, unhelpful 500 — the explicit pre-check guarantees a clean `409 EMAIL_TAKEN` every time. The schema's `unique: true` index still exists as a backstop against a theoretical race between the check and the create.

```js
async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  return user;
}
```
`.select('+password')` is the explicit opt-in the model's `select:false` demands. Both failure branches — no such user, and wrong password — throw the *identical* `ApiError`. This is deliberate: if a "no such user" response looked different from a "wrong password" response, an attacker could enumerate which emails have accounts on the system just by trying logins. One generic message closes that off.

```js
function generateToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}
```
`TOKEN_EXPIRY = '7d'` is a local constant, not a 6th environment variable — `environment.js`'s whole design point is validating the small, closed set of things the app truly cannot boot without; token lifetime is an MVP-tuning knob, not a boot-blocker (see `DECISIONS.md`). The JWT payload only carries `sub` (user id) and `role` — enough for `authMiddleware.js` to look the user up and for future phases to make quick role checks without a DB round-trip if ever needed, but nothing sensitive.

#### `backend/src/middleware/authMiddleware.js`

```js
async function protect(req, res, next) {
  const token = req.cookies.token;
  if (!token) throw new ApiError(401, 'NO_TOKEN', 'Authentication required');

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Session expired or invalid, please log in again');
  }

  const user = await User.findById(decoded.sub);
  if (!user) throw new ApiError(401, 'INVALID_TOKEN', 'Session expired or invalid, please log in again');

  req.user = user;
  next();
}
```
Two distinct error codes for what's functionally the same outcome (`user: null` on the frontend) — `NO_TOKEN` (cookie never existed) vs. `INVALID_TOKEN` (expired, tampered, or the user was deleted after the token was issued). They cost nothing to keep separate and make manual debugging of cookie issues much faster than one generic "unauthenticated" code would. Note `jwt.verify` throwing is caught with a bare `catch {}` (no binding) — we don't care *why* it failed, any verify failure is the same `INVALID_TOKEN` response. This is the one function in the auth slice guarded by an explicit `try/catch` rather than relying on Express 5's automatic promise-rejection forwarding — because `jwt.verify` throws *synchronously*, not via a rejected promise, so it needs a real `try/catch` to convert into the `ApiError` we want instead of a raw `JsonWebTokenError` reaching `errorHandler` (which would still work generically, but with the wrong `code`).

#### `backend/src/middleware/validateRequest.js`

```js
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    throw new ApiError(400, 'VALIDATION_ERROR', message);
  }
  next();
}
```
Generic and route-agnostic — this doesn't know anything about auth specifically. It's meant to be dropped into every future phase's route file the same way `authRoutes.js` uses it: an array of `express-validator` `body()`/`param()`/`query()` chains, then this middleware, then the controller. `errors.array().map(e => e.msg).join(', ')` collapses potentially multiple field failures (e.g. both a bad email *and* a short password) into one readable message rather than only surfacing the first.

#### `backend/src/controllers/authController.js`

```js
function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  };
}

function setAuthCookie(res, token) {
  res.cookie('token', token, { ...cookieOptions(), maxAge: SEVEN_DAYS_MS });
}
```
This one function is the entire implementation of CLAUDE.md's cross-origin cookie rule ("`sameSite:'none',secure:true` only needed in production... local dev can use `sameSite:'lax'`") — it branches on `env.NODE_ENV` once, here, so `register` and `login` (which both call it) can never issue cookies with different options from each other, and Phase 10's deploy cutover needs zero changes to this function — it already does the right thing in production because `NODE_ENV` will be `'production'` on Render. `logout`'s `res.clearCookie('token', cookieOptions())` reuses the *same* function (minus `maxAge`, which `clearCookie` doesn't need) — browsers only clear a cookie if the clearing call's options match the ones it was set with, so any drift here would silently fail to log the user out.

```js
async function register(req, res) {
  const { name, email, password, role } = req.body;
  const user = await authService.registerUser({ name, email, password, role });
  const token = authService.generateToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ success: true, data: { user } });
}
```
`register` auto-logs-in (issues the cookie immediately, same as `login` does) rather than requiring a separate login step afterward — matches the Phase 1 roadmap goal of "land in workspace shell." Notice the controller itself has no `try/catch` anywhere in this file — if `registerUser` throws an `ApiError`, Express 5's promise handling (see the top of this section) carries it straight to `errorHandler` with no code needed here. This is what "controllers stay thin" looks like in practice: parse `req.body`, call the service, shape the response — the actual business rules (uniqueness, hashing, generic error messages) all live in `authService.js`.

#### `backend/src/routes/authRoutes.js`

```js
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(ROLES).withMessage('Invalid role'),
  ],
  validateRequest,
  authController.register
);
```
The shape every route in this file (and every future phase's route files) follows: an array of `express-validator` chains, then `validateRequest`, then the controller — three ingredients, always in that order, so a malformed request never reaches business logic. `role` is `.optional()` — if the client omits it, Mongoose's schema `default: 'EMPLOYEE'` fills it in; if the client *does* send it, it's checked against the same `ROLES` array the schema enum uses. `/logout` and `/me` are mounted behind `protect` (imported from `authMiddleware.js`) with no validation chains — there's no request body to validate, only a cookie, which `protect` itself checks.

Deliberately **not** in this file: any `@swagger` JSDoc blocks. See `config/swagger.js` below for where those live instead — a routes file's only job here is routing and validation wiring, not documentation.

#### `backend/src/config/swagger.js`

Two things living in one file, wired together: a `@swagger` JSDoc comment block (right at the top, above the actual code) documenting all four `/auth/*` paths in OpenAPI 3 format — including a `cookieAuth` security scheme so Swagger UI correctly shows `/auth/logout` and `/auth/me` as requiring the `token` cookie — and, below that, the `swaggerJsdoc(...)` call that turns those comments into a spec object:

```js
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'PagerSlack API', version: '1.0.0', ... },
    servers: [{ url: '/api/v1' }],
  },
  apis: ['./src/config/swagger.js'],
});
```
`apis` tells `swagger-jsdoc` which files to scan for `@swagger` comments — pointed at this file itself rather than `./src/routes/*.js`, which is the more common pattern. This project centralizes all documentation blocks in this one file instead of scattering them across each route file (see `DECISIONS.md`); every future phase's routes add their own `@swagger` block here, and this file's `apis` array stays a one-element array pointing at itself. Note this file only *builds the spec object* — it doesn't serve anything by itself. `swagger-jsdoc` (this file) and `swagger-ui-express` (wired in `app.js`, next) are two separate packages doing two separate jobs: one generates the OpenAPI JSON, the other turns that JSON into the browsable `/api-docs` page.

#### `backend/src/app.js` (edited)

```js
app.use('/api/v1/auth', authRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFound);
app.use(errorHandler);
```
Both new lines land **before** `notFound`/`errorHandler`, which — per Phase 0's own rule — must stay the last two things mounted, since they're what every request falls through to once nothing else has matched. `swaggerUi.serve` (a static-asset middleware) and `swaggerUi.setup(swaggerSpec)` (the actual page) are both required as a pair — `serve` alone doesn't render anything, and `setup` alone has no assets to reference.

### Frontend files

#### `frontend/src/theme.css` (new)

The single place every future phase's CSS pulls color from. Two layers: brand/severity tokens as plain custom properties (`--ps-primary`, `--ps-severity-high`, etc. — see the file for the full list), and then targeted overrides of Bootstrap's own component-level CSS variables. The second layer exists because Bootstrap's shipped CSS bakes most of its colors from Sass *at build time* — overriding the single global `--bs-primary` variable does **not** cascade into `.btn-primary`'s actual background, because that class's CSS already has a literal hex value compiled in. The fix used here: override each component's own local variables directly, e.g. `.btn-primary { --bs-btn-bg: var(--ps-primary); ... }`. The hover/active/focus variants are set to the **identical** value as the resting state — that's the concrete mechanism behind "avoid hovers" against a framework that ships hover-darken effects by default; it's not that no hover CSS gets written, it's that the hover CSS explicitly cancels itself out.

#### `frontend/src/main.jsx` (edited)

```js
import 'bootstrap/dist/css/bootstrap.min.css'
import './theme.css'
import './index.css'
```
Order matters: Bootstrap's CSS loads first so its default component styles exist to be overridden; `theme.css` loads second so its overrides win the cascade (same-specificity CSS rules resolve by source order, last one wins); `index.css`'s minimal reset loads last but doesn't touch any color property, so it never fights `theme.css`. The other change here: `<App/>` is now wrapped in `<BrowserRouter>` — this has to live above `<App/>` (not inside it) since `App.jsx`'s own `<Routes>` needs a router context to already exist above it in the tree.

#### `frontend/src/index.css` (edited)

Phase 0's version of this file carried over stock-Vite-template dark-mode CSS (a `@media (prefers-color-scheme: dark)` block redefining `--bg` to a dark color). That's now deleted — CLAUDE.md puts dark/light theming out of scope entirely, and worse, it was silently fighting the new deliberate off-white palette on any machine with system dark mode on. What's left is a genuinely minimal reset: `box-sizing: border-box`, `body { margin: 0 }`, and a font stack. No color properties at all — `theme.css` and Bootstrap own every color in the app now.

#### `frontend/src/api/authApi.js` (new)

Four one-line functions (`register`, `login`, `logout`, `me`), each a thin call through the shared `client` from Phase 0 (`baseURL:'/api/v1'`, `withCredentials:true`). No logic here at all on purpose — this file's only job is "know the four auth URLs," so nothing else in the frontend hardcodes an `/auth/...` path string.

#### `frontend/src/context/AuthContext.jsx` (new)

```jsx
useEffect(() => {
  authApi.me()
    .then((res) => setUser(res.data.data.user))
    .catch(() => setUser(null))
    .finally(() => setLoading(false));
}, []);
```
Runs once on mount. This is the entire mechanism behind "session survives a page refresh" — the cookie itself is already sitting in the browser from a previous login (httpOnly, so JavaScript can't even read it directly), and this effect asks the backend "who am I, based on whatever cookie you just received" every time the app boots cold. A failed `me()` call (401, cookie missing or expired) is treated as a normal, expected outcome — `.catch(() => setUser(null))`, not a logged error — because "not logged in" is not a failure state for this app, it's the default one.

```jsx
async function login(credentials) {
  const res = await authApi.login(credentials);
  setUser(res.data.data.user);
  return res.data.data.user;
}
```
`login`, `register`, and `logout` all follow this shape: call the API, then synchronize local `user` state from the *response*, never by re-deriving it locally. This keeps the frontend from ever guessing at what the backend decided — same "backend is the source of truth" principle Phase 0's `ARCHITECTURE.md` entry already flagged for `ProtectedRoute`, applied here to the write side too.

#### `frontend/src/hooks/useAuth.js` (new)

```js
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
```
The `undefined` check exists because `createContext(undefined)` was deliberately given no default value — if a future component tries to call `useAuth()` outside of `<AuthProvider>` (a wiring mistake in `App.jsx`), this throws immediately with a clear message instead of quietly returning `undefined` and causing a confusing `Cannot read properties of undefined (reading 'user')` several lines later somewhere else.

#### `frontend/src/components/common/Button.jsx` / `Badge.jsx` (new)

```jsx
export default function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
```
Deliberately this thin — the entire value of this component is that "the Bootstrap class name + theme.css override live in exactly one place," not any behavior. `{...props}` forwards everything else (`onClick`, `type`, `disabled`, ...) straight to the underlying `<button>` untouched. `Badge.jsx` is the same shape (`variant` → `badge badge-{variant}`), used for both the role tag on `Workspace` now and severity/status pills once Phase 4 needs them — one component, two unrelated call sites, because the underlying pattern (colored pill, no interaction) is identical.

#### `frontend/src/pages/Login.jsx` / `Register.jsx` (new)

Structurally identical: a Bootstrap `.card` centered via flex utilities, a form with controlled `useState` inputs, a submit handler that calls the corresponding `AuthContext` function inside a `try/catch`, navigates to `/` on success, and on failure reads `err.response?.data?.error?.message` — the exact `message` field from the backend's standard `{success:false,error:{code,message}}` shape — into an inline Bootstrap `.alert-danger`. This is the concrete proof the frontend actually consumes the standard error envelope rather than showing a generic "something went wrong" for every failure. `Register.jsx` additionally has the role `<select>` (`EMPLOYEE`/`TEAM_LEAD`/`MANAGER`) — the only way, anywhere in this app's scope, to create a non-`EMPLOYEE` test account outside the 3 fixed seed users.

#### `frontend/src/pages/Workspace.jsx` (new)

Minimal on purpose — full sidebar/channel UI is Phase 2's job. What's here: a welcome message, the user's role rendered through `<Badge variant="role">` (teal, matching the mockup's role-tag treatment), and a logout `Button` that calls `AuthContext`'s `logout()` then navigates to `/login`.

#### `frontend/src/App.jsx` (full rewrite)

```jsx
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
```
The `if (loading) return null` line is the one-line fix for a real bug class: without it, `ProtectedRoute` would redirect to `/login` *immediately* on every page load — before `AuthContext`'s mount-time `me()` call has had a chance to resolve — even for a genuinely logged-in user with a valid cookie, because `user` starts as `null` until that request comes back. Waiting for `loading` to flip to `false` first is what makes "refresh the page and stay logged in" actually work instead of flashing the login page every time. `replace` on the `<Navigate>` means the redirect doesn't leave a bogus `/` entry in browser history that the back button would return to.

Route table: `/login` and `/register` are public; `/` is wrapped in `ProtectedRoute` and renders `Workspace`. `<AuthProvider>` wraps the whole `<AppRoutes>` tree (not placed in `main.jsx`) so `main.jsx` stays a pure bootstrap file with no app-specific logic — Phase 0's original one-job simplicity for that file is preserved.

---

## Phase 2 — Teams & Channels

**What it proves:** a user can create a team (auto-joining it), create channels in it, and switch between them via a persistent sidebar shell — all driven by real backend state, with `User.team` as the single fact the whole frontend hangs off of.

### Backend files

#### `backend/src/models/User.js` (edited)

```js
team: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Team',
  default: null,
},
```
The one field added to an existing model this phase — flagged as coming in Phase 1's `DECISIONS.md` ("nothing for it to reference until Team model exists"). Nullable: a freshly-registered user has no team until they create one. No `toJSON` transform change needed — a raw team id is safe to expose, unlike the password field that transform exists to hide.

#### `backend/src/models/Team.js` / `Channel.js` (new)

`Team`: `name` (unique — a global namespace of team names, not per-anything), `createdBy` (ObjectId ref User — free to persist since `req.user._id` is already in hand at creation time, no reason not to keep it even though nothing reads it back yet). `Channel`: `name`, `team` (ObjectId ref Team, required), plus `channelSchema.index({team:1, name:1}, {unique:true})` — a compound index, so `#general` can exist once per team but the same name is fine on a different team. Neither model has a `toJSON` transform — `User`'s exists specifically to hide a password; there's no equivalent security reason here, so adding one would be pure diff noise.

#### `backend/src/services/teamService.js`

```js
async function createTeam({ name, creatorId }) {
  const existingName = await Team.findOne({ name });
  if (existingName) {
    throw new ApiError(409, 'TEAM_NAME_TAKEN', 'A team with this name already exists');
  }

  const creator = await User.findById(creatorId);
  if (creator.team) {
    throw new ApiError(409, 'ALREADY_ON_TEAM', 'You already belong to a team');
  }

  const team = await Team.create({ name, createdBy: creatorId });
  creator.team = team._id;
  await creator.save();

  return team;
}
```
Two explicit pre-checks before anything is written, same "explicit query, not a caught duplicate-key error" pattern `authService.registerUser` established in Phase 1 — a raw Mongo `E11000` wouldn't have the `.status`/`.code` shape `errorHandler` expects. The `creator.team` check is what makes `POST /teams` safe to call as "create AND join" in one step: without it, a user who already belongs to a team could call this again and silently get moved to a new team, orphaning their old one's channels with no join endpoint to get back — this project has none, on purpose (see `DECISIONS.md`), so the guard is what keeps that gap from becoming a real data-integrity trap.

#### `backend/src/services/channelService.js`

```js
async function assertTeamExists(teamId) {
  const team = await Team.findById(teamId);
  if (!team) {
    throw new ApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }
  return team;
}
```
A small local helper (not exported) shared by `listChannelsByTeam` and `createChannel` — both need to 404 on a bogus `teamId` rather than `listChannelsByTeam` silently returning `[]` (which would look identical to "this team just has no channels yet" from the frontend's perspective, an ambiguity worth avoiding) or `createChannel` writing a channel that points at a team that doesn't exist.

#### `backend/src/controllers/teamController.js` / `channelController.js`

Same thin shape `authController.js` established — parse `req.params`/`req.body`/`req.user`, call the service, respond. `req.user` is available in every one of these handlers because every route in `teamRoutes.js` sits behind `protect` (see below); `createTeam`'s controller is literally `teamService.createTeam({ name, creatorId: req.user._id })` — no auth logic in the controller itself, just reading what `protect` already attached.

#### `backend/src/routes/teamRoutes.js`

```js
router.use(protect);
```
One line instead of repeating `protect` as a second argument on all five routes below it — every route in this file needs auth, so gating the whole router is exactly equivalent and shorter. First route file in the project to use `param()` validators:
```js
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid team id')],
  validateRequest,
  teamController.getTeam
);
```
Phase 1 never needed this — no route had a URL param. Without `.isMongoId()`, a request like `GET /teams/not-an-id` would reach `Team.findById('not-an-id')`, Mongoose would throw an uncaught `CastError` on the malformed ObjectId, and it would fall through to a generic `500 INTERNAL_ERROR` — the one place in the app where a bad *input* would have looked like a server *bug*. The nested `GET/POST /:teamId/channels` routes live in this same file (not `channelRoutes.js`) even though they're conceptually "channel" endpoints, because the URL prefix they're mounted under (`/api/v1/teams/...`) is what CLAUDE.md's endpoint list actually specifies — one file owns one URL prefix, matching how `authRoutes.js` already works, rather than reaching for Express's `mergeParams` router-nesting feature for a one-off case.

#### `backend/src/config/swagger.js` (edited)

Six new `@swagger` path blocks appended to the same single JSDoc comment `app.js`'s Swagger UI already reads — no new file, no change to the `apis: ['./src/config/swagger.js']` array, continuing Phase 1's centralization decision. Two new tags (`Teams`, `Channels`) added alongside `Auth` so `/api-docs` groups the six new routes sensibly instead of dumping them under the existing `Auth` heading.

#### `backend/src/app.js` (edited)

```js
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/channels', channelRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```
Two new lines, same grouping order the file already had (resource routers together, then docs, then `notFound`/`errorHandler` last — unchanged, and still correct, since both new routers are mounted *before* that final pair).

### Frontend files

#### `frontend/src/context/AuthContext.jsx` (edited)

```js
async function refreshUser() {
  try {
    const res = await authApi.me();
    setUser(res.data.data.user);
  } catch {
    setUser(null);
  }
}
```
Added and exported from the context value, but — notably — **not** called from the mount-time session-restore effect, which still duplicates these same three lines as its own inline `.then/.catch/.finally` chain. This looks like it should be simplified to `refreshUser().finally(() => setLoading(false))`, and that was tried, but a newer `eslint-plugin-react-hooks` rule (`react-hooks/set-state-in-effect`) flags calling a component-scope function that itself calls `setState` from inside `useEffect`, even though the exact same logic written inline as a promise-chain literal in the effect body is fine. `refreshUser()` exists for `Workspace.jsx` to call after creating a team (see below) — a case with no such restriction, since it's an event handler, not an effect.

#### `frontend/src/api/teamApi.js` / `channelApi.js` (new)

One function per endpoint, same thin-wrapper shape as `authApi.js` — `teamApi.js` has five (`listTeams`, `createTeam`, `getTeam`, `listChannels`, `createChannel`), `channelApi.js` has one (`getChannel`). `createChannel(teamId, {name})` and `listChannels(teamId)` both build their URL from the passed-in team id (`` `/teams/${teamId}/channels` ``) rather than the module knowing a "current team" — keeps these functions stateless, matching `authApi.js`'s pattern of not caching anything itself.

#### `frontend/src/components/layout/AppLayout.jsx` (new)

```jsx
useEffect(() => {
  let cancelled = false;

  const fetchData = user.team
    ? Promise.all([teamApi.getTeam(user.team), teamApi.listChannels(user.team)]).then(
        ([teamRes, channelsRes]) => ({
          team: teamRes.data.data.team,
          channels: channelsRes.data.data.channels,
        })
      )
    : Promise.resolve({ team: null, channels: [] });

  fetchData.then((result) => {
    if (cancelled) return;
    setTeam(result.team);
    setChannels(result.channels);
  });

  return () => { cancelled = true; };
}, [user.team]);
```
Every `setState` call in this effect lives inside the final `.then((result) => {...})` callback — none are top-level synchronous statements in the effect body, which is what the same `react-hooks/set-state-in-effect` rule mentioned above requires. The teamless case (`user.team` falsy) is handled by branching *which promise gets built*, not by an early `return` with its own synchronous `setState` calls — both branches converge on the identical `.then` callback, so there's exactly one place `team`/`channels` state ever gets set from this effect, not two. `cancelled` guards against a fast team-switch (or, more realistically here, a fast `user.team` change right after team creation) resolving out of order and overwriting newer state with a stale response. Deliberately has **no** `loading` state — see `DECISIONS.md`; threading one through the same lint constraint added real complexity for a Phase 8-tier polish concern this phase doesn't need.

`handleCreateChannel` is owned here (not in `Sidebar`) so the channel list has exactly one place it's mutated: `setChannels((prev) => [...prev, res.data.data.channel])` appends the just-created channel without waiting for a full re-fetch.

#### `frontend/src/components/layout/Sidebar.jsx` (new)

```jsx
<NavLink
  key={channel._id}
  to={`/channels/${channel._id}`}
  className={({ isActive }) =>
    `list-group-item list-group-item-action${isActive ? ' active' : ''}`
  }
>
```
Uses React Router's `NavLink` render-prop form of `className` rather than manually comparing `useParams().channelId` to each channel's id — `NavLink` already knows whether its own `to` matches the current URL, so this is fewer lines and can't drift out of sync with the router's own notion of "active." The create-channel form is a single controlled input + the shared `Button` component; it's hidden implicitly (rendered inside the `{team && (...)}` block) when the user has no team yet, since there's nothing to attach a channel to. The user-info/role-`Badge`/logout footer is the block that used to be `Workspace.jsx`'s entire content in Phase 1 — relocated here verbatim in spirit, now permanently visible in the persistent shell instead of only on a full-page "Welcome" screen.

#### `frontend/src/pages/Channel.jsx` (new)

```jsx
useEffect(() => {
  let cancelled = false;
  channelApi.getChannel(channelId).then((res) => {
    if (!cancelled) setChannel(res.data.data.channel);
  });
  return () => { cancelled = true; };
}, [channelId]);
```
No synchronous reset of `channel` to `null` when `channelId` changes (an earlier version had one — removed for the same lint rule reasons documented above). The practical effect: switching channels shows the *previous* channel's heading for one tick until the new fetch resolves, rather than a blank flash. Acceptable here since this page is still just a placeholder — Phase 3 replaces its body with the real message list, at which point this fetch/render pattern will matter more and can be revisited.

#### `frontend/src/pages/Workspace.jsx` (edited, repurposed)

No longer the post-login landing page's entire content (that's `Sidebar`'s job now within the persistent `AppLayout` shell). Two states based on `user.team`: teamless → a create-team form whose submit handler calls `teamApi.createTeam({name})` then **`await refreshUser()`** — this is the one call site in the app that actually uses `AuthContext`'s `refreshUser`, and it's necessary, not decorative: `POST /teams` sets `user.team` on the backend, but `AuthContext`'s `user` state was populated once, at mount; without this call, `Sidebar`/`AppLayout` would keep reading a stale `user.team === null` until a manual page reload. Has-a-team → a plain "select a channel" placeholder.

#### `frontend/src/App.jsx` (edited)

```jsx
<Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
  <Route index element={<Workspace />} />
  <Route path="channels/:channelId" element={<Channel />} />
</Route>
```
`ProtectedRoute` now wraps `AppLayout` once, at the parent level — its `children`-prop shape from Phase 1 needed no changes to work here, since "a single protected element that itself contains a nested `<Outlet/>`" is just as valid a child as the flat `Workspace` it used to wrap directly. The `index` route is what renders at exactly `/` (not a wildcard), and `channels/:channelId` is relative to the parent's `/` — React Router v7's nested-route convention, matching the `<BrowserRouter>` (declarative, not `createBrowserRouter`) setup already established in `main.jsx`.

#### `frontend/src/theme.css` (edited)

```css
.list-group-item.active {
  --bs-list-group-active-bg: var(--ps-primary);
  --bs-list-group-active-border-color: var(--ps-primary);
}
```
Same override mechanism `.btn-primary` already established in Phase 1 (Bootstrap's compiled CSS bakes most colors from Sass at build time, so overriding a component's own local CSS variables is what actually works, not a single global `--bs-primary` override) — extended to a new component (`list-group`) for the first time, not a new pattern.

---

## Phase 3 — Messaging + Socket.IO core

**What it proves:** two browser sessions on the same channel see each other's messages instantly with no refresh; switching one session to a different channel proves the message doesn't leak across rooms; a mention in a message reaches the mentioned user as a toast even if they've navigated elsewhere in the app; a backend restart mid-session recovers automatically. Built and verified in 4 sub-slices, pausing for manual review after each (an explicit request for this phase specifically, since it's the first one touching WebSockets).

### Sub-slice A — Socket.IO plumbing

#### `backend/src/sockets/socketServer.js` (new)

```js
function initSocketServer(server) {
  io = new Server(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.engine.use(cookieParser());

  io.use(async (socket, next) => {
    const token = socket.request.cookies.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.sub);
      if (!user) return next(new Error('Authentication required'));
      socket.userId = user._id.toString();
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });
```
`io.engine.use(cookieParser())` is a Socket.IO 4.6+ feature that runs Express-style middleware on the underlying Engine.IO HTTP upgrade request before a socket connection exists — it populates `socket.request.cookies` exactly like Express's own `cookieParser()` populates `req.cookies`, so this middleware can read `socket.request.cookies.token` and verify it with the identical `jwt.verify` call `authMiddleware.protect` uses. `io.use(...)` is Socket.IO's connection-level middleware; calling `next(new Error(...))` (not `ApiError` — that's an Express-only convention, sockets have no HTTP status codes) rejects the handshake before `connection` ever fires.

```js
  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    socket.on('channel:join', (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('channel:leave', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });
  });
```
Every authenticated connection auto-joins its own `user:<id>` room immediately — this is what makes `notification:new` delivery "just work" regardless of which page the user is on, since it's tied to the connection, not to any particular open channel. `channel:join`/`channel:leave` are client-initiated control events (not part of CLAUDE.md's push-event list, not a third room type) that let `Channel.jsx` opt a connection into a specific channel's broadcast room on demand.

```js
function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
module.exports = { initSocketServer, getIO };
```
`getIO()` is how every other backend file (`messageService.js`, `notificationEvents.js`) reaches the socket server without a circular import back to `server.js` — they just call `getIO().to(room).emit(...)` after `initSocketServer` has run once at boot. Throwing if called before init turns "forgot to wire this up" into an immediate, loud crash instead of a silent no-op.

#### `backend/src/server.js` (edited)

```js
const { initSocketServer } = require('./sockets/socketServer');
const server = http.createServer(app);
initSocketServer(server);
```
One import, one call, placed right after the same `http.createServer(app)` line Phase 0's `ARCHITECTURE.md` entry already flagged as "the object Phase 3 needs a handle on" — confirming that early decision paid off with zero restructuring needed here.

#### `frontend/vite.config.js` (edited)

```js
'/socket.io': { target: 'http://localhost:5000', ws: true, changeOrigin: true },
```
A second proxy entry alongside the existing `/api` one. `ws: true` is the one new option — it tells Vite's dev proxy to also upgrade matching requests to a WebSocket connection (an HTTP proxy alone would only forward the initial handshake request and then drop the connection), which is exactly what Socket.IO's default transport needs.

#### `frontend/src/context/SocketContext.jsx` / `frontend/src/hooks/useSocket.js` (new)

```jsx
useEffect(() => {
  if (!user) return undefined;

  const conn = io({ withCredentials: true });
  function handleConnect() { setSocket(conn); }
  conn.on('connect', handleConnect);

  return () => {
    conn.off('connect', handleConnect);
    conn.disconnect();
    setSocket(null);
  };
}, [user]);
```
Mirrors `AuthContext.jsx`/`useAuth.js`'s exact shape from Phase 1 — a context holding one value, a hook throwing if used outside the provider. `io({withCredentials:true})` with no URL argument connects relative to the current origin (through the Vite proxy in dev), the same "no hardcoded backend URL" pattern `client.js` established for HTTP in Phase 0. The effect only runs once `user` is truthy — no point holding a socket connection for a logged-out visitor. `setSocket(conn)` happens inside `handleConnect`, a nested closure, not as a synchronous top-level statement in the effect body — the ESLint-safe shape verified against the actual `react-hooks/set-state-in-effect` rule source before this phase started (see `DECISIONS.md`).

#### `frontend/src/App.jsx` (edited)

```jsx
<AuthProvider>
  <SocketProvider>
    <AppRoutes />
  </SocketProvider>
</AuthProvider>
```
`SocketProvider` nests inside `AuthProvider`, not the other way around — it needs `useAuth()`'s `user` value to decide whether to connect at all.

**Checkpoint A** (verified live): logged in, confirmed via DevTools → Network → WS a `101 Switching Protocols` handshake on `/socket.io/?...&transport=websocket` carrying the `token` cookie and `Access-Control-Allow-Credentials: true`.

### Sub-slice B — Messages persist and load

#### `backend/src/models/Message.js` (new)

`content` (required, trimmed, `maxlength:2000` as a schema-level backstop behind the route's own validator), `channel`/`author` (required ObjectId refs). `messageSchema.index({channel:1, createdAt:1})` — a compound index matching the exact access pattern `listMessagesByChannel` uses (fetch one channel's messages, oldest first), indexed from the start rather than added later as a "polish" afterthought.

#### `backend/src/services/messageService.js` (new, later edited twice more in C and D)

```js
async function listMessagesByChannel(channelId) {
  await assertChannelExists(channelId);
  return Message.find({ channel: channelId }).sort({ createdAt: 1 }).populate('author', 'name');
}
```
`assertChannelExists` mirrors Phase 2's `assertTeamExists` helper pattern exactly — a 404 on a bogus channel id rather than an ambiguous empty array. `.populate('author', 'name')` pulls in just the sender's display name, not the full user document (no email/role needed for chat rendering) — keeps the payload minimal and avoids ever letting a password hash anywhere near this response (moot anyway, since `select:false` already hides it, but minimal projection is the better habit).

#### `backend/src/controllers/messageController.js` / `routes/messageRoutes.js` (new)

```js
const router = express.Router({ mergeParams: true });
```
`mergeParams: true` is what makes `req.params.id` (the channel id from the *parent* router's `/:id/messages` mount) visible inside this router at all — without it, a nested router only sees its own path segments, not the parent's. This is the mechanism behind keeping `messageRoutes.js` a separate file (per CLAUDE.md's tree) while still hanging off `channelRoutes.js`'s URL prefix, instead of Phase 2's flat-file approach for team-scoped channels.

#### `backend/src/routes/channelRoutes.js` (edited)

```js
router.use('/:id/messages', messageRoutes);
```
One new `require` plus this one line. `messageRoutes.js` already applies its own `protect` + `param('id').isMongoId()` + `validateRequest` internally, so nothing is duplicated at the mount point — a deliberate deviation from the original sub-slice plan's wording (see `DECISIONS.md`), since duplicating those same two checks at the mount would just run them twice per request.

#### `backend/src/config/swagger.js` (edited)

One new `Messages` tag, one new `/channels/{id}/messages` path block with both `GET` and `POST` documented — same append-only pattern every phase has used on this file since Phase 1.

#### `frontend/src/api/messageApi.js` (new)

Two one-line functions, same thin-wrapper shape as `channelApi.js`.

#### `frontend/src/utils/formatDate.js` (new)

One function, `formatTime` — `toLocaleTimeString` with hour/minute only, used by `MessageItem.jsx`.

#### `frontend/src/components/chat/MessageList.jsx` / `MessageItem.jsx` / `MessageInput.jsx` (new)

Deliberately minimal: `MessageList` is a scrollable `overflow-auto` container mapping messages to `MessageItem`; `MessageItem` renders author name + timestamp + content with no bubble/avatar styling (not in scope); `MessageInput` is a controlled input + the reusable `Button`, trims and no-ops on empty submit, clears after send.

#### `frontend/src/pages/Channel.jsx` (rewritten, then edited again in C)

Two independent, cancel-safe fetch effects (channel details, message history) — the same `let cancelled = false` / cleanup pattern established in Phase 2's `Channel.jsx`, now doubled since there are two independent data sources instead of one.

**Checkpoint B** (verified live): sent a message, refreshed the page, confirmed it persisted — no realtime expected yet at this point, by design.

### Sub-slice C — Realtime message delivery

#### `backend/src/services/messageService.js` (edited)

```js
async function createMessage({ channelId, authorId, content }) {
  const channel = await assertChannelExists(channelId);
  const message = await Message.create({ channel: channelId, author: authorId, content });
  await message.populate('author', 'name');

  getIO().to(`channel:${channelId}`).emit('message:new', message);
  ...
```
The emit is scoped to exactly one room, `channel:<channelId>` — never a bare `getIO().emit(...)`, which is the one-character mistake that would violate CLAUDE.md's "no global broadcast" rule. `assertChannelExists` now has its return value captured (`const channel = ...`) rather than just awaited, because Sub-slice D's mention resolution needs `channel.team`.

#### `frontend/src/pages/Channel.jsx` (edited)

```jsx
useEffect(() => {
  if (!socket) return undefined;

  function joinChannel() { socket.emit('channel:join', channelId); }
  function handleNewMessage(message) {
    if (message.channel === channelId) {
      setMessages((prev) => [...prev, message]);
    }
  }

  joinChannel();
  socket.on('connect', joinChannel);
  socket.on('message:new', handleNewMessage);

  return () => {
    socket.off('connect', joinChannel);
    socket.off('message:new', handleNewMessage);
    socket.emit('channel:leave', channelId);
  };
}, [socket, channelId]);
```
`joinChannel` runs immediately on mount **and** is re-registered on every socket `'connect'` event — the reconnect-correctness fix from `DECISIONS.md`: a reconnect gets a new `socket.id` and loses prior room memberships, unlike `user:<id>` which the server rejoins automatically in its own `connection` handler. `handleNewMessage`'s `message.channel === channelId` guard is defensive against a stale listener from a fast channel-switch firing before its own cleanup runs (Mongoose's default `toJSON` serializes the unpopulated `channel` ObjectId to a plain string, so this comparison is a safe string-to-string check). The send handler (`MessageInput`'s `onSend` prop) now just fires the POST and ignores the response — `message:new` is the only place `setMessages` gets called for a new message, since the sender is themselves a member of `channel:<channelId>` and would otherwise see their own message twice.

**Checkpoint C** (verified live, two browsers): message sent in Chrome's `#dev` channel appeared instantly in Edge's `#dev`; switching Edge to `#qa` and repeating showed nothing arrive there (room-scoping proof); switching Edge back to `#dev` caught it up via the history re-fetch, not a live push.

### Sub-slice D — Mentions + notifications

#### `backend/src/models/Notification.js` (new)

`recipient`/`fromUser`/`channel`/`message` (all required ObjectId refs), `type` (enum `['MENTION']` — room to grow when Phase 7 adds escalation notifications). No index — no query path exists, since there's deliberately no list/read endpoint (see `DECISIONS.md`).

#### `backend/src/sockets/notificationEvents.js` (new)

```js
function emitNotification(notification) {
  getIO().to(`user:${notification.recipient}`).emit('notification:new', notification);
}
```
Scoped to the single recipient's `user:<id>` room — the same "never a bare `getIO().emit()`" discipline as the `message:new` emit.

#### `backend/src/services/notificationService.js` (new)

```js
async function createMentionNotifications({ channelId, messageId, fromUserId, mentionedUserIds }) {
  const notifications = await Notification.insertMany(mentionedUserIds.map((recipient) => ({
    recipient, type: 'MENTION', channel: channelId, fromUser: fromUserId, message: messageId,
  })));

  for (const notification of notifications) {
    await notification.populate([{ path: 'fromUser', select: 'name' }, { path: 'channel', select: 'name' }]);
    emitNotification(notification);
  }
}
```
Bulk-inserts one `Notification` document per mentioned user, then populates `fromUser`/`channel` names before emitting each — so the frontend toast can render "Sarah mentioned you in #general" without a second round trip per toast.

#### `backend/src/services/messageService.js` (edited again)

```js
async function resolveMentions(content, teamId, authorId) {
  const mentioned = [...content.matchAll(/@(\w+)/g)].map((match) => match[1].toLowerCase());
  if (mentioned.length === 0) return [];

  const members = await User.find({ team: teamId });
  const mentionedUserIds = new Set();
  for (const member of members) {
    if (member._id.toString() === authorId.toString()) continue;
    const firstName = member.name.split(' ')[0].toLowerCase();
    if (mentioned.includes(firstName)) mentionedUserIds.add(member._id.toString());
  }
  return [...mentionedUserIds];
}
```
Case-insensitive first-name matching against the team roster — the only viable mechanism given there's no username/handle field and no members-list endpoint in scope (see `DECISIONS.md` for the documented name-collision limitation). Called from `createMessage` *after* the `message:new` emit, so mention resolution and notification fan-out never delay chat delivery:
```js
const mentionedUserIds = await resolveMentions(content, channel.team, authorId);
if (mentionedUserIds.length > 0) {
  await notificationService.createMentionNotifications({ channelId, messageId: message._id, fromUserId: authorId, mentionedUserIds });
}
```

#### `frontend/src/components/common/Toast.jsx` (new)

```jsx
useEffect(() => {
  const id = setTimeout(onDismiss, 8000);
  return () => clearTimeout(id);
}, [onDismiss]);
```
Purely presentational — no queue/subscription logic here, that lives in `AppLayout.jsx`. `setTimeout`'s callback is a nested closure, already a safe pattern under the ESLint rule with no workaround needed. 8 seconds (raised from an initial 4s after live testing showed 4s wasn't enough time to read a toast mid-tab-switch — see `DECISIONS.md`).

#### `frontend/src/theme.css` (edited)

Two new rules, `.toast-mention` and `.mention-highlight`, both keyed off the existing `--ps-tertiary` teal token rather than introducing a new color — keeps the notification/mention visual language inside the already-established palette.

#### `frontend/src/components/layout/AppLayout.jsx` (edited)

```jsx
useEffect(() => {
  if (!socket) return undefined;
  function handleNotification(notification) {
    const text = `${notification.fromUser.name} mentioned you in #${notification.channel.name}`;
    setToasts((prev) => [...prev, { id: notification._id, text }]);
  }
  socket.on('notification:new', handleNotification);
  return () => socket.off('notification:new', handleNotification);
}, [socket]);
```
Same shape as `Channel.jsx`'s `message:new` listener — `setState` only inside the named nested handler. Renders as a `position-fixed bottom-0 end-0` stack, independent of `Sidebar`/`Outlet`, so it overlays regardless of which page is showing.

#### `frontend/src/components/chat/MessageItem.jsx` (edited)

```jsx
function renderContent(content) {
  return content.split(/(@\w+)/g).map((part, index) =>
    /^@\w+$/.test(part) ? <span key={index} className="mention-highlight">{part}</span> : part
  );
}
```
`.split()` with a *capturing* group keeps the delimiters (the `@word` matches themselves) in the resulting array alongside the surrounding plain-text segments — cosmetic only, no click-through, since there's no per-user profile page or route to link to in scope.

**Checkpoint D** (verified live, three users — see below): mentions delivered as toasts, cross-browser, including while the recipient was on a different page than the mentioned channel.

### Cross-phase — demo tooling

#### `scripts/seed.js` (new, pulled forward from Phase 9 — see `DECISIONS.md` for the full reasoning)

```js
let team = await Team.findOne({ name: TEAM_NAME });
const users = [];
for (const seedUser of SEED_USERS) {
  let user = await User.findOne({ email: seedUser.email });
  if (!user) {
    user = await authService.registerUser({ name: seedUser.name, email: seedUser.email, password: SEED_PASSWORD, role: seedUser.role });
  }
  user.role = seedUser.role;
  if (team) user.team = team._id;
  await user.save();
  users.push(user);
}
if (!team) {
  team = await Team.create({ name: TEAM_NAME, createdBy: users[0]._id });
  await User.updateMany({ _id: { $in: users.map((user) => user._id) } }, { team: team._id });
}
```
Additive and idempotent by design — finds the existing "Engineering" team (the user's own real testing team, not a fixture) rather than deleting and recreating it, upserts the 3 seed users onto it, and only creates the 3 named channels if they don't already exist. Reuses `authService.registerUser` (not a manual `bcrypt.hash` call) specifically so new seed users go through the exact same hashing path a real registration does. Runs via `npm run seed` from `backend/` (added to `backend/package.json`'s `scripts`), because `scripts/seed.js` itself cannot directly `require('mongoose')`/`require('bcryptjs')` — Node resolves bare specifiers from the requiring file's own directory upward, and `scripts/` (a sibling of `backend/`, not a descendant) has no `node_modules` in its ancestry. Every dependency this file needs comes in indirectly, through files that live under `backend/src/` and can resolve their own imports fine.

#### `backend/package.json` (edited)

```json
"seed": "node ../scripts/seed.js",
```
One new script. Running it via `npm run seed` (cwd = `backend/`, same as `npm run dev`) is what lets `config/environment.js`'s `dotenv.config()` — which resolves `.env` relative to `process.cwd()`, unchanged since Phase 0 — find `backend/.env` correctly.

---

## Phase 4 — Incident creation

**What it proves:** a user can open an Incidents page, create an incident through a modal (title, description, severity, channel), see it rendered as a severity-colored card, and open its detail page — with the backend writing the first `IncidentEvent` (`CREATED`) from day one, even though nothing in the UI reads that history back until Phase 5. No lifecycle actions, no sockets, no escalation anywhere in this phase — all deferred on purpose to Phase 5/7.

### Backend files

#### `backend/src/models/Incident.js` / `IncidentEvent.js` (new)

```js
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
const ESCALATION_LEVELS = ['EMPLOYEE', 'TEAM_LEAD', 'MANAGER'];
```
Three separate enums exported off the model constructor — same `module.exports.ROLES = ROLES` pattern `User.js` established in Phase 1, so any file needing the canonical list (the route's validator, the frontend's `severity.js`) imports the *same* array the schema's own `enum` uses, instead of a second hand-typed copy that could drift. `status`/`escalationLevel` default to `'OPEN'`/`'EMPLOYEE'` — CLAUDE.md's state model made concrete as two independent fields, not a combined enum. `assignedTo` is not a field here at all — see `DECISIONS.md`, same "no dead field" precedent as Phase 1's `User.team`.

```js
const incidentEventSchema = new mongoose.Schema({
  incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  type: { type: String, enum: ['CREATED'], required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
incidentEventSchema.index({ incident: 1, createdAt: 1 });
```
Same compound-index-matches-the-query-pattern discipline as `Message.js`'s `{channel:1,createdAt:1}` — this is exactly what `listIncidentHistory` queries by. `type` only declares `'CREATED'` right now, not the full eventual set — mirrors `Notification.type`'s Phase 3 precedent of declaring only what the current phase actually produces.

#### `backend/src/utils/generateIncidentNumber.js` (new)

```js
async function generateIncidentNumber() {
  const count = await Incident.countDocuments();
  return `INC-${String(count + 1).padStart(4, '0')}`;
}
```
A count-and-increment scheme, not a proper atomic sequence — two near-simultaneous creates could theoretically read the same `count` and generate the same number. Accepted, not fixed (see `DECISIONS.md`): a real fix (a dedicated counters collection with `findOneAndUpdate({$inc})`) is real engineering effort for a race this demo's single-operator usage pattern will never actually trigger.

#### `backend/src/services/incidentService.js` (new)

```js
async function createIncident({ title, description, severity, channelId, createdById }) {
  await assertChannelExists(channelId);

  const incidentNumber = await generateIncidentNumber();
  const incident = await Incident.create({ incidentNumber, title, description, severity, channel: channelId, createdBy: createdById });

  await IncidentEvent.create({ incident: incident._id, type: 'CREATED', actor: createdById });

  return incident.populate([{ path: 'channel', select: 'name' }, { path: 'createdBy', select: 'name' }]);
}
```
The `IncidentEvent` write happens *inside* `createIncident`, not as a separate call the controller has to remember to make — this is what guarantees CLAUDE.md's "every state transition writes an event" rule holds from the very first incident ever created, rather than being something Phase 5 has to retrofit onto creation too. `assertChannelExists` is a local, unexported helper — same duplicated-per-service pattern `messageService.js` already established rather than importing across services.

`listIncidents`/`getIncidentById`/`listIncidentHistory` follow the same `assertX`-then-`populate` shape every read path in this codebase has used since Phase 2's `channelService.js`.

#### `backend/src/routes/incidentRoutes.js` (new)

```js
router.post('/', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim(),
  body('severity').isIn(SEVERITIES).withMessage('Invalid severity'),
  body('channel').isMongoId().withMessage('Invalid channel id'),
], validateRequest, incidentController.createIncident);
```
`SEVERITIES` imported from `models/Incident.js` — the exact same array the schema enum validates against, so a request that somehow slipped past this `express-validator` check would still be rejected by Mongoose's own schema validation as a second line of defense (same belt-and-suspenders pattern as `User.email`'s regex behind `express-validator`'s `isEmail()`).

#### `backend/src/app.js` / `config/swagger.js` (edited)

One new mount line (`app.use('/api/v1/incidents', incidentRoutes)`) and one new `Incidents` tag + 4 path blocks appended to the centralized Swagger file — same append-only pattern every phase since Phase 1 has used.

### Frontend files

#### `frontend/src/utils/severity.js` (new)

```js
export function severityVariant(severity) {
  return `severity-${severity.toLowerCase()}`;
}
```
One function turning `'HIGH'` into `'severity-high'` — the exact string `Badge`'s `variant` prop needs to produce the `badge-severity-high` class `theme.css` already defines. Every component that renders a severity badge calls this instead of repeating `.toLowerCase()` inline.

#### `frontend/src/components/common/Modal.jsx` (new, then fixed after a live bug)

```jsx
return (
  <>
    <div className="modal-backdrop show" onClick={onClose} />
    <div className="modal d-block" tabIndex="-1" role="dialog">
      <div className="modal-dialog" role="document">
        ...
```
Originally built with the backdrop nested *inside* the `.modal d-block` wrapper alongside `.modal-dialog`. That was a real bug, caught during live browser testing: Bootstrap's CSS assigns `.modal-backdrop` a lower `z-index` (1050) than `.modal` (1055) — but that ordering is only meaningful between true siblings sharing a stacking context. Nested one level deeper, the backdrop (which has an explicit `z-index`) painted *above* the dialog content (which has none), which both visually darkened the form and silently absorbed every click/keystroke meant for the inputs underneath. Fixed by rendering the two as siblings inside a `<>...</>` fragment — matching the DOM structure Bootstrap's own JS produces, even though this component hand-rolls its own show/hide logic instead of using Bootstrap's JS modal plugin (no `react-bootstrap`, no Bootstrap JS bundle, per the project's CSS-only Bootstrap decision from Phase 1).

#### `frontend/src/components/incidents/CreateIncidentModal.jsx` (new, edited once for validation)

```jsx
async function handleSubmit(e) {
  e.preventDefault();
  if (!title.trim()) {
    pushToast('Enter a title to create an incident');
    return;
  }
  if (!channel) return;
  ...
```
Empty-title submission used to silently no-op (indistinguishable from a broken button, per live user feedback) — now calls `pushToast`, received as a prop rather than pulled directly via `useOutletContext()` inside this component, keeping the "who reads outlet context" responsibility at the page level (`Incidents.jsx`) consistent with how `channels` is already passed down as a prop rather than re-read here too.

#### `frontend/src/components/incidents/IncidentCard.jsx` / `IncidentList.jsx` / `pages/Incidents.jsx` / `pages/IncidentDetails.jsx` (new)

Same minimal shapes as Phase 3's chat components: `IncidentCard` is a `<Link>`-wrapped Bootstrap `.card` showing the incident number, channel, title, and two badges (severity-colored, status); `IncidentList` maps to cards with a "No incidents yet" empty state; `Incidents.jsx` owns the fetch-on-mount + `isModalOpen` state + a `handleCreated` that prepends the new incident to local state (no re-fetch, same pattern `AppLayout.handleCreateChannel` established in Phase 2); `IncidentDetails.jsx` is intentionally minimal this phase — three badges, description, reporter name, no timeline yet.

#### `frontend/src/components/layout/AppLayout.jsx` (edited — `pushToast` generalized)

```jsx
const pushToast = useCallback((text) => {
  setToasts((prev) => [...prev, { id: crypto.randomUUID(), text }]);
}, []);

useEffect(() => {
  if (!socket) return undefined;
  function handleNotification(notification) {
    pushToast(`${notification.fromUser.name} mentioned you in #${notification.channel.name}`);
  }
  socket.on('notification:new', handleNotification);
  return () => socket.off('notification:new', handleNotification);
}, [socket, pushToast]);
```
Phase 3 built the toast queue specifically for mention notifications, with the append-to-`toasts` logic written inline inside the socket handler. This phase needed a second, unrelated caller (form validation), so that logic was extracted into `pushToast` — wrapped in `useCallback` with an empty dependency array (it only closes over the `setToasts` setter, which React guarantees is stable across renders) so it can be safely listed in the notification effect's dependency array without causing extra re-subscriptions, and passed down through `<Outlet context={{ channels, pushToast }} />` so any page under this layout can trigger a toast without its own parallel queue/render pipeline. One `bottom-0` → `top-0` class change on the toast stack's container also moved *all* toasts (mentions included) to the top-right corner, per request.

#### `frontend/src/components/layout/Sidebar.jsx` / `App.jsx` (edited)

One new `NavLink` to `/incidents` (same `isActive`-render-prop pattern as the channel links), and two new routes (`incidents`, `incidents/:incidentId`) nested under the same `ProtectedRoute`-wrapped `AppLayout` parent route as `channels/:channelId`.

---

## Phase 5 — Incident lifecycle (assign/acknowledge/resolve)

**What it proves:** an incident can move through its full state machine — assigned to someone, acknowledged, resolved — with every transition written as an `IncidentEvent`, and every open detail page updating live over the incident's own channel room the instant any of those actions happen anywhere.

`Incident.assignedTo` and `IncidentEvent.targetUser` (nullable `ObjectId ref User`) were added this phase — both deferred since Phase 4 for lack of a consumer. `IncidentEvent.type` widened from `['CREATED']` to include `ASSIGNED`/`ACKNOWLEDGED`/`RESOLVED`. `incidentService.js` gained `assignIncident`/`acknowledgeIncident`/`resolveIncident`, all sharing one rule: `RESOLVED` is terminal (`assertNotResolved` rejects `409 INCIDENT_RESOLVED` on any of the three once resolved); `acknowledgeIncident` additionally requires `status === 'OPEN'`. A new `sockets/incidentEvents.js` mirrors `notificationEvents.js`'s shape — `emitIncidentEvent(eventName, channelId, incident)` scoped to `channel:<id>`, never global.

No dedicated members-list endpoint exists (same gap Phase 3 hit for mentions), so `teamService.getTeamById` was enriched with a `members` array instead of adding one — purely additive, existing consumers unaffected. On the frontend, `IncidentDetails.jsx` was rewritten to compose three new components (`IncidentHeader`, `IncidentTimeline`, `IncidentActions`) and joins `channel:<incident.channel>` the same way `Channel.jsx` does, updating from the socket echo rather than its own POST responses — the same single-source-of-truth pattern Phase 3 established for `message:new`. Incident creation and assignment also post an automatic channel message containing a real `@mention`, transparently reusing the entire Phase 3 mention → `Notification` → toast pipeline for zero new notification code.

---

## Phase 6 — Demo service panel

**What it proves:** the "Order API" can be flipped between healthy and failing from a UI panel, with every open browser session updating instantly — the one deliberate exception to the two-room-only socket rule (`service:health_changed` is a bare `getIO().emit(...)`, no `.to(room)`).

One model (`DemoService`: `name` unique, `status` enum `HEALTHY`/`FAILING`), four endpoints (`GET /demo/services`, `POST /demo/services/:id/fail`, `POST /demo/services/:id/restore`, `GET /demo/orders`), and one card component (`DemoServiceCard.jsx`, embedded in `Workspace.jsx`'s has-a-team branch). `GET /demo/orders` is a stateless simulated endpoint — no `Order` model, no persistence — that returns fake data when healthy or throws `500 SERVICE_UNAVAILABLE` when failing, purely by checking the `DemoService` document's current status. The frontend card needs no room-join dance at all, since the broadcast is global — a genuine simplification versus `Channel.jsx`/`IncidentDetails.jsx`'s room-scoped pattern. This phase was built once, fully reverted over an unrelated scope doubt that was later resolved, then rebuilt from scratch identically to the original — nothing about the design changed across that round trip.

---

## Phase 7 — Automatic escalation (+ auto-assign-to-employee)

**What it proves:** an incident left unacknowledged escalates itself, unattended — `EMPLOYEE → TEAM_LEAD → MANAGER` — reassigning both `escalationLevel` and `assignedTo` and paging the new owner even if they're not looking at that channel. A later addition guarantees every incident actually reaches the employee first, regardless of who reported it.

**Escalation.** `escalationWorker.js` does one thing — `setInterval` at `ESCALATION_POLL_INTERVAL_MS` (default 5s) calling `escalationService.runEscalationSweep()`, with a `running` guard against overlapping ticks — per the non-negotiable rule that business logic lives in the service, not the worker. `Incident.levelChangedAt` (new field) is the escalation clock, deliberately not `updatedAt` (which unrelated saves like manual assignment also bump). `findEscalatableIncidents` matches `OPEN` incidents below `MANAGER` whose `levelChangedAt` is older than `ESCALATION_ACK_WINDOW_MS` (default 15s); `escalateIncident` looks up the next level's seeded user **by exact seeded email**, not by role (see below for why), bumps `escalationLevel`/`assignedTo`/`levelChangedAt`, writes an `ESCALATED` `IncidentEvent` (`actor: null` — the first system-triggered event, which is why `IncidentEvent.actor` became nullable this phase), and emits `incident:escalated` to **both** the channel room and the new assignee's own `user:<id>` room — the literal reading of the socket-room rule ("user room receives all `incident:*` events for that user"), applied here even though Phase 5's assign/acknowledge/resolve don't do the same (an accepted, un-retrofitted gap in already-working code).

**Auto-assign.** Every incident routes through the seeded `EMPLOYEE` before the ladder starts. If the reporter *is* the employee, `createIncident` self-assigns at creation — no timer. Otherwise it's created unassigned, and the same worker tick's `runAutoAssignSweep()` (run before the escalation sweep) auto-assigns it to the employee after `AUTO_ASSIGN_WINDOW_MS` (default 10s) if nobody manually assigned it first — writing an `AUTO_ASSIGNED` event and posting a channel message with a real `@mention`, which drives the toast for free via the existing mention pipeline (no new frontend socket listener needed). `levelChangedAt` resets on this first assignment (auto or manual) so the employee always gets a full ack window from whenever they actually received it, not from raw creation time — but a *later* reassignment at an already-escalated level still doesn't reset the clock, preserving the original anti-gaming protection.

**Two real bugs, one root cause**, found while building this: looking up "the seeded user" by `role` alone is unsafe, because a shared dev database accumulates non-seeded accounts (12 stray `EMPLOYEE`s from manual testing, and — going forward — every self-registration creates another one, so `EMPLOYEE` specifically can never be assumed unique). Fixed by adding `SEEDED_USER_EMAILS`/`SEEDED_TEAM_NAME` to `backend/src/config/constants.js` and matching seeded identities by exact email everywhere, not by role or name. See `DECISIONS.md` for the full incident writeup.

---

## POC-scope reconciliation retrofit

Mid-project, `CLAUDE.md` was rewritten to formalize the project as a deliberate POC — one seeded team, deterministic one-user-per-role, no invite/join flow — codifying as policy what had already been decided piecemeal (an earlier "let people join a team" request, then a full external team-invitation-system proposal, both declined for the same reason). Three code changes reconciled the existing app with that formalization: `Team.members` added and kept in sync at register/seed time; `POST /auth/register` now looks up the seeded team by name and force-sets `role: 'EMPLOYEE'`, ignoring any client-supplied role (`Register.jsx`'s role picker removed to match); and `acknowledge`/`resolve` gained `assertCanAct` — allowed only for the current assignee, or someone whose role outranks-or-matches the incident's `escalationLevel` — so a stale browser session can't act on an incident it's no longer responsible for once escalation has moved it along. `Workspace.jsx`'s create-team form was removed as unreachable in normal operation, since registration now always auto-joins the one seeded team.
