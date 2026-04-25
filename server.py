from flask import Flask, request, jsonify
from flask_cors import CORS
import vertexai
from vertexai.generative_models import GenerativeModel
import json
import os
from dotenv import load_dotenv

# Load the hidden variables from your .env file
load_dotenv()

app = Flask(__name__)
CORS(app) 

# ==========================================
# 1. CONFIGURATION: Secure Project ID 
# ==========================================
# This now safely grabs the ID from your computer without it being in the code!
PROJECT_ID = os.getenv("GCP_PROJECT_ID") 
LOCATION = "us-central1"

print("Initializing Google Cloud Vertex AI...")
try:
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    # Using gemma-1.1-7b-it as it is better at strict JSON formatting
    model = GenerativeModel("gemini-2.5-flash") 
except Exception as e:
    print(f"WARNING: Failed to initialize Vertex AI: {e}")

# ==========================================
# 2. THE API ENDPOINT
# ==========================================
@app.route('/analyze-notes', methods=['POST'])
def analyze_notes():
    data = request.json
    doctor_notes = data.get('notes', '')

    if not doctor_notes:
        return jsonify({"error": "No notes provided"}), 400

    print(f"Received clinical notes. Length: {len(doctor_notes)} characters. Asking Gemma to analyze...")

    # PROMPT ENGINEERING: We ask Gemma to return BOTH Markov keywords AND full Quick Phrases
    prompt = f"""
    You are an AI assistant helping a paralyzed hospital patient communicate.
    Read the following doctor's clinical notes and generate two things based on the patient's condition:
    1. "keywords": 10 single-word nouns and verbs for a predictive typing keyboard (e.g., pain, leg, nurse).
    2. "quickPhrases": 5 short, first-person sentences (3-5 words max) the patient might urgently want to say (e.g., "My incision burns", "I need more water", "Adjust my pillows").

    Doctor's Notes: "{doctor_notes}"

    Output ONLY a raw JSON object in this exact format. Do not use markdown blocks or backticks.
    {{
        "keywords": ["word1", "word2"],
        "quickPhrases": ["phrase 1", "phrase 2"]
    }}
    """

    try:
        # Call Google Gemma
        response = model.generate_content(prompt)
        raw_text = response.text
        print("Success! Gemma generated a response.")

        # Clean the response to strip out any accidental markdown formatting (```json)
        clean_json_string = raw_text.replace('```json', '').replace('```', '').strip()
        
        # Isolate just the JSON object just in case Gemma adds conversational text
        start_idx = clean_json_string.find('{')
        end_idx = clean_json_string.rfind('}') + 1
        
        if start_idx != -1 and end_idx != 0:
            clean_json_string = clean_json_string[start_idx:end_idx]

        # Parse the string into a Python dictionary
        parsed_data = json.loads(clean_json_string)
        
        # Send the payload back to the frontend
        return jsonify({
            "contextWords": parsed_data.get("keywords", []),
            "quickPhrases": parsed_data.get("quickPhrases", [])
        }), 200

    except json.JSONDecodeError as e:
        print(f"ERROR parsing JSON from Gemma: {e}")
        print(f"Raw output was: {raw_text}")
        return jsonify({"error": "Gemma returned invalid JSON", "details": str(e)}), 500
        
    except Exception as e:
        print(f"ERROR calling Gemma: {e}")
        return jsonify({"error": "Backend processing failed", "details": str(e)}), 500

# ==========================================
# 3. SERVER STARTUP
# ==========================================
if __name__ == '__main__':
    print("=========================================")
    print("🏥 'My Voice' AI Backend Server Running!")
    print("📡 URL: [http://127.0.0.1:5000](http://127.0.0.1:5000)")
    print("=========================================")
    app.run(debug=True, port=5000)