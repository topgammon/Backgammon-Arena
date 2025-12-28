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
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});

