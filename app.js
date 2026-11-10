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
let topologyData = [];
let leanTopology = [];
let pendingClickTarget = null;

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
        { id: 101, time: "09:00", title: "Fimbabahn A3", type: "lift", anchorRef: "node_ischgl", createdBy: "אלעד", createdAt: Date.now() },
        { id: 102, time: "09:30", title: "מסלול 6", type: "blue", anchorRef: "node_idalp", createdBy: "אלעד", createdAt: Date.now() },
        { id: 103, time: "10:30", title: "מסלול 23", type: "blue", anchorRef: "node_hollboden", createdBy: "אלעד", createdAt: Date.now() },
        { id: 104, time: "11:30", title: "Höllkarbahn C2", type: "lift", anchorRef: "node_hollboden", createdBy: "אלעד", createdAt: Date.now() },
        { id: 108, time: "13:00", title: "Höllbodenbahn C1", type: "lift", anchorRef: "node_idalp", createdBy: "אלעד", createdAt: Date.now() },
        { id: 109, time: "13:30", title: "Flimjochbahn B2", type: "lift", anchorRef: "node_viderjoch", createdBy: "אלעד", createdAt: Date.now() },
        { id: 110, time: "14:30", title: "מסעדת Idalp", type: "break", anchorRef: "node_idalp", createdBy: "אלעד", createdAt: Date.now() },
        { id: 112, time: "15:30", title: "מסלול 1 למטה", type: "red", anchorRef: "node_ischgl", createdBy: "אלעד", createdAt: Date.now() }
    ];
}

async function loadTopology() {
    try {
        const response = await fetch('topology.json');
        topologyData = await response.json();

        // יצירת הגרסה הרזה לחיסכון בטוקנים ל-Gemini: נזרקים קואורדינטות ושדות מיותרים
        leanTopology = topologyData.map(item => ({
            ID: item.ID,
            Type: item.Type,
            leads_to: item.leads_to
        }));
        
        console.log("Topology loaded! Total items:", topologyData.length);
    } catch (error) {
        console.error("שגיאה בטעינת המפה:", error);
    }
}

window.onload = async () => {
    await loadTopology();
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
    renderHistoryList();
};

function changeCurrentUser(name) {
    currentUser = name;
    localStorage.setItem('ischgl_current_user', name);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    
    // סינכרון בר הניווט במובייל מול מצב התפריט
    const navBar = document.getElementById('mobile-nav-bar');
    if (navBar) {
        if (sidebar.classList.contains('collapsed')) {
            // התפריט סגור - הצג את בר הניווט
            navBar.style.display = ''; 
            updateNavModeBar();
        } else {
            // התפריט פתוח - הסתר את בר הניווט למניעת עומס ויזואלי
            navBar.style.display = 'none'; 
        }
    }
}

function restoreOriginalDay1() {
    if (currentUser === 'אורח') return alert("אורח אינו מורשה לבצע שינויים בלו\"ז.");
    if (confirm("שחזור לו\"ז יום 1 המקורי? נקודות קיימות ביום 1 יוחלפו.")) {
        itineraryData[1] = getDay1Baseline();
        saveLocal();
        
        // איפוס סמן הניווט לתחילת היום עקב החלפת הנתונים
        currentNavStepIndex = 0; 
        
        renderItinerary(); // קריאה זו כבר מעדכנת את בר הניווט בסופה
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
// Accurate map centering logic (fixed for RTL layout)
function moveIndicator(xPercent, yPercent) {
    const indicator = document.getElementById('indicator');
    const img = document.getElementById('map-image');
    const container = document.getElementById('map-container');

    if (!img.complete || img.clientWidth === 0) return;

    // הכרחת כיווניות LTR על מיכל המפה למניעת היפוך גלילה בערבית/עברית
    container.style.direction = 'ltr';

    const xPx = (xPercent / 100) * img.clientWidth;
    const yPx = (yPercent / 100) * img.clientHeight;

    indicator.style.left = xPx + 'px';
    indicator.style.top = yPx + 'px';
    indicator.classList.remove('blinking');
    void indicator.offsetWidth; 
    indicator.classList.add('blinking');

    // חישוב מרכוז אופקי ואנכי מדויק
    const targetScrollLeft = xPx - (container.clientWidth / 2);
    const targetScrollTop = yPx - (container.clientHeight / 2);

    container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
    });
}

// --- MAP CLICK HANDLER ---
document.getElementById('map-image').addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / this.width) * 100;
    const yPercent = ((e.clientY - rect.top) / this.height) * 100;

    if (currentActiveTab === 'tab-builder') {
        if (currentUser === 'אורח') return alert("אורח אינו מורשה להוסיף נקודות חדשות.");
        pendingClickTarget = { x: xPercent, y: yPercent };
        moveIndicator(xPercent, yPercent);
        populateAnchorDropdown();
        document.getElementById('modal-overlay').style.display = 'flex';
        document.getElementById('modal-title').value = '';
    }
});

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; pendingClickTarget = null; }

function populateAnchorDropdown() {
    const select = document.getElementById('modal-anchor-ref');
    // מסננים רק את הצמתים (Nodes) מתוך מסד הנתונים
    const nodes = topologyData.filter(item => item.Type === 'node');
    select.innerHTML = `<option value="">-- ללא עוגן --</option>` + 
        nodes.map(n => `<option value="${n.ID}">${n.Name} (${n.ID})</option>`).join('');
}

function saveNewPoint() {
    const day = document.getElementById('modal-day').value;
    const time = document.getElementById('modal-time').value;
    const title = document.getElementById('modal-title').value || "נקודת ציון";
    const type = document.getElementById('modal-type').value;
    const anchorRef = document.getElementById('modal-anchor-ref').value;
    if (!pendingClickTarget) return closeModal();

    let finalDesc = "";
    
    // שליפת השם הרשמי ממסד הנתונים של המפה (אם קיים)
    const topologyMatch = topologyData.find(item => 
        item.ID.toLowerCase() === title.toLowerCase() || 
        item.Name.toLowerCase() === title.toLowerCase() ||
        (item.Type !== 'node' && item.ID.includes(`_${title.toLowerCase()}`))
    );

    if (topologyMatch) {
        finalDesc = `${topologyMatch.Name} (${topologyMatch.Type})`;
    }

    const newStep = {
        id: Date.now(), time, type, title, desc: finalDesc,
        anchorRef, x: pendingClickTarget.x, y: pendingClickTarget.y,
        createdBy: currentUser, createdAt: Date.now()
    };

    if (!itineraryData[day]) itineraryData[day] = [];
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
    
    if (steps.length === 0) {
        list.innerHTML = `<div style="padding:15px; text-align:center; color:#888;">הלו"ז ריק.</div>`;
        updateNavModeBar(); // קריאה לעדכון הבר (יסתיר אותו כי אין נתונים)
        return;
    }
    
    const typeLabels = { 'lift': 'ליפט', 'blue': 'כחול', 'red': 'אדום', 'black': 'שחור', 'break': 'עצירה' };
    const now = Date.now();

    list.innerHTML = steps.map(step => {
        const isElad = currentUser === 'אלעד';
        const isCreatorWithin5Min = (step.createdBy === currentUser) && ((now - (step.createdAt || 0)) < 5 * 60 * 1000);
        const canDelete = (currentUser !== 'אורח') && (isElad || isCreatorWithin5Min);

        return `
        <div class="step" id="step-${step.id}" onclick="selectStep(${day}, ${step.id})">
            <div class="step-time">${step.time}</div>
            <div class="step-details">
                <div class="step-title">${step.title}</div>
                <span class="step-type type-${step.type}">${typeLabels[step.type] || step.type}</span>
                ${step.desc ? `<div style="font-size:0.75rem; margin-top:4px;">${step.desc}</div>` : ''}
                ${step.warning ? `<div class="step-warning">${step.warning}</div>` : ''}
                <div class="step-meta">עודכן על ידי: ${step.createdBy || 'מנהל'}</div>
            </div>
            ${canDelete ? `<button class="delete-btn" onclick="deleteStep(event, ${day}, ${step.id})">✖</button>` : ''}
        </div>`;
    }).join('');

    // עדכון בר הניווט לאחר סיום הרינדור
    updateNavModeBar();
    drawDayRoute();
}
function deleteStep(event, day, id) {
    event.stopPropagation(); // מונע את סימון השלב ברקע בזמן שלוחצים על כפתור המחיקה
    if (confirm("האם אתה בטוח שברצונך למחוק שלב זה מהלוז?")) {
        itineraryData[day] = itineraryData[day].filter(step => step.id !== id);
        saveLocal();
        renderItinerary();
    }
}

function selectStep(day, id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('selected'));
    const el = document.getElementById(`step-${id}`);
    if (el) el.classList.add('selected');
    
    const steps = itineraryData[day] || [];
    const stepIndex = steps.findIndex(s => s.id === id);
    const step = steps[stepIndex];
    if(!step) return;
    
    // סינכרון בר הניווט ללחיצה על שלב ספציפי
    currentNavStepIndex = stepIndex !== -1 ? stepIndex : 0;
    updateNavModeBar();
    
    let tX = step.x, tY = step.y;
    if (step.anchorRef) {
        const node = topologyData.find(n => n.ID === step.anchorRef);
        if (node && node.x !== null && node.x !== undefined) { 
            tX = (node.x / document.getElementById('map-image').naturalWidth) * 100;
            tY = (node.y / document.getElementById('map-image').naturalHeight) * 100;
        }
    }
    moveIndicator(tX, tY);
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

async function generateAIItinerary() {
    if (currentUser === 'אורח') return alert("אורח אינו מורשה ליצור לו\"ז ב-AI.");
    
    const promptText = document.getElementById('ai-prompt').value;
    if (!promptText.trim()) return alert("אנא הזן בקשה ללו\"ז.");

    const statusEl = document.getElementById('ai-status');
    const previewContainer = document.getElementById('ai-preview-container');
    
    statusEl.style.display = 'block';
    previewContainer.style.display = 'none';

    const currentTripContext = JSON.stringify(itineraryData);

    const systemPrompt = `
    You are an expert snowboard and ski trip planner for Ischgl. 
    Create an itinerary based on this user request: "${promptText}".

    CRITICAL ROUTING RULES:
    1. You MUST ONLY use the pistes, lifts, and connections defined in the following TOPOLOGY GRAPH (JSON format). You cannot suggest a route that is not logically connected in this graph: ${JSON.stringify(leanTopology)}
    2. Keep the routes logical for the requested skill level.

    EXISTING ITINERARY CONTEXT:
    ${currentTripContext}

    OUTPUT FORMAT RULES:
    1. Output ONLY a raw, valid JSON array of objects. No markdown formatting, no backticks, no text outside the JSON.
    2. Each object must have EXACTLY these keys:
    - time (string, format HH:MM)
    - title (string, name of lift, piste, or activity)
    - type (string, strictly one of: "lift", "blue", "red", "black", "break")
    - desc (string, short explanation in Hebrew)
    - anchorRef (string, MUST be a valid node ID from the topology graph, e.g., "node_idalp" or "node_alp_bella". Use "" if none fits)
    3. Keep the itinerary concise: maximum of 10 to 12 steps per day.
    `;

    try {
        // Send text only - no image
        const requestParts = [{ text: systemPrompt }];

        let response;
        let retries = 5;
        let delay = 5000; 

        while (retries > 0) {
            response = await fetch('https://gemini-proxy.eladafriat1122.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: requestParts }],
                    // Force fast execution and strict JSON to prevent Cloudflare 524 Timeout
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (response.status === 503) {
                console.warn(`השרת עמוס (503). מנסה שוב... נותרו ${retries - 1} ניסיונות.`);
                retries--;
                if (retries === 0) {
                    throw new Error("השרתים של גוגל עמוסים כרגע. אנא נסה שוב בעוד דקה.");
                }
                await new Promise(res => setTimeout(res, delay));
            } else {
                break;
            }
        }

        if (!response.ok) {
            let errorDetails = "";
            try {
                const errorJson = await response.json();
                errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
            } catch (e) {
                errorDetails = "לא ניתן לפענח את תשובת השגיאה";
            }
            throw new Error(`דחייה מגוגל (400): ${errorDetails}`);
        }

        const data = await response.json();
        
        if (data.error) {
            console.error("Gemini API Error:", data.error);
            throw new Error(data.error.message || "שגיאה מהשרת");
        }

        let aiText = data.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        pendingAIItinerary = JSON.parse(aiText);
        renderAIPreview();
        statusEl.style.display = 'none';

    } catch (error) {
        console.error("Error calling AI:", error);
        alert("אירעה שגיאה: " + error.message);
        statusEl.style.display = 'none';
    }
}

function renderAIPreview() {
    const listEl = document.getElementById('ai-preview-list');
    const typeLabels = { 'lift': 'ליפט', 'blue': 'כחול', 'red': 'אדום', 'black': 'שחור', 'break': 'עצירה' };
    
    listEl.innerHTML = pendingAIItinerary.map(step => `
        <div class="ai-preview-item">
            <div class="ai-preview-time">${step.time}</div>
            <div class="ai-preview-details">
                <strong style="display:block;">${step.title}</strong>
                <span class="step-type type-${step.type}" style="margin:2px 0;">${typeLabels[step.type] || step.type}</span>
                <div style="font-size:0.75rem; margin-top:2px;">${step.desc}</div>
                <div style="font-size:0.7rem; color:#888;">עוגן מפה: ${step.anchorRef || 'ללא'}</div>
            </div>
        </div>
    `).join('');

    document.getElementById('ai-preview-container').style.display = 'block';
}

function cancelAIPreview() {
    pendingAIItinerary = [];
    document.getElementById('ai-preview-container').style.display = 'none';
    document.getElementById('ai-prompt').value = '';
}

function approveAIItinerary() {
    const day = document.getElementById('ai-target-day').value;
    
    // Inject system metadata into each AI generated step
    const processedSteps = pendingAIItinerary.map((step, index) => {
        return {
            ...step,
            id: Date.now() + index, // Ensure unique IDs
            createdBy: currentUser + ' (AI)',
            createdAt: Date.now()
        };
    });

    // Merge into existing day
    if (!itineraryData[day]) itineraryData[day] = [];
    itineraryData[day] = [...itineraryData[day], ...processedSteps];
    
    // Sort day by time
    itineraryData[day].sort((a, b) => a.time.localeCompare(b.time));
    
    // Save, Update UI, and Switch to Itinerary Tab
    saveLocal();
    document.getElementById('view-day-select').value = day;
    renderItinerary();
    switchTab('tab-itinerary');
    
    // Cleanup AI state
    cancelAIPreview();
    
    // Remind user to push
    document.getElementById('cloud-status').innerText = "יש שינויים מקומיים - לחץ פרסם לענן";
    document.getElementById('cloud-status').style.color = "#dc3545";
}
// --- MOBILE NAVIGATION MODE ---
let currentNavStepIndex = 0;

function updateNavModeBar() {
    const navBar = document.getElementById('mobile-nav-bar');
    if (!navBar) return;
    
    const day = document.getElementById('view-day-select').value;
    const steps = itineraryData[day] || [];

    if (steps.length === 0) {
        navBar.classList.add('hidden');
        return;
    }

    if (currentNavStepIndex < 0) currentNavStepIndex = 0;
    if (currentNavStepIndex >= steps.length) currentNavStepIndex = steps.length - 1;

    const step = steps[currentNavStepIndex];

    document.getElementById('nav-time').textContent = step.time || '';
    document.getElementById('nav-title').textContent = step.title || '';
    document.getElementById('nav-desc').textContent = step.desc || '';
    
    const typeEl = document.getElementById('nav-type');
    typeEl.textContent = step.type || '';
    typeEl.className = `badge type-${step.type}`; 

    document.getElementById('nav-prev').disabled = (currentNavStepIndex === 0);
    document.getElementById('nav-next').disabled = (currentNavStepIndex === steps.length - 1);

    navBar.classList.remove('hidden');

    // שליפת קואורדינטות (מעוגן או מהשלב עצמו)
    let targetX = step.x;
    let targetY = step.y;

    if (step.anchorRef) {
        const node = topologyData.find(n => n.ID === step.anchorRef);
        if (node && node.x !== null && node.x !== undefined) { 
            // המרה חזרה מהפיקסלים המוחלטים ב-JSON לאחוזים יחסיים של המפה
            targetX = (node.x / document.getElementById('map-image').naturalWidth) * 100;
            targetY = (node.y / document.getElementById('map-image').naturalHeight) * 100;
        }
    }

    // מיקוד המפה והזזת הסמן
    if (targetX && targetY) {
        focusMapOnPoint(targetX, targetY);
        if (typeof moveIndicator === 'function') {
            moveIndicator(targetX, targetY);
        }
    }
}
function nextNavStep() {
    const day = document.getElementById('view-day-select').value;
    const steps = itineraryData[day] || [];
    if (currentNavStepIndex < steps.length - 1) {
        currentNavStepIndex++;
        updateNavModeBar();
    }
}

function prevNavStep() {
    if (currentNavStepIndex > 0) {
        currentNavStepIndex--;
        updateNavModeBar();
    }
}

function focusMapOnPoint(xPercent, yPercent) {
    const mapContainer = document.getElementById('map-container');
    const mapImage = document.getElementById('map-image');
    if (!mapContainer || !mapImage) return;

    const pixelX = (xPercent / 100) * mapImage.offsetWidth;
    const pixelY = (yPercent / 100) * mapImage.offsetHeight;

    mapContainer.scrollTo({
        left: pixelX - (mapContainer.clientWidth / 2),
        top: pixelY - (mapContainer.clientHeight / 2),
        behavior: 'smooth'
    });
}
