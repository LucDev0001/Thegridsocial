import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  getDocs,
  startAfter,
  getDoc,
  where,
  writeBatch,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  db,
  auth,
  provider,
  onAuthStateChanged,
  signInAnonymously,
  updateProfile,
  arrayUnion,
  arrayRemove,
} from "./firebase-setup.js";
import { map } from "./map-setup.js";
import { showToast, showConfirm } from "./ui.js";
import { fakeMsgs, baseStats, langToFlag, containsProfanity } from "./utils.js";
import { translations, applyLanguage } from "./i18n.js";

// --- FIREBASE: Ler Mensagens ---
let unsubscribe;
let markersData = []; // Armazena coordenadas para conectar os pontos
let markersMap = {}; // Armazena referências aos marcadores por ID
let currentLines = []; // Armazena as linhas desenhadas
let searchIndex = []; // Índice para busca local
let radarLayer = null; // Camada do efeito radar
let motdData = null; // Dados da mensagem do dia
let clanStats = {}; // Estatísticas dos clãs
let clanChatUnsubscribe = null; // Listener do chat
let lastFeedDoc = null; // Paginação do feed
let currentUser = null; // Usuário logado
let notificationsUnsubscribe = null; // Listener de notificações
let feedUnsubscribe = null; // Listener do Feed em tempo real

function clearMap() {
  // Remove marcadores
  Object.values(markersMap).forEach((marker) => map.removeLayer(marker));
  markersMap = {};
  markersData = [];

  // Remove linhas
  currentLines.forEach((line) => map.removeLayer(line));
  currentLines = [];
  searchIndex = []; // Limpa índice de busca
  if (radarLayer) map.removeLayer(radarLayer);
}

// --- EASTER EGG: HIDDEN MARKER ---
// Bermuda Triangle approx
const eggMarker = L.circleMarker([25.0, -71.0], {
  radius: 30,
  color: "transparent",
  fillColor: "transparent",
  fillOpacity: 0,
  interactive: true,
}).addTo(map);

eggMarker.on("click", () => {
  showToast(
    "⚠️ SYSTEM ANOMALY DETECTED ⚠️\n\nCOORDINATES: 25.0, -71.0\nENCRYPTED SIGNAL FOUND.\n\nACCESS CODE REQUIRED IN SEARCH BAR: 'THE_ARCHITECT'",
  );
});

function loadMessages(sortBy = "timestamp") {
  if (unsubscribe) unsubscribe();
  clearMap();

  // Render Fake Messages (Client-Side)
  renderFakeMarkers();

  const msgsRef = collection(db, "world_messages");
  const q = query(msgsRef, orderBy(sortBy, "desc"), limit(200));

  unsubscribe = onSnapshot(q, (snapshot) => {
    // Total = Real + Fake
    const totalCount = snapshot.size + fakeMsgs.length;
    document.getElementById("total-msgs").innerText = totalCount;
    document.getElementById("welcome-total-msgs").innerText = totalCount; // Update modal stats
    updateCountryStats(snapshot);
    updateMotD(snapshot); // Update Message of the Day
    updateClanStats(snapshot); // Update Clan Stats

    // Hide Loading Screen
    const loader = document.getElementById("loading-screen");
    if (loader) {
      loader.classList.add("opacity-0", "pointer-events-none");
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();

        // --- FIX: WIPE SYSTEM (Ignora mensagens com mais de 24h) ---
        const oneDayAgo = Date.now() / 1000 - 86400;
        if (data.timestamp && data.timestamp.seconds < oneDayAgo) return;
        // -----------------------------------------------------------

        if (data.lat && data.lng) {
          const currentLatLng = new L.LatLng(data.lat, data.lng);

          // New Like/Dislike Logic
          const likedBy = data.likedBy || [];
          const dislikedBy = data.dislikedBy || [];
          const likeCount = likedBy.length;
          const dislikeCount = dislikedBy.length;
          const specialTitle = data.specialTitle;

          // --- GAMIFICATION: LEVEL SYSTEM ---
          let markerClass = "marker-pin"; // Level 1 (Cyan)
          let lineColor = "#06b6d4";
          let rankTitle = "";

          if (likeCount >= 50) {
            markerClass = "marker-pin-gold"; // Level 3 (Gold)
            lineColor = "#eab308";
            rankTitle =
              "<span style='color:#eab308; font-size:10px; border:1px solid #eab308; padding:1px 3px; border-radius:3px; margin-left:5px;'>[ LEGEND ]</span>";
          } else if (likeCount >= 10) {
            markerClass = "marker-pin-purple"; // Level 2 (Purple)
            lineColor = "#a855f7";
            rankTitle =
              "<span style='color:#a855f7; font-size:10px; border:1px solid #a855f7; padding:1px 3px; border-radius:3px; margin-left:5px;'>[ VETERAN ]</span>";
          }
          // ----------------------------------

          if (specialTitle === "HACKER") {
            rankTitle =
              "<span style='color:#10b981; font-size:10px; border:1px solid #10b981; padding:1px 3px; border-radius:3px; margin-left:5px; background:#000;'>[ HACKER ]</span>";
            lineColor = "#10b981";
          }

          // --- NEURAL NETWORK LINES (Conecta aos 3 pontos mais próximos) ---
          const neighbors = markersData
            .map((pt) => ({ pt, dist: currentLatLng.distanceTo(pt) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3);

          neighbors.forEach((n) => {
            const line = L.polyline([currentLatLng, n.pt], {
              color: lineColor, // Match marker color
              weight: 1.5,
              opacity: 0.6,
              className: "neural-line", // Classe para animação CSS
              interactive: false,
            }).addTo(map);
          });
          // currentLines.push(line); // (Opcional: guardar ref se precisar limpar individualmente)

          markersData.push(currentLatLng);
          // -------------------------------------------------------------

          // Marcador Customizado (Ponto de Luz)
          const techIcon = L.divIcon({
            className: "custom-div-icon",
            html: `<div class='${markerClass}'></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });

          const marker = L.marker(currentLatLng, {
            icon: techIcon,
          }).addTo(map);

          markersMap[change.doc.id] = marker;

          // Add to Search Index
          searchIndex.push({
            id: change.doc.id,
            name: data.name,
            text: data.text,
            lat: data.lat,
            lng: data.lng,
            timestamp: data.timestamp,
            likes: likeCount,
          });

          const safeName = data.name.replace(/</g, "&lt;");
          const safeText = data.text.replace(/</g, "&lt;");

          const safeNameEscaped = safeName
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'")
            .replace(/\n/g, "\\n")
            .replace(/"/g, "&quot;");
          const safeTextEscaped = safeText
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'")
            .replace(/\n/g, "\\n")
            .replace(/"/g, "&quot;");

          // Determine colors based on user action (requires currentUser, handled in click but visual here is generic or needs update on auth)
          // For simplicity in popup string, we use generic colors, but could be dynamic if we rebuild popup on auth change.
          const likeColor =
            currentUser && likedBy.includes(currentUser.uid)
              ? "#22c55e"
              : "#64748b";
          const dislikeColor =
            currentUser && dislikedBy.includes(currentUser.uid)
              ? "#ef4444"
              : "#64748b";

          const authorName = data.name || "Anonymous";
          const authorUid = data.uid || null;
          let nameHtml = `<strong style="color: ${lineColor}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">${authorName.replace(
            /</g,
            "&lt;",
          )}</strong>`;
          if (authorUid && currentUser && authorUid !== currentUser.uid) {
            const safeAuthorName = authorName
              .replace(/'/g, "\\'")
              .replace(/"/g, "&quot;");
            nameHtml = `<button onclick="window.openPublicProfile('${authorUid}', '${safeAuthorName}')" style="background:none; border:none; padding:0; text-align:left; cursor:pointer;" class="hover:underline">${nameHtml}</button>`;
          }

          const replyCount = data.replyCount || 0;

          marker.bindPopup(`
                      <div style="font-family: 'Rajdhani', sans-serif; min-width: 200px;">
                          ${nameHtml}${rankTitle}
                          <p style="margin: 6px 0; font-size: 14px; color: #e0f2fe;">"${safeText}"</p>
                          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                              <button onclick="openThread('${change.doc.id}')" style="font-size: 10px; color: #06b6d4; background:none; border:1px solid #06b6d4; padding: 2px 6px; cursor:pointer;">REPLY (${replyCount})</button>
                              <div style="display: flex; align-items: center; gap: 5px;">
                                  <button onclick="handleReaction('${change.doc.id}', 'like')" style="background: none; border: none; cursor: pointer; color: ${likeColor}; font-size: 14px; padding: 0 2px;">👍 <span id="likes-${change.doc.id}">${likeCount}</span></button>
                                  <button onclick="handleReaction('${change.doc.id}', 'dislike')" style="background: none; border: none; cursor: pointer; color: ${dislikeColor}; font-size: 14px; padding: 0 2px;">👎 <span id="dislikes-${change.doc.id}">${dislikeCount}</span></button>
                                  <button onclick="prepareDownload('${safeNameEscaped}', '${safeTextEscaped}', ${data.lat}, ${data.lng})" style="background: none; border: none; cursor: pointer; color: #06b6d4; font-size: 16px; padding: 0; margin-left: 5px;" title="Download Image">📸</button>
                              </div>
                          </div>
                      </div>
                  `);
        }
      } else if (change.type === "modified") {
        // Atualiza o contador em tempo real se alguém curtir
        const data = change.doc.data();
        const marker = markersMap[change.doc.id];
        if (marker) {
          const likedBy = data.likedBy || [];
          const dislikedBy = data.dislikedBy || [];
          const likeCount = likedBy.length;
          const dislikeCount = dislikedBy.length;

          // Atualiza o número no DOM se o popup estiver aberto
          const likeSpan = document.getElementById(`likes-${change.doc.id}`);
          if (likeSpan) likeSpan.innerText = likeCount;
          const dislikeSpan = document.getElementById(
            `dislikes-${change.doc.id}`,
          );
          if (dislikeSpan) dislikeSpan.innerText = dislikeCount;

          // Atualiza o conteúdo interno do popup para a próxima vez que abrir
          const popup = marker.getPopup();
          if (popup) {
            const likeColor =
              currentUser && likedBy.includes(currentUser.uid)
                ? "#22c55e"
                : "#64748b";
            const dislikeColor =
              currentUser && dislikedBy.includes(currentUser.uid)
                ? "#ef4444"
                : "#64748b";

            const buttonsRegex =
              /<button onclick="handleReaction\('[^']+', 'like'\)".*?<\/button>\s*<button onclick="handleReaction\('[^']+', 'dislike'\)".*?<\/button>/s;
            const newButtonsHTML = `<button onclick="handleReaction('${change.doc.id}', 'like')" style="background: none; border: none; cursor: pointer; color: ${likeColor}; font-size: 14px; padding: 0 2px;">👍 <span id="likes-${change.doc.id}">${likeCount}</span></button>\n<button onclick="handleReaction('${change.doc.id}', 'dislike')" style="background: none; border: none; cursor: pointer; color: ${dislikeColor}; font-size: 14px; padding: 0 2px;">👎 <span id="dislikes-${change.doc.id}">${dislikeCount}</span></button>`;

            let currentContent = popup.getContent();
            if (currentContent.match(buttonsRegex)) {
              const newContent = currentContent.replace(
                buttonsRegex,
                newButtonsHTML,
              );
              marker.setPopupContent(newContent);
            }
          }

          // Atualiza contagem de respostas se houver
          const replyCount = data.replyCount || 0;
          // (Simplificação: o botão de reply já tem o onclick, apenas o texto mudaria, mas para Spark plan não vamos ouvir replies em tempo real no mapa global para economizar, apenas likes)
        }
      } else if (change.type === "removed") {
        // --- FIX: REAL-TIME REMOVAL ---
        const marker = markersMap[change.doc.id];
        if (marker) {
          map.removeLayer(marker);
          delete markersMap[change.doc.id];

          // Remove do índice de busca também
          const idx = searchIndex.findIndex(
            (item) => item.id === change.doc.id,
          );
          if (idx > -1) searchIndex.splice(idx, 1);
        }
        // ------------------------------
      }
    });
  });
}

// Inicializa com Latest
loadMessages("timestamp");

// Função de troca de filtro
window.switchFilter = (type) => {
  const btnLatest = document.getElementById("filter-latest");
  const btnTop = document.getElementById("filter-top");

  if (type === "timestamp") {
    btnLatest.className =
      "px-3 py-1 text-xs font-bold bg-cyan-600 text-black rounded hover:bg-cyan-500 transition uppercase";
    btnTop.className =
      "px-3 py-1 text-xs font-bold text-cyan-400 hover:text-white transition uppercase";
  } else {
    btnTop.className =
      "px-3 py-1 text-xs font-bold bg-cyan-600 text-black rounded hover:bg-cyan-500 transition uppercase";
    btnLatest.className =
      "px-3 py-1 text-xs font-bold text-cyan-400 hover:text-white transition uppercase";
  }
  loadMessages(type);
};

function renderFakeMarkers() {
  fakeMsgs.forEach((msg, index) => {
    const id = `fake_${index}`;
    const currentLatLng = new L.LatLng(msg.lat, msg.lng);
    const likes = msg.likes;
    const specialTitle = msg.specialTitle; // Support for fake hackers

    // Level System
    let markerClass = "marker-pin";
    let lineColor = "#06b6d4";
    let rankTitle = "";

    if (likes >= 50) {
      markerClass = "marker-pin-gold";
      lineColor = "#eab308";
      rankTitle =
        "<span style='color:#eab308; font-size:10px; border:1px solid #eab308; padding:1px 3px; border-radius:3px; margin-left:5px;'>[ LEGEND ]</span>";
    } else if (likes >= 10) {
      markerClass = "marker-pin-purple";
      lineColor = "#a855f7";
      rankTitle =
        "<span style='color:#a855f7; font-size:10px; border:1px solid #a855f7; padding:1px 3px; border-radius:3px; margin-left:5px;'>[ VETERAN ]</span>";
    }

    if (specialTitle === "HACKER") {
      rankTitle =
        "<span style='color:#10b981; font-size:10px; border:1px solid #10b981; padding:1px 3px; border-radius:3px; margin-left:5px; background:#000;'>[ HACKER ]</span>";
      lineColor = "#10b981";
    }

    // Neural Lines
    const neighbors = markersData
      .map((pt) => ({ pt, dist: currentLatLng.distanceTo(pt) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    neighbors.forEach((n) => {
      const line = L.polyline([currentLatLng, n.pt], {
        color: lineColor,
        weight: 1.5,
        opacity: 0.6,
        className: "neural-line",
        interactive: false,
      }).addTo(map);
      currentLines.push(line);
    });

    markersData.push(currentLatLng);

    const techIcon = L.divIcon({
      className: "custom-div-icon",
      html: `<div class='${markerClass}'></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    const marker = L.marker(currentLatLng, { icon: techIcon }).addTo(map);
    markersMap[id] = marker;

    // Add to Search Index
    searchIndex.push({
      id,
      name: msg.name || "Anonymous Traveler",
      text: msg.t,
      lat: msg.lat,
      lng: msg.lng,
      timestamp: { seconds: Date.now() / 1000 - index * 3600 },
    }); // Fake timestamp for history

    const safeName = msg.name || "Anonymous Traveler";
    const safeText = msg.t;
    const safeNameEscaped = safeName
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/"/g, "&quot;");
    const safeTextEscaped = safeText
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/"/g, "&quot;");

    // Popup Content (Simplified for fake)
    marker.bindPopup(`
            <div style="font-family: 'Rajdhani', sans-serif; min-width: 200px;">
                <strong style="color: ${lineColor}; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">${safeName}</strong>${rankTitle}
                <p style="margin: 6px 0; font-size: 14px; color: #e0f2fe;">"${safeText}"</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <span style="font-size: 10px; color: #64748b; font-family: monospace;">COORDS: ${msg.lat.toFixed(
                      2,
                    )}, ${msg.lng.toFixed(2)}</span>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <button onclick="likeMessage('${id}')" style="background: none; border: none; cursor: pointer; color: #64748b; font-size: 16px; padding: 0; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">♥</button>
                        <button onclick="prepareDownload('${safeNameEscaped}', '${safeTextEscaped}', ${
                          msg.lat
                        }, ${
                          msg.lng
                        })" style="background: none; border: none; cursor: pointer; color: #06b6d4; font-size: 16px; padding: 0; margin-left: 5px;" title="Download Image">📸</button>
                        <span id="likes-${id}" style="font-size: 12px; color: #e0f2fe;">${likes}</span>
                    </div>
                </div>
            </div>
        `);
  });
}

function updateCountryStats(snapshot) {
  // Start with base stats (clone object)
  const counts = { ...baseStats };

  // Add real counts
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.lang) {
      const code = data.lang.split("-")[0];
      counts[code] = (counts[code] || 0) + 1;
    }
  });

  // Ordena e pega Top 5
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const html = sorted
    .map(([code, count]) => {
      const flag = langToFlag[code] || "🏳️";
      return `<div>${flag} ${code.toUpperCase()}: <span class="text-white">${count}</span></div>`;
    })
    .join("");

  document.getElementById("top-countries").innerHTML = html || "Calculating...";
}

// --- CLAN STATS ---
function updateClanStats(snapshot) {
  clanStats = {};

  // Helper to process a message
  const processMsg = (name, likes) => {
    if (!name) return;
    const match = name.match(/^\[([a-zA-Z0-9_-]+)\]/);
    if (match) {
      const tag = match[1].toUpperCase();
      if (!clanStats[tag]) clanStats[tag] = { likes: 0, members: 0 }; // Using likes as score
      clanStats[tag].likes += likes || 0;
      clanStats[tag].members += 1;
    }
  };

  // Process Real Messages
  snapshot.forEach((doc) => {
    const data = doc.data();
    const likes = data.likedBy ? data.likedBy.length : 0;
    processMsg(data.name, likes);
  });

  // Process Fake Messages
  fakeMsgs.forEach((msg) => {
    processMsg(msg.name, msg.likes);
  });
}

// --- MESSAGE OF THE DAY (MotD) ---
function updateMotD(snapshot) {
  const docs = [];
  snapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));

  // Combine with fake msgs for variety if db is empty
  const allMsgs = [...docs, ...fakeMsgs];
  if (allMsgs.length === 0) return;

  // Deterministic selection based on date
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  // Simple hash of date string to integer
  let hash = 0;
  for (let i = 0; i < today.length; i++)
    hash = today.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % allMsgs.length;

  motdData = allMsgs[index];

  const container = document.getElementById("motd-container");
  const content = document.getElementById("motd-content");

  content.innerText = `"${motdData.text || motdData.t}" - ${
    motdData.name || "Anonymous"
  }`;
  container.classList.remove("hidden");
}

window.locateMotD = () => {
  if (!motdData) return;
  const lat = motdData.lat;
  const lng = motdData.lng;

  map.flyTo([lat, lng], 10, { duration: 2 });

  // Try to find marker (might be fake or real)
  let marker = markersMap[motdData.id];
  // If it's a fake msg from the array, we need to find its ID.
  // Fake msgs in renderFakeMarkers use 'fake_INDEX'.
  if (!marker && !motdData.id) {
    // It's a raw fake msg object, find it in the map
    const fakeIdx = fakeMsgs.indexOf(motdData);
    if (fakeIdx > -1) marker = markersMap[`fake_${fakeIdx}`];
  }

  if (marker) {
    setTimeout(() => marker.openPopup(), 2200);
    showRadar(lat, lng);
  }
};

// --- AUTHENTICATION LOGIC ---
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const btnOpen = document.getElementById("btn-open-modal");

  if (user) {
    // Show Welcome Modal if first visit (Onboarding)
    const welcomeModal = document.getElementById("modal-welcome");
    if (welcomeModal && !localStorage.getItem("wmt_welcome_seen_v1")) {
      welcomeModal.classList.remove("hidden");
    }

    // Update UI for logged in
    btnOpen.innerHTML = '<span class="text-xl">⊕</span> POST SIGNAL';

    // Create user profile in 'users' collection if it doesn't exist
    const userRef = doc(db, "users", user.uid);
    setDoc(
      userRef,
      {
        displayName: user.displayName || user.email.split("@")[0],
        email: user.email,
      },
      { merge: true },
    );

    // Listen for user stats (followers, etc.)
    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const followersEl = document.getElementById("profile-followers");
        const followingEl = document.getElementById("profile-following");
        if (followersEl) followersEl.innerText = userData.followerCount || 0;
        if (followingEl) followingEl.innerText = userData.followingCount || 0;
      }
    });

    // Check if user has a message to enable edit mode
    const qMsg = query(
      collection(db, "world_messages"),
      where("uid", "==", user.uid),
      limit(1),
    );

    getDocs(qMsg).then((snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        localStorage.setItem("wmt_msg_id", docSnap.id);
        if (data.name) localStorage.setItem("wmt_name", data.name);
        checkClanButton();

        btnOpen.innerHTML = '<span class="text-xl">↻</span> UPDATE SIGNAL';

        const inputName = document.getElementById("input-name");
        const inputMsg = document.getElementById("input-msg");
        if (inputName) inputName.value = data.name || "";
        if (inputMsg) {
          inputMsg.value = data.text || "";
          document.getElementById("char-count").innerText =
            inputMsg.value.length;
        }
      } else {
        localStorage.removeItem("wmt_msg_id");
        btnOpen.innerHTML = '<span class="text-xl">⊕</span> POST SIGNAL';
      }
    });

    // --- NOTIFICATIONS LISTENER ---
    if (notificationsUnsubscribe) notificationsUnsubscribe();
    const notifQuery = query(
      collection(db, "notifications"),
      where("to", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(5),
    );

    notificationsUnsubscribe = onSnapshot(notifQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          // Only show if recent (within last minute) to avoid spam on reload
          const now = Date.now() / 1000;
          if (data.timestamp && now - data.timestamp.seconds < 60) {
            showToast(`💬 NEW REPLY FROM: ${data.from}`, "success");
          }
        } else if (change.type === "added" && data.type === "follow") {
          showToast(`👤 ${data.from} is now following you!`, "info");
        }
      });
    });
  } else {
    // Redirect to Login Page if not logged in
    window.location.href = "src/view/login.html";
  }
});

document.getElementById("btn-logout").onclick = () => auth.signOut();

// Profile Handlers
document.getElementById("btn-profile").onclick = () => {
  document.getElementById("modal-profile").classList.remove("hidden");
  // Populate Profile Data
  if (currentUser) {
    const emailDisplay = document.getElementById("profile-email-display");
    const uidDisplay = document.getElementById("profile-uid");
    const nameInput = document.getElementById("profile-name");

    if (emailDisplay)
      emailDisplay.innerText = currentUser.email || "Anonymous Guest";
    if (uidDisplay) uidDisplay.innerText = currentUser.uid;
    if (nameInput) nameInput.value = currentUser.displayName || "";
  }
};

document.getElementById("btn-close-profile").onclick = () => {
  document.getElementById("modal-profile").classList.add("hidden");
};

document.getElementById("btn-save-profile").onclick = async () => {
  const newName = document.getElementById("profile-name").value;
  if (currentUser && newName) {
    await updateProfile(currentUser, { displayName: newName });
    showToast("Profile Updated", "success");
  }
};

document.getElementById("btn-delete-account").onclick = async () => {
  showConfirm("Are you sure? This cannot be undone.", async () => {
    if (currentUser) await currentUser.delete();
    location.reload();
  });
};

// --- PUBLIC PROFILE & FOLLOW SYSTEM ---
window.openPublicProfile = async (targetUid, targetName) => {
  if (!currentUser || targetUid === currentUser.uid) return;

  const modal = document.getElementById("modal-public-profile");
  const nameEl = document.getElementById("public-profile-name");
  const followersEl = document.getElementById("public-profile-followers");
  const followingEl = document.getElementById("public-profile-following");
  const followBtn = document.getElementById("btn-public-follow");

  nameEl.innerText = "Loading...";
  followersEl.innerText = "-";
  followingEl.innerText = "-";
  modal.classList.remove("hidden");

  const targetUserSnap = await getDoc(doc(db, "users", targetUid));
  const currentUserSnap = await getDoc(doc(db, "users", currentUser.uid));

  if (targetUserSnap.exists()) {
    const targetData = targetUserSnap.data();
    nameEl.innerText = targetData.displayName || "Anonymous";
    followersEl.innerText = targetData.followerCount || 0;
    followingEl.innerText = targetData.followingCount || 0;
  }

  if (currentUserSnap.exists()) {
    const isFollowing = (currentUserSnap.data().following || []).includes(
      targetUid,
    );
    followBtn.innerText = isFollowing ? "UNFOLLOW" : "FOLLOW";
    followBtn.className = isFollowing
      ? "w-full bg-red-900/50 border border-red-500 text-red-400 hover:bg-red-500 hover:text-black py-2 font-bold uppercase text-xs transition"
      : "w-full bg-cyan-900/50 border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black py-2 font-bold uppercase text-xs transition";
  }

  followBtn.onclick = () => handleFollow(targetUid, targetName);
};

window.closePublicProfile = () => {
  document.getElementById("modal-public-profile").classList.add("hidden");
};

window.handleFollow = async (targetUid, targetName) => {
  const currentUserRef = doc(db, "users", currentUser.uid);
  const targetUserRef = doc(db, "users", targetUid);
  const currentUserSnap = await getDoc(currentUserRef);
  const isFollowing = (currentUserSnap.data().following || []).includes(
    targetUid,
  );
  const batch = writeBatch(db);

  if (isFollowing) {
    batch.update(currentUserRef, {
      following: arrayRemove(targetUid),
      followingCount: increment(-1),
    });
    batch.update(targetUserRef, {
      followers: arrayRemove(currentUser.uid),
      followerCount: increment(-1),
    });
  } else {
    batch.update(currentUserRef, {
      following: arrayUnion(targetUid),
      followingCount: increment(1),
    });
    batch.update(targetUserRef, {
      followers: arrayUnion(currentUser.uid),
      followerCount: increment(1),
    });
    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      to: targetUid,
      from: currentUser.displayName || "An Operator",
      type: "follow",
      timestamp: serverTimestamp(),
    });
  }

  await batch.commit();
  openPublicProfile(targetUid, targetName); // Refresh modal state
};

// --- FEED SYSTEM ---
const feedPanel = document.getElementById("feed-panel");
const feedContent = document.getElementById("feed-content");

document.getElementById("btn-toggle-feed").onclick = () => {
  feedPanel.classList.toggle("open");
  if (feedPanel.classList.contains("open")) {
    loadFeed(false); // Inicia listener em tempo real
  } else {
    if (feedUnsubscribe) {
      feedUnsubscribe(); // Para o listener ao fechar
      feedUnsubscribe = null;
    }
  }
};
document.getElementById("btn-close-feed").onclick = () => {
  feedPanel.classList.remove("open");
  if (feedUnsubscribe) {
    feedUnsubscribe();
    feedUnsubscribe = null;
  }
};

// Helper para criar o elemento do feed
function createFeedItem(doc) {
  const data = doc.data();
  const div = document.createElement("div");
  div.id = `feed-item-${doc.id}`;
  div.className =
    "bg-black/40 border border-cyan-900/50 p-3 hover:bg-cyan-900/20 transition cursor-pointer mb-2";
  div.innerHTML = `
          <div class="flex justify-between text-xs text-cyan-500 font-bold mb-1">
              <span>${data.name}</span>
              <span>${new Date(
                data.timestamp?.seconds * 1000,
              ).toLocaleDateString()}</span>
          </div>
          <div class="text-gray-300 text-sm font-mono mb-2">"${data.text}"</div>
          <div class="flex justify-between text-xs text-gray-500">
              <span>👍 ${data.likedBy ? data.likedBy.length : 0}</span>
              <span>↩ ${data.replyCount || 0}</span>
          </div>
      `;
  div.onclick = () => {
    map.flyTo([data.lat, data.lng], 14, { duration: 2 });
    const marker = markersMap[doc.id];
    if (marker) setTimeout(() => marker.openPopup(), 2200);
    if (window.innerWidth < 768) feedPanel.classList.remove("open"); // Close on mobile
  };
  return div;
}

async function loadFeed(isMore = false) {
  if (!isMore) {
    // --- MODO TEMPO REAL (Carga Inicial) ---
    if (feedUnsubscribe) feedUnsubscribe();
    feedContent.innerHTML = "";
    lastFeedDoc = null;

    const q = query(
      collection(db, "world_messages"),
      orderBy("timestamp", "desc"),
      limit(20),
    );

    feedUnsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const doc = change.doc;
        if (change.type === "added") {
          const div = createFeedItem(doc);
          // Insere na posição correta (importante para carga inicial vs novas mensagens)
          const items = feedContent.children;
          if (change.newIndex < items.length) {
            feedContent.insertBefore(div, items[change.newIndex]);
          } else {
            feedContent.appendChild(div);
          }
        } else if (change.type === "modified") {
          const existing = document.getElementById(`feed-item-${doc.id}`);
          if (existing) existing.replaceWith(createFeedItem(doc));
        } else if (change.type === "removed") {
          const existing = document.getElementById(`feed-item-${doc.id}`);
          if (existing) existing.remove();
        }
      });

      if (!snapshot.empty) {
        lastFeedDoc = snapshot.docs[snapshot.docs.length - 1];
      }
    });
  } else {
    // --- MODO ESTÁTICO (Carregar Mais Antigos) ---
    if (!lastFeedDoc) return;

    const q = query(
      collection(db, "world_messages"),
      orderBy("timestamp", "desc"),
      startAfter(lastFeedDoc),
      limit(20),
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      lastFeedDoc = snapshot.docs[snapshot.docs.length - 1];
      snapshot.forEach((doc) => {
        feedContent.appendChild(createFeedItem(doc));
      });
    } else {
      showToast("No more signals.", "info");
    }
  }
}

document.getElementById("btn-load-more").onclick = () => loadFeed(true);

// --- UI Interaction: Hide on Map Move ---
const uiContainer = document.getElementById("main-ui-container");
let uiHideTimeout;

const hideUI = () => {
  clearTimeout(uiHideTimeout);
  if (uiContainer) {
    uiContainer.classList.add("opacity-0");
  }
};

const showUI = () => {
  clearTimeout(uiHideTimeout);
  uiHideTimeout = setTimeout(() => {
    if (uiContainer) {
      uiContainer.classList.remove("opacity-0");
    }
  }, 1000); // 1 segundo de delay para reaparecer
};

map.on("movestart", hideUI);
map.on("zoomstart", hideUI);
map.on("moveend", showUI);
map.on("zoomend", showUI);

// --- THREAD / REPLY SYSTEM ---
let currentThreadId = null;

window.openThread = async (msgId) => {
  currentThreadId = msgId;
  const modal = document.getElementById("modal-thread");
  const originalDiv = document.getElementById("thread-original");
  const repliesDiv = document.getElementById("thread-replies");

  modal.classList.remove("hidden");
  originalDiv.innerHTML =
    '<div class="animate-pulse text-cyan-500">LOADING SOURCE...</div>';
  repliesDiv.innerHTML =
    '<div class="animate-pulse text-gray-500">SCANNING REPLIES...</div>';

  // Load Original
  const msgDoc = await getDoc(doc(db, "world_messages", msgId));
  if (msgDoc.exists()) {
    const data = msgDoc.data();
    originalDiv.innerHTML = `
            <div class="text-cyan-400 font-bold text-lg">${data.name}</div>
            <div class="text-white my-2 font-mono">"${data.text}"</div>
            <div class="text-xs text-gray-500">ID: ${msgId}</div>
        `;
  }

  // Load Replies (Subcollection)
  const q = query(
    collection(db, "world_messages", msgId, "replies"),
    orderBy("timestamp", "asc"),
    limit(50),
  );
  const snapshot = await getDocs(q);
  repliesDiv.innerHTML = "";
  snapshot.forEach((doc) => {
    const r = doc.data();
    const div = document.createElement("div");
    div.className = "bg-black/30 border-l-2 border-cyan-700 p-2 pl-4";
    div.innerHTML = `
            <div class="text-xs text-cyan-600 font-bold">${r.name}</div>
            <div class="text-gray-300 text-sm">${r.text}</div>
        `;
    repliesDiv.appendChild(div);
  });
};

document.getElementById("btn-close-thread").onclick = () =>
  document.getElementById("modal-thread").classList.add("hidden");

document.getElementById("btn-send-reply").onclick = async () => {
  if (!currentUser) {
    showToast("LOGIN REQUIRED", "error");
    return;
  }
  const text = document.getElementById("reply-input").value.trim();
  if (!text || !currentThreadId) return;

  const name = currentUser.displayName || "Anonymous";

  // Add reply
  await addDoc(collection(db, "world_messages", currentThreadId, "replies"), {
    name: name,
    text: text,
    timestamp: serverTimestamp(),
    uid: currentUser.uid,
  });

  // Update counter on parent
  await updateDoc(doc(db, "world_messages", currentThreadId), {
    replyCount: increment(1),
  });

  // --- CREATE NOTIFICATION ---
  // Get parent doc to find owner
  const parentDoc = await getDoc(doc(db, "world_messages", currentThreadId));
  if (parentDoc.exists()) {
    const parentData = parentDoc.data();
    if (parentData.uid && parentData.uid !== currentUser.uid) {
      await addDoc(collection(db, "notifications"), {
        to: parentData.uid,
        from: name,
        type: "reply",
        msgId: currentThreadId,
        timestamp: serverTimestamp(),
        read: false,
      });
    }
  }

  document.getElementById("reply-input").value = "";
  openThread(currentThreadId); // Reload
};

// Executa tradução ao carregar
applyLanguage();

// --- WELCOME MODAL LOGIC ---
const welcomeModal = document.getElementById("modal-welcome");
const btnEnter = document.getElementById("btn-enter-site");
const flagsContainer = document.getElementById("welcome-flags");
const btnCloseWelcome = document.getElementById("btn-close-welcome");

// Populate flags in modal
Object.values(langToFlag).forEach((flag) => {
  const span = document.createElement("span");
  span.innerText = flag;
  flagsContainer.appendChild(span);
});

btnEnter.onclick = () => {
  welcomeModal.classList.add("hidden");
  localStorage.setItem("wmt_welcome_seen_v1", "true");
};

btnCloseWelcome.onclick = () => {
  welcomeModal.classList.add("hidden");
  localStorage.setItem("wmt_welcome_seen_v1", "true");
};

// Check for Clan Tag on Load to show Chat Button
function checkClanButton() {
  const localName = localStorage.getItem("wmt_name");
  if (localName && localName.match(/^\[([a-zA-Z0-9_-]+)\]/)) {
    document.getElementById("btn-clan-chat").classList.remove("hidden");
  }
}
checkClanButton();

// --- INTERAÇÃO ---
const modalForm = document.getElementById("modal-form");
const modalShare = document.getElementById("modal-share");
const btnOpen = document.getElementById("btn-open-modal");
const btnClose = document.getElementById("btn-close-modal");
const btnCloseShare = document.getElementById("btn-close-share");
const btnSubmit = document.getElementById("btn-submit");
const inputName = document.getElementById("input-name");
const inputMsg = document.getElementById("input-msg");
const btnDelete = document.getElementById("btn-delete");

// Abrir/Fechar Modais
btnOpen.onclick = () => {
  modalForm.classList.remove("hidden");
};
btnClose.onclick = () => modalForm.classList.add("hidden");
btnCloseShare.onclick = () => modalShare.classList.add("hidden");
inputMsg.oninput = (e) =>
  (document.getElementById("char-count").innerText = e.target.value.length);

// Visual Verification for Tag
inputName.addEventListener("input", (e) => {
  const val = e.target.value;
  const match = val.match(/^\[([a-zA-Z0-9_-]+)\]/);
  if (match) {
    inputName.classList.add(
      "border-green-500",
      "text-green-400",
      "shadow-[0_0_10px_rgba(34,197,94,0.3)]",
    );
    inputName.classList.remove("border-cyan-900", "text-cyan-100");
  } else {
    inputName.classList.remove(
      "border-green-500",
      "text-green-400",
      "shadow-[0_0_10px_rgba(34,197,94,0.3)]",
    );
    inputName.classList.add("border-cyan-900", "text-cyan-100");
  }
});

// --- FUNÇÕES DE INTERAÇÃO (Anexadas ao window para acesso via HTML) ---

// Deletar Mensagem
// (Moved to Profile Modal logic)

// Enviar Mensagem
btnSubmit.onclick = async () => {
  const name = inputName.value.trim();
  const text = inputMsg.value.trim();

  if (!name || !text) {
    showToast("ERROR: Missing data fields.", "error");
    return;
  }

  // Verifica profanidade
  if (containsProfanity(name) || containsProfanity(text)) {
    const userLang = navigator.language.split("-")[0];
    showToast(
      translations[userLang]?.error_profanity ||
        translations["en"].error_profanity,
      "error",
    );
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerText = "ACQUIRING GPS...";

  if (!navigator.geolocation) {
    showToast("Seu navegador não suporta geolocalização.", "error");
    btnSubmit.disabled = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        btnSubmit.innerText = "UPLOADING...";

        const payload = {
          name: name,
          text: text,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: serverTimestamp(),
          lang: navigator.language,
          specialTitle: localStorage.getItem("wmt_special_title") || null,
          uid: currentUser ? currentUser.uid : "guest",
          replyCount: 0,
        };

        const existingId = localStorage.getItem("wmt_msg_id");

        if (existingId) {
          await updateDoc(doc(db, "world_messages", existingId), payload);
          showToast("Signal Updated!", "success");
        } else {
          const docRef = await addDoc(
            collection(db, "world_messages"),
            payload,
          );
          localStorage.setItem("wmt_msg_id", docRef.id);

          // Update UI button state
          const btnOpen = document.getElementById("btn-open-modal");
          if (btnOpen)
            btnOpen.innerHTML = '<span class="text-xl">↻</span> UPDATE SIGNAL';
        }

        localStorage.setItem("wmt_name", name);
        checkClanButton();

        // Show Reward Logic (Simples)
        // (Simplified for new logic)
        document.getElementById("reward-locked").classList.remove("hidden");
        document.getElementById("reward-unlocked").classList.add("hidden");

        // Sucesso
        modalForm.classList.add("hidden");
        modalShare.classList.remove("hidden");
        inputName.value = "";
        inputMsg.value = "";

        // Zoom na localização do usuário
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 10);
      } catch (err) {
        console.error(err);
        showToast("Erro ao salvar. Tente novamente.", "error");
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "UPLOAD TO GRID 📡";
      }
    },
    (err) => {
      showToast(
        "ACCESS DENIED: Location required for node synchronization.",
        "error",
      );
      btnSubmit.disabled = false;
      btnSubmit.innerText = "UPLOAD TO GRID 📡";
    },
  );
};

// Funções Globais (Window)
window.share = (platform) => {
  const url = "https://thegridsocial.vercel.app";
  const localName = localStorage.getItem("wmt_name");
  const match = localName ? localName.match(/^\[([a-zA-Z0-9_-]+)\]/) : null;

  let text =
    "Acabei de deixar minha marca no Mural Global! Venha ver e deixe a sua também.";

  if (match) {
    const tag = match[1].toUpperCase();
    text = `⚔️ Estou dominando o Grid com o clã [${tag}]! Entre no site, use a tag [${tag}] e ajude a fortalecer nosso sinal no THE GRID SOCIAL.`;
  } else {
    text =
      "📡 Estabeleci um uplink no THE GRID SOCIAL. Curta minha mensagem para eu virar Lenda antes do Reset Diário!";
  }

  if (platform === "whatsapp") {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
      "_blank",
    );
  } else if (platform === "twitter") {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text,
      )}&url=${encodeURIComponent(url)}`,
      "_blank",
    );
  }
};

window.copyLink = () => {
  navigator.clipboard.writeText("https://thegridsocial.vercel.app");
  showToast("Link copiado para a área de transferência!", "success");
};

window.prepareDownload = (name, text, lat, lng) => {
  document.getElementById("card-name").innerText = name;
  document.getElementById("card-text").innerText = `"${text}"`;
  document.getElementById("card-coords").innerText = `${lat.toFixed(
    4,
  )}, ${lng.toFixed(4)}`;
  document.getElementById("card-date").innerText = new Date()
    .toISOString()
    .split("T")[0];
  window.downloadCard();
};

window.downloadCard = async () => {
  const card = document.getElementById("share-card");
  if (document.getElementById("card-name").innerText === "CODENAME") {
    const name = document.getElementById("input-name").value || "Anonymous";
    const text = document.getElementById("input-msg").value || "Hello World";
    document.getElementById("card-name").innerText = name;
    document.getElementById("card-text").innerText = `"${text}"`;
    document.getElementById("card-date").innerText = new Date()
      .toISOString()
      .split("T")[0];
  }

  try {
    const canvas = await html2canvas(card, {
      backgroundColor: "#000000",
      scale: 2,
    });
    const link = document.createElement("a");
    link.download = `WMT_TRANSMISSION_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  } catch (err) {
    console.error("Image generation failed:", err);
    showToast("Error generating image.", "error");
  }
};

window.handleReaction = async (id, action) => {
  if (!currentUser) {
    showToast("LOGIN REQUIRED TO REACT", "error");
    return;
  }

  if (id.startsWith("fake_")) {
    showToast("CANNOT REACT TO SIMULATED SIGNALS", "info");
    return;
  }

  const docRef = doc(db, "world_messages", id);
  const uid = currentUser.uid;

  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const likedBy = data.likedBy || [];
    const dislikedBy = data.dislikedBy || [];

    if (action === "like") {
      if (likedBy.includes(uid)) {
        await updateDoc(docRef, { likedBy: arrayRemove(uid) }); // Undo Like
      } else {
        await updateDoc(docRef, {
          likedBy: arrayUnion(uid),
          dislikedBy: arrayRemove(uid),
        }); // Like and remove Dislike
      }
    } else if (action === "dislike") {
      if (dislikedBy.includes(uid)) {
        await updateDoc(docRef, { dislikedBy: arrayRemove(uid) }); // Undo Dislike
      } else {
        await updateDoc(docRef, {
          dislikedBy: arrayUnion(uid),
          likedBy: arrayRemove(uid),
        }); // Dislike and remove Like
      }
    }
  } catch (e) {
    console.error("Erro ao curtir:", e);
  }
};

// --- GUEST LOGIN HELPER ---
window.loginGuest = () => {
  signInAnonymously(auth).catch((error) => {
    console.error("Guest Login Error:", error);
    if (error.code === "auth/admin-restricted-operation") {
      showToast("ERROR: Enable Anonymous Auth in Firebase Console", "error");
    } else {
      showToast(error.message, "error");
    }
  });
};

// --- AUDIO CONTROL ---
window.toggleAudio = () => {
  const audio = document.getElementById("audio-ambience");
  const btn = document.getElementById("btn-audio");

  if (audio.paused) {
    audio.play().catch((e) => console.log("Audio prevented:", e));
    btn.innerText = "🔊 ON";
    btn.classList.add("bg-cyan-600", "text-black");
    btn.classList.remove("text-cyan-400");
  } else {
    audio.pause();
    btn.innerText = "🔇 OFF";
    btn.classList.remove("bg-cyan-600", "text-black");
    btn.classList.add("text-cyan-400");
  }
};

// --- AUTO PILOT ---
let autoPilotInterval;
let isAutoPilotOn = false;

window.toggleAutoPilot = () => {
  isAutoPilotOn = !isAutoPilotOn;
  const btn = document.getElementById("btn-autopilot");
  const audio = document.getElementById("audio-ambience");
  const audioBtn = document.getElementById("btn-audio");

  if (isAutoPilotOn) {
    btn.classList.add("bg-cyan-600", "text-black");
    btn.classList.remove("text-cyan-400");
    btn.innerText = "PILOT: ON";
    moveCamera();
    autoPilotInterval = setInterval(moveCamera, 10000);
    // Start audio and update the audio button
    audio.play().catch((e) => console.log("Audio play failed:", e));
    audioBtn.innerText = "🔊 ON";
    audioBtn.classList.add("bg-cyan-600", "text-black");
    audioBtn.classList.remove("text-cyan-400");
  } else {
    btn.classList.remove("bg-cyan-600", "text-black");
    btn.classList.add("text-cyan-400");
    btn.innerText = "AUTO PILOT";
    clearInterval(autoPilotInterval);
    // Stop audio and update the audio button
    audio.pause();
    audioBtn.innerText = "🔇 OFF";
    audioBtn.classList.remove("bg-cyan-600", "text-black");
    audioBtn.classList.add("text-cyan-400");
  }
};

function moveCamera() {
  if (!isAutoPilotOn) return;
  const keys = Object.keys(markersMap);
  if (keys.length === 0) return;
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  const marker = markersMap[randomKey];
  if (marker) {
    const latLng = marker.getLatLng();
    map.flyTo(latLng, 6, { duration: 4 });
    setTimeout(() => {
      if (isAutoPilotOn) marker.openPopup();
    }, 4000);
  }
}

map.on("mousedown", () => {
  if (isAutoPilotOn) window.toggleAutoPilot();
});

// --- COUNTDOWN ---
function updateCountdown() {
  const now = new Date();
  const target = new Date();
  target.setUTCHours(24, 0, 0, 0);
  let diff = target - now;
  if (diff < 0) diff += 86400000;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  document.getElementById("countdown-timer").innerText = `${h
    .toString()
    .padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}
setInterval(updateCountdown, 1000);
updateCountdown();

// --- SEARCH ---
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

searchInput.addEventListener("input", (e) => {
  const val = e.target.value.toLowerCase();
  if (val === "the_architect") {
    localStorage.setItem("wmt_special_title", "HACKER");
    showToast("ACCESS GRANTED. TITLE [ HACKER ] UNLOCKED.", "success");
    searchInput.value = "";
    return;
  }
  if (val.length < 2) {
    searchResults.classList.add("hidden");
    return;
  }
  const matches = searchIndex
    .filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(val)) ||
        (item.text && item.text.toLowerCase().includes(val)),
    )
    .slice(0, 10);
  renderSuggestions(matches);
});

function renderSuggestions(matches) {
  searchResults.innerHTML = "";
  if (matches.length === 0) {
    searchResults.classList.add("hidden");
    return;
  }
  matches.forEach((m) => {
    const li = document.createElement("li");
    li.className =
      "p-3 hover:bg-cyan-900/50 cursor-pointer border-b border-cyan-900/30 text-cyan-100 transition-colors";
    li.innerHTML = `<div class="font-bold text-cyan-400">${m.name}</div><div class="text-gray-400 truncate">${m.text}</div>`;
    li.onclick = () => {
      const marker = markersMap[m.id];
      if (marker) {
        showRadar(m.lat, m.lng);
        map.flyTo([m.lat, m.lng], 12, { duration: 2 });
        setTimeout(() => marker.openPopup(), 2200);
        searchResults.classList.add("hidden");
        searchInput.value = "";
      }
    };
    searchResults.appendChild(li);
  });
  searchResults.classList.remove("hidden");
}

document.addEventListener("click", (e) => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.classList.add("hidden");
  }
});

function showRadar(lat, lng) {
  if (radarLayer) map.removeLayer(radarLayer);
  const radarIcon = L.divIcon({
    className: "custom-div-icon",
    html: '<div class="radar-wave"></div><div class="radar-wave"></div><div class="radar-wave"></div>',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
  radarLayer = L.marker([lat, lng], {
    icon: radarIcon,
    interactive: false,
  }).addTo(map);
  setTimeout(() => {
    if (radarLayer) map.removeLayer(radarLayer);
  }, 5000);
}

// --- HISTORY MODE ---
let historyActive = false;
let historyData = [];
let historyIdx = 0;
let historyPlayInterval;
let historyPathLine = null;

window.toggleHistoryMode = () => {
  historyActive = !historyActive;
  const ui = document.getElementById("history-ui");
  const btn = document.getElementById("btn-history");

  if (historyActive) {
    ui.classList.remove("hidden");
    btn.classList.add("bg-cyan-600", "text-black");
    historyData = [...searchIndex].sort((a, b) => {
      const tA = a.timestamp ? a.timestamp.seconds : 0;
      const tB = b.timestamp ? b.timestamp.seconds : 0;
      return tA - tB;
    });
    const latLngs = historyData.map((d) => [d.lat, d.lng]);
    if (historyPathLine) map.removeLayer(historyPathLine);
    historyPathLine = L.polyline(latLngs, {
      color: "#06b6d4",
      weight: 2,
      dashArray: "5, 10",
      opacity: 0.5,
    }).addTo(map);
    document.getElementById("history-slider").max = historyData.length - 1;
    historyIdx = 0;
    updateHistoryStep();
  } else {
    ui.classList.add("hidden");
    btn.classList.remove("bg-cyan-600", "text-black");
    clearInterval(historyPlayInterval);
    document.getElementById("btn-play-history").innerText = "PLAY";
    if (historyPathLine) map.removeLayer(historyPathLine);
  }
};

window.navHistory = (step) => {
  historyIdx += step;
  if (historyIdx < 0) historyIdx = 0;
  if (historyIdx >= historyData.length) historyIdx = historyData.length - 1;
  updateHistoryStep();
};

window.togglePlayHistory = () => {
  const btn = document.getElementById("btn-play-history");
  if (historyPlayInterval) {
    clearInterval(historyPlayInterval);
    historyPlayInterval = null;
    btn.innerText = "PLAY";
  } else {
    btn.innerText = "PAUSE";
    historyPlayInterval = setInterval(() => {
      historyIdx++;
      if (historyIdx >= historyData.length) {
        clearInterval(historyPlayInterval);
        historyPlayInterval = null;
        btn.innerText = "REPLAY";
        return;
      }
      updateHistoryStep();
    }, 3000);
  }
};

function updateHistoryStep() {
  const data = historyData[historyIdx];
  if (!data) return;
  document.getElementById("history-slider").value = historyIdx;
  document.getElementById("history-counter").innerText = `${historyIdx + 1} / ${
    historyData.length
  }`;
  document.getElementById("history-date").innerText = new Date(
    (data.timestamp?.seconds || Date.now() / 1000) * 1000,
  ).toLocaleDateString();
  map.flyTo([data.lat, data.lng], 6, { duration: 1.5 });
  const marker = markersMap[data.id];
  if (marker) setTimeout(() => marker.openPopup(), 1600);
}

document.getElementById("history-slider").addEventListener("input", (e) => {
  historyIdx = parseInt(e.target.value);
  updateHistoryStep();
});

// --- HALL OF FAME ---
window.openHallOfFame = async () => {
  const modal = document.getElementById("modal-hall-of-fame");
  const list = document.getElementById("hall-of-fame-list");
  modal.classList.remove("hidden");
  list.innerHTML =
    '<div class="text-center text-yellow-500 font-mono animate-pulse py-10">RETRIEVING LEGENDS...</div>';

  try {
    const msgsRef = collection(db, "world_messages");
    const q = query(msgsRef, orderBy("likes", "desc"), limit(10));
    const snapshot = await getDocs(q);

    list.innerHTML = "";
    let rank = 1;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.className =
        "bg-black/40 border border-yellow-900/30 p-4 flex items-center gap-4 hover:bg-yellow-900/10 hover:border-yellow-500/50 transition cursor-pointer group";
      div.innerHTML = `
                <div class="text-2xl font-bold text-yellow-700 group-hover:text-yellow-500 w-8 font-mono">#${rank}</div>
                <div class="flex-1 min-w-0">
                    <div class="text-yellow-500 font-bold uppercase text-sm truncate">${
                      data.name
                    }</div>
                    <div class="text-gray-400 text-sm italic truncate">"${
                      data.text
                    }"</div>
                </div>
                <div class="text-yellow-600 group-hover:text-yellow-400 font-mono text-xs flex flex-col items-center min-w-[40px]">
                    <span class="text-lg">♥</span>
                    <span>${data.likes || 0}</span>
                </div>
            `;
      div.onclick = () => {
        modal.classList.add("hidden");
        map.flyTo([data.lat, data.lng], 12, { duration: 2 });
        const marker = markersMap[doc.id];
        if (marker) setTimeout(() => marker.openPopup(), 2200);
      };
      list.appendChild(div);
      rank++;
    });
  } catch (e) {
    console.error(e);
    list.innerHTML =
      '<div class="text-center text-red-500">ERROR RETRIEVING DATA</div>';
  }
};

window.closeHallOfFame = () => {
  document.getElementById("modal-hall-of-fame").classList.add("hidden");
};

// --- CLAN LEADERBOARD ---
window.openClanLeaderboard = () => {
  const modal = document.getElementById("modal-clans");
  const list = document.getElementById("clan-list");
  const rivalryDiv = document.getElementById("clan-rivalry");
  modal.classList.remove("hidden");

  const sortedClans = Object.entries(clanStats)
    .sort((a, b) => b[1].likes - a[1].likes)
    .slice(0, 10);

  list.innerHTML = "";
  if (sortedClans.length === 0) {
    list.innerHTML =
      '<div class="text-center text-red-500 font-mono py-10">NO CLANS DETECTED</div>';
    return;
  }

  sortedClans.forEach(([tag, stats], index) => {
    const div = document.createElement("div");
    div.className =
      "bg-black/40 border border-red-900/30 p-4 flex items-center gap-4 hover:bg-red-900/10 hover:border-red-500/50 transition";
    div.innerHTML = `
            <div class="text-2xl font-bold text-red-700 w-8 font-mono">#${
              index + 1
            }</div>
            <div class="flex-1">
                <div class="text-red-500 font-bold uppercase text-lg">[${tag}]</div>
                <div class="text-gray-400 text-xs font-mono">${
                  stats.members
                } MEMBERS</div>
            </div>
            <div class="text-red-600 font-mono text-xl font-bold">${
              stats.likes
            } <span class="text-xs">PTS</span></div>
        `;
    list.appendChild(div);
  });

  const localName = localStorage.getItem("wmt_name");
  const match = localName ? localName.match(/^\[([a-zA-Z0-9_-]+)\]/) : null;

  if (match) {
    const myTag = match[1].toUpperCase();
    const myRankIndex = sortedClans.findIndex(([tag]) => tag === myTag);

    if (myRankIndex !== -1) {
      rivalryDiv.classList.remove("hidden");
      let html = `<h3 class="text-red-400 font-bold uppercase text-sm mb-2">⚠️ RIVALRY INTEL ⚠️</h3>`;
      if (myRankIndex < sortedClans.length - 1) {
        const chaser = sortedClans[myRankIndex + 1];
        const diff = sortedClans[myRankIndex][1].likes - chaser[1].likes;
        html += `<div class="text-xs text-red-200 font-mono mb-1">THREAT: <span class="text-white font-bold">[${chaser[0]}]</span> is <span class="text-red-500 font-bold">${diff} PTS</span> behind you.</div>`;
      } else {
        html += `<div class="text-xs text-red-200 font-mono mb-1">NO THREATS DETECTED BEHIND.</div>`;
      }
      rivalryDiv.innerHTML = html;
    } else {
      rivalryDiv.classList.add("hidden");
    }
  } else {
    rivalryDiv.classList.add("hidden");
  }
};

window.closeClanLeaderboard = () => {
  document.getElementById("modal-clans").classList.add("hidden");
};

// --- SYSTEM LEVELS MODAL ---
window.openLevelsModal = () => {
  document.getElementById("modal-levels").classList.remove("hidden");
};
window.closeLevelsModal = () => {
  document.getElementById("modal-levels").classList.add("hidden");
};

// --- CLAN CHAT ---
window.openClanChat = () => {
  const localName = localStorage.getItem("wmt_name");
  const match = localName ? localName.match(/^\[([a-zA-Z0-9_-]+)\]/) : null;

  if (!match) {
    showToast(
      "ACCESS DENIED: You must have a [TAG] in your name to access Clan Comms.",
      "error",
    );
    return;
  }

  const tag = match[1].toUpperCase();
  document.getElementById("clan-chat-tag").innerText =
    `CHANNEL: [${tag}] // ENCRYPTED`;
  document.getElementById("modal-clan-chat").classList.remove("hidden");

  const chatRef = collection(db, "clan_messages");
  const q = query(chatRef, orderBy("timestamp", "asc"), limit(50));

  if (clanChatUnsubscribe) clanChatUnsubscribe();

  clanChatUnsubscribe = onSnapshot(q, (snapshot) => {
    const container = document.getElementById("clan-chat-messages");
    container.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.tag === tag) {
        const div = document.createElement("div");
        div.innerHTML = `<span class="text-green-600">[${
          data.sender.split("]")[1] || data.sender
        }]</span>: <span class="text-green-300">${data.text}</span>`;
        container.appendChild(div);
      }
    });
    container.scrollTop = container.scrollHeight;
  });
};

window.closeClanChat = () => {
  document.getElementById("modal-clan-chat").classList.add("hidden");
  if (clanChatUnsubscribe) clanChatUnsubscribe();
};

window.sendClanMessage = async () => {
  const input = document.getElementById("clan-chat-input");
  const text = input.value.trim();
  const localName = localStorage.getItem("wmt_name");
  const match = localName ? localName.match(/^\[([a-zA-Z0-9_-]+)\]/) : null;

  if (!text || !match) return;

  await addDoc(collection(db, "clan_messages"), {
    tag: match[1].toUpperCase(),
    sender: localName,
    text: text,
    timestamp: serverTimestamp(),
  });
  input.value = "";
};

// --- PWA SERVICE WORKER REGISTRATION ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("Service Worker registrado!", reg))
      .catch((err) => console.log("Falha ao registrar Service Worker:", err));
  });
}
