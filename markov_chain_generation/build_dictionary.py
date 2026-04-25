import csv
import json
import re
import os
from collections import defaultdict, Counter

class SmartMarkovBuilder:
    def __init__(self):
        # We no longer need to pass n_gram_size, as we are hardcoding both levels
        self.chain = defaultdict(Counter)

    def clean_text(self, text):
        """Standardizes text: lowercase, removes punctuation except apostrophes."""
        text = str(text).lower()
        text = re.sub(r'[^a-z0-9\s\']', '', text)
        return text.split()

    def add_to_chain(self, tokens):
        """Builds both 1-word and 2-word transitions for fallback logic."""
        # 1. Build 1-word history (Bigrams)
        for i in range(len(tokens) - 1):
            state = tokens[i]
            next_word = tokens[i + 1]
            self.chain[state][next_word] += 1
            
        # 2. Build 2-word history (Trigrams)
        for i in range(len(tokens) - 2):
            state = f"{tokens[i]} {tokens[i+1]}"
            next_word = tokens[i + 2]
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
        print(f"Exporting multi-level dictionary to {output_path}...")
        optimized_dict = {}
        
        for state, counter in self.chain.items():
            # Keep top 10 words for every state
            top_words = [word for word, count in counter.most_common(10)]
            optimized_dict[state] = top_words

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(optimized_dict, f, separators=(',', ':'))
        print("Export complete.")

# Execution
if __name__ == "__main__":
    builder = SmartMarkovBuilder()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Go up one folder (..), then into 'data', then grab the files
    csv_path = os.path.join(script_dir, '..', 'data', 'medical_qa.csv')
    json_path = os.path.join(script_dir, '..', 'data', 'markov_dictionary.json')
    
    builder.process_csv(csv_path, target_column='Patient')
    builder.export_json(json_path)