# StaffSync

StaffSync is a staff management app with a React dashboard and an Express/MongoDB API. It includes account signup and login, employee records, attendance, leave requests, announcements, training sessions, and dashboard statistics.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB running locally, or a MongoDB connection string

## Run locally

1. In `backend`, copy `.env.example` to `.env`. Set a private `JWT_SECRET` (at least 32 random characters). Set `MONGO_URI` if MongoDB is not running at `mongodb://127.0.0.1:27017/StaffSync`.
2. Install backend dependencies with `npm install` in `backend`, then start it with `npm run dev`.
3. In another terminal, install frontend dependencies with `npm install` in `frontend`, then start the app with `npm run dev`.
4. Open the local URL Vite prints. Create an account to sign in.

The Vite development server proxies `/api` requests to the backend at `127.0.0.1:5000`. For a separately hosted API, set `VITE_API_URL` to its API base URL (for example, `https://api.example.com/api`) in `frontend/.env`.

## Deploy on Render with MongoDB Atlas

The repository must include both `package.json` files and their lockfiles. Keep `.env` files private; add deployment secrets in the hosting dashboard instead.

1. Create a MongoDB Atlas cluster and database user. Add the Render backend's outbound IP ranges to the Atlas IP access list. In Render, find these under the backend service's **Connect → Outbound** tab. Avoid opening database access to every IP unless you knowingly accept that exposure.
2. Create a Render **Web Service** for this repository. Set **Root Directory** to `backend`, **Build Command** to `npm install`, and **Start Command** to `npm start`.
3. Add these backend environment variables in Render: `MONGO_URI` (Atlas connection string), `JWT_SECRET` (a long unique secret), and `FRONTEND_URL` (the exact public URL of the frontend, without a trailing slash). `PORT` is supplied by Render.
4. Create a Render **Static Site** for the same repository. Set **Root Directory** to `frontend`, **Build Command** to `npm install && npm run build`, and **Publish Directory** to `dist`.
5. Set the frontend build environment variable `VITE_API_URL` to the backend's public URL plus `/api`, for example `https://staffsync-api.onrender.com/api`. Trigger a deploy after setting it.
6. Open the frontend URL and verify signup, login, and protected API features. Promote HR or Manager accounts only in the database; public signup intentionally creates Employee accounts.

Render requires web services to listen on `0.0.0.0` and the provided `PORT`. Atlas accepts connections only from IP addresses on its access list. See the [Render web service guide](https://render.com/docs/web-services), [Render static site guide](https://render.com/docs/static-sites), and [MongoDB Atlas IP access list guide](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).

## Roles

Public signup creates Employee accounts. HR and Manager permissions are enforced by the API and must be assigned by an administrator directly in the `users` collection; never add a public role selector or accept a role supplied during signup. HR can manage employee records, announcements, and training. HR and Managers can mark attendance and review leave requests. All signed-in roles can view shared records and submit leave requests.

## API

- `GET /api/health` — service health
- `POST /api/auth/signup`, `POST /api/auth/login` — public account access
- `/api/employees`, `/api/attendance`, `/api/leaves`, `/api/announcements`, `/api/trainings`, `/api/dashboard/stats` — authenticated app data

Protected requests use `Authorization: Bearer <token>`. The backend listens on port 5000 by default; set `PORT` to change it.
