const STORAGE_KEYS = {
  checkins: "calendar_checkins",
  memos: "calendar_memos",
  notes: "daily_notes",
  theme: "app_theme",
  summaryStatsExpanded: "summary_stats_expanded",
  recordsFiltersExpanded: "records_filters_expanded",
  notifications: "habit_notifications",
};

const APP_NAME = "365.dev";
const BACKUP_VERSION = 3;
const THEME_META = {
  light: "#5c7289",
  dark: "#0f1114",
  sage: "#5a8a6a",
  sand: "#9a8060",
  ink: "#2a3544",
  dusk: "#3d2f3a",
};
const THEME_IDS = ["light", "dark", "sage", "sand", "ink", "dusk"];

const STATUS_MAP = {
  success: { icon: "✓", class: "success", label: "守住了" },
  partial: { icon: "○", class: "partial", label: "差点犯" },
  fail: { icon: "✗", class: "fail", label: "没守住" },
};

const TRIGGER_MAP = {
  stress: "压力",
  boredom: "无聊",
  social: "社交",
  fatigue: "疲劳",
  other: "其他",
};

const DEFAULT_NOTIFICATIONS = {
  enabled: true,
  time1: "12:00",
  enable2: true,
  time2: "23:00",
};

const NOTIFY_BODY_NOON = "午间打卡——守住了就点「守住了」。";
const NOTIFY_BODY_NIGHT = "晚间打卡——记一下今天，守住了就点「守住了」。";

const SESSION_IDS = ["noon", "night"];
const SESSION_META = {
  noon: { label: "午间打卡", short: "午", hint: "中午是高危时段，及时记一笔" },
  night: { label: "晚间打卡", short: "晚", hint: "回顾全天，守住再睡" },
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_NAMES = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

/** 全年日历从该年几月开始展示（0=一月）；2026 年从 5 月起 */
const YEAR_CALENDAR_START = { year: 2026, month: 4 };

function getYearCalendarMonthRange(year) {
  if (year < YEAR_CALENDAR_START.year) {
    return { start: 0, end: 11 };
  }
  if (year === YEAR_CALENDAR_START.year) {
    return { start: YEAR_CALENDAR_START.month, end: 11 };
  }
  return { start: 0, end: 11 };
}

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

function emptySessionEntry() {
  return { status: "", summary: "", trigger: "", plan: "" };
}

function normalizeSessionEntry(value) {
  if (!value || !value.status) return null;
  return {
    status: value.status,
    summary: value.summary || "",
    trigger: value.trigger || "",
    plan: value.plan || "",
  };
}

function normalizeDayRecord(value) {
  if (!value) return { noon: null, night: null };
  if (value.noon !== undefined || value.night !== undefined) {
    return {
      noon: normalizeSessionEntry(value.noon),
      night: normalizeSessionEntry(value.night),
    };
  }
  if (value.status) {
    return {
      noon: null,
      night: normalizeSessionEntry(value),
    };
  }
  return { noon: null, night: null };
}

function migrateCheckins(data) {
  const migrated = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (typeof value === "string") {
      migrated[key] = {
        noon: null,
        night: { status: value, summary: "", trigger: "", plan: "" },
      };
    } else {
      migrated[key] = normalizeDayRecord(value);
    }
    if (!migrated[key].noon && !migrated[key].night) {
      delete migrated[key];
    }
  });
  return migrated;
}

function getDayRecord(dateKey) {
  return normalizeDayRecord(checkins[dateKey]);
}

function getSessionRecord(dateKey, session) {
  const day = getDayRecord(dateKey);
  return day[session] || null;
}

/** @deprecated 使用 getSessionRecord / getDayRecord */
function getCheckinRecord(dateKey) {
  const day = getDayRecord(dateKey);
  return day.night || day.noon || null;
}

function setSessionRecord(dateKey, session, entry) {
  const day = getDayRecord(dateKey);
  day[session] = normalizeSessionEntry(entry);
  if (!day.noon && !day.night) {
    delete checkins[dateKey];
  } else {
    checkins[dateKey] = day;
  }
}

function clearSessionRecord(dateKey, session) {
  if (!checkins[dateKey]) return;
  const day = normalizeDayRecord(checkins[dateKey]);
  day[session] = null;
  const hasRemaining = SESSION_IDS.some((s) => day[s]?.status);
  if (!hasRemaining) {
    delete checkins[dateKey];
  } else {
    checkins[dateKey] = { noon: day.noon, night: day.night };
  }
}

function dayHasAnySession(dateKey) {
  const day = getDayRecord(dateKey);
  return SESSION_IDS.some((s) => day[s]?.status);
}

function dayIsRelapse(dateKey) {
  const day = getDayRecord(dateKey);
  return SESSION_IDS.some((s) => day[s] && isRelapseStatus(day[s].status));
}

function dayIsSober(dateKey) {
  if (dayIsRelapse(dateKey)) return false;
  const day = getDayRecord(dateKey);
  return SESSION_IDS.some((s) => day[s] && isSoberStatus(day[s].status));
}

function getDayAggregateStatus(dateKey) {
  const day = getDayRecord(dateKey);
  let worst = null;
  SESSION_IDS.forEach((s) => {
    const st = day[s]?.status;
    if (!st) return;
    if (st === "fail") worst = "fail";
    else if (st === "partial") worst = worst === "fail" ? "fail" : "partial";
    else if (st === "success" && worst !== "fail" && worst !== "partial") worst = "success";
  });
  return worst;
}

function getSuggestedSession() {
  const hour = new Date().getHours();
  return hour < 17 ? "noon" : "night";
}

function getPreferredSessionForDay(dateKey) {
  const day = getDayRecord(dateKey);
  const suggested = getSuggestedSession();
  if (!day[suggested]?.status) return suggested;
  const other = suggested === "noon" ? "night" : "noon";
  if (!day[other]?.status) return other;
  return suggested;
}

function getDayRecordForStreak(dateKey, excludeSession = null) {
  const day = getDayRecord(dateKey);
  if (!excludeSession) return day;
  return { ...day, [excludeSession]: null };
}

function isDayRelapseForStreak(day) {
  return SESSION_IDS.some((s) => day[s] && isRelapseStatus(day[s].status));
}

function isDaySoberForStreak(day) {
  if (isDayRelapseForStreak(day)) return false;
  return SESSION_IDS.some((s) => day[s] && isSoberStatus(day[s].status));
}

function dayHasAnySessionObj(day) {
  return SESSION_IDS.some((s) => day[s]?.status);
}

function iterateSessionRecords(callback) {
  Object.keys(checkins).forEach((dateKey) => {
    SESSION_IDS.forEach((session) => {
      const rec = getSessionRecord(dateKey, session);
      if (rec?.status) callback(dateKey, session, rec);
    });
  });
}

function computeStreak(getDayFn) {
  const todayKey = getTodayKey();
  if (isDayRelapseForStreak(getDayFn(todayKey))) return 0;

  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const day = getDayFn(key);
    if (isDayRelapseForStreak(day)) break;
    if (isDaySoberForStreak(day)) streak++;
    else if (!dayHasAnySessionObj(day) && i > 0) break;
  }
  return streak;
}

/** 当前连续清醒天数（任一次没守住会归零） */
function getCurrentStreak() {
  return computeStreak(getDayRecord);
}

/** 历史最长连续清醒天数 */
function getLongestStreak() {
  const keys = Object.keys(checkins).sort();
  if (!keys.length) return 0;

  let longest = 0;
  let run = 0;
  const start = parseDateKey(keys[0]);
  const end = parseDateKey(keys[keys.length - 1]);
  const cursor = new Date(start.year, start.month, start.day);

  while (cursor <= new Date(end.year, end.month, end.day)) {
    const key = formatDateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const day = getDayRecord(key);
    if (isDayRelapseForStreak(day)) {
      longest = Math.max(longest, run);
      run = 0;
    } else if (isDaySoberForStreak(day)) {
      run++;
      longest = Math.max(longest, run);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return longest;
}

function getHabitMonthStats(year, month) {
  let sober = 0;
  let relapse = 0;
  let nearMiss = 0;
  iterateSessionRecords((key, _session, rec) => {
    const p = parseDateKey(key);
    if (p.year !== year || p.month !== month) return;
    if (isRelapseStatus(rec.status)) relapse++;
    else if (rec.status === "partial") nearMiss++;
    else if (rec.status === "success") sober++;
  });
  return { sober, relapse, nearMiss, logged: sober + relapse + nearMiss };
}

function getTriggerInsights(year) {
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  const triggerCounts = {};
  iterateSessionRecords((key, _session, rec) => {
    if (!isRelapseStatus(rec.status)) return;
    const p = parseDateKey(key);
    if (p.year !== year) return;
    const date = new Date(p.year, p.month, p.day);
    weekdayCounts[date.getDay()]++;
    if (rec.trigger && TRIGGER_MAP[rec.trigger]) {
      triggerCounts[rec.trigger] = (triggerCounts[rec.trigger] || 0) + 1;
    }
  });
  return { weekdayCounts, triggerCounts };
}

function pickFromArray(arr, seed) {
  if (!arr?.length) return "";
  if (seed != null) return arr[Math.abs(seed) % arr.length];
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTotalSuccessCount() {
  let count = 0;
  iterateSessionRecords((_key, _session, rec) => {
    if (rec.status === "success") count++;
  });
  return count;
}

/** 计算连续天数，可排除某日某次（用于保存前对比） */
function getCurrentStreakExcluding(excludeKey, excludeSession = null) {
  return computeStreak((key) => {
    if (key !== excludeKey) return getDayRecord(key);
    return getDayRecordForStreak(key, excludeSession);
  });
}

function isRelapseStatus(status) {
  return status === "fail";
}

function isSoberStatus(status) {
  return status === "success" || status === "partial";
}

function getStreakAsOfDate(dateKey) {
  const anchor = parseDateKey(dateKey);
  const anchorDate = new Date(anchor.year, anchor.month, anchor.day);
  let streak = 0;

  for (let i = 0; i < 400; i++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const day = getDayRecord(key);
    if (isDayRelapseForStreak(day)) break;
    if (isDaySoberForStreak(day)) streak++;
    else if (!dayHasAnySessionObj(day) && i > 0) break;
  }
  return streak;
}

function getStreakHint(current, longest) {
  if (dayIsRelapse(getTodayKey())) {
    return "今天没守住也没关系，明天可以重新来";
  }
  if (current >= 90) return "三个月级的坚持，默认选项已经换了";
  if (current >= 60) return "两个月，新常态正在形成";
  if (current >= 30) return "一个月，你在用事实证明自己";
  if (current >= 14) return "两周了，这已经不是运气";
  if (current >= 7) return "完整一周，大脑开始认这条新路";
  if (current >= 2) return `第 ${current} 天，每一天都在重写默认选项`;
  if (current === 1) return "Day 1 也是胜利，今天开始了";
  if (current === 0 && longest > 0) return "随时可以重新开始 Day 1";
  if (current === longest && current >= 3) {
    return `平了个人纪录 ${longest} 天，稳住就是进步`;
  }
  return "守住一天，就多一天自由";
}

function detectSuccessMilestone(prevStreak, newStreak, prevLongest, newLongest) {
  const markers = [1, 7, 14, 30, 60, 90];
  for (const m of markers) {
    if (prevStreak < m && newStreak >= m) {
      return { kind: "streak", days: m };
    }
  }
  if (newLongest > prevLongest && newLongest >= 2) {
    return { kind: "record", days: newLongest };
  }
  return null;
}

function getEarnedAchievements() {
  const longest = getLongestStreak();
  const totalSuccess = getTotalSuccessCount();
  return [
    { label: "首次守住", earned: totalSuccess >= 1 },
    { label: "连续 7 天", earned: longest >= 7 },
    { label: "连续 30 天", earned: longest >= 30 },
    { label: "连续 90 天", earned: longest >= 90 },
    { label: "累计守住 10 次", earned: totalSuccess >= 10 },
    { label: "累计守住 50 次", earned: totalSuccess >= 50 },
  ];
}

let celebrationToastTimer = null;

function showCelebrationToast(message, duration = 2400) {
  const el = document.getElementById("celebration-toast");
  if (!el) return;
  clearTimeout(celebrationToastTimer);
  el.textContent = message;
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("show"));
  celebrationToastTimer = setTimeout(() => {
    el.classList.remove("show");
    celebrationToastTimer = setTimeout(() => el.classList.add("hidden"), 280);
  }, duration);
}

function showSuccessToast(streak, session) {
  const extra = pickFromArray(SUCCESS_TOAST_EXTRAS);
  const rank = getRankForStreak(streak);
  const sessionLabel = session ? SESSION_META[session]?.short + "间" : "";
  showCelebrationToast(
    `✓ ${sessionLabel}守住了 · ${rank.name} · 连续第 ${streak} 天 · ${extra}`
  );
}

function showRankUpModal(rank) {
  const modal = document.getElementById("milestone-modal");
  const badgeEl = modal?.querySelector(".milestone-badge");
  const titleEl = document.getElementById("milestone-title");
  const bodyEl = document.getElementById("milestone-body");
  if (!modal || !titleEl || !bodyEl) return;

  if (badgeEl) badgeEl.textContent = "晋级";
  titleEl.textContent = rank.name;
  bodyEl.innerHTML = `
    <div class="rank-up-badge-wrap">${renderRankBadgeSvg(rank, 72)}</div>
    <p class="rank-up-desc">连续清醒进入 ${getRankRangeLabel(rank)} 档，继续保持。</p>
  `;
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

function showMilestoneModal(milestone) {
  const modal = document.getElementById("milestone-modal");
  const badgeEl = modal?.querySelector(".milestone-badge");
  const titleEl = document.getElementById("milestone-title");
  const bodyEl = document.getElementById("milestone-body");
  if (!modal || !titleEl || !bodyEl) return;

  if (badgeEl) badgeEl.textContent = "里程碑";
  const msg =
    milestone.kind === "record"
      ? MILESTONE_MESSAGES.record
      : MILESTONE_MESSAGES[milestone.days];
  if (!msg) return;

  titleEl.textContent =
    milestone.kind === "record" ? `${msg.title} · ${milestone.days} 天` : msg.title;
  bodyEl.textContent = msg.body;
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

function closeMilestoneModal() {
  const modal = document.getElementById("milestone-modal");
  if (!modal) return;
  modal.classList.remove("show");
  setTimeout(() => modal.classList.add("hidden"), 220);
}

function afterSuccessCheckin(dateKey, session, prevStreak, prevLongest) {
  const newStreak = getCurrentStreak();
  const newLongest = getLongestStreak();
  const isToday = dateKey === getTodayKey();
  const milestone =
    isToday && detectSuccessMilestone(prevStreak, newStreak, prevLongest, newLongest);
  const prevRank = getRankForStreak(prevStreak);
  const newRank = getRankForStreak(newStreak);
  const rankUp = isToday && newRank.tier > prevRank.tier;

  showSuccessToast(newStreak, session);
  if (milestone) {
    setTimeout(() => showMilestoneModal(milestone), 2600);
    if (rankUp) setTimeout(() => showRankUpModal(newRank), 5400);
  } else if (rankUp) {
    setTimeout(() => showRankUpModal(newRank), 2600);
  }
}

function renderHeaderRank() {
  const el = document.getElementById("header-rank");
  if (!el) return;
  const streak = getCurrentStreak();
  el.innerHTML = renderHeaderRankHtml(streak);
}

function renderHeaderStreak() {
  const el = document.getElementById("header-streak");
  if (!el) return;
  const current = getCurrentStreak();
  const longest = getLongestStreak();
  const hint = getStreakHint(current, longest);
  el.innerHTML = `
    <div class="header-streak-main">
      <span class="header-streak-num">${current}</span>
      <span class="header-streak-unit">天</span>
      <span class="header-streak-label">连续清醒</span>
    </div>
    ${hint ? `<p class="header-streak-sub">${hint}</p>` : ""}
  `;
}

function renderHeaderTodayWin() {
  const el = document.getElementById("header-today-win");
  if (!el) return;
  const day = getDayRecord(getTodayKey());
  const hasSuccess = SESSION_IDS.some((s) => day[s]?.status === "success");
  if (hasSuccess) {
    const seed = getDayOfYear(new Date()) + getTotalSuccessCount();
    el.textContent = pickFromArray(SUCCESS_QUOTES, seed);
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

function renderHeader() {
  renderHeaderRank();
  renderHeaderStreak();
  renderHeaderTodayWin();
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
  syncWidgetData();
}

function loadNotificationSettings() {
  return { ...DEFAULT_NOTIFICATIONS, ...loadJSON(STORAGE_KEYS.notifications, {}) };
}

function saveNotificationSettings(settings) {
  saveJSON(STORAGE_KEYS.notifications, settings);
}

function parseTimeString(timeStr) {
  const [h, m] = (timeStr || "23:00").split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

async function scheduleHabitReminders() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const settings = loadNotificationSettings();
  try {
    const LN = getCapacitorPlugin(cap, "LocalNotifications");
    try {
      await LN.requestPermissions();
    } catch {
      /* ignore */
    }
    const toCancel = [{ id: 1001 }, { id: 1002 }];
    try {
      await LN.cancel({ notifications: toCancel });
    } catch {
      /* ignore */
    }
    if (!settings.enabled) return;

    const notifications = [];
    const t1 = parseTimeString(settings.time1);
    notifications.push({
      id: 1001,
      title: `${APP_NAME} · 午间`,
      body: NOTIFY_BODY_NOON,
      schedule: {
        on: { hour: t1.hour, minute: t1.minute },
        allowWhileIdle: true,
        repeats: true,
        every: "day",
      },
    });
    if (settings.enable2) {
      const t2 = parseTimeString(settings.time2);
      notifications.push({
        id: 1002,
        title: `${APP_NAME} · 晚间`,
        body: NOTIFY_BODY_NIGHT,
        schedule: {
          on: { hour: t2.hour, minute: t2.minute },
          allowWhileIdle: true,
          repeats: true,
          every: "day",
        },
      });
    }
    await LN.schedule({ notifications });
  } catch (err) {
    console.warn("schedule notifications failed", err);
  }
}

function renderNotificationSettings() {
  const settings = loadNotificationSettings();
  const enabledEl = document.getElementById("notify-enabled");
  const time1El = document.getElementById("notify-time1");
  const enable2El = document.getElementById("notify-enable2");
  const time2El = document.getElementById("notify-time2");
  if (!enabledEl) return;
  enabledEl.checked = !!settings.enabled;
  time1El.value = settings.time1 || "12:00";
  enable2El.checked = settings.enable2 !== false;
  time2El.value = settings.time2 || "23:00";
}

function saveNotificationSettingsFromForm() {
  const settings = {
    enabled: document.getElementById("notify-enabled").checked,
    time1: document.getElementById("notify-time1").value || "12:00",
    enable2: document.getElementById("notify-enable2").checked,
    time2: document.getElementById("notify-time2").value || "23:00",
  };
  saveNotificationSettings(settings);
  scheduleHabitReminders();
  alert("提醒设置已保存");
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

const MEMO_COLLAPSE_LINE_LIMIT = 5;
const MEMO_COLLAPSE_CHAR_LIMIT = 160;

function isMemoLong(content) {
  const text = (content || "").trim();
  if (!text) return false;
  const lineCount = text.split("\n").length;
  return lineCount > MEMO_COLLAPSE_LINE_LIMIT || text.length > MEMO_COLLAPSE_CHAR_LIMIT;
}

function renderMemoCard(memo) {
  const preview = getMemoTitle(memo.content);
  const pinLabel = memo.pinned ? "取消置顶" : "置顶";
  const pinAction = memo.pinned ? "unpin" : "pin";
  const longMemo = isMemoLong(memo.content);
  const bodyHtml = formatMemoContent(memo.content, true);
  const expandBtn = longMemo
    ? `<button type="button" class="memo-expand-btn" data-action="toggle-expand" data-id="${memo.id}" aria-expanded="false">展开全文</button>`
    : "";

  return `
    <article class="memo-card${memo.pinned ? " is-pinned" : ""}" data-id="${memo.id}">
      <div class="memo-card-head">
        <h3 class="memo-title">
          ${memo.pinned ? '<span class="memo-pin-badge">置顶</span>' : ""}
          ${escapeHtml(preview)}
        </h3>
        <time class="memo-time">${formatMemoTime(memo.updatedAt)}</time>
      </div>
      <div class="memo-body-wrap${longMemo ? " is-collapsible" : ""}">
        <div class="memo-body">${bodyHtml}</div>
        ${expandBtn}
      </div>
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
let selectedModalStatus = "success";
let selectedSession = "noon";

// ===== 触觉 / 小组件 =====
async function hapticImpact(style = "Light") {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  try {
    const Haptics = getCapacitorPlugin(cap, "Haptics");
    await Haptics.impact({ style });
  } catch {
    /* ignore */
  }
}

async function hapticForCheckin(status) {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  try {
    const Haptics = getCapacitorPlugin(cap, "Haptics");
    if (status === "success" && Haptics.notification) {
      await Haptics.notification({ type: "SUCCESS" });
    } else {
      await Haptics.impact({ style: status === "partial" ? "Light" : "Light" });
    }
  } catch {
    /* ignore */
  }
}

function hapticSuccess() {
  return hapticForCheckin("success");
}

function hapticClear() {
  return hapticImpact("Light");
}

async function syncWidgetData() {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  try {
    const WidgetSync = getCapacitorPlugin(cap, "WidgetSync");
    const quote = QUOTES[getTodayQuoteIndex()];
    const todayKey = getTodayKey();
    const day = getDayRecord(todayKey);
    const agg = getDayAggregateStatus(todayKey);
    const streak = getCurrentStreak();
    await WidgetSync.update({
      quote: quote.text,
      author: quote.author || "",
      dayNum: getDayOfYear(new Date()),
      checkedIn: dayHasAnySession(todayKey),
      status: agg || "",
      statusLabel: agg ? STATUS_MAP[agg].label : "未打卡",
      streakDays: streak,
      noonChecked: !!day.noon?.status,
      nightChecked: !!day.night?.status,
      noonStatus: day.noon?.status || "",
      nightStatus: day.night?.status || "",
    });
  } catch (err) {
    console.warn("widget sync failed", err);
  }
}

function openCheckinFromWidget() {
  switchTab("calendar");
  openModal(getTodayKey(), getSuggestedSession());
}

async function initNativeBridge() {
  window.__openCheckinFromWidget = openCheckinFromWidget;
  window.addEventListener("app-open-checkin", openCheckinFromWidget);

  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  const App = cap.Plugins?.App;
  if (App?.getLaunchUrl) {
    try {
      const { url } = await App.getLaunchUrl();
      if (url && String(url).includes("checkin")) {
        setTimeout(openCheckinFromWidget, 400);
      }
    } catch {
      /* ignore */
    }
  }
  if (App?.addListener) {
    App.addListener("appUrlOpen", ({ url }) => {
      if (url && String(url).includes("checkin")) openCheckinFromWidget();
    });
  }

  syncWidgetData();
  scheduleHabitReminders();
}

// ===== 主题 =====
function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  return THEME_IDS.includes(saved) ? saved : "light";
}

function applyTheme(theme) {
  const t = THEME_IDS.includes(theme) ? theme : "light";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(STORAGE_KEYS.theme, t);
  const meta = document.getElementById("meta-theme-color");
  if (meta) meta.content = THEME_META[t] || THEME_META.light;
  const isDark = t === "dark" || t === "ink" || t === "dusk";
  document.querySelector("meta[name=color-scheme]")?.setAttribute(
    "content",
    isDark ? "dark" : "light"
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

  iterateSessionRecords((key, _session, rec) => {
    const parsed = parseDateKey(key);
    if (period === "year" && parsed.year !== year) return;
    if (period === "month" && (parsed.year !== year || parsed.month !== month)) return;
    if (rec.status === "success") success++;
    else if (rec.status === "partial") partial++;
    else if (rec.status === "fail") fail++;
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
  if (stats.fail === 0) return "本月还没有复发记录，继续保持。";
  if (stats.partial > stats.fail) return "有不少「差点犯」，说明你在和高危瞬间搏斗。";
  return "复发不代表失败，记录下来的每一次复盘都在帮你下一次守住。";
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

  const mainView = document.getElementById("main-view");
  if (mainView) {
    mainView.classList.toggle(
      "main-content--nav-gap",
      tabName === "summary" || tabName === "memos"
    );
    mainView.classList.toggle("main-content--calendar-fit", tabName === "calendar");
  }

  updateHeaderVisibility(tabName);

  if (tabName === "records") renderRecords();
  if (tabName === "memos") renderMemos();
  if (tabName === "summary") renderSummary();
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => switchTab(item.dataset.tab));
});

function setSettingsButtonsVisible(visible) {
  const btn = document.querySelector("#app-header .open-settings-btn");
  if (btn) btn.classList.toggle("hidden", !visible);
}

function openDataPanel() {
  document.getElementById("main-view").classList.add("hidden");
  document.getElementById("bottom-nav").classList.add("hidden");
  document.getElementById("app-header").classList.add("header-hidden");
  document.getElementById("data-panel").classList.remove("hidden");
  setSettingsButtonsVisible(false);
  renderDataPanel();
}

function closeDataPanel() {
  document.getElementById("data-panel").classList.add("hidden");
  document.getElementById("main-view").classList.remove("hidden");
  document.getElementById("bottom-nav").classList.remove("hidden");
  setSettingsButtonsVisible(true);
  const activeTab = document.querySelector(".nav-item.active")?.dataset.tab || "calendar";
  updateHeaderVisibility(activeTab);
}

function renderRankPanel() {
  const listEl = document.getElementById("rank-guide-list");
  if (!listEl) return;
  const streak = getCurrentStreak();
  listEl.innerHTML = renderRankGuideListHtml(streak);
  requestAnimationFrame(() => {
    listEl.querySelector(".rank-guide-item.is-current")?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  });
}

function openRankPanel() {
  document.getElementById("main-view").classList.add("hidden");
  document.getElementById("bottom-nav").classList.add("hidden");
  document.getElementById("app-header").classList.add("header-hidden");
  document.getElementById("rank-panel").classList.remove("hidden");
  setSettingsButtonsVisible(false);
  renderRankPanel();
}

function closeRankPanel() {
  document.getElementById("rank-panel").classList.add("hidden");
  document.getElementById("main-view").classList.remove("hidden");
  document.getElementById("bottom-nav").classList.remove("hidden");
  setSettingsButtonsVisible(true);
  const activeTab = document.querySelector(".nav-item.active")?.dataset.tab || "calendar";
  updateHeaderVisibility(activeTab);
}

document.querySelectorAll(".open-settings-btn").forEach((btn) => {
  btn.addEventListener("click", openDataPanel);
});
document.getElementById("data-back-btn").addEventListener("click", closeDataPanel);
document.getElementById("rank-back-btn")?.addEventListener("click", closeRankPanel);
document.getElementById("header-rank")?.addEventListener("click", (e) => {
  if (e.target.closest("#header-rank-btn")) openRankPanel();
});

function getTodayQuoteIndex() {
  return (getDayOfYear(new Date()) - 1) % QUOTES.length;
}

function initSummaryStatsToggle() {
  const toggle = document.getElementById("summary-stats-toggle");
  const block = document.getElementById("summary-stats-block");
  const textEl = toggle?.querySelector(".summary-stats-toggle-text");
  if (!toggle || !block) return;

  const setExpanded = (expanded) => {
    block.classList.toggle("collapsed", !expanded);
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (textEl) textEl.textContent = expanded ? "收起详细统计" : "展开详细统计";
  };

  setExpanded(!!loadJSON(STORAGE_KEYS.summaryStatsExpanded, false));

  toggle.addEventListener("click", () => {
    const expanded = block.classList.contains("collapsed");
    setExpanded(expanded);
    saveJSON(STORAGE_KEYS.summaryStatsExpanded, expanded);
  });
}

// ===== 日历模块 =====
function appendDaySessionIcons(cell, dateKey) {
  const agg = getDayAggregateStatus(dateKey);
  if (agg) cell.classList.add(`status-${agg}`);

  const wrap = document.createElement("span");
  wrap.className = "day-session-icons";
  SESSION_IDS.forEach((session) => {
    const rec = getSessionRecord(dateKey, session);
    const slot = document.createElement("span");
    slot.className = "day-session-slot";
    if (rec?.status) {
      slot.classList.add("filled", `status-${rec.status}`);
      slot.textContent = STATUS_MAP[rec.status].icon;
    } else {
      slot.textContent = SESSION_META[session].short;
    }
    slot.title = `${SESSION_META[session].label}${
      rec?.status ? " · " + STATUS_MAP[rec.status].label : ""
    }`;
    wrap.appendChild(slot);
  });
  cell.appendChild(wrap);
}

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

    appendDaySessionIcons(cell, dateKey);

    cell.addEventListener("click", () => openModal(dateKey, getPreferredSessionForDay(dateKey)));
    grid.appendChild(cell);
  }

  renderMonthStats();
}

function renderMonthStats() {
  const habit = getHabitMonthStats(currentYear, currentMonth);
  const statsEl = document.getElementById("month-stats");

  statsEl.innerHTML = `
    <div class="stat-item success">
      <div class="stat-num">${habit.sober}</div>
      <div class="stat-label">守住了</div>
    </div>
    <div class="stat-item partial">
      <div class="stat-num">${habit.nearMiss}</div>
      <div class="stat-label">差点犯</div>
    </div>
    <div class="stat-item fail">
      <div class="stat-num">${habit.relapse}</div>
      <div class="stat-label">没守住</div>
    </div>
  `;
}

function renderSummaryHabitPanel() {
  const panel = document.getElementById("summary-habit-panel");
  if (!panel) return;

  const now = new Date();
  const monthHabit = getHabitMonthStats(now.getFullYear(), now.getMonth());
  const current = getCurrentStreak();
  const longest = getLongestStreak();
  const insights = getTriggerInsights(summaryYear);

  const maxWeekday = Math.max(1, ...insights.weekdayCounts);
  const weekdayBars = WEEKDAYS.map((name, i) => {
    const count = insights.weekdayCounts[i];
    const pct = Math.round((count / maxWeekday) * 100);
    return `<div class="insight-bar-row">
      <span class="insight-bar-label">周${name}</span>
      <span class="insight-bar-track"><span class="insight-bar-fill fail" style="width:${pct}%"></span></span>
      <span class="insight-bar-num">${count}</span>
    </div>`;
  }).join("");

  const triggerEntries = Object.entries(insights.triggerCounts).sort((a, b) => b[1] - a[1]);
  const triggerHtml = triggerEntries.length
    ? triggerEntries
        .map(
          ([key, n]) =>
            `<span class="insight-tag">${TRIGGER_MAP[key]} ${n} 次</span>`
        )
        .join("")
    : '<p class="insight-empty">暂无诱因记录，「没守住」时可填写复盘</p>';

  const totalSuccess = getTotalSuccessCount();
  const achievements = getEarnedAchievements();
  const achievementHtml = achievements
    .map(
      (a) =>
        `<span class="achievement-badge${a.earned ? " earned" : " locked"}">${a.label}</span>`
    )
    .join("");

  panel.innerHTML = `
    <div class="habit-hero">
      <div class="habit-hero-stat highlight">
        <span class="habit-hero-num">${current}</span>
        <span class="habit-hero-label">当前连续清醒</span>
      </div>
      <div class="habit-hero-stat">
        <span class="habit-hero-num">${longest}</span>
        <span class="habit-hero-label">历史最长</span>
      </div>
    </div>
    <div class="habit-month-row">
      <span>本月守住了 <strong>${monthHabit.sober}</strong> 天</span>
      <span>复发 <strong>${monthHabit.relapse}</strong> 天</span>
    </div>
    <div class="habit-insight-block">
      <p class="habit-insight-title">守住成就</p>
      <p class="habit-achievement-sub">累计守住 <strong>${totalSuccess}</strong> 次</p>
      <div class="achievement-badges">${achievementHtml}</div>
    </div>
    <div class="habit-insight-block">
      <p class="habit-insight-title">${summaryYear} 年 · 复发多出现在（星期）</p>
      <div class="insight-bars">${weekdayBars}</div>
    </div>
    <div class="habit-insight-block">
      <p class="habit-insight-title">诱因分布</p>
      <div class="insight-tags">${triggerHtml}</div>
    </div>
  `;
}

function renderSummary() {
  renderYearCalendar(summaryYear);
  renderSummaryHabitPanel();

  const stats = getYearStats(summaryYear);
  document.getElementById("summary-subtitle").textContent = `${summaryYear} 年记录`;

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
        <span class="summary-card-label">守住了</span>
      </article>
      <article class="summary-card partial">
        <span class="summary-card-num">${stats.partial}</span>
        <span class="summary-card-label">差点犯</span>
      </article>
      <article class="summary-card fail">
        <span class="summary-card-num">${stats.fail}</span>
        <span class="summary-card-label">没守住</span>
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
        <span><i class="dot success"></i>守住了 ${stats.success}</span>
        <span><i class="dot partial"></i>差点犯 ${stats.partial}</span>
        <span><i class="dot fail"></i>没守住 ${stats.fail}</span>
      </div>
    `;

    document.getElementById("summary-insight").innerHTML = `
      <p class="insight-text">${getSummaryInsight(stats)}</p>
    `;
  }
}

function updateModalStatusSelection(status) {
  selectedModalStatus = status || null;
  document.querySelectorAll(".status-btn").forEach((btn) => {
    const active = btn.dataset.status === status;
    btn.classList.toggle("selected", active);
  });
  const relapseSection = document.getElementById("relapse-review-section");
  if (relapseSection) {
    relapseSection.classList.toggle("hidden", status !== "fail");
  }

  const hintEl = document.getElementById("status-encourage-hint");
  const summaryEl = document.getElementById("checkin-summary");
  if (hintEl) {
    let hint = "";
    if (status === "success") {
      hint = pickFromArray(SUCCESS_SELECT_HINTS, selectedDateKey?.length);
    } else if (status === "partial") {
      hint = pickFromArray(PARTIAL_SELECT_HINTS, selectedDateKey?.length);
    } else if (status === "fail") {
      hint = pickFromArray(FAIL_SELECT_HINTS, selectedDateKey?.length);
    }
    if (hint) {
      hintEl.textContent = hint;
      hintEl.classList.remove("hidden");
    } else {
      hintEl.textContent = "";
      hintEl.classList.add("hidden");
    }
  }
  if (summaryEl) {
    summaryEl.placeholder = status && SUMMARY_PLACEHOLDERS[status]
      ? SUMMARY_PLACEHOLDERS[status]
      : "今天发生了什么？用一句话记录...";
  }
}

function updateSessionTabsUI() {
  document.querySelectorAll(".session-tab").forEach((btn) => {
    const session = btn.dataset.session;
    const active = session === selectedSession;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
    const rec = getSessionRecord(selectedDateKey, session);
    btn.classList.toggle("done", !!rec?.status);
  });
}

function loadSessionIntoModal() {
  const record = getSessionRecord(selectedDateKey, selectedSession);
  summaryInput.value = record?.summary || "";
  const triggerEl = document.getElementById("relapse-trigger");
  const planEl = document.getElementById("relapse-plan");
  if (triggerEl) triggerEl.value = record?.trigger || "";
  if (planEl) planEl.value = record?.plan || "";
  updateModalStatusSelection(record?.status || null);
  updateSessionTabsUI();
}

function openModal(dateKey, session = null) {
  selectedDateKey = dateKey;
  selectedSession = session || getSuggestedSession();
  const { year, month, day } = parseDateKey(dateKey);

  document.getElementById("modal-date").textContent =
    `${year}年${month + 1}月${day}日 · ${SESSION_META[selectedSession].label}`;
  loadSessionIntoModal();
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  selectedDateKey = null;
  selectedSession = getSuggestedSession();
  selectedModalStatus = null;
  summaryInput.value = "";
  const triggerEl = document.getElementById("relapse-trigger");
  const planEl = document.getElementById("relapse-plan");
  if (triggerEl) triggerEl.value = "";
  if (planEl) planEl.value = "";
  document.getElementById("relapse-review-section")?.classList.add("hidden");
  document.getElementById("status-encourage-hint")?.classList.add("hidden");
  document.querySelectorAll(".status-btn").forEach((btn) => btn.classList.remove("selected"));
}

function openMemoFromCheckin() {
  if (!selectedDateKey) return;

  if (selectedModalStatus) {
    setSessionRecord(selectedDateKey, selectedSession, buildCheckinEntry(selectedModalStatus));
    saveJSON(STORAGE_KEYS.checkins, checkins);
    renderCalendar();
    renderSummary();
    renderHeader();
    syncWidgetData();
  }

  const { year, month, day } = parseDateKey(selectedDateKey);
  const dateLabel = `${year}年${month + 1}月${day}日 · ${SESSION_META[selectedSession].label}`;
  const statusLabel = selectedModalStatus ? STATUS_MAP[selectedModalStatus].label : "";
  const summary = summaryInput.value.trim();
  const draft = `${dateLabel}${statusLabel ? ` · ${statusLabel}` : ""}\n\n${summary}\n\n`;

  closeModal();
  switchTab("memos");
  openMemoModal(null, draft);
}

function clearCheckinAt(dateKey) {
  if (!dayHasAnySession(dateKey)) return;
  const { year, month, day } = parseDateKey(dateKey);
  if (!confirm(`确定清除 ${year}年${month + 1}月${day}日的打卡记录？`)) return;

  delete checkins[dateKey];
  saveJSON(STORAGE_KEYS.checkins, checkins);
  hapticClear();
  renderCalendar();
  renderSummary();
  renderHeader();
  syncWidgetData();
}

function buildMiniDayHtml(year, month, dayNum, todayKey) {
  const dateKey = formatDateKey(year, month, dayNum);
  const agg = getDayAggregateStatus(dateKey);
  let cls = "mini-day mini-day--readonly";
  if (dateKey === todayKey) cls += " today";
  if (agg) cls += ` status-${agg}`;

  const dayRecord = getDayRecord(dateKey);
  const noon = dayRecord.noon?.status;
  const night = dayRecord.night?.status;
  let statusHtml = "";

  if (noon || night) {
    if (noon && night && noon === night) {
      statusHtml = `<span class="mini-day-icon status-icon ${STATUS_MAP[noon].class}">${STATUS_MAP[noon].icon}</span>`;
    } else if (noon && night && agg) {
      statusHtml = `<span class="mini-day-icon status-icon ${STATUS_MAP[agg].class}">${STATUS_MAP[agg].icon}</span>`;
    } else {
      statusHtml = '<span class="mini-day-sessions">';
      SESSION_IDS.forEach((session) => {
        const st = dayRecord[session]?.status;
        const slotCls = st ? `filled status-${st}` : "empty";
        const text = st ? STATUS_MAP[st].icon : SESSION_META[session].short;
        statusHtml += `<span class="mini-session-slot ${slotCls}">${text}</span>`;
      });
      statusHtml += "</span>";
    }
  }

  const label = agg
    ? `${month + 1}月${dayNum}日 ${STATUS_MAP[agg].label}`
    : `${month + 1}月${dayNum}日`;

  return `<span class="${cls}" aria-label="${label}">
    <span class="mini-day-num">${dayNum}</span>${statusHtml}
  </span>`;
}

function renderYearCalendar(year) {
  const headEl = document.getElementById("year-calendar-head");
  const container = document.getElementById("year-calendar");
  const todayKey = getTodayKey();
  const weekdayLabels = WEEKDAYS.map((d) => `<span>${d}</span>`).join("");

  const { start: monthStart, end: monthEnd } = getYearCalendarMonthRange(year);
  const yearTitle =
    year === YEAR_CALENDAR_START.year
      ? `${year} 年（${MONTH_NAMES[YEAR_CALENDAR_START.month]}起）`
      : `${year} 年全年`;

  headEl.innerHTML = `
    <h3 class="year-calendar-title">${yearTitle}</h3>
    <div class="year-nav">
      <button type="button" class="btn-icon btn-icon-sm" id="summary-year-prev" aria-label="上一年">‹</button>
      <span class="year-nav-label">${year}</span>
      <button type="button" class="btn-icon btn-icon-sm" id="summary-year-next" aria-label="下一年">›</button>
    </div>
  `;

  let gridHtml = '<div class="year-grid">';
  for (let month = monthStart; month <= monthEnd; month++) {
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

function buildCheckinEntry(status) {
  const entry = {
    status,
    summary: summaryInput.value.trim(),
    trigger: "",
    plan: "",
  };
  if (status === "fail") {
    entry.trigger = document.getElementById("relapse-trigger")?.value || "";
    entry.plan = document.getElementById("relapse-plan")?.value.trim() || "";
  }
  return entry;
}

function saveCheckin() {
  if (!selectedDateKey) return;
  const dateKey = selectedDateKey;
  const session = selectedSession;

  if (!selectedModalStatus) {
    if (getSessionRecord(dateKey, session)?.status) {
      clearSessionRecord(dateKey, session);
      saveJSON(STORAGE_KEYS.checkins, checkins);
      hapticClear();
      renderCalendar();
      renderSummary();
      renderHeader();
      syncWidgetData();
    }
    closeModal();
    return;
  }

  const status = selectedModalStatus;
  const prevStreak = getCurrentStreakExcluding(dateKey, session);
  const prevLongest = getLongestStreak();

  setSessionRecord(dateKey, session, buildCheckinEntry(status));
  saveJSON(STORAGE_KEYS.checkins, checkins);
  hapticForCheckin(status);
  renderCalendar();
  renderSummary();
  renderHeader();
  syncWidgetData();
  closeModal();

  if (status === "success") {
    afterSuccessCheckin(dateKey, session, prevStreak, prevLongest);
  }
}

modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);

document.querySelectorAll(".status-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const status = btn.dataset.status;
    updateModalStatusSelection(selectedModalStatus === status ? null : status);
  });
});

document.getElementById("save-checkin-btn").addEventListener("click", saveCheckin);

document.querySelectorAll(".session-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!selectedDateKey) return;
    selectedSession = btn.dataset.session;
    loadSessionIntoModal();
    const { year, month, day } = parseDateKey(selectedDateKey);
    document.getElementById("modal-date").textContent =
      `${year}年${month + 1}月${day}日 · ${SESSION_META[selectedSession].label}`;
  });
});

// ===== 打卡记录 =====
function getRecordsFilterValues() {
  const read = (name) =>
    document.querySelector(`.records-filter-chips[data-filter="${name}"] .filter-chip.active`)
      ?.dataset.value || "";
  return {
    status: read("status"),
    session: read("session"),
    period: read("period"),
  };
}

function matchesRecordsPeriod(dateKey, period) {
  if (!period) return true;
  const { year, month, day } = parseDateKey(dateKey);
  const recordDate = new Date(year, month, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "month") {
    return year === now.getFullYear() && month === now.getMonth();
  }
  if (period === "30") {
    const diffDays = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }
  return true;
}

function collectRecordEntries() {
  const entries = [];
  Object.keys(checkins)
    .sort((a, b) => b.localeCompare(a))
    .forEach((dateKey) => {
      SESSION_IDS.forEach((session) => {
        const rec = getSessionRecord(dateKey, session);
        if (rec?.status && STATUS_MAP[rec.status]) {
          entries.push({ dateKey, session, ...rec });
        }
      });
    });
  return entries;
}

function filterRecordEntries(entries) {
  const { status, session, period } = getRecordsFilterValues();
  return entries.filter((entry) => {
    if (status && entry.status !== status) return false;
    if (session && entry.session !== session) return false;
    if (!matchesRecordsPeriod(entry.dateKey, period)) return false;
    return true;
  });
}

function initRecordsFilters() {
  document.querySelectorAll(".records-filter-chips").forEach((group) => {
    group.addEventListener("click", (e) => {
      const chip = e.target.closest(".filter-chip");
      if (!chip || !group.contains(chip)) return;
      group.querySelectorAll(".filter-chip").forEach((btn) => {
        btn.classList.toggle("active", btn === chip);
      });
      renderRecords();
    });
  });
}

function initRecordsFilterToggle() {
  const toggle = document.getElementById("records-filter-toggle");
  const filters = document.getElementById("records-filters");
  const textEl = toggle?.querySelector(".records-filter-toggle-text");
  if (!toggle || !filters) return;

  const setExpanded = (expanded) => {
    filters.classList.toggle("collapsed", !expanded);
    toggle.classList.toggle("is-active", expanded);
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (textEl) textEl.textContent = expanded ? "收起筛选" : "筛选";
  };

  setExpanded(!!loadJSON(STORAGE_KEYS.recordsFiltersExpanded, false));

  toggle.addEventListener("click", () => {
    const expanded = filters.classList.contains("collapsed");
    setExpanded(expanded);
    saveJSON(STORAGE_KEYS.recordsFiltersExpanded, expanded);
  });
}

function renderRecords() {
  const listEl = document.getElementById("records-list");
  const countEl = document.getElementById("records-count");
  const allEntries = collectRecordEntries();
  const entries = filterRecordEntries(allEntries);
  const filters = getRecordsFilterValues();
  const hasFilter = !!(filters.status || filters.session || filters.period);

  if (hasFilter) {
    countEl.textContent = entries.length
      ? `筛选结果 ${entries.length} 条 · 共 ${allEntries.length} 条`
      : allEntries.length
        ? `筛选结果 0 条 · 共 ${allEntries.length} 条`
        : "";
  } else {
    countEl.textContent = entries.length ? `共 ${entries.length} 条记录` : "";
  }

  if (!entries.length) {
    listEl.innerHTML = `
      <div class="records-empty">
        <p>${hasFilter ? "没有符合筛选条件的记录" : "还没有打卡记录"}</p>
        <p class="records-empty-hint">${
          hasFilter ? "试试调整筛选条件" : "去日历打卡，写下你的第一句话总结吧"
        }</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = entries
    .map(({ dateKey, session, status, summary, trigger, plan }) => {
      const meta = STATUS_MAP[status];
      const streakAtRecord = getStreakAsOfDate(dateKey);
      const rank = getRankForStreak(streakAtRecord);
      const summaryText = summary
        ? escapeHtml(summary)
        : '<span class="records-no-summary">（未填写总结）</span>';
      let relapseHtml = "";
      if (status === "fail" && (trigger || plan)) {
        const parts = [];
        if (trigger && TRIGGER_MAP[trigger]) {
          parts.push(`诱因：${TRIGGER_MAP[trigger]}`);
        }
        if (plan) parts.push(`明天：${escapeHtml(plan)}`);
        relapseHtml = `<p class="record-relapse-meta">${parts.join(" · ")}</p>`;
      }
      return `
        <article class="record-item status-${status}">
          <div class="record-top">
            <time class="record-date">${formatDisplayDate(dateKey)} · ${SESSION_META[session].label}</time>
            <span class="record-rank" style="--rank-color: ${rank.color}">
              ${renderRankBadgeSvg(rank, 22)}
              <span class="record-rank-name">${rank.name}</span>
            </span>
            <span class="record-badge ${meta.class}">
              <span class="status-icon ${meta.class}">${meta.icon}</span>
              ${meta.label}
            </span>
          </div>
          <p class="record-summary">${summaryText}</p>
          ${relapseHtml}
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
  if (action === "toggle-expand") {
    const wrap = btn.closest(".memo-body-wrap");
    if (!wrap) return;
    const expanded = wrap.classList.toggle("is-expanded");
    btn.textContent = expanded ? "收起" : "展开全文";
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    return;
  }
  if (action === "edit") openMemoModal(id);
  if (action === "delete") openDeleteMemoModal(id);
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

function openMemoModal(memoId = null, initialContent = null) {
  editingMemoId = memoId;
  const memo = memos.find((item) => item.id === memoId);

  memoModalTitle.textContent = memo ? "编辑备忘录" : "新建备忘录";
  memoInput.value = initialContent ?? memo?.content ?? "";
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

let pendingDeleteMemoId = null;
const deleteMemoModal = document.getElementById("delete-memo-modal");
const deleteMemoMessage = document.getElementById("delete-memo-message");

function getMemoDeleteTitle(memo) {
  return (
    memo?.content
      ?.trim()
      .split("\n")[0]
      .slice(0, 24) || "这条备忘录"
  );
}

function openDeleteMemoModal(memoId) {
  const memo = memos.find((item) => item.id === memoId);
  if (!memo || !deleteMemoModal || !deleteMemoMessage) return;
  pendingDeleteMemoId = memoId;
  const title = getMemoDeleteTitle(memo);
  deleteMemoMessage.textContent = `确定删除「${title}」吗？删除后无法恢复。`;
  deleteMemoModal.classList.remove("hidden");
}

function closeDeleteMemoModal() {
  pendingDeleteMemoId = null;
  deleteMemoModal?.classList.add("hidden");
}

function confirmDeleteMemo() {
  if (!pendingDeleteMemoId) return;
  const memoId = pendingDeleteMemoId;
  closeDeleteMemoModal();
  memos = memos.filter((item) => item.id !== memoId);
  saveJSON(STORAGE_KEYS.memos, memos);
  renderMemos();
}

document.getElementById("delete-memo-confirm-btn")?.addEventListener("click", confirmDeleteMemo);
document.getElementById("delete-memo-cancel-btn")?.addEventListener("click", closeDeleteMemoModal);
deleteMemoModal?.querySelector(".modal-backdrop")?.addEventListener("click", closeDeleteMemoModal);

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
      notifications: loadNotificationSettings(),
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
      notifications: raw.data.notifications,
    };
  }

  if (raw.checkins || raw.memos) {
    return {
      checkins: raw.checkins ?? {},
      memos: raw.memos ?? [],
      notifications: raw.notifications,
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
  renderHeader();
  renderCalendar();
  renderSummary();
  renderRecords();
  renderMemos();
  renderDataPanel();
  syncWidgetData();
  scheduleHabitReminders();
}

function renderDataPanel() {
  const { checkinCount, memoCount } = getDataStats();
  document.getElementById("data-stats").textContent =
    `当前：${checkinCount} 条打卡 · ${memoCount} 条备忘录`;
  renderNotificationSettings();
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
  if (normalized.notifications && typeof normalized.notifications === "object") {
    saveNotificationSettings({
      ...DEFAULT_NOTIFICATIONS,
      ...normalized.notifications,
    });
  }

  replaceCheckins(normalized.checkins);
  memos = loadMemos();
  reloadAppData();
}

document.getElementById("save-notify-btn")?.addEventListener("click", saveNotificationSettingsFromForm);
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
initSummaryStatsToggle();
initRecordsFilters();
initRecordsFilterToggle();
document.getElementById("main-view")?.classList.add("main-content--calendar-fit");
document.getElementById("milestone-dismiss")?.addEventListener("click", closeMilestoneModal);
document.getElementById("milestone-modal")?.querySelector(".milestone-backdrop")?.addEventListener("click", closeMilestoneModal);
renderHeader();
renderCalendar();
initNativeBridge();
