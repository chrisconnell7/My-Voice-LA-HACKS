# My-Voice-LA-HACKS

My Voice: AAC Communication Application

My Voice is a high-performance Augmentative and Alternative Communication (AAC) application designed for patients with speech or motor impairments. It combines high-speed eye-tracking-ready interfaces with a localized N-gram predictive engine and AI-driven clinical phrase generation.

🚀 Features

Momentum Dwell Engine: Eye-tracking ready interaction with a "forgiving" dwell ring that reverses progress on jitter rather than resetting.

Background AI Thread: Predictive typing powered by a Web Worker to ensure zero UI lag during heavy processing.

Gemma AI Integration: Context-aware clinical phrase generation based on patient notes or descriptions.

Multi-Language Support: Localized keyboard layouts (Latin, Spanish, Pinyin, French) and localized TTS.

Smart Spacing: Intelligent punctuation and phrase-aware spacing logic.

🛠️ Installation & Setup

1. Clone the Repository

git clone <your-repository-url>
cd MY-VOICE-LA-HACKS


2. Set Up Virtual Environment (venv)

On Windows:

# Create the environment
python -m venv venv

# Activate the environment
.\venv\Scripts\activate


On macOS / Linux:

# Create the environment
python3 -m venv venv

# Activate the environment
source venv/bin/activate


3. Install Dependencies

pip install -r requirements.txt


☁️ Google Cloud & Vertex AI Setup

The "Doctor Prompts" generation feature uses Google's Gemma models via Vertex AI.

Create a Project: Go to the Google Cloud Console and create a project.

Enable APIs: Enable the Vertex AI API for your project.

Install GCloud CLI: Install the Google Cloud SDK.

Authenticate:

gcloud init
gcloud auth application-default login


Environment Configuration

Create a .env file in the root directory and add your credentials:

GOOGLE_CLOUD_PROJECT="your-project-id-here"
GOOGLE_API_KEY="your-api-key-here"


🎁 Bonus: Beginner's Guide to Google Cloud Setup

If you've never used Google Cloud before, follow these steps to get everything running for free:

1. Get Free Credits

Google Cloud usually offers a $300 free trial for new users. Sign up at cloud.google.com/free. This will easily cover all the Gemma AI requests for this project.

2. Create Your First Project

Go to the Project Selector Page.

Click Create Project.

Give it a name (e.g., my-voice-aac) and click Create.

Important: Copy the Project ID (it usually looks like my-voice-aac-123456). You'll need this for your .env file.

3. Enable the Vertex AI API

In the search bar at the top, type "Vertex AI".

Click on Vertex AI from the results.

Click the Enable All Recommended APIs button. This allows the Python server to talk to the Gemma model.

4. Create an API Key (Alternative Method)

If you don't want to use the CLI to log in, you can create a traditional API Key:

Go to APIs & Services > Credentials.

Click Create Credentials > API Key.

Copy this key into your GOOGLE_API_KEY field in the .env file.

🖥️ Running the Application

1. Start the AI Backend

The Python server handles the clinical text analysis and AI phrase generation.

# Ensure venv is activated
python server.py


The server runs on http://127.0.0.1:5000.

2. Launch the Frontend

Because this app uses ES6 JavaScript Modules and Web Workers, it must be served via a web server.

Using Python:

python -m http.server 8000


Using VS Code: Use the Live Server extension to open index.html.

Access the app at http://localhost:8000.

📁 Project Structure

index.html: Main application entry point.

server.py: Flask backend for Vertex AI integration.

/scripts:

main.js: UI logic and Dwell Click engine.

ngram-worker.js: Background thread for predictions.

doctor.js: AI phrase generation and modal logic.

/data: Contains markov_dictionary.json and clinical datasets.

/styles: Application-wide CSS and layout definitions.

📄 License

This project was developed for LA Hacks 2024.