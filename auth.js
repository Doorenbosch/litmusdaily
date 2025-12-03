/**
 * The Litmus - Authentication Module
 * Firebase Auth with Google and Apple Sign-in
 * 
 * User data stored in Firestore:
 * - /users/{uid}/preferences (coin selections, etc.)
 * - /users/{uid}/profile (display name, avatar)
 */

// Firebase Configuration
// TODO: Replace with your Firebase project config from Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "litmusdaily.firebaseapp.com",
    projectId: "litmusdaily",
    storageBucket: "litmusdaily.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Check if Firebase is configured
const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

// Initialize Firebase
let app, auth, db;
let currentUser = null;

function initFirebase() {
    // Don't initialize if not configured
    if (!isFirebaseConfigured) {
        console.log('[Auth] Firebase not configured - sign-in disabled');
        hideSignInButton();
        return;
    }
    
    try {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Listen for auth state changes
        auth.onAuthStateChanged(handleAuthStateChanged);
        
        console.log('[Auth] Firebase initialized');
    } catch (error) {
        console.error('[Auth] Firebase init error:', error);
        hideSignInButton();
    }
}

// Hide sign-in button when Firebase isn't ready
function hideSignInButton() {
    const signinBtn = document.getElementById('signin-btn');
    if (signinBtn) {
        signinBtn.style.display = 'none';
    }
}

// Handle auth state changes
async function handleAuthStateChanged(user) {
    currentUser = user;
    
    const signedOutEl = document.getElementById('auth-signed-out');
    const signedInEl = document.getElementById('auth-signed-in');
    const userAvatarEl = document.getElementById('user-avatar');
    const userNameEl = document.getElementById('user-name');
    
    if (user) {
        // User is signed in
        console.log('[Auth] User signed in:', user.displayName);
        
        // Update UI
        if (signedOutEl) signedOutEl.classList.add('auth-hidden');
        if (signedInEl) signedInEl.classList.remove('auth-hidden');
        
        // Set user info
        if (userAvatarEl) {
            userAvatarEl.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User');
        }
        if (userNameEl) {
            userNameEl.textContent = user.displayName?.split(' ')[0] || 'User';
        }
        
        // Load user preferences from Firestore
        await loadUserPreferences();
        
        // Close sign-in modal if open
        closeSignInModal();
        
    } else {
        // User is signed out
        console.log('[Auth] User signed out');
        
        // Update UI
        if (signedOutEl) signedOutEl.classList.remove('auth-hidden');
        if (signedInEl) signedInEl.classList.add('auth-hidden');
        
        // Clear user data
        clearUserPreferences();
    }
}

// Google Sign-In
async function signInWithGoogle() {
    if (!isFirebaseConfigured) {
        console.log('[Auth] Firebase not configured');
        return;
    }
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        const result = await auth.signInWithPopup(provider);
        console.log('[Auth] Google sign-in successful');
        
        // Track sign-in in GA4
        if (window.trackEvent) {
            window.trackEvent('sign_in', { method: 'google' });
        }
        
        // Create/update user document
        await createUserDocument(result.user);
        
    } catch (error) {
        console.error('[Auth] Google sign-in error:', error);
        
        // Track error
        if (window.trackEvent) {
            window.trackEvent('sign_in_error', { method: 'google', error: error.code });
        }
        
        showAuthError(error.message);
    }
}

// Apple Sign-In
async function signInWithApple() {
    if (!isFirebaseConfigured) {
        console.log('[Auth] Firebase not configured');
        return;
    }
    
    try {
        const provider = new firebase.auth.OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        
        const result = await auth.signInWithPopup(provider);
        console.log('[Auth] Apple sign-in successful');
        
        // Track sign-in in GA4
        if (window.trackEvent) {
            window.trackEvent('sign_in', { method: 'apple' });
        }
        
        // Create/update user document
        await createUserDocument(result.user);
        
    } catch (error) {
        console.error('[Auth] Apple sign-in error:', error);
        
        // Track error
        if (window.trackEvent) {
            window.trackEvent('sign_in_error', { method: 'apple', error: error.code });
        }
        
        showAuthError(error.message);
    }
}

// Sign Out
async function signOut() {
    try {
        await auth.signOut();
        console.log('[Auth] Sign out successful');
        
        // Track sign-out in GA4
        if (window.trackEvent) {
            window.trackEvent('sign_out');
        }
    } catch (error) {
        console.error('[Auth] Sign out error:', error);
    }
}

// Create or update user document in Firestore
async function createUserDocument(user) {
    if (!user || !db) return;
    
    const userRef = db.collection('users').doc(user.uid);
    
    try {
        const doc = await userRef.get();
        
        if (!doc.exists) {
            // New user - create document with defaults
            await userRef.set({
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                preferences: {
                    selectedCoins: ['bitcoin', 'ethereum'],
                    defaultRegion: 'americas'
                }
            });
            console.log('[Auth] Created new user document');
        } else {
            // Existing user - update last login
            await userRef.update({
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('[Auth] Error creating user document:', error);
    }
}

// Load user preferences from Firestore
async function loadUserPreferences() {
    if (!currentUser || !db) return;
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const doc = await userRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            const prefs = data.preferences || {};
            
            // Apply preferences
            if (prefs.selectedCoins) {
                localStorage.setItem('litmus_selected_coins', JSON.stringify(prefs.selectedCoins));
                // Trigger reload of coins display
                if (typeof loadYourCoins === 'function') {
                    loadYourCoins();
                }
            }
            
            if (prefs.defaultRegion && typeof setRegion === 'function') {
                setRegion(prefs.defaultRegion);
            }
            
            console.log('[Auth] Loaded user preferences');
        }
    } catch (error) {
        console.error('[Auth] Error loading preferences:', error);
    }
}

// Save user preferences to Firestore
async function saveUserPreferences(prefs) {
    if (!currentUser || !db) {
        // Not signed in - save to localStorage only
        console.log('[Auth] Not signed in, saving to localStorage only');
        return false;
    }
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        await userRef.update({
            preferences: prefs,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('[Auth] Saved user preferences to Firestore');
        return true;
    } catch (error) {
        console.error('[Auth] Error saving preferences:', error);
        return false;
    }
}

// Clear user preferences (on sign out)
function clearUserPreferences() {
    // Keep localStorage for anonymous usage, just mark as not synced
    console.log('[Auth] Cleared synced preferences');
}

// Show auth error
function showAuthError(message) {
    // Could show a toast or modal with error
    console.error('[Auth] Error:', message);
    alert('Sign in error: ' + message);
}

// Modal controls
function openSignInModal() {
    const modal = document.getElementById('signin-modal');
    if (modal) modal.classList.add('active');
}

function closeSignInModal() {
    const modal = document.getElementById('signin-modal');
    if (modal) modal.classList.remove('active');
}

// Initialize auth UI listeners
function initAuthUI() {
    // Sign in button
    const signInBtn = document.getElementById('signin-btn');
    if (signInBtn) {
        signInBtn.addEventListener('click', openSignInModal);
    }
    
    // Sign in modal close
    const signInModalClose = document.getElementById('signin-modal-close');
    if (signInModalClose) {
        signInModalClose.addEventListener('click', closeSignInModal);
    }
    
    // Close modal on overlay click
    const signInModal = document.getElementById('signin-modal');
    if (signInModal) {
        signInModal.addEventListener('click', (e) => {
            if (e.target === signInModal) closeSignInModal();
        });
    }
    
    // Google sign in
    const googleBtn = document.getElementById('google-signin');
    if (googleBtn) {
        googleBtn.addEventListener('click', signInWithGoogle);
    }
    
    // Apple sign in
    const appleBtn = document.getElementById('apple-signin');
    if (appleBtn) {
        appleBtn.addEventListener('click', signInWithApple);
    }
    
    // User menu toggle
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', () => {
            userDropdown.classList.toggle('open');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('open');
            }
        });
    }
    
    // Sign out
    const signOutBtn = document.getElementById('signout-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            signOut();
            if (userDropdown) userDropdown.classList.remove('open');
        });
    }
    
    console.log('[Auth] UI initialized');
}

// Check if user is signed in
function isSignedIn() {
    return currentUser !== null;
}

// Get current user
function getCurrentUser() {
    return currentUser;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    initAuthUI();
});

// Export functions for use in app.js
window.LitmusAuth = {
    isSignedIn,
    getCurrentUser,
    saveUserPreferences,
    loadUserPreferences,
    openSignInModal,
    signOut
};
