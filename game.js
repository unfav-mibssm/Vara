// game.js - Skribbl Pro Engine
const firebaseConfig = {
    apiKey: "AIzaSyAY7hSDaaBh71z3k2PXj3s93uxk3AF3Mvs",
    authDomain: "mini-skribbl.firebaseapp.com",
    databaseURL: "https://mini-skribbl-default-rtdb.firebaseio.com",
    projectId: "mini-skribbl",
    storageBucket: "mini-skribbl.firebasestorage.app",
    messagingSenderId: "423970942237",
    appId: "1:423970942237:web:ac3853dab889c0fe3305f4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- Game Variables ---
let myId = 'u_' + Math.random().toString(36).substr(2, 7);
let roomId, myName, isDrawer = false, currentTool = 'brush';
let canvas, ctx, drawing = false;
let currentRound = 1, totalRounds = 10;
let wordBank = ["Apple", "Pizza", "Eiffel Tower", "Cactus", "Donut", "Spider", "Laptop", "Guitar", "Rocket", "Banana", "Ice Cream", "Volcano", "Bicycle"];

// --- Initialization ---
function joinGame() {
    myName = document.getElementById('playerName').value.trim() || "Guest" + Math.floor(Math.random()*100);
    roomId = document.getElementById('roomCode').value.trim().toUpperCase() || 'LOBBY';

    // Join Room
    const userRef = db.ref(`rooms/${roomId}/players/${myId}`);
    userRef.set({ name: myName, score: 0, hasGuessed: false });
    userRef.onDisconnect().remove();

    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    
    setupCanvas();
    syncWithFirebase();
}

function setupCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Internal resolution is always 800x600 for sync consistency
    canvas.width = 800;
    canvas.height = 600;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', endDraw);
    
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    window.addEventListener('touchend', endDraw);

    function startDraw(e) {
        if (!isDrawer) return;
        const pos = getPos(e);
        if (currentTool === 'bucket') {
            executeFloodFill(Math.round(pos.x), Math.round(pos.y), "#000000");
        } else {
            drawing = true;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            db.ref(`rooms/${roomId}/drawEvents`).push({ type: 'start', x: pos.x, y: pos.y });
        }
    }

    function draw(e) {
        if (!drawing || !isDrawer) return;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        db.ref(`rooms/${roomId}/drawEvents`).push({ type: 'move', x: pos.x, y: pos.y });
    }

    function endDraw() {
        if (!drawing) return;
        drawing = false;
        db.ref(`rooms/${roomId}/drawEvents`).push({ type: 'end' });
    }
}

// --- Bucket Fill Algorithm ---
function executeFloodFill(startX, startY, fillHex) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const pixelPos = (startY * canvas.width + startX) * 4;
    const targetR = data[pixelPos], targetG = data[pixelPos+1], targetB = data[pixelPos+2];
    
    // Only fill if color is different (prevents infinite loop)
    if (targetR === 0 && targetG === 0 && targetB === 0) return; 

    const stack = [[startX, startY]];
    while(stack.length > 0) {
        const [x, y] = stack.pop();
        const pos = (y * canvas.width + x) * 4;
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
        if (data[pos] === targetR && data[pos+1] === targetG && data[pos+2] === targetB) {
            data[pos] = 0; data[pos+1] = 0; data[pos+2] = 0; data[pos+3] = 255;
            stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
        }
    }
    ctx.putImageData(imgData, 0, 0);
    db.ref(`rooms/${roomId}/drawEvents`).push({ type: 'fill', x: startX, y: startY, color: fillHex });
}

// --- Firebase Sync ---
function syncWithFirebase() {
    // Listen for Draw Events
    db.ref(`rooms/${roomId}/drawEvents`).on('child_added', snap => {
        if (isDrawer) return;
        const ev = snap.val();
        if (ev.type === 'start') { ctx.beginPath(); ctx.moveTo(ev.x, ev.y); }
        else if (ev.type === 'move') { ctx.lineTo(ev.x, ev.y); ctx.stroke(); }
        else if (ev.type === 'fill') { /* remote fill logic here */ }
        else if (ev.type === 'clear') { ctx.clearRect(0,0,canvas.width,canvas.height); }
    });

    // Listen for Player List
    db.ref(`rooms/${roomId}/players`).on('value', snap => {
        const players = snap.val() || {};
        updatePlayerList(players);
    });

    // Listen for Game State (Rounds/Timer)
    db.ref(`rooms/${roomId}/game`).on('value', snap => {
        const game = snap.val() || {};
        isDrawer = (game.drawer === myId);
        document.getElementById('roundIndicator').innerText = `ROUND ${game.round || 1} / 10`;
        document.getElementById('timer').innerText = game.timeLeft || 80;
        document.getElementById('wordDisplay').innerText = isDrawer ? game.word : maskWord(game.word);
        
        document.getElementById('painterControls').style.display = isDrawer ? 'flex' : 'none';
        document.getElementById('drawerStatus').style.display = isDrawer ? 'block' : 'none';
    });
}

function updatePlayerList(players) {
    const list = document.getElementById('playerList');
    list.innerHTML = "";
    Object.keys(players).forEach(id => {
        const p = players[id];
        list.innerHTML += `
            <div class="player-card ${p.hasGuessed ? 'guessed' : ''}">
                <span>${p.name}</span>
                <b>${p.score}</b>
            </div>`;
    });
}

function maskWord(word) {
    if (!word) return "WAITING...";
    return word.split('').map(() => '_').join(' ');
}

function handleChat(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('chatInput');
        const val = input.value.trim();
        if (val) {
            db.ref(`rooms/${roomId}/chat`).push({ name: myName, msg: val });
            input.value = "";
        }
    }
}

function setTool(t) {
    currentTool = t;
    document.getElementById('btnBrush').classList.toggle('active', t === 'brush');
    document.getElementById('btnBucket').classList.toggle('active', t === 'bucket');
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isDrawer) db.ref(`rooms/${roomId}/drawEvents`).set(null);
}
