# CLICKER Mobile App Deployment Guide

This guide provides instructions on how to convert the **CLICKER** web codebase into a native iOS/Android application using **Capacitor**.

## 🛠️ Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- [Android Studio](https://developer.android.com/studio) (for Android builds).
- [Xcode](https://developer.apple.com/xcode/) (for iOS builds - macOS required).

## 🚀 Build Instructions

### 1. Initialize the Mobile Project
Open your terminal in the root directory of the project and run:
```bash
npm install
npm run cap:init
```

### 2. Add Target Platforms
To add Android or iOS support:
```bash
# For Android
npm run cap:add:android

# For iOS
npm run cap:add:ios
```

### 3. Build & Sync
Every time you update your web files (HTML/JS/CSS), sync the changes to the native platforms:
```bash
npm run cap:sync
```

### 4. Generate Signed Release (APK/IPA)

#### For Android:
1. Run `npm run cap:open:android` to open the project in Android Studio.
2. In Android Studio, go to **Build > Generate Signed Bundle / APK**.
3. Follow the wizard to create your keystore and sign the APK.
4. The installable `.apk` file will be generated in `android/app/release/`.

#### For iOS:
1. Run `npm run cap:open:ios` to open the project in Xcode.
2. Select a development team and configure signing in the **Signing & Capabilities** tab.
3. Go to **Product > Archive**.
4. Use the **Distribute App** wizard to export an `.ipa` file.

## 📱 PWA (Fast Install)
The project is already configured as a **Progressive Web App (PWA)**. 
- Open the URL in Chrome (Android) or Safari (iOS).
- Select **Add to Home Screen**.
- The app will now launch in a full-screen, standalone mode with offline support.

## 🌍 GitHub Hosting (Web Distribution)
The project is configured for **GitHub Pages**. Every push to the `main` branch will automatically deploy the latest version of the app to your GitHub Pages URL.

1.  **Push to GitHub**: Initialize a Git repository and push your code to GitHub.
2.  **Enable GitHub Pages**: Go to **Settings > Pages** and ensure **GitHub Actions** is selected as the source.
3.  **Sync with Backend**: Once hosted on GitHub, use the **Admin > Network Config** in the app to connect it to your local Master Server IP or a public tunnel URL.

## 🧪 Compatibility Testing
- **Android**: Tested on Android 10+ (Chrome 80+).
- **iOS**: Tested on iOS 14+ (Safari).
- **Offline**: Verified Service Worker caching for core assets.
- **Responsiveness**: Optimized for 360px to 450px mobile screens.
