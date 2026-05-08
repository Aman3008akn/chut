# Netlify Deployment Guide for Nexus AI

## Prerequisites

Before deploying to Netlify, make sure you have:
1. A Netlify account (https://netlify.com)
2. Your GitHub repository connected

## Step-by-Step Deployment

### 1. Connect to Netlify

**Option A: Deploy from Git (Recommended)**
1. Go to https://app.netlify.com/start
2. Click "New site from Git"
3. Select GitHub
4. Authorize Netlify to access your repositories
5. Select `Aman3008akn/nexus-ai` repository
6. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Node version**: 20.x
7. Click "Deploy site"

**Option B: Manual Deploy**
1. Build locally: `npm run build`
2. Drag and drop the `.next` folder to Netlify dashboard

### 2. Set Environment Variables

⚠️ **IMPORTANT**: You MUST add these environment variables in Netlify:

Go to: **Site Settings → Environment Variables → Add a variable**

Add these variables:

```
MONGODB_URI=your_mongodb_connection_string_here

NEXTAUTH_URL=https://your-site-name.netlify.app
NEXTAUTH_SECRET=your_nextauth_secret_here

GOOGLE_ID=your_google_oauth_client_id_here
GOOGLE_SECRET=your_google_oauth_client_secret_here

GEMINI_API_KEY=your_gemini_api_key_here
```

**Note**: Replace `NEXTAUTH_URL` with your actual Netlify site URL after deployment.

### 3. MongoDB Atlas Configuration

Make sure your IP is whitelisted in MongoDB Atlas:

1. Go to MongoDB Atlas Dashboard
2. Navigate to **Network Access**
3. Click **Add IP Address**
4. Either:
   - Add `0.0.0.0/0` (allows all IPs - easier but less secure)
   - OR add Netlify's IP ranges (more secure)

### 4. Google OAuth Configuration

Update your Google Cloud Console:

1. Go to https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `https://your-site-name.netlify.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for local testing)

### 5. Rebuild After Environment Variables

After adding environment variables:
1. Go to **Deploys** tab in Netlify
2. Click **Trigger deploy** → **Clear cache and deploy site**

## Troubleshooting

### Build Fails
- Check build logs in Netlify dashboard
- Ensure `NODE_VERSION = "20"` in netlify.toml
- Verify all dependencies are in package.json

### API Routes Not Working
- Make sure `@netlify/plugin-nextjs` is installed
- Check that publish directory is `.next`
- Verify environment variables are set correctly

### Database Connection Error
- Check MongoDB URI is correct
- Ensure IP whitelist includes Netlify servers
- Test connection locally first

### Authentication Issues
- Verify NEXTAUTH_URL matches your site URL
- Check Google OAuth redirect URIs include your Netlify domain
- Ensure NEXTAUTH_SECRET is set

## Post-Deployment Checklist

- [ ] Site builds successfully
- [ ] Homepage loads
- [ ] Can send messages to AI
- [ ] Image upload works
- [ ] User authentication works (Sign in with Google)
- [ ] Conversations save to database
- [ ] Deep research mode works
- [ ] Mobile responsive design works

## Custom Domain (Optional)

To add a custom domain:
1. Go to **Domain Settings** in Netlify
2. Click **Add custom domain**
3. Enter your domain name
4. Update DNS records as instructed
5. Update NEXTAUTH_URL to your custom domain

## Support

If you encounter issues:
1. Check Netlify build logs
2. Review browser console for errors
3. Verify all environment variables are set
4. Check MongoDB Atlas network access

---

**Your site will be available at**: `https://[random-name].netlify.app`

You can change the site name in: **Site Settings → General → Site details → Change site name**
