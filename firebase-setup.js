import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  updateProfile,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNOxJGgic010Z1Jnlw6JBE6R9FyHgbvl4",
  authDomain: "muralglobal.firebaseapp.com",
  projectId: "muralglobal",
  storageBucket: "muralglobal.firebasestorage.app",
  messagingSenderId: "335201502624",
  appId: "1:335201502624:web:39f13acaa8696da89a50c5",
  measurementId: "G-1FF5FBMT9P",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export {
  db,
  analytics,
  auth,
  provider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  updateProfile,
  sendPasswordResetEmail,
  arrayUnion,
  arrayRemove,
};
