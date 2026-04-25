export class NgramEngine {
    constructor(dictionaryUrl) {
        this.dictionaryUrl = dictionaryUrl;
        this.dictionary = {};
        this.isLoaded = false;
    }

    async load() {
        try {
            const response = await fetch(this.dictionaryUrl);
            if (!response.ok) throw new Error("Network response was not ok");
            this.dictionary = await response.json();
            this.isLoaded = true;
            console.log("Smart Markov dictionary loaded successfully.");
        } catch (error) {
            console.error("Failed to load markov_dictionary.json:", error);
        }
    }

    _cleanInput(text) {
        return text.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
    }

    /**
     * @param {string} inputText - The user's current typed sentence.
     * @param {number} numSuggestions - How many buttons to render (Default: 5).
     * @param {Array<string>} gemmaContextWords - Keywords from Gemma to prioritize.
     */
    getPredictions(inputText, numSuggestions = 5, gemmaContextWords = []) {
        if (!this.isLoaded) {
            console.warn("Engine not loaded yet.");
            return [];
        }

        const cleanedText = this._cleanInput(inputText);
        if (!cleanedText) return [];

        const tokens = cleanedText.split(/\s+/);
        let suggestions = [];

        // PATH A: Multi-Level Context Lookup
        // 1. Try to get 2-word context first (highest accuracy)
        if (tokens.length >= 2) {
            const twoWordState = `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`;
            suggestions = this.dictionary[twoWordState];
        }

        // 2. Fallback to 1-word context if the 2-word combo isn't in the dataset 
        //    OR if they have only typed one word so far.
        if (!suggestions || suggestions.length === 0) {
            const oneWordState = tokens[tokens.length - 1];
            suggestions = this.dictionary[oneWordState] || [];
        }

        // PATH B: Google Gemma Context Boosting
        if (suggestions.length > 0) {
            const sortedSuggestions = suggestions.sort((a, b) => {
                // If the word is in the Gemma list, give it a weight of 1, else 0
                const aIsContext = gemmaContextWords.includes(a) ? 1 : 0;
                const bIsContext = gemmaContextWords.includes(b) ? 1 : 0;
                
                // Sort descending (context words bubble up to the front of the array)
                return bIsContext - aIsContext; 
            });

            // Return the top N words
            return sortedSuggestions.slice(0, numSuggestions);
        }

        return [];
    }
}