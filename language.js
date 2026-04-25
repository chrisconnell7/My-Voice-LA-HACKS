// language.js
// ─── LANGUAGE & TRANSLATION ───────────────────────────────────────────────
//
// Design: English is always the source of truth (originalCategoryData +
// doctorPrompts). When the user picks a non-English language we send ALL
// translatable strings to Claude in one batch, cache the result under the
// language code, and apply it. Switching back to English just restores the
// originals — no API call needed.
//
// Cache keys:  translationCache[langCode] = {
//   phrases:      { [catKey]: [{icon, text}, …] }
//   catLabels:    { [catKey]: string }
//   uiValues:     string[]
//   doctorPhrases?: [{icon, text}, …]   — added lazily when prompts exist
// }

const translationCache = {};
// Map your app's language codes to NLLB's FLORES-200 codes
const nllbLangMap = {
    'en-US': 'eng_Latn',
    'es-US': 'spa_Latn',
    'zh-CN': 'zho_Hans',
    'tl-PH': 'tgl_Latn', // Tagalog
    'vi-VN': 'vie_Latn',
    'ar-SA': 'arb_Arab',
    'fr-FR': 'fra_Latn',
    'ko-KR': 'kor_Hang',
    'ru-RU': 'rus_Cyrl',
    'hi-IN': 'hin_Deva'
};

let translatorPipeline = null;

// ─── Snapshot of the original English category phrases (excluding Doctor,
//     which is user-managed and translated separately).
const originalCategoryData = JSON.parse(JSON.stringify(
    Object.fromEntries(Object.entries(categoryData).filter(([k]) => k !== 'Doctor'))
));

// The fixed UI strings we translate (order matters — applyUIStrings uses indices).
// ⚠️  If you add strings here, add them to applyUIStrings() AND keep indices in sync.
const UI_STRINGS_EN = [
    // 0  – message section label
    'Message',
    // 1  – AI section label
    'AI Suggested Continuations',
    // 2  – AI sub-label
    'Suggestions based on your message',
    // 3  – AI placeholder (idle)
    'Start typing or selecting phrases to see AI suggestions…',
    // 4  – suggestions section label
    'You might want to say:',
    // 5  – categories section label
    'Browse by category:',
    // 6  – footer hint
    'Look at a button for a moment to select it',
    // 7  – speak button (message area)
    'Speak',
    // 8  – keyboard toggle button
    'Keyboard',
    // 9  – sidebar: clear
    'Clear',
    // 10 – sidebar: back
    'Back',
    // 11 – sidebar: speak
    'Speak',
    // 12 – header status badge
    'Eye Tracking Active',
    // 13 – menu section: Language
    'Language',
    // 14 – menu language change link
    'Change →',
    // 15 – menu section: Navigation
    'Navigation',
    // 16 – menu item: Keyboard
    'Keyboard',
    // 17 – menu item: Doctor Prompts
    'Doctor Prompts',
    // 18 – menu section: App
    'App',
    // 19 – menu item: Settings
    'Settings',
    // 20 – menu item: Help
    'Help',
    // 21 – doctor modal title
    '🩺 Doctor Prompts',
    // 22 – doctor tab: saved phrases
    '📋 Saved Phrases',
    // 23 – doctor tab: AI generate
    '✨ AI Generate',
    // 24 – doctor saved panel hint
    'Click ▶ to insert a phrase into the message, or 🗑 to delete it.',
    // 25 – doctor "Add Manually" label
    'Add Manually',
    // 26 – doctor add button
    '+ Add',
    // 27 – doctor done button
    '✅ Done',
    // 28 – doctor AI input label
    '📝 Describe patient context',
    // 29 – doctor AI textarea placeholder
    'Enter symptoms, diagnosis, procedures, medications, or any relevant clinical context…\n\ne.g. Post-op abdominal surgery, patient has diabetes, possible infection risk',
    // 30 – doctor file divider
    'or upload a file',
    // 31 – doctor file drop title
    'Drop a .md or .txt file here',
    // 32 – doctor file drop subtitle
    'Patient notes, symptom lists, care plans, or clinical markdown',
    // 33 – doctor generate button label
    '✨ Generate Phrase Suggestions',
    // 34 – doctor generated results label
    'Suggested phrases — click to use or save',
    // 35 – doctor save all button
    '💾 Save All to Phrases',
    // 36 – AI placeholder (no results)
    'No suggestions found...',
    // 37 – AI placeholder (model ready)
    'Start typing to see neural suggestions...',
    // 38 – language modal title
    '🌐 Select Language',
    // 39 – language search placeholder
    'Search languages…',
    // 40 – language apply button
    '✅ Apply Language',
];

async function getTranslator() {
    if (!translatorPipeline) {
        // Update the UI banner so the user knows a large download is happening
        let banner = document.getElementById('translatingBanner');
        if (banner) banner.textContent = 'Downloading offline translation model (first time only)...';
        
        // Dynamically import transformers.js so we don't break the non-module script tag
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1');
        env.allowLocalModels = false; 

        // Load the distilled NLLB model
        translatorPipeline = await pipeline('translation', 'Xenova/nllb-200-distilled-600M');
        
        if (banner) banner.textContent = 'Translating…';
    }
    return translatorPipeline;
}


// ─── LANGUAGE PICKER UI ───────────────────────────────────────────────────

function renderRegionTabs() {
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

document.getElementById('langModal').addEventListener('click', function(e) {
    if (e.target === this) closeLangModal();
});


// ─── APPLY LANGUAGE (entry point from the modal "Apply" button) ───────────

async function applyLanguage() {
    if (!pendingLang) return;
    currentLang = pendingLang;
    closeLangModal();
    await translatePageToLanguage(currentLang);
}


// ─── CORE TRANSLATION PIPELINE ───────────────────────────────────────────

async function translatePageToLanguage(lang) {
    if (lang.code === 'en-US') {
        restoreEnglishUI();
        return;
    }

    showTranslatingBanner(true);

    try {
        const cache = await buildTranslationCache(lang);
        applyTranslation(cache);
    } catch (e) {
        console.error('Translation failed:', e);
    } finally {
        showTranslatingBanner(false);
    }
}

/**
 * Returns a fully-populated translation cache entry for `lang`.
 * Performs one batched API call covering all phrases, category labels,
 * UI strings, and doctor prompts.
 */
async function buildTranslationCache(lang) {
    const code = lang.code;
    const existing = translationCache[code];

    const needsFullTranslation = !existing;
    const currentDoctorTexts = doctorPrompts.map(p => p.text);
    const cachedDoctorTexts  = existing?.doctorSourceTexts || [];
    const needsDoctorUpdate  = JSON.stringify(currentDoctorTexts) !== JSON.stringify(cachedDoctorTexts);

    if (!needsFullTranslation && !needsDoctorUpdate) {
        return existing;
    }

    // Initialize the local AI
    const translator = await getTranslator();
    const targetLangCode = nllbLangMap[code];

    // 1. Flatten all texts into a single array
    const phraseTexts = [];
    const phraseIndex = {};
    Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
        phraseIndex[cat] = [phraseTexts.length, phrases.length];
        phrases.forEach(p => phraseTexts.push(p.text));
    });

    const catKeys = categoryMeta.filter(m => m.key !== 'Doctor').map(m => m.key);

    const allTextsToTranslate = [
        ...phraseTexts,
        ...catKeys,
        ...UI_STRINGS_EN,
        ...currentDoctorTexts
    ];

    // 2. Perform the translation locally
    // NLLB can take an array of strings and translate them in bulk
    const results = await translator(allTextsToTranslate, {
        src_lang: 'eng_Latn',
        tgt_lang: targetLangCode
    });

    const translatedStrings = results.map(res => res.translation_text);

    // 3. Unpack the flat array back into distinct categories
    let offset = 0;
    
    const translatedPhraseTexts = translatedStrings.slice(offset, offset + phraseTexts.length);
    offset += phraseTexts.length;

    const translatedCatKeys = translatedStrings.slice(offset, offset + catKeys.length);
    offset += catKeys.length;

    const translatedUIStrings = translatedStrings.slice(offset, offset + UI_STRINGS_EN.length);
    offset += UI_STRINGS_EN.length;

    const translatedDoctorTexts = translatedStrings.slice(offset, offset + currentDoctorTexts.length);

    // 4. Build and save the cache
    const cache = {
        phrases: {},
        catLabels: {},
        uiValues: translatedUIStrings,
        doctorPhrases: doctorPrompts.map((p, i) => ({
            icon: p.icon,
            text: translatedDoctorTexts[i] || p.text,
        })),
        doctorSourceTexts: currentDoctorTexts,
    };

    Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
        const [start] = phraseIndex[cat];
        cache.phrases[cat] = phrases.map((p, i) => ({
            icon: p.icon,
            text: translatedPhraseTexts[start + i] || p.text,
        }));
    });

    catKeys.forEach((key, i) => {
        cache.catLabels[key] = translatedCatKeys[i] || key;
    });

    translationCache[code] = cache;
    return cache;
}


// ─── APPLY / RESTORE ──────────────────────────────────────────────────────

function applyTranslation(cache) {
    Object.entries(cache.phrases).forEach(([cat, phrases]) => {
        categoryData[cat] = phrases;
    });

    categoryMeta.forEach(m => {
        if (m.key !== 'Doctor') {
            m._displayKey = cache.catLabels[m.key] || null;
        }
    });

    if (cache.doctorPhrases && cache.doctorPhrases.length > 0) {
        categoryData['Doctor'] = cache.doctorPhrases;
    }

    applyUIStrings(cache.uiValues);

    if (typeof updateKeyboardLabel === 'function') updateKeyboardLabel();
    if (typeof renderCategories   === 'function') renderCategories();
    if (typeof renderSuggestions  === 'function') renderSuggestions();
    if (typeof clearAISuggestions === 'function') clearAISuggestions();
    if (typeof buildKeyboard      === 'function' && typeof keyboardVisible !== 'undefined' && keyboardVisible) buildKeyboard();
}

function restoreEnglishUI() {
    Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
        categoryData[cat] = phrases.map(p => ({ ...p }));
    });

    categoryMeta.forEach(m => { m._displayKey = null; });

    if (typeof syncDoctorCategoryFull === 'function') syncDoctorCategoryFull();

    applyUIStrings(null);

    if (typeof updateKeyboardLabel === 'function') updateKeyboardLabel();
    if (typeof renderCategories   === 'function') renderCategories();
    if (typeof renderSuggestions  === 'function') renderSuggestions();
    if (typeof clearAISuggestions === 'function') clearAISuggestions();
    if (typeof buildKeyboard      === 'function' && typeof keyboardVisible !== 'undefined' && keyboardVisible) buildKeyboard();
}


// ─── UI STRING APPLICATION ────────────────────────────────────────────────

/**
 * Write all UI strings into the DOM.
 * Pass null to reset every element back to its English default.
 */
function applyUIStrings(v) {
    const s    = v || UI_STRINGS_EN;
    const safe = i => (s[i] != null ? s[i] : UI_STRINGS_EN[i]);
    const el   = (sel, txt) => { const e = document.querySelector(sel); if (e) e.textContent = txt; };

    // ── Main page ─────────────────────────────────────────────────────────
    el('.message-section .section-label',    safe(0));
    el('.ai-section .section-label',         safe(1));

    const aiLbl = document.querySelector('.ai-label span:nth-child(2)');
    if (aiLbl) aiLbl.textContent = safe(2);

    const aiPh = document.querySelector('#aiSuggestions .ai-placeholder');
    if (aiPh) aiPh.textContent = safe(3);

    el('.suggestions-section .section-label', safe(4));
    el('.categories-section .section-label',  safe(5));

    const footer = document.querySelector('.footer span:last-child');
    if (footer) footer.textContent = ' ' + safe(6);

    const speakSpan = document.querySelector('.speak-btn span:last-child');
    if (speakSpan) speakSpan.textContent = safe(7);

    const kbSpan = document.querySelector('.keyboard-toggle-btn span:last-child');
    if (kbSpan) kbSpan.textContent = safe(8);

    // ── Action sidebar ────────────────────────────────────────────────────
    // Each .action-btn has: <div class="action-icon">…</div> <div>Label</div>
    const sidebarBtns = document.querySelectorAll('.action-sidebar .action-btn');
    [9, 10, 11].forEach((strIdx, i) => {
        if (!sidebarBtns[i]) return;
        const label = sidebarBtns[i].querySelector('div:last-child');
        if (label) label.textContent = safe(strIdx);
    });

    // ── Header status badge ───────────────────────────────────────────────
    const statusSpan = document.querySelector('.status-badge span');
    if (statusSpan) statusSpan.textContent = safe(12);

    // ── Menu drawer ───────────────────────────────────────────────────────
    const menuSections = document.querySelectorAll('.menu-section-title');
    // Order in HTML: Language (0), Navigation (1), App (2)
    if (menuSections[0]) menuSections[0].textContent = safe(13);
    if (menuSections[1]) menuSections[1].textContent = safe(15);
    if (menuSections[2]) menuSections[2].textContent = safe(18);

    const menuLangChange = document.querySelector('.menu-lang-change');
    if (menuLangChange) menuLangChange.textContent = safe(14);

    // Menu items — rebuild innerHTML to preserve the icon span
    const menuItems = document.querySelectorAll('.menu-item');
    const menuItemDefs = [
        [0, '⌨️', 16],
        [1, '🩺', 17],
        [2, '⚙️', 19],
        [3, '💬', 20],
    ];
    menuItemDefs.forEach(([idx, icon, strIdx]) => {
        if (menuItems[idx]) {
            menuItems[idx].innerHTML = `<span class="menu-item-icon">${icon}</span> ${safe(strIdx)}`;
        }
    });

    // ── Doctor modal ──────────────────────────────────────────────────────
    const docModalTitle = document.querySelector('.modal-title');
    if (docModalTitle) docModalTitle.textContent = safe(21);

    const tabSaved = document.getElementById('tab-saved');
    if (tabSaved) tabSaved.textContent = safe(22);

    const tabGen = document.getElementById('tab-generate');
    if (tabGen) tabGen.textContent = safe(23);

    // Saved panel: hint text (first div inside #panel-saved)
    const savedHint = document.querySelector('#panel-saved > div:first-child');
    if (savedHint) savedHint.textContent = safe(24);

    // "Add Manually" label — find it by data attribute we stamp on first write
    let addManuallyEl = document.querySelector('[data-i18n="addManually"]');
    if (!addManuallyEl) {
        // First time: find by current English text and stamp the attribute
        document.querySelectorAll('#panel-saved div').forEach(d => {
            if (d.textContent.trim() === 'Add Manually') {
                d.setAttribute('data-i18n', 'addManually');
                addManuallyEl = d;
            }
        });
    }
    if (addManuallyEl) addManuallyEl.textContent = safe(25);

    const promptAddBtn = document.querySelector('.prompt-add-btn');
    if (promptAddBtn) promptAddBtn.textContent = safe(26);

    const modalApplyBtn = document.querySelector('.modal-apply-btn');
    if (modalApplyBtn) modalApplyBtn.textContent = safe(27);

    // AI generate panel
    const aiInputLabel = document.querySelector('.ai-input-label');
    if (aiInputLabel) aiInputLabel.textContent = safe(28);

    const aiTextInput = document.querySelector('.ai-text-input');
    if (aiTextInput) aiTextInput.placeholder = safe(29);

    const aiDivider = document.querySelector('.ai-divider');
    if (aiDivider) aiDivider.textContent = safe(30);

    const fileDropTitle = document.querySelector('.file-drop-title');
    if (fileDropTitle) fileDropTitle.textContent = safe(31);

    const fileDropSub = document.querySelector('.file-drop-sub');
    if (fileDropSub) fileDropSub.textContent = safe(32);

    // Generate button — don't overwrite while mid-generation (button is disabled)
    const genBtn      = document.getElementById('generateBtn');
    const genBtnLabel = document.getElementById('generateBtnLabel');
    if (genBtnLabel && genBtn && !genBtn.disabled) {
        genBtnLabel.textContent = safe(33);
    }

    const generatedLabel = document.querySelector('.generated-label');
    if (generatedLabel) generatedLabel.textContent = safe(34);

    const saveAllBtn = document.querySelector('.save-all-btn');
    if (saveAllBtn) saveAllBtn.textContent = safe(35);

    // ── Language modal ────────────────────────────────────────────────────
    const langModalTitle = document.querySelector('.lang-modal-title');
    if (langModalTitle) langModalTitle.textContent = safe(38);

    const langSearch = document.getElementById('langSearch');
    if (langSearch) langSearch.placeholder = safe(39);

    const langApplyBtn = document.querySelector('.lang-apply-btn');
    if (langApplyBtn) langApplyBtn.textContent = safe(40);
}

/**
 * Get a single translated UI string by index.
 * main.js uses this for dynamically-set placeholder text.
 */
function getUIString(index) {
    if (currentLang.code === 'en-US') return UI_STRINGS_EN[index];
    const cache = translationCache[currentLang.code];
    return cache?.uiValues?.[index] ?? UI_STRINGS_EN[index];
}

// Expose helpers to global scope for use in main.js / other non-module scripts
window.getUIString = getUIString;
window.UI_IDX = {
    AI_IDLE:   3,
    AI_NONE:  36,
    AI_READY: 37,
};

function showTranslatingBanner(show) {
    let b = document.getElementById('translatingBanner');
    if (show && !b) {
        b = document.createElement('div');
        b.id = 'translatingBanner';
        b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#0066cc;color:white;text-align:center;padding:10px;font-weight:600;z-index:9999;font-size:15px;';
        b.textContent = 'Translating…';
        document.body.appendChild(b);
    } else if (!show && b) {
        b.remove();
    }
}


// ─── DOCTOR PROMPT TRANSLATION HELPER ────────────────────────────────────
// Called by doctor.js → syncDoctorCategoryFull() whenever prompts change
// while a non-English language is active.

async function translateDoctorPromptsIfNeeded() {
    if (currentLang.code === 'en-US' || doctorPrompts.length === 0) return;

    const code = currentLang.code;

    if (translationCache[code]) {
        translationCache[code].doctorSourceTexts = null;
    }

    showTranslatingBanner(true);
    try {
        const cache = await buildTranslationCache(currentLang);
        categoryData['Doctor'] = cache.doctorPhrases;
        if (typeof renderSuggestions === 'function' && currentCategory === 'Doctor') {
            renderSuggestions();
        }
    } catch(e) {
        console.error('Doctor prompt translation failed:', e);
    } finally {
        showTranslatingBanner(false);
    }
}
