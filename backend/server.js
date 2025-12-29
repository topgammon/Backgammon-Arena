import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

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
const rankedQueue = new Map(); // Map of userId -> { socketId, elo, timestamp } for ranked matchmaking

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
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 User disconnected:', socket.id, 'Reason:', reason);
    
    // Remove from guest queue
    const guestIndex = guestQueue.findIndex(p => p.socketId === socket.id);
    if (guestIndex !== -1) {
      guestQueue.splice(guestIndex, 1);
      console.log('👤 Removed from guest queue, new size:', guestQueue.length);
    }
    
    // Remove from ranked queue
    if (rankedQueue.has(socket.id)) {
      rankedQueue.delete(socket.id);
      console.log('👤 Removed from ranked queue');
    }
    
    // Clean up active matches where this socket was a player
    for (const [matchId, match] of activeMatches.entries()) {
      if (match.player1.socketId === socket.id || match.player2.socketId === socket.id) {
        const opponentSocketId = match.player1.socketId === socket.id 
          ? match.player2.socketId 
          : match.player1.socketId;
        
        // Notify opponent of disconnect
        io.to(opponentSocketId).emit('game:opponent-disconnected', {
          matchId
        });
        
        // Remove match after a delay (in case of reconnection)
        setTimeout(() => {
          activeMatches.delete(matchId);
          console.log(`🗑️ Cleaned up match ${matchId}`);
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
  
  // Ranked matchmaking (for logged in users) - placeholder for now
  socket.on('matchmaking:ranked:join', (data) => {
    console.log('User joining ranked matchmaking queue:', socket.id, data);
    // TODO: Implement ranked matchmaking with ELO-based matching
    socket.emit('matchmaking:ranked:queued', { message: 'Ranked matchmaking coming soon' });
  });
  
  socket.on('matchmaking:ranked:leave', () => {
    console.log('🚪 User leaving ranked matchmaking queue:', socket.id);
    rankedQueue.delete(socket.id);
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
    const { matchId } = data;
    const match = activeMatches.get(matchId);
    
    if (!match) {
      console.error('❌ Invalid matchId for first roll tie:', matchId);
      return;
    }
    
    // Find opponent socket
    const opponentSocketId = match.player1.socketId === socket.id 
      ? match.player2.socketId 
      : match.player1.socketId;
    
    // Broadcast tie to opponent
    io.to(opponentSocketId).emit('game:first-roll-tie', {
      matchId
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

