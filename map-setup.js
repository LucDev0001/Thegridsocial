// --- MAPA ---
const map = L.map("map", { zoomControl: false }).setView([20, 0], 2);
L.control.zoom({ position: "bottomright" }).addTo(map);

// Tiles High-Tech (CartoDB Dark Matter)
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; OpenStreetMap &copy; CARTO",
  subdomains: "abcd",
  maxZoom: 20,
}).addTo(map);

export { map };
