# Deployment Guide - Vercel

This guide will help you deploy the ContentFlow presentation website to Vercel.

## Prerequisites

- GitHub account
- Vercel account (free)
- This repository pushed to GitHub

## Deployment Steps

### Step 1: Push Code to GitHub

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin master
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Select the repository containing this project

### Step 3: Configure Environment Variables

In the Vercel dashboard, add these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

(Get these from your Supabase project settings)

### Step 4: Deploy

Click "Deploy" and wait for the build to complete. Vercel will automatically:
- Run `npm install`
- Run `npm run build`
- Deploy the optimized build

## After Deployment

Your site will be live at: `https://your-project-name.vercel.app`

You can also connect a custom domain in the Vercel dashboard.

## Build Details

- **Framework**: Next.js 16.2.4
- **Output**: Static + Server-rendered pages
- **Build Command**: `npm run build`
- **Build Time**: ~3-5 seconds

## Available Routes

- `/` - Landing page
- `/presentation` - Interactive presentation (no auth required)
- `/dashboard` - Dashboard (requires auth)
- `/auth/login` - Login page
- `/auth/signup` - Signup page

## Redeployment

Any push to the `master` branch will automatically trigger a new deployment.

## Troubleshooting

If the build fails:
1. Check that all environment variables are set
2. Ensure the build succeeds locally: `npm run build`
3. Check Vercel logs for specific errors
