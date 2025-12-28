# Python AI Service Setup

This guide will help you set up the Python backend service that uses GNU Backgammon for CPU AI.

## Prerequisites

1. **Python 3.8+** installed on your system
   - Check: `python --version` or `python3 --version`
   - Download from: https://www.python.org/downloads/

2. **pip** (Python package manager)
   - Usually comes with Python
   - Check: `pip --version` or `pip3 --version`

## Installation Steps

### 1. Navigate to the backend directory

```bash
cd backend
```

### 2. Create a virtual environment (recommended)

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

This will install:
- Flask (web framework)
- flask-cors (CORS support)
- gnubg-nn-pypi (GNU Backgammon neural network)
- numpy (numerical computing)

### 4. Verify GNU Backgammon installation

```bash
python -c "import gnubg; print('GNU Backgammon loaded successfully')"
```

If you see an error, the `gnubg-nn-pypi` package may need additional setup. Check the [GNU Backgammon documentation](https://gnubg.readthedocs.io/) for details.

## Running the Service

### Start the Python AI service

```bash
python python_ai_service.py
```

The service will start on `http://localhost:5000`

You should see:
```
==================================================
Backgammon Arena - GNU Backgammon AI Service
==================================================
GNU Backgammon: Available (or Not Available)
Starting server on http://localhost:5000
==================================================
```

### Start the Node.js backend (in a separate terminal)

```bash
cd backend
npm start
```

The Node.js server will proxy CPU move requests to the Python service.

## Troubleshooting

### GNU Backgammon not available

If you see "GNU Backgammon: Not Available", the service will fall back to a simple AI implementation. This is fine for testing, but for production you'll want GNU Backgammon working.

**Options:**
1. Check if `gnubg-nn-pypi` installed correctly: `pip list | grep gnubg`
2. Try installing from source: https://github.com/gnubg/gnubg
3. Use the simple AI fallback for now (it will still work with difficulty levels)

### Port already in use

If port 5000 is already in use, you can change it in `python_ai_service.py`:
```python
app.run(host='0.0.0.0', port=5001, debug=True)  # Change port number
```

And update `backend/.env`:
```
PYTHON_AI_SERVICE_URL=http://localhost:5001
```

## Testing

Test the service is running:

```bash
curl http://localhost:5000/api/health
```

Should return:
```json
{
  "status": "ok",
  "gnubg_available": true,
  "service": "python_ai"
}
```

## Development Notes

- The Python service runs independently from the Node.js backend
- The Node.js server proxies requests to the Python service
- If the Python service is unavailable, the frontend will handle errors gracefully
- Difficulty levels (1-10) adjust move selection accuracy and strategic depth

