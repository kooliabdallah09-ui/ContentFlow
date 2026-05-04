# ContentFlow

An AI-powered content generation and publishing platform built with Next.js, React, TypeScript, and Supabase.

## Features

### Core Features ✅
- **AI Content Generation** - Generate blog posts, social media content, and email sequences powered by Claude API
- **Content Editor** - Edit and refine generated content with real-time metrics
- **Content Library** - Save and organize all your generated content

### Advanced Features ✅

#### Phase 1: Publishing Integrations
- Connect social media accounts (Twitter/X)
- Publish content directly from ContentFlow
- Support for multiple platforms (LinkedIn, Instagram, Facebook, TikTok coming soon)

#### Phase 2: Content Calendar & Scheduling
- Visual content calendar
- Schedule posts for future publishing
- Automatic publishing at scheduled times
- Reschedule or cancel posts

#### Phase 3: Analytics Dashboard
- Track engagement metrics across platforms
- View content performance
- Platform-specific analytics
- Identify top-performing content

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Anthropic API key
- Twitter Developer account (optional, for integrations)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your credentials:
   - Supabase URL and keys
   - Anthropic API key
   - App URL

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Configuration

### Supabase Setup
1. Create a Supabase project
2. Run the SQL schema from `database-schema.sql`
3. **If you have an existing database**, run the migration from `migrations/001_fix_foreign_keys.sql` to update foreign key references
4. Copy your project URL and keys to `.env.local`

### Anthropic API
1. Get API key from [console.anthropic.com](https://console.anthropic.com)
2. Add to `.env.local` as `ANTHROPIC_API_KEY`

### Advanced Features Setup

**For Publishing Integrations:**
- Follow the guide in [INTEGRATIONS_SETUP.md](./INTEGRATIONS_SETUP.md)

**For Content Calendar & Scheduling:**
- Set up a cron job service (EasyCron, AWS CloudWatch, etc.)
- Configure `CRON_SECRET` in `.env.local`

**For Analytics Dashboard:**
- Same cron setup as scheduling
- Configure daily analytics sync

See [ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md) for detailed setup instructions.

## Project Structure

```
contentflow/
├── app/                          # Next.js app directory
│   ├── (auth)/                  # Authentication pages
│   ├── api/                     # API endpoints
│   │   ├── content/            # Content generation & saving
│   │   ├── calendar/           # Scheduling endpoints
│   │   ├── integrations/       # Platform connections
│   │   └── analytics/          # Analytics endpoints
│   ├── dashboard/              # User dashboard
│   ├── generate/               # Content generators
│   ├── calendar/               # Calendar view
│   ├── analytics/              # Analytics dashboard
│   └── settings/               # User settings
├── components/                  # React components
├── lib/                        # Utility libraries
│   ├── integrations/          # Platform publishers
│   ├── scheduler.ts           # Content scheduling
│   ├── analytics/             # Analytics aggregation
│   ├── jobs/                  # Background jobs
│   └── db.ts                  # Database utilities
├── public/                     # Static files
├── database-schema.sql        # Supabase schema
└── ADVANCED_FEATURES.md       # Feature documentation
```

## API Routes

### Content Generation
- `POST /api/content/generate/blog` - Generate blog posts
- `POST /api/content/generate/social` - Generate social posts
- `POST /api/content/generate/email` - Generate email sequences
- `POST /api/content/save` - Save generated content
- `GET /api/content/retrieve` - Retrieve saved content

### Publishing Integrations
- `GET /api/integrations/twitter/connect` - Start OAuth flow
- `GET /api/integrations/twitter/callback` - Handle OAuth
- `POST /api/integrations/disconnect` - Remove integration
- `POST /api/integrations/publish` - Publish to platform
- `GET /api/integrations/status` - Get connected platforms

### Content Calendar
- `POST /api/calendar/schedule` - Schedule content
- `GET /api/calendar/list` - Get scheduled posts
- `POST /api/calendar/reschedule` - Change schedule
- `DELETE /api/calendar/delete` - Remove from schedule
- `POST /api/calendar/execute` - Publish due content (cron)

### Analytics
- `GET /api/analytics/metrics` - Get aggregated metrics
- `POST /api/analytics/sync` - Sync platform data (cron)

## Build & Deploy

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

## Technologies Used

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Node.js
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude API
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS with custom glassmorphism

## License

MIT

## Support

For issues and feature requests, please see [ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md) for troubleshooting guides.
