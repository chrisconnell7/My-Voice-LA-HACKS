import csv
import json
import re
import os # Make sure to add this!
from collections import defaultdict, Counter

class MarkovChainBuilder:
    def __init__(self, n_gram_size=2):
        # n_gram_size=2 means it looks at the previous 1 word to predict the next.
        # n_gram_size=3 would look at the previous 2 words.
        self.n_gram_size = n_gram_size
        self.chain = defaultdict(Counter)

    def clean_text(self, text):
        """Standardizes text: lowercase, removes punctuation except apostrophes."""
        text = str(text).lower()
        text = re.sub(r'[^a-z0-9\s\']', '', text)
        return text.split()

    def add_to_chain(self, tokens):
        """Builds n-gram transitions from a list of tokens."""
        if len(tokens) < self.n_gram_size:
            return
            
        for i in range(len(tokens) - self.n_gram_size + 1):
            # The 'state' is the preceding words (e.g., "i am")
            state = " ".join(tokens[i : i + self.n_gram_size - 1])
            # The 'next_word' is what follows
            next_word = tokens[i + self.n_gram_size - 1]
            self.chain[state][next_word] += 1

    def process_csv(self, file_path, target_column='Patient'):
        """Reads the CSV and processes the target column."""
        print(f"Processing CSV: {file_path}...")
        with open(file_path, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                if target_column in row and row[target_column]:
                    tokens = self.clean_text(row[target_column])
                    self.add_to_chain(tokens)

    def export_json(self, output_path):
        """Sorts the predictions by frequency and exports to JSON."""
        print(f"Exporting dictionary to {output_path}...")
        optimized_dict = {}
        
        for state, counter in self.chain.items():
            # Get the top words sorted by frequency to keep the JSON small
            # The UI only needs 4 autocomplete chips, so we store the top 10 for safety
            top_words = [word for word, count in counter.most_common(10)]
            optimized_dict[state] = top_words

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(optimized_dict, f, separators=(',', ':')) # Minified
        print("Export complete.")

# Execution
if __name__ == "__main__":
    builder = MarkovChainBuilder(n_gram_size=2)
    
    # Automatically find the folder this script is sitting in
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Build the full paths for the CSV and JSON files
    csv_path = os.path.join(script_dir, 'medical_qa.csv')
    json_path = os.path.join(script_dir, 'markov_dictionary.json')
    
    # Run the builder with the correct absolute paths
    builder.process_csv(csv_path, target_column='Patient')
    builder.export_json(json_path)