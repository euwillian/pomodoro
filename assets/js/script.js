// =====================
// Persistência
// =====================
const STORAGE = {
  THEME: "pomodoro:theme",
  TASKS: "pomodoro:tasks",
  SETTINGS: "pomodoro:settings",
  STATE: "pomodoro:state",
};

// Preferência de tema
const savedTheme = localStorage.getItem(STORAGE.THEME);
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
} else if (
  window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: light)").matches
) {
  document.documentElement.setAttribute("data-theme", "light");
}

// =====================
// Helpers seguros (evitam erros em outras páginas)
// =====================
const $ = (sel) => document.querySelector(sel);
const on = (el, evt, cb) => el && el.addEventListener(evt, cb);

// =====================
// Timer Logic (Pomodoro)
// =====================
const display = $("#display");
const statusEl = $("#status");
const pomosEl = $("#pomos");
const cycleEl = $("#cycle");

// Áudio do alarme (coloque clock.mp3 na raiz)
const alarm = new Audio("/audio/clock.mp3");

let settings = JSON.parse(localStorage.getItem(STORAGE.SETTINGS) || "{}");
if (!settings.work) {
  settings = {
    work: 25,
    short: 5,
    long: 15,
    autoStartWork: true,
    autoStartBreak: true,
  };
}

// Estes elementos estão no modal, que está no index.html
const els = {
  work: $("#workM"),
  short: $("#shortM"),
  long: $("#longM"),
  autoStartWork: $("#autoStartWork"),
  autoStartBreak: $("#autoStartBreak"),
};
if (
  els.work &&
  els.short &&
  els.long &&
  els.autoStartWork &&
  els.autoStartBreak
) {
  els.work.value = settings.work;
  els.short.value = settings.short;
  els.long.value = settings.long;
  els.autoStartWork.checked = settings.autoStartWork;
  els.autoStartBreak.checked = settings.autoStartBreak;
}

let state = {
  mode: "work", // 'work' | 'short' | 'long'
  secondsLeft: settings.work * 60,
  running: false,
  interval: null,
  pomodoros: 0,
  cycle: 1,
};

function saveState() {
  localStorage.setItem(
    STORAGE.STATE,
    JSON.stringify({
      mode: state.mode,
      secondsLeft: state.secondsLeft,
      running: false, // sempre parar ao recarregar
      pomodoros: state.pomodoros,
      cycle: state.cycle,
    })
  );
}

function loadState() {
  const s = JSON.parse(localStorage.getItem(STORAGE.STATE) || "null");
  if (!s) return;
  state.mode = s.mode;
  state.secondsLeft = s.secondsLeft;
  state.pomodoros = s.pomodoros;
  state.cycle = s.cycle;
  state.running = false;
  state.interval = null;
  render();
}

function mmss(sec) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function render() {
  if (!display || !statusEl || !pomosEl || !cycleEl) return;
  display.textContent = mmss(state.secondsLeft);
  pomosEl.textContent = state.pomodoros;
  cycleEl.textContent = state.cycle;
  const label =
    state.mode === "work"
      ? "Foco"
      : state.mode === "short"
      ? "Pausa curta"
      : "Pausa longa";
  statusEl.textContent = label;
  document.title = `${display.textContent} • ${label}`;
}

function setMode(mode) {
  state.mode = mode;
  const mins =
    mode === "work"
      ? settings.work
      : mode === "short"
      ? settings.short
      : settings.long;
  state.secondsLeft = mins * 60;
  render();
  saveState();
}

function tick() {
  state.secondsLeft--;

  // Aviso sonoro 5s antes do fim
  if (state.secondsLeft === 5) {
    alarm.play().catch(() => {});
  }

  if (state.secondsLeft <= 0) {
    clearInterval(state.interval);
    state.running = false;

    // Concluiu etapa
    if (state.mode === "work") {
      state.pomodoros++;
      state.cycle = (state.cycle % 4) + 1;
      if (state.pomodoros % 4 === 0) {
        setMode("long");
      } else {
        setMode("short");
      }
      if (settings.autoStartBreak) start();
    } else {
      setMode("work");
      if (settings.autoStartWork) start();
    }

    render();
    saveState();
  } else {
    render();
    saveState();
  }
}

function start() {
  if (!display) return; // não está na index
  if (state.running) return;
  state.running = true;
  state.interval = setInterval(tick, 1000);
}

function pause() {
  clearInterval(state.interval);
  state.running = false;
  saveState();
}

function reset() {
  pause();
  state.pomodoros = 0;
  state.cycle = 1;
  setMode("work");
  render();
  saveState();
}

// Botões do cronômetro (só na index)
on($("#startBtn"), "click", start);
on($("#pauseBtn"), "click", pause);
on($("#resetBtn"), "click", reset);

// Funções para o modal de ajustes
const settingsModal = $("#settingsModal");
const overlay = $("#overlay");
const closeSettings = $("#closeSettings");

function openSettings() {
  settingsModal.style.display = "flex";
  overlay.style.display = "block";
}

function closeModal() {
  settingsModal.style.display = "none";
  overlay.style.display = "none";
}

// Eventos do modal de ajustes
on(closeSettings, "click", closeModal);
on(overlay, "click", closeModal);

// Eventos dos botões do modal de ajustes
on($("#saveSettings"), "click", () => {
  if (!els.work) return;
  settings = {
    work: +els.work.value || 25,
    short: +els.short.value || 5,
    long: +els.long.value || 15,
    autoStartWork: els.autoStartWork.checked,
    autoStartBreak: els.autoStartBreak.checked,
  };
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(settings));
  setMode(state.mode);
  closeModal();
});
on($("#defaultSettings"), "click", () => {
  if (!els.work) return;
  els.work.value = 25;
  els.short.value = 5;
  els.long.value = 15;
  els.autoStartWork.checked = true;
  els.autoStartBreak.checked = true;
  settings = {
    work: 25,
    short: 5,
    long: 15,
    autoStartWork: true,
    autoStartBreak: true,
  };
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(settings));
  setMode("work");
  reset();
  closeModal();
});

// =====================
// Tasks (CRUD)
// =====================
const tasksEl = $("#tasks");
const inputEl = $("#newTask");
const addBtn = $("#addTask");

let tasks = JSON.parse(localStorage.getItem(STORAGE.TASKS) || "[]");

function persistTasks() {
  localStorage.setItem(STORAGE.TASKS, JSON.stringify(tasks));
}

function taskRow(t) {
  const row = document.createElement("div");
  row.className = "task" + (t.done ? " done" : "");
  row.dataset.id = t.id;
  row.innerHTML = `
    <input type="checkbox" ${
      t.done ? "checked" : ""
    } aria-label="Concluir tarefa">
    <div class="text" title="${t.text.replace(/"/g, "&quot;")}">${t.text}</div>
    <div>
      <button class="icon btn" title="Editar">✏️</button>
      <button class="icon btn" title="Remover">🗑️</button>
    </div>`;

  const cb = row.querySelector('input[type="checkbox"]');
  const txt = row.querySelector(".text");
  const [editBtn, delBtn] = row.querySelectorAll("button");

  cb.addEventListener("change", () => {
    t.done = cb.checked;
    row.classList.toggle("done", t.done);
    persistTasks();
  });

  editBtn.addEventListener("click", () => {
    const editor = document.createElement("input");
    editor.type = "text";
    editor.value = t.text;
    editor.style.width = "100%";
    editor.className = "soft";
    txt.replaceWith(editor);
    editor.focus();
    const save = () => {
      t.text = editor.value.trim() || t.text;
      const span = document.createElement("div");
      span.className = "text";
      span.textContent = t.text;
      span.title = t.text;
      editor.replaceWith(span);
      persistTasks();
    };
    editor.addEventListener("blur", save);
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        editor.blur();
      }
      if (e.key === "Escape") {
        editor.value = t.text;
        editor.blur();
      }
    });
  });

  delBtn.addEventListener("click", () => {
    tasks = tasks.filter((x) => x.id !== t.id);
    renderTasks();
    persistTasks();
  });

  return row;
}

function renderTasks() {
  if (!tasksEl) return;
  tasksEl.innerHTML = "";
  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "Sem tarefas por enquanto.";
    tasksEl.appendChild(empty);
    return;
  }
  tasks.forEach((t) => tasksEl.appendChild(taskRow(t)));
}

function addTask() {
  const text = (inputEl?.value || "").trim();
  if (!text) return;
  tasks.unshift({ id: crypto.randomUUID(), text, done: false });
  inputEl.value = "";
  renderTasks();
  persistTasks();
}

on(inputEl, "keydown", (e) => {
  if (e.key === "Enter") addTask();
});
on(addBtn, "click", addTask);

// =====================
// YouTube (player pequeno com play/pausa/volume)
// =====================
let ytPlayer = null;
let ytApiReady = false;

function loadYTApiOnce() {
  if (window.YT && window.YT.Player) {
    ytApiReady = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onload = () => {};
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      ytApiReady = true;
      resolve();
    };
  });
}

function parseYouTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    // /embed/ID
    const parts = u.pathname.split("/");
    const idx = parts.indexOf("embed");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch (_) {}
  return null;
}

async function createPlayer(videoId) {
  const el = document.getElementById("ytPlayer");
  if (!el) return;
  await loadYTApiOnce();
  if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
  ytPlayer = new YT.Player("ytPlayer", {
    videoId,
    width: "280",
    height: "158",
    playerVars: {
      modestbranding: 1,
      rel: 0,
      controls: 0, // usamos controles próprios
      playsinline: 1,
    },
    events: {
      onReady: (ev) => {
        try {
          ev.target.setVolume(parseInt($("#ytVol")?.value || "60", 10));
        } catch (_) {}
      },
    },
  });
}

on($("#ytLoad"), "click", async () => {
  const url = $("#ytUrl")?.value?.trim();
  const id = parseYouTubeId(url || "");
  if (!id) {
    alert("URL inválida do YouTube");
    return;
  }
  await createPlayer(id);
});

on($("#ytPlay"), "click", () => {
  try {
    ytPlayer && ytPlayer.playVideo();
  } catch (_) {}
});
on($("#ytPause"), "click", () => {
  try {
    ytPlayer && ytPlayer.pauseVideo();
  } catch (_) {}
});
on($("#ytVol"), "input", (e) => {
  try {
    ytPlayer && ytPlayer.setVolume(parseInt(e.target.value, 10));
  } catch (_) {}
});

// Carrega o footer automaticamente em todas as páginas
document.addEventListener("DOMContentLoaded", function () {
  fetch("../footer.html")
    .then((response) => {
      // Verifica se a requisição foi bem-sucedida
      if (!response.ok) {
        throw new Error("Erro ao carregar o footer: " + response.statusText);
      }
      return response.text();
    })
    .then((data) => {
      // Encontra o elemento com o ID 'footer-placeholder' e insere o conteúdo
      const footerPlaceholder = document.getElementById("footer-placeholder");
      if (footerPlaceholder) {
        footerPlaceholder.innerHTML = data;
      } else {
        console.error(
          'O elemento com o ID "footer-placeholder" não foi encontrado.'
        );
      }
    })
    .catch((error) => console.error("Houve um erro:", error));
});

// O código para carregar o cabeçalho
document.addEventListener("DOMContentLoaded", function () {
  fetch("../header.html")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Erro ao carregar o cabeçalho: " + response.statusText);
      }
      return response.text();
    })
    .then((data) => {
      const headerPlaceholder = document.getElementById("header-placeholder");
      if (headerPlaceholder) {
        headerPlaceholder.innerHTML = data;

        // Conectar os eventos dos botões do header
        const settingsBtn = $("#settingsBtn");
        const themeToggle = $("#themeToggle");

        on(settingsBtn, "click", openSettings);
        on(themeToggle, "click", () => {
          const cur = document.documentElement.getAttribute("data-theme");
          const next = cur === "dark" ? "light" : "dark";
          document.documentElement.setAttribute("data-theme", next);
          localStorage.setItem(STORAGE.THEME, next);
        });
      } else {
        console.error('Elemento com ID "header-placeholder" não encontrado.');
      }
    })
    .catch((error) => console.error(error));
});

// =====================
// Init
// =====================
loadState();
render();
renderTasks();