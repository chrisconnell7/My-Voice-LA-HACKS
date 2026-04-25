// ai-worker.js
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

env.allowLocalModels = false;
let generator = null;

// =======================================================================
// ⚙️ AAC PATIENT AI CONFIGURATION
// =======================================================================
const CONFIG = {
    hiddenContext: "I am a patient in a hospital. I am speaking: ",

    params: {
        max_new_tokens: 4,           // Slightly longer to allow a new phrase to start
        num_return_sequences: 8,     
        do_sample: true,
        top_k: 40,                   
        temperature: 0.4,            // Bumped up slightly to prevent it from getting stuck on periods
        repetition_penalty: 1.15,    
        return_full_text: false      
    },

    bannedWords: [
        "patient", "patients", "therapist", "doctor", "nurse", 
        "he", "she", "they", "we", "said", "asked", "hospital"
    ]
};
// =======================================================================

function cleanSuggestion(generatedText) {
    let cleaned = generatedText;
    
    // Chop at terminal punctuation to keep it to one short thought,
    // but ALLOW apostrophes and commas so it can say things like "I'm" or "bad, and"
    cleaned = cleaned.split(/[.!?;:()\[\]"“”\n]/)[0];

    return cleaned.trim();
}

function isSuggestionValid(suggestion, originalInput) {
    if (!suggestion || suggestion.length === 0) return false;

    const lowerSuggestion = suggestion.toLowerCase();

    for (let word of CONFIG.bannedWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lowerSuggestion)) return false;
    }

    if (lowerSuggestion.includes('_') || lowerSuggestion.includes('*')) return false;

    return true;
}

// Helper to extract just the end of the user's text so the AI doesn't get confused
function getLastFewWords(text) {
    // Only feed the last ~40 characters or the last sentence to keep the AI focused
    const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
    let lastPart = sentences[sentences.length - 1];
    
    // If the last part is empty (e.g. they just typed a period), grab the previous sentence too
    if (lastPart.trim() === '' && sentences.length > 1) {
        lastPart = sentences[sentences.length - 2];
    }
    return lastPart.trim();
}

self.addEventListener('message', async (event) => {
    const { action, text } = event.data;

    if (action === 'initialize') {
        try {
            generator = await pipeline('text-generation', 'Xenova/gpt2', {
                progress_callback: (progress) => {
                    self.postMessage({ status: 'progress', progress });
                }
            });
            self.postMessage({ status: 'ready' });
        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }

    if (action === 'generate') {
        if (!generator) return;
        
        // Only look at the immediate context to prevent AI confusion
        const recentContext = getLastFewWords(text);
        
        // If the sentence ends with a period, force a space so it predicts the NEXT word
        let promptText = recentContext;
        if (/[.!?]$/.test(promptText)) {
            promptText += " "; 
        }

        const fullPrompt = CONFIG.hiddenContext + promptText;

        try {
            const results = await generator(fullPrompt, CONFIG.params);
            const validSuggestions = new Set();
            
            results.forEach(seq => {
                const newWords = seq.generated_text;
                const cleanedText = cleanSuggestion(newWords);
                
                if (isSuggestionValid(cleanedText, promptText)) {
                    // Formatting: if they typed "hurting.", the suggestion should have a space " I need"
                    const prefix = text.endsWith(" ") || cleanedText.startsWith("'") ? "" : " ";
                    validSuggestions.add(text + prefix + cleanedText);
                }
            });

            // Grab the top 4 unique, valid suggestions
            const finalSuggestions = Array.from(validSuggestions).slice(0, 4);

            self.postMessage({ status: 'complete', suggestions: finalSuggestions });
        } catch (error) {
            console.error(error);
            self.postMessage({ status: 'complete', suggestions: [] });
        }
    }
});