# PagerSlack
Team Communication and Incident Escalation System: a small Slack-like application for a software development team.  The application should allow team members to communicate through channels, tag other users, and create incidents from important messages.
# PagerSlack

A Slack-like team communication and incident escalation platform
for software development teams.

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
- Docker

## Setup

### 1. Clone repository

git clone <repository-url>

cd PagerSlack

### 2. Start MongoDB

docker compose up -d

### 3. Install backend dependencies

cd backend
npm install

### 4. Configure environment

Copy `.env.example` to `.env`.

### 5. Seed database

npm run seed

### 6. Start backend

npm run dev

### 7. Install frontend dependencies

cd ../frontend
npm install

### 8. Start frontend

npm run dev

## Demo Accounts

Employee:
employee@pagerslack.dev

Team Lead:
lead@pagerslack.dev

Manager:
manager@pagerslack.dev

Password:
...

## Testing

From the project root:

npx playwright test

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