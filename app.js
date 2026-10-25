// --- CLOUD DB CONFIGURATION (JSONBin.io) ---
const BIN_ID = "6ad9fdfaffd5d1605382786d";
const API_KEY = "$2a$10$dSqj7XBPfPV5gDNYt8wWCupc8hA5.iaFcdm8EJAy23Dh2cab9sptm";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// Local Application State
let itineraryData = JSON.parse(localStorage.getItem('ischgl_itinerary')) || { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
let anchorsData = JSON.parse(localStorage.getItem('ischgl_anchors')) || {};
let historyData = JSON.parse(localStorage.getItem('ischgl_history')) || [];
let currentUser = localStorage.getItem('ischgl_current_user') || 'אלעד';

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

// --- REAL-WORLD PISTE DATABASE FOR ISCHGL ---
const pisteDB = {
    "1": { desc: "ירידת עמק לאישגל (Valley Run).", alert: "⚠️ סנובורד: נוטה לקרח ועומס בסוף היום. קטעים תלולים ליד Schatzi bar." },
    "2b": { desc: "פנינה נסתרת. מסלול שקט ששומר על תנאים טובים גם אחה\"צ.", alert: "" },
    "6": { desc: "מסלול כחול קלאסי. מצוין לחימום בוקר מ-Pardorama.", alert: "" },
    "7": { desc: "מסלול אדום ארוך ורחב (Endless slope).", alert: "" },
    "14a": { desc: "Lange Wand. המסלול התלול באתר.", alert: "⚠️ סנובורד: שיפוע קיצוני של 70%. דורש שליטה מוחלטת באדג'ים." },
    "20": { desc: "מסלול שחור מקביל.", alert: "⚠️ סנובורד: Blind start - לא ניתן לראות את השיפוע מתחילת המסלול." },
    "21": { desc: "מסלול שחור מקביל.", alert: "⚠️ סנובורד: Blind start - לא ניתן לראות את השיפוע מתחילת המסלול." },
    "23": { desc: "מסלול כחול ארוך. פופולרי מאוד.", alert: "⚠️ סנובורד: עמוס מאוד ולעיתים נוצרים מוגולים (Bumps) שמקשים על הגלישה." },
    "38": { desc: "מסלול קשוח עם שיפוע צד (Hanging slope).", alert: "⚠️ סנובורד: נוטה להיות קרחי וקשה לאחיזת סנובורד." },
    "42": { desc: "Ski Route (אוף-פיסט מסומן). לא חתול.", alert: "⚠️ סנובורד: חובה לצבור מהירות בסוף המסלול כדי לא להיתקע בעלייה חזרה." },
    "63": { desc: "מסלול אדום נסתר. מעולה לקארבינג.", alert: "⚠️ סנובורד: צבור מהירות לקראת הסוף כדי להגיע לליפט." },
    "80": { desc: "Duty Free Run לסמאנון (שווייץ).", alert: "⚠️ סנובורד: מקטע שטוח ארוך מאוד בסוף. לשמור מהירות או להיערך להליכה." }
};

// --- LIVE WEATHER API (Open-Meteo) ---
async function fetchLiveWeather() {
    try {
        // Fetching data for Idalp, Ischgl (Lat: 47.01, Lon: 10.29, Elev: ~2300m)
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=47.01&longitude=10.29&current=temperature_2m,weather_code&timezone=auto");
        const data = await res.json();
        
        const temp = data.current.temperature_2m;
        const code = data.current.weather_code;
        
        let weatherDesc = "מעונן / רגיל";
        let gogglesRec = "עדשת S2 (ורוד/כתום) למצבי אור משתנים.";
        let layersRec = "שכבה תרמית + מעיל.";

        // Decode weather codes
        if (code === 0 || code === 1) {
            weatherDesc = "שמיים בהירים (Bluebird) ☀️";
            gogglesRec = "עדשת S3 (כהה/מראה) - סנוור גבוה מהשלג.";
        } else if (code >= 2 && code <= 3) {
            weatherDesc = "מעונן ☁️";
            gogglesRec = "עדשת S1/S2 - תנאי Flat Light.";
        } else if (code >= 45 && code <= 48) {
            weatherDesc = "ערפל כבד 🌫️";
            gogglesRec = "עדשת S1 צהובה/בהירה - ראות לקויה.";
        } else if (code >= 51 && code <= 67) {
            weatherDesc = "גשם קל/מעורב 🌧️";
            gogglesRec = "עדשת S1.";
        } else if (code >= 71 && code <= 77) {
            weatherDesc = "שלג יורד ❄️";
            gogglesRec = "עדשת S1 בהירה לניגודיות גבוהה.";
        }

        if (temp < -8) {
            layersRec = "קר מאוד. חובה להוסיף שכבת פליז (Mid-layer) וחם-צוואר.";
        } else if (temp > 2) {
            layersRec = "חם מהרגיל. ניתן לשקול גלישה ללא Mid-layer לאוורור.";
        }

        document.getElementById('weather-live-temp').innerText = `${temp}°C`;
        document.getElementById('weather-live-desc').innerText = weatherDesc;
        document.getElementById('weather-live-goggles').innerText = gogglesRec;
        document.getElementById('weather-live-layers').innerText = layersRec;
        document.getElementById('weather-status').innerText = "מעודכן בזמן אמת (Idalp)";
        document.getElementById('weather-status').style.color = "#198754";

    } catch (e) {
        document.getElementById('weather-status').innerText = "שגיאה במשיכת נתונים, מוצג מידע ברירת מחדל.";
    }
}

// Baseline Day 1 Itinerary Generator
function getDay1Baseline() {
    return [
        { id: 101, time: "09:00", title: "Fimbabahn A3", type: "lift", desc: "עלייה מתחנת העיירה.", anchorRef: "תחנת הבסיס Fimbabahn A3", x: 70, y: 80, createdBy: "אלעד", createdAt: Date.now() },
        { id: 102, time: "09:30", title: "מסלול 6", type: "blue", desc: pisteDB["6"].desc, anchorRef: "Idalp", x: 50, y: 50, createdBy: "אלעד", createdAt: Date.now() },
        { id: 103, time: "10:30", title: "מסלול 23", type: "blue", desc: pisteDB["23"].desc, warning: pisteDB["23"].alert, anchorRef: "Höllboden", x: 62, y: 51, createdBy: "אלעד", createdAt: Date.now() },
        { id: 104, time: "11:30", title: "Höllkarbahn C2", type: "lift", desc: "עלייה מ-Höllboden.", anchorRef: "Höllboden", x: 62, y: 51, createdBy: "אלעד", createdAt: Date.now() },
        { id: 106, time: "11:50", title: "Zeblasbahn D2", type: "lift", desc: "טיפוס לפלינקופף.", x: 59, y: 43, createdBy: "אלעד", createdAt: Date.now() },
        { id: 108, time: "13:00", title: "Höllbodenbahn C1", type: "lift", desc: "עלייה ל-Idalp.", anchorRef: "Idalp", x: 50, y: 50, createdBy: "אלעד", createdAt: Date.now() },
        { id: 109, time: "13:30", title: "Flimjochbahn B2", type: "lift", desc: "עלייה ל-Viderjoch.", anchorRef: "Viderjoch", x: 44, y: 46, createdBy: "אלעד", createdAt: Date.now() },
        { id: 110, time: "14:30", title: "מסעדת Idalp", type: "break", desc: "הפסקת צהריים.", anchorRef: "Idalp", x: 50, y: 50, createdBy: "אלעד", createdAt: Date.now() },
        { id: 112, time: "15:30", title: "מסלול 1 למטה", type: "red", desc: pisteDB["1"].desc, warning: pisteDB["1"].alert, anchorRef: "תחנת הבסיס Fimbabahn A3", x: 70, y: 80, createdBy: "אלעד", createdAt: Date.now() }
    ];
}

window.onload = () => {
    document.getElementById('user-select').value = currentUser;
    if (itineraryData[1].length === 0) {
        itineraryData[1] = getDay1Baseline();
        saveLocal();
    }
    
    // Check if BIN_ID is updated, avoid fetching if default template
    if (BIN_ID !== "YOUR_BIN_ID_HERE") {
        pullFromCloud();
    } else {
        document.getElementById('cloud-status').innerText = "מופעל מקומית";
        renderItinerary();
    }
    
    fetchLiveWeather();
    renderAnchorsList();
    renderHistoryList();
};

function changeCurrentUser(name) {
    currentUser = name;
    localStorage.setItem('ischgl_current_user', name);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function restoreOriginalDay1() {
    if (confirm("שחזור לו\"ז יום 1 המקורי? נקודות קיימות ביום 1 יוחלפו.")) {
        itineraryData[1] = getDay1Baseline();
        saveLocal();
        renderItinerary();
    }
}

function saveLocal() {
    localStorage.setItem('ischgl_itinerary', JSON.stringify(itineraryData));
    localStorage.setItem('ischgl_anchors', JSON.stringify(anchorsData));
    localStorage.setItem('ischgl_history', JSON.stringify(historyData));
}

// --- CLOUD SYNC & SMART MERGE ---
async function pullFromCloud() {
    document.getElementById('cloud-status').innerText = "משוך...";
    try {
        const response = await fetch(API_URL, { headers: { 'X-Master-Key': API_KEY } });
        const data = await response.json();
        if (data.record) {
            const cloudItinerary = data.record.itinerary || {};
            anchorsData = data.record.anchors || anchorsData;
            historyData = data.record.history || historyData;

            for (let day = 1; day <= 7; day++) {
                const localDaySteps = itineraryData[day] || [];
                const cloudDaySteps = cloudItinerary[day] || [];
                const mergedMap = new Map();
                cloudDaySteps.forEach(item => mergedMap.set(item.id, item));
                localDaySteps.forEach(item => mergedMap.set(item.id, item)); 
                itineraryData[day] = Array.from(mergedMap.values()).sort((a, b) => a.time.localeCompare(b.time));
            }

            saveLocal();
            renderItinerary();
            renderAnchorsList();
            renderHistoryList();
            document.getElementById('cloud-status').innerText = "מעודכן ✓";
            document.getElementById('cloud-status').style.color = "#198754";
        }
    } catch (error) {
        document.getElementById('cloud-status').innerText = "שגיאה";
    }
}

async function pushToCloud() {
    document.getElementById('cloud-status').innerText = "שומר...";
    const snapshot = {
        timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        updatedBy: currentUser,
        itinerarySnapshot: JSON.parse(JSON.stringify(itineraryData))
    };
    
    historyData.unshift(snapshot);
    if (historyData.length > 5) historyData.pop();

    try {
        await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
            body: JSON.stringify({ itinerary: itineraryData, anchors: anchorsData, history: historyData })
        });
        saveLocal();
        renderHistoryList();
        document.getElementById('cloud-status').innerText = "פורסם ✓";
        document.getElementById('cloud-status').style.color = "#198754";
    } catch (error) {
        document.getElementById('cloud-status').innerText = "שגיאה בענן";
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    currentActiveTab = tabId;
}

// --- MAP FOCUS ENGINE ---
function moveIndicator(xPercent, yPercent) {
    const indicator = document.getElementById('indicator');
    const img = document.getElementById('map-image');
    const container = document.getElementById('map-container');
    const xPx = (xPercent / 100) * img.width;
    const yPx = (yPercent / 100) * img.height;

    indicator.style.left = xPx + 'px';
    indicator.style.top = yPx + 'px';
    indicator.classList.remove('blinking');
    void indicator.offsetWidth; 
    indicator.classList.add('blinking');

    container.scrollTo({
        left: xPx - (container.clientWidth / 2),
        top: yPx - (container.clientHeight / 2),
        behavior: 'smooth'
    });
}

// --- MAP CLICK HANDLER ---
document.getElementById('map-image').addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / this.width) * 100;
    const yPercent = ((e.clientY - rect.top) / this.height) * 100;

    if (currentActiveTab === 'tab-builder') {
        pendingClickTarget = { x: xPercent, y: yPercent };
        moveIndicator(xPercent, yPercent);
        populateAnchorDropdown();
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

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; pendingClickTarget = null; }

function populateAnchorDropdown() {
    const select = document.getElementById('modal-anchor-ref');
    select.innerHTML = `<option value="">-- ללא עוגן --</option>` + Object.keys(anchorsData).map(a => `<option value="${a}">${a}</option>`).join('');
}

// Extract piste number and match to DB, apply fallback if missing
function saveNewPoint() {
    const day = document.getElementById('modal-day').value;
    const time = document.getElementById('modal-time').value;
    const title = document.getElementById('modal-title').value || "נקודת ציון";
    const type = document.getElementById('modal-type').value;
    const anchorRef = document.getElementById('modal-anchor-ref').value;
    if (!pendingClickTarget) return closeModal();

    let finalDesc = "";
    let finalWarning = "";

    // Regex match to find piste number in title (e.g., "14a", "6", "80")
    const match = title.match(/\b\d+[a-z]?\b/i);
    const pisteKey = match ? match[0].toLowerCase() : null;

    if (pisteKey && pisteDB[pisteKey]) {
        finalDesc = pisteDB[pisteKey].desc;
        finalWarning = pisteDB[pisteKey].alert;
    } else {
        // Fallback logic for missing piste items based on classification
        if (type === "blue") finalDesc = "מסלול כחול. אידיאלי לקארבינג עדין.";
        if (type === "red") finalDesc = "מסלול אדום. ייתכנו שיפועים המצריכים יציבות קצוות.";
        if (type === "black") finalWarning = "⚠️ מסלול שחור למתקדמים. זהירות משיפועים צדדיים.";
        if (title.includes("Samnaun") || title.includes("שווייץ")) finalWarning = "⚠️ ייתכנו מקטעים שטוחים. לשמור מהירות.";
    }

    const newStep = {
        id: Date.now(), time, type, title, desc: finalDesc, warning: finalWarning,
        anchorRef, x: pendingClickTarget.x, y: pendingClickTarget.y,
        createdBy: currentUser, createdAt: Date.now()
    };

    itineraryData[day].push(newStep);
    itineraryData[day].sort((a, b) => a.time.localeCompare(b.time));
    saveLocal();
    closeModal();
    if (document.getElementById('view-day-select').value === day) renderItinerary();
}

function renderItinerary() {
    const day = document.getElementById('view-day-select').value;
    const list = document.getElementById('itinerary-list');
    const steps = itineraryData[day] || [];
    
    if (steps.length === 0) return list.innerHTML = `<div style="padding:15px; text-align:center; color:#888;">הלו"ז ריק.</div>`;
    
    const typeLabels = { 'lift': 'ליפט', 'blue': 'כחול', 'red': 'אדום', 'black': 'שחור', 'break': 'עצירה' };
    const now = Date.now();

    list.innerHTML = steps.map(step => {
        const isElad = currentUser === 'אלעד';
        const isCreatorWithin5Min = (step.createdBy === currentUser) && ((now - (step.createdAt || 0)) < 5 * 60 * 1000);
        const canDelete = isElad || isCreatorWithin5Min;

        return `
        <div class="step" id="step-${step.id}" onclick="selectStep(${day}, ${step.id})">
            <div class="step-time">${step.time}</div>
            <div class="step-details">
                <div class="step-title">${step.title}</div>
                <span class="step-type type-${step.type}">${typeLabels[step.type]}</span>
                ${step.desc ? `<div style="font-size:0.75rem; margin-top:4px;">${step.desc}</div>` : ''}
                ${step.warning ? `<div class="step-warning">${step.warning}</div>` : ''}
                <div class="step-meta">עודכן על ידי: ${step.createdBy || 'מנהל'}</div>
            </div>
            ${canDelete ? `<button class="delete-btn" onclick="deleteStep(event, ${day}, ${step.id})">✖</button>` : ''}
        </div>`;
    }).join('');
}

function selectStep(day, id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('selected'));
    const el = document.getElementById(`step-${id}`);
    if (el) el.classList.add('selected');
    
    const step = itineraryData[day].find(s => s.id === id);
    if(!step) return;
    
    let tX = step.x, tY = step.y;
    if (step.anchorRef && anchorsData[step.anchorRef]) {
        tX = anchorsData[step.anchorRef].x;
        tY = anchorsData[step.anchorRef].y;
    }
    moveIndicator(tX, tY);
}

function deleteStep(e, day, id) {
    e.stopPropagation();
    if(confirm("למחוק פריט זה?")) {
        itineraryData[day] = itineraryData[day].filter(s => s.id !== id);
        saveLocal();
        renderItinerary();
    }
}

function renderHistoryList() {
    const list = document.getElementById('version-history-list');
    if (historyData.length === 0) return list.innerHTML = "אין גרסאות קודמות שמורות.";
    list.innerHTML = historyData.map((h, idx) => `
        <div style="padding:6px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
            <span><b>${h.timestamp}</b> ע"י ${h.updatedBy}</span>
            <button onclick="restoreVersion(${idx})" style="padding:3px 6px; font-size:0.72rem; cursor:pointer;">שחזר</button>
        </div>
    `).join('');
}

function restoreVersion(idx) {
    if (confirm("לשחזר לגרסה זו?")) {
        itineraryData = JSON.parse(JSON.stringify(historyData[idx].itinerarySnapshot));
        saveLocal();
        renderItinerary();
    }
}

function renderAnchorsList() {
    document.getElementById('calib-list-container').innerHTML = requiredAnchors.map(anchor => `
        <div style="display:flex; justify-content:space-between; padding:5px 0; font-size:0.85rem;">
            <span>${anchor}</span>
            ${anchorsData[anchor] ? `<span style="color:#198754; font-weight:bold;">✓</span>` : `<span style="color:#dc3545; font-weight:bold;">✗</span>`}
        </div>
    `).join('');
}

function startGuidedCalibration() {
    calibrationQueue = requiredAnchors.filter(a => !anchorsData[a]);
    if (calibrationQueue.length === 0) {
        if(confirm("לכייל מחדש?")) calibrationQueue = [...requiredAnchors];
        else return;
    }
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
        renderItinerary();
    }
}

function skipCurrentAnchor() { proceedToNextCalibration(); }