// game.js - The Pro Game Engine
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

// --- Core Variables ---
let myId = 'u' + Math.random().toString(36).substr(2, 5);
let roomId, myName, isDrawer = false, currentTool = 'brush', currentColor = '#000000';
let canvas, ctx, drawing = false;
let currentWord = "";

// --- Initialization ---
function joinGame() {
    myName = document.getElementById('playerName').value.trim() || "Guest" + Math.floor(Math.random()*100);
    roomId = document.getElementById('roomCode').value.trim().toUpperCase() || 'LOBBY';

    // 1. Join the Player List
    const userRef = db.ref(`rooms/${roomId}/players/${myId}`);
    userRef.set({ name: myName, score: 0, hasGuessed: false, isOnline: true });
    userRef.onDisconnect().remove();

    // 2. Switch Screens
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    
    setupCanvas();
    syncGame();
}

function setupCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Fixed resolution for all devices to ensure drawing scales correctly
    canvas.width = 800;
    canvas.height = 600;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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

    // Desktop Mouse Events
    canvas.addEventListener('mousedown', (e) => startDraw(getPos(e)));
    canvas.addEventListener('mousemove', (e) => moveDraw(getPos(e)));
    window.addEventListener('mouseup', endDraw);

    // Mobile Touch Events
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(getPos(e)); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDraw(getPos(e)); });
    window.addEventListener('touchend', endDraw);
}

function startDraw(pos) {
    if (!isDrawer) return;
    if (currentTool === 'bucket') {
        fillArea(Math.round(pos.x), Math.round(pos.y), currentColor);
    } else {
        drawing = true;
        ctx.beginPath();
        ctx.strokeStyle = currentColor;
        ctx.moveTo(pos.x, pos.y);
        db.ref(`rooms/${roomId}/drawEvents`).push({ type: 'start', x: pos.x, y: pos.y, color: currentColor });
    }
}

function moveDraw(pos) {
    if (!drawing || !isDrawer) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    db.ref(`rooms/${roomId}/drawEvents`).push({ type: 'move', x: pos.x, y: pos.y });
}

function endDraw() {
    if (!drawing) return;
    drawing = false;
    db.ref(`rooms/${roomId}/drawEvents`).push({ type: 'end' });
}

// --- Bucket Fill Algorithm ---
function fillArea(startX, startY, fillHex) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const pixelPos = (startY * canvas.width + startX) * 4;
    
    const targetR = data[pixelPos], targetG = data[pixelPos+1], targetB = data[pixelPos+2];
    const fillRGB = hexToRgb(fillHex);
    
    if (targetR === fillRGB.r && targetG === fillRGB.g && targetB === fillRGB.b) return;

    const stack = [[startX, startY]];
    while(stack.length > 0) {
        const [x, y] = stack.pop();
        const pos = (y * canvas.width + x) * 4;
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
        
        if (data[pos] === targetR && data[pos+1] === targetG && data[pos+2] === targetB) {
            data[pos] = fillRGB.r; data[pos+1] = fillRGB.g; data[pos+2] = fillRGB.b; data[pos+3] = 255;
            stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
        }
    }
    ctx.putImageData(imgData, 0, 0);
    db.ref(`rooms/${roomId}/drawEvents`).push({ type: 'fill', x: startX, y: startY, color: fillHex });
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// --- Firebase Syncing ---
function syncGame() {
    // 1. Listen for Drawing
    db.ref(`rooms/${roomId}/drawEvents`).on('child_added', (snap) => {
        if (isDrawer) return; // Don't sync back to yourself
        const e = snap.val();
        if (e.type === 'start') { ctx.beginPath(); ctx.strokeStyle = e.color; ctx.moveTo(e.x, e.y); }
        else if (e.type === 'move') { ctx.lineTo(e.x, e.y); ctx.stroke(); }
        else if (e.type === 'clear') { ctx.clearRect(0, 0, canvas.width, canvas.height); }
        else if (e.type === 'fill') { /* Local fill call can be added here */ }
    });

    // 2. Listen for Player Updates
    db.ref(`rooms/${roomId}/players`).on('value', (snap) => {
        const players = snap.val() || {};
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
    });

    // 3. Game State (Drawer, Timer, Round)
    db.ref(`rooms/${roomId}/state`).on('value', (snap) => {
        const state = snap.val() || {};
        isDrawer = (state.drawer === myId);
        currentWord = state.word || "";
        
        document.getElementById('timer').innerText = state.timeLeft || 80;
        document.getElementById('roundIndicator').innerText = `ROUND ${state.round || 1} / 10`;
        document.getElementById('wordDisplay').innerText = isDrawer ? currentWord : maskWord(currentWord);
        document.getElementById('painterControls').style.display = isDrawer ? 'flex' : 'none';
        document.getElementById('drawerStatus').style.display = isDrawer ? 'block' : 'none';
    });
}

function maskWord(word) {
    if (!word) return "WAITING...";
    return word.split('').map(() => '_').join(' ');
}

// --- Chat & Guesses ---
function handleChat(e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('chatInput');
        const guess = input.value.trim().toLowerCase();
        if (!guess) return;

        if (!isDrawer && guess === currentWord.toLowerCase()) {
            db.ref(`rooms/${roomId}/players/${myId}`).update({ 
                hasGuessed: true, 
                score: firebase.database.ServerValue.increment(500) 
            });
            input.value = "Correct!";
            input.disabled = true;
        } else {
            db.ref(`rooms/${roomId}/chat`).push({ name: myName, msg: guess });
            input.value = "";
        }
    }
}

// --- Tools ---
function setTool(t) {
    currentTool = t;
    document.getElementById('btnBrush').classList.toggle('active', t === 'brush');
    document.getElementById('btnBucket').classList.toggle('active', t === 'bucket');
}

function setColor(c) {
    currentColor = c;
    document.getElementById('colorPopup').classList.remove('active');
}

function toggleColors() { document.getElementById('colorPopup').classList.toggle('active'); }

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isDrawer) db.ref(`rooms/${roomId}/drawEvents`).set(null);
}
