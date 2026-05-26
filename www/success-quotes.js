/** 鼓励强度：温和 / 标准 / 强鼓励 */
const ENCOURAGEMENT_LEVELS = ["gentle", "standard", "strong"];

const ENCOURAGEMENT_PACKS = {
  gentle: {
    SUCCESS_QUOTES: [
      "今天又赢了一次。",
      "这一下很难，你做到了。",
      "不是没冲动，是冲动没赢。",
      "给明天的自己，留了一个更好的起点。",
      "每一次守住，都是在重写默认选项。",
    ],
    SUCCESS_TOAST_PREFIX: ["很好", "不错", "守住了"],
    SUCCESS_TOAST_EXTRAS: [
      "今天又赢了一次",
      "这一下很难，你做到了",
      "你选对了",
    ],
    DOUBLE_WIN_TOAST: "今日双场全胜，可以安心一点。",
    SUCCESS_SELECT_HINTS: [
      "选这个，就是在给明天的自己铺路。",
      "记下一笔，下次更好复制今天的做法。",
      "守住不是运气，是一次次正确的选择。",
    ],
    PARTIAL_SELECT_HINTS: [
      "拦住了也算赢，差一点不代表失败。",
      "记录「差点犯」，下次更容易提前识别。",
      "没完全守住，但你在场、你在对抗。",
    ],
    FAIL_SELECT_HINTS: [
      "诚实记录比假装完美更有力量。",
      "填诱因和小计划，是在帮下一次守住。",
      "复发不等于放弃，复盘后重新来。",
    ],
    FAIL_SAVE_TOAST: "记录完成，下一局从现在开始。",
    PARTIAL_SAVE_TOAST: "差点犯也记下了，你在和高危瞬间搏斗。",
    SUMMARY_PLACEHOLDERS: {
      success: "今天靠什么守住的？记一笔，下次更好复制。",
      partial: "差在哪里？下次可以提前准备什么？",
      fail: "发生了什么？诚实写下来，就是在帮自己。",
    },
    STREAK_HINTS: {
      relapse: "今天没守住也没关系，明天可以重新来",
      d90: "三个月级的坚持，默认选项已经换了",
      d60: "两个月，新常态正在形成",
      d30: "一个月，你在用事实证明自己",
      d14: "两周了，这已经不是运气",
      d7: "完整一周，大脑开始认这条新路",
      d2: (n) => `第 ${n} 天，每一天都在重写默认选项`,
      d1: "Day 1 也是胜利，今天开始了",
      restart: "随时可以重新开始 Day 1",
      record: (n) => `平了个人纪录 ${n} 天，稳住就是进步`,
      default: "守住一天，就多一天自由",
    },
    RANK_UP_DESC: (range) => `连续清醒进入 ${range} 档，继续保持。`,
    MILESTONE_MESSAGES: {
      1: { title: "Day 1", body: "第一个胜利日。最难的不是永远，是开始。" },
      7: { title: "连续 7 天", body: "完整一周，大脑开始认这条新路。" },
      14: { title: "连续 14 天", body: "两周了，这已经不是运气。" },
      30: { title: "连续 30 天", body: "一个月，你在用事实证明自己。" },
      60: { title: "连续 60 天", body: "两个月，新常态正在形成。" },
      90: { title: "连续 90 天", body: "三个月级的坚持，默认选项已经换了。" },
      record: { title: "个人新纪录", body: "打破了历史最长连续，这是硬实力。" },
    },
    GREETING: {
      doubleWin: "今日双场全胜，可以安心一点。",
      streak: (n) => `第 ${n} 天，你仍在战斗`,
      checkedIn: "今天已经守住了，可以安心一点",
      pending: "午间/晚间场还没记录，等你来赢这一局",
      morning: "新的一天，从第一个正确选择开始",
      evening: "今天还没结束，仍有机会守住",
    },
    NOTIFY_NOON: [
      "午间打卡——守住了就点「守住了」。",
      "中午是高危时段，记一笔就是赢。",
    ],
    NOTIFY_NIGHT: [
      "晚间打卡——记一下今天，守住了就点「守住了」。",
      "给今天画一个句号，守住再睡。",
    ],
    DOUBLE_WIN_BADGE: "今日双场全胜",
    ACHIEVEMENT_UNLOCK: (label) => `解锁成就：${label}`,
  },
  standard: {
    SUCCESS_QUOTES: [
      "太棒了，今天又赢了一次！",
      "这一下很难，你做到了，真了不起。",
      "不是没冲动，是冲动没赢——你更强。",
      "今天高危时段过去了，你选对了！",
      "给明天的自己，留了一个更好的起点。",
      "每一次守住，都是在重写默认选项。",
      "你证明了：这次可以不一样。",
      "把今天守住，就是给自由多存一天。",
      "难而正确的事，你完成了。",
      "Day by day，习惯在加固，你在变强。",
    ],
    SUCCESS_TOAST_PREFIX: ["太棒了！", "干得漂亮！", "你做到了！"],
    SUCCESS_TOAST_EXTRAS: [
      "今天又赢了一次",
      "这一下很难，你做到了",
      "冲动没赢，你赢了",
      "你选对了，值得骄傲",
    ],
    DOUBLE_WIN_TOAST: "今日双场全胜！你是今天的赢家！",
    SUCCESS_SELECT_HINTS: [
      "选这个，就是在给明天的自己铺路。",
      "这一下选对了，值得认真总结！",
      "守住不是运气，是你一次次正确的选择。",
      "今天这一票，投给了更好的自己。",
      "这就是强者会做的选择。",
    ],
    PARTIAL_SELECT_HINTS: [
      "拦住了也算赢，差一点不代表失败！",
      "高危瞬间搏斗过，这本身就需要勇气。",
      "记录「差点犯」，下次更容易提前识别。",
      "没完全守住，但你在场、你在对抗。",
    ],
    FAIL_SELECT_HINTS: [
      "愿意诚实面对，本身就比逃避强一百倍。",
      "填诱因和小计划，是在帮下一次守住。",
      "复发不等于放弃，复盘后重新来。",
      "今天跌倒了，但你还在这里，这就是没放弃。",
    ],
    FAIL_SAVE_TOAST: "记录完成，下一局从现在开始。你仍在场上。",
    PARTIAL_SAVE_TOAST: "差点犯也记下了！你在和高危瞬间搏斗，这很勇敢。",
    SUMMARY_PLACEHOLDERS: {
      success: "今天靠什么守住的？记一笔，下次更好复制！",
      partial: "差在哪里？下次可以提前准备什么？",
      fail: "发生了什么？诚实写下来，就是在帮自己。",
    },
    STREAK_HINTS: {
      relapse: "今天跌倒了，但你还在这里，明天重新来",
      d90: "三个月！默认选项已经换了，你做到了",
      d60: "两个月！新常态正在形成，继续冲",
      d30: "一个月！你在用事实证明自己",
      d14: "两周了！这已经不是运气，是实力",
      d7: "完整一周！大脑开始认这条新路",
      d2: (n) => `${n} 天！惯性正在转向你这边`,
      d1: "Day 1 胜利！最难的是开始，你开始了",
      restart: "随时可以重新开始 Day 1，你仍有机会",
      record: (n) => `平了个人纪录 ${n} 天！稳住就是进步`,
      default: "守住一天，就多一天自由",
    },
    RANK_UP_DESC: (range) => `你凭实力升到了 ${range} 档，这是应得的！`,
    MILESTONE_MESSAGES: {
      1: { title: "Day 1 胜利！", body: "第一个胜利日！最难的不是永远，是开始——你开始了。" },
      7: { title: "连续 7 天！", body: "完整一周！大脑开始认这条新路，你正在改写自己。" },
      14: { title: "连续 14 天！", body: "两周了！这已经不是运气，是你在一次次选对。" },
      30: { title: "连续 30 天！", body: "一个月！你在用事实证明：这次可以不一样。" },
      60: { title: "连续 60 天！", body: "两个月！新常态正在形成，你已经是另一种人了。" },
      90: { title: "连续 90 天！", body: "三个月级的坚持！默认选项已经换了，太了不起。" },
      record: { title: "个人新纪录！", body: "打破了历史最长连续！这是硬实力，值得骄傲。" },
    },
    GREETING: {
      doubleWin: "今日双场全胜！你是今天的赢家！",
      streak: (n) => `第 ${n} 天，你仍在战斗，了不起！`,
      checkedIn: "今天已经守住了，可以安心一点，你做得很好",
      pending: "还有场次没记录，等你来赢这一局！",
      morning: "新的一天！从第一个正确选择开始",
      evening: "今天还没结束，仍有机会守住，加油",
    },
    NOTIFY_NOON: [
      "午间场来了——你比冲动更强大！",
      "中午是高危时段，记一笔就是赢。",
      "午间打卡：守住这一下，今天就稳了。",
    ],
    NOTIFY_NIGHT: [
      "晚间打卡：给今天画一个赢的句号。",
      "回顾全天，守住再睡，你值得安心。",
      "晚间场来了——今天的最后一票，投给更好的自己。",
    ],
    DOUBLE_WIN_BADGE: "今日双场全胜 · 你是赢家",
    ACHIEVEMENT_UNLOCK: (label) => `🎉 解锁成就：${label}`,
  },
  strong: {
    SUCCESS_QUOTES: [
      "太棒了！今天又赢了一次，你真的很强！",
      "这一下超难，你做到了！我为你骄傲！",
      "冲动来了又怎样？最后还是你赢！",
      "高危时段过去了——你选对了，这就是强者！",
      "给明天的自己存下了一份超级礼物！",
      "每一次守住，你都在重写命运！",
      "你证明了：这次绝对可以不一样！",
      "把今天守住，自由又多存一天——继续冲！",
      "难而正确的事，你完成了！牛逼！",
      "Day by day，你在变强，习惯在为你打工！",
      "今天的你，比昨天更值得信赖！",
      "这不是运气，这是你一次次硬扛出来的！",
    ],
    SUCCESS_TOAST_PREFIX: ["太棒了！！", "干得漂亮！！", "你太强了！！"],
    SUCCESS_TOAST_EXTRAS: [
      "今天又赢了一次，继续冲",
      "这一下很难，你硬扛住了",
      "冲动没赢，你赢了全场",
      "你选对了，这就是强者",
      "又向自由迈进一大步",
    ],
    DOUBLE_WIN_TOAST: "🔥 今日双场全胜！你是今天的绝对赢家！",
    SUCCESS_SELECT_HINTS: [
      "选这个！就是在给明天的自己铺路！",
      "这一下选对了！值得大声庆祝！",
      "守住不是运气，是你一次次硬选出来的！",
      "今天这一票，投给了更牛逼的自己！",
      "这就是强者会做的选择，你正在成为那种人！",
    ],
    PARTIAL_SELECT_HINTS: [
      "拦住了就是胜利！差一点也是赢，不是打折！",
      "高危瞬间搏斗过——这本身就需要巨大的勇气！",
      "记录「差点犯」，下次你会更强！",
      "没完全守住，但你在场、你在对抗，这很了不起！",
    ],
    FAIL_SELECT_HINTS: [
      "愿意诚实面对，比假装完美强一百倍！你没有逃避！",
      "填诱因和小计划，下一次你会更猛！",
      "复发不等于放弃！复盘后重新来，你仍在场上！",
      "今天跌倒了，但你还在这里——这就是没放弃，这就够了！",
    ],
    FAIL_SAVE_TOAST: "记录完成！下一局从现在开始，你仍有机会赢回来！",
    PARTIAL_SAVE_TOAST: "差点犯记下了！你在和高危搏斗，这很勇敢，下次会更强！",
    SUMMARY_PLACEHOLDERS: {
      success: "今天靠什么守住的？写下来，下次复制这份胜利！",
      partial: "差在哪里？写下来，下次提前干掉它！",
      fail: "发生了什么？诚实写下来，就是在帮未来的自己！",
    },
    STREAK_HINTS: {
      relapse: "今天跌倒了没关系！你还在这里，明天重新赢回来！",
      d90: "三个月！！！默认选项已经换了——你是真的变了！",
      d60: "两个月！！新常态正在形成，继续冲，别停！",
      d30: "一个月！！你在用事实证明自己，太强了！",
      d14: "两周了！！这绝对不是运气，是硬实力！",
      d7: "完整一周！！大脑开始认这条新路，惯性转向你了！",
      d2: (n) => `${n} 天！！惯性正在转向你这边，继续冲！`,
      d1: "Day 1 胜利！！最难的是开始——你开始了，这就很牛！",
      restart: "随时可以重新开始 Day 1！你仍有机会，冲！",
      record: (n) => `平了个人纪录 ${n} 天！！稳住就是进步，你太强了！`,
      default: "守住一天，就多一天自由——每一天都算数！",
    },
    RANK_UP_DESC: (range) => `你凭实力晋升到 ${range} 档！这是应得的，继续升级！`,
    MILESTONE_MESSAGES: {
      1: { title: "Day 1 胜利！！", body: "第一个胜利日！最难的不是永远，是开始——你已经开始了，这就很了不起！" },
      7: { title: "连续 7 天！！", body: "完整一周！大脑开始认这条新路，你正在改写自己，继续冲！" },
      14: { title: "连续 14 天！！", body: "两周了！这绝对不是运气——是你在一次次硬选对！" },
      30: { title: "连续 30 天！！", body: "一个月！你在用事实证明：这次可以不一样，而且你正在做到！" },
      60: { title: "连续 60 天！！", body: "两个月！新常态正在形成——你已经是另一种人了！" },
      90: { title: "连续 90 天！！", body: "三个月级的坚持！！默认选项已经换了，你太了不起了！" },
      record: { title: "个人新纪录！！", body: "打破了历史最长连续！！这是硬实力，值得大声庆祝！" },
    },
    GREETING: {
      streak: (n) => `第 ${n} 天！你仍在战斗，真的了不起！`,
      doubleWin: "今日双场全胜！你是今天的绝对赢家！",
      checkedIn: "今天已经守住了！可以安心一点，你做得很好！",
      pending: "还有场次等你来赢！这一局，你可以的！",
      morning: "新的一天！从第一个正确选择开始，冲！",
      evening: "今天还没结束！仍有机会守住，加油！",
    },
    NOTIFY_NOON: [
      "午间场来了——你比冲动更强大！冲！",
      "中午是高危时段，记一笔就是赢！",
      "午间打卡：守住这一下，今天就是你的！",
    ],
    NOTIFY_NIGHT: [
      "晚间打卡：给今天画一个赢的句号！",
      "回顾全天，守住再睡——你值得安心！",
      "晚间场来了——最后一票，投给更强大的自己！",
    ],
    DOUBLE_WIN_BADGE: "🔥 今日双场全胜 · 绝对赢家",
    ACHIEVEMENT_UNLOCK: (label) => `🎉🎉 解锁成就：${label}！太棒了！`,
  },
};

function getEncouragementPack(level) {
  return ENCOURAGEMENT_PACKS[level] || ENCOURAGEMENT_PACKS.standard;
}

function getEncouragementLevelLabel(level) {
  if (level === "gentle") return "温和";
  if (level === "strong") return "强鼓励";
  return "标准";
}

/** 兼容旧引用 */
const SUCCESS_QUOTES = ENCOURAGEMENT_PACKS.standard.SUCCESS_QUOTES;
const SUCCESS_TOAST_EXTRAS = ENCOURAGEMENT_PACKS.standard.SUCCESS_TOAST_EXTRAS;
const SUCCESS_SELECT_HINTS = ENCOURAGEMENT_PACKS.standard.SUCCESS_SELECT_HINTS;
const PARTIAL_SELECT_HINTS = ENCOURAGEMENT_PACKS.standard.PARTIAL_SELECT_HINTS;
const FAIL_SELECT_HINTS = ENCOURAGEMENT_PACKS.standard.FAIL_SELECT_HINTS;
const SUMMARY_PLACEHOLDERS = ENCOURAGEMENT_PACKS.standard.SUMMARY_PLACEHOLDERS;
const MILESTONE_MESSAGES = ENCOURAGEMENT_PACKS.standard.MILESTONE_MESSAGES;
