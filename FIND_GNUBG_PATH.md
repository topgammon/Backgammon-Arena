# Finding GNU Backgammon Installation Path

Since you can open GNU Backgammon, it's installed somewhere. Here's how to find the exact path:

## Method 1: Right-click the desktop shortcut

1. **Find the GNU Backgammon shortcut** (on desktop or Start menu)
2. **Right-click it** → Select **"Properties"**
3. Look at the **"Target"** field - this shows the full path to `gnubg.exe`
4. Copy that path and let me know!

Example: `C:\Users\YourName\AppData\Local\Programs\GNU Backgammon\gnubg.exe`

## Method 2: From Task Manager (while running)

1. Open GNU Backgammon
2. Press `Ctrl + Shift + Esc` to open Task Manager
3. Find `gnubg.exe` in the list
4. Right-click it → **"Open file location"**
5. This will show you the installation folder

## Method 3: Check common locations

The installer might have put it in one of these places:
- `C:\Users\YourName\AppData\Local\Programs\GNU Backgammon\`
- `C:\Program Files\GNU Backgammon\`
- `C:\Program Files (x86)\GNU Backgammon\`
- `C:\gnubg\`

Once you find the path, I'll update the Python code to use it!


