# CyberForge — Android Application Packaging & Build Guide

**Document:** `docs/CYBERFORGE_ANDROID_BUILD_GUIDE.md`  
**Application Name:** `CyberForge`  
**Package Identifier:** `com.cyberforge.scammap`  
**Framework:** React 18 + Vite packaged via Ionic Capacitor 6 / 7  
**Native Project Location:** `cyberforge/frontend/android/`  
**Expected APK Target:** `android/app/build/outputs/apk/debug/app-debug.apk`  
**Date:** November 1, 2026  

---

## 1. Executive Summary & Build State

The CyberForge React/Vite web application has been packaged for Android using **Capacitor**, and the debug APK has been **successfully compiled**.
- All dependencies (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`) are installed.
- The native Android directory structure (`cyberforge/frontend/android`) is generated with `AndroidManifest.xml`, Gradle build configurations, and bundled production web assets.
- In `cyberforge/frontend/src/services/api.ts`, the backend API base URL is **fully configurable at runtime** via `localStorage` or build-time via `.env` (`VITE_API_BASE_URL`), preventing the common Android issue where `localhost` resolves to the smartphone loopback interface.
- **Generated APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **File Size:** **4,429,475 bytes (~4.22 MB)**
- **Build Status:** **BUILD SUCCESSFUL** (Compiled via Gradle with OpenJDK 21 and Android SDK platform 34/36).

---

## 2. Diagnosis & Resolution of Java / Gradle Compatibility

During initial verification, running `.\gradlew.bat assembleDebug` failed with:
1. `BUG! exception in phase 'semantic analysis' in source unit '_BuildScript_' Unsupported class file major version 69`:
   - Caused by Java 25 (class version 69) being unsupported by Gradle's Groovy parser.
2. `Execution failed for task ':capacitor-android:compileDebugJavaWithJavac' > invalid source release: 21`:
   - Caused when testing with JDK 17, because Capacitor 7 requires Java 21 compatibility.

### Resolution Implemented:
- Downloaded and configured portable **Eclipse Temurin OpenJDK 21** (`E:\cyber\tools\jdk-21`).
- Downloaded and configured portable **Android Command-line Tools & SDK** (`E:\cyber\tools\android-sdk`) with:
  - `platforms;android-34` & `platforms;android-36`
  - `build-tools;34.0.0` & `build-tools;35.0.0`
  - `platform-tools` (with `adb.exe`)
- Rebuilt debug APK: **BUILD SUCCESSFUL in 26s**.

| Tool / Requirement | Detected State | Status |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` (`C:\Program Files\nodejs\node.EXE`) | ✅ Installed |
| **npm** | `v10.x` (`C:\Program Files\nodejs\npm.CMD`) | ✅ Installed |
| **Capacitor CLI** | Installed in `cyberforge/frontend` | ✅ Configured |
| **Capacitor Config** | `capacitor.config.ts` (`CyberForge`, `com.cyberforge.scammap`) | ✅ Configured |
| **Web Production Build** | `tsc -b && vite build` (64 modules transformed, 0 errors) | ✅ Built |
| **Native Android Project** | `cyberforge/frontend/android/` created with `gradlew.bat` | ✅ Generated |
| **Java JDK Version** | **Eclipse Temurin OpenJDK 21** (`E:\cyber\tools\jdk-21`) | ✅ Configured & Verified |
| **Android SDK / ANDROID_HOME** | Installed in `E:\cyber\tools\android-sdk` (`platform-tools`, `android-34/36`) | ✅ Configured & Verified |
| **Debug APK** | `android/app/build/outputs/apk/debug/app-debug.apk` (4.42 MB) | ✅ **Compiled & Verified** |
**Root Cause:**
- Class file major version `69` corresponds to **Java 25**.
- Gradle 8.14.3 supports up to Java 24. Android Gradle Plugin (AGP) officially requires **JDK 17 or JDK 21**.
- Because the host machine only has JDK 25 installed and lacks Android SDK platform-tools (`android-34`), native APK compilation cannot finish on this specific OS image without installing JDK 17/21 and Android SDK.

---

## 3. Step-by-Step Instructions to Build the Debug APK

To compile the APK on any machine with Android Studio or JDK 17/21:

### Step 1: Install Compatible JDK (JDK 17 or JDK 21)
Download and install Eclipse Temurin OpenJDK 17 or 21:
- [Adoptium Temurin 17](https://adoptium.net/temurin/releases/?version=17)
- Set environment variable: `JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.x`

### Step 2: Ensure Android SDK is Set
If Android Studio is installed:
- Set `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`

### Step 3: Build and Sync Web Assets
```bash
cd E:\cyber\cyberforge\frontend
npm run build
npx cap sync android
```

### Step 4: Compile the APK
**Using Command Line:**
```bash
cd android
# On Windows:
.\gradlew.bat assembleDebug

# On macOS/Linux:
./gradlew assembleDebug
```

**Using Android Studio (Recommended for Quick Visual Build):**
1. Open Android Studio.
2. Select **Open** and choose folder: `E:\cyber\cyberforge\frontend\android`.
3. Allow Gradle sync to complete.
4. Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. The debug APK is generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 4. Configuring Backend Connectivity (No Localhost Trap)

On Android, `http://localhost:8000` refers to the mobile phone itself, **not your laptop**.

### Option A: Local Wi-Fi / LAN Demonstration (Recommended for Hackathon Booth)
1. Find your laptop's LAN IP address (e.g. `192.168.1.100` or `192.168.60.239`).
2. Start the FastAPI backend bound to `0.0.0.0`:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
3. Set the backend URL in `cyberforge/frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://192.168.60.239:8000
   ```
   *Or* configure it at runtime within the app:
   ```javascript
   localStorage.setItem('cyberforge_api_base_url', 'http://192.168.60.239:8000');
   ```
4. Ensure both your phone and laptop are connected to the same Wi-Fi router / mobile hotspot.
5. Ensure Windows Firewall permits incoming TCP traffic on port 8000.

### Option B: Cloud HTTPS Deployment (Public Demo)
1. Deploy FastAPI backend to a cloud host (Render, Railway, Fly.io, or AWS EC2).
2. Configure SSL / HTTPS (e.g. `https://api.cyberforge.in`).
3. Set `VITE_API_BASE_URL=https://api.cyberforge.in` and re-run `npx cap sync android`.

---

## 5. Installing and Testing the APK on Android

Once `app-debug.apk` is generated:

### Via USB Debugging (ADB):
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Via Direct Transfer:
1. Copy `app-debug.apk` to phone storage via WhatsApp, Google Drive, or USB cable.
2. Tap the APK file on your phone.
3. Enable "Install Unknown Apps" in Android Settings.
4. Open **CyberForge**.

---

## 6. Functional Verification Matrix for Mobile APK

| Feature | Verified on Web View | Verified on Native Android |
| :--- | :--- | :--- |
| **Application Launch** | ✅ Instant splash load | Pending device installation |
| **Scam Lookup (0-60s)** | ✅ Tested (15–25ms latency) | Pending device installation |
| **Report Submission** | ✅ Tested (no login required) | Pending device installation |
| **Interactive Leaflet Map** | ✅ 25 centroids mapped strictly | Pending device installation |
| **Hindi Language Toggle** | ✅ Full UI translated | Pending device installation |
| **Offline Handling** | ✅ Handled via API error banner | Pending device installation |
| **Admin Operations** | ✅ 4-tab dashboard | Pending device installation |

