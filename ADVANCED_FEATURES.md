# ContentFlow Advanced Features Documentation

Complete guide to Phase 1, 2, and 3 features: Publishing Integrations, Content Calendar & Scheduling, and Analytics Dashboard.

## Phase 1: Publishing Integrations ✅

### Overview
Publish your generated content directly to social media platforms from ContentFlow.

### Supported Platforms
- **Twitter/X** - Tweet your content (Implemented ✅)
- **LinkedIn** - Coming Soon
- **Instagram** - Coming Soon (via Meta Graph API)
- **Facebook** - Coming Soon (via Meta Graph API)
- **TikTok** - Coming Soon

### Setup Twitter Integration

#### 1. Get Twitter API Credentials

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new application or use existing one
3. Go to "Settings" tab
4. Find "Authentication settings" section
5. Enable OAuth 2.0
6. Set required scopes:
   - `tweet.read`
   - `tweet.write`
   - `users.read`
7. Set Redirect URI:
   - Development: `http://localhost:3000/api/integrations/twitter/callback`
   - Production: `https://yourdomain.com/api/integrations/twitter/callback`
8. Copy your credentials:
   - Client ID
   - Client Secret
   - API Key
   - API Secret

#### 2. Configure Environment Variables

Add to `.env.local`:

```bash
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
```

#### 3. Connect Your Account

1. Start the development server: `npm run dev`
2. Go to `/settings/integrations`
3. Click "Connect" on the Twitter card
4. Authorize with your Twitter account
5. You'll be redirected back to integrations page with success message

### Using the Integration

#### Publishing Blog Posts

1. Generate or open a blog post
2. Click "Save to Library" or "Schedule for Later"
3. Once saved, navigate to the content and click "Publish"
4. Select Twitter as the platform
5. Content will be published as a tweet

#### Publishing Social Posts

1. Generate social media content
2. Click "Save All Posts"
3. Select "Publish" for individual posts or "Publish All"
4. Choose target platforms
5. Posts are published immediately to connected platforms

### Architecture

**API Endpoints:**
- `POST /api/integrations/twitter/connect` - Start OAuth flow
- `GET /api/integrations/twitter/callback` - Handle OAuth callback
- `POST /api/integrations/disconnect` - Disconnect a platform
- `POST /api/integrations/publish` - Publish content to platforms
- `GET /api/integrations/status` - Get connected platforms

**Libraries:**
- `lib/integrations/twitter.ts` - Twitter API v2 publisher
- `lib/auth-integration.ts` - Token storage and retrieval

---

## Phase 2: Content Calendar & Scheduling ✅

### Overview
Schedule your content to be published automatically at specific times across multiple platforms.

### Features

- **Calendar View** - Visual calendar of scheduled content
- **Drag-to-Reschedule** - Change publish dates easily
- **Bulk Scheduling** - Schedule multiple pieces of content
- **Timezone Support** - Schedule in your local timezone
- **Auto-Publish** - Automatic publishing at scheduled times

### How to Use

#### Schedule Content from Generators

1. Generate blog post, social post, or email sequence
2. In the Editor, click "Schedule for Later"
3. Select platforms to publish to
4. Choose date and time
5. Click "Schedule"
6. Content will be published automatically at the specified time

#### View Calendar

1. Click "Calendar" in main navigation
2. View all scheduled content for current month
3. Click previous/next to browse months
4. Hover over content to see details
5. Use reschedule or delete buttons

#### Reschedule Content

1. Open Calendar
2. Hover over scheduled content
3. Click "Reschedule"
4. Select new date and time
5. Confirm

### Background Publishing Job

The system includes an automatic cron job that publishes due content.

**Setup:**

1. Add to `.env.local`:
   ```bash
   CRON_SECRET=your_secure_random_token
   ```

2. Set up an external cron service (like EasyCron, AWS CloudWatch, etc.)
3. Configure to call:
   ```
   POST /api/calendar/execute
   Authorization: Bearer your_cron_secret
   ```

4. Recommended frequency: Every 5 minutes

**How it works:**
- Checks for content with `scheduled_date` <= now
- Publishes to connected platforms
- Updates content status to "published"
- Handles errors gracefully with retry logic

### Database Tables

**content_calendar:**
```sql
- id (uuid) - Primary key
- user_id (uuid) - User who scheduled
- content_id (uuid) - Content to publish
- scheduled_date (timestamp) - When to publish
- published_date (timestamp) - When actually published
- platforms (text[]) - Target platforms
- status (text) - draft|scheduled|publishing|published|failed
- error_message (text) - If publishing failed
- created_at, updated_at (timestamp)
```

### API Endpoints

- `POST /api/calendar/schedule` - Schedule content
- `GET /api/calendar/list` - Get scheduled content
- `POST /api/calendar/reschedule` - Change schedule
- `DELETE /api/calendar/delete` - Remove from schedule
- `POST /api/calendar/execute` - Cron job endpoint

### Architecture

**Core Files:**
- `lib/scheduler.ts` - Scheduling utilities
- `lib/jobs/scheduler.ts` - Cron job handler
- `app/calendar/page.tsx` - Calendar UI
- `app/api/calendar/*` - API endpoints

---

## Phase 3: Analytics Dashboard ✅

### Overview
Track your content performance and engagement metrics across all platforms.

### Features

- **Engagement Tracking** - View likes, comments, shares, clicks
- **Platform Breakdown** - Performance by platform
- **Top Performing Posts** - See your best content
- **Time Range Analysis** - Last 7, 30, or 90 days
- **Trend Analysis** - Growth over time

### Dashboard Sections

#### Key Metrics
- **Total Posts** - Number of pieces published
- **Total Views** - Sum of all impressions
- **Total Clicks** - Link clicks and interactions
- **Total Shares** - Share count across platforms
- **Average Engagement Rate** - Overall engagement %

#### Platform Breakdown
For each connected platform:
- Number of posts published
- Total views/impressions
- Clicks generated
- Shares and reactions
- Average engagement rate

#### Top Performing Post
Details of your best-performing content:
- Title and platform
- View count
- Click count
- Like/favorite count
- Engagement rate

### Supported Metrics

**Twitter:**
- Impressions (views)
- Retweets (shares)
- Replies (comments)
- Likes
- Click-through rate

**LinkedIn:**
- Impressions
- Clicks
- Comments
- Shares
- Engagement rate

**Instagram/Facebook:**
- Impressions
- Reach
- Saves
- Shares
- Comments
- Likes
- Engagement rate

### How to Use

1. Click "Analytics" in main navigation
2. Choose time range: Last 7, 30, or 90 days
3. View key metrics at top
4. See platform breakdown
5. Identify top performing posts
6. Use insights to inform future content

### Data Sync

Analytics data is synced daily from connected platforms.

**Setup:**

1. Add to `.env.local`:
   ```bash
   CRON_SECRET=your_secure_random_token
   ```

2. Set up external cron service
3. Configure to call:
   ```
   POST /api/analytics/sync
   Authorization: Bearer your_cron_secret
   ```

4. Recommended frequency: Once per day (e.g., 2 AM UTC)

**What gets synced:**
- Views/impressions from each platform
- Clicks and click-through rates
- Shares and re-shares
- Comments and replies
- Likes and reactions

### API Endpoints

- `GET /api/analytics/metrics?days=30` - Get aggregated metrics
- `POST /api/analytics/sync` - Sync with platforms (cron)

### Database Tables

**content_analytics:**
```sql
- id (uuid) - Primary key
- user_id (uuid) - User who owns content
- content_id (uuid) - Content being tracked
- platform (text) - Where posted
- views (int) - Impressions/views
- clicks (int) - Click-throughs
- shares (int) - Share count
- comments (int) - Comment count
- likes (int) - Like/favorite count
- impressions (int) - Total impressions
- engagement_rate (decimal) - Engagement %
- fetched_at (timestamp) - When data was fetched
- created_at (timestamp)
```

### Architecture

**Core Files:**
- `lib/analytics/aggregator.ts` - Metrics aggregation
- `app/analytics/page.tsx` - Dashboard UI
- `app/api/analytics/*` - API endpoints
- `lib/jobs/analyticsSync.ts` - Sync job handler

---

## Complete Setup Checklist

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Twitter Developer account (for Phase 1)

### Initial Setup
- [ ] Clone repository
- [ ] Install dependencies: `npm install`
- [ ] Set up Supabase project
- [ ] Update database schema with provided SQL
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in Supabase credentials

### Phase 1: Integrations
- [ ] Get Twitter API credentials
- [ ] Add Twitter credentials to `.env.local`
- [ ] Test integration: Go to `/settings/integrations`
- [ ] Connect Twitter account
- [ ] Test publishing from generators

### Phase 2: Scheduling
- [ ] Generate cron token for `CRON_SECRET`
- [ ] Add `CRON_SECRET` to `.env.local`
- [ ] Set up external cron service
- [ ] Configure cron to call `/api/calendar/execute`
- [ ] Test scheduling from generators
- [ ] Verify auto-publish works

### Phase 3: Analytics
- [ ] Configure cron service for analytics sync
- [ ] Set up cron to call `/api/analytics/sync` daily
- [ ] Publish some content and wait for sync
- [ ] Check `/analytics` page for metrics

---

## Environment Variables Reference

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Phase 1: Twitter Integration
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret

# Phase 2 & 3: Cron Jobs
CRON_SECRET=your_secure_random_token_here
```

---

## Troubleshooting

### Twitter Integration Issues

**Error: "Twitter integration not connected"**
- Verify you've completed the OAuth flow
- Check tokens in database: `SELECT * FROM integrations WHERE platform='twitter'`
- Try disconnecting and reconnecting

**Error: "Failed to publish"**
- Check tweet length (Twitter limit: 280 characters)
- Verify platform is still connected
- Check API credentials in `.env.local`

### Scheduling Issues

**Scheduled content not publishing**
- Verify cron job is running
- Check logs: `SELECT * FROM content_calendar WHERE status='failed'`
- Ensure integration is still connected
- Verify scheduled_date is in the past

**Content published but status not updated**
- Check database directly for status
- Review error_message field for details
- Manually trigger cron job to retry

### Analytics Issues

**No metrics showing**
- Analytics are only available for published content
- Wait 24 hours for first sync
- Check that integrations are connected
- Verify cron job for sync is running

**Inaccurate metrics**
- Platform APIs may lag 24-48 hours
- Try manual sync: call `/api/analytics/sync`
- Check fetched_at timestamp in database

---

## Future Enhancements

- LinkedIn, Instagram, Facebook integrations
- Email campaign tracking
- Real-time webhook-based analytics
- Content recommendations based on metrics
- Automated posting optimization
- Custom reporting and exports
- Team collaboration features
