#!/usr/bin/env python3
"""
GNU Backgammon evaluation script
This script is executed by gnubg-cli.exe --python to evaluate positions
"""

import sys
import json
import os

def encode_position_to_gnubg(checkers, bar, borne_off, current_player):
    """
    Convert game state to GNU Backgammon position string format
    GNU Backgammon format: position X:Y where X is point (1-24, 25=bar, 0=bar), Y is checkers
    Positive Y = player 1 (O), negative Y = player 2 (X)
    Points are numbered 1-24 from player 2's perspective (bottom to top)
    """
    # Initialize arrays for both players
    # GNU Backgammon: point 1-24 from bottom (player 2's perspective)
    # Our format: point 0-23 where 0-5 is player 2's home, 18-23 is player 1's home
    
    # IMPORTANT: Always start with a fresh dictionary for each call
    points = {}  # point_num: count (positive for player 1, negative for player 2)
    processed_count = 0
    skipped_count = 0
    
    # Process checkers on the board
    # First, count checkers by our format points to verify input
    our_points_count = {}  # Track checkers by our point format for debugging
    for checker in checkers:
        # Handle both dict-like and object-like access
        if isinstance(checker, dict):
            point = checker.get('point', -1)
            player = checker.get('player', 0)
        else:
            point = getattr(checker, 'point', -1)
            player = getattr(checker, 'player', 0)
        
        # Convert to integers (JSON might send them as strings or numbers)
        try:
            point = int(point)
        except (ValueError, TypeError):
            skipped_count += 1
            continue  # Skip invalid checker
        
        try:
            player = int(player)
        except (ValueError, TypeError):
            skipped_count += 1
            continue  # Skip invalid checker
        
        # Track by our point format for debugging
        if 0 <= point <= 23 and (player == 1 or player == 2):
            key = f"p{player}_pt{point}"
            our_points_count[key] = our_points_count.get(key, 0) + 1
        
        # Check if point is valid (0-23 for on-board, 24/-1 for bar, borne-off not in checkers)
        if point < 0 or point > 23:
            skipped_count += 1
            continue  # Skip bar/borne-off checkers (they're handled separately)
        
        if player != 1 and player != 2:
            skipped_count += 1
            continue
        
        processed_count += 1
        if player == 1:
            # Player 1: points 0-23 map to GNU points 24-1 (reversed)
            gnubg_point = 24 - point
            points[gnubg_point] = points.get(gnubg_point, 0) + 1
        elif player == 2:
            # Player 2: points 0-23 map to GNU points 1-24 (direct, but offset by 1)
            gnubg_point = point + 1
            points[gnubg_point] = points.get(gnubg_point, 0) - 1
    
    # Handle bar: bar 25 for player 1, bar 0 for player 2
    bar1 = len(bar.get('1', []))
    bar2 = len(bar.get('2', []))
    if bar1 > 0:
        points[25] = bar1
    if bar2 > 0:
        points[0] = -bar2
    
    # Build position string: position 25:Y 24:Y ... 1:Y 0:Y
    # IMPORTANT: GNU Backgammon needs ALL 26 points (0-24 plus bar at 25/0) explicitly listed
    # We'll use compact format (only non-zero) but if all are zero, we'll need special handling
    pos_parts = []
    for point_num in sorted(points.keys(), reverse=True):
        checker_count = points[point_num]
        # Only include non-zero counts (compact format)
        # Note: checker_count can be negative for player 2, positive for player 1
        if checker_count != 0:
            pos_parts.append(f"{point_num}:{checker_count}")
    
    # Return just the point specifications (without "position" or "set board" prefix)
    # The caller will add "set board" prefix
    # If position string is empty (all zeros), we need to handle this specially
    # For the starting position where everything cancels, we'll use "set board" without arguments
    # which should reset to the starting position
    if pos_parts:
        position_str = " ".join(pos_parts)
    else:
        # Empty position string - this happens when all checkers cancel out (e.g., initial position)
        # We'll return empty string and the caller will use "set board" without arguments
        position_str = ""
    
    # Store encoding stats for debugging (only used if function is called with debug=True)
    if hasattr(encode_position_to_gnubg, '_debug'):
        # Include the actual points dictionary contents for debugging
        # Only include non-zero entries in the debug output
        points_debug = {str(k): v for k, v in sorted(points.items()) if v != 0}
        # Calculate sum to verify we processed correctly
        total_gnu_checkers = sum(abs(v) for v in points.values())
        
        encode_position_to_gnubg._last_stats = {
            'processed': processed_count,
            'skipped': skipped_count,
            'total_checkers': len(checkers),
            'points_dict_size': len(points),
            'points_dict': points_debug,  # Show actual contents (non-zero only)
            'points_dict_all': {str(k): v for k, v in sorted(points.items())},  # Show all including zeros
            'total_gnu_checkers': total_gnu_checkers,  # Sum of absolute values should equal processed_count
            'our_points_count': dict(sorted(list(our_points_count.items()))[:10]),  # Show our format point counts
            'pos_parts_count': len(pos_parts),
            'pos_str': position_str
        }
    
    return position_str

def main():
    try:
        # Read JSON file path from environment variable (GNU Backgammon --python doesn't pass args)
        input_file = os.environ.get('GNUBG_EVAL_FILE')
        if not input_file:
            # Fallback to command line argument if environment variable not set
            if len(sys.argv) >= 2:
                input_file = sys.argv[1]
            else:
                result = {'error': 'No input file provided (neither GNUBG_EVAL_FILE env var nor command line arg)', 'equity': None}
                # Use stderr for output (avoids mixing with GNU banner on stdout)
        # On Windows, writing to stderr can sometimes trigger beeps, so we suppress if possible
        try:
            print(json.dumps(result), file=sys.stderr, flush=True)
        except:
            # Fallback if stderr write fails
            sys.stderr.write(json.dumps(result) + '\n')
            sys.stderr.flush()
                sys.exit(1)
        with open(input_file, 'r') as f:
            input_data = json.load(f)
        
        checkers = input_data.get('checkers', [])
        bar = input_data.get('bar', {})
        borne_off = input_data.get('borneOff', {})
        current_player = input_data.get('currentPlayer', 1)
        
        # Convert to GNU Backgammon position format
        # Enable debug mode to capture stats
        encode_position_to_gnubg._debug = True
        pos_str = encode_position_to_gnubg(checkers, bar, borne_off, current_player)
        # Get encoding statistics if available
        encoding_stats = getattr(encode_position_to_gnubg, '_last_stats', {})
        
        # Debug: Always print position info to stderr (will be included in JSON error output if needed)
        # Also include a hash of the position to detect if same positions are being sent
        import hashlib
        pos_hash = hashlib.md5(pos_str.encode() if pos_str else b'').hexdigest()[:8]
        
        # Include debug info in the result JSON so Python service can log it
        sample_checkers = checkers[:5] if len(checkers) > 0 else []
        # Count points with checkers to verify encoding
        points_with_checkers = len([p for p in pos_str.split() if ':' in p]) if pos_str else 0
        
        # Count checkers by point to debug encoding issues
        checker_distribution = {}
        for c in checkers:
            if isinstance(c, dict):
                pt = c.get('point', -1)
                pl = c.get('player', 0)
            else:
                pt = getattr(c, 'point', -1)
                pl = getattr(c, 'player', 0)
            try:
                pt = int(pt)
                pl = int(pl)
                if 0 <= pt <= 23 and (pl == 1 or pl == 2):
                    key = f"p{pl}_pt{pt}"
                    checker_distribution[key] = checker_distribution.get(key, 0) + 1
            except:
                pass
        
        debug_info = {
            'checker_count': len(checkers),
            'bar1': len(bar.get('1', [])),
            'bar2': len(bar.get('2', [])),
            'borne1': borne_off.get('1', 0),
            'borne2': borne_off.get('2', 0),
            'current_player': current_player,
            'pos_hash': pos_hash,
            'pos_str_preview': pos_str[:200] if pos_str else '(EMPTY!)',
            'pos_str_length': len(pos_str) if pos_str else 0,
            'points_count': points_with_checkers,
            'sample_checkers': sample_checkers,
            'full_pos_str': pos_str,  # Include full position string for debugging
            'checker_distribution': dict(list(sorted(checker_distribution.items()))[:15]),  # First 15 point distributions
            'encoding_stats': encoding_stats  # Include encoding statistics
        }
        
        # Import gnubg module (it should be available when running via --python)
        try:
            import gnubg
        except ImportError:
            result = {
                'error': 'gnubg module not available - script must be run via gnubg-cli --python',
                'equity': None
            }
            # Use stderr for output (avoids mixing with GNU banner on stdout)
        # On Windows, writing to stderr can sometimes trigger beeps, so we suppress if possible
        try:
            print(json.dumps(result), file=sys.stderr, flush=True)
        except:
            # Fallback if stderr write fails
            sys.stderr.write(json.dumps(result) + '\n')
            sys.stderr.flush()
            sys.exit(1)
        
        # Initialize game context if needed
        # Try to set board directly - if it fails, we'll initialize a game first
        # We avoid calling "new game" first because it resets to starting position
        game_initialized = False
        
        # Always initialize a new game first (required for "set board" to work)
        try:
            gnubg.command("new game")
        except Exception as e:
            # If "new game" fails, continue anyway - might already be initialized
            pass
        
        # Set the position using "set board" command
        # Format: "set board position X:Y ..." where X is point, Y is checkers
        # NOTE: Empty pos_str can occur when all checkers cancel out (e.g., initial position)
        # Since "new game" above already sets the starting position, we can skip "set board"
        # if pos_str is empty, as the board is already in the correct state
        if pos_str:
            cmd = f"set board position {pos_str}"
        else:
            # Empty position string - board is already set to starting position by "new game"
            # Skip setting board (it's already correct), but continue to set turn
            cmd = None
        
        if cmd:  # Only set board if we have a position string
            try:
                gnubg.command(cmd)
            except Exception as e:
                # Try without "position" keyword (some versions might not need it)
                try:
                    if pos_str:
                        cmd2 = f"set board {pos_str}"
                        gnubg.command(cmd2)
                    else:
                        # Shouldn't get here if cmd is None, but handle it anyway
                        pass
                except Exception as e2:
                    result = {
                        'error': f'Failed to set position with commands "{cmd}" and "{cmd2 if pos_str else "N/A"}": {str(e)}, {str(e2)}',
                        'equity': None,
                        'debug': debug_info
                    }
                    # Use stderr for output (avoids mixing with GNU banner on stdout)
        # On Windows, writing to stderr can sometimes trigger beeps, so we suppress if possible
        try:
            print(json.dumps(result), file=sys.stderr, flush=True)
        except:
            # Fallback if stderr write fails
            sys.stderr.write(json.dumps(result) + '\n')
            sys.stderr.flush()
                    sys.exit(1)
        
        # Set whose turn it is (CRITICAL for correct evaluation!)
        # GNU Backgammon uses 0 for player 1 (O) and 1 for player 2 (X)
        try:
            if current_player == 1:
                gnubg.command("set turn 0")  # Player 1 (O)
            else:
                gnubg.command("set turn 1")  # Player 2 (X)
        except Exception as e:
            # If numeric format doesn't work, try O/X format
            try:
                if current_player == 1:
                    gnubg.command("set turn O")
                else:
                    gnubg.command("set turn X")
            except:
                # If both fail, log but continue (evaluation might still work)
                pass
        
        # Set evaluation context - use 2-ply for speed (desktop GNU uses 2-ply by default)
        # 3-ply is 21x slower, so 2-ply is the sweet spot for speed/accuracy
        try:
            gnubg.evalcontext(plies=2, cubeful=1)  # 2-ply is fast and accurate enough
        except:
            pass  # Ignore if evalcontext doesn't exist or fails
        
        # Evaluate the position
        eval_result = gnubg.evaluate()
        
        # Extract equity - gnubg.evaluate() returns a tuple, not a dict
        # Format: (equity, win, winGammon, winBackgammon, lose, loseGammon, loseBackgammon)
        # or sometimes just equity as a float
        if isinstance(eval_result, tuple):
            # Tuple format: first element is equity
            equity = eval_result[0] if len(eval_result) > 0 else 0.0
        elif isinstance(eval_result, dict):
            # Dict format (if it ever returns a dict)
            equity = eval_result.get('equity', 0.0)
        else:
            # Just a float
            equity = float(eval_result) if eval_result else 0.0
        
        # GNU evaluates from the perspective of the player to move
        # We want: positive = CPU (player 2) winning, negative = Player 1 winning
        # If current_player is 1, we need to negate
        if current_player == 1:
            equity = -equity  # Reverse for player 1
        
        # Normalize to -1 to 1 range (GNU equity is typically in range around -1 to 1)
        equity = max(-1.0, min(1.0, equity))
        
        # Return result as JSON (print to stderr to avoid mixing with GNU banner on stdout)
        result = {
            'equity': equity,
            'evaluation': equity,  # For compatibility
            'debug': debug_info  # Include debug info for troubleshooting
        }
        
        # Use stderr for output (avoids mixing with GNU banner on stdout)
        # On Windows, writing to stderr can sometimes trigger beeps, so we suppress if possible
        try:
            print(json.dumps(result), file=sys.stderr, flush=True)
        except:
            # Fallback if stderr write fails
            sys.stderr.write(json.dumps(result) + '\n')
            sys.stderr.flush()
        
    except Exception as e:
        # Return error
        import traceback
        result = {
            'error': str(e),
            'traceback': traceback.format_exc(),
            'equity': None
        }
        # Use stderr for output (avoids mixing with GNU banner on stdout)
        # On Windows, writing to stderr can sometimes trigger beeps, so we suppress if possible
        try:
            print(json.dumps(result), file=sys.stderr, flush=True)
        except:
            # Fallback if stderr write fails
            sys.stderr.write(json.dumps(result) + '\n')
            sys.stderr.flush()
        sys.exit(1)

if __name__ == '__main__':
    main()
