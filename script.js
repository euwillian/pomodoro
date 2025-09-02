// =====================
// Persistência
// =====================
const STORAGE = {
    THEME: 'pomodoro:theme',
    TASKS: 'pomodoro:tasks',
    SETTINGS: 'pomodoro:settings',
    STATE: 'pomodoro:state'
};

// Preferência de tema
const savedTheme = localStorage.getItem(STORAGE.THEME);
if(savedTheme){
    document.documentElement.setAttribute('data-theme', savedTheme);
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches){
    document.documentElement.setAttribute('data-theme', 'light');
}

// =====================
// Timer Logic (Pomodoro)
// =====================
const display = document.getElementById('display');
const statusEl = document.getElementById('status');
const pomosEl = document.getElementById('pomos');
const cycleEl = document.getElementById('cycle');

// Criar áudio do alarme
const alarm = new Audio('clock.mp3');

let settings = JSON.parse(localStorage.getItem(STORAGE.SETTINGS) || '{}');
if(!settings.work){ settings = { work:25, short:5, long:15 }; }

const els = {
    work: document.getElementById('workM'),
    short: document.getElementById('shortM'),
    long: document.getElementById('longM')
};
els.work.value = settings.work;
els.short.value = settings.short;
els.long.value = settings.long;

let state = {
    mode: 'work', // 'work' | 'short' | 'long'
    secondsLeft: settings.work * 60,
    running: false,
    interval: null,
    pomodoros: 0,
    cycle: 1
};

function saveState(){
    localStorage.setItem(STORAGE.STATE, JSON.stringify({
        mode: state.mode,
        secondsLeft: state.secondsLeft,
        running: false, // sempre parar ao recarregar
        pomodoros: state.pomodoros,
        cycle: state.cycle
    }));
}

function loadState(){
    const s = JSON.parse(localStorage.getItem(STORAGE.STATE) || 'null');
    if(!s) return;
    state.mode = s.mode; 
    state.secondsLeft = s.secondsLeft; 
    state.pomodoros = s.pomodoros; 
    state.cycle = s.cycle; 
    state.running = false; 
    state.interval = null;
    render();
}

function mmss(sec){
    const m = Math.floor(sec/60).toString().padStart(2,'0');
    const s = Math.floor(sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
}

function render(){
    display.textContent = mmss(state.secondsLeft);
    pomosEl.textContent = state.pomodoros;
    cycleEl.textContent = state.cycle;
    const label = state.mode === 'work' ? 'Foco' : (state.mode === 'short' ? 'Pausa curta' : 'Pausa longa');
    statusEl.textContent = label;
    document.title = `${display.textContent} • ${label}`;
}

function setMode(mode){
    state.mode = mode;
    const mins = mode==='work' ? settings.work : mode==='short' ? settings.short : settings.long;
    state.secondsLeft = mins * 60;
    render(); saveState();
}

function start(){
    if(state.running) return;
    state.running = true;
    state.interval = setInterval(()=>{
        state.secondsLeft--;

        // =====================
        // Tocar som quando faltar 9 segundos
        // =====================
        if(state.secondsLeft === 9){
            alarm.play().catch(e => console.log("Erro ao tocar som:", e));
        }

        if(state.secondsLeft <= 0){
            clearInterval(state.interval); 
            state.running=false;

            // Concluiu etapa
            if(state.mode==='work'){
                state.pomodoros++;
                state.cycle = (state.cycle % 4) + 1;
                if((state.pomodoros % 4) === 0){ 
                    setMode('long'); 
                } else { 
                    setMode('short'); 
                }
            } else {
                setMode('work');
            }
        }
        render(); 
        saveState();
    }, 1000);
}

function pause(){
    clearInterval(state.interval); 
    state.running=false; 
    saveState();
}

function reset(){
    pause();
    state.pomodoros = 0; 
    state.cycle = 1;
    setMode('work'); 
    render(); 
    saveState();
}

document.getElementById('startBtn').addEventListener('click', start);
document.getElementById('pauseBtn').addEventListener('click', pause);
document.getElementById('resetBtn').addEventListener('click', reset);

// Settings actions
document.getElementById('saveSettings').addEventListener('click', ()=>{
    settings = { work: +els.work.value || 25, short: +els.short.value || 5, long: +els.long.value || 15 };
    localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(settings));
    setMode(state.mode);
});
document.getElementById('defaultSettings').addEventListener('click', ()=>{
    els.work.value=25; els.short.value=5; els.long.value=15; 
    settings = { work:25, short:5, long:15 };
    localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(settings));
    setMode('work'); reset();
});

// =====================
// Tasks (CRUD)
// =====================
const tasksEl = document.getElementById('tasks');
const inputEl = document.getElementById('newTask');
const addBtn = document.getElementById('addTask');

let tasks = JSON.parse(localStorage.getItem(STORAGE.TASKS) || '[]');

function persistTasks(){ localStorage.setItem(STORAGE.TASKS, JSON.stringify(tasks)); }

function taskRow(t){
    const row = document.createElement('div'); row.className='task' + (t.done ? ' done' : ''); row.dataset.id=t.id;
    row.innerHTML = `
    <input type="checkbox" ${t.done?'checked':''} aria-label="Concluir tarefa">
    <div class="text" title="${t.text.replace(/"/g,'&quot;')}">${t.text}</div>
    <div>
        <button class="icon btn" title="Editar">✏️</button>
        <button class="icon btn" title="Remover">🗑️</button>
    </div>`;

    const cb = row.querySelector('input[type="checkbox"]');
    const txt = row.querySelector('.text');
    const [editBtn, delBtn] = row.querySelectorAll('button');

    cb.addEventListener('change', ()=>{
        t.done = cb.checked;
        row.classList.toggle('done', t.done);
        persistTasks();
    });

    editBtn.addEventListener('click', ()=>{
        const editor = document.createElement('input');
        editor.type='text'; editor.value=t.text; editor.style.width='100%'; editor.className='soft';
        txt.replaceWith(editor); editor.focus();
        const save = ()=>{
            t.text = editor.value.trim() || t.text;
            const span = document.createElement('div'); span.className='text'; span.textContent=t.text; span.title=t.text; editor.replaceWith(span);
            persistTasks();
        };
        editor.addEventListener('blur', save);
        editor.addEventListener('keydown', e=>{ if(e.key==='Enter') { editor.blur(); } if(e.key==='Escape'){ editor.value=t.text; editor.blur(); }});
    });

    delBtn.addEventListener('click', ()=>{
        tasks = tasks.filter(x=>x.id!==t.id); renderTasks(); persistTasks();
    });

    return row;
}

function renderTasks(){
    tasksEl.innerHTML='';
    if(tasks.length===0){
        const empty = document.createElement('div');
        empty.className='muted'; empty.textContent='Sem tarefas por enquanto.';
        tasksEl.appendChild(empty); return;
    }
    tasks.forEach(t=> tasksEl.appendChild(taskRow(t)));
}

function addTask(){
    const text = (inputEl.value || '').trim(); if(!text) return;
    tasks.unshift({ id: crypto.randomUUID(), text, done:false });
    inputEl.value=''; renderTasks(); persistTasks();
}

inputEl.addEventListener('keydown', e=>{ if(e.key==='Enter') addTask(); });
addBtn.addEventListener('click', addTask);

// =====================
// Theme Toggle
// =====================
const themeToggle = document.getElementById('themeToggle');
themeToggle.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE.THEME, next);
});

// Init
loadState(); render(); renderTasks();
