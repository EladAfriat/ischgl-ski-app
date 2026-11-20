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

        // Preserve full enriched dataset for local routing and duration calculations
        leanTopology = topologyData;

        console.log("Topology loaded! Total items:", topologyData.length);
    } catch (error) {
        console.error("Error loading topology:", error);
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

function parseTimeToMinutes(timeStr = "09:00") {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 9 * 60;
    return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes) {
    const wrapped = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(wrapped / 60) % 24;
    const minutes = wrapped % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeTopologyGraph(rawTopology) {
    const items = Array.isArray(rawTopology) ? rawTopology : Object.values(rawTopology || {});
    const itemMap = new Map();
    const nodes = [];

    for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const id = raw.ID || raw.id;
        if (!id) continue;

        const name = raw.Name || raw.name || raw.officialTitle || id;
        const rawType = String(raw.Type || raw.type || '').toLowerCase();
        const rawDiff = String(raw.Difficulty || raw.difficulty || '').toLowerCase();

        let category = rawType;
        if (rawType === 'slope' && ['blue', 'red', 'black'].includes(rawDiff)) {
            category = rawDiff;
        }

        const normalized = {
            id,
            name,
            officialTitle: raw.officialTitle || name,
            category,
            liftCategory: raw.liftCategory || null,
            leadsTo: Array.isArray(raw.leads_to) ? raw.leads_to : [],
            lengthMeters: raw.lengthMeters || null,
            estimatedMinutes: raw.estimatedMinutes || (category === 'lift' ? 10 : 8),
            isSkiRoute: Boolean(raw.isSkiRoute)
        };

        itemMap.set(id, normalized);
        if (category === 'node' || id.toLowerCase().startsWith('node_')) {
            nodes.push(normalized);
        }
    }

    return { itemMap, nodes };
}

function calculateRealisticDuration(edge, currentMinutes) {
    let duration = edge.estimatedMinutes || (edge.category === 'lift' ? 8 : 6);
    let waitNote = '';

    if (edge.category === 'lift') {
        const snowboardTransition = 3; // Unstrapping, boarding, strapping in
        let queueMinutes = 0;

        const isValleyGondola = ['lift_A1', 'lift_A2', 'lift_A3'].includes(edge.id);
        if (isValleyGondola && currentMinutes >= 8 * 60 + 30 && currentMinutes <= 10 * 60 + 15) {
            queueMinutes = 12; // Morning valley bottleneck
        } else if (edge.liftCategory === 'tram') {
            queueMinutes = 6; // Aerial tramway schedule wait
        } else if (currentMinutes >= 10 * 60 + 30 && currentMinutes <= 13 * 60 + 30) {
            queueMinutes = 5; // Mid-day hub queue
        }

        duration += snowboardTransition + queueMinutes;
        if (queueMinutes > 0) {
            waitNote = ` (כולל ~${queueMinutes} דק' תור)`;
        }
    } else {
        // Short regrouping / rest buffer between runs
        duration += 3;
    }

    return { duration, waitNote };
}

function isValleyDescent(edge) {
    if (!edge || edge.category === 'lift') return false;
    return edge.isValleyRun ||
        edge.leadsTo.includes('node_ischgl') ||
        edge.leadsTo.includes('node_samnaun');
}

function isModerateSlope(edge, itemMap) {
    if (edge.isSkiRoute) return false;
    const leadsToBlack = edge.leadsTo.some(targetId => {
        const target = itemMap.get(targetId);
        return target && target.category === 'black';
    });
    return !leadsToBlack;
}

function liftLeadsToUnvisitedSlope(liftEdge, itemMap, activeTypes, avoidSteep, usedEdgesToday) {
    for (const targetId of liftEdge.leadsTo) {
        const target = itemMap.get(targetId);
        if (!target) continue;

        const nextSlopes = target.category === 'node'
            ? target.leadsTo.map(id => itemMap.get(id)).filter(Boolean)
            : [target];

        const hasFreshSlope = nextSlopes.some(s =>
            activeTypes.includes(s.category) &&
            !isValleyDescent(s) &&
            (!avoidSteep || isModerateSlope(s, itemMap)) &&
            !usedEdgesToday.has(s.id)
        );
        if (hasFreshSlope) return true;
    }
    return false;
}

function findParentNodeOfEdge(edgeId, itemMap) {
    for (const item of itemMap.values()) {
        if (item.category === 'node' && item.leadsTo.includes(edgeId)) {
            return item.id;
        }
    }
    return null;
}

function findNextEdgeTowardsWaypoint(startNodeId, targetNodeId, itemMap, preferredTypes, currentMinutes) {
    if (!targetNodeId || startNodeId === targetNodeId || !itemMap.has(targetNodeId)) {
        return null;
    }

    const liftsClosed = currentMinutes >= 16 * 60;
    const queue = [{ nodeId: startNodeId, firstEdgeId: null }];
    const visitedNodes = new Set([startNodeId]);

    while (queue.length > 0) {
        const { nodeId, firstEdgeId } = queue.shift();
        if (nodeId === targetNodeId) {
            return firstEdgeId ? itemMap.get(firstEdgeId) : null;
        }

        const node = itemMap.get(nodeId);
        if (!node) continue;

        const sortedEdges = [...node.leadsTo].sort((aId, bId) => {
            const edgeA = itemMap.get(aId);
            const edgeB = itemMap.get(bId);
            const scoreA = edgeA && (preferredTypes.includes(edgeA.category) || edgeA.category === 'lift') ? 0 : 1;
            const scoreB = edgeB && (preferredTypes.includes(edgeB.category) || edgeB.category === 'lift') ? 0 : 1;
            return scoreA - scoreB;
        });

        for (const edgeId of sortedEdges) {
            const edge = itemMap.get(edgeId);
            if (!edge || edge.liftCategory === 'carpet') continue;
            if (liftsClosed && edge.category === 'lift') continue;

            if (isValleyDescent(edge) && !edge.leadsTo.includes(targetNodeId)) {
                continue;
            }

            if (edge.category === 'node') {
                if (!visitedNodes.has(edge.id)) {
                    visitedNodes.add(edge.id);
                    queue.push({ nodeId: edge.id, firstEdgeId: firstEdgeId || edge.id });
                }
                continue;
            }

            for (const nextNodeId of edge.leadsTo) {
                if (!visitedNodes.has(nextNodeId)) {
                    visitedNodes.add(nextNodeId);
                    queue.push({ nodeId: nextNodeId, firstEdgeId: firstEdgeId || edge.id });
                }
            }
        }
    }

    return null;
}

function buildLocalItinerary(intent, rawTopology) {
    const { itemMap, nodes } = normalizeTopologyGraph(rawTopology);
    if (nodes.length === 0) return [];

    let currentNodeId = itemMap.has(intent.startNodeId) ? intent.startNodeId : "node_ischgl";
    let forcedNextEdgeId = (intent.forcedFirstEdgeId && itemMap.has(intent.forcedFirstEdgeId))
        ? intent.forcedFirstEdgeId
        : null;

    const finalEdgeId = (intent.forcedLastEdgeId && itemMap.has(intent.forcedLastEdgeId))
        ? intent.forcedLastEdgeId
        : "piste_1";
    const preFinalNodeId = findParentNodeOfEdge(finalEdgeId, itemMap) || "node_idalp";

    let currentMinutes = parseTimeToMinutes(intent.startTime || "09:00");
    const liftClosingMinutes = 16 * 60; // Official Ischgl last lift ascent: 16:00
    const pisteClosingMinutes = 16 * 60 + 30; // Official valley run closure: 16:30

    const morningTypes = Array.isArray(intent.morningTypes) && intent.morningTypes.length > 0
        ? intent.morningTypes
        : ['blue', 'red'];
    const afternoonTypes = Array.isArray(intent.afternoonTypes) && intent.afternoonTypes.length > 0
        ? intent.afternoonTypes
        : morningTypes;
    const avoidSteep = Boolean(intent.avoidSteep);

    const waypointsQueue = Array.isArray(intent.targetWaypoints)
        ? intent.targetWaypoints.filter(wp => itemMap.has(wp))
        : [];

    const lunchTargetMinutes = parseTimeToMinutes(intent.lunchTime || "13:00");
    let lunchTaken = !intent.includeLunchBreak;
    let returningToBase = false;

    const itinerary = [];
    const usedEdgesToday = new Set();
    const edgeUsageCount = new Map();

    // Clock-driven loop: runs until lift closing (16:00) + final valley descent (up to 16:30)
    while (currentMinutes < pisteClosingMinutes) {
        const activeTypes = (!lunchTaken && currentMinutes < lunchTargetMinutes)
            ? morningTypes
            : afternoonTypes;

        let selectedEdge = null;
        const stepStartNodeId = currentNodeId;

        if (forcedNextEdgeId && itemMap.has(forcedNextEdgeId)) {
            selectedEdge = itemMap.get(forcedNextEdgeId);
            forcedNextEdgeId = null;
        } else {
            const currentNode = itemMap.get(currentNodeId);
            if (!currentNode || currentNode.leadsTo.length === 0) break;

            if (returningToBase && currentNodeId === 'node_ischgl') {
                break;
            }

            // Trigger lunch break around lunchTargetMinutes at a mountain hub
            if (!lunchTaken && currentMinutes >= lunchTargetMinutes - 10 && currentNode.id !== 'node_ischgl') {
                const breakDuration = 45;
                itinerary.push({
                    time: formatMinutesToTime(currentMinutes),
                    title: `הפסקת צהריים - ${currentNode.name}`,
                    type: "break",
                    desc: `עצירה למנוחה ואוכל באזור ${currentNode.name} (45 דק')`,
                    startRef: currentNode.id,
                    anchorRef: currentNode.id
                });
                currentMinutes += breakDuration;
                lunchTaken = true;
                continue;
            }

            // Trigger return-to-village routing ~35 mins before 16:00 lift closure (earlier if in Samnaun)
            const isSwissSide = ['node_samnaun', 'node_alp_trida', 'node_alp_bella', 'node_alptrider_sattel', 'node_salaas', 'node_muller', 'node_visnitzkopf'].includes(currentNodeId);
            const returnTriggerMinutes = isSwissSide ? (14 * 60 + 50) : (liftClosingMinutes - 35);

            if (intent.endAtBase !== false && currentMinutes >= returnTriggerMinutes && !returningToBase && currentNodeId !== 'node_ischgl') {
                returningToBase = true;
                waypointsQueue.length = 0;
                waypointsQueue.push(preFinalNodeId);
            }

            // Execute final valley run (e.g., piste_1) once at preFinalNodeId (node_idalp)
            if (returningToBase && currentNodeId === preFinalNodeId && itemMap.has(finalEdgeId)) {
                selectedEdge = itemMap.get(finalEdgeId);
            }

            if (!selectedEdge && waypointsQueue.length > 0 && waypointsQueue[0] === currentNodeId) {
                waypointsQueue.shift();
            }

            if (!selectedEdge && waypointsQueue.length > 0) {
                selectedEdge = findNextEdgeTowardsWaypoint(currentNodeId, waypointsQueue[0], itemMap, activeTypes, currentMinutes);
            }

            if (!selectedEdge) {
                // After 16:00, lifts are closed — only allow valley runs down to Ischgl
                if (currentMinutes >= liftClosingMinutes) {
                    if (itemMap.has(finalEdgeId) && currentNode.leadsTo.includes(finalEdgeId)) {
                        selectedEdge = itemMap.get(finalEdgeId);
                    } else {
                        break;
                    }
                } else {
                    const outgoingItems = currentNode.leadsTo
                        .map(id => itemMap.get(id))
                        .filter(edge => edge && edge.liftCategory !== 'carpet' && !isValleyDescent(edge));

                    if (outgoingItems.length === 0) break;

                    // 1. Pick an UNVISITED matching slope if available at this hub
                    let unusedSlopes = outgoingItems.filter(edge =>
                        activeTypes.includes(edge.category) &&
                        !usedEdgesToday.has(edge.id) &&
                        (!avoidSteep || isModerateSlope(edge, itemMap))
                    );

                    if (unusedSlopes.length > 0) {
                        if (avoidSteep) {
                            const cruising = unusedSlopes.filter(s => (s.lengthMeters || 2000) >= 2000);
                            if (cruising.length > 0) unusedSlopes = cruising;
                        }
                        selectedEdge = unusedSlopes[Math.floor(Math.random() * unusedSlopes.length)];
                    } else {
                        // 2. Otherwise take a lift to explore another peak/sector with unvisited slopes
                        let lifts = outgoingItems.filter(edge => edge.category === 'lift' || edge.category === 'node');
                        const unusedLifts = lifts.filter(l => !usedEdgesToday.has(l.id));
                        if (unusedLifts.length > 0) lifts = unusedLifts;

                        const productiveLifts = lifts.filter(l =>
                            l.category === 'lift' && liftLeadsToUnvisitedSlope(l, itemMap, activeTypes, avoidSteep, usedEdgesToday)
                        );
                        if (productiveLifts.length > 0) lifts = productiveLifts;

                        if (lifts.length > 0) {
                            selectedEdge = lifts[Math.floor(Math.random() * lifts.length)];
                        } else {
                            // 3. Fallback: pick the least-repeated edge from this hub
                            const sortedByUsage = [...outgoingItems].sort((a, b) =>
                                (edgeUsageCount.get(a.id) || 0) - (edgeUsageCount.get(b.id) || 0)
                            );
                            selectedEdge = sortedByUsage[0];
                        }
                    }
                }
            }
        }

        if (!selectedEdge) break;

        if (selectedEdge.category === 'node') {
            currentNodeId = selectedEdge.id;
            continue;
        }

        const validTargets = selectedEdge.leadsTo.filter(id => itemMap.has(id));
        const nextTargetId = validTargets.length > 0
            ? validTargets[Math.floor(Math.random() * validTargets.length)]
            : currentNodeId;

        const nextTargetObj = itemMap.get(nextTargetId);
        let anchorNodeId = currentNodeId;

        if (nextTargetObj && nextTargetObj.category === 'node') {
            currentNodeId = nextTargetObj.id;
            anchorNodeId = nextTargetObj.id;
        } else if (nextTargetObj) {
            forcedNextEdgeId = nextTargetObj.id;
            anchorNodeId = currentNodeId;
        }

        const { duration, waitNote } = calculateRealisticDuration(selectedEdge, currentMinutes);
        const distanceStr = selectedEdge.lengthMeters
            ? `אורך: ${selectedEdge.lengthMeters.toLocaleString()} מ' | `
            : '';
        const routeNote = selectedEdge.isSkiRoute ? ' (Ski Route)' : '';

        itinerary.push({
            time: formatMinutesToTime(currentMinutes),
            title: `${selectedEdge.officialTitle}${routeNote}`,
            type: ['lift', 'blue', 'red', 'black'].includes(selectedEdge.category) ? selectedEdge.category : 'red',
            desc: `${distanceStr}זמן כולל: ${duration} דק'${waitNote}`,
            startRef: stepStartNodeId,
            anchorRef: anchorNodeId
        });

        usedEdgesToday.add(selectedEdge.id);
        edgeUsageCount.set(selectedEdge.id, (edgeUsageCount.get(selectedEdge.id) || 0) + 1);
        currentMinutes += duration;
    }

    return itinerary;
}

async function fetchWithRetry(url, options, maxRetries = 2, timeoutMs = 15000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timer);

            if ([429, 500, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
                const delayMs = attempt * 1500;
                console.warn(`Proxy returned ${response.status}. Retrying (${attempt + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }

            return response;
        } catch (err) {
            clearTimeout(timer);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, attempt * 1500));
                continue;
            }
            throw err;
        }
    }
}

function fallbackLocalIntentParser(promptText, itemMap) {
    const text = promptText.toLowerCase();

    const liftMatch = promptText.match(/\b([A-O]\d{1,2})\b/i);
    const candidateLiftId = liftMatch ? `lift_${liftMatch[1].toUpperCase()}` : null;
    const forcedFirstEdgeId = (candidateLiftId && itemMap.has(candidateLiftId)) ? candidateLiftId : null;

    let forcedLastEdgeId = 'piste_1';
    const endSlopeMatch = promptText.match(/(?:לסיים|סיום).*?מסלול\s*(\d{1,2}[a-c]?)/i);
    if (endSlopeMatch) {
        const candidateSlope = `piste_${endSlopeMatch[1].toLowerCase()}`;
        if (itemMap.has(candidateSlope)) forcedLastEdgeId = candidateSlope;
    }

    const splitParts = text.split(/צהריים|לאחר מכן|אחרי/);
    const morningPart = splitParts[0] || text;
    const afternoonPart = splitParts.slice(1).join(' ') || morningPart;

    const extractColors = (segment) => {
        const colors = [];
        if (segment.includes('כחול')) colors.push('blue');
        if (segment.includes('אדום') || segment.includes('אדומי')) colors.push('red');
        if (segment.includes('שחור')) colors.push('black');
        return colors.length > 0 ? colors : ['blue', 'red'];
    };

    const timeMatch = promptText.match(/\b(\d{1,2}:\d{2})\b/);
    const lunchTime = timeMatch ? timeMatch[1].padStart(5, '0') : '13:00';

    const targetWaypoints = [];
    if (text.includes('סמנאון') || text.includes('samnaun')) targetWaypoints.push('node_samnaun');
    if (text.includes('פלינקופף') || text.includes('palinkopf')) targetWaypoints.push('node_palinkopf');
    if (text.includes('גרייטשפיץ') || text.includes('greitspitz')) targetWaypoints.push('node_greitspitz');

    return {
        startNodeId: 'node_ischgl',
        forcedFirstEdgeId,
        forcedLastEdgeId,
        startTime: '09:00',
        morningTypes: extractColors(morningPart),
        afternoonTypes: extractColors(afternoonPart),
        avoidSteep: text.includes('לא תלול') || text.includes('מתון') || text.includes('רגוע'),
        targetWaypoints,
        includeLunchBreak: !text.includes('בלי הפסקה'),
        lunchTime,
        endAtBase: true
    };
}

async function generateAIItinerary() {
    if (currentUser === 'אורח') return alert("אורח אינו מורשה ליצור לו\"ז ב-AI.");

    const promptText = document.getElementById('ai-prompt').value;
    if (!promptText.trim()) return alert("אנא הזן בקשה ללו\"ז.");

    const statusEl = document.getElementById('ai-status');
    const previewContainer = document.getElementById('ai-preview-container');

    statusEl.style.display = 'block';
    previewContainer.style.display = 'none';

    const { itemMap, nodes } = normalizeTopologyGraph(leanTopology);
    const compactNodesList = nodes.map(n => ({ id: n.id, name: n.name }));
    const compactLiftsList = Array.from(itemMap.values())
        .filter(item => item.category === 'lift')
        .map(l => ({ id: l.id, name: l.officialTitle }));

    const intentPrompt = `
    You are a ski trip intent parser for Ischgl.
    Analyze the user request: "${promptText}"
    Available resort nodes: ${JSON.stringify(compactNodesList)}
    Available lifts: ${JSON.stringify(compactLiftsList)}

    Extract the user's preferences into a strict JSON object with these exact keys:
    - startNodeId (string, MUST be "node_ischgl" UNLESS the user explicitly specifies starting at another station)
    - forcedFirstEdgeId (string or null, if the user specifies a specific first lift/slope like "A3" or "Fimbabahn", return its exact ID e.g. "lift_A3", otherwise null)
    - forcedLastEdgeId (string, if user specifies a closing slope like "מסלול 1", return its exact ID e.g. "piste_1", default "piste_1")
    - startTime (string, HH:MM format, default "09:00")
    - morningTypes (array of strings from ["blue", "red", "black"] for before lunch, default ["blue", "red"])
    - afternoonTypes (array of strings from ["blue", "red", "black"] for after lunch, default same as morningTypes)
    - avoidSteep (boolean, true if user asks for gentle, cruising, or "not too steep" runs, default false)
    - targetWaypoints (array of valid node ids the user explicitly wants to visit e.g. ["node_samnaun"], default [])
    - includeLunchBreak (boolean, default true)
    - lunchTime (string, HH:MM format, default "13:00")
    - endAtBase (boolean, default true)
    `;

    let parsedIntent = null;

    try {
        const response = await fetchWithRetry('https://gemini-proxy.eladafriat1122.workers.dev', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: intentPrompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || "API Error");
        }

        let aiText = data.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedIntent = JSON.parse(aiText);

    } catch (error) {
        console.warn("Gemini API unavailable/timed out, using local intent parser fallback:", error.message);
        parsedIntent = fallbackLocalIntentParser(promptText, itemMap);
    }

    pendingAIItinerary = buildLocalItinerary(parsedIntent, leanTopology);
    renderAIPreview();
    statusEl.style.display = 'none';
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
    const day = document.getElementById('view-day-select').value;
    const steps = itineraryData[day] || [];

    if (steps.length === 0) {
        if (navBar) navBar.classList.add('hidden');
        drawStepMarkers(day, -1);
        return;
    }

    if (currentNavStepIndex < 0) currentNavStepIndex = 0;
    if (currentNavStepIndex >= steps.length) currentNavStepIndex = steps.length - 1;

    const step = steps[currentNavStepIndex];

    if (navBar) {
        document.getElementById('nav-time').textContent = step.time || '';
        document.getElementById('nav-title').textContent = step.title || '';
        document.getElementById('nav-desc').textContent = step.desc || '';

        const typeEl = document.getElementById('nav-type');
        typeEl.textContent = step.type || '';
        typeEl.className = `badge type-${step.type}`;

        document.getElementById('nav-prev').disabled = (currentNavStepIndex === 0);
        document.getElementById('nav-next').disabled = (currentNavStepIndex === steps.length - 1);
        navBar.classList.remove('hidden');
    }

    // Draw green Start pin and red End pin for the currently selected step
    drawStepMarkers(day, currentNavStepIndex);

    // Center map and move glowing indicator to the step destination
    let targetX = step.x;
    let targetY = step.y;
    const mapImg = document.getElementById('map-image');

    if (step.anchorRef && mapImg && mapImg.naturalWidth) {
        const node = topologyData.find(n => n.ID === step.anchorRef);
        if (node && typeof node.x === 'number' && typeof node.y === 'number') {
            targetX = (node.x / mapImg.naturalWidth) * 100;
            targetY = (node.y / mapImg.naturalHeight) * 100;
        }
    }

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

function drawStepMarkers(day, stepIndex) {
    try {
        const mapImg = document.getElementById('map-image');
        if (!mapImg || !mapImg.naturalWidth) return;

        const container = mapImg.parentElement;
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        let svg = document.getElementById('day-route-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'day-route-svg';
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '5';
            container.appendChild(svg);
        }

        svg.setAttribute('viewBox', `0 0 ${mapImg.naturalWidth} ${mapImg.naturalHeight}`);
        svg.innerHTML = '';

        const steps = itineraryData[day] || [];
        const step = steps[stepIndex];
        if (!step) return;

        const nodeCoords = new Map();
        const edgeToParentNode = new Map();

        for (const item of topologyData) {
            if (!item || !item.ID) continue;
            if (typeof item.x === 'number' && typeof item.y === 'number') {
                nodeCoords.set(item.ID, { x: item.x, y: item.y });
            }
            if (item.Type === 'node' && Array.isArray(item.leads_to)) {
                for (const targetId of item.leads_to) {
                    if (!edgeToParentNode.has(targetId)) {
                        edgeToParentNode.set(targetId, item.ID);
                    }
                }
            }
        }

        const inferOriginNode = (targetStep) => {
            if (targetStep.startRef && nodeCoords.has(targetStep.startRef)) return targetStep.startRef;
            const cleanTitle = String(targetStep.title || '').replace(' (Ski Route)', '').trim().toLowerCase();
            const matchedEdge = topologyData.find(it =>
                it.Type !== 'node' &&
                (String(it.officialTitle || '').toLowerCase() === cleanTitle ||
                 String(it.Name || '').toLowerCase() === cleanTitle)
            );
            if (matchedEdge && edgeToParentNode.has(matchedEdge.ID)) {
                return edgeToParentNode.get(matchedEdge.ID);
            }
            return 'node_ischgl';
        };

        const endNodeId = step.anchorRef;
        const startNodeId = (step.type === 'break')
            ? endNodeId
            : (step.startRef && nodeCoords.has(step.startRef))
                ? step.startRef
                : (stepIndex > 0 && steps[stepIndex - 1]?.anchorRef && nodeCoords.has(steps[stepIndex - 1].anchorRef))
                    ? steps[stepIndex - 1].anchorRef
                    : inferOriginNode(step);

        const drawPin = (nodeId, color, label) => {
            const pt = nodeCoords.get(nodeId);
            if (!pt) return;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pt.x);
            circle.setAttribute('cy', pt.y);
            circle.setAttribute('r', '11');
            circle.setAttribute('fill', color);
            circle.setAttribute('stroke', '#ffffff');
            circle.setAttribute('stroke-width', '3');
            svg.appendChild(circle);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pt.x);
            text.setAttribute('y', pt.y - 18);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#111827');
            text.setAttribute('stroke', '#ffffff');
            text.setAttribute('stroke-width', '4');
            text.setAttribute('paint-order', 'stroke');
            text.setAttribute('font-size', '14');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('font-family', 'sans-serif');
            text.textContent = label;
            svg.appendChild(text);
        };

        if (step.type === 'break') {
            drawPin(endNodeId, '#f59e0b', 'הפסקת צהריים');
            return;
        }

        if (startNodeId && endNodeId && startNodeId === endNodeId) {
            drawPin(startNodeId, '#2563eb', 'התחלה / סיום');
        } else {
            drawPin(startNodeId, '#16a34a', 'התחלה');
            drawPin(endNodeId, '#dc2626', 'סיום');
        }
    } catch (err) {
        console.warn('drawStepMarkers skipped:', err);
    }
}

function drawDayRoute() {
    const day = document.getElementById('view-day-select').value;
    drawStepMarkers(day, currentNavStepIndex);
}