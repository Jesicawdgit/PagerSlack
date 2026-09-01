# PagerSlack

A Slack-like team communication and incident escalation platform for software development teams. Team members message in channels, tag each other, and turn messages into incidents that auto-escalate if unacknowledged.

## Features

- User authentication
- Teams and channels
- Real-time messaging
- @mentions
- Incident creation
- Incident assignment
- Incident acknowledgement
- Incident resolution
- Incident severity
- Automatic incident escalation
- Escalation history
- Real-time notifications
- Demo service failure simulation
- Playwright end-to-end testing

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- Axios
- Socket.IO Client

### Backend
- Node.js
- Express
- JavaScript
- Socket.IO
- JWT
- Mongoose

### Database
- MongoDB

### Testing
- Playwright

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md).

## Technical Decisions

See [DECISIONS.md](DECISIONS.md).

## Prerequisites

- Node.js
- npm
- A MongoDB Atlas connection string (free M0 tier is enough — nothing runs locally, no Docker needed)

## Setup

### 1. Clone repository

git clone <repository-url>

cd PagerSlack

### 2. Configure environment

cd backend
cp .env.example .env

Fill in `.env` with your own Atlas connection string (`MONGO_URI`) and a `JWT_SECRET`.

### 3. Install backend dependencies

npm install

### 4. Seed the database

npm run seed

### 5. Start the backend

npm run dev

### 6. Install frontend dependencies

cd ../frontend
npm install

### 7. Start the frontend

npm run dev

## Demo Accounts

Employee:
employee@pagerslack.dev

Team Lead:
lead@pagerslack.dev

Manager:
manager@pagerslack.dev

Password (all three):
PagerSlack2026!

## Testing

From the project root, with the backend and frontend both running (`npm run dev` in each):

npm install
npx playwright install chromium
npm test

## Incident Escalation

Incidents follow:

Employee
   ↓
Team Lead
   ↓
Manager

An incident is automatically escalated when it is not
acknowledged within the configured acknowledgement window.

## Demo Service

PagerSlack includes a simulated service that can be switched
between:

HTTP 200 — Healthy

and

HTTP 500 — Failure

This allows the complete incident lifecycle to be demonstrated
without depending on an external monitoring platform.