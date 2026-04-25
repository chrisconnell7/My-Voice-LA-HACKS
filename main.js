// main.js
// ─── CORE UI, MESSAGE HANDLING & NEURAL INITIALIZATION ────────────────────

const messageText = document.getElementById('messageText');

// 1. Start the background Web Worker for the Neural Network
const aiWorker = new Worker('ai-worker.js', { type: 'module' });
let isAiReady = false;
let neuralDebounceTimer = null;

// 2. Listen for the worker talking back to the UI
aiWorker.addEventListener('message', (event) => {
    const data = event.data;
    const aiPlaceholder = document.querySelector('.ai-placeholder');
    const row = document.getElementById('aiSuggestions');
    const spinner = document.getElementById('aiSpinner');

    if (data.status === 'progress') {
        // Update download progress bar for the 240MB model
        const percent = Math.round((data.progress.loaded / data.progress.total) * 100);
        if (aiPlaceholder) aiPlaceholder.textContent = `Downloading AI Model... ${percent}%`;
    } 
    else if (data.status === 'ready') {
        // The model is fully loaded and cached
        isAiReady = true;
        if (aiPlaceholder) aiPlaceholder.textContent = "Start typing to see neural suggestions...";
    }
    else if (data.status === 'complete') {
        // The AI has finished generating predictions
        if (spinner) spinner.classList.remove('visible');
        
        if (!data.suggestions || data.suggestions.length === 0) {
            row.innerHTML = '<span class="ai-placeholder">No suggestions found...</span>';
            return;
        }

        row.innerHTML = '';
        data.suggestions.forEach(s => {
            const chip = document.createElement('button');
            chip.className = 'ai-chip';
            chip.textContent = s;
            
            chip.onclick = () => {
                // The neural network returns the full string context, so we overwrite the entire text box
                setMessageContent(s + ' ');
                scheduleAI(getMessageContent());
            };
            row.appendChild(chip);
        });
    }
});


// ─── MESSAGE UI ───
function getMessageContent() {
    const cursor = messageText.querySelector('.cursor');
    if (cursor) cursor.remove();
    const text = messageText.textContent.trim();
    const span = document.createElement('span');
    span.className = 'cursor';
    messageText.appendChild(span);
    return text;
}

function setMessageContent(text) {
    const cursor = messageText.querySelector('.cursor');
    if (cursor) cursor.remove();
    messageText.textContent = text;
    const span = document.createElement('span');
    span.className = 'cursor';
    messageText.appendChild(span);
}

function addToMessage(text, button) {
    const current = getMessageContent();
    // Add a space before appending if there is already text
    const newText = current ? current + ' ' + text : text;
    setMessageContent(newText);
    
    document.querySelectorAll('.suggestion-btn').forEach(b => b.classList.remove('active'));
    if (button) button.classList.add('active');
    
    // Clear suggestions immediately upon selecting a full phrase
    clearAISuggestions();
    // Schedule new predictions based on the newly added phrase
    scheduleAI(newText);
}

function clearMessage() {
    setMessageContent('');
    document.querySelectorAll('.suggestion-btn').forEach(b => b.classList.remove('active'));
    clearAISuggestions();
}


// ─── NEURAL AUTOFILL LOGIC ───
function clearAISuggestions() {
    const row = document.getElementById('aiSuggestions');
    if (row) row.innerHTML = '<span class="ai-placeholder">Start typing or selecting phrases to see suggestions…</span>';
}

function scheduleAI(text) {
    // Add a 300ms debounce. We don't want the neural net generating
    // text halfway through a keystroke. Wait until they pause.
    clearTimeout(neuralDebounceTimer);
    neuralDebounceTimer = setTimeout(() => {
        updateNeuralSuggestions(text);
    }, 300);
}

function updateNeuralSuggestions(text) {
    const spinner = document.getElementById('aiSpinner');
    
    if (!text || text.length < 2 || !isAiReady) { 
        clearAISuggestions(); 
        return; 
    }

    if (spinner) spinner.classList.add('visible');
    
    // Send the text to the background worker. 
    // The UI is now free to do whatever it wants without lagging!
    aiWorker.postMessage({ action: 'generate', text: text });
}


// ─── CATEGORIES & UI NAVIGATION ───
function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    categoryMeta.forEach((m) => { 
        const key = m.key;
        const displayKey = m._displayKey || key; // Use translated key if available
        const icon = m.icon;
        
        const btn = document.createElement('button');
        btn.className = 'category-btn' + (key === currentCategory ? ' active' : '');
        btn.innerHTML = `<div class="category-icon">${icon}</div><div>${displayKey}</div>`;
        btn.onclick = () => selectCategory(key, btn);
        grid.appendChild(btn);
    });
}

function selectCategory(key, btn) {
    currentCategory = key;
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSuggestions();
}

function renderSuggestions(extraPhrases) {
    const grid = document.getElementById('suggestionsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const phrases = extraPhrases || categoryData[currentCategory] || [];
    phrases.forEach(({ icon, text }) => {
        const btn = document.createElement('button');
        btn.className = 'suggestion-btn';
        btn.innerHTML = `<div class="suggestion-icon">${icon}</div><div class="suggestion-text">${text}</div>`;
        btn.onclick = () => addToMessage(text, btn);
        grid.appendChild(btn);
    });
}


// ─── EXPOSE TO GLOBAL WINDOW SCOPE ───
// Because this file is now an ES Module (<script type="module">), its variables are private.
// We MUST bind these functions to the `window` object so your index.html buttons 
// (which use onclick="...") can still find them.

window.clearMessage = clearMessage;
window.scheduleAI = scheduleAI;
window.renderCategories = renderCategories;
window.selectCategory = selectCategory;
window.renderSuggestions = renderSuggestions;

window.backspace = function backspace() {
    const current = getMessageContent();
    const newText = current.slice(0, -1);
    setMessageContent(newText);
    scheduleAI(newText);
}

window.speakMessage = function speakMessage() {
    const text = getMessageContent();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLang.tts;
    window.speechSynthesis.speak(utterance);
}

window.toggleMenu = function toggleMenu() {
    menuOpen = !menuOpen;
    document.getElementById('menuOverlay').classList.toggle('open', menuOpen);
}

window.handleMenuOverlayClick = function handleMenuOverlayClick(e) {
    if (e.target === document.getElementById('menuOverlay')) window.toggleMenu();
}

window.openSettings = function openSettings() { alert('Settings panel — coming soon!'); }
window.openHelp = function openHelp() { alert('Help: Look at any button for 1–2 seconds to select it.'); }


// ─── STARTUP INIT ───
document.addEventListener('DOMContentLoaded', () => {
    // Sync external data (from doctor.js / data.js)
    if (typeof syncDoctorCategoryFull === 'function') syncDoctorCategoryFull();
    
    renderCategories();
    renderSuggestions();
    
    // Tell the Web Worker to download and initialize the neural network
    aiWorker.postMessage({ action: 'initialize' });
});

// ─── DWELL CLICKING (CURSOR RING) ───

// 1. Create the SVG cursor ring and add it to the body
const cursorRing = document.createElement('div');
cursorRing.id = 'dwell-cursor';
cursorRing.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 40 40">
        <circle class="dwell-bg" cx="20" cy="20" r="16"></circle>
        <circle class="dwell-progress" cx="20" cy="20" r="16"></circle>
    </svg>
`;
document.body.appendChild(cursorRing);

let dwellTimer = null;
let hoveredElement = null;

// 2. Make the ring follow the mouse
document.addEventListener('mousemove', (e) => {
    // Center the 40x40 ring precisely on the cursor tip
    cursorRing.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
});

// 3. Handle the dwell logic
document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('button, .menu-lang-current, .lang-item, .prompt-emoji-picker, .generated-item-text');
    
    if (target && target !== hoveredElement) {
        clearTimeout(dwellTimer);
        
        hoveredElement = target;
        cursorRing.classList.add('dwelling'); // Start the ring animation
        
        dwellTimer = setTimeout(() => {
            target.click();
            cursorRing.classList.remove('dwelling'); // Reset ring after click
            hoveredElement = null; 
        }, 1000);
    }
});

document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('button, .menu-lang-current, .lang-item, .prompt-emoji-picker, .generated-item-text');
    
    if (target && target === hoveredElement) {
        // Prevent reset if mouse is just moving between child elements inside the button
        if (!target.contains(e.relatedTarget)) {
            clearTimeout(dwellTimer);
            cursorRing.classList.remove('dwelling'); // Cancel the ring animation
            hoveredElement = null;
        }
    }
});