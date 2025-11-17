import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replace with your Firebase config
const firebaseConfig = {
 apiKey: "AIzaSyBWtNnscpX_5FdaHAjUvtr5EKjGq_9pPZQ",
  authDomain: "firetap-49a54.firebaseapp.com",
  projectId: "firetap-49a54",
  storageBucket: "firetap-49a54.firebasestorage.app",
  messagingSenderId: "1030033330360",
  appId: "1:1030033330360:web:c6872cfdb51bdf13bae44d",
  measurementId: "G-7V2RLNE232"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider,db  };
