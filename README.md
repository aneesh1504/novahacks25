NovaHacks 25

Backend run (run using venv):
    python -m pip install --upgrade pip      
    python -m pip install -r requirements.txt            
    python -m uvicorn api_server:app --reload --port 8000

Frontend:
    npm install
    npm run dev

    in liquid-glass-login make .env.local and add:
    # Copy to .env.local and adjust values for your environment
    NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
    NEXT_PUBLIC_USE_BACKEND=true