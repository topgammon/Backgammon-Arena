import React, { useState, useEffect, useRef } from 'react';
import { cpuMakeMove, DIFFICULTY_LEVELS, calculateMoveAccuracy, calculateWinningProbability } from './cpuAI';
import { SupabaseAuthProvider, useSupabaseAuth } from './contexts/SupabaseAuthContext';
import SupabaseAuthPage from './components/auth/SupabaseAuthPage';
import { supabase } from './supabase';

const buttonStyle = {
  backgroundColor: '#28a745',
  color: 'white',
  padding: '12px 24px',
  margin: '10px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '18px',
  cursor: 'pointer',
  minWidth: '180px',
};

const sectionStyle = {
  background: '#f9f9f9',
  borderRadius: '10px',
  padding: '30px',
  margin: '20px auto',
  maxWidth: '400px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
};

// Increased board size
const triangleW = 58; // 48 * 1.2
const triangleH = 216; // 180 * 1.2
const checkerSize = 43; // 36 * 1.2
const gap = 38; // 32 * 1.2
const bearOffW = 72; // 60 * 1.2
const boardX = 36; // 30 * 1.2
const boardY = 36; // 30 * 1.2
const boardW = triangleW * 12 + gap + bearOffW;
const boardH = 576; // 480 * 1.2

function getInitialCheckers() {
  let layout = [
    [0, 2, 1], [11, 5, 1], [16, 3, 1], [18, 5, 1],
    [23, 2, 2], [12, 5, 2], [7, 3, 2], [5, 5, 2]
  ];
  let arr = [];
  let id = 1;
  for (let [point, count, player] of layout) {
    for (let i = 0; i < count; i++) {
      arr.push({ id: id++, point, offset: i, player });
    }
  }
  return arr;
}

// Dice component
function Dice({ value, faded, shrunk, isRolling = false, frame = 0 }) {
  const dotRadius = 5;
  const size = 61;
  const padding = 18;
  const positions = [padding, size / 2, size - padding];
  
  // Standard dice face patterns
  const dots = [
    [],
    [[1, 1]],
    [[0, 0], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 0], [0, 2], [2, 0], [2, 2]],
    [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  ];

  // 3D rolling frames - different dice faces shown during animation
  const rollingFrames = [
    // Frame 1: Front face (original value)
    { face: value, rotation: 0, scale: 1 },
    // Frame 2: Side view - tilted
    { face: Math.floor(Math.random() * 6) + 1, rotation: 15, scale: 0.9 },
    // Frame 3: Corner view - more tilted
    { face: Math.floor(Math.random() * 6) + 1, rotation: 30, scale: 0.8 },
    // Frame 4: Edge view - maximum tilt
    { face: Math.floor(Math.random() * 6) + 1, rotation: 45, scale: 0.7 },
    // Frame 5: Back to corner view
    { face: Math.floor(Math.random() * 6) + 1, rotation: 30, scale: 0.8 },
    // Frame 6: Side view
    { face: Math.floor(Math.random() * 6) + 1, rotation: 15, scale: 0.9 },
    // Frame 7: Final face (original value)
    { face: value, rotation: 0, scale: 1 },
  ];

  const currentFrame = isRolling ? rollingFrames[frame] : { face: value, rotation: 0, scale: 1 };

  return (
    <svg
      width={size}
      height={size}
      style={{
        margin: '0 8px',
        verticalAlign: 'middle',
        opacity: faded ? 0.5 : 1,
        transform: isRolling ? 
          `rotate(${currentFrame.rotation}deg) scale(${currentFrame.scale})` : 
          (shrunk ? 'scale(0.7)' : 'scale(1)'),
        transition: 'opacity 0.2s, transform 0.2s',
        display: 'inline-block',
      }}
    >
      <rect x={4} y={4} width={size - 8} height={size - 8} rx={14} fill="#fff" stroke="#222" strokeWidth={5} />
      {dots[currentFrame.face]?.map(([r, c], i) => (
        <circle key={i} cx={positions[c]} cy={positions[r]} r={dotRadius} fill="#222" />
      ))}
    </svg>
  );
}

function pipCount(checkers, player, bar, borneOff) {
  let total = 0;
  for (let c of checkers) {
    if (c.player === player) {
      total += player === 1 ? 24 - c.point : c.point + 1;
    }
  }
  // Bar checkers
  total += bar[player].length * 25;
  // Borne off checkers are 0
  return total;
}

function getMoveDistance(from, to, player) {
  return player === 1 ? (to - from) : (from - to);
}



function App({ onShowAuth, user }) {
  // Add movesAllowed state FIRST
  const [movesAllowed, setMovesAllowed] = useState([null, null]);
  const [screen, setScreen] = useState('home');
  const [checkers, setCheckers] = useState(getInitialCheckers());
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [dice, setDice] = useState([0, 0]);
  const [usedDice, setUsedDice] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [hasRolled, setHasRolled] = useState(false);
  const [bar, setBar] = useState({ 1: [], 2: [] });
  const [borneOff, setBorneOff] = useState({ 1: 0, 2: 0 });
  const [message, setMessage] = useState('');
  const svgRef = useRef();
  // Add overlay state
  const [noMoveOverlay, setNoMoveOverlay] = useState(false);
  const [lastNoMoveDice, setLastNoMoveDice] = useState(null);
  // Use a ref to store the next player after a no-move turn
  const nextPlayerRef = useRef(null);
  // State for undo
  const [prevState, setPrevState] = useState(null);
  // Undo stack for the current turn
  const [undoStack, setUndoStack] = useState([]);
  // Track if a valid move has been made this turn
  const [moveMade, setMoveMade] = useState(false);
  // Awaiting End Turn phase
  const [awaitingEndTurn, setAwaitingEndTurn] = useState(false);
  // Add state for first roll system
  const [firstRollPhase, setFirstRollPhase] = useState(true);
  const [firstRolls, setFirstRolls] = useState([null, null]); // [player1, player2]
  const [firstRollTurn, setFirstRollTurn] = useState(1); // 1 or 2
  const [firstRollResult, setFirstRollResult] = useState(null); // null, 1, 2, or 'tie'
  // Add state for confirm resign overlay
  const [showConfirmResign, setShowConfirmResign] = useState(false);
  // Add state for game over overlay
  const [gameOver, setGameOver] = useState(null); // { type: 'win'|'resign'|'disconnect'|'double', winner: 1|2, loser: 1|2 }
  const [timer, setTimer] = useState(45);
  const timerRef = useRef();
  const prevPlayerRef = useRef(null);
  const prevScreenRef = useRef(null);
  // Add state for endgame test
  const [endgameTestActive, setEndgameTestActive] = useState(false);
  // Add state for dice rolling animation
  const [isRolling, setIsRolling] = useState(false);
  const [rollingDice, setRollingDice] = useState([1, 1]);
  const [animationFrame, setAnimationFrame] = useState(0);
  // Add state for first roll animation
  const [isFirstRolling, setIsFirstRolling] = useState(false);
  const [firstRollAnimationFrame, setFirstRollAnimationFrame] = useState(0);
  // Add state for auto-roll toggle
  const [autoRoll, setAutoRoll] = useState({ 1: false, 2: false });
  // Add state for doubling
  const [doubleOffer, setDoubleOffer] = useState(null); // { from: player, to: player, timer: seconds }
  const [doubleTimer, setDoubleTimer] = useState(15);
  const [canDouble, setCanDouble] = useState({ 1: true, 2: true }); // Track who can double next
  const [gameStakes, setGameStakes] = useState(1); // Current game stakes (1, 2, 4, 8, etc.)
  
  // CPU game state
  const [cpuDifficulty, setCpuDifficulty] = useState(3); // Default to Intermediate
  const [isCpuGame, setIsCpuGame] = useState(false);
  const [cpuPlayer, setCpuPlayer] = useState(2); // CPU plays as Player 2 by default
  const [isCpuThinking, setIsCpuThinking] = useState(false);
  
  // Move accuracy tracking
  const [moveAccuracy, setMoveAccuracy] = useState({ 1: [], 2: [] }); // Track accuracy for each player
  const [averageAccuracy, setAverageAccuracy] = useState({ 1: 0, 2: 0 });

  // Matchmaking state
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState('');
  const [matchmakingAnimation, setMatchmakingAnimation] = useState(0);
  const [matchmakingSubscription, setMatchmakingSubscription] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [isOnlineGame, setIsOnlineGame] = useState(false);
  const [opponentInfo, setOpponentInfo] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);

  // Add debug state for troubleshooting
  const [debugInfo, setDebugInfo] = useState({
    databaseConnected: false,
    tablesExist: false,
    lastError: null,
    matchmakingStatus: 'idle'
  });

  // Test database connection on component mount
  useEffect(() => {
    const testDatabaseConnection = async () => {
      try {
        console.log('Testing database connection...');
        const { data, error } = await supabase
          .from('matchmaking_queue')
          .select('count')
          .limit(1);
        
        if (error) {
          console.error('Database connection failed:', error);
          setDebugInfo(prev => ({
            ...prev,
            databaseConnected: false,
            lastError: error.message
          }));
        } else {
          console.log('Database connection successful');
          setDebugInfo(prev => ({
            ...prev,
            databaseConnected: true,
            lastError: null
          }));
        }
      } catch (error) {
        console.error('Database test error:', error);
        setDebugInfo(prev => ({
          ...prev,
          databaseConnected: false,
          lastError: error.message
        }));
      }
    };

    testDatabaseConnection();
  }, []);

  // Reset first roll state on new game
  useEffect(() => {
    setFirstRollPhase(true);
    setFirstRolls([null, null]);
    setFirstRollTurn(1);
    setFirstRollResult(null);
    setAutoRoll({ 1: false, 2: false }); // Reset auto-roll to OFF
    // Reset accuracy tracking
    setMoveAccuracy({ 1: [], 2: [] });
    setAverageAccuracy({ 1: 0, 2: 0 });
  }, [screen]);

  // Matchmaking animation effect
  useEffect(() => {
    if (isMatchmaking) {
      const interval = setInterval(() => {
        setMatchmakingAnimation(prev => (prev + 1) % 4);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isMatchmaking]);

  // Cleanup matchmaking subscription on unmount
  useEffect(() => {
    return () => {
      if (matchmakingSubscription) {
        if (matchmakingSubscription.subscription) {
          matchmakingSubscription.subscription.unsubscribe();
        }
        if (matchmakingSubscription.interval) {
          clearInterval(matchmakingSubscription.interval);
        }
      }
    };
  }, [matchmakingSubscription]);

  // Cleanup matchmaking subscription on unmount
  useEffect(() => {
    return () => {
      if (matchmakingSubscription) {
        if (matchmakingSubscription.interval) {
          clearInterval(matchmakingSubscription.interval);
        }
        if (matchmakingSubscription.statusInterval) {
          clearInterval(matchmakingSubscription.statusInterval);
        }
      }
    };
  }, [matchmakingSubscription]);

  // Simple sync for online first rolls
  useEffect(() => {
    if (isOnlineGame && currentMatch && currentPlayerId && firstRollPhase) {
      const syncFirstRolls = setInterval(async () => {
        try {
          const { data: moves, error } = await supabase
            .from('game_moves')
            .select('*')
            .eq('match_id', currentMatch.id)
            .eq('move_type', 'first_roll')
            .order('created_at', { ascending: true });

          if (error) {
            console.error('Error syncing first rolls:', error);
            return;
          }

          if (moves && moves.length > 0) {
            // Update local state with opponent's roll
            const newFirstRolls = [...firstRolls];
            let hasUpdates = false;

            for (const move of moves) {
              if (move.player_id !== currentPlayerId) {
                const moveData = move.move_data;
                if (moveData && moveData.player && moveData.roll) {
                  newFirstRolls[moveData.player - 1] = moveData.roll;
                  hasUpdates = true;
                }
              }
            }

            if (hasUpdates) {
              setFirstRolls(newFirstRolls);
            }
          }
        } catch (error) {
          console.error('Error syncing first rolls:', error);
        }
      }, 1000);

      return () => {
        clearInterval(syncFirstRolls);
      };
    }
  }, [isOnlineGame, currentMatch, currentPlayerId, firstRollPhase, firstRolls]);

  // Matchmaking functions - Simplified and robust
  const startMatchmaking = async () => {
    setIsMatchmaking(true);
    setMatchmakingStatus('Searching for opponent...');
    setScreen('matchmaking');
    setDebugInfo(prev => ({ ...prev, matchmakingStatus: 'starting' }));

    try {
      // Test database connection
      const { data: testData, error: testError } = await supabase
        .from('matchmaking_queue')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('Database connection test failed:', testError);
        setMatchmakingStatus('Database connection error. Please try again.');
        setDebugInfo(prev => ({ 
          ...prev, 
          matchmakingStatus: 'error',
          lastError: testError.message 
        }));
        return;
      }
      console.log('Database connection test successful');
      setDebugInfo(prev => ({ 
        ...prev, 
        matchmakingStatus: 'connected',
        lastError: null 
      }));

      // Create a unique player ID and name
      let playerId, playerName;
      if (user) {
        playerId = user.id;
        playerName = user.user_metadata?.username || user.email;
      } else {
        // Generate unique guest ID and name
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        playerId = `guest_${timestamp}_${randomSuffix}`;
        playerName = `Guest_${timestamp}`;
      }
      
      setCurrentPlayerId(playerId);
      setDebugInfo(prev => ({ ...prev, matchmakingStatus: 'joining_queue' }));

      // Insert player into matchmaking queue
      console.log('Joining matchmaking queue:', { playerId, playerName, isGuest: !user });
      
      // First, check if player is already in queue
      const { data: existingQueue, error: checkError } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('player_id', playerId);
        
      if (checkError) {
        console.error('Error checking existing queue entry:', checkError);
        setDebugInfo(prev => ({ 
          ...prev, 
          matchmakingStatus: 'error',
          lastError: checkError.message 
        }));
        setMatchmakingStatus('Error checking queue. Please try again.');
        return;
      } else if (existingQueue && existingQueue.length > 0) {
        console.log('Player already in queue, skipping insert');
        setDebugInfo(prev => ({ ...prev, matchmakingStatus: 'already_in_queue' }));
      } else {
        const { data: queueData, error: queueError } = await supabase
          .from('matchmaking_queue')
          .insert([
            {
              player_id: playerId,
              player_name: playerName,
              is_guest: !user,
              created_at: new Date().toISOString()
            }
          ])
          .select();

        if (queueError) {
          console.error('Error joining queue:', queueError);
          setMatchmakingStatus('Error joining queue. Please try again.');
          setDebugInfo(prev => ({ 
            ...prev, 
            matchmakingStatus: 'error',
            lastError: queueError.message 
          }));
          return;
        }

        console.log('Successfully joined queue:', queueData);
        setDebugInfo(prev => ({ ...prev, matchmakingStatus: 'in_queue' }));
      }

      // Set up periodic checks for opponents (simple and reliable)
      let isChecking = false;
      const periodicCheck = setInterval(async () => {
        if (isMatchmaking && !isChecking) {
          isChecking = true;
          await checkForMatch(playerId);
          isChecking = false;
        }
      }, 1000); // Check every 1 second for faster response

      // Update status periodically to show activity
      const statusInterval = setInterval(() => {
        if (isMatchmaking) {
          setMatchmakingStatus(prev => {
            if (prev.includes('...')) {
              return 'Searching for opponent';
            } else {
              return prev + '.';
            }
          });
        } else {
          clearInterval(statusInterval);
        }
      }, 2000);

      // Store intervals for cleanup
      setMatchmakingSubscription({ 
        interval: periodicCheck,
        statusInterval: statusInterval
      });

      // Initial check for existing opponents
      setTimeout(async () => {
        await checkForMatch(playerId);
      }, 500); // Check sooner

    } catch (error) {
      console.error('Matchmaking error:', error);
      setMatchmakingStatus('Error starting matchmaking. Please try again.');
      setDebugInfo(prev => ({ 
        ...prev, 
        matchmakingStatus: 'error',
        lastError: error.message 
      }));
    }
  };

  const checkForMatch = async (currentPlayerId) => {
    try {
      console.log('Checking for match for player:', currentPlayerId);
      
      // 1. Check if a match already exists for this player
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${currentPlayerId},player2_id.eq.${currentPlayerId}`)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (matchError) {
        console.error('Error checking for matches:', matchError);
        return;
      }
      
      console.log('Found existing matches:', matches);
      
      if (matches && matches.length > 0) {
        // You have been matched!
        const match = matches[0];
        console.log('Match found! Transitioning to game:', match);
        
        // Stop matchmaking immediately to prevent further checks
        setIsMatchmaking(false);
        
        // Get opponent name from match record
        let opponentName = 'Opponent';
        if (match.player1_id === currentPlayerId) {
          opponentName = match.player2_name || 'Opponent';
        } else {
          opponentName = match.player1_name || 'Opponent';
        }
        
        setCurrentMatch(match);
        setIsOnlineGame(true);
        setOpponentInfo({ name: opponentName });
        setMatchmakingStatus('');
        
        // Clean up matchmaking subscription
        if (matchmakingSubscription) {
          if (matchmakingSubscription.interval) {
            clearInterval(matchmakingSubscription.interval);
          }
          if (matchmakingSubscription.statusInterval) {
            clearInterval(matchmakingSubscription.statusInterval);
          }
          setMatchmakingSubscription(null);
        }
        
        // Reset game state for online play
        setCheckers(getInitialCheckers());
        setSelected(null);
        setLegalMoves([]);
        setDice([0, 0]);
        setUsedDice([]);
        setCurrentPlayer(1);
        setHasRolled(false);
        setBar({ 1: [], 2: [] });
        setBorneOff({ 1: 0, 2: 0 });
        setMessage('');
        setFirstRollPhase(true);
        setFirstRolls([null, null]);
        setFirstRollTurn(1);
        setFirstRollResult(null);
        setGameOver(null);
        setDoubleOffer(null);
        setCanDouble({ 1: true, 2: true });
        setGameStakes(1);
        setUndoStack([]);
        setMoveMade(false);
        setAwaitingEndTurn(false);
        setNoMoveOverlay(false);
        setShowConfirmResign(false);
        
        setScreen('onlineGame');
        return;
      }

      // 2. If not matched, check the queue for an opponent
      const { data: players, error } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .neq('player_id', currentPlayerId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error checking for matches:', error);
        return;
      }

      console.log('Players in queue:', players);

      if (players && players.length > 0) {
        // Match with the first player in queue (first come, first served)
        const opponent = players[0];
        console.log('Found opponent in queue:', opponent);
        console.log('Creating match between:', opponent.player_id, 'and', currentPlayerId);
        
        // Create the match - this will handle the transition for both players
        await createMatch(opponent.player_id, currentPlayerId, opponent.player_name);
        
        // The first player will find this match on their next checkForMatch call
        // and transition to the game automatically
        console.log('Match creation completed for player:', currentPlayerId);
      } else {
        console.log('No opponents found in queue');
      }
    } catch (error) {
      console.error('Error checking for match:', error);
    }
  };

  const createMatch = async (player1Id, player2Id, player1Name) => {
    try {
      console.log('Creating match between:', player1Id, 'and', player2Id);
      setMatchmakingStatus('Match found! Starting game...');

      // Check if match already exists to prevent race conditions
      const { data: existingMatches, error: checkError } = await supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${player1Id},player2_id.eq.${player1Id}`)
        .eq('status', 'active');

      if (checkError) {
        console.error('Error checking for existing matches:', checkError);
        return;
      }

      if (existingMatches && existingMatches.length > 0) {
        console.log('Match already exists, not creating duplicate');
        return;
      }

      // Get current player's name
      let currentPlayerName = 'You';
      if (user) {
        currentPlayerName = user.user_metadata?.username || user.email;
      } else {
        // Extract name from player2Id (format: guest_timestamp_random)
        const parts = player2Id.split('_');
        if (parts.length >= 2) {
          currentPlayerName = `Guest_${parts[1]}`;
        }
      }

      // Create match record with correct player names
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert([
          {
            player1_id: player1Id,
            player2_id: player2Id,
            player1_name: player1Name,
            player2_name: currentPlayerName,
            status: 'active',
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (matchError) {
        console.error('Error creating match:', matchError);
        setMatchmakingStatus('Error creating match. Please try again.');
        return;
      }

      console.log('Match created successfully:', matchData);

      // Small delay to ensure database sync before removing from queue
      await new Promise(resolve => setTimeout(resolve, 200));

      // Remove both players from queue
      const { error: deleteError } = await supabase
        .from('matchmaking_queue')
        .delete()
        .in('player_id', [player1Id, player2Id]);

      if (deleteError) {
        console.error('Error removing players from queue:', deleteError);
      } else {
        console.log('Players removed from queue successfully');
      }

      // Set up the game for the current player
      // Stop matchmaking immediately to prevent further checks
      setIsMatchmaking(false);
      
      setCurrentMatch(matchData[0]);
      setIsOnlineGame(true);
      setOpponentInfo({ name: player1Name });
      setMatchmakingStatus('');
      
      // Clean up matchmaking subscription
      if (matchmakingSubscription) {
        if (matchmakingSubscription.interval) {
          clearInterval(matchmakingSubscription.interval);
        }
        if (matchmakingSubscription.statusInterval) {
          clearInterval(matchmakingSubscription.statusInterval);
        }
        setMatchmakingSubscription(null);
      }
      
      // Small delay to ensure database sync
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Match created and game started:', matchData[0]);
      
      // Reset game state for online play - EXACTLY like pass-and-play
      setCheckers(getInitialCheckers());
      setSelected(null);
      setLegalMoves([]);
      setDice([0, 0]);
      setUsedDice([]);
      setCurrentPlayer(1);
      setHasRolled(false);
      setBar({ 1: [], 2: [] });
      setBorneOff({ 1: 0, 2: 0 });
      setMessage('');
      setFirstRollPhase(true);
      setFirstRolls([null, null]);
      setFirstRollTurn(1);
      setFirstRollResult(null);
      setGameOver(null);
      setDoubleOffer(null);
      setCanDouble({ 1: true, 2: true });
      setGameStakes(1);
      setUndoStack([]);
      setMoveMade(false);
      setAwaitingEndTurn(false);
      setNoMoveOverlay(false);
      setShowConfirmResign(false);
      
      setScreen('onlineGame');
    } catch (error) {
      console.error('Error creating match:', error);
      setMatchmakingStatus('Error creating match. Please try again.');
    }
  };

  const cancelMatchmaking = async () => {
    try {
      if (!currentPlayerId) return;
      
      // Remove from queue
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('player_id', currentPlayerId);

      // Cleanup subscription
      if (matchmakingSubscription) {
        if (matchmakingSubscription.interval) {
          clearInterval(matchmakingSubscription.interval);
        }
        if (matchmakingSubscription.statusInterval) {
          clearInterval(matchmakingSubscription.statusInterval);
        }
        setMatchmakingSubscription(null);
      }

      // Cleanup
      setIsMatchmaking(false);
      setMatchmakingStatus('');
      setCurrentPlayerId(null);
      setScreen('home');
    } catch (error) {
      console.error('Error canceling matchmaking:', error);
    }
  };

  // Reset undo stack and moveMade at the start of each turn
  useEffect(() => {
    setUndoStack([]);
    setMoveMade(false);
  }, [currentPlayer, hasRolled]);

  // Reset awaitingEndTurn at the start of each turn
  useEffect(() => {
    console.log('[Turn Start] Reset awaitingEndTurn to false');
    setAwaitingEndTurn(false);
  }, [currentPlayer, hasRolled]);

  // Helper to check if all dice are used
  function allDiceUsed() {
    return usedDice.length >= movesAllowed.length;
  }

  // Helper to store moves in database for online games
  async function storeMoveInDatabase(action, data = {}) {
    if (!isOnlineGame || !currentMatch || !currentPlayerId) return;
    
    try {
      const { error } = await supabase
        .from('game_moves')
        .insert([
          {
            match_id: currentMatch.id,
            player_id: currentPlayerId,
            move_type: 'game_move',
            move_data: {
              player: currentPlayer,
              action: action,
              data: data
            },
            created_at: new Date().toISOString()
          }
        ]);
      
      if (error) {
        console.error('Error storing move in database:', error);
      } else {
        console.log('Stored move in database:', action, data);
      }
    } catch (error) {
      console.error('Error storing move in database:', error);
    }
  }

  function canBearOffReact() {
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let checkersOutside = checkers.reduce((sum, c) => {
      if (c.player === currentPlayer && !homeQuadrant.includes(c.point)) sum++;
      return sum;
    }, 0) + bar[currentPlayer].length;
    return checkersOutside === 0;
  }

  function getDoublesMultiMoves(from, die, usedDice) {
    const results = [];
    const maxSteps = 4 - usedDice.length;
    for (let mult = 1; mult <= maxSteps; mult++) {
      let valid = true;
      let pos = from;
      for (let m = 1; m <= mult; m++) {
        let next = currentPlayer === 1 ? pos + die : pos - die;
        if (next < 0 || next > 23) { valid = false; break; }
        let pointCheckers = checkers.filter(c => c.point === next);
        if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer) {
          // valid
        } else if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
          // valid, hitting a blot
        } else {
          valid = false; break;
        }
        pos = next;
      }
      if (valid) results.push({ dest: pos, steps: mult });
    }
    return results;
  }

  function getBarEntryMoves(barChecker, movesAllowed, usedDice) {
    const results = [];
    for (let i = 0; i < movesAllowed.length; i++) {
      if (usedDice.includes(i)) continue; // skip used dice
      let die = movesAllowed[i];
      let entryPoint;
      if (barChecker.player === 1) {
        entryPoint = die - 1; // white enters on points 0-5
      } else {
        entryPoint = 24 - die; // black enters on points 23-18 (23 is valid)
      }
      let pointCheckers = checkers.filter(c => c.point === entryPoint);
      if (entryPoint >= 0 && entryPoint <= 23 && (pointCheckers.length === 0 || pointCheckers[0].player === barChecker.player || pointCheckers.length === 1)) {
        results.push({ dest: entryPoint, steps: 1, dieIndex: i });
      }
    }
    return results;
  }

  /**
   * BEARING OFF LOGIC - Complete rebuild
   * Rules:
   * 1. Can only bear off when all checkers are in home board
   * 2. Can bear off with exact die or higher die only for farthest checker
   * 3. For doubles, can use same die multiple times
   * 4. For regular dice, can use sum of both dice
   */
  function calculateLegalMoves(selectedChecker) {
    let from = selectedChecker.point;
    let availableDice = movesAllowed.filter((d, i) => !usedDice.includes(i));
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let canBear = canBearOffReact();
    let moves = new Set();
    
    // Bar entry logic
    if (from === 24 || from === -1) {
      // Single die bar entry
      for (let i = 0; i < movesAllowed.length; i++) {
        if (usedDice.includes(i)) continue;
        let die = movesAllowed[i];
        let entryPoint = currentPlayer === 1 ? die - 1 : 24 - die;
        let pointCheckers = checkers.filter(c => c.point === entryPoint);
        if (entryPoint >= 0 && entryPoint <= 23 && (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1)) {
          moves.add(`${entryPoint}|1|bar|${i}`);
        }
      }
      
      // Multimove bar entry (sum of two dice) - only if no dice used yet
      if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
        let d1 = movesAllowed[0], d2 = movesAllowed[1];
        let sum = d1 + d2;
        let entryPoint = currentPlayer === 1 ? sum - 1 : 24 - sum;
        
        if (entryPoint >= 0 && entryPoint <= 23) {
          // Check if final destination is valid (no need to check intermediate for bar entry)
          let endCheckers = checkers.filter(c => c.point === entryPoint);
          if (endCheckers.length === 0 || endCheckers[0].player === currentPlayer || endCheckers.length === 1) {
            moves.add(`${entryPoint}|2|bar|sum`);
          }
        }
      }
      
      setLegalMoves(Array.from(moves));
      return;
    }
    
    // Regular moves (non-bearing off)
    for (let i = 0; i < availableDice.length; i++) {
      let d = availableDice[i];
      let to = currentPlayer === 1 ? from + d : from - d;
      if (to >= 0 && to <= 23) {
        let pointCheckers = checkers.filter(c => c.point === to);
        if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1) {
          moves.add(to);
        }
      }
    }
    
    // BEARING OFF LOGIC
    if (canBear && homeQuadrant.includes(from)) {
      // Calculate distance to bear off
      let distance = currentPlayer === 1 ? 24 - from : from + 1;
      
      // Get all player's checkers in home quadrant
      let playerCheckers = checkers.filter(c => c.player === currentPlayer && homeQuadrant.includes(c.point));
      
      // Find the farthest checker (highest distance from bear off)
      let farthestDistance = currentPlayer === 1
        ? Math.max(...playerCheckers.map(c => 24 - c.point))
        : Math.max(...playerCheckers.map(c => c.point + 1));
      
      // Check if this checker is the farthest
      let isFarthest = (currentPlayer === 1 && (24 - from) === farthestDistance) || 
                       (currentPlayer === 2 && (from + 1) === farthestDistance);
      
      // Single die bearing off
      for (let i = 0; i < movesAllowed.length; i++) {
        if (usedDice.includes(i)) continue;
        let d = movesAllowed[i];
        
        // Check if this die can be used for bearing off
        let canUseThisDie = false;
        
        // Case 1: Exact match
        if (d === distance) {
          canUseThisDie = true;
        }
        // Case 2: Higher die and this is the farthest checker
        else if (d > distance && isFarthest) {
          canUseThisDie = true;
        }
        // Case 3: Higher die and this is the only checker left that can bear off
        else if (d > distance) {
          // Check if this is the only checker that can bear off with any available die
          let otherCheckersCanBearOff = false;
          for (let otherChecker of playerCheckers) {
            if (otherChecker.point === from) continue; // Skip self
            let otherDistance = currentPlayer === 1 ? 24 - otherChecker.point : otherChecker.point + 1;
            let otherIsFarthest = (currentPlayer === 1 && (24 - otherChecker.point) === farthestDistance) || 
                                 (currentPlayer === 2 && (otherChecker.point + 1) === farthestDistance);
            
            // Check if other checker can bear off with any available die
            for (let j = 0; j < movesAllowed.length; j++) {
              if (usedDice.includes(j)) continue;
              let otherDie = movesAllowed[j];
              if (otherDie === otherDistance || (otherDie > otherDistance && otherIsFarthest)) {
                otherCheckersCanBearOff = true;
                break;
              }
            }
            if (otherCheckersCanBearOff) break;
          }
          
          // If no other checkers can bear off, then this checker can use the higher die
          if (!otherCheckersCanBearOff) {
            canUseThisDie = true;
          }
        }
        
        if (canUseThisDie) {
          // For doubles, check if this die has been used too many times
          if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
            let dieUsageCount = usedDice.filter(usedIndex => usedIndex === i).length;
            if (dieUsageCount < 2) { // Can use each die up to 2 times for doubles
              moves.add('bearoff');
            }
          } else {
            // For regular dice, check if this die is available
            if (!usedDice.includes(i)) {
              moves.add('bearoff');
            }
          }
        }
      }
      
      // Sum bearing off (two dice) - only if no dice used yet
      if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
        let d1 = movesAllowed[0], d2 = movesAllowed[1];
        if (d1 + d2 === distance) {
          // Check if intermediate move is valid
          let mid = currentPlayer === 1 ? from + d1 : from - d1;
          if (mid >= 0 && mid <= 23) {
            let midCheckers = checkers.filter(c => c.point === mid);
            if (midCheckers.length === 0 || midCheckers[0].player === currentPlayer || midCheckers.length === 1) {
              moves.add(`bearoff|sum|0,1`);
            }
          }
        }
      }
      
      // Multimove bearing off for doubles
      if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
        let d = movesAllowed[0];
        let maxSteps = 4 - usedDice.length;
        
        for (let steps = 2; steps <= maxSteps; steps++) {
          let valid = true;
          let pos = from;
          
          // Check if this multimove is valid
          for (let s = 1; s <= steps; s++) {
            let next = currentPlayer === 1 ? pos + d : pos - d;
            if (next < 0 || next > 23) { 
              valid = false; 
              break; 
            }
            let pointCheckers = checkers.filter(c => c.point === next);
            if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1) {
              // valid
            } else {
              valid = false; 
              break;
            }
            pos = next;
          }
          
          if (valid) {
            // Check if this multimove ends in bearing off
            let finalDistance = currentPlayer === 1 ? 24 - pos : pos + 1;
            if (finalDistance <= d) {
              moves.add(`bearoff|multimove|${steps}`);
            }
          }
        }
      }
    }
    
    // Multi-move highlighting for regular moves (non-bearing off)
    if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
      let d1 = movesAllowed[0], d2 = movesAllowed[1];
      for (let order of [[d1, d2], [d2, d1]]) {
        let mid = currentPlayer === 1 ? from + order[0] : from - order[0];
        let to2 = currentPlayer === 1 ? mid + order[1] : mid - order[1];
        if (mid >= 0 && mid <= 23 && to2 >= 0 && to2 <= 23) {
          let midCheckers = checkers.filter(c => c.point === mid);
          let endCheckers = checkers.filter(c => c.point === to2);
          if ((midCheckers.length === 0 || midCheckers[0].player === currentPlayer || midCheckers.length === 1) &&
              (endCheckers.length === 0 || endCheckers[0].player === currentPlayer || endCheckers.length === 1)) {
            moves.add(`${to2}|sum`);
          }
        }
      }
    }
    
    // Multi-move highlighting for doubles (move 2, 3, or 4 times with the same die)
    if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
      let d = movesAllowed[0];
      let maxSteps = 4 - usedDice.length;
      for (let steps = 2; steps <= maxSteps; steps++) {
        let valid = true;
        let pos = from;
        for (let s = 1; s <= steps; s++) {
          let next = currentPlayer === 1 ? pos + d : pos - d;
          if (next < 0 || next > 23) { valid = false; break; }
          let pointCheckers = checkers.filter(c => c.point === next);
          if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1) {
            // valid
          } else {
            valid = false; break;
          }
          pos = next;
        }
        if (valid) moves.add(`${pos}|${steps}`);
      }
    }
    
    setLegalMoves(Array.from(moves));
  }

  // NOTE: getNextBearoffChecker function removed - no longer needed since auto-selection is disabled for bearing off

  function findDieIndexForMove(from, to, movesAllowed, usedDice, isBarEntry = false, player = null) {
    if (isBarEntry) {
      // For bar entry, from is 24 (white) or -1 (black), to is entry point
      for (let i = 0; i < movesAllowed.length; i++) {
        if (!usedDice.includes(i)) {
          let die = movesAllowed[i];
          let entryPoint = player === 1 ? die - 1 : 24 - die;
          if (entryPoint === to) return i;
        }
      }
      return -1;
    } else {
      for (let i = 0; i < movesAllowed.length; i++) {
        if (!usedDice.includes(i)) {
          let expected = Math.abs(getMoveDistance(from, to, player ?? currentPlayer));
          // Debug for Player 2 moving to 0
          if ((player ?? currentPlayer) === 2 && to === 0) {
            console.log('[DEBUG] findDieIndexForMove: Player 2 moving from', from, 'to 0. movesAllowed:', movesAllowed, 'usedDice:', usedDice, 'expected:', expected);
          }
          if (movesAllowed[i] === expected) {
            // Debug log for Player 2 to 0
            if ((player ?? currentPlayer) === 2 && to === 0) {
              console.log('[findDieIndexForMove] Player 2 matching die', movesAllowed[i], 'for move', from, '->', to, 'expected', expected);
            }
            return i;
          }
        }
      }
      // Extra debug if not found
      if ((player ?? currentPlayer) === 2 && to === 0) {
        console.warn('[findDieIndexForMove] No matching die found for Player 2 moving from', from, 'to 0. movesAllowed:', movesAllowed, 'usedDice:', usedDice);
      }
      return -1;
    }
  }

  // Prevent all game actions if gameOver is set
  function handlePointClick(point) {
    if (gameOver) return;
    let match;
    const from = selected ? selected.point : null;
    
    // BEARING OFF HANDLERS
    if (point === 'bearoff' && selected && legalMoves.includes('bearoff')) {
      handleSingleBearoff(selected);
      return;
    }
    
    if (typeof point === 'string' && point.startsWith('bearoff|sum|') && selected && legalMoves.some(m => typeof m === 'string' && m.startsWith('bearoff|sum|'))) {
      handleSumBearoff(selected, point);
      return;
    }
    
    if (typeof point === 'string' && point.startsWith('bearoff|multimove|') && selected && legalMoves.some(m => typeof m === 'string' && m.startsWith('bearoff|multimove|'))) {
      handleMultimoveBearoff(selected, point);
      return;
    }
    
    // Handle regular moves (non-bearing off)
    match = legalMoves.find(m => (typeof m === 'string' && m.split('|')[0] == point) || m == point);
    let dest = typeof match === 'string' && match.includes('|') ? parseInt(match.split('|')[0], 10) : point;
    if (!selected || match == null) return;
    
    // Store state for undo
    setUndoStack(stack => [
      {
        checkers: JSON.parse(JSON.stringify(checkers)),
        bar: JSON.parse(JSON.stringify(bar)),
        borneOff: { ...borneOff },
        usedDice: [...usedDice],
        selected: selected ? { ...selected } : null,
        legalMoves: [...legalMoves],
        hasRolled,
        movesAllowed: [...movesAllowed],
        currentPlayer,
        dice: [...dice],
        moveMade,
        awaitingEndTurn,
        noMoveOverlay,
      },
      ...stack
    ]);
    setMoveMade(true);
    
    // Handle regular moves
    handleRegularMove(selected, dest, match);
    
    // Store the move in database for online games
    if (isOnlineGame) {
      const dieIndex = findDieIndexForMove(selected.point, dest, movesAllowed, usedDice);
      storeMoveInDatabase('move_checker', {
        checkerId: selected.id,
        fromPoint: selected.point,
        toPoint: dest,
        dieIndex: dieIndex
      });
    }
  }
  
  // Handle single die bearing off
  function handleSingleBearoff(checker) {
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let from = checker.point;
    let distance = currentPlayer === 1 ? 24 - from : from + 1;
    let playerCheckers = checkers.filter(c => c.player === currentPlayer && homeQuadrant.includes(c.point));
    let farthestDistance = currentPlayer === 1
      ? Math.max(...playerCheckers.map(c => 24 - c.point))
      : Math.max(...playerCheckers.map(c => c.point + 1));
    let isFarthest = (currentPlayer === 1 && (24 - from) === farthestDistance) || 
                     (currentPlayer === 2 && (from + 1) === farthestDistance);
    
    // Calculate move accuracy for human players
    if (isCpuGame && currentPlayer !== cpuPlayer) {
      const move = {
        type: 'bear_off',
        from: from,
        checker: checker
      };
      
      const accuracy = calculateMoveAccuracy(move, checkers, bar, borneOff, movesAllowed, usedDice, currentPlayer);
      setMoveAccuracy(prev => ({
        ...prev,
        [currentPlayer]: [...prev[currentPlayer], accuracy]
      }));
      
      console.log(`[Accuracy] Player ${currentPlayer} bear off accuracy: ${(accuracy * 100).toFixed(1)}%`);
    }
    
    // Find which die to use
    let dieIndex = -1;
    for (let i = 0; i < movesAllowed.length; i++) {
      if (usedDice.includes(i)) continue;
      let d = movesAllowed[i];
      if (d === distance || (d > distance && isFarthest)) {
        dieIndex = i;
        break;
      }
    }
    
    if (dieIndex === -1) return;
    
    // Store state for undo
    setUndoStack(stack => [
      {
        checkers: JSON.parse(JSON.stringify(checkers)),
        bar: JSON.parse(JSON.stringify(bar)),
        borneOff: { ...borneOff },
        usedDice: [...usedDice],
        selected: selected ? { ...selected } : null,
        legalMoves: [...legalMoves],
        hasRolled,
        movesAllowed: [...movesAllowed],
        currentPlayer,
        dice: [...dice],
        moveMade,
        awaitingEndTurn,
        noMoveOverlay,
      },
      ...stack
    ]);
    
    // Execute bearing off
    let newCheckers = checkers.filter(c => c.id !== checker.id);
    let newBorneOff = { ...borneOff };
    newBorneOff[currentPlayer]++;
    let newUsedDice = [...usedDice, dieIndex];
    
    // Update state
    setCheckers(newCheckers);
    setUsedDice(newUsedDice);
    setBorneOff(newBorneOff);
    setMoveMade(true);
    
    // Check for win
    if (newBorneOff[currentPlayer] === 15) {
      triggerGameOver('win', currentPlayer, currentPlayer === 1 ? 2 : 1);
      return;
    }
    
    // Clear selection and check if turn should end
    setSelected(null);
    setLegalMoves([]);
    if (allDiceUsed() || !hasAnyValidMoves()) {
      setAwaitingEndTurn(true);
    }
    
    // Store the bear off move in database for online games
    if (isOnlineGame) {
      storeMoveInDatabase('move_checker', {
        checkerId: checker.id,
        fromPoint: checker.point,
        toPoint: 'bearoff',
        dieIndex: dieIndex
      });
    }
  }
  
  // Handle sum bearing off (two dice)
  function handleSumBearoff(checker, point) {
    let [, , idxStr] = point.split('|');
    let [i, j] = idxStr.split(',').map(Number);
    
    if (usedDice.includes(i) || usedDice.includes(j)) return;
    
    // Store state for undo
    setUndoStack(stack => [
      {
        checkers: JSON.parse(JSON.stringify(checkers)),
        bar: JSON.parse(JSON.stringify(bar)),
        borneOff: { ...borneOff },
        usedDice: [...usedDice],
        selected: selected ? { ...selected } : null,
        legalMoves: [...legalMoves],
        hasRolled,
        movesAllowed: [...movesAllowed],
        currentPlayer,
        dice: [...dice],
        moveMade,
        awaitingEndTurn,
        noMoveOverlay,
      },
      ...stack
    ]);
    
    // Execute sum bearing off
    let newCheckers = checkers.filter(c => c.id !== checker.id);
    let newBorneOff = { ...borneOff };
    newBorneOff[currentPlayer]++;
    let newUsedDice = [...usedDice, i, j];
    
    // Update state
    setCheckers(newCheckers);
    setUsedDice(newUsedDice);
    setBorneOff(newBorneOff);
    setMoveMade(true);
    
    // Check for win
    if (newBorneOff[currentPlayer] === 15) {
      triggerGameOver('win', currentPlayer, currentPlayer === 1 ? 2 : 1);
      return;
    }
    
    // Clear selection and check if turn should end
    setSelected(null);
    setLegalMoves([]);
    if (allDiceUsed() || !hasAnyValidMoves()) {
      setAwaitingEndTurn(true);
    }
    
    // Store the bear off move in database for online games
    if (isOnlineGame) {
      storeMoveInDatabase('move_checker', {
        checkerId: checker.id,
        fromPoint: checker.point,
        toPoint: 'bearoff',
        dieIndex: [i, j]
      });
    }
  }
  
  // Handle multimove bearing off for doubles
  function handleMultimoveBearoff(checker, point) {
    let [, , stepsStr] = point.split('|');
    let steps = parseInt(stepsStr, 10);
    let d = movesAllowed[0]; // For doubles, all dice are the same
    
    // Find which dice indices to use
    let dieIndexes = [];
    let availableDice = [];
    
    // Get all available dice indices
    for (let i = 0; i < movesAllowed.length; i++) {
      if (!usedDice.includes(i)) {
        availableDice.push(i);
      }
    }
    
    // Take the first 'steps' available dice
    if (availableDice.length >= steps) {
      dieIndexes = availableDice.slice(0, steps);
    }
    
    if (dieIndexes.length !== steps) return;
    
    // Store state for undo
    setUndoStack(stack => [
      {
        checkers: JSON.parse(JSON.stringify(checkers)),
        bar: JSON.parse(JSON.stringify(bar)),
        borneOff: { ...borneOff },
        usedDice: [...usedDice],
        selected: selected ? { ...selected } : null,
        legalMoves: [...legalMoves],
        hasRolled,
        movesAllowed: [...movesAllowed],
        currentPlayer,
        dice: [...dice],
        moveMade,
        awaitingEndTurn,
        noMoveOverlay,
      },
      ...stack
    ]);
    
    // Execute multimove bearing off
    let newCheckers = checkers.filter(c => c.id !== checker.id);
    let newBorneOff = { ...borneOff };
    newBorneOff[currentPlayer]++;
    let newUsedDice = [...usedDice, ...dieIndexes];
    
    // Update state
    setCheckers(newCheckers);
    setUsedDice(newUsedDice);
    setBorneOff(newBorneOff);
    setMoveMade(true);
    
    // Check for win
    if (newBorneOff[currentPlayer] === 15) {
      triggerGameOver('win', currentPlayer, currentPlayer === 1 ? 2 : 1);
      return;
    }
    
    // Clear selection and check if turn should end
    setSelected(null);
    setLegalMoves([]);
    if (allDiceUsed() || !hasAnyValidMoves()) {
      setAwaitingEndTurn(true);
    }
    
    // Store the bear off move in database for online games
    if (isOnlineGame) {
      storeMoveInDatabase('move_checker', {
        checkerId: checker.id,
        fromPoint: checker.point,
        toPoint: 'bearoff',
        dieIndex: dieIndexes
      });
    }
  }
  
  // Handle regular moves (non-bearing off)
  function handleRegularMove(checker, dest, match) {
    let from = checker.point;
    
    // Calculate move accuracy for human players
    if (isCpuGame && currentPlayer !== cpuPlayer) {
      const move = {
        type: 'regular',
        from: from,
        to: dest,
        checker: checker
      };
      
      const accuracy = calculateMoveAccuracy(move, checkers, bar, borneOff, movesAllowed, usedDice, currentPlayer);
      setMoveAccuracy(prev => ({
        ...prev,
        [currentPlayer]: [...prev[currentPlayer], accuracy]
      }));
      
      console.log(`[Accuracy] Player ${currentPlayer} move accuracy: ${(accuracy * 100).toFixed(1)}%`);
    }
    
    // Handle bar entry
    if (from === 24 || from === -1) {
      if (typeof match === 'string' && match.includes('|bar|')) {
        let [, stepsStr, , typeStr] = match.split('|');
        let steps = parseInt(stepsStr, 10);
        
        let newCheckers = checkers.filter(c => c.id !== checker.id);
        let newBar = { ...bar, [currentPlayer]: bar[currentPlayer].filter(c => c.id !== checker.id) };
        let newBorneOff = { ...borneOff };
        let newUsedDice = [...usedDice];
        
        // Handle single die bar entry
        if (steps === 1) {
          let dieIndex = parseInt(match.split('|')[3], 10);
          let newChecker = { ...checker, point: dest, offset: newCheckers.filter(c => c.point === dest).length };
          
          // Handle hit
          let pointCheckers = checkers.filter(c => c.point === dest);
          if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
            let hitChecker = pointCheckers[0];
            let opp = hitChecker.player;
            let newHitObj = { ...hitChecker, point: opp === 1 ? 24 : -1, offset: bar[opp].length };
            newBar[opp] = [...bar[opp], newHitObj];
                        newCheckers = newCheckers.filter(c => c.id !== hitChecker.id);
          }
          
          newCheckers.push(newChecker);
          newUsedDice.push(dieIndex);
        }
        // Handle multimove bar entry (sum of two dice)
        else if (steps === 2 && typeStr === 'sum') {
          let d1 = movesAllowed[0], d2 = movesAllowed[1];
          let pos = from;
          let movingChecker = checker;
          
          // Move through intermediate point to final destination
          let intermediatePoint = currentPlayer === 1 ? d1 - 1 : 24 - d1;
          
          // Handle hit at intermediate point
          let pointCheckers = newCheckers.filter(c => c.point === intermediatePoint);
          if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
            let hitChecker = pointCheckers[0];
            let barChecker = { ...hitChecker, point: hitChecker.player === 1 ? 24 : -1, offset: newBar[hitChecker.player].length };
            newBar[hitChecker.player] = [...newBar[hitChecker.player], barChecker];
            newCheckers = newCheckers.filter(c => c.id !== hitChecker.id);
          }
          
          // Handle hit at final destination
          pointCheckers = newCheckers.filter(c => c.point === dest);
          if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
            let hitChecker = pointCheckers[0];
            let barChecker = { ...hitChecker, point: hitChecker.player === 1 ? 24 : -1, offset: newBar[hitChecker.player].length };
            newBar[hitChecker.player] = [...newBar[hitChecker.player], barChecker];
            newCheckers = newCheckers.filter(c => c.id !== hitChecker.id);
          }
          
          let newChecker = { ...movingChecker, point: dest, offset: newCheckers.filter(c => c.point === dest).length };
          newCheckers.push(newChecker);
          
          newUsedDice.push(0, 1); // Use both dice
        }
        
        // Update state
        setCheckers(newCheckers);
        setBar(newBar);
        setBorneOff(newBorneOff);
        setUsedDice(newUsedDice);
        setSelected(null);
        setLegalMoves([]);
        setMoveMade(true);
        return;
      }
    }
    
    // Handle multimoves for doubles
    if (typeof match === 'string' && match.includes('|') && !match.startsWith('bearoff')) {
      if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
        let [destStr, stepsStr] = match.split('|');
        let destLocal = parseInt(destStr, 10);
        let steps = parseInt(stepsStr, 10);
        let d = movesAllowed[0];
        
        let dieIndexes = [];
        for (let i = 0, used = 0; i < movesAllowed.length && used < steps; i++) {
          if (!usedDice.includes(i)) {
            dieIndexes.push(i);
            used++;
          }
        }
        
        if (dieIndexes.length !== steps) return;
        
        let newCheckers = [...checkers];
        let newBar = { ...bar };
        let newBorneOff = { ...borneOff };
        let pos = from;
        let movingChecker = checker;
        
        for (let s = 1; s <= steps; s++) {
          let next = s === steps ? destLocal : (currentPlayer === 1 ? pos + d : pos - d);
          
          // Handle hit
          let pointCheckers = newCheckers.filter(c => c.point === next);
          if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
            let hitChecker = pointCheckers[0];
            let barChecker = { ...hitChecker, point: hitChecker.player === 1 ? 24 : -1, offset: newBar[hitChecker.player].length };
            newBar[hitChecker.player] = [...newBar[hitChecker.player], barChecker];
            newCheckers = newCheckers.filter(c => c.id !== hitChecker.id);
          }
          
          let idx = newCheckers.findIndex(c => c.id === movingChecker.id);
          newCheckers[idx] = { ...movingChecker, point: next, offset: newCheckers.filter(c => c.point === next).length };
          movingChecker = newCheckers[idx];
          pos = next;
        }
        
        let newUsedDice = [...usedDice, ...dieIndexes];
        // Update state
        setCheckers(newCheckers);
        setBar(newBar);
        setBorneOff(newBorneOff);
        setUsedDice(newUsedDice);
        setSelected(null);
        setLegalMoves([]);
        setMoveMade(true);
        return;
      }
      
      // Handle sum moves
      if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && match.endsWith('|sum')) {
        let d1 = movesAllowed[0], d2 = movesAllowed[1];
        let newCheckers = [...checkers];
        let newBar = { ...bar };
        let newBorneOff = { ...borneOff };
        let pos = from;
        let movingChecker = checker;
        
        // Try both orders
        let orders = [[d1, d2], [d2, d1]];
        let bestOrder = null;
        for (let order of orders) {
          let mid = currentPlayer === 1 ? pos + order[0] : pos - order[0];
          let to2 = currentPlayer === 1 ? mid + order[1] : mid - order[1];
          if (to2 === dest) {
            let midCheckers = checkers.filter(c => c.point === mid);
            if (midCheckers.length === 1 && midCheckers[0].player !== currentPlayer) {
              bestOrder = order;
              break;
            }
            if (!bestOrder) bestOrder = order;
          }
        }
        
        if (bestOrder) {
          for (let d of bestOrder) {
            let next = currentPlayer === 1 ? pos + d : pos - d;
            
            // Handle hit
            let pointCheckers = newCheckers.filter(c => c.point === next);
            if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
              let hitChecker = pointCheckers[0];
              let barChecker = { ...hitChecker, point: hitChecker.player === 1 ? 24 : -1, offset: newBar[hitChecker.player].length };
              newBar[hitChecker.player] = [...newBar[hitChecker.player], barChecker];
              newCheckers = newCheckers.filter(c => c.id !== hitChecker.id);
            }
            
            let idx = newCheckers.findIndex(c => c.id === movingChecker.id);
            newCheckers[idx] = { ...movingChecker, point: next, offset: newCheckers.filter(c => c.point === next).length };
            movingChecker = newCheckers[idx];
            pos = next;
          }
          
          let newUsedDice = [...usedDice, 0, 1];
          // Update state
          setCheckers(newCheckers);
          setBar(newBar);
          setBorneOff(newBorneOff);
          setUsedDice(newUsedDice);
          setSelected(null);
          setLegalMoves([]);
          setMoveMade(true);
          return;
        }
      }
    }
    
    // Handle single move
    let dieIndex = findDieIndexForMove(from, dest, movesAllowed, usedDice, false, currentPlayer);
    if (dieIndex === -1) return;
    
    let newCheckers = [...checkers];
    let newBar = { ...bar };
    let newBorneOff = { ...borneOff };
    
    // Handle hit
    let pointCheckers = newCheckers.filter(c => c.point === dest);
    if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
      let hitChecker = pointCheckers[0];
      let barChecker = { ...hitChecker, point: hitChecker.player === 1 ? 24 : -1, offset: newBar[hitChecker.player].length };
      newBar[hitChecker.player] = [...newBar[hitChecker.player], barChecker];
      newCheckers = newCheckers.filter(c => c.id !== hitChecker.id);
    }
    
    let idx = newCheckers.findIndex(c => c.id === checker.id);
    newCheckers[idx] = { ...checker, point: dest, offset: newCheckers.filter(c => c.point === dest).length };
    
    let newUsedDice = [...usedDice, dieIndex];
    // Update state
    setCheckers(newCheckers);
    setBar(newBar);
    setBorneOff(newBorneOff);
    setUsedDice(newUsedDice);
    setSelected(null);
    setLegalMoves([]);
    setMoveMade(true);
  }

  // Modified resignGame to support confirm
  const confirmResign = () => setShowConfirmResign(true);
  const cancelResign = () => setShowConfirmResign(false);
  const doResign = () => {
    setShowConfirmResign(false);
    triggerGameOver('resign', currentPlayer === 1 ? 2 : 1, currentPlayer);
  };

  // Double offer functions
  const offerDouble = () => {
    if (!canDouble[currentPlayer]) return;
    
    const toPlayer = currentPlayer === 1 ? 2 : 1;
    setDoubleOffer({ from: currentPlayer, to: toPlayer });
    setDoubleTimer(15);
  };

  const handleDoubleResponse = (accepted) => {
    if (accepted) {
      // Accept the double
      setGameStakes(prev => prev * 2);
      setCanDouble(prev => ({ ...prev, [currentPlayer]: false, [doubleOffer.to]: true }));
      setDoubleOffer(null);
      setDoubleTimer(15);
    } else {
      // Decline the double - offerer wins
      setDoubleOffer(null);
      setDoubleTimer(15);
      triggerGameOver('double', doubleOffer.from, doubleOffer.to);
    }
  };

  // Update rollDice to auto-select bar checker only after dice/movesAllowed are set
  const rollDice = async () => {
    if (gameOver) return;
    if (hasRolled) return;
    
    console.log('Rolling dice in online game:', { isOnlineGame, currentPlayer, hasRolled });
    
    setMessage('');
    setNoMoveOverlay(false);
    setLastNoMoveDice(null);
    if (nextPlayerRef.current !== null) {
      setCurrentPlayer(nextPlayerRef.current);
      nextPlayerRef.current = null;
    }
    
    // Start rolling animation
    setIsRolling(true);
    setAnimationFrame(0);
    
    // Animate dice values and frames during roll
    const rollInterval = setInterval(() => {
      setRollingDice([
        1 + Math.floor(Math.random() * 6),
        1 + Math.floor(Math.random() * 6)
      ]);
      setAnimationFrame(prev => (prev + 1) % 7);
    }, 100);
    
    // Stop animation and set final values after 600ms
    setTimeout(async () => {
      clearInterval(rollInterval);
      setIsRolling(false);
      setAnimationFrame(0);
      
      const d = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      let moves;
      if (d[0] === d[1]) {
        moves = [d[0], d[0], d[0], d[0]];
      } else {
        moves = [d[0], d[1]];
      }
      setDice(d);
      setUsedDice([]);
      setHasRolled(true);
      setMovesAllowed(moves);
      console.log('Rolled dice:', d, 'movesAllowed:', moves);
      setSelected(null);
      setLegalMoves([]);

      // Store the roll in database for online games
      if (isOnlineGame && currentMatch && currentPlayerId) {
        try {
          const { error } = await supabase
            .from('game_moves')
            .insert([
              {
                match_id: currentMatch.id,
                player_id: currentPlayerId,
                move_type: 'game_move',
                move_data: {
                  player: currentPlayer,
                  action: 'roll_dice',
                  data: {
                    dice: d,
                    movesAllowed: moves
                  }
                },
                created_at: new Date().toISOString()
              }
            ]);
          
          if (error) {
            console.error('Error storing dice roll:', error);
          } else {
            console.log('Stored dice roll in database');
          }
        } catch (error) {
          console.error('Error storing dice roll:', error);
        }
      }
    }, 600);
  };

  // Add useEffect to auto-select bar checker and calculate legal moves after rolling
  React.useEffect(() => {
    if (hasRolled && bar[currentPlayer].length > 0) {
      const barChecker = bar[currentPlayer][bar[currentPlayer].length - 1];
      setSelected(barChecker);
      calculateLegalMoves(barChecker);
    }
  }, [hasRolled, bar, movesAllowed, currentPlayer]);

  // Auto-roll when turn starts if enabled
  React.useEffect(() => {
    if (!firstRollPhase && !hasRolled && !gameOver && autoRoll[currentPlayer] && !doubleOffer) {
      // Small delay to ensure state is ready
      setTimeout(() => {
        if (!hasRolled && !gameOver && !doubleOffer) {
          rollDice();
        }
      }, 100);
    }
  }, [currentPlayer, firstRollPhase, hasRolled, gameOver, autoRoll, doubleOffer]);

  // CPU move logic
  React.useEffect(() => {
    if (isCpuGame && !firstRollPhase && !gameOver && currentPlayer === cpuPlayer && !hasRolled && !isCpuThinking) {
      // CPU's turn - roll dice automatically
      setTimeout(() => {
        if (!hasRolled && !gameOver && currentPlayer === cpuPlayer && isCpuGame) {
          rollDice();
        }
      }, 500); // Small delay for better UX
    }
  }, [isCpuGame, firstRollPhase, gameOver, currentPlayer, cpuPlayer, hasRolled, isCpuThinking]);

  // CPU move execution after dice are rolled
  React.useEffect(() => {
    if (isCpuGame && !gameOver && currentPlayer === cpuPlayer && hasRolled && !isCpuThinking) {
      setIsCpuThinking(true);
      
      // Simulate thinking time based on difficulty
      const thinkingTime = Math.max(500, (6 - cpuDifficulty) * 300); // Higher difficulty = faster moves
      
      setTimeout(() => {
        if (currentPlayer === cpuPlayer && hasRolled && !gameOver && isCpuGame) {
          executeCpuMove();
        }
        setIsCpuThinking(false);
      }, thinkingTime);
    }
  }, [isCpuGame, gameOver, currentPlayer, cpuPlayer, hasRolled, isCpuThinking, cpuDifficulty]);

  // CPU doubling decision trigger
  React.useEffect(() => {
    if (isCpuGame && !gameOver && currentPlayer === cpuPlayer && !hasRolled && !doubleOffer) {
      // Small delay to allow for state updates
      setTimeout(() => {
        if (currentPlayer === cpuPlayer && !gameOver && !doubleOffer && isCpuGame) {
          cpuDoubleDecision();
        }
      }, 200);
    }
  }, [isCpuGame, gameOver, currentPlayer, cpuPlayer, hasRolled, doubleOffer]);

  // CPU response to doubling offers
  React.useEffect(() => {
    if (isCpuGame && doubleOffer && doubleOffer.to === cpuPlayer && !gameOver) {
      cpuDoubleResponse();
    }
  }, [isCpuGame, doubleOffer, cpuPlayer, gameOver]);

  // Handle double offer timer
  React.useEffect(() => {
    if (doubleOffer && doubleTimer > 0) {
      const timer = setTimeout(() => {
        setDoubleTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (doubleOffer && doubleTimer === 0) {
      // Auto-decline when timer expires
      handleDoubleResponse(false);
    }
  }, [doubleOffer, doubleTimer]);

  // Reset doubling state on new game
  React.useEffect(() => {
    setDoubleOffer(null);
    setDoubleTimer(15);
    setCanDouble({ 1: true, 2: true });
    setGameStakes(1);
  }, [screen]);
  
  // Calculate average accuracy when move accuracy changes
  React.useEffect(() => {
    const calculateAverage = (accuracies) => {
      if (accuracies.length === 0) return 0;
      return accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    };
    
    setAverageAccuracy({
      1: calculateAverage(moveAccuracy[1]),
      2: calculateAverage(moveAccuracy[2])
    });
  }, [moveAccuracy]);

  // New: Get all legal from-points for the current player
  function getLegalFromPoints() {
    if (!hasRolled) return [];
    let legal = new Set();
    if (bar[currentPlayer].length > 0) {
      legal.add(currentPlayer === 1 ? 24 : -1);
      return Array.from(legal);
    }
    let playerCheckers = checkers.filter(c => c.player === currentPlayer);
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let canBear = canBearOffReact();
    let availableDice = movesAllowed.filter((d, i) => !usedDice.includes(i));
    
    for (let c of playerCheckers) {
      let from = c.point;
      
      // Check regular moves (non-bearing off)
      for (let i = 0; i < availableDice.length; i++) {
        let d = availableDice[i];
        let to = currentPlayer === 1 ? from + d : from - d;
        if (to >= 0 && to <= 23) {
          let pointCheckers = checkers.filter(c2 => c2.point === to);
          if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1) {
            legal.add(from);
          }
        }
      }
      
      // Check bearing off moves
      if (canBear && homeQuadrant.includes(from)) {
        let distance = currentPlayer === 1 ? 24 - from : from + 1;
        let homeCheckers = playerCheckers.filter(c => homeQuadrant.includes(c.point));
        let farthestDistance = currentPlayer === 1
          ? Math.max(...homeCheckers.map(c => 24 - c.point))
          : Math.max(...homeCheckers.map(c => c.point + 1));
        let isFarthest = (currentPlayer === 1 && (24 - from) === farthestDistance) || 
                         (currentPlayer === 2 && (from + 1) === farthestDistance);
        
        // Check single die bearing off
        for (let d of availableDice) {
          if (d === distance || (d > distance && isFarthest)) {
            legal.add(from);
          }
        }
        
        // Check sum bearing off for regular dice
        if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
          let d1 = movesAllowed[0], d2 = movesAllowed[1];
          if (d1 + d2 === distance) {
            let mid = currentPlayer === 1 ? from + d1 : from - d1;
            if (mid >= 0 && mid <= 23) {
              let midCheckers = checkers.filter(c => c.point === mid);
              if (midCheckers.length === 0 || midCheckers[0].player === currentPlayer || midCheckers.length === 1) {
                legal.add(from);
              }
            }
          }
        }
        
        // Check multimove bearing off for doubles
        if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
          let d = movesAllowed[0];
          let maxSteps = 4 - usedDice.length;
          for (let steps = 2; steps <= maxSteps; steps++) {
            let valid = true;
            let pos = from;
            for (let s = 1; s <= steps; s++) {
              let next = currentPlayer === 1 ? pos + d : pos - d;
              if (next < 0 || next > 23) { 
                valid = false; 
                break; 
              }
              let pointCheckers = checkers.filter(c => c.point === next);
              if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1) {
                // valid
              } else {
                valid = false; 
                break;
              }
              pos = next;
            }
            if (valid) {
              // Check if this multimove ends in bearing off
              let finalDistance = currentPlayer === 1 ? 24 - pos : pos + 1;
              if (finalDistance <= d) {
                legal.add(from);
                break; // If this checker can make a multimove bearing off, we don't need to check longer moves
              }
            }
          }
        }
      }
    }
    
    // Add support for doubles multi-moves in getLegalFromPoints
    if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
      let d = movesAllowed[0];
      let maxSteps = 4 - usedDice.length;
      for (let c of playerCheckers) {
        let from = c.point;
        for (let steps = 2; steps <= maxSteps; steps++) {
          let valid = true;
          let pos = from;
          for (let s = 1; s <= steps; s++) {
            let next = currentPlayer === 1 ? pos + d : pos - d;
            if (next < 0 || next > 23) { 
              valid = false; 
              break; 
            }
            let pointCheckers = checkers.filter(c2 => c2.point === next);
            if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1) {
              // valid
            } else {
              valid = false; 
              break;
            }
            pos = next;
          }
          if (valid) {
            legal.add(from);
            break; // If this checker can make a multi-move, we don't need to check longer moves
          }
        }
      }
    }
    
    // Add support for sum moves (non-bearing off)
    if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
      let d1 = movesAllowed[0], d2 = movesAllowed[1];
      for (let c of playerCheckers) {
        let from = c.point;
        for (let order of [[d1, d2], [d2, d1]]) {
          let mid = currentPlayer === 1 ? from + order[0] : from - order[0];
          let to2 = currentPlayer === 1 ? mid + order[1] : mid - order[1];
          if (mid >= 0 && mid <= 23 && to2 >= 0 && to2 <= 23) {
            let midCheckers = checkers.filter(c => c.point === mid);
            let endCheckers = checkers.filter(c => c.point === to2);
            if ((midCheckers.length === 0 || midCheckers[0].player === currentPlayer || midCheckers.length === 1) &&
                (endCheckers.length === 0 || endCheckers[0].player === currentPlayer || endCheckers.length === 1)) {
              legal.add(from);
            }
          }
        }
      }
    }
    
    return Array.from(legal);
  }



  // Deselect checker if click is anywhere outside a valid move/triangle
  useEffect(() => {
    function handleGlobalClick(e) {
      if (!selected) return;
      
      // If the click is inside the SVG board, check if it has a specific handler
      if (svgRef.current && svgRef.current.contains(e.target)) {
        const target = e.target;
        
        // Check if this is a click on an element that has its own handler
        const hasSpecificHandler = target.closest('[data-triangle]') || 
                                  target.closest('[data-bearoff]') ||
                                  target.closest('[data-checker]') || // Checkers
                                  target.tagName === 'text'; // Pip counter text
        
        if (hasSpecificHandler) {
          // Let the specific handler deal with it
          return;
        }
        
        // If we get here, it's a click on the board but not on a specific element
        setSelected(null);
        setLegalMoves([]);
        return;
      }
      
      // Click was outside the SVG board entirely
      setSelected(null);
      setLegalMoves([]);
    }
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [selected, legalMoves]);

  // After rolling, check for no valid moves and end turn if none (including bar entry)
  useEffect(() => {
    if (hasRolled && movesAllowed && movesAllowed[0] != null && !noMoveOverlay) {
      const found = hasAnyValidMoves();
      // Type 1: No moves at all
      if (!found && usedDice.length === 0) {
        setNoMoveOverlay(true);
        setLastNoMoveDice([...movesAllowed]);
      }
      // Type 2: Some moves made, but cannot use all dice
      if (!found && usedDice.length > 0) {
        setNoMoveOverlay('noMore');
        setLastNoMoveDice([...movesAllowed]);
      }
    }
  }, [hasRolled, movesAllowed, usedDice, bar, checkers, currentPlayer, noMoveOverlay]);

  // Add useEffect to set awaitingEndTurn after all dice are used or no valid moves remain
  useEffect(() => {
    if (
      hasRolled &&
      (allDiceUsed() || !hasAnyValidMoves()) &&
      (usedDice.length > 0 || !hasAnyValidMoves())
    ) {
      console.log('[useEffect] Setting awaitingEndTurn to true');
      setAwaitingEndTurn(true);
    }
  }, [usedDice, checkers, hasRolled, moveMade, noMoveOverlay]);

  // Handle checker clicks specifically
  function handleCheckerClick(checker) {
    if (!hasRolled) return;
    
    // If a checker is selected and this is a legal move destination, make the move
    if (selected && selected.id !== checker.id) {
      const legalMovesArray = Array.from(legalMoves);
      const isLegalMove = legalMovesArray.some(move => {
        if (typeof move === 'number') {
          return move === checker.point;
        }
        if (typeof move === 'string' && move.includes('|')) {
          const [dest] = move.split('|');
          return parseInt(dest, 10) === checker.point;
        }
        return false;
      });
      
      if (isLegalMove) {
        handlePointClick(checker.point);
        return;
      } else {
        // If not a legal move, deselect
        setSelected(null);
        setLegalMoves([]);
        return;
      }
    }
    
    // If this checker is already selected, deselect it
    if (selected && selected.id === checker.id) {
      setSelected(null);
      setLegalMoves([]);
      return;
    }
    
    // If no checker selected, select this checker if it's a legal from-point
    if (!selected) {
      const legalFrom = getLegalFromPoints();
      if (legalFrom.includes(checker.point)) {
        // Select the top checker from this point (regardless of which checker was clicked)
        const stack = checkers.filter(c => c.point === checker.point && c.player === currentPlayer);
        const topChecker = stack.reduce((a, b) => a.offset > b.offset ? a : b);
        setSelected(topChecker);
        calculateLegalMoves(topChecker);
      } else {
        setSelected(null);
        setLegalMoves([]);
      }
    } else {
      // If a different checker is selected, switch to this one if it's legal
      const legalFrom = getLegalFromPoints();
      if (legalFrom.includes(checker.point)) {
        // Select the top checker from this point (regardless of which checker was clicked)
        const stack = checkers.filter(c => c.point === checker.point && c.player === currentPlayer);
        const topChecker = stack.reduce((a, b) => a.offset > b.offset ? a : b);
        setSelected(topChecker);
        calculateLegalMoves(topChecker);
      } else {
        // If not a legal from-point, deselect
        setSelected(null);
        setLegalMoves([]);
      }
    }
  }

  // Handle triangle clicks (for empty triangles or destination moves)
  function handleTriangleClick(idx) {
    if (!hasRolled) return;
    
    // If a checker is selected and this is a legal move destination, move there
    if (selected) {
      const isLegalMove = legalMoves.some(move => {
        if (typeof move === 'number') {
          return move === idx;
        }
        if (typeof move === 'string' && move.includes('|')) {
          const [dest] = move.split('|');
          return parseInt(dest, 10) === idx;
        }
        return false;
      });
      
      if (isLegalMove) {
        handlePointClick(idx);
      } else {
        // If not a legal move, deselect
        setSelected(null);
        setLegalMoves([]);
      }
      return;
    }
    
    // If no checker selected, try to select a checker from this point
    const legalFrom = getLegalFromPoints();
    if (legalFrom.includes(idx)) {
      const stack = checkers.filter(c => c.point === idx && c.player === currentPlayer);
      if (stack.length > 0) {
        const topChecker = stack.reduce((a, b) => a.offset > b.offset ? a : b);
        setSelected(topChecker);
        calculateLegalMoves(topChecker);
      }
    } else {
      setSelected(null);
      setLegalMoves([]);
    }
  }

  // Handle bar checker clicks
  function handleBarCheckerClick(barChecker) {
    if (!hasRolled) return;
    
    // If player has bar checkers, select the clicked bar checker
    if (bar[currentPlayer].length > 0) {
      setSelected(barChecker);
      calculateLegalMoves(barChecker);
      return;
    }
  }

  // Helper to check if any valid moves remain for the current player
  function hasAnyValidMoves() {
    if (bar[currentPlayer].length > 0) {
      const barChecker = bar[currentPlayer][bar[currentPlayer].length - 1];
      const barMoves = getBarEntryMoves(barChecker, movesAllowed, usedDice);
      return barMoves.length > 0;
    }
    
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let playerCheckers = checkers.filter(c => c.player === currentPlayer && homeQuadrant.includes(c.point));
    let availableDice = movesAllowed.filter((d, i) => !usedDice.includes(i));
    
    // Check if can bear off
    let canBear = canBearOffReact();
    
    // Check for any valid bearing off move
    if (canBear) {
      for (let checker of playerCheckers) {
        let distance = currentPlayer === 1 ? 24 - checker.point : checker.point + 1;
        let farthestDistance = currentPlayer === 1
          ? Math.max(...playerCheckers.map(c => 24 - c.point))
          : Math.max(...playerCheckers.map(c => c.point + 1));
        let isFarthest = (currentPlayer === 1 && (24 - checker.point) === farthestDistance) || 
                         (currentPlayer === 2 && (checker.point + 1) === farthestDistance);
        
        // Check single die bearing off
        for (let d of availableDice) {
          if (d === distance || (d > distance && isFarthest)) {
            return true;
          }
        }
        
        // Check sum bearing off for regular dice
        if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
          let d1 = movesAllowed[0], d2 = movesAllowed[1];
          if (d1 + d2 === distance) {
            let mid = currentPlayer === 1 ? checker.point + d1 : checker.point - d1;
            if (mid >= 0 && mid <= 23) {
              let midCheckers = checkers.filter(c => c.point === mid);
              if (midCheckers.length === 0 || midCheckers[0].player === currentPlayer || midCheckers.length === 1) {
                return true;
              }
            }
          }
        }
        
        // Check multimove bearing off for doubles
        if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
          let d = movesAllowed[0];
          let maxSteps = 4 - usedDice.length;
          for (let steps = 2; steps <= maxSteps; steps++) {
            let valid = true;
            let pos = checker.point;
            for (let s = 1; s <= steps; s++) {
              let next = currentPlayer === 1 ? pos + d : pos - d;
              if (next < 0 || next > 23) { 
                valid = false; 
                break; 
              }
              let pointCheckers = checkers.filter(c => c.point === next);
              if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1) {
                // valid
              } else {
                valid = false; 
                break;
              }
              pos = next;
            }
            if (valid) {
              // Check if this multimove ends in bearing off
              let finalDistance = currentPlayer === 1 ? 24 - pos : pos + 1;
              if (finalDistance <= d) {
                return true;
              }
            }
          }
        }
      }
    }
    
    // Check for any valid move within the board
    for (let idx = 0; idx < 24; idx++) {
      const stack = checkers.filter(c => c.point === idx && c.player === currentPlayer);
      if (stack.length > 0) {
        const topChecker = stack.reduce((a, b) => a.offset > b.offset ? a : b);
        let tempMoves = new Set();
        
        if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
          let d = movesAllowed[0];
          const multiMoves = getDoublesMultiMoves(topChecker.point, d, usedDice);
          for (const move of multiMoves) {
            tempMoves.add(`${move.dest}|${move.steps}`);
          }
        } else {
          for (let i = 0; i < movesAllowed.length; i++) {
            if (usedDice.includes(i)) continue;
            let d = movesAllowed[i];
            let to = currentPlayer === 1 ? topChecker.point + d : topChecker.point - d;
            if (to >= 0 && to <= 23) {
              let pointCheckers = checkers.filter(c => c.point === to);
              if (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1) {
                tempMoves.add(to);
              }
            }
          }
          
          if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
            let d1 = movesAllowed[0], d2 = movesAllowed[1];
            for (let order of [[d1, d2], [d2, d1]]) {
              let mid = currentPlayer === 1 ? topChecker.point + order[0] : topChecker.point - order[0];
              let to2 = currentPlayer === 1 ? mid + order[1] : mid - order[1];
              if (mid >= 0 && mid <= 23 && to2 >= 0 && to2 <= 23) {
                let midCheckers = checkers.filter(c => c.point === mid);
                let endCheckers = checkers.filter(c => c.point === to2);
                if ((midCheckers.length === 0 || midCheckers[0].player === currentPlayer || midCheckers.length === 1) &&
                    (endCheckers.length === 0 || endCheckers[0].player === currentPlayer || endCheckers.length === 1)) {
                  tempMoves.add(to2);
                }
              }
            }
          }
        }
        
        if (tempMoves.size > 0) {
          return true;
        }
      }
    }
    return false;
  }

  // Derived variable for End Turn button visibility
  const showEndTurn = awaitingEndTurn && (allDiceUsed() || !hasAnyValidMoves());

  // Undo handler
  function handleUndo() {
    if (gameOver) return;
    if (!undoStack.length) return;
    const prev = undoStack[0];
    setCheckers(prev.checkers);
    setBar(prev.bar);
    setBorneOff(prev.borneOff);
    setUsedDice(prev.usedDice);
    setSelected(null); // Always clear selection after undo
    setLegalMoves([]); // Always clear legal moves after undo
    setHasRolled(prev.hasRolled);
    setMovesAllowed(prev.movesAllowed);
    setCurrentPlayer(prev.currentPlayer);
    setDice(prev.dice);
    setMoveMade(prev.moveMade);
    setAwaitingEndTurn(prev.awaitingEndTurn);
    setNoMoveOverlay(prev.noMoveOverlay);
    const newStack = undoStack.slice(1);
    setUndoStack(newStack);
    if (newStack.length === 0) {
      setMoveMade(false);
    }
    // After any undo, immediately re-check if End Turn is valid
    if (allDiceUsed() || !hasAnyValidMoves()) {
      setAwaitingEndTurn(true);
    } else {
      setAwaitingEndTurn(false);
      setNoMoveOverlay(false);
    }
  }

  // End Turn handler
  async function handleEndTurn() {
    if (gameOver) return;
    setNoMoveOverlay(false);
    setLastNoMoveDice(null);
    setHasRolled(false);
    setSelected(null);
    setLegalMoves([]);
    setUsedDice([]);
    setMoveMade(false);
    setCurrentPlayer(3 - currentPlayer);
    setAwaitingEndTurn(false);

    // Store the end turn action in database for online games
    if (isOnlineGame && currentMatch && currentPlayerId) {
      try {
        const { error } = await supabase
          .from('game_moves')
          .insert([
            {
              match_id: currentMatch.id,
              player_id: currentPlayerId,
              move_type: 'game_move',
              move_data: {
                player: currentPlayer,
                action: 'end_turn',
                data: {}
              },
              created_at: new Date().toISOString()
            }
          ]);
        
        if (error) {
          console.error('Error storing end turn:', error);
        } else {
          console.log('Stored end turn in database');
        }
      } catch (error) {
        console.error('Error storing end turn:', error);
      }
    }
  }


  
  function makeSimpleCpuMove() {
    console.log('[CPU] makeSimpleCpuMove called');
    
    // Safety check - only proceed if this is actually a CPU game
    if (!isCpuGame) {
      console.log('[CPU] Not a CPU game, aborting move');
      return;
    }
    
    // Use the new GTO-based AI system
    const gameState = {
      checkers,
      bar,
      borneOff,
      movesAllowed,
      usedDice,
      player: cpuPlayer
    };
    
    const aiResult = cpuMakeMove(gameState, cpuDifficulty);
    
    if (aiResult.type === 'no_moves') {
      console.log('[CPU] No legal moves available, ending turn');
      handleEndTurn();
      return;
    }
    
    const move = aiResult.move;
    console.log('[CPU] Selected move:', move, 'with accuracy:', aiResult.accuracy);
    
    // Execute the selected move
    if (move.type === 'bar_entry') {
      // Handle bar entry
      let barChecker = bar[cpuPlayer][bar[cpuPlayer].length - 1];
      setSelected(barChecker);
      handlePointClick(move.to);
    } else if (move.type === 'regular') {
      // Handle regular move
      setSelected(move.checker);
      handlePointClick(move.to);
    } else if (move.type === 'bear_off') {
      // Handle bearing off
      setSelected(move.checker);
      handlePointClick('bearoff');
    }
  }

  // CPU move execution function
  function executeCpuMove() {
    console.log('[CPU] executeCpuMove called', { gameOver, currentPlayer, cpuPlayer, hasRolled, isCpuGame });
    if (gameOver || currentPlayer !== cpuPlayer || !hasRolled || !isCpuGame) return;
    
    // Check if CPU has any valid moves
    if (!hasAnyValidMoves()) {
      console.log('[CPU] No valid moves, ending turn');
      handleEndTurn();
      return;
    }
    
    console.log('[CPU] Making move...');
    // Use the simple CPU move function
    makeSimpleCpuMove();
  }





  // CPU doubling decision function
  function cpuDoubleDecision() {
    if (!isCpuGame || currentPlayer !== cpuPlayer || doubleOffer) return;
    
    // Advanced doubling logic based on winning probability
    const shouldDouble = () => {
      const winningProbability = calculateWinningProbability(checkers, bar, borneOff, cpuPlayer);
      
      // Double if we have a strong advantage (70%+ winning probability)
      // Higher difficulty levels are more aggressive with doubling
      const threshold = cpuDifficulty >= 4 ? 0.70 : 
                      cpuDifficulty >= 3 ? 0.75 : 
                      cpuDifficulty >= 2 ? 0.80 : 0.85;
      
      console.log(`[CPU] Considering double - Winning probability: ${(winningProbability * 100).toFixed(1)}%, Threshold: ${(threshold * 100).toFixed(1)}%`);
      
      return winningProbability > threshold;
    };
    
    if (shouldDouble() && canDouble[cpuPlayer]) {
      setTimeout(() => {
        if (currentPlayer === cpuPlayer && !gameOver) {
          console.log('[CPU] Offering double');
          offerDouble();
        }
      }, 1000); // 1 second delay
    }
  }

  // CPU response to doubling offers
  function cpuDoubleResponse() {
    if (!isCpuGame || doubleOffer?.to !== cpuPlayer) return;
    
    // CPU response logic based on winning probability
    const shouldAccept = () => {
      const winningProbability = calculateWinningProbability(checkers, bar, borneOff, cpuPlayer);
      
      // Accept if probability of winning is greater than 50%
      // Higher difficulty levels are more precise in their evaluation
      const threshold = cpuDifficulty >= 4 ? 0.50 : 
                      cpuDifficulty >= 3 ? 0.48 : 
                      cpuDifficulty >= 2 ? 0.45 : 0.42;
      
      console.log(`[CPU] Winning probability: ${(winningProbability * 100).toFixed(1)}%, Threshold: ${(threshold * 100).toFixed(1)}%`);
      
      return winningProbability > threshold;
    };
    
    // Simulate thinking time
    setTimeout(() => {
      if (doubleOffer?.to === cpuPlayer && !gameOver) {
        const accept = shouldAccept();
        console.log(`[CPU] ${accept ? 'Accepting' : 'Declining'} double offer`);
        handleDoubleResponse(accept);
      }
    }, 2000); // 2 second delay for CPU to "think"
  }

  function handleFirstRoll() {
    // For online games, handle differently
    if (isOnlineGame) {
      handleOnlineFirstRoll();
      return;
    }
    
    // Start first roll animation
    setIsFirstRolling(true);
    setFirstRollAnimationFrame(0);
    
    // Animate dice during first roll
    const firstRollInterval = setInterval(() => {
      setFirstRollAnimationFrame(prev => (prev + 1) % 7);
    }, 100);
    
    // Stop animation and set final value after 600ms
    setTimeout(() => {
      clearInterval(firstRollInterval);
      setIsFirstRolling(false);
      setFirstRollAnimationFrame(0);
      
      const roll = 1 + Math.floor(Math.random() * 6);
      let newRolls = [...firstRolls];
      newRolls[firstRollTurn - 1] = roll;
      setFirstRolls(newRolls);
      if (firstRollTurn === 1) {
        setFirstRollTurn(2);
      } else {
        // Both have rolled, determine winner
        if (newRolls[0] > newRolls[1]) {
          setFirstRollResult(1);
          setTimeout(() => {
            setCurrentPlayer(1);
            setFirstRollPhase(false);
            setHasRolled(true);
            setDice([newRolls[0], newRolls[1]]);
            setUsedDice([]);
            setMovesAllowed(newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]);
          }, 1200);
        } else if (newRolls[1] > newRolls[0]) {
          setFirstRollResult(2);
          setTimeout(() => {
            setCurrentPlayer(2);
            setFirstRollPhase(false);
            setHasRolled(true);
            setDice([newRolls[0], newRolls[1]]);
            setUsedDice([]);
            setMovesAllowed(newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]);
          }, 1200);
        } else {
          setFirstRollResult('tie');
          setTimeout(() => {
            setFirstRolls([null, null]);
            setFirstRollTurn(1);
            setFirstRollResult(null);
          }, 1200);
        }
      }
    }, 600);
  }

  async function handleOnlineFirstRoll() {
    if (!currentMatch || !currentPlayerId) return;
    
    // Determine which player this user is
    const isPlayer1 = currentMatch.player1_id === currentPlayerId;
    const isPlayer2 = currentMatch.player2_id === currentPlayerId;
    const playerNumber = isPlayer1 ? 1 : isPlayer2 ? 2 : null;
    
    if (!playerNumber || firstRollTurn !== playerNumber) return;
    
    // Start first roll animation
    setIsFirstRolling(true);
    setFirstRollAnimationFrame(0);
    
    // Animate dice during first roll
    const firstRollInterval = setInterval(() => {
      setFirstRollAnimationFrame(prev => (prev + 1) % 7);
    }, 100);
    
    // Stop animation and set final value after 600ms
    setTimeout(async () => {
      clearInterval(firstRollInterval);
      setIsFirstRolling(false);
      setFirstRollAnimationFrame(0);
      
      const roll = Math.floor(Math.random() * 6) + 1;
      
      console.log(`Online first roll for player ${playerNumber}: ${roll}`);
      
      // Store the roll in the database
      const { error } = await supabase
        .from('game_moves')
        .insert([
          {
            match_id: currentMatch.id,
            player_id: currentPlayerId,
            move_type: 'first_roll',
            move_data: { roll, player: playerNumber },
            created_at: new Date().toISOString()
          }
        ]);
      
      if (error) {
        console.error('Error storing first roll:', error);
        return;
      }
      
      // Update local state (same as offline)
      let newRolls = [...firstRolls];
      newRolls[firstRollTurn - 1] = roll;
      setFirstRolls(newRolls);
      
      if (firstRollTurn === 1) {
        setFirstRollTurn(2);
      } else {
        // Both have rolled, determine winner (same as offline)
        if (newRolls[0] > newRolls[1]) {
          setFirstRollResult(1);
          setTimeout(() => {
            setCurrentPlayer(1);
            setFirstRollPhase(false);
            setHasRolled(true);
            setDice([newRolls[0], newRolls[1]]);
            setUsedDice([]);
            setMovesAllowed(newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]);
          }, 1200);
        } else if (newRolls[1] > newRolls[0]) {
          setFirstRollResult(2);
          setTimeout(() => {
            setCurrentPlayer(2);
            setFirstRollPhase(false);
            setHasRolled(true);
            setDice([newRolls[0], newRolls[1]]);
            setUsedDice([]);
            setMovesAllowed(newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]);
          }, 1200);
        } else {
          setFirstRollResult('tie');
          setTimeout(() => {
            setFirstRolls([null, null]);
            setFirstRollTurn(1);
            setFirstRollResult(null);
          }, 1200);
        }
      }
    }, 600);
  }

  // Auto-roll for CPU during first roll phase
  React.useEffect(() => {
    if (isCpuGame && firstRollPhase && !isFirstRolling && !firstRollResult) {
      // Auto-roll for CPU player during first roll
      const currentRoller = firstRollTurn;
      const isCpuTurn = (currentRoller === 1 && cpuPlayer === 1) || (currentRoller === 2 && cpuPlayer === 2);
      
      if (isCpuTurn) {
        setTimeout(() => {
          if (firstRollPhase && !isFirstRolling && !firstRollResult && isCpuGame) {
            handleFirstRoll();
          }
        }, 1000); // 1 second delay for CPU to "think"
      }
    }
  }, [isCpuGame, firstRollPhase, firstRollTurn, isFirstRolling, firstRollResult, cpuPlayer]);

  // Synchronize online first rolls
  useEffect(() => {
    if (!isOnlineGame || !currentMatch || !firstRollPhase) return;

    const syncFirstRolls = async () => {
      try {
        const { data: moves, error } = await supabase
          .from('game_moves')
          .select('*')
          .eq('match_id', currentMatch.id)
          .eq('move_type', 'first_roll')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching first rolls:', error);
          return;
        }

        if (moves && moves.length > 0) {
          let newRolls = [...firstRolls];
          let hasChanges = false;

          moves.forEach(move => {
            const { roll, player } = move.move_data;
            if (roll && player && !newRolls[player - 1]) {
              newRolls[player - 1] = roll;
              hasChanges = true;
              console.log(`Synced first roll for player ${player}: ${roll}`);
            }
          });

          if (hasChanges) {
            setFirstRolls(newRolls);
            
            // If both players have rolled, determine winner
            if (newRolls[0] && newRolls[1]) {
              if (newRolls[0] > newRolls[1]) {
                setFirstRollResult(1);
                setTimeout(() => {
                  setCurrentPlayer(1);
                  setFirstRollPhase(false);
                  setHasRolled(true);
                  setDice([newRolls[0], newRolls[1]]);
                  setUsedDice([]);
                  setMovesAllowed(newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]);
                }, 1200);
              } else if (newRolls[1] > newRolls[0]) {
                setFirstRollResult(2);
                setTimeout(() => {
                  setCurrentPlayer(2);
                  setFirstRollPhase(false);
                  setHasRolled(true);
                  setDice([newRolls[0], newRolls[1]]);
                  setUsedDice([]);
                  setMovesAllowed(newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]);
                }, 1200);
              } else {
                setFirstRollResult('tie');
                setTimeout(() => {
                  setFirstRolls([null, null]);
                  setFirstRollTurn(1);
                  setFirstRollResult(null);
                }, 1200);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in syncFirstRolls:', error);
      }
    };

    const interval = setInterval(syncFirstRolls, 1000);
    return () => clearInterval(interval);
  }, [isOnlineGame, currentMatch, firstRollPhase, firstRolls]);

  // Synchronize online game moves
  useEffect(() => {
    if (!isOnlineGame || !currentMatch || firstRollPhase) return;

    const syncGameMoves = async () => {
      try {
        const { data: moves, error } = await supabase
          .from('game_moves')
          .select('*')
          .eq('match_id', currentMatch.id)
          .eq('move_type', 'game_move')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching game moves:', error);
          return;
        }

        if (moves && moves.length > 0) {
          // Process the latest move
          const latestMove = moves[moves.length - 1];
          const { player, action, data } = latestMove.move_data;

          // Only process moves from the opponent
          const isPlayer1 = currentMatch.player1_id === currentPlayerId;
          const isPlayer2 = currentMatch.player2_id === currentPlayerId;
          const playerNumber = isPlayer1 ? 1 : isPlayer2 ? 2 : null;
          
          if (player !== playerNumber) {
            console.log(`Processing opponent move:`, latestMove.move_data);
            
            if (action === 'roll_dice') {
              setDice(data.dice);
              setMovesAllowed(data.movesAllowed);
              setHasRolled(true);
              setUsedDice([]);
              setCurrentPlayer(player);
              setSelected(null);
              setLegalMoves([]);
            } else if (action === 'end_turn') {
              setCurrentPlayer(player === 1 ? 2 : 1);
              setHasRolled(false);
              setDice([0, 0]);
              setMovesAllowed([]);
              setUsedDice([]);
              setSelected(null);
              setLegalMoves([]);
            } else if (action === 'move_checker') {
              // Apply the move to the local state
              if (data.toPoint === 'bearoff') {
                // Handle bearing off
                setCheckers(prevCheckers => {
                  return prevCheckers.filter(c => c.id !== data.checkerId);
                });
                setBorneOff(prev => ({
                  ...prev,
                  [player]: prev[player] + 1
                }));
              } else {
                // Handle regular move
                setCheckers(prevCheckers => {
                  const newCheckers = [...prevCheckers];
                  const checkerIndex = newCheckers.findIndex(c => c.id === data.checkerId);
                  if (checkerIndex !== -1) {
                    newCheckers[checkerIndex] = { 
                      ...newCheckers[checkerIndex], 
                      point: data.toPoint,
                      offset: newCheckers.filter(c => c.point === data.toPoint).length
                    };
                  }
                  return newCheckers;
                });
              }
              
              // Update used dice
              if (Array.isArray(data.dieIndex)) {
                setUsedDice(prev => [...prev, ...data.dieIndex]);
              } else {
                setUsedDice(prev => [...prev, data.dieIndex]);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in syncGameMoves:', error);
      }
    };

    const interval = setInterval(syncGameMoves, 1000);
    return () => clearInterval(interval);
  }, [isOnlineGame, currentMatch, firstRollPhase, currentPlayerId]);

  function renderFirstRollModal() {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: 36,
          minWidth: 320,
          boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <h2 style={{ marginBottom: 6, fontSize: 28, letterSpacing: 1 }}>Break the Dice</h2>
          <div style={{ fontSize: 15, color: '#555', marginBottom: 18 }}>
            roll to see who goes first
          </div>
          {/* Frozen dice image placeholder */}
          <div style={{ marginBottom: 12 }}>
            {/* TODO: Add a frozen dice image here! */}
            <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #b3e0ff 60%, #e0f7fa 100%)', borderRadius: 12, display: 'inline-block', opacity: 0.5 }} />
          </div>
          <div style={{ display: 'flex', gap: 32, marginBottom: 18 }}>
            <div style={{ textAlign: 'center' }}>
              {/* Checker icon for Player 1 */}
              <svg width="38" height="38" style={{ display: 'block', margin: '0 auto 4px auto' }}>
                <g filter="url(#mini-checker-shadow)">
                  <circle cx="19" cy="19" r="18" fill="#fff" stroke="#000" strokeWidth="1.5" />
                  <circle cx="19" cy="19" r="13.5" fill="none" stroke="#e5e5e5" strokeWidth="2.5" />
                  <circle cx="19" cy="19" r="9" fill="none" stroke="#e5e5e5" strokeWidth="2" />
                  <circle cx="19" cy="19" r="5" fill="none" stroke="#e5e5e5" strokeWidth="1.5" />
                </g>
                <defs>
                  <filter id="mini-checker-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.18" />
                  </filter>
                </defs>
              </svg>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {isOnlineGame ? `Player 1${currentMatch?.player1_id === currentPlayerId ? ' (You)' : ''}` : 'Player 1'}
              </div>
              {firstRolls[0] ? (
                <Dice 
                  value={firstRolls[0]} 
                  isRolling={isFirstRolling && firstRollTurn === 1}
                  frame={firstRollAnimationFrame}
                />
              ) : (
                isFirstRolling && firstRollTurn === 1 ? (
                  <Dice 
                    value={Math.floor(Math.random() * 6) + 1}
                    isRolling={true}
                    frame={firstRollAnimationFrame}
                  />
                ) : (
                  <div style={{ height: 48 }} />
                )
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              {/* Checker icon for Player 2 */}
              <svg width="38" height="38" style={{ display: 'block', margin: '0 auto 4px auto' }}>
                <g filter="url(#mini-checker-shadow)">
                  <circle cx="19" cy="19" r="18" fill="#111" stroke="#000" strokeWidth="1.5" />
                  <circle cx="19" cy="19" r="13.5" fill="none" stroke="#222" strokeWidth="2.5" />
                  <circle cx="19" cy="19" r="9" fill="none" stroke="#222" strokeWidth="2" />
                  <circle cx="19" cy="19" r="5" fill="none" stroke="#222" strokeWidth="1.5" />
                </g>
                <defs>
                  <filter id="mini-checker-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.18" />
                  </filter>
                </defs>
              </svg>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {isOnlineGame ? `Player 2${currentMatch?.player2_id === currentPlayerId ? ' (You)' : ''}` : (isCpuGame ? 'CPU' : 'Player 2')}
              </div>
              {firstRolls[1] ? (
                <Dice 
                  value={firstRolls[1]} 
                  isRolling={isFirstRolling && firstRollTurn === 2}
                  frame={firstRollAnimationFrame}
                />
              ) : (
                isFirstRolling && firstRollTurn === 2 ? (
                  <Dice 
                    value={Math.floor(Math.random() * 6) + 1}
                    isRolling={true}
                    frame={firstRollAnimationFrame}
                  />
                ) : (
                  <div style={{ height: 48 }} />
                )
              )}
            </div>
          </div>
          {/* Only show the roll button if it's the human player's turn to roll */}
          {(!firstRollResult && !isFirstRolling && (
            (!isCpuGame || (firstRollTurn === 1 && cpuPlayer !== 1) || (firstRollTurn === 2 && cpuPlayer !== 2))
          )) && (
            <button
              style={{ ...buttonStyle, minWidth: 160, marginTop: 8 }}
              onClick={isOnlineGame ? handleOnlineFirstRoll : handleFirstRoll}
            >
              {firstRollTurn === 1 ? 'Player 1: Roll' : (isCpuGame ? 'CPU: Roll' : 'Player 2: Roll')}
            </button>
          )}
          {firstRollResult === 1 && <div style={{ color: '#28a745', fontWeight: 600, fontSize: 20, marginTop: 16 }}>Player 1 goes first!</div>}
          {firstRollResult === 2 && <div style={{ color: '#007bff', fontWeight: 600, fontSize: 20, marginTop: 16 }}>{isCpuGame ? 'CPU goes first!' : 'Player 2 goes first!'}</div>}
          {firstRollResult === 'tie' && <div style={{ color: '#dc3545', fontWeight: 600, fontSize: 20, marginTop: 16 }}>Tie! Roll again.</div>}
        </div>
      </div>
    );
  }

  function renderBoard() {
    let stackCount = Array(24).fill(0);
    const legalFrom = getLegalFromPoints();
    // Precompute triangle polygons and checker <g> elements
    const trianglePolys = [];
    const checkerGs = [];
    const triangleEdgeMargin = 4;
    for (let i = 0; i < 12; i++) {
      let isRightHalf = i < 6;
      let idxTop = 12 + i; // 12-23 (top row)
      let xTop = boardX + triangleW * i;
      if (!isRightHalf) xTop += gap;
      // Add margin to first and last triangle
      let left = i === 0 ? xTop + triangleEdgeMargin : xTop;
      let right = i === 11 ? xTop + triangleW - triangleEdgeMargin : xTop + triangleW;
      const isBrown = (i % 2 === 0);
      const stitchColor = isBrown ? '#ffe4b5' : '#5a341a';
      // Calculate points for stitching (3px in from edge)
      const inset = 4; // Increased gap for clear separation
      const leftX = left + (left < right ? inset : -inset);
      const rightX = right - (right > left ? inset : -inset);
      const topY = boardY + 3 + inset;
      const tipY = boardY + 3 + triangleH - inset;
      trianglePolys.push(
        <g key={`top-${idxTop}`}>
          <polygon
            points={`${left},${boardY + 3} ${right},${boardY + 3} ${xTop + triangleW / 2},${boardY + 3 + triangleH}`}
            fill={isBrown ? '#5a341a' : '#ffe4b5'}
            opacity={selected && selected.point === idxTop ? 0.7 : 1}
            onClick={e => { e.stopPropagation(); handleTriangleClick(idxTop); }}
            style={{ cursor: hasRolled ? 'pointer' : 'default' }}
            data-triangle={idxTop}
          />
          {hasRolled && legalFrom.includes(idxTop) && (
            <circle cx={xTop + triangleW / 2} cy={boardY + 18} r="7" fill="#FF4500" stroke="#222" strokeWidth="2" />
          )}
        </g>
      );
    }
    for (let i = 0; i < 12; i++) {
      let isRightHalf = i < 6;
      let idxBot = 11 - i; // 11-0 (bottom row, left to right)
      let xBot = boardX + triangleW * i;
      if (!isRightHalf) xBot += gap;
      let left = i === 0 ? xBot + triangleEdgeMargin : xBot;
      let right = i === 11 ? xBot + triangleW - triangleEdgeMargin : xBot + triangleW;
      const isBrown = ((i + 1) % 2 === 0);
      const stitchColor = isBrown ? '#ffe4b5' : '#5a341a';
      const inset = 4;
      const leftX = left + (left < right ? inset : -inset);
      const rightX = right - (right > left ? inset : -inset);
      const baseY = boardY + boardH - 3 - inset;
      const tipY = boardY + boardH - 3 - triangleH + inset;
      trianglePolys.push(
        <g key={idxBot}>
          <polygon
            points={`${left},${boardY + boardH - 3} ${right},${boardY + boardH - 3} ${xBot + triangleW / 2},${boardY + boardH - 3 - triangleH}`}
            fill={isBrown ? '#5a341a' : '#ffe4b5'}
            opacity={selected && selected.point === idxBot ? 0.7 : 1}
            onClick={e => { e.stopPropagation(); handleTriangleClick(idxBot); }}
            style={{ cursor: hasRolled ? 'pointer' : 'default' }}
            data-triangle={idxBot}
          />
          {hasRolled && legalFrom.includes(idxBot) && (
            <circle cx={xBot + triangleW / 2} cy={boardY + boardH - 18} r="7" fill="#FF4500" stroke="#222" strokeWidth="2" />
          )}
        </g>
      );
    }
    // Render all checkers on top of triangles, but set pointerEvents to 'none' if a legal move is present for this triangle
    let allCheckers = [];
    let stackCountAll = Array(24).fill(0);
    for (let idx = 0; idx < 24; idx++) {
      const triangleCheckers = checkers.filter(c => c.point === idx);
      const triangleIsLegal = legalMoves.some(m => Number(typeof m === 'string' && m.includes('|') ? m.split('|')[0] : m) === idx);
      const stackLen = triangleCheckers.length;
      // Overlap logic: if 5 or more, overlap so stack never exceeds triangle height
      let maxStackHeight = triangleH - 8; // 8px padding from tip
      let baseSpacing = checkerSize + 2;
      let spacing = baseSpacing;
      if (stackLen > 1) {
        let totalHeight = (stackLen - 1) * baseSpacing + checkerSize;
        if (totalHeight > maxStackHeight) {
          spacing = (maxStackHeight - checkerSize) / (stackLen - 1);
        }
      }
      for (let j = 0; j < triangleCheckers.length; j++) {
        const c = triangleCheckers[j];
        const isBottom = c.point < 12;
        const i2 = isBottom ? 11 - c.point : c.point - 12;
        const isRightHalf2 = i2 < 6;
        let x = boardX + triangleW * i2 + triangleW / 2;
        if (!isRightHalf2) x += gap;
        // Move checkers slightly away from the board border (4px offset)
        let borderOffset = 4;
        let baseY = isBottom
          ? boardY + boardH - checkerSize / 2 - borderOffset
          : boardY + checkerSize / 2 + borderOffset;
        let y = baseY + (isBottom ? -1 : 1) * stackCountAll[c.point] * spacing;
        stackCountAll[c.point]++;
        // Only highlight the top checker in the stack if it matches selected
        const topChecker = triangleCheckers.reduce((a, b) => a.offset > b.offset ? a : b);
        const isTopAndSelected = selected && c.id === selected.id && c.id === topChecker.id;
        allCheckers.push(
          <Checker
            key={`${idx}-${j}`}
            checker={c}
            x={x}
            y={y}
            isSelected={selected === c}
            onClick={e => { e.stopPropagation(); handleCheckerClick(c); }}
            dataTriangle={idx}
          />
        );

      }
    }
    // Bearing off rectangles (sidebar)
    const bearOffRects = [];
    const bearOffGap = 20;
    const bearOffRectH = (boardH - bearOffGap) / 2;
    const bearOffRectW = bearOffW - 10;
    const bearOffX = boardX + triangleW * 12 + gap + 5;
    // Player 1 (top)
    const canBearOff1 = (legalMoves.includes('bearoff') || legalMoves.some(m => typeof m === 'string' && m.startsWith('bearoff|sum'))) && currentPlayer === 1;
    let bearoffSumMove1 = legalMoves.find(m => typeof m === 'string' && m.startsWith('bearoff|sum'));
    // Player 1 bearing off rectangle
    bearOffRects.push(
      <rect
        key={`bearoff-p1-main`}
        x={bearOffX}
        y={boardY + 5}
        width={bearOffRectW}
        height={bearOffRectH - 70}
        fill={canBearOff1 ? '#a0522d' : '#ffe4b5'}
        stroke="#b87333"
        strokeWidth={canBearOff1 ? 6 : 3}
        rx={8}
        filter={canBearOff1 ? 'url(#checker-glow)' : undefined}
        style={{ cursor: canBearOff1 ? 'pointer' : 'default' }}
        onClick={canBearOff1 ? (e => { e.stopPropagation(); handlePointClick(bearoffSumMove1 || 'bearoff'); }) : undefined}
        data-bearoff="true"
      />
    );
    // Player 2 (bottom)
    const canBearOff2 = (legalMoves.includes('bearoff') || legalMoves.some(m => typeof m === 'string' && m.startsWith('bearoff|sum'))) && currentPlayer === 2;
    let bearoffSumMove2 = legalMoves.find(m => typeof m === 'string' && m.startsWith('bearoff|sum'));
    bearOffRects.push(
      <rect
        key={`bearoff-p2-main`}
        x={bearOffX}
        y={boardY + bearOffRectH + bearOffGap + 65}
        width={bearOffRectW}
        height={bearOffRectH - 70}
        fill={canBearOff2 ? '#a0522d' : '#ffe4b5'}
        stroke="#b87333"
        strokeWidth={canBearOff2 ? 6 : 3}
        rx={8}
        filter={canBearOff2 ? 'url(#checker-glow)' : undefined}
        style={{ cursor: canBearOff2 ? 'pointer' : 'default' }}
        onClick={canBearOff2 ? (e => { e.stopPropagation(); handlePointClick(bearoffSumMove2 || 'bearoff'); }) : undefined}
        data-bearoff="true"
      />
    );
    // Borne-off checker stack representation
    const checkerRectH = 8;
    const checkerRectW = bearOffRectW - 8;
    const checkerSpacing = 2;
    
    // Player 1 (top) - show as stacked checkers in pocket
    let borneOffRects1 = [];
    const p1StackStartY = boardY + 5 + bearOffRectH - 76 - checkerRectH;
    if (borneOff[1] > 0) {
      // Show all checkers in the pocket
      for (let i = 0; i < borneOff[1]; i++) {
        const player = 1;
        const cx = bearOffX + 4 + checkerRectW / 2;
        const cy = p1StackStartY - i * (checkerRectH + checkerSpacing) + checkerRectH / 2;
                 borneOffRects1.push(
           <rect
             key={`bo1-${i}`}
             x={cx - checkerRectW / 2}
             y={cy - checkerRectH / 2}
             width={checkerRectW}
             height={checkerRectH}
             rx={checkerRectH / 2}
             fill={player === 1 ? '#fff' : '#111'}
             stroke="#000"
             strokeWidth={1}
             opacity={0.9} // Consistent opacity for all checkers in stack
           />
         );
      }
    }
    
    // Player 2 (bottom) - show as stacked checkers in pocket
    let borneOffRects2 = [];
    const p2StackStartY = boardY + bearOffRectH + bearOffGap + 5 + bearOffRectH - 16 - checkerRectH;
    if (borneOff[2] > 0) {
      // Show all checkers in the pocket
      for (let i = 0; i < borneOff[2]; i++) {
        const player = 2;
        const cx = bearOffX + 4 + checkerRectW / 2;
        const cy = p2StackStartY - i * (checkerRectH + checkerSpacing) + checkerRectH / 2;
                 borneOffRects2.push(
           <rect
             key={`bo2-${i}`}
             x={cx - checkerRectW / 2}
             y={cy - checkerRectH / 2}
             width={checkerRectW}
             height={checkerRectH}
             rx={checkerRectH / 2}
             fill={player === 1 ? '#fff' : '#111'}
             stroke="#000"
             strokeWidth={1}
             opacity={0.9} // Consistent opacity for all checkers in stack
           />
         );
      }
    }
    // Draw a slot/pocket for borne-off checkers (Player 1 - top)
    const slotColor = '#e0cfa0'; // slightly lighter beige for visibility
    const slotStroke = '#b87333';
    const slotH = 15 * checkerRectH + 14 * checkerSpacing; // 15 checkers + 14 gaps
    const slotY1 = p1StackStartY - (14 * (checkerRectH + checkerSpacing));
    bearOffRects.push(
      <rect
        key="bo-slot-1"
        x={bearOffX + 4}
        y={slotY1}
        width={checkerRectW}
        height={slotH}
        rx={5}
        fill={slotColor}
        stroke={slotStroke}
        strokeWidth={1.5}
        style={{ opacity: 0.7 }}
      />
    );
    // Player 2 (bottom)
    const slotY2 = p2StackStartY - (14 * (checkerRectH + checkerSpacing));
    bearOffRects.push(
      <rect
        key="bo-slot-2"
        x={bearOffX + 4}
        y={slotY2}
        width={checkerRectW}
        height={slotH}
        rx={5}
        fill={slotColor}
        stroke={slotStroke}
        strokeWidth={1.5}
        style={{ opacity: 0.7 }}
      />
    );
    // Overlay a transparent clickable rect for bearing off (Player 1 - top)
    if (canBearOff1) {
      bearOffRects.push(
        <rect
          key="bo-pocket-click-1"
          x={bearOffX + 4}
          y={slotY1}
          width={checkerRectW}
          height={slotH}
          rx={5}
          fill="transparent"
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          onClick={e => { e.stopPropagation(); handlePointClick(bearoffSumMove1 || 'bearoff'); }}
          data-bearoff="true"
        />
      );
    }
    // Overlay a transparent clickable rect for bearing off (Player 2 - bottom)
    if (canBearOff2) {
      bearOffRects.push(
        <rect
          key="bo-pocket-click-2"
          x={bearOffX + 4}
          y={slotY2}
          width={checkerRectW}
          height={slotH}
          rx={5}
          fill="transparent"
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          onClick={e => { e.stopPropagation(); handlePointClick(bearoffSumMove2 || 'bearoff'); }}
          data-bearoff="true"
        />
      );
    }
    return (
      <svg ref={svgRef} width={boardX * 2 + boardW} height={boardY * 2 + boardH} style={{ background: '#5c3317', border: '2px solid #3e2410', margin: 10, position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
        <defs>
          <radialGradient id="checker-white" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="80%" stopColor="#e0e0e0" stopOpacity="1" />
            <stop offset="100%" stopColor="#bbb" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="checker-black" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#888" stopOpacity="1" />
            <stop offset="80%" stopColor="#222" stopOpacity="1" />
            <stop offset="100%" stopColor="#000" stopOpacity="1" />
          </radialGradient>
          {/* Neon yellow glow filter for selected checker */}
          <filter id="checker-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#FFD700" floodOpacity="1.5" />
          </filter>
          <pattern id="wood-grain" patternUnits="userSpaceOnUse" width="80" height="80">
            <rect width="80" height="80" fill="#3e2410" />
            <path d="M0,40 Q20,44 40,38 T80,40" stroke="#4a2a12" strokeWidth="3.5" fill="none" opacity="0.32" />
            <path d="M0,60 Q25,66 50,58 T80,60" stroke="#5d2e13" strokeWidth="2.7" fill="none" opacity="0.22" />
            <path d="M0,20 Q18,24 40,18 T80,20" stroke="#2d180a" strokeWidth="2.2" fill="none" opacity="0.18" />
            <path d="M0,70 Q30,76 60,68 T80,70" stroke="#6e3c1a" strokeWidth="2.2" fill="none" opacity="0.19" />
            <path d="M10,10 Q20,20 30,10 Q40,0 50,10" stroke="#5a341a" strokeWidth="1.8" fill="none" opacity="0.18" />
            <path d="M20,30 Q30,36 40,32 Q50,28 60,34" stroke="#7a4a2a" strokeWidth="1.2" fill="none" opacity="0.13" />
            <ellipse cx="36" cy="18" rx="7" ry="2.5" fill="none" stroke="#2d180a" strokeWidth="2.2" opacity="0.18" />
            <ellipse cx="15" cy="65" rx="4" ry="1.5" fill="none" stroke="#5d2e13" strokeWidth="1.8" opacity="0.16" />
            <ellipse cx="60" cy="60" rx="5" ry="2" fill="none" stroke="#4a2a12" strokeWidth="1.5" opacity="0.13" />
            <ellipse cx="55" cy="25" rx="3.5" ry="1.2" fill="none" stroke="#7a4a2a" strokeWidth="1.1" opacity="0.11" />
          </pattern>
          <radialGradient id="checker-gradient-1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="70%" stopColor="#e0e0e0" stopOpacity="1" />
            <stop offset="100%" stopColor="#bbb" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="checker-gradient-2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#444" stopOpacity="1" />
            <stop offset="70%" stopColor="#222" stopOpacity="1" />
            <stop offset="100%" stopColor="#111" stopOpacity="1" />
          </radialGradient>
          <filter id="checker-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>
        {/* No triangle pulse, just glow */}
        <style>{`
          @keyframes triangle-pulse-fill {
            0% { fill: rgba(255,69,0,0.08); }
            50% { fill: rgba(255,69,0,0.38); }
            100% { fill: rgba(255,69,0,0.08); }
          }
          .triangle-pulse {
            animation: triangle-pulse-fill 1.4s infinite;
          }

        `}</style>

        {/* Board background: two-tone brown */}
        <rect x={0} y={0} width={boardX * 2 + boardW} height={boardY * 2 + boardH} rx={14} fill="url(#wood-grain)" />
        {/* Main board frame: remove wood grain, restore solid color */}
        <rect x={boardX} y={boardY} width={boardW} height={boardH} fill="#3e2410" />
        <rect x={boardX + 3} y={boardY + 3} width={boardW - 6 - bearOffW} height={boardH - 6} fill="#8b5c2a" pointerEvents="none" />
        {/* Center bar: two-tone brown */}
        <rect x={boardX + triangleW * 6} y={boardY + 3} width={gap} height={boardH - 6} fill="#3e2410" />
        {/* Triangles */}
        {trianglePolys}
        {/* Highlight legal moves (fix for doubles: parse dest|steps) - now rendered after checkers so always on top */}
        {legalMoves.map((move, idx) => {
          // Only render highlights for numeric moves (triangle indices)
          if (typeof move === 'string' && (move === 'bearoff' || move.includes('bearoff'))) return null;
          let point, steps;
          if (typeof move === 'string' && move.includes('|')) {
            [point, steps] = move.split('|');
            point = parseInt(point, 10);
          } else {
            point = move;
          }
          const isBottom = point < 12;
          const i = isBottom ? 11 - point : point - 12;
          const isRightHalf = i < 6;
          let x0 = boardX + triangleW * i;
          if (!isRightHalf) x0 += gap;
          let x1 = x0 + triangleW;
          let xMid = x0 + triangleW / 2;
          let yBase = isBottom ? boardY + boardH - 5 : boardY + 5;
          let yTip = isBottom ? yBase - triangleH : yBase + triangleH;
          return (
            <g key={idx} style={{ pointerEvents: 'none' }}>
              {/* Glowing left side, exactly like checker glow */}
              <line
                x1={x0}
                y1={yBase}
                x2={xMid}
                y2={yTip}
                stroke="#FFD700"
                strokeWidth={4}
                filter="url(#checker-glow)"
                opacity={1}
              />
              {/* Glowing right side, exactly like checker glow */}
              <line
                x1={x1}
                y1={yBase}
                x2={xMid}
                y2={yTip}
                stroke="#FFD700"
                strokeWidth={4}
                filter="url(#checker-glow)"
                opacity={1}
              />
            </g>
          );
        })}
        {/* Checkers on top of triangles */}
        {allCheckers}
        {/* Bar checkers */}
        {/* Center checkers horizontally on the bar; Player 1 stacks upward, Player 2 stacks downward from center */}
        {bar[1].map((c, i) => {
          // Player 1: center horizontally, stack upward from center
          let x = boardX + triangleW * 6 + gap / 2;
          let y = boardY + boardH / 2 - (i + 0.5) * (checkerSize + 4);
          return (
            <Checker
              key={`bar-1-${i}`}
              checker={c}
              x={x}
              y={y}
              isSelected={selected === c}
              onClick={() => handleBarCheckerClick(c)}
              dataTriangle="bar"
            />
          );
        })}
        {bar[2].map((c, i) => {
          // Player 2: center horizontally, stack downward from center
          let x = boardX + triangleW * 6 + gap / 2;
          let y = boardY + boardH / 2 + (i + 0.5) * (checkerSize + 4);
          return (
            <Checker
              key={`bar-2-${i}`}
              checker={c}
              x={x}
              y={y}
              isSelected={selected === c}
              onClick={() => handleBarCheckerClick(c)}
              dataTriangle="bar"
            />
          );
        })}
        {/* Bearing off rectangles */}
        {bearOffRects}
        {/* Borne-off checker rectangles (sideways checkers) */}
        {borneOffRects1}
        {borneOffRects2}
        
        {/* Doubling Cube */}
        {gameStakes > 1 && (
          <g>
            <rect
              x={bearOffX + bearOffRectW / 2 - 24}
              y={boardY + bearOffRectH + bearOffGap / 2 - 24}
              width={48}
              height={48}
              fill="#dc3545"
              stroke="#fff"
              strokeWidth={2}
              rx={6}
            />
            <text
              x={bearOffX + bearOffRectW / 2}
              y={boardY + bearOffRectH + bearOffGap / 2 + 8}
              textAnchor="middle"
              fill="#fff"
              fontSize="24"
              fontWeight="bold"
            >
              {gameStakes}
            </text>
          </g>
        )}
                      {/* Borne-off counts (now as Pips, styled, showing actual pip count) */}
              <g>
                <text 
                  x={bearOffX + bearOffRectW / 2} 
                  y={boardY + bearOffRectH / 2 - 115} 
                  textAnchor="middle" 
                  fill="#5c3317" 
                  fontSize="13" 
                  fontWeight="bold" 
                  style={{ letterSpacing: 1, cursor: canBearOff1 ? 'pointer' : 'default' }}
                  onClick={canBearOff1 ? (e => { e.stopPropagation(); handlePointClick(bearoffSumMove1 || 'bearoff'); }) : undefined}
                >Pips</text>
                <text 
                  x={bearOffX + bearOffRectW / 2} 
                  y={boardY + bearOffRectH / 2 - 85} 
                  textAnchor="middle" 
                  fill="#5c3317" 
                  fontSize="26" 
                  fontWeight="bold"
                  style={{ cursor: canBearOff1 ? 'pointer' : 'default' }}
                  onClick={canBearOff1 ? (e => { e.stopPropagation(); handlePointClick(bearoffSumMove1 || 'bearoff'); }) : undefined}
                >{pipCount(checkers, 1, bar, borneOff)}</text>
              </g>
                      <g>
                <text 
                  x={bearOffX + bearOffRectW / 2} 
                  y={boardY + bearOffRectH + bearOffGap + bearOffRectH / 2 - 55} 
                  textAnchor="middle" 
                  fill="#5c3317" 
                  fontSize="13" 
                  fontWeight="bold" 
                  style={{ letterSpacing: 1, cursor: canBearOff2 ? 'pointer' : 'default' }}
                  onClick={canBearOff2 ? (e => { e.stopPropagation(); handlePointClick(bearoffSumMove2 || 'bearoff'); }) : undefined}
                >Pips</text>
                <text 
                  x={bearOffX + bearOffRectW / 2} 
                  y={boardY + bearOffRectH + bearOffGap + bearOffRectH / 2 - 25} 
                  textAnchor="middle" 
                  fill="#5c3317" 
                  fontSize="26" 
                  fontWeight="bold"
                  style={{ cursor: canBearOff2 ? 'pointer' : 'default' }}
                  onClick={canBearOff2 ? (e => { e.stopPropagation(); handlePointClick(bearoffSumMove2 || 'bearoff'); }) : undefined}
                >{pipCount(checkers, 2, bar, borneOff)}</text>
              </g>
        {/* Double button overlay: left side of board */}
        {!hasRolled && !awaitingEndTurn && !isRolling && !autoRoll[currentPlayer] && canDouble[currentPlayer] && (
          !isCpuGame || currentPlayer !== cpuPlayer
        ) && (
          <foreignObject
            x={boardX + triangleW * 2}
            y={boardY + boardH / 2 - 40}
            width={120}
            height={120}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'auto', background: 'none', borderRadius: 0, boxShadow: 'none', padding: 0, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#ff6b35',
                  marginBottom: 6,
                  letterSpacing: 1,
                }}
              >
                <span style={{ color: '#ff6b35' }}>⚡</span>
                <span style={{ color: '#ff6b35', marginLeft: 4 }}>2×</span>
              </div>
              <button 
                style={{ 
                  ...buttonStyle, 
                  minWidth: 0, 
                  width: 110, 
                  fontSize: 22, 
                  padding: '14px 0', 
                  margin: 0,
                  background: '#ff6b35',
                  color: '#fff'
                }} 
                onClick={offerDouble}
              >
                Double
              </button>
            </div>
          </foreignObject>
        )}
        
        {/* Dice and button overlay: center of right half of board */}
        <foreignObject
          x={boardX + triangleW * 6.875}
          y={boardY + boardH / 2 - 40}
          width={320}
          height={120}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'auto', background: 'none', borderRadius: 0, boxShadow: 'none', padding: 0, minWidth: 0 }}>
            {/* TIMER: Show timer above dice/buttons, always visible during turn */}
            {!gameOver && screen === 'passplay' && !firstRollPhase && (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: timer <= 5 ? '#dc3545' : '#fff',
                  marginBottom: 6,
                  letterSpacing: 1,
                  textShadow: timer <= 5 ? '0 0 8px #fff, 0 0 16px #fff' : 'none',
                }}
              >
                <span style={{ color: '#fff', marginRight: 4, textShadow: 'none' }}>⏰</span>
                <span style={timer <= 5 ? { color: '#dc3545', textShadow: '0 0 8px #fff, 0 0 16px #fff' } : { color: '#fff', textShadow: 'none' }}>{timer}</span>
                <span style={timer <= 5 ? { color: '#dc3545' } : { color: '#fff' }}>s</span>
              </div>
            )}
            {/* DICE EMOJI: Show dice emoji above roll dice button in CPU mode (only before rolling) */}
            {!gameOver && isCpuGame && !firstRollPhase && !hasRolled && !isRolling && currentPlayer !== cpuPlayer && (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 6,
                  letterSpacing: 1,
                }}
              >
                <span style={{ color: '#fff' }}>🎲</span>
              </div>
            )}
            {/* Show Roll Dice and Double buttons before rolling */}
            {(!hasRolled && !awaitingEndTurn && !isRolling && (
              !isCpuGame || currentPlayer !== cpuPlayer
            )) ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...buttonStyle, minWidth: 0, width: 110, fontSize: 22, padding: '14px 0', margin: 0 }} onClick={rollDice}>Roll Dice</button>
              </div>
            ) : null}
            {/* After rolling, show dice (doubles: 4 dice, else 2 dice) */}
            {(hasRolled || isRolling) && !showEndTurn && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 0 4px 0', gap: 7 }}>
                {isRolling ? (
                  // Show rolling dice during animation
                  [0, 1].map(i => (
                    <Dice
                      key={i}
                      value={rollingDice[i]}
                      faded={false}
                      shrunk={false}
                      isRolling={true}
                      frame={animationFrame}
                    />
                  ))
                ) : (
                  // Show final dice after roll
                  (dice[0] === dice[1] && dice[0] !== 0)
                    ? [0, 1, 2, 3].map(i => (
                        <Dice
                          key={i}
                          value={dice[0]}
                          faded={usedDice.includes(i)}
                          shrunk={usedDice.includes(i)}
                        />
                      ))
                    : [0, 1].map(i => (
                        <Dice
                          key={i}
                          value={dice[i]}
                          faded={usedDice.includes(i)}
                          shrunk={usedDice.includes(i)}
                        />
                      ))
                )}
              </div>
            )}
            {/* When all moves are spent, show End Turn button in same spot */}
            {showEndTurn && (
              !isCpuGame || currentPlayer !== cpuPlayer
            ) && (
              <button style={{ ...buttonStyle, minWidth: 0, width: 110, fontSize: 22, padding: '14px 0', margin: 0, background: '#007bff', color: '#fff' }} onClick={handleEndTurn}>End Turn</button>
            )}
          </div>
        </foreignObject>
      </svg>
    );
  }

  const renderPassPlay = () => (
    <div style={{ textAlign: 'center', marginTop: 30 }}>
      <TopGammonTextLogo />
      <h2>Pass and Play Backgammon</h2>
      {/* Removed legacy pip count display here */}
      {message && <div style={{ color: 'red', margin: 10 }}>{message}</div>}
      {renderBoard()}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, margin: '16px 0 0 0' }}>
        <div style={{ fontSize: 20, minWidth: 180, textAlign: 'right' }}>
          <b>Current Move:</b> Player {currentPlayer}
          <span style={{
            display: 'inline-block',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: currentPlayer === 1 ? '#fff' : '#222',
            marginLeft: 10,
            verticalAlign: 'middle',
            border: '2px solid #b87333',
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Undo button: show after any move, including bearing off */}
            {undoStack.length > 0 && hasRolled && (
              <button style={{ ...buttonStyle, background: '#ffc107', color: '#222' }} onClick={handleUndo}>Undo</button>
            )}
            {/* Resign button: always show */}
            <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff' }} onClick={confirmResign}>Resign</button>
          </div>
          {/* TEMP: Endgame test button below Resign - HIDDEN FROM USERS */}
          {/* <button style={{ ...buttonStyle, background: '#ff9800', color: '#fff', marginBottom: 0 }} onClick={setEndgameState}>Set Endgame State (TEST)</button> */}
          {/* {endgameTestActive && (
            <div style={{ fontSize: 14, color: '#666', marginTop: 4, textAlign: 'center' }}>Endgame test state: Both players ready to bear off.</div>
          )} */}
        </div>
      </div>
      {/* Auto-roll toggle controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32, margin: '16px 0 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Player 1 Auto-roll:</span>
          <button 
            style={{ 
              ...buttonStyle, 
              minWidth: 60, 
              padding: '8px 12px', 
              fontSize: 14,
              background: autoRoll[1] ? '#28a745' : '#6c757d',
              color: '#fff'
            }} 
            onClick={() => setAutoRoll(prev => ({ ...prev, 1: !prev[1] }))}
          >
            {autoRoll[1] ? 'ON' : 'OFF'}
          </button>
        </div>
        {/* Only show Player 2 toggle in pass-and-play mode */}
        {!isCpuGame && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Player 2 Auto-roll:</span>
            <button 
              style={{ 
                ...buttonStyle, 
                minWidth: 60, 
                padding: '8px 12px', 
                fontSize: 14,
                background: autoRoll[2] ? '#28a745' : '#6c757d',
                color: '#fff'
              }} 
              onClick={() => setAutoRoll(prev => ({ ...prev, 2: !prev[2] }))}
            >
              {autoRoll[2] ? 'ON' : 'OFF'}
            </button>
          </div>
        )}
      </div>
      {noMoveOverlay && usedDice.length < movesAllowed.length && !gameOver && (
        <div style={{
          position: 'absolute',
          top: '54.5%',
          left: 'calc(50% - 373px)', // 2 pixels to the right
          transform: 'translateY(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            border: '2px solid #28a745',
            borderRadius: 12,
            padding: 32,
            minWidth: 220,
            maxWidth: 340,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 'bold',
            color: '#222',
            boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          }}>
            <div style={{ marginBottom: 16 }}>{noMoveOverlay === 'noMore' ? 'No More Moves' : 'No Moves :('}</div>
            {noMoveOverlay === 'noMore' ? (
              (!isCpuGame || currentPlayer !== cpuPlayer) && (
                <button style={{ ...buttonStyle, minWidth: 0, width: 110, fontSize: 22, padding: '14px 0', margin: '12px 0 0 0', background: '#007bff', color: '#fff' }} onClick={handleEndTurn}>End Turn</button>
              )
            ) : noMoveOverlay === true ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {lastNoMoveDice && (
                  <>
                    {dice.map((d, i) => (
                      <Dice
                        key={i}
                        value={d}
                        faded={usedDice.includes(i)}
                        shrunk={usedDice.includes(i)}
                      />
                    ))}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
      {firstRollPhase && renderFirstRollModal()}
      {/* Double Offer Overlay */}
      {doubleOffer && (
        <div style={{
          position: 'absolute',
          top: '54.5%',
          left: 'calc(50% - 373px)',
          transform: 'translateY(-50%)',
          zIndex: 20,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)',
            border: '2px solid #ff6b35',
            borderRadius: 12,
            padding: 32,
            minWidth: 280,
            maxWidth: 400,
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 'bold',
            color: '#222',
            boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          }}>
            <div style={{ marginBottom: 16, fontSize: 24, color: '#ff6b35' }}>
              🎲 Double Offered! 🎲
            </div>
            <div style={{ marginBottom: 8 }}>
              Player {doubleOffer.from} offers to double the stakes
            </div>
            <div style={{ marginBottom: 16, fontSize: 18, color: '#666' }}>
              Current stakes: {gameStakes} | New stakes: {gameStakes * 2}
            </div>
            <div style={{ marginBottom: 16, fontSize: 16, color: '#dc3545', fontWeight: 'bold' }}>
              ⏰ {doubleTimer} seconds to decide
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                style={{ 
                  ...buttonStyle, 
                  minWidth: 100, 
                  padding: '12px 20px', 
                  fontSize: 18,
                  background: '#28a745',
                  color: '#fff'
                }} 
                onClick={() => handleDoubleResponse(true)}
              >
                Accept
              </button>
              <button 
                style={{ 
                  ...buttonStyle, 
                  minWidth: 100, 
                  padding: '12px 20px', 
                  fontSize: 18,
                  background: '#dc3545',
                  color: '#fff'
                }} 
                onClick={() => handleDoubleResponse(false)}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Resign Overlay */}
      {showConfirmResign && (
        <div style={{
          position: 'absolute',
          top: '54.5%',
          left: 'calc(50% - 373px)',
          transform: 'translateY(-50%)',
          zIndex: 20,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)',
            border: '2px solid #dc3545',
            borderRadius: 12,
            padding: 32,
            minWidth: 260,
            maxWidth: 340,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 'bold',
            color: '#222',
            boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          }}>
            <div style={{ marginBottom: 18 }}>Are you sure you want to resign?</div>
            <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
              <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff', minWidth: 0, width: 90, fontSize: 20 }} onClick={doResign}>Yes</button>
              <button style={{ ...buttonStyle, background: '#bbb', color: '#222', minWidth: 0, width: 90, fontSize: 20 }} onClick={cancelResign}>No</button>
            </div>
          </div>
        </div>
      )}
      {/* Game Over Overlay */}
      {gameOver && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.08)',
          zIndex: 1000,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.98)',
            border: '2px solid #28a745',
            borderRadius: 12,
            padding: 36,
            minWidth: 300,
            maxWidth: 340,
            textAlign: 'center',
            fontSize: 26,
            fontWeight: 'bold',
            color: '#222',
            boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          }}>
            <div style={{ marginBottom: 22 }}>{getGameOverMessage(gameOver)}</div>
            <div style={{ display: 'flex', gap: 22, marginTop: 8 }}>
              <button className="rematch-btn" style={{ ...buttonStyle, background: '#28a745', color: '#fff', fontSize: 22 }} onClick={handleRematch}>Rematch</button>
              <button style={{ ...buttonStyle, background: '#bbb', color: '#222', minWidth: 0, width: 110, fontSize: 22 }} onClick={handleQuit}>Quit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCpuGame = () => (
    <div style={{ textAlign: 'center', marginTop: 30 }}>
      <TopGammonTextLogo />
      <h2>Play vs CPU</h2>
      {message && <div style={{ color: 'red', margin: 10 }}>{message}</div>}
      {renderBoard()}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, margin: '16px 0 0 0' }}>
        <div style={{ fontSize: 20, minWidth: 180, textAlign: 'right' }}>
          <b>Current Move:</b> {currentPlayer === cpuPlayer ? 'CPU' : 'You'}
          <span style={{
            display: 'inline-block',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: currentPlayer === 1 ? '#fff' : '#222',
            marginLeft: 10,
            verticalAlign: 'middle',
            border: '2px solid #b87333',
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Undo button: show after any move, including bearing off */}
            {undoStack.length > 0 && hasRolled && currentPlayer !== cpuPlayer && (
              <button style={{ ...buttonStyle, background: '#ffc107', color: '#222' }} onClick={handleUndo}>Undo</button>
            )}
            {/* Resign button: always show */}
            <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff' }} onClick={confirmResign}>Resign</button>
          </div>
          {/* CPU difficulty display */}
          <div style={{ fontSize: 14, color: '#666', marginTop: 8 }}>
            CPU Difficulty: <strong>{DIFFICULTY_LEVELS[cpuDifficulty].name}</strong>
          </div>
          {/* Move accuracy display */}
          {isCpuGame && (
            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
              Your Accuracy: <strong>{(averageAccuracy[1] * 100).toFixed(1)}%</strong>
            </div>
          )}
          {/* Player 1 Auto-roll toggle for CPU mode */}
          {currentPlayer !== cpuPlayer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Auto-roll:</span>
              <button 
                style={{ 
                  ...buttonStyle, 
                  minWidth: 50, 
                  padding: '6px 10px', 
                  fontSize: 12,
                  background: autoRoll[1] ? '#28a745' : '#6c757d',
                  color: '#fff'
                }} 
                onClick={() => setAutoRoll(prev => ({ ...prev, 1: !prev[1] }))}
              >
                {autoRoll[1] ? 'ON' : 'OFF'}
              </button>
            </div>
          )}
        </div>
      </div>
      {/* First Roll Modal */}
      {firstRollPhase && (
        renderFirstRollModal()
      )}

      {/* All the overlays from renderPassPlay */}
      {noMoveOverlay && usedDice.length < movesAllowed.length && !gameOver && (
        <div style={{
          position: 'absolute',
          top: '54.5%',
          left: 'calc(50% - 373px)',
          transform: 'translateY(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            border: '2px solid #28a745',
            borderRadius: 12,
            padding: 32,
            minWidth: 220,
            maxWidth: 340,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 'bold',
            color: '#222',
            boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          }}>
            <div style={{ marginBottom: 18 }}>
              {noMoveOverlay === 'noMore' 
                ? `No more moves available.\nUsed ${usedDice.length} of ${movesAllowed.length} dice.`
                : `No legal moves available.\nDice: ${lastNoMoveDice?.join(', ')}`
              }
            </div>
            {(!isCpuGame || currentPlayer !== cpuPlayer) && (
              <button 
                style={{ 
                  ...buttonStyle, 
                  minWidth: 100, 
                  padding: '12px 20px', 
                  fontSize: 18,
                  background: '#28a745',
                  color: '#fff'
                }} 
                onClick={handleEndTurn}
              >
                End Turn
              </button>
            )}
          </div>
        </div>
      )}
      {/* Double offer overlay */}
      {doubleOffer && doubleOffer.to === (cpuPlayer === 1 ? 2 : 1) && (
        <div style={{
          position: 'absolute',
          top: '54.5%',
          left: 'calc(50% - 373px)',
          transform: 'translateY(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            border: '2px solid #ff6b35',
            borderRadius: 12,
            padding: 32,
            minWidth: 220,
            maxWidth: 340,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 'bold',
            color: '#222',
            boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          }}>
            <div style={{ marginBottom: 18 }}>
              CPU offers to double the stakes!\nTimer: {doubleTimer}s
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
              <button 
                style={{ 
                  ...buttonStyle, 
                  minWidth: 100, 
                  padding: '12px 20px', 
                  fontSize: 18,
                  background: '#28a745',
                  color: '#fff'
                }} 
                onClick={() => handleDoubleResponse(true)}
              >
                Accept
              </button>
              <button 
                style={{ 
                  ...buttonStyle, 
                  minWidth: 100, 
                  padding: '12px 20px', 
                  fontSize: 18,
                  background: '#dc3545',
                  color: '#fff'
                }} 
                onClick={() => handleDoubleResponse(false)}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Resign Overlay */}
      {showConfirmResign && (
        <div style={{
          position: 'absolute',
          top: '54.5%',
          left: 'calc(50% - 373px)',
          transform: 'translateY(-50%)',
          zIndex: 20,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)',
            border: '2px solid #dc3545',
            borderRadius: 12,
            padding: 32,
            minWidth: 260,
            maxWidth: 340,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 'bold',
            color: '#222',
            boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          }}>
            <div style={{ marginBottom: 18 }}>Are you sure you want to resign?</div>
            <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
              <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff', minWidth: 0, width: 90, fontSize: 20 }} onClick={doResign}>Yes</button>
              <button style={{ ...buttonStyle, background: '#bbb', color: '#222', minWidth: 0, width: 90, fontSize: 20 }} onClick={cancelResign}>No</button>
            </div>
          </div>
        </div>
      )}
      {/* Game Over Overlay */}
      {gameOver && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.08)',
          zIndex: 1000,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.98)',
            border: '2px solid #28a745',
            borderRadius: 12,
            padding: 36,
            minWidth: 300,
            maxWidth: 340,
            textAlign: 'center',
            fontSize: 26,
            fontWeight: 'bold',
            color: '#222',
            boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            wordBreak: 'break-word',
            whiteSpace: 'pre-line',
          }}>
            <div style={{ marginBottom: 22 }}>{getGameOverMessage(gameOver)}</div>
            <div style={{ display: 'flex', gap: 22, marginTop: 8 }}>
              <button className="rematch-btn" style={{ ...buttonStyle, background: '#28a745', color: '#fff', fontSize: 22 }} onClick={handleRematch}>Rematch</button>
              <button style={{ ...buttonStyle, background: '#bbb', color: '#222', minWidth: 0, width: 110, fontSize: 22 }} onClick={handleQuit}>Quit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCpuDifficultySelection = () => (
    <div style={{ textAlign: 'center', marginTop: 30 }}>
      <TopGammonTextLogo />
      <h2>Select CPU Difficulty</h2>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(DIFFICULTY_LEVELS).map(([level, info]) => (
            <button
              key={level}
              style={{
                ...buttonStyle,
                background: cpuDifficulty === parseInt(level) ? '#28a745' : '#f8f9fa',
                color: cpuDifficulty === parseInt(level) ? '#fff' : '#333',
                border: cpuDifficulty === parseInt(level) ? '2px solid #28a745' : '2px solid #ddd',
                textAlign: 'left',
                padding: '20px',
                fontSize: '18px',
                fontWeight: 'bold',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '8px'
              }}
              onClick={() => setCpuDifficulty(parseInt(level))}
            >
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                Level {level}: {info.name}
              </div>
              <div style={{ fontSize: '14px', color: cpuDifficulty === parseInt(level) ? '#fff' : '#666', fontWeight: 'normal' }}>
                {info.description}
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: '32px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            style={{ ...buttonStyle, background: '#6c757d', color: '#fff' }}
            onClick={() => setScreen('home')}
          >
            Back to Home
          </button>
          <button
            style={{ ...buttonStyle, background: '#28a745', color: '#fff' }}
            onClick={() => {
              setIsCpuGame(true);
              setCpuPlayer(2); // CPU plays as Player 2
              setScreen('cpu');
            }}
          >
            Start Game
          </button>
        </div>
      </div>
    </div>
  );

  const TopGammonLogo = () => (
    <svg width="320" height="70" viewBox="0 0 320 70" style={{ margin: '0 auto 24px', display: 'block' }}>
      <defs>
        <linearGradient id="tg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbb034"/>
          <stop offset="100%" stopColor="#ffdd00"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="70" rx="18" fill="#222" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontFamily="Verdana, Geneva, sans-serif" fontWeight="bold" fontSize="38" fill="url(#tg-grad)">TopGammon</text>
      <circle cx="45" cy="35" r="18" fill="#fff" stroke="#fbb034" strokeWidth="4" />
      <circle cx="275" cy="35" r="18" fill="#fbb034" stroke="#fff" strokeWidth="4" />
      <circle cx="45" cy="35" r="7" fill="#222" />
      <circle cx="275" cy="35" r="7" fill="#222" />
    </svg>
  );

  const StaticBoardSVG = () => (
    <svg width="420" height="180" viewBox="0 0 420 180" style={{ display: 'block', margin: '0 auto 32px', maxWidth: '100%' }}>
      <rect x="0" y="0" width="420" height="180" rx="18" fill="#f5e6c8" stroke="#bfa76f" strokeWidth="6" />
      {/* Triangles */}
      {[...Array(12)].map((_, i) => (
        <polygon key={i} points={`${20 + i*28},10 ${34 + i*28},150 ${6 + i*28},150`} fill={i%2===0 ? '#bfa76f' : '#fff'} stroke="#bfa76f" strokeWidth="1.5" />
      ))}
      {[...Array(12)].map((_, i) => (
        <polygon key={i+12} points={`${20 + i*28},170 ${34 + i*28},30 ${6 + i*28},30`} fill={i%2===0 ? '#bfa76f' : '#fff'} stroke="#bfa76f" strokeWidth="1.5" />
      ))}
      {/* Bar */}
      <rect x="206" y="10" width="8" height="160" fill="#e2c275" stroke="#bfa76f" strokeWidth="2" />
      {/* Checkers */}
      {[0,1,2,3,4].map(i => (
        <circle key={i} cx={34+0*28} cy={35+22*i} r="12" fill="#fff" stroke="#222" strokeWidth="2" />
      ))}
      {[0,1,2,3,4].map(i => (
        <circle key={i+5} cx={34+11*28} cy={35+22*i} r="12" fill="#222" stroke="#fff" strokeWidth="2" />
      ))}
      {[0,1,2,3,4].map(i => (
        <circle key={i+10} cx={34+0*28} cy={145-22*i} r="12" fill="#222" stroke="#fff" strokeWidth="2" />
      ))}
      {[0,1,2,3,4].map(i => (
        <circle key={i+15} cx={34+11*28} cy={145-22*i} r="12" fill="#fff" stroke="#222" strokeWidth="2" />
      ))}
    </svg>
  );

  const howToPlay = (
    <div style={sectionStyle}>
      <h2 style={{ color: '#bfa76f' }}>How to Play Backgammon</h2>
      <ol style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto', fontSize: 17, color: '#333' }}>
        <li><b>Setup:</b> Each player has 15 checkers. The board has 24 triangles (points), a bar, and bear-off area.</li>
        <li><b>Objective:</b> Move all your checkers into your home board and bear them off before your opponent does.</li>
        <li><b>Movement:</b> Players take turns rolling two dice and move checkers according to the numbers rolled. You can split the dice between two checkers or use both numbers for one checker.</li>
        <li><b>Direction:</b> Player 1 moves checkers from point 24 to 1; Player 2 moves from 1 to 24 (opposite directions).</li>
        <li><b>Hitting:</b> If you land on a point with a single opponent checker, you hit it and send it to the bar. That checker must re-enter before the opponent can move others.</li>
        <li><b>Doubles:</b> If you roll doubles, play each die twice (four moves total).</li>
        <li><b>Bearing Off:</b> Once all your checkers are in your home board, you can start removing them (bearing off) by rolling the exact number needed.</li>
        <li><b>Winning:</b> The first player to bear off all 15 checkers wins!</li>
      </ol>
    </div>
  );

  const glossary = (
    <div style={sectionStyle}>
      <h2 style={{ color: '#bfa76f' }}>Backgammon Glossary</h2>
      <ul style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto', fontSize: 17, color: '#333', columns: 2, columnGap: 32 }}>
        <li><b>Point:</b> A triangle on the board (1-24).</li>
        <li><b>Bar:</b> The center strip where hit checkers go.</li>
        <li><b>Bear Off:</b> Removing checkers from the board.</li>
        <li><b>Home Board:</b> The last 6 points where you bear off.</li>
        <li><b>Outer Board:</b> The other 12 points not in the home board.</li>
        <li><b>Blot:</b> A single checker on a point (vulnerable to being hit).</li>
        <li><b>Hit:</b> Landing on a blot and sending it to the bar.</li>
        <li><b>Prime:</b> A sequence of 6 occupied points, blocking the opponent.</li>
        <li><b>Gammon:</b> Winning before your opponent bears off any checkers (double win).</li>
        <li><b>Backgammon:</b> Winning before your opponent bears off any checkers and they still have checkers in your home or on the bar (triple win).</li>
        <li><b>Doubling Cube:</b> A die used to raise the stakes of the game.</li>
        <li><b>Checker:</b> A playing piece (each player has 15).</li>
        <li><b>Move:</b> Shifting a checker according to the dice roll.</li>
        <li><b>Slot:</b> To move a checker to an open point, often as a setup.</li>
        <li><b>Anchor:</b> A point occupied by two or more of your checkers in the opponent's home board.</li>
      </ul>
    </div>
  );

  const history = (
    <div style={sectionStyle}>
      <h2 style={{ color: '#bfa76f' }}>A Brief History of Backgammon</h2>
      <p style={{ maxWidth: 600, margin: '0 auto', fontSize: 17, color: '#333', textAlign: 'left' }}>
        Backgammon is one of the oldest known board games, dating back over 5,000 years to ancient Mesopotamia. It has been played by kings, scholars, and everyday people across Persia, Rome, and the Middle East. The modern rules were standardized in the 20th century, and today backgammon is enjoyed worldwide for its blend of strategy and luck. Whether played casually or competitively, backgammon remains a timeless classic.
      </p>
    </div>
  );

  // --- Styled text logo for homepage ---
  const TopGammonTextLogo = () => (
    <div style={{ fontFamily: 'Segoe UI, Verdana, Geneva, sans-serif', fontWeight: 700, fontSize: 48, margin: '0 auto 18px', letterSpacing: 1 }}>
      <span style={{ color: '#fbb034', textShadow: '1px 2px 6px #fff7c0' }}>Top</span>
      <span style={{ color: '#222', marginLeft: 6 }}>Gammon</span>
    </div>
  );

  // --- Simple image-based home board using screenshot ---
  const HomeBoardSVG = () => {
    return (
      <img 
        src="/Homeboard.png" 
        alt="TopGammon Backgammon Board" 
        style={{ 
          maxWidth: '100%', 
          height: 'auto', 
          margin: '0 auto 18px', 
          display: 'block'
        }} 
      />
    );
  };

  // Shared width for homepage boxes
  const homepageBoxWidth = 480;

  // Homepage feature bullet points
  const homepageFeatures = [
    'Competitive ranked play',
    'Free to play',
    'AI game review and lessons',
    'Modern, clean UI',
    'Play vs friends or CPU',
    'Guest play—no signup needed',
    'Undo/redo moves',
  ];

  // Leaderboards box definition
  const leaderboards = (
    <div style={{ ...sectionStyle, maxWidth: homepageBoxWidth, minWidth: 320, flex: 1 }}>
      <h2 style={{ color: '#bfa76f' }}>Leaderboards</h2>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        {/* Highest Rating Leaderboard */}
        <div style={{ flex: 1, minWidth: 180, maxWidth: 240, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 12, margin: '0 4px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#bfa76f' }}>Highest Rating</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ color: '#888', fontWeight: 600 }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Player</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {/* Data rows will go here */}
            </tbody>
          </table>
        </div>
        {/* Most Wins All Time Leaderboard */}
        <div style={{ flex: 1, minWidth: 180, maxWidth: 240, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 12, margin: '0 4px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#bfa76f' }}>Most Wins All Time</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ color: '#888', fontWeight: 600 }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Player</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Wins</th>
              </tr>
            </thead>
            <tbody>
              {/* Data rows will go here */}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <div style={{ textAlign: 'center', marginTop: 30, paddingBottom: 40, background: '#f5e6c8', minHeight: '100vh' }}>
      <div style={{
        ...sectionStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: 1100,
        width: '100%',
        marginBottom: 32,
        marginTop: 0,
        marginLeft: 'auto',
        marginRight: 'auto',
        boxSizing: 'border-box',
        padding: '32px 36px 24px 36px',
        gap: 0,
      }}>
        <TopGammonTextLogo />
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 32, marginTop: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 320 }}>
            <HomeBoardSVG />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 320, paddingLeft: 12 }}>
            <ul style={{ fontSize: 20, color: '#333', textAlign: 'left', listStyle: 'disc inside', margin: 0, padding: 0, lineHeight: 1.7, fontWeight: 700, fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif' }}>
              {homepageFeatures.map((f, i) => (
                <li key={i} style={{ marginBottom: 8 }}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 40, margin: '0 auto 24px', maxWidth: 1100, flexWrap: 'wrap' }}>
        <div style={{ ...sectionStyle, maxWidth: homepageBoxWidth, minWidth: 320, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <div>
            <h2>Play Online</h2>
                                        {user ? (
                              <>
                                <button style={buttonStyle} onClick={startMatchmaking}>New Game</button>
                                <button style={buttonStyle} onClick={() => alert('Tournaments coming soon!')}>Tournaments</button>
                              </>
                            ) : (
                              <>
                                <button style={buttonStyle} onClick={startMatchmaking}>Play as Guest</button>
                                <button style={buttonStyle} onClick={onShowAuth}>Login / Signup</button>
                              </>
                            )}
          </div>
          <div style={{ marginTop: 32 }}>
            <h2>Play Offline</h2>
            <button style={buttonStyle} onClick={() => setScreen('passplay')}>Pass and Play</button>
            <button style={buttonStyle} onClick={() => setScreen('cpu-difficulty')}>Vs. CPU</button>
          </div>
        </div>
        <div style={{ ...sectionStyle, maxWidth: homepageBoxWidth, minWidth: 320, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <h2 style={{ color: '#bfa76f' }}>Leaderboards</h2>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            {/* Highest Rating Leaderboard */}
            <div style={{ flex: 1, minWidth: 180, maxWidth: 240, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 12, margin: '0 4px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#bfa76f' }}>Highest Rating</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                <thead>
                  <tr style={{ color: '#888', fontWeight: 600 }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Player</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Data rows will go here */}
                </tbody>
              </table>
            </div>
            {/* Most Wins All Time Leaderboard */}
            <div style={{ flex: 1, minWidth: 180, maxWidth: 240, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 12, margin: '0 4px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: '#bfa76f' }}>Most Wins All Time</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                <thead>
                  <tr style={{ color: '#888', fontWeight: 600 }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Player</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Data rows will go here */}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 40, margin: '0 auto 24px', maxWidth: 1100, flexWrap: 'wrap' }}>
        <div style={{ ...sectionStyle, maxWidth: homepageBoxWidth, minWidth: 320, flex: 1 }}>{howToPlay}</div>
        <div style={{ ...sectionStyle, maxWidth: homepageBoxWidth, minWidth: 320, flex: 1 }}>{glossary}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 40, margin: '0 auto 24px', maxWidth: 1100, flexWrap: 'wrap' }}>
        <div style={{ ...sectionStyle, maxWidth: homepageBoxWidth, minWidth: 320, flex: 1 }}>{history}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', margin: '40px auto', maxWidth: 1100 }}>
        <a 
          href="/TimeBoss/index.html" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: '#bfa76f',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 600,
            padding: '12px 24px',
            border: '2px solid #bfa76f',
            borderRadius: '8px',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            display: 'inline-block'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#bfa76f';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#bfa76f';
          }}
        >
          Play TimeBoss
        </a>
      </div>
    </div>
  );

  const renderPlaceholder = (title, description) => (
    <div style={{ textAlign: 'center', marginTop: 80 }}>
      <h2>{title}</h2>
      <p style={{ color: '#555', fontSize: 18 }}>{description}</p>
      <button style={buttonStyle} onClick={() => setScreen('home')}>Back to Home</button>
    </div>
  );

    const renderMatchmaking = () => (
    <div style={{ textAlign: 'center', marginTop: 30, paddingBottom: 40, background: '#f5e6c8', minHeight: '100vh' }}>
      <div style={{ ...sectionStyle, maxWidth: 600, margin: '50px auto' }}>
        <h1 style={{ color: '#bfa76f', marginBottom: 20 }}>Finding Opponent</h1>
        
        {/* Loading Animation */}
        <div style={{ margin: '40px 0' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '30px'
          }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: i === matchmakingAnimation ? '#28a745' : '#ddd',
                  transition: 'background-color 0.3s ease',
                  transform: i === matchmakingAnimation ? 'scale(1.2)' : 'scale(1)',
                  boxShadow: i === matchmakingAnimation ? '0 0 10px rgba(40, 167, 69, 0.5)' : 'none'
                }}
              />
            ))}
          </div>
          
          <p style={{ fontSize: 18, color: '#666', marginBottom: '20px' }}>
            {matchmakingStatus || 'Searching for opponent...'}
          </p>
          
          <div style={{ fontSize: 14, color: '#888', marginBottom: '30px' }}>
            {user ? `Playing as: ${user.user_metadata?.username || user.email}` : `Playing as: ${currentPlayerId ? currentPlayerId.split('_')[1] ? `Guest_${currentPlayerId.split('_')[1]}` : 'Guest' : 'Guest'}`}
          </div>
        </div>

        {/* Debug Info Panel */}
        <div style={{ 
          background: '#fff', 
          padding: '15px', 
          borderRadius: '8px', 
          margin: '20px 0',
          border: '1px solid #ddd',
          textAlign: 'left'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#666' }}>Debug Info:</h4>
          <div style={{ fontSize: '12px', color: '#888' }}>
            <div>Database Connected: {debugInfo.databaseConnected ? '✅ Yes' : '❌ No'}</div>
            <div>Current Player ID: {currentPlayerId || 'None'}</div>
            <div>Matchmaking Status: {debugInfo.matchmakingStatus}</div>
            {debugInfo.lastError && (
              <div style={{ color: '#dc3545', marginTop: '5px' }}>
                Last Error: {debugInfo.lastError}
              </div>
            )}
          </div>
        </div>

        {/* Cancel Button */}
        <button 
          style={{
            ...buttonStyle,
            backgroundColor: '#dc3545',
            marginTop: '20px'
          }} 
          onClick={cancelMatchmaking}
        >
          Cancel Matchmaking
        </button>
      </div>
    </div>
  );

  const renderOnlineGame = () => {
    // Determine which player this user is
    const isPlayer1 = currentMatch && currentMatch.player1_id === currentPlayerId;
    const isPlayer2 = currentMatch && currentMatch.player2_id === currentPlayerId;
    const playerNumber = isPlayer1 ? 1 : isPlayer2 ? 2 : null;
    
    // Always render the board (exactly like pass-and-play) - the first roll modal overlays on top
    return (
      <div style={{ textAlign: 'center', marginTop: 30, paddingBottom: 40, background: '#f5e6c8', minHeight: '100vh', position: 'relative' }}>
        <div style={{ ...sectionStyle, maxWidth: 1200, margin: '20px auto' }}>
          <h1 style={{ color: '#bfa76f', marginBottom: 20 }}>Online Game</h1>
          
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: 16, color: '#666' }}>
              Playing against: {opponentInfo?.name || 'Opponent'}
            </p>
            <p style={{ fontSize: 14, color: '#888' }}>
              You are Player {playerNumber}
            </p>
          </div>

          {/* Game board - always visible */}
          <div style={{ 
            background: '#fff', 
            padding: '20px', 
            borderRadius: '8px',
            margin: '20px 0',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}>
            {renderBoard()}
          </div>

          {/* Game controls */}
          <div style={{ marginTop: '20px' }}>
            {!hasRolled && currentPlayer === playerNumber && !firstRollPhase && (
              <button 
                style={{
                  ...buttonStyle,
                  fontSize: '18px',
                  padding: '12px 24px',
                  marginRight: '10px'
                }} 
                onClick={rollDice}
              >
                Roll Dice
              </button>
            )}
            
            {hasRolled && allDiceUsed() && currentPlayer === playerNumber && !firstRollPhase && (
              <button 
                style={{
                  ...buttonStyle,
                  backgroundColor: '#28a745',
                  fontSize: '16px',
                  padding: '10px 20px'
                }} 
                onClick={handleEndTurn}
              >
                End Turn
              </button>
            )}
          </div>

          {/* Back to home button */}
          <button 
            style={{
              ...buttonStyle,
              backgroundColor: '#6c757d',
              marginTop: '20px'
            }} 
            onClick={() => {
              setScreen('home');
              setIsOnlineGame(false);
              setCurrentMatch(null);
              setOpponentInfo(null);
            }}
          >
              Back to Home
          </button>
        </div>
      </div>
    );
  };

  // Game over handler
  function triggerGameOver(type, winner, loser) {
    setGameOver({ type, winner, loser });
    // Clear all overlays when game ends
    setShowConfirmResign(false);
    setNoMoveOverlay(false);
  }

  // Game over message
  function getGameOverMessage(go) {
    if (!go) return '';
    if (go.type === 'win') return `Player ${go.winner} wins!`;
    if (go.type === 'resign') return `Player ${go.loser} resigned. Player ${go.winner} wins!`;
    if (go.type === 'disconnect') return `Player ${go.loser} disconnected. Player ${go.winner} wins by default!`;
    if (go.type === 'double') return `Player ${go.loser} declined the double. Player ${go.winner} wins!`;
    if (go.type === 'timeout') return `Player ${go.loser} ran out of time. Player ${go.winner} wins by timeout!`;
    return 'Game Over';
  }

  function handleRematch() {
    setGameOver(null);
    setCheckers(getInitialCheckers());
    setSelected(null);
    setLegalMoves([]);
    setDice([0, 0]);
    setUsedDice([]);
    setCurrentPlayer(1);
    setHasRolled(false);
    setBar({ 1: [], 2: [] });
    setBorneOff({ 1: 0, 2: 0 });
    setMessage('');
    setScreen('passplay');
    setTimer(30);
    setUndoStack([]);
    setMoveMade(false);
    setAwaitingEndTurn(false);
    // Reset doubling state
    setDoubleOffer(null);
    setDoubleTimer(15);
    setCanDouble({ 1: true, 2: true });
    setGameStakes(1);
    setNoMoveOverlay(false);
    setShowConfirmResign(false);
    setFirstRollPhase(true);
    setFirstRolls([null, null]);
    setFirstRollTurn(1);
    setFirstRollResult(null);
    setEndgameTestActive(false);
    // Reset CPU-related state to prevent interference with pass and play
    setIsCpuGame(false);
    setCpuPlayer(2);
    setIsCpuThinking(false);
    setCpuDifficulty(3);
    if (timerRef.current) clearInterval(timerRef.current);
  }
  function handleQuit() {
    setGameOver(null);
    setScreen('home');
    setCheckers(getInitialCheckers());
    setSelected(null);
    setLegalMoves([]);
    setDice([0, 0]);
    setUsedDice([]);
    setCurrentPlayer(1);
    setHasRolled(false);
    setBar({ 1: [], 2: [] });
    setBorneOff({ 1: 0, 2: 0 });
    setMessage('');
    setTimer(30);
    setUndoStack([]);
    setMoveMade(false);
    setAwaitingEndTurn(false);
    setNoMoveOverlay(false);
    setShowConfirmResign(false);
    setFirstRollPhase(true);
    setFirstRolls([null, null]);
    setFirstRollTurn(1);
    setFirstRollResult(null);
    setEndgameTestActive(false);
    // Reset CPU-related state to prevent interference with pass and play
    setIsCpuGame(false);
    setCpuPlayer(2);
    setIsCpuThinking(false);
    setCpuDifficulty(3);
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Force a page refresh to ensure complete state reset
    window.location.reload();
  }

  // Timer countdown - pause/resume instead of reset
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Only reset timer on turn change or rematch (not on double offer changes)
    if (currentPlayer !== prevPlayerRef.current || screen !== prevScreenRef.current) {
      setTimer(45);
      prevPlayerRef.current = currentPlayer;
      prevScreenRef.current = screen;
    }
    
    // Start timer if it's the player's turn and not game over, and not currently rolling, and no double offer active
    if (!gameOver && screen === 'passplay' && !firstRollPhase && !gameOver && !isRolling && !doubleOffer) {
      timerRef.current = setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            // Timeout: trigger game over
            triggerGameOver('timeout', currentPlayer === 1 ? 2 : 1, currentPlayer);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentPlayer, screen, gameOver, firstRollPhase, isRolling, doubleOffer]);

  // TEMP: Set endgame state for testing bearing off (both players)
  function setEndgameState() {
    setEndgameTestActive(true);
    // Set up a simple endgame scenario for testing bearing off
    let endgameCheckers = [];
    let id = 1;
    
    // Player 1: All checkers in home board (points 18-23)
    // Player 2: All checkers in home board (points 0-5)
    
    // Player 1 checkers - simple distribution
    for (let point = 18; point <= 23; point++) {
      let count = point === 18 ? 5 : point === 19 ? 3 : point === 20 ? 2 : point === 21 ? 2 : point === 22 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        endgameCheckers.push({ id: id++, point, offset: i, player: 1 });
      }
    }
    
    // Player 2 checkers - simple distribution
    for (let point = 0; point <= 5; point++) {
      let count = point === 0 ? 5 : point === 1 ? 3 : point === 2 ? 2 : point === 3 ? 2 : point === 4 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        endgameCheckers.push({ id: id++, point, offset: i, player: 2 });
      }
    }
    
    setCheckers(endgameCheckers);
    setBar({ 1: [], 2: [] });
    setBorneOff({ 1: 0, 2: 0 });
    setSelected(null);
    setLegalMoves([]);
    setUsedDice([]);
    setHasRolled(false);
    setMovesAllowed([null, null]);
    setCurrentPlayer(1);
    setMessage('Endgame test state: Both players ready to bear off');
  }

  useEffect(() => {
    if (gameOver) setNoMoveOverlay(false);
  }, [gameOver]);

  // Add this useEffect to always recalculate legal moves when selected changes
  useEffect(() => {
    if (selected) {
      calculateLegalMoves(selected);
    } else {
      setLegalMoves([]);
    }
  }, [selected]);

  // Listen for match creation events (for the player who didn't initiate the match)
  useEffect(() => {
    if (isMatchmaking && currentPlayerId) {
      const matchSubscription = supabase
        .channel('match-creation')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'matches'
          }, 
          async (payload) => {
            console.log('Match creation event received:', payload);
            const match = payload.new;
            
            // Check if this match involves the current player
            if (match.player1_id === currentPlayerId || match.player2_id === currentPlayerId) {
              console.log('Match involves current player, transitioning to game...');
              
              // Get opponent info
              const opponentId = match.player1_id === currentPlayerId ? match.player2_id : match.player1_id;
              const { data: opponentData } = await supabase
                .from('matchmaking_queue')
                .select('player_name')
                .eq('player_id', opponentId)
                .single();
              
              const opponentName = opponentData?.player_name || 'Unknown Player';
              
              // Set up the game (same as createMatch but without creating the match)
              setCurrentMatch(match);
              setIsOnlineGame(true);
              setOpponentInfo({ name: opponentName });
              setIsMatchmaking(false);
              setMatchmakingStatus('');
              
              // Reset game state for online play
              setCheckers(getInitialCheckers());
              setSelected(null);
              setLegalMoves([]);
              setDice([0, 0]);
              setUsedDice([]);
              setCurrentPlayer(1);
              setHasRolled(false);
              setBar({ 1: [], 2: [] });
              setBorneOff({ 1: 0, 2: 0 });
              setMessage('');
              setFirstRollPhase(true);
              setFirstRolls([null, null]);
              setFirstRollTurn(1);
              setFirstRollResult(null);
              setGameOver(null);
              setDoubleOffer(null);
              setCanDouble({ 1: true, 2: true });
              setGameStakes(1);
              
              // Start the online game
              setScreen('onlineGame');
              
              // Cleanup subscription and interval
              if (matchmakingSubscription) {
                if (matchmakingSubscription.interval) {
                  clearInterval(matchmakingSubscription.interval);
                }
                setMatchmakingSubscription(null);
              }
            }
          }
        )
        .subscribe();
      
      return () => {
        matchSubscription.unsubscribe();
      };
    }
  }, [isMatchmaking, currentPlayerId, matchmakingSubscription]);

  // Listen for first roll moves in online games
  useEffect(() => {
    if (isOnlineGame && currentMatch && currentPlayerId) {
      const firstRollSubscription = supabase
        .channel('first-roll-moves')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'game_moves',
            filter: `match_id=eq.${currentMatch.id}`
          }, 
          async (payload) => {
            console.log('First roll move received:', payload);
            const move = payload.new;
            
            if (move.move_type === 'first_roll' && move.player_id !== currentPlayerId) {
              // This is the opponent's first roll
              const moveData = move.move_data;
              console.log('Opponent first roll:', moveData);
              
              // Update local state with opponent's roll
              const newFirstRolls = [...firstRolls];
              newFirstRolls[moveData.player] = moveData.total;
              setFirstRolls(newFirstRolls);
              
              // Check if both players have rolled
              if (newFirstRolls[1] && newFirstRolls[2]) {
                // Determine winner
                if (newFirstRolls[1] > newFirstRolls[2]) {
                  setFirstRollResult(1);
                  setTimeout(() => {
                    setCurrentPlayer(1);
                    setFirstRollPhase(false);
                    setHasRolled(true);
                    setDice([newFirstRolls[1], newFirstRolls[2]]);
                    setUsedDice([]);
                    setMovesAllowed(newFirstRolls[1] === newFirstRolls[2] ? 
                      [newFirstRolls[1], newFirstRolls[1], newFirstRolls[1], newFirstRolls[1]] : 
                      [newFirstRolls[1], newFirstRolls[2]]);
                  }, 1200);
                } else if (newFirstRolls[2] > newFirstRolls[1]) {
                  setFirstRollResult(2);
                  setTimeout(() => {
                    setCurrentPlayer(2);
                    setFirstRollPhase(false);
                    setHasRolled(true);
                    setDice([newFirstRolls[1], newFirstRolls[2]]);
                    setUsedDice([]);
                    setMovesAllowed(newFirstRolls[1] === newFirstRolls[2] ? 
                      [newFirstRolls[1], newFirstRolls[1], newFirstRolls[1], newFirstRolls[1]] : 
                      [newFirstRolls[1], newFirstRolls[2]]);
                  }, 1200);
                } else {
                  setFirstRollResult('tie');
                  setTimeout(() => {
                    setFirstRolls([null, null]);
                    setFirstRollTurn(1);
                    setFirstRollResult(null);
                  }, 1200);
                }
              } else {
                // Switch to other player
                setFirstRollTurn(moveData.player === 1 ? 2 : 1);
              }
            }
          }
        )
        .subscribe();
      return () => {
        firstRollSubscription.unsubscribe();
      };
    }
  }, [isOnlineGame, currentMatch, currentPlayerId, firstRolls]);

  // Helper: always select the top checker in a stack for a given checker
  function selectTopChecker(checker) {
    if (!checker) {
      setSelected(null);
      return;
    }
    // Find all checkers at this point for this player
    const stack = checkers.filter(c => c.point === checker.point && c.player === checker.player);
    if (stack.length === 0) {
      setSelected(null);
      return;
    }
    const topChecker = stack.reduce((a, b) => a.offset > b.offset ? a : b);
    setSelected(topChecker);
  }

  // Unified Checker component for all checkers
  function Checker({ checker, x, y, isSelected, onClick, isSideways = false, dataTriangle = null }) {
    const baseX = x;
    const baseY = y;
    
    // For sideways checkers (borne off), rotate the entire group
    const transform = isSideways ? `rotate(90, ${baseX}, ${baseY})` : '';
    
    return (
      <g 
        transform={transform}
        onClick={onClick} 
        style={{ cursor: checker.player === currentPlayer && hasRolled ? 'pointer' : 'default' }}
        data-triangle={dataTriangle}
        data-checker="true"
      >
        {/* Simple shadow */}
        <ellipse
          cx={baseX}
          cy={baseY + checkerSize * 0.18}
          rx={checkerSize * 0.44}
          ry={checkerSize * 0.18}
          fill="#000"
          opacity={0.13}
        />
        {/* Main checker body - flat disc style */}
        <circle
          cx={baseX}
          cy={baseY}
          r={checkerSize / 2}
          fill={checker.player === 1 ? '#fff' : '#111'}
          stroke={isSelected ? 'none' : '#000'}
          strokeWidth={isSelected ? 0 : 1.5}
          filter={isSelected ? 'url(#checker-glow)' : 'url(#checker-shadow)'}
        />
        {/* Three sharp rings for definition */}
        <circle
          cx={baseX}
          cy={baseY}
          r={checkerSize * 0.38}
          fill="none"
          stroke={checker.player === 1 ? '#e5e5e5' : '#222'}
          strokeWidth={checkerSize * 0.07}
        />
        <circle
          cx={baseX}
          cy={baseY}
          r={checkerSize * 0.26}
          fill="none"
          stroke={checker.player === 1 ? '#ccc' : '#333'}
          strokeWidth={checkerSize * 0.06}
        />
        <circle
          cx={baseX}
          cy={baseY}
          r={checkerSize * 0.15}
          fill="none"
          stroke={checker.player === 1 ? '#aaa' : '#444'}
          strokeWidth={checkerSize * 0.05}
        />
      </g>
    );
  }

  // NOTE: Auto-selection for bearing off has been removed.
  // Players must manually select checkers to bear off.
  // Auto-selection is still active for bar entry (sitting).

  if (screen === 'home') return renderHome();
  if (screen === 'guest') return renderPlaceholder('Play as Guest', 'Online guest play coming soon!');
  if (screen === 'login') return renderPlaceholder('Login / Signup', 'User authentication coming soon!');
  if (screen === 'matchmaking') return renderMatchmaking();
  if (screen === 'onlineGame') return renderOnlineGame();
  if (screen === 'passplay') return renderPassPlay();
  if (screen === 'cpu-difficulty') return renderCpuDifficultySelection();
  if (screen === 'cpu') return renderCpuGame();

  return null;
}

// Wrapper component that handles authentication
function AppWithAuth() {
  const [currentScreen, setCurrentScreen] = useState('game');
  const { user, loading, signOut } = useSupabaseAuth();

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (currentScreen === 'auth') {
    return (
      <SupabaseAuthPage 
        onBackToGame={() => setCurrentScreen('game')}
      />
    );
  }

  // Show the game with authentication context
  return (
    <div>
      {/* Header with user info */}
      <div style={{
        background: '#1976d2',
        color: 'white',
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
          TopGammon
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {user && (
            <>
              <span>Welcome, {user.user_metadata?.username || user.email}</span>
              <button
                onClick={async () => {
                  // Handle logout
                  await signOut();
                }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Game component */}
      <App onShowAuth={() => setCurrentScreen('auth')} user={user} />
    </div>
  );
}

// Main app wrapper with Supabase provider
function AppWrapper() {
  return (
    <SupabaseAuthProvider>
      <AppWithAuth />
    </SupabaseAuthProvider>
  );
}

export default AppWrapper;