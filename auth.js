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

// --- Universal App/Loading Elements ---
const loadingSpinner = document.getElementById('loadingSpinner');
const appContent = document.getElementById('app');

// Helper to hide loading spinner and show app content
function hideLoadingSpinner() {
    if (loadingSpinner) {
        loadingSpinner.classList.add('hidden');
    }
}
function showAppContent() {
    if (appContent) {
        appContent.classList.remove('hidden');
        appContent.classList.add('revealed'); // For CSS transition
    }
}


// --- Login Page Specific Elements (conditionally selected) ---
let loginCard, nameGroup, nameInput, emailInput, passwordInput, mainAuthBtn, toggleAuthBtn, toggleText, authError;
let passwordToggle; // NEW: For the eye icon
// Check if on login.html by checking for unique login page elements
const isOnLoginPage = window.location.pathname.includes('login.html');

if (isOnLoginPage) {
    loginCard = document.querySelector('.login-card'); 
    nameGroup = document.getElementById('nameGroup');
    nameInput = document.getElementById('name');
    emailInput = document.getElementById('email');
    passwordInput = document.getElementById('password');
    mainAuthBtn = document.getElementById('mainAuthBtn');
    toggleAuthBtn = document.getElementById('toggleAuthBtn');
    toggleText = document.getElementById('toggleText');
    authError = document.getElementById('authError');
    passwordToggle = document.getElementById('passwordToggle'); // NEW: Get the toggle icon
}

let isLoginMode = true; // State variable for login.html form

// --- Global elements for Protected Pages ---
const logoutBtn = document.getElementById('logoutBtn'); 

// --- Functions to toggle UI on login.html (if applicable) ---
function setLoginMode(isLogin) {
    isLoginMode = isLogin;
    if (loginCard && nameGroup && mainAuthBtn && toggleText && toggleAuthBtn) { 
        loginCard.dataset.authMode = isLogin ? 'login' : 'signup'; // Update data-attribute for CSS

        if (!isLogin) {
            nameInput.setAttribute('required', 'true'); // Name required for signup
        } else {
            nameInput.removeAttribute('required'); // Name not required for login
            nameInput.value = ''; // Clear name field when switching to login
        }

        mainAuthBtn.textContent = isLogin ? 'Login' : 'Sign Up';
        toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
        toggleAuthBtn.textContent = isLogin ? 'Sign Up' : 'Login';
        authError.textContent = ''; // Clear any previous errors on mode change
        console.log("Auth form UI updated to " + (isLogin ? "Login" : "Sign Up") + " mode.");
    }
}

// --- Firebase Authentication State Listener ---
onAuthStateChanged(auth, async (user) => {
    console.log('onAuthStateChanged triggered. User:', user ? user.uid : 'null');

    if (user) {
        // User is signed in.
        if (isOnLoginPage) {
            console.log('User logged in, redirecting from login.html to index.html');
            window.location.href = 'index.html';
            return; 
        }

        if (window.location.pathname.includes('index.html') || window.location.pathname.includes('add-cash.html') || window.location.pathname.includes('announcement.html')) {
            await loadUserData(user.uid); 
            showAppContent(); 
            hideLoadingSpinner(); 
        }
    } else {
        // User is signed out.
        console.log('User is signed out.');
        
        if (isOnLoginPage) {
            setLoginMode(true); 
            showAppContent(); 
            hideLoadingSpinner(); 
        } else {
            console.log('User logged out, redirecting to login.html');
            window.location.href = 'login.html';
        }
        window.currentUserData = null; // Clear global user data
    }
});

// --- Login Page Form Handlers (for login.html) ---
if (isOnLoginPage && loginCard) {
    console.log("Login form elements found, attaching listeners.");

    document.getElementById('authForm').addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        authError.textContent = ''; 
        
        const email = emailInput.value.trim(); 
        const password = passwordInput.value;
        const name = nameInput.value.trim(); 

        if (!email || !password) { authError.textContent = 'Please enter email and password.'; return; }
        if (password.length < 6) { authError.textContent = 'Password should be at least 6 characters.'; return; }
        if (!isLoginMode && !name) { authError.textContent = 'Please enter your name for signup.'; return; }

        mainAuthBtn.disabled = true;
        mainAuthBtn.textContent = isLoginMode ? 'Logging In...' : 'Signing Up...';

        try {
            if (isLoginMode) {
                console.log('Attempting LOGIN with email:', email);
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                console.log('Attempting SIGN UP with email:', email, 'name:', name);
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                await setDoc(doc(db, "users", user.uid), {
                    Name: name || email.split('@')[0], 
                    Balance: 0.00,
                    "Login time": Timestamp.now(),
                    playedGames: {}
                });
                console.log("New user data initialized in Firestore for UID:", user.uid);
            }
        } catch (error) {
            console.error('Authentication error:', error.code, error.message);
            authError.textContent = 'Auth failed: ' + getAuthErrorMessage(error.code);
        } finally {
            mainAuthBtn.disabled = false;
            setLoginMode(isLoginMode); // Reset button text based on current mode
        }
    });

    toggleAuthBtn.addEventListener('click', () => {
        setLoginMode(!isLoginMode); // Toggle mode
        console.log("Auth mode toggled to:", isLoginMode ? 'Login' : 'Signup');
    });
    
    // NEW: Password toggle functionality
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Toggle the eye icon classes
            passwordToggle.querySelector('i').classList.toggle('fa-eye');
            passwordToggle.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
}

// --- Logout functionality (for index.html and other protected pages) ---
if (logoutBtn) { 
    console.log("Logout button found, attaching listener.");
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth); 
            console.log('User logged out successfully!');
        } catch (error) {
            console.error('Logout error:', error.code, error.message);
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
        const userDocRef = doc(db, "users", uid); 
        const userDoc = await getDoc(userDocRef); 

        if (userDoc.exists()) {
            const userData = userDoc.data(); 
            console.log('Loaded user data from Firestore:', userData);

            const greetingTitle = document.getElementById('greeting-title');
            if (greetingTitle) {
                greetingTitle.textContent = `Hello, ${userData.Name || 'Player'}`; 
            }

            const balanceAmount = document.getElementById('current-balance-display');
            if (balanceAmount) {
                const balance = typeof userData.Balance === 'number' ? userData.Balance : 0.00;
                balanceAmount.textContent = `Rs. ${balance.toFixed(2)}`;
            }

            window.currentUserData = {
                uid: uid,
                name: userData.Name || 'Player',
                balance: typeof userData.Balance === 'number' ? userData.Balance : 0.00,
                playedGames: userData.playedGames || {} 
            };
            console.log("window.currentUserData set:", window.currentUserData);

            await updateDoc(userDocRef, {
                "Login time": Timestamp.now()
            });
            console.log("User login time updated in Firestore.");

            if (window.location.pathname.includes('index.html')) {
                updateGameButtonStates(window.currentUserData.playedGames);
            }

        } else {
            console.warn("User document does not exist for UID:", uid, ". Creating a default one.");
            await setDoc(doc(db, "users", uid), {
                Name: auth.currentUser.email ? auth.currentUser.email.split('@')[0] : 'Player', 
                Balance: 0.00, 
                "Login time": Timestamp.now(), 
                playedGames: {} 
            });
            await loadUserData(uid); 
        }
    } catch (error) {
        console.error('Error loading user data from Firestore:', error);
        await signOut(auth);
    }
}

// --- Function to update game button UI state ---
function updateGameButtonStates(playedGames) {
    console.log("Updating game button states based on:", playedGames);
    document.querySelectorAll('.game-action-btn').forEach(button => {
        const gameId = button.dataset.gameId; 
        if (gameId && playedGames[gameId]) {
            button.textContent = 'Played';
            button.classList.remove('play-now-btn');
            button.classList.add('played-btn');
            button.disabled = true; 
        } else {
            button.textContent = 'Play Now';
            button.classList.remove('played-btn');
            button.classList.add('play-now-btn');
            button.disabled = false; 
        }
    });
}

// --- Helper function for Firebase Auth error messages ---
function getAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email': return 'Invalid email address format.';
        case 'auth/user-disabled': return 'This user account has been disabled.';
        case 'auth/user-not-found': return 'No user found with this email. Please sign up.';
        case 'auth/wrong-password': return 'Incorrect password.';
        case 'auth/email-already-in-use': return 'This email is already registered. Try logging in.';
        case 'auth/weak-password': return 'Password is too weak. Must be at least 6 characters.';
        case 'auth/network-request-failed': return 'Network error. Please check your internet connection.';
        case 'auth/invalid-credential': return 'Invalid email or password.';
        default: return 'An unknown authentication error occurred. Please try again.';
    }
}

// Export functions that are used by other modules
export { loadUserData, updateGameButtonStates };