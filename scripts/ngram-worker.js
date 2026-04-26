// scripts/ngram-worker.js
import { NgramEngine } from './ngram-engine.js';

let engine = null;

self.onmessage = async (e) => {
    const { action, filePath, text, limit, contextWords } = e.data;

    if (action === 'load') {
        engine = new NgramEngine(filePath);
        await engine.load();
        self.postMessage({ status: 'ready' });
    }

    if (action === 'predict') {
        if (!engine) return;
        const predictions = await engine.getRemotePredictions(text, language || 'English', limit, contextWords);
        self.postMessage({ status: 'results', predictions });
    }
};