import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { supabase } from './supabase.js';

// Load environment variables
dotenv.config();

// Log startup info (non-sensitive)
console.log('🔧 Starting Backend Server...');
console.log('📦 Node version:', process.version);
console.log('📁 Working directory:', process.cwd());
console.log('🔐 Environment:', process.env.NODE_ENV || 'development');

const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:5000';

const app = express();
const httpServer = createServer(app);

// Configure CORS for Socket.io - allow all origins for public matchmaking service
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for public service
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

// Middleware - CORS for HTTP requests
app.use(cors({
  origin: "*", // Allow all origins for public API
  credentials: false
}));
app.use(express.json());

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backgammon Arena API is running' });
});

// Proxy CPU move requests to Python AI service
app.post('/api/cpu/move', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/cpu/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling Python AI service:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Proxy CPU double decision requests to Python AI service
app.post('/api/cpu/double', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/cpu/double`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling Python AI service:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Evaluate current position (for evaluation bar display)
app.post('/api/evaluate', async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling Python AI service for evaluation:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Matchmaking queues
const guestQueue = []; // Simple queue for guest matchmaking
const rankedQueue = []; // Array of { socketId, userId, elo, timestamp } for ranked matchmaking

// ELO calculation function (standard chess.com formula)
function calculateELOChange(playerELO, opponentELO, result) {
  // result: 1 = win, 0.5 = draw, 0 = loss
  const K = 32; // K-factor (standard for chess.com)
  const expectedScore = 1 / (1 + Math.pow(10, (opponentELO - playerELO) / 400));
  const eloChange = Math.round(K * (result - expectedScore));
  return eloChange;
}

// Active matches: matchId -> { player1: { socketId, userId }, player2: { socketId, userId }, gameState }
const activeMatches = new Map();

// Helper function to match players
function matchPlayers(queue, player1, player2) {
  const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Remove both players from queue
  const index1 = queue.findIndex(p => p.socketId === player1.socketId);
  const index2 = queue.findIndex(p => p.socketId === player2.socketId);
  if (index1 !== -1) queue.splice(index1, 1);
  if (index2 !== -1) queue.splice(index2, 1);
  
  return {
    matchId,
    player1: {
      socketId: player1.socketId,
      userId: player1.userId,
      isGuest: player1.isGuest
    },
    player2: {
      socketId: player2.socketId,
      userId: player2.userId,
      isGuest: player2.isGuest
    }
  };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  console.log('📊 Current guest queue size:', guestQueue.length);
  
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
  
  // Rejoin active match handler (for reconnection after refresh)
  socket.on('game:rejoin', (data) => {
    const { matchId, playerNumber, userId } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Match not found for rejoin:', matchId);
      socket.emit('game:rejoin-error', { 
        matchId, 
        message: 'Match no longer exists' 
      });
      return;
    }
    
    // Verify player identity
    const expectedPlayer = playerNumber === 1 ? match.player1 : match.player2;
    if (userId && expectedPlayer.userId && expectedPlayer.userId !== userId) {
      console.error('❌ User ID mismatch for rejoin:', { expected: expectedPlayer.userId, received: userId });
      socket.emit('game:rejoin-error', { 
        matchId, 
        message: 'Invalid player credentials' 
      });
      return;
    }
    
    // Update socket ID for this player
    if (playerNumber === 1) {
      match.player1.socketId = socket.id;
    } else {
      match.player2.socketId = socket.id;
    }
    
    console.log(`✅ Player ${playerNumber} rejoined match ${matchId} with new socket ${socket.id}`);
    
    // Send success response with current game state
    socket.emit('game:rejoin-success', {
      matchId,
      playerNumber,
      gameState: match.gameState || null
    });
    
    // Notify opponent that player reconnected
    const opponentSocketId = playerNumber === 1 ? match.player2.socketId : match.player1.socketId;
    if (opponentSocketId) {
      io.to(opponentSocketId).emit('game:opponent-reconnected', {
        matchId
      });
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 User disconnected:', socket.id, 'Reason:', reason);
    
    // Remove from guest queue
    const guestIndex = guestQueue.findIndex(p => p.socketId === socket.id);
    if (guestIndex !== -1) {
      guestQueue.splice(guestIndex, 1);
      console.log('👤 Removed from guest queue, new size:', guestQueue.length);
    }
    
    // Remove from ranked queue
    const rankedIndex = rankedQueue.findIndex(p => p.socketId === socket.id);
    if (rankedIndex !== -1) {
      rankedQueue.splice(rankedIndex, 1);
      console.log('👤 Removed from ranked queue, new size:', rankedQueue.length);
    }
    
    // Clean up active matches where this socket was a player
    // But don't remove immediately - wait for potential reconnection
    for (const [matchId, match] of activeMatches.entries()) {
      if (match.player1.socketId === socket.id || match.player2.socketId === socket.id) {
        const opponentSocketId = match.player1.socketId === socket.id 
          ? match.player2.socketId 
          : match.player1.socketId;
        
        // Notify opponent of disconnect
        if (opponentSocketId) {
          io.to(opponentSocketId).emit('game:opponent-disconnected', {
            matchId
          });
        }
        
        // Remove match after a delay (in case of reconnection)
        setTimeout(() => {
          // Only remove if socket still matches (player didn't reconnect)
          const currentMatch = activeMatches.get(matchId);
          if (currentMatch) {
            // Check if the disconnected socket is still in the match
            const isPlayer1 = currentMatch.player1.socketId === socket.id;
            const isPlayer2 = currentMatch.player2.socketId === socket.id;
            if (isPlayer1 || isPlayer2) {
              activeMatches.delete(matchId);
              console.log(`🗑️ Cleaned up match ${matchId}`);
            }
          }
        }, 30000); // 30 second grace period
      }
    }
  });

  // Guest matchmaking
  socket.on('matchmaking:guest:join', () => {
    console.log('🎮 Guest joining matchmaking queue:', socket.id);
    
    // Remove from any existing queue position
    const existingIndex = guestQueue.findIndex(p => p.socketId === socket.id);
    if (existingIndex !== -1) {
      guestQueue.splice(existingIndex, 1);
    }
    
    // Add to guest queue
    guestQueue.push({
      socketId: socket.id,
      userId: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isGuest: true,
      timestamp: Date.now()
    });
    
    // Try to find a match
    if (guestQueue.length >= 2) {
      const player1 = guestQueue[0];
      const player2 = guestQueue[1];
      const match = matchPlayers(guestQueue, player1, player2);
      
      console.log('Match found for guests:', match.matchId);
      
      // Store match in active matches
      activeMatches.set(match.matchId, {
        player1: match.player1,
        player2: match.player2,
        gameState: null,
        createdAt: Date.now()
      });
      
      // Notify both players
      io.to(match.player1.socketId).emit('matchmaking:match-found', {
        matchId: match.matchId,
        playerNumber: 1,
        opponent: {
          userId: match.player2.userId,
          isGuest: match.player2.isGuest
        }
      });
      
      io.to(match.player2.socketId).emit('matchmaking:match-found', {
        matchId: match.matchId,
        playerNumber: 2,
        opponent: {
          userId: match.player1.userId,
          isGuest: match.player1.isGuest
        }
      });
    } else {
      // Send confirmation that player is in queue
      socket.emit('matchmaking:guest:queued', {
        position: guestQueue.length,
        estimatedWaitTime: null // Could calculate based on average wait time
      });
    }
  });
  
  // Guest matchmaking leave
  socket.on('matchmaking:guest:leave', () => {
    console.log('🚪 Guest leaving matchmaking queue:', socket.id);
    const index = guestQueue.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      guestQueue.splice(index, 1);
      console.log('👤 Removed from guest queue, new size:', guestQueue.length);
    }
    socket.emit('matchmaking:guest:left');
  });
  
  // Ranked matchmaking (for logged in users)
  socket.on('matchmaking:ranked:join', async (data) => {
    const { userId, elo } = data;
    
    if (!userId) {
      console.error('❌ No userId provided for ranked matchmaking');
      socket.emit('matchmaking:ranked:error', { message: 'Must be logged in for ranked play' });
      return;
    }
    
    console.log('🏆 User joining ranked matchmaking queue:', socket.id, { userId, elo });
    
    // Remove from any existing queue position
    const existingIndex = rankedQueue.findIndex(p => p.socketId === socket.id || p.userId === userId);
    if (existingIndex !== -1) {
      rankedQueue.splice(existingIndex, 1);
    }
    
    // Add to ranked queue
    const playerData = {
      socketId: socket.id,
      userId: userId,
      elo: elo || 1000,
      timestamp: Date.now(),
      isGuest: false
    };
    rankedQueue.push(playerData);
    
    // Try to find a match within ELO range
    // Match players within 200 ELO points, or expand range if waiting too long
    const ELO_RANGE = 200;
    const MAX_WAIT_TIME = 30000; // 30 seconds
    const waitTime = Date.now() - playerData.timestamp;
    const maxELODiff = waitTime > MAX_WAIT_TIME ? 400 : ELO_RANGE;
    
    const opponent = rankedQueue.find(p => 
      p.socketId !== socket.id && 
      p.userId !== userId &&
      Math.abs(p.elo - playerData.elo) <= maxELODiff
    );
    
    if (opponent) {
      // Found a match!
      const player1 = playerData.elo >= opponent.elo ? playerData : opponent;
      const player2 = playerData.elo >= opponent.elo ? opponent : playerData;
      const match = matchPlayers(rankedQueue, player1, player2);
      
      console.log('🏆 Ranked match found:', match.matchId, { 
        player1: { userId: player1.userId, elo: player1.elo },
        player2: { userId: player2.userId, elo: player2.elo }
      });
      
      // Store match in active matches
      activeMatches.set(match.matchId, {
        player1: match.player1,
        player2: match.player2,
        gameState: null,
        createdAt: Date.now(),
        isRanked: true,
        player1ELO: player1.elo,
        player2ELO: player2.elo
      });
      
      // Notify both players
      io.to(match.player1.socketId).emit('matchmaking:match-found', {
        matchId: match.matchId,
        playerNumber: 1,
        opponent: {
          userId: match.player2.userId,
          isGuest: false,
          elo: match.player2.elo
        }
      });
      
      io.to(match.player2.socketId).emit('matchmaking:match-found', {
        matchId: match.matchId,
        playerNumber: 2,
        opponent: {
          userId: match.player1.userId,
          isGuest: false,
          elo: match.player1.elo
        }
      });
    } else {
      // Send confirmation that player is in queue
      socket.emit('matchmaking:ranked:queued', {
        position: rankedQueue.length,
        estimatedWaitTime: null
      });
    }
  });
  
  socket.on('matchmaking:ranked:leave', () => {
    console.log('🚪 User leaving ranked matchmaking queue:', socket.id);
    const index = rankedQueue.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      rankedQueue.splice(index, 1);
      console.log('👤 Removed from ranked queue, new size:', rankedQueue.length);
    }
    socket.emit('matchmaking:ranked:left');
  });
  
  // Game event handlers
  socket.on('game:dice-roll-start', (data) => {
    const { matchId, player } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for dice roll start:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    // Broadcast dice roll animation start to opponent
    io.to(opponentSocketId).emit('game:dice-roll-start', {
      matchId,
      player
    });
    
    console.log(`🎲 Player ${player} started rolling dice in match ${matchId}`);
  });
  
  socket.on('game:dice-roll', (data) => {
    const { matchId, player, dice, movesAllowed } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for dice roll:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    // Broadcast dice roll result to opponent
    io.to(opponentSocketId).emit('game:dice-rolled', {
      matchId,
      player,
      dice,
      movesAllowed
    });
    
    console.log(`🎲 Player ${player} rolled dice in match ${matchId}`);
  });
  
  socket.on('game:move', (data) => {
    const { matchId, player, move, gameState } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for move:', matchId);
      return;
    }
    
    // Update match game state
    if (gameState) {
      match.gameState = gameState;
    }
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    // Broadcast move to opponent
    io.to(opponentSocketId).emit('game:move', {
      matchId,
      player,
      move,
      gameState
    });
    
    console.log(`🎯 Player ${player} made a move in match ${matchId}`);
  });
  
  // State sync handler (for testing/debugging)
  socket.on('game:state-sync', (data) => {
    const { matchId, player, checkers, bar, borneOff, currentPlayer, dice, hasRolled, usedDice, movesAllowed } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for state sync:', matchId);
      return;
    }
    
    // Update match game state
    const gameState = { checkers, bar, borneOff, currentPlayer, dice, hasRolled, usedDice, movesAllowed };
    match.gameState = gameState;
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    // Broadcast state sync to opponent (send properties directly)
    io.to(opponentSocketId).emit('game:state-sync', {
      matchId,
      player,
      checkers,
      bar,
      borneOff,
      currentPlayer,
      dice,
      hasRolled,
      usedDice,
      movesAllowed
    });
    
    console.log(`🔄 Player ${player} synced game state in match ${matchId}`);
  });
  
  socket.on('game:end-turn', (data) => {
    const { matchId, player, nextPlayer, gameState } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for end turn:', matchId);
      return;
    }
    
    // Update match game state
    if (gameState) {
      match.gameState = gameState;
    }
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    // Broadcast turn change to opponent
    io.to(opponentSocketId).emit('game:turn-changed', {
      matchId,
      currentPlayer: nextPlayer
    });
    
    console.log(`🔄 Player ${player} ended turn, now Player ${nextPlayer}'s turn in match ${matchId}`);
  });
  
  // Double offer handlers
  socket.on('game:double-offer', (data) => {
    const { matchId, player, doubleOffer, gameStakes } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for double offer:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    // Broadcast double offer to opponent
    io.to(opponentSocketId).emit('game:double-offered', {
      matchId,
      doubleOffer,
      gameStakes,
      to: doubleOffer.to
    });
    
    console.log(`💰 Player ${player} offered double in match ${matchId}`);
  });
  
  socket.on('game:double-response', (data) => {
    const { matchId, player, accepted, gameStakes, gameOver } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for double response:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    if (accepted) {
      // Broadcast double acceptance to opponent
      io.to(opponentSocketId).emit('game:double-response', {
        matchId,
        player,
        accepted: true,
        gameStakes,
        doubleOffer: { from: player === 1 ? 2 : 1, to: player }
      });
      console.log(`✅ Player ${player} accepted double in match ${matchId}, new stakes: ${gameStakes}`);
    } else {
      // Broadcast double decline (game over) to both players
      io.to(opponentSocketId).emit('game:double-response', {
        matchId,
        player,
        accepted: false,
        gameOver
      });
      io.to(socket.id).emit('game:double-response', {
        matchId,
        player,
        accepted: false,
        gameOver
      });
      console.log(`❌ Player ${player} declined double in match ${matchId}`);
    }
  });
  
  // First roll handlers
  socket.on('game:first-roll-start', (data) => {
    const { matchId, player, rollTurn } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for first roll start:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    // Broadcast first roll animation start to opponent
    io.to(opponentSocketId).emit('game:first-roll-start', {
      matchId,
      player,
      rollTurn
    });
    
    console.log(`🎲 Player ${player} started first roll (turn ${rollTurn}) in match ${matchId}`);
  });
  
  socket.on('game:first-roll', (data) => {
    const { matchId, player, roll, rollTurn, nextRollTurn } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for first roll:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = player === 1 ? match.player2.socketId : match.player1.socketId;
    
    // Broadcast first roll to opponent with next turn information
    const eventData = {
      matchId,
      player,
      roll,
      rollTurn,
      nextRollTurn
    };
    console.log(`🎲 Player ${player} rolled ${roll} in first roll phase (turn ${rollTurn}, nextTurn: ${nextRollTurn}) for match ${matchId}`);
    console.log(`📤 Sending to opponent socket ${opponentSocketId}:`, eventData);
    io.to(opponentSocketId).emit('game:first-roll', eventData);
  });
  
  socket.on('game:first-roll-complete', (data) => {
    const { matchId, firstRolls, winner, currentPlayer, dice, movesAllowed } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for first roll complete:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = match.player1.socketId === socket.id 
      ? match.player2.socketId 
      : match.player1.socketId;
    
    // Broadcast first roll completion to opponent
    io.to(opponentSocketId).emit('game:first-roll-complete', {
      matchId,
      firstRolls,
      winner,
      currentPlayer,
      dice,
      movesAllowed
    });
    
    console.log(`🎯 First roll complete in match ${matchId}, Player ${winner} goes first`);
  });
  
  socket.on('game:first-roll-tie', (data) => {
    const { matchId, firstRolls } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for first roll tie:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = match.player1.socketId === socket.id 
      ? match.player2.socketId 
      : match.player1.socketId;
    
    // Broadcast tie to opponent with roll values so they can see both dice
    io.to(opponentSocketId).emit('game:first-roll-tie', {
      matchId,
      firstRolls
    });
    
    console.log(`🤝 First roll tie in match ${matchId}, rerolling...`);
  });
  
  // Rematch handlers
  socket.on('game:rematch-request', (data) => {
    const { matchId, from, to } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for rematch request:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = match.player1.socketId === socket.id 
      ? match.player2.socketId 
      : match.player1.socketId;
    
    // Check if opponent socket is still connected
    const opponentSocket = io.sockets.sockets.get(opponentSocketId);
    if (!opponentSocket || !opponentSocket.connected) {
      // Opponent is not connected, automatically decline
      console.log(`⚠️ Opponent not connected for rematch request in match ${matchId}, auto-declining`);
      io.to(socket.id).emit('game:rematch-decline', {
        matchId, from, to
      });
      return;
    }
    
    // Send rematch request to opponent
    io.to(opponentSocketId).emit('game:rematch-request', {
      matchId, from, to
    });
    
    console.log(`🔄 Rematch requested in match ${matchId}, Player ${from} -> Player ${to}`);
  });
  
  socket.on('game:rematch-accept', (data) => {
    const { matchId, from, to } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for rematch accept:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = match.player1.socketId === socket.id 
      ? match.player2.socketId 
      : match.player1.socketId;
    
    // Send rematch accept to both players
    io.to(opponentSocketId).emit('game:rematch-accept', {
      matchId, from, to
    });
    io.to(socket.id).emit('game:rematch-accept', {
      matchId, from, to
    });
    
    console.log(`✅ Rematch accepted in match ${matchId}`);
  });
  
  socket.on('game:rematch-decline', (data) => {
    const { matchId, from, to } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for rematch decline:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = match.player1.socketId === socket.id 
      ? match.player2.socketId 
      : match.player1.socketId;
    
    // Send rematch decline to requester
    io.to(opponentSocketId).emit('game:rematch-decline', {
      matchId, from, to
    });
    
    console.log(`❌ Rematch declined in match ${matchId}`);
  });
  
  // Game over handler
  socket.on('game:over', async (data) => {
    const { matchId, gameOver } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for game over:', matchId);
      return;
    }
    
    console.log(`🏁 Game over event received for match ${matchId}:`, {
      type: gameOver.type,
      winner: gameOver.winner,
      loser: gameOver.loser,
      isRanked: match.isRanked,
      player1Guest: match.player1.isGuest,
      player2Guest: match.player2.isGuest
    });
    
    // Find opponent socket
    const opponentSocketId = match.player1.socketId === socket.id 
      ? match.player2.socketId 
      : match.player1.socketId;
    
    // Calculate ELO changes for ranked matches
    // ELO is calculated for ALL game over types (win, resign, timeout, disconnect, double decline)
    // as long as it's a ranked match with registered players
    let eloChanges = null;
    if (match.isRanked && !match.player1.isGuest && !match.player2.isGuest) {
      const player1ELO = match.player1ELO || 1000;
      const player2ELO = match.player2ELO || 1000;
      
      // Determine result: 1 = win, 0 = loss
      // This works for all game over types (win, resign, timeout, disconnect, double decline)
      const player1Result = gameOver.winner === 1 ? 1 : 0;
      const player2Result = gameOver.winner === 2 ? 1 : 0;
      
      console.log(`📊 Calculating ELO for game over type: ${gameOver.type}, Winner: Player ${gameOver.winner}`);
      
      // Calculate ELO changes
      const player1Change = calculateELOChange(player1ELO, player2ELO, player1Result);
      const player2Change = calculateELOChange(player2ELO, player1ELO, player2Result);
      
      const newPlayer1ELO = player1ELO + player1Change;
      const newPlayer2ELO = player2ELO + player2Change;
      
      eloChanges = {
        player1: {
          userId: match.player1.userId,
          oldELO: player1ELO,
          newELO: newPlayer1ELO,
          change: player1Change
        },
        player2: {
          userId: match.player2.userId,
          oldELO: player2ELO,
          newELO: newPlayer2ELO,
          change: player2Change
        }
      };
      
      // Update ELO in database
      if (supabase) {
        try {
          console.log(`🔄 Updating ELO in database for match ${matchId}...`);
          console.log(`   Player 1: ${match.player1.userId}, ELO: ${player1ELO} → ${newPlayer1ELO} (${player1Change > 0 ? '+' : ''}${player1Change})`);
          console.log(`   Player 2: ${match.player2.userId}, ELO: ${player2ELO} → ${newPlayer2ELO} (${player2Change > 0 ? '+' : ''}${player2Change})`);
          
          // Get current stats for player 1
          const { data: player1Data, error: fetchError1 } = await supabase
            .from('users')
            .select('wins, losses, games_played, elo_rating')
            .eq('id', match.player1.userId)
            .single();
          
          if (!fetchError1 && player1Data) {
            // Update player 1
            const { data: updatedPlayer1, error: error1 } = await supabase
              .from('users')
              .update({ 
                elo_rating: newPlayer1ELO,
                wins: (player1Data.wins || 0) + (player1Result === 1 ? 1 : 0),
                losses: (player1Data.losses || 0) + (player1Result === 0 ? 1 : 0),
                games_played: (player1Data.games_played || 0) + 1
              })
              .eq('id', match.player1.userId)
              .select();
            
            if (error1) {
              console.error('❌ Error updating player 1 ELO:', error1);
            } else {
              // Verify the update succeeded
              const { data: verify1, error: verifyError1 } = await supabase
                .from('users')
                .select('elo_rating, wins, losses, games_played')
                .eq('id', match.player1.userId)
                .single();
              
              if (verifyError1) {
                console.error('❌ Error verifying player 1 update:', verifyError1);
              } else {
                console.log(`✅ Player 1 ELO updated: ${player1ELO} → ${newPlayer1ELO} (${player1Change > 0 ? '+' : ''}${player1Change})`);
                console.log(`   Verified in DB: ELO=${verify1.elo_rating}, Wins=${verify1.wins}, Losses=${verify1.losses}, Games=${verify1.games_played}`);
              }
            }
          } else if (fetchError1) {
            console.error('❌ Error fetching player 1 data:', fetchError1);
          }
          
          // Get current stats for player 2
          const { data: player2Data, error: fetchError2 } = await supabase
            .from('users')
            .select('wins, losses, games_played, elo_rating')
            .eq('id', match.player2.userId)
            .single();
          
          if (!fetchError2 && player2Data) {
            // Update player 2
            const { data: updatedPlayer2, error: error2 } = await supabase
              .from('users')
              .update({ 
                elo_rating: newPlayer2ELO,
                wins: (player2Data.wins || 0) + (player2Result === 1 ? 1 : 0),
                losses: (player2Data.losses || 0) + (player2Result === 0 ? 1 : 0),
                games_played: (player2Data.games_played || 0) + 1
              })
              .eq('id', match.player2.userId)
              .select();
            
            if (error2) {
              console.error('❌ Error updating player 2 ELO:', error2);
            } else {
              // Verify the update succeeded
              const { data: verify2, error: verifyError2 } = await supabase
                .from('users')
                .select('elo_rating, wins, losses, games_played')
                .eq('id', match.player2.userId)
                .single();
              
              if (verifyError2) {
                console.error('❌ Error verifying player 2 update:', verifyError2);
              } else {
                console.log(`✅ Player 2 ELO updated: ${player2ELO} → ${newPlayer2ELO} (${player2Change > 0 ? '+' : ''}${player2Change})`);
                console.log(`   Verified in DB: ELO=${verify2.elo_rating}, Wins=${verify2.wins}, Losses=${verify2.losses}, Games=${verify2.games_played}`);
              }
            }
          } else if (fetchError2) {
            console.error('❌ Error fetching player 2 data:', fetchError2);
          }
          
          console.log(`📊 ELO updated for ranked match ${matchId}:`, eloChanges);
        } catch (err) {
          console.error('Error updating ELO in database:', err);
        }
      } else {
        console.log(`⚠️ ELO calculation skipped for match ${matchId}:`, {
          isRanked: match.isRanked,
          player1Guest: match.player1.isGuest,
          player2Guest: match.player2.isGuest
        });
      }
    } else {
      console.log(`⚠️ ELO calculation skipped - not a ranked match or has guest players:`, {
        isRanked: match.isRanked,
        player1Guest: match.player1.isGuest,
        player2Guest: match.player2.isGuest
      });
    }
    
    // Broadcast game over to opponent with ELO changes
    io.to(opponentSocketId).emit('game:over', {
      matchId,
      gameOver,
      eloChanges
    });
    
    // Also send to sender with ELO changes
    socket.emit('game:over', {
      matchId,
      gameOver,
      eloChanges
    });
    
    console.log(`🏁 Game over in match ${matchId}: ${gameOver.type}, Winner: Player ${gameOver.winner}`);
    if (eloChanges) {
      console.log(`📊 ELO changes: Player 1: ${eloChanges.player1.change > 0 ? '+' : ''}${eloChanges.player1.change}, Player 2: ${eloChanges.player2.change > 0 ? '+' : ''}${eloChanges.player2.change}`);
    }
  });
  
  // Chat handler
  socket.on('game:chat', (data) => {
    const { matchId, player, message, username } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for chat:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = match.player1.socketId === socket.id 
      ? match.player2.socketId 
      : match.player1.socketId;
    
    // Broadcast chat message to opponent, including username if provided
    io.to(opponentSocketId).emit('game:chat', {
      matchId,
      player,
      message,
      username // Forward username to opponent
    });
    
    console.log(`💬 Chat message in match ${matchId} from Player ${player}${username ? ` (${username})` : ''}`);
  });
});

const PORT = process.env.PORT || 3001;

// Log PORT environment variable for debugging
console.log('🔌 PORT environment variable:', process.env.PORT || 'not set (using default 3001)');
console.log('🔌 Server will listen on port:', PORT);

// Add error handling for server startup
httpServer.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Socket.io server ready for connections`);
  console.log(`🌐 CORS enabled for all origins`);
  console.log(`🔗 Health check available at: http://0.0.0.0:${PORT}/api/health`);
});

