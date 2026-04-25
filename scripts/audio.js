// scripts/audio.js
let recognition;
let isListening = false;

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
            }
        }
        
        if (finalTranscript) {
            console.log("Doctor said:", finalTranscript);
            // Instantly send the transcribed text to your Gemma backend!
            window.analyzeWithGemma(finalTranscript);
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
    };
} else {
    console.warn("Speech Recognition API not supported in this browser.");
}

window.toggleListening = () => {
    const btn = document.getElementById('listenBtn');
    
    if (!isListening) {
        // Set the microphone language dynamically based on your app's state
        // If no language is selected yet, default to English (US)
        const langCode = window.currentLang ? window.currentLang.code : 'en-US';
        recognition.lang = langCode;
        
        recognition.start();
        isListening = true;
        if(btn) btn.classList.add('recording');
        console.log(`🎙️ Listening in ${langCode}...`);
    } else {
        recognition.stop();
        isListening = false;
        if(btn) btn.classList.remove('recording');
        console.log("🛑 Stopped.");
    }
};