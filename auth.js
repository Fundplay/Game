// auth.js

import { auth, db, Timestamp } from './firebase-init.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

console.log("auth.js loaded.");

// Get DOM elements for login/signup form (only exist on login.html)
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const authError = document.getElementById('authError');

// Get DOM element for logout button (only exists on index.html)
const logoutBtn = document.getElementById('logoutBtn'); 

// --- Firebase Authentication State Listener ---
// This runs whenever the user's sign-in state changes (login, logout, page refresh)
onAuthStateChanged(auth, async (user) => {
    console.log('onAuthStateChanged triggered. User:', user ? user.uid : 'null');

    if (user) {
        // User is signed in.
        // If the user is on the login/signup page, redirect them to the home page.
        if (window.location.pathname.includes('login.html')) {
            console.log('User logged in, redirecting from login.html to index.html');
            window.location.href = 'index.html';
            return; // Prevent further execution on login.html
        }

        // If the user is on index.html, add-cash.html, or announcement.html, load their data.
        if (window.location.pathname.includes('index.html') || window.location.pathname.includes('add-cash.html') || window.location.pathname.includes('announcement.html')) {
            await loadUserData(user.uid);
        }
    } else {
        // User is signed out.
        console.log('User is signed out.');
        
        // If the user is NOT on the login page, redirect them to the login page.
        if (!window.location.pathname.includes('login.html')) {
            console.log('User logged out, redirecting to login.html');
            window.location.href = 'login.html';
        }
        // Clear global user data if logged out
        window.currentUserData = null;
    }
});

// --- Login/Signup Form Submission Logic (for login.html) ---
if (authForm) { // Only attach listeners if the authForm exists (i.e., on login.html)
    console.log("Auth form found, attaching listeners.");
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission
        const email = emailInput.value;
        const password = passwordInput.value;
        authError.textContent = ''; // Clear any previous error messages
        console.log('Attempting login with email:', email);

        try {
            // Attempt to sign in with email and password
            await signInWithEmailAndPassword(auth, email, password);
            console.log('User logged in successfully! Auth state changed listener will handle redirect.');
        } catch (error) {
            console.error('Login error:', error.code, error.message);
            authError.textContent = 'Login failed: ' + getAuthErrorMessage(error.code);
        }
    });

    signupBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        authError.textContent = ''; // Clear any previous error messages
        console.log('Attempting signup with email:', email);

        if (password.length < 6) {
            authError.textContent = 'Password should be at least 6 characters.';
            return;
        }

        try {
            // Attempt to create a new user with email and password
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('User signed up successfully!', user.uid);

            // --- Create a new user document in Firestore ---
            // Ensure the 'users' collection exists and rules allow writes
            await setDoc(doc(db, "users", user.uid), {
                Name: email.split('@')[0], // Use part of email as default name
                Balance: 0.00, // Set initial balance to 0 (as a number)
                "Login time": Timestamp.now() // Record signup time
            });
            console.log("New user data initialized in Firestore for UID:", user.uid);
            // The onAuthStateChanged listener will handle redirection to index.html
        } catch (error) {
            console.error('Signup error:', error.code, error.message);
            authError.textContent = 'Signup failed: ' + getAuthErrorMessage(error.code);
        }
    });
}

// --- Logout functionality (for index.html and other protected pages) ---
if (logoutBtn) { // Only attach listener if the logoutBtn exists (i.e., on index.html)
    console.log("Logout button found, attaching listener.");
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth); // Sign out the current user
            console.log('User logged out successfully!');
            // The onAuthStateChanged listener will handle redirection to login.html
        } catch (error) {
            console.error('Logout error:', error.code, error.message);
            // Optionally display error to user, though redirect should happen quickly
        }
    });
}

// --- Firestore User Data Loading and UI Update ---
async function loadUserData(uid) {
    if (!uid) {
        console.warn("loadUserData called without a UID.");
        return;
    }
    console.log("Attempting to load user data for UID:", uid);

    try {
        const userDocRef = doc(db, "users", uid); // Reference to the user's document
        const userDoc = await getDoc(userDocRef); // Fetch the document

        if (userDoc.exists()) {
            const userData = userDoc.data(); 
            console.log('Loaded user data from Firestore:', userData);

            // Update the greeting title on index.html
            const greetingTitle = document.getElementById('greeting-title');
            if (greetingTitle) {
                greetingTitle.textContent = `Hello, ${userData.Name || 'Player'}`;
            }

            // Update the available balance on index.html
            const balanceAmount = document.getElementById('current-balance-display');
            if (balanceAmount) {
                // Ensure balance is a number, default to 0.00 if missing or invalid
                const balance = typeof userData.Balance === 'number' ? userData.Balance : 0.00;
                balanceAmount.textContent = `Rs. ${balance.toFixed(2)}`;
            }

            // Store user data globally for other scripts (like script.js) to access easily
            window.currentUserData = {
                uid: uid,
                name: userData.Name || 'Player',
                balance: typeof userData.Balance === 'number' ? userData.Balance : 0.00
            };
            console.log("window.currentUserData set:", window.currentUserData);

            // Update the user's last login time in Firestore
            await updateDoc(userDocRef, {
                "Login time": Timestamp.now()
            });
            console.log("User login time updated in Firestore.");

        } else {
            console.warn("User document does not exist for UID:", uid, ". Creating a default one.");
            // This might happen if user authenticates but doc creation failed or was skipped.
            // Create a default one here to prevent further errors.
            await setDoc(doc(db, "users", uid), {
                Name: auth.currentUser.email.split('@')[0], // Use part of email as default name
                Balance: 0.00, // Set initial balance to 0
                "Login time": Timestamp.now() // Record signup time
            });
            // After creating, try loading again or just set currentUserData
            const defaultUserData = {
                uid: uid,
                name: auth.currentUser.email.split('@')[0],
                balance: 0.00
            };
            window.currentUserData = defaultUserData;
            console.log("Default user data created and set:", defaultUserData);
            // Re-call loadUserData to update UI if necessary
            await loadUserData(uid); // Make sure to await this recursive call
        }
    } catch (error) {
        console.error('Error loading user data from Firestore:', error);
    }
}

// --- Helper function to get user-friendly Firebase Auth error messages ---
function getAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/user-disabled':
            return 'This user account has been disabled.';
        case 'auth/user-not-found': // For login
            return 'No user found with this email. Please sign up.';
        case 'auth/wrong-password': // For login
            return 'Incorrect password.';
        case 'auth/email-already-in-use': // For signup
            return 'This email is already registered. Try logging in.';
        case 'auth/weak-password': // For signup
            return 'Password is too weak. Must be at least 6 characters.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        case 'auth/invalid-credential': // Generic failure for incorrect password or non-existent user
            return 'Invalid email or password.';
        default:
            return 'An unknown authentication error occurred. Please try again.';
    }
}

// Export functions if other scripts need to interact directly (e.g., to re-load user data)
export { loadUserData }; 