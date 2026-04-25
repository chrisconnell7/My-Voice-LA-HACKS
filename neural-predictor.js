// neural-predictor.js
// ─── NEURAL NETWORK PREDICTION ENGINE (TRANSFORMERS.JS) ──────────────────

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

// Optional: Tell the environment to use the browser's Cache API to store the model
// so the user only has to download it once.
env.allowLocalModels = false; 

export class NeuralPredictor {
    constructor() {
        this.generator = null;
        this.isLoaded = false;
        this.isLoading = false;
    }

    // 1. Download and initialize the neural network
    async initialize(progressCallback) {
        if (this.isLoading || this.isLoaded) return;
        this.isLoading = true;

        try {
            // We are using a highly compressed version of GPT-2 (approx. 240MB).
            // It gets downloaded to the browser's IndexedDB cache automatically.
            this.generator = await pipeline('text-generation', 'Xenova/gpt2', {
                progress_callback: progressCallback // Updates your UI with download %
            });
            this.isLoaded = true;
            console.log("Neural Network successfully loaded into the browser!");
        } catch (error) {
            console.error("Failed to load Neural Network:", error);
        } finally {
            this.isLoading = false;
        }
    }

    // 2. The Prediction Engine
    async getSuggestions(inputText, limit = 4) {
        if (!this.isLoaded || !inputText || inputText.trim() === '') return [];

        try {
            // To make it act like "medical autocomplete", we prepend a hidden system prompt.
            // The AI reads this context, but we only show the user the output.
            const hiddenContext = "I am a patient in a hospital. ";
            const fullPrompt = hiddenContext + inputText;

            // Generate continuations
            const results = await this.generator(fullPrompt, {
                max_new_tokens: 3,           // Only guess the next 1 to 3 words
                num_return_sequences: limit, // Give us 4 different options
                do_sample: true,             // Allow creative guessing
                top_k: 50,                   // Limit guesses to the top 50 most logical words
                temperature: 0.6,            // Lower temp = more predictable/standard English
                repetition_penalty: 1.2      // Stop it from stuttering (e.g., "I want to to to")
            });

            // Clean up the output to remove the hidden context and exact prompt
            const suggestions = new Set();
            
            results.forEach(seq => {
                let generatedText = seq.generated_text;
                // Strip the hidden context
                generatedText = generatedText.replace(hiddenContext, "");
                
                // Ensure it's longer than what the user typed to be a valid suggestion
                if (generatedText.length > inputText.length && generatedText.trim() !== inputText.trim()) {
                    suggestions.add(generatedText);
                }
            });

            return Array.from(suggestions);
        } catch (error) {
            console.error("Generation error:", error);
            return [];
        }
    }
}  