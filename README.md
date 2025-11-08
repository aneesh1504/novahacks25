NovaHacks 25

Backend run:
    python -m pip install --upgrade pip      
    python -m pip install -r requirements.txt            
    python -m uvicorn api_server:app --reload --port 8000

Frontend:
    npm install
    npm run dev