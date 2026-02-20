// game.js - The Master Replica Engine
let myId = "u" + Math.random().toString(36).substr(2, 5);
let roomId = "LOBBY_1", myName, isDrawer = false, currentWord = "";
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d');

function enterGame() {
    myName = document.getElementById('username').value.trim() || "Guest";
    document.getElementById('login-screen').style.display = 'none';
    
    // Set Canvas Resolution
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Join Player List
    db.ref(`rooms/${roomId}/players/${myId}`).set({ name: myName, score: 0, guessed: false });
    db.ref(`rooms/${roomId}/players/${myId}`).onDisconnect().remove();

    initGameSync();
    initDrawingLogic();
    checkIfHost(); // Start the brain if you're first
}

function initGameSync() {
    // 1. Sidebar Sync (Pencil & Green Names)
    db.ref(`rooms/${roomId}`).on('value', snap => {
        const data = snap.val() || {};
        const players = data.players || {};
        const state = data.state || {};
        const sidebar = document.getElementById('player-sidebar');
        
        sidebar.innerHTML = Object.keys(players).map(id => {
            const p = players[id];
            const drawing = (id === state.drawer);
            return `
                <div class="player-card ${p.guessed ? 'guessed' : ''} ${drawing ? 'is-drawing' : ''}">
                    <span>${drawing ? '✏️ ' : ''}${p.name}</span>
                    <b>${p.score}</b>
                </div>`;
        }).join('');

        // 2. State Sync (Timer/Word)
        isDrawer = (state.drawer === myId);
        currentWord = state.word || "";
        document.getElementById('timer').innerText = state.timer || 80;
        document.getElementById('round-count').innerText = state.round || 1;
        document.getElementById('word-display').innerText = isDrawer ? currentWord : (currentWord.replace(/[A-Za-z]/g, "_ "));
    });

    // 3. Draw Sync
    db.ref(`rooms/${roomId}/lines`).on('child_added', snap => {
        if (isDrawer) return;
        const d = snap.val();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(d.x1 * canvas.width, d.y1 * canvas.height);
        ctx.lineTo(d.x2 * canvas.width, d.y2 * canvas.height); ctx.stroke();
    });
}

function initDrawingLogic() {
    let x, y, drawing = false;
    const getXY = (e) => ({ x: e.offsetX || e.touches[0].pageX - canvas.offsetLeft, y: e.offsetY || e.touches[0].pageY - canvas.offsetTop });

    const start = (e) => { if(!isDrawer) return; drawing = true; const p = getXY(e); x = p.x; y = p.y; };
    const move = (e) => {
        if(!drawing || !isDrawer) return;
        const p = getXY(e);
        db.ref(`rooms/${roomId}/lines`).push({ x1: x/canvas.width, y1: y/canvas.height, x2: p.x/canvas.width, y2: p.y/canvas.height });
        x = p.x; y = p.y;
    };
    canvas.onmousedown = start; canvas.onmousemove = move; window.onmouseup = () => drawing = false;
    canvas.ontouchstart = start; canvas.ontouchmove = move; window.ontouchend = () => drawing = false;
}

function handleInput(e) {
    if(e.key === 'Enter') {
        const val = e.target.value.trim().toUpperCase();
        if(val === currentWord && !isDrawer) {
            db.ref(`rooms/${roomId}/players/${myId}`).update({ guessed: true, score: firebase.database.ServerValue.increment(200) });
            document.getElementById('chat-msgs').innerHTML += `<div style="color:green;font-weight:bold">Correct!</div>`;
        } else {
            db.ref(`rooms/${roomId}/chat`).push({ name: myName, msg: val });
            document.getElementById('chat-msgs').innerHTML += `<div><b>${myName}:</b> ${val}</div>`;
        }
        e.target.value = "";
    }
}

// --- THE BRAIN (Game Loop) ---
function checkIfHost() {
    db.ref(`rooms/${roomId}/players`).limitToFirst(1).on('value', snap => {
        if(snap.val() && Object.keys(snap.val())[0] === myId) {
            setInterval(() => {
                db.ref(`rooms/${roomId}/state`).transaction(s => {
                    if(!s) return { timer: 80, round: 1, drawer: myId, word: wordBank[0] };
                    if(s.timer > 0) s.timer--;
                    else {
                        s.timer = 80; s.word = wordBank[Math.floor(Math.random()*wordBank.length)];
                        db.ref(`rooms/${roomId}/lines`).remove();
                        db.ref(`rooms/${roomId}/players`).once('value', p => {
                            Object.keys(p.val()).forEach(id => db.ref(`rooms/${roomId}/players/${id}`).update({ guessed: false }));
                        });
                    }
                    return s;
                });
            }, 1000);
        }
    });
}
