# Installing GNU Backgammon on Windows

## Step 1: Download GNU Backgammon

**Direct Download Link:**
- Click here to download: https://ftp.gnu.org/gnu/gnubg/gnubg-1_08_003-20240428-setup.exe
- Or visit: https://www.gnu.org/software/gnubg/ and scroll to "Downloading GNU Backgammon"

**File name:** `gnubg-1_08_003-20240428-setup.exe` (approximately 30-40 MB)

## Step 2: Install GNU Backgammon

1. **Run the installer:**
   - Double-click the downloaded `.exe` file
   - Follow the installation wizard

2. **Choose installation location:**
   - Default is usually: `C:\Program Files\GNU Backgammon\`
   - You can use the default, or choose a custom location
   - **Note the installation path** - we may need it later

3. **Complete the installation:**
   - Click "Next" through the wizard
   - Finish the installation

## Step 3: Verify Installation

1. **Check if gnubg.exe exists:**
   - Navigate to the installation folder (usually `C:\Program Files\GNU Backgammon\`)
   - Look for `gnubg.exe` or `gnubg-cli.exe`

2. **Add to PATH (Optional but Recommended):**
   
   **Option A: Add to PATH via System Settings:**
   - Press `Win + X` and select "System"
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", find "Path" and click "Edit"
   - Click "New" and add: `C:\Program Files\GNU Backgammon`
   - Click "OK" on all windows
   - **Restart PowerShell/Command Prompt** for changes to take effect

   **Option B: Test without PATH (we can update code if needed):**
   - If you don't want to modify PATH, we can update the Python code to use the full path
   - Just let me know the exact installation path

3. **Test from command line:**
   - Open PowerShell or Command Prompt
   - Type: `gnubg --version`
   - Or: `"C:\Program Files\GNU Backgammon\gnubg.exe" --version`
   - If you see version information, it's installed correctly!

## Step 4: Update Python Code (if needed)

If GNU Backgammon is NOT in your PATH, we need to update the Python code with the exact path.

1. **Find the exact path:**
   - Navigate to where you installed GNU Backgammon
   - Right-click on `gnubg.exe` and select "Properties"
   - Copy the full path (e.g., `C:\Program Files\GNU Backgammon\gnubg.exe`)

2. **Let me know the path:**
   - I'll update the Python code to use that specific path

## Step 5: Restart Python Service

After installation:

1. **Stop the Python service** (if running):
   - Press `Ctrl + C` in the terminal where it's running

2. **Start it again:**
   ```bash
   cd backend
   python python_ai_service.py
   ```

3. **Check the output:**
   - You should see: `✓ GNU Backgammon found at: [path]`
   - If you see this, GNU Backgammon is ready to use!

## Troubleshooting

### "gnubg not found" error:

1. **Check if it's installed:**
   - Go to the installation folder and verify `gnubg.exe` exists

2. **Try the full path:**
   - Test with: `"C:\Program Files\GNU Backgammon\gnubg.exe" --version`
   - If this works, we need to update the Python code with this path

3. **Alternative locations to check:**
   - `C:\Program Files (x86)\GNU Backgammon\gnubg.exe`
   - `C:\gnubg\gnubg.exe`
   - Your custom installation location

### Command line interface:

GNU Backgammon has both a GUI and command-line interface. For our Python integration, we need the command-line interface (`gnubg.exe` or `gnubg-cli.exe`). The installer should include both.

## Need Help?

If you encounter any issues:
1. Tell me what error message you see
2. Tell me where GNU Backgammon was installed (the exact path)
3. I'll help you fix it!

