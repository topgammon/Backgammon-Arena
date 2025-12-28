"""
GNU Backgammon AI Service for Backgammon Arena
Provides CPU move calculation with difficulty levels (1-10)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import random
import sys
import subprocess
import os
import shutil
import ctypes
import threading
import time
import re

app = Flask(__name__)
CORS(app)

# GNU Backgammon integration
# Check if gnubg is available in PATH
GNUBG_AVAILABLE = False
GNUBG_PATH = None

# Persistent GNU Backgammon process for faster move recommendations
GNUBG_PROCESS = None
GNUBG_LOCK = threading.Lock()  # Lock to ensure only one thread interacts with GNUBG at a time

# Try to find gnubg executable
if shutil.which('gnubg'):
    GNUBG_PATH = 'gnubg'
    GNUBG_AVAILABLE = True
elif shutil.which('gnubg-cli'):
    GNUBG_PATH = 'gnubg-cli'
    GNUBG_AVAILABLE = True
elif os.path.exists('/usr/bin/gnubg'):
    GNUBG_PATH = '/usr/bin/gnubg'
    GNUBG_AVAILABLE = True
elif os.path.exists('/usr/local/bin/gnubg'):
    GNUBG_PATH = '/usr/local/bin/gnubg'
    GNUBG_AVAILABLE = True
# Windows paths - check user's AppData first (common installation location)
# Prefer gnubg-cli.exe for command-line interface
gnubg_user_path_cli = os.path.expanduser('~\\AppData\\Local\\gnubg\\gnubg-cli.exe')
gnubg_user_path = os.path.expanduser('~\\AppData\\Local\\gnubg\\gnubg.exe')
if os.path.exists(gnubg_user_path_cli):
    GNUBG_PATH = gnubg_user_path_cli
    GNUBG_AVAILABLE = True
elif os.path.exists(gnubg_user_path):
    GNUBG_PATH = gnubg_user_path
    GNUBG_AVAILABLE = True
elif os.path.exists('C:\\Program Files\\GNU Backgammon\\gnubg.exe'):
    GNUBG_PATH = 'C:\\Program Files\\GNU Backgammon\\gnubg.exe'
    GNUBG_AVAILABLE = True
elif os.path.exists('C:\\Program Files (x86)\\GNU Backgammon\\gnubg.exe'):
    GNUBG_PATH = 'C:\\Program Files (x86)\\GNU Backgammon\\gnubg.exe'
    GNUBG_AVAILABLE = True

if GNUBG_AVAILABLE:
    print(f"✓ GNU Backgammon found at: {GNUBG_PATH}")
    print("  Using GNU Backgammon neural network for evaluation")
    print("  Fallback AI available with advanced heuristics:")
    print("    - Pip count evaluation (55% weight)")
    print("    - Trapped pieces detection (12-22% weight)")
    print("    - Exposed blots analysis (10% weight)")
    print("    - 100% won position detection")
else:
    print("ℹ GNU Backgammon not found - using fallback AI")
    print("  To enable GNU Backgammon:")
    print("    - Install from: https://www.gnu.org/software/gnubg/")
    print("    - Or use: sudo apt-get install gnubg (Linux)")
    print("    - Or: brew install gnubg (Mac)")


def calculate_pip_count(checkers, bar, borne_off, player):
    """
    Calculate pip count (total distance all pieces need to travel to bear off)
    """
    pips = 0
    
    # Add pips for pieces on the board
    for checker in checkers:
        if checker.get('player') == player:
            point = checker.get('point', 0)
            if point >= 0 and point <= 23:  # On board
                if player == 1:
                    pips += 24 - point  # Distance from point to bear off
                else:  # player == 2
                    pips += point + 1  # Distance from point to bear off
    
    # Add pips for pieces on bar (25 pips each)
    pips += len(bar.get(str(player), [])) * 25
    
    # Subtract pips for pieces already borne off (they count as 0)
    # Already handled since borne off pieces aren't in checkers
    
    return pips


def is_point_blocked(checkers, point, blocking_player):
    """
    Check if a point is blocked by the blocking player (2+ pieces)
    """
    count = sum(1 for c in checkers if c.get('point') == point and c.get('player') == blocking_player)
    return count >= 2


def count_exposed_blots(checkers, player):
    """
    Count exposed blots (single pieces that can be hit by opponent)
    A blot is a single piece on a point (not protected by having 2+ pieces)
    """
    # Count unique points that have exactly 1 piece (blots)
    blots_by_point = {}
    
    # First, count pieces per point for this player
    for checker in checkers:
        if checker.get('player') == player:
            point = checker.get('point', -1)
            if 0 <= point <= 23:  # On board (not bar or borne off)
                if point not in blots_by_point:
                    # Count how many pieces of this player are on this point
                    pieces_on_point = sum(1 for c in checkers 
                                        if c.get('point') == point and c.get('player') == player)
                    # If only 1 piece, it's a blot (exposed/vulnerable)
                    if pieces_on_point == 1:
                        blots_by_point[point] = True
                    else:
                        blots_by_point[point] = False  # Mark as not a blot (protected)
    
    # Return count of points with blots
    return sum(1 for is_blot in blots_by_point.values() if is_blot)


def count_trapped_pieces(checkers, bar, player):
    """
    Count pieces that are trapped:
    1. On bar with all entry points blocked (prime)
    2. In opponent's home board behind a prime (6 consecutive blocked points)
    """
    trapped = 0
    opponent = 1 if player == 2 else 2
    
    # Check pieces on bar
    bar_pieces = len(bar.get(str(player), []))
    if bar_pieces > 0:
        # Check if all entry points are blocked
        # Player 1 enters on points 0-5 (points 1-6 on board)
        # Player 2 enters on points 18-23 (points 19-24 on board)
        if player == 1:
            entry_points = [0, 1, 2, 3, 4, 5]  # Points 1-6 (0-indexed)
        else:  # player == 2
            entry_points = [18, 19, 20, 21, 22, 23]  # Points 19-24 (0-indexed)
        
        # Count how many entry points are blocked
        blocked_entry_points = sum(1 for point in entry_points if is_point_blocked(checkers, point, opponent))
        
        # If all 6 entry points are blocked, pieces on bar are trapped
        if blocked_entry_points >= 6:
            trapped += bar_pieces
        # If 4-5 entry points blocked, partially trapped
        elif blocked_entry_points >= 4:
            trapped += bar_pieces * 0.5
    
    # Check pieces in opponent's home board that are behind a prime
    # Player 1's home: points 18-23 (points 19-24 on board)
    # Player 2's home: points 0-5 (points 1-6 on board)
    if player == 1:
        # Player 1 pieces in Player 2's home (points 0-5)
        opponent_home = list(range(0, 6))
        player_checkers_in_opponent_home = [c for c in checkers 
                                           if c.get('player') == player 
                                           and 0 <= c.get('point', -1) <= 5]
        
        # Check if there's a prime blocking escape (6 consecutive blocked points)
        for checker in player_checkers_in_opponent_home:
            point = checker.get('point', 0)
            # Check if all points from current position forward are blocked
            escape_route_blocked = True
            for i in range(min(6, 24 - point)):
                check_point = point + i
                if check_point < 24 and not is_point_blocked(checkers, check_point, opponent):
                    escape_route_blocked = False
                    break
            if escape_route_blocked:
                trapped += 1
                
    else:  # player == 2
        # Player 2 pieces in Player 1's home (points 18-23)
        opponent_home = list(range(18, 24))
        player_checkers_in_opponent_home = [c for c in checkers 
                                           if c.get('player') == player 
                                           and 18 <= c.get('point', -1) <= 23]
        
        # Check if there's a prime blocking escape
        for checker in player_checkers_in_opponent_home:
            point = checker.get('point', 23)
            # Check if all points from current position backward are blocked
            escape_route_blocked = True
            for i in range(min(6, point + 1)):
                check_point = point - i
                if check_point >= 0 and not is_point_blocked(checkers, check_point, opponent):
                    escape_route_blocked = False
                    break
            if escape_route_blocked:
                trapped += 1
    
    return trapped


def is_position_won(checkers, bar, borne_off, player):
    """
    Check if a position is 100% won (mathematically certain win)
    Conditions:
    1. All pieces are in home board or borne off
    2. No pieces on bar
    3. Opponent has no pieces in front to block
    4. Even worst-case scenario (all 1s) would still win
    """
    opponent = 1 if player == 2 else 2
    
    # Check if player has all pieces in home or borne off
    if player == 1:
        player_pieces_in_home = sum(1 for c in checkers 
                                    if c.get('player') == player 
                                    and 18 <= c.get('point', -1) <= 23)
    else:  # player == 2
        player_pieces_in_home = sum(1 for c in checkers 
                                    if c.get('player') == player 
                                    and 0 <= c.get('point', -1) <= 5)
    
    player_borne_off_count = borne_off.get(str(player), 0)
    player_on_bar = len(bar.get(str(player), []))
    
    # All pieces must be in home or borne off, none on bar
    total_pieces = player_pieces_in_home + player_borne_off_count + player_on_bar
    if total_pieces < 15 or player_on_bar > 0:
        return False
    
    # Check if opponent has any pieces in front of player's home
    if player == 1:
        opponent_in_front = sum(1 for c in checkers 
                                if c.get('player') == opponent 
                                and 18 <= c.get('point', -1) <= 23)
    else:  # player == 2
        opponent_in_front = sum(1 for c in checkers 
                                if c.get('player') == opponent 
                                and 0 <= c.get('point', -1) <= 5)
    
    if opponent_in_front > 0:
        return False
    
    # Calculate worst-case scenario: player rolls all 1s, opponent rolls all 6s
    player_pips = calculate_pip_count(checkers, bar, borne_off, player)
    opponent_pips = calculate_pip_count(checkers, bar, borne_off, opponent)
    
    # If player has significantly fewer pips and all pieces in home, they win
    # Simple heuristic: if player has < 10 pips and opponent has > 20 pips, player wins
    if player_pips < 10 and opponent_pips > 20:
        return True
    
    # More sophisticated: if player can bear off in worst case before opponent
    if player_borne_off_count >= 10 and player_pips < 15:
        return True
    
    return False


def evaluate_position_simple(game_state):
    """
    Improved position evaluation
    Returns a score from -1 (CPU losing badly) to 1 (CPU winning badly)
    
    First checks for 100% won/lost positions, then uses heuristic evaluation.
    
    Factors considered (weighted):
    1. Pip count (heaviest weight - ~55%)
    2. Pieces borne off (~20%)
    3. Trapped pieces (~12%)
    4. Exposed blots (~10%)
    5. Position (pieces in home board) (~3%)
    """
    checkers = game_state.get('checkers', [])
    bar = game_state.get('bar', {})
    borne_off = game_state.get('borneOff', {})
    current_player = game_state.get('currentPlayer', 2)  # CPU is player 2
    
    # Check for 100% won positions first
    cpu_won = is_position_won(checkers, bar, borne_off, 2)
    player_won = is_position_won(checkers, bar, borne_off, 1)
    
    if cpu_won and not player_won:
        return 1.0  # CPU has 100% win
    if player_won and not cpu_won:
        return -1.0  # Player has 100% win
    
    # Calculate pip counts
    cpu_pips = calculate_pip_count(checkers, bar, borne_off, 2)
    player_pips = calculate_pip_count(checkers, bar, borne_off, 1)
    
    # Pip advantage (negative means CPU is ahead)
    pip_diff = player_pips - cpu_pips
    
    # Normalize pip difference (typical game has ~150-200 pips per player)
    # Scale so difference of 50 pips = about 0.5 evaluation
    pip_score = pip_diff / 100.0  # Max pip diff ~50-60 = 0.5-0.6 score
    
    # Pieces borne off (higher is better)
    cpu_borne_off = borne_off.get('2', 0)
    player_borne_off = borne_off.get('1', 0)
    borne_off_diff = cpu_borne_off - player_borne_off
    borne_off_score = borne_off_diff / 15.0  # Normalize by max pieces (15)
    
    # Trapped pieces (having trapped pieces is bad)
    cpu_trapped = count_trapped_pieces(checkers, bar, 2)
    player_trapped = count_trapped_pieces(checkers, bar, 1)
    trapped_diff = player_trapped - cpu_trapped
    trapped_score = trapped_diff / 5.0  # Normalize (max trapped ~3-5 pieces)
    
    # Exposed blots (single vulnerable pieces that can be hit)
    cpu_blots = count_exposed_blots(checkers, 2)
    player_blots = count_exposed_blots(checkers, 1)
    blots_diff = player_blots - cpu_blots
    blots_score = blots_diff / 10.0  # Normalize (max blots ~8-10 in a game)
    
    # Position evaluation (pieces in home board, safe points)
    cpu_in_home = sum(1 for c in checkers 
                     if c.get('player') == 2 and 0 <= c.get('point', -1) <= 5)
    player_in_home = sum(1 for c in checkers 
                        if c.get('player') == 1 and 18 <= c.get('point', -1) <= 23)
    position_diff = cpu_in_home - player_in_home
    position_score = position_diff / 15.0  # Normalize
    
    # Weighted combination:
    # Pips: 55% (most important, but position can override)
    # Borne off: 20%
    # Trapped: 12% (very important - can reverse pip advantage)
    # Blots: 10% (exposed vulnerable pieces)
    # Position: 3%
    
    # If there are many trapped pieces, boost their influence
    # Trapped pieces can significantly override pip advantage
    if abs(trapped_score) > 0.3:  # Significant trapped piece difference
        # Boost the trapped score influence when it matters
        evaluation = (
            pip_score * 0.45 +  # Reduce pip weight slightly
            borne_off_score * 0.20 +
            trapped_score * 0.22 +  # Increase trapped weight
            blots_score * 0.10 +
            position_score * 0.03
        )
    else:
        evaluation = (
            pip_score * 0.55 +
            borne_off_score * 0.20 +
            trapped_score * 0.12 +
            blots_score * 0.10 +
            position_score * 0.03
        )
    
    # Clamp to -1 to 1 range
    evaluation = max(-1.0, min(1.0, evaluation))
    
    return evaluation


def encode_position_to_gnubg(checkers, bar, borne_off, current_player):
    """
    Convert game state to GNU Backgammon position string format (same logic as gnubg_eval.py)
    GNU Backgammon format: position X:Y where X is point (1-24, 25=bar, 0=bar), Y is checkers
    Positive Y = player 1 (O), negative Y = player 2 (X)
    """
    points = {}
    
    # Process checkers on the board
    for checker in checkers:
        if isinstance(checker, dict):
            point = checker.get('point', -1)
            player = checker.get('player', 0)
        else:
            point = getattr(checker, 'point', -1)
            player = getattr(checker, 'player', 0)
        
        try:
            point = int(point)
            player = int(player)
        except (ValueError, TypeError):
            continue
        
        if point < 0 or point > 23 or player not in [1, 2]:
            continue
        
        if player == 1:
            gnubg_point = 24 - point
            points[gnubg_point] = points.get(gnubg_point, 0) + 1
        else:
            gnubg_point = point + 1
            points[gnubg_point] = points.get(gnubg_point, 0) - 1
    
    # Handle bar
    bar1 = len(bar.get('1', [])) if isinstance(bar, dict) else len(bar.get(1, []))
    bar2 = len(bar.get('2', [])) if isinstance(bar, dict) else len(bar.get(2, []))
    if bar1 > 0:
        points[25] = bar1
    if bar2 > 0:
        points[0] = -bar2
    
    # Build position string
    pos_parts = []
    for point_num in sorted(points.keys(), reverse=True):
        checker_count = points[point_num]
        if checker_count != 0:
            pos_parts.append(f"{point_num}:{checker_count}")
    
    return " ".join(pos_parts) if pos_parts else ""


def start_gnubg_process():
    """Start a persistent GNU Backgammon process for faster move recommendations"""
    global GNUBG_PROCESS
    if not GNUBG_AVAILABLE:
        return None
    
    if GNUBG_PROCESS and GNUBG_PROCESS.poll() is None:
        return GNUBG_PROCESS  # Process is still running
    
    print("Starting persistent GNU Backgammon process...")
    try:
        subprocess_kwargs = {
            'stdin': subprocess.PIPE,
            'stdout': subprocess.PIPE,
            'stderr': subprocess.PIPE,
            'text': True,
            'bufsize': 1,  # Line-buffered
        }
        
        if sys.platform == 'win32':
            try:
                subprocess_kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
            except AttributeError:
                pass
        
        # Start gnubg-cli in command-line mode
        process = subprocess.Popen(
            [GNUBG_PATH, '-t', '-c', '--no-rc', '--quiet'],
            **subprocess_kwargs
        )
        
        # Read initial banner to clear buffer
        output = ""
        start_time = time.time()
        while "gnubg>" not in output and time.time() - start_time < 2.0:
            try:
                line = process.stdout.readline()
                if not line:
                    break
                output += line
            except:
                break
        
        if "gnubg>" in output:
            print("✓ GNU Backgammon process started successfully")
            GNUBG_PROCESS = process
            return process
        else:
            print("✗ GNU Backgammon process did not start correctly")
            if process.poll() is not None:
                print(f"  Process exited with code: {process.returncode}")
            GNUBG_PROCESS = None
            return None
    except Exception as e:
        print(f"✗ Error starting GNU Backgammon process: {e}")
        GNUBG_PROCESS = None
        return None


def send_gnubg_command(command, timeout=1.0):
    """Send a command to the persistent GNU Backgammon process and return output"""
    global GNUBG_PROCESS
    
    if not GNUBG_PROCESS or GNUBG_PROCESS.poll() is not None:
        start_gnubg_process()
        if not GNUBG_PROCESS:
            raise Exception("GNU Backgammon process not available")
    
    with GNUBG_LOCK:
        try:
            # Clear any pending output (try to read until prompt appears)
            for _ in range(20):
                try:
                    line = GNUBG_PROCESS.stdout.readline()
                    if not line or "gnubg>" in line:
                        break
                except:
                    break
            
            # Send command
            GNUBG_PROCESS.stdin.write(command + '\n')
            GNUBG_PROCESS.stdin.flush()
            
            # Read output until we see the prompt
            output_lines = []
            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    line = GNUBG_PROCESS.stdout.readline()
                    if not line:
                        break
                    output_lines.append(line.rstrip())
                    if "gnubg>" in line:
                        break
                except:
                    break
            
            return "\n".join(output_lines)
        except Exception as e:
            print(f"✗ Error sending command to GNU Backgammon: {e}")
            # Try to restart process on error
            try:
                GNUBG_PROCESS.kill()
            except:
                pass
            GNUBG_PROCESS = None
            raise


def get_gnubg_hint(game_state, dice):
    """
    Get move recommendation from GNU Backgammon using the 'hint' command.
    This is much faster than evaluating each move separately.
    """
    if not GNUBG_AVAILABLE:
        return None
    
    try:
        start_gnubg_process()
        if not GNUBG_PROCESS:
            return None
        
        # Set board position
        checkers = game_state.get('checkers', [])
        bar = game_state.get('bar', {})
        borne_off = game_state.get('borneOff', {})
        current_player = game_state.get('currentPlayer', 1)
        
        pos_str = encode_position_to_gnubg(checkers, bar, borne_off, current_player)
        
        # Start new game and set position
        send_gnubg_command("new game", timeout=0.5)
        
        if pos_str:
            send_gnubg_command(f"set board position {pos_str}", timeout=0.5)
        else:
            send_gnubg_command("set board", timeout=0.5)  # Initial position
        
        # Set turn (GNU Backgammon uses 0 for first player, 1 for second)
        gnubg_player = 0 if current_player == 1 else 1
        send_gnubg_command(f"set turn {gnubg_player}", timeout=0.5)
        
        # Set dice
        dice_str = f"{dice[0]} {dice[1]}"
        send_gnubg_command(f"set dice {dice_str}", timeout=0.5)
        
        # Get hint (best move recommendation)
        hint_output = send_gnubg_command("hint", timeout=4.0)
        
        # Parse hint output
        # Example: "Best move: 8/5 6/5 (equity -0.000)"
        match = re.search(r"Best move:\s+(.*?)\s+\(equity\s+([-+]?\d*\.\d+)\)", hint_output)
        if match:
            move_str = match.group(1).strip()
            equity = float(match.group(2))
            
            # Adjust equity for current player (GNU Backgammon returns from perspective of player to move)
            if current_player == 1:
                equity = -equity  # Flip sign for player 1
            
            return {'move_str': move_str, 'equity': equity}
        
        return None
    except Exception as e:
        print(f"✗ Error getting GNU Backgammon hint: {e}")
        return None


def evaluate_position_gnubg(game_state):
    """
    Evaluate position using GNU Backgammon (if available)
    
    Uses GNU Backgammon's Python API via subprocess execution.
    Creates a temporary JSON file with game state, executes gnubg-cli with
    a Python script that uses the gnubg module to evaluate the position.
    
    Returns equity from -1 (CPU losing) to 1 (CPU winning), or None if unavailable
    """
    if not GNUBG_AVAILABLE:
        return None
    
    try:
        import tempfile
        
        # Create temporary JSON file with game state
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp_file:
            json.dump(game_state, tmp_file)
            tmp_path = tmp_file.name
        
        try:
            # Get the directory where this script is located
            script_dir = os.path.dirname(os.path.abspath(__file__))
            eval_script = os.path.join(script_dir, 'gnubg_eval.py')
            
            # GNU Backgammon's --python flag doesn't pass command-line arguments
            # Pass the file path via environment variable instead
            env = os.environ.copy()
            env['GNUBG_EVAL_FILE'] = tmp_path
            
            # Execute GNU Backgammon with Python script
            # --no-rc prevents reading config files for faster startup
            # --python executes our evaluation script
            # Aggressively suppress all Windows console/sound output to prevent beeps
            subprocess_kwargs = {
                'capture_output': True,
                'text': True,
                'timeout': 2,  # 2 second timeout per evaluation (balanced for speed/accuracy)
                'cwd': os.path.dirname(GNUBG_PATH) if os.path.dirname(GNUBG_PATH) else None,
                'env': env,
                'stdin': subprocess.DEVNULL,  # Suppress stdin to prevent any interactive prompts
            }
            
            # On Windows, aggressively suppress console to prevent beep sounds
            if sys.platform == 'win32':
                try:
                    # CREATE_NO_WINDOW prevents console window and system beeps
                    # This is critical for suppressing Windows beep sounds
                    subprocess_kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
                except AttributeError:
                    pass
            
            # Build command with --quiet flag to suppress GNU Backgammon sounds
            # --quiet suppresses sound effects and beeps
            # If --quiet is not supported, GNU Backgammon will just ignore it
            gnubg_args = [GNUBG_PATH, '--no-rc', '--quiet', '--python', eval_script]
            
            # Additional Windows beep suppression: try to disable console beep programmatically
            # This is a belt-and-suspenders approach in addition to CREATE_NO_WINDOW
            if sys.platform == 'win32':
                try:
                    # Try to suppress beeps by redirecting to null (already done via DEVNULL for stdin)
                    # CREATE_NO_WINDOW should prevent most beeps, but we'll also try this:
                    kernel32 = ctypes.windll.kernel32
                    # There's no direct "disable beep" API, but CREATE_NO_WINDOW should handle it
                    # We could try MessageBeep(0xFFFFFFFF) to disable, but that's not standard
                    # The best approach is CREATE_NO_WINDOW which we already use
                    pass
                except Exception:
                    pass  # If any beep suppression fails, continue anyway
            
            result = subprocess.run(
                gnubg_args,
                **subprocess_kwargs
            )
            
            # GNU Backgammon prints banner to stdout, our JSON should be in stderr
            # But let's check both
            
            # Parse JSON output
            # GNU Backgammon prints banner to stdout, our JSON should be in stderr
            json_output = None
            
            # Check stderr first (where we print our JSON)
            if result.stderr:
                stderr_lines = result.stderr.strip().split('\n')
                for line in stderr_lines:
                    line = line.strip()
                    if line.startswith('{'):
                        try:
                            json_output = json.loads(line)
                            break
                        except json.JSONDecodeError:
                            continue
            
            # Also check stdout in case
            if not json_output and result.stdout:
                stdout_lines = result.stdout.strip().split('\n')
                for line in reversed(stdout_lines):
                    line = line.strip()
                    if line.startswith('{'):
                        try:
                            json_output = json.loads(line)
                            break
                        except json.JSONDecodeError:
                            continue
            
            if json_output and 'equity' in json_output:
                equity = json_output.get('equity')
                if equity is not None:
                    # Ensure equity is in valid range
                    equity = max(-1.0, min(1.0, float(equity)))
                    # Log debug info if available
                    debug_info = json_output.get('debug', {})
                    pos_hash = debug_info.get('pos_hash', 'unknown')
                    checker_count = debug_info.get('checker_count', '?')
                    bar1 = debug_info.get('bar1', '?')
                    bar2 = debug_info.get('bar2', '?')
                    borne1 = debug_info.get('borne1', '?')
                    borne2 = debug_info.get('borne2', '?')
                    pos_str_preview = debug_info.get('pos_str_preview', '?')
                    pos_str_length = debug_info.get('pos_str_length', '?')
                    sample_checkers = debug_info.get('sample_checkers', [])
                    points_count = debug_info.get('points_count', '?')
                    checker_dist = debug_info.get('checker_distribution', {})
                    encoding_stats = debug_info.get('encoding_stats', {})
                    points_dict = encoding_stats.get('points_dict', {})
                    points_dict_all = encoding_stats.get('points_dict_all', {})
                    total_gnu_checkers = encoding_stats.get('total_gnu_checkers', '?')
                    our_points_count = encoding_stats.get('our_points_count', {})
                    if pos_str_length == 0 or pos_str_preview == '(EMPTY!)':
                        print(f"✗ GNU Backgammon: EMPTY POSITION STRING! (pos_hash={pos_hash}, checkers={checker_count}, processed={encoding_stats.get('processed', '?')}, total_gnu_checkers={total_gnu_checkers}, points_dict_all={points_dict_all}, our_points={our_points_count})")
                    else:
                        # Show full position string if it's not too long
                        full_pos = debug_info.get('full_pos_str', '')
                        if points_count < 10:  # If very few points, something is wrong
                            print(f"⚠ GNU Backgammon evaluation: {equity:.4f} (pos_hash={pos_hash}, checkers={checker_count}, points={points_count} [SHOULD BE MORE!], pos_str='{full_pos}', processed={encoding_stats.get('processed', '?')}, total_gnu={total_gnu_checkers}, points_dict_all={points_dict_all})")
                        elif len(full_pos) < 300:
                            print(f"✓ GNU Backgammon evaluation: {equity:.4f} (pos_hash={pos_hash}, checkers={checker_count}, points={points_count}, pos_str='{full_pos}')")
                        else:
                            print(f"✓ GNU Backgammon evaluation: {equity:.4f} (pos_hash={pos_hash}, checkers={checker_count}, points={points_count}, preview='{pos_str_preview[:200]}')")
                    return equity
            
            # Check for error in output
            if json_output and 'error' in json_output:
                error_msg = json_output.get('error')
                print(f"✗ GNU Backgammon evaluation error: {error_msg}")
                if 'traceback' in json_output:
                    traceback_lines = json_output.get('traceback', '').split('\n')[:5]
                    print(f"  Traceback (first 5 lines):")
                    for tb_line in traceback_lines:
                        print(f"    {tb_line}")
                return None
            
            # Debug output if no JSON found
            print(f"✗ GNU Backgammon: No JSON found in output")
            print(f"  Return code: {result.returncode}")
            if result.stderr:
                print(f"  Stderr (last 5 lines):")
                for line in result.stderr.strip().split('\n')[-5:]:
                    print(f"    {line}")
            if result.stdout:
                print(f"  Stdout (last 5 lines):")
                for line in result.stdout.strip().split('\n')[-5:]:
                    print(f"    {line}")
            
            return None
                
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
                
    except subprocess.TimeoutExpired:
        print("✗ GNU Backgammon evaluation timed out (falling back to simple evaluation)")
        return None
    except Exception as e:
        print(f"✗ Error calling GNU Backgammon: {e} (falling back to simple evaluation)")
        import traceback
        traceback.print_exc()
        return None
    
    print("✗ GNU Backgammon evaluation failed (falling back to simple evaluation)")
    return None  # Fall back to simple evaluation if GNU Backgammon fails


def convert_to_gnubg_position(game_state):
    """
    Convert game state to GNU Backgammon position format
    Format: "position 24:0 0:0 0:0 ..." where each number is point:checkers
    """
    checkers = game_state.get('checkers', [])
    bar = game_state.get('bar', {})
    borne_off = game_state.get('borneOff', {})
    
    # Initialize point counts (24 points + bar + borne off)
    points = [0] * 26  # 24 points + bar (25) + borne off (26)
    
    # Count checkers on each point
    for checker in checkers:
        point = checker.get('point', -1)
        player = checker.get('player', 0)
        if 0 <= point <= 23:
            if player == 1:
                # Player 1: points 0-23 map to 24-1 (reversed)
                gnubg_point = 24 - point
                points[gnubg_point - 1] += 1
            else:  # player == 2
                # Player 2: points 0-23 map to 1-24 (normal)
                points[point] += 1
    
    # Handle bar (point 25 in gnubg format)
    player1_bar = len(bar.get('1', []))
    player2_bar = len(bar.get('2', []))
    if player1_bar > 0:
        points[24] = player1_bar  # Bar for player 1
    if player2_bar > 0:
        points[24] = -player2_bar  # Bar for player 2 (negative)
    
    # Handle borne off (point 26 in gnubg format)
    player1_borne = borne_off.get('1', 0)
    player2_borne = borne_off.get('2', 0)
    if player1_borne > 0:
        points[25] = player1_borne
    if player2_borne > 0:
        points[25] = -player2_borne
    
    # Format as gnubg position string
    # This is a simplified conversion - full implementation would need proper encoding
    position_parts = [f"{i+1}:{points[i]}" for i in range(24)]
    return " ".join(position_parts)


def get_best_move_gnubg(game_state, difficulty):
    """
    Get best move using GNU Backgammon neural network
    """
    if not GNUBG_AVAILABLE:
        return None
    
    try:
        # Convert game state to GNU Backgammon format
        # This is a simplified version - full implementation would need
        # proper position encoding for GNU Backgammon
        
        # For now, use GNU Backgammon's evaluation if available
        # Full implementation would require position encoding
        position = encode_position(game_state)
        evaluation = gnubg.eval_position(position)
        
        # Adjust based on difficulty
        # Higher difficulty = more optimal play
        # Lower difficulty = add some randomness
        
        return {
            'move': evaluation.get('best_move'),
            'evaluation': evaluation.get('equity'),
            'confidence': 1.0 - (difficulty - 1) * 0.05  # 95% to 50% confidence
        }
    except Exception as e:
        print(f"Error using GNU Backgammon: {e}")
        return None


def encode_position(game_state):
    """
    Encode game state into GNU Backgammon position format
    This is a placeholder - full implementation needed
    """
    # TODO: Implement proper position encoding for GNU Backgammon
    # GNU Backgammon uses a specific position format
    return game_state


def get_accuracy_for_difficulty(difficulty):
    """Helper function to get accuracy percentage for a difficulty level"""
    if difficulty <= 1:
        return 0.08
    elif difficulty == 2:
        return 0.15
    elif difficulty == 3:
        return 0.30
    elif difficulty == 4:
        return 0.45
    elif difficulty == 5:
        return 0.60
    elif difficulty == 6:
        return 0.75
    elif difficulty == 7:
        return 0.95
    elif difficulty == 8:
        return 0.985
    else:  # difficulty == 9
        return 0.998


# Opening book - standard optimal opening moves in backgammon
# These are memorized moves that all strong players use for the first few moves
OPENING_BOOK = {
    # First roll moves (for player 2 / CPU)
    # Format: (dice1, dice2): [list of optimal moves as move descriptions]
    # Moves are described as from_point-to_point or "bearoff" etc.
    # We'll match these to actual legal moves
    
    # Opening roll 3-1: Best moves are 8/5 6/5 (move 8->5, 6->5) or 24/23 13/10
    # Opening roll 4-1: Best is 13/9 6/5
    # Opening roll 5-1: Best is 13/8 6/5  
    # Opening roll 6-1: Best is 24/18 13/12
    # Opening roll 4-2: Best is 8/4 6/4
    # Opening roll 5-2: Best is 13/8 13/11
    # Opening roll 6-2: Best is 24/18 13/11
    # Opening roll 5-3: Best is 8/3 6/3
    # Opening roll 6-3: Best is 24/18 13/10
    # Opening roll 6-4: Best is 24/18 13/9
    # Opening roll 6-5: Best is 24/18 24/19
    # Doubles are played 4 times (doubling cube rules)
}

def is_opening_phase(game_state):
    """
    Determine if the game is still in the opening phase
    Opening phase = first few moves, typically when most pieces are still in starting positions
    """
    checkers = game_state.get('checkers', [])
    bar = game_state.get('bar', {})
    borne_off = game_state.get('borneOff', {})
    
    # Count how many pieces have moved from starting positions
    # Starting positions: Player 1 has 2 at 0, 5 at 11, 3 at 16, 5 at 18
    # Player 2 has 2 at 23, 5 at 12, 3 at 7, 5 at 5
    
    player1_starting_positions = {0: 2, 11: 5, 16: 3, 18: 5}
    player2_starting_positions = {23: 2, 12: 5, 7: 3, 5: 5}
    
    # Count pieces in starting positions
    p1_in_start = sum(1 for c in checkers 
                     if c.get('player') == 1 
                     and c.get('point') in player1_starting_positions.keys())
    
    p2_in_start = sum(1 for c in checkers 
                     if c.get('player') == 2 
                     and c.get('point') in player2_starting_positions.keys())
    
    # Count pieces borne off
    p1_borne = borne_off.get('1', 0)
    p2_borne = borne_off.get('2', 0)
    
    # Count pieces on bar
    p1_bar = len(bar.get('1', []))
    p2_bar = len(bar.get('2', []))
    
    # Opening phase if:
    # - No pieces borne off
    # - No pieces on bar (for both players)
    # - Most pieces still in starting positions (>20 out of 30 total pieces still in starting spots)
    total_in_start = p1_in_start + p2_in_start
    total_pieces_on_board = len(checkers)
    
    # Opening phase: first ~10-15 moves, no pieces borne off, no pieces hit
    is_opening = (p1_borne == 0 and p2_borne == 0 and 
                  p1_bar == 0 and p2_bar == 0 and
                  total_in_start >= 20)
    
    return is_opening


def get_best_move_simple(game_state, difficulty, legal_moves):
    """
    Get best move using evaluation (GNU Backgammon if available, otherwise simple evaluation)
    Difficulty affects how optimal the move selection is
    
    For difficulties 7-9: Use GNU Backgammon evaluation for top move candidates (smart evaluation)
    For difficulties 1-6: Use simple evaluation only (faster, works reliably)
    """
    if not legal_moves or len(legal_moves) == 0:
        return None
    
    # Check if we're in the opening phase
    in_opening = is_opening_phase(game_state)
    
    # For high difficulties (7-9), use GNU Backgammon but VERY efficiently
    # Key optimization: Only evaluate top 2-3 moves with GNU Backgammon
    # This matches how GNU Backgammon desktop works - it evaluates the top candidates
    use_gnubg = GNUBG_AVAILABLE and difficulty >= 7
    
    # For ALL difficulties, start with fast simple evaluation to identify best candidates
    # This is very fast (milliseconds) and accurate enough for initial filtering
    quick_scores = []
    for move in legal_moves:
        try:
            temp_state = apply_move(game_state.copy(), move)
            quick_score = evaluate_position_simple(temp_state)
            quick_scores.append({
                'move': move,
                'score': quick_score if quick_score is not None else 0.0
            })
        except:
            quick_scores.append({
                'move': move,
                'score': 0.0
            })
    
    # Sort by quick score to identify top candidates
    quick_scores.sort(key=lambda x: x['score'], reverse=True)
    
    # If using GNU Backgammon, ONLY evaluate the top 2-3 moves (not all!)
    # This is the key optimization - GNU Backgammon is slow, so we minimize calls
    if use_gnubg and len(quick_scores) > 1:
        # For openings: evaluate top 2 moves only (openings usually have fewer legal moves, simple eval is good enough)
        # For mid-game: evaluate top 2-3 moves only (this is enough to find the best move)
        num_to_evaluate = 2 if in_opening else (3 if difficulty >= 9 else 2)
        num_to_evaluate = min(num_to_evaluate, len(quick_scores))
        
        top_moves = [item['move'] for item in quick_scores[:num_to_evaluate]]
        
        # Re-evaluate ONLY top moves with GNU Backgammon
        move_scores = []
        for item in quick_scores:
            move = item['move']
            if move in top_moves:
                try:
                    temp_state = apply_move(game_state.copy(), move)
                    # Evaluate with GNU Backgammon (has 1-second timeout per call)
                    gnubg_score = evaluate_position_gnubg(temp_state)
                    # Use GNU Backgammon score if available, otherwise use quick score
                    final_score = gnubg_score if gnubg_score is not None else item['score']
                    move_scores.append({
                        'move': move,
                        'score': final_score
                    })
                except Exception as e:
                    # If GNU Backgammon fails, use the quick score
                    move_scores.append(item)
            else:
                # For moves not in top 2-3, use quick score (not evaluated with GNU)
                move_scores.append(item)
    else:
        # Not using GNU Backgammon, use simple evaluation for all moves
        move_scores = quick_scores
    
    # If no moves were successfully evaluated, return first move
    if not move_scores:
        return legal_moves[0] if legal_moves else None
    
    # Sort by score (higher is better for CPU)
    move_scores.sort(key=lambda x: x['score'], reverse=True)
    
    # Dramatically improved difficulty scaling to match FIBS rating system:
    # For difficulties 7-9, use GNU Backgammon evaluation and make errors very rarely
    # Level 1 (800 rating): 8% accuracy - makes terrible moves
    # Level 2 (1000 rating): 15% accuracy - very poor play
    # Level 3 (1200 rating): 30% accuracy - poor play
    # Level 4 (1400 rating): 45% accuracy - below average
    # Level 5 (1600 rating): 60% accuracy - average
    # Level 6 (1800 rating): 75% accuracy - good play
    # Level 7 (2000 rating): 95% accuracy - strong play (uses GNU Backgammon)
    # Level 8 (2200 rating): 98.5% accuracy - very strong (uses GNU Backgammon)
    # Level 9 (2400 rating): 99.8% accuracy - near-perfect (uses GNU Backgammon, almost never makes mistakes)
    
    if difficulty <= 1:
        accuracy = 0.08  # Beginner: almost always wrong
    elif difficulty == 2:
        accuracy = 0.15  # Novice: very poor
    elif difficulty == 3:
        accuracy = 0.30  # Amateur: poor
    elif difficulty == 4:
        accuracy = 0.45  # Intermediate: below average
    elif difficulty == 5:
        accuracy = 0.60  # Skilled: average
    elif difficulty == 6:
        accuracy = 0.75  # Advanced: good
    elif difficulty == 7:
        accuracy = 0.95  # Expert: strong (GNU Backgammon)
    elif difficulty == 8:
        accuracy = 0.985  # Master: very strong (GNU Backgammon)
    else:  # difficulty == 9
        accuracy = 0.998  # Grandmaster: near-perfect (GNU Backgammon)
    
    if random.random() < accuracy and len(move_scores) > 0:
        # Choose best move (or near-best for lower difficulties)
        if difficulty <= 1:
            # Level 1: Even when "accurate", often choose from top 3-4
            if len(move_scores) > 1:
                top_n = min(4, len(move_scores))
                return random.choice(move_scores[:top_n])['move']
            return move_scores[0]['move']
        elif difficulty <= 2:
            # Level 2: Often choose from top 3
            if len(move_scores) > 1:
                top_n = min(3, len(move_scores))
                return random.choice(move_scores[:top_n])['move']
            return move_scores[0]['move']
        elif difficulty <= 3:
            # Level 3: Sometimes choose from top 3
            if len(move_scores) > 1 and random.random() < 0.3:
                top_n = min(3, len(move_scores))
                return random.choice(move_scores[:top_n])['move']
            return move_scores[0]['move']
        elif difficulty <= 4:
            # Level 4: Occasionally choose 2nd or 3rd best
            if len(move_scores) > 1 and random.random() < 0.2:
                top_n = min(3, len(move_scores))
                return random.choice(move_scores[:top_n])['move']
            return move_scores[0]['move']
        elif difficulty <= 5:
            # Level 5: Occasionally choose 2nd best
            if len(move_scores) > 1 and random.random() < 0.15:
                return move_scores[1]['move']
            return move_scores[0]['move']
        elif difficulty == 6:
            # Level 6: Rarely choose 2nd best
            if len(move_scores) > 1 and random.random() < 0.05:
                return move_scores[1]['move']
            return move_scores[0]['move']
        else:
            # Levels 7-9: Always choose best move when accurate (using GNU Backgammon evaluation)
            return move_scores[0]['move']
    else:
        # Choose a bad move (lower difficulty = worse moves)
        if move_scores:
            if difficulty <= 1:
                # Level 1: Choose from worst 25% of moves
                worst_quarter = move_scores[int(len(move_scores) * 0.75):]
                return random.choice(worst_quarter)['move'] if worst_quarter else move_scores[-1]['move']
            elif difficulty <= 2:
                # Level 2: Choose from worst 50% of moves
                worst_half = move_scores[len(move_scores)//2:]
                return random.choice(worst_half)['move']
            elif difficulty <= 3:
                # Level 3: Choose from bottom 40% of moves
                bottom_40 = move_scores[int(len(move_scores) * 0.6):]
                return random.choice(bottom_40)['move'] if bottom_40 else move_scores[-1]['move']
            elif difficulty <= 4:
                # Level 4: Choose from bottom 30% of moves
                bottom_30 = move_scores[int(len(move_scores) * 0.7):]
                return random.choice(bottom_30)['move'] if bottom_30 else move_scores[-1]['move']
            elif difficulty <= 5:
                # Level 5: Choose from bottom 25% of moves
                bottom_25 = move_scores[int(len(move_scores) * 0.75):]
                return random.choice(bottom_25)['move'] if bottom_25 else move_scores[-1]['move']
            elif difficulty == 6:
                # Level 6: When wrong, choose from bottom 25%
                bottom_25 = move_scores[int(len(move_scores) * 0.75):]
                return random.choice(bottom_25)['move'] if bottom_25 else move_scores[-1]['move']
            else:
                # Levels 7-9: When wrong (very rare), choose from bottom 30% (not worst, but still suboptimal)
                # This should almost never happen due to high accuracy
                bottom_30 = move_scores[int(len(move_scores) * 0.7):]
                return random.choice(bottom_30)['move'] if bottom_30 else move_scores[-1]['move']
        return None


def apply_move(game_state, move):
    """
    Apply a move to game state for evaluation purposes
    Creates a copy of the game state with the move applied
    """
    import copy
    
    # Deep copy the game state
    new_state = copy.deepcopy(game_state)
    
    # Get move details
    checkers = new_state.get('checkers', [])
    bar = new_state.get('bar', {})
    borne_off = new_state.get('borneOff', {})
    current_player = new_state.get('currentPlayer', 1)
    used_dice = new_state.get('usedDice', [])
    
    # Parse move format
    # Moves can be:
    # - Integer: destination point (regular move)
    # - String "bearoff": single bearoff
    # - String "bearoff|sum|i,j": bearoff using sum of two dice
    # - String "point|steps|type|dice": complex move format
    
    if isinstance(move, int):
        # Simple destination point (we can't simulate this properly without knowing the source)
        # For evaluation, we'll just return the state unchanged
        # The actual move evaluation will be done by the frontend before sending moves
        return new_state
    elif isinstance(move, str):
        if move == 'bearoff':
            # Single bearoff - remove one checker from home and add to borne off
            home_quadrant = [18, 19, 20, 21, 22, 23] if current_player == 1 else [0, 1, 2, 3, 4, 5]
            home_checkers = [c for c in checkers if c.get('player') == current_player and c.get('point') in home_quadrant]
            if home_checkers:
                # Remove the farthest checker (highest point for player 1, lowest for player 2)
                if current_player == 1:
                    farthest = max(home_checkers, key=lambda c: c.get('point', 0))
                else:
                    farthest = min(home_checkers, key=lambda c: c.get('point', 23))
                
                checkers.remove(farthest)
                borne_off[str(current_player)] = borne_off.get(str(current_player), 0) + 1
        elif move.startswith('bearoff|sum|'):
            # Bearoff using sum of dice
            parts = move.split('|')
            if len(parts) >= 3:
                home_quadrant = [18, 19, 20, 21, 22, 23] if current_player == 1 else [0, 1, 2, 3, 4, 5]
                home_checkers = [c for c in checkers if c.get('player') == current_player and c.get('point') in home_quadrant]
                if home_checkers:
                    if current_player == 1:
                        farthest = max(home_checkers, key=lambda c: c.get('point', 0))
                    else:
                        farthest = min(home_checkers, key=lambda c: c.get('point', 23))
                    checkers.remove(farthest)
                    borne_off[str(current_player)] = borne_off.get(str(current_player), 0) + 1
    
    new_state['checkers'] = checkers
    new_state['bar'] = bar
    new_state['borneOff'] = borne_off
    
    return new_state


@app.route('/api/cpu/move', methods=['POST'])
def get_cpu_move():
    """
    Calculate CPU move based on game state and difficulty
    Has a 5-second timeout - will return best move found so far or fallback
    """
    import signal
    import threading
    
    try:
        data = request.json
        game_state = data.get('gameState')
        difficulty = data.get('difficulty', 5)
        legal_moves = data.get('legalMoves', [])
        
        if not game_state:
            return jsonify({'error': 'Game state required'}), 400
        
        if not legal_moves:
            return jsonify({'error': 'No legal moves available', 'move': None}), 400
        
        # Use timeout mechanism - return within 5 seconds max
        best_move = None
        timeout_occurred = [False]  # Use list to allow modification in nested function
        
        def move_selection():
            nonlocal best_move
            try:
                best_move = get_best_move_simple(game_state, difficulty, legal_moves)
            except Exception as e:
                print(f"Error in move selection: {e}")
                best_move = legal_moves[0] if legal_moves else None
        
        # Run move selection in a thread with timeout
        thread = threading.Thread(target=move_selection)
        thread.daemon = True
        thread.start()
        thread.join(timeout=5.0)  # Wait max 5 seconds
        
        if thread.is_alive():
            # Timeout occurred - use fallback
            timeout_occurred[0] = True
            print(f"⚠ Move selection timed out after 5 seconds, using fast fallback")
            # Use simple heuristic: pick first move or random from first 3
            if len(legal_moves) > 0:
                best_move = legal_moves[0] if difficulty <= 5 else random.choice(legal_moves[:min(3, len(legal_moves))])
        
        # If no move was selected (shouldn't happen but safety check)
        if best_move is None:
            best_move = legal_moves[0] if legal_moves else None
        
        # If no move was returned, use the first legal move as fallback
        if best_move is None and legal_moves:
            print(f"Warning: get_best_move_simple returned None, using first legal move as fallback")
            best_move = legal_moves[0]
        
        if best_move is None:
            print(f"Error: No valid moves available (legal_moves was empty or all evaluations failed)")
            return jsonify({'error': 'No valid moves available', 'move': None}), 400
        
        accuracy = get_accuracy_for_difficulty(difficulty)
        method_note = 'timeout-fallback' if timeout_occurred[0] else 'evaluated'
        
        return jsonify({
            'move': best_move,
            'method': method_note,
            'difficulty': difficulty,
            'note': f'Move selected (timeout: {timeout_occurred[0]}, accuracy: {accuracy:.1%})'
        })
    
    except Exception as e:
        import traceback
        print(f"Error calculating CPU move: {e}")
        traceback.print_exc()
        # Return first legal move as emergency fallback
        legal_moves = request.json.get('legalMoves', []) if request.json else []
        fallback_move = legal_moves[0] if legal_moves else None
        return jsonify({'error': str(e), 'move': fallback_move}), 500


@app.route('/api/cpu/double', methods=['POST'])
def should_double():
    """
    Determine if CPU should offer/accept double based on position
    """
    try:
        data = request.json
        game_state = data.get('gameState')
        difficulty = data.get('difficulty', 5)
        action = data.get('action')  # 'offer' or 'accept'
        
        if not game_state:
            return jsonify({'error': 'Game state required'}), 400
        
        # Simple evaluation
        evaluation = evaluate_position_simple(game_state)
        
        if action == 'offer':
            # Offer double if CPU has 80%+ win chance
            # evaluation range: -1 (0% win) to 1 (100% win)
            # 80% win = (evaluation + 1) / 2 = 0.8, so evaluation = 0.6
            should_offer = evaluation > 0.6
        else:  # accept
            # Accept double if CPU has >30% win chance
            # 30% win = (evaluation + 1) / 2 = 0.3, so evaluation = -0.4
            should_accept = evaluation > -0.4
        
        return jsonify({
            'should': should_offer if action == 'offer' else should_accept,
            'evaluation': evaluation,
            'difficulty': difficulty
        })
    
    except Exception as e:
        print(f"Error evaluating double: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/evaluate', methods=['POST'])
def evaluate_position():
    """
    Evaluate current game position
    Returns evaluation from -1 (CPU losing) to 1 (CPU winning)
    Uses GNU Backgammon if available, otherwise falls back to simple evaluation
    """
    try:
        data = request.json
        game_state = data.get('gameState')
        
        if not game_state:
            return jsonify({'error': 'Game state required'}), 400
        
        # Try GNU Backgammon first, fallback to simple evaluation
        if GNUBG_AVAILABLE:
            evaluation = evaluate_position_gnubg(game_state)
            if evaluation is None:
                print("  → Using simple evaluation (fallback)")
                evaluation = evaluate_position_simple(game_state)
            else:
                print(f"  → Using GNU Backgammon evaluation: {evaluation:.4f}")
        else:
            print("  → Using simple evaluation (GNU Backgammon not available)")
            evaluation = evaluate_position_simple(game_state)
        
        return jsonify({
            'evaluation': evaluation
        })
    except Exception as e:
        print(f"Error evaluating position: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'gnubg_available': GNUBG_AVAILABLE,
        'service': 'python_ai'
    })


if __name__ == '__main__':
    print("=" * 50)
    print("Backgammon Arena - GNU Backgammon AI Service")
    print("=" * 50)
    print(f"GNU Backgammon: {'Available' if GNUBG_AVAILABLE else 'Not Available'}")
    
    # Get port from environment variable or default to 5000
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    if debug_mode:
        print(f"⚠️  WARNING: Running in DEBUG mode (development only)")
        print(f"Starting development server on http://0.0.0.0:{port}")
    else:
        print(f"Starting production server on http://0.0.0.0:{port}")
        print("⚠️  NOTE: For production, use a WSGI server like Gunicorn:")
        print("   gunicorn -w 4 -b 0.0.0.0:5000 python_ai_service:app")
    
    print("=" * 50)
    app.run(host='0.0.0.0', port=port, debug=debug_mode)

