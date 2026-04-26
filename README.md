# 👁️ My Voice

Eye-Controlled AI Communication for Immobilized Patients

# 📖 About The Project

My Voice is an Augmentative and Alternative Communication (AAC) platform designed specifically for paralyzed, immobilized, or critically ill patients who are unable to speak or use their hands.

By leveraging browser-based eye-tracking, local AI models, and custom voice cloning, My Voice allows patients to seamlessly communicate their immediate needs, answer medical questions, and connect with their loved ones—using nothing but their gaze.

Built by Chris, Kadon, and Ryan for LA Hacks 2026

# ✨ Key Features

Magnetic Eye-Tracking: High-performance, hardware-accelerated eye tracking using MediaPipe and OpenCV. Features "Gravity Wells" (magnetic snapping) and a momentum-based dwell-click engine, making it effortless to type without exhausting the eyes.

Context-Aware AI Suggestions: Analyzes doctors' clinical notes (via local Google Gemma LLM) to instantly generate and suggest hyper-relevant, patient-centric vocabulary based on their current condition (e.g., suggesting "nausea" or "pain" after surgery).

Zero-Latency Word Prediction: A local N-gram Markov chain engine runs in a background Web Worker, providing instant predictive typing.

Custom Voice Cloning: Patients or family members can clone their original voice using ElevenLabs, restoring a deeply personal element to their communication.

Multilingual Support & Translation: Real-time translation and keyboard layouts for English, Spanish, and Chinese.

# 🛠️ Tech Stack

Frontend: Vanilla HTML/CSS/JS, MediaPipe Vision Tasks, OpenCV.js WebAssembly

Backend: Python, Flask

AI & Machine Learning: * Ollama (Google Gemma 4:e2b) for contextual language processing

Faster-Whisper (CPU optimized) for background audio transcription

ElevenLabs API for Voice Cloning and TTS

# 🚀 Setup Instructions

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

Python 3.12+

Ollama (For running local AI models)

An ElevenLabs Account & API Key

A code editor like VS Code with the Live Server extension installed.

## 1. Clone the Repository

Open your terminal and clone the repo:

git clone [https://github.com/chrisconnell7/My-Voice-LA-HACKS.git](https://github.com/chrisconnell7/My-Voice-LA-HACKS.git)

cd My-Voice-LA-HACKS


## 2. Set Up the Python Environment

Create and activate a virtual environment to keep dependencies clean:

Windows:
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Mac/Linux:
```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 3. Configure Environment Variables

Go to your ElevenLabs Profile and copy your API Key.

In the root directory of the project, create a new file named `.env`.

Paste the following into the .env file and save it:

`ELEVENLABS_API_KEY=your_api_key_here`


## 4. Initialize Local AI Models (Ollama)

We use Google's Gemma model locally to ensure patient data privacy. Open a new terminal window/powershell and run:

`ollama run gemma4:e2b`


Note: This will download the model to your machine. It may take a few minutes the very first time you run it depending on your internet connection.

## 5. Run the Application

You need to run both the Python backend and serve the HTML frontend.

Start the Backend Server:
In your original terminal (with the venv activated), start the Flask server:

`python server.py`


(The server will run on `http://localhost:5000`)

Start the Frontend:
To ensure webcam permissions and WebWorkers load correctly, the frontend must be served over a local web server (not just double-clicking the file).

Open the project folder in VS Code.

Right-click index.html and select "Open with Live Server".

The app will launch in your browser. Accept the camera permissions to begin eye-tracking!

# 🎯 Usage Notes

Calibrating: Click the "Calibrate" button in the top left. Keep your head completely still and follow the animated dots with your eyes.

Typing: Simply look at a key on the keyboard or a suggested phrase. The circular cursor will snap to the button and "fill up" to click it.

Doctor Prompts: Upload a .md or .txt file of a clinical summary to automatically generate relevant QuickWords and phrases tailored to the patient's immediate medical context.