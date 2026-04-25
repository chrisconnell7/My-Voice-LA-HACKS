// data.js
// ─── STATIC DATA & GLOBAL STATE ──────────────────────────────────────────

const categoryData = {
    Doctor: [],
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
    { key: 'Doctor',    icon: '📝' },
    { key: 'Medical',   icon: '➕' },
    { key: 'Feelings',  icon: '😊' },
    { key: 'Needs',     icon: '👨‍👩‍👧' },
    { key: 'People',    icon: '👥' },
    { key: 'Questions', icon: '💬' },
];

const emojiOptions = ['🩺','💊','🩹','🧬','🔬','💉','🏥','❤️','🧠','🦷','👁️','👂'];

const keyboardLayouts = {
    latin: [
        ['Q','W','E','R','T','Y','U','I','O','P'],
        ['A','S','D','F','G','H','J','K','L'],
        ['Z','X','C','V','B','N','M','⌫'],
        [' ','✓']
    ],
    spanish: [
        ['Q','W','E','R','T','Y','U','I','O','P'],
        ['A','S','D','F','G','H','J','K','L','Ñ'],
        ['Z','X','C','V','B','N','M','⌫'],
        ['Á','É','Í','Ó','Ú','Ü',' ','✓']
    ],
    pinyin: [
        ['b','p','m','f','d','t','n','l','g','k'],
        ['h','j','q','x','zh','ch','sh','r','z','c'],
        ['s','y','w','a','o','e','i','u','ü','⌫'],
        ['ā','á','ǎ','à','ē','é','ě','è','ī','í','ǐ','ì',' ','✓']
    ]
};

const languages = [
    { code:'en-US', flag:'🇺🇸', native:'English',        english:'English',            tts:'en-US',  keyboard:'latin'   },
    { code:'es-US', flag:'🇲🇽', native:'Español',        english:'Spanish',            tts:'es-US',  keyboard:'spanish' },
    { code:'zh-CN', flag:'🇨🇳', native:'中文 (拼音)',     english:'Chinese (Pinyin)',    tts:'zh-CN',  keyboard:'pinyin'  },
];

// Global State
let currentCategory = 'Feelings';
let doctorPrompts = [
    { icon: '🩺', text: 'Do you have chest pain?' },
    { icon: '💊', text: 'Are you taking your medication?' },
    { icon: '🤢', text: 'Do you feel nauseous?' },
];
let selectedEmojiIndex = 0;
let keyboardVisible = false;
let shiftOn = false;
let currentLang = languages[0];
let pendingLang = languages[0];
let activeRegion = 'All';
let menuOpen = false;