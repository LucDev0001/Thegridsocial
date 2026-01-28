export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return; // Fail gracefully if container not present
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    toast.style.transition = "all 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function showConfirm(message, onConfirm) {
  const modal = document.getElementById("custom-confirm");
  if (!modal) {
    // Fallback for pages without the modal
    if (confirm(message)) {
      onConfirm();
    }
    return;
  }
  const msgEl = document.getElementById("confirm-msg");
  const btnOk = document.getElementById("btn-confirm-ok");
  const btnCancel = document.getElementById("btn-confirm-cancel");

  msgEl.innerText = message;
  modal.classList.remove("hidden");

  const close = () => {
    modal.classList.add("hidden");
    btnOk.onclick = null;
    btnCancel.onclick = null;
  };

  btnOk.onclick = () => {
    onConfirm();
    close();
  };

  btnCancel.onclick = close;
}
