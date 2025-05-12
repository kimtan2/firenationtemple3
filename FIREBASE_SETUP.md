# Firebase Setup for Fire Nation Temple

This application now uses Firebase Firestore to store Spaces and Topics (Subjects). Follow these steps to set up Firebase for your local development environment:

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup steps
3. Once your project is created, add a web app to it by clicking the web icon
4. Register your app with a nickname (e.g., "Fire Nation Temple")
5. Copy the Firebase configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Step 2: Create a .env.local File

Create a `.env.local` file in the root of your project with the following environment variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
```

Replace each placeholder with the corresponding values from your Firebase configuration.

## Step 3: Set Up Firestore Database

1. In the Firebase Console, navigate to Firestore Database
2. Click "Create database"
3. Choose either production mode or test mode (you can change this later)
4. Select a location closest to your users
5. Wait for Firestore to be provisioned

## Step 4: Security Rules

For development purposes, you can use these permissive rules (update these for production):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Step 5: Run Your Application

After setting up Firebase and configuring your environment variables, you can run your application:

```
npm run dev
```

Your app will now use Firebase Firestore to store Spaces and Topics!

## How It Works

- When you add, update, or delete Spaces and Topics, the changes are saved to both the local IndexedDB and Firebase Firestore
- The app will sync data between local IndexedDB and Firestore when loading spaces and topics
- If Firestore operations fail, the app will gracefully fall back to local data
