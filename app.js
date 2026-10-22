// --- CLOUD DB CONFIGURATION (JSONBin.io) ---
// REPLACE THESE WITH YOUR JSONBIN KEYS:
const BIN_ID = "6ad9fdfaffd5d1605382786d";
const API_KEY = "$2a$10$dSqj7XBPfPV5gDNYt8wWCupc8hA5.iaFcdm8EJAy23Dh2cab9sptm";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Local State
let itineraryData = JSON.parse(localStorage.getItem('ischgl_itinerary')) || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
let anchorsData = JSON.parse(localStorage.getItem('ischgl_anchors')) || {};
let currentActiveTab = 'tab-itinerary';
let pendingClickTarget = null;
let isGuidedCalibrating = false;
let currentCalibTarget = null;
let calibrationQueue = [];

const requiredAnchors = [
    "תחנת הבסיס Fimbabahn A3",
    "Idalp",
    "Höllboden",
    "Viderjoch",
    "Palinkopf"
];

// --- CLOUD SYNC LOGIC ---
async function pullFromCloud() {
    if (!BIN_ID || BIN_ID === "YOUR_BIN_ID_HERE") return alert("יש להזין BIN_ID ו-API_KEY בקובץ app.js כדי להשתמש בענן.");
    document.getElementById('cloud-status').innerText = "מושך נתונים...";
    try {
        const response = await fetch(API_URL, { headers: { 'X-Master-Key': API_KEY } });
        const data = await response.json();
        
        if (data.record) {
            itineraryData = data.record.itinerary || itineraryData;
            anchorsData = data.record.anchors || anchorsData;
            saveLocal();
            renderItinerary();
            renderAnchorsList();
            document.getElementById('cloud-status').innerText = "מעודכן ✓";
            document.getElementById('cloud-status').style.color = "#198754";
        }
    } catch (error) {
        console.error("Cloud pull failed:", error);
        document.getElementById('cloud-status').innerText = "שגיאת רשת";
    }
}

async function pushToCloud() {
    if (!BIN_ID || BIN_ID === "YOUR_BIN_ID_HERE") return alert("מזהי הענן חסרים ב-app.js.");
    document.getElementById('cloud-status').innerText = "שומר לענן...";
    try {
        await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
            body: JSON.stringify({ itinerary: itineraryData, anchors: anchorsData })
        });
        document.getElementById('cloud-status').innerText = "שמור ומפורסם ✓";
        document.getElementById('cloud-status').style.color = "#198754";
        alert("השינויים נשמרו בענן בהצלחה! שותפים יכולים כעת למשוך עדכונים.");
    } catch (error) {
        document.getElementById('cloud-status').innerText = "שגיאת שמירה";
    }
}

window.onload = () => {
    // Attempt to pull cloud data on initial load
    if (BIN_ID !== "YOUR_BIN_ID_HERE") {
        pullFromCloud();
    }
    renderItinerary();
    renderAnchorsList();
};

function saveLocal() {
    localStorage.setItem('ischgl_itinerary', JSON.stringify(itineraryData));
    localStorage.setItem('ischgl_anchors', JSON.stringify(anchorsData));
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    currentActiveTab = tabId;
    if (tabId !== 'tab-calibration') {
        isGuidedCalibrating = false;
        document.getElementById('calib-status-box').style.display = 'none';
    }
}

// Map Click & Smart Context Engine
document.getElementById('map-image').addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / this.width) * 100;
    const yPercent = ((e.clientY - rect.top) / this.height) * 100;

    if (currentActiveTab === 'tab-builder') {
        pendingClickTarget = { x: xPercent, y: yPercent };
        moveIndicator(xPercent, yPercent);
        populateAnchorDropdown();
        analyzeContextAndSuggest(xPercent, yPercent); // Trigger smart suggestions
        
        document.getElementById('modal-overlay').style.display = 'flex';
        document.getElementById('modal-title').value = '';
    }
    else if (currentActiveTab === 'tab-calibration' && isGuidedCalibrating && currentCalibTarget) {
        anchorsData[currentCalibTarget] = { x: xPercent, y: yPercent };
        saveLocal();
        renderAnchorsList();
        moveIndicator(xPercent, yPercent);
        proceedToNextCalibration();
    }
});

function moveIndicator(xPercent, yPercent) {
    const indicator = document.getElementById('indicator'), img = document.getElementById('map-image'), container = document.getElementById('map-container');
    const xPx = (xPercent / 100) * img.width, yPx = (yPercent / 100) * img.height;
    indicator.style.left = xPx + 'px'; indicator.style.top = yPx + 'px';
    indicator.classList.remove('blinking'); void indicator.offsetWidth; indicator.classList.add('blinking');
    container.scrollTo({ left: xPx - (container.clientWidth / 2), top: yPx - (container.clientHeight / 2), behavior: 'smooth' });
}

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; pendingClickTarget = null; }

function populateAnchorDropdown() {
    const select = document.getElementById('modal-anchor-ref');
    select.innerHTML = `<option value="">-- השתמש במיקום הלחיצה --</option>` + Object.keys(anchorsData).map(a => `<option value="${a}">${a}</option>`).join('');
}

// --- CONTEXT AWARE SUGGESTIONS ---
function analyzeContextAndSuggest(x, y) {
    const suggBox = document.getElementById('smart-suggestions');
    const zoneName = document.getElementById('detected-zone');
    const btns = document.getElementById('suggestion-buttons');
    suggBox.style.display = 'none';

    // Dummy coordinate logic (adjust based on your actual calibrated points)
    // If clicked near center (Idalp approx x:45-55, y:45-55)
    if (x > 40 && x < 60 && y > 40 && y < 60) {
        suggBox.style.display = 'block';
        zoneName.innerText = "Idalp";
        btns.innerHTML = `
            <button onclick="applyQuickAdd('Flimjochbahn B2', 'lift', 'Idalp')" style="background:#0d6efd; color:white; border:none; padding:5px; border-radius:4px; font-size:0.75rem; cursor:pointer;">+ ליפט B2</button>
            <button onclick="applyQuickAdd('מסלול 11 חזרה', 'blue', 'Idalp')" style="background:#0d6efd; color:white; border:none; padding:5px; border-radius:4px; font-size:0.75rem; cursor:pointer;">+ מסלול 11</button>
            <button onclick="applyQuickAdd('ארוחת צהריים - Restaurant Idalp', 'break', 'Idalp')" style="background:#198754; color:white; border:none; padding:5px; border-radius:4px; font-size:0.75rem; cursor:pointer;">+ מסעדה</button>
        `;
    }
    // If clicked near Palinkopf (upper right)
    else if (x > 50 && x < 70 && y > 20 && y < 40) {
        suggBox.style.display = 'block';
        zoneName.innerText = "Palinkopf";
        btns.innerHTML = `
            <button onclick="applyQuickAdd('מסלול 40 לסמאנון', 'red', 'Palinkopf')" style="background:#dc3545; color:white; border:none; padding:5px; border-radius:4px; font-size:0.75rem; cursor:pointer;">+ ירידה 40</button>
            <button onclick="applyQuickAdd('תצפית פסגה', 'break', 'Palinkopf')" style="background:#198754; color:white; border:none; padding:5px; border-radius:4px; font-size:0.75rem; cursor:pointer;">+ תצפית</button>
        `;
    }
}

function applyQuickAdd(title, type, anchorFallback) {
    document.getElementById('modal-title').value = title;
    document.getElementById('modal-type').value = type;
    // Auto-select anchor if it exists in calibration
    if(anchorsData[anchorFallback]) {
        document.getElementById('modal-anchor-ref').value = anchorFallback;
    }
}

// Save with Snowboard specific warnings
function saveNewPoint() {
    const day = document.getElementById('modal-day').value;
    const time = document.getElementById('modal-time').value;
    const title = document.getElementById('modal-title').value || "נקודת ציון";
    const type = document.getElementById('modal-type').value;
    const anchorRef = document.getElementById('modal-anchor-ref').value;
    if (!pendingClickTarget) return closeModal();

    let autoDesc = "";
    
    // SNOWBOARD SMART TAGS
    if (title.includes("80") || title.includes("Samnaun") || title.includes("שווייץ")) {
        autoDesc = "⚠️ סנובורד: כולל מקטעים שטוחים. לא לאבד מהירות לקראת הסוף!";
    } else if (title.includes("14a")) {
        autoDesc = "⚠️ שיפוע חריף במיוחד (מעל 70%). לשמור על אדג'ים.";
    } else if (type === "blue") {
        autoDesc = "מסלול נוח לבניית ביטחון וקארבינג.";
    }

    itineraryData[day].push({ id: Date.now(), time, type, title, desc: autoDesc, anchorRef, x: pendingClickTarget.x, y: pendingClickTarget.y });
    itineraryData[day].sort((a, b) => a.time.localeCompare(b.time));
    saveLocal();
    closeModal();
    if (document.getElementById('view-day-select').value === day) renderItinerary();
    
    // Suggest pushing to cloud
    document.getElementById('cloud-status').innerText = "שינויים ממתינים...";
    document.getElementById('cloud-status').style.color = "#dc3545";
}

function renderItinerary() {
    const day = document.getElementById('view-day-select').value, list = document.getElementById('itinerary-list'), steps = itineraryData[day] || [];
    if (steps.length === 0) return list.innerHTML = `<div style="padding:20px; text-align:center; color:#888;">הלו"ז ריק.</div>`;
    const typeLabels = { 'lift': 'ליפט', 'blue': 'כחול', 'red': 'אדום', 'black': 'שחור', 'break': 'עצירה' };
    list.innerHTML = steps.map(step => `
        <div class="step" id="step-${step.id}" onclick="selectStep(${day}, ${step.id})">
            <div class="step-time">${step.time}</div>
            <div class="step-details">
                <div class="step-title">${step.title}</div>
                <span class="step-type type-${step.type}">${typeLabels[step.type]}</span>
                ${step.desc ? `<div class="step-desc" style="margin-top:5px; font-weight:bold; color:#dc3545;">${step.desc}</div>` : ''}
            </div>
            <button class="delete-btn" onclick="deleteStep(event, ${day}, ${step.id})">✖</button>
        </div>
    `).join('');
}

function selectStep(day, id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('selected'));
    document.getElementById(`step-${id}`).classList.add('selected');
    const step = itineraryData[day].find(s => s.id === id);
    if(!step) return;
    let tX = step.x, tY = step.y;
    if (step.anchorRef && anchorsData[step.anchorRef]) { tX = anchorsData[step.anchorRef].x; tY = anchorsData[step.anchorRef].y; }
    moveIndicator(tX, tY);
}

function deleteStep(e, day, id) {
    e.stopPropagation();
    if(confirm("למחוק?")) { itineraryData[day] = itineraryData[day].filter(s => s.id !== id); saveLocal(); renderItinerary(); }
}

// Calibration Engine 
function renderAnchorsList() {
    document.getElementById('calib-list-container').innerHTML = requiredAnchors.map(anchor => `
        <div class="calib-item">
            <span>${anchor}</span>
            ${anchorsData[anchor] ? `<span class="status-icon status-done">✓</span>` : `<span class="status-icon status-pending">✗</span>`}
        </div>
    `).join('');
}
function startGuidedCalibration() {
    calibrationQueue = requiredAnchors.filter(a => !anchorsData[a]);
    if (calibrationQueue.length === 0) { if(confirm("לכייל מחדש הכל?")) calibrationQueue = [...requiredAnchors]; else return; }
    isGuidedCalibrating = true;
    document.getElementById('calib-status-box').style.display = 'block';
    proceedToNextCalibration();
}
function proceedToNextCalibration() {
    if (calibrationQueue.length > 0) {
        currentCalibTarget = calibrationQueue.shift();
        document.getElementById('current-calib-target').innerText = currentCalibTarget;
    } else {
        isGuidedCalibrating = false;
        document.getElementById('calib-status-box').style.display = 'none';
        alert("כיול הושלם!"); renderItinerary();
    }
}
function skipCurrentAnchor() { proceedToNextCalibration(); }