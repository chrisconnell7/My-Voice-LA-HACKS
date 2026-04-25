// scripts/keyboard.js
// ─── KEYBOARD UI & LOGIC ──────────────────────────────────────────────────

window.keyboardVisible = false;
window.shiftOn = false;

const spaceLabels = ['space', 'espacio', 'espace', '空格'];

window.buildNumpad = () => {
    const grid = document.getElementById('numpadGrid');
    if (!grid) return;
    
    const numLayout = [['7','8','9'], ['4','5','6'], ['1','2','3'], ['.', '0', '⌫']];
    
    grid.innerHTML = numLayout.map(row => row.map(k => `
        <button class="numpad-key ${k === '⌫' ? 'numpad-action' : ''}" 
                onclick="window.handleKey('${k}')">${k}</button>
    `).join('')).join('');
};

window.buildKeyboard = () => {
    const container = document.getElementById('keyboardRows');
    if (!container) return;
    
    window.buildNumpad();
    
    const type = window.currentLang.keyboard || 'latin';
    const rows = window.keyboardLayouts[type] || window.keyboardLayouts.latin;
    
    container.innerHTML = rows.map(row => `
        <div class="keyboard-row">
            ${row.map(k => {
                // Ensure translated space bars still get the special styling
                const isSpecial = ['⌫', 'Shift', '✓'].includes(k) || spaceLabels.includes(k);
                return `
                    <button class="key ${isSpecial ? 'key-special' : ''}" 
                            onclick="window.handleKey('${k}')">${k}</button>
                `;
            }).join('')}
        </div>
    `).join('');
};


window.handleKey = (k) => {
    if (k === '⌫') { window.backspace(); return; }
    if (k === '✓') { window.speakMessage(); return; }
    if (k === 'Shift') { window.shiftOn = !window.shiftOn; window.buildKeyboard(); return; }
    
    // Check if the key pressed is one of our recognized space labels
    if (spaceLabels.includes(k) || k === ' ') {
        window.addToMessage(' '); 
        return;
    }

    // Normal character logic
    window.addToMessage(k);
};

window.toggleKeyboard = () => {
    window.keyboardVisible = !window.keyboardVisible;
    document.getElementById('keyboardSection').classList.toggle('open', window.keyboardVisible);
    document.getElementById('keyboardToggleBtn').classList.toggle('active', window.keyboardVisible);
    
// scripts/keyboard.js -> Inside window.toggleKeyboard

    if (window.keyboardVisible) {
        const kbNames = { latin: 'Latin/QWERTY', french: 'AZERTY', pinyin: 'Pinyin', spanish: 'Spanish' };
        const type = window.currentLang.keyboard || 'latin'; // Pulls from new currentLang
        const label = document.getElementById('keyboardLangLabel');
        if (label) {
            label.textContent = `${window.currentLang.flag} ${window.currentLang.english} — ${kbNames[type] || type}`;
        }
        window.buildKeyboard();
    }
};

// ─── TEXT TO SPEECH ───
window.speakMessage = () => {
    const text = window.getMessageContent();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = window.currentLang.tts;
    window.speechSynthesis.speak(utterance);
};