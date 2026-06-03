const STORAGE_KEYS = {
  checkins: "calendar_checkins",
  memos: "calendar_memos",
  notes: "daily_notes",
  theme: "app_theme",
  encouragementLevel: "encouragement_level",
  shownAchievements: "shown_achievements",
  summaryStatsExpanded: "summary_stats_expanded",
  recordsFiltersExpanded: "records_filters_expanded",
  notifications: "habit_notifications",
  appPinHash: "app_pin_hash",
};

const APP_NAME = "365.dev";
const BACKUP_VERSION = 4;
const THEME_META = {
  light: "#5c7289",
  dawn: "#c4843a",
  dark: "#0f1114",
  sage: "#5a8a6a",
  sand: "#9a8060",
  ink: "#2a3544",
  dusk: "#3d2f3a",
};
const THEME_IDS = ["light", "dawn", "dark", "sage", "sand", "ink", "dusk"];
const DEFAULT_ENCOURAGEMENT_LEVEL = "strong";
const STREAK_MILESTONE_DAYS = [7, 14, 30, 60, 90];

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

const NOTIFY_BODY_NOON_FALLBACK = "午间打卡——守住了就点「守住了」。";
const NOTIFY_BODY_NIGHT_FALLBACK = "晚间打卡——记一下今天，守住了就点「守住了」。";

const SESSION_IDS = ["night", "noon"];
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

function getEncouragementLevel() {
  const level = loadJSON(STORAGE_KEYS.encouragementLevel, DEFAULT_ENCOURAGEMENT_LEVEL);
  return ENCOURAGEMENT_LEVELS.includes(level) ? level : DEFAULT_ENCOURAGEMENT_LEVEL;
}

function getEncPack() {
  return getEncouragementPack(getEncouragementLevel());
}

function pickEnc(key, seed) {
  const pack = getEncPack();
  const val = pack[key];
  if (Array.isArray(val)) return pickFromArray(val, seed);
  return val || "";
}

function getEncSummaryPlaceholder(status) {
  return getEncPack().SUMMARY_PLACEHOLDERS?.[status] || "今天发生了什么？用一句话记录...";
}

function getEncMilestoneMessage(milestone) {
  const pack = getEncPack();
  if (milestone.kind === "record") return pack.MILESTONE_MESSAGES.record;
  return pack.MILESTONE_MESSAGES[milestone.days];
}

function isDayDoubleSuccess(dateKey) {
  const day = getDayRecord(dateKey);
  return SESSION_IDS.every((s) => day[s]?.status === "success");
}

function countDoubleWinDays() {
  let count = 0;
  Object.keys(checkins).forEach((key) => {
    if (isDayDoubleSuccess(key)) count++;
  });
  return count;
}

function getMonthSoberDayCount(year, month) {
  const days = new Set();
  iterateSessionRecords((key, _session, rec) => {
    const p = parseDateKey(key);
    if (p.year !== year || p.month !== month) return;
    if (rec.status === "success") days.add(key);
  });
  return days.size;
}

function getMonthSuccessRate(year, month) {
  let success = 0;
  let total = 0;
  iterateSessionRecords((key, _session, rec) => {
    const p = parseDateKey(key);
    if (p.year !== year || p.month !== month) return;
    total++;
    if (rec.status === "success") success++;
  });
  return total ? Math.round((success / total) * 100) : 0;
}

function getWeekStats(refDate = new Date()) {
  const end = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  let success = 0;
  let total = 0;
  iterateSessionRecords((key, _session, rec) => {
    const p = parseDateKey(key);
    const d = new Date(p.year, p.month, p.day);
    if (d < start || d > end) return;
    total++;
    if (rec.status === "success") success++;
  });
  return { success, total, rate: total ? Math.round((success / total) * 100) : 0 };
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
  const h = getEncPack().STREAK_HINTS;
  if (dayIsRelapse(getTodayKey())) return h.relapse;
  if (current >= 90) return h.d90;
  if (current >= 60) return h.d60;
  if (current >= 30) return h.d30;
  if (current >= 14) return h.d14;
  if (current >= 7) return h.d7;
  if (current >= 2) return h.d2(current);
  if (current === 1) return h.d1;
  if (current === 0 && longest > 0) return h.restart;
  if (current === longest && current >= 3) return h.record(longest);
  return h.default;
}

function isStreakMilestoneDay(current) {
  return STREAK_MILESTONE_DAYS.includes(current);
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

function countSessionsByStatus(status) {
  let count = 0;
  iterateSessionRecords((_key, _session, rec) => {
    if (rec.status === status) count++;
  });
  return count;
}

function countSessionSuccessBySlot(sessionId) {
  let count = 0;
  iterateSessionRecords((_key, session, rec) => {
    if (session === sessionId && rec.status === "success") count++;
  });
  return count;
}

function getWeekPerfectRate() {
  const week = getWeekStats();
  return week;
}

function countTotalSessions() {
  let count = 0;
  iterateSessionRecords(() => {
    count++;
  });
  return count;
}

function getYearSuccessCount(year) {
  let count = 0;
  iterateSessionRecords((key, _session, rec) => {
    if (rec.status !== "success") return;
    if (parseDateKey(key).year === year) count++;
  });
  return count;
}

function countPinnedMemos() {
  return memos.filter((m) => m.pinned).length;
}

function getAchievementCheerLine(earnedCount, total) {
  if (earnedCount === 0) return "第一枚勋章等你来拿，今天就有机会解锁！";
  if (earnedCount < 5) return "已经上路了，每一枚都在证明你在变强。";
  if (earnedCount < 15) return "战绩亮眼！继续解锁更多高光时刻。";
  if (earnedCount < total * 0.5) return "坚持正在变成可见的成果，继续冲！";
  return "你是真正的长期主义者，太了不起了！";
}

function getAchievementsList() {
  const longest = getLongestStreak();
  const current = getCurrentStreak();
  const totalSuccess = getTotalSuccessCount();
  const doubleWinDays = countDoubleWinDays();
  const partialCount = countSessionsByStatus("partial");
  const failCount = countSessionsByStatus("fail");
  const noonSuccess = countSessionSuccessBySlot("noon");
  const nightSuccess = countSessionSuccessBySlot("night");
  const memoCount = memos.length;
  const pinnedMemos = countPinnedMemos();
  const totalSessions = countTotalSessions();
  const now = new Date();
  const year = now.getFullYear();
  const monthRate = getMonthSuccessRate(year, now.getMonth());
  const monthSoberDays = getMonthSoberDayCount(year, now.getMonth());
  const week = getWeekPerfectRate();
  const rankTier = getRankForStreak(longest).tier;
  const yearSuccess = getYearSuccessCount(year);

  return [
    { id: "first", label: "首次守住", desc: "完成第一次「守住了」打卡", earned: totalSuccess >= 1 },
    { id: "double", label: "首次双场全胜", desc: "同一天午间与晚间都守住", earned: doubleWinDays >= 1 },
    { id: "double3", label: "3 天双场全胜", desc: "累计 3 天双场全胜", earned: doubleWinDays >= 3 },
    { id: "double7", label: "7 天双场全胜", desc: "累计 7 天双场全胜", earned: doubleWinDays >= 7 },
    { id: "double14", label: "14 天双场全胜", desc: "累计 14 天双场全胜", earned: doubleWinDays >= 14 },
    { id: "double30", label: "30 天双场全胜", desc: "累计 30 天双场全胜", earned: doubleWinDays >= 30 },
    { id: "double60", label: "60 天双场全胜", desc: "累计 60 天双场全胜", earned: doubleWinDays >= 60 },
    { id: "streak3", label: "连续 3 天", desc: "连续清醒达到 3 天", earned: longest >= 3 },
    { id: "streak7", label: "连续 7 天", desc: "连续清醒达到 7 天", earned: longest >= 7 },
    { id: "streak14", label: "连续 14 天", desc: "连续清醒达到 14 天", earned: longest >= 14 },
    { id: "streak21", label: "连续 21 天", desc: "连续清醒达到 21 天", earned: longest >= 21 },
    { id: "streak30", label: "连续 30 天", desc: "连续清醒达到 30 天", earned: longest >= 30 },
    { id: "streak60", label: "连续 60 天", desc: "连续清醒达到 60 天", earned: longest >= 60 },
    { id: "streak90", label: "连续 90 天", desc: "连续清醒达到 90 天", earned: longest >= 90 },
    { id: "streak180", label: "连续 180 天", desc: "连续清醒达到 180 天", earned: longest >= 180 },
    { id: "streak365", label: "连续 365 天", desc: "连续清醒达到一整年", earned: longest >= 365 },
    { id: "total5", label: "累计守住 5 次", desc: "累计 5 次守住打卡", earned: totalSuccess >= 5 },
    { id: "total10", label: "累计守住 10 次", desc: "累计 10 次守住打卡", earned: totalSuccess >= 10 },
    { id: "total25", label: "累计守住 25 次", desc: "累计 25 次守住打卡", earned: totalSuccess >= 25 },
    { id: "total50", label: "累计守住 50 次", desc: "累计 50 次守住打卡", earned: totalSuccess >= 50 },
    { id: "total100", label: "累计守住 100 次", desc: "累计 100 次守住打卡", earned: totalSuccess >= 100 },
    { id: "total200", label: "累计守住 200 次", desc: "累计 200 次守住打卡", earned: totalSuccess >= 200 },
    { id: "total300", label: "累计守住 300 次", desc: "累计 300 次守住打卡", earned: totalSuccess >= 300 },
    { id: "total500", label: "累计守住 500 次", desc: "累计 500 次守住打卡", earned: totalSuccess >= 500 },
    { id: "noon10", label: "午间守住 10 次", desc: "午间场次累计守住 10 次", earned: noonSuccess >= 10 },
    { id: "noon25", label: "午间守住 25 次", desc: "午间场次累计守住 25 次", earned: noonSuccess >= 25 },
    { id: "noon50", label: "午间守住 50 次", desc: "午间场次累计守住 50 次", earned: noonSuccess >= 50 },
    { id: "night10", label: "晚间守住 10 次", desc: "晚间场次累计守住 10 次", earned: nightSuccess >= 10 },
    { id: "night25", label: "晚间守住 25 次", desc: "晚间场次累计守住 25 次", earned: nightSuccess >= 25 },
    { id: "night50", label: "晚间守住 50 次", desc: "晚间场次累计守住 50 次", earned: nightSuccess >= 50 },
    { id: "partial1", label: "首次差点犯", desc: "诚实记录第一次「差点犯」", earned: partialCount >= 1 },
    { id: "partial10", label: "差点犯 10 次", desc: "累计记录 10 次差点犯，说明你在持续对抗", earned: partialCount >= 10 },
    { id: "partial25", label: "差点犯 25 次", desc: "累计记录 25 次差点犯，你在场、你在战斗", earned: partialCount >= 25 },
    { id: "fail1", label: "首次复盘", desc: "诚实记录第一次「没守住」并完成复盘", earned: failCount >= 1 },
    { id: "fail5", label: "复盘 5 次", desc: "累计 5 次复盘，每一次都在帮下一次守住", earned: failCount >= 5 },
    { id: "memo1", label: "首条提示", desc: "写下第一条提示备忘", earned: memoCount >= 1 },
    { id: "memo5", label: "5 条提示", desc: "累计写下 5 条提示备忘", earned: memoCount >= 5 },
    { id: "memo10", label: "10 条提示", desc: "累计写下 10 条提示备忘", earned: memoCount >= 10 },
    { id: "memo20", label: "20 条提示", desc: "累计写下 20 条提示备忘", earned: memoCount >= 20 },
    { id: "pin1", label: "首次置顶", desc: "置顶第一条重要提示", earned: pinnedMemos >= 1 },
    { id: "pin3", label: "3 条置顶", desc: "累计置顶 3 条提示", earned: pinnedMemos >= 3 },
    { id: "sessions30", label: "打卡 30 次", desc: "累计完成 30 次打卡（任意状态）", earned: totalSessions >= 30 },
    { id: "sessions100", label: "打卡 100 次", desc: "累计完成 100 次打卡（任意状态）", earned: totalSessions >= 100 },
    { id: "sessions200", label: "打卡 200 次", desc: "累计完成 200 次打卡（任意状态）", earned: totalSessions >= 200 },
    { id: "month70", label: "本月守住率 70%", desc: "本月打卡守住率达到 70%", earned: monthRate >= 70 && monthSoberDays >= 4 },
    { id: "month80", label: "本月守住率 80%", desc: "本月打卡守住率达到 80%", earned: monthRate >= 80 && monthSoberDays >= 5 },
    { id: "month90", label: "本月守住率 90%", desc: "本月打卡守住率达到 90%", earned: monthRate >= 90 && monthSoberDays >= 8 },
    { id: "month100", label: "本月全胜", desc: "本月全部打卡均为守住（至少 6 次）", earned: monthRate === 100 && monthSoberDays >= 6 },
    { id: "week100", label: "本周全胜", desc: "近 7 天打卡全部守住（至少 2 次）", earned: week.rate === 100 && week.total >= 2 },
    { id: "year30", label: "今年守住 30 次", desc: `${year} 年累计守住 30 次`, earned: yearSuccess >= 30 },
    { id: "year100", label: "今年守住 100 次", desc: `${year} 年累计守住 100 次`, earned: yearSuccess >= 100 },
    { id: "rank5", label: "晋升上士", desc: "连续清醒达到上士档（22 天及以上）", earned: rankTier >= 5 },
    { id: "rank10", label: "晋升少尉", desc: "连续清醒达到少尉档（60 天及以上）", earned: rankTier >= 10 },
    { id: "rank13", label: "晋升少校", desc: "连续清醒达到少校档（101 天及以上）", earned: rankTier >= 13 },
    { id: "rank16", label: "晋升大校", desc: "连续清醒达到大校档（164 天及以上）", earned: rankTier >= 16 },
    { id: "rank19", label: "晋升上将", desc: "连续清醒达到最高军衔上将", earned: rankTier >= 19 },
    { id: "record", label: "个人新纪录", desc: "当前连续天数追平或打破历史最长", earned: current > 0 && current === longest && longest >= 7 },
    { id: "record30", label: "纪录 30 天", desc: "历史最长连续清醒达到 30 天", earned: longest >= 30 },
    { id: "record100", label: "纪录 100 天", desc: "历史最长连续清醒达到 100 天", earned: longest >= 100 },
  ];
}

function getEarnedAchievements() {
  return getAchievementsList().filter((a) => a.earned);
}

function loadShownAchievements() {
  const raw = loadJSON(STORAGE_KEYS.shownAchievements, []);
  return Array.isArray(raw) ? raw : [];
}

function saveShownAchievements(ids) {
  saveJSON(STORAGE_KEYS.shownAchievements, ids);
}

function detectNewAchievements() {
  const shown = new Set(loadShownAchievements());
  return getAchievementsList().filter((a) => a.earned && !shown.has(a.id));
}

function markAchievementsShown(ids) {
  const merged = [...new Set([...loadShownAchievements(), ...ids])];
  saveShownAchievements(merged);
}

function showAchievementUnlockModal(achievement) {
  const modal = document.getElementById("milestone-modal");
  const badgeEl = modal?.querySelector(".milestone-badge");
  const titleEl = document.getElementById("milestone-title");
  const bodyEl = document.getElementById("milestone-body");
  if (!modal || !titleEl || !bodyEl) return;

  if (badgeEl) badgeEl.textContent = "成就";
  titleEl.textContent = achievement.label;
  bodyEl.textContent = achievement.desc;
  modal.classList.add("milestone-modal--achievement");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

function queueAchievementUnlocks(achievements, delayStart = 3000) {
  achievements.forEach((a, i) => {
    setTimeout(() => {
      showAchievementUnlockModal(a);
      markAchievementsShown([a.id]);
    }, delayStart + i * 2800);
  });
}

let celebrationToastTimer = null;

function showCelebrationToast(message, duration = 2400) {
  const el = document.getElementById("celebration-toast");
  if (!el) return;
  clearTimeout(celebrationToastTimer);
  el.textContent = message;
  el.classList.remove("hidden");
  const level = getEncouragementLevel();
  el.classList.toggle("celebration-toast--strong", level === "strong");
  requestAnimationFrame(() => el.classList.add("show"));
  celebrationToastTimer = setTimeout(() => {
    el.classList.remove("show");
    celebrationToastTimer = setTimeout(() => el.classList.add("hidden"), 280);
  }, duration);
}

function showSuccessToast(streak, session, options = {}) {
  const pack = getEncPack();
  const prefix = pickFromArray(pack.SUCCESS_TOAST_PREFIX, streak + (session?.length || 0));
  const extra = pickFromArray(pack.SUCCESS_TOAST_EXTRAS, streak);
  const rank = getRankForStreak(streak);
  const sessionLabel = session ? SESSION_META[session]?.short + "间" : "";
  let msg = `${prefix} ✓ ${sessionLabel}守住了 · ${rank.name} · 连续第 ${streak} 天 · ${extra}`;
  if (options.doubleWin) {
    msg = `${pack.DOUBLE_WIN_TOAST} ${msg}`;
  }
  showCelebrationToast(msg, options.doubleWin ? 3200 : 2600);
}

function flashCalendarCell(dateKey) {
  const cell = document.querySelector(`.day-cell[data-date-key="${dateKey}"]`);
  if (!cell) return;
  cell.classList.remove("day-cell--pop");
  void cell.offsetWidth;
  cell.classList.add("day-cell--pop");
  setTimeout(() => cell.classList.remove("day-cell--pop"), 700);
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
    <div class="rank-up-badge-wrap rank-up-badge-wrap--animate">${renderRankBadgeSvg(rank, 72)}</div>
    <p class="rank-up-desc">${getEncPack().RANK_UP_DESC(getRankRangeLabel(rank))}</p>
  `;
  modal.classList.add("milestone-modal--rank-up");
  modal.classList.remove("milestone-modal--achievement");
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
  const msg = getEncMilestoneMessage(milestone);
  if (!msg) return;

  titleEl.textContent =
    milestone.kind === "record" ? `${msg.title} · ${milestone.days} 天` : msg.title;
  bodyEl.textContent = msg.body;
  modal.classList.remove("milestone-modal--achievement", "milestone-modal--rank-up");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

function closeMilestoneModal() {
  const modal = document.getElementById("milestone-modal");
  if (!modal) return;
  modal.classList.remove("show", "milestone-modal--achievement", "milestone-modal--rank-up");
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
  const doubleWin = isDayDoubleSuccess(dateKey);
  const newAchievements = detectNewAchievements();

  flashCalendarCell(dateKey);
  showSuccessToast(newStreak, session, { doubleWin });

  let chainDelay = 2800;
  if (milestone) {
    setTimeout(() => showMilestoneModal(milestone), chainDelay);
    chainDelay += 2800;
    if (rankUp) setTimeout(() => showRankUpModal(newRank), chainDelay);
    chainDelay += rankUp ? 2800 : 0;
  } else if (rankUp) {
    setTimeout(() => showRankUpModal(newRank), chainDelay);
    chainDelay += 2800;
  }

  if (newAchievements.length) {
    queueAchievementUnlocks(newAchievements, chainDelay);
  }

  renderAchievements();
}

function renderHeaderRank() {
  const el = document.getElementById("header-rank");
  if (!el) return;
  const streak = getCurrentStreak();
  el.innerHTML = renderHeaderRankHtml(streak);
}

function renderHeaderRankProgress() {
  const el = document.getElementById("header-rank-progress");
  if (!el) return;
  el.innerHTML = renderRankProgressHtml(getCurrentStreak());
}

function renderHeaderStreak() {
  const el = document.getElementById("header-streak");
  if (!el) return;
  const current = getCurrentStreak();
  const longest = getLongestStreak();
  const hint = getStreakHint(current, longest);
  el.classList.toggle("header-streak--milestone", isStreakMilestoneDay(current));
  el.innerHTML = `
    <div class="header-streak-main">
      <span class="header-streak-num">${current}</span>
      <span class="header-streak-unit">天</span>
      <span class="header-streak-label">连续清醒</span>
    </div>
    ${hint ? `<p class="header-streak-sub">${hint}</p>` : ""}
  `;
}

function migrateShownAchievements() {
  const shown = loadShownAchievements();
  if (shown.length) return;
  const earned = getAchievementsList()
    .filter((a) => a.earned)
    .map((a) => a.id);
  if (earned.length) saveShownAchievements(earned);
}

function renderHeader() {
  renderHeaderRank();
  renderHeaderStreak();
  renderHeaderRankProgress();
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
      body: pickEnc("NOTIFY_NOON", 1) || NOTIFY_BODY_NOON_FALLBACK,
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
        body: pickEnc("NOTIFY_NIGHT", 2) || NOTIFY_BODY_NIGHT_FALLBACK,
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

function renderMemoPinIcon() {
  return `<svg class="memo-pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 17v5"/><path d="M8 10V6a4 4 0 1 1 8 0v4"/><path d="M6 10h12v2l-2 8H8l-2-8v-2z"/>
  </svg>`;
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
      <div class="memo-card-header">
        <div class="memo-card-meta">
          <div class="memo-card-head">
            ${memo.pinned ? `<span class="memo-pin-badge" title="已置顶" aria-label="已置顶">${renderMemoPinIcon()}</span>` : ""}
            <h3 class="memo-title">${escapeHtml(preview)}</h3>
          </div>
          <time class="memo-time">${formatMemoTime(memo.updatedAt)}</time>
        </div>
      </div>
      <div class="memo-body-wrap${longMemo ? " is-collapsible" : ""}">
        <div class="memo-body">${bodyHtml}</div>
        ${expandBtn}
      </div>
      <div class="memo-actions" aria-hidden="true">
        <button type="button" class="memo-btn pin" data-action="${pinAction}" data-id="${memo.id}">${pinLabel}</button>
        <button type="button" class="memo-btn edit" data-action="edit" data-id="${memo.id}">编辑</button>
        <button type="button" class="memo-btn delete" data-action="delete" data-id="${memo.id}">删除</button>
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

document.getElementById("theme-options")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".theme-option");
  if (!btn) return;
  applyTheme(btn.dataset.theme);
});

function applyEncouragementLevel(level) {
  const lv = ENCOURAGEMENT_LEVELS.includes(level) ? level : DEFAULT_ENCOURAGEMENT_LEVEL;
  saveJSON(STORAGE_KEYS.encouragementLevel, lv);
  document.querySelectorAll(".encouragement-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.level === lv);
  });
  renderHeader();
  renderAchievements();
}

function initEncouragementLevel() {
  applyEncouragementLevel(getEncouragementLevel());
}

document.getElementById("encouragement-options")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".encouragement-option");
  if (!btn) return;
  applyEncouragementLevel(btn.dataset.level);
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

function switchTab(tabName, options = {}) {
  const { fromNav = true } = options;
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", fromNav && item.dataset.tab === tabName);
  });
  document.querySelectorAll("#main-view .panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabName}-panel`);
  });

  const mainView = document.getElementById("main-view");
  if (mainView) {
    mainView.classList.toggle(
      "main-content--nav-gap",
      tabName === "summary" || tabName === "memos" || tabName === "achievements" || tabName === "records"
    );
    mainView.classList.toggle("main-content--calendar-fit", tabName === "calendar");
  }

  updateHeaderVisibility(tabName);

  if (tabName === "records") renderRecords();
  if (tabName === "memos") renderMemos();
  if (tabName === "achievements") renderAchievements();
  if (tabName === "summary") renderSummary();
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => switchTab(item.dataset.tab, { fromNav: true }));
});

document.getElementById("achievements-open-records")?.addEventListener("click", () => {
  switchTab("records", { fromNav: false });
});

document.getElementById("records-back-btn")?.addEventListener("click", () => {
  switchTab("achievements", { fromNav: true });
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
    cell.dataset.dateKey = dateKey;

    if (dateKey === todayKey) {
      const hasCheckin = SESSION_IDS.some((s) => getSessionRecord(dateKey, s)?.status);
      if (!hasCheckin) cell.classList.add("today");
      cell.setAttribute("aria-label", `${day}日（今天）`);
    }
    if (isDayDoubleSuccess(dateKey)) {
      cell.classList.add("day-cell--double-win");
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

function getMonthEncourageLine(year, month) {
  const habit = getHabitMonthStats(year, month);
  const soberDays = getMonthSoberDayCount(year, month);
  const rate = getMonthSuccessRate(year, month);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  if (!habit.logged) {
    return isCurrentMonth
      ? "第一张胜利票等你来填，从今天开始！"
      : "这个月还没有记录，新的月份是新的机会。";
  }

  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear -= 1;
  }
  const prevSoberDays = getMonthSoberDayCount(prevYear, prevMonth);
  const diff = soberDays - prevSoberDays;

  if (isCurrentMonth && diff > 0) {
    return `本月已守住 ${soberDays} 天，比上个月多 ${diff} 天，继续冲！`;
  }
  if (isCurrentMonth && rate >= 80) {
    return `本月守住率 ${rate}%，你正在稳稳改写默认选项！`;
  }
  if (isCurrentMonth) {
    return `本月已守住 ${soberDays} 天，每一天都算数，继续加油！`;
  }
  return `该月守住 ${soberDays} 天，守住率 ${rate}%。`;
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

function renderMonthEncourage() {
  const encourageEl = document.getElementById("month-encourage");
  if (!encourageEl) return;
  const now = new Date();
  encourageEl.textContent = getMonthEncourageLine(now.getFullYear(), now.getMonth());
}

function renderAchievements() {
  const subtitleEl = document.getElementById("achievements-subtitle");
  if (subtitleEl) {
    const list = getAchievementsList();
    const earned = list.filter((a) => a.earned).length;
    subtitleEl.textContent = `已解锁 ${earned} / ${list.length} 项成就`;
  }
  renderMonthEncourage();
  renderCalendarAchievements();
  renderCalendarReport();
  renderAchievementBadgesFull();
  renderAchievementPanel();
}

function renderAchievementMedalSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" stroke="#c9a227" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5 4H3v1a4 4 0 0 0 4 4M19 4h2v1a4 4 0 0 1-4 4" stroke="#d4af37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function renderCalendarAchievements() {
  const el = document.getElementById("calendar-achievements");
  if (!el) return;

  const list = getAchievementsList();
  const earned = list.filter((a) => a.earned);
  const upcoming = list.filter((a) => !a.earned).slice(0, 3);
  const pct = list.length ? Math.round((earned.length / list.length) * 100) : 0;
  const cheerLine = getAchievementCheerLine(earned.length, list.length);

  const earnedHtml = earned
    .slice(-5)
    .reverse()
    .map(
      (a) =>
        `<span class="calendar-achievement-badge earned" title="${escapeHtml(a.desc)}"><span class="badge-icon" aria-hidden="true">★</span>${escapeHtml(a.label)}</span>`
    )
    .join("");

  const upcomingHtml = upcoming
    .map(
      (a) =>
        `<span class="calendar-achievement-badge locked" title="${escapeHtml(a.desc)}"><span class="badge-icon" aria-hidden="true">◇</span>${escapeHtml(a.label)}</span>`
    )
    .join("");

  el.innerHTML = `
    <div class="calendar-achievements-card">
      <div class="calendar-achievements-glow" aria-hidden="true"></div>
      <div class="calendar-achievements-head">
        <div class="calendar-achievements-head-main">
          <span class="calendar-achievements-medal" aria-hidden="true">${renderAchievementMedalSvg()}</span>
          <div class="calendar-achievements-head-text">
            <span class="calendar-achievements-title">我的战绩</span>
            <p class="calendar-achievements-cheer">${escapeHtml(cheerLine)}</p>
          </div>
        </div>
        <div class="calendar-achievements-actions">
          <span class="calendar-achievements-count">${earned.length}/${list.length}</span>
        </div>
      </div>
      <div class="calendar-achievements-progress-wrap">
        <div class="calendar-achievements-progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <span class="calendar-achievements-progress-fill" style="width:${pct}%"></span>
        </div>
        <span class="calendar-achievements-progress-label">已解锁 ${pct}%</span>
      </div>
      <div class="calendar-achievements-badges">${earnedHtml || '<span class="calendar-achievements-empty">完成打卡，第一枚勋章马上属于你</span>'}${upcomingHtml}</div>
    </div>
  `;
}

function renderAchievementBadgesFull() {
  const subEl = document.getElementById("achievements-full-sub");
  const badgesEl = document.getElementById("achievement-badges-full");
  if (!badgesEl) return;

  const totalSuccess = getTotalSuccessCount();
  const achievements = getAchievementsList();
  const achievementHtml = achievements
    .map(
      (a) =>
        `<span class="achievement-badge${a.earned ? " earned" : " locked"}" title="${escapeHtml(a.desc)}">${escapeHtml(a.label)}</span>`
    )
    .join("");

  if (subEl) {
    subEl.innerHTML = `累计守住 <strong>${totalSuccess}</strong> 次`;
  }
  badgesEl.innerHTML = achievementHtml;
}

function renderAchievementPanel() {
  const listEl = document.getElementById("achievement-list");
  if (!listEl) return;
  const list = getAchievementsList();
  const earnedCount = list.filter((a) => a.earned).length;

  listEl.innerHTML = `
    <p class="achievement-list-summary">已解锁 ${earnedCount} / ${list.length}</p>
    ${list
      .map(
        (a) => `
      <article class="achievement-list-item${a.earned ? " is-earned" : ""}">
        <div class="achievement-list-main">
          <span class="achievement-list-label">${escapeHtml(a.label)}</span>
          <span class="achievement-list-desc">${escapeHtml(a.desc)}</span>
        </div>
        <span class="achievement-list-status">${a.earned ? "已解锁" : "未解锁"}</span>
      </article>`
      )
      .join("")}
  `;
}

function renderCalendarReport() {
  const el = document.getElementById("calendar-report");
  if (!el) return;

  const week = getWeekStats();
  const current = getCurrentStreak();
  const longest = getLongestStreak();
  const now = new Date();
  const monthRate = getMonthSuccessRate(now.getFullYear(), now.getMonth());
  const monthSober = getMonthSoberDayCount(now.getFullYear(), now.getMonth());

  el.innerHTML = `
    <div class="calendar-report-card">
      <p class="calendar-report-title">本周 / 本月战报</p>
      <div class="calendar-report-grid">
        <div class="calendar-report-stat">
          <span class="calendar-report-num">${week.rate}%</span>
          <span class="calendar-report-label">近 7 天守住率</span>
        </div>
        <div class="calendar-report-stat">
          <span class="calendar-report-num">${monthRate}%</span>
          <span class="calendar-report-label">本月守住率</span>
        </div>
        <div class="calendar-report-stat">
          <span class="calendar-report-num">${monthSober}</span>
          <span class="calendar-report-label">本月守住天数</span>
        </div>
        <div class="calendar-report-stat highlight">
          <span class="calendar-report-num">${current}</span>
          <span class="calendar-report-label">当前连续 / 最长 ${longest}</span>
        </div>
      </div>
      <p class="calendar-report-foot">${week.total ? `近 7 天守住 ${week.success} 次，你仍在场上。` : "近 7 天还没有记录，今天就可以开始。"}</p>
    </div>
  `;
}

function renderSummary() {
  renderYearCalendar(summaryYear);

  const stats = getYearStats(summaryYear);
  document.getElementById("summary-subtitle").textContent = `${summaryYear} 年记录`;

  const overviewEl = document.getElementById("summary-overview");
  if (!stats.total) {
    overviewEl.innerHTML = `
      <div class="summary-empty">
        <p class="summary-empty-title">第一张胜利票等你来填</p>
        <p class="summary-empty-hint">在日历页完成第一次打卡，这里会为你汇总全年战绩</p>
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
      hint = pickEnc("SUCCESS_SELECT_HINTS", selectedDateKey?.length);
    } else if (status === "partial") {
      hint = pickEnc("PARTIAL_SELECT_HINTS", selectedDateKey?.length);
    } else if (status === "fail") {
      hint = pickEnc("FAIL_SELECT_HINTS", selectedDateKey?.length);
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
    summaryEl.placeholder = status
      ? getEncSummaryPlaceholder(status)
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
    renderAchievements();
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
  renderAchievements();
  syncWidgetData();
}

function buildMiniDayHtml(year, month, dayNum, todayKey) {
  const dateKey = formatDateKey(year, month, dayNum);
  const agg = getDayAggregateStatus(dateKey);
  let cls = "mini-day mini-day--readonly";
  if (dateKey === todayKey) {
    const hasCheckin = SESSION_IDS.some((s) => getSessionRecord(dateKey, s)?.status);
    if (!hasCheckin) cls += " today";
  }
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
      renderAchievements();
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
  } else if (status === "partial") {
    showCelebrationToast(pickEnc("PARTIAL_SAVE_TOAST", dateKey.length), 2600);
    const newAchievements = detectNewAchievements();
    if (newAchievements.length) queueAchievementUnlocks(newAchievements, 2800);
    renderAchievements();
  } else if (status === "fail") {
    showCelebrationToast(pickEnc("FAIL_SAVE_TOAST", dateKey.length), 2600);
    renderAchievements();
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
  entries.sort((a, b) => {
    const dateCmp = b.dateKey.localeCompare(a.dateKey);
    if (dateCmp !== 0) return dateCmp;
    return SESSION_IDS.indexOf(a.session) - SESSION_IDS.indexOf(b.session);
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
        <p>${hasFilter ? "没有符合筛选条件的记录" : "还没有打卡记录，第一笔胜利等你来写"}</p>
        <p class="records-empty-hint">${
          hasFilter ? "试试调整筛选条件" : "去日历打卡，写下你的第一句话总结，这就是开始！"
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

function hideMemoCardActions(exceptCard = null) {
  document.querySelectorAll(".memo-card.actions-visible").forEach((card) => {
    if (card !== exceptCard) {
      card.classList.remove("actions-visible");
      card.querySelector(".memo-actions")?.setAttribute("aria-hidden", "true");
    }
  });
}

function showMemoCardActions(card) {
  if (!card) return;
  hideMemoCardActions(card);
  card.classList.add("actions-visible");
  card.querySelector(".memo-actions")?.setAttribute("aria-hidden", "false");
  hapticImpact("Light");
}

let memoLongPressTimer = null;
let memoLongPressCard = null;

function clearMemoLongPressTimer() {
  if (memoLongPressTimer) {
    clearTimeout(memoLongPressTimer);
    memoLongPressTimer = null;
  }
  memoLongPressCard = null;
}

function initMemoLongPress() {
  const listEl = document.getElementById("memos-list");
  if (!listEl) return;

  listEl.addEventListener(
    "touchstart",
    (e) => {
      const card = e.target.closest(".memo-card");
      if (!card || e.target.closest(".memo-actions, .memo-expand-btn")) return;
      clearMemoLongPressTimer();
      memoLongPressCard = card;
      memoLongPressTimer = setTimeout(() => {
        showMemoCardActions(card);
        clearMemoLongPressTimer();
      }, 480);
    },
    { passive: true }
  );

  ["touchend", "touchmove", "touchcancel"].forEach((type) => {
    listEl.addEventListener(type, clearMemoLongPressTimer, { passive: true });
  });

  listEl.addEventListener("mousedown", (e) => {
    const card = e.target.closest(".memo-card");
    if (!card || e.target.closest(".memo-actions, .memo-expand-btn")) return;
    clearMemoLongPressTimer();
    memoLongPressCard = card;
    memoLongPressTimer = setTimeout(() => {
      showMemoCardActions(card);
      clearMemoLongPressTimer();
    }, 480);
  });

  listEl.addEventListener("mouseup", clearMemoLongPressTimer);
  listEl.addEventListener("mouseleave", clearMemoLongPressTimer);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".memo-card")) hideMemoCardActions();
  });
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
  hideMemoCardActions();
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
        <p class="memos-empty-hint">点击右上角「+ 新建」，写下第一条给自己的话</p>
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
    : '<p class="memo-empty-text">暂无内容</p>';
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
      encouragementLevel: getEncouragementLevel(),
      shownAchievements: loadShownAchievements(),
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
      encouragementLevel: raw.data.encouragementLevel,
      shownAchievements: raw.data.shownAchievements,
    };
  }

  if (raw.checkins || raw.memos) {
    return {
      checkins: raw.checkins ?? {},
      memos: raw.memos ?? [],
      notifications: raw.notifications,
      encouragementLevel: raw.encouragementLevel,
      shownAchievements: raw.shownAchievements,
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
  renderAchievements();
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
  renderPinSettingsForm();
}

// ===== 应用密码 =====
const PIN_SESSION_KEY = "app_unlocked";
const PIN_MIN_LEN = 4;
const PIN_MAX_LEN = 8;

function normalizePinInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, PIN_MAX_LEN);
}

function isValidPin(pin) {
  return /^\d{4,8}$/.test(pin);
}

async function hashPin(pin) {
  const text = `${APP_NAME}:${pin}`;
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return `f${(hash >>> 0).toString(16)}`;
}

function getStoredPinHash() {
  return loadJSON(STORAGE_KEYS.appPinHash, "") || "";
}

function isPinConfigured() {
  return !!getStoredPinHash();
}

function isAppUnlocked() {
  return !isPinConfigured() || sessionStorage.getItem(PIN_SESSION_KEY) === "1";
}

function showLockScreen() {
  const screen = document.getElementById("lock-screen");
  const input = document.getElementById("lock-pin-input");
  const errorEl = document.getElementById("lock-error");
  if (!screen) return;
  screen.classList.remove("hidden");
  screen.setAttribute("aria-hidden", "false");
  document.body.classList.add("body-locked");
  if (errorEl) errorEl.classList.add("hidden");
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 60);
  }
}

function hideLockScreen() {
  const screen = document.getElementById("lock-screen");
  if (!screen) return;
  screen.classList.add("hidden");
  screen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("body-locked");
}

async function verifyPin(pin) {
  const hash = await hashPin(pin);
  return hash === getStoredPinHash();
}

async function savePinHash(pin) {
  const hash = await hashPin(pin);
  saveJSON(STORAGE_KEYS.appPinHash, hash);
}

async function unlockAppWithPin(pin) {
  const normalized = normalizePinInput(pin);
  if (!isValidPin(normalized)) return false;
  const ok = await verifyPin(normalized);
  if (!ok) return false;
  sessionStorage.setItem(PIN_SESSION_KEY, "1");
  hideLockScreen();
  return true;
}

async function handleLockSubmit() {
  const input = document.getElementById("lock-pin-input");
  const errorEl = document.getElementById("lock-error");
  if (!input) return;
  const ok = await unlockAppWithPin(input.value);
  if (!ok) {
    errorEl?.classList.remove("hidden");
    input.value = "";
    input.focus();
    hapticImpact("Light");
    return;
  }
  errorEl?.classList.add("hidden");
}

function renderPinSettingsForm() {
  const formEl = document.getElementById("pin-settings-form");
  const descEl = document.getElementById("pin-settings-desc");
  if (!formEl) return;

  const configured = isPinConfigured();
  if (descEl) {
    descEl.textContent = configured
      ? "已启用数字密码，可修改或清除"
      : "设置 4–8 位数字密码，启动时需验证后才能进入";
  }

  if (!configured) {
    formEl.innerHTML = `
      <label class="settings-field-label" for="pin-set-new">新密码</label>
      <input type="password" id="pin-set-new" class="settings-pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="4–8 位数字" />
      <label class="settings-field-label" for="pin-set-confirm">确认密码</label>
      <input type="password" id="pin-set-confirm" class="settings-pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="再次输入" />
      <button type="button" id="pin-set-btn" class="btn-primary pin-settings-btn">设置密码</button>
    `;
    document.getElementById("pin-set-btn")?.addEventListener("click", handlePinSet);
    return;
  }

  formEl.innerHTML = `
    <label class="settings-field-label" for="pin-old">当前密码</label>
    <input type="password" id="pin-old" class="settings-pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="current-password" placeholder="当前密码" />
    <label class="settings-field-label" for="pin-new">新密码</label>
    <input type="password" id="pin-new" class="settings-pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="4–8 位数字" />
    <label class="settings-field-label" for="pin-new-confirm">确认新密码</label>
    <input type="password" id="pin-new-confirm" class="settings-pin-input" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="再次输入" />
    <div class="pin-settings-actions">
      <button type="button" id="pin-change-btn" class="btn-primary pin-settings-btn">修改密码</button>
      <button type="button" id="pin-remove-btn" class="btn-secondary pin-settings-btn">清除密码</button>
    </div>
  `;
  document.getElementById("pin-change-btn")?.addEventListener("click", handlePinChange);
  document.getElementById("pin-remove-btn")?.addEventListener("click", handlePinRemove);
}

async function handlePinSet() {
  const pin = normalizePinInput(document.getElementById("pin-set-new")?.value);
  const confirm = normalizePinInput(document.getElementById("pin-set-confirm")?.value);
  if (!isValidPin(pin)) {
    alert(`密码需为 ${PIN_MIN_LEN}–${PIN_MAX_LEN} 位数字`);
    return;
  }
  if (pin !== confirm) {
    alert("两次输入的密码不一致");
    return;
  }
  await savePinHash(pin);
  sessionStorage.setItem(PIN_SESSION_KEY, "1");
  hideLockScreen();
  renderPinSettingsForm();
  alert("密码设置成功");
}

async function handlePinChange() {
  const oldPin = normalizePinInput(document.getElementById("pin-old")?.value);
  const newPin = normalizePinInput(document.getElementById("pin-new")?.value);
  const confirm = normalizePinInput(document.getElementById("pin-new-confirm")?.value);
  if (!(await verifyPin(oldPin))) {
    alert("当前密码不正确");
    return;
  }
  if (!isValidPin(newPin)) {
    alert(`新密码需为 ${PIN_MIN_LEN}–${PIN_MAX_LEN} 位数字`);
    return;
  }
  if (newPin !== confirm) {
    alert("两次输入的新密码不一致");
    return;
  }
  await savePinHash(newPin);
  sessionStorage.setItem(PIN_SESSION_KEY, "1");
  renderPinSettingsForm();
  alert("密码已修改");
}

async function handlePinRemove() {
  const oldPin = normalizePinInput(document.getElementById("pin-old")?.value);
  if (!(await verifyPin(oldPin))) {
    alert("当前密码不正确");
    return;
  }
  if (!confirm("确定清除应用密码？清除后启动将不再需要验证。")) return;
  localStorage.removeItem(STORAGE_KEYS.appPinHash);
  sessionStorage.removeItem(PIN_SESSION_KEY);
  hideLockScreen();
  renderPinSettingsForm();
  alert("密码已清除");
}

function initAppLock() {
  if (isAppUnlocked()) {
    hideLockScreen();
  } else {
    showLockScreen();
  }

  document.getElementById("lock-submit-btn")?.addEventListener("click", handleLockSubmit);
  document.getElementById("lock-pin-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLockSubmit();
  });
  document.getElementById("lock-pin-input")?.addEventListener("input", (e) => {
    e.target.value = normalizePinInput(e.target.value);
    document.getElementById("lock-error")?.classList.add("hidden");
  });
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
  if (
    normalized.encouragementLevel &&
    ENCOURAGEMENT_LEVELS.includes(normalized.encouragementLevel)
  ) {
    saveJSON(STORAGE_KEYS.encouragementLevel, normalized.encouragementLevel);
  }
  if (Array.isArray(normalized.shownAchievements)) {
    saveJSON(STORAGE_KEYS.shownAchievements, normalized.shownAchievements);
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
initEncouragementLevel();
initSummaryStatsToggle();
initRecordsFilters();
initRecordsFilterToggle();
initMemoLongPress();
initAppLock();
document.getElementById("main-view")?.classList.add("main-content--calendar-fit");
document.getElementById("milestone-dismiss")?.addEventListener("click", closeMilestoneModal);
document.getElementById("milestone-modal")?.querySelector(".milestone-backdrop")?.addEventListener("click", closeMilestoneModal);
renderHeader();
renderCalendar();
migrateShownAchievements();
initNativeBridge();
