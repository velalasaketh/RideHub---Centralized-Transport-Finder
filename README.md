# RideHub - Ride-Sharing Comparison App

RideHub is a premium ride-sharing comparison and simulation mobile application built with React Native and Expo. It allows users to compare fares across three major providers: **UrbanRide**, **CityMove**, and **Ridezy**, with a real-time map simulation and notification system.

## 🚀 Key Features
- **Provider Comparison**: Real-time fare calculation comparing multiple service types.
- **Map Simulation**: Beautifully rendered driver-to-rider and trip simulations using Google Maps.
- **Live Notifications**: Status alerts for Captain Assigned, Arrived, Started, and Completed.
- **Premium UI/UX**: Rebranded with custom logos, modern payment card layouts, and smooth animations.
- **Safety Toolkit**: Integrated safety banners and ride insurance summaries.

## 🛠 Tech Stack
- **Framework**: React Native with Expo (SDK 54)
- **Maps**: `react-native-maps`, `react-native-maps-directions`
- **Backend**: Firebase Firestore & Auth
- **UI Components**: Lucide Icons, Custom Design System
- **Services**: Google Places API, Google Directions API, Google Geocoding API

---

## 📋 Prerequisites
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (LTS recommended)
- [Expo Go](https://expo.dev/client) app installed on your physical device for testing.
- [Google Cloud Account](https://console.cloud.google.com/) with a valid API Key.
- [Firebase Account](https://console.firebase.google.com/) with a set-up project.

---

## ⚙️ Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ride
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and add the following keys:
```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
EXPO_PUBLIC_RESEND_API_KEY=YOUR_RESEND_API_KEY_FOR_EMAILS
```
> [!IMPORTANT]
> Ensure the following Google APIs are enabled in your Google Cloud Console:
> - **Directions API**
> - **Places API**
> - **Geocoding API**

### 4. Firebase Configuration
Update your Firebase project credentials in `src/services/firebaseConfig.ts`:
```typescript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ... other keys
};
```

---

## 🏃 Running the Application

### Start Expo Server
```bash
npx expo start
```
- **Android**: Use `a` to open in an Android Emulator or scan QR code in Expo Go.
- **iOS**: Use `i` to open in an iOS Simulator or scan QR code in Expo Go.

### Building for Production
To build the final production bundle (AAB):
```bash
eas build --platform android --profile production
```

### Building an APK Preview (Installable)
To build a shareable APK for testing on physical devices:
```bash
eas build --platform android --profile preview
```

## 📄 License
Private Repository. All Rights Reserved.
