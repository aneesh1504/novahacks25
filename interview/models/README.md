Place a Vosk model directory here for offline speech-to-text.

Recommended (small English):
- vosk-model-small-en-us-0.15

Download from: https://alphacephei.com/vosk/models

After download, you should have a directory like:

models/
  └── vosk-model-small-en-us-0.15/
      ├── am
      ├── conf
      ├── graph
      ├── ivector
      ├── rescore
      ├── README
      └── ...

The Flask server will use this path by default. You can override with environment variable `VOSK_MODEL`.
