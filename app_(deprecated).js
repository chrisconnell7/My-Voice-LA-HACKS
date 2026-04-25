// ─── DATA ─────────────────────────────────────────────────────────────────

const categoryData = {
    Doctor: [
        
    ],
    Medical: [
        { icon: '🧍', text: "I'm in pain." },
        { icon: '💔', text: "I have chest pain." },
        { icon: '🤢', text: "I feel nauseous." },
        { icon: '😮‍💨', text: "I can't breathe well." },
        { icon: '🤕', text: "I have a headache." },
        { icon: '🤧', text: "I feel dizzy." },
        { icon: '💉', text: "I need pain relief." },
    ],
    Feelings: [
        { icon: '😕', text: "I'm uncomfortable." },
        { icon: '😢', text: "I'm sad." },
        { icon: '😟', text: "I'm anxious." },
        { icon: '😊', text: "I'm feeling okay." },
        { icon: '😴', text: "I'm tired." },
        { icon: '😣', text: "I'm in pain." },
        { icon: '😌', text: "I feel calm." },
    ],
    Needs: [
        { icon: '🖐️', text: "I need help." },
        { icon: '🥤', text: "I'm thirsty." },
        { icon: '🍽️', text: "I'm hungry." },
        { icon: '🛏️', text: "I need to rest." },
        { icon: '🚽', text: "I need to use the bathroom." },
        { icon: '🌡️', text: "Please be louder." },
        { icon: '🔕', text: "Please be quiet." },
        { icon: '🌡️', text: "Please change temperature." },
    ],
    People: [
        { icon: '👨‍⚕️', text: "I want to see the doctor." },
        { icon: '👩‍⚕️', text: "I want to see the nurse." },
        { icon: '👨‍👩‍👧', text: "I want to see my family." },
        { icon: '🧑‍🦯', text: "I need my caregiver." },
        { icon: '📞', text: "Please call someone." },
        { icon: '🙏', text: "Please stay with me." },
    ],
    Questions: [
        { icon: '🔄', text: "Can you repeat that?" },
        { icon: '❓', text: "I have a question." },
        { icon: '✅', text: "Yes." },
        { icon: '❌', text: "No." },
        { icon: '💊', text: "What is this medication for?" },
    ]
};

const categoryMeta = [
    { key: 'Doctor',      icon: '📝' },
    { key: 'Medical',   icon: '➕' },
    { key: 'Feelings',  icon: '😊' },
    { key: 'Needs',     icon: '👨‍👩‍👧' },
    { key: 'People',    icon: '👥' },
    { key: 'Questions', icon: '💬' },
];

let currentCategory = 'Feelings';
let doctorPrompts = [
    { icon: '🩺', text: 'Do you have chest pain?' },
    { icon: '💊', text: 'Are you taking your medication?' },
    { icon: '🤢', text: 'Do you feel nauseous?' },
];
let selectedEmojiIndex = 0;
const emojiOptions = ['🩺','💊','🩹','🧬','🔬','💉','🏥','❤️','🧠','🦷','👁️','👂'];
let aiDebounceTimer = null;

// ─── MESSAGE HELPERS ──────────────────────────────────────────────────────

const messageText = document.getElementById('messageText');

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
    const newText = current ? current + ' ' + text : text;
    setMessageContent(newText);
    document.querySelectorAll('.suggestion-btn').forEach(b => b.classList.remove('active'));
    if (button) button.classList.add('active');
    scheduleAI(newText);
}

function clearMessage() {
    setMessageContent('');
    document.querySelectorAll('.suggestion-btn').forEach(b => b.classList.remove('active'));
    clearAISuggestions();
}

function backspace() {
    const current = getMessageContent();
    const newText = current.slice(0, -1);
    setMessageContent(newText);
    scheduleAI(newText);
}

function speakMessage() {
    const text = getMessageContent();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '';
    categoryMeta.forEach((m) => { const { key, icon } = m;
        const btn = document.createElement('button');
        btn.className = 'category-btn' + (key === currentCategory ? ' active' : '');
        btn.innerHTML = `<div class="category-icon">${icon}</div><div>${key}</div>`;
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

// ─── KEYBOARD ─────────────────────────────────────────────────────────────

// ─── KEYBOARD LAYOUTS ─────────────────────────────────────────────────────

const keyboardLayouts = {
    latin: [
        ['Q','W','E','R','T','Y','U','I','O','P'],
        ['A','S','D','F','G','H','J','K','L'],
        ['Z','X','C','V','B','N','M','⌫'],
        [' ','✓']
    ],
    // Spanish - includes accented vowels and ñ
    spanish: [
        ['Q','W','E','R','T','Y','U','I','O','P'],
        ['A','S','D','F','G','H','J','K','L','Ñ'],
        ['Z','X','C','V','B','N','M','⌫'],
        ['Á','É','Í','Ó','Ú','Ü',' ','✓']
    ],
    french: [
        ['A','Z','E','R','T','Y','U','I','O','P'],
        ['Q','S','D','F','G','H','J','K','L','M'],
        ['W','X','C','V','B','N','É','È','⌫'],
        ['À','Â','Ê','Î','Ô','Û','Ç',' ','✓']
    ],
    // Pinyin with tone marks for all vowels
    pinyin: [
        ['b','p','m','f','d','t','n','l','g','k'],
        ['h','j','q','x','zh','ch','sh','r','z','c'],
        ['s','y','w','a','o','e','i','u','ü','⌫'],
        ['ā','á','ǎ','à','ē','é','ě','è','ī','í','ǐ','ì',' ','✓']
    ],
    arabic: [
        ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح'],
        ['ش','س','ي','ب','ل','ا','ت','ن','م','ك'],
        ['ظ','ط','ذ','د','ز','ر','و','ة','⌫'],
        [' ','✓']
    ],
    korean: [
        ['ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ'],
        ['ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ'],
        ['ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ','⌫'],
        [' ','✓']
    ],
    cyrillic: [
        ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З'],
        ['Ф','Ы','В','А','П','Р','О','Л','Д','Ж'],
        ['Я','Ч','С','М','И','Т','Ь','Б','Ю','⌫'],
        [' ','✓']
    ],
}
    // Hindi: Devanagari vowels + common consonants

let keyboardVisible = false;
let shiftOn = false;

function getKeyboardLayout() {
    const type = currentLang.keyboard || 'latin';
    return keyboardLayouts[type] || keyboardLayouts.latin;
}

function isNativeScript() {
    return ['arabic','korean','cyrillic','hindi','pinyin','spanish','french'].includes(currentLang.keyboard);
}


function buildNumpad() {
    const grid = document.getElementById('numpadGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const numLayout = [
        ['7','8','9'],
        ['4','5','6'],
        ['1','2','3'],
        ['.',  '0', '⌫']
    ];
    numLayout.forEach(row => {
        row.forEach(k => {
            const btn = document.createElement('button');
            btn.className = 'numpad-key' + (k === '⌫' ? ' numpad-action' : '');
            btn.textContent = k;
            btn.onclick = () => {
                if (k === '⌫') { backspace(); return; }
                const current = getMessageContent();
                setMessageContent(current + k);
                scheduleAI(getMessageContent());
            };
            grid.appendChild(btn);
        });
    });
}

function buildKeyboard() {
    const container = document.getElementById('keyboardRows');
    container.innerHTML = '';
    buildNumpad();
    const rows = getKeyboardLayout();
    const native = isNativeScript();

    rows.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        row.forEach(k => {
            if (k === '') return; // skip empty slots
            const key = document.createElement('button');
            key.className = 'key';
            let label = k;
            // Only apply shift/lowercase transformation on Latin layouts
            if (!native && k.length === 1 && /[A-Z]/.test(k)) {
                label = shiftOn ? k : k.toLowerCase();
            }
            if (k === ' ') { key.className += ' space'; label = 'SPACE'; }
            else if (['⌫','✓'].includes(k)) key.className += ' action-key wide';
            else if (k.length > 1 && k !== '⌫' && !['ABC','123','✓'].includes(k)) {
                // Multi-char keys like 'zh', 'ch', 'an', 'ing' — slightly wider
                key.className += ' wide';
                key.style.fontSize = '14px';
            }
            key.textContent = label;
            key.onclick = () => handleKey(k);
            rowDiv.appendChild(key);
        });
        container.appendChild(rowDiv);
    });
}

function handleKey(k) {
    if (k === '⌫') { backspace(); return; }
    if (k === '✓') { speakMessage(); return; }
    const native = isNativeScript();
    const char = (!native && k.length === 1 && /[A-Z]/.test(k))
        ? (shiftOn ? k : k.toLowerCase()) : k;
    const current = getMessageContent();
    setMessageContent(current + (k === ' ' ? ' ' : char));
    scheduleAI(getMessageContent());
}

function toggleKeyboard() {
    keyboardVisible = !keyboardVisible;
    const section = document.getElementById('keyboardSection');
    const btn = document.getElementById('keyboardToggleBtn');
    section.classList.toggle('open', keyboardVisible);
    btn.classList.toggle('active', keyboardVisible);
    if (keyboardVisible) {
        updateKeyboardLabel();
        buildKeyboard();
    }
}

function updateKeyboardLabel() {
    const label = document.getElementById('keyboardLangLabel');
    if (!label) return;
    const kbNames = {
        latin: 'Latin / QWERTY',
        french: 'AZERTY (French)',
        pinyin: 'Pinyin (Chinese input)',
        arabic: 'Arabic',
        korean: 'Hangul (Korean)',
        cyrillic: 'Cyrillic (Russian)',
        hindi: 'Devanagari (Hindi)',
    };
    const type = currentLang.keyboard || 'latin';
    label.textContent = `${currentLang.flag}  ${currentLang.english} — ${kbNames[type] || type}`;
}

// ─── AI AUTOFILL ─────────────────────────────────────────────────────────

function clearAISuggestions() {
    const row = document.getElementById('aiSuggestions');
    row.innerHTML = '<span class="ai-placeholder">Start typing or selecting phrases to see AI suggestions…</span>';
}

function scheduleAI(text) {
    clearTimeout(aiDebounceTimer);
    if (!text || text.length < 3) { clearAISuggestions(); return; }
    aiDebounceTimer = setTimeout(() => fetchAISuggestions(text), 700);
}

async function fetchAISuggestions(text) {
    const spinner = document.getElementById('aiSpinner');
    const row = document.getElementById('aiSuggestions');
    spinner.classList.add('visible');
    row.innerHTML = '';

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                system: `You are an AAC (Augmentative and Alternative Communication) assistant for people with communication disabilities who may be in a medical setting. 
Given the beginning of what a patient is trying to say, generate exactly 4 short, natural phrase completions or follow-up sentences they might want to say next.
Rules:
- Each suggestion must be under 10 words
- Keep language simple and direct
- Suggestions should be useful in a medical/care context
- Return ONLY a JSON array of 4 strings, no preamble, no markdown. Example: ["I need water","Please call my nurse","I feel worse","It hurts here"]`,
                messages: [{ role: 'user', content: `Patient has typed: "${text}"\n\nReturn 4 suggestions as a JSON array only.` }]
            })
        });

        const data = await response.json();
        const rawText = data.content.map(i => i.text || '').join('');
        const clean = rawText.replace(/```json|```/g, '').trim();
        const suggestions = JSON.parse(clean);

        row.innerHTML = '';
        suggestions.forEach(s => {
            const chip = document.createElement('button');
            chip.className = 'ai-chip';
            chip.textContent = s;
            chip.onclick = () => addToMessage(s, null);
            row.appendChild(chip);
        });
    } catch (e) {
        row.innerHTML = '<span class="ai-placeholder">Could not load suggestions. Check your connection.</span>';
    } finally {
        spinner.classList.remove('visible');
    }
}

// ─── DOCTOR PROMPTS ───────────────────────────────────────────────────────

let loadedFileContent = null;
let loadedFileName = null;
let generatedPhrases = [];

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
}

function cycleEmoji() {
    selectedEmojiIndex = (selectedEmojiIndex + 1) % emojiOptions.length;
    document.getElementById('emojiPickerBtn').textContent = emojiOptions[selectedEmojiIndex];
}

// File handling
function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('fileDropZone').classList.add('dragover');
}
function handleDragLeave(e) {
    document.getElementById('fileDropZone').classList.remove('dragover');
}
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

// AI Generation
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
                system: `You are a clinical AAC (Augmentative and Alternative Communication) assistant. 
Given clinical context about a patient (symptoms, diagnoses, procedures, medications, or notes), generate 10 short, specific phrases the patient might need to communicate — focusing on complications, pain, concerns, or needs relevant to their specific situation.

Rules:
- Each phrase must be under 12 words
- Phrases should be in first person (patient speaking)
- Focus on complications, discomfort, specific needs, or questions relevant to the clinical context
- Assign a relevant medical emoji to each phrase
- Return ONLY a JSON array of objects like: [{"icon":"😣","text":"My incision site is burning."},...]
- No preamble, no markdown fences`,
                messages: [{
                    role: 'user',
                    content: `Clinical context:\n\n${context.slice(0, 4000)}\n\nGenerate 10 patient AAC phrases as a JSON array only.`
                }]
            })
        });

        const data = await response.json();
        const raw = data.content.map(i => i.text || '').join('');
        const clean = raw.replace(/```json|```/g, '').trim();
        generatedPhrases = JSON.parse(clean);
        renderGeneratedPhrases();
    } catch (e) {
        alert('Could not generate suggestions. Please check your connection and try again.');
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
}

function openDoctorModal() {
    renderPromptList();
    switchDocTab('saved');
    document.getElementById('doctorModal').classList.add('open');
}

function closeDoctorModal() {
    document.getElementById('doctorModal').classList.remove('open');
}

// Close modal on overlay click
document.getElementById('doctorModal').addEventListener('click', function(e) {
    if (e.target === this) closeDoctorModal();
});

// ─── LANGUAGE DATA ────────────────────────────────────────────────────────
// Top 10 most spoken languages in the United States

const languages = [
    { code:'en-US', flag:'🇺🇸', native:'English',        english:'English',            tts:'en-US',  keyboard:'latin'   },
    { code:'es-US', flag:'🇲🇽', native:'Español',        english:'Spanish',            tts:'es-US',  keyboard:'spanish' },
    { code:'zh-CN', flag:'🇨🇳', native:'中文 (拼音)',     english:'Chinese (Pinyin)',    tts:'zh-CN',  keyboard:'pinyin'  },
    { code:'tl-PH', flag:'🇵🇭', native:'Filipino',       english:'Filipino/Tagalog',   tts:'fil-PH', keyboard:'latin'   },
    { code:'vi-VN', flag:'🇻🇳', native:'Tiếng Việt',     english:'Vietnamese',         tts:'vi-VN',  keyboard:'latin'   },
    { code:'ar-SA', flag:'🇸🇦', native:'العربية',        english:'Arabic',             tts:'ar-SA',  keyboard:'arabic'  },
    { code:'fr-FR', flag:'🇫🇷', native:'Français',       english:'French',             tts:'fr-FR',  keyboard:'french'  },
    { code:'ko-KR', flag:'🇰🇷', native:'한국어',          english:'Korean',             tts:'ko-KR',  keyboard:'korean'  },
    { code:'ru-RU', flag:'🇷🇺', native:'Русский',        english:'Russian',            tts:'ru-RU',  keyboard:'cyrillic'},
    { code:'hi-IN', flag:'🇮🇳', native:'हिन्दी',          english:'Hindi',              tts:'hi-IN',  keyboard:'hindi'   },
];

const regions = ['All'];

let currentLang = languages[0];
let pendingLang = languages[0];
let activeRegion = 'All';

// ─── MENU ─────────────────────────────────────────────────────────────────

let menuOpen = false;

function toggleMenu() {
    menuOpen = !menuOpen;
    document.getElementById('menuOverlay').classList.toggle('open', menuOpen);
}

function handleMenuOverlayClick(e) {
    if (e.target === document.getElementById('menuOverlay')) toggleMenu();
}

// ─── LANGUAGE MODAL ───────────────────────────────────────────────────────

function renderRegionTabs() {
    // Single region list — hide the tabs bar entirely
    const tabs = document.getElementById('langRegionTabs');
    if (tabs) tabs.style.display = 'none';
}

function renderLangList() {
    const query = (document.getElementById('langSearch').value || '').toLowerCase();
    const list = document.getElementById('langList');
    list.innerHTML = '';

    const filtered = languages.filter(l => {
        const matchRegion = activeRegion === 'All' || l.region === activeRegion;
        const matchSearch = !query ||
            l.native.toLowerCase().includes(query) ||
            l.english.toLowerCase().includes(query);
        return matchRegion && matchSearch;
    });

    if (!filtered.length) {
        list.innerHTML = '<div style="color:#aaa;text-align:center;padding:24px;font-size:14px;">No languages found.</div>';
        return;
    }

    filtered.forEach(l => {
        const item = document.createElement('div');
        item.className = 'lang-item' + (l.code === pendingLang.code ? ' selected' : '');
        item.innerHTML = `
            <span class="lang-item-flag">${l.flag}</span>
            <div class="lang-item-info">
                <div class="lang-item-native">${l.native}</div>
                <div class="lang-item-english">${l.english}</div>
            </div>
            <span class="lang-item-check">✓</span>
        `;
        item.onclick = () => { pendingLang = l; renderLangList(); };
        list.appendChild(item);
    });
}

function filterLanguages() { renderLangList(); }

function openLangModal() {
    pendingLang = currentLang;
    activeRegion = 'All';
    document.getElementById('langSearch').value = '';
    renderRegionTabs();
    renderLangList();
    document.getElementById('langModal').classList.add('open');
}

function closeLangModal() {
    document.getElementById('langModal').classList.remove('open');
}

function applyLanguage() {
    currentLang = pendingLang;
    // Update menu display
    document.getElementById('menuLangFlag').textContent = currentLang.flag;
    document.getElementById('menuLangName').textContent = currentLang.native;
    document.getElementById('menuLangSub').textContent = currentLang.english;
    // Update status badge to show language
    // Status badge stays as 'Eye Tracking Active'
    closeLangModal();
    toggleMenu();
    // Rebuild keyboard for new language if visible
    if (keyboardVisible) {
        updateKeyboardLabel();
        buildKeyboard();
    }
    translatePageToLanguage(currentLang);
    // Re-speak any existing message in new language
    const msg = getMessageContent();
    if (msg) {
        setTimeout(() => {
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = currentLang.tts;
            window.speechSynthesis.speak(u);
        }, 300);
    }
}

document.getElementById('langModal').addEventListener('click', function(e) {
    if (e.target === this) closeLangModal();
});

// Override speakMessage to use selected language
function speakMessage() {
    const text = getMessageContent();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLang.tts;
    window.speechSynthesis.speak(utterance);
}

// Override fetchAISuggestions to pass language context
async function fetchAISuggestions(text) {
    const spinner = document.getElementById('aiSpinner');
    const row = document.getElementById('aiSuggestions');
    spinner.classList.add('visible');
    row.innerHTML = '';

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                system: `You are an AAC (Augmentative and Alternative Communication) assistant for people with communication disabilities in a medical setting.
Given what a patient has typed, generate exactly 4 short phrase completions or follow-up sentences they might want to say next.
Rules:
- RESPOND IN THIS LANGUAGE: ${currentLang.english} (${currentLang.native})
- Each suggestion must be under 10 words
- Keep language simple and direct
- Return ONLY a JSON array of 4 strings, no preamble, no markdown.`,
                messages: [{ role: 'user', content: `Patient has typed: "${text}"\n\nReturn 4 suggestions in ${currentLang.english} as a JSON array only.` }]
            })
        });

        const data = await response.json();
        const rawText = data.content.map(i => i.text || '').join('');
        const clean = rawText.replace(/```json|```/g, '').trim();
        const suggestions = JSON.parse(clean);

        row.innerHTML = '';
        suggestions.forEach(s => {
            const chip = document.createElement('button');
            chip.className = 'ai-chip';
            chip.textContent = s;
            chip.onclick = () => addToMessage(s, null);
            row.appendChild(chip);
        });
    } catch (e) {
        row.innerHTML = '<span class="ai-placeholder">Could not load suggestions.</span>';
    } finally {
        spinner.classList.remove('visible');
    }
}

function openSettings() { alert('Settings panel — coming soon!'); }
function openHelp() { alert('Help: Look at any button for 1–2 seconds to select it.'); }

// INIT_PLACEHOLDER

// ─── TRANSLATION & DOCTOR SYNC ───────────────────────────────────────────

const translationCache = {};
let fileExtractedPhrases = [];

const originalCategoryData = JSON.parse(JSON.stringify(
    Object.fromEntries(Object.entries(categoryData).filter(([k]) => k !== 'Doctor'))
));

function syncDoctorCategoryFull() {
    const combined = doctorPrompts.map(p => ({ icon: p.icon, text: p.text }));
    (fileExtractedPhrases || []).forEach(p => {
        if (!combined.find(c => c.text === p.text)) combined.push(p);
    });
    categoryData['Doctor'] = combined;
    if (currentCategory === 'Doctor') renderSuggestions();
}

async function translatePageToLanguage(lang) {
    if (lang.code === 'en-US') { restoreEnglishUI(); return; }
    const cacheKey = lang.code;
    if (translationCache[cacheKey]) { applyTranslation(translationCache[cacheKey]); return; }
    showTranslatingBanner(true);
    try {
        const allPhrases = [];
        Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
            phrases.forEach(p => allPhrases.push({ cat, text: p.text }));
        });
        const doctorPhraseTexts = doctorPrompts.map(p => p.text);
        const catLabels = categoryMeta.filter(m => m.key !== 'Doctor').map(m => m.key);
        const uiValues = [
            'Message','AI Suggested Continuations','Suggestions based on your message',
            'Start typing or selecting phrases to see AI suggestions...',
            'You might want to say:','Browse by category:',
            'Look at a button for a moment to select it','Speak','Keyboard'
        ];
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4000,
                system: `You are a medical translation assistant. Translate all texts into ${lang.english} (${lang.native}). Return ONLY a JSON object with keys: "phrases" (array), "doctorPhrases" (array), "catLabels" (array), "uiValues" (array). Same order as input. No preamble, no markdown.`,
                messages: [{ role: 'user', content: JSON.stringify({ allPhrases, doctorPhraseTexts, catLabels, uiValues }) }]
            })
        });
        const data = await response.json();
        const raw = data.content.map(i => i.text || '').join('');
        const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
        const cache = { phrases: {}, doctorPhrases: [], catLabels: {}, uiValues: result.uiValues };
        let idx = 0;
        Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
            cache.phrases[cat] = phrases.map(p => ({ icon: p.icon, text: result.phrases[idx++] || p.text }));
        });
        cache.doctorPhrases = doctorPrompts.map((p, i) => ({ icon: p.icon, text: result.doctorPhrases[i] || p.text }));
        catLabels.forEach((label, i) => { cache.catLabels[label] = result.catLabels[i] || label; });
        translationCache[cacheKey] = cache;
        applyTranslation(cache);
    } catch(e) { console.error('Translation failed', e); }
    finally { showTranslatingBanner(false); }
}

function applyTranslation(cache) {
    Object.entries(cache.phrases).forEach(([cat, phrases]) => { categoryData[cat] = phrases; });
    categoryMeta.forEach(m => {
        if (m.key !== 'Doctor' && cache.catLabels[m.key]) m._displayKey = cache.catLabels[m.key];
    });
    if (cache.doctorPhrases) categoryData['Doctor'] = cache.doctorPhrases;
    applyUIStrings(cache.uiValues);
    renderCategories(); renderSuggestions(); clearAISuggestions();
}

function restoreEnglishUI() {
    Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
        categoryData[cat] = phrases.map(p => ({...p}));
    });
    categoryMeta.forEach(m => { m._displayKey = null; });
    applyUIStrings(null);
    syncDoctorCategoryFull();
    renderCategories(); renderSuggestions(); clearAISuggestions();
}

function applyUIStrings(v) {
    const defaults = ['Message','AI Suggested Continuations','Suggestions based on your message',
        'Start typing or selecting phrases to see AI suggestions...',
        'You might want to say:','Browse by category:',
        'Look at a button for a moment to select it','Speak','Keyboard'];
    const s = v || defaults;
    const safe = i => (s[i] || defaults[i]);
    const el = (sel, txt) => { const e = document.querySelector(sel); if (e) e.textContent = txt; };
    el('.message-section .section-label', safe(0));
    el('.ai-section .section-label', safe(1));
    const aiLbl = document.querySelector('.ai-label span:nth-child(2)');
    if (aiLbl) aiLbl.textContent = safe(2);
    const aiPh = document.querySelector('#aiSuggestions .ai-placeholder');
    if (aiPh) aiPh.textContent = safe(3);
    el('.suggestions-section .section-label', safe(4));
    el('.categories-section .section-label', safe(5));
    const footer = document.querySelector('.footer span:last-child');
    if (footer) footer.textContent = ' ' + safe(6);
    const speakSpan = document.querySelector('.speak-btn span:last-child');
    if (speakSpan) speakSpan.textContent = safe(7);
    const kbSpan = document.querySelector('.keyboard-toggle-btn span:last-child');
    if (kbSpan) kbSpan.textContent = safe(8);
}

function showTranslatingBanner(show) {
    let b = document.getElementById('translatingBanner');
    if (show && !b) {
        b = document.createElement('div');
        b.id = 'translatingBanner';
        b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#0066cc;color:white;text-align:center;padding:10px;font-weight:600;z-index:9999;font-size:15px;';
        b.textContent = 'Translating page...';
        document.body.appendChild(b);
    } else if (!show && b) { b.remove(); }
}

async function extractPhrasesFromFile(fileContent) {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                system: 'You are a clinical AAC assistant. Extract up to 12 short patient-communication phrases (under 12 words each) from clinical notes. Assign a medical emoji to each. Return ONLY a JSON array: [{"icon":"emoji","text":"..."},...]. No preamble.',
                messages: [{ role: 'user', content: 'Clinical notes:\n\n' + fileContent.slice(0, 3000) + '\n\nExtract as JSON array only.' }]
            })
        });
        const data = await response.json();
        const raw = data.content.map(i => i.text || '').join('');
        fileExtractedPhrases = JSON.parse(raw.replace(/```json|```/g, '').trim());
        syncDoctorCategoryFull();
    } catch(e) { console.error('File phrase extraction failed', e); }
}

// ─── INIT ─────────────────────────────────────────────────────────────────
syncDoctorCategoryFull();
renderCategories();
renderSuggestions();
