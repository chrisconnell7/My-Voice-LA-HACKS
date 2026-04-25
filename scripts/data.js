// scripts/data.js
// ─── UNIFIED STATE, CONFIG, AND TRANSLATIONS ─────────────────────────

window.categoryMeta = [
    { key: 'Doctor',    icon: '📝' }, { key: 'Medical',   icon: '➕' },
    { key: 'Feelings',  icon: '😊' }, { key: 'Needs',     icon: '👨‍👩‍👧' },
    { key: 'People',    icon: '👥' }, { key: 'Questions', icon: '💬' },
];

window.emojiOptions = ['🩺','💊','🩹','🧬','🔬','💉','🏥','❤️','🧠','🦷','👁️','👂'];

window.languages = [
    { code:'en-US', flag:'🇺🇸', native:'English', english:'English', tts:'en-US', keyboard:'latin' },
    { code:'es-US', flag:'🇲🇽', native:'Español', english:'Spanish', tts:'es-US', keyboard:'spanish' },
    { code:'zh-CN', flag:'🇨🇳', native:'中文 (拼音)', english:'Chinese', tts:'zh-CN', keyboard:'pinyin' },
];

window.keyboardLayouts = {
    latin: [['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l'], ['z','x','c','v','b','n','m','⌫'], ['space','✓']],
    spanish: [['q','w','e','r','t','y','u','i','o','p'], ['a','s','d','f','g','h','j','k','l','ñ'], ['z','x','c','v','b','n','m','⌫'], ['á','é','í','ó','ú','ü','espacio','✓']],
    pinyin: [['b','p','m','f','d','t','n','l','g','k'], ['h','j','q','x','zh','ch','sh','r','z','c'], ['s','y','w','a','o','e','i','u','ü','⌫'], ['ā','á','ǎ','à','ē','é','ě','è','ī','í','ǐ','ì','空格','✓']]
};
    
// Global App State
window.currentCategory = 'Feelings';
window.currentLang = window.languages[0];
window.doctorPrompts = [
    { icon: '🩺', text: 'Do you have chest pain?' },
    { icon: '💊', text: 'Are you taking your medication?' },
];
// Add this to the bottom of scripts/data.js
window.categoryData = {
    Doctor: window.doctorPrompts,
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
// Gemma Context (Used by Markov Engine)
window.gemmaContextWords = [];