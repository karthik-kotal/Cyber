# CyberForge — Render Cloud Backend Application Deployment Guide
*Deploying the CyberForge Backend API Application to Render (render.com)*

---

## 1. Overview

This deployment hosts the **CyberForge Backend Application** as a standalone Python Web Service on Render.
- Your **Web Frontend** remains completely untouched and independent (running on Vite locally or on its own host).
- Your **Mobile Android App** connects directly to your live Render application URL over the internet.

---

## 2. Fast 1-Click Deployment via Render Blueprint

We have added `render.yaml` to the root of your repository.

### Step 1: Push Changes to GitHub
```powershell
cd E:\cyber
git add .
git commit -m "feat: configure render backend application deployment"
git push origin master
```

### Step 2: Create Service on Render
1. Go to **[dashboard.render.com](https://dashboard.render.com)** and log in.
2. Click **New +** $\to$ **Blueprint**.
3. Select your repository: **`karthik-kotal/Cyber`**.
4. Render detects `render.yaml` with service `cyberforge-app` $\to$ click **Apply**.

---

## 3. Alternative: Manual Setup on Render (Without Blueprint)

1. Click **New +** $\to$ **Web Service**.
2. Select repository `karthik-kotal/Cyber`.
3. Fill in:
   - **Name**: `cyberforge-app`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
4. Click **Create Web Service**.

---

## 4. Connecting Your Android App to the Render Application

Once deployed, Render gives you a URL like `https://cyberforge-app.onrender.com`.

In your Android phone, your app can now connect from anywhere in the world:
1. In `cyberforge/frontend/src/services/api.ts`, update:
   ```typescript
   export const DEFAULT_DEVICE_API_BASE_URL = 'https://cyberforge-app.onrender.com';
   ```
2. Re-compile your APK:
   ```powershell
   cd E:\cyber\cyberforge\frontend
   npm run build
   npx cap sync android
   cd android
   .\gradlew.bat assembleDebug
   ```
3. Install `app-debug.apk` on your phone!
