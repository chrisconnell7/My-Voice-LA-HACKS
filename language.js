// language.js
// ─── STATIC TRANSLATION DICTIONARY ────────────────────────────────────────

const staticTranslations = {
    'en-US': {
        ui: {
            "My Voice": "My Voice",
            "Eye Tracking Active": "Eye Tracking Active",
            "Keyboard": "Keyboard",
            "Message": "Message",
            "Speak": "Speak",
            "Select Language": "🌐 Select Language",
            "Doctor Prompts": "Doctor Prompts",
            "Settings": "Settings",
            "Help": "Help",
            "You might want to say...": "You might want to say...",
            "Categories": "Categories",
            "Start typing to see neural suggestions...": "Start typing to see neural suggestions...",
            "Back": "Back",
            "Clear": "Clear"
        },
        // English defaults to the original categoryData in data.js
    },
    'es-US': {
        ui: {
            "My Voice": "Mi Voz",
            "Eye Tracking Active": "Seguimiento Ocular Activo",
            "Keyboard": "Teclado",
            "Message": "Mensaje",
            "Speak": "Hablar",
            "Select Language": "🌐 Seleccionar Idioma",
            "Doctor Prompts": "Frases Médicas",
            "Settings": "Ajustes",
            "Help": "Ayuda",
            "You might want to say...": "Tal vez quieras decir...",
            "Categories": "Categorías",
            "Start typing to see neural suggestions...": "Escribe para ver sugerencias...",
            "Back": "Atrás",
            "Clear": "Borrar"
        },
        categories: {
            Medical: [
                { icon: '🧍', text: "Tengo dolor." },
                { icon: '💔', text: "Tengo dolor en el pecho." },
                { icon: '🤢', text: "Tengo náuseas." },
                { icon: '😮‍💨', text: "No puedo respirar bien." },
                { icon: '🤕', text: "Me duele la cabeza." },
                { icon: '🤧', text: "Me siento mareado." },
                { icon: '💉', text: "Necesito un analgésico." }
            ],
            Feelings: [
                { icon: '😕', text: "Estoy incómodo." },
                { icon: '😢', text: "Estoy triste." },
                { icon: '😟', text: "Estoy ansioso." },
                { icon: '😊', text: "Me siento bien." },
                { icon: '😴', text: "Estoy cansado." },
                { icon: '😣', text: "Tengo dolor." },
                { icon: '😌', text: "Me siento tranquilo." }
            ],
            Needs: [
                { icon: '🖐️', text: "Necesito ayuda." },
                { icon: '🥤', text: "Tengo sed." },
                { icon: '🍽️', text: "Tengo hambre." },
                { icon: '🛏️', text: "Necesito descansar." },
                { icon: '🚽', text: "Necesito usar el baño." }
            ]
        }
    },
    'zh-CN': {
        ui: {
            "My Voice": "我的声音",
            "Eye Tracking Active": "眼动追踪开启",
            "Keyboard": "键盘",
            "Message": "信息",
            "Speak": "说话",
            "Select Language": "🌐 选择语言",
            "Doctor Prompts": "医生提示",
            "Settings": "设置",
            "Help": "帮助",
            "You might want to say...": "你可能想说...",
            "Categories": "类别",
            "Start typing to see neural suggestions...": "开始输入以查看建议...",
            "Back": "退格",
            "Clear": "清除"
        },
        categories: {
            Medical: [
                { icon: '🧍', text: "我很痛。" },
                { icon: '💔', text: "我胸痛。" },
                { icon: '🤢', text: "我觉得恶心。" },
                { icon: '😮‍💨', text: "我呼吸不畅。" },
                { icon: '🤕', text: "我头痛。" },
                { icon: '🤧', text: "我觉得头晕。" },
                { icon: '💉', text: "我需要止痛药。" }
            ],
            Feelings: [
                { icon: '😕', text: "我不舒服。" },
                { icon: '😢', text: "我很伤心。" },
                { icon: '😟', text: "我很焦虑。" },
                { icon: '😊', text: "我感觉很好。" },
                { icon: '😴', text: "我很累。" },
                { icon: '😣', text: "我很痛。" },
                { icon: '😌', text: "我觉得很平静。" }
            ],
            Needs: [
                { icon: '🖐️', text: "我需要帮助。" },
                { icon: '🥤', text: "我渴了。" },
                { icon: '🍽️', text: "我饿了。" },
                { icon: '🛏️', text: "我需要休息。" },
                { icon: '🚽', text: "我要上厕所。" }
            ]
        }
    }
};

// ─── LANGUAGE APPLICATION LOGIC ─────────────────────────────────────────────

function applyLanguage() {
    closeLangModal();
    const langCode = currentLang.code;
    
    // 1. Create a backup of the English defaults on the very first run
    if (!staticTranslations['en-US'].categories) {
        staticTranslations['en-US'].categories = {
            Medical: [...categoryData['Medical']],
            Feelings: [...categoryData['Feelings']],
            Needs: [...categoryData['Needs']]
        };
    }

    // Fallback to English dictionary if something breaks
    const dict = staticTranslations[langCode] || staticTranslations['en-US'];

    // 2. Safely apply categories for ALL languages (no more if/else block)
    categoryData['Medical'] = dict.categories.Medical;
    categoryData['Feelings'] = dict.categories.Feelings;
    categoryData['Needs'] = dict.categories.Needs;

    // 3. Re-render the grid if we are looking at a standard category
    if (currentCategory !== 'Doctor' && typeof renderSuggestions === 'function') {
        renderSuggestions();
    }

    // 4. Update all Static UI Elements tagged with .ui-text and data-en
    const uiElements = document.querySelectorAll('.ui-text');
    uiElements.forEach(el => {
        const englishKey = el.getAttribute('data-en');
        if (dict.ui[englishKey]) {
            el.textContent = dict.ui[englishKey];
        } else if (langCode === 'en-US') {
            // Restore English
            el.textContent = englishKey;
        }
    });

    // 5. Update the Keyboard Layout
    if (typeof keyboardVisible !== 'undefined' && keyboardVisible) {
        if (typeof updateKeyboardLabel === 'function') updateKeyboardLabel();
        if (typeof buildKeyboard === 'function') buildKeyboard();
    }
}
// ─── LANGUAGE MODAL UI LOGIC ─────────────────────────────────────────────

// We removed the duplicate "let currentLang" declaration here. 
// It safely relies on the one already defined in data.js!

function openLangModal() {
    const searchInput = document.getElementById('langSearch');
    if (searchInput) searchInput.value = '';
    
    // Fallback just in case currentLang was somehow lost
    if (typeof currentLang === 'undefined' || !currentLang) {
        window.currentLang = languages[0];
    }

    renderLanguageList();
    document.getElementById('langModal').classList.add('open');
}

function closeLangModal() {
    document.getElementById('langModal').classList.remove('open');
}

function renderLanguageList(filterText = '') {
    const list = document.getElementById('langList');
    if (!list) return;
    list.innerHTML = '';
    
    const term = filterText.toLowerCase();
    
    // Filter the 3 languages based on the search box
    const filtered = languages.filter(l => 
        l.native.toLowerCase().includes(term) || 
        l.english.toLowerCase().includes(term)
    );

    // Draw the buttons for each language
    filtered.forEach(lang => {
        const div = document.createElement('div');
        // Highlight the currently selected language
        const isSelected = (typeof currentLang !== 'undefined' && currentLang.code === lang.code);
        div.className = 'lang-item' + (isSelected ? ' selected' : '');
        div.style.padding = '15px';
        div.style.margin = '10px 0';
        div.style.borderRadius = '10px';
        div.style.border = '1px solid #eee';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '15px';
        div.style.fontSize = '18px';
        
        div.innerHTML = `<span style="font-size: 24px;">${lang.flag}</span> <span style="font-weight: 600;">${lang.native} (${lang.english})</span>`;
        
        // When clicked, update the global currentLang variable and redraw
        div.onclick = () => {
            currentLang = lang;
            renderLanguageList(filterText); 
        };
        
        list.appendChild(div);
    });
}

function filterLanguages() {
    const searchInput = document.getElementById('langSearch');
    if (searchInput) {
        renderLanguageList(searchInput.value);
    }
}