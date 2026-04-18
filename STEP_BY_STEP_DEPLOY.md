# Step By Step: GitHub -> MongoDB -> Vercel

This guide is written for someone with zero coding knowledge.

You do not need to run anything on your computer.

## What you are building

You already have the project files.

Your job is only to do these 3 things:

1. Put the project on GitHub
2. Create a MongoDB Atlas database
3. Connect the GitHub project to Vercel and deploy it

After that, you open the website and create the first admin account.

## Before you start

Make sure you have accounts for:

- GitHub
- MongoDB Atlas
- Vercel

If you do not have them yet, create them first.

## Part 1: Put the project on GitHub

### 1. Create a new GitHub repository

1. Open GitHub
2. Click the `+` button at the top right
3. Click `New repository`
4. Repository name: `fleet-portal`
5. Choose `Private` or `Public`
6. Do not add a README
7. Click `Create repository`

### 2. Upload the project files

1. Open your new empty repository
2. Click `Add file`
3. Click `Upload files`
4. Open this folder on your computer:

`C:\Users\mfspa\Documents\Codex\2026-04-18-files-mentioned-by-the-user-fleet-2\fleet-portal-main`

5. Select everything inside that folder
6. Drag all files and folders into the GitHub upload page
7. Wait until GitHub finishes loading them
8. In the commit message box type:

`Initial portal upload`

9. Choose `Commit directly to the main branch`
10. Click `Commit changes`

Important:

- Upload the contents of `fleet-portal-main`
- Do not upload the zip file itself
- Do not create `.env.local` in GitHub

## Part 2: Create MongoDB Atlas database

### 3. Create a project in MongoDB Atlas

1. Open MongoDB Atlas
2. Create a new project
3. Name it:

`Fleet Portal`

### 4. Create a cluster

1. Inside the Atlas project, create a database cluster
2. If you want the cheapest starting option, choose the free cluster if Atlas offers it in your screen
3. Pick any nearby region
4. Wait for the cluster to finish creating

### 5. Create database access user

1. In Atlas, open the cluster page
2. Click `Connect`
3. If Atlas asks for a database user, create one
4. Save these two values somewhere safe:

- Database username
- Database password

Important:

- This database username/password is for MongoDB
- It is different from your future website login

### 6. Add network access

Because Vercel is a cloud service, the simplest beginner setup is:

1. In Atlas, go to Network Access / IP Access List
2. Click `Add IP Address`
3. Add:

`0.0.0.0/0`

4. Save it

Important:

- This allows connections from anywhere
- Use a strong database password
- Later, this can be locked down more tightly if needed

### 7. Copy your MongoDB connection string

1. Go back to the cluster
2. Click `Connect`
3. Choose `Drivers`
4. Copy the connection string that starts with:

`mongodb+srv://`

It will look similar to this:

`mongodb+srv://USERNAME:PASSWORD@cluster-name.xxxxx.mongodb.net/?retryWrites=true&w=majority`

Now replace:

- `USERNAME` with your MongoDB database username
- `PASSWORD` with your MongoDB database password

Save the final full connection string somewhere safe.

## Part 3: Deploy on Vercel

### 8. Import the GitHub repository into Vercel

1. Open Vercel
2. Click `Add New...`
3. Click `Project`
4. Connect your GitHub account if Vercel asks
5. Find your `fleet-portal` repository
6. Click `Import`

### 9. Add environment variables in Vercel

Before clicking deploy, or in Project Settings after import, add these:

#### Variable 1

Name:

`MONGODB_URI`

Value:

Paste your full MongoDB connection string here

#### Variable 2

Name:

`JWT_SECRET`

Value:

Use a long random secret, example:

`fleet-portal-secret-2026-change-this-to-any-long-random-text`

Add both variables for:

- Production
- Preview
- Development

### 10. Deploy

1. Click `Deploy`
2. Wait for Vercel to build the project
3. When it finishes, open the live site

## Part 4: First website setup

### 11. Create the first admin account

When the website opens for the first time:

1. You will see the login/setup screen
2. Create your first admin account
3. This becomes the main admin for the portal

This admin can then:

- log in
- add payroll entries
- approve other users
- manage technicians

## Part 5: What to do after deployment

### 12. Test the portal

After login:

1. Add one technician job entry
2. Check that it appears on the right side
3. Check the technician summary cards at the bottom
4. Open a technician card
5. Test Excel export
6. Test PDF export

## If something goes wrong

### If Vercel says build failed

Check these first:

- Did you upload all files and folders from `fleet-portal-main`?
- Did you add `MONGODB_URI` exactly with that spelling?
- Did you add `JWT_SECRET` exactly with that spelling?
- Did you paste the full MongoDB connection string?

### If login page loads but app errors later

Check MongoDB:

- cluster exists
- database user exists
- IP access list includes `0.0.0.0/0`
- connection string username/password were replaced correctly

## Easiest way to work with me next

If you want, send me:

1. a screenshot of the screen you are on, or
2. the exact error message

Then I can guide you from that exact step.
