export class NgramEngine {
    constructor(dictionaryUrl = 'markov_dictionary.json') {
        this.dictionaryUrl = dictionaryUrl;
        this.dictionary = {};
        this.isLoaded = false;
    }

    /**
     * Fetches and parses the JSON dictionary. 
     * Call this once when the application initializes.
     */
    async load() {
        try {
            const response = await fetch(this.dictionaryUrl);
            if (!response.ok) throw new Error("Network response was not ok");
            this.dictionary = await response.json();
            this.isLoaded = true;
            console.log("Markov dictionary loaded successfully.");
        } catch (error) {
            console.error("Failed to load markov_dictionary.json:", error);
        }
    }

    /**
     * Cleans the input text using the same logic as the Python parser.
     */
    _cleanInput(text) {
        return text.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
    }

    /**
     * Takes the current text input and returns an array of up to 4 string predictions.
     */
    getPredictions(inputText, numSuggestions = 4) {
        if (!this.isLoaded) {
            console.warn("Engine not loaded yet.");
            return [];
        }

        const cleanedText = this._cleanInput(inputText);
        if (!cleanedText) return [];

        const tokens = cleanedText.split(/\s+/);
        
        // Assuming n_gram_size=2 from the Python script, we only care about the last word typed
        const lastWord = tokens[tokens.length - 1];

        // O(1) Hash Map lookup
        const suggestions = this.dictionary[lastWord];

        if (suggestions && suggestions.length > 0) {
            // Return top 4 suggestions
            return suggestions.slice(0, numSuggestions);
        }

        // Return empty array if no predictions found in the model
        return [];
    }
}