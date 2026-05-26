const STORAGE_KEYS = {
  checkins: "calendar_checkins",
  memos: "calendar_memos",
  notes: "daily_notes",
  theme: "app_theme",
};

const APP_NAME = "365.dev";
const BACKUP_VERSION = 1;
const THEME_META = { light: "#5a7fa8", dark: "#0f1114" };

const STATUS_MAP = {
  success: { icon: "✓", class: "success", label: "成功" },
  partial: { icon: "○", class: "partial", label: "差点" },
  fail: { icon: "✗", class: "fail", label: "失败" },
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_NAMES = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

// ===== 工具函数 =====
function formatDateKey(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function getTodayKey() {
  const now = new Date();
  return formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function migrateCheckins(data) {
  const migrated = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (typeof value === "string") {
      migrated[key] = { status: value, summary: "" };
    } else if (value && value.status) {
      migrated[key] = {
        status: value.status,
        summary: value.summary || "",
      };
    }
  });
  return migrated;
}

function getCheckinRecord(dateKey) {
  const value = checkins[dateKey];
  if (!value) return null;
  if (typeof value === "string") return { status: value, summary: "" };
  return value;
}

function formatDisplayDate(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(year, month, day);
  return `${year}年${month + 1}月${day}日 · 星期${WEEKDAYS[date.getDay()]}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatMemoTime(iso) {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${d}日 ${h}:${min}`;
}

function formatInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code class=\"memo-code\">$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  return html;
}

function formatMemoContent(content, skipFirstLine = false) {
  let lines = content.split("\n");
  if (skipFirstLine && lines.filter((l) => l.trim()).length > 1) {
    const firstNonEmpty = lines.findIndex((l) => l.trim());
    if (firstNonEmpty >= 0) {
      lines = [...lines.slice(0, firstNonEmpty), ...lines.slice(firstNonEmpty + 1)];
    }
  }

  let html = "";
  let inList = false;
  let inOrderedList = false;

  const closeLists = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    if (inOrderedList) {
      html += "</ol>";
      inOrderedList = false;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      html += '<div class="memo-spacer"></div>';
      return;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      closeLists();
      html += '<hr class="memo-hr" />';
      return;
    }

    if (/^[-•*]\s/.test(trimmed)) {
      if (inOrderedList) {
        html += "</ol>";
        inOrderedList = false;
      }
      if (!inList) {
        html += '<ul class="memo-list">';
        inList = true;
      }
      html += `<li><span class="memo-list-text">${formatInlineMarkdown(trimmed.replace(/^[-•*]\s/, ""))}</span></li>`;
      return;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (!inOrderedList) {
        html += '<ol class="memo-list memo-list-ordered">';
        inOrderedList = true;
      }
      html += `<li><span class="memo-list-text">${formatInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</span></li>`;
      return;
    }

    closeLists();

    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)[0].length;
      const text = trimmed.replace(/^#{1,3}\s/, "");
      html += `<h4 class="memo-heading memo-heading-${level}">${formatInlineMarkdown(text)}</h4>`;
      return;
    }

    if (/^>\s/.test(trimmed)) {
      html += `<blockquote class="memo-blockquote">${formatInlineMarkdown(trimmed.replace(/^>\s/, ""))}</blockquote>`;
      return;
    }

    html += `<p class="memo-paragraph">${formatInlineMarkdown(trimmed)}</p>`;
  });

  closeLists();
  return html || '<p class="memo-empty-text">（空内容）</p>';
}

function loadMemos() {
  const stored = loadJSON(STORAGE_KEYS.memos, null);
  if (Array.isArray(stored)) {
    return stored.map((memo) => ({
      ...memo,
      pinned: !!memo.pinned,
    }));
  }

  const legacyNotes = loadJSON(STORAGE_KEYS.notes, {});
  const migrated = Object.entries(legacyNotes)
    .filter(([, text]) => text && text.trim())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, text]) => ({
      id: `legacy-${dateKey}`,
      content: text.trim(),
      pinned: false,
      createdAt: `${dateKey}T12:00:00.000Z`,
      updatedAt: `${dateKey}T12:00:00.000Z`,
    }));

  if (migrated.length) saveJSON(STORAGE_KEYS.memos, migrated);
  return migrated;
}

function sortMemos(list) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function getMemoTitle(content) {
  return content.trim().split("\n")[0] || "无标题";
}

function renderMemoCard(memo) {
  const preview = getMemoTitle(memo.content);
  const pinLabel = memo.pinned ? "取消置顶" : "置顶";
  const pinAction = memo.pinned ? "unpin" : "pin";

  return `
    <article class="memo-card${memo.pinned ? " is-pinned" : ""}" data-id="${memo.id}">
      <div class="memo-card-head">
        <h3 class="memo-title">
          ${memo.pinned ? '<span class="memo-pin-badge">置顶</span>' : ""}
          ${escapeHtml(preview)}
        </h3>
        <time class="memo-time">${formatMemoTime(memo.updatedAt)}</time>
      </div>
      <div class="memo-body">${formatMemoContent(memo.content, true)}</div>
      <div class="memo-actions">
        <button class="memo-btn pin" data-action="${pinAction}" data-id="${memo.id}">${pinLabel}</button>
        <button class="memo-btn edit" data-action="edit" data-id="${memo.id}">编辑</button>
        <button class="memo-btn delete" data-action="delete" data-id="${memo.id}">删除</button>
      </div>
    </article>
  `;
}

// ===== 状态 =====
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDateKey = null;

const checkins = migrateCheckins(loadJSON(STORAGE_KEYS.checkins, {}));
let memos = loadMemos();
let editingMemoId = null;

let summaryYear = new Date().getFullYear();

// ===== 主题 =====
function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  return saved === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(STORAGE_KEYS.theme, t);
  const meta = document.getElementById("meta-theme-color");
  if (meta) meta.content = THEME_META[t];
  document.querySelector("meta[name=color-scheme]")?.setAttribute(
    "content",
    t === "dark" ? "dark" : "light"
  );
  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === t);
  });
}

function initTheme() {
  applyTheme(loadTheme());
}

document.getElementById("theme-options").addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-option");
  if (!btn) return;
  applyTheme(btn.dataset.theme);
});

function getCheckinStats(period = "all", refDate = null) {
  const base = refDate || new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  let success = 0;
  let partial = 0;
  let fail = 0;

  Object.entries(checkins).forEach(([key, value]) => {
    const record = typeof value === "string" ? { status: value } : value;
    if (!record?.status) return;

    const parsed = parseDateKey(key);
    if (period === "year" && parsed.year !== year) return;
    if (period === "month" && (parsed.year !== year || parsed.month !== month)) return;

    if (record.status === "success") success++;
    else if (record.status === "partial") partial++;
    else if (record.status === "fail") fail++;
  });

  const total = success + partial + fail;
  const successRate = total ? Math.round((success / total) * 100) : 0;
  return { success, partial, fail, total, successRate };
}

function getYearStats(year) {
  return getCheckinStats("year", new Date(year, 0, 1));
}

function getSummaryInsight(stats) {
  if (!stats.total) return "还没有打卡数据，去日历页记录第一天吧。";
  if (stats.successRate >= 80) return "状态很好，多数日子都在向目标前进。";
  if (stats.successRate >= 50) return "整体在正轨上，继续稳住节奏。";
  if (stats.partial > stats.fail) return "有不少「差点」，再坚持一点就能更多成功。";
  return "别灰心，每一天的记录都是在重新出发。";
}

// ===== 底部导航 =====
function updateHeaderVisibility(tabName) {
  document.getElementById("app-header").classList.toggle("header-hidden", tabName !== "calendar");
}

function switchTab(tabName) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabName);
  });
  document.querySelectorAll("#main-view .panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabName}-panel`);
  });

  updateHeaderVisibility(tabName);

  if (tabName === "records") renderRecords();
  if (tabName === "memos") renderMemos();
  if (tabName === "summary") renderSummary();
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => switchTab(item.dataset.tab));
});

const HEADER_CLICKS_NEEDED = 5;
const HEADER_CLICK_WINDOW = 2000;
let headerClickCount = 0;
let headerClickTimer = null;

function openDataPanel() {
  document.getElementById("main-view").classList.add("hidden");
  document.getElementById("bottom-nav").classList.add("hidden");
  document.getElementById("data-panel").classList.remove("hidden");
  renderDataPanel();
}

function closeDataPanel() {
  document.getElementById("data-panel").classList.add("hidden");
  document.getElementById("main-view").classList.remove("hidden");
  document.getElementById("bottom-nav").classList.remove("hidden");
  const activeTab = document.querySelector(".nav-item.active")?.dataset.tab || "calendar";
  updateHeaderVisibility(activeTab);
}

document.getElementById("app-header").addEventListener("click", () => {
  if (!document.getElementById("data-panel").classList.contains("hidden")) return;

  headerClickCount += 1;
  clearTimeout(headerClickTimer);
  if (headerClickCount >= HEADER_CLICKS_NEEDED) {
    headerClickCount = 0;
    openDataPanel();
    return;
  }
  headerClickTimer = setTimeout(() => {
    headerClickCount = 0;
  }, HEADER_CLICK_WINDOW);
});

document.getElementById("data-back-btn").addEventListener("click", closeDataPanel);

function getTodayQuoteIndex() {
  return (getDayOfYear(new Date()) - 1) % QUOTES.length;
}

// ===== 顶部每日语录 =====
function renderHeaderQuote() {
  const quote = QUOTES[getTodayQuoteIndex()];
  const authorEl = document.getElementById("header-author");

  document.getElementById("header-quote").textContent = quote.text;

  if (quote.author) {
    authorEl.textContent = `—— ${quote.author}`;
    authorEl.hidden = false;
  } else {
    authorEl.textContent = "";
    authorEl.hidden = true;
  }
}

// ===== 日历模块 =====
function renderCalendar() {
  const grid = document.getElementById("calendar-grid");

  document.getElementById("month-title").textContent =
    `${currentYear}年 ${MONTH_NAMES[currentMonth]}`;

  grid.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayKey = getTodayKey();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(currentYear, currentMonth, day);
    const cell = document.createElement("button");
    cell.className = "day-cell";
    cell.type = "button";

    if (dateKey === todayKey) {
      cell.classList.add("today");
      cell.setAttribute("aria-label", `${day}日（今天）`);
    }

    const numEl = document.createElement("span");
    numEl.className = "day-num";
    numEl.textContent = day;
    cell.appendChild(numEl);

    const record = getCheckinRecord(dateKey);
    if (record && STATUS_MAP[record.status]) {
      const { status } = record;
      cell.classList.add(`status-${status}`);
      const iconEl = document.createElement("span");
      iconEl.className = `status-icon ${STATUS_MAP[status].class}`;
      iconEl.textContent = STATUS_MAP[status].icon;
      cell.appendChild(iconEl);
    }

    cell.addEventListener("click", () => openModal(dateKey));
    grid.appendChild(cell);
  }

  renderMonthStats();
}

function renderMonthStats() {
  const stats = getCheckinStats("month", new Date(currentYear, currentMonth, 1));
  const statsEl = document.getElementById("month-stats");

  statsEl.innerHTML = `
    <div class="stat-item success">
      <div class="stat-num">${stats.success}</div>
      <div class="stat-label">成功</div>
    </div>
    <div class="stat-item partial">
      <div class="stat-num">${stats.partial}</div>
      <div class="stat-label">差点</div>
    </div>
    <div class="stat-item fail">
      <div class="stat-num">${stats.fail}</div>
      <div class="stat-label">失败</div>
    </div>
  `;
}

function renderSummary() {
  renderYearCalendar(summaryYear);

  const stats = getYearStats(summaryYear);
  document.getElementById("summary-subtitle").textContent = `${summaryYear} 年打卡统计`;

  const overviewEl = document.getElementById("summary-overview");
  if (!stats.total) {
    overviewEl.innerHTML = `
      <div class="summary-empty">
        <p class="summary-empty-title">暂无打卡数据</p>
        <p class="summary-empty-hint">在日历页完成第一次打卡后，这里会显示汇总</p>
      </div>
    `;
    document.getElementById("summary-cards").innerHTML = "";
    document.getElementById("summary-bar").innerHTML = "";
    document.getElementById("summary-insight").innerHTML = "";
  } else {
    overviewEl.innerHTML = `
      <div class="summary-flat-overview">
        <div class="flat-stat highlight">
          <span class="flat-stat-num">${stats.successRate}%</span>
          <span class="flat-stat-label">成功率</span>
        </div>
        <div class="flat-stat">
          <span class="flat-stat-num">${stats.total}</span>
          <span class="flat-stat-label">总打卡</span>
        </div>
      </div>
    `;

    document.getElementById("summary-cards").innerHTML = `
      <article class="summary-card success">
        <span class="summary-card-num">${stats.success}</span>
        <span class="summary-card-label">成功</span>
      </article>
      <article class="summary-card partial">
        <span class="summary-card-num">${stats.partial}</span>
        <span class="summary-card-label">差点</span>
      </article>
      <article class="summary-card fail">
        <span class="summary-card-num">${stats.fail}</span>
        <span class="summary-card-label">失败</span>
      </article>
    `;

    const successPct = (stats.success / stats.total) * 100;
    const partialPct = (stats.partial / stats.total) * 100;
    const failPct = (stats.fail / stats.total) * 100;

    document.getElementById("summary-bar").innerHTML = `
      <p class="summary-bar-title">占比分布</p>
      <div class="summary-bar">
        <span class="bar-seg success" style="width:${successPct}%"></span>
        <span class="bar-seg partial" style="width:${partialPct}%"></span>
        <span class="bar-seg fail" style="width:${failPct}%"></span>
      </div>
      <div class="summary-bar-legend">
        <span><i class="dot success"></i>成功 ${stats.success}</span>
        <span><i class="dot partial"></i>差点 ${stats.partial}</span>
        <span><i class="dot fail"></i>失败 ${stats.fail}</span>
      </div>
    `;

    document.getElementById("summary-insight").innerHTML = `
      <p class="insight-text">${getSummaryInsight(stats)}</p>
    `;
  }
}

function updateModalStatusSelection(status) {
  document.querySelectorAll(".status-btn").forEach((btn) => {
    const active = btn.dataset.status === status;
    btn.classList.toggle("selected", active);
  });
}

function openModal(dateKey) {
  selectedDateKey = dateKey;
  const { year, month, day } = parseDateKey(dateKey);
  const record = getCheckinRecord(dateKey);

  document.getElementById("modal-date").textContent = `${year}年${month + 1}月${day}日`;
  summaryInput.value = record?.summary || "";
  updateModalStatusSelection(record?.status || "success");
  modal.classList.remove("hidden");
  summaryInput.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  selectedDateKey = null;
  summaryInput.value = "";
  document.querySelectorAll(".status-btn").forEach((btn) => btn.classList.remove("selected"));
}

function clearCheckinAt(dateKey) {
  if (!getCheckinRecord(dateKey)) return;
  const { year, month, day } = parseDateKey(dateKey);
  if (!confirm(`确定清除 ${year}年${month + 1}月${day}日的打卡记录？`)) return;

  delete checkins[dateKey];
  saveJSON(STORAGE_KEYS.checkins, checkins);
  renderCalendar();
  renderSummary();
}

function buildMiniDayHtml(year, month, day, todayKey) {
  const dateKey = formatDateKey(year, month, day);
  const record = getCheckinRecord(dateKey);
  let cls = "mini-day";
  if (dateKey === todayKey) cls += " today";
  if (record?.status) cls += ` status-${record.status}`;

  const statusHtml = record?.status
    ? `<span class="mini-day-icon status-icon ${STATUS_MAP[record.status].class}">${STATUS_MAP[record.status].icon}</span>`
    : "";

  const label = record?.status
    ? `${month + 1}月${day}日 ${STATUS_MAP[record.status].label}`
    : `${month + 1}月${day}日`;

  return `<button type="button" class="${cls}" data-date="${dateKey}" aria-label="${label}">
    <span class="mini-day-num">${day}</span>${statusHtml}
  </button>`;
}

function bindMiniDayEvents(container) {
  container.querySelectorAll(".mini-day[data-date]").forEach((btn) => {
    const dateKey = btn.dataset.date;
    let pressTimer = null;
    let longPressed = false;

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const startPress = () => {
      longPressed = false;
      cancelPress();
      if (!getCheckinRecord(dateKey)) return;
      pressTimer = setTimeout(() => {
        longPressed = true;
        clearCheckinAt(dateKey);
      }, 550);
    };

    btn.addEventListener("mousedown", startPress);
    btn.addEventListener("touchstart", startPress, { passive: true });
    btn.addEventListener("mouseup", cancelPress);
    btn.addEventListener("mouseleave", cancelPress);
    btn.addEventListener("touchend", cancelPress);
    btn.addEventListener("touchcancel", cancelPress);

    btn.addEventListener("click", (e) => {
      if (longPressed) {
        e.preventDefault();
        longPressed = false;
        return;
      }
      openModal(dateKey);
    });
  });
}

function renderYearCalendar(year) {
  const headEl = document.getElementById("year-calendar-head");
  const container = document.getElementById("year-calendar");
  const todayKey = getTodayKey();
  const weekdayLabels = WEEKDAYS.map((d) => `<span>${d}</span>`).join("");

  headEl.innerHTML = `
    <h3 class="year-calendar-title">${year} 年全年</h3>
    <div class="year-nav">
      <button type="button" class="btn-icon btn-icon-sm" id="summary-year-prev" aria-label="上一年">‹</button>
      <span class="year-nav-label">${year}</span>
      <button type="button" class="btn-icon btn-icon-sm" id="summary-year-next" aria-label="下一年">›</button>
    </div>
  `;

  let gridHtml = '<div class="year-grid">';
  for (let month = 0; month < 12; month++) {
    gridHtml += `<article class="mini-month">
      <p class="mini-month-title">${MONTH_NAMES[month]}</p>
      <div class="mini-weekdays">${weekdayLabels}</div>
      <div class="mini-days">`;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
      gridHtml += '<span class="mini-day empty"></span>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      gridHtml += buildMiniDayHtml(year, month, day, todayKey);
    }
    gridHtml += "</div></article>";
  }
  gridHtml += "</div>";
  container.innerHTML = gridHtml;
  bindMiniDayEvents(container);

  document.getElementById("summary-year-prev")?.addEventListener("click", () => {
    summaryYear -= 1;
    renderSummary();
  });
  document.getElementById("summary-year-next")?.addEventListener("click", () => {
    summaryYear += 1;
    renderSummary();
  });
}

document.getElementById("prev-month").addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
});

document.getElementById("next-month").addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
});

// ===== 打卡弹窗 =====
const modal = document.getElementById("checkin-modal");
const summaryInput = document.getElementById("checkin-summary");

function saveCheckin(status) {
  if (!selectedDateKey) return;
  checkins[selectedDateKey] = {
    status,
    summary: summaryInput.value.trim(),
  };
  saveJSON(STORAGE_KEYS.checkins, checkins);
  renderCalendar();
  renderSummary();
  closeModal();
}

document.getElementById("close-modal").addEventListener("click", closeModal);
modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);

document.querySelectorAll(".status-btn").forEach((btn) => {
  btn.addEventListener("click", () => saveCheckin(btn.dataset.status));
});

document.getElementById("clear-status").addEventListener("click", () => {
  if (!selectedDateKey) return;
  delete checkins[selectedDateKey];
  saveJSON(STORAGE_KEYS.checkins, checkins);
  renderCalendar();
  renderSummary();
  closeModal();
});

// ===== 打卡记录 =====
function renderRecords() {
  const listEl = document.getElementById("records-list");
  const countEl = document.getElementById("records-count");
  const entries = Object.keys(checkins)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ dateKey: key, ...getCheckinRecord(key) }))
    .filter((item) => item && STATUS_MAP[item.status]);

  countEl.textContent = entries.length ? `共 ${entries.length} 条记录` : "";

  if (!entries.length) {
    listEl.innerHTML = `
      <div class="records-empty">
        <p>还没有打卡记录</p>
        <p class="records-empty-hint">去日历打卡，写下你的第一句话总结吧</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = entries
    .map(({ dateKey, status, summary }) => {
      const meta = STATUS_MAP[status];
      const summaryText = summary
        ? escapeHtml(summary)
        : '<span class="records-no-summary">（未填写总结）</span>';
      return `
        <article class="record-item status-${status}">
          <div class="record-top">
            <time class="record-date">${formatDisplayDate(dateKey)}</time>
            <span class="record-badge ${meta.class}">
              <span class="status-icon ${meta.class}">${meta.icon}</span>
              ${meta.label}
            </span>
          </div>
          <p class="record-summary">${summaryText}</p>
        </article>
      `;
    })
    .join("");
}

function toggleMemoPin(memoId) {
  memos = memos.map((memo) =>
    memo.id === memoId ? { ...memo, pinned: !memo.pinned } : memo
  );
  saveJSON(STORAGE_KEYS.memos, memos);
  renderMemos();
}

function handleMemoAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === "edit") openMemoModal(id);
  if (action === "delete") deleteMemo(id);
  if (action === "pin" || action === "unpin") toggleMemoPin(id);
}

// ===== 备忘录 =====
const memoModal = document.getElementById("memo-modal");
const memoInput = document.getElementById("memo-input");
const memoPinInput = document.getElementById("memo-pin");
const memoModalTitle = document.getElementById("memo-modal-title");

function renderMemos() {
  const listEl = document.getElementById("memos-list");
  const countEl = document.getElementById("memos-count");
  const sorted = sortMemos(memos);
  const pinnedCount = sorted.filter((memo) => memo.pinned).length;

  countEl.textContent = sorted.length
    ? `共 ${sorted.length} 条${pinnedCount ? ` · ${pinnedCount} 条置顶` : ""}`
    : "";

  if (!sorted.length) {
    listEl.innerHTML = `
      <div class="memos-empty">
        <p>还没有备忘录</p>
        <p class="memos-empty-hint">点击右上角「+ 新建」写下第一条吧</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = sorted.map((memo) => renderMemoCard(memo)).join("");
}

function updateMemoPreview() {
  const previewEl = document.getElementById("memo-preview");
  if (!previewEl) return;
  const content = memoInput.value.trim();
  previewEl.innerHTML = content
    ? formatMemoContent(content, false)
    : '<p class="memo-empty-text">输入内容后将在此显示 Markdown 排版效果</p>';
}

function openMemoModal(memoId = null) {
  editingMemoId = memoId;
  const memo = memos.find((item) => item.id === memoId);

  memoModalTitle.textContent = memo ? "编辑备忘录" : "新建备忘录";
  memoInput.value = memo?.content || "";
  memoPinInput.checked = !!memo?.pinned;
  updateMemoPreview();
  memoModal.classList.remove("hidden");
  memoInput.focus();
}

function closeMemoModal() {
  memoModal.classList.add("hidden");
  editingMemoId = null;
  memoInput.value = "";
  memoPinInput.checked = false;
  updateMemoPreview();
}

function saveMemo() {
  const content = memoInput.value.trim();
  if (!content) {
    memoInput.focus();
    return;
  }

  const now = new Date().toISOString();
  const pinned = memoPinInput.checked;

  if (editingMemoId) {
    memos = memos.map((memo) =>
      memo.id === editingMemoId
        ? { ...memo, content, pinned, updatedAt: now }
        : memo
    );
  } else {
    memos.unshift({
      id: `memo-${Date.now()}`,
      content,
      pinned,
      createdAt: now,
      updatedAt: now,
    });
  }

  saveJSON(STORAGE_KEYS.memos, memos);
  closeMemoModal();
  renderMemos();
}

function deleteMemo(memoId) {
  if (!confirm("确定删除这条备忘录吗？")) return;
  memos = memos.filter((memo) => memo.id !== memoId);
  saveJSON(STORAGE_KEYS.memos, memos);
  renderMemos();
}

document.getElementById("new-memo-btn").addEventListener("click", () => openMemoModal());
document.getElementById("save-memo-btn").addEventListener("click", saveMemo);
document.getElementById("cancel-memo-btn").addEventListener("click", closeMemoModal);
memoModal.querySelector(".modal-backdrop").addEventListener("click", closeMemoModal);
memoInput.addEventListener("input", updateMemoPreview);

document.getElementById("memos-list").addEventListener("click", handleMemoAction);

// ===== 数据导出 / 导入 =====
function getDataStats() {
  const checkinCount = Object.keys(checkins).length;
  const memoCount = memos.length;
  return { checkinCount, memoCount };
}

function buildExportPayload() {
  return {
    app: APP_NAME,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      checkins,
      memos,
    },
  };
}

function normalizeImportPayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("文件格式无效");
  }

  if (raw.data && typeof raw.data === "object") {
    return {
      checkins: raw.data.checkins ?? {},
      memos: raw.data.memos ?? [],
    };
  }

  if (raw.checkins || raw.memos) {
    return {
      checkins: raw.checkins ?? {},
      memos: raw.memos ?? [],
    };
  }

  throw new Error("未找到可导入的数据");
}

function validateImportData({ checkins: importedCheckins, memos: importedMemos }) {
  if (importedCheckins && typeof importedCheckins !== "object") {
    throw new Error("打卡数据格式错误");
  }
  if (!Array.isArray(importedMemos)) {
    throw new Error("备忘录数据格式错误");
  }
}

function replaceCheckins(nextCheckins) {
  Object.keys(checkins).forEach((key) => delete checkins[key]);
  Object.assign(checkins, migrateCheckins(nextCheckins || {}));
}

function reloadAppData() {
  renderHeaderQuote();
  renderCalendar();
  renderSummary();
  renderRecords();
  renderMemos();
  renderDataPanel();
}

function renderDataPanel() {
  const { checkinCount, memoCount } = getDataStats();
  document.getElementById("data-stats").textContent =
    `当前：${checkinCount} 条打卡 · ${memoCount} 条备忘录`;
}

function downloadJsonInBrowser(json, fileName) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getCapacitorPlugin(cap, name) {
  if (cap.Plugins?.[name]) return cap.Plugins[name];
  if (typeof cap.registerPlugin === "function") return cap.registerPlugin(name);
  throw new Error(`${name} 插件不可用，请重新安装 App`);
}

async function exportJsonNative(Capacitor, json, fileName) {
  const Filesystem = getCapacitorPlugin(Capacitor, "Filesystem");
  const Share = getCapacitorPlugin(Capacitor, "Share");

  await Filesystem.writeFile({
    path: fileName,
    data: json,
    directory: "CACHE",
    encoding: "utf8",
  });

  const { uri } = await Filesystem.getUri({
    path: fileName,
    directory: "CACHE",
  });

  await Share.share({
    title: `${APP_NAME} 数据备份`,
    files: [uri],
    dialogTitle: "导出 JSON 备份",
  });
}

function isShareCancelled(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("cancel") || msg.includes("abort") || msg.includes("dismiss");
}

async function exportAllData() {
  const payload = buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const date = getTodayKey();
  const fileName = `${APP_NAME}-backup-${date}.json`;
  const cap = window.Capacitor;

  if (cap?.isNativePlatform?.()) {
    try {
      await exportJsonNative(cap, json, fileName);
    } catch (err) {
      if (!isShareCancelled(err)) {
        console.error(err);
        alert(`导出失败：${err.message || "未知错误"}`);
      }
    }
    return;
  }

  downloadJsonInBrowser(json, fileName);
}

function importAllData(payload) {
  const normalized = normalizeImportPayload(payload);
  validateImportData(normalized);

  saveJSON(STORAGE_KEYS.checkins, migrateCheckins(normalized.checkins));
  saveJSON(
    STORAGE_KEYS.memos,
    normalized.memos.map((memo) => ({
      ...memo,
      pinned: !!memo.pinned,
    }))
  );

  replaceCheckins(normalized.checkins);
  memos = loadMemos();
  reloadAppData();
}

document.getElementById("export-data-btn").addEventListener("click", exportAllData);

document.getElementById("import-data-btn").addEventListener("click", () => {
  document.getElementById("import-file-input").click();
});

document.getElementById("import-file-input").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const normalized = normalizeImportPayload(payload);
      validateImportData(normalized);

      const { checkinCount, memoCount } = {
        checkinCount: Object.keys(normalized.checkins || {}).length,
        memoCount: normalized.memos.length,
      };

      if (
        !confirm(
          `即将导入 ${checkinCount} 条打卡、${memoCount} 条备忘录，并覆盖当前全部数据。是否继续？`
        )
      ) {
        return;
      }

      importAllData(payload);
      alert("导入成功");
    } catch (err) {
      alert(`导入失败：${err.message || "未知错误"}`);
    }
  };
  reader.onerror = () => alert("读取文件失败");
  reader.readAsText(file, "utf-8");
});

// ===== 初始化 =====
initTheme();
renderHeaderQuote();
renderCalendar();
