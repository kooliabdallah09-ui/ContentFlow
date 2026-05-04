# Publishing Integrations Setup Guide

Complete guide to set up ContentFlow integrations with all major social platforms.

## Quick Start Checklist

- [ ] Twitter/X - OAuth credentials
- [ ] LinkedIn - OAuth credentials  
- [ ] Instagram/Facebook - Meta App credentials
- [ ] TikTok - Developer credentials
- [ ] Google Gemini - API key for image generation

---

## Twitter/X Integration

### Prerequisites
1. Twitter Developer Account ([developer.twitter.com](https://developer.twitter.com))
2. Access to Twitter API v2

### Getting Twitter OAuth Credentials

1. **Create a Twitter App:**
   - Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Create a new app (or use existing)
   - Go to app settings

2. **Configure OAuth 2.0:**
   - Under "Authentication settings", enable OAuth 2.0
   - Set scopes:
     - `tweet.read`
     - `tweet.write`
     - `users.read`
   - Add Redirect URLs:
     - Development: `http://localhost:3000/api/integrations/twitter/callback`
     - Production: `https://yourdomain.com/api/integrations/twitter/callback`

3. **Get Your Credentials:**
   - `Client ID` → `TWITTER_CLIENT_ID`
   - `Client Secret` → `TWITTER_CLIENT_SECRET`
   - `API Key` → `TWITTER_API_KEY`
   - `API Secret` → `TWITTER_API_SECRET`

### Environment Variables
```bash
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
```

---

## LinkedIn Integration

### Prerequisites
1. LinkedIn Developer Account ([linkedin.com/developers](https://www.linkedin.com/developers))
2. Registered application

### Getting LinkedIn OAuth Credentials

1. **Create a LinkedIn App:**
   - Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
   - Click "Create app"
   - Fill in app details (name, LinkedIn Page, app logo, legal agreement)
   - Click "Create app"

2. **Configure OAuth:**
   - Go to "Auth" tab
   - Add Authorized redirect URLs:
     - Development: `http://localhost:3000/api/integrations/linkedin/callback`
     - Production: `https://yourdomain.com/api/integrations/linkedin/callback`
   - Request `Sign In with LinkedIn` access if not already granted

3. **Get Your Credentials:**
   - Go to "Auth" tab
   - `Client ID` → `LINKEDIN_CLIENT_ID`
   - `Client Secret` → `LINKEDIN_CLIENT_SECRET`

### Environment Variables
```bash
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
```

### Required Scopes
- `openid`
- `profile`
- `email`
- `w_member_social` (to post on behalf of user)

---

## Instagram & Facebook Integration (via Meta)

### Prerequisites
1. Meta Developer Account ([developers.facebook.com](https://developers.facebook.com))
2. Instagram Business Account (linked to Facebook Page)

### Getting Meta App Credentials

1. **Create a Meta App:**
   - Go to [Meta App Dashboard](https://developers.facebook.com/apps)
   - Click "My Apps" → "Create App"
   - Choose "Business" as app type
   - Fill app details and create

2. **Set Up Products:**
   - In app dashboard, go to "My Products"
   - Add "Facebook Login" product
   - Add "Instagram Graph API" product

3. **Configure OAuth:**
   - Go to Facebook Login settings
   - Add Redirect URIs:
     - Development: `http://localhost:3000/api/integrations/instagram/callback`
     - Production: `https://yourdomain.com/api/integrations/instagram/callback`

4. **Get Your Credentials:**
   - Go to Settings → Basic
   - `App ID` → `FACEBOOK_APP_ID`
   - `App Secret` → `FACEBOOK_APP_SECRET`

### Environment Variables
```bash
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
```

### Required Permissions
- `instagram_basic`
- `instagram_content_publish`
- `pages_manage_posts`
- `pages_read_engagement`

---

## TikTok Integration

### Prerequisites
1. TikTok Developer Account ([developers.tiktok.com](https://developers.tiktok.com))
2. TikTok Creator Account

### Getting TikTok OAuth Credentials

1. **Create a TikTok App:**
   - Go to [TikTok Developer](https://developers.tiktok.com/app)
   - Click "Create an app"
   - Fill app information
   - Select "TikTok Video" as app type
   - Accept terms and create

2. **Configure OAuth:**
   - In app settings, go to "OAuth Redirect URIs"
   - Add:
     - Development: `http://localhost:3000/api/integrations/tiktok/callback`
     - Production: `https://yourdomain.com/api/integrations/tiktok/callback`

3. **Get Your Credentials:**
   - Go to "Keys and Permissions"
   - `Client Key` → `TIKTOK_CLIENT_ID`
   - `Client Secret` → `TIKTOK_CLIENT_SECRET`

### Environment Variables
```bash
TIKTOK_CLIENT_ID=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
```

### Required Scopes
- `user.info.basic`
- `video.create` (for publishing)
- `video.publish`

---

## Google Gemini API (AI Image Generation)

### Prerequisites
1. Google Cloud Account
2. Generative AI API enabled

### Getting API Key

1. **Create API Key:**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Click "Get API Key"
   - Select or create Google Cloud project
   - Click "Create API Key"
   - Copy the generated key

### Environment Variables
```bash
GOOGLE_GEMINI_API_KEY=your_api_key
```

---

## Complete .env.local Setup

Create `.env.local` with all credentials:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic
ANTHROPIC_API_KEY=your_api_key

# Google Gemini
GOOGLE_GEMINI_API_KEY=your_api_key

# Twitter/X
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret

# LinkedIn
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret

# Facebook/Instagram
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret

# TikTok
TIKTOK_CLIENT_ID=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your_secure_random_token
```

---

## Testing Integrations

### 1. Local Development

Start dev server:
```bash
npm run dev
```

### 2. Test Twitter Connection

1. Navigate to [http://localhost:3000/settings/integrations](http://localhost:3000/settings/integrations)
2. Click "Connect" on Twitter
3. Authorize the app
4. Verify "Connected" status appears

### 3. Test Publishing

1. Go to [http://localhost:3000/generate/social](http://localhost:3000/generate/social)
2. Generate a social post
3. Click "Publish" or use calendar to schedule
4. Verify post appears on your Twitter account

### 4. Verify Other Platforms

Once implemented, test each platform's "Connect" button at `/settings/integrations`

---

## Troubleshooting

### "Invalid OAuth credentials"
- Verify credentials are exact (no extra spaces)
- Check redirect URIs match exactly in platform settings
- Ensure app is in development/production mode correctly

### "Token expired"
- OAuth tokens refresh automatically
- If error persists, disconnect and reconnect account

### "Unable to publish"
- Check integration is still connected
- Verify content meets platform requirements:
  - Twitter: ≤280 characters
  - LinkedIn: ≤3000 characters
  - Instagram: ≤2200 characters
  - TikTok: Requires video upload
- Check API rate limits haven't been exceeded

### Redirect URI mismatch
- Ensure `NEXT_PUBLIC_APP_URL` matches your app's URL
- Production redirect URIs must use HTTPS

---

## Rate Limits

**Twitter/X:**
- 450 requests per 15 minutes (posts)
- 30 requests per 15 minutes (media)

**LinkedIn:**
- 100 requests per day (share posts)

**Instagram/Facebook:**
- 200 requests per hour

**TikTok:**
- 500 requests per hour

Space out bulk operations to avoid hitting limits.

---

## Security Best Practices

✓ Never commit `.env.local` to version control  
✓ Use different credentials for dev/production  
✓ Rotate API keys regularly  
✓ Monitor integration activity in settings  
✓ Revoke access if accounts are compromised  
✓ Keep tokens encrypted in database  

---

## Next Steps

1. **Get API credentials** for each platform using the guides above
2. **Add to `.env.local`** with your actual credentials
3. **Test Twitter** first since it's fully implemented
4. **Monitor logs** for any OAuth errors
5. **Deploy to production** once tested locally

---

## Support

For issues or questions:
1. Check platform's API documentation
2. Verify credentials in platform dashboard
3. Check browser console for error messages
4. Review server logs for detailed errors
