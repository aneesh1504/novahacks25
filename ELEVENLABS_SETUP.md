# ElevenLabs TTS Setup Guide

## Overview
Your voice interviewer now uses ElevenLabs for high-quality AI voice synthesis instead of basic TTS engines.

## Setup Steps

### 1. Get ElevenLabs API Key
1. Visit [ElevenLabs](https://elevenlabs.io)
2. Sign up for an account (free tier available)
3. Go to your profile settings
4. Copy your API key

### 2. Set Environment Variable
Set your API key as an environment variable:

```bash
export ELEVENLABS_API_KEY="your_api_key_here"
```

Or create a `.env` file in the server directory:
```
ELEVENLABS_API_KEY=your_api_key_here
```

### 3. Available Voices
ElevenLabs provides many high-quality voices. Popular ones include:
- **Rachel** (default) - Clear, professional female voice
- **Drew** - Warm male voice  
- **Clyde** - Middle-aged male voice
- **Bella** - Young female voice
- **Antoni** - Well-rounded male voice
- **Elli** - Emotional female voice
- **Josh** - Deep male voice
- **Arnold** - Crisp male voice
- **Adam** - Deep male voice
- **Sam** - Raspy male voice

### 4. TTS Endpoint Usage
The `/tts` endpoint now accepts these parameters:

```json
{
  "text": "Hello, welcome to the interview!",
  "voice": "Rachel",
  "stability": 0.5,
  "similarity_boost": 0.5
}
```

**Parameters:**
- `text` (required): Text to synthesize
- `voice` (optional): Voice name (default: "Rachel")
- `stability` (optional): Voice stability 0.0-1.0 (default: 0.5)
- `similarity_boost` (optional): Voice similarity 0.0-1.0 (default: 0.5)

### 5. Voice Settings
- **Stability**: Higher values = more consistent voice, lower values = more expressive
- **Similarity Boost**: Higher values = closer to original voice, lower values = more creative liberty

### 6. Running the Server
```bash
cd /Users/Jason/CMU/Novahacks/novahacks25/server
export ELEVENLABS_API_KEY="your_api_key_here"
.venv/bin/python app.py
```

### 7. Testing TTS
You can test the TTS endpoint using curl:

```bash
curl -X POST http://localhost:5173/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, this is a test of ElevenLabs TTS!","voice":"Rachel"}' \
  --output test.mp3
```

## Benefits of ElevenLabs
- **High Quality**: Natural-sounding AI voices
- **Multiple Voices**: Choose from various voice personalities
- **Multilingual**: Supports multiple languages
- **Fast Generation**: Quick synthesis
- **Custom Voices**: Can clone voices (premium feature)

## Usage Limits
- Free tier: 10,000 characters/month
- Paid plans available for higher usage

## Frontend Integration
The frontend `src/app.js` will automatically use the new TTS endpoint. The voice selection can be configured in the frontend to let users choose their preferred interview voice.