// scripts/data.js
// ─── UNIFIED STATE, CONFIG, AND TRANSLATIONS ─────────────────────────

window.categoryData = window.categoryData || {};

window.categoryMeta = [
    { key: 'Doctor',    icon: '📝' },
    { key: 'QuickWords',icon: '⚡' },
    { key: 'Medical',   icon: '➕' },
    { key: 'Feelings',  icon: '😊' }, 
    { key: 'Needs',     icon: '👨‍👩‍👧' },
    { key: 'People',    icon: '👥' }, 
    { key: 'Questions', icon: '💬' },
    { key: 'Transcription', icon: '📡' },
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
window.currentCategory = 'Quickwords';
window.currentLang = window.languages[0];
window.doctorPrompts = [
    { icon: '🩺', text: 'Do you have chest pain?' },
    { icon: '💊', text: 'Are you taking your medication?' },
];

// Global Transcription State
window.fullTranscriptHistory = [];
window.maxTranscriptionPhrases = 10; // Keep only latest 10 phrases
// window.autoListenInterval = 10000;   // 10 seconds default


// Gemma Context (Used by Markov Engine)
window.gemmaContextWords = [];

window.staticTranslations = {
    'en-US': {
        ui: {
            "My Voice": "My Voice",
            "Message": "Message", 
            "Speak": "Speak", 
            "Keyboard": "Keyboard", 
            "Settings": "Settings", 
            "Help": "Help", 
            "Doctor Prompts": "Doctor Prompts", 
            "Select Language": "🌐 Select Language", 
            "You might want to say": "You might want to say", 
            "AI suggested Continuations": "AI Suggested Continuations",
            "Start typing or selecting phrases to see AI suggestions...": "Start typing or selecting phrases to see AI suggestions...", 
            "Suggestions based on your message": "Suggestions based on your message",
            "Browse by category": "Browse by category", 
            "Back": "Back", 
            "Clear": "Clear", 
            "Eye Tracking Active": "Eye Tracking Active",
            "Navigation": "Navigation",
            "Look at button at the bottom to select it": "Look at button at the bottom to select it",
            // Category Names
            "QuickWords": "QuickWords", "Doctor": "Doctor", "Medical": "Medical", "Feelings": "Feelings", "Needs": "Needs", "People": "People", "Questions": "Questions"
        },
        categories: {
            QuickWords: [
                { icon: '👍', text: "Yes" }, { icon: '👎', text: "No" }, { icon: '🛑', text: "Stop" },
                { icon: '⏳', text: "Wait" }, { icon: '🙏', text: "Thank you" }, { icon: '🤷', text: "I don't know" }
            ],
            Medical: [
                { icon: '😣', text: "Pain" }, { icon: '😮‍💨', text: "Breathe" }, { icon: '🤢', text: "Nausea" },
                { icon: '🤧', text: "Dizzy" }, { icon: '🫀', text: "Chest" }, { icon: '🤕', text: "Head" },
                { icon: '💊', text: "Medicine" }, { icon: '🩻', text: "Scan" }
            ],
            Needs: [
                { icon: '🚽', text: "Bathroom" }, { icon: '💧', text: "Water" }, { icon: '🛏️', text: "Bed" },
                { icon: '🥶', text: "Cold" }, { icon: '🥵', text: "Hot" }, { icon: '痒', text: "Itch" },
                { icon: '👓', text: "Glasses" }, { icon: '📱', text: "Phone" }
            ],
            Feelings: [
                { icon: '😟', text: "Anxious" }, { icon: '😨', text: "Scared" }, { icon: '😠', text: "Frustrated" },
                { icon: '😕', text: "Confused" }, { icon: '😴', text: "Tired" }, { icon: '😌', text: "Comfortable" }
            ],
            People: [
                { icon: '👩‍⚕️', text: "Nurse" }, { icon: '👨‍⚕️', text: "Doctor" }, { icon: '👨‍👩‍👧', text: "Family" },
                { icon: '🧑‍🦯', text: "Therapist" }, { icon: '⛪', text: "Chaplain" }
            ],
            Questions: [
                { icon: '❓', text: "What is happening?" }, { icon: '⏰', text: "When?" }, { icon: '🏠', text: "Go home?" },
                { icon: '📊', text: "Results?" }, { icon: '🗣️', text: "Explain" }
            ]
        }
    },
    'es-US': {
        ui: {
            "My Voice": "Mi Voz",
            "Message": "Mensaje", 
            "Speak": "Hablar", 
            "Keyboard": "Teclado", 
            "Settings": "Ajustes", 
            "Help": "Ayuda", 
            "Doctor Prompts": "Frases Médicas", 
            "Select Language": "🌐 Seleccionar Idioma", 
            "You might want to say": "Tal vez quieras decir", 
            "AI suggested Continuations": "Continuaciones sugeridas por IA",
            "Start typing or selecting phrases to see AI suggestions...": "Escribe o selecciona frases para ver sugerencias de IA...", 
            "Suggestions based on your message": "Sugerencias basadas en tu mensaje",
            "Browse by category": "Navegar por categoría", 
            "Back": "Atrás", 
            "Clear": "Borrar", 
            "Eye Tracking Active": "Seguimiento Ocular Activo",
            "Navigation": "Navegación",
            "Look at button at the bottom to select it": "Mira el botón en la parte inferior para seleccionarlo",
            // Category Names
            "QuickWords": "Rápidas", "Doctor": "Médico", "Medical": "Salud", "Feelings": "Sentimientos", "Needs": "Necesidades", "People": "Personas", "Questions": "Preguntas"
        },
        categories: {
            QuickWords: [
                { icon: '👍', text: "Sí" }, { icon: '👎', text: "No" }, { icon: '🛑', text: "Para" },
                { icon: '⏳', text: "Espera" }, { icon: '🙏', text: "Gracias" }, { icon: '🤷', text: "No sé" }
            ],
            Medical: [
                { icon: '😣', text: "Dolor" }, { icon: '😮‍💨', text: "Respirar" }, { icon: '🤢', text: "Náuseas" },
                { icon: '🤧', text: "Mareo" }, { icon: '🫀', text: "Pecho" }, { icon: '🤕', text: "Cabeza" },
                { icon: '💊', text: "Medicina" }, { icon: '🩻', text: "Examen" }
            ],
            Needs: [
                { icon: '🚽', text: "Baño" }, { icon: '💧', text: "Agua" }, { icon: '🛏️', text: "Cama" },
                { icon: '🥶', text: "Frío" }, { icon: '🥵', text: "Calor" }, { icon: '痒', text: "Picazón" },
                { icon: '👓', text: "Gafas" }, { icon: '📱', text: "Teléfono" }
            ],
            Feelings: [
                { icon: '😟', text: "Ansiedad" }, { icon: '😨', text: "Miedo" }, { icon: '😠', text: "Frustrado" },
                { icon: '😕', text: "Confundido" }, { icon: '😴', text: "Cansado" }, { icon: '😌', text: "Cómodo" }
            ],
            People: [
                { icon: '👩‍⚕️', text: "Enfermera" }, { icon: '👨‍⚕️', text: "Médico" }, { icon: '👨‍👩‍👧', text: "Familia" },
                { icon: '🧑‍🦯', text: "Terapeuta" }, { icon: '⛪', text: "Capellán" }
            ],
            Questions: [
                { icon: '❓', text: "¿Qué pasa?" }, { icon: '⏰', text: "¿Cuándo?" }, { icon: '🏠', text: "¿Ir a casa?" },
                { icon: '📊', text: "¿Resultados?" }, { icon: '🗣️', text: "Explica" }
            ]
        }
    },
    'zh-CN': {
        ui: {
            "My Voice": "我的声音",
            "Message": "信息", 
            "Speak": "说话", 
            "Keyboard": "键盘", 
            "Settings": "设置", 
            "Help": "帮助", 
            "Doctor Prompts": "医生提示", 
            "Select Language": "🌐 选择语言", 
            "You might want to say": "你可能想说", 
            "AI suggested Continuations": "AI 建议的延续",
            "Start typing or selecting phrases to see AI suggestions...": "开始输入或选择短语以查看 AI 建议...", 
            "Suggestions based on your message": "基于您的信息的建议",
            "Browse by category": "按类别浏览", 
            "Back": "返回", 
            "Clear": "清除", 
            "Eye Tracking Active": "眼动追踪已激活",
            "Navigation": "导航",
            "Look at button at the bottom to select it": "查看底部的按钮以选择它",
            // Category Names
            "QuickWords": "常用词", "Doctor": "医生", "Medical": "医疗", "Feelings": "感觉", "Needs": "需求", "People": "人物", "Questions": "问题"
        },
        categories: {
            QuickWords: [
                { icon: '👍', text: "是" }, { icon: '👎', text: "不是" }, { icon: '🛑', text: "停" },
                { icon: '⏳', text: "等一下" }, { icon: '🙏', text: "谢谢" }, { icon: '🤷', text: "不知道" }
            ],
            Medical: [
                { icon: '😣', text: "痛" }, { icon: '😮‍💨', text: "呼吸" }, { icon: '🤢', text: "恶心" },
                { icon: '🤧', text: "头晕" }, { icon: '🫀', text: "胸" }, { icon: '🤕', text: "头" },
                { icon: '💊', text: "药" }, { icon: '🩻', text: "检查" }
            ],
            Needs: [
                { icon: '🚽', text: "洗手间" }, { icon: '💧', text: "水" }, { icon: '🛏️', text: "床" },
                { icon: '🥶', text: "冷" }, { icon: '🥵', text: "热" }, { icon: '痒', text: "痒" },
                { icon: '👓', text: "眼镜" }, { icon: '📱', text: "手机" }
            ],
            Feelings: [
                { icon: '😟', text: "焦虑" }, { icon: '😨', text: "害怕" }, { icon: '😠', text: "沮丧" },
                { icon: '😕', text: "困惑" }, { icon: '😴', text: "累" }, { icon: '😌', text: "舒服" }
            ],
            People: [
                { icon: '👩‍⚕️', text: "护士" }, { icon: '👨‍⚕️', text: "医生" }, { icon: '👨‍👩‍👧', text: "家人" },
                { icon: '🧑‍🦯', text: "治疗师" }, { icon: '⛪', text: "牧师" }
            ],
            Questions: [
                { icon: '❓', text: "怎么了？" }, { icon: '⏰', text: "什么时候？" }, { icon: '🏠', text: "回家？" },
                { icon: '📊', text: "结果？" }, { icon: '🗣️', text: "解释" }
            ]
        }
    }
};

// 1. Load the English defaults automatically on startup
window.categoryData = { ...window.staticTranslations['en-US'].categories };

// 2. Initialize the Doctor category with any saved custom prompts
window.categoryData['Doctor'] = window.doctorPrompts || [];