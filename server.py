import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import requests
import json
from faster_whisper import WhisperModel
import tempfile # Add this at the top

app = Flask(__name__)
CORS(app) 

# ==========================================
# 1. LOAD LOCAL MODELS
# ==========================================
OLLAMA_API_URL = "http://localhost:11434/api/generate"

print("Loading local Whisper model (CPU optimized)...")
# 'base' is highly accurate but small (~140MB). 
# It runs perfectly on CPUs using int8 compression.
whisper_model = WhisperModel("base", device="cpu", compute_type="int8")

UPLOAD_FOLDER = tempfile.gettempdir() 
print(f"📁 System Temp Folder used for audio: {UPLOAD_FOLDER}")
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# ==========================================
# 2. AUDIO TRANSCRIPTION ROUTE
# ==========================================
@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400
        
    file = request.files['audio']
    # 'en', 'es', 'zh', etc.
    lang_code = request.form.get('language', 'en') 
    
    if file and file.filename != '':
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        print(f"🎙️ Processing audio locally... (Language: {lang_code})")
        
        try:
            # Run the audio through the local Whisper model
            # Note: Whisper natively translates to English if you want, but here we just transcribe
            segments, info = whisper_model.transcribe(filepath, beam_size=5, language=lang_code)
            
            # Combine the text chunks
            transcription = "".join([segment.text for segment in segments])
            
            # Clean up the file
            if os.path.exists(filepath):
                os.remove(filepath)
                
            return jsonify({
                "transcription": transcription.strip(),
                "status": "success"
            }), 200
            
        except Exception as e:
            print(f"Transcription error: {e}")
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Invalid file"}), 400

# ==========================================
# 3. TEXT ANALYSIS ROUTE (GEMMA)
# ==========================================
@app.route('/analyze-notes', methods=['POST'])
def analyze_notes():
    data = request.json
    doctor_notes = data.get('notes', '')
    # This comes from window.currentLang.english (e.g., "Spanish" or "Chinese")
    target_lang_name = data.get('language', 'English') 

    if not doctor_notes:
        return jsonify({"error": "No notes provided"}), 400

    # We tell Gemma to act as a bridge between the Doctor and Patient
    prompt = f"""
    ROLE: Medical Communication Assistant.
    TASK: Translate clinical notes and generate patient-centric communication chips.
    
    INPUT NOTES: "{doctor_notes}"
    PATIENT LANGUAGE: {target_lang_name}

    INSTRUCTIONS:
    1. Read the input notes (which may be in English or another language).
    2. Extract the core medical symptoms and needs.
    3. Translate those findings into {target_lang_name}.
    4. Generate 10 single-word nouns/verbs (keywords) in {target_lang_name}.
    5. Generate 5 short first-person phrases in {target_lang_name} for the patient to use.

    OUTPUT FORMAT: Return ONLY a raw JSON object.
    {{
      "keywords": [],
      "quickPhrases": []
    }}
    """

    try:
        response = requests.post(OLLAMA_API_URL, json={
            "model": "gemma4:e2b", 
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": { "temperature": 0.1 } # Low temp = higher translation accuracy
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
    print("=========================================")
    print("🏥 'My Voice' AI Backend Server Running!")
    print("=========================================")
    app.run(debug=True, port=5000)