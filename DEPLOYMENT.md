# Deploy Nexus AI on Netlify

## Quick Steps:

1. Push code to GitHub
2. Connect GitHub repo to Netlify
3. Add environment variables in Netlify dashboard
4. Update Google OAuth redirect URI
5. Deploy!

## Environment Variables Needed:
- MONGODB_URI
- NEXTAUTH_URL (your netlify URL)
- NEXTAUTH_SECRET
- GOOGLE_ID
- GOOGLE_SECRET
- GEMINI_API_KEY

## After Deployment:
- Update NEXTAUTH_URL to your Netlify URL
- Add Netlify URL to Google OAuth authorized redirects
- Test all features
