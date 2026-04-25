// scripts/audio.js additions
let isAutoListening = false;
let globalStream = null;

window.toggleAutoListen = async () => {
    isAutoListening = document.getElementById('autoListenToggle').checked;
    
    if (isAutoListening) {
        console.log("🚀 Auto-Listen loop engaged.");
        try {
            // Keep the stream open so we don't have to re-request permission
            globalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            window.startContinuousCycle();
        } catch (err) {
            console.error("Mic access failed:", err);
            document.getElementById('autoListenToggle').checked = false;
        }
    } else {
        console.log("🛑 Auto-Listen loop disabled.");
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
        if (globalStream) globalStream.getTracks().forEach(track => track.stop());
    }
};

window.startContinuousCycle = () => {
    if (!isAutoListening || !globalStream) return;

    audioChunks = [];
    mediaRecorder = new MediaRecorder(globalStream);

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // 1. Immediately start the NEXT chunk (Gapless feel)
        if (isAutoListening) window.startContinuousCycle();

        // 2. Process this chunk in the background (No 'await' here!)
        window.processBackgroundChunk(audioBlob);
    };

    mediaRecorder.start();

    // Trigger onstop after 10 seconds
    setTimeout(() => {
        if (mediaRecorder.state === "recording") mediaRecorder.stop();
    }, 10000); 
};

window.processBackgroundChunk = async (blob) => {
    const formData = new FormData();
    formData.append("audio", blob, "auto_chunk.webm");
    formData.append("language", window.currentLang.code.split('-')[0]);

    try {
        const resp = await fetch('http://127.0.0.1:5000/transcribe', { method: 'POST', body: formData });
        const data = await resp.json();

        if (data.transcription && data.transcription.trim().length > 0) {
            // Save to full history log
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            window.fullTranscriptHistory.push({ time, text: data.transcription });
            if (window.renderHistory) window.renderHistory();

            // Send to Gemma for Chips
            const gemmaResp = await fetch('http://127.0.0.1:5000/analyze-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: data.transcription, language: window.currentLang.english })
            });
            const gemmaData = await gemmaResp.json();

            if (gemmaData.contextWords) {
                const newPhrases = gemmaData.quickPhrases.map(t => ({ icon: '📡', text: t }));
                const current = window.categoryData['Transcription'] || [];
                
                // Sliding Window: New phrases at the top, keep only the latest 10
                window.categoryData['Transcription'] = [...newPhrases, ...current].slice(0, 10);
                
                if (window.currentCategory === 'Transcription') window.renderSuggestions();
            }
        }
    } catch (e) {
        console.error("Background processing error:", e);
    }
};