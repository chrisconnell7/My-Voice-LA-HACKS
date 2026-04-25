// scripts/audio.js
let mediaRecorder;
let audioChunks = [];
let isListening = false;

window.toggleListening = async (e) => {
    // 1. COMPLETELY BLOCK THE REFRESH
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    
    const btn = document.getElementById('listenBtn');

    if (!isListening) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                audioChunks = []; // Reset
                
                if (btn) btn.classList.remove('recording');
                console.log("🛑 Recording stopped. Sending to local Whisper...");
                
                await window.sendAudioToBackend(audioBlob);
            };

            mediaRecorder.start();
            isListening = true;
            if (btn) btn.classList.add('recording');
            console.log("🎙️ Listening...");

        } catch (error) {
            console.error("Microphone access denied:", error);
        }
    } else {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        isListening = false;
        return false;
    }
};

window.sendAudioToBackend = async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "doctor_speech.webm");

    // Pass the language so Whisper knows what to translate/transcribe
    const langCode = window.currentLang ? window.currentLang.code.split('-')[0] : 'en';
    formData.append("language", langCode);

    try {
        const response = await fetch('http://127.0.0.1:5000/transcribe', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.transcription) {
            console.log("🎯 Whisper Transcribed:", data.transcription);
            // Send the transcribed text straight into your local Gemma model!
            window.analyzeWithGemma(data.transcription);
        }
        
    } catch (error) {
        console.error("Failed to process audio locally:", error);
    }
};