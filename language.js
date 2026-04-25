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

// ─── Snapshot of the original English category phrases (excluding Doctor,
//     which is user-managed and translated separately).
const originalCategoryData = JSON.parse(JSON.stringify(
    Object.fromEntries(Object.entries(categoryData).filter(([k]) => k !== 'Doctor'))
));

// The fixed UI strings we translate (order matters — applyUIStrings uses indices).
const UI_STRINGS_EN = [
    'Message',
    'AI Suggested Continuations',
    'Suggestions based on your message',
    'Start typing or selecting phrases to see AI suggestions…',
    'You might want to say:',
    'Browse by category:',
    'Look at a button for a moment to select it',
    'Speak',
    'Keyboard',
];


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
    // English is the source — just restore originals.
    if (lang.code === 'en-US') {
        restoreEnglishUI();
        return;
    }

    showTranslatingBanner(true);

    try {
        // Build (or refresh) the cache entry for this language.
        const cache = await buildTranslationCache(lang);
        applyTranslation(cache);
    } catch (e) {
        console.error('Translation failed:', e);
        // Fall back gracefully — leave whatever was already rendered.
    } finally {
        showTranslatingBanner(false);
    }
}

/**
 * Returns a fully-populated translation cache entry for `lang`.
 *
 * We always translate the fixed phrases + UI strings fresh when first
 * requested (cached thereafter). Doctor prompts are included if they
 * exist and haven't been translated into this language yet.
 */
async function buildTranslationCache(lang) {
    const code = lang.code;
    const existing = translationCache[code];

    // Collect what needs translating.
    const needsFullTranslation = !existing;
    const currentDoctorTexts = doctorPrompts.map(p => p.text);
    const cachedDoctorTexts  = existing?.doctorSourceTexts || [];
    const needsDoctorUpdate  = JSON.stringify(currentDoctorTexts) !== JSON.stringify(cachedDoctorTexts);

    if (!needsFullTranslation && !needsDoctorUpdate) {
        return existing; // Already fully up-to-date.
    }

    // ── Assemble the payload ──────────────────────────────────────────────
    // Flatten phrases to a plain array so the JSON stays small and the
    // model doesn't get confused by nested objects.
    const phraseTexts = [];
    const phraseIndex = {}; // catKey -> [startIdx, count]
    Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
        phraseIndex[cat] = [phraseTexts.length, phrases.length];
        phrases.forEach(p => phraseTexts.push(p.text));
    });

    const catKeys = categoryMeta.filter(m => m.key !== 'Doctor').map(m => m.key);

    const payload = {
        phraseTexts,          // flat array of English phrase texts
        catKeys,              // category label strings to translate
        uiStrings: UI_STRINGS_EN,
        doctorTexts: currentDoctorTexts,
    };

    // ── Single API call ───────────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            system: `You are a medical translation assistant specialising in AAC (Augmentative and Alternative Communication) for hospital patients.

Translate every string in the input JSON into ${lang.english} (${lang.native}).
Rules:
- Keep translations short and natural — these appear on buttons and UI labels.
- Preserve first-person phrasing for patient phrases (e.g. "I am in pain").
- Keep medical accuracy.
- Return ONLY a valid JSON object — no markdown fences, no preamble — with exactly these keys:
  {
    "phraseTexts": [...],   // same length as input phraseTexts
    "catKeys":    [...],   // same length as input catKeys
    "uiStrings":  [...],   // same length as input uiStrings
    "doctorTexts":[...]    // same length as input doctorTexts
  }`,
            messages: [{
                role: 'user',
                content: JSON.stringify(payload),
            }],
        }),
    });

    const data = await response.json();
    const raw  = data.content.map(i => i.text || '').join('');
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // ── Re-assemble into the cache structure ─────────────────────────────
    const cache = {
        phrases: {},
        catLabels: {},
        uiValues: result.uiStrings,
        doctorPhrases: doctorPrompts.map((p, i) => ({
            icon: p.icon,
            text: result.doctorTexts[i] || p.text,
        })),
        doctorSourceTexts: currentDoctorTexts, // track what we translated
    };

    Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
        const [start, count] = phraseIndex[cat];
        cache.phrases[cat] = phrases.map((p, i) => ({
            icon: p.icon,
            text: result.phraseTexts[start + i] || p.text,
        }));
    });

    catKeys.forEach((key, i) => {
        cache.catLabels[key] = result.catKeys[i] || key;
    });

    translationCache[code] = cache;
    return cache;
}


// ─── APPLY / RESTORE ──────────────────────────────────────────────────────

function applyTranslation(cache) {
    // Phrase tiles
    Object.entries(cache.phrases).forEach(([cat, phrases]) => {
        categoryData[cat] = phrases;
    });

    // Category button labels
    categoryMeta.forEach(m => {
        if (m.key !== 'Doctor') {
            m._displayKey = cache.catLabels[m.key] || null;
        }
    });

    // Doctor prompts (translated)
    if (cache.doctorPhrases && cache.doctorPhrases.length > 0) {
        categoryData['Doctor'] = cache.doctorPhrases;
    }

    // Static UI strings
    applyUIStrings(cache.uiValues);

    // Refresh rendered components
    if (typeof updateKeyboardLabel === 'function') updateKeyboardLabel();
    if (typeof renderCategories   === 'function') renderCategories();
    if (typeof renderSuggestions  === 'function') renderSuggestions();
    if (typeof clearAISuggestions === 'function') clearAISuggestions();
    if (typeof buildKeyboard      === 'function' && typeof keyboardVisible !== 'undefined' && keyboardVisible) buildKeyboard();
}

function restoreEnglishUI() {
    // Reset phrases to original English
    Object.entries(originalCategoryData).forEach(([cat, phrases]) => {
        categoryData[cat] = phrases.map(p => ({ ...p }));
    });

    // Reset category display labels
    categoryMeta.forEach(m => { m._displayKey = null; });

    // Restore doctor prompts (English)
    if (typeof syncDoctorCategoryFull === 'function') syncDoctorCategoryFull();

    applyUIStrings(null);

    if (typeof updateKeyboardLabel === 'function') updateKeyboardLabel();
    if (typeof renderCategories   === 'function') renderCategories();
    if (typeof renderSuggestions  === 'function') renderSuggestions();
    if (typeof clearAISuggestions === 'function') clearAISuggestions();
    if (typeof buildKeyboard      === 'function' && typeof keyboardVisible !== 'undefined' && keyboardVisible) buildKeyboard();
}


// ─── UI STRING HELPERS ────────────────────────────────────────────────────

function applyUIStrings(v) {
    const s = v || UI_STRINGS_EN;
    const safe = i => s[i] || UI_STRINGS_EN[i];
    const el   = (sel, txt) => { const e = document.querySelector(sel); if (e) e.textContent = txt; };

    el('.message-section .section-label',    safe(0));
    el('.ai-section .section-label',         safe(1));

    const aiLbl = document.querySelector('.ai-label span:nth-child(2)');
    if (aiLbl) aiLbl.textContent = safe(2);

    const aiPh = document.querySelector('#aiSuggestions .ai-placeholder');
    if (aiPh) aiPh.textContent = safe(3);

    el('.suggestions-section .section-label',  safe(4));
    el('.categories-section .section-label',   safe(5));

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

    // Invalidate the cached doctor phrases so buildTranslationCache re-fetches them.
    if (translationCache[code]) {
        translationCache[code].doctorSourceTexts = null;
    }

    // Re-translate (only doctor section changes, but we reuse the full pipeline
    // so the cache stays consistent).
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
