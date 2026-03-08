// ==================== TIẾN LÊN MIỀN NAM - CLIENT ====================

// ==================== CONSTANTS ====================
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['spade', 'club', 'diamond', 'heart'];
const SUIT_SYMBOLS = { spade: '♠', club: '♣', diamond: '♦', heart: '♥' };
const SUIT_COLORS = { spade: 'black', club: 'black', diamond: 'red', heart: 'red' };
const RANK_ICONS = ['🥇', '🥈', '🥉', '4️⃣'];
const AI_NAMES = ['AI 1', 'AI 2', 'AI 3'];

// ==================== GAME STATE ====================
let gameState = {
    mode: null,         // 'offline' or 'online'
    hands: [[], [], [], []],
    currentTurn: 0,
    lastPlay: null,
    lastPlayedBy: -1,
    passCount: 0,
    isFirstTurn: true,
    finishOrder: [],
    selectedCards: [],
    myIndex: 0,
    players: [
        { name: 'Bạn', avatar: '😎' },
        { name: 'AI 1', avatar: '🤖' },
        { name: 'AI 2', avatar: '🤖' },
        { name: 'AI 3', avatar: '🤖' }
    ]
};

// ==================== SETTINGS ====================
let settings = {
    sound: true,
    music: false,
    speed: 'normal'
};

function loadSettings() {
    try {
        const saved = localStorage.getItem('tienlen_settings');
        if (saved) Object.assign(settings, JSON.parse(saved));
        document.getElementById('sound-toggle').checked = settings.sound;
        document.getElementById('music-toggle').checked = settings.music;
        document.getElementById('speed-select').value = settings.speed;
        applySpeed();
    } catch (e) { /* ignore */ }
}

function saveSettings() {
    try { localStorage.setItem('tienlen_settings', JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

function toggleSound() {
    settings.sound = document.getElementById('sound-toggle').checked;
    saveSettings();
}

function toggleMusic() {
    settings.music = document.getElementById('music-toggle').checked;
    saveSettings();
}

function changeSpeed() {
    settings.speed = document.getElementById('speed-select').value;
    applySpeed();
    saveSettings();
}

function applySpeed() {
    const mult = settings.speed === 'fast' ? 0.5 : settings.speed === 'slow' ? 2 : 1;
    document.documentElement.style.setProperty('--speed-mult', mult);
}

function getSpeedMs(base) {
    const mult = settings.speed === 'fast' ? 0.5 : settings.speed === 'slow' ? 2 : 1;
    return base * mult;
}

// ==================== SOUND EFFECTS ====================
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// Initialize AudioContext on first user gesture
document.addEventListener('click', function initAudio() {
    getAudioCtx();
    document.removeEventListener('click', initAudio);
}, { once: true });

function playSound(type) {
    if (!settings.sound) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        switch (type) {
            case 'click':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.1);
                break;
            case 'deal':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.12);
                break;
            case 'play':
                osc.type = 'square';
                osc.frequency.setValueAtTime(500, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.15);
                break;
            case 'pass':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.2);
                break;
            case 'win':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523, ctx.currentTime);
                osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
                osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
                osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.45);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.8);
                break;
            case 'error':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.25);
                break;
        }
    } catch (e) { /* ignore audio errors */ }
}

// ==================== CARD LOGIC ====================
function cardValue(card) {
    return RANKS.indexOf(card.rank) * 4 + SUITS.indexOf(card.suit);
}

function sortCards(cards) {
    return [...cards].sort((a, b) => cardValue(a) - cardValue(b));
}

function cardsEqual(a, b) {
    return a.rank === b.rank && a.suit === b.suit;
}

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ rank, suit });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    const d = [...deck];
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
}

function dealCards() {
    const deck = shuffleDeck(createDeck());
    return [
        sortCards(deck.slice(0, 13)),
        sortCards(deck.slice(13, 26)),
        sortCards(deck.slice(26, 39)),
        sortCards(deck.slice(39, 52))
    ];
}

function findStartingPlayer(hands) {
    for (let i = 0; i < 4; i++) {
        for (const card of hands[i]) {
            if (card.rank === '3' && card.suit === 'spade') return i;
        }
    }
    return 0;
}

function getComboType(cards) {
    if (!cards || cards.length === 0) return null;
    const sorted = sortCards(cards);

    if (sorted.length === 1) {
        return { type: 'single', rank: RANKS.indexOf(sorted[0].rank), topCard: sorted[0] };
    }

    if (sorted.length === 2) {
        if (sorted[0].rank === sorted[1].rank) {
            return { type: 'pair', rank: RANKS.indexOf(sorted[0].rank), topCard: sorted[1] };
        }
        return null;
    }

    if (sorted.length === 3) {
        if (sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank) {
            return { type: 'triple', rank: RANKS.indexOf(sorted[0].rank), topCard: sorted[2] };
        }
        return null;
    }

    // Four of a kind
    if (sorted.length === 4) {
        if (sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank && sorted[2].rank === sorted[3].rank) {
            return { type: 'four', rank: RANKS.indexOf(sorted[0].rank), topCard: sorted[3] };
        }
    }

    // Straight (sảnh) - minimum 3 cards
    if (sorted.length >= 3) {
        let isStraight = true;
        for (let i = 1; i < sorted.length; i++) {
            if (RANKS.indexOf(sorted[i].rank) - RANKS.indexOf(sorted[i - 1].rank) !== 1) {
                isStraight = false;
                break;
            }
        }
        if (isStraight && RANKS.indexOf(sorted[sorted.length - 1].rank) < 12) {
            return { type: 'straight', rank: RANKS.indexOf(sorted[sorted.length - 1].rank), length: sorted.length, topCard: sorted[sorted.length - 1] };
        }
    }

    // Double straight (sảnh đôi)
    if (sorted.length >= 6 && sorted.length % 2 === 0) {
        let isDoubleStraight = true;
        const pairs = [];
        for (let i = 0; i < sorted.length; i += 2) {
            if (sorted[i].rank !== sorted[i + 1].rank) {
                isDoubleStraight = false;
                break;
            }
            pairs.push(RANKS.indexOf(sorted[i].rank));
        }
        if (isDoubleStraight) {
            for (let i = 1; i < pairs.length; i++) {
                if (pairs[i] - pairs[i - 1] !== 1) {
                    isDoubleStraight = false;
                    break;
                }
            }
            if (isDoubleStraight && pairs[pairs.length - 1] < 12) {
                return { type: 'doubleStraight', rank: pairs[pairs.length - 1], length: pairs.length, topCard: sorted[sorted.length - 1] };
            }
        }
    }

    return null;
}

function canBeat(lastCombo, newCombo) {
    if (!lastCombo) return true;

    // Four of a kind beats any 2
    if (newCombo.type === 'four' && lastCombo.type === 'single' && lastCombo.rank === 12) return true;
    if (newCombo.type === 'four' && lastCombo.type === 'pair' && lastCombo.rank === 12) return true;

    // 3 consecutive pairs beat a single 2
    if (newCombo.type === 'doubleStraight' && newCombo.length >= 3 && lastCombo.type === 'single' && lastCombo.rank === 12) return true;
    // 4 consecutive pairs beat a pair of 2s
    if (newCombo.type === 'doubleStraight' && newCombo.length >= 4 && lastCombo.type === 'pair' && lastCombo.rank === 12) return true;

    // Same type comparison
    if (newCombo.type !== lastCombo.type) return false;
    if (newCombo.type === 'straight' || newCombo.type === 'doubleStraight') {
        if (newCombo.length !== lastCombo.length) return false;
    }

    return cardValue(newCombo.topCard) > cardValue(lastCombo.topCard);
}

// ==================== SCREEN NAVIGATION ====================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
    playSound('click');
}

function startOffline() {
    gameState.mode = 'offline';
    showScreen('game-screen');
    startOfflineGame();
}

function showOnlineLobby() {
    showScreen('online-screen');
    connectSocket();
}

function showGuide() { showScreen('guide-screen'); }
function showSettings() { showScreen('settings-screen'); }

function backToMenu() {
    showScreen('menu-screen');
    document.getElementById('victory-overlay').style.display = 'none';
    gameState.mode = null;
    if (socket && socket.connected && gameState.roomId) {
        socket.emit('leaveRoom');
    }
}

// ==================== CARD RENDERING ====================
function createCardEl(card, small) {
    const el = document.createElement('div');
    const color = SUIT_COLORS[card.suit];
    const symbol = SUIT_SYMBOLS[card.suit];

    el.className = `card ${color}`;
    el.innerHTML = `
        <div class="card-corner top-left">
            <span class="card-rank">${card.rank}</span>
            <span class="card-suit-small">${symbol}</span>
        </div>
        <span class="card-suit-center">${symbol}</span>
        <div class="card-corner bottom-right">
            <span class="card-rank">${card.rank}</span>
            <span class="card-suit-small">${symbol}</span>
        </div>
    `;

    el.dataset.rank = card.rank;
    el.dataset.suit = card.suit;

    return el;
}

function renderMyHand() {
    const container = document.getElementById('my-hand');
    container.innerHTML = '';
    const hand = gameState.hands[gameState.myIndex];
    if (!hand) return;

    hand.forEach((card, i) => {
        const el = createCardEl(card);
        const isSelected = gameState.selectedCards.some(c => cardsEqual(c, card));
        if (isSelected) el.classList.add('selected');

        el.addEventListener('click', () => {
            toggleCardSelection(card);
        });

        // Dealing animation - remove class after animation to allow selection transforms
        el.classList.add('dealing');
        el.style.animationDelay = `${i * 0.05}s`;
        el.addEventListener('animationend', () => {
            el.classList.remove('dealing');
        }, { once: true });

        container.appendChild(el);
    });

    // Update card count
    document.getElementById('count-bottom').textContent = hand.length;
}

function toggleCardSelection(card) {
    const idx = gameState.selectedCards.findIndex(c => cardsEqual(c, card));
    if (idx !== -1) {
        gameState.selectedCards.splice(idx, 1);
    } else {
        gameState.selectedCards.push(card);
    }
    playSound('click');
    updateHandDisplay();
}

function updateHandDisplay() {
    const container = document.getElementById('my-hand');
    const cards = container.querySelectorAll('.card');
    const hand = gameState.hands[gameState.myIndex];

    cards.forEach((el, i) => {
        if (i < hand.length) {
            const card = hand[i];
            const isSelected = gameState.selectedCards.some(c => cardsEqual(c, card));
            el.classList.toggle('selected', isSelected);
        }
    });
}

function renderHiddenCards(position, count) {
    const container = document.getElementById(`hand-${position}`);
    container.innerHTML = '';
    const max = Math.min(count, 13);
    for (let i = 0; i < max; i++) {
        const div = document.createElement('div');
        div.className = 'hidden-card';
        container.appendChild(div);
    }
}

function renderPlayArea(cards) {
    const area = document.getElementById('play-area');
    area.innerHTML = '';

    if (!cards || cards.length === 0) {
        area.innerHTML = '<div class="play-area-label">Khu vực đánh bài</div>';
        return;
    }

    const group = document.createElement('div');
    group.className = 'played-cards-group';

    const sorted = sortCards(cards);
    sorted.forEach((card, i) => {
        const el = createCardEl(card, true);
        el.classList.add('appear-center');
        el.style.animationDelay = `${i * 0.06}s`;
        group.appendChild(el);
    });

    area.appendChild(group);
}

function updatePlayerPositions() {
    const positions = ['left', 'top', 'right'];
    const gs = gameState;

    positions.forEach((pos, i) => {
        const playerIndex = (gs.myIndex + 1 + i) % 4;
        const slot = document.getElementById(`player-${pos}`);
        const nameEl = slot.querySelector('.player-name');
        const avatarEl = slot.querySelector('.player-avatar');
        const countEl = document.getElementById(`count-${pos}`);

        nameEl.textContent = gs.players[playerIndex].name;
        avatarEl.textContent = gs.players[playerIndex].avatar;
        countEl.textContent = gs.hands[playerIndex] ? gs.hands[playerIndex].length : 0;

        renderHiddenCards(pos, gs.hands[playerIndex] ? gs.hands[playerIndex].length : 0);
    });

    document.getElementById('my-name').textContent = gs.players[gs.myIndex].name;
}

function updateTurnIndicator() {
    const positions = ['bottom', 'left', 'top', 'right'];
    const gs = gameState;

    // Remove active-turn from all
    document.querySelectorAll('.player-slot').forEach(el => el.classList.remove('active-turn'));

    // Find which position the current turn player is at
    if (gs.currentTurn === gs.myIndex) {
        document.getElementById('player-bottom').classList.add('active-turn');
    } else {
        const offset = (gs.currentTurn - gs.myIndex + 4) % 4;
        const posMap = ['bottom', 'left', 'top', 'right'];
        const pos = posMap[offset];
        const slot = document.getElementById(`player-${pos}`);
        if (slot) slot.classList.add('active-turn');
    }
}

function updateCardCounts() {
    const gs = gameState;
    document.getElementById('count-bottom').textContent = gs.hands[gs.myIndex] ? gs.hands[gs.myIndex].length : 0;

    const positions = ['left', 'top', 'right'];
    positions.forEach((pos, i) => {
        const playerIndex = (gs.myIndex + 1 + i) % 4;
        document.getElementById(`count-${pos}`).textContent = gs.hands[playerIndex] ? gs.hands[playerIndex].length : 0;
        renderHiddenCards(pos, gs.hands[playerIndex] ? gs.hands[playerIndex].length : 0);
    });
}

function updateControls() {
    const gs = gameState;
    const isMyTurn = gs.currentTurn === gs.myIndex;
    const controls = document.getElementById('game-controls');

    document.getElementById('btn-play').disabled = !isMyTurn;
    document.getElementById('btn-pass').disabled = !isMyTurn || gs.isFirstTurn;

    if (isMyTurn) {
        controls.style.opacity = '1';
        controls.style.pointerEvents = 'auto';
    } else {
        controls.style.opacity = '0.5';
        controls.style.pointerEvents = 'none';
    }
}

// ==================== GAME MESSAGE ====================
let messageTimeout = null;

function showMessage(text, duration) {
    const el = document.getElementById('game-message');
    el.textContent = text;
    el.classList.add('show');

    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        el.classList.remove('show');
    }, duration || 2000);
}

// ==================== OFFLINE GAME ====================
function startOfflineGame() {
    const gs = gameState;
    gs.hands = dealCards();
    gs.finishOrder = [];
    gs.lastPlay = null;
    gs.lastPlayedBy = -1;
    gs.passCount = 0;
    gs.isFirstTurn = true;
    gs.selectedCards = [];
    gs.myIndex = 0;
    gs.players = [
        { name: 'Bạn', avatar: '😎' },
        { name: 'AI 1', avatar: '🤖' },
        { name: 'AI 2', avatar: '🤖' },
        { name: 'AI 3', avatar: '🤖' }
    ];

    gs.currentTurn = findStartingPlayer(gs.hands);

    updatePlayerPositions();
    renderMyHand();
    renderPlayArea(null);
    updateTurnIndicator();
    updateControls();

    playSound('deal');

    if (gs.currentTurn === gs.myIndex) {
        showMessage('Bạn có 3♠ - Đánh trước!', 3000);
    } else {
        showMessage(`${gs.players[gs.currentTurn].name} có 3♠ - Đánh trước!`, 3000);
        setTimeout(() => aiPlay(), getSpeedMs(1200));
    }
}

function playCards() {
    const gs = gameState;

    if (gs.mode === 'online') {
        if (gs.selectedCards.length === 0) {
            showMessage('Chọn bài để đánh!', 1500);
            playSound('error');
            return;
        }
        socket.emit('playCards', gs.selectedCards);
        gs.selectedCards = [];
        return;
    }

    // Offline mode
    if (gs.currentTurn !== gs.myIndex) return;

    if (gs.selectedCards.length === 0) {
        showMessage('Chọn bài để đánh!', 1500);
        playSound('error');
        return;
    }

    const combo = getComboType(gs.selectedCards);
    if (!combo) {
        showMessage('Bài không hợp lệ!', 1500);
        playSound('error');
        return;
    }

    // First turn must include 3 of spades
    if (gs.isFirstTurn) {
        const has3Spade = gs.selectedCards.some(c => c.rank === '3' && c.suit === 'spade');
        if (!has3Spade) {
            showMessage('Lượt đầu phải có 3♠!', 1500);
            playSound('error');
            return;
        }
    }

    // Check if can beat last play
    if (gs.lastPlay && gs.lastPlayedBy !== gs.myIndex) {
        if (!canBeat(gs.lastPlay, combo)) {
            showMessage('Bài không đủ lớn!', 1500);
            playSound('error');
            return;
        }
    }

    // Remove cards from hand
    for (const card of gs.selectedCards) {
        const idx = gs.hands[gs.myIndex].findIndex(c => cardsEqual(c, card));
        if (idx !== -1) gs.hands[gs.myIndex].splice(idx, 1);
    }

    // Update game state
    const playedCards = [...gs.selectedCards];
    gs.lastPlay = combo;
    gs.lastPlayedBy = gs.myIndex;
    gs.passCount = 0;
    gs.isFirstTurn = false;
    gs.selectedCards = [];

    // Render
    renderPlayArea(playedCards);
    renderMyHand();
    updateCardCounts();
    playSound('play');

    // Check if player finished
    if (gs.hands[gs.myIndex].length === 0) {
        gs.finishOrder.push(gs.myIndex);
    }

    // Check game over
    const activePlayers = [0, 1, 2, 3].filter(i => !gs.finishOrder.includes(i));
    if (activePlayers.length <= 1) {
        for (const i of activePlayers) {
            if (!gs.finishOrder.includes(i)) gs.finishOrder.push(i);
        }
        setTimeout(() => showVictory(), getSpeedMs(800));
        return;
    }

    advanceTurn();
}

function passTurn() {
    const gs = gameState;

    if (gs.mode === 'online') {
        socket.emit('passTurn');
        return;
    }

    // Offline mode
    if (gs.currentTurn !== gs.myIndex) return;
    if (gs.isFirstTurn) {
        showMessage('Lượt đầu phải đánh bài!', 1500);
        playSound('error');
        return;
    }

    gs.passCount++;
    playSound('pass');
    showPassIndicator('bottom');

    // Check if all others passed
    const activePlayers = [0, 1, 2, 3].filter(i => !gs.finishOrder.includes(i)).length;
    if (gs.passCount >= activePlayers - 1) {
        gs.lastPlay = null;
        gs.lastPlayedBy = -1;
        gs.passCount = 0;
        setTimeout(() => renderPlayArea(null), getSpeedMs(600));
    }

    advanceTurn();
}

function advanceTurn() {
    const gs = gameState;
    let next = (gs.currentTurn + 1) % 4;
    let attempts = 0;
    while (gs.finishOrder.includes(next) && attempts < 4) {
        next = (next + 1) % 4;
        attempts++;
    }

    gs.currentTurn = next;
    updateTurnIndicator();
    updateControls();

    // If AI's turn
    if (gs.mode === 'offline' && gs.currentTurn !== gs.myIndex) {
        setTimeout(() => aiPlay(), getSpeedMs(1000));
    }
}

function showPassIndicator(position) {
    const slot = document.getElementById(`player-${position}`);
    const indicator = document.createElement('div');
    indicator.className = 'pass-indicator';
    indicator.textContent = 'BỎ LƯỢT';
    slot.appendChild(indicator);
    setTimeout(() => indicator.remove(), 1500);
}

// ==================== AI LOGIC ====================
function aiPlay() {
    const gs = gameState;
    if (gs.currentTurn === gs.myIndex) return;
    if (gs.finishOrder.includes(gs.currentTurn)) {
        advanceTurn();
        return;
    }

    const hand = gs.hands[gs.currentTurn];
    if (!hand || hand.length === 0) {
        advanceTurn();
        return;
    }

    const playerIndex = gs.currentTurn;
    const position = getPlayerPosition(playerIndex);

    // Find valid play
    let validPlay = null;

    if (gs.isFirstTurn) {
        // Must include 3 of spades
        validPlay = findFirstTurnPlay(hand);
    } else if (!gs.lastPlay || gs.lastPlayedBy === playerIndex) {
        // Free turn - play smallest
        validPlay = findSmallestPlay(hand);
    } else {
        // Must beat last play
        validPlay = findBeatingPlay(hand, gs.lastPlay);
    }

    if (validPlay) {
        // Remove cards from hand
        for (const card of validPlay) {
            const idx = hand.findIndex(c => cardsEqual(c, card));
            if (idx !== -1) hand.splice(idx, 1);
        }

        const combo = getComboType(validPlay);
        gs.lastPlay = combo;
        gs.lastPlayedBy = playerIndex;
        gs.passCount = 0;
        gs.isFirstTurn = false;

        renderPlayArea(validPlay);
        updateCardCounts();
        playSound('play');
        showMessage(`${gs.players[playerIndex].name} đánh ${getComboName(combo)}`, 1500);

        // Check if AI finished
        if (hand.length === 0) {
            gs.finishOrder.push(playerIndex);
        }

        // Check game over
        const activePlayers = [0, 1, 2, 3].filter(i => !gs.finishOrder.includes(i));
        if (activePlayers.length <= 1) {
            for (const i of activePlayers) {
                if (!gs.finishOrder.includes(i)) gs.finishOrder.push(i);
            }
            setTimeout(() => showVictory(), getSpeedMs(800));
            return;
        }

        advanceTurn();
    } else {
        // Pass
        gs.passCount++;
        playSound('pass');
        showPassIndicator(position);
        showMessage(`${gs.players[playerIndex].name} bỏ lượt`, 1200);

        const activePlayers = [0, 1, 2, 3].filter(i => !gs.finishOrder.includes(i)).length;
        if (gs.passCount >= activePlayers - 1) {
            gs.lastPlay = null;
            gs.lastPlayedBy = -1;
            gs.passCount = 0;
            setTimeout(() => renderPlayArea(null), getSpeedMs(600));
        }

        advanceTurn();
    }
}

function getPlayerPosition(playerIndex) {
    const offset = (playerIndex - gameState.myIndex + 4) % 4;
    return ['bottom', 'left', 'top', 'right'][offset];
}

function findFirstTurnPlay(hand) {
    // Must include 3♠
    const threeSpade = hand.find(c => c.rank === '3' && c.suit === 'spade');
    if (!threeSpade) return null;

    // Try to play a pair/triple with 3
    const threes = hand.filter(c => c.rank === '3');
    if (threes.length >= 2) return threes.slice(0, 2);

    // Just play the single 3♠
    return [threeSpade];
}

function findSmallestPlay(hand) {
    if (hand.length === 0) return null;

    // Try single (smallest card)
    return [hand[0]];
}

function findBeatingPlay(hand, lastCombo) {
    if (!lastCombo) return findSmallestPlay(hand);

    const sorted = sortCards(hand);

    switch (lastCombo.type) {
        case 'single':
            return findBeatingSingle(sorted, lastCombo);
        case 'pair':
            return findBeatingPair(sorted, lastCombo);
        case 'triple':
            return findBeatingTriple(sorted, lastCombo);
        case 'four':
            return findBeatingFour(sorted, lastCombo);
        case 'straight':
            return findBeatingStraight(sorted, lastCombo);
        case 'doubleStraight':
            return findBeatingDoubleStraight(sorted, lastCombo);
        default:
            return null;
    }
}

function findBeatingSingle(hand, lastCombo) {
    // Find smallest single that beats it
    for (const card of hand) {
        if (cardValue(card) > cardValue(lastCombo.topCard)) {
            return [card];
        }
    }

    // If last was a 2, try four-of-a-kind or consecutive pairs
    if (lastCombo.rank === 12) {
        const four = findFourOfAKind(hand);
        if (four) return four;
        const dbl = findDoubleStraightOfLength(hand, 3);
        if (dbl) return dbl;
    }

    return null;
}

function findBeatingPair(hand, lastCombo) {
    // Find pairs
    const groups = groupByRank(hand);
    for (const rank of RANKS) {
        const group = groups[rank];
        if (group && group.length >= 2) {
            const combo = getComboType(group.slice(0, 2));
            if (combo && canBeat(lastCombo, combo)) {
                return group.slice(0, 2);
            }
        }
    }

    // If last was pair of 2s, try four-of-a-kind or 4 consecutive pairs
    if (lastCombo.rank === 12) {
        const four = findFourOfAKind(hand);
        if (four) return four;
        const dbl = findDoubleStraightOfLength(hand, 4);
        if (dbl) return dbl;
    }

    return null;
}

function findBeatingTriple(hand, lastCombo) {
    const groups = groupByRank(hand);
    for (const rank of RANKS) {
        const group = groups[rank];
        if (group && group.length >= 3) {
            const combo = getComboType(group.slice(0, 3));
            if (combo && canBeat(lastCombo, combo)) {
                return group.slice(0, 3);
            }
        }
    }
    return null;
}

function findBeatingFour(hand, lastCombo) {
    const groups = groupByRank(hand);
    for (const rank of RANKS) {
        const group = groups[rank];
        if (group && group.length >= 4) {
            const combo = getComboType(group.slice(0, 4));
            if (combo && canBeat(lastCombo, combo)) {
                return group.slice(0, 4);
            }
        }
    }
    return null;
}

function findBeatingStraight(hand, lastCombo) {
    const len = lastCombo.length;
    // Try all possible straights of same length
    for (let startIdx = 0; startIdx <= RANKS.length - len; startIdx++) {
        if (startIdx + len - 1 >= 12) continue; // no 2 in straight

        const straightCards = [];
        let valid = true;
        for (let j = 0; j < len; j++) {
            const targetRank = RANKS[startIdx + j];
            const card = hand.find(c => c.rank === targetRank && !straightCards.some(s => cardsEqual(s, c)));
            if (!card) { valid = false; break; }
            straightCards.push(card);
        }
        if (valid) {
            const combo = getComboType(straightCards);
            if (combo && canBeat(lastCombo, combo)) {
                return straightCards;
            }
        }
    }
    return null;
}

function findBeatingDoubleStraight(hand, lastCombo) {
    const numPairs = lastCombo.length;
    const groups = groupByRank(hand);

    for (let startIdx = 0; startIdx <= RANKS.length - numPairs; startIdx++) {
        if (startIdx + numPairs - 1 >= 12) continue;

        const dblCards = [];
        let valid = true;
        for (let j = 0; j < numPairs; j++) {
            const targetRank = RANKS[startIdx + j];
            const group = groups[targetRank];
            if (!group || group.length < 2) { valid = false; break; }
            dblCards.push(group[0], group[1]);
        }
        if (valid) {
            const combo = getComboType(dblCards);
            if (combo && canBeat(lastCombo, combo)) {
                return dblCards;
            }
        }
    }
    return null;
}

function findFourOfAKind(hand) {
    const groups = groupByRank(hand);
    for (const rank of RANKS) {
        if (groups[rank] && groups[rank].length >= 4) {
            return groups[rank].slice(0, 4);
        }
    }
    return null;
}

function findDoubleStraightOfLength(hand, minPairs) {
    const groups = groupByRank(hand);
    for (let startIdx = 0; startIdx <= RANKS.length - minPairs; startIdx++) {
        if (startIdx + minPairs - 1 >= 12) continue;
        const cards = [];
        let valid = true;
        for (let j = 0; j < minPairs; j++) {
            const r = RANKS[startIdx + j];
            if (!groups[r] || groups[r].length < 2) { valid = false; break; }
            cards.push(groups[r][0], groups[r][1]);
        }
        if (valid) return cards;
    }
    return null;
}

function groupByRank(hand) {
    const groups = {};
    for (const card of hand) {
        if (!groups[card.rank]) groups[card.rank] = [];
        groups[card.rank].push(card);
    }
    return groups;
}

function getComboName(combo) {
    if (!combo) return '';
    switch (combo.type) {
        case 'single': return `lẻ ${combo.topCard.rank}`;
        case 'pair': return `đôi ${combo.topCard.rank}`;
        case 'triple': return `ba ${combo.topCard.rank}`;
        case 'four': return `tứ quý ${combo.topCard.rank}`;
        case 'straight': return `sảnh ${combo.length} lá`;
        case 'doubleStraight': return `sảnh đôi ${combo.length} đôi`;
        default: return '';
    }
}

function sortMyHand() {
    if (!gameState.hands[gameState.myIndex]) return;
    gameState.hands[gameState.myIndex] = sortCards(gameState.hands[gameState.myIndex]);
    gameState.selectedCards = [];
    renderMyHand();
    playSound('click');
}

// ==================== VICTORY ====================
function showVictory() {
    const gs = gameState;
    const rankings = gs.finishOrder.map((idx, rank) => ({
        name: gs.players[idx].name,
        rank: rank + 1,
        icon: RANK_ICONS[rank] || '🏅'
    }));

    const container = document.getElementById('victory-rankings');
    container.innerHTML = '';

    rankings.forEach((r) => {
        const item = document.createElement('div');
        item.className = `ranking-item${r.rank === 1 ? ' first' : ''}`;
        item.innerHTML = `
            <span class="ranking-icon">${r.icon}</span>
            <span class="ranking-name">${r.name}</span>
            <span class="ranking-position">Hạng ${r.rank}</span>
        `;
        container.appendChild(item);
    });

    document.getElementById('victory-overlay').style.display = 'flex';
    createConfetti();

    if (rankings[0] && rankings[0].name === gs.players[gs.myIndex].name) {
        playSound('win');
    }
}

function createConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = '';
    const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12'];

    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';

        const shapes = ['50%', '0', '50% 0 50% 50%'];
        confetti.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)];

        if (Math.random() > 0.5) {
            confetti.style.width = '8px';
            confetti.style.height = '14px';
        }

        container.appendChild(confetti);
    }
}

function playAgain() {
    document.getElementById('victory-overlay').style.display = 'none';
    document.getElementById('confetti-container').innerHTML = '';

    if (gameState.mode === 'offline') {
        startOfflineGame();
    } else if (gameState.mode === 'online') {
        // In online mode, go back to room
        showScreen('room-screen');
    }
}

// ==================== ONLINE MODE (SOCKET.IO) ====================
let socket = null;

function connectSocket() {
    if (socket && socket.connected) return;

    socket = io();

    socket.on('connect', () => {
        console.log('Đã kết nối tới server');
    });

    socket.on('roomCreated', (data) => {
        gameState.roomId = data.roomId;
        gameState.isHost = true;
        document.getElementById('room-id-text').textContent = data.roomId;
        updateRoomPlayers(data.players);
        showScreen('room-screen');
        document.getElementById('btn-start-game').style.display = 'flex';
    });

    socket.on('playerJoined', (data) => {
        updateRoomPlayers(data.players);
        playSound('deal');
    });

    socket.on('playerLeft', (data) => {
        updateRoomPlayers(data.players);
        showMessage(`${data.name} đã rời phòng`, 2000);
    });

    socket.on('gameStarted', (data) => {
        gameState.mode = 'online';
        gameState.myIndex = data.playerIndex;
        gameState.hands = [[], [], [], []];
        gameState.hands[data.playerIndex] = data.hand;
        gameState.currentTurn = data.currentTurn;
        gameState.lastPlay = null;
        gameState.lastPlayedBy = -1;
        gameState.passCount = 0;
        gameState.isFirstTurn = data.isFirstTurn;
        gameState.finishOrder = [];
        gameState.selectedCards = [];

        // Setup player info from server data
        gameState.players = data.players.map((p, i) => ({
            name: p.name,
            avatar: i === data.playerIndex ? '😎' : '👤'
        }));
        // Pad to 4 if needed
        while (gameState.players.length < 4) {
            gameState.players.push({ name: '---', avatar: '❌' });
        }
        // Set card counts for opponents
        data.players.forEach((p, i) => {
            if (i !== data.playerIndex) {
                gameState.hands[i] = new Array(p.cardCount);
            }
        });

        showScreen('game-screen');
        updatePlayerPositions();
        renderMyHand();
        renderPlayArea(null);
        updateTurnIndicator();
        updateControls();
        playSound('deal');

        if (gameState.currentTurn === gameState.myIndex) {
            showMessage('Lượt của bạn! Đánh bài có 3♠', 3000);
        } else {
            showMessage(`Lượt của ${gameState.players[gameState.currentTurn].name}`, 2000);
        }
    });

    socket.on('playerPlayed', (data) => {
        renderPlayArea(data.cards);
        playSound('play');

        // Update card counts
        data.cardCounts.forEach((count, i) => {
            if (i !== gameState.myIndex) {
                gameState.hands[i] = new Array(count);
            }
        });
        updateCardCounts();
        showMessage(`${gameState.players[data.playerIndex].name} đánh bài`, 1200);
    });

    socket.on('playerPassed', (data) => {
        playSound('pass');
        const pos = getPlayerPosition(data.playerIndex);
        showPassIndicator(pos);
        showMessage(`${gameState.players[data.playerIndex].name} bỏ lượt`, 1200);
    });

    socket.on('nextTurn', (data) => {
        gameState.currentTurn = data.currentTurn;
        gameState.lastPlay = data.lastPlay;
        gameState.lastPlayedBy = data.lastPlayedBy;
        gameState.isFirstTurn = false;

        if (data.hand) {
            gameState.hands[gameState.myIndex] = data.hand;
            gameState.selectedCards = [];
            renderMyHand();
        }

        data.cardCounts.forEach((count, i) => {
            if (i !== gameState.myIndex) {
                gameState.hands[i] = new Array(count);
            }
        });

        if (!data.lastPlay) {
            renderPlayArea(null);
        }

        updateCardCounts();
        updateTurnIndicator();
        updateControls();

        if (gameState.currentTurn === gameState.myIndex) {
            showMessage('Lượt của bạn!', 1500);
        }
    });

    socket.on('gameWinner', (data) => {
        const gs = gameState;
        gs.finishOrder = [];

        const rankingsContainer = document.getElementById('victory-rankings');
        rankingsContainer.innerHTML = '';

        data.rankings.forEach((r, i) => {
            const item = document.createElement('div');
            item.className = `ranking-item${i === 0 ? ' first' : ''}`;
            item.innerHTML = `
                <span class="ranking-icon">${RANK_ICONS[i] || '🏅'}</span>
                <span class="ranking-name">${r.name}</span>
                <span class="ranking-position">Hạng ${r.rank}</span>
            `;
            rankingsContainer.appendChild(item);
        });

        document.getElementById('victory-overlay').style.display = 'flex';
        createConfetti();

        if (data.rankings[0] && data.rankings[0].name === gs.players[gs.myIndex].name) {
            playSound('win');
        }
    });

    socket.on('invalidMove', (msg) => {
        showMessage(msg, 1500);
        playSound('error');
    });

    socket.on('error', (msg) => {
        showMessage(msg, 2000);
        playSound('error');
    });

    // Chat
    socket.on('newMessage', (data) => {
        addChatMessage(data);
    });

    socket.on('disconnect', () => {
        console.log('Mất kết nối');
        showMessage('Mất kết nối server!', 3000);
    });
}

function createRoom() {
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput.value.trim();
    if (!name) {
        showMessage('Nhập tên của bạn!', 1500);
        playSound('error');
        return;
    }
    connectSocket();
    socket.emit('createRoom', name);
}

function joinRoom() {
    const nameInput = document.getElementById('player-name-input');
    const roomInput = document.getElementById('room-id-input');
    const name = nameInput.value.trim();
    const roomId = roomInput.value.trim().toUpperCase();

    if (!name) {
        showMessage('Nhập tên của bạn!', 1500);
        playSound('error');
        return;
    }
    if (!roomId) {
        showMessage('Nhập mã phòng!', 1500);
        playSound('error');
        return;
    }

    connectSocket();
    gameState.isHost = false;
    socket.emit('joinRoom', { roomId, playerName: name });
}

function leaveRoom() {
    if (socket && socket.connected) {
        socket.disconnect();
        socket = null;
    }
    gameState.roomId = null;
    backToMenu();
}

function startOnlineGame() {
    if (!socket) return;
    socket.emit('startGame');
}

function updateRoomPlayers(players) {
    const container = document.getElementById('room-players');
    container.innerHTML = '';

    players.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'room-player-item';
        item.innerHTML = `
            <span class="player-avatar">👤</span>
            <span>${p.name}</span>
            ${i === 0 ? '<span class="host-badge">👑 Chủ phòng</span>' : ''}
        `;
        container.appendChild(item);
    });

    // Show start button only for host with 2+ players
    const startBtn = document.getElementById('btn-start-game');
    if (gameState.isHost && players.length >= 2) {
        startBtn.style.display = 'flex';
    } else {
        startBtn.style.display = 'none';
    }
}

// ==================== CHAT ====================
let chatOpen = false;
let unreadCount = 0;

function toggleChat() {
    const panel = document.getElementById('chat-panel');
    chatOpen = !chatOpen;
    panel.classList.toggle('open', chatOpen);

    if (chatOpen) {
        unreadCount = 0;
        updateChatBadge();
    }
    playSound('click');
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    if (gameState.mode === 'online' && socket) {
        socket.emit('sendMessage', message);
    } else {
        // Offline - just show locally
        addChatMessage({
            name: gameState.players[gameState.myIndex].name,
            message: message,
            time: new Date().toLocaleTimeString('vi-VN')
        });
    }
    input.value = '';
    playSound('click');
}

function sendEmoji(emoji) {
    if (gameState.mode === 'online' && socket) {
        socket.emit('sendMessage', emoji);
    } else {
        addChatMessage({
            name: gameState.players[gameState.myIndex].name,
            message: emoji,
            time: new Date().toLocaleTimeString('vi-VN')
        });
    }
    playSound('click');
}

function addChatMessage(data) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `
        <div class="msg-name">${escapeHtml(data.name)}</div>
        <div class="msg-text">${escapeHtml(data.message)}</div>
        <div class="msg-time">${data.time || ''}</div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;

    if (!chatOpen) {
        unreadCount++;
        updateChatBadge();
    }
}

function updateChatBadge() {
    const badge = document.getElementById('chat-badge');
    if (unreadCount > 0) {
        badge.style.display = 'flex';
        badge.textContent = unreadCount;
    } else {
        badge.style.display = 'none';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Chat enter key
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
});

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    showScreen('menu-screen');
});
