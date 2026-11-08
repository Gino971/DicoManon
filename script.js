// Script for user-fed French→Italian dictionary and simple quiz

// storage for translation groups. Each entry contains a set of French words and a set of Italian words
// all combinations of one member of the French set with one member of the Italian set are considered
// valid translations. Existing data from the old pair-based format will be converted on load.
const dictionary = [
    {
        fr: new Set(['bonjour']),
        it: new Set(['ciao'])
    },
    {
        fr: new Set(['au revoir']),
        it: new Set(['arrivederci'])
    },
    {
        fr: new Set(['merci']),
        it: new Set(['grazie'])
    },
    {
        fr: new Set(['s’il vous plaît']),
        it: new Set(['per favore'])
    },
    {
        fr: new Set(['oui']),
        it: new Set(['sì'])
    },
    {
        fr: new Set(['non']),
        it: new Set(['no'])
    },
    {
        fr: new Set(['amour']),
        it: new Set(['amore'])
    },
    {
        fr: new Set(['ami']),
        it: new Set(['amico'])
    },
    {
        fr: new Set(['famille']),
        it: new Set(['famiglia'])
    },
    {
        fr: new Set(['eau']),
        it: new Set(['acqua'])
    },
    {
        fr: new Set(['pain']),
        it: new Set(['pane'])
    },
    {
        fr: new Set(['fromage']),
        it: new Set(['formaggio'])
    },
    {
        fr: new Set(['vin']),
        it: new Set(['vino'])
    },
    {
        fr: new Set(['chien']),
        it: new Set(['cane'])
    },
    {
        fr: new Set(['chat']),
        it: new Set(['gatto'])
    },
    {
        fr: new Set(['maison']),
        it: new Set(['casa'])
    },
    {
        fr: new Set(['voiture']),
        it: new Set(['auto'])
    },
    {
        fr: new Set(['soleil']),
        it: new Set(['sole'])
    },
    {
        fr: new Set(['lune']),
        it: new Set(['luna'])
    },
    {
        fr: new Set(['école']),
        it: new Set(['scuola'])
    }
];

// Capacitor filesystem helpers (Android/iOS)
function getFsPlugin() {
    return window.Capacitor && window.Capacitor.Plugins
        ? window.Capacitor.Plugins.Filesystem
        : null;
}

function getFilePickerPlugin() {
    if (!window.Capacitor || !window.Capacitor.Plugins) return null;
    // Capawesome plugin is exposed as FilePicker in Capacitor plugins.
    return window.Capacitor.Plugins.FilePicker || null;
}

function isNativeCapacitor() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
}

function getFsDocumentsDirectory(fs) {
    // Capacitor enums may not be exposed in the same place depending on build setup.
    if (fs && fs.Directory && fs.Directory.Documents) return fs.Directory.Documents;
    return 'DOCUMENTS';
}

async function ensureFsPermissions(fs) {
    if (!fs || typeof fs.requestPermissions !== 'function') return;
    try {
        await fs.requestPermissions();
    } catch (e) {
        console.warn('filesystem permission request failed', e);
    }
}

function parseJsonTextOrBase64(textOrBase64) {
    if (typeof textOrBase64 !== 'string') return null;
    try {
        return JSON.parse(textOrBase64);
    } catch (_e) {
        try {
            return JSON.parse(atob(textOrBase64));
        } catch (_e2) {
            return null;
        }
    }
}


// persistence helpers -----------------------------------------------------

// convert an array-of-objects representation into internal dictionary groups,
// merging any overlaps.  used when loading full state from storage.
function applyArray(arr) {
    if (!Array.isArray(arr)) return false;
    const newGroups = [];
    arr.forEach(item => {
        if (item && item.fr !== undefined && item.it !== undefined) {
            let frSet, itSet;
            if (typeof item.fr === 'string') frSet = new Set([item.fr]);
            else if (Array.isArray(item.fr)) frSet = new Set(item.fr);
            else frSet = new Set();

            if (typeof item.it === 'string') itSet = new Set([item.it]);
            else if (Array.isArray(item.it)) itSet = new Set(item.it);
            else itSet = new Set();

            newGroups.push({ fr: frSet, it: itSet });
        }
    });
    // merge overlaps
    function merge(list) {
        for (let i = 0; i < list.length; ++i) {
            for (let j = i + 1; j < list.length; ) {
                const g1 = list[i];
                const g2 = list[j];
                const overlap = [...g1.fr].some(w => g2.fr.has(w)) ||
                                [...g1.it].some(w => g2.it.has(w)) ||
                                [...g1.fr].some(w => g2.it.has(w)) ||
                                [...g1.it].some(w => g2.fr.has(w));
                if (overlap) {
                    g2.fr.forEach(w => g1.fr.add(w));
                    g2.it.forEach(w => g1.it.add(w));
                    list.splice(j, 1);
                } else {
                    j++;
                }
            }
        }
    }
    merge(newGroups);
    const allEmpty = newGroups.every(g => g.fr.size === 0 && g.it.size === 0);
    if (!allEmpty && newGroups.length) {
        dictionary.splice(0, dictionary.length, ...newGroups);
        return true;
    }
    return false;
}

function normalizeImportedPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.dictionary)) return payload.dictionary;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return null;
}

// import functionality removed – dictionary is now managed in-app or via export only.
async function loadDictionary() {
    let arr = null;

    // first, try Capacitor filesystem if available (Android/iOS external file)
    const fs = getFsPlugin();
    if (fs && fs.readFile) {
        try {
            await ensureFsPermissions(fs);
            const options = {
                path: 'DicoManon.json',
                directory: getFsDocumentsDirectory(fs)
            };
            const result = await fs.readFile(options);
            // result.data is base64-encoded by default on some platforms, try decode
            let text = result.data;
            try {
                // on Android it may already be plain text
                JSON.parse(text);
            } catch (_e) {
                // try decoding base64
                text = atob(result.data);
            }
            arr = normalizeImportedPayload(JSON.parse(text));
            console.log('loaded dictionary from Capacitor file');
        } catch (e) {
            // file may not exist or error; ignore and proceed to other methods
            console.warn('capacitor read failed', e);
        }
    }

    // try electron file storage next (desktop)
    if (!arr && window.electronAPI && window.electronAPI.readDictionary) {
        try {
            arr = await window.electronAPI.readDictionary();
        } catch (e) {
            console.error('error reading dictionary from file', e);
        }
    }

    // finally fallback to localStorage for web
    if (!arr) {
        const stored = localStorage.getItem('dictionary');
        if (stored) {
            try {
                arr = JSON.parse(stored);
            } catch (e) {
                console.error('failed to parse stored dictionary', e);
            }
        }
    }

    if (arr) {
        const applied = applyArray(arr);
        if (applied && window.electronAPI && window.electronAPI.writeDictionary) {
            // make sure file is up to date with whatever we just loaded
            window.electronAPI.writeDictionary(arr).catch(e => console.error('write error', e));
        }
        // also store into localStorage for web fallback
        try {
            localStorage.setItem('dictionary', JSON.stringify(arr));
        } catch (e) {}
    }
}

// if two groups share any word (in either language), merge them into one group
function mergeGroups() {
    for (let i = 0; i < dictionary.length; ++i) {
        for (let j = i + 1; j < dictionary.length; ) {
            const g1 = dictionary[i];
            const g2 = dictionary[j];
            const overlap = [...g1.fr].some(w => g2.fr.has(w)) ||
                            [...g1.it].some(w => g2.it.has(w)) ||
                            [...g1.fr].some(w => g2.it.has(w)) ||
                            [...g1.it].some(w => g2.fr.has(w));
            if (overlap) {
                // merge g2 into g1
                g2.fr.forEach(w => g1.fr.add(w));
                g2.it.forEach(w => g1.it.add(w));
                dictionary.splice(j, 1);
            } else {
                j++;
            }
        }
    }
}

function saveDictionary() {
    // convert sets back to arrays for storage
    const out = dictionary.map(g => ({ fr: [...g.fr], it: [...g.it] }));
    // always keep localStorage in sync for web builds or fallback
    try {
        localStorage.setItem('dictionary', JSON.stringify(out));
    } catch (e) {
        console.warn('could not save to localStorage', e);
    }

    // persist via Capacitor filesystem if possible (mobile persistent file)
    const fs = getFsPlugin();
    if (fs && fs.writeFile) {
        try {
            const json = JSON.stringify(out, null, 2);
            const options = {
                path: 'DicoManon.json',
                data: json,
                recursive: true,
                directory: getFsDocumentsDirectory(fs)
            };
            ensureFsPermissions(fs);
            fs.writeFile(options).catch(err => {
                console.error('capacitor write failed', err);
            });
        } catch (e) {
            console.error('error preparing capacitor write', e);
        }
    }

    // if electron API is available, persist to disk as well
    if (window.electronAPI && window.electronAPI.writeDictionary) {
        window.electronAPI.writeDictionary(out).catch(err => {
            console.error('failed to write dictionary file', err);
        });
    }
}

// ------------------------------------------------------------------------

// entry section elements
const frInput = document.getElementById('frWord');
const itInput = document.getElementById('itWord');
const addBtn = document.getElementById('addWord');
const entryMsg = document.getElementById('entryMessage');
const wordList = document.getElementById('wordList');
const listView = document.getElementById('listView');
const fullWordList = document.getElementById('fullWordList');
const closeListViewBtn = document.getElementById('closeListView');

// game section elements
const directionSelector = document.getElementById('direction');
const startBtn = document.getElementById('startGame');
const gamePlay = document.getElementById('gamePlay');
const questionEl = document.getElementById('question');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswer');
const gameMsg = document.getElementById('gameMessage');
const addTranslationBtn = document.getElementById('addTranslation');
const removeWordBtn = document.getElementById('removeWord');
const scoreEl = document.getElementById('score');
const totalEl = document.getElementById('total');
const scoreBar = document.getElementById('scoreBar');
const feedbackControls = document.getElementById('feedbackControls');
const endGameDialog = document.getElementById('endGameDialog');
const finalScore = document.getElementById('finalScore');
const restartGameBtn = document.getElementById('restartGameBtn');
const mainMenuBtn = document.getElementById('mainMenuBtn');

let currentWord = null;
let correct = 0;
let total = 0;
let answeredThisRound = false; // track whether current question has been answered

// generate a fun emoji based on performance
function scoreEmoji() {
    if (total === 0) return '';
    const ratio = correct / total;
    if (ratio === 1) return '🥳';
    if (ratio >= 0.75) return '😎';
    if (ratio >= 0.5) return '😄';
    if (ratio >= 0.25) return '😕';
    return '😢';
}

function updateScoreDisplay() {
    // Update score numbers
    scoreEl.textContent = correct;
    totalEl.textContent = total;
    
    // Update progress bar width
    if (total > 0) {
        const percentage = (correct / total) * 100;
        scoreBar.style.width = percentage + '%';
    } else {
        scoreBar.style.width = '0%';
    }
    
    // Add animation flash
    scoreBar.style.opacity = '0.8';
    setTimeout(() => {
        scoreBar.style.opacity = '1';
    }, 100);
}
let available = [];
let retryWords = [];
let currentDirection = 'fr-it'; // holds chosen direction
// sorting for full list view
let sortField = 'fr'; // 'fr' or 'it'
let sortAscending = true;

const wordStatsKey = 'wordAnswerStats';
let wordStats = {};
try {
    wordStats = JSON.parse(localStorage.getItem(wordStatsKey)) || {};
} catch (error) {
    console.warn('could not load word statistics', error);
}

function getWordStats(source, direction) {
    const key = JSON.stringify([direction, normalize(source)]);
    return wordStats[key] ?? { correct: 0, incorrect: 0 };
}

function recordAnswer({ source, direction }, isCorrect, acceptedTranslation = false) {
    const key = JSON.stringify([direction, normalize(source)]);
    const stats = getWordStats(source, direction);
    if (acceptedTranslation) stats.incorrect -= 1;
    stats[isCorrect ? 'correct' : 'incorrect'] += 1;
    wordStats[key] = stats;
    saveWordStats();
}

function saveWordStats() {
    try {
        localStorage.setItem(wordStatsKey, JSON.stringify(wordStats));
    } catch (error) {
        console.warn('could not save word statistics', error);
    }
}

function showWordStats(cell, words, direction) {
    for (const word of words) {
        const stats = getWordStats(word, direction);
        const line = document.createElement('div');
        line.textContent = `${word} · ✓ ${stats.correct} · ✗ ${stats.incorrect}`;
        cell.appendChild(line);
    }
}

function refreshWordList() {
    wordList.innerHTML = '';
    if (dictionary.length === 0) {
        const li = document.createElement('li');
        li.textContent = '(aucun mot)';
        wordList.appendChild(li);
        return;
    }
    dictionary.forEach(group => {
        const frList = Array.from(group.fr).join(', ');
        const itList = Array.from(group.it).join(', ');
        const li = document.createElement('li');
        li.textContent = `${frList} → ${itList}`;
        wordList.appendChild(li);
    });
}

function populateFullList() {
    const tbody = fullWordList.querySelector('tbody');
    tbody.innerHTML = '';
    // sort groups according to current settings
    const entries = dictionary.map((group, idx) => ({ group, idx }));
    entries.sort((a, b) => {
        let va, vb;
        if (sortField === 'fr') {
            va = [...a.group.fr].sort()[0] || '';
            vb = [...b.group.fr].sort()[0] || '';
        } else {
            va = [...a.group.it].sort()[0] || '';
            vb = [...b.group.it].sort()[0] || '';
        }
        // normalize for comparison (remove accents, lowercase)
        va = normalize(va);
        vb = normalize(vb);
        if (va < vb) return sortAscending ? -1 : 1;
        if (va > vb) return sortAscending ? 1 : -1;
        return 0;
    });
    entries.forEach(({ group, idx }) => {
        const tr = document.createElement('tr');
        const tdFr = document.createElement('td');
        showWordStats(tdFr, group.fr, 'fr-it');
        const tdIt = document.createElement('td');
        showWordStats(tdIt, group.it, 'it-fr');
        const tdActions = document.createElement('td');
        tdActions.className = 'table-actions';
        // edit button edits first entry for simplicity (convert to comma-separated inputs)
        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn list-action-btn';
        editBtn.title = 'Modifier';
        editBtn.innerHTML = '<span class="material-icons">edit</span>';
        editBtn.dataset.mode = 'edit';
        editBtn.addEventListener('click', () => {
            if (editBtn.dataset.mode === 'edit') {
                const currentFr = Array.from(group.fr).join(', ');
                const currentIt = Array.from(group.it).join(', ');
                tdFr.innerHTML = `<input type="text" class="row-edit" value="${currentFr}" placeholder="français" aria-label="français">`;
                tdIt.innerHTML = `<input type="text" class="row-edit" value="${currentIt}" placeholder="italien" aria-label="italien">`;
                editBtn.innerHTML = '<span class="material-icons">check</span>';
                editBtn.title = 'Enregistrer';
                editBtn.dataset.mode = 'save';
            } else {
                const inFr = tdFr.querySelector('input');
                const inIt = tdIt.querySelector('input');
                const frItems = inFr.value.split(',').map(s => s.trim()).filter(Boolean);
                const itItems = inIt.value.split(',').map(s => s.trim()).filter(Boolean);
                if (frItems.length && itItems.length) {
                    group.fr = new Set(frItems);
                    group.it = new Set(itItems);
                    saveDictionary();
                }
                refreshWordList();
                populateFullList();
            }
        });
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn list-action-btn';
        delBtn.title = 'Supprimer';
        delBtn.innerHTML = '<span class="material-icons">delete</span>';
        delBtn.addEventListener('click', () => {
            if (confirm(`Supprimer ce groupe de traductions ?`)) {
                dictionary.splice(idx, 1);
                saveDictionary();
                refreshWordList();
                populateFullList();
            }
        });
        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);
        tr.appendChild(tdFr);
        tr.appendChild(tdIt);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    });
}

// editing state
let editingIndex = null;

function resetEntryForm() {
    editingIndex = null;
    addBtn.textContent = '+';
    entryMsg.textContent = '';
}

addBtn.addEventListener('click', () => {
    const fr = frInput.value.trim();
    const it = itInput.value.trim();
    if (!fr || !it) {
        entryMsg.textContent = 'Les deux champs sont requis.';
        return;
    }
    // check duplicate pair
    if (pairExistsInGroups(fr, it)) {
        showTooltip(addBtn, 'Déjà présent');
        return;
    }
    if (editingIndex !== null) {
        // editing now updates an entire group; for simplicity just replace sets
        const parts = fr.split(',').map(s=>s.trim()).filter(Boolean);
        const partsIt = it.split(',').map(s=>s.trim()).filter(Boolean);
        dictionary[editingIndex].fr = new Set(parts);
        dictionary[editingIndex].it = new Set(partsIt);
        entryMsg.textContent = `Groupe modifié`;
    } else {
        // try to merge into existing group if either word already present
        let targetGroup = null;
        for (const g of dictionary) {
            if (setHas(g.fr, fr) || setHas(g.it, it) || setHas(g.fr, it) || setHas(g.it, fr)) {
                targetGroup = g;
                break;
            }
        }
        if (targetGroup) {
            addWordToGroup(targetGroup, 'fr', fr);
            addWordToGroup(targetGroup, 'it', it);
            entryMsg.textContent = `Ajouté aux traductions existantes`;
        } else {
            dictionary.push({ fr: new Set([fr]), it: new Set([it]) });
            entryMsg.textContent = `Nouveau mot : ${fr} → ${it}`;
        }
    }
    saveDictionary();
    refreshWordList();
    populateFullList();
    frInput.value = '';
    itInput.value = '';
    resetEntryForm();
});

// list toggle moved to toolbar
const toolbarListBtn = document.getElementById('listToggleToolbar');

function updateToggleButton() {
    if (!toolbarListBtn) return;
    if (wordList.classList.contains('hidden')) {
        toolbarListBtn.title = 'Afficher la liste';
    } else {
        toolbarListBtn.title = 'Masquer la liste';
    }
}

// initialisation après chargement
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadDictionary();
        refreshWordList();
        updateToggleButton();
        // export functionality has been removed per user request.
    // the quit button listener is attached later with the other control handlers
    // attach header click listeners for sorting
    const frHeader = fullWordList.querySelector('th:nth-child(1)');
    const itHeader = fullWordList.querySelector('th:nth-child(2)');
    if (frHeader) {
        frHeader.style.cursor = 'pointer';
        frHeader.addEventListener('click', () => {
            if (sortField === 'fr') sortAscending = !sortAscending;
            else { sortField = 'fr'; sortAscending = true; }
            populateFullList();
        });
    }
    if (itHeader) {
        itHeader.style.cursor = 'pointer';
        itHeader.addEventListener('click', () => {
            if (sortField === 'it') sortAscending = !sortAscending;
            else { sortField = 'it'; sortAscending = true; }
            populateFullList();
        });
    }
      // toolbar toggle must be set up after DOM loaded as well
      if (toolbarListBtn) {
          toolbarListBtn.addEventListener('click', () => {
              console.log('list toggle toolbar clicked');
              populateFullList();
              if (listView) {
                  listView.classList.remove('hidden');
              } else {
                  console.log('no listView element');
              }
              updateToggleButton();
          });
      }
    } catch (e) {
        console.error('error in DOMContentLoaded handler', e);
    }
});

closeListViewBtn && closeListViewBtn.addEventListener('click', () => {
    listView.classList.add('hidden');
});

// back navigation from game page
const backBtn = document.getElementById('backToMain');
backBtn && backBtn.addEventListener('click', () => {
    clearTimeout(autoNextTimer);
    const gamePage = document.getElementById('gamePage');
    const mainSection = document.getElementById('mainContent');
    if (gamePage) gamePage.classList.add('hidden');
    if (mainSection) mainSection.classList.remove('hidden');
    // reset game view
    gamePlay.classList.add('hidden');
    gameMsg.textContent = '';
    answerInput.value = '';
    // clear available to avoid accidental reuse
    available = [];
    retryWords = [];
});

startBtn.addEventListener('click', () => {
    if (dictionary.length === 0) {
        gameMsg.textContent = 'Veuillez ajouter au moins un mot avant de jouer.';
        return;
    }
    // reveal game page and hide main section
    const gamePage = document.getElementById('gamePage');
    const mainSection = document.getElementById('mainContent');
    if (gamePage) gamePage.classList.remove('hidden');
    if (mainSection) mainSection.classList.add('hidden');

    // build available list based on direction selection
    currentDirection = directionSelector.value;
    available = [];
    retryWords = [];
    dictionary.forEach(group => {
        if (currentDirection === 'fr-it' || currentDirection === 'random') {
            if (currentDirection !== 'it-fr') {
                group.fr.forEach(word => {
                    available.push({ source: word, group, direction: 'fr-it' });
                });
            }
        }
        if (currentDirection === 'it-fr' || currentDirection === 'random') {
            if (currentDirection !== 'fr-it') {
                group.it.forEach(word => {
                    available.push({ source: word, group, direction: 'it-fr' });
                });
            }
        }
    });
    // initialize game state
    correct = 0;
    total = 0;
    scoreEl.textContent = correct;
    totalEl.textContent = total;
    scoreBar.style.width = '0%';
    gameMsg.textContent = '';
    gamePlay.classList.remove('hidden');
    if (feedbackControls) feedbackControls.classList.remove('hidden');
    askNext();
});

// helper to remove the current pair and move on
function removeCurrentWord() {
    if (!currentWord) return;
    clearTimeout(autoNextTimer);
    const group = currentWord.group;
    if (!group) return;
    if (currentWord.direction === 'fr-it') {
        group.fr.delete(currentWord.source);
    } else {
        group.it.delete(currentWord.source);
    }
    // if either side becomes empty, remove entire group
    if (group.fr.size === 0 || group.it.size === 0) {
        dictionary.splice(dictionary.indexOf(group), 1);
        available = available.filter(word => word.group !== group);
        retryWords = retryWords.filter(word => word.group !== group);
    }
    retryWords = retryWords.filter(word => word.source !== currentWord.source ||
        word.direction !== currentWord.direction || word.group !== group);
    saveDictionary();
    refreshWordList();
    if (feedbackControls) feedbackControls.classList.add('hidden');
    if (removeWordBtn) removeWordBtn.classList.add('hidden');
    askNext();
}

function askNext() {
    answeredThisRound = false;
    submitAnswerBtn.disabled = false;

    if (available.length === 0 && retryWords.length > 0) {
        available = retryWords;
        retryWords = [];
    }
    if (available.length === 0) {
        currentWord = null;
        showEndGameDialog();
        return;
    }
    const weights = available.map(({ source, direction }) => {
        const { correct, incorrect } = getWordStats(source, direction);
        return 1 + 4 * incorrect / (correct + incorrect + 1);
    });
    let draw = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    const index = weights.findIndex(weight => (draw -= weight) < 0);
    currentWord = available.splice(index, 1)[0];
    // display question depending on direction
    if (currentWord.direction === 'fr-it') {
        document.getElementById('prompt').textContent = 'Traduire en italien :';
        document.getElementById('wordToTranslate').textContent = currentWord.source;
    } else {
        document.getElementById('prompt').textContent = 'Traduire en français :';
        document.getElementById('wordToTranslate').textContent = currentWord.source;
    }
    answerInput.value = '';
    answerInput.focus();
    // hide feedback area and other transient buttons
    gameMsg.textContent = '';
    addTranslationBtn.classList.add('hidden');
    if (feedbackControls) feedbackControls.classList.remove('hidden');
    if (removeWordBtn) {
        removeWordBtn.classList.remove('hidden');
        removeWordBtn.onclick = removeCurrentWord;
    }
}

// display end game dialog with final score and options
function showEndGameDialog() {
    gamePlay.classList.add('hidden');
    
    // Calculate performance emoji
    const emoji = scoreEmoji();
    
    // Format final score message
    const accuracyPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    finalScore.innerHTML = `<strong>${emoji} ${correct}/${total} correctes (${accuracyPercent}%)</strong>`;
    
    // Show dialog
    endGameDialog.classList.remove('hidden');
}

// helper to normalize strings: remove accents and lowercase
function normalize(str) {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// check if a set contains a word ignoring case/accents
function setHas(set, word) {
    const nw = normalize(word);
    for (const w of set) {
        if (normalize(w) === nw) return true;
    }
    return false;
}

// add word to specific side of group if not already present
function addWordToGroup(group, side, word) {
    const target = side === 'fr' ? group.fr : group.it;
    if (!setHas(target, word)) {
        target.add(word);
        return true;
    }
    return false;
}

// check if a specific pair already exists in any group
function pairExistsInGroups(fr, it) {
    return dictionary.some(g => setHas(g.fr, fr) && setHas(g.it, it));
}

// show a temporary tooltip near element
function showTooltip(el, msg) {
    const tip = document.createElement('div');
    tip.className = 'temp-tooltip';
    tip.textContent = msg;
    document.body.appendChild(tip);
    const rect = el.getBoundingClientRect();
    tip.style.top = `${rect.bottom + 4 + window.scrollY}px`;
    tip.style.left = `${rect.left + window.scrollX}px`;
    setTimeout(() => {
        tip.classList.add('fade');
        tip.addEventListener('transitionend', () => tip.remove());
    }, 1500);
}


// when user submits an answer, evaluate and (if correct) advance automatically
// after a short delay. a pending timer is cleared when navigating manually.
let autoNextTimer = null;
submitAnswerBtn.addEventListener('click', () => {
    if (answeredThisRound || !currentWord || gamePlay.classList.contains('hidden')) return;
    // clear any pending automatic advancement
    if (autoNextTimer) {
        clearTimeout(autoNextTimer);
        autoNextTimer = null;
    }
    const answer = answerInput.value.trim();
    if (!answer) {
        return;
    }

    // mark that the user has answered this round
    answeredThisRound = true;
    total += 1;
    const group = currentWord.group;
    // determine expected set depending on direction
    const expectedSet = currentWord.direction === 'fr-it' ? group.it : group.fr;
    let givenCorrect = [...expectedSet].some(w => normalize(w) === normalize(answer));
    recordAnswer(currentWord, givenCorrect);
    if (!givenCorrect && !currentWord.isRetry) {
        retryWords.push({ ...currentWord, isRetry: true });
    }
    if (givenCorrect) {
        correct += 1;
        gameMsg.textContent = 'Bonne réponse !';
        submitAnswerBtn.disabled = true; // prevent duplicate submissions
        // allow adding this translation if not already in group
        let source = currentWord.source;
        // show feedback controls
        if (feedbackControls) feedbackControls.classList.remove('hidden');
        const addedNew = addWordToGroup(group, currentWord.direction==='fr-it'?'it':'fr', answer);
        if (!addedNew) {
            // already present, hide button
            addTranslationBtn.classList.add('hidden');
        } else {
            entryMsg.textContent = `Ajouté : ${answer}`;
            saveDictionary();
            refreshWordList();
            addTranslationBtn.classList.add('hidden');
            if (feedbackControls) feedbackControls.classList.add('hidden');
            if (removeWordBtn) removeWordBtn.classList.add('hidden');
        }
        // advance after 1.2 seconds regardless of whether a word was added
        autoNextTimer = setTimeout(() => {
            askNext();
            autoNextTimer = null;
        }, 1200);
    } else {
        // wrong answer: show correct translations from expectedSet
        let questionWord = currentWord.source;
        const unique = [...new Set([...expectedSet])];
        const transStr = unique.join(' ou ');
        gameMsg.innerHTML = `Faux, la bonne traduction du mot <span class="highlight">${questionWord}</span> est <span class="highlight">${transStr}</span>.`;
        console.log('wrong answer', answer, 'expected set', unique);

        // prepare add button: add answer to expected set on click
        addTranslationBtn.textContent = 'Ajouter';
        addTranslationBtn.classList.remove('icon-btn');
        addTranslationBtn.classList.remove('hidden');
        addTranslationBtn.onclick = () => {
            if (addWordToGroup(group, currentWord.direction==='fr-it'?'it':'fr', answer)) {
                entryMsg.textContent = `Ajouté : ${answer}`;
                saveDictionary();
                refreshWordList();
                populateFullList();
            }
            if (!currentWord.isRetry) {
                retryWords.pop();
            }
            recordAnswer(currentWord, true, true);
            correct += 1;
            updateScoreDisplay();
            addTranslationBtn.classList.add('hidden');
            if (feedbackControls) feedbackControls.classList.add('hidden');
            askNext();
        };
        if (feedbackControls) feedbackControls.classList.remove('hidden');
    }
    updateScoreDisplay();

});

// allow pressing Enter on answer input
answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAnswerBtn.click();
});

// pairExists is no longer used since dictionary groups manage translations directly

// reset and quit buttons
const resetBtn = document.getElementById('resetGame');
const quitBtn = document.getElementById('quitGame');

resetBtn.addEventListener('click', () => {
    clearTimeout(autoNextTimer);
    correct = 0;
    total = 0;
    scoreEl.textContent = correct;
    totalEl.textContent = total;
    scoreBar.style.width = '0%';
    gameMsg.textContent = '';
    gamePlay.classList.add('hidden');
});

// end game dialog buttons
restartGameBtn && restartGameBtn.addEventListener('click', () => {
    // Reset score and restart game
    correct = 0;
    total = 0;
    scoreEl.textContent = correct;
    totalEl.textContent = total;
    scoreBar.style.width = '0%';
    gameMsg.textContent = '';
    
    // Hide dialog and show game play
    endGameDialog.classList.add('hidden');
    gamePlay.classList.remove('hidden');
    
    // Reinitialize available words based on current direction
    const direction = directionSelector.value;
    available = [];
    retryWords = [];
    dictionary.forEach(group => {
        if (direction === 'fr-it' || direction === 'random') {
            group.fr.forEach(word => {
                available.push({ source: word, group, direction: 'fr-it' });
            });
        }
        if (direction === 'it-fr' || direction === 'random') {
            group.it.forEach(word => {
                available.push({ source: word, group, direction: 'it-fr' });
            });
        }
    });
    
    // Start next question
    askNext();
});

mainMenuBtn && mainMenuBtn.addEventListener('click', () => {
    // Hide dialog and return to main menu
    endGameDialog.classList.add('hidden');
    const gamePage = document.getElementById('gamePage');
    const mainSection = document.getElementById('mainContent');
    if (gamePage) gamePage.classList.add('hidden');
    if (mainSection) mainSection.classList.remove('hidden');
    // Reset game state
    gamePlay.classList.add('hidden');
    gameMsg.textContent = '';
    answerInput.value = '';
    available = [];
    retryWords = [];
});

// next question button
const nextBtn = document.getElementById('nextQuestion');
nextBtn && nextBtn.addEventListener('click', () => {
    if (!currentWord || gamePlay.classList.contains('hidden')) return;
    if (autoNextTimer) {
        clearTimeout(autoNextTimer);
        autoNextTimer = null;
    }
    // if user hasn't answered this round, count as wrong
    if (!answeredThisRound) {
        recordAnswer(currentWord, false);
        if (!currentWord.isRetry) {
            retryWords.push({ ...currentWord, isRetry: true });
        }
        total += 1;
        updateScoreDisplay();
    }
    addTranslationBtn.classList.add('hidden');
    if (removeWordBtn) removeWordBtn.classList.add('hidden');
    // keep feedbackControls visible so trash/next stay in place
    askNext();
});

quitBtn.addEventListener('click', () => {
    console.log('quit button clicked');
    // if the full list view overlay is open, just close it
    if (listView && !listView.classList.contains('hidden')) {
        listView.classList.add('hidden');
        return;
    }
    // NOTE: we no longer hide the game; pressing Quit always attempts to exit.
    console.log('quit: attempting to terminate app (gamePlay hidden=',
                gamePlay && gamePlay.classList.contains('hidden'),
                'listView hidden=', listView && listView.classList.contains('hidden'));

    // try Capacitor App plugin first (Android/iOS)
    const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (capApp && typeof capApp.exitApp === 'function') {
        console.log('quit: using Capacitor App.exitApp');
        capApp.exitApp();
        return;
    }
    if (navigator && typeof navigator.app === 'object' &&
               typeof navigator.app.exitApp === 'function') {
        console.log('quit: using navigator.app.exitApp (Cordova)');
        navigator.app.exitApp();
        return;
    }
    if (window.electronAPI && window.electronAPI.closeWindow) {
        console.log('quit: calling electronAPI.closeWindow');
        window.electronAPI.closeWindow();
        return;
    }
    console.log('quit: no programmatic exit available');
    if (typeof window.close === 'function') {
        window.close();
    }
    alert('Pour quitter, fermez l’onglet ou utilisez la commande de fermeture de votre système.');
});
// export and import functionality
const exportBtn = document.getElementById('exportDict');
const importBtn = document.getElementById('importDict');
const importFile = document.getElementById('dictImportFile');
const importMsg = document.getElementById('importMessage');

function collectWordStats() {
    const result = {};
    for (const group of dictionary) {
        for (const [words, direction] of [[group.fr, 'fr-it'], [group.it, 'it-fr']]) {
            for (const word of words) {
                if (typeof word !== 'string') continue;
                const key = JSON.stringify([direction, normalize(word)]);
                const stats = wordStats[key];
                if (stats && (stats.correct || stats.incorrect)) result[key] = stats;
            }
        }
    }
    return result;
}

function restoreBackup(payload) {
    if (!applyArray(normalizeImportedPayload(payload))) return false;
    if (payload.wordStats && typeof payload.wordStats === 'object') {
        wordStats = Object.fromEntries(Object.entries(payload.wordStats).filter(([, stats]) =>
            stats && [stats.correct, stats.incorrect].every(count =>
                Number.isSafeInteger(count) && count >= 0
            )
        ));
        wordStats = collectWordStats();
        saveWordStats();
    }
    saveDictionary();
    refreshWordList();
    populateFullList();
    return true;
}

if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        // convert dictionary to JSON format
        const data = dictionary.map(g => ({ fr: [...g.fr], it: [...g.it] }));
        const json = JSON.stringify({ dictionary: data, wordStats: collectWordStats() }, null, 2);
        
        // try Capacitor filesystem first (Android/iOS)
        const fs = getFsPlugin();
        if (fs && fs.writeFile) {
            try {
                const now = new Date().toISOString().split('T')[0];
                const filename = `DicoManon_${now}.json`;
                await ensureFsPermissions(fs);
                const options = {
                    path: filename,
                    data: json,
                    recursive: true,
                    directory: getFsDocumentsDirectory(fs)
                };
                await fs.writeFile(options);

                // try to resolve URI for better user feedback on Android.
                if (typeof fs.getUri === 'function') {
                    try {
                        const uri = await fs.getUri({
                            path: filename,
                            directory: getFsDocumentsDirectory(fs)
                        });
                        showImportMessage(`✓ Export ok: ${filename}`);
                        console.log('export uri', uri && uri.uri ? uri.uri : uri);
                    } catch (_uriErr) {
                        showImportMessage(`✓ Export ok: ${filename}`);
                    }
                } else {
                    showImportMessage(`✓ Export ok: ${filename}`);
                }
                return;
            } catch (e) {
                console.error('capacitor export failed', e);
                showImportMessage('⚠ Erreur lors de la sauvegarde');
                return;
            }
        }
        
        // fallback to web API for browsers and desktop
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // filename with timestamp
        const now = new Date().toISOString().split('T')[0];
        link.download = `DicoManon_${now}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showImportMessage('✓ Fichier téléchargé');
    });
}

if (importBtn) {
    importBtn.addEventListener('click', async () => {
        const fs = getFsPlugin();

        // Native file picker plugin (Android/iOS) for external JSON selection.
        const filePicker = getFilePickerPlugin();
        if (isNativeCapacitor() && filePicker && typeof filePicker.pickFiles === 'function') {
            try {
                const result = await filePicker.pickFiles({
                    limit: 1,
                    readData: true,
                    types: ['application/json', 'text/json', '.json']
                });
                const picked = result && Array.isArray(result.files) ? result.files[0] : null;
                if (!picked) {
                    showImportMessage('⚠ Aucun fichier sélectionné');
                    return;
                }

                // Prefer direct data from picker, fallback to filesystem path if provided.
                let parsed = null;
                if (picked.data) {
                    parsed = parseJsonTextOrBase64(picked.data);
                }

                if (!parsed && picked.path && fs && typeof fs.readFile === 'function') {
                    try {
                        const readResult = await fs.readFile({ path: picked.path });
                        parsed = parseJsonTextOrBase64(readResult && readResult.data ? readResult.data : '');
                    } catch (readErr) {
                        console.warn('read picked path failed', readErr);
                    }
                }

                if (restoreBackup(parsed)) {
                    showImportMessage('✓ Dictionnaire importé (picker Android)');
                } else {
                    showImportMessage('⚠ Fichier JSON invalide');
                }
                return;
            } catch (pickerErr) {
                console.warn('native file picker failed', pickerErr);
            }
        }

        // fallback: trigger hidden file input (web / desktop / native fallback)
        importFile.click();
    });
}

if (importFile) {
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (restoreBackup(parsed)) {
                    showImportMessage('✓ Dictionnaire importé avec succès');
                } else {
                    showImportMessage('⚠ Format invalide ou vide');
                }
            } catch (err) {
                console.error('import error', err);
                showImportMessage('❌ Erreur lors de la lecture du fichier');
            }
        };
        reader.readAsText(file);
        // reset input so same file can be re-imported
        importFile.value = '';
    });
}

function showImportMessage(msg) {
    if (importMsg) {
        importMsg.textContent = msg;
        importMsg.classList.remove('hidden');
        importMsg.style.display = 'block';
        setTimeout(() => {
            importMsg.classList.add('hidden');
            importMsg.style.display = 'none';
        }, 3000);
    }
}