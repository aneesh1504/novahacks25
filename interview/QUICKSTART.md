# Quick Setup for ElevenLabs TTS

## Step 1: Get Your ElevenLabs API Key
1. Visit [elevenlabs.io](https://elevenlabs.io)
2. Sign up for a free account
3. Go to your profile settings
4. Copy your API key

## Step 2: Configure Your API Key
Edit the `.env` file in the `server` directory:

```bash
cd /Users/Jason/CMU/Novahacks/novahacks25/server
nano .env
```

Replace `your_elevenlabs_api_key_here` with your actual API key:
```
ELEVENLABS_API_KEY=el-1234567890abcdef1234567890abcdef
```

## Step 3: Run the Server
```bash
cd /Users/Jason/CMU/Novahacks/novahacks25/server
.venv/bin/python app.py
```

## Step 4: Test the Voice Interviewer
1. Open your browser to `http://localhost:5173`
2. Enable TTS and select an ElevenLabs voice
3. Start the interview and enjoy high-quality AI voices!

## Available Voices:
- **Rachel** - Clear, professional female voice
- **Drew** - Warm male voice  
- **Clyde** - Middle-aged male voice
- **Bella** - Young female voice
- **Antoni** - Well-rounded male voice
- **Elli** - Emotional female voice
- **Josh** - Deep male voice
- **Arnold** - Crisp male voice
- **Adam** - Deep male voice
- **Sam** - Raspy male voice

## Note:
- Free tier: 10,000 characters/month
- Your `.env` file is automatically ignored by git for security
- See `.env.example` for reference format