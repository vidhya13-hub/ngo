let needs = [];
let volunteers = [];
let map = null;
let mapMarkers = [];
let geoCache = {};

const defaultLocations = [
  { name: "Delhi", lat: 28.6139, lng: 77.2090, needs: 0 },
  { name: "Bangalore", lat: 12.9716, lng: 77.5946, needs: 0 },
  { name: "Mumbai", lat: 19.0760, lng: 72.8777, needs: 0 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707, needs: 0 }
];

const fallbackPlaces = {
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  delhi: { lat: 28.6139, lng: 77.2090 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  pune: { lat: 18.5204, lng: 73.8567 },
  mysore: { lat: 12.2958, lng: 76.6394 }
};

const API_BASE = "http://localhost:5000";

/* LOGIN */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const loginPage = document.getElementById("loginPage");
    const appPage = document.getElementById("appPage");
    const navUserName = document.getElementById("navUserName");

    if (!nameInput || !emailInput || !loginPage || !appPage) {
      console.error("Login elements missing in HTML");
      return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name || !email) return;

    localStorage.setItem("userName", name);
    localStorage.setItem("userEmail", email);

    loginPage.classList.add("hidden");
    appPage.classList.remove("hidden");

    if (navUserName) {
      navUserName.innerText = name;
    }

    if (!map) {
      initMap();
    }

    await loadBackendData();
  });
}

function initMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  map = L.map("map").setView([20.5937, 78.9629], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

/* REAL GEOCODING */
async function geocodeLocation(locationText) {
  const key = locationText.trim().toLowerCase();

  if (!key) return null;
  if (geoCache[key]) return geoCache[key];
  if (fallbackPlaces[key]) {
    geoCache[key] = fallbackPlaces[key];
    return fallbackPlaces[key];
  }

  try {
    setMapStatus(`Finding ${locationText} on map...`);

    const email = localStorage.getItem("userEmail") || "demo@example.com";
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(locationText)}&limit=1&email=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en"
      }
    });

    if (!response.ok) {
      throw new Error("Geocoding failed");
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const coords = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      geoCache[key] = coords;
      setMapStatus(`Found ${locationText}`);
      return coords;
    }

    setMapStatus(`Could not find "${locationText}", using fallback`);
    return getFallbackCoordinateBySpread(key);
  } catch (error) {
    setMapStatus(`Map API issue for "${locationText}", using fallback`);
    return getFallbackCoordinateBySpread(key);
  }
}

function getFallbackCoordinateBySpread(key) {
  if (fallbackPlaces[key]) return fallbackPlaces[key];

  const hash = Array.from(key).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const lat = 20.5937 + ((hash % 20) - 10) * 0.25;
  const lng = 78.9629 + ((hash % 30) - 15) * 0.25;

  const coords = { lat, lng };
  geoCache[key] = coords;
  return coords;
}

function setMapStatus(text) {
  const status = document.getElementById("mapStatus");
  if (status) status.innerText = text;
}

/* LOAD DATA FROM BACKEND */
async function loadBackendData() {
  try {
    const response = await fetch(`${API_BASE}/data`);
    const data = await response.json();

    needs = Array.isArray(data.needs) ? data.needs : [];
    volunteers = Array.isArray(data.volunteers) ? data.volunteers : [];

    updateAnalytics();
    renderMatches();
    renderChart();
    loadLocations();
    updateMapMarkers();
  } catch (error) {
    console.error("Failed to load backend data:", error);
  }
}

/* ADD NEED */
const needForm = document.getElementById("needForm");

if (needForm) {
  needForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const descriptionInput = document.getElementById("description");
    const locationInput = document.getElementById("location");
    const urgencyInput = document.getElementById("urgency");

    const description = descriptionInput ? descriptionInput.value.trim() : "";
    const location = locationInput ? locationInput.value.trim() : "";
    const urgency = urgencyInput ? urgencyInput.value : "medium";

    if (!description || !location) return;

    const coords = await geocodeLocation(location);

    const needPayload = {
      description,
      location,
      urgency,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null
    };

    try {
      const response = await fetch(`${API_BASE}/add-need`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(needPayload)
      });

      const data = await response.json();
      console.log("Need saved:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to save need");
      }

      needForm.reset();
      if (urgencyInput) urgencyInput.value = "medium";

      await loadBackendData();
    } catch (error) {
      console.error("Error saving need:", error);
      alert("Failed to save need to backend");
    }
  });
}

/* REGISTER VOLUNTEER */
const volunteerForm = document.getElementById("volunteerForm");

if (volunteerForm) {
  volunteerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nameInput = document.getElementById("volName");
    const skillInput = document.getElementById("volSkill");
    const locationInput = document.getElementById("volLocation");

    const name = nameInput ? nameInput.value.trim() : "";
    const skill = skillInput ? skillInput.value.trim() : "";
    const location = locationInput ? locationInput.value.trim() : "";

    if (!name || !skill || !location) {
      alert("Please fill all fields");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/add-volunteer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name,
          skill: skill,
          location: location
        })
      });

      const data = await response.json();
      console.log("Volunteer saved:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to save volunteer");
      }

      volunteerForm.reset();
      await loadBackendData();
      alert("Volunteer saved successfully ✅");
    } catch (error) {
      console.error("Error saving volunteer:", error);
      alert("Failed to save volunteer to backend");
    }
  });
}

/* MATCHING */
function createMatches() {
  const matches = [];

  needs.forEach((need) => {
    volunteers.forEach((volunteer) => {
      const needLocation = (need.location || "").toLowerCase();
      const volunteerLocation = (volunteer.location || "").toLowerCase();

      const sameLocation = volunteerLocation === needLocation;

      const skillText = (volunteer.skill || "").toLowerCase();
      const needText = (need.description || "").toLowerCase();

      const skillMatch =
        needText.includes(skillText) ||
        (skillText.includes("medical") && needText.includes("medical")) ||
        (skillText.includes("teach") && needText.includes("education")) ||
        (skillText.includes("food") && needText.includes("food")) ||
        (skillText.includes("cook") && needText.includes("food")) ||
        (skillText.includes("shelter") && needText.includes("shelter")) ||
        (skillText.includes("cloth") && needText.includes("clothing"));

      if (sameLocation || skillMatch) {
        matches.push({
          volunteer: volunteer.name,
          skill: volunteer.skill,
          need: need.description,
          location: need.location
        });
      }
    });
  });

  return matches;
}

function renderMatches() {
  const section = document.getElementById("matchSection");
  const list = document.getElementById("matchList");
  const matches = createMatches();

  if (!list) return;

  if (matches.length === 0) {
    if (section) section.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  if (section) section.classList.remove("hidden");
  list.innerHTML = "";

  matches.forEach((match) => {
    const div = document.createElement("div");
    div.className = "match-card";

    div.innerHTML = `
      <div class="match-row">
        <div class="match-info">
          <div><i class="fa-solid fa-users"></i> <strong>${escapeHtml(match.volunteer)}</strong></div>
          <div><i class="fa-solid fa-award"></i> ${escapeHtml(match.skill)}</div>
          <div><i class="fa-solid fa-location-dot"></i> ${escapeHtml(match.location)}</div>
        </div>
        <div><span class="match-tag">Matched</span></div>
      </div>
      <div class="match-need">
        <strong>Need:</strong> ${escapeHtml(match.need)}
      </div>
    `;
    list.appendChild(div);
  });
}

/* ANALYTICS */
function updateAnalytics() {
  const totalNeedsCard = document.getElementById("totalNeedsCard");
  const totalVolunteersCard = document.getElementById("totalVolunteersCard");
  const topNeedCard = document.getElementById("topNeedCard");

  if (totalNeedsCard) totalNeedsCard.innerText = needs.length;
  if (totalVolunteersCard) totalVolunteersCard.innerText = volunteers.length;

  if (!topNeedCard) return;

  if (needs.length === 0) {
    topNeedCard.innerText = "No needs yet";
    return;
  }

  const highNeed = needs.find((n) => n.urgency === "high");
  topNeedCard.innerText = highNeed
    ? shortenText(highNeed.description, 18)
    : shortenText(needs[0].description, 18);
}

/* CHART */
function getNeedCategories() {
  const counts = {
    Food: 0,
    Medical: 0,
    Education: 0,
    Shelter: 0,
    Clothing: 0,
    Other: 0
  };

  needs.forEach((need) => {
    const text = (need.description || "").toLowerCase();

    if (text.includes("food") || text.includes("meal") || text.includes("cook")) {
      counts.Food++;
    } else if (text.includes("medical") || text.includes("health") || text.includes("first aid")) {
      counts.Medical++;
    } else if (text.includes("education") || text.includes("teach") || text.includes("school")) {
      counts.Education++;
    } else if (text.includes("shelter") || text.includes("housing")) {
      counts.Shelter++;
    } else if (text.includes("cloth") || text.includes("dress")) {
      counts.Clothing++;
    } else {
      counts.Other++;
    }
  });

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .filter((item) => item.count > 0);
}

function renderChart() {
  const container = document.getElementById("chartBars");
  if (!container) return;

  const data = getNeedCategories();
  if (data.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;">No need data yet. Add some needs to see category distribution.</p>`;
    return;
  }

  const max = Math.max(...data.map((d) => d.count));
  container.innerHTML = "";

  data.forEach((item) => {
    const width = (item.count / max) * 100;
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <div>${escapeHtml(item.category)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${width}%"></div>
      </div>
      <div>${item.count}</div>
    `;
    container.appendChild(row);
  });
}

/* MAP MARKERS */
function clearMapMarkers() {
  if (!map) return;
  mapMarkers.forEach((marker) => map.removeLayer(marker));
  mapMarkers = [];
}

function updateMapMarkers() {
  if (!map) return;

  clearMapMarkers();

  if (needs.length === 0) {
    defaultLocations.forEach((loc) => {
      const marker = L.marker([loc.lat, loc.lng])
        .addTo(map)
        .bindPopup(`<strong>${escapeHtml(loc.name)}</strong><br>0 needs`);
      mapMarkers.push(marker);
    });
    setMapStatus("Showing default locations");
    return;
  }

  const bounds = [];

  needs.forEach((need) => {
    if (need.lat == null || need.lng == null) return;

    const marker = L.marker([need.lat, need.lng])
      .addTo(map)
      .bindPopup(`
        <strong>${escapeHtml(need.description)}</strong><br>
        Location: ${escapeHtml(need.location)}<br>
        Urgency: ${escapeHtml(need.urgency)}
      `);

    mapMarkers.push(marker);
    bounds.push([need.lat, need.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30] });
    setMapStatus("Map updated with real searched locations");
  }
}

/* LOCATION LIST */
function loadLocations() {
  const container = document.getElementById("locationsList");
  if (!container) return;

  container.innerHTML = "";

  if (needs.length === 0) {
    defaultLocations.forEach((loc) => {
      const div = document.createElement("div");
      div.className = "location-item";
      div.innerHTML = `
        <div>
          <div class="location-name"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(loc.name)}</div>
          <div class="location-needs">0 needs</div>
        </div>
        <button class="nav-small-btn" onclick="navigateTo(${loc.lat}, ${loc.lng}, '${jsEscape(loc.name)}')">
          <i class="fa-solid fa-location-arrow"></i>
        </button>
      `;
      container.appendChild(div);
    });
    return;
  }

  const grouped = {};

  needs.forEach((need) => {
    const key = (need.location || "").trim().toLowerCase();
    if (!key) return;

    if (!grouped[key]) {
      grouped[key] = {
        label: need.location,
        lat: need.lat,
        lng: need.lng,
        count: 0
      };
    }
    grouped[key].count += 1;
  });

  Object.values(grouped).forEach((loc) => {
    const div = document.createElement("div");
    div.className = "location-item";
    div.innerHTML = `
      <div>
        <div class="location-name"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(loc.label)}</div>
        <div class="location-needs">${loc.count} needs</div>
      </div>
      <button class="nav-small-btn" onclick="navigateTo(${loc.lat}, ${loc.lng}, '${jsEscape(loc.label)}')">
        <i class="fa-solid fa-location-arrow"></i>
      </button>
    `;
    container.appendChild(div);
  });
}

function navigateTo(lat, lng, name) {
  if (!map || lat == null || lng == null) return;
  map.setView([lat, lng], 11);

  const tempMarker = L.marker([lat, lng])
    .addTo(map)
    .bindPopup(`<strong>${escapeHtml(name)}</strong>`)
    .openPopup();

  mapMarkers.push(tempMarker);
  setMapStatus(`Focused on ${name}`);
}

/* CHATBOT */
let messages = [
  {
    type: "bot",
    text: "Hi! I can help you find volunteers, needs, matches, and map locations."
  }
];

function toggleChat() {
  const chatbot = document.getElementById("chatbot");
  if (!chatbot) return;
  chatbot.classList.toggle("hidden");
  renderMessages();
}

function renderMessages() {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  container.innerHTML = "";

  messages.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `message ${msg.type}`;
    div.innerText = msg.text;
    container.appendChild(div);
  });

  container.scrollTop = container.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  messages.push({ type: "user", text });
  renderMessages();
  input.value = "";

  setTimeout(() => {
    messages.push({ type: "bot", text: getBotResponse(text) });
    renderMessages();
  }, 700);
}

function handleKeyPress(e) {
  if (e.key === "Enter") {
    sendMessage();
  }
}

function getBotResponse(userText) {
  const text = userText.toLowerCase();

  if (text.includes("match")) {
    const matches = createMatches();
    return matches.length > 0
      ? `I found ${matches.length} possible volunteer matches. Check the Matching Results section.`
      : "No matches yet. Add more needs or volunteers to generate matches.";
  }

  if (text.includes("volunteer")) {
    return `There are currently ${volunteers.length} registered volunteers in the system.`;
  }

  if (text.includes("need")) {
    return `There are currently ${needs.length} community needs added.`;
  }

  if (text.includes("urgent") || text.includes("priority")) {
    const highNeed = needs.find((n) => n.urgency === "high");
    return highNeed
      ? `The highest priority need right now is: ${highNeed.description} in ${highNeed.location}.`
      : "No high urgency needs have been added yet.";
  }

  if (text.includes("map")) {
    return "The map now uses real location search. Add a need with a city name to see it appear on the map.";
  }

  return [
    "I can help you check volunteers, needs, urgent cases, matches, and map locations.",
    "Try asking about urgent needs, volunteer count, or matches.",
    "Add a city in the need form and it will appear on the live map.",
    "The dashboard updates automatically when you add data."
  ][Math.floor(Math.random() * 4)];
}

/* HELPERS */
function shortenText(text, maxLength) {
  const safeText = String(text || "");
  return safeText.length > maxLength ? safeText.slice(0, maxLength) + "..." : safeText;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function jsEscape(str) {
  return String(str).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

/* INITIAL LOAD */
window.addEventListener("load", async function () {
  const savedName = localStorage.getItem("userName");
  const loginPage = document.getElementById("loginPage");
  const appPage = document.getElementById("appPage");
  const navUserName = document.getElementById("navUserName");

  fetch(`${API_BASE}/api/test`)
    .then((res) => res.json())
    .then((data) => console.log("Backend says:", data.message))
    .catch((err) => console.error("Error:", err));

  if (savedName) {
    if (navUserName) navUserName.innerText = savedName;
    if (loginPage) loginPage.classList.add("hidden");
    if (appPage) appPage.classList.remove("hidden");

    if (!map) initMap();
    await loadBackendData();
  } else {
    if (loginPage) loginPage.classList.remove("hidden");
    if (appPage) appPage.classList.add("hidden");
  }
});