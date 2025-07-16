# 🎤 Voice Chat Assistant

React frontend for the [PDF Chatbot](https://github.com/anoopbajpaipublic/pdf-chatbot) backend. It allows users to chat with a PDF-based AI using both **text input** and **voice commands**, and the AI responds with both **text and speech** via OpenAI's TTS.

---

## ✨ Features

- 🎙️ Voice-enabled interface using Web Speech API
- 🧠 Queries answered from the PDF content via API
- 🔊 AI responds via OpenAI Text-to-Speech (`tts-1-hd`)
- 📱 Responsive, modern chat UI with rich feedback
- 🛡️ Handles permission states and mic access gracefully

---

## 📦 Tech Stack

- React + TypeScript
- Web Speech API (Voice Input)
- OpenAI TTS (Voice Output)
- Fetches responses from FastAPI backend ([pdf-chatbot](https://github.com/your-org/pdf-chatbot))

---

## 🚀 Setup Instructions

### 1. Clone the repo and install dependencies

bash
git clone <your-frontend-repo-url> voice-chat-assistant
cd voice-chat-assistant
npm install

2. Configure API Key
Create a .env file in the root:
REACT_APP_OPENAI_API_KEY=sk-xxxxxx  # Your OpenAI API Key

3. Start the backend
Make sure the backend server (pdf-chatbot) is running on http://localhost:8000. See backend setup https://github.com/anoopbajpaipublic/pdf-chatbot

uvicorn server:app --reload

4. Start the React app
npm start

By default, the app runs on http://localhost:3001

🧪 Test Voice + Text Chat
Ask a question by typing or speaking (e.g., "What recipes use coconut milk?")

The bot will respond with a short text and speak the answer.

You can mute the audio or stop AI speech at any time.

⚠️ Browser Requirements
Microphone access requires HTTPS or localhost

Best supported in Chrome and Edge

🛠 Scripts
bash

npm start      # Runs on http://localhost:3001
npm run build  # Production build
npm test       # Run tests

📂 Folder Structure  

voice-chat-assistant/

├── public/

├── src/

│   └── ChatBot.tsx

├── .env

├── package.json

└── README.md

📖 License
MIT or Custom License

