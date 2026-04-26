// scripts/main.js
// ─── CORE UI & WORKER-BASED PREDICTION ENGINE ──────────────────────

// 1. Initialize the Worker (The AI's private thread)
const ngramWorker = new Worker('./scripts/ngram-worker.js', { type: 'module' });
let isEngineReady = false;
let debounceTimer = null;

// Dwell Click (Momentum Engine) State
let dwellProgress = 0; 
let isHovering = false;
let currentTarget = null;
let animationFrame = null;

const DWELL_TIME = 500; 
const REVERSE_SPEED = 1.5; 

// ─── DWELL CURSOR INITIALIZATION ───
const cursorRing = document.createElement('div');
cursorRing.id = 'dwell-cursor';
cursorRing.innerHTML = `
    <svg width="40" height="40" viewBox="0 0 40 40">
        <circle class="dwell-bg" cx="20" cy="20" r="16"></circle>
        <circle class="dwell-progress" cx="20" cy="20" r="16"></circle>
    </svg>
`;
document.body.appendChild(cursorRing);

// ─── MESSAGE UI HELPERS ───
const messageText = document.getElementById('messageText');

window.getMessageContent = () => {
    const tempDiv = messageText.cloneNode(true);
    const cursor = tempDiv.querySelector('.cursor');
    if (cursor) cursor.remove();
    // Using innerText preserves spaces better than textContent
    return tempDiv.innerText;
};

window.getUIString = (englishKey) => {
    // If no language is selected yet, default to English
    const langCode = window.currentLang ? window.currentLang.code : 'en-US';
    const dict = window.staticTranslations[langCode] || window.staticTranslations['en-US'];
    
    // Return the translation if it exists, otherwise return the original English key
    return (dict && dict.ui && dict.ui[englishKey]) ? dict.ui[englishKey] : englishKey;
};

window.setMessageContent = (text) => {
    // Overwriting innerHTML ensures only ONE custom blue cursor exists
    messageText.innerHTML = text + '<span class="cursor"></span>';
};

// --- SMART ADD TO MESSAGE ---
window.addToMessage = (text) => {
    const current = window.getMessageContent();
    
    // A "Word or Phrase" is text longer than 1 char, OR an AI word (which ends in a space)
    const isFullWordOrPhrase = text.length > 1 || text.endsWith(' ');
    
    // Check if the current message ends in sentence-ending punctuation
    const justFinishedSentence = /[.!?]$/.test(current.trim());
    
    // Only add a space if:
    // - Not empty, no existing space, and the new text doesn't start with a space
    // - AND (it's a full word/phrase OR we just finished a sentence)
    const needsGlueSpace = current.length > 0 && 
                          !current.endsWith(' ') && 
                          !text.startsWith(' ') &&
                          (isFullWordOrPhrase || justFinishedSentence);
    
    const space = needsGlueSpace ? ' ' : '';
    const newText = current + space + text; 
    
    window.setMessageContent(newText);
    window.scheduleAI(newText);
}

window.clearMessage = () => { window.setMessageContent(''); window.scheduleAI(''); };
window.backspace = () => {
    const text = window.getMessageContent().slice(0, -1);
    window.setMessageContent(text);
    window.scheduleAI(text);
};

// ─── WORKER COMMUNICATION (The "Brain" Interface) ───
ngramWorker.onmessage = (e) => {
    if (e.data.status === 'ready') {
        isEngineReady = true;
        
        // FIX: Safely find the placeholder element in the DOM first
        const aiPlaceholder = document.querySelector('.ai-placeholder');
        
        if (aiPlaceholder) {
            aiPlaceholder.textContent = window.getUIString('Start typing to see neural suggestions...');
        }
    }
    if (e.data.status === 'results') {
        renderAIChips(e.data.predictions);
    }
};

window.scheduleAI = (text) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const row = document.getElementById('aiSuggestions');
        if (!row) return;

        if (!text || !isEngineReady) {
            row.innerHTML = `<span class="ai-placeholder">...</span>`;
            return;
        }

        // Offload the heavy prediction math to the background thread
        ngramWorker.postMessage({
            action: 'predict',
            text: text,
            limit: 5,
            contextWords: window.gemmaContextWords || []
        });
    }, 150);
};

function renderAIChips(predictions) {
    const row = document.getElementById('aiSuggestions');
    if (!row) return;
    row.innerHTML = '';
    
    predictions.forEach(word => {
        const chip = document.createElement('button');
        chip.className = 'ai-chip';
        chip.textContent = word;
        if (window.gemmaContextWords?.includes(word)) chip.classList.add('gemma-boosted');
        
        chip.onclick = () => {
            // Adding a trailing space signals to addToMessage that this is a full word
            window.addToMessage(word + ' ');
        };
        row.appendChild(chip);
    });
}

// ─── CATEGORY & SUGGESTION RENDERING ───
window.renderSuggestions = () => {
    const grid = document.getElementById('suggestionsGrid');
    if (!grid) return;
    
    // Safety check: ensure categoryData exists
    if (!window.categoryData || !window.categoryData[window.currentCategory]) {
        grid.innerHTML = '<div style="padding: 20px; color: #666;">No phrases found for this category.</div>';
        return;
    }

    const phrases = window.categoryData[window.currentCategory];
    
    // Build the buttons using data-text to perfectly protect against apostrophes
    grid.innerHTML = phrases.map(phrase => {
        // Escape double quotes just in case, single quotes (apostrophes) are now 100% safe
        const safeText = phrase.text.replace(/"/g, '&quot;');
        
        return `
            <button class="suggestion-btn" data-text="${safeText}" onclick="window.addToMessage(this.dataset.text)">
                <span class="suggestion-icon">${phrase.icon}</span>
                <span>${phrase.text}</span>
            </button>
        `;
    }).join('');
};

window.selectCategory = (key) => { 
    window.currentCategory = key; 
    window.renderCategories(); 
    window.renderSuggestions(); 
};

window.renderSuggestions = () => {
    const grid = document.getElementById('suggestionsGrid');
    if (!grid) return;
    const phrases = window.categoryData[window.currentCategory] || [];
    grid.innerHTML = phrases.map(p => {
        const safeText = p.text.replace(/"/g, '&quot;');
        return `
            <button class="suggestion-btn" data-text="${safeText}" onclick="window.addToMessage(this.dataset.text)">
                <div class="suggestion-icon">${p.icon}</div><div class="suggestion-text">${p.text}</div>
            </button>
        `;
    }).join('');
};

// ─── DWELL CLICK (MOMENTUM ENGINE) ───
// Add this new variable to the top of your state in main.js
let dwellLockout = false; 

function updateDwell() {
    const progressCircle = document.querySelector('.dwell-progress');
    const ringContainer = document.getElementById('dwell-cursor');
    
    // Check if we are currently locked out (prevents immediate re-fills after click)
    if (dwellLockout) {
        dwellProgress = 0;
        isHovering = false;
    }

    if (isHovering && dwellProgress < 100 && !dwellLockout) {
        dwellProgress += (100 / (DWELL_TIME / 16.6)); 
    } else if (!isHovering && dwellProgress > 0) {
        dwellProgress -= (100 / (DWELL_TIME / 16.6)) * REVERSE_SPEED;
    }

    // Force snap to zero and hide if progress is gone
    if (!isHovering && dwellProgress < 1) {
        dwellProgress = 0;
        if (ringContainer) ringContainer.style.opacity = "0";
    } else if (ringContainer && !dwellLockout) {
        ringContainer.style.opacity = "1";
    }

    dwellProgress = Math.max(0, Math.min(100, dwellProgress));

    if (progressCircle) {
        progressCircle.style.strokeDashoffset = 101 - (dwellProgress * 1.01);
    }

    // --- UPDATED CLICK TRIGGER ---
    if (dwellProgress >= 100 && currentTarget && !dwellLockout) {
        currentTarget.click();
        
        // RESET EVERYTHING
        dwellProgress = 0; 
        isHovering = false;
        dwellLockout = true; // Block the ring from filling again immediately
        
        if (ringContainer) ringContainer.style.opacity = "0";
    }

    if (dwellProgress > 0 || isHovering || dwellLockout) {
        animationFrame = requestAnimationFrame(updateDwell);
    } else {
        animationFrame = null;
    }
}

// UPDATE your mouseout listener to clear the lockout
document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('button, .ai-chip, .suggestion-btn, .category-btn, .key');
    if (target && target === currentTarget) {
        if (!target.contains(e.relatedTarget)) {
            isHovering = false;
            dwellLockout = false; // The lockout ends once the mouse leaves the button
        }
    }
});
document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('button, .ai-chip, .suggestion-btn, .category-btn, .key, .action-btn');
    if (target) {
        isHovering = true;
        currentTarget = target;
        if (!animationFrame) animationFrame = requestAnimationFrame(updateDwell);
    }
});

document.addEventListener('mousemove', (e) => {
    const ring = document.getElementById('dwell-cursor');
    if (ring) ring.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
});

// ─── UI NAVIGATION ───
window.toggleMenu = () => {
    window.menuOpen = !window.menuOpen;
    document.getElementById('menuOverlay')?.classList.toggle('open', window.menuOpen);
};

// FIX: Define the missing function triggered by index.html
window.handleMenuOverlayClick = () => {
    if (window.menuOpen) {
        window.toggleMenu();
    }
};

// ─── STARTUP INIT ───
document.addEventListener('DOMContentLoaded', () => {
    window.renderCategories();
    window.renderSuggestions();
    window.setMessageContent(''); 

    // Start background loading immediately—this won't lag the UI at all!
    ngramWorker.postMessage({ 
        action: 'load', 
        filePath: '../data/markov_dictionary.json' 
    });
});

// ─── LANGUAGE MODAL SYSTEM ───────────────────────────────────────────

let selectedLangTemp = null;

window.openLangModal = () => {
    selectedLangTemp = window.currentLang; // Start with current
    window.renderLanguageList();
    document.getElementById('langModal').classList.add('open');
};

window.closeLangModal = () => {
    document.getElementById('langModal').classList.remove('open');
};

window.renderLanguageList = (filter = "") => {
    const list = document.getElementById('langList');
    if (!list) return;

    const filtered = window.languages.filter(l => 
        l.english.toLowerCase().includes(filter.toLowerCase()) || 
        l.native.toLowerCase().includes(filter.toLowerCase())
    );

    list.innerHTML = filtered.map(l => `
        <div class="lang-item ${selectedLangTemp.code === l.code ? 'selected' : ''}" 
             onclick="window.selectLanguageTemp('${l.code}')">
            <span class="lang-flag">${l.flag}</span>
            <div class="lang-info">
                <div class="lang-name">${l.native}</div>
                <div class="lang-sub">${l.english}</div>
            </div>
            <div class="lang-radio"></div>
        </div>
    `).join('');
};

window.selectLanguageTemp = (code) => {
    selectedLangTemp = window.languages.find(l => l.code === code);
    window.renderLanguageList(document.getElementById('langSearch').value);
};

window.filterLanguages = () => {
    const val = document.getElementById('langSearch').value;
    window.renderLanguageList(val);
};

window.applyLanguage = () => {
    if (!selectedLangTemp) return;
    
    // 1. Update Global State
    window.currentLang = selectedLangTemp;
    
    // 2. Update Menu UI
    document.getElementById('menuLangFlag').textContent = window.currentLang.flag;
    document.getElementById('menuLangName').textContent = window.currentLang.native;
    document.getElementById('menuLangSub').textContent = window.currentLang.english;
    
    // 3. Update Keyboard if it's open
    if (window.keyboardVisible && typeof window.buildKeyboard === 'function') {
        window.buildKeyboard();
    }
    
    // Grab the dictionary for the selected language, or default to en-US
    const dict = window.staticTranslations[window.currentLang.code] || window.staticTranslations['en-US'];
    
    // 4. Update Static UI Text
    document.querySelectorAll('.ui-text').forEach(el => {
        const englishKey = el.getAttribute('data-en');
        if (dict && dict.ui && dict.ui[englishKey]) {
            el.textContent = dict.ui[englishKey];
        } else {
            el.textContent = englishKey; // Fallback
        }
    });

    // 5. Update Built-in Category Phrases 
    if (dict && dict.categories) {
        // Create a fresh copy of the target language categories
        const newCategories = { ...dict.categories };
        
        // Merge them into the active state
        Object.keys(newCategories).forEach(key => {
            window.categoryData[key] = newCategories[key];
        });

        // Ensure Doctor prompts (which are user-generated, not translated) stay preserved
        window.categoryData['Doctor'] = window.doctorPrompts || [];
    }

    // 6. INSTANTLY REFRESH BOTH GRIDS (This fixes your category delay!)
    if (typeof window.renderCategories === 'function') {
        window.renderCategories();
    }
    
    if (window.currentCategory !== 'Doctor' && typeof window.renderSuggestions === 'function') {
        window.renderSuggestions();
    }
    
    // Close the modal after applying
    if (typeof window.closeLangModal === 'function') {
        window.closeLangModal();
    }
};
// ─── CATEGORY & SUGGESTION LOGIC ────────────────────────────────────────

// Default to 'QuickWords' if no category is selected yet
window.currentCategory = window.currentCategory || 'QuickWords';

window.renderCategories = () => {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    
    // Safety check: Ensure categoryData exists
    window.categoryData = window.categoryData || {};
    
    grid.innerHTML = window.categoryMeta.map(cat => {
        // Add the active styling if it is the currently selected category
        const isActive = (window.currentCategory === cat.key) ? ' active' : '';
        
        // Use a smart onclick that works whether setCategory is global or local
        return `
            <button class="category-btn${isActive}" 
                    onclick="typeof window.setCategory === 'function' ? window.setCategory('${cat.key}') : setCategory('${cat.key}')">
                <span>${window.getUIString(cat.key)}</span>
                <span style="font-size:24px">${cat.icon}</span>
            </button>
        `;
    }).join('');
};

window.setCategory = (categoryName) => {
    // 1. Update the active category state
    window.currentCategory = categoryName;
    
    // 2. Re-render the category buttons to update the blue "active" highlighting
    if (typeof window.renderCategories === 'function') {
        window.renderCategories();
    }
    
    // 3. Render the specific phrases for this category (No modal pop-up anymore!)
    if (typeof window.renderSuggestions === 'function') {
        window.renderSuggestions();
    }
};

window.renderSuggestions = () => {
    const grid = document.getElementById('suggestionsGrid');
    if (!grid) return;
    
    // 🌟 DYNAMIC OVERRIDE: If 'Doctor' is selected, pull directly from the doctor's saved prompts!
    if (window.currentCategory === 'Doctor') {
        window.categoryData['Doctor'] = window.doctorPrompts || [];
    }
    
    // Safety check: ensure categoryData exists and has phrases
    if (!window.categoryData || !window.categoryData[window.currentCategory] || window.categoryData[window.currentCategory].length === 0) {
        grid.innerHTML = '<div style="padding: 20px; color: #666;">No phrases found here.</div>';
        return;
    }
    

    const phrases = window.categoryData[window.currentCategory].slice(0, 7);
    
    // Build the buttons (boxes) using data-text to perfectly protect against apostrophes
    grid.innerHTML = phrases.map(phrase => {
        const safeText = phrase.text.replace(/"/g, '&quot;');
        
        return `
            <button class="suggestion-btn" data-text="${safeText}" onclick="window.addToMessage(this.dataset.text)">
                <span class="suggestion-icon">${phrase.icon || '📝'}</span>
                <span>${phrase.text}</span>
            </button>
        `;
    }).join('');
};

window.selectedVoiceId = localStorage.getItem('userVoiceId') || "pNInz6obpgDQGcFmaJgB";

window.selectVoice = (id) => {
    window.selectedVoiceId = id;
    localStorage.setItem('userVoiceId', id);
    
    // Visually update the cards (add 'active' class)
    document.querySelectorAll('.voice-card').forEach(card => {
        card.classList.remove('active');
        if (card.getAttribute('onclick').includes(id)) {
            card.classList.add('active');
        }
    });
    console.log("Voice updated to:", id);
};

// --- SETTINGS MODAL LOGIC ---
window.openSettings = () => {
    document.getElementById('settingsModal').classList.add('open');
    // Highlight the currently saved voice
    window.updateVoiceUI();
};

window.closeSettings = () => {
    document.getElementById('settingsModal').classList.remove('open');
};

window.updateVoiceUI = () => {
    const currentId = window.selectedVoiceId;
    document.querySelectorAll('.voice-card').forEach(card => {
        card.classList.toggle('active', card.dataset.id === currentId);
    });
};

// Overwrite the existing window.selectVoice to include UI updates
window.selectVoice = (id) => {
    window.selectedVoiceId = id;
    localStorage.setItem('userVoiceId', id);
    window.updateVoiceUI();
    console.log("Voice changed to:", id);
};

// ─── INITIALIZATION (Put this at the very bottom of main.js) ───
// ─── STARTUP INIT ───
document.addEventListener('DOMContentLoaded', () => {
    // Set default category to QuickWords on launch
    window.currentCategory = 'QuickWords'; 

    window.renderCategories();
    window.renderSuggestions();
    window.setMessageContent(''); 

    // Start background loading
    ngramWorker.postMessage({ 
        action: 'load', 
        filePath: '../data/markov_dictionary.json' 
    });
});