/**
 * CPU AI Module for Backgammon Arena
 * 
 * This module will handle CPU move calculations based on difficulty level (1-10).
 * Currently a placeholder structure - will be integrated with a backgammon AI library.
 * 
 * TODO: Integrate with a backgammon AI library (e.g., backgammon.js AI module, 
 *       GNU Backgammon JS port, or custom minimax/neural network implementation)
 */

/**
 * Get the best move for the CPU player based on difficulty level
 * Calls the Python GNU Backgammon AI service
 * 
 * @param {Object} gameState - Current game state
 * @param {number} difficulty - Difficulty level (1-10)
 * @param {Array} legalMoves - Array of legal moves
 * @returns {Promise<Object|null>} - Best move object or null if no valid moves
 */
export async function getCpuMove(gameState, difficulty, legalMoves = []) {
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    const response = await fetch(`${API_URL}/api/cpu/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameState: gameState,
        difficulty: difficulty,
        legalMoves: legalMoves
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.move || null;
  } catch (error) {
    console.error('Error getting CPU move:', error);
    // Fallback: return null (CPU will pass)
    return null;
  }
}

/**
 * Calculate move accuracy based on difficulty
 * Lower difficulty = more mistakes
 * 
 * @param {number} difficulty - Difficulty level (1-10)
 * @returns {number} - Accuracy percentage (0-1)
 */
export function getMoveAccuracy(difficulty) {
  // Level 1: 60% accuracy
  // Level 10: 98% accuracy
  return 0.6 + (difficulty - 1) * (0.38 / 9);
}

/**
 * Get thinking time for CPU based on difficulty
 * Higher difficulty = faster moves (better AI)
 * 
 * @param {number} difficulty - Difficulty level (1-9)
 * @returns {number} - Thinking time in milliseconds
 */
export function getThinkingTime(difficulty) {
  // Level 1: 800ms
  // Level 9: 320ms
  return Math.max(200, 800 - (difficulty - 1) * 60);
}

/**
 * Check if CPU should accept a double offer
 * Calls the Python GNU Backgammon AI service
 * 
 * @param {Object} gameState - Current game state
 * @param {number} difficulty - Difficulty level (1-10)
 * @returns {Promise<boolean>} - Whether to accept the double
 */
export async function shouldAcceptDouble(gameState, difficulty) {
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    const response = await fetch(`${API_URL}/api/cpu/double`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameState: gameState,
        difficulty: difficulty,
        action: 'accept'
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.should || false;
  } catch (error) {
    console.error('Error evaluating double acceptance:', error);
    // Fallback: simple logic
    const threshold = 0.5 + (difficulty - 1) * 0.05;
    return Math.random() < threshold;
  }
}

/**
 * Check if CPU should offer a double
 * Calls the Python GNU Backgammon AI service
 * 
 * @param {Object} gameState - Current game state
 * @param {number} difficulty - Difficulty level (1-10)
 * @returns {Promise<boolean>} - Whether to offer a double
 */
export async function shouldOfferDouble(gameState, difficulty) {
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    const response = await fetch(`${API_URL}/api/cpu/double`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameState: gameState,
        difficulty: difficulty,
        action: 'offer'
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.should || false;
  } catch (error) {
    console.error('Error evaluating double offer:', error);
    // Fallback: simple logic
    const threshold = 0.3 + (difficulty - 1) * 0.06;
    return Math.random() < threshold;
  }
}

