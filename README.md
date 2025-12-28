# 🎲 Backgammon Arena

A modern, online backgammon platform - the chess.com equivalent for backgammon players!

## 🚀 Getting Started

### Prerequisites
- Node.js (v22+)
- npm or yarn

### Installation

1. **Install frontend dependencies:**
```bash
cd frontend
npm install
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Set up environment variables:**
   - Copy `backend/.env.example` to `backend/.env` and fill in your Supabase credentials
   - Copy `frontend/.env.example` to `frontend/.env` and fill in your Supabase credentials

### Running the Application

**Start the backend server:**
```bash
cd backend
npm run dev
```
Backend runs on http://localhost:3001

**Start the frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on http://localhost:5173

## 📋 Project Status

- [x] Preparation checklist complete
- [x] Project structure set up
- [x] Frontend (React + Vite) configured
- [x] Backend (Node.js + Express) configured
- [x] Socket.io for real-time play
- [ ] Supabase database setup
- [ ] Game logic integration
- [ ] User authentication
- [ ] Online multiplayer
- [ ] Leaderboards and tournaments
- [ ] Deployed and live!

## 🛠️ Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Socket.io
- **Game Engine:** @mrlhumphreys/jbackgammon
- **Hosting:** Vercel (frontend) + Vercel/Heroku (backend)

## 🎮 Features (MVP)

- ✅ Guest play (no signup required)
- ✅ Sign up / Login (email, Google, Facebook) - *Coming soon*
- ✅ Offline vs Bot (difficulty 1-10)
- ✅ Pass-and-play (2 players, same device)
- ✅ Online matchmaking (ELO-based pairing)
- ✅ ELO ranking system
- ✅ Leaderboards
- ✅ Game review & analysis
- ✅ Basic lessons
- ✅ Tournaments (Bracket & Round Robin)

## 📁 Project Structure

```
Backgammon-Arena/
├── frontend/          # React frontend application
│   ├── src/          # Source code
│   └── public/       # Static assets
├── backend/          # Express backend server
│   └── server.js     # Main server file
└── README.md
```

---

**Questions?** Just ask! We're here to help you build this step-by-step. 🎯
