import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Firebase config for firetap-f2bcd project
const firebaseConfig = {
  apiKey: "AIzaSyAKqhu06Rjss3JaBR1WqVxZGgy5DS5d--k",
  authDomain: "firetap-f2bcd.firebaseapp.com",
  projectId: "firetap-f2bcd",
  storageBucket: "firetap-f2bcd.firebasestorage.app",
  messagingSenderId: "787633419930",
  appId: "1:787633419930:web:d43ef98e4889604e939123",
  measurementId: "G-Q1EGDXXJ8R",
  databaseURL: "https://firetap-f2bcd-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app); // Firestore for user data and device registrations
const rtdb = getDatabase(app); // Realtime Database for live sensor data

export { auth, provider, db, rtdb };
