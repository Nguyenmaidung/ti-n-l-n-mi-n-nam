const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ==================== GAME LOGIC ====================

const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUITS = ['spade', 'club', 'diamond', 'heart'];

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

function cardValue(card) {
    return RANKS.indexOf(card.rank) * 4 + SUITS.indexOf(card.suit);
}

function sortCards(cards) {
    return [...cards].sort((a, b) => cardValue(a) - cardValue(b));
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

    if (sorted.length === 1) return { type: 'single', rank: RANKS.indexOf(sorted[0].rank), topCard: sorted[0] };

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
        // Straight cannot contain 2
        if (isStraight && RANKS.indexOf(sorted[sorted.length - 1].rank) < 12) {
            return { type: 'straight', rank: RANKS.indexOf(sorted[sorted.length - 1].rank), length: sorted.length, topCard: sorted[sorted.length - 1] };
        }
    }

    // Double straight (sảnh đôi) - pairs in sequence
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
            // Cannot contain 2
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

    // Compare by card value (rank * 4 + suit)
    return cardValue(newCombo.topCard) > cardValue(lastCombo.topCard);
}

// ==================== ROOMS ====================

const rooms = {};

function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

io.on('connection', (socket) => {
    console.log('Người chơi kết nối:', socket.id);

    socket.on('createRoom', (playerName) => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            id: roomId,
            players: [{ id: socket.id, name: playerName, ready: false }],
            host: socket.id,
            gameState: null
        };
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerName = playerName;
        socket.emit('roomCreated', { roomId, players: rooms[roomId].players });
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms[roomId];
        if (!room) {
            socket.emit('error', 'Phòng không tồn tại!');
            return;
        }
        if (room.players.length >= 4) {
            socket.emit('error', 'Phòng đã đầy!');
            return;
        }
        if (room.gameState) {
            socket.emit('error', 'Game đang diễn ra!');
            return;
        }

        room.players.push({ id: socket.id, name: playerName, ready: false });
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerName = playerName;

        io.to(roomId).emit('playerJoined', { players: room.players });
    });

    socket.on('startGame', () => {
        const room = rooms[socket.roomId];
        if (!room || socket.id !== room.host) return;
        if (room.players.length < 2) {
            socket.emit('error', 'Cần ít nhất 2 người chơi!');
            return;
        }

        const hands = dealCards();
        // If less than 4 players, just use however many we have
        const playerCount = room.players.length;

        // Re-deal for actual player count
        const deck = shuffleDeck(createDeck());
        const cardsPerPlayer = Math.floor(52 / playerCount);
        const playerHands = [];
        for (let i = 0; i < playerCount; i++) {
            playerHands.push(sortCards(deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer)));
        }

        const startingPlayer = findStartingPlayer(playerHands);

        room.gameState = {
            hands: playerHands,
            currentTurn: startingPlayer,
            lastPlay: null,
            lastPlayedBy: -1,
            passCount: 0,
            isFirstTurn: true,
            finishOrder: [],
            rankings: []
        };

        // Send each player their own hand
        room.players.forEach((player, index) => {
            io.to(player.id).emit('gameStarted', {
                hand: playerHands[index],
                playerIndex: index,
                currentTurn: startingPlayer,
                players: room.players.map(p => ({ name: p.name, cardCount: playerHands[room.players.indexOf(p)].length })),
                isFirstTurn: true
            });
        });
    });

    socket.on('playCards', (cards) => {
        const room = rooms[socket.roomId];
        if (!room || !room.gameState) return;

        const gs = room.gameState;
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== gs.currentTurn) return;

        // Validate cards are in player's hand
        const hand = gs.hands[playerIndex];
        const playedCards = cards.map(c => hand.find(h => h.rank === c.rank && h.suit === c.suit)).filter(Boolean);
        if (playedCards.length !== cards.length) return;

        const combo = getComboType(playedCards);
        if (!combo) {
            socket.emit('invalidMove', 'Bài không hợp lệ!');
            return;
        }

        // First turn must include 3 of spades
        if (gs.isFirstTurn) {
            const has3Spade = playedCards.some(c => c.rank === '3' && c.suit === 'spade');
            if (!has3Spade) {
                socket.emit('invalidMove', 'Lượt đầu phải có 3 bích!');
                return;
            }
        }

        if (gs.lastPlay && gs.lastPlayedBy !== playerIndex) {
            if (!canBeat(gs.lastPlay, combo)) {
                socket.emit('invalidMove', 'Bài không đủ lớn!');
                return;
            }
        }

        // Remove cards from hand
        for (const card of playedCards) {
            const idx = hand.findIndex(h => h.rank === card.rank && h.suit === card.suit);
            if (idx !== -1) hand.splice(idx, 1);
        }

        gs.lastPlay = combo;
        gs.lastPlayedBy = playerIndex;
        gs.passCount = 0;
        gs.isFirstTurn = false;

        // Check if player finished
        if (hand.length === 0) {
            gs.finishOrder.push(playerIndex);
        }

        // Broadcast
        io.to(socket.roomId).emit('playerPlayed', {
            playerIndex,
            cards: playedCards,
            cardCounts: room.players.map((p, i) => gs.hands[i].length)
        });

        // Check game over
        const activePlayers = room.players.filter((p, i) => !gs.finishOrder.includes(i));
        if (activePlayers.length <= 1) {
            // Last player is the loser
            room.players.forEach((p, i) => {
                if (!gs.finishOrder.includes(i)) gs.finishOrder.push(i);
            });
            const rankings = gs.finishOrder.map((idx, rank) => ({
                name: room.players[idx].name,
                rank: rank + 1
            }));
            io.to(socket.roomId).emit('gameWinner', { rankings });
            room.gameState = null;
            return;
        }

        // Next turn
        advanceTurn(room);
    });

    socket.on('passTurn', () => {
        const room = rooms[socket.roomId];
        if (!room || !room.gameState) return;

        const gs = room.gameState;
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== gs.currentTurn) return;

        if (gs.isFirstTurn) {
            socket.emit('invalidMove', 'Lượt đầu phải đánh bài!');
            return;
        }

        gs.passCount++;

        io.to(socket.roomId).emit('playerPassed', { playerIndex });

        // If all other active players passed, reset
        const activePlayers = room.players.filter((p, i) => !gs.finishOrder.includes(i)).length;
        if (gs.passCount >= activePlayers - 1) {
            gs.lastPlay = null;
            gs.lastPlayedBy = -1;
            gs.passCount = 0;
        }

        advanceTurn(room);
    });

    function advanceTurn(room) {
        const gs = room.gameState;
        const playerCount = room.players.length;
        let next = (gs.currentTurn + 1) % playerCount;

        // Skip finished players
        let attempts = 0;
        while (gs.finishOrder.includes(next) && attempts < playerCount) {
            next = (next + 1) % playerCount;
            attempts++;
        }

        gs.currentTurn = next;

        // Send each player their updated hand
        room.players.forEach((player, index) => {
            io.to(player.id).emit('nextTurn', {
                currentTurn: gs.currentTurn,
                hand: gs.hands[index],
                lastPlay: gs.lastPlay,
                lastPlayedBy: gs.lastPlayedBy,
                cardCounts: room.players.map((p, i) => gs.hands[i].length)
            });
        });
    }

    // Chat
    socket.on('sendMessage', (message) => {
        if (!socket.roomId) return;
        io.to(socket.roomId).emit('newMessage', {
            name: socket.playerName || 'Ẩn danh',
            message: message,
            time: new Date().toLocaleTimeString('vi-VN')
        });
    });

    socket.on('disconnect', () => {
        console.log('Người chơi ngắt kết nối:', socket.id);
        if (socket.roomId && rooms[socket.roomId]) {
            const room = rooms[socket.roomId];
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0) {
                delete rooms[socket.roomId];
            } else {
                if (room.host === socket.id) {
                    room.host = room.players[0].id;
                }
                io.to(socket.roomId).emit('playerLeft', {
                    players: room.players,
                    name: socket.playerName
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎮 Tiến Lên Miền Nam đang chạy tại http://localhost:${PORT}`);
});
