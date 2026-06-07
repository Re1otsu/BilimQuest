/* ===== BilimAI chat widget ===== */
(function () {
  const root = document.getElementById("bq-chat");
  if (!root || root.dataset.bqInit) return;
  root.dataset.bqInit = "1";

  const ROLE = (root.dataset.role || "student").trim();
  const NAME = (root.dataset.name || "").trim();
  const isTeacher = ROLE === "teacher";
  const isStudent = !isTeacher;

  // Ойын беті ме? (подсказка/разбор ошибок тек ойын беттерінде көрінеді)
  const GAME_PAGE = /^\/(game[1-9]|module\d+|toqsan2\/g\d|toqsan4\/g\d|quest3\/m\d)/.test(
    location.pathname
  );

  const CFG = {
    student: {
      title: "BilimAI",
      sub: "Көмекші",
      greeting: (NAME ? `Сәлем, ${NAME}! ` : "Сәлем! ") +
        "Мен — BilimAI 🤖 Тапсырмалар мен тақырыптар бойынша көмектесемін. Не сұрайсың?",
      chips: ["Бұл тапсырманы қалай шешемін?", "Екілік жүйе деген не?", "Маған кеңес бер"],
    },
    teacher: {
      title: "BilimAI",
      sub: "Талдау көмекшісі",
      greeting: (NAME ? `Сәлем, ${NAME}! ` : "Сәлем! ") +
        "Аналитиканы талдауға, хабарландыру жазуға және әдістемелік кеңеске көмектесемін.",
      chips: ["Қай тарау әлсіз?", "Хабарландыру мәтінін жаз", "Кімге көмек керек?"],
    },
  };
  const cfg = isTeacher ? CFG.teacher : CFG.student;

  // Питомец иногда подбадривает (показывается у кнопки, когда панель закрыта)
  const PET_LINES = [
    "Жарайсың! 🌟 Жалғастыра бер!",
    "Қиналсаң — мені басып шақыр 😊",
    "Сен істей аласың! 💪",
    "Әр қате — жаңа сабақ 📚",
    "Демалуды да ұмытпа 💧",
  ];

  const SVG = {
    bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  };

  // ---------- build DOM ----------
  root.innerHTML = `
    <div class="bq-pet-bubble" id="bq-pet-bubble" hidden></div>
    <button class="bq-fab" type="button" aria-label="BilimAI көмекшісін ашу" aria-expanded="false" aria-controls="bq-panel">
      <span class="bq-fab-open bq-pet">${SVG.bot}</span>
      <span class="bq-fab-close">${SVG.close}</span>
      <span class="bq-fab-badge" aria-hidden="true"></span>
    </button>
    <section id="bq-panel" class="bq-panel" role="dialog" aria-modal="false" aria-label="${cfg.title} көмекші" hidden>
      <header class="bq-head">
        <div class="bq-avatar bq-pet">${SVG.bot}</div>
        <div class="bq-head-meta">
          <div class="bq-head-title">${cfg.title}</div>
          <div class="bq-head-sub">${cfg.sub}</div>
        </div>
        <button class="bq-close" type="button" aria-label="Жабу">${SVG.close}</button>
      </header>
      <div class="bq-msgs" id="bq-msgs" aria-live="polite"></div>
      <div class="bq-actions" id="bq-actions"></div>
      <div class="bq-chips" id="bq-chips"></div>
      <form class="bq-input" id="bq-form">
        <textarea id="bq-text" rows="1" placeholder="Сұрағыңды жаз..." aria-label="Хабарлама"></textarea>
        <button class="bq-send" id="bq-send" type="submit" aria-label="Жіберу">${SVG.send}</button>
      </form>
    </section>`;

  const fab = root.querySelector(".bq-fab");
  const panel = root.querySelector(".bq-panel");
  const msgs = root.querySelector("#bq-msgs");
  const chipsBox = root.querySelector("#bq-chips");
  const actionsBox = root.querySelector("#bq-actions");
  const form = root.querySelector("#bq-form");
  const textarea = root.querySelector("#bq-text");
  const sendBtn = root.querySelector("#bq-send");
  const badge = root.querySelector(".bq-fab-badge");
  const petBubble = root.querySelector("#bq-pet-bubble");

  const STORE_KEY = "bq_chat_" + ROLE;
  let history = []; // [{role:'user'|'model', text}]
  let busy = false;
  let pendingMode = null; // 'mistake' — следующее сообщение уйдёт в разбор ошибок

  // ---------- helpers ----------
  function esc(s) {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function fmt(s) {
    // minimal markdown: **bold**, `code`, line breaks preserved by CSS white-space
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }
  function addMsg(text, who) {
    const div = document.createElement("div");
    div.className = "bq-msg " + who;
    div.innerHTML = who === "bot" ? fmt(text) : esc(text);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }
  function showTyping() {
    const t = document.createElement("div");
    t.className = "bq-typing";
    t.id = "bq-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(t);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() {
    const t = document.getElementById("bq-typing");
    if (t) t.remove();
  }
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-16))); } catch (e) {}
  }
  function load() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]"); } catch (e) { return []; }
  }

  // Ойын бетіндегі көрінетін мәтінді жинау (ИИ контекст түсінуі үшін)
  function collectGameContext() {
    if (!GAME_PAGE) return "";
    const seen = new Set();
    const parts = [];
    const push = (t) => {
      t = (t || "").replace(/\s+/g, " ").trim();
      if (t && t.length <= 200 && !seen.has(t)) { seen.add(t); parts.push(t); }
    };
    if (document.title) push(document.title);
    // заголовки, описания, подписи, кнопки — всё, что объясняет игру
    const sel = "h1,h2,h3,h4,p,label,button,.description,.task,.rule,.hint,.tip,[class*='instr'],[class*='desc'],li";
    document.querySelectorAll(sel).forEach((el) => {
      if (root.contains(el)) return;          // не берём текст самого виджета
      if (el.closest("#game-over,[hidden]")) return;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      push(el.textContent);
    });
    // подсказки из placeholder/alt
    document.querySelectorAll("input[placeholder],img[alt]").forEach((el) => {
      if (root.contains(el)) return;
      push(el.getAttribute("placeholder") || el.getAttribute("alt"));
    });
    return parts.join(" | ").slice(0, 900);
  }

  function renderChips() {
    chipsBox.innerHTML = "";
    cfg.chips.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bq-chip";
      b.textContent = c;
      b.addEventListener("click", () => { textarea.value = c; send(); });
      chipsBox.appendChild(b);
    });
  }

  // ---------- игровые действия (подсказка / разбор ошибок) ----------
  function renderGameActions() {
    if (!(isStudent && GAME_PAGE)) return;
    const acts = [
      { label: "💡 Көмек керек", kind: "hint" },
      { label: "🤔 Қатемді түсіндір", kind: "mistake" },
    ];
    acts.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bq-action";
      b.textContent = a.label;
      b.addEventListener("click", () => onGameAction(a.kind));
      actionsBox.appendChild(b);
    });
    actionsBox.classList.add("show");
  }

  async function onGameAction(kind) {
    if (busy) return;
    if (kind === "mistake") {
      // интерактивный разбор: просим описать, что не получилось
      pendingMode = "mistake";
      addMsg("Не істегенде қателестің немесе түсінбедің? Маған жазып жібер — бірге шешеміз 😊", "bot");
      chipsBox.style.display = "none";
      textarea.focus();
      return;
    }
    // hint — мгновенная подсказка по текущей игре
    addMsg("💡 Көмек керек", "user");
    chipsBox.style.display = "none";
    busy = true; sendBtn.disabled = true;
    showTyping();
    try {
      const res = await fetch("/api/game-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "hint", page: location.pathname, page_text: collectGameContext() }),
      });
      const data = await res.json();
      hideTyping();
      addMsg((data && data.reply) || "Кешіріңіз, кеңес дайындай алмадым.", "bot");
    } catch (e) {
      hideTyping();
      addMsg("Байланыс қатесі. Қайта көріп көрші.", "bot");
    } finally {
      busy = false; sendBtn.disabled = false;
      textarea.focus();
    }
  }

  // ---------- open / close ----------
  function open() {
    panel.hidden = false;
    requestAnimationFrame(() => root.classList.add("bq-open"));
    fab.setAttribute("aria-expanded", "true");
    badge.style.display = "none";
    hidePetBubble();
    textarea.focus();
  }
  function close() {
    root.classList.remove("bq-open");
    fab.setAttribute("aria-expanded", "false");
    setTimeout(() => { panel.hidden = true; }, 220);
    fab.focus();
  }
  fab.addEventListener("click", () => (root.classList.contains("bq-open") ? close() : open()));
  root.querySelector(".bq-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("bq-open")) close(); });

  // ---------- питомец: всплывающая реплика ----------
  let bubbleTimer = null;
  function showPetBubble(text) {
    if (root.classList.contains("bq-open")) return;
    petBubble.textContent = text;
    petBubble.hidden = false;
    requestAnimationFrame(() => petBubble.classList.add("show"));
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(hidePetBubble, 6000);
  }
  function hidePetBubble() {
    petBubble.classList.remove("show");
    bubbleTimer = setTimeout(() => { petBubble.hidden = true; }, 250);
  }
  petBubble.addEventListener("click", open);

  function startPetLife() {
    if (!isStudent) return;
    // первое приветствие питомца
    setTimeout(() => {
      showPetBubble(GAME_PAGE
        ? "Көмек керек болса, мені басып шақыр! 💡"
        : "Сәлем! Мен BilimAI 🤖 Сұрағың болса осында бас.");
    }, 3500);
    // периодическая мотивация
    setInterval(() => {
      if (!root.classList.contains("bq-open") && Math.random() < 0.6) {
        showPetBubble(PET_LINES[Math.floor(Math.random() * PET_LINES.length)]);
      }
    }, 75000);
  }

  // ---------- send ----------
  async function send() {
    const text = textarea.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    addMsg(text, "user");
    textarea.value = ""; textarea.style.height = "auto";
    chipsBox.style.display = "none";
    showTyping();

    // выбор маршрута: разбор ошибок vs обычный чат
    const mode = pendingMode;
    let url, payload;
    if (mode) {
      url = "/api/game-help";
      payload = { mode, message: text, page: location.pathname, page_text: collectGameContext() };
      pendingMode = null;
    } else {
      history.push({ role: "user", text });
      url = "/api/chat";
      payload = { message: text, history: history.slice(-10), page: location.pathname, page_text: collectGameContext() };
      save();
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      hideTyping();
      const reply = (data && data.reply) ? data.reply : "Кешіріңіз, жауап беру мүмкін болмады. Кейінірек қайталап көріңіз.";
      addMsg(reply, "bot");
      if (!mode) {
        history.push({ role: "model", text: reply });
        save();
      }
    } catch (e) {
      hideTyping();
      addMsg("Байланыс қатесі. Интернетті тексеріп, қайта жіберіңіз.", "bot");
    } finally {
      busy = false; sendBtn.disabled = false;
      textarea.focus();
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); send(); });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + "px";
  });

  // ---------- init ----------
  history = load();
  if (history.length) {
    history.forEach((m) => addMsg(m.text, m.role === "user" ? "user" : "bot"));
    chipsBox.style.display = "none";
  } else {
    addMsg(cfg.greeting, "bot");
  }
  renderGameActions();
  renderChips();
  startPetLife();
})();
