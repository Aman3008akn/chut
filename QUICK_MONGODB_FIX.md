# Quick MongoDB Fix - Step by Step

## The Problem
You're getting "bad auth : authentication failed" which means either:
- Wrong password
- User doesn't exist
- IP not whitelisted

## Solution (Choose ONE):

### Option A: Reset Password (Easiest)

1. **Go to MongoDB Atlas**: https://cloud.mongodb.com/

2. **Navigate to Database Access**:
   - Select your project
   - Click "Database Access" in left sidebar

3. **Edit the User**:
   - Find `amansjeje432_db_user`
   - Click "Edit" button

4. **Set New Password**:
   - Click "Edit Password"
   - Click "Autogenerate Secure Password" 
   - **COPY THE PASSWORD** (you won't see it again!)
   - Click "Update User"

5. **Update .env.local**:
   ```
   MONGODB_URI=mongodb+srv://amansjeje432_db_user:YOUR_NEW_PASSWORD@nexusai.vbmcp4b.mongodb.net/nexusai?retryWrites=true&w=majority
   ```

6. **Restart server**:
   ```bash
   npm run dev
   ```

---

### Option B: Create New User (If Option A doesn't work)

1. **Go to Database Access** in MongoDB Atlas

2. **Click "Add New Database User"**

3. **Fill in details**:
   - Authentication Method: Password
   - Username: `nexusai_user` (or any name you want)
   - Password: Click "Autogenerate Secure Password"
   - **COPY THE PASSWORD!**
   - Database User Privileges: "Read and write to any database"

4. **Click "Add User"**

5. **Update .env.local**:
   ```
   MONGODB_URI=mongodb+srv://nexusai_user:YOUR_NEW_PASSWORD@nexusai.vbmcp4b.mongodb.net/nexusai?retryWrites=true&w=majority
   ```

6. **Restart server**

---

### Option C: Check Network Access

1. **Go to Network Access** in MongoDB Atlas (left sidebar)

2. **Check if your IP is listed**:
   - If not, click "Add IP Address"
   - Click "Add Current IP Address"
   - OR for testing: Add `0.0.0.0/0` (allows all IPs)
   - Click "Confirm"

3. **Wait 1-2 minutes** for changes to take effect

4. **Try connecting again**

---

## After Making Changes:

1. **Stop the current server** (Ctrl+C in terminal)

2. **Clear cache**:
   ```bash
   Remove-Item -Recurse -Force .next
   ```

3. **Start server**:
   ```bash
   npm run dev
   ```

4. **Check terminal** for connection errors

---

## Still Not Working?

Common issues:
- ❌ Password has special characters → URL encode them
- ❌ Cluster is paused → Resume it in MongoDB Atlas
- ❌ Wrong cluster name → Check your connection string in Atlas
- ❌ Typo in username → Double-check spelling

## Get Connection String from Atlas:

1. Go to "Database" → "Connect"
2. Click "Connect your application"
3. Copy the connection string
4. Replace `<password>` with your actual password
5. Paste in `.env.local`
