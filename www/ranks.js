/** 连续清醒天数 → 军衔等级 */
const MILITARY_RANKS = [
  { tier: 1, min: 0, max: 3, name: "列兵", color: "#94a3b8", stripes: 1, stars: 0 },
  { tier: 2, min: 4, max: 9, name: "上等兵", color: "#78909c", stripes: 2, stars: 0 },
  { tier: 3, min: 10, max: 14, name: "下士", color: "#c9a227", stripes: 1, stars: 0, bar: true },
  { tier: 4, min: 15, max: 21, name: "中士", color: "#d4af37", stripes: 2, stars: 0, bar: true },
  { tier: 5, min: 22, max: 29, name: "上士", color: "#e6c04a", stripes: 3, stars: 0, bar: true },
  { tier: 6, min: 30, max: 35, name: "四级军士长", color: "#5a7fa8", stripes: 0, stars: 1, chevron: 4 },
  { tier: 7, min: 36, max: 42, name: "三级军士长", color: "#4a6f98", stripes: 0, stars: 1, chevron: 5 },
  { tier: 8, min: 43, max: 50, name: "二级军士长", color: "#3d5f86", stripes: 0, stars: 2, chevron: 5 },
  { tier: 9, min: 51, max: 59, name: "一级军士长", color: "#2f5074", stripes: 0, stars: 2, chevron: 6 },
  { tier: 10, min: 60, max: 70, name: "少尉", color: "#6b8cae", stripes: 0, stars: 1, officer: true },
  { tier: 11, min: 71, max: 86, name: "中尉", color: "#5a7fa8", stripes: 0, stars: 2, officer: true },
  { tier: 12, min: 87, max: 100, name: "上尉", color: "#4a6f98", stripes: 0, stars: 3, officer: true },
  { tier: 13, min: 101, max: 120, name: "少校", color: "#c45c5c", stripes: 0, stars: 1, oak: true },
  { tier: 14, min: 121, max: 142, name: "中校", color: "#b84a4a", stripes: 0, stars: 2, oak: true },
  { tier: 15, min: 143, max: 163, name: "上校", color: "#a83838", stripes: 0, stars: 3, oak: true },
  { tier: 16, min: 164, max: 182, name: "大校", color: "#922f2f", stripes: 0, stars: 4, oak: true },
  { tier: 17, min: 183, max: 200, name: "少将", color: "#7c3aed", stripes: 0, stars: 1, general: true },
  { tier: 18, min: 201, max: 220, name: "中将", color: "#6d28d9", stripes: 0, stars: 2, general: true },
  { tier: 19, min: 221, max: Infinity, name: "上将", color: "#5b21b6", stripes: 0, stars: 3, general: true },
];

function getRankForStreak(days) {
  const d = Math.max(0, days || 0);
  return (
    MILITARY_RANKS.find((r) => d >= r.min && d <= r.max) ||
    MILITARY_RANKS[MILITARY_RANKS.length - 1]
  );
}

function getRankRangeLabel(rank) {
  if (rank.max === Infinity) return `${rank.min} 天及以上`;
  return `${rank.min}–${rank.max} 天`;
}

function getNextRank(days) {
  const current = getRankForStreak(days);
  if (current.tier >= MILITARY_RANKS.length) return null;
  return MILITARY_RANKS.find((r) => r.tier === current.tier + 1) || null;
}

function getRankProgress(days) {
  const rank = getRankForStreak(days);
  const d = Math.max(0, days || 0);
  if (rank.max === Infinity) {
    return { rank, next: null, remaining: 0, percent: 100 };
  }
  const span = rank.max - rank.min + 1;
  const progress = Math.max(0, d - rank.min);
  const percent = Math.min(100, Math.round((progress / span) * 100));
  const next = getNextRank(d);
  const remaining = next ? Math.max(0, next.min - d) : 0;
  return { rank, next, remaining, percent };
}

function renderRankProgressHtml(streak) {
  const { rank, next, remaining, percent } = getRankProgress(streak);
  if (!next) {
    return `<p class="rank-progress-label">已达最高军衔 · ${rank.name}</p>`;
  }
  return `
    <div class="rank-progress-wrap">
      <div class="rank-progress-head">
        <span class="rank-progress-text">距 ${next.name} 还差 ${remaining} 天</span>
        <span class="rank-progress-pct">${percent}%</span>
      </div>
      <div class="rank-progress-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
        <span class="rank-progress-fill" style="width:${percent}%"></span>
      </div>
    </div>
  `;
}

function rankStar(cx, cy, r, fill) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 2) * -1 + (Math.PI / 5) * i;
    const radius = i % 2 === 0 ? r : r * 0.42;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return `<polygon points="${points.join(" ")}" fill="${fill}"/>`;
}

function rankChevron(x, y, w, fill) {
  const h = w * 0.55;
  return `<path d="M${x} ${y + h} L${x + w / 2} ${y} L${x + w} ${y + h} Z" fill="${fill}"/>`;
}

function rankInsigniaSvg(rank) {
  const c = rank.color;
  const stripes = rank.stripes || 0;
  const stars = rank.stars || 0;
  let g = "";

  if (stripes > 0) {
    const startY = stripes === 1 ? 20 : stripes === 2 ? 17 : 14;
    for (let i = 0; i < stripes; i++) {
      g += rankChevron(17, startY + i * 6, 14, c);
    }
  }

  if (rank.bar) {
    g += `<rect x="16" y="28" width="16" height="2.5" rx="1.2" fill="${c}" opacity="0.85"/>`;
    g += `<rect x="18" y="31" width="12" height="1.5" rx="0.75" fill="${c}" opacity="0.5"/>`;
  }

  if (rank.chevron) {
    const count = Math.min(rank.chevron - 3, 3);
    for (let i = 0; i < count; i++) {
      g += rankChevron(15 + i * 5, 22, 6, c);
    }
    g += rankStar(24, 16, 3.2, c);
  }

  if (rank.officer) {
    const startX = stars === 1 ? 24 : stars === 2 ? 20 : 17;
    const step = stars === 3 ? 7 : 8;
    for (let i = 0; i < stars; i++) {
      g += rankStar(startX + i * step, 18, 2.8, c);
    }
    g += `<rect x="18" y="26" width="12" height="1.5" rx="0.75" fill="${c}" opacity="0.55"/>`;
  }

  if (rank.oak) {
    const startX = stars === 1 ? 24 : stars === 2 ? 20 : stars === 3 ? 17 : 14.5;
    const step = stars >= 3 ? 7 : 8;
    for (let i = 0; i < stars; i++) {
      g += rankStar(startX + i * step, 17, 2.5, c);
    }
    g += `<path d="M14 30 Q24 34 34 30" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.45"/>`;
    g += `<path d="M16 31 Q24 33 32 31" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.3"/>`;
  }

  if (rank.general) {
    const startX = stars === 1 ? 24 : stars === 2 ? 19 : 15;
    const step = 9;
    for (let i = 0; i < stars; i++) {
      g += rankStar(startX + i * step, 17, 3.2, c);
    }
    g += `<rect x="17" y="27" width="14" height="1.2" rx="0.6" fill="${c}" opacity="0.35"/>`;
  }

  if (!g) {
    g = `<circle cx="24" cy="20" r="3.5" fill="${c}" opacity="0.45"/>`;
  }

  return g;
}

function renderRankBadgeSvg(rank, size = 48) {
  const c = rank.color;
  const uid = `rk${rank.tier}`;
  const insignia = rankInsigniaSvg(rank);

  return `<svg class="rank-badge-svg" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="${uid}Bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.35"/>
        <stop offset="45%" stop-color="${c}" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0.28"/>
      </linearGradient>
      <linearGradient id="${uid}Shine" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M24 4 L38 11 L38 24 C38 32 24 42 24 42 C24 42 10 32 10 24 L10 11 Z"
      fill="url(#${uid}Bg)" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M24 6 L36 12 L36 24 C36 30.5 24 39 24 39 C24 39 12 30.5 12 24 L12 12 Z"
      fill="none" stroke="${c}" stroke-width="0.6" opacity="0.35"/>
    <ellipse cx="19" cy="13" rx="5" ry="3" fill="url(#${uid}Shine)" opacity="0.35"/>
    <g class="rank-badge-insignia">${insignia}</g>
  </svg>`;
}

function renderHeaderRankHtml(streak, styleId = "classic") {
  const rank = getRankForStreak(streak);
  const styleClass = `rank-style--${styleId || "classic"}`;
  return `
    <button type="button" class="header-rank-btn ${styleClass}" id="header-rank-btn" style="--rank-color: ${rank.color}" aria-label="查看军衔说明：${rank.name}，${getRankRangeLabel(rank)}" title="${rank.name} · ${getRankRangeLabel(rank)}">
      ${renderRankBadgeSvg(rank, 36)}
      <span class="header-rank-name">${rank.name}</span>
      <span class="header-rank-range">${getRankRangeLabel(rank)}</span>
    </button>
  `;
}

const RANK_STYLE_PREVIEW_STREAK = 25;

function renderRankStylePreviewHtml(styleId) {
  const rank = getRankForStreak(RANK_STYLE_PREVIEW_STREAK);
  const styleClass = `rank-style--${styleId || "classic"}`;
  return `<span class="header-rank-btn ${styleClass}" style="--rank-color: ${rank.color}">
    ${renderRankBadgeSvg(rank, 28)}
    <span class="header-rank-name">${rank.name}</span>
    <span class="header-rank-range">${getRankRangeLabel(rank)}</span>
  </span>`;
}

function renderRankGuideListHtml(streak) {
  const current = getRankForStreak(streak);
  const progressHtml = renderRankProgressHtml(streak);
  const items = MILITARY_RANKS.map((rank) => {
    const isCurrent = rank.tier === current.tier;
    return `
      <article class="rank-guide-item${isCurrent ? " is-current" : ""}" style="--rank-color: ${rank.color}" data-tier="${rank.tier}">
        ${renderRankBadgeSvg(rank, 48)}
        <div class="rank-guide-info">
          <span class="rank-guide-name">${rank.name}</span>
          <span class="rank-guide-range">${getRankRangeLabel(rank)}</span>
        </div>
        ${isCurrent ? '<span class="rank-guide-tag">当前</span>' : ""}
      </article>
    `;
  }).join("");
  return `${progressHtml}<div class="rank-guide-list-items">${items}</div>`;
}
