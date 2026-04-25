// keyboard.js
// ─── KEYBOARD UI & LOGIC ──────────────────────────────────────────────────

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
    if (!container) return;
    
    container.innerHTML = '';
    buildNumpad();

    // This dynamically gets 'pinyin', 'spanish', etc., from currentLang
    const rows = getKeyboardLayout(); 
    
    rows.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';
        
        row.forEach(k => {
            const key = document.createElement('button');
            key.className = 'key';
            
            // Highlight special action keys
            if (['⌫', 'Shift', 'Space', '✓'].includes(k)) {
                key.classList.add('key-special');
            }

            key.textContent = k;
            key.onclick = () => handleKey(k);
            rowDiv.appendChild(key);
        });
        container.appendChild(rowDiv);
    });
}

function handleKey(k) {
    if (k === '⌫') { backspace(); return; }
    if (k === '✓') { speakMessage(); return; }
    if (k === 'Shift') { shiftOn = !shiftOn; buildKeyboard(); return; }
    if (k === 'Space') { k = ' '; }

    const current = getMessageContent();
    
    // Append the character (the layouts in data.js already contain the accents/symbols)
    setMessageContent(current + k);
    
    // Trigger AI prediction for the new language
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