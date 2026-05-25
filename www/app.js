const STORAGE_KEYS = {
  checkins: "calendar_checkins",
  memos: "calendar_memos",
  notes: "daily_notes",
};

const APP_NAME = "行歌";
const BACKUP_VERSION = 1;

const STATUS_MAP = {
  success: { icon: "✓", class: "success", label: "成功" },
  partial: { icon: "○", class: "partial", label: "差点" },
  fail: { icon: "✗", class: "fail", label: "失败" },
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

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

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += '<div class="memo-spacer"></div>';
      return;
    }

    if (/^[-•*]\s/.test(trimmed)) {
      if (inList) {
        html += "</ul>";
      } else {
        html += '<ul class="memo-list">';
      }
      inList = true;
      html += `<li><span class="memo-list-text">${escapeHtml(trimmed.replace(/^[-•*]\s/, ""))}</span></li>`;
      return;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)[0].length;
      const text = trimmed.replace(/^#{1,3}\s/, "");
      html += `<h4 class="memo-heading memo-heading-${level}">${escapeHtml(text)}</h4>`;
      return;
    }

    if (/^>\s/.test(trimmed)) {
      html += `<blockquote class="memo-blockquote">${escapeHtml(trimmed.replace(/^>\s/, ""))}</blockquote>`;
      return;
    }

    html += `<p class="memo-paragraph">${escapeHtml(trimmed)}</p>`;
  });

  if (inList) html += "</ul>";
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

// ===== Tab 切换 =====
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll("#main-view .panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tab.dataset.tab}-panel`).classList.add("active");
    if (tab.dataset.tab === "records") renderRecords();
    if (tab.dataset.tab === "memos") renderMemos();
  });
});

const HEADER_CLICKS_NEEDED = 5;
const HEADER_CLICK_WINDOW = 2000;
let headerClickCount = 0;
let headerClickTimer = null;

function openDataPanel() {
  document.getElementById("main-view").classList.add("hidden");
  document.getElementById("data-panel").classList.remove("hidden");
  renderDataPanel();
}

function closeDataPanel() {
  document.getElementById("data-panel").classList.add("hidden");
  document.getElementById("main-view").classList.remove("hidden");
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
  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
  ];

  document.getElementById("month-title").textContent =
    `${currentYear}年 ${monthNames[currentMonth]}`;

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
  const statsEl = document.getElementById("month-stats");
  let success = 0;
  let partial = 0;
  let fail = 0;

  Object.entries(checkins).forEach(([key, value]) => {
    const record = typeof value === "string" ? { status: value } : value;
    const { year, month } = parseDateKey(key);
    if (year === currentYear && month === currentMonth) {
      if (record.status === "success") success++;
      else if (record.status === "partial") partial++;
      else if (record.status === "fail") fail++;
    }
  });

  statsEl.innerHTML = `
    <div class="stat-item success">
      <div class="stat-num">${success}</div>
      <div class="stat-label">成功</div>
    </div>
    <div class="stat-item partial">
      <div class="stat-num">${partial}</div>
      <div class="stat-label">差点</div>
    </div>
    <div class="stat-item fail">
      <div class="stat-num">${fail}</div>
      <div class="stat-label">失败</div>
    </div>
  `;
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

function openModal(dateKey) {
  selectedDateKey = dateKey;
  const { year, month, day } = parseDateKey(dateKey);
  const record = getCheckinRecord(dateKey);

  document.getElementById("modal-date").textContent = `${year}年${month + 1}月${day}日`;
  summaryInput.value = record?.summary || "";
  modal.classList.remove("hidden");
  summaryInput.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  selectedDateKey = null;
  summaryInput.value = "";
}

function saveCheckin(status) {
  if (!selectedDateKey) return;
  checkins[selectedDateKey] = {
    status,
    summary: summaryInput.value.trim(),
  };
  saveJSON(STORAGE_KEYS.checkins, checkins);
  renderCalendar();
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

function openMemoModal(memoId = null) {
  editingMemoId = memoId;
  const memo = memos.find((item) => item.id === memoId);

  memoModalTitle.textContent = memo ? "编辑备忘录" : "新建备忘录";
  memoInput.value = memo?.content || "";
  memoPinInput.checked = !!memo?.pinned;
  memoModal.classList.remove("hidden");
  memoInput.focus();
}

function closeMemoModal() {
  memoModal.classList.add("hidden");
  editingMemoId = null;
  memoInput.value = "";
  memoPinInput.checked = false;
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
  renderRecords();
  renderMemos();
  renderDataPanel();
}

function renderDataPanel() {
  const { checkinCount, memoCount } = getDataStats();
  document.getElementById("data-stats").textContent =
    `当前：${checkinCount} 条打卡 · ${memoCount} 条备忘录`;
}

function exportAllData() {
  const payload = buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const date = getTodayKey();
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${APP_NAME}-backup-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
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
renderHeaderQuote();
renderCalendar();
