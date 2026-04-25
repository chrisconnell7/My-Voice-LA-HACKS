// predictor.js
// ─── EFFICIENT DYNAMIC WEIGHT PREDICTION ENGINE ───────────────────────────

class TrieNode {
    constructor() {
        this.children = new Map();
        this.isWord = false;
        this.globalFreq = 0;
        this.medicalFreq = 0;
    }
}

class AACPredictor {
    constructor() {
        this.root = new TrieNode();
        this.bigrams = new Map();
        
        // If the user types any of these words, the engine shifts into "Medical Mode"
        this.medicalTriggers = new Set([
            "pain", "hurt", "hurts", "doctor", "nurse", "chest", "head", 
            "nauseous", "feel", "feeling", "breathe", "help", "medication", 
            "dizzy", "tired", "bathroom", "water", "bed"
        ]);
    }

    // Helper to clean and split text
    _tokenize(text) {
        return text.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).filter(w => w.length > 0);
    }

    // Train the engine. isMedical flag determines which frequency counter to increment
    train(dataSources, isMedical = false) {
        dataSources.forEach(source => {
            const words = this._tokenize(source);
            
            for (let i = 0; i < words.length; i++) {
                const currentWord = words[i];
                
                // 1. Insert into Trie for Word Completion
                let node = this.root;
                for (const char of currentWord) {
                    if (!node.children.has(char)) node.children.set(char, new TrieNode());
                    node = node.children.get(char);
                }
                node.isWord = true;
                if (isMedical) node.medicalFreq++; else node.globalFreq++;

                // 2. Insert into Bigram Map for Next-Word Prediction
                if (i < words.length - 1) {
                    const nextWord = words[i + 1];
                    if (!this.bigrams.has(currentWord)) this.bigrams.set(currentWord, new Map());
                    
                    const nextWordData = this.bigrams.get(currentWord);
                    if (!nextWordData.has(nextWord)) {
                        nextWordData.set(nextWord, { global: 0, medical: 0 });
                    }
                    if (isMedical) nextWordData.get(nextWord).medical++;
                    else nextWordData.get(nextWord).global++;
                }
            }
        });
    }

    // Helper to find words in the Trie starting with a prefix
    _findTrieCompletions(prefix, globalWeight, medicalWeight) {
        let node = this.root;
        for (const char of prefix) {
            if (!node.children.has(char)) return [];
            node = node.children.get(char);
        }

        const results = [];
        const dfs = (currentNode, currentWord) => {
            if (currentNode.isWord && currentWord !== prefix) {
                const score = (currentNode.globalFreq * globalWeight) + (currentNode.medicalFreq * medicalWeight);
                results.push({ word: currentWord, score });
            }
            for (const [char, childNode] of currentNode.children) {
                dfs(childNode, currentWord + char);
            }
        };
        
        dfs(node, prefix);
        return results;
    }

    getSuggestions(inputText, limit = 4) {
        if (!inputText || inputText.trim() === '') return [];

        const isSpaceAtEnd = inputText.endsWith(' ');
        const cleanInput = inputText.toLowerCase().replace(/[.,!?]/g, ' ');
        const words = cleanInput.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return [];
        
        const lastWord = words[words.length - 1];

        // --- DYNAMIC WEIGHTING LOGIC ---
        // Default weights: Global English is normal (1x), Medical is slightly boosted (2x)
        let globalWeight = 1.0;
        let medicalWeight = 2.0;

        // Check if the user has recently typed a medical trigger word
        const recentWords = words.slice(-3); // Look at the last 3 words typed
        const hasMedicalContext = recentWords.some(w => this.medicalTriggers.has(w));
        
        if (hasMedicalContext) {
            // Context detected! Spike the medical multiplier.
            medicalWeight = 15.0; 
        }

        let suggestions = [];

        // Scenario 1: User is currently typing a word (Word Completion)
        if (!isSpaceAtEnd) {
            const completions = this._findTrieCompletions(lastWord, globalWeight, medicalWeight);
            completions.sort((a, b) => b.score - a.score); // Sort by highest score
            
            completions.slice(0, limit).forEach(c => {
                const suffix = c.word.slice(lastWord.length);
                suggestions.push(inputText + suffix); // Preserve original casing/punctuation
            });
        } 
        // Scenario 2: User just finished a word (Next-Word Prediction)
        else if (this.bigrams.has(lastWord)) {
            const nextWordsMap = this.bigrams.get(lastWord);
            const scoredWords = [];

            for (const [nextWord, counts] of nextWordsMap.entries()) {
                const score = (counts.global * globalWeight) + (counts.medical * medicalWeight);
                scoredWords.push({ word: nextWord, score });
            }

            scoredWords.sort((a, b) => b.score - a.score);
            
            scoredWords.slice(0, limit).forEach(item => {
                suggestions.push(inputText + item.word);
            });
        }

        return suggestions;
    }
}