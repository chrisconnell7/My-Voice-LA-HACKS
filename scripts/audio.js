// scripts/audio.js
let isAutoListening = false;
let globalStream = null;
let mediaRecorder = null; 
let audioChunks = [];     

window.toggleAutoListen = async () => {
    isAutoListening = !isAutoListening;
    
    const listenBtn = document.getElementById('autoListenBtn');
    
    if (listenBtn) {
        listenBtn.classList.toggle('active', isAutoListening);
    }
    
    if (isAutoListening) {
        console.log("🚀 Auto-Listen loop engaged.");
        try {
            globalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            window.startContinuousCycle();
        } catch (err) {
            console.error("Mic access failed:", err);
            isAutoListening = false; 
            if (listenBtn) listenBtn.classList.remove('active');
        }
    } else {
        console.log("🛑 Auto-Listen loop disabled.");
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        if (globalStream) {
            globalStream.getTracks().forEach(track => track.stop());
            globalStream = null; 
        }
    }
};

window.startContinuousCycle = () => {
    if (!isAutoListening || !globalStream) return;

    audioChunks = [];
    mediaRecorder = new MediaRecorder(globalStream);

    mediaRecorder.ondataavailable = (e) => { 
        if (e.data.size > 0) audioChunks.push(e.data); 
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // 1. Immediately start the NEXT chunk (Gapless feel)
        if (isAutoListening) window.startContinuousCycle();

        // 2. Process this chunk in the background
        if (typeof window.processBackgroundChunk === 'function') {
            window.processBackgroundChunk(audioBlob);
        }
    };

    mediaRecorder.start();

    // Trigger onstop after 10 seconds
    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }, 10000); 
};

// ==========================================
// BACKGROUND PROCESSING & APIs
// ==========================================

window.processBackgroundChunk = async (blob) => {
    const formData = new FormData();
    formData.append("audio", blob, "auto_chunk.webm");
    
    // Safely get language code
    const langCode = window.currentLang && window.currentLang.code 
        ? window.currentLang.code.split('-')[0] 
        : 'en';
    formData.append("language", langCode);

    try {
        const resp = await fetch('http://127.0.0.1:5000/transcribe', { method: 'POST', body: formData });
        const data = await resp.json();

        if (data.transcription && data.transcription.trim().length > 0) {
            // Save to full history log
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            window.fullTranscriptHistory.push({ time, text: data.transcription });
            if (window.renderHistory) window.renderHistory();

            // Send to Gemma for Chips
            const targetLang = window.currentLang ? window.currentLang.english : 'English';
            const gemmaResp = await fetch('http://127.0.0.1:5000/analyze-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: data.transcription, language: targetLang })
            });
            const gemmaData = await gemmaResp.json();

            if (gemmaData.contextWords) {
                const newPhrases = gemmaData.quickPhrases.map(t => ({ icon: '📡', text: t }));
                const current = window.categoryData['Transcription'] || [];
                
                // Sliding Window: New phrases at the top, keep only the latest 10
                window.categoryData['Transcription'] = [...newPhrases, ...current].slice(0, 10);
                
                if (window.currentCategory === 'Transcription' && window.renderSuggestions) {
                    window.renderSuggestions();
                }
            }
        }
    } catch (e) {
        console.error("Background processing error:", e);
    }
};

window.handleVoiceClone = async () => {
    const fileInput = document.getElementById('voiceUpload');
    const status = document.getElementById('cloneStatus');
    
    if (!fileInput || !fileInput.files[0]) return;

    status.textContent = "🧬 Cloning your voice... please wait.";
    status.style.color = "#4a90e2";
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', 'Personalized Patient Voice');

    try {
        const response = await fetch('http://127.0.0.1:5000/clone-voice', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.voice_id) {
            // Success! Set the new voice as active
            if (window.selectVoice) window.selectVoice(data.voice_id);
            status.textContent = "✅ Voice Cloned Successfully!";
            status.style.color = "#28a745";
            
            // Add a permanent button for the custom voice
            const customVoicePlaceholder = document.getElementById('customVoicePlaceholder');
            if (customVoicePlaceholder) {
                customVoicePlaceholder.innerHTML = `
                    <button class="voice-card action-btn active" data-id="${data.voice_id}" onclick="window.selectVoice('${data.voice_id}')">
                        <span class="voice-icon">🌟</span> Personal
                    </button>
                `;
            }
        } else {
            throw new Error(data.error || "Unknown Error");
        }
    } catch (e) {
        status.textContent = "❌ Error: " + e.message;
        status.style.color = "#dc3545";
    }
};