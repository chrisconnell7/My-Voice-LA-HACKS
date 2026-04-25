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
    target_language = data.get('language', 'English') 

    if not doctor_notes:
        return jsonify({"error": "No notes provided"}), 400

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
        response = requests.post(OLLAMA_API_URL, json={
            "model": "gemma4:e2b", 
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
    print("=========================================")
    print("🏥 'My Voice' AI Backend Server Running!")
    print("=========================================")
    app.run(debug=True, port=5000)