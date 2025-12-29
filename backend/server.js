import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

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
});

const PORT = process.env.PORT || 3001;

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

