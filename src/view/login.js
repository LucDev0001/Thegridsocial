import {
  auth,
  provider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "../../js/firebase-setup.js";

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "../../index.html";
  }
});

// UI Tabs
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const errorMsg = document.getElementById("error-msg");

function showError(msg) {
  errorMsg.innerText = `ERROR: ${msg}`;
  errorMsg.classList.remove("hidden");
  setTimeout(() => errorMsg.classList.add("hidden"), 5000);
}

tabLogin.onclick = () => {
  tabLogin.classList.add("text-cyan-400", "border-b-2", "border-cyan-400");
  tabLogin.classList.remove("text-gray-500");
  tabRegister.classList.remove(
    "text-cyan-400",
    "border-b-2",
    "border-cyan-400"
  );
  tabRegister.classList.add("text-gray-500");

  formLogin.classList.remove("hidden");
  formRegister.classList.add("hidden");
};

tabRegister.onclick = () => {
  tabRegister.classList.add("text-cyan-400", "border-b-2", "border-cyan-400");
  tabRegister.classList.remove("text-gray-500");
  tabLogin.classList.remove("text-cyan-400", "border-b-2", "border-cyan-400");
  tabLogin.classList.add("text-gray-500");

  formRegister.classList.remove("hidden");
  formLogin.classList.add("hidden");
};

// Login Logic
document.getElementById("btn-login-email").onclick = async () => {
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-pass").value;

  if (!email || !pass) return showError("Credentials required.");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // Redirect handled by onAuthStateChanged
  } catch (e) {
    showError(e.message);
  }
};

// Forgot Password Logic
const modalForgot = document.getElementById("modal-forgot");
const btnForgot = document.getElementById("btn-forgot-pass");
const btnCloseForgot = document.getElementById("btn-close-forgot");
const btnSendReset = document.getElementById("btn-send-reset");
const forgotMsg = document.getElementById("forgot-msg");

btnForgot.onclick = () => modalForgot.classList.remove("hidden");
btnCloseForgot.onclick = () => modalForgot.classList.add("hidden");

btnSendReset.onclick = async () => {
  const email = document.getElementById("forgot-email").value;
  if (!email) {
    forgotMsg.innerText = "Please enter email.";
    forgotMsg.className = "mt-2 text-center text-xs font-mono text-red-500";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    forgotMsg.innerText = "Reset link sent! Check your inbox.";
    forgotMsg.className = "mt-2 text-center text-xs font-mono text-green-500";
  } catch (e) {
    forgotMsg.innerText = e.message;
    forgotMsg.className = "mt-2 text-center text-xs font-mono text-red-500";
  }
};

// Register Logic
document.getElementById("btn-register-submit").onclick = async () => {
  const email = document.getElementById("reg-email").value;
  const pass = document.getElementById("reg-pass").value;
  const dobVal = document.getElementById("reg-dob").value;

  if (!email || !pass || !dobVal) return showError("All fields required.");

  // Age Check
  const dob = new Date(dobVal);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  if (age < 13) {
    return showError("Access Denied: Minimum age 13 required.");
  }

  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    // Redirect handled by onAuthStateChanged
  } catch (e) {
    showError(e.message);
  }
};

// Google Login
document.getElementById("btn-google").onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    showError(e.message);
  }
};

// Guest Login
document.getElementById("btn-guest").onclick = async () => {
  try {
    await signInAnonymously(auth);
  } catch (e) {
    showError(e.message);
  }
};
