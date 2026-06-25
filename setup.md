# Project Setup

## Prerequisites
- Node.js 22+
- PostgreSQL 16
- Docker (optional)

## Clone Repository

git clone https://github.com/team/project.git
cd project

## Backend Setup

cd backend
npm install

Create .env:

DATABASE_URL=...
JWT_SECRET=...

Run migrations:

npm run migrate

Start server:

npm run dev

## Frontend Setup

cd frontend
npm install
npm run dev

Frontend runs on:
http://localhost:5173

Backend runs on:
http://localhost:3000