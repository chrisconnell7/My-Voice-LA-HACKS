// doctor.js
// ─── DOCTOR PROMPTS & CLINICAL FILE PARSING ───────────────────────────────

let loadedFileContent = null;
let loadedFileName = null;
let generatedPhrases = [];
let fileExtractedPhrases = [];

function switchDocTab(tab) {
    document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.doc-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('panel-' + tab).classList.add('active');
}

function renderPromptList() {
    const list = document.getElementById('promptList');
    list.innerHTML = '';
    if (doctorPrompts.length === 0) {
        list.innerHTML = '<div style="color:#aaa;font-size:14px;text-align:center;padding:12px 0 4px;">No saved phrases yet.</div>';
        return;
    }
    doctorPrompts.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'prompt-item';
        item.innerHTML = `
            <span class="prompt-item-icon">${p.icon}</span>
            <span class="prompt-item-text">${p.text}</span>
            <button class="prompt-delete" onclick="usePrompt(${i})" title="Insert into message">▶</button>
            <button class="prompt-delete" onclick="deletePrompt(${i})" title="Delete">🗑</button>
        `;
        list.appendChild(item);
    });
}

function usePrompt(i) {
    addToMessage(doctorPrompts[i].text, null);
    closeDoctorModal();
}

function deletePrompt(i) {
    doctorPrompts.splice(i, 1);
    renderPromptList();
    syncDoctorCategoryFull();
}

function addPrompt() {
    const input = document.getElementById('newPromptInput');
    const text = input.value.trim();
    if (!text) return;
    doctorPrompts.push({ icon: emojiOptions[selectedEmojiIndex], text });
    input.value = '';
    renderPromptList();
    syncDoctorCategoryFull();
}

function cycleEmoji() {
    selectedEmojiIndex = (selectedEmojiIndex + 1) % emojiOptions.length;
    document.getElementById('emojiPickerBtn').textContent = emojiOptions[selectedEmojiIndex];
}

function handleDragOver(e) { e.preventDefault(); document.getElementById('fileDropZone').classList.add('dragover'); }
function handleDragLeave(e) { document.getElementById('fileDropZone').classList.remove('dragover'); }
function handleDrop(e) {
    e.preventDefault();
    document.getElementById('fileDropZone').classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
}
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) loadFile(file);
}

function loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        loadedFileContent = e.target.result;
        loadedFileName = file.name;
        document.getElementById('fileLoaded').style.display = 'flex';
        document.getElementById('fileLoadedName').textContent = file.name;
        extractPhrasesFromFile(loadedFileContent);
    };
    reader.readAsText(file);
}

function clearFile() {
    loadedFileContent = null;
    loadedFileName = null;
    fileExtractedPhrases = [];
    syncDoctorCategoryFull();
    document.getElementById('fileLoaded').style.display = 'none';
    document.getElementById('mdFileInput').value = '';
}

async function extractPhrasesFromFile(fileContent) {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                system: 'You are a clinical AAC assistant. Extract up to 12 short patient-communication phrases (under 12 words each) from clinical notes. Always write phrases in English. Assign a medical emoji to each. Return ONLY a JSON array: [{"icon":"emoji","text":"..."},...]. No preamble.',
                messages: [{ role: 'user', content: 'Clinical notes:\n\n' + fileContent.slice(0, 3000) + '\n\nExtract as JSON array only.' }]
            })
        });
        const data = await response.json();
        const raw = data.content.map(i => i.text || '').join('');
        fileExtractedPhrases = JSON.parse(raw.replace(/```json|```/g, '').trim());
        syncDoctorCategoryFull();
    } catch(e) { console.error('File phrase extraction failed', e); }
}

async function generateFromContext() {
    const textInput = document.getElementById('aiContextInput').value.trim();
    const context = loadedFileContent || textInput;
    if (!context) {
        alert('Please enter some patient context or upload a file first.');
        return;
    }

    const btn = document.getElementById('generateBtn');
    const spinner = document.getElementById('generateSpinner');
    const label = document.getElementById('generateBtnLabel');
    btn.disabled = true;
    spinner.classList.add('visible');
    label.textContent = 'Generating…';

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                system: `You are a clinical AAC assistant. Generate 10 specific patient phrases in English based on context. Under 12 words, first person, with medical emoji. Return JSON array only: [{"icon":"😣","text":"My incision hurts."},...]`,
                messages: [{ role: 'user', content: `Clinical context:\n\n${context.slice(0, 4000)}\n\nGenerate 10 patient AAC phrases as JSON array.` }]
            })
        });

        const data = await response.json();
        const raw = data.content.map(i => i.text || '').join('');
        const clean = raw.replace(/```json|```/g, '').trim();
        generatedPhrases = JSON.parse(clean);
        renderGeneratedPhrases();
    } catch (e) {
        alert('Could not generate suggestions. Please check your connection.');
    } finally {
        btn.disabled = false;
        spinner.classList.remove('visible');
        label.textContent = '✨ Regenerate';
    }
}

function renderGeneratedPhrases() {
    const grid = document.getElementById('generatedGrid');
    const results = document.getElementById('generatedResults');
    grid.innerHTML = '';
    generatedPhrases.forEach((p, i) => {
        const item = document.createElement('div');
        item.className = 'generated-item';
        item.innerHTML = `
            <span class="generated-item-icon">${p.icon}</span>
            <span class="generated-item-text">${p.text}</span>
            <button class="generated-save-btn" id="save-gen-${i}" onclick="saveGenerated(${i})">Save</button>
        `;
        item.querySelector('.generated-item-text').onclick = () => {
            addToMessage(p.text, null);
            closeDoctorModal();
        };
        grid.appendChild(item);
    });
    results.classList.add('visible');
}

function saveGenerated(i) {
    const p = generatedPhrases[i];
    if (!doctorPrompts.find(d => d.text === p.text)) {
        doctorPrompts.push({ icon: p.icon, text: p.text });
        renderPromptList();
        syncDoctorCategoryFull();
    }
    const btn = document.getElementById('save-gen-' + i);
    btn.textContent = '✓ Saved';
    btn.classList.add('saved');
    btn.disabled = true;
}

function saveAllGenerated() {
    generatedPhrases.forEach((p, i) => {
        if (!doctorPrompts.find(d => d.text === p.text)) {
            doctorPrompts.push({ icon: p.icon, text: p.text });
        }
        const btn = document.getElementById('save-gen-' + i);
        if (btn) { btn.textContent = '✓ Saved'; btn.classList.add('saved'); btn.disabled = true; }
    });
    renderPromptList();
    syncDoctorCategoryFull();
}

/**
 * Rebuild categoryData['Doctor'] from the current doctorPrompts +
 * fileExtractedPhrases, then translate if a non-English language is active.
 *
 * Always stores English as the source; translation is layered on top.
 */
/**
 * Rebuild categoryData['Doctor'] from the current doctorPrompts +
 * fileExtractedPhrases. No translation applied in static mode.
 */
function syncDoctorCategoryFull() {
    // Build the combined list of custom prompts + extracted files
    const combined = doctorPrompts.map(p => ({ icon: p.icon, text: p.text }));
    
    (fileExtractedPhrases || []).forEach(p => {
        if (!combined.find(c => c.text === p.text)) combined.push(p);
    });

    // Assign it to the grid and render
    categoryData['Doctor'] = combined;
    if (currentCategory === 'Doctor') renderSuggestions();
}

function openDoctorModal() {
    renderPromptList();
    switchDocTab('saved');
    document.getElementById('doctorModal').classList.add('open');
}

function closeDoctorModal() {
    document.getElementById('doctorModal').classList.remove('open');
}

document.getElementById('doctorModal').addEventListener('click', function(e) {
    if (e.target === this) closeDoctorModal();
});
