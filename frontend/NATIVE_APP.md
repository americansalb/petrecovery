# ReunitePets Native App (Capacitor)

This document explains how to build and run the ReunitePets native app for iOS and Android using Capacitor.

## Why Native?

The web app (PWA) has a critical limitation: **GPS stops when the app is backgrounded**. This is a fundamental browser restriction on both iOS and Android that cannot be bypassed.

For the GPS search feature where users walk around for 15-30+ minutes looking for lost pets, reliable background GPS is essential. The native app provides:

- **Background GPS tracking**: Continues even when the app is in the background
- **Foreground service (Android)**: Persistent notification prevents OS from killing the app
- **"Always allow" location (iOS)**: Full background location access
- **Better battery optimization**: Native APIs are more efficient

## Prerequisites

### For iOS
- macOS with Xcode 14+ installed
- Apple Developer account (for device testing/distribution)
- CocoaPods: `sudo gem install cocoapods`

### For Android
- Android Studio with SDK 21+ (Android 5.0)
- Java 17+ (check with `java -version`)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Development Mode (Live Reload)

For development, the app loads from your local dev server:

```bash
# Start the Next.js dev server
npm run dev

# In a new terminal, set dev mode and sync
export CAPACITOR_DEV=true
export CAPACITOR_DEV_URL=http://YOUR_LOCAL_IP:3000  # Get IP: ipconfig getifaddr en0
npx cap sync

# Open in IDE
npx cap open ios     # Opens Xcode
npx cap open android # Opens Android Studio
```

Then run the app from the IDE on a simulator/device.

### 3. Production Build

For production, the app loads from your hosted web server:

```bash
# Set your production URL
export CAPACITOR_SERVER_URL=https://your-app-domain.com
npx cap sync

# Open in IDE
npx cap open ios
npx cap open android
```

## Building for App Store / Play Store

### iOS App Store

1. Open the project in Xcode: `npx cap open ios`
2. Select your team in Signing & Capabilities
3. Update the bundle identifier if needed
4. Archive the app: Product → Archive
5. Distribute to App Store Connect

### Android Play Store

1. Open the project in Android Studio: `npx cap open android`
2. Generate signed APK/Bundle: Build → Generate Signed Bundle/APK
3. Follow the signing wizard
4. Upload to Play Console

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CAPACITOR_DEV` | Enable development mode | `true` |
| `CAPACITOR_DEV_URL` | Local dev server URL | `http://192.168.1.100:3000` |
| `CAPACITOR_SERVER_URL` | Production web app URL | `https://reunitepets.com` |

### Updating the App

When you make changes to the web app:

```bash
# Sync changes to native projects
npx cap sync

# Or if you only need to copy web files
npx cap copy
```

## GPS Permissions

### iOS (Info.plist)

The app requests "Always allow" location permission with these messages:

- **When in use**: "ReunitePets needs your location to help you search for lost pets..."
- **Always allow**: "ReunitePets needs continuous location access to track your search route..."

### Android (AndroidManifest.xml)

Permissions included:
- `ACCESS_FINE_LOCATION` - Precise GPS
- `ACCESS_COARSE_LOCATION` - Network location
- `ACCESS_BACKGROUND_LOCATION` - Background tracking (Android 10+)
- `FOREGROUND_SERVICE` - Persistent service
- `FOREGROUND_SERVICE_LOCATION` - Location foreground service (Android 14+)
- `WAKE_LOCK` - Prevent sleep during search

## How It Works

1. The native app is essentially a wrapper that loads your web app
2. When GPS tracking starts, the app checks if native GPS is available
3. If native (Capacitor), it uses `@capacitor-community/background-geolocation`
4. This plugin creates a foreground service (Android) or uses CLLocationManager (iOS)
5. GPS continues to work even when the app is backgrounded

## Troubleshooting

### GPS not working in background

**iOS**: Check that "Always allow" location is granted in Settings → Privacy → Location Services → ReunitePets

**Android**:
1. Check that location permission is set to "Allow all the time"
2. Disable battery optimization for ReunitePets
3. Some manufacturers (Samsung, Xiaomi) require additional steps to prevent killing background apps

### App shows blank screen

1. Check that your server URL is correct and accessible
2. For production, ensure HTTPS is configured
3. Check the native logs in Xcode/Android Studio

### Changes not appearing

Run `npx cap sync` after making changes to ensure native projects are updated.

## File Structure

```
frontend/
├── capacitor.config.ts   # Capacitor configuration
├── ios/                  # iOS Xcode project
│   └── App/
│       ├── App/
│       │   └── Info.plist  # iOS permissions
│       └── Podfile
├── android/              # Android Studio project
│   └── app/
│       └── src/main/
│           └── AndroidManifest.xml  # Android permissions
├── app/lib/
│   ├── gpsService.js         # Main GPS service (auto-uses native when available)
│   └── nativeGpsService.js   # Native GPS wrapper
└── out/                  # Static files for fallback
```

## Support

For issues specific to the native app, check:
1. Capacitor documentation: https://capacitorjs.com/docs
2. Background Geolocation plugin: https://github.com/capacitor-community/background-geolocation
