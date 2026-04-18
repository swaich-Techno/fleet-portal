# M's Fleet Service Portal

A Next.js payroll operations portal for technician job entry, role-based access, payroll summaries, and technician history exports.

## GitHub To Vercel To MongoDB

You do not need to run this locally.

1. Create a new empty GitHub repository.
2. In GitHub, use `Add file` -> `Upload files` and upload everything inside this project folder.
3. In MongoDB Atlas, create a database and copy your connection string.
4. In Vercel, click `Add New...` -> `Project`, import the GitHub repo, and add these environment variables before deploying:
   - `MONGODB_URI`
   - `JWT_SECRET`
5. Deploy.
6. Open the deployed site and create the first admin account on the login page.
7. After that, admins can approve viewer and editor access from the dashboard.

## GitHub Copy-Paste File Order

If you want to create the repo manually in GitHub's web editor, add these first:

- `package.json`
- `next.config.js`
- `.gitignore`
- `.env.example`
- `README.md`
- `styles/globals.css`
- `lib/mongodb.js`
- `lib/auth.js`
- `lib/constants.js`
- `lib/payroll.js`
- `lib/exporters.js`
- `models/User.js`
- `models/Technician.js`
- `models/Job.js`
- `pages/_app.js`
- `pages/index.js`
- `pages/dashboard.js`
- `pages/api/session.js`
- `pages/api/login.js`
- `pages/api/users.js`
- `pages/api/technicians.js`
- `pages/api/jobs.js`

## Environment

Copy `.env.example` to `.env.local` and set:

- `MONGODB_URI`
- `JWT_SECRET`

## First Run

1. Install dependencies with `npm install`
2. Start the app with `npm run dev`
3. Open the login page
4. Create the first admin account
5. Sign in and approve viewer/editor requests from the `User Access` panel

## Features

- Login landing page with first-admin setup flow
- Admin, editor, and viewer roles
- Admin approval workflow for requested accounts
- Technician roster management with hourly/salary labels
- Payroll calculations for regular hours, after hours, Sundays, and U.S. federal holidays
- Technician history filters for current and previous years
- Excel and PDF export from technician detail reports
