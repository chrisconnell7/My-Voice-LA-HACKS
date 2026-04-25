// scripts/doctor.js
// ─── DOCTOR UI & GEMMA BACKEND INTEGRATION ────────────────────────────

let loadedFileContent = null;
let fileExtractedPhrases = [];

// ─── TAB & LIST RENDERING ───

window.switchDocTab = (tab) => {
    document.querySelectorAll('.doc-tab, .doc-panel').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('panel-' + tab).classList.add('active');
};

window.renderPromptList = () => {
    const list = document.getElementById('promptList');
    if (!list) return;
    
    list.innerHTML = window.doctorPrompts.length === 0 
        ? '<div style="color:#aaa;text-align:center;padding:12px;">No saved phrases yet.</div>' 
        : '';
        
    window.doctorPrompts.forEach((p, i) => {
        const safeText = p.text.replace(/"/g, '&quot;');
        list.innerHTML += `
            <div class="prompt-item">
                <span class="prompt-item-icon">${p.icon}</span>
                <span class="prompt-item-text">${p.text}</span>
                <button data-text="${safeText}" onclick="window.addToMessage(this.dataset.text)" title="Insert">▶</button>
                <button onclick="window.deletePrompt(${i})" title="Delete">🗑</button>
            </div>`;
    });
};

// ─── MANUAL PROMPT LOGIC ───

window.addPrompt = () => {
    const input = document.getElementById('newPromptInput');
    const text = input ? input.value.trim() : "";
    if (!text) return;
    
    // Uses the current emoji from the cycle button
    const icon = document.getElementById('emojiPickerBtn').textContent;
    window.doctorPrompts.push({ icon, text });
    
    input.value = '';
    window.renderPromptList();
    window.syncDoctorCategory();
};

window.deletePrompt = (i) => { 
    window.doctorPrompts.splice(i, 1); 
    window.renderPromptList(); 
    window.syncDoctorCategory(); 
};

window.cycleEmoji = () => {
    // selectedEmojiIndex is defined in data.js
    window.selectedEmojiIndex = (window.selectedEmojiIndex + 1) % window.emojiOptions.length;
    document.getElementById('emojiPickerBtn').textContent = window.emojiOptions[window.selectedEmojiIndex];
};

// ─── FILE UPLOAD HANDLERS ───

window.handleDragOver = (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); };
window.handleDragLeave = (e) => { e.currentTarget.classList.remove('dragover'); };
window.handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) window.loadFile(file);
};

window.handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) window.loadFile(file);
};

window.loadFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        loadedFileContent = e.target.result;
        document.getElementById('fileLoadedName').textContent = file.name;
        document.getElementById('fileLoaded').style.display = 'flex';
        // Auto-analyze context when file is loaded
        window.analyzeWithGemma(loadedFileContent); 
    };
    reader.readAsText(file);
};

window.clearFile = () => {
    loadedFileContent = null;
    fileExtractedPhrases = [];
    document.getElementById('fileLoaded').style.display = 'none';
    document.getElementById('mdFileInput').value = '';
    window.syncDoctorCategory();
};

// ─── AI GENERATION & BACKEND INTEGRATION ───

window.generateFromContext = async () => {
    const textInput = document.getElementById('aiContextInput');
    const context = loadedFileContent || (textInput ? textInput.value.trim() : "");
    
    if (!context) {
        alert('Please enter context or upload a file.');
        return;
    }

    const btn = document.getElementById('generateBtn');
    const spinner = document.getElementById('generateSpinner');
    const label = document.getElementById('generateBtnLabel');

    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.add('visible');
    if (label) label.textContent = 'Gemma is thinking...';

    await window.analyzeWithGemma(context);
    
    window.renderGeneratedPhrases();
    
    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.remove('visible');
    if (label) label.textContent = '✨ Regenerate';
};

window.analyzeWithGemma = async (contextText) => {
    // Grab the target language from your UI state
    const targetLang = window.currentLang ? window.currentLang.english : 'English';

    try {
        const response = await fetch('http://127.0.0.1:5000/analyze-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                notes: contextText,
                language: targetLang // Send the language to Flask!
            })
        });
        
        const data = await response.json();
        if (data.contextWords) window.gemmaContextWords = data.contextWords;
        
        if (data.quickPhrases) {
            fileExtractedPhrases = data.quickPhrases.map(text => ({ icon: '⚡', text }));
            window.syncDoctorCategory();
        }
    } catch(e) {
        console.error("Gemma API failed. Is server.py running?", e);
    }
};

window.renderGeneratedPhrases = () => {
    const grid = document.getElementById('generatedGrid');
    const results = document.getElementById('generatedResults');
    if (!grid || !results) return;

    grid.innerHTML = '';
    fileExtractedPhrases.forEach((p, i) => {
        const safeText = p.text.replace(/"/g, '&quot;');
        grid.innerHTML += `
            <div class="generated-item">
                <span class="generated-item-icon">${p.icon}</span>
                <span class="generated-item-text" onclick="window.addToMessage(this.textContent)">${p.text}</span>
                <button class="generated-save-btn" id="save-gen-${i}" onclick="window.saveGenerated(${i})">Save</button>
            </div>`;
    });
    results.classList.add('visible');
};

window.saveAllGenerated = () => {
    fileExtractedPhrases.forEach((p, i) => {
        // 1. Add to the data array if it's not already there
        if (!window.doctorPrompts.find(d => d.text === p.text)) {
            window.doctorPrompts.push({ icon: p.icon, text: p.text });
        }
        
        // 2. Update the specific button UI to match your screenshot
        const btn = document.getElementById('save-gen-' + i);
        if (btn) {
            btn.textContent = '✓ Saved';
            btn.classList.add('saved');
            btn.disabled = true;
        }
    });
    
    // 3. Refresh the main UI categories and the "Saved" tab list once
    window.renderPromptList();
    window.syncDoctorCategory();
};

window.syncDoctorCategory = () => {
    const combined = [...window.doctorPrompts];
    fileExtractedPhrases.forEach(p => {
        if (!combined.find(c => c.text === p.text)) combined.push(p);
    });
    window.categoryData['Doctor'] = combined;
    if (window.currentCategory === 'Doctor') window.renderSuggestions();
};

// ─── MODAL UI LOGIC ───

window.openDoctorModal = () => {
    window.renderPromptList();
    window.switchDocTab('saved');
    const modal = document.getElementById('doctorModal');
    if (modal) modal.classList.add('open');
};

window.closeDoctorModal = () => {
    const modal = document.getElementById('doctorModal');
    if (modal) modal.classList.remove('open');
};

document.addEventListener('click', (e) => {
    const modal = document.getElementById('doctorModal');
    if (modal && e.target === modal) window.closeDoctorModal();
});

// scripts/doctor.js
window.renderHistory = () => {
    const container = document.getElementById('historyContainer');
    if (!container) return;

    if (window.fullTranscriptHistory.length === 0) {
        container.innerHTML = '<p style="color:#888; text-align:center;">No history yet.</p>';
        return;
    }

    container.innerHTML = window.fullTranscriptHistory.map(h => `
        <div class="history-item">
            <small>${h.time}</small>
            <p>${h.text}</p>
        </div>
    `).join('');
    
    // Auto-scroll to the latest entry
    container.scrollTop = container.scrollHeight;
};

window.clearHistory = () => {
    window.fullTranscriptHistory = [];
    window.renderHistory();
};