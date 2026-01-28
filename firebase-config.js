// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCNOxJGgic010Z1Jnlw6JBE6R9FyHgbvl4",
  authDomain: "muralglobal.firebaseapp.com",
  projectId: "muralglobal",
  storageBucket: "muralglobal.firebasestorage.app",
  messagingSenderId: "335201502624",
  appId: "1:335201502624:web:39f13acaa8696da89a50c5",
  measurementId: "G-1FF5FBMT9P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);