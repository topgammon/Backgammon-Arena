# How to Restart the Python AI Service

## If the service is currently running:

1. **Stop the service:**
   - In the terminal window where it's running, press `Ctrl + C`
   - This will stop the Python service

2. **Start it again:**
   ```bash
   cd backend
   python python_ai_service.py
   ```

## If you're starting fresh:

1. **Open PowerShell or Command Prompt**

2. **Navigate to the backend directory:**
   ```bash
   cd "C:\Users\Knowmad\Desktop\Backgammon Arena\backend"
   ```

3. **Activate virtual environment (if you're using one):**
   ```bash
   venv\Scripts\activate
   ```

4. **Start the service:**
   ```bash
   python python_ai_service.py
   ```

5. **You should see:**
   ```
   ==================================================
   Backgammon Arena - GNU Backgammon AI Service
   ==================================================
   ✓ GNU Backgammon found at: [path]
   (or)
   ℹ GNU Backgammon not found - using fallback AI
   Starting server on http://localhost:5000
   ==================================================
   ```

## Quick Check:

After starting, the service should be running on `http://localhost:5000`

To verify it's working, open a browser and go to:
```
http://localhost:5000/api/health
```

You should see a JSON response like:
```json
{
  "status": "ok",
  "gnubg_available": true,
  "service": "python_ai"
}
```


