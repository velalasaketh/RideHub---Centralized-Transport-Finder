import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAp8gjDsniuEisXUr9nfhncbY5ECw_CqlQ",
  authDomain: "ridehub-90d8e.firebaseapp.com",
  projectId: "ridehub-90d8e",
  storageBucket: "ridehub-90d8e.firebasestorage.app",
  messagingSenderId: "381043812421",
  appId: "1:381043812421:web:a340273cfc8bb00cb19b2c",
  measurementId: "G-QJX9YB7BZF"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);
export default app;
