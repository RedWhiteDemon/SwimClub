let schedule = [];

const coaches = [
  {
    name: "Анна Смирнова",
    slug: "anna-smirnova",
    role: "Старший тренер",
    specialization: "Техника кроля и адаптация новичков",
    tagline: "От первых метров до уверенного кроля",
    bio: "Помогает преодолеть дискомфорт в воде и выстроить базу: положение тела, ритм, дыхание и безопасное ускорение.",
    experienceYears: 8,
    certification: "Инструктор по плаванию, категория A",
    tags: ["Кроль", "Новички", "Дыхание", "Семейные группы"]
  },
  {
    name: "Илья Орлов",
    slug: "ilya-orlov",
    role: "Тренер по ОФП и скорости",
    specialization: "Выносливость и интервальные тренировки",
    tagline: "Дистанции и темп без потери техники",
    bio: "Собирает план с контролем нагрузки: интервалы, повторы, работа ног и устойчивый корпус на длинных отрезках.",
    experienceYears: 6,
    certification: "Тренер по спортивному плаванию",
    tags: ["Выносливость", "Интервалы", "Темп", "Кроль"]
  },
  {
    name: "Марина Ким",
    slug: "marina-kim",
    role: "Тренер соревновательных групп",
    specialization: "Подготовка к любительским соревнованиям",
    tagline: "Старты, стратегия и дистанции 100–1500 м",
    bio: "Готовит к стартам и внутренним заплывам: разгон, повороты, распределение сил и уверенность в гонке.",
    experienceYears: 9,
    certification: "Мастер-тренер Swim Performance",
    tags: ["Соревнования", "Старт", "Стратегия", "Комплекс / кроль"]
  }
];

const dayShortRu = {
  Понедельник: "Пн",
  Вторник: "Вт",
  Среда: "Ср",
  Четвер: "Чт",
  Пятница: "Пт",
  Суббота: "Сб",
  Воскресенье: "Вс"
};

const TOKEN_KEY = "swimclub_token";
const EMAIL_MAX_LEN = 254;

/** Простая проверка до запроса; окончательно формат проверяет сервер. */
function isReasonableEmail(email) {
  const s = String(email || "").trim();
  if (!s || s.length > EMAIL_MAX_LEN || /\s/.test(s) || s.includes("..")) {
    return false;
  }
  const at = s.lastIndexOf("@");
  if (at <= 0 || at === s.length - 1) {
    return false;
  }
  const domain = s.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.toLowerCase());
}

function getApiBase() {
  if (typeof window !== "undefined" && window.SWIMCLUB_API_BASE != null && String(window.SWIMCLUB_API_BASE).trim() !== "") {
    const b = String(window.SWIMCLUB_API_BASE).trim().replace(/\/$/, "");
    return b.endsWith("/api") ? b : `${b}/api`;
  }
  const o = window.location.origin;
  if (!o || o === "null" || o.startsWith("file:")) {
    return "http://localhost:3000/api";
  }
  const host = window.location.hostname;
  const port = window.location.port;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const likelyStaticDevServer = new Set(["5500", "5501", "5173", "4173"]);
  if (isLocal && likelyStaticDevServer.has(port)) {
    return "http://localhost:3000/api";
  }
  const base = o.replace(/\/$/, "");
  return `${base}/api`;
}

function humanizeApiErrorMessage(message, status) {
  if (typeof message !== "string") {
    return message || "Ошибка запроса.";
  }
  const m = message.trim();
  if (
    m.includes("<!DOCTYPE") ||
    m.includes("<html") ||
    m.includes("Cannot POST") ||
    m.includes("Cannot GET")
  ) {
    return (
      "API недоступен по этому адресу страницы. Запустите в папке проекта npm run dev и откройте сайт с http://localhost:3000 " +
      '(или задайте window.SWIMCLUB_API_BASE = "http://localhost:ПОРТ" без /api в конце).'
    );
  }
  return m || `Ошибка ${status || ""}`.trim();
}

function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path, options = {}) {
  const url = `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Accept: "application/json",
    ...(options.headers || {})
  };
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (res.status === 204) {
    return null;
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    const raw = (data && data.error) || res.statusText || "Ошибка запроса";
    const err = new Error(humanizeApiErrorMessage(raw, res.status));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

const photoItems = [
  {
    title: "Разминка у дорожки",
    caption: "Новички, первые недели — безопасный ритм и разогрев суставов.",
    src: "images/gallery/warmup.jpg"
  },
  {
    title: "Техника дыхания",
    caption: "Серия упражнений в мелководье и с доской.",
    src: "images/gallery/breathing.jpg"
  },
  {
    title: "Группа выносливости",
    caption: "Интервалы средней длины, контроль темпа.",
    src: "images/gallery/endurance.jpg"
  },
  {
    title: "Стартовый блок",
    caption: "Продвинутый уровень — старты и ускорения.",
    src: "images/gallery/start-block.jpg"
  }
];

/** Реальные ролики YouTube (короткие id из ссылок watch?v=) — прямые embed, без поиска. */
const swimVideoItems = [
  { videoId: "uiI6Z_0Q2Io", title: "Идеальная техника кроля", channelTitle: "MySwimPro" },
  { videoId: "lp5iqhfS4vE", title: "Сильнее грести в кроле", channelTitle: "MySwimPro" },
  { videoId: "krg9J0Rz4Kg", title: "Всё о технике кроля", channelTitle: "MySwimPro" },
  { videoId: "9l9xEzQRbZk", title: "Тренировка кроля 45 минут", channelTitle: "MySwimPro" },
  { videoId: "NFHanLS9g5k", title: "Кроль за 60 секунд", channelTitle: "MySwimPro" },
  { videoId: "9gw8tbkhKgo", title: "Техника брассом", channelTitle: "Speedo" },
  { videoId: "qgID-bQQTQg", title: "Брасс: работа рук, часть 1", channelTitle: "Skills NT" },
  { videoId: "ppuDgfdk9y8", title: "Брасс для начинающих", channelTitle: "SwimLifePro" },
  { videoId: "LOwNCPesW0k", title: "Как плавать брассом", channelTitle: "Global Triathlon Network" },
  { videoId: "-V6TwcSs1nk", title: "Хороший брасс: тайминг и позиция", channelTitle: "Butterfly swimming" },
  { videoId: "PCnsicdXVY0", title: "Кроль на спине для начинающих", channelTitle: "Rocket Swimming" },
  { videoId: "ijsYj94OYSM", title: "Кроль на спине: ключевые элементы", channelTitle: "U.S. Masters Swimming" },
  { videoId: "qq0vcQEZahQ", title: "На спине: 4 простых шага", channelTitle: "Global Triathlon Network" },
  { videoId: "8PkF7euQZBo", title: "Техника кроля на спине", channelTitle: "Global Triathlon Network" },
  { videoId: "HB4YEe4xRvQ", title: "Кроль на спине с олимпийской чемпионкой", channelTitle: "FINA / Rice" },
  { videoId: "Leejy2PLVxA", title: "Баттерфляй: советы по уровням", channelTitle: "Rocket Swimming" },
  { videoId: "EU7Hyo_oy2k", title: "Баттерфляй для начинающих", channelTitle: "MySwimPro" },
  { videoId: "x-CB6aD4S2s", title: "Баттерфляй пошагово", channelTitle: "Global Triathlon Network" },
  { videoId: "e6P5FJnYfj8", title: "Техника баттерфляя: разбор", channelTitle: "MySwimPro" },
  { videoId: "riIyImmuB_M", title: "Баттерфляй: механика гребка", channelTitle: "Global Triathlon Network" },
  { videoId: "Y4ZU2uW-YnU", title: "Поворот кувырком за 5 шагов", channelTitle: "MySwimPro" },
  { videoId: "rysbaBy9gjA", title: "Идеальный кувырок: 3 шага", channelTitle: "MySwimPro" },
  { videoId: "Y4cDXisd6vw", title: "Повороты в плавании с К. Дресселом", channelTitle: "MySwimPro" },
  { videoId: "2C_fQG4ByY0", title: "Быстрый кувырок: продвинутый разбор", channelTitle: "Kaitlin Frehling" },
  { videoId: "foGlgwWk76I", title: "Кувырок в кроле за три шага", channelTitle: "Swim Technique" },
  { videoId: "tvp0xh1HUFs", title: "Взрослым: плавание с нуля, часть 2", channelTitle: "SwimtoFly" },
  { videoId: "hHx2sdhmbOU", title: "Плавать на спине и держаться на воде", channelTitle: "Skills NT" },
  { videoId: "Eggwe7Z0XVA", title: "Базовый кроль для новичков", channelTitle: "Skills NT" },
  { videoId: "kJOHVbHvw4U", title: "Тренировка для взрослых: старт с нуля", channelTitle: "Skills NT" },
  { videoId: "hw3SuuFJTq8", title: "Интенсивный курс плавания за несколько дней", channelTitle: "Skills NT" },
  { videoId: "BvMyYqlLLLU", title: "Дельфин-кик: шаги и дыхание", channelTitle: "SWIMVICE" },
  { videoId: "vY6GxQqAkuQ", title: "Подводный дельфин-кик", channelTitle: "Olympian Marcus" },
  { videoId: "bu1SVg2zW_k", title: "Дельфин-кик с олимпийской пловчихой", channelTitle: "Speedo / Sutton" },
  { videoId: "8ZJHdiRtG6M", title: "Открытая вода: советы новичкам", channelTitle: "Dan Swim Coach" },
  { videoId: "cI-7GKB6W1A", title: "Плавание в открытой воде в разных условиях", channelTitle: "Ocean Walker" },
  { videoId: "Hxdp7_klHk4", title: "Первый заплыв на открытой воде", channelTitle: "MySwimPro" }
];

const VIDEOS_PER_PAGE = 36;

const state = {
  activeTab: "home",
  editingId: null,
  videoItems: [],
  apiOk: false,
  user: null,
  newsItems: [],
  myApplications: [],
  adminNewsList: [],
  adminApplicationsList: [],
  discussionsView: "list",
  discussionsPostId: null,
  discussionsThreadCache: null,
  discussionsEditingCommentId: null
};

const scheduleBody = document.getElementById("schedule-body");
const scheduleDayFilter = document.getElementById("schedule-day-filter");
const scheduleLevelFilter = document.getElementById("schedule-level-filter");
const scheduleSearch = document.getElementById("schedule-search");
const scheduleSummary = document.getElementById("schedule-summary");
const scheduleResetFilters = document.getElementById("schedule-reset-filters");
const sessionSelect = document.getElementById("session-select");
const coachesContainer = document.getElementById("coaches-grid");
const bookingForm = document.getElementById("booking-form");
const applicationsSearch = document.getElementById("applications-search");
const messageEl = document.getElementById("message");
const newsList = document.getElementById("news-list");
const photoGallery = document.getElementById("photo-gallery");
const videoGallery = document.getElementById("video-gallery");
const videoSearchInput = document.getElementById("video-search");
const cancelEditButton = document.getElementById("cancel-edit");
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function formatApplicationDateTime(iso) {
  if (!iso) {
    return "—";
  }
  try {
    const d = new Date(String(iso));
    if (Number.isNaN(d.getTime())) {
      return String(iso);
    }
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

function formatRuDate(iso) {
  try {
    const d = new Date(`${String(iso).trim()}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      return String(iso);
    }
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return String(iso);
  }
}

function getCoachInitials(name) {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return String(name)
    .slice(0, 2)
    .toUpperCase();
}

function sessionsForCoach(coachName) {
  return schedule.filter((s) => s.coach === coachName);
}

function buildSessionHtml(session, sessionId) {
  if (!session) {
    return `<div class="application-session application-session--warn">Тренировка из расписания не найдена. <code>${escapeHtml(sessionId)}</code></div>`;
  }
  return `
    <div class="application-session">
      <span class="application-session__when">${escapeHtml(session.day)} · ${escapeHtml(session.time)}</span>
      <span class="application-session__detail">Группа: ${escapeHtml(session.level)} · тренер: ${escapeHtml(session.coach)}</span>
    </div>
  `;
}

function onlyDigits(value) {
  return String(value).replace(/\D/g, "");
}

function getBelarusNationalDigits(value) {
  const d = onlyDigits(value);
  if (d.startsWith("375")) {
    return d.slice(3, 12);
  }
  if (d.length <= 9) {
    return d.slice(0, 9);
  }
  return d.slice(-9);
}

/**
 * Формат: +375 XX XXX-XX-XX (код страны и 9 цифр номера).
 */
function applyPhoneMask(value) {
  const d = onlyDigits(value);
  if (!d.length) {
    return "";
  }

  let national = "";
  if (d.startsWith("375")) {
    national = d.slice(3, 12);
  } else {
    national = d.slice(0, 9);
  }

  if (!national.length) {
    return d.startsWith("375") ? "+375 " : "";
  }

  let out = "+375";
  out += " ";
  out += national.slice(0, Math.min(2, national.length));
  if (national.length > 2) {
    out += " " + national.slice(2, Math.min(5, national.length));
  }
  if (national.length > 5) {
    out += "-" + national.slice(5, Math.min(7, national.length));
  }
  if (national.length > 7) {
    out += "-" + national.slice(7, 9);
  }
  return out;
}

function getFieldError(field, value) {
  if (field === "name") {
    if (!value.trim()) {
      return "Укажите имя.";
    }
    if (value.trim().length < 2) {
      return "Имя слишком короткое.";
    }
  }
  if (field === "phone") {
    const national = getBelarusNationalDigits(value);
    if (national.length !== 9) {
      return "Укажите белорусский номер: +375 и 9 цифр.";
    }
  }
  if (field === "session") {
    if (!value) {
      return "Выберите тренировку.";
    }
  }
  return "";
}

function setFieldError(field, text) {
  const node = document.querySelector(`[data-error-for="${field}"]`);
  if (!node) {
    return;
  }
  if (!text) {
    node.textContent = "";
    node.classList.add("hidden");
    return;
  }
  node.textContent = text;
  node.classList.remove("hidden");
}

function validateApplication(data) {
  const errors = {
    name: getFieldError("name", data.name),
    phone: getFieldError("phone", data.phone),
    session: getFieldError("session", data.sessionId)
  };
  Object.keys(errors).forEach((key) => setFieldError(key, errors[key]));
  return !Object.values(errors).some(Boolean);
}

function mapApplicationFromApi(row) {
  if (!row || row.id == null) {
    return null;
  }
  const sessionId = row.session_id != null ? row.session_id : row.sessionId;
  const createdAt = row.created_at != null ? row.created_at : row.createdAt;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    sessionId,
    level: row.level,
    created_at: createdAt || null
  };
}

function getApplications() {
  return state.myApplications;
}

async function refreshSessionsFromApi() {
  if (!state.apiOk) {
    return;
  }
  try {
    const rows = await apiFetch("/sessions");
    schedule = Array.isArray(rows) ? rows : [];
  } catch {
    /* keep previous schedule */
  }
  populateScheduleFilters();
  renderSessionOptions();
  renderSchedule();
  renderCoaches();
}

async function refreshMyApplications() {
  if (!state.user || !state.apiOk) {
    state.myApplications = [];
    return;
  }
  try {
    const raw = await apiFetch("/me/applications", { headers: authHeaders() });
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw && raw.applications) ? raw.applications : [];
    state.myApplications = rows.map(mapApplicationFromApi).filter(Boolean);
  } catch {
    state.myApplications = [];
  }
}

function countForSession(sessionId, ignoreId = null) {
  const sessionRow = schedule.find((s) => s.id === sessionId);
  if (sessionRow && typeof sessionRow.booked === "number") {
    let b = sessionRow.booked;
    if (ignoreId) {
      const prev = state.myApplications.find((a) => a.id === ignoreId);
      if (prev && prev.sessionId === sessionId) {
        b = Math.max(0, b - 1);
      }
    }
    return b;
  }
  return state.myApplications.filter((app) => app.sessionId === sessionId && app.id !== ignoreId).length;
}

function sessionLabel(item) {
  return `${item.day} | ${item.time} | ${item.level}`;
}

function findSession(id) {
  return schedule.find((s) => s.id === id);
}

function getFilteredScheduleRows() {
  const day = scheduleDayFilter ? scheduleDayFilter.value : "";
  const level = scheduleLevelFilter ? scheduleLevelFilter.value : "";
  const q = scheduleSearch ? scheduleSearch.value.trim().toLowerCase() : "";

  return schedule.filter((item) => {
    if (day && item.day !== day) {
      return false;
    }
    if (level && item.level !== level) {
      return false;
    }
    if (q) {
      const hay = `${item.day} ${item.time} ${item.level} ${item.coach}`.toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function coachPageHref(coachName) {
  const c = coaches.find((x) => x.name === coachName);
  return c ? `coach-${c.slug}.html` : null;
}

function scheduleLevelBadgeClass(level) {
  if (/начинающ/i.test(level)) {
    return "schedule-badge schedule-badge--beginner";
  }
  if (/средн/i.test(level)) {
    return "schedule-badge schedule-badge--mid";
  }
  if (/продвинут/i.test(level)) {
    return "schedule-badge schedule-badge--advanced";
  }
  if (/семейн/i.test(level)) {
    return "schedule-badge schedule-badge--family";
  }
  return "schedule-badge";
}

function ruTrainingWord(n) {
  const abs = n % 100;
  const rem = abs % 10;
  if (abs >= 11 && abs <= 14) {
    return "тренировок";
  }
  if (rem === 1) {
    return "тренировка";
  }
  if (rem >= 2 && rem <= 4) {
    return "тренировки";
  }
  return "тренировок";
}

function renderSchedule() {
  if (!scheduleBody) {
    return;
  }
  scheduleBody.innerHTML = "";
  const rows = getFilteredScheduleRows();
  const totalSlots = schedule.length;

  if (scheduleSummary) {
    const hasFilters =
      (scheduleDayFilter && scheduleDayFilter.value) ||
      (scheduleLevelFilter && scheduleLevelFilter.value) ||
      (scheduleSearch && scheduleSearch.value.trim());
    if (totalSlots === 0) {
      scheduleSummary.textContent = "Расписание пока не заполнено.";
    } else if (rows.length === 0) {
      scheduleSummary.textContent = hasFilters
        ? "По текущим фильтрам слотов нет — измените день, уровень или поиск."
        : "Нет строк для отображения.";
    } else if (hasFilters) {
      scheduleSummary.textContent = `Показано слотов: ${rows.length} из ${totalSlots}. Сбросьте фильтры, чтобы увидеть всё расписание.`;
    } else {
      scheduleSummary.textContent = `В расписании ${totalSlots} ${ruTrainingWord(
        totalSlots
      )} — свободные места считаются по заявкам на сервере.`;
    }
  }

  if (!rows.length && totalSlots > 0) {
    const tr = document.createElement("tr");
    tr.className = "schedule-row--empty";
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "schedule-empty-cell";
    td.textContent = "Нет слотов по выбранным условиям.";
    tr.appendChild(td);
    scheduleBody.appendChild(tr);
    return;
  }

  if (!rows.length) {
    if (totalSlots === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "schedule-empty-cell";
      td.textContent = "Тренировки скоро появятся.";
      tr.appendChild(td);
      scheduleBody.appendChild(tr);
    }
    return;
  }

  rows.forEach((item) => {
    const booked =
      typeof item.booked === "number" ? item.booked : countForSession(item.id);
    const free = Math.max(0, item.capacity - booked);
    const pct = item.capacity ? Math.min(100, Math.round((booked / item.capacity) * 100)) : 0;
    const dayShort = dayShortRu[item.day] || item.day.slice(0, 2);
    const coachHref = coachPageHref(item.coach);
    const coachHtml = coachHref
      ? `<a class="schedule-coach" href="${coachHref}">${escapeHtml(item.coach)}</a>`
      : escapeHtml(item.coach);
    const levelClass = scheduleLevelBadgeClass(item.level);
    let rowMod = "";
    if (free === 0) {
      rowMod = " schedule-row--full";
    } else if (free <= 2) {
      rowMod = " schedule-row--few";
    }
    const hint =
      free === 0
        ? "группа заполнена"
        : free <= 2
          ? "осталось мало мест"
          : "есть места";

    const tr = document.createElement("tr");
    tr.className = `schedule-row${rowMod}`;
    tr.innerHTML = `
      <td data-label="День">
        <span class="schedule-day">
          <abbr class="schedule-day__short" title="${escapeHtml(item.day)}">${escapeHtml(dayShort)}</abbr>
          <span class="schedule-day__full">${escapeHtml(item.day)}</span>
        </span>
      </td>
      <td data-label="Время"><span class="schedule-time">${escapeHtml(item.time)}</span></td>
      <td data-label="Группа"><span class="${levelClass}">${escapeHtml(item.level)}</span></td>
      <td data-label="Тренер">${coachHtml}</td>
      <td data-label="Места">
        <div class="schedule-capacity" title="Занято ${booked} из ${item.capacity} мест (данные сервера)">
          <div class="schedule-capacity__top">
            <span class="schedule-capacity__free">${free}</span>
            <span class="schedule-capacity__slash">/</span>
            <span class="schedule-capacity__cap">${item.capacity}</span>
            <span class="schedule-capacity__hint">${escapeHtml(hint)}</span>
          </div>
          <div class="schedule-capacity__bar" role="presentation"><span style="width:${pct}%"></span></div>
        </div>
      </td>
    `;
    scheduleBody.appendChild(tr);
  });
}

function renderSessionOptions() {
  if (!sessionSelect) {
    return;
  }
  sessionSelect.innerHTML = "";
  schedule.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = sessionLabel(item);
    sessionSelect.appendChild(option);
  });
}

function renderCoaches() {
  if (!coachesContainer) {
    return;
  }
  coachesContainer.innerHTML = "";
  coaches.forEach((coach) => {
    const initials = getCoachInitials(coach.name);
    const sessions = sessionsForCoach(coach.name);
    const tagsHtml = coach.tags
      .map((t) => `<li class="coach-card__tag">${escapeHtml(t)}</li>`)
      .join("");
    const scheduleHtml =
      sessions.length > 0
        ? `<ul class="coach-card__sessions">${sessions
            .map(
              (s) =>
                `<li><span class="coach-card__sess-day">${escapeHtml(
                  dayShortRu[s.day] || s.day
                )}</span><span class="coach-card__sess-meta">${escapeHtml(s.time)} · ${escapeHtml(
                  s.level
                )}</span></li>`
            )
            .join("")}</ul>`
        : `<p class="coach-card__sessions-empty">Нет слотов в текущем расписании.</p>`;

    const article = document.createElement("article");
    article.className = "coach-card";
    article.innerHTML = `
      <div class="coach-card__top">
        <div class="coach-card__avatar" aria-hidden="true">${escapeHtml(initials)}</div>
        <div class="coach-card__head">
          <h3 class="coach-card__name">${escapeHtml(coach.name)}</h3>
          <p class="coach-card__role">${escapeHtml(coach.role)}</p>
        </div>
      </div>
      <p class="coach-card__spec">${escapeHtml(coach.specialization)}</p>
      <p class="coach-card__tagline">${escapeHtml(coach.tagline)}</p>
      <p class="coach-card__bio">${escapeHtml(coach.bio)}</p>
      <ul class="coach-card__tags" aria-label="Направления работы">${tagsHtml}</ul>
      <dl class="coach-card__facts">
        <div class="coach-card__fact">
          <dt>Опыт</dt>
          <dd>${coach.experienceYears} лет</dd>
        </div>
        <div class="coach-card__fact">
          <dt>Квалификация</dt>
          <dd>${escapeHtml(coach.certification)}</dd>
        </div>
      </dl>
      <div class="coach-card__sessions-block">
        <p class="coach-card__sessions-title">Группы по расписанию клуба</p>
        ${scheduleHtml}
      </div>
      <div class="coach-card__actions">
        <a class="btn btn-ghost" href="coach-${escapeHtml(coach.slug)}.html">Подробнее</a>
        <a class="btn coach-card__book" href="#booking-requests" data-tab-link="booking-requests">Записаться</a>
      </div>
    `;
    coachesContainer.appendChild(article);
  });
}

function renderApplications() {
  const mainList = document.getElementById("applications-list");
  const cabinetApps = document.getElementById("cabinet-apps-list");
  const containers = [mainList, cabinetApps].filter(Boolean);
  if (!containers.length) {
    return;
  }
  const applications = getApplications();
  const term = applicationsSearch ? applicationsSearch.value.trim().toLowerCase() : "";

  const filtered = applications.filter((app) => {
    if (!term) {
      return true;
    }
    const session = findSession(app.sessionId);
    const sessionStr = session
      ? `${session.day} ${session.time} ${session.level} ${session.coach}`
      : String(app.sessionId || "");
    const whenHay = app.created_at ? ` ${formatApplicationDateTime(app.created_at)}` : "";
    const hay = `${app.name} ${app.phone} ${sessionStr} ${app.level}${whenHay}`.toLowerCase();
    return hay.includes(term);
  });

  containers.forEach((listEl) => {
    listEl.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.className = "applications-empty";
      empty.textContent = applications.length
        ? "По запросу ничего не найдено — попробуйте другие слова."
        : "Пока нет заявок. Отправьте форму выше.";
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach((app) => {
        const session = findSession(app.sessionId);
        const item = document.createElement("li");
        item.className = "application-card";
        const whenStr = formatApplicationDateTime(app.created_at);
        item.innerHTML = `
        <div class="application-card__head">
          <div class="application-card__title">
            <span class="application-card__name">${escapeHtml(app.name)}</span>
            <span class="application-card__badge">${escapeHtml(app.level)}</span>
          </div>
          <div class="application-card__actions">
            <button class="btn btn-ghost" type="button" data-edit-id="${escapeHtml(app.id)}">Изменить</button>
            <button class="btn btn-danger-ghost" type="button" data-delete-id="${escapeHtml(app.id)}">Удалить</button>
          </div>
        </div>
        <p class="application-card__meta"><time datetime="${escapeHtml(app.created_at || "")}">${escapeHtml(whenStr)}</time></p>
        <div class="application-card__body">
          <div class="application-row">
            <p class="application-row__label">Телефон</p>
            <p class="application-row__value application-row__value--phone">${escapeHtml(app.phone)}</p>
          </div>
          <div class="application-row">
            <p class="application-row__label">Тренировка</p>
            <div class="application-row__value">${buildSessionHtml(session, app.sessionId)}</div>
          </div>
        </div>
      `;
        listEl.appendChild(item);
      });

    listEl.querySelectorAll("[data-edit-id]").forEach((btn) => {
      btn.addEventListener("click", () => fillFormForEdit(btn.getAttribute("data-edit-id")));
    });
    listEl.querySelectorAll("[data-delete-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteApplication(btn.getAttribute("data-delete-id")));
    });
  });
}

async function deleteApplication(id) {
  if (!state.apiOk || !state.user) {
    return;
  }
  try {
    await apiFetch(`/me/applications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (state.editingId === id) {
      resetEditState();
    }
    await refreshSessionsFromApi();
    await refreshMyApplications();
    renderApplications();
    renderSchedule();
    renderCabinetProfile();
    setMessage("Заявка удалена.");
  } catch (e) {
    setMessage(e.message || "Не удалось удалить заявку.");
  }
}

function resetEditState() {
  state.editingId = null;
  bookingForm.reset();
  if (cancelEditButton) {
    cancelEditButton.classList.add("hidden");
  }
  setFieldError("name", "");
  setFieldError("phone", "");
  setFieldError("session", "");
}

function fillFormForEdit(id) {
  const app = getApplications().find((a) => a.id === id);
  if (!app) {
    return;
  }
  state.editingId = id;
  bookingForm.name.value = app.name;
  bookingForm.phone.value = app.phone;
  bookingForm.session.value = app.sessionId;
  bookingForm.level.value = app.level;
  if (cancelEditButton) {
    cancelEditButton.classList.remove("hidden");
  }
  setMessage("Редактирование заявки — внесите изменения и сохраните.");
  activateTab("booking-requests");
}

function setMessage(text) {
  messageEl.textContent = text;
  window.setTimeout(() => {
    if (messageEl.textContent === text) {
      messageEl.textContent = "";
    }
  }, 4000);
}

function renderHomeContent() {
  if (newsList) {
    newsList.innerHTML = "";
    state.newsItems.forEach((n) => {
      const el = document.createElement("article");
      el.className = "news-item";
      const tagBlock = n.tag
        ? `<span class="news-item__tag">${escapeHtml(n.tag)}</span>`
        : "";
      const dateStr = formatRuDate(n.date);
      el.innerHTML = `
        <div class="news-item__meta">
          ${tagBlock}
          <time class="news-item__time" datetime="${escapeHtml(n.date)}">${escapeHtml(dateStr)}</time>
        </div>
        <h3 class="news-item__title">${escapeHtml(n.title)}</h3>
        <p class="news-item__text">${escapeHtml(n.text)}</p>
      `;
      newsList.appendChild(el);
    });
  }

  if (photoGallery) {
    photoGallery.innerHTML = "";
    photoItems.forEach((p) => {
      const el = document.createElement("article");
      el.className = "media-item";
      const safeSrc = escapeHtml(p.src);
      el.innerHTML = `
        <img class="media-item__img" src="${safeSrc}" alt="${escapeHtml(p.title)}" width="640" height="480" loading="lazy" decoding="async" />
        <div class="media-item__overlay" aria-hidden="true"></div>
        <div class="media-item__inner">
          <span class="media-item__title">${escapeHtml(p.title)}</span>
          <span class="media-item__caption">${escapeHtml(p.caption)}</span>
        </div>
      `;
      photoGallery.appendChild(el);
    });
  }
}

function getUniqueSwimVideos() {
  const uniqueById = new Map();
  swimVideoItems.forEach((video) => {
    const id = String(video.videoId || "").trim();
    if (!id || uniqueById.has(id)) {
      return;
    }
    uniqueById.set(id, {
      ...video,
      watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`
    });
  });
  return Array.from(uniqueById.values()).slice(0, VIDEOS_PER_PAGE);
}

function renderVideoContent() {
  if (!videoGallery) {
    return;
  }
  const searchTerm = videoSearchInput ? videoSearchInput.value.trim().toLowerCase() : "";
  const filteredVideos = state.videoItems.filter((video) => video.title.toLowerCase().includes(searchTerm));
  const videosToShow = filteredVideos.slice(0, VIDEOS_PER_PAGE);

  videoGallery.innerHTML = "";

  if (!videosToShow.length) {
    videoGallery.innerHTML = `<p class="empty-state">Видео не найдены. Измените поисковый запрос.</p>`;
    return;
  }

  videosToShow.forEach((video) => {
    const item = document.createElement("article");
    item.className = "video-item";
    item.innerHTML = `
      <iframe
        src="${video.embedUrl}"
        title="${video.title}"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
      <p><strong>${video.title}</strong> — ${video.channelTitle || "YouTube"}</p>
      <a class="btn" href="${video.watchUrl}" target="_blank" rel="noopener noreferrer">Открыть в YouTube</a>
    `;
    videoGallery.appendChild(item);
  });
}

function activateTab(name) {
  let tab = name;
  if (tab === "admin" && (!state.user || state.user.role !== "admin")) {
    tab = "home";
  }
  if (tab === "cabinet" && (!state.apiOk || !state.user)) {
    tab = "home";
  }
  state.activeTab = tab;
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tabTarget === tab);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === tab);
  });
  const safe = tab.replace(/[^a-z0-9-]/gi, "");
  window.location.hash = safe ? `#${safe}` : "";
  if (tab === "admin" && state.user && state.user.role === "admin") {
    loadAdminPanel();
  }
  if (tab === "discussions") {
    onDiscussionsTabActivated();
  }
}

function syncTabFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  const valid = tabPanels.map((p) => p.dataset.tabPanel);
  if (raw && valid.includes(raw)) {
    activateTab(raw);
    return;
  }
  activateTab(state.activeTab || "home");
}

function populateScheduleFilters() {
  if (scheduleDayFilter) {
    const days = Array.from(new Set(schedule.map((s) => s.day)));
    const current = scheduleDayFilter.value;
    scheduleDayFilter.innerHTML = '<option value="">Все дни</option>';
    days.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      scheduleDayFilter.appendChild(opt);
    });
    scheduleDayFilter.value = current;
  }
  if (scheduleLevelFilter) {
    const levels = Array.from(new Set(schedule.map((s) => s.level)));
    const current = scheduleLevelFilter.value;
    scheduleLevelFilter.innerHTML = '<option value="">Все уровни</option>';
    levels.forEach((lv) => {
      const opt = document.createElement("option");
      opt.value = lv;
      opt.textContent = lv;
      scheduleLevelFilter.appendChild(opt);
    });
    scheduleLevelFilter.value = current;
  }
}

const authToolbar = document.getElementById("auth-toolbar");
const tabBtnAdmin = document.getElementById("tab-btn-admin");
const tabBtnCabinet = document.getElementById("tab-btn-cabinet");

function updateCabinetTabVisibility() {
  if (!tabBtnCabinet) {
    return;
  }
  const hideCabinet = !state.apiOk || !state.user;
  tabBtnCabinet.classList.toggle("hidden", hideCabinet);
  if (hideCabinet && state.activeTab === "cabinet") {
    activateTab("home");
  }
}

let adminEditingSessionId = null;
let adminEditingNewsId = null;

function updateAccessGates() {
  const offline = !state.apiOk;
  const logged = Boolean(state.user);
  const bookingApiOffline = document.getElementById("booking-api-offline");
  const bookingGuestGate = document.getElementById("booking-guest-gate");
  const bookingUserBlocks = document.getElementById("booking-user-blocks");
  const videoApiOffline = document.getElementById("video-api-offline");
  const videoGuestGate = document.getElementById("video-guest-gate");
  const videoUserSection = document.getElementById("video-user-section");
  [bookingApiOffline, videoApiOffline].forEach((el) => {
    if (el) {
      el.classList.toggle("hidden", !offline);
    }
  });
  [bookingGuestGate, videoGuestGate].forEach((el) => {
    if (el) {
      el.classList.toggle("hidden", offline || logged);
    }
  });
  if (bookingUserBlocks) {
    bookingUserBlocks.classList.toggle("hidden", offline || !logged);
  }
  if (videoUserSection) {
    videoUserSection.classList.toggle("hidden", offline || !logged);
  }
}

function renderAuthToolbar() {
  if (!authToolbar) {
    return;
  }
  if (!state.apiOk) {
    authToolbar.innerHTML = `<span class="auth-toolbar__hint">API недоступен</span>`;
    if (tabBtnAdmin) {
      tabBtnAdmin.classList.add("hidden");
    }
    updateCabinetTabVisibility();
    updateSiteChatSubtitle();
    syncDiscussionsAuthUi();
    return;
  }
  if (state.user) {
    authToolbar.innerHTML = `
      <span class="auth-toolbar__user">${escapeHtml(state.user.name || state.user.email)}</span>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-open-cabinet">Личный кабинет</button>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-logout">Выйти</button>
    `;
    document.getElementById("btn-open-cabinet")?.addEventListener("click", () => activateTab("cabinet"));
    document.getElementById("btn-logout")?.addEventListener("click", () => logout());
  } else {
    authToolbar.innerHTML = `
      <button type="button" class="btn btn-ghost btn-sm" id="btn-open-login">Вход</button>
      <button type="button" class="btn btn-sm" id="btn-open-register">Регистрация</button>
    `;
    document.getElementById("btn-open-login")?.addEventListener("click", () => openLoginModal());
    document.getElementById("btn-open-register")?.addEventListener("click", () => openRegisterModal());
  }
  if (tabBtnAdmin) {
    tabBtnAdmin.classList.toggle("hidden", !state.user || state.user.role !== "admin");
  }
  updateCabinetTabVisibility();
  updateSiteChatSubtitle();
  syncDiscussionsAuthUi();
}

function renderCabinetProfile() {
  const dl = document.getElementById("cabinet-profile-dl");
  const hint = document.getElementById("cabinet-guest-hint");
  if (hint) {
    hint.classList.toggle("hidden", Boolean(state.user));
  }
  if (dl) {
    dl.classList.toggle("hidden", !state.user);
    if (state.user) {
      dl.innerHTML = `
        <div class="cabinet-dl__row"><dt>Email</dt><dd>${escapeHtml(state.user.email)}</dd></div>
        <div class="cabinet-dl__row"><dt>Имя</dt><dd>${escapeHtml(state.user.name)}</dd></div>
        <div class="cabinet-dl__row"><dt>Телефон</dt><dd>${escapeHtml(state.user.phone)}</dd></div>
        <div class="cabinet-dl__row"><dt>Роль</dt><dd>${escapeHtml(
          state.user.role === "admin" ? "Администратор" : "Участник"
        )}</dd></div>
      `;
    }
  }
}

function openLoginModal() {
  resetLoginModalToCredentials();
  const m = document.getElementById("modal-login");
  const err = document.getElementById("login-error");
  if (err) {
    err.textContent = "";
  }
  if (m) {
    m.classList.remove("hidden");
  }
}

function resetLoginModalToCredentials() {
  const cred = document.getElementById("login-credentials-block");
  const forgot = document.getElementById("login-forgot-panel");
  const title = document.getElementById("modal-login-title");
  const forgotForm = document.getElementById("form-forgot-password");
  const forgotErr = document.getElementById("forgot-error");
  const forgotOk = document.getElementById("forgot-success");
  if (cred) {
    cred.classList.remove("hidden");
  }
  if (forgot) {
    forgot.classList.add("hidden");
  }
  if (title) {
    title.textContent = "Вход";
  }
  if (forgotForm) {
    forgotForm.reset();
  }
  if (forgotErr) {
    forgotErr.textContent = "";
  }
  if (forgotOk) {
    forgotOk.textContent = "";
    forgotOk.classList.add("hidden");
  }
}

function openRegisterModal() {
  const m = document.getElementById("modal-register");
  const err = document.getElementById("register-error");
  if (err) {
    err.textContent = "";
  }
  if (m) {
    m.classList.remove("hidden");
  }
}

function closeModals() {
  resetLoginModalToCredentials();
  document.querySelectorAll(".modal-overlay").forEach((el) => el.classList.add("hidden"));
}

function initPasswordVisibilityToggles() {
  document.querySelectorAll("[data-password-for]").forEach((btn) => {
    const id = btn.getAttribute("data-password-for");
    const input = id ? document.getElementById(id) : null;
    if (!input || input.tagName !== "INPUT") {
      return;
    }
    btn.addEventListener("click", () => {
      const revealed = input.type === "password";
      input.type = revealed ? "text" : "password";
      btn.setAttribute("aria-pressed", revealed ? "true" : "false");
      btn.setAttribute("aria-label", revealed ? "Скрыть пароль" : "Показать пароль");
    });
  });
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  state.user = null;
  state.myApplications = [];
  adminEditingSessionId = null;
  adminEditingNewsId = null;
  resetEditState();
  renderAuthToolbar();
  updateAccessGates();
  renderApplications();
  renderCabinetProfile();
  activateTab("home");
}

async function loadAdminPanel() {
  if (!state.user || state.user.role !== "admin") {
    return;
  }
  await refreshSessionsFromApi();
  try {
    const news = await apiFetch("/news");
    state.adminNewsList = Array.isArray(news) ? news : [];
  } catch {
    state.adminNewsList = [];
  }
  try {
    const apps = await apiFetch("/admin/applications", { headers: authHeaders() });
    state.adminApplicationsList = Array.isArray(apps) ? apps : [];
  } catch {
    state.adminApplicationsList = [];
  }
  renderAdminSessionsTable();
  renderAdminApplicationsTable();
  renderAdminNewsList();
}

function renderAdminSessionsTable() {
  const mount = document.getElementById("admin-sessions-mount");
  if (!mount) {
    return;
  }
  if (!schedule.length) {
    mount.innerHTML = "<p>Нет слотов.</p>";
    return;
  }
  const rows = schedule
    .map((s) => {
      const booked = typeof s.booked === "number" ? s.booked : "—";
      return `
      <tr>
        <td><code>${escapeHtml(s.id)}</code></td>
        <td>${escapeHtml(s.day)}</td>
        <td>${escapeHtml(s.time)}</td>
        <td>${escapeHtml(s.level)}</td>
        <td>${escapeHtml(s.coach)}</td>
        <td>${escapeHtml(String(s.capacity))}</td>
        <td>${escapeHtml(String(booked))}</td>
        <td class="admin-table-actions">
          <button type="button" class="btn btn-ghost btn-xs" data-admin-edit-session="${escapeHtml(s.id)}">Изменить</button>
          <button type="button" class="btn btn-danger-ghost btn-xs" data-admin-del-session="${escapeHtml(s.id)}">Удалить</button>
        </td>
      </tr>`;
    })
    .join("");
  mount.innerHTML = `<div class="table-wrap"><table class="admin-table schedule-table">
    <thead><tr><th>ID</th><th>День</th><th>Время</th><th>Группа</th><th>Тренер</th><th>Мест</th><th>Занято</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
  mount.querySelectorAll("[data-admin-edit-session]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sid = btn.getAttribute("data-admin-edit-session");
      const sess = schedule.find((x) => x.id === sid);
      if (!sess) {
        return;
      }
      adminEditingSessionId = sid;
      const form = document.getElementById("admin-session-form");
      if (form) {
        if (form.elements.id) {
          form.elements.id.value = sess.id;
        }
        form.elements.day.value = sess.day;
        form.elements.time.value = sess.time;
        form.elements.level.value = sess.level;
        form.elements.coach.value = sess.coach;
        form.elements.capacity.value = sess.capacity;
        const sub = form.querySelector("[type=submit]");
        if (sub) {
          sub.textContent = "Сохранить изменения";
        }
      }
    });
  });
  mount.querySelectorAll("[data-admin-del-session]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const sid = btn.getAttribute("data-admin-del-session");
      if (!window.confirm("Удалить слот?")) {
        return;
      }
      try {
        await apiFetch(`/admin/sessions/${encodeURIComponent(sid)}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        await refreshSessionsFromApi();
        renderAdminSessionsTable();
        updateAccessGates();
      } catch (e) {
        window.alert(e.message || "Ошибка удаления");
      }
    });
  });
}

function renderAdminNewsList() {
  const mount = document.getElementById("admin-news-mount");
  if (!mount) {
    return;
  }
  const list = state.adminNewsList || [];
  if (!list.length) {
    mount.innerHTML = "<p>Нет новостей.</p>";
    return;
  }
  mount.innerHTML = `<ul class="admin-news-list">${list
    .map(
      (n) => `
    <li class="admin-news-item">
      <div class="admin-news-item__body">
        <strong>${escapeHtml(n.title)}</strong>
        <span class="admin-news-item__date">${escapeHtml(n.date)}</span>
        <p>${escapeHtml(n.text)}</p>
      </div>
      <div class="admin-news-item__actions">
        <button type="button" class="btn btn-ghost btn-xs" data-admin-edit-news="${escapeHtml(n.id)}">Изменить</button>
        <button type="button" class="btn btn-danger-ghost btn-xs" data-admin-del-news="${escapeHtml(n.id)}">Удалить</button>
      </div>
    </li>`
    )
    .join("")}</ul>`;
  mount.querySelectorAll("[data-admin-edit-news]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nid = btn.getAttribute("data-admin-edit-news");
      const n = list.find((x) => x.id === nid);
      if (!n) {
        return;
      }
      adminEditingNewsId = nid;
      const form = document.getElementById("admin-news-form");
      if (form) {
        form.elements.title.value = n.title;
        form.elements.date.value = n.date;
        form.elements.tag.value = n.tag || "";
        form.elements.text.value = n.text;
        const sub = form.querySelector("[type=submit]");
        if (sub) {
          sub.textContent = "Сохранить новость";
        }
      }
    });
  });
  mount.querySelectorAll("[data-admin-del-news]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nid = btn.getAttribute("data-admin-del-news");
      if (!window.confirm("Удалить новость?")) {
        return;
      }
      try {
        await apiFetch(`/admin/news/${encodeURIComponent(nid)}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        const news = await apiFetch("/news");
        state.adminNewsList = Array.isArray(news) ? news : [];
        state.newsItems = state.adminNewsList.slice();
        renderHomeContent();
        renderAdminNewsList();
      } catch (e) {
        window.alert(e.message || "Ошибка");
      }
    });
  });
}

function renderAdminApplicationsTable() {
  const mount = document.getElementById("admin-applications-mount");
  if (!mount) {
    return;
  }
  const list = state.adminApplicationsList || [];
  if (!list.length) {
    mount.innerHTML = "<p>Заявок пока нет.</p>";
    return;
  }
  const rows = list
    .map((row) => {
      const sess = schedule.find((s) => s.id === row.session_id);
      const slot = sess
        ? `${escapeHtml(sess.day)} · ${escapeHtml(sess.time)} · ${escapeHtml(sess.coach)}`
        : escapeHtml(row.session_id || "—");
      const userCell = row.user
        ? `${escapeHtml(row.user.name)}<br><span class="admin-app-email">${escapeHtml(row.user.email)}</span>`
        : `<span class="admin-app-orphan">Нет пользователя в базе</span><br><code>${escapeHtml(
            row.user_id || ""
          )}</code>`;
      return `
      <tr>
        <td><time datetime="${escapeHtml(row.created_at || "")}">${escapeHtml(
          formatApplicationDateTime(row.created_at)
        )}</time></td>
        <td>${userCell}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.phone)}</td>
        <td>${slot}</td>
        <td>${escapeHtml(row.level)}</td>
        <td class="admin-table-actions">
          <button type="button" class="btn btn-danger-ghost btn-xs" data-admin-del-app="${escapeHtml(
            row.id
          )}">Удалить</button>
        </td>
      </tr>`;
    })
    .join("");
  mount.innerHTML = `<div class="table-wrap"><table class="admin-table schedule-table admin-applications-table">
    <thead><tr>
      <th>Дата</th>
      <th>Участник</th>
      <th>Имя в заявке</th>
      <th>Телефон</th>
      <th>Тренировка</th>
      <th>Уровень</th>
      <th></th>
    </tr></thead>
    <tbody>${rows}</tbody></table></div>`;

  mount.querySelectorAll("[data-admin-del-app]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-admin-del-app");
      if (!id || !window.confirm("Удалить эту заявку? Место в слоте станет свободным.")) {
        return;
      }
      try {
        await apiFetch(`/admin/applications/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        await refreshSessionsFromApi();
        const apps = await apiFetch("/admin/applications", { headers: authHeaders() });
        state.adminApplicationsList = Array.isArray(apps) ? apps : [];
        renderAdminApplicationsTable();
        await refreshMyApplications();
        renderApplications();
        renderSchedule();
      } catch (e) {
        window.alert(e.message || "Ошибка удаления");
      }
    });
  });
}

async function loadInitialData() {
  const banner = document.getElementById("api-offline-banner");
  try {
    await apiFetch("/health");
    state.apiOk = true;
  } catch {
    state.apiOk = false;
  }
  if (banner) {
    if (!state.apiOk) {
      banner.classList.remove("hidden");
      banner.textContent =
        "Сервер API недоступен. Запустите npm run dev и откройте сайт через http://localhost:3000.";
    } else {
      banner.classList.add("hidden");
      banner.textContent = "";
    }
  }

  if (state.apiOk) {
    try {
      const rows = await apiFetch("/sessions");
      schedule = Array.isArray(rows) ? rows : [];
    } catch {
      schedule = [];
    }
    try {
      const news = await apiFetch("/news");
      state.newsItems = Array.isArray(news) ? news : [];
    } catch {
      state.newsItems = [];
    }
  }

  const tok = localStorage.getItem(TOKEN_KEY);
  if (tok && state.apiOk) {
    try {
      const me = await apiFetch("/auth/me", { headers: { Authorization: `Bearer ${tok}` } });
      state.user = me.user;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      state.user = null;
    }
  } else {
    state.user = null;
  }

  if (state.user && state.apiOk) {
    await refreshMyApplications();
  } else {
    state.myApplications = [];
  }
}

if (bookingForm) {
  bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = String(bookingForm.name.value || "").trim();
  const phoneRaw = String(bookingForm.phone.value || "");
  const sessionId = String(bookingForm.session.value || "");
  const level = String(bookingForm.level.value || "");
  const wasEditing = Boolean(state.editingId);

  if (!validateApplication({ name, phone: phoneRaw, sessionId })) {
    setMessage("Исправьте ошибки в форме.");
    return;
  }

  const normalizedPhone = applyPhoneMask(phoneRaw);
  bookingForm.phone.value = normalizedPhone;

  const targetSession = findSession(sessionId);
  if (!targetSession) {
    setMessage("Тренировка не найдена.");
    return;
  }

  const booked = countForSession(sessionId, state.editingId);
  if (booked >= targetSession.capacity) {
    setMessage("На эту тренировку уже нет свободных мест.");
    return;
  }

  const body = { name, phone: normalizedPhone, sessionId, level };
  try {
    let saved = null;
    if (state.editingId) {
      saved = await apiFetch(`/me/applications/${encodeURIComponent(state.editingId)}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } else {
      saved = await apiFetch("/me/applications", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }
    resetEditState();
    await refreshSessionsFromApi();
    await refreshMyApplications();
    const mapped = mapApplicationFromApi(saved);
    if (mapped) {
      const has = state.myApplications.some((a) => a.id === mapped.id);
      if (!has) {
        state.myApplications = [mapped, ...state.myApplications];
      } else {
        state.myApplications = state.myApplications.map((a) => (a.id === mapped.id ? mapped : a));
      }
    }
    renderApplications();
    renderSchedule();
    renderCabinetProfile();
    setMessage(wasEditing ? "Заявка обновлена." : "Заявка успешно отправлена.");
  } catch (e) {
    setMessage(e.message || "Не удалось сохранить заявку.");
  }
});
}

if (cancelEditButton) {
  cancelEditButton.addEventListener("click", () => {
    resetEditState();
    setMessage("Редактирование отменено.");
  });
}

if (applicationsSearch) {
  applicationsSearch.addEventListener("input", () => renderApplications());
}

if (scheduleDayFilter) {
  scheduleDayFilter.addEventListener("change", () => renderSchedule());
}
if (scheduleLevelFilter) {
  scheduleLevelFilter.addEventListener("change", () => renderSchedule());
}
if (scheduleSearch) {
  scheduleSearch.addEventListener("input", () => renderSchedule());
}

if (scheduleResetFilters) {
  scheduleResetFilters.addEventListener("click", () => {
    if (scheduleDayFilter) {
      scheduleDayFilter.value = "";
    }
    if (scheduleLevelFilter) {
      scheduleLevelFilter.value = "";
    }
    if (scheduleSearch) {
      scheduleSearch.value = "";
    }
    populateScheduleFilters();
    renderSchedule();
  });
}

const phoneInput = document.getElementById("field-phone");
if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    const cursor = phoneInput.selectionStart;
    const before = phoneInput.value;
    phoneInput.value = applyPhoneMask(before);
    if (typeof cursor === "number") {
      phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    }
  });
}

const regPhoneInput = document.getElementById("reg-phone");
if (regPhoneInput) {
  regPhoneInput.addEventListener("input", () => {
    regPhoneInput.value = applyPhoneMask(regPhoneInput.value);
  });
}

document.getElementById("gate-booking-login")?.addEventListener("click", () => openLoginModal());
document.getElementById("gate-booking-register")?.addEventListener("click", () => openRegisterModal());
document.getElementById("gate-video-login")?.addEventListener("click", () => openLoginModal());
document.getElementById("gate-video-register")?.addEventListener("click", () => openRegisterModal());

document.getElementById("login-show-forgot")?.addEventListener("click", () => {
  const cred = document.getElementById("login-credentials-block");
  const forgot = document.getElementById("login-forgot-panel");
  const title = document.getElementById("modal-login-title");
  const forgotErr = document.getElementById("forgot-error");
  const forgotOk = document.getElementById("forgot-success");
  if (cred) {
    cred.classList.add("hidden");
  }
  if (forgot) {
    forgot.classList.remove("hidden");
  }
  if (title) {
    title.textContent = "Восстановление пароля";
  }
  if (forgotErr) {
    forgotErr.textContent = "";
  }
  if (forgotOk) {
    forgotOk.textContent = "";
    forgotOk.classList.add("hidden");
  }
});

document.getElementById("login-back-from-forgot")?.addEventListener("click", () => {
  resetLoginModalToCredentials();
});

document.getElementById("form-forgot-password")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("forgot-error");
  const okEl = document.getElementById("forgot-success");
  if (errEl) {
    errEl.textContent = "";
  }
  if (okEl) {
    okEl.classList.add("hidden");
    okEl.textContent = "";
  }
  const fd = new FormData(e.target);
  const emailRaw = fd.get("email");
  if (!isReasonableEmail(emailRaw)) {
    if (errEl) {
      errEl.textContent = "Укажите действительный адрес электронной почты.";
    }
    return;
  }
  try {
    const data = await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: emailRaw })
    });
    if (okEl && data && data.message) {
      okEl.textContent = data.message;
      okEl.classList.remove("hidden");
    }
  } catch (ex) {
    if (errEl) {
      errEl.textContent = ex.message || "Ошибка запроса.";
    }
  }
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay || ev.target.closest("[data-close-modal]")) {
      closeModals();
    }
  });
});

document.getElementById("form-login")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("login-error");
  if (err) {
    err.textContent = "";
  }
  const fd = new FormData(e.target);
  const emailLogin = fd.get("email");
  if (!isReasonableEmail(emailLogin)) {
    if (err) {
      err.textContent = "Укажите действительный адрес электронной почты.";
    }
    return;
  }
  try {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: emailLogin,
        password: fd.get("password")
      })
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    state.user = res.user;
    closeModals();
    await refreshMyApplications();
    await refreshSessionsFromApi();
    renderAuthToolbar();
    updateAccessGates();
    renderApplications();
    renderCabinetProfile();
  } catch (ex) {
    if (err) {
      err.textContent = ex.message || "Ошибка входа.";
    }
  }
});

document.getElementById("form-register")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("register-error");
  if (err) {
    err.textContent = "";
  }
  const passEl = document.getElementById("reg-password");
  const confirmEl = document.getElementById("reg-password-confirm");
  const pass = passEl ? String(passEl.value) : "";
  const pass2 = confirmEl ? String(confirmEl.value) : "";
  if (pass !== pass2) {
    if (err) {
      err.textContent = "Пароли не совпадают.";
    }
    return;
  }
  const fd = new FormData(e.target);
  const emailReg = fd.get("email");
  if (!isReasonableEmail(emailReg)) {
    if (err) {
      err.textContent = "Укажите действительный адрес электронной почты.";
    }
    return;
  }
  try {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: fd.get("name"),
        phone: fd.get("phone"),
        email: emailReg,
        password: fd.get("password")
      })
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    state.user = res.user;
    closeModals();
    e.target.reset();
    await refreshMyApplications();
    await refreshSessionsFromApi();
    renderAuthToolbar();
    updateAccessGates();
    renderApplications();
    renderCabinetProfile();
    activateTab("booking-requests");
  } catch (ex) {
    if (err) {
      err.textContent = ex.message || "Ошибка регистрации.";
    }
  }
});

document.getElementById("admin-session-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const capacity = Number(fd.get("capacity"));
  const payload = {
    day: String(fd.get("day")).trim(),
    time: String(fd.get("time")).trim(),
    level: String(fd.get("level")).trim(),
    coach: String(fd.get("coach")).trim(),
    capacity
  };
  const optId = String(fd.get("id") || "").trim();
  try {
    if (adminEditingSessionId) {
      await apiFetch(`/admin/sessions/${encodeURIComponent(adminEditingSessionId)}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      const body = optId ? { ...payload, id: optId } : payload;
      await apiFetch("/admin/sessions", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }
    adminEditingSessionId = null;
    e.target.reset();
    const sub = e.target.querySelector("[type=submit]");
    if (sub) {
      sub.textContent = "Добавить слот";
    }
    await refreshSessionsFromApi();
    renderAdminSessionsTable();
    updateAccessGates();
  } catch (ex) {
    window.alert(ex.message || "Ошибка");
  }
});

document.getElementById("admin-news-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    title: String(fd.get("title")).trim(),
    text: String(fd.get("text")).trim(),
    tag: String(fd.get("tag") || "").trim(),
    date: String(fd.get("date")).trim()
  };
  try {
    if (adminEditingNewsId) {
      await apiFetch(`/admin/news/${encodeURIComponent(adminEditingNewsId)}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch("/admin/news", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
    adminEditingNewsId = null;
    e.target.reset();
    const sub = e.target.querySelector("[type=submit]");
    if (sub) {
      sub.textContent = "Добавить новость";
    }
    const news = await apiFetch("/news");
    state.adminNewsList = Array.isArray(news) ? news : [];
    state.newsItems = state.adminNewsList.slice();
    renderHomeContent();
    renderAdminNewsList();
  } catch (ex) {
    window.alert(ex.message || "Ошибка");
  }
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tabTarget));
});

document.addEventListener("click", (event) => {
  const tabLink = event.target.closest("[data-tab-link]");
  if (!tabLink || !tabLink.dataset.tabLink) {
    return;
  }
  event.preventDefault();
  activateTab(tabLink.dataset.tabLink);
});

window.addEventListener("hashchange", syncTabFromHash);

let siteChatPollTimer = null;

function stopSiteChatPolling() {
  if (siteChatPollTimer != null) {
    clearInterval(siteChatPollTimer);
    siteChatPollTimer = null;
  }
}

function ensureSiteChatPolling() {
  stopSiteChatPolling();
  siteChatPollTimer = window.setInterval(() => {
    const panel = document.getElementById("site-chat-panel");
    if (!panel || panel.classList.contains("hidden")) {
      return;
    }
    if (!state.user) {
      return;
    }
    void loadSiteChatThread(true);
  }, 4000);
}

function formatChatTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function renderSiteChatHint(htmlSafeText) {
  const el = document.getElementById("site-chat-messages");
  if (!el) {
    return;
  }
  el.innerHTML = `<p class="site-chat__hint">${htmlSafeText}</p>`;
}

function renderSiteChatMessagesFromServer(messages) {
  const el = document.getElementById("site-chat-messages");
  if (!el) {
    return;
  }
  const myId = state.user && state.user.id;
  if (!Array.isArray(messages) || messages.length === 0) {
    el.innerHTML = `<p class="site-chat__hint">Пока нет сообщений. Напишите первым.</p>`;
    return;
  }
  el.innerHTML = messages
    .map((m) => {
      const mine = m.from_user_id === myId;
      const side = mine ? "user" : "peer";
      const bubble = escapeHtml(m.text).replace(/\n/g, "<br>");
      const authorLine =
        mine || !m.author_name
          ? ""
          : `<div class="site-chat__msg-author">${escapeHtml(String(m.author_name))}</div>`;
      return `<div class="site-chat__msg site-chat__msg--${side}">
      ${authorLine}
      <div class="site-chat__msg-bubble">${bubble}</div>
      <time class="site-chat__msg-time" datetime="${escapeHtml(m.created_at)}">${escapeHtml(formatChatTime(m.created_at))}</time>
    </div>`;
    })
    .join("");
  el.scrollTop = el.scrollHeight;
}

async function loadSiteChatThread(silent) {
  if (!state.user) {
    return;
  }
  try {
    const rows = await apiFetch("/me/chat/messages", {
      headers: { ...authHeaders() }
    });
    renderSiteChatMessagesFromServer(Array.isArray(rows) ? rows : []);
  } catch (ex) {
    if (!silent) {
      window.alert(ex.message || "Не удалось загрузить сообщения");
      renderSiteChatHint(escapeHtml("Не удалось обновить чат. Проверьте соединение."));
    }
  }
}

function syncSiteChatChrome() {
  const form = document.getElementById("site-chat-form");
  const guest = !state.user;
  if (form) {
    form.classList.toggle("hidden", guest);
  }
  if (guest) {
    stopSiteChatPolling();
    renderSiteChatHint(
      escapeHtml("Войдите в аккаунт, чтобы общаться в чате со всеми зарегистрированными участниками клуба.")
    );
  }
}

function updateSiteChatSubtitle() {
  const sub = document.getElementById("site-chat-subtitle");
  if (!sub) {
    return;
  }
  if (state.user) {
    sub.textContent = "Все участники видят эти сообщения";
  } else {
    sub.textContent = "Доступно после входа";
  }
  syncSiteChatChrome();
  if (state.user && state.apiOk) {
    void loadSiteChatThread(true);
  }
}

function syncDiscussionsAuthUi() {
  const createWrap = document.getElementById("discussions-create-wrap");
  const guestHint = document.getElementById("discussions-list-guest");
  if (!createWrap || !guestHint) {
    return;
  }
  const logged = Boolean(state.user);
  const ok = state.apiOk;
  createWrap.classList.toggle("hidden", !ok || !logged);
  guestHint.classList.toggle("hidden", !ok || logged);
}

function discussionCanEditDiscussion(authorId) {
  const u = state.user;
  if (!u || !authorId) {
    return false;
  }
  if (u.role === "admin") {
    return true;
  }
  return u.id === authorId;
}

function hideDiscussionPostEditUi() {
  document.getElementById("discussions-thread-post-read")?.classList.remove("hidden");
  document.getElementById("discussions-edit-post-form")?.classList.add("hidden");
  const err = document.getElementById("discussions-edit-post-error");
  if (err) {
    err.classList.add("hidden");
    err.textContent = "";
  }
}

function hideDiscussionCommentEditUi() {
  state.discussionsEditingCommentId = null;
  document.getElementById("discussions-edit-comment-wrap")?.classList.add("hidden");
  const err = document.getElementById("discussions-edit-comment-error");
  if (err) {
    err.classList.add("hidden");
    err.textContent = "";
  }
  const ta = document.getElementById("discussions-edit-comment-body");
  if (ta) {
    ta.value = "";
  }
}

function resetDiscussionsEditors() {
  state.discussionsThreadCache = null;
  hideDiscussionPostEditUi();
  hideDiscussionCommentEditUi();
}

function showDiscussionsListView() {
  state.discussionsView = "list";
  state.discussionsPostId = null;
  resetDiscussionsEditors();
  const listV = document.getElementById("discussions-list-view");
  const threadV = document.getElementById("discussions-thread-view");
  if (listV) {
    listV.classList.remove("hidden");
  }
  if (threadV) {
    threadV.classList.add("hidden");
  }
  document.getElementById("discussions-new-form")?.classList.add("hidden");
}

function showDiscussionsThreadView(postId) {
  state.discussionsView = "thread";
  state.discussionsPostId = postId;
  const listV = document.getElementById("discussions-list-view");
  const threadV = document.getElementById("discussions-thread-view");
  if (listV) {
    listV.classList.add("hidden");
  }
  if (threadV) {
    threadV.classList.remove("hidden");
  }
}

function renderDiscussionsPostList(posts) {
  const listEl = document.getElementById("discussions-post-list");
  if (!listEl) {
    return;
  }
  if (!posts.length) {
    listEl.innerHTML = `<li class="discussion-empty">Пока нет тем — создайте первую после входа.</li>`;
    return;
  }
  listEl.innerHTML = posts
    .map((p) => {
      const meta = `${escapeHtml(p.author_name)} · ${escapeHtml(formatChatTime(p.created_at))} · ${Number(p.comment_count) || 0} комм.`;
      return `<li class="discussion-post-item">
      <button type="button" class="discussion-post-row" data-post-id="${escapeHtml(p.id)}">
        <span class="discussion-post-row__title">${escapeHtml(p.title)}</span>
        <span class="discussion-post-row__preview">${escapeHtml(p.body_preview || "")}</span>
        <span class="discussion-post-row__meta">${meta}</span>
      </button>
    </li>`;
    })
    .join("");
}

async function loadDiscussionsList() {
  const listEl = document.getElementById("discussions-post-list");
  const offline = document.getElementById("discussions-list-offline");
  if (!listEl) {
    return;
  }
  if (!state.apiOk) {
    listEl.innerHTML = "";
    offline?.classList.remove("hidden");
    return;
  }
  offline?.classList.add("hidden");
  try {
    const posts = await apiFetch("/discussions");
    renderDiscussionsPostList(Array.isArray(posts) ? posts : []);
  } catch {
    listEl.innerHTML = "";
    offline?.classList.remove("hidden");
  }
}

function renderDiscussionsThreadPost(post) {
  const postRead = document.getElementById("discussions-thread-post-read");
  if (!postRead) {
    return;
  }
  hideDiscussionPostEditUi();
  const bodyHtml = escapeHtml(post.body || "").replace(/\n/g, "<br>");
  const editBtn = discussionCanEditDiscussion(post.author_id)
    ? `<p class="discussion-post-actions"><button type="button" class="btn btn-ghost btn-sm" id="discussions-edit-post-open">Редактировать тему</button></p>`
    : "";
  postRead.innerHTML = `<header class="discussion-thread-head">
      <h2 class="discussion-thread-title">${escapeHtml(post.title)}</h2>
      <p class="discussion-thread-meta">${escapeHtml(post.author_name)} · ${escapeHtml(formatChatTime(post.created_at))}</p>
    </header>
    <div class="discussion-thread-body">${bodyHtml || '<p class="discussion-empty-body">(Без текста)</p>'}</div>${editBtn}`;
}

function renderDiscussionsThreadComments(comments) {
  const commentsEl = document.getElementById("discussions-thread-comments");
  if (!commentsEl) {
    return;
  }
  if (!comments.length) {
    commentsEl.innerHTML = `<li class="discussion-empty">Пока без комментариев.</li>`;
    return;
  }
  commentsEl.innerHTML = comments
    .map((c) => {
      const html = escapeHtml(c.body).replace(/\n/g, "<br>");
      const canEdit = discussionCanEditDiscussion(c.author_id);
      const editLine = canEdit
        ? `<p class="discussion-comment-actions"><button type="button" class="btn btn-ghost btn-xs" data-comment-edit="${escapeHtml(c.id)}">Редактировать</button></p>`
        : "";
      return `<li class="discussion-comment-item" data-comment-id="${escapeHtml(c.id)}">
      <div class="discussion-comment-body">${html}</div>
      <footer class="discussion-comment-meta">${escapeHtml(c.author_name)} · ${escapeHtml(formatChatTime(c.created_at))}</footer>${editLine}
    </li>`;
    })
    .join("");
}

function syncDiscussionsThreadChrome() {
  const form = document.getElementById("discussions-comment-form");
  const guest = document.getElementById("discussions-comment-guest");
  const logged = Boolean(state.user);
  if (form) {
    form.classList.toggle("hidden", !logged);
  }
  if (guest) {
    guest.classList.toggle("hidden", logged);
  }
  if (!logged) {
    hideDiscussionCommentEditUi();
  }
}

async function loadDiscussionsThread(postId) {
  const postRead = document.getElementById("discussions-thread-post-read");
  const commentsEl = document.getElementById("discussions-thread-comments");
  if (!postRead || !commentsEl) {
    return;
  }
  hideDiscussionPostEditUi();
  hideDiscussionCommentEditUi();
  state.discussionsThreadCache = null;
  state.discussionsEditingCommentId = null;
  postRead.innerHTML = `<p class="discussion-loading">Загрузка…</p>`;
  commentsEl.innerHTML = "";
  syncDiscussionsThreadChrome();
  try {
    const data = await apiFetch(`/discussions/${encodeURIComponent(postId)}`);
    if (!data || !data.post) {
      throw new Error("empty");
    }
    state.discussionsThreadCache = {
      post: data.post,
      comments: Array.isArray(data.comments) ? data.comments : []
    };
    renderDiscussionsThreadPost(data.post);
    renderDiscussionsThreadComments(state.discussionsThreadCache.comments);
    syncDiscussionsThreadChrome();
  } catch {
    postRead.innerHTML = `<p class="discussion-error">Не удалось загрузить тему.</p>`;
  }
}

function onDiscussionsTabActivated() {
  syncDiscussionsAuthUi();
  if (state.discussionsView === "thread" && state.discussionsPostId) {
    const listV = document.getElementById("discussions-list-view");
    const threadV = document.getElementById("discussions-thread-view");
    if (listV) {
      listV.classList.add("hidden");
    }
    if (threadV) {
      threadV.classList.remove("hidden");
    }
    void loadDiscussionsThread(state.discussionsPostId);
  } else {
    showDiscussionsListView();
    void loadDiscussionsList();
  }
}

function initDiscussions() {
  syncDiscussionsAuthUi();
  document.getElementById("discussions-toggle-new")?.addEventListener("click", () => {
    document.getElementById("discussions-new-form")?.classList.toggle("hidden");
  });
  document.getElementById("discussions-cancel-new")?.addEventListener("click", () => {
    document.getElementById("discussions-new-form")?.classList.add("hidden");
    const err = document.getElementById("discussions-new-error");
    if (err) {
      err.classList.add("hidden");
      err.textContent = "";
    }
  });
  document.getElementById("discussions-new-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleIn = document.getElementById("discussions-new-title");
    const bodyIn = document.getElementById("discussions-new-body");
    const errEl = document.getElementById("discussions-new-error");
    const title = (titleIn && titleIn.value ? titleIn.value : "").trim();
    const body = (bodyIn && bodyIn.value ? bodyIn.value : "").trim();
    if (!title) {
      return;
    }
    try {
      const created = await apiFetch("/discussions", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title, body })
      });
      if (titleIn) {
        titleIn.value = "";
      }
      if (bodyIn) {
        bodyIn.value = "";
      }
      document.getElementById("discussions-new-form")?.classList.add("hidden");
      if (errEl) {
        errEl.classList.add("hidden");
        errEl.textContent = "";
      }
      if (created && created.id) {
        showDiscussionsThreadView(created.id);
        await loadDiscussionsThread(created.id);
      } else {
        await loadDiscussionsList();
      }
    } catch (ex) {
      if (errEl) {
        errEl.textContent = ex.message || "Ошибка";
        errEl.classList.remove("hidden");
      }
    }
  });
  document.getElementById("discussions-post-list")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-post-id]");
    if (!btn || !btn.dataset.postId) {
      return;
    }
    showDiscussionsThreadView(btn.dataset.postId);
    void loadDiscussionsThread(btn.dataset.postId);
  });
  document.getElementById("discussions-back-list")?.addEventListener("click", () => {
    showDiscussionsListView();
    void loadDiscussionsList();
  });
  document.getElementById("discussions-comment-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pid = state.discussionsPostId;
    if (!pid || !state.user) {
      return;
    }
    const ta = document.getElementById("discussions-comment-body");
    const errEl = document.getElementById("discussions-comment-error");
    const text = (ta && ta.value ? ta.value : "").trim();
    if (!text) {
      return;
    }
    try {
      await apiFetch(`/discussions/${encodeURIComponent(pid)}/comments`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (ta) {
        ta.value = "";
      }
      if (errEl) {
        errEl.classList.add("hidden");
        errEl.textContent = "";
      }
      await loadDiscussionsThread(pid);
    } catch (ex) {
      if (errEl) {
        errEl.textContent = ex.message || "Ошибка";
        errEl.classList.remove("hidden");
      }
    }
  });

  document.getElementById("discussions-thread-view")?.addEventListener("click", (ev) => {
    if (ev.target.closest("#discussions-edit-post-open")) {
      const cache = state.discussionsThreadCache;
      if (!cache || !cache.post) {
        return;
      }
      const titleIn = document.getElementById("discussions-edit-post-title");
      const bodyIn = document.getElementById("discussions-edit-post-body");
      if (titleIn) {
        titleIn.value = cache.post.title;
      }
      if (bodyIn) {
        bodyIn.value = cache.post.body || "";
      }
      document.getElementById("discussions-thread-post-read")?.classList.add("hidden");
      document.getElementById("discussions-edit-post-form")?.classList.remove("hidden");
      const pe = document.getElementById("discussions-edit-post-error");
      if (pe) {
        pe.classList.add("hidden");
        pe.textContent = "";
      }
    }
    const editBtn = ev.target.closest("[data-comment-edit]");
    if (editBtn && editBtn.getAttribute("data-comment-edit")) {
      const cid = editBtn.getAttribute("data-comment-edit");
      const cache = state.discussionsThreadCache;
      if (!cache || !Array.isArray(cache.comments)) {
        return;
      }
      const c = cache.comments.find((x) => x.id === cid);
      if (!c) {
        return;
      }
      state.discussionsEditingCommentId = cid;
      const ta = document.getElementById("discussions-edit-comment-body");
      if (ta) {
        ta.value = c.body;
      }
      document.getElementById("discussions-edit-comment-wrap")?.classList.remove("hidden");
      const ce = document.getElementById("discussions-edit-comment-error");
      if (ce) {
        ce.classList.add("hidden");
        ce.textContent = "";
      }
      ta?.focus();
    }
  });

  document.getElementById("discussions-edit-post-cancel")?.addEventListener("click", () => {
    hideDiscussionPostEditUi();
  });

  document.getElementById("discussions-edit-post-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pid = state.discussionsPostId;
    if (!pid || !state.user) {
      return;
    }
    const titleIn = document.getElementById("discussions-edit-post-title");
    const bodyIn = document.getElementById("discussions-edit-post-body");
    const errEl = document.getElementById("discussions-edit-post-error");
    const title = (titleIn && titleIn.value ? titleIn.value : "").trim();
    const body = (bodyIn && bodyIn.value ? bodyIn.value : "").trim();
    if (!title) {
      return;
    }
    try {
      await apiFetch(`/discussions/${encodeURIComponent(pid)}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title, body })
      });
      hideDiscussionPostEditUi();
      await loadDiscussionsThread(pid);
      await loadDiscussionsList();
    } catch (ex) {
      if (errEl) {
        errEl.textContent = ex.message || "Ошибка";
        errEl.classList.remove("hidden");
      }
    }
  });

  document.getElementById("discussions-edit-comment-cancel")?.addEventListener("click", () => {
    hideDiscussionCommentEditUi();
  });

  document.getElementById("discussions-edit-comment-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pid = state.discussionsPostId;
    const cid = state.discussionsEditingCommentId;
    if (!pid || !cid || !state.user) {
      return;
    }
    const ta = document.getElementById("discussions-edit-comment-body");
    const errEl = document.getElementById("discussions-edit-comment-error");
    const text = (ta && ta.value ? ta.value : "").trim();
    if (!text) {
      return;
    }
    try {
      await apiFetch(`/discussions/${encodeURIComponent(pid)}/comments/${encodeURIComponent(cid)}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      hideDiscussionCommentEditUi();
      await loadDiscussionsThread(pid);
      await loadDiscussionsList();
    } catch (ex) {
      if (errEl) {
        errEl.textContent = ex.message || "Ошибка";
        errEl.classList.remove("hidden");
      }
    }
  });
}

function setSiteChatOpen(open) {
  const panel = document.getElementById("site-chat-panel");
  const fab = document.getElementById("site-chat-toggle");
  const input = document.getElementById("site-chat-input");
  if (!panel || !fab) {
    return;
  }
  panel.classList.toggle("hidden", !open);
  fab.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    updateSiteChatSubtitle();
    if (state.user) {
      void loadSiteChatThread(false).then(() => {
        requestAnimationFrame(() => input?.focus());
      });
      ensureSiteChatPolling();
    }
  } else {
    stopSiteChatPolling();
  }
}

function initSiteChat() {
  const root = document.getElementById("site-chat");
  const fab = document.getElementById("site-chat-toggle");
  const panel = document.getElementById("site-chat-panel");
  const closeBtn = document.getElementById("site-chat-close");
  const form = document.getElementById("site-chat-form");
  const input = document.getElementById("site-chat-input");
  if (!root || !fab || !panel || !form || !input) {
    return;
  }
  updateSiteChatSubtitle();

  fab.addEventListener("click", () => {
    const willOpen = panel.classList.contains("hidden");
    setSiteChatOpen(willOpen);
  });
  closeBtn?.addEventListener("click", () => setSiteChatOpen(false));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.user) {
      return;
    }
    const text = input.value.trim();
    if (!text) {
      return;
    }
    input.value = "";
    try {
      await apiFetch("/me/chat/messages", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      await loadSiteChatThread(false);
    } catch (ex) {
      window.alert(ex.message || "Не удалось отправить сообщение");
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || panel.classList.contains("hidden")) {
      return;
    }
    setSiteChatOpen(false);
  });
}

if (videoSearchInput) {
  videoSearchInput.addEventListener("input", () => renderVideoContent());
}

async function bootstrap() {
  initPasswordVisibilityToggles();
  state.videoItems = getUniqueSwimVideos();
  await loadInitialData();
  populateScheduleFilters();
  renderSchedule();
  renderSessionOptions();
  renderCoaches();
  renderAuthToolbar();
  updateAccessGates();
  renderApplications();
  renderHomeContent();
  renderVideoContent();
  renderCabinetProfile();
  initSiteChat();
  initDiscussions();
  syncTabFromHash();
}

bootstrap();
