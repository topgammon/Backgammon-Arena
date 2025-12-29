import React, { useState, useEffect, useRef } from 'react';
import './GameBoard.css';
import { getCpuMove, getThinkingTime, shouldAcceptDouble, shouldOfferDouble } from './cpuAI';
import { supabase } from '../lib/supabase';
import { io } from 'socket.io-client';

// TODO: Future feature - Track player records against each bot difficulty for signed-in users
// This will display win/loss stats for each difficulty level when viewing the difficulty selection screen

// Constants
const buttonStyle = {
  backgroundColor: '#ff751f',
  color: 'white',
  padding: '12px 24px',
  margin: '10px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '18px',
  cursor: 'pointer',
  minWidth: '162px',
};

// CPU Difficulty Levels (1-9) - Removed "Perfect" to make 9 levels for 3x3 grid
// TODO: Future feature - Track player records against each bot difficulty for signed-in users
// This will display win/loss stats for each difficulty level when viewing the difficulty selection screen
// Avatar mapping: Each difficulty level has a unique avatar
const DIFFICULTY_LEVELS = {
  1: { name: 'Beginner', description: 'Makes many mistakes, often misses obvious moves.', skillRating: 800, avatar: 'Barry' },
  2: { name: 'Novice', description: 'Plays poorly, but occasionally finds good moves.', skillRating: 1000, avatar: 'Bruce' },
  3: { name: 'Amateur', description: 'Makes frequent errors, but understands basic strategy.', skillRating: 1200, avatar: 'Charles' },
  4: { name: 'Intermediate', description: 'Understands fundamental strategy, but lacks depth.', skillRating: 1400, avatar: 'Dennis' },
  5: { name: 'Skilled', description: 'Plays solid, but can be outmaneuvered by experienced players.', skillRating: 1600, avatar: 'Edward' },
  6: { name: 'Advanced', description: 'Strong player, rarely makes obvious mistakes.', skillRating: 1800, avatar: 'Gregory' },
  7: { name: 'Expert', description: 'Consistently makes good moves, challenging opponent.', skillRating: 2000, avatar: 'Martin' },
  8: { name: 'Master', description: 'Plays near-perfect, very difficult to beat.', skillRating: 2200, avatar: 'Milo' },
  9: { name: 'Grandmaster', description: 'Plays optimally, almost impossible to defeat. You have to get lucky to win.', skillRating: 2400, avatar: 'Ronald' },
};

const triangleW = 58;
const triangleH = 216;
const checkerSize = 43;
const gap = 38;
const bearOffW = 72;
const boardX = 36;
const boardY = 36;
const boardW = triangleW * 12 + gap + bearOffW;
const boardH = 576;

// Helper functions
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

function pipCount(checkers, player, bar, borneOff) {
  let total = 0;
  for (let c of checkers) {
    if (c.player === player) {
      total += player === 1 ? 24 - c.point : c.point + 1;
    }
  }
  total += bar[player].length * 25;
  return total;
}

function getMoveDistance(from, to, player) {
  return player === 1 ? (to - from) : (from - to);
}

// Dice component
function Dice({ value, faded, shrunk, isRolling = false, frame = 0 }) {
  const dotRadius = 5;
  const size = 61;
  const padding = 18;
  const positions = [padding, size / 2, size - padding];
  
  const dots = [
    [],
    [[1, 1]],
    [[0, 0], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 0], [0, 2], [2, 0], [2, 2]],
    [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  ];

  const rollingFrames = [
    { face: value, rotation: 0, scale: 1 },
    { face: Math.floor(Math.random() * 6) + 1, rotation: 15, scale: 0.9 },
    { face: Math.floor(Math.random() * 6) + 1, rotation: 30, scale: 0.8 },
    { face: Math.floor(Math.random() * 6) + 1, rotation: 45, scale: 0.7 },
    { face: Math.floor(Math.random() * 6) + 1, rotation: 30, scale: 0.8 },
    { face: Math.floor(Math.random() * 6) + 1, rotation: 15, scale: 0.9 },
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

// Logo component (using new logo instead of TopGammonTextLogo)
function BackgammonArenaLogo() {
  return (
    <div style={{ marginBottom: '18px' }}>
      <img src="/logo.svg" alt="Backgammon Arena Logo" style={{ height: '120px' }} />
    </div>
  );
}

function GameBoard() {
  // All state variables from old project
  const [movesAllowed, setMovesAllowed] = useState([null, null]);
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
  const [noMoveOverlay, setNoMoveOverlay] = useState(false);
  const [lastNoMoveDice, setLastNoMoveDice] = useState(null);
  const nextPlayerRef = useRef(null);
  const [undoStack, setUndoStack] = useState([]);
  const [moveMade, setMoveMade] = useState(false);
  const [awaitingEndTurn, setAwaitingEndTurn] = useState(false);
  const [firstRollPhase, setFirstRollPhase] = useState(true);
  const [firstRolls, setFirstRolls] = useState([null, null]);
  const [firstRollTurn, setFirstRollTurn] = useState(1);
  const [firstRollResult, setFirstRollResult] = useState(null);
  const [showConfirmResign, setShowConfirmResign] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [timer, setTimer] = useState(45);
  const [rematchRequest, setRematchRequest] = useState(null); // { from: playerNumber, to: playerNumber }
  const firstRollIntervalRef = useRef(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [signupFormData, setSignupFormData] = useState({
    email: '',
    password: '',
    username: '',
    country: 'US'
  });
  const [loginFormData, setLoginFormData] = useState({
    email: '',
    password: ''
  });
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [editingCountry, setEditingCountry] = useState(false);
  const [newCountry, setNewCountry] = useState('');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const timerRef = useRef();
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState('');
  const [matchmakingType, setMatchmakingType] = useState(null); // 'guest' or 'ranked'
  const socketRef = useRef(null);
  const [isOnlineGame, setIsOnlineGame] = useState(false);
  const [matchId, setMatchId] = useState(null);
  const [playerNumber, setPlayerNumber] = useState(null); // 1 or 2
  const [opponent, setOpponent] = useState(null); // { userId, isGuest }
  const transitioningToGameRef = useRef(false);
  
  // Track window width for responsive design
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Available avatars
  const availableAvatars = [
    'Barry', 'Bruce', 'Charles', 'Dennis', 'Edward', 'Gregory',
    'Martin', 'Milo', 'Ronald', 'Seamus', 'Seymour', 'Troy'
  ];

  // Country list with flags
  const countries = [
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱' },
    { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
    { code: 'PE', name: 'Peru', flag: '🇵🇪' },
    { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
    { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
    { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
    { code: 'AT', name: 'Austria', flag: '🇦🇹' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
    { code: 'NO', name: 'Norway', flag: '🇳🇴' },
    { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
    { code: 'FI', name: 'Finland', flag: '🇫🇮' },
    { code: 'PL', name: 'Poland', flag: '🇵🇱' },
    { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
    { code: 'GR', name: 'Greece', flag: '🇬🇷' },
    { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
    { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
    { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
    { code: 'RU', name: 'Russia', flag: '🇷🇺' },
    { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
    { code: 'IL', name: 'Israel', flag: '🇮🇱' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
    { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
    { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
    { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
    { code: 'IN', name: 'India', flag: '🇮🇳' },
    { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
    { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
    { code: 'CN', name: 'China', flag: '🇨🇳' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
    { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
    { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
    { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
    { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
    { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
    { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
    { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
    { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
    { code: 'MT', name: 'Malta', flag: '🇲🇹' },
    { code: 'CY', name: 'Cyprus', flag: '🇨🇾' }
  ];

  // Helper function to get country flag
  const getCountryFlag = (countryCode) => {
    const country = countries.find(c => c.code === countryCode);
    return country ? country.flag : '🌍';
  };
  const prevPlayerRef = useRef(null);
  const cpuDoubleCheckedRef = useRef(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingDice, setRollingDice] = useState([1, 1]);
  const [animationFrame, setAnimationFrame] = useState(0);
  const [isFirstRolling, setIsFirstRolling] = useState(false);
  const [firstRollAnimationFrame, setFirstRollAnimationFrame] = useState(0);
  const [autoRoll, setAutoRoll] = useState({ 1: false, 2: false });
  const [doubleOffer, setDoubleOffer] = useState(null);
  const [doubleTimer, setDoubleTimer] = useState(12);
  const [canDouble, setCanDouble] = useState({ 1: true, 2: true });
  const [gameStakes, setGameStakes] = useState(1);
  const [isCpuGame, setIsCpuGame] = useState(false);
  const [cpuPlayer, setCpuPlayer] = useState(2); // CPU plays as Player 2
  const [cpuDifficulty, setCpuDifficulty] = useState(5); // Default to level 5 (middle difficulty)
  const [isCpuThinking, setIsCpuThinking] = useState(false);
  const [screen, setScreen] = useState('home'); // Start on homepage
  const [cpuDoubleMessage, setCpuDoubleMessage] = useState(null); // Message to show after CPU decides on double
  const [positionEvaluation, setPositionEvaluation] = useState(0); // Current position evaluation (-1 to 1)

  // Auto-detect country based on browser locale when signup form opens
  useEffect(() => {
    if (showSignupForm && (!signupFormData.country || signupFormData.country === 'US')) {
      // Try to detect country from timezone or locale
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const locale = navigator.language || navigator.userLanguage;
      
      // Simple country detection based on common patterns
      let detectedCountry = 'US';
      if (timezone.includes('Europe/London') || locale.includes('en-GB')) detectedCountry = 'GB';
      else if (timezone.includes('Europe/') || locale.includes('de')) detectedCountry = 'DE';
      else if (timezone.includes('Europe/Paris') || locale.includes('fr')) detectedCountry = 'FR';
      else if (timezone.includes('Europe/Madrid') || locale.includes('es')) detectedCountry = 'ES';
      else if (timezone.includes('Europe/Rome') || locale.includes('it')) detectedCountry = 'IT';
      else if (timezone.includes('America/Toronto') || locale.includes('en-CA')) detectedCountry = 'CA';
      else if (timezone.includes('Australia/') || locale.includes('en-AU')) detectedCountry = 'AU';
      else if (timezone.includes('America/Sao_Paulo') || locale.includes('pt-BR')) detectedCountry = 'BR';
      else if (timezone.includes('America/Mexico') || locale.includes('es-MX')) detectedCountry = 'MX';
      
      setSignupFormData(prev => ({ ...prev, country: detectedCountry }));
    }
  }, [showSignupForm]);

  // Check authentication state on mount and when auth changes
  useEffect(() => {
    if (!supabase) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user profile when user changes
  useEffect(() => {
    if (!user || !supabase) {
      setUserProfile(null);
      return;
    }

    const fetchUserProfile = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error fetching user profile:', error);
        setUserProfile(null);
      } else if (data) {
        setUserProfile(data);
      } else {
        // If profile doesn't exist, try to create it from auth metadata
        if (user.user_metadata?.username) {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              username: user.user_metadata.username,
              country: user.user_metadata.country || 'US',
              avatar: 'Barry', // Default to first avatar
              elo_rating: 1000,
              wins: 0,
              losses: 0,
              games_played: 0
            });
          
          if (!insertError) {
            // Fetch again after creating
            const { data: newData } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single();
            setUserProfile(newData);
          }
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  // Reset first roll state on mount
  useEffect(() => {
    setFirstRollPhase(true);
    setFirstRolls([null, null]);
    setFirstRollTurn(1);
    setFirstRollResult(null);
    setAutoRoll({ 1: false, 2: false });
  }, []);

  // Reset undo stack and moveMade at the start of each turn
  useEffect(() => {
    setUndoStack([]);
    setMoveMade(false);
  }, [currentPlayer, hasRolled]);

  // Reset awaitingEndTurn at the start of each turn
  useEffect(() => {
    setAwaitingEndTurn(false);
  }, [currentPlayer, hasRolled]);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (currentPlayer !== prevPlayerRef.current) {
      setTimer(45);
      prevPlayerRef.current = currentPlayer;
    }
    
    if (!gameOver && (screen === 'passplay' || screen === 'onlineGame') && !firstRollPhase && !gameOver && !isRolling && !doubleOffer) {
      timerRef.current = setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            // Only trigger timeout forfeit if player has valid moves available
            // If no valid moves, auto-end turn instead
            if (hasRolled && hasAnyValidMoves() && !allDiceUsed()) {
              triggerGameOver('timeout', currentPlayer === 1 ? 2 : 1, currentPlayer);
            } else if (hasRolled && (!hasAnyValidMoves() || allDiceUsed())) {
              // Auto-end turn if no moves available
              handleEndTurn();
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentPlayer, screen, gameOver, firstRollPhase, isRolling, doubleOffer]);

  // Double timer countdown
  useEffect(() => {
    if (!doubleOffer) return;
    
    const interval = setInterval(() => {
      setDoubleTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDoubleResponse(false); // Auto-decline on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [doubleOffer]);

  // Auto-roll when turn starts if enabled
  useEffect(() => {
    if (!firstRollPhase && !hasRolled && !gameOver && autoRoll[currentPlayer] && !doubleOffer) {
      setTimeout(() => {
        if (!hasRolled && !gameOver && !doubleOffer) {
          rollDice();
        }
        }, 50);
    }
  }, [currentPlayer, firstRollPhase, hasRolled, gameOver, autoRoll, doubleOffer]);

  // CPU auto-roll dice for first roll phase (break the dice)
  useEffect(() => {
    if (isCpuGame && firstRollPhase && !gameOver && firstRollTurn === cpuPlayer && !isFirstRolling && !firstRollResult && screen === 'cpu') {
      const timeoutId = setTimeout(() => {
        if (firstRollPhase && firstRollTurn === cpuPlayer && !isFirstRolling && !firstRollResult && isCpuGame) {
          handleFirstRoll();
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isCpuGame, firstRollPhase, firstRollTurn, gameOver, cpuPlayer, isFirstRolling, screen, firstRollResult]);

  // CPU auto-roll dice when it's CPU's turn (after first roll phase)
  useEffect(() => {
    // Don't roll if CPU has offered a double (wait for player response)
    const cpuOfferedDouble = isCpuGame && doubleOffer && doubleOffer.from === cpuPlayer;
    if (isCpuGame && !firstRollPhase && !gameOver && currentPlayer === cpuPlayer && !hasRolled && !isCpuThinking && !cpuOfferedDouble && screen === 'cpu') {
      setTimeout(() => {
        const stillCpuOfferedDouble = isCpuGame && doubleOffer && doubleOffer.from === cpuPlayer;
        if (!hasRolled && !gameOver && currentPlayer === cpuPlayer && isCpuGame && !stillCpuOfferedDouble) {
          rollDice();
        }
      }, 300); // Reduced delay
    }
  }, [isCpuGame, firstRollPhase, gameOver, currentPlayer, cpuPlayer, hasRolled, isCpuThinking, screen, doubleOffer]);

  // CPU double offer check (before CPU's turn starts) - only check once per turn
  useEffect(() => {
    // Reset the check flag when turn changes
    if (currentPlayer !== cpuPlayer) {
      cpuDoubleCheckedRef.current = false;
      return;
    }
    
    if (!isCpuGame || gameOver || firstRollPhase || doubleOffer || !canDouble[cpuPlayer]) return;
    if (currentPlayer === cpuPlayer && !hasRolled && screen === 'cpu' && !cpuDoubleCheckedRef.current) {
      cpuDoubleCheckedRef.current = true; // Mark as checked for this turn
      
      // Check if CPU should offer double (70%+ win chance)
      const checkCpuDoubleOffer = async () => {
        try {
          const gameState = getGameStateForAI();
          const shouldOffer = await shouldOfferDouble(gameState, cpuDifficulty);
          if (shouldOffer && currentPlayer === cpuPlayer && !hasRolled && !doubleOffer && canDouble[cpuPlayer]) {
            offerDouble();
          }
        } catch (error) {
          console.error('Error checking CPU double offer:', error);
        }
      };
      // Small delay to ensure game state is stable
      setTimeout(checkCpuDoubleOffer, 500);
    }
  }, [isCpuGame, currentPlayer, cpuPlayer, hasRolled, firstRollPhase, gameOver, doubleOffer, canDouble, screen, cpuDifficulty]);

  // Handle CPU double decision when player offers double to CPU
  useEffect(() => {
    if (!isCpuGame || !doubleOffer || doubleOffer.to !== cpuPlayer || doubleOffer.from === cpuPlayer) return;
    
    // Player offered double to CPU - CPU needs to decide
    const handleCpuDoubleDecision = async () => {
      // Capture the offer details before clearing state
      const offerFrom = doubleOffer.from;
      
      try {
        const gameState = getGameStateForAI();
        const shouldAccept = await shouldAcceptDouble(gameState, cpuDifficulty);
        
        // Clear the double offer state first
        setDoubleOffer(null);
        
        if (shouldAccept) {
          // CPU accepted
          // When CPU accepts a double:
          // - CPU (cpuPlayer) gains the right to offer next
          // - Player (offerFrom) loses the right until CPU offers
          setGameStakes(prev => prev * 2);
          setCanDouble(prev => ({ ...prev, [offerFrom]: false, [cpuPlayer]: true }));
          setCpuDoubleMessage('CPU accepted offer to double');
          setTimeout(() => setCpuDoubleMessage(null), 3000);
        } else {
          // CPU declined - player wins!
          setCpuDoubleMessage('CPU declined offer to double, game over PLAYER WINS!');
          setTimeout(() => {
            setCpuDoubleMessage(null);
            triggerGameOver('double', offerFrom, cpuPlayer);
          }, 3000);
        }
      } catch (error) {
        console.error('Error in CPU double decision:', error);
        // On error, default to accept
        setDoubleOffer(null);
        setGameStakes(prev => prev * 2);
        setCanDouble(prev => ({ ...prev, [offerFrom]: false, [cpuPlayer]: true }));
        setCpuDoubleMessage('CPU accepted offer to double');
        setTimeout(() => setCpuDoubleMessage(null), 3000);
      }
    };
    
    // Small delay for UI feedback
    setTimeout(handleCpuDoubleDecision, 800);
  }, [isCpuGame, doubleOffer, cpuPlayer, cpuDifficulty]);

  // CPU move execution after dice are rolled - continue making moves until all dice used
  useEffect(() => {
    if (isCpuGame && !gameOver && currentPlayer === cpuPlayer && hasRolled && !isCpuThinking && !firstRollPhase && screen === 'cpu' && !awaitingEndTurn && !allDiceUsed() && hasAnyValidMoves() && !doubleOffer) {
      setIsCpuThinking(true);
      
      const thinkingTime = getThinkingTime(cpuDifficulty);
      
      setTimeout(() => {
        if (currentPlayer === cpuPlayer && hasRolled && !gameOver && isCpuGame && !firstRollPhase && !awaitingEndTurn && !doubleOffer) {
          executeCpuMove();
          // Don't reset isCpuThinking here - let executeCpuMove reset it after the move completes
        } else {
          setIsCpuThinking(false);
        }
      }, thinkingTime);
    }
  }, [isCpuGame, gameOver, currentPlayer, cpuPlayer, hasRolled, isCpuThinking, cpuDifficulty, screen, firstRollPhase, awaitingEndTurn, usedDice, movesAllowed, checkers, doubleOffer]);

  // Auto-end CPU turn when all dice used or no moves available
  useEffect(() => {
    if (isCpuGame && !gameOver && currentPlayer === cpuPlayer && awaitingEndTurn && !firstRollPhase && screen === 'cpu') {
      // Small delay to ensure move animations complete
      const timeoutId = setTimeout(() => {
        if (currentPlayer === cpuPlayer && awaitingEndTurn && isCpuGame && !gameOver) {
          handleEndTurn();
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isCpuGame, gameOver, currentPlayer, cpuPlayer, awaitingEndTurn, firstRollPhase, screen]);

  // Helper functions
  function allDiceUsed() {
    return usedDice.length >= movesAllowed.length;
  }

  function canBearOffReact() {
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let checkersOutside = checkers.reduce((sum, c) => {
      if (c.player === currentPlayer && !homeQuadrant.includes(c.point) && c.point !== 24 && c.point !== -1) sum++;
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
      if (usedDice.includes(i)) continue;
      let die = movesAllowed[i];
      let entryPoint;
      if (barChecker.player === 1) {
        entryPoint = die - 1;
      } else {
        entryPoint = 24 - die;
      }
      let pointCheckers = checkers.filter(c => c.point === entryPoint);
      if (entryPoint >= 0 && entryPoint <= 23 && (pointCheckers.length === 0 || pointCheckers[0].player === barChecker.player || pointCheckers.length === 1)) {
        results.push({ dest: entryPoint, steps: 1, dieIndex: i });
      }
    }
    return results;
  }

  function hasAnyValidMoves() {
    if (bar[currentPlayer].length > 0) {
      const barChecker = bar[currentPlayer][bar[currentPlayer].length - 1];
      const barMoves = getBarEntryMoves(barChecker, movesAllowed, usedDice);
      return barMoves.length > 0;
    }
    
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let playerCheckers = checkers.filter(c => c.player === currentPlayer && homeQuadrant.includes(c.point));
    let availableDice = movesAllowed.filter((d, i) => !usedDice.includes(i));
    
    let canBear = canBearOffReact();
    
    if (canBear) {
      for (let checker of playerCheckers) {
        let distance = currentPlayer === 1 ? 24 - checker.point : checker.point + 1;
        let farthestDistance = currentPlayer === 1
          ? Math.max(...playerCheckers.map(c => 24 - c.point))
          : Math.max(...playerCheckers.map(c => c.point + 1));
        let isFarthest = (currentPlayer === 1 && (24 - checker.point) === farthestDistance) || 
                         (currentPlayer === 2 && (checker.point + 1) === farthestDistance);
        
        for (let d of availableDice) {
          if (d === distance || (d > distance && isFarthest)) {
            return true;
          }
        }
      }
    }
    
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
        }
        
        if (tempMoves.size > 0) {
          return true;
        }
      }
    }
    return false;
  }

  const showEndTurn = awaitingEndTurn && (allDiceUsed() || !hasAnyValidMoves());

  // Auto-select bar checker after rolling
  useEffect(() => {
    if (hasRolled && bar[currentPlayer].length > 0) {
      const barChecker = bar[currentPlayer][bar[currentPlayer].length - 1];
      setSelected(barChecker);
      calculateLegalMoves(barChecker);
    }
  }, [hasRolled, bar, movesAllowed, currentPlayer]);

  // After rolling, check for no valid moves
  useEffect(() => {
    if (hasRolled && movesAllowed && movesAllowed[0] != null && !noMoveOverlay) {
      const found = hasAnyValidMoves();
      if (!found && usedDice.length === 0) {
        setNoMoveOverlay(true);
        setLastNoMoveDice([...movesAllowed]);
      }
      if (!found && usedDice.length > 0) {
        setNoMoveOverlay('noMore');
        setLastNoMoveDice([...movesAllowed]);
      }
    }
  }, [hasRolled, movesAllowed, usedDice, bar, checkers, currentPlayer, noMoveOverlay]);

  // Set awaitingEndTurn after all dice are used or no valid moves remain
  useEffect(() => {
    if (
      hasRolled &&
      (allDiceUsed() || !hasAnyValidMoves()) &&
      (usedDice.length > 0 || !hasAnyValidMoves())
    ) {
      setAwaitingEndTurn(true);
    }
  }, [usedDice, checkers, hasRolled, moveMade, noMoveOverlay]);

  // Auto-end turn if no legal moves (not a forfeit - only timeout is forfeit)
  useEffect(() => {
    // Only auto-end if all dice are used OR no valid moves remain AND we've made at least one move
    const shouldAutoEnd = 
      !gameOver &&
      hasRolled &&
      !awaitingEndTurn &&
      !isRolling &&
      !firstRollPhase &&
      (screen === 'passplay' || screen === 'onlineGame') &&
      usedDice.length > 0 &&
      (allDiceUsed() || !hasAnyValidMoves());
    
    if (shouldAutoEnd) {
      // Small delay to ensure UI updates and state is current
      const timeoutId = setTimeout(() => {
        // Double-check conditions before ending turn - must have used dice and no valid moves
        if (!gameOver && hasRolled && usedDice.length > 0 && !awaitingEndTurn && !isRolling) {
          const stillNoMoves = !hasAnyValidMoves();
          const allUsed = allDiceUsed();
          if (stillNoMoves || allUsed) {
            console.log('Auto-ending turn: no valid moves available or all dice used');
            handleEndTurn();
          }
        }
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [hasRolled, usedDice, checkers, bar, movesAllowed, awaitingEndTurn, isRolling, firstRollPhase, gameOver, screen, currentPlayer]);

  // Global click handler to deselect
  useEffect(() => {
    function handleGlobalClick(e) {
      if (!selected) return;
      if (svgRef.current && svgRef.current.contains(e.target)) {
        const target = e.target;
        const hasSpecificHandler = target.closest('[data-triangle]') || 
                                  target.closest('[data-bearoff]') ||
                                  target.closest('[data-bearoff-checker]') ||
                                  target.closest('[data-checker]') ||
                                  target.tagName === 'text';
        if (hasSpecificHandler) return;
        setSelected(null);
        setLegalMoves([]);
        return;
      }
      setSelected(null);
      setLegalMoves([]);
    }
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [selected, legalMoves]);

  // Calculate legal moves function
  function calculateLegalMoves(selectedChecker) {
    let from = selectedChecker.point;
    let availableDice = movesAllowed.filter((d, i) => !usedDice.includes(i));
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let canBear = canBearOffReact();
    let moves = new Set();
    
    // Bar entry logic
    if (from === 24 || from === -1) {
      for (let i = 0; i < movesAllowed.length; i++) {
        if (usedDice.includes(i)) continue;
        let die = movesAllowed[i];
        let entryPoint = currentPlayer === 1 ? die - 1 : 24 - die;
        let pointCheckers = checkers.filter(c => c.point === entryPoint);
        if (entryPoint >= 0 && entryPoint <= 23 && (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1)) {
          moves.add(`${entryPoint}|1|bar|${i}`);
        }
      }
      
      // Only allow multimove (sum) bar entry if there's exactly 1 piece on the bar
      // If multiple pieces are on the bar, all must enter individually before any other moves
      // Skip multimove if there are 2 or more pieces on the bar
      if (bar[currentPlayer].length > 1) {
        setLegalMoves(Array.from(moves));
        return;
      }
      if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0 && bar[currentPlayer].length === 1) {
        let d1 = movesAllowed[0], d2 = movesAllowed[1];
        let sum = d1 + d2;
        let entryPoint = currentPlayer === 1 ? sum - 1 : 24 - sum;
        
        // Check if intermediate point is valid (required for multimove)
        let intermediatePoint = currentPlayer === 1 ? d1 - 1 : 24 - d1;
        let intermediateCheckers = checkers.filter(c => c.point === intermediatePoint);
        let intermediateValid = intermediatePoint >= 0 && intermediatePoint <= 23 && 
                               (intermediateCheckers.length === 0 || intermediateCheckers[0].player === currentPlayer || intermediateCheckers.length === 1);
        
        // Only allow multimove if intermediate point is valid AND final point is valid
        if (entryPoint >= 0 && entryPoint <= 23 && intermediateValid) {
          let endCheckers = checkers.filter(c => c.point === entryPoint);
          if (endCheckers.length === 0 || endCheckers[0].player === currentPlayer || endCheckers.length === 1) {
            moves.add(`${entryPoint}|2|bar|sum`);
          }
        }
      }
      
      setLegalMoves(Array.from(moves));
      return;
    }
    
    // If there are pieces on the bar, only bar entry moves are allowed
    if (bar[currentPlayer].length > 0) {
      setLegalMoves([]);
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
      let distance = currentPlayer === 1 ? 24 - from : from + 1;
      let playerCheckers = checkers.filter(c => c.player === currentPlayer && homeQuadrant.includes(c.point));
      let farthestDistance = currentPlayer === 1
        ? Math.max(...playerCheckers.map(c => 24 - c.point))
        : Math.max(...playerCheckers.map(c => c.point + 1));
      let isFarthest = (currentPlayer === 1 && (24 - from) === farthestDistance) || 
                       (currentPlayer === 2 && (from + 1) === farthestDistance);
      
      for (let i = 0; i < movesAllowed.length; i++) {
        if (usedDice.includes(i)) continue;
        let d = movesAllowed[i];
        let canUseThisDie = false;
        
        if (d === distance) {
          canUseThisDie = true;
        } else if (d > distance && isFarthest) {
          canUseThisDie = true;
        } else if (d > distance) {
          let otherCheckersCanBearOff = false;
          for (let otherChecker of playerCheckers) {
            if (otherChecker.point === from) continue;
            let otherDistance = currentPlayer === 1 ? 24 - otherChecker.point : otherChecker.point + 1;
            let otherIsFarthest = (currentPlayer === 1 && (24 - otherChecker.point) === farthestDistance) || 
                                 (currentPlayer === 2 && (otherChecker.point + 1) === farthestDistance);
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
          if (!otherCheckersCanBearOff) {
            canUseThisDie = true;
          }
        }
        
        if (canUseThisDie) {
          if (movesAllowed.length === 4 && movesAllowed.every(x => x === movesAllowed[0])) {
            let dieUsageCount = usedDice.filter(usedIndex => usedIndex === i).length;
            if (dieUsageCount < 2) {
              moves.add('bearoff');
            }
          } else {
            if (!usedDice.includes(i)) {
              moves.add('bearoff');
            }
          }
        }
      }
      
      if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
        let d1 = movesAllowed[0], d2 = movesAllowed[1];
        if (d1 + d2 === distance) {
          let mid = currentPlayer === 1 ? from + d1 : from - d1;
          if (mid >= 0 && mid <= 23) {
            let midCheckers = checkers.filter(c => c.point === mid);
            if (midCheckers.length === 0 || midCheckers[0].player === currentPlayer || midCheckers.length === 1) {
              moves.add(`bearoff|sum|0,1`);
            }
          }
        }
      }
      
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
          if (valid) {
            let finalDistance = currentPlayer === 1 ? 24 - pos : pos + 1;
            if (finalDistance <= d) {
              moves.add(`bearoff|multimove|${steps}`);
            }
          }
        }
      }
    }
    
    // Multi-move highlighting for regular moves
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
    
    // Multi-move highlighting for doubles
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

  function findDieIndexForMove(from, to, movesAllowed, usedDice, isBarEntry = false, player = null) {
    if (isBarEntry) {
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
          if (movesAllowed[i] === expected) {
            return i;
          }
        }
      }
      return -1;
    }
  }

  // Helper function to send game events via Socket.io for online games
  const sendGameEvent = (eventType, data) => {
    if (isOnlineGame && socketRef.current && matchId && currentPlayer === playerNumber) {
      socketRef.current.emit(`game:${eventType}`, {
        matchId,
        player: playerNumber,
        ...data
      });
    }
  };

  function handlePointClick(point, allowCpu = false) {
    if (gameOver) return;
    // Prevent player interaction when it's CPU's turn (unless allowCpu is true for programmatic CPU moves)
    if (!allowCpu && isCpuGame && currentPlayer === cpuPlayer) return;
    // Prevent player interaction when it's not their turn in online game
    if (isOnlineGame && currentPlayer !== playerNumber) return;
    let match;
    const from = selected ? selected.point : null;
    
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
    
    match = legalMoves.find(m => (typeof m === 'string' && m.split('|')[0] == point) || m == point);
    let dest = typeof match === 'string' && match.includes('|') ? parseInt(match.split('|')[0], 10) : point;
    if (!selected || match == null) return;
    
    // Don't add CPU moves to undo stack
    if (!allowCpu) {
      setUndoStack(stack => [{
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
      }, ...stack]);
      setMoveMade(true);
    }
    
    handleRegularMove(selected, dest, match);
  }

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
    
    // Don't add CPU moves to undo stack
    if (!(isCpuGame && currentPlayer === cpuPlayer)) {
      setUndoStack(stack => [{
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
      }, ...stack]);
      setMoveMade(true);
    }
    
    let newCheckers = checkers.filter(c => c.id !== checker.id);
    let newBorneOff = { ...borneOff };
    newBorneOff[currentPlayer]++;
    let newUsedDice = [...usedDice, dieIndex];
    
    setCheckers(newCheckers);
    setUsedDice(newUsedDice);
    setBorneOff(newBorneOff);
    
    if (newBorneOff[currentPlayer] === 15) {
      triggerGameOver('win', currentPlayer, currentPlayer === 1 ? 2 : 1);
      return;
    }
    
    setSelected(null);
    setLegalMoves([]);
    if (allDiceUsed() || !hasAnyValidMoves()) {
      setAwaitingEndTurn(true);
    }
    
    // Send move to server for online games
    if (isOnlineGame && !allowCpu && currentPlayer === playerNumber && socketRef.current && matchId) {
      socketRef.current.emit('game:move', {
        matchId,
        player: playerNumber,
        move: { moveType: 'bearoff', checker: checker.id },
        gameState: {
          checkers: newCheckers,
          bar: bar,
          borneOff: newBorneOff,
          usedDice: newUsedDice
        }
      });
    }
  }

  function handleSumBearoff(checker, point) {
    let [, , idxStr] = point.split('|');
    let [i, j] = idxStr.split(',').map(Number);
    if (usedDice.includes(i) || usedDice.includes(j)) return;
    
    // Don't add CPU moves to undo stack
    if (!(isCpuGame && currentPlayer === cpuPlayer)) {
      setUndoStack(stack => [{
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
      }, ...stack]);
      setMoveMade(true);
    }
    
    let newCheckers = checkers.filter(c => c.id !== checker.id);
    let newBorneOff = { ...borneOff };
    newBorneOff[currentPlayer]++;
    let newUsedDice = [...usedDice, i, j];
    
    setCheckers(newCheckers);
    setUsedDice(newUsedDice);
    setBorneOff(newBorneOff);
    
    if (newBorneOff[currentPlayer] === 15) {
      triggerGameOver('win', currentPlayer, currentPlayer === 1 ? 2 : 1);
      return;
    }
    
    setSelected(null);
    setLegalMoves([]);
    if (allDiceUsed() || !hasAnyValidMoves()) {
      setAwaitingEndTurn(true);
    }
    
    // Send move to server for online games
    if (isOnlineGame && !allowCpu && currentPlayer === playerNumber && socketRef.current && matchId) {
      socketRef.current.emit('game:move', {
        matchId,
        player: playerNumber,
        move: { moveType: 'bearoff-sum', checker: checker.id, point: point },
        gameState: {
          checkers: newCheckers,
          bar: bar,
          borneOff: newBorneOff,
          usedDice: newUsedDice
        }
      });
    }
  }

  function handleMultimoveBearoff(checker, point) {
    let [, , stepsStr] = point.split('|');
    let steps = parseInt(stepsStr, 10);
    let availableDice = [];
    for (let i = 0; i < movesAllowed.length; i++) {
      if (!usedDice.includes(i)) {
        availableDice.push(i);
      }
    }
    let dieIndexes = availableDice.slice(0, steps);
    if (dieIndexes.length !== steps) return;
    
    // Don't add CPU moves to undo stack
    if (!(isCpuGame && currentPlayer === cpuPlayer)) {
      setUndoStack(stack => [{
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
      }, ...stack]);
      setMoveMade(true);
    }
    
    let newCheckers = checkers.filter(c => c.id !== checker.id);
    let newBorneOff = { ...borneOff };
    newBorneOff[currentPlayer]++;
    let newUsedDice = [...usedDice, ...dieIndexes];
    
    setCheckers(newCheckers);
    setUsedDice(newUsedDice);
    setBorneOff(newBorneOff);
    
    if (newBorneOff[currentPlayer] === 15) {
      triggerGameOver('win', currentPlayer, currentPlayer === 1 ? 2 : 1);
      return;
    }
    
    setSelected(null);
    setLegalMoves([]);
    if (allDiceUsed() || !hasAnyValidMoves()) {
      setAwaitingEndTurn(true);
    }
    
    // Send move to server for online games
    if (isOnlineGame && !allowCpu && currentPlayer === playerNumber && socketRef.current && matchId) {
      socketRef.current.emit('game:move', {
        matchId,
        player: playerNumber,
        move: { moveType: 'bearoff-multimove', checker: checker.id, point: point },
        gameState: {
          checkers: newCheckers,
          bar: bar,
          borneOff: newBorneOff,
          usedDice: newUsedDice
        }
      });
    }
  }

  function handleRegularMove(checker, dest, match) {
    let from = checker.point;
    
    if (from === 24 || from === -1) {
      if (typeof match === 'string' && match.includes('|bar|')) {
        let [, stepsStr, , typeStr] = match.split('|');
        let steps = parseInt(stepsStr, 10);
        let newCheckers = checkers.filter(c => c.id !== checker.id);
        let newBar = { ...bar, [currentPlayer]: bar[currentPlayer].filter(c => c.id !== checker.id) };
        let newBorneOff = { ...borneOff };
        let newUsedDice = [...usedDice];
        
        if (steps === 1) {
          let dieIndex = parseInt(match.split('|')[3], 10);
          let newChecker = { ...checker, point: dest, offset: newCheckers.filter(c => c.point === dest).length };
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
        } else if (steps === 2 && typeStr === 'sum') {
          // Prevent multimove bar entry if there are multiple pieces on the bar
          // All pieces must enter individually before any other moves
          if (bar[currentPlayer].length > 1) {
            setMessage('All pieces must enter from the bar individually before using multimove');
            return;
          }
          let d1 = movesAllowed[0], d2 = movesAllowed[1];
          let intermediatePoint = currentPlayer === 1 ? d1 - 1 : 24 - d1;
          let pointCheckers = newCheckers.filter(c => c.point === intermediatePoint);
          if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
            let hitChecker = pointCheckers[0];
            let barChecker = { ...hitChecker, point: hitChecker.player === 1 ? 24 : -1, offset: newBar[hitChecker.player].length };
            newBar[hitChecker.player] = [...newBar[hitChecker.player], barChecker];
            newCheckers = newCheckers.filter(c => c.id !== hitChecker.id);
          }
          pointCheckers = newCheckers.filter(c => c.point === dest);
          if (pointCheckers.length === 1 && pointCheckers[0].player !== currentPlayer) {
            let hitChecker = pointCheckers[0];
            let barChecker = { ...hitChecker, point: hitChecker.player === 1 ? 24 : -1, offset: newBar[hitChecker.player].length };
            newBar[hitChecker.player] = [...newBar[hitChecker.player], barChecker];
            newCheckers = newCheckers.filter(c => c.id !== hitChecker.id);
          }
          let newChecker = { ...checker, point: dest, offset: newCheckers.filter(c => c.point === dest).length };
          newCheckers.push(newChecker);
          newUsedDice.push(0, 1);
        }
        
        setCheckers(newCheckers);
        setBar(newBar);
        setBorneOff(newBorneOff);
        setUsedDice(newUsedDice);
        setSelected(null);
        setLegalMoves([]);
        setMoveMade(true);
        
        // Send move to server for online games
        if (isOnlineGame && currentPlayer === playerNumber && socketRef.current && matchId) {
          socketRef.current.emit('game:move', {
            matchId,
            player: playerNumber,
            move: { from: from, to: dest, match: match },
            gameState: {
              checkers: newCheckers,
              bar: newBar,
              borneOff: newBorneOff,
              usedDice: newUsedDice
            }
          });
        }
        return;
      }
    }
    
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
        setCheckers(newCheckers);
        setBar(newBar);
        setBorneOff(newBorneOff);
        setUsedDice(newUsedDice);
        setSelected(null);
        setLegalMoves([]);
        setMoveMade(true);
        
        // Send move to server for online games
        if (isOnlineGame && currentPlayer === playerNumber && socketRef.current && matchId) {
          socketRef.current.emit('game:move', {
            matchId,
            player: playerNumber,
            move: { moveType: 'multimove-doubles', from: from, to: destLocal, steps: steps, match: match },
            gameState: {
              checkers: newCheckers,
              bar: newBar,
              borneOff: newBorneOff,
              usedDice: newUsedDice
            }
          });
        }
        return;
      }
      
      if (movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && match.endsWith('|sum')) {
        let d1 = movesAllowed[0], d2 = movesAllowed[1];
        let newCheckers = [...checkers];
        let newBar = { ...bar };
        let newBorneOff = { ...borneOff };
        let pos = from;
        let movingChecker = checker;
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
          setCheckers(newCheckers);
          setBar(newBar);
          setBorneOff(newBorneOff);
          setUsedDice(newUsedDice);
          setSelected(null);
          setLegalMoves([]);
          setMoveMade(true);
          
          // Send move to server for online games
          if (isOnlineGame && currentPlayer === playerNumber && socketRef.current && matchId) {
            socketRef.current.emit('game:move', {
              matchId,
              player: playerNumber,
              move: { moveType: 'multimove-sum', from: from, to: dest, match: match },
              gameState: {
                checkers: newCheckers,
                bar: newBar,
                borneOff: newBorneOff,
                usedDice: newUsedDice
              }
            });
          }
          return;
        }
      }
    }
    
    let dieIndex = findDieIndexForMove(from, dest, movesAllowed, usedDice, false, currentPlayer);
    if (dieIndex === -1) return;
    
    let newCheckers = [...checkers];
    let newBar = { ...bar };
    let newBorneOff = { ...borneOff };
    
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
    setCheckers(newCheckers);
    setBar(newBar);
    setBorneOff(newBorneOff);
    setUsedDice(newUsedDice);
    setSelected(null);
    setLegalMoves([]);
    setMoveMade(true);
    
    // Send move to server for online games
    if (isOnlineGame && currentPlayer === playerNumber && socketRef.current && matchId) {
      socketRef.current.emit('game:move', {
        matchId,
        player: playerNumber,
        move: { moveType: 'regular', from: from, to: dest, match: match },
        gameState: {
          checkers: newCheckers,
          bar: newBar,
          borneOff: newBorneOff,
          usedDice: newUsedDice
        }
      });
    }
  }

  const confirmResign = () => setShowConfirmResign(true);
  const cancelResign = () => setShowConfirmResign(false);
  const doResign = () => {
    setShowConfirmResign(false);
    triggerGameOver('resign', currentPlayer === 1 ? 2 : 1, currentPlayer);
  };

  const offerDouble = () => {
    if (!canDouble[currentPlayer]) return;
    const toPlayer = currentPlayer === 1 ? 2 : 1;
    
    // In CPU games, if player is offering to CPU, CPU will decide automatically via useEffect
    // Don't show player decision prompt in this case
    if (isCpuGame && toPlayer === cpuPlayer) {
      // CPU will decide automatically - just set the offer state
      setDoubleOffer({ from: currentPlayer, to: toPlayer });
      // Timer won't run for CPU decisions (handled in timer useEffect)
      setDoubleTimer(12);
    } else {
      // Normal flow: show decision prompt
      setDoubleOffer({ from: currentPlayer, to: toPlayer });
      setDoubleTimer(12);
    }
  };

  const handleDoubleResponse = (accepted) => {
    if (accepted) {
      setGameStakes(prev => prev * 2);
      // When a double is accepted:
      // - The person who accepted (currentPlayer/doubleOffer.to) gains the right to offer next
      // - The person who offered (doubleOffer.from) loses the right until the other player offers
      setCanDouble(prev => ({ ...prev, [doubleOffer.from]: false, [doubleOffer.to]: true }));
      setDoubleOffer(null);
      setDoubleTimer(12);
    } else {
      setDoubleOffer(null);
      setDoubleTimer(12);
      triggerGameOver('double', doubleOffer.from, doubleOffer.to);
    }
  };

  const rollDice = () => {
    if (gameOver) return;
    if (hasRolled) return;
    // Prevent rolling when it's not your turn in online games
    if (isOnlineGame && currentPlayer !== playerNumber) return;
    
    setMessage('');
    setNoMoveOverlay(false);
    setLastNoMoveDice(null);
    if (nextPlayerRef.current !== null) {
      setCurrentPlayer(nextPlayerRef.current);
      nextPlayerRef.current = null;
    }
    
    setIsRolling(true);
    setAnimationFrame(0);
    
    // Send rolling animation start to server for online games
    if (isOnlineGame && currentPlayer === playerNumber && socketRef.current && matchId) {
      socketRef.current.emit('game:dice-roll-start', {
        matchId,
        player: playerNumber
      });
    }
    
    const rollInterval = setInterval(() => {
      const rollingValues = [
        1 + Math.floor(Math.random() * 6),
        1 + Math.floor(Math.random() * 6)
      ];
      setRollingDice(rollingValues);
      setAnimationFrame(prev => (prev + 1) % 7);
        }, 50);
    
    setTimeout(() => {
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
      setSelected(null);
      setLegalMoves([]);
      
      // Send dice roll result to server for online games
      if (isOnlineGame && currentPlayer === playerNumber && socketRef.current && matchId) {
        socketRef.current.emit('game:dice-roll', {
          matchId,
          player: playerNumber,
          dice: d,
          movesAllowed: moves
        });
      }
    }, 600);
  };

  function handleFirstRoll() {
    // Prevent rolling when it's not your turn in online games
    if (isOnlineGame && firstRollTurn !== playerNumber) return;
    
    setIsFirstRolling(true);
    setFirstRollAnimationFrame(0);
    
    // Send first roll animation start to server for online games
    if (isOnlineGame && socketRef.current && matchId) {
      socketRef.current.emit('game:first-roll-start', {
        matchId,
        player: playerNumber,
        rollTurn: firstRollTurn
      });
    }
    
    const firstRollInterval = setInterval(() => {
      setFirstRollAnimationFrame(prev => (prev + 1) % 7);
        }, 50);
    
    setTimeout(() => {
      clearInterval(firstRollInterval);
      setIsFirstRolling(false);
      setFirstRollAnimationFrame(0);
      
      const roll = 1 + Math.floor(Math.random() * 6);
      let newRolls = [...firstRolls];
      newRolls[firstRollTurn - 1] = roll;
      setFirstRolls(newRolls);
      
      if (firstRollTurn === 1) {
        // Send first roll to server for online games BEFORE updating local state
        if (isOnlineGame && socketRef.current && matchId) {
          socketRef.current.emit('game:first-roll', {
            matchId,
            player: playerNumber,
            roll: roll,
            rollTurn: 1,
            nextRollTurn: 2
          });
        }
        setFirstRollTurn(2);
      } else {
        // Show result first, then close modal after delay
        if (newRolls[0] > newRolls[1]) {
          setFirstRollResult(1);
          // Wait longer so both players can see the result
          setTimeout(() => {
            setCurrentPlayer(1);
            setFirstRollPhase(false);
            setHasRolled(true);
            setDice([newRolls[0], newRolls[1]]);
            setUsedDice([]);
            setMovesAllowed(newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]);
            
            // Send first roll result to server for online games
            if (isOnlineGame && socketRef.current && matchId) {
              socketRef.current.emit('game:first-roll-complete', {
                matchId,
                firstRolls: newRolls,
                winner: 1,
                currentPlayer: 1,
                dice: [newRolls[0], newRolls[1]],
                movesAllowed: newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]
              });
            }
          }, 2500);
        } else if (newRolls[1] > newRolls[0]) {
          setFirstRollResult(2);
          // Wait longer so both players can see the result
          setTimeout(() => {
            setCurrentPlayer(2);
            setFirstRollPhase(false);
            setHasRolled(true);
            setDice([newRolls[0], newRolls[1]]);
            setUsedDice([]);
            setMovesAllowed(newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]);
            
            // Send first roll result to server for online games
            if (isOnlineGame && socketRef.current && matchId) {
              socketRef.current.emit('game:first-roll-complete', {
                matchId,
                firstRolls: newRolls,
                winner: 2,
                currentPlayer: 2,
                dice: [newRolls[0], newRolls[1]],
                movesAllowed: newRolls[0] === newRolls[1] ? [newRolls[0], newRolls[0], newRolls[0], newRolls[0]] : [newRolls[0], newRolls[1]]
              });
            }
          }, 2500);
        } else {
          setFirstRollResult('tie');
          setTimeout(() => {
            setFirstRolls([null, null]);
            setFirstRollTurn(1);
            setFirstRollResult(null);
            setIsFirstRolling(false);
            setFirstRollAnimationFrame(0);
            
            // Send tie result to server for online games
            if (isOnlineGame && socketRef.current && matchId) {
              socketRef.current.emit('game:first-roll-tie', {
                matchId
              });
            }
          }, 1500);
        }
      }
    }, 600);
  }

  function handleUndo() {
    if (gameOver) return;
    if (!undoStack.length) return;
    // Prevent undoing CPU moves in CPU games
    if (isCpuGame && currentPlayer === cpuPlayer) return;
    const prev = undoStack[0];
    setCheckers(prev.checkers);
    setBar(prev.bar);
    setBorneOff(prev.borneOff);
    setUsedDice(prev.usedDice);
    setSelected(null);
    setLegalMoves([]);
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
    if (allDiceUsed() || !hasAnyValidMoves()) {
      setAwaitingEndTurn(true);
    } else {
      setAwaitingEndTurn(false);
      setNoMoveOverlay(false);
    }
  }

  function handleEndTurn() {
    if (gameOver) return;
    setNoMoveOverlay(false);
    setLastNoMoveDice(null);
    setHasRolled(false);
    setSelected(null);
    setLegalMoves([]);
    setUsedDice([]);
    setMoveMade(false);
    const nextPlayer = 3 - currentPlayer;
    setCurrentPlayer(nextPlayer);
    setAwaitingEndTurn(false);
    // Clear undo stack when CPU's turn starts (to prevent undoing CPU moves)
    if (isCpuGame && nextPlayer === cpuPlayer) {
      setUndoStack([]);
    }
    
    // Send turn change to server for online games
    if (isOnlineGame && currentPlayer === playerNumber && socketRef.current && matchId) {
      socketRef.current.emit('game:end-turn', {
        matchId,
        player: playerNumber,
        nextPlayer: nextPlayer,
        timer: timer,
        gameState: {
          checkers: checkers,
          bar: bar,
          borneOff: borneOff
        }
      });
    }
  }

  // Prepare game state for AI
  function getGameStateForAI() {
    // Format checkers for Python backend (ensure it's an array of objects with player and point)
    const formattedCheckers = checkers.map(c => ({
      player: c.player,
      point: c.point
    }));
    
    return {
      checkers: formattedCheckers,
      bar: bar,
      borneOff: borneOff,
      currentPlayer: currentPlayer,
      movesAllowed: movesAllowed,
      usedDice: usedDice,
      dice: dice,
      gameStakes: gameStakes
    };
  }

  // Update position evaluation for the evaluation bar (updates after every move and during CPU thinking)
  useEffect(() => {
    if (gameOver || firstRollPhase || screen === 'home' || screen === 'cpu-difficulty') {
      setPositionEvaluation(0);
      return;
    }

    let cancelled = false;
    let timeoutId = null;

    const updateEvaluation = async () => {
      if (cancelled) return;
      try {
        const gameState = getGameStateForAI();
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${BACKEND_URL}/api/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameState })
        });
        if (!cancelled && response.ok) {
          const data = await response.json();
          const evalValue = data.evaluation;
          if (typeof evalValue === 'number' && !isNaN(evalValue)) {
            setPositionEvaluation(prevEval => {
              // Only log if the value actually changed significantly to avoid spam
              if (Math.abs(prevEval - evalValue) > 0.0001) {
                console.log('Evaluation updated:', prevEval.toFixed(4), '->', evalValue.toFixed(4));
              }
              return evalValue;
            });
          } else {
            console.warn('Invalid evaluation value received:', evalValue, data);
            // Don't reset to 0 on invalid value, keep previous evaluation
          }
        } else if (!cancelled) {
          console.error('Evaluation request failed:', response.status, response.statusText);
          // Don't reset to 0 on error, keep previous evaluation
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching position evaluation:', error);
          // Don't reset to 0 on error, keep previous evaluation
        }
      }
    };

    // Use a debounced approach: cancel any pending request and start a new one after a short delay
    // This ensures we only make one request per state change, using the latest state
    timeoutId = setTimeout(updateEvaluation, 100); // Small delay to batch rapid state changes
    
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [checkers, bar, borneOff, gameOver, firstRollPhase, hasRolled, moveMade, isCpuThinking, currentPlayer, screen, dice, usedDice]);

  // Execute CPU move - continues until all dice are used or no moves available
  async function executeCpuMove() {
    if (gameOver || currentPlayer !== cpuPlayer || !hasRolled || firstRollPhase || doubleOffer) return;
    
    // Check if all dice are used or no moves available
    if (allDiceUsed() || !hasAnyValidMoves()) {
      handleEndTurn();
      return;
    }
    
    try {
      // Collect all possible moves with their checkers
      const allPossibleMoves = [];
      
      // Check bar entry moves
      if (bar[currentPlayer].length > 0) {
        const barChecker = bar[currentPlayer][bar[currentPlayer].length - 1];
        const tempLegalMoves = calculateLegalMovesSync(barChecker);
        tempLegalMoves.forEach(move => {
          allPossibleMoves.push({ type: 'bar', move: move, checker: barChecker });
        });
      }
      
      // Check regular moves for each checker
      const playerCheckers = checkers.filter(c => c.player === currentPlayer && c.point !== 24 && c.point !== -1);
      for (const checker of playerCheckers) {
        const tempLegalMoves = calculateLegalMovesSync(checker);
        tempLegalMoves.forEach(move => {
          allPossibleMoves.push({ type: 'regular', move: move, checker: checker });
        });
      }
      
      // Check bearing off moves
      const homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
      if (canBearOffReact()) {
        const homeCheckers = checkers.filter(c => c.player === currentPlayer && homeQuadrant.includes(c.point));
        for (const checker of homeCheckers) {
          const tempLegalMoves = calculateLegalMovesSync(checker);
          tempLegalMoves.forEach(move => {
            if (typeof move === 'string' && move.includes('bearoff')) {
              allPossibleMoves.push({ type: 'bearoff', move: move, checker: checker });
            }
          });
        }
      }
      
      if (allPossibleMoves.length === 0) {
        // No valid moves, end turn
        handleEndTurn();
        return;
      }
      
      // Get game state for AI
      const gameState = getGameStateForAI();
      
      // Convert allPossibleMoves to legal moves format for AI service
      // The AI service needs a flat list of moves (point numbers or move strings)
      const legalMovesForAI = allPossibleMoves.map(m => m.move);
      
      // Call AI service to get best move
      let moveToExecute = allPossibleMoves[0]; // Default fallback
      if (!moveToExecute) {
        console.error('No possible moves available for CPU');
        handleEndTurn();
        return;
      }
      
      try {
        const bestMoveFromAI = await getCpuMove(gameState, cpuDifficulty, legalMovesForAI);
        if (bestMoveFromAI !== null && bestMoveFromAI !== undefined) {
          // Find the move object that matches the AI's recommendation
          const matchingMove = allPossibleMoves.find(m => {
            // Handle different move formats
            if (typeof bestMoveFromAI === 'number') {
              return m.move === bestMoveFromAI || (typeof m.move === 'number' && m.move === bestMoveFromAI);
            } else if (typeof bestMoveFromAI === 'string') {
              return String(m.move) === String(bestMoveFromAI);
            }
            return false;
          });
          if (matchingMove) {
            moveToExecute = matchingMove;
          } else {
            console.warn('AI recommended move not found in legal moves, using fallback:', bestMoveFromAI, 'Available moves:', allPossibleMoves.map(m => m.move));
          }
        } else {
          console.warn('AI service returned null/undefined move, using first available move as fallback');
        }
      } catch (error) {
        console.error('Error getting CPU move from AI service:', error);
        // Fall back to first move on error - moveToExecute is already set to allPossibleMoves[0]
      }
      
      // Ensure we have a valid move before proceeding
      if (!moveToExecute) {
        console.error('No valid move to execute after AI service call');
        handleEndTurn();
        return;
      }
      
      // Execute the move and continue after it completes
      const executeMoveAndContinue = () => {
        if (moveToExecute.type === 'bar') {
          // Handle bar entry
          const moveStr = String(moveToExecute.move);
          if (moveStr.includes('|')) {
            const destPoint = parseInt(moveStr.split('|')[0], 10);
            setSelected(moveToExecute.checker);
            calculateLegalMoves(moveToExecute.checker);
            // Use a small delay to ensure state is updated
            setTimeout(() => {
              handlePointClick(destPoint, true); // Allow CPU moves
              // Continue making moves after this one completes
              setTimeout(() => {
                setIsCpuThinking(false); // Reset thinking flag to allow next move
              }, 150);
            }, 50);
          }
        } else if (moveToExecute.type === 'bearoff') {
          // Handle bearing off - call the bearoff functions directly
          const moveStr = String(moveToExecute.move);
          setSelected(moveToExecute.checker);
          calculateLegalMoves(moveToExecute.checker);
          setTimeout(() => {
            if (moveStr === 'bearoff') {
              handleSingleBearoff(moveToExecute.checker);
            } else if (moveStr.startsWith('bearoff|sum|')) {
              handleSumBearoff(moveToExecute.checker, moveStr);
            } else if (moveStr.startsWith('bearoff|multimove|')) {
              handleMultimoveBearoff(moveToExecute.checker, moveStr);
            }
            // Continue making moves after this one completes
            setTimeout(() => {
              setIsCpuThinking(false); // Reset thinking flag to allow next move
            }, 150);
          }, 50);
        } else {
          // Handle regular move
          const moveStr = String(moveToExecute.move);
          let destPoint;
          if (typeof moveToExecute.move === 'number') {
            destPoint = moveToExecute.move;
          } else if (moveStr.includes('|')) {
            destPoint = parseInt(moveStr.split('|')[0], 10);
          } else {
            destPoint = parseInt(moveStr, 10);
          }
          
          setSelected(moveToExecute.checker);
          calculateLegalMoves(moveToExecute.checker);
          setTimeout(() => {
            handlePointClick(destPoint, true); // Allow CPU moves
              // Continue making moves after this one completes
              setTimeout(() => {
                setIsCpuThinking(false); // Reset thinking flag to allow next move
              }, 150);
          }, 50);
        }
      };
      
      executeMoveAndContinue();
      
    } catch (error) {
      console.error('Error executing CPU move:', error);
      // On error, end turn
      handleEndTurn();
    }
  }

  // Synchronous version of calculateLegalMoves for CPU (doesn't use state)
  function calculateLegalMovesSync(selectedChecker) {
    let from = selectedChecker.point;
    let availableDice = movesAllowed.filter((d, i) => !usedDice.includes(i));
    let homeQuadrant = currentPlayer === 1 ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
    let canBear = canBearOffReact();
    let moves = new Set();
    
    // Bar entry logic
    if (from === 24 || from === -1) {
      for (let i = 0; i < movesAllowed.length; i++) {
        if (usedDice.includes(i)) continue;
        let die = movesAllowed[i];
        let entryPoint = currentPlayer === 1 ? die - 1 : 24 - die;
        let pointCheckers = checkers.filter(c => c.point === entryPoint);
        if (entryPoint >= 0 && entryPoint <= 23 && (pointCheckers.length === 0 || pointCheckers[0].player === currentPlayer || pointCheckers.length === 1)) {
          moves.add(`${entryPoint}|1|bar|${i}`);
        }
      }
      
      if (bar[currentPlayer].length === 1 && movesAllowed.length === 2 && movesAllowed[0] !== movesAllowed[1] && usedDice.length === 0) {
        let d1 = movesAllowed[0], d2 = movesAllowed[1];
        let sum = d1 + d2;
        let entryPoint = currentPlayer === 1 ? sum - 1 : 24 - sum;
        
        // Check if intermediate point is valid (required for multimove)
        let intermediatePoint = currentPlayer === 1 ? d1 - 1 : 24 - d1;
        let intermediateCheckers = checkers.filter(c => c.point === intermediatePoint);
        let intermediateValid = intermediatePoint >= 0 && intermediatePoint <= 23 && 
                               (intermediateCheckers.length === 0 || intermediateCheckers[0].player === currentPlayer || intermediateCheckers.length === 1);
        
        // Only allow multimove if intermediate point is valid AND final point is valid
        if (entryPoint >= 0 && entryPoint <= 23 && intermediateValid) {
          let endCheckers = checkers.filter(c => c.point === entryPoint);
          if (endCheckers.length === 0 || endCheckers[0].player === currentPlayer || endCheckers.length === 1) {
            moves.add(`${entryPoint}|2|bar|sum`);
          }
        }
      }
      
      return Array.from(moves);
    }
    
    // If there are pieces on the bar, only bar entry moves are allowed
    if (bar[currentPlayer].length > 0) {
      return [];
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
    
    // Bearing off logic
    if (canBear && homeQuadrant.includes(from)) {
      let distance = currentPlayer === 1 ? 24 - from : from + 1;
      for (let i = 0; i < movesAllowed.length; i++) {
        if (usedDice.includes(i)) continue;
        let d = movesAllowed[i];
        if (d >= distance) {
          moves.add('bearoff');
        }
      }
    }
    
    // Multi-move highlighting for regular moves
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
    
    return Array.from(moves);
  }

  function triggerGameOver(type, winner, loser) {
    setGameOver({ type, winner, loser });
    setShowConfirmResign(false);
    setNoMoveOverlay(false);
    
    // Send game over to server for online games
    if (isOnlineGame && socketRef.current && matchId) {
      socketRef.current.emit('game:over', {
        matchId,
        gameOver: { type, winner, loser }
      });
    }
  }

  function getGameOverMessage(go) {
    if (!go) return '';
    const player1Name = 'Player 1';
    const player2Name = isCpuGame ? 'CPU' : 'Player 2';
    const winnerName = go.winner === 1 ? player1Name : player2Name;
    const loserName = go.loser === 1 ? player1Name : player2Name;
    
    if (go.type === 'win') return `${winnerName} wins!`;
    if (go.type === 'resign') return `${loserName} resigned. ${winnerName} wins!`;
    if (go.type === 'disconnect') return `${loserName} disconnected. ${winnerName} wins by default!`;
    if (go.type === 'double') return `${loserName} declined the double. ${winnerName} wins!`;
    if (go.type === 'timeout') return `${loserName} ran out of time. ${winnerName} wins by timeout!`;
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
    setTimer(45);
    setUndoStack([]);
    setMoveMade(false);
    setAwaitingEndTurn(false);
    setDoubleOffer(null);
    setDoubleTimer(12);
    setCanDouble({ 1: true, 2: true });
    setGameStakes(1);
    setNoMoveOverlay(false);
    setShowConfirmResign(false);
    setFirstRollPhase(true);
    setFirstRolls([null, null]);
    setFirstRollTurn(1);
    setFirstRollResult(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function handleQuit() {
    window.location.reload();
  }

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
      
      if (canBear && homeQuadrant.includes(from)) {
        let distance = currentPlayer === 1 ? 24 - from : from + 1;
        let homeCheckers = playerCheckers.filter(c => homeQuadrant.includes(c.point));
        let farthestDistance = currentPlayer === 1
          ? Math.max(...homeCheckers.map(c => 24 - c.point))
          : Math.max(...homeCheckers.map(c => c.point + 1));
        let isFarthest = (currentPlayer === 1 && (24 - from) === farthestDistance) || 
                         (currentPlayer === 2 && (from + 1) === farthestDistance);
        for (let d of availableDice) {
          if (d === distance || (d > distance && isFarthest)) {
            legal.add(from);
          }
        }
      }
    }
    
    return Array.from(legal);
  }

  function handleCheckerClick(checker) {
    if (!hasRolled) return;
    // Prevent player interaction when it's CPU's turn
    if (isCpuGame && currentPlayer === cpuPlayer) return;
    
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
        setSelected(null);
        setLegalMoves([]);
        return;
      }
    }
    
    if (selected && selected.id === checker.id) {
      setSelected(null);
      setLegalMoves([]);
      return;
    }
    
    if (!selected) {
      const legalFrom = getLegalFromPoints();
      if (legalFrom.includes(checker.point)) {
        const stack = checkers.filter(c => c.point === checker.point && c.player === currentPlayer);
        const topChecker = stack.reduce((a, b) => a.offset > b.offset ? a : b);
        setSelected(topChecker);
        calculateLegalMoves(topChecker);
      } else {
        setSelected(null);
        setLegalMoves([]);
      }
    } else {
      const legalFrom = getLegalFromPoints();
      if (legalFrom.includes(checker.point)) {
        const stack = checkers.filter(c => c.point === checker.point && c.player === currentPlayer);
        const topChecker = stack.reduce((a, b) => a.offset > b.offset ? a : b);
        setSelected(topChecker);
        calculateLegalMoves(topChecker);
      } else {
        setSelected(null);
        setLegalMoves([]);
      }
    }
  }

  function handleTriangleClick(idx) {
    if (!hasRolled) return;
    // Prevent player interaction when it's CPU's turn
    if (isCpuGame && currentPlayer === cpuPlayer) return;
    
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
        setSelected(null);
        setLegalMoves([]);
      }
      return;
    }
    
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

  function handleBarCheckerClick(barChecker) {
    if (!hasRolled) return;
    // Prevent player interaction when it's CPU's turn
    if (isCpuGame && currentPlayer === cpuPlayer) return;
    // Prevent selecting opponent's bar checkers in online games
    if (isOnlineGame && (currentPlayer !== playerNumber || barChecker.player !== playerNumber)) return;
    if (bar[currentPlayer].length > 0) {
      setSelected(barChecker);
      calculateLegalMoves(barChecker);
      return;
    }
  }

  // Checker component
  function Checker({ checker, x, y, isSelected, onClick, isSideways = false, dataTriangle = null }) {
    const baseX = x;
    const baseY = y;
    const transform = isSideways ? `rotate(90, ${baseX}, ${baseY})` : '';
    
    return (
      <g 
        transform={transform}
        onClick={onClick} 
        style={{ cursor: checker.player === currentPlayer && hasRolled && (!isCpuGame || currentPlayer !== cpuPlayer) ? 'pointer' : 'default' }}
        data-triangle={dataTriangle}
        data-checker="true"
      >
        <ellipse
          cx={baseX}
          cy={baseY + checkerSize * 0.18}
          rx={checkerSize * 0.44}
          ry={checkerSize * 0.18}
          fill="#000"
          opacity={0.13}
        />
        <circle
          cx={baseX}
          cy={baseY}
          r={checkerSize / 2}
          fill={checker.player === 1 ? '#fff' : '#111'}
          stroke={isSelected ? 'none' : '#000'}
          strokeWidth={isSelected ? 0 : 1.5}
          filter={isSelected ? 'url(#checker-glow)' : 'url(#checker-shadow)'}
        />
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

  // Render functions - these are very large, copied from old project
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
          <div style={{ marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #b3e0ff 60%, #e0f7fa 100%)', borderRadius: 12, display: 'inline-block', opacity: 0.5 }} />
          </div>
          <div style={{ display: 'flex', gap: 32, marginBottom: 18 }}>
            <div style={{ textAlign: 'center' }}>
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
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Player 1</div>
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
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{isCpuGame ? 'CPU' : 'Player 2'}</div>
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
          {(!firstRollResult && !isFirstRolling) && (
            <>
              {!isOnlineGame ? (
                // Not online game - show button for current turn
                <button
                  style={{ ...buttonStyle, minWidth: 160, marginTop: 8 }}
                  onClick={handleFirstRoll}
                >
                  {firstRollTurn === 1 ? 'Player 1: Roll' : (isCpuGame ? 'CPU: Roll' : 'Player 2: Roll')}
                </button>
              ) : (
                // Online game - show button only if it's this player's turn
                firstRollTurn === playerNumber ? (
                  <button
                    style={{ ...buttonStyle, minWidth: 160, marginTop: 8 }}
                    onClick={handleFirstRoll}
                  >
                    {firstRollTurn === 1 ? 'Player 1: Roll' : 'Player 2: Roll'}
                  </button>
                ) : (
                  <div style={{ color: '#666', marginTop: 8, fontSize: 16 }}>
                    Waiting for opponent to roll... (Turn: {firstRollTurn}, You: {playerNumber})
                  </div>
                )
              )}
            </>
          )}
          {firstRollResult === 1 && <div style={{ color: '#28a745', fontWeight: 600, fontSize: 20, marginTop: 16 }}>Player 1 goes first!</div>}
          {firstRollResult === 2 && <div style={{ color: '#007bff', fontWeight: 600, fontSize: 20, marginTop: 16 }}>{isCpuGame ? 'CPU goes first!' : 'Player 2 goes first!'}</div>}
          {firstRollResult === 'tie' && <div style={{ color: '#dc3545', fontWeight: 600, fontSize: 20, marginTop: 16 }}>Tie! Roll again.</div>}
        </div>
      </div>
    );
  }

  function renderBoard() {
    const legalFrom = getLegalFromPoints();
    const trianglePolys = [];
    
    // Top triangles (12-23)
    for (let i = 0; i < 12; i++) {
      let isRightHalf = i < 6;
      let idxTop = 12 + i;
      let xTop = boardX + triangleW * i;
      if (!isRightHalf) xTop += gap;
      let left = i === 0 ? xTop + 4 : xTop;
      let right = i === 11 ? xTop + triangleW - 4 : xTop + triangleW;
      const isBrown = (i % 2 === 0);
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
    
    // Bottom triangles (0-11)
    for (let i = 0; i < 12; i++) {
      let isRightHalf = i < 6;
      let idxBot = 11 - i;
      let xBot = boardX + triangleW * i;
      if (!isRightHalf) xBot += gap;
      let left = i === 0 ? xBot + 4 : xBot;
      let right = i === 11 ? xBot + triangleW - 4 : xBot + triangleW;
      const isBrown = ((i + 1) % 2 === 0);
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
    
    // Render checkers
    let allCheckers = [];
    let stackCountAll = Array(24).fill(0);
    for (let idx = 0; idx < 24; idx++) {
      const triangleCheckers = checkers.filter(c => c.point === idx);
      const stackLen = triangleCheckers.length;
      let maxStackHeight = triangleH - 8;
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
        let borderOffset = 4;
        let baseY = isBottom
          ? boardY + boardH - checkerSize / 2 - borderOffset
          : boardY + checkerSize / 2 + borderOffset;
        let y = baseY + (isBottom ? -1 : 1) * stackCountAll[c.point] * spacing;
        stackCountAll[c.point]++;
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
    
    // Bearing off rectangles
    const bearOffRects = [];
    const bearOffGap = 20;
    const bearOffRectH = (boardH - bearOffGap) / 2;
    const bearOffRectW = bearOffW - 10;
    const bearOffX = boardX + triangleW * 12 + gap + 5;
    const canBearOff1 = (legalMoves.includes('bearoff') || legalMoves.some(m => typeof m === 'string' && m.startsWith('bearoff|sum'))) && currentPlayer === 1;
    const canBearOff2 = (legalMoves.includes('bearoff') || legalMoves.some(m => typeof m === 'string' && m.startsWith('bearoff|sum'))) && currentPlayer === 2;
    let bearoffSumMove1 = legalMoves.find(m => typeof m === 'string' && m.startsWith('bearoff|sum'));
    let bearoffSumMove2 = legalMoves.find(m => typeof m === 'string' && m.startsWith('bearoff|sum'));
    
    bearOffRects.push(
      <rect
        key="bearoff-p1-main"
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
    bearOffRects.push(
      <rect
        key="bearoff-p2-main"
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
    
    // Borne-off checkers (these are clickable to bear off a selected piece)
    const checkerRectH = 8;
    const checkerRectW = bearOffRectW - 8;
    const checkerSpacing = 2;
    let borneOffRects1 = [];
    const p1StackStartY = boardY + 5 + bearOffRectH - 76 - checkerRectH;
    if (borneOff[1] > 0) {
      for (let i = 0; i < borneOff[1]; i++) {
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
            fill="#fff"
            stroke="#000"
            strokeWidth={1}
            opacity={0.9}
            style={{ cursor: (canBearOff1 && selected && currentPlayer === 1) ? 'pointer' : 'default' }}
            onClick={(canBearOff1 && selected && currentPlayer === 1) ? (e => { 
              e.stopPropagation(); 
              handlePointClick(bearoffSumMove1 || 'bearoff'); 
            }) : undefined}
            data-bearoff-checker="true"
          />
        );
      }
    }
    let borneOffRects2 = [];
    const p2StackStartY = boardY + bearOffRectH + bearOffGap + 5 + bearOffRectH - 16 - checkerRectH;
    if (borneOff[2] > 0) {
      for (let i = 0; i < borneOff[2]; i++) {
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
            fill="#111"
            stroke="#000"
            strokeWidth={1}
            opacity={0.9}
            style={{ cursor: (canBearOff2 && selected && currentPlayer === 2) ? 'pointer' : 'default' }}
            onClick={(canBearOff2 && selected && currentPlayer === 2) ? (e => { 
              e.stopPropagation(); 
              handlePointClick(bearoffSumMove2 || 'bearoff'); 
            }) : undefined}
            data-bearoff-checker="true"
          />
        );
      }
    }
    
    // Legal move highlights
    const legalMoveHighlights = legalMoves.map((move, idx) => {
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
    });
    
    // Calculate win probabilities from evaluation
    // evaluation range: -1 (CPU losing/Player 1 winning) to 1 (CPU winning/Player 1 losing)
    // Player 1 win probability = (1 - evaluation) / 2
    // CPU win probability = (1 + evaluation) / 2
    // Clamp probabilities to valid range [0, 1]
    // Convert evaluation (-1 to 1, where positive = CPU winning) to win probabilities (0 to 1)
    // Evaluation of 1 = CPU 100% win, Evaluation of -1 = Player 1 100% win
    // Evaluation of 0 = 50/50
    const cpuWinProb = Math.max(0, Math.min(1, (positionEvaluation + 1) / 2));
    const player1WinProb = 1 - cpuWinProb;
    const evalBarHeight = boardH;
    const evalBarWidth = 24;
    const evalBarX = 10;
    const evalBarY = boardY;
    
    // Debug: Log evaluation to see if it's changing
    console.log('Render Board - Evaluation:', positionEvaluation, 'P1 Prob:', player1WinProb, 'CPU Prob:', cpuWinProb);

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {/* Evaluation Bar */}
        <div style={{ width: evalBarWidth + 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width={evalBarWidth + 20} height={evalBarHeight + boardY * 2} style={{ margin: 10 }}>
            {/* White section (Player 1) on top */}
            <rect
              key={`eval-white-${positionEvaluation}`}
              x={10}
              y={evalBarY}
              width={evalBarWidth}
              height={evalBarHeight * player1WinProb}
              fill="#fff"
              stroke="#000"
              strokeWidth={1}
            />
            {/* Black section (CPU/Player 2) on bottom */}
            <rect
              key={`eval-black-${positionEvaluation}`}
              x={10}
              y={evalBarY + evalBarHeight * player1WinProb}
              width={evalBarWidth}
              height={evalBarHeight * cpuWinProb}
              fill="#111"
              stroke="#000"
              strokeWidth={1}
            />
            {/* Center line at 50% */}
            <line
              x1={10}
              y1={evalBarY + evalBarHeight / 2}
              x2={10 + evalBarWidth}
              y2={evalBarY + evalBarHeight / 2}
              stroke="#666"
              strokeWidth={1}
              strokeDasharray="2,2"
              opacity={0.5}
            />
          </svg>
        </div>
        <svg ref={svgRef} width={boardX * 2 + boardW} height={boardY * 2 + boardH} style={{ background: '#5c3317', border: '2px solid #3e2410', margin: 10, position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
        <defs>
          <filter id="checker-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#FFD700" floodOpacity="1.5" />
          </filter>
          <pattern id="wood-grain" patternUnits="userSpaceOnUse" width="80" height="80">
            <rect width="80" height="80" fill="#3e2410" />
            <path d="M0,40 Q20,44 40,38 T80,40" stroke="#4a2a12" strokeWidth="3.5" fill="none" opacity="0.32" />
          </pattern>
          <filter id="checker-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>
        <rect x={0} y={0} width={boardX * 2 + boardW} height={boardY * 2 + boardH} rx={14} fill="url(#wood-grain)" />
        <rect x={boardX} y={boardY} width={boardW} height={boardH} fill="#3e2410" />
        <rect x={boardX + 3} y={boardY + 3} width={boardW - 6 - bearOffW} height={boardH - 6} fill="#8b5c2a" pointerEvents="none" />
        <rect x={boardX + triangleW * 6} y={boardY + 3} width={gap} height={boardH - 6} fill="#3e2410" />
        {trianglePolys}
        {legalMoveHighlights}
        {allCheckers}
        {bar[1].map((c, i) => {
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
        {bearOffRects}
        {borneOffRects1}
        {borneOffRects2}
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
        {!hasRolled && !awaitingEndTurn && !isRolling && !autoRoll[currentPlayer] && canDouble[currentPlayer] && (!isOnlineGame || (isOnlineGame && currentPlayer === playerNumber)) && (
          <foreignObject
            x={boardX + triangleW * 2}
            y={boardY + boardH / 2 - 40}
            width={120}
            height={120}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'auto', background: 'none', borderRadius: 0, boxShadow: 'none', padding: 0, minWidth: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ff6b35', marginBottom: 6, letterSpacing: 1 }}>
                <span style={{ color: '#ff6b35' }}>⚡</span>
                <span style={{ color: '#ff6b35', marginLeft: 4 }}>2×</span>
              </div>
              <button 
                style={{ ...buttonStyle, minWidth: 0, width: 110, fontSize: 22, padding: '14px 0', margin: 0, background: '#ff6b35', color: '#fff' }} 
                onClick={offerDouble}
              >
                Double
              </button>
            </div>
          </foreignObject>
        )}
        <foreignObject
          x={boardX + triangleW * 6.875}
          y={boardY + boardH / 2 - 40}
          width={320}
          height={120}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'auto', background: 'none', borderRadius: 0, boxShadow: 'none', padding: 0, minWidth: 0 }}>
            {!gameOver && (screen === 'passplay' || screen === 'onlineGame') && !firstRollPhase && (
              <div style={{ fontSize: 28, fontWeight: 700, color: timer <= 5 ? '#dc3545' : '#fff', marginBottom: 6, letterSpacing: 1, textShadow: timer <= 5 ? '0 0 8px #fff, 0 0 16px #fff' : 'none' }}>
                <span style={{ color: '#fff', marginRight: 4, textShadow: 'none' }}>⏰</span>
                <span style={timer <= 5 ? { color: '#dc3545', textShadow: '0 0 8px #fff, 0 0 16px #fff' } : { color: '#fff', textShadow: 'none' }}>{timer}</span>
                <span style={timer <= 5 ? { color: '#dc3545' } : { color: '#fff' }}>s</span>
              </div>
            )}
            {(!hasRolled && !awaitingEndTurn && !isRolling && !gameOver) ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {(!isOnlineGame || (isOnlineGame && currentPlayer === playerNumber)) && (
                  <button style={{ ...buttonStyle, minWidth: 0, width: 110, fontSize: 22, padding: '14px 0', margin: 0 }} onClick={rollDice}>Roll Dice</button>
                )}
                {isOnlineGame && currentPlayer !== playerNumber && (
                  <div style={{ fontSize: 18, color: '#fff', padding: '14px 0' }}>Waiting for opponent to roll...</div>
                )}
              </div>
            ) : null}
            {(hasRolled || isRolling) && !showEndTurn && !gameOver && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 0 4px 0', gap: 7 }}>
                {isRolling ? (
                  [0, 1].map(i => (
                    <Dice key={i} value={isRolling ? rollingDice[i] : (dice[i] || 1)} faded={false} shrunk={false} isRolling={true} frame={animationFrame} />
                  ))
                ) : (
                  (dice[0] === dice[1] && dice[0] !== 0)
                    ? [0, 1, 2, 3].map(i => (
                        <Dice key={i} value={dice[0]} faded={usedDice.includes(i)} shrunk={usedDice.includes(i)} />
                      ))
                    : [0, 1].map(i => (
                        <Dice key={i} value={dice[i]} faded={usedDice.includes(i)} shrunk={usedDice.includes(i)} />
                      ))
                )}
              </div>
            )}
            {showEndTurn && (!isCpuGame || currentPlayer !== cpuPlayer) && (screen !== 'onlineGame' || (screen === 'onlineGame' && currentPlayer === playerNumber)) && !gameOver && (
              <button style={{ ...buttonStyle, minWidth: 0, width: 110, fontSize: 22, padding: '14px 0', margin: 0, background: '#007bff', color: '#fff' }} onClick={handleEndTurn}>End Turn</button>
            )}
          </div>
        </foreignObject>
        {/* Your move / Waiting text on left side */}
        {!gameOver && !firstRollPhase && hasRolled && !isRolling && screen === 'onlineGame' && (
          <foreignObject
            x={boardX + 20}
            y={boardY + boardH / 2 - 10}
            width={200}
            height={30}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#fff', textAlign: 'left' }}>
              <span style={{
                display: 'inline-block',
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: currentPlayer === 1 ? '#fff' : '#222',
                border: '2px solid #b87333',
                flexShrink: 0,
              }} />
              {currentPlayer === playerNumber ? (
                <span>Your move</span>
              ) : (
                <span>Waiting for opponent's move</span>
              )}
            </div>
          </foreignObject>
        )}
      </svg>
      </div>
    );
  }

  const renderPassPlay = () => (
    <div style={{ textAlign: 'center', marginTop: 30 }}>
      <div style={{ marginBottom: '18px' }}>
        <img src="/logo.svg" alt="Backgammon Arena Logo" style={{ height: '120px' }} />
      </div>
      <h2>Pass and Play Backgammon</h2>
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
            {undoStack.length > 0 && hasRolled && (
              <button style={{ ...buttonStyle, background: '#ffc107', color: '#222' }} onClick={handleUndo}>Undo</button>
            )}
            <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff' }} onClick={confirmResign}>Resign</button>
          </div>
        </div>
      </div>
      {!isCpuGame && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32, margin: '16px 0 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Player 1 Auto-roll:</span>
            <button 
              style={{ ...buttonStyle, minWidth: 60, padding: '8px 12px', fontSize: 14, background: autoRoll[1] ? '#28a745' : '#6c757d', color: '#fff' }} 
              onClick={() => setAutoRoll(prev => ({ ...prev, 1: !prev[1] }))}
            >
              {autoRoll[1] ? 'ON' : 'OFF'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Player 2 Auto-roll:</span>
            <button 
              style={{ ...buttonStyle, minWidth: 60, padding: '8px 12px', fontSize: 14, background: autoRoll[2] ? '#28a745' : '#6c757d', color: '#fff' }} 
              onClick={() => setAutoRoll(prev => ({ ...prev, 2: !prev[2] }))}
            >
              {autoRoll[2] ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}
      {noMoveOverlay && usedDice.length < movesAllowed.length && !gameOver && (
        <div style={{ position: 'absolute', top: '54.5%', left: 'calc(50% - 373px)', transform: 'translateY(-50%)', zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.95)', border: '2px solid #28a745', borderRadius: 12, padding: 32, minWidth: 220, maxWidth: 340, textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: '#222', boxShadow: '0 2px 16px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
            <div style={{ marginBottom: 16 }}>{noMoveOverlay === 'noMore' ? 'No More Moves' : 'No Moves :('}</div>
            {noMoveOverlay === 'noMore' && (
              <button style={{ ...buttonStyle, minWidth: 0, width: 110, fontSize: 22, padding: '14px 0', margin: '12px 0 0 0', background: '#007bff', color: '#fff' }} onClick={handleEndTurn}>End Turn</button>
            )}
          </div>
        </div>
      )}
      {firstRollPhase && renderFirstRollModal()}
      {/* Only show double offer modal if it's not a CPU decision (CPU decisions are handled automatically) */}
      {doubleOffer && !(isCpuGame && doubleOffer.to === cpuPlayer && doubleOffer.from !== cpuPlayer) && (
        <div style={{ position: 'absolute', top: '54.5%', left: 'calc(50% - 373px)', transform: 'translateY(-50%)', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.97)', border: '2px solid #ff6b35', borderRadius: 12, padding: 32, minWidth: 280, maxWidth: 400, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#222', boxShadow: '0 4px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
            <div style={{ marginBottom: 16, fontSize: 24, color: '#ff6b35' }}>🎲 Double Offered! 🎲</div>
            <div style={{ marginBottom: 8 }}>{doubleOffer.from === 1 ? 'Player 1' : (isCpuGame ? 'CPU' : 'Player 2')} offers to double the stakes</div>
            <div style={{ marginBottom: 16, fontSize: 18, color: '#666' }}>Current stakes: {gameStakes} | New stakes: {gameStakes * 2}</div>
            <div style={{ marginBottom: 16, fontSize: 20, color: doubleTimer <= 3 ? '#dc3545' : '#333', fontWeight: 'bold' }}>⏰ {doubleTimer} seconds to decide</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...buttonStyle, minWidth: 100, padding: '12px 20px', fontSize: 18, background: '#28a745', color: '#fff' }} onClick={() => handleDoubleResponse(true)}>Accept</button>
              <button style={{ ...buttonStyle, minWidth: 100, padding: '12px 20px', fontSize: 18, background: '#dc3545', color: '#fff' }} onClick={() => handleDoubleResponse(false)}>Decline</button>
            </div>
          </div>
        </div>
      )}
      {/* CPU double decision message */}
      {cpuDoubleMessage && (
        <div style={{ position: 'absolute', top: '54.5%', left: 'calc(50% - 373px)', transform: 'translateY(-50%)', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.97)', border: '2px solid #ff6b35', borderRadius: 12, padding: 32, minWidth: 280, maxWidth: 400, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#222', boxShadow: '0 4px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
            <div style={{ marginBottom: 16, fontSize: 24, color: '#ff6b35' }}>🎲 {cpuDoubleMessage} 🎲</div>
          </div>
        </div>
      )}
      {showConfirmResign && (
        <div style={{ position: 'absolute', top: '54.5%', left: 'calc(50% - 373px)', transform: 'translateY(-50%)', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(255,255,255,0.97)', border: '2px solid #dc3545', borderRadius: 12, padding: 32, minWidth: 260, maxWidth: 340, textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: '#222', boxShadow: '0 2px 16px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
            <div style={{ marginBottom: 18 }}>Are you sure you want to resign?</div>
            <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
              <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff', minWidth: 0, width: 90, fontSize: 20 }} onClick={doResign}>Yes</button>
              <button style={{ ...buttonStyle, background: '#bbb', color: '#222', minWidth: 0, width: 90, fontSize: 20 }} onClick={cancelResign}>No</button>
            </div>
          </div>
        </div>
      )}
      {gameOver && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.08)', zIndex: 1000, pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.98)', border: '2px solid #28a745', borderRadius: 12, padding: 36, minWidth: 300, maxWidth: 340, textAlign: 'center', fontSize: 26, fontWeight: 'bold', color: '#222', boxShadow: '0 2px 16px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
            <div style={{ marginBottom: 22 }}>{getGameOverMessage(gameOver)}</div>
            <div style={{ display: 'flex', gap: 22, marginTop: 8 }}>
              <button style={{ ...buttonStyle, background: '#28a745', color: '#fff', fontSize: 22 }} onClick={handleRematch}>Rematch</button>
              <button style={{ ...buttonStyle, background: '#bbb', color: '#222', minWidth: 0, width: 110, fontSize: 22 }} onClick={handleQuit}>Quit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Homepage constants
  const sectionStyle = {
    background: '#f9f9f9',
    borderRadius: '10px',
    padding: '30px',
    margin: '20px auto',
    maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
  };

  const homepageBoxWidth = 480;

  const homepageFeatures = [
    'Competitive ranked play',
    'Free to play',
    'AI game review and lessons',
    'Modern, clean UI',
    'Play vs friends or CPU',
    'Guest play—no signup needed',
    'Undo/redo moves',
  ];

  const howToPlay = (
    <div style={sectionStyle}>
      <h2 style={{ 
        color: '#000', 
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
      }}>
        How to Play Backgammon
      </h2>
      <ol style={{ 
        textAlign: 'left', 
        maxWidth: 600, 
        margin: '0 auto', 
        fontSize: 16, 
        color: '#333',
        lineHeight: 1.6,
        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
        paddingLeft: '20px'
      }}>
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
      <h2 style={{ 
        color: '#000', 
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
      }}>
        Backgammon Glossary
      </h2>
      <ul style={{ 
        textAlign: 'left', 
        maxWidth: 600, 
        margin: '0 auto', 
        fontSize: 16, 
        color: '#333', 
        columns: 2, 
        columnGap: 32,
        lineHeight: 1.6,
        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
        paddingLeft: '20px'
      }}>
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
      <h2 style={{ 
        color: '#000', 
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
      }}>
        A Brief History of Backgammon
      </h2>
      <p style={{ 
        maxWidth: 600, 
        margin: '0 auto', 
        fontSize: 16, 
        color: '#333', 
        textAlign: 'left',
        lineHeight: 1.6,
        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
      }}>
        Backgammon is one of the oldest known board games, dating back over 5,000 years to ancient Mesopotamia. It has been played by kings, scholars, and everyday people across Persia, Rome, and the Middle East. The modern rules were standardized in the 20th century, and today backgammon is enjoyed worldwide for its blend of strategy and luck. Whether played casually or competitively, backgammon remains a timeless classic.
      </p>
    </div>
  );

  // Login function
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setLoginError('Supabase not configured');
      return;
    }

    setLoginError('');
    setLoginLoading(true);

    try {
      let emailToUse = loginFormData.email;

      // Check if input is a username (not containing @)
      if (!loginFormData.email.includes('@')) {
        // It's a username, fetch the user's email from the database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('email')
          .eq('username', loginFormData.email)
          .single();

        if (userError || !userData) {
          setLoginError('Username not found');
          setLoginLoading(false);
          return;
        }

        emailToUse = userData.email;
      }

      // Sign in with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: loginFormData.password,
      });

      if (error) {
        setLoginError(error.message);
        setLoginLoading(false);
        return;
      }

      // Success! User is logged in
      setShowLoginModal(false);
      setShowLoginForm(false);
      setLoginFormData({ email: '', password: '' });
      setLoginError('');
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('An unexpected error occurred');
    } finally {
      setLoginLoading(false);
    }
  };

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    if (!supabase || !username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single();

      if (error && error.code === 'PGRST116') {
        // Not found = available
        setUsernameAvailable(true);
      } else if (data) {
        // Found = not available
        setUsernameAvailable(false);
      } else {
        setUsernameAvailable(null);
      }
    } catch (error) {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Debounced username check
  useEffect(() => {
    if (!showSignupForm) return;

    const timeoutId = setTimeout(() => {
      if (signupFormData.username && signupFormData.username.length >= 3) {
        checkUsernameAvailability(signupFormData.username);
      } else {
        setUsernameAvailable(null);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [signupFormData.username, showSignupForm]);

  // Signup function
  const handleSignup = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setSignupError('Supabase not configured');
      return;
    }

    setSignupError('');
    setSignupLoading(true);

    try {
      // Validate form
      if (!signupFormData.email || !signupFormData.password || !signupFormData.username) {
        setSignupError('Please fill in all fields');
        setSignupLoading(false);
        return;
      }

      if (signupFormData.username.length < 3) {
        setSignupError('Username must be at least 3 characters');
        setSignupLoading(false);
        return;
      }

      if (usernameAvailable === false) {
        setSignupError('Username is already taken. Please choose another.');
        setSignupLoading(false);
        return;
      }

      if (signupFormData.password.length < 6) {
        setSignupError('Password must be at least 6 characters');
        setSignupLoading(false);
        return;
      }

      // Sign up with Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupFormData.email,
        password: signupFormData.password,
        options: {
          data: {
            username: signupFormData.username,
            country: signupFormData.country
          }
        }
      });

      if (authError) {
        setSignupError(authError.message);
        setSignupLoading(false);
        return;
      }

      if (!authData.user) {
        setSignupError('Failed to create account');
        setSignupLoading(false);
        return;
      }

      // Create user profile in database (default avatar is first one: Barry)
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: signupFormData.email,
          username: signupFormData.username,
          country: signupFormData.country,
          avatar: 'Barry', // Default to first avatar
          elo_rating: 1000,
          wins: 0,
          losses: 0,
          games_played: 0
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        setSignupError(profileError.message || 'Failed to create profile. Please try again.');
        setSignupLoading(false);
        return;
      }

      // Immediately fetch the profile to ensure it's available
      const { data: newProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      
      if (newProfile) {
        setUserProfile(newProfile);
      }

      // Success! User is automatically logged in
      setShowLoginModal(false);
      setShowSignupForm(false);
      setSignupFormData({ email: '', password: '', username: '', country: 'US' });
      setSignupError('');
      
      // Navigate to home (already there, but refresh state)
      setScreen('home');
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError('An unexpected error occurred');
    } finally {
      setSignupLoading(false);
    }
  };

  const HomeBoardSVG = () => {
    return (
      <img 
        src="/Homeboard.png" 
        alt="Backgammon Arena Board" 
        style={{ 
          width: 'auto', 
          height: '350px', 
          objectFit: 'contain',
          margin: '0 auto 18px', 
          display: 'block'
        }} 
      />
    );
  };

  // Sidebar menu items
  const sidebarMenuItems = [
    { label: 'Tournaments', icon: '🏆' },
    { label: 'Lessons', icon: '📚' },
    { label: 'Game Review', icon: '🔍' },
    { label: 'News', icon: '📰' },
    { label: 'Events', icon: '📅' },
    { label: 'Shop', icon: '🛒' }
  ];

  const renderHome = () => {
    const isMobile = windowWidth <= 768;
    return (
    <div style={{ 
      textAlign: 'center', 
      marginTop: isMobile ? 80 : 30, 
      paddingBottom: 40, 
      background: '#a8a7a8', 
      minHeight: '100vh',
      position: 'relative',
      paddingLeft: user && sidebarOpen && !isMobile ? '260px' : '0',
      transition: 'padding-left 0.3s ease',
      overflowX: 'hidden',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Sidebar Menu - Only show when logged in */}
      {user && (
        <>
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              position: 'fixed',
              top: isMobile ? '10px' : '20px',
              left: sidebarOpen && !isMobile ? '240px' : (isMobile ? (sidebarOpen ? '220px' : '10px') : '20px'),
              zIndex: 1500,
              background: '#ff751f',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: isMobile ? '8px 12px' : '10px 14px',
              cursor: 'pointer',
              fontSize: isMobile ? '18px' : '20px',
              transition: 'left 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>

          {/* Sidebar */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: sidebarOpen ? 0 : (isMobile ? '-220px' : '-260px'),
            width: isMobile ? '220px' : '260px',
            height: '100vh',
            background: '#fff',
            boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
            transition: 'left 0.3s ease',
            zIndex: 1400,
            overflowY: 'auto',
            paddingTop: isMobile ? '50px' : '60px'
          }}>
            <div style={{ padding: '20px' }}>
              {sidebarMenuItems.map((item, index) => (
                <div
                  key={index}
                  onClick={() => alert('Coming soon!')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    marginBottom: '8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'transparent',
                    transition: 'all 0.2s',
                    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                    fontSize: '16px',
                    color: '#333'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0f0f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Overlay (for mobile) */}
          {sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.3)',
                zIndex: 1300
              }}
            />
          )}
        </>
      )}
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
        padding: isMobile ? '20px 16px' : '32px 36px 24px 36px',
        gap: 0,
      }}>
        <div style={{ marginBottom: isMobile ? '12px' : '18px' }}>
          <img src="/logo.svg" alt="Backgammon Arena Logo" style={{ height: isMobile ? '120px' : '180px', maxWidth: '100%' }} />
        </div>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row', 
          alignItems: 'flex-start', 
          justifyContent: 'center', 
          width: '100%', 
          gap: isMobile ? 24 : 48, 
          marginTop: 8, 
          flexWrap: 'wrap' 
        }}>
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            minWidth: isMobile ? '100%' : 320,
            maxWidth: isMobile ? '100%' : 'none'
          }}>
            <HomeBoardSVG />
          </div>
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: isMobile ? 'center' : 'flex-start', 
            minWidth: isMobile ? '100%' : 320, 
            paddingLeft: isMobile ? 0 : 12 
          }}>
            <div style={{ width: '100%' }}>
              <h2 style={{ marginBottom: '4px', color: '#000' }}>Play Online</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                {user ? (
                  <>
                    <div 
                      onClick={() => setScreen('profile')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: '12px',
                        cursor: 'pointer',
                        backgroundColor: '#a8a7a8',
                        color: '#fff',
                        padding: '12px 24px',
                        margin: '10px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: isMobile ? '16px' : '18px',
                        minWidth: isMobile ? '140px' : '162px',
                        height: '42px',
                        maxHeight: '42px',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#9a999a';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#a8a7a8';
                      }}
                    >
                      {userProfile?.avatar ? (
                        <img 
                          src={`/avatars/${userProfile.avatar}.png`}
                          alt={userProfile.avatar}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            objectFit: 'cover',
                            flexShrink: 0
                          }}
                          onError={(e) => {
                            // Fallback to initial if image fails to load
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: '#ff751f',
                        display: userProfile?.avatar ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        color: '#fff',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        {userProfile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '👤'}
                      </div>
                      <span style={{ 
                        fontSize: isMobile ? '14px' : '18px', 
                        fontWeight: '600',
                        color: '#fff',
                        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                        whiteSpace: isMobile ? 'normal' : 'nowrap'
                      }}>
                        {userProfile?.username || 'User'}
                      </span>
                      <span style={{ 
                        fontSize: isMobile ? '14px' : '18px', 
                        fontWeight: '600',
                        color: '#fff',
                        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                        whiteSpace: isMobile ? 'normal' : 'nowrap'
                      }}>
                        Rating {userProfile?.elo_rating || 1000}
                      </span>
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>
                        {getCountryFlag(userProfile?.country)}
                      </span>
                    </div>
                    <button style={buttonStyle} onClick={() => {
                      setMatchmakingType('ranked');
                      setIsMatchmaking(true);
                      setScreen('matchmaking');
                    }}>Play Game (ranked)</button>
                  </>
                ) : (
                  <>
                    <button style={buttonStyle} onClick={() => {
                      setMatchmakingType('guest');
                      setIsMatchmaking(true);
                      setScreen('matchmaking');
                    }}>Play as Guest (unranked)</button>
                    <button style={buttonStyle} onClick={() => setShowLoginModal(true)}>Login / Signup (ranked)</button>
                  </>
                )}
              </div>
              <h2 style={{ marginBottom: '4px', color: '#000' }}>Play Offline</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button style={buttonStyle} onClick={() => setScreen('passplay')}>Pass and Play</button>
                <button style={buttonStyle} onClick={() => setScreen('cpu-difficulty')}>Vs. CPU</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        justifyContent: 'center', 
        alignItems: 'stretch', 
        gap: isMobile ? 20 : 40, 
        margin: '0 auto 24px', 
        maxWidth: 1100, 
        flexWrap: 'wrap',
        padding: isMobile ? '0 16px' : '0'
      }}>
        <div style={{ 
          ...sectionStyle, 
          maxWidth: isMobile ? '100%' : homepageBoxWidth, 
          minWidth: isMobile ? '100%' : 320, 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: '100%',
          padding: isMobile ? '20px 16px' : sectionStyle.padding
        }}>
          <ul style={{ fontSize: 20, color: '#000', textAlign: 'left', listStyle: 'disc inside', margin: 0, padding: 0, lineHeight: 1.7, fontWeight: 700, fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif' }}>
            {homepageFeatures.map((f, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{f}</li>
            ))}
          </ul>
        </div>
        <div style={{ ...sectionStyle, maxWidth: homepageBoxWidth, minWidth: 320, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <h2 style={{ 
            color: '#000', 
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '20px',
            fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
          }}>
            Leaderboards
          </h2>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180, maxWidth: 240, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 12, margin: '0 4px' }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: 18, 
                color: '#000',
                fontWeight: 'bold',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                Highest Rating
              </h3>
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
            <div style={{ flex: 1, minWidth: 180, maxWidth: 240, background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 12, margin: '0 4px' }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: 18, 
                color: '#000',
                fontWeight: 'bold',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                Most Wins All Time
              </h3>
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
      
      {/* Login/Signup Modal */}
      {showLoginModal && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(0, 0, 0, 0.5)', 
            zIndex: 2000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLoginModal(false);
              setShowSignupForm(false);
              setShowLoginForm(false);
              setSignupError('');
              setLoginError('');
              setSignupFormData({ email: '', password: '', username: '', country: 'US' });
              setLoginFormData({ email: '', password: '' });
            }
          }}
        >
          <div 
            style={{ 
              background: '#fff', 
              borderRadius: '16px', 
              padding: '40px', 
              minWidth: '400px', 
              maxWidth: '480px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              animation: 'fadeIn 0.2s ease-in'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowLoginModal(false);
                setShowSignupForm(false);
                setShowLoginForm(false);
                setSignupError('');
                setLoginError('');
                setSignupFormData({ email: '', password: '', username: '', country: 'US' });
                setLoginFormData({ email: '', password: '' });
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                fontSize: '28px',
                cursor: 'pointer',
                color: '#666',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s',
                lineHeight: 1
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f0f0f0';
                e.target.style.color = '#000';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.color = '#666';
              }}
            >
              ×
            </button>

            {/* Modal Content */}
            {!showSignupForm ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '28px', 
                fontWeight: 'bold', 
                color: '#000',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                Welcome to TopGammon
              </h2>
              <p style={{ 
                margin: '0 0 32px 0', 
                fontSize: '16px', 
                color: '#666',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                Sign in to track your stats and play ranked matches
              </p>

              {/* Google Sign In Button */}
              <button
                onClick={() => {
                  // TODO: Implement Google sign in
                  alert('Google sign in coming soon!');
                }}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  marginBottom: '16px',
                  background: '#fff',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#4285f4';
                  e.target.style.boxShadow = '0 4px 8px rgba(66, 133, 244, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#ddd';
                  e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* Create Account Button */}
              <button
                onClick={() => {
                  setShowSignupForm(true);
                }}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: '#ff751f',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#fff',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                  boxShadow: '0 2px 4px rgba(255, 117, 31, 0.3)',
                  marginBottom: '16px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#e6640f';
                  e.target.style.boxShadow = '0 4px 8px rgba(255, 117, 31, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#ff751f';
                  e.target.style.boxShadow = '0 2px 4px rgba(255, 117, 31, 0.3)';
                }}
              >
                Create Account
              </button>

              {/* Login Form */}
              <div style={{ marginBottom: '16px' }}>
                <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="Username or Email"
                      value={loginFormData.email}
                      onChange={(e) => setLoginFormData({ ...loginFormData, email: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#ff751f'}
                      onBlur={(e) => e.target.style.borderColor = '#ddd'}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="password"
                      placeholder="Password"
                      value={loginFormData.password}
                      onChange={(e) => setLoginFormData({ ...loginFormData, password: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#ff751f'}
                      onBlur={(e) => e.target.style.borderColor = '#ddd'}
                    />
                  </div>
                  {loginError && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '10px',
                      background: '#fee',
                      border: '1px solid #fcc',
                      borderRadius: '8px',
                      color: '#c33',
                      fontSize: '13px',
                      fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                    }}>
                      {loginError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loginLoading}
                    style={{
                      width: '100%',
                      padding: '12px 24px',
                      background: loginLoading ? '#ccc' : '#6c757d',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: loginLoading ? 'not-allowed' : 'pointer',
                      color: '#fff',
                      transition: 'all 0.2s',
                      fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      if (!loginLoading) {
                        e.target.style.background = '#5a6268';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loginLoading) {
                        e.target.style.background = '#6c757d';
                      }
                    }}
                  >
                    {loginLoading ? 'Logging in...' : 'Login'}
                  </button>
                </form>
              </div>

              {/* Divider */}
              <div style={{ 
                margin: '24px 0', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                color: '#999',
                fontSize: '14px'
              }}>
                <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
                <span>or</span>
                <div style={{ flex: 1, height: '1px', background: '#ddd' }}></div>
              </div>

              {/* Guest Play Option */}
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  alert('Guest play coming soon!');
                }}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  background: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  color: '#666',
                  transition: 'all 0.2s',
                  fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#999';
                  e.target.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#ddd';
                  e.target.style.color = '#666';
                }}
              >
                Continue as Guest
              </button>
            </div>
            ) : (
            /* Signup Form */
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '28px', 
                fontWeight: 'bold', 
                color: '#000',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                Create Account
              </h2>
              <p style={{ 
                margin: '0 0 24px 0', 
                fontSize: '16px', 
                color: '#666',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                Join TopGammon to track your stats and compete
              </p>

              <form onSubmit={handleSignup} style={{ textAlign: 'left' }}>
                {/* Username */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#333',
                    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                  }}>
                    Username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={signupFormData.username}
                      onChange={(e) => {
                        setSignupFormData({ ...signupFormData, username: e.target.value });
                        setUsernameAvailable(null); // Reset while typing
                      }}
                      required
                      minLength={3}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 12px',
                        border: `2px solid ${
                          usernameAvailable === false ? '#dc3545' : 
                          usernameAvailable === true ? '#28a745' : 
                          '#ddd'
                        }`,
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => {
                        if (usernameAvailable === null) {
                          e.target.style.borderColor = '#ff751f';
                        }
                      }}
                      onBlur={(e) => {
                        if (usernameAvailable === null) {
                          e.target.style.borderColor = '#ddd';
                        }
                      }}
                    />
                    {signupFormData.username.length >= 3 && (
                      <div style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '18px'
                      }}>
                        {checkingUsername ? (
                          <span style={{ color: '#999' }}>⏳</span>
                        ) : usernameAvailable === true ? (
                          <span style={{ color: '#28a745' }}>✓</span>
                        ) : usernameAvailable === false ? (
                          <span style={{ color: '#dc3545' }}>✗</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {signupFormData.username.length > 0 && signupFormData.username.length < 3 && (
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#999',
                      fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                    }}>
                      Username must be at least 3 characters
                    </p>
                  )}
                  {usernameAvailable === false && (
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#dc3545',
                      fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                    }}>
                      Username is already taken
                    </p>
                  )}
                  {usernameAvailable === true && (
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#28a745',
                      fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                    }}>
                      Username is available
                    </p>
                  )}
                </div>

                {/* Email */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#333',
                    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                  }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={signupFormData.email}
                    onChange={(e) => setSignupFormData({ ...signupFormData, email: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ff751f'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#333',
                    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                  }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={signupFormData.password}
                    onChange={(e) => setSignupFormData({ ...signupFormData, password: e.target.value })}
                    required
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ff751f'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                  />
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    fontSize: '12px', 
                    color: '#999',
                    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                  }}>
                    Must be at least 6 characters
                  </p>
                </div>

                {/* Error Message */}
                {signupError && (
                  <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '8px',
                    color: '#c33',
                    fontSize: '14px',
                    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                  }}>
                    {signupError}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={signupLoading}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    background: signupLoading ? '#ccc' : '#ff751f',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: signupLoading ? 'not-allowed' : 'pointer',
                    color: '#fff',
                    transition: 'all 0.2s',
                    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                    boxShadow: signupLoading ? 'none' : '0 2px 4px rgba(255, 117, 31, 0.3)',
                    marginBottom: '16px'
                  }}
                  onMouseEnter={(e) => {
                    if (!signupLoading) {
                      e.target.style.background = '#e6640f';
                      e.target.style.boxShadow = '0 4px 8px rgba(255, 117, 31, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!signupLoading) {
                      e.target.style.background = '#ff751f';
                      e.target.style.boxShadow = '0 2px 4px rgba(255, 117, 31, 0.3)';
                    }
                  }}
                >
                  {signupLoading ? 'Creating Account...' : 'Create Account'}
                </button>

                {/* Back to Login */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSignupForm(false);
                    setSignupError('');
                    setSignupFormData({ email: '', password: '', username: '', country: 'US' });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    background: 'transparent',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    color: '#666',
                    transition: 'all 0.2s',
                    fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = '#999';
                    e.target.style.color = '#333';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '#ddd';
                    e.target.style.color = '#666';
                  }}
                >
                  Back to Sign In
                </button>
              </form>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
  };

  // CPU Difficulty Selection Screen
  const renderCpuDifficultySelection = () => (
    <div style={{ textAlign: 'center', marginTop: 30, paddingBottom: 40, background: '#a8a7a8', minHeight: '100vh' }}>
      <div style={{
        maxWidth: 1000,
        margin: '0 auto',
        padding: '40px 20px',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <img src="/logo.svg" alt="Backgammon Arena Logo" style={{ height: '120px' }} />
        </div>
        <h2 style={{ color: '#000', marginBottom: '32px' }}>Select Opponent</h2>
        {/* Beta Disclaimer */}
        <div style={{ 
          maxWidth: 600, 
          margin: '0 auto 24px auto', 
          padding: '12px 20px', 
          background: '#fff3cd', 
          border: '2px solid #ffc107', 
          borderRadius: '8px',
          color: '#856404',
          fontSize: '14px',
          fontWeight: 500
        }}>
          ⚠️ Bots are in beta and are still in development.
        </div>
        {/* 3x3 Grid Layout */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '20px',
          marginBottom: '32px',
          maxWidth: '900px',
          margin: '0 auto 32px auto',
        }}>
          {Object.entries(DIFFICULTY_LEVELS).map(([level, info]) => (
            <button
              key={level}
              style={{
                backgroundColor: cpuDifficulty === parseInt(level) ? '#ff751f' : '#f8f9fa',
                color: cpuDifficulty === parseInt(level) ? '#fff' : '#000',
                border: cpuDifficulty === parseInt(level) ? '3px solid #ff751f' : '2px solid #ddd',
                borderRadius: '12px',
                padding: '20px',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minHeight: '180px',
                boxShadow: cpuDifficulty === parseInt(level) ? '0 4px 8px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
              }}
              onClick={() => setCpuDifficulty(parseInt(level))}
              onMouseEnter={(e) => {
                if (cpuDifficulty !== parseInt(level)) {
                  e.currentTarget.style.backgroundColor = '#e9ecef';
                  e.currentTarget.style.borderColor = '#ff751f';
                }
              }}
              onMouseLeave={(e) => {
                if (cpuDifficulty !== parseInt(level)) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#ddd';
                }
              }}
            >
              {/* Avatar Image */}
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: `3px solid ${cpuDifficulty === parseInt(level) ? '#fff' : '#ddd'}`,
                boxShadow: cpuDifficulty === parseInt(level) ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 6px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img 
                  src={`/avatars/${info.avatar}.png`}
                  alt={info.avatar}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={(e) => {
                    // Fallback if image fails to load
                    e.target.style.display = 'none';
                    e.target.parentElement.style.background = cpuDifficulty === parseInt(level) ? '#ff751f' : '#ddd';
                    e.target.parentElement.textContent = info.avatar[0];
                    e.target.parentElement.style.fontSize = '36px';
                    e.target.parentElement.style.fontWeight = 'bold';
                    e.target.parentElement.style.color = cpuDifficulty === parseInt(level) ? '#fff' : '#666';
                  }}
                />
              </div>
              
              {/* Opponent Name */}
              <div style={{ 
                fontSize: '20px', 
                fontWeight: 'bold',
                color: cpuDifficulty === parseInt(level) ? '#fff' : '#000',
                marginTop: '4px'
              }}>
                {info.avatar}
              </div>
              
              {/* Difficulty Name */}
              <div style={{ 
                fontSize: '16px', 
                fontWeight: '600',
                color: cpuDifficulty === parseInt(level) ? '#fff' : '#333',
                marginTop: '-4px'
              }}>
                {info.name}
              </div>
              
              {/* Rating Badge */}
              <div style={{ 
                fontSize: '13px', 
                color: cpuDifficulty === parseInt(level) ? '#fff' : '#666', 
                fontWeight: '600',
                marginTop: '4px',
                padding: '4px 12px',
                borderRadius: '12px',
                background: cpuDifficulty === parseInt(level) ? 'rgba(255,255,255,0.2)' : '#f0f0f0'
              }}>
                Rating: {info.skillRating}
              </div>
              
              {/* Description */}
              <div style={{ 
                fontSize: '13px', 
                color: cpuDifficulty === parseInt(level) ? 'rgba(255,255,255,0.95)' : '#666', 
                fontWeight: 'normal', 
                textAlign: 'center',
                lineHeight: '1.4',
                marginTop: '8px',
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {info.description}
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: '32px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            style={{ ...buttonStyle, backgroundColor: '#6c757d', minWidth: 'auto', margin: '0' }}
            onClick={() => setScreen('home')}
          >
            Back to Home
          </button>
          <button
            style={{ ...buttonStyle, minWidth: 'auto', margin: '0' }}
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

  // CPU Game Screen (similar to pass and play, but with CPU logic)
  const renderCpuGame = () => {
    // For now, render the same as pass and play
    // CPU move logic will be added when we integrate the bot library
    return (
      <div style={{ textAlign: 'center', marginTop: 30 }}>
        <div style={{ marginBottom: '18px' }}>
          <img src="/logo.svg" alt="Backgammon Arena Logo" style={{ height: '120px' }} />
        </div>
        <h2>Vs. {DIFFICULTY_LEVELS[cpuDifficulty].name} (Rating: {DIFFICULTY_LEVELS[cpuDifficulty].skillRating})</h2>
        {message && <div style={{ color: 'red', margin: 10 }}>{message}</div>}
        {renderBoard()}
        {/* Same UI as pass and play, but timer will be disabled */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {undoStack.length > 0 && hasRolled && (!isCpuGame || currentPlayer !== cpuPlayer) && (
              <button style={{ ...buttonStyle, background: '#ffc107', color: '#222' }} onClick={handleUndo}>Undo</button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Player 1 Auto-roll:</span>
              <button 
                style={{ ...buttonStyle, minWidth: 60, padding: '8px 12px', fontSize: 14, background: autoRoll[1] ? '#28a745' : '#6c757d', color: '#fff' }} 
                onClick={() => setAutoRoll(prev => ({ ...prev, 1: !prev[1] }))}
              >
                {autoRoll[1] ? 'ON' : 'OFF'}
              </button>
            </div>
            <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff' }} onClick={confirmResign}>Resign</button>
          </div>
        </div>
        {firstRollPhase && renderFirstRollModal()}
        {doubleOffer && !(isCpuGame && doubleOffer.to === cpuPlayer && doubleOffer.from !== cpuPlayer) && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', padding: 30, borderRadius: 10, textAlign: 'center' }}>
              <h3>Double Offered!</h3>
              <p>{doubleOffer.from === cpuPlayer ? 'CPU' : 'Player 1'} has offered to double the stakes.</p>
              <div style={{ marginBottom: 16, fontSize: 18, color: '#666' }}>Current stakes: {gameStakes} | New stakes: {gameStakes * 2}</div>
              <div style={{ marginBottom: 16, fontSize: 20, color: doubleTimer <= 3 ? '#dc3545' : '#333', fontWeight: 'bold' }}>⏰ {doubleTimer} seconds to decide</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                <button style={buttonStyle} onClick={() => handleDoubleResponse(true)}>Accept</button>
                <button style={{ ...buttonStyle, background: '#dc3545' }} onClick={() => handleDoubleResponse(false)}>Decline</button>
              </div>
            </div>
          </div>
        )}
        {/* CPU double decision message */}
        {cpuDoubleMessage && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', padding: 30, borderRadius: 10, textAlign: 'center', maxWidth: 400 }}>
              <h3 style={{ marginBottom: 16 }}>{cpuDoubleMessage}</h3>
            </div>
          </div>
        )}
        {showConfirmResign && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', padding: 30, borderRadius: 10, textAlign: 'center' }}>
              <h3>Confirm Resignation</h3>
              <p>Are you sure you want to resign?</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                <button style={buttonStyle} onClick={doResign}>Yes, Resign</button>
                <button style={{ ...buttonStyle, background: '#6c757d' }} onClick={cancelResign}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        {gameOver && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', padding: 30, borderRadius: 10, textAlign: 'center', maxWidth: 400 }}>
              <h2>{getGameOverMessage(gameOver)}</h2>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                <button style={buttonStyle} onClick={handleRematch}>Rematch</button>
                <button style={{ ...buttonStyle, background: '#6c757d' }} onClick={handleQuit}>Quit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Socket.io connection for matchmaking
  useEffect(() => {
    if (!isMatchmaking || socketRef.current) return;
    
    // Backend URL: In production, this should be set to your Railway backend URL
    // Example: https://your-backend-name.railway.app
    // For local development, defaults to http://localhost:3001
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    const isGuest = matchmakingType === 'guest';
    
    const socket = io(backendUrl);
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('Connected to matchmaking server');
      setMatchmakingStatus('Searching for opponent...');
      
      if (isGuest) {
        socket.emit('matchmaking:guest:join');
      } else {
        // TODO: Implement ranked matchmaking
        socket.emit('matchmaking:ranked:join', {
          userId: user?.id,
          elo: userProfile?.elo_rating || 1000
        });
      }
    });
    
    socket.on('matchmaking:guest:queued', (data) => {
      setMatchmakingStatus(`Waiting for opponent... (Position: ${data.position})`);
    });
    
      socket.on('matchmaking:match-found', (data) => {
        console.log('Match found:', data);
        setMatchmakingStatus('Match found! Starting game...');
        
        // Mark that we're transitioning to game (don't disconnect socket)
        transitioningToGameRef.current = true;
        
        // Set online game state
        setMatchId(data.matchId);
        setPlayerNumber(data.playerNumber);
        setOpponent(data.opponent);
        setIsOnlineGame(true);
        
        // Initialize game state for online play
        setCheckers(getInitialCheckers());
        setBar({ 1: [], 2: [] });
        setBorneOff({ 1: 0, 2: 0 });
        setDice([0, 0]);
        setUsedDice([]);
        setCurrentPlayer(1);
        setHasRolled(false);
        setFirstRollPhase(true);
        setFirstRolls([null, null]);
        setFirstRollTurn(1);
        setFirstRollResult(null);
        setGameOver(null);
        setDoubleOffer(null);
        setCanDouble({ 1: true, 2: true });
        setGameStakes(1);
        setMessage('');
        setSelected(null);
        setLegalMoves([]);
        setUndoStack([]);
        setMoveMade(false);
        setAwaitingEndTurn(false);
        setIsCpuGame(false);
        
        // Transition to online game screen
        setTimeout(() => {
          setIsMatchmaking(false);
          setMatchmakingStatus('');
          setMatchmakingType(null);
          setScreen('onlineGame');
        }, 500);
      });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from matchmaking server');
      if (isMatchmaking) {
        setMatchmakingStatus('Disconnected. Please try again.');
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setMatchmakingStatus('Error connecting to server. Please try again.');
    });
    
    return () => {
      // Only cleanup/disconnect if we're canceling matchmaking, NOT when transitioning to game
      // The socket needs to stay connected for the online game!
      if (socketRef.current && isMatchmaking && !transitioningToGameRef.current) {
        // Only disconnect if we're still in matchmaking and NOT transitioning to game
        const isGuestCleanup = matchmakingType === 'guest';
        if (isGuestCleanup) {
          socketRef.current.emit('matchmaking:guest:leave');
        } else {
          socketRef.current.emit('matchmaking:ranked:leave');
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // Reset the ref after cleanup
      transitioningToGameRef.current = false;
    };
  }, [isMatchmaking, matchmakingType, user, userProfile]);

  // Matchmaking Screen
  const renderMatchmaking = () => {
    const isGuest = matchmakingType === 'guest';
    
    const handleCancelMatchmaking = () => {
      if (socketRef.current) {
        if (isGuest) {
          socketRef.current.emit('matchmaking:guest:leave');
        } else {
          socketRef.current.emit('matchmaking:ranked:leave');
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsMatchmaking(false);
      setMatchmakingStatus('');
      setMatchmakingType(null);
      setScreen('home');
    };
    
    return (
      <div style={{ 
        textAlign: 'center', 
        marginTop: 30, 
        paddingBottom: 40, 
        background: '#a8a7a8', 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          ...sectionStyle,
          maxWidth: 600,
          width: '100%',
          padding: '60px 40px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '32px' }}>
            <img src="/logo.svg" alt="Backgammon Arena Logo" style={{ height: '120px', marginBottom: '24px' }} />
          </div>
          
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: '#000',
            marginBottom: '16px',
            fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
          }}>
            {isGuest ? 'Guest Matchmaking' : 'Ranked Matchmaking'}
          </h1>
          
          <div style={{
            fontSize: '18px',
            color: '#666',
            marginBottom: '40px',
            fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
          }}>
            {isGuest ? '(Unranked)' : '(Ranked - ELO Rating: ' + (userProfile?.elo_rating || 1000) + ')'}
          </div>
          
          {/* Loading animation */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              border: '8px solid #f3f3f3',
              borderTop: '8px solid #ff751f',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px'
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
          
          <div style={{
            fontSize: '20px',
            color: '#000',
            marginBottom: '40px',
            fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
            minHeight: '60px'
          }}>
            {matchmakingStatus || 'Connecting to matchmaking server...'}
          </div>
          
          <button
            style={{
              ...buttonStyle,
              background: '#dc3545',
              minWidth: '200px'
            }}
            onClick={handleCancelMatchmaking}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  // Auto-resign on page leave for guest online play
  useEffect(() => {
    if (!isOnlineGame || !matchmakingType || matchmakingType !== 'guest') return;
    
    const handleBeforeUnload = () => {
      // Auto-resign when leaving the page during a guest game
      if (socketRef.current && matchId && playerNumber && !gameOver) {
        socketRef.current.emit('game:resign', {
          matchId,
          player: playerNumber
        });
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOnlineGame, matchmakingType, matchId, playerNumber, gameOver]);
  
  // Socket.io handlers for online game events
  useEffect(() => {
    if (!isOnlineGame || !socketRef.current || !matchId || !playerNumber) return;
    
    const socket = socketRef.current;
    const currentMatchId = matchId;
    const currentPlayerNumber = playerNumber;
    
    // Listen for opponent's moves
    const handleMove = (data) => {
      if (data.matchId === currentMatchId && data.player !== currentPlayerNumber) {
        // Apply opponent's move by syncing game state
        console.log('Opponent move received:', data);
        if (data.gameState) {
          setCheckers(data.gameState.checkers);
          setBar(data.gameState.bar);
          setBorneOff(data.gameState.borneOff);
          setUsedDice(data.gameState.usedDice);
          setSelected(null);
          setLegalMoves([]);
          setMoveMade(true);
        }
      }
    };
    
    // Listen for dice roll animation start
    const handleDiceRollStart = (data) => {
      if (data.matchId === currentMatchId && data.player !== currentPlayerNumber) {
        setIsRolling(true);
        setAnimationFrame(0);
        // Animate opponent's dice roll
        const rollInterval = setInterval(() => {
          setRollingDice([
            1 + Math.floor(Math.random() * 6),
            1 + Math.floor(Math.random() * 6)
          ]);
          setAnimationFrame(prev => (prev + 1) % 7);
        }, 50);
        
        // Clear interval after animation duration
        setTimeout(() => {
          clearInterval(rollInterval);
        }, 600);
      }
    };
    
    // Listen for dice rolls
    const handleDiceRolled = (data) => {
      if (data.matchId === currentMatchId && data.player !== currentPlayerNumber) {
        setDice(data.dice);
        setHasRolled(true);
        setIsRolling(false);
        setAnimationFrame(0);
        if (data.movesAllowed) {
          setMovesAllowed(data.movesAllowed);
        }
      }
    };
    
    // Listen for turn changes
    const handleTurnChanged = (data) => {
      if (data.matchId === currentMatchId) {
        setCurrentPlayer(data.currentPlayer);
        setHasRolled(false);
        setUsedDice([]);
        setSelected(null);
        setLegalMoves([]);
        // Reset timer when turn changes
        if (data.timer !== undefined) {
          setTimer(data.timer);
        } else {
          setTimer(45);
        }
      }
    };
    
    // Listen for timer updates
    // Listen for game state sync
    const handleStateSync = (data) => {
      if (data.matchId === currentMatchId) {
        if (data.checkers) setCheckers(data.checkers);
        if (data.bar) setBar(data.bar);
        if (data.borneOff) setBorneOff(data.borneOff);
        if (data.currentPlayer) setCurrentPlayer(data.currentPlayer);
        if (data.dice) setDice(data.dice);
        if (data.gameStakes) setGameStakes(data.gameStakes);
      }
    };
    
    // Listen for double offers
    const handleDoubleOffered = (data) => {
      if (data.matchId === currentMatchId && data.to === currentPlayerNumber) {
        setDoubleOffer(data.doubleOffer);
      }
    };
    
    // Listen for game over
    const handleGameOver = (data) => {
      if (data.matchId === currentMatchId) {
        setGameOver(data.gameOver);
      }
    };
    
    // Listen for first roll animation start
    const handleFirstRollStart = (data) => {
      if (data.matchId === currentMatchId && data.player !== currentPlayerNumber) {
        // Clear any existing interval
        if (firstRollIntervalRef.current) {
          clearInterval(firstRollIntervalRef.current);
          firstRollIntervalRef.current = null;
        }
        
        setIsFirstRolling(true);
        setFirstRollAnimationFrame(0);
        // Animate opponent's first roll - continue until roll value is received
        firstRollIntervalRef.current = setInterval(() => {
          setFirstRollAnimationFrame(prev => (prev + 1) % 7);
        }, 50);
        
        // Backup timeout in case roll event is delayed (shouldn't happen but safety net)
        setTimeout(() => {
          if (firstRollIntervalRef.current) {
            clearInterval(firstRollIntervalRef.current);
            firstRollIntervalRef.current = null;
          }
        }, 3000);
      }
    };
    
    // Listen for first roll events
    const handleFirstRoll = (data) => {
      console.log('Received first roll event:', data, 'currentPlayerNumber:', currentPlayerNumber);
      if (data.matchId === currentMatchId && data.player !== currentPlayerNumber) {
        // Clear animation interval if it exists
        if (firstRollIntervalRef.current) {
          clearInterval(firstRollIntervalRef.current);
          firstRollIntervalRef.current = null;
        }
        
        console.log('Processing opponent first roll, updating state...');
        // Update opponent's first roll and turn together
        setFirstRolls(prev => {
          const newRolls = [...prev];
          newRolls[data.rollTurn - 1] = data.roll;
          console.log('Updated firstRolls to:', newRolls);
          return newRolls;
        });
        setIsFirstRolling(false);
        setFirstRollAnimationFrame(0);
        // Update turn to nextRollTurn if provided, otherwise use fallback logic
        const newTurn = data.nextRollTurn || (data.rollTurn === 1 ? 2 : 1);
        console.log('Setting firstRollTurn to:', newTurn);
        setFirstRollTurn(newTurn);
      } else {
        console.log('Ignoring first roll event - wrong match or same player');
      }
    };
    
    const handleFirstRollComplete = (data) => {
      if (data.matchId === currentMatchId) {
        // Clear animation interval if it exists
        if (firstRollIntervalRef.current) {
          clearInterval(firstRollIntervalRef.current);
          firstRollIntervalRef.current = null;
        }
        setIsFirstRolling(false);
        setFirstRollAnimationFrame(0);
        
        // Show result first, then close modal after delay
        setFirstRolls(data.firstRolls);
        setFirstRollResult(data.winner);
        
        // Wait to close modal so both players can see the result
        setTimeout(() => {
          setCurrentPlayer(data.currentPlayer);
          setFirstRollPhase(false);
          setHasRolled(true);
          setDice(data.dice);
          setUsedDice([]);
          setMovesAllowed(data.movesAllowed);
        }, 2000);
      }
    };
    
    const handleFirstRollTie = (data) => {
      if (data.matchId === currentMatchId) {
        // Clear animation interval if it exists
        if (firstRollIntervalRef.current) {
          clearInterval(firstRollIntervalRef.current);
          firstRollIntervalRef.current = null;
        }
        // Reset for tie
        setFirstRolls([null, null]);
        setFirstRollTurn(1);
        setFirstRollResult(null);
        setIsFirstRolling(false);
        setFirstRollAnimationFrame(0);
      }
    };
    
    socket.on('game:move', handleMove);
    socket.on('game:dice-roll-start', handleDiceRollStart);
    socket.on('game:dice-rolled', handleDiceRolled);
    socket.on('game:turn-changed', handleTurnChanged);
    socket.on('game:state-sync', handleStateSync);
    socket.on('game:double-offered', handleDoubleOffered);
    socket.on('game:over', handleGameOver);
    socket.on('game:first-roll-start', handleFirstRollStart);
    socket.on('game:first-roll', handleFirstRoll);
    socket.on('game:first-roll-complete', handleFirstRollComplete);
    socket.on('game:first-roll-tie', handleFirstRollTie);
    
    return () => {
      socket.off('game:move', handleMove);
      socket.off('game:dice-roll-start', handleDiceRollStart);
      socket.off('game:dice-rolled', handleDiceRolled);
      socket.off('game:turn-changed', handleTurnChanged);
      socket.off('game:state-sync', handleStateSync);
      socket.off('game:double-offered', handleDoubleOffered);
      socket.off('game:over', handleGameOver);
      socket.off('game:first-roll-start', handleFirstRollStart);
      socket.off('game:first-roll', handleFirstRoll);
      socket.off('game:first-roll-complete', handleFirstRollComplete);
      socket.off('game:first-roll-tie', handleFirstRollTie);
      socket.off('game:rematch-request', handleRematchRequest);
      socket.off('game:rematch-accept', handleRematchAccept);
      socket.off('game:rematch-decline', handleRematchDecline);
    };
  }, [isOnlineGame, matchId, playerNumber]);
  
  // Online Game Screen
  const renderOnlineGame = () => {
    const opponentName = opponent?.isGuest 
      ? `Guest ${opponent.userId?.split('_')[1]?.substring(0, 6) || 'Player'}` 
      : opponent?.userId || 'Opponent';
    
    return (
      <div style={{ textAlign: 'center', marginTop: 30 }}>
        <div style={{ marginBottom: '18px' }}>
          <img src="/logo.svg" alt="Backgammon Arena Logo" style={{ height: '120px' }} />
        </div>
        <h2>Online Guest Match - Unranked</h2>
        {message && <div style={{ color: 'red', margin: 10 }}>{message}</div>}
        {renderBoard()}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, margin: '16px 0 0 0' }}>
          <div style={{ fontSize: 20, minWidth: 180, textAlign: 'right' }}>
            <b>Player {playerNumber}</b>
            <span style={{
              display: 'inline-block',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: playerNumber === 1 ? '#fff' : '#222',
              marginLeft: 10,
              verticalAlign: 'middle',
              border: '2px solid #b87333',
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {undoStack.length > 0 && hasRolled && currentPlayer === playerNumber && (
                <button style={{ ...buttonStyle, background: '#ffc107', color: '#222' }} onClick={handleUndo}>Undo</button>
              )}
              <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff' }} onClick={confirmResign}>Resign</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Auto-roll:</span>
              <button 
                style={{ ...buttonStyle, minWidth: 60, padding: '8px 12px', fontSize: 14, background: autoRoll[playerNumber] ? '#28a745' : '#6c757d', color: '#fff' }} 
                onClick={() => setAutoRoll(prev => ({ ...prev, [playerNumber]: !prev[playerNumber] }))}
              >
                {autoRoll[playerNumber] ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
        {firstRollPhase && renderFirstRollModal()}
        {doubleOffer && doubleOffer.to === playerNumber && (
          <div 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              width: '100vw', 
              height: '100vh', 
              background: 'rgba(0, 0, 0, 0.5)', 
              zIndex: 2000, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                // Don't close on background click
              }
            }}
          >
            <div 
              style={{ 
                background: '#fff', 
                borderRadius: '16px', 
                padding: '40px', 
                minWidth: '400px', 
                maxWidth: '480px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                animation: 'fadeIn 0.2s ease-in',
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: 16, fontSize: 28, color: '#ff6b35', fontWeight: 'bold' }}>🎲 Double Offered! 🎲</div>
              <div style={{ marginBottom: 12, fontSize: 18, color: '#333' }}>Opponent offers to double the stakes</div>
              <div style={{ marginBottom: 20, fontSize: 16, color: '#666' }}>Current stakes: {gameStakes} | New stakes: {gameStakes * 2}</div>
              <div style={{ marginBottom: 24, fontSize: 18, color: doubleTimer <= 3 ? '#dc3545' : '#333', fontWeight: 'bold' }}>⏰ {doubleTimer} seconds to decide</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button style={{ ...buttonStyle, minWidth: 120, padding: '12px 24px', fontSize: 18, background: '#28a745', color: '#fff' }} onClick={() => handleDoubleResponse(true)}>Accept</button>
                <button style={{ ...buttonStyle, minWidth: 120, padding: '12px 24px', fontSize: 18, background: '#dc3545', color: '#fff' }} onClick={() => handleDoubleResponse(false)}>Decline</button>
              </div>
            </div>
          </div>
        )}
        {showConfirmResign && (
          <div 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              width: '100vw', 
              height: '100vh', 
              background: 'rgba(0, 0, 0, 0.5)', 
              zIndex: 2000, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cancelResign();
              }
            }}
          >
            <div 
              style={{ 
                background: '#fff', 
                borderRadius: '16px', 
                padding: '40px', 
                minWidth: '400px', 
                maxWidth: '480px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                animation: 'fadeIn 0.2s ease-in',
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: 24, fontSize: 20, fontWeight: 'bold', color: '#222' }}>Are you sure you want to resign?</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button style={{ ...buttonStyle, background: '#dc3545', color: '#fff', minWidth: 120, fontSize: 18, padding: '12px 24px' }} onClick={doResign}>Yes</button>
                <button style={{ ...buttonStyle, background: '#6c757d', color: '#fff', minWidth: 120, fontSize: 18, padding: '12px 24px' }} onClick={cancelResign}>No</button>
              </div>
            </div>
          </div>
        )}
        {gameOver && (
          <div 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              width: '100vw', 
              height: '100vh', 
              background: 'rgba(0, 0, 0, 0.5)', 
              zIndex: 2000, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                // Don't close on background click
              }
            }}
          >
            <div 
              style={{ 
                background: '#fff', 
                borderRadius: '16px', 
                padding: '40px', 
                minWidth: '400px', 
                maxWidth: '480px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                animation: 'fadeIn 0.2s ease-in',
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginBottom: 20, fontSize: 24, fontWeight: 'bold', color: '#222' }}>{getGameOverMessage(gameOver)}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center', marginTop: 20, width: '100%' }}>
                {!rematchRequest ? (
                  <>
                    <button style={buttonStyle} onClick={() => {
                      if (isOnlineGame && socketRef.current && matchId) {
                        const toPlayer = playerNumber === 1 ? 2 : 1;
                        setRematchRequest({ from: playerNumber, to: toPlayer });
                        socketRef.current.emit('game:rematch-request', {
                          matchId,
                          from: playerNumber,
                          to: toPlayer
                        });
                      } else {
                        handleRematch();
                      }
                    }}>Rematch</button>
                    <button style={{ ...buttonStyle, background: '#007bff' }} onClick={() => { 
                      if (isOnlineGame) {
                        // Disconnect from current match
                        if (socketRef.current) {
                          socketRef.current.disconnect();
                          socketRef.current = null;
                        }
                        // Reset game state
                        setGameOver(null);
                        setRematchRequest(null);
                        setIsOnlineGame(false);
                        setMatchId(null);
                        setPlayerNumber(null);
                        setOpponent(null);
                        // Start matchmaking
                        setIsMatchmaking(true);
                        setMatchmakingType('guest');
                        setScreen('onlineMatchmaking');
                        setMatchmakingStatus('Connecting...');
                      } else {
                        handleQuit();
                      }
                    }}>New Game</button>
                    <button style={{ ...buttonStyle, background: '#6c757d' }} onClick={handleQuit}>Quit</button>
                  </>
                ) : rematchRequest.from === playerNumber ? (
                  <>
                    <div style={{ marginBottom: 10, color: '#666', fontSize: 16 }}>Rematch request sent...</div>
                    <button style={{ ...buttonStyle, background: '#007bff' }} onClick={() => { 
                      // Disconnect from current match
                      if (socketRef.current) {
                        socketRef.current.disconnect();
                        socketRef.current = null;
                      }
                      // Reset game state
                      setGameOver(null);
                      setRematchRequest(null);
                      setIsOnlineGame(false);
                      setMatchId(null);
                      setPlayerNumber(null);
                      setOpponent(null);
                      // Start matchmaking
                      setIsMatchmaking(true);
                      setMatchmakingType('guest');
                      setScreen('onlineMatchmaking');
                      setMatchmakingStatus('Connecting...');
                    }}>New Game</button>
                    <button style={{ ...buttonStyle, background: '#6c757d' }} onClick={handleQuit}>Quit</button>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 10, color: '#666', fontSize: 16 }}>Opponent requested rematch</div>
                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                      <button style={{ ...buttonStyle, flex: 1, background: '#28a745' }} onClick={() => {
                        if (isOnlineGame && socketRef.current && matchId) {
                          socketRef.current.emit('game:rematch-accept', {
                            matchId,
                            from: rematchRequest.from,
                            to: playerNumber
                          });
                          // Reset game state for rematch
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
                          setTimer(45);
                          setUndoStack([]);
                          setMoveMade(false);
                          setAwaitingEndTurn(false);
                          setDoubleOffer(null);
                          setDoubleTimer(12);
                          setCanDouble({ 1: true, 2: true });
                          setGameStakes(1);
                          setNoMoveOverlay(false);
                          setShowConfirmResign(false);
                          setFirstRollPhase(true);
                          setFirstRolls([null, null]);
                          setFirstRollTurn(1);
                          setFirstRollResult(null);
                          setRematchRequest(null);
                          if (timerRef.current) clearInterval(timerRef.current);
                        }
                      }}>Accept</button>
                      <button style={{ ...buttonStyle, flex: 1, background: '#dc3545' }} onClick={() => {
                        if (isOnlineGame && socketRef.current && matchId) {
                          socketRef.current.emit('game:rematch-decline', {
                            matchId,
                            from: rematchRequest.from,
                            to: playerNumber
                          });
                          setRematchRequest(null);
                        }
                      }}>Decline</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Profile Page
  const renderProfile = () => {
    if (!user) {
      // Redirect to home if not logged in
      setScreen('home');
      return null;
    }

    const handleSignOut = async () => {
      if (supabase) {
        await supabase.auth.signOut();
        setUser(null);
        setUserProfile(null);
        setScreen('home');
      }
    };

    const handleUpdateCountry = async () => {
      if (!supabase || !newCountry) return;

      const { error } = await supabase
        .from('users')
        .update({ country: newCountry })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating country:', error);
        alert('Failed to update country');
      } else {
        setUserProfile({ ...userProfile, country: newCountry });
        setEditingCountry(false);
        setNewCountry('');
      }
    };

    const handleUpdateAvatar = async (avatarName) => {
      if (!supabase) return;

      const { error } = await supabase
        .from('users')
        .update({ avatar: avatarName })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating avatar:', error);
        alert('Failed to update avatar');
      } else {
        setUserProfile({ ...userProfile, avatar: avatarName });
        setShowAvatarSelector(false);
      }
    };

    return (
      <div style={{ textAlign: 'center', marginTop: 30, paddingBottom: 40, background: '#a8a7a8', minHeight: '100vh' }}>
        <div style={{
          ...sectionStyle,
          maxWidth: 1200,
          width: '100%',
          margin: '20px auto',
          padding: '40px'
        }}>
          <div style={{ marginBottom: '32px', textAlign: 'left' }}>
            <button
              onClick={() => setScreen('home')}
              style={{
                ...buttonStyle,
                background: '#6c757d',
                minWidth: '120px'
              }}
            >
              ← Back to Home
            </button>
          </div>

          {/* Profile Header - 2 Columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '24px',
            marginBottom: '32px',
            alignItems: 'center',
            textAlign: 'left'
          }}>
            <div style={{ position: 'relative' }}>
              {userProfile?.avatar ? (
                <img 
                  src={`/avatars/${userProfile.avatar}.png`}
                  alt={userProfile.avatar}
                  onClick={() => setShowAvatarSelector(true)}
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    cursor: 'pointer',
                    border: '3px solid #ff751f',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.opacity = '0.8';
                    e.target.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1';
                    e.target.style.transform = 'scale(1)';
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                onClick={() => setShowAvatarSelector(true)}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '12px',
                  background: '#ff751f',
                  display: userProfile?.avatar ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  color: '#fff',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '3px solid #ff751f'
                }}
                onMouseEnter={(e) => {
                  e.target.style.opacity = '0.8';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '1';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                {userProfile?.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '👤'}
              </div>
            </div>
            <div>
              <h1 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '32px', 
                color: '#000',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                {userProfile?.username || 'User'}
              </h1>
              <p style={{ 
                margin: '0 0 8px 0', 
                fontSize: '16px', 
                color: '#666',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                {user.email}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  fontSize: '16px', 
                  color: '#666',
                  fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                }}>
                  {editingCountry ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={newCountry || userProfile?.country || 'US'}
                        onChange={(e) => setNewCountry(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '2px solid #ddd',
                          fontSize: '14px',
                          fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif',
                          minWidth: '200px'
                        }}
                      >
                        {countries.map(country => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleUpdateCountry}
                        style={{
                          padding: '6px 12px',
                          background: '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingCountry(false);
                          setNewCountry('');
                        }}
                        style={{
                          padding: '6px 12px',
                          background: '#6c757d',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: '20px' }}>
                        {getCountryFlag(userProfile?.country)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingCountry(true);
                          setNewCountry(userProfile?.country || 'US');
                        }}
                        style={{
                          marginLeft: '8px',
                          padding: '4px 12px',
                          background: 'transparent',
                          color: '#666',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                        }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Section - 2 Columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px',
            marginBottom: '32px'
          }}>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>ELO Rating</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff751f' }}>
                {userProfile?.elo_rating || 1000}
              </div>
            </div>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Games Played</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#6c757d' }}>
                {userProfile?.games_played || 0}
              </div>
            </div>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Wins</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#28a745' }}>
                {userProfile?.wins || 0}
              </div>
            </div>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Losses</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc3545' }}>
                {userProfile?.losses || 0}
              </div>
            </div>
          </div>

          {/* Placeholder for future content */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '24px'
          }}>
            <h2 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '20px', 
              color: '#000',
              fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
            }}>
              Game History
            </h2>
            <p style={{ color: '#666', fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif' }}>
              Your game history will appear here
            </p>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            style={{
              ...buttonStyle,
              background: '#dc3545',
              color: '#fff',
              width: '100%',
              maxWidth: '300px'
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Avatar Selector Modal */}
        {showAvatarSelector && (
          <div 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              width: '100vw', 
              height: '100vh', 
              background: 'rgba(0, 0, 0, 0.5)', 
              zIndex: 2000, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAvatarSelector(false);
              }
            }}
          >
            <div 
              style={{ 
                background: '#fff', 
                borderRadius: '16px', 
                padding: '40px', 
                minWidth: '500px', 
                maxWidth: '600px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                animation: 'fadeIn 0.2s ease-in'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowAvatarSelector(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '28px',
                  cursor: 'pointer',
                  color: '#666',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s',
                  lineHeight: 1
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f0f0f0';
                  e.target.style.color = '#000';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#666';
                }}
              >
                ×
              </button>

              <h2 style={{ 
                margin: '0 0 24px 0', 
                fontSize: '24px', 
                fontWeight: 'bold', 
                color: '#000',
                fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
              }}>
                Choose Your Avatar
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px'
              }}>
                {availableAvatars.map((avatarName) => (
                  <div
                    key={avatarName}
                    onClick={() => handleUpdateAvatar(avatarName)}
                    style={{
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '12px',
                      border: userProfile?.avatar === avatarName ? '3px solid #ff751f' : '2px solid #ddd',
                      background: userProfile?.avatar === avatarName ? '#fff5f0' : '#fff',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#ff751f';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (userProfile?.avatar !== avatarName) {
                        e.currentTarget.style.borderColor = '#ddd';
                      }
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <img 
                      src={`/avatars/${avatarName}.png`}
                      alt={avatarName}
                      style={{
                        width: '100%',
                        height: 'auto',
                        borderRadius: '8px',
                        display: 'block'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.textContent = avatarName[0];
                        fallback.style.cssText = 'width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: #ff751f; color: #fff; font-weight: bold; border-radius: 8px;';
                        e.target.parentNode.appendChild(fallback);
                      }}
                    />
                    <p style={{
                      margin: '8px 0 0 0',
                      fontSize: '12px',
                      textAlign: 'center',
                      color: '#666',
                      fontFamily: 'Montserrat, Segoe UI, Verdana, Geneva, sans-serif'
                    }}>
                      {avatarName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (screen === 'home') return renderHome();
  if (screen === 'matchmaking') return renderMatchmaking();
  if (screen === 'onlineGame') return renderOnlineGame();
  if (screen === 'passplay') return renderPassPlay();
  if (screen === 'cpu-difficulty') return renderCpuDifficultySelection();
  if (screen === 'cpu') return renderCpuGame();
  if (screen === 'profile') return renderProfile();
  
  return renderHome();
}

export default GameBoard;
