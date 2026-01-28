import {
  auth,
  onAuthStateChanged,
  updateProfile,
  signOut,
} from "../../js/firebase-setup.js";
import { showToast, showConfirm } from "../../js/ui.js";

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // window.location.href = "login.html"; // Removed immediate redirect to prevent flash if auth is just slow
    return;
  }
  currentUser = user;

  document.getElementById("profile-email-display").innerText =
    user.email || "Anonymous Guest";
  document.getElementById("profile-uid").innerText = user.uid;
  document.getElementById("profile-name").value = user.displayName || "";
});

document.getElementById("btn-save-profile").onclick = async () => {
  const newName = document.getElementById("profile-name").value;
  const btn = document.getElementById("btn-save-profile");

  if (currentUser && newName) {
    try {
      btn.innerText = "UPDATING...";
      await updateProfile(currentUser, { displayName: newName });
      showToast("Profile Updated Successfully", "success");
    } catch (e) {
      showToast("Error: " + e.message, "error");
    } finally {
      btn.innerText = "UPDATE DATA";
    }
  }
};

document.getElementById("btn-logout").onclick = async () => {
  await signOut(auth);
};

document.getElementById("btn-delete-account").onclick = async () => {
  showConfirm(
    "WARNING: This will permanently delete your account and cannot be undone. Proceed?",
    async () => {
      await currentUser.delete();
      window.location.href = "login.html";
    }
  );
};
