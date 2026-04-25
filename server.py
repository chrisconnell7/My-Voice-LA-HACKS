from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

app = Flask(__name__)
CORS(app) 

# Ollama runs locally on this port by default
OLLAMA_API_URL = "http://localhost:11434/api/generate"

@app.route('/analyze-notes', methods=['POST'])
def analyze_notes():
    data = request.json
    doctor_notes = data.get('notes', '')
    target_language = data.get('language', 'English') 

    if not doctor_notes:
        return jsonify({"error": "No notes provided"}), 400

    # UPGRADED PROMPT: Aggressively forcing specificity
    prompt = f"""
    You are an expert AI assistant helping a paralyzed hospital patient communicate. 
    Read the following doctor's clinical notes and generate UI elements based ONLY on their specific diagnosis.

    Doctor's Notes: "{doctor_notes}"

    Generate two things:
    1. "keywords": 10 single-word nouns and verbs. They MUST be related to the exact anatomy or symptoms mentioned in the notes.
    2. "quickPhrases": 5 short, first-person sentences (3-5 words max). They MUST address specific symptoms of the condition. 
       - BAD EXAMPLES (Too generic): "I am in pain", "Please help me", "I need a doctor".
       - GOOD EXAMPLES (If notes mention stroke/heart): "My chest feels tight", "My arm is numb", "I feel dizzy", "My face feels weak".

    CRITICAL INSTRUCTION: You must write the 'keywords' and 'quickPhrases' in {target_language}.
    
    Return ONLY a raw JSON object with keys 'keywords' and 'quickPhrases'. Do not include markdown blocks like ```json.
    """

    try:
        # We add "options" to lower the temperature, making the AI highly focused and literal
        response = requests.post(OLLAMA_API_URL, json={
            "model": "gemma:2b",
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2 
            }
        })
        
        response_data = response.json()
        raw_text = response_data.get('response', '{}')
        
        parsed_data = json.loads(raw_text)
        
        return jsonify({
            "contextWords": parsed_data.get("keywords", []),
            "quickPhrases": parsed_data.get("quickPhrases", [])
        }), 200

    except Exception as e:
        print(f"ERROR calling local Ollama model: {e}")
        return jsonify({"error": "Backend processing failed", "details": str(e)}), 500

if __name__ == '__main__':
    print("🏥 'My Voice' AI Backend Server Running via Ollama!")
    app.run(debug=True, port=5000)