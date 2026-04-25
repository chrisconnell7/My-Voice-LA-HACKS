// scripts/data.js
// ─── UNIFIED STATE, CONFIG, AND TRANSLATIONS ─────────────────────────

window.categoryData = window.categoryData || {};

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

window.staticTranslations = {
    'en-US': {
        ui: {
            "Message": "Message",
            "Speak": "Speak",
            "Keyboard": "Keyboard",
            "Settings": "Settings",
            "Help": "Help",
            "Doctor Prompts": "Doctor Prompts",
            "Select Language": "🌐 Select Language",
            "You might want to say...": "You might want to say...",
            "Start typing to see neural suggestions...": "Start typing to see neural suggestions...",
            "Categories": "Categories",
            "Back": "Back",
            "Clear": "Clear",
            // Category Names
            "Doctor": "Doctor",
            "Medical": "Medical",
            "Feelings": "Feelings",
            "Needs": "Needs",
            "People": "People",
            "Questions": "Questions",
            "Look at button at the bottom to select it": "Look at button at the bottom to select it"
        },
        categories: {
            Medical: [
                { icon: '🧍', text: "I'm in pain." },
                { icon: '💔', text: "I have chest pain." },
                { icon: '🤢', text: "I feel nauseous." },
                { icon: '😮‍💨', text: "I can't breathe well." },
                { icon: '🤕', text: "I have a headache." },
                { icon: '🤧', text: "I feel dizzy." },
                { icon: '💉', text: "I need pain relief." }
            ],
            Feelings: [
                { icon: '😕', text: "I'm uncomfortable." },
                { icon: '😢', text: "I'm sad." },
                { icon: '😟', text: "I'm anxious." },
                { icon: '😊', text: "I'm feeling okay." },
                { icon: '😴', text: "I'm tired." },
                { icon: '😣', text: "I'm in pain." },
                { icon: '😌', text: "I feel calm." }
            ],
            Needs: [
                { icon: '🖐️', text: "I need help." },
                { icon: '🥤', text: "I'm thirsty." },
                { icon: '🍽️', text: "I'm hungry." },
                { icon: '🛏️', text: "I need to rest." },
                { icon: '🚽', text: "I need to use the bathroom." },
                { icon: '🌡️', text: "Please be louder." },
                { icon: '🔕', text: "Please be quiet." },
                { icon: '🌡️', text: "Please change temperature." }
            ],
            People: [
                { icon: '👨‍⚕️', text: "I want to see the doctor." },
                { icon: '👩‍⚕️', text: "I want to see the nurse." },
                { icon: '👨‍👩‍👧', text: "I want to see my family." },
                { icon: '🧑‍🦯', text: "I need my caregiver." },
                { icon: '🤝', text: "Can someone stay with me?" }
            ],
            Questions: [
                { icon: '❓', text: "What is happening?" },
                { icon: '⏰', text: "When can I go home?" },
                { icon: '💊', text: "What is this medicine for?" },
                { icon: '🤷', text: "I don't understand." },
                { icon: '🗣️', text: "Can you explain that again?" },
                { icon: '🔄', text: "What's next?" }
            ]
        }
    },
    'es-US': {
        ui: {
            "Message": "Mensaje",
            "Speak": "Hablar",
            "Keyboard": "Teclado",
            "Settings": "Ajustes",
            "Help": "Ayuda",
            "Doctor Prompts": "Frases Médicas",
            "Select Language": "🌐 Seleccionar Idioma",
            "You might want to say...": "Tal vez quieras decir...",
            "Start typing to see neural suggestions...": "Escribe para ver sugerencias...",
            "Categories": "Categorías",
            "Back": "Atrás",
            "Clear": "Borrar",
            // Category Names
            "Doctor": "Médico",
            "Medical": "Salud",
            "Feelings": "Sentimientos",
            "Needs": "Necesidades",
            "People": "Personas",
            "Questions": "Preguntas",
            "Look at button at the bottom to select it": "Mira el botón en la parte inferior para seleccionarlo"
        },
        categories: {
            Medical: [
                { icon: '🧍', text: "Tengo dolor." },
                { icon: '💔', text: "Me duele el pecho." },
                { icon: '🤢', text: "Tengo náuseas." },
                { icon: '😮‍💨', text: "No puedo respirar bien." },
                { icon: '🤕', text: "Tengo dolor de cabeza." },
                { icon: '🤧', text: "Me siento mareado." },
                { icon: '💉', text: "Necesito un analgésico." }
            ],
            Feelings: [
                { icon: '😕', text: "Estoy incómodo." },
                { icon: '😢', text: "Estoy triste." },
                { icon: '😟', text: "Tengo ansiedad." },
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
                { icon: '🚽', text: "Necesito ir al baño." },
                { icon: '🌡️', text: "Por favor, hable más fuerte." },
                { icon: '🔕', text: "Por favor, guarde silencio." },
                { icon: '🌡️', text: "Por favor, cambie la temperatura." }
            ],
            People: [
                { icon: '👨‍⚕️', text: "Quiero ver al médico." },
                { icon: '👩‍⚕️', text: "Quiero ver a la enfermera." },
                { icon: '👨‍👩‍👧', text: "Quiero ver a mi familia." },
                { icon: '🧑‍🦯', text: "Necesito a mi cuidador." },
                { icon: '🤝', text: "¿Puede alguien quedarse conmigo?" }
            ],
            Questions: [
                { icon: '❓', text: "¿Qué está pasando?" },
                { icon: '⏰', text: "¿Cuándo puedo ir a casa?" },
                { icon: '💊', text: "¿Para qué es esta medicina?" },
                { icon: '🤷', text: "No entiendo." },
                { icon: '🗣️', text: "¿Puede explicarlo de nuevo?" },
                { icon: '🔄', text: "¿Qué sigue?" }
            ]
        }
    },
    'zh-CN': {
        ui: {
            "Message": "信息",
            "Speak": "说话",
            "Keyboard": "键盘",
            "Settings": "设置",
            "Help": "帮助",
            "Doctor Prompts": "医生提示",
            "Select Language": "🌐 选择语言",
            "You might want to say...": "你可能想说...",
            "Start typing to see neural suggestions...": "开始输入以查看建议...",
            "Categories": "类别",
            "Back": "返回",
            "Clear": "清除",
            // Category Names
            "Doctor": "医生",
            "Medical": "医疗",
            "Feelings": "感觉",
            "Needs": "需求",
            "People": "人物",
            "Questions": "问题",
            "Look at button at the bottom to select it": "看底部的按钮来选择它"
        },
        categories: {
            Medical: [
                { icon: '🧍', text: "我很痛。" },
                { icon: '💔', text: "我胸痛。" },
                { icon: '🤢', text: "我想吐。" },
                { icon: '😮‍💨', text: "我呼吸困难。" },
                { icon: '🤕', text: "我头痛。" },
                { icon: '🤧', text: "我头晕。" },
                { icon: '💉', text: "我需要止痛药。" }
            ],
            Feelings: [
                { icon: '😕', text: "我不舒服。" },
                { icon: '😢', text: "我很难过。" },
                { icon: '😟', text: "我很焦虑。" },
                { icon: '😊', text: "我感觉还可以。" },
                { icon: '😴', text: "我很累。" },
                { icon: '😣', text: "我很痛。" },
                { icon: '😌', text: "我很平静。" }
            ],
            Needs: [
                { icon: '🖐️', text: "我需要帮助。" },
                { icon: '🥤', text: "我渴了。" },
                { icon: '🍽️', text: "我饿了。" },
                { icon: '🛏️', text: "我需要休息。" },
                { icon: '🚽', text: "我需要去洗手间。" },
                { icon: '🌡️', text: "请大声一点。" },
                { icon: '🔕', text: "请安静。" },
                { icon: '🌡️', text: "请调整温度。" }
            ],
            People: [
                { icon: '👨‍⚕️', text: "我想看医生。" },
                { icon: '👩‍⚕️', text: "我想看护士。" },
                { icon: '👨‍👩‍👧', text: "我想见我的家人。" },
                { icon: '🧑‍🦯', text: "我需要我的看护人。" },
                { icon: '🤝', text: "有人可以陪我吗？" }
            ],
            Questions: [
                { icon: '❓', text: "发生什么事了？" },
                { icon: '⏰', text: "我什么时候可以回家？" },
                { icon: '💊', text: "这个药是做什么用的？" },
                { icon: '🤷', text: "我不明白。" },
                { icon: '🗣️', text: "你能再解释一遍吗？" },
                { icon: '🔄', text: "接下来是什么？" }
            ]
        }
    }
};