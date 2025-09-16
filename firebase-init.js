

// firebase-init.js

// Import the functions you need from the SDKs you need
// Using Firebase JS SDK v9 modular API for cleaner code and tree-shaking benefits.
// The URLs point to specific versions (9.22.0) to ensure stability.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCNZssIhRAg7AEVSodEWkAr70u8cAjqY6Y", // <<< VERIFY THIS IS YOUR ACTUAL API KEY
  authDomain: "fundplay-42169.firebaseapp.com",
  projectId: "fundplay-42169",
  storageBucket: "fundplay-42169.firebasestorage.app",
  messagingSenderId: "537830993744",
  appId: "1:537830993744:web:96796495c1660bedd60655",
  measurementId: "G-R5W86KQ2LP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Get Firebase Authentication service
const db = getFirestore(app); // Get Firestore service

// Export app, auth, db, and Timestamp to be used in other scripts
export { app, auth, db, Timestamp };