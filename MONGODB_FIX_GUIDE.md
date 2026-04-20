# MongoDB Authentication Fix Guide

## Problem
You're experiencing a "bad auth : authentication failed" error when trying to connect to MongoDB Atlas.

## Solution Steps

### 1. Verify Your MongoDB Atlas Credentials

1. **Log in to MongoDB Atlas**: https://cloud.mongodb.com/

2. **Check Database Access**:
   - Go to your project → Click on "Database Access" in the left sidebar
   - Verify that the user `amansjeje432_db_user` exists
   - If it doesn't exist, create a new database user with:
     - Username: Choose a username
     - Password: Choose a strong password
     - Role: "Read and write to any database" (or specific permissions as needed)

3. **Reset Password if Needed**:
   - Click "Edit" next to your user
   - Set a new password
   - Save changes

### 2. Update Your .env.local File

After verifying/creating your credentials, update the MONGODB_URI in your `.env.local` file:

```
MONGODB_URI=mongodb+srv://<username>:<password>@nexusai.vbmcp4b.mongodb.net/?appName=nexusai
```

Replace `<username>` and `<password>` with your actual credentials.

**Important**: Make sure to URL-encode special characters in your password if it contains any.

### 3. Check Network Access

1. In MongoDB Atlas, go to "Network Access" in the left sidebar
2. Ensure your IP address is whitelisted:
   - Click "Add IP Address"
   - Add your current IP or use `0.0.0.0/0` for development (allows all IPs - not recommended for production)

### 4. Verify Database Name

Make sure the database name in your connection string matches what you expect. The current URI uses the default database from the cluster.

### 5. Test the Connection

After updating the credentials:
1. Restart your development server
2. Check the terminal for connection errors
3. Try making a request to see if MongoDB connects successfully

## Example .env.local Format

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://your_username:your_password@nexusai.vbmcp4b.mongodb.net/nexusai?retryWrites=true&w=majority

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here
GOOGLE_ID=your_google_id
GOOGLE_SECRET=your_google_secret

# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key
```

## Common Issues

1. **Special Characters in Password**: If your password contains special characters like `@`, `#`, `$`, etc., you need to URL-encode them:
   - `@` becomes `%40`
   - `#` becomes `%23`
   - `$` becomes `%24`
   - Use an online URL encoder tool

2. **Wrong Cluster Name**: Make sure `nexusai.vbmcp4b.mongodb.net` is the correct cluster address

3. **User Permissions**: Ensure the database user has read/write permissions to the database

4. **IP Whitelist**: Your IP must be in the network access whitelist

## Need Help?

If you're still having issues:
1. Check MongoDB Atlas logs for more detailed error messages
2. Verify your cluster is running and not paused
3. Contact MongoDB support if the issue persists
