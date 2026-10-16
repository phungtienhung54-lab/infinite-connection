/**
 * 国际公益招聘 RSS 来源（只读官方公开 RSS，不调用需审批的 API）
 *
 *   1. ReliefWeb · Jobs —— 官方公开 RSS：
 *        - https://reliefweb.int/jobs/rss.xml?advanced-search=(C58)      （中国）
 *        - https://reliefweb.int/jobs/rss.xml?view=unspecified-location  （远程/轮岗/不限地点）
 *      不调用 api.reliefweb.int（需获批 appname）。
 *   2. NGO Job Board —— https://ngojobboard.org/wpjobboard/xml/rss/
 *      只请求该 RSS 本身，不跟进任何条目链接；robots.txt 中的 blackhole
 *      陷阱链接一律过滤，绝不请求。
 *
 * 用法：
 *   import { internationalRssSources } from "./job-sources/international-rss.mjs";
 *   for (const src of internationalRssSources) await src.scrape(ctx);
 *   ctx = { fetchWithUA, ageOf, guessRole, guessVolunteerRole, perSource }
 *
 * 返回不含 id 的 JobItem 形对象（id 由主脚本统一分配）。
 * 仅使用 Node 内置能力，无第三方依赖：NGO Job Board 走 ctx.fetchWithUA；
 * ReliefWeb 对 Node 全局 fetch 返回 406，改走内置 node:https（同一 UA，见 httpsGetText）。
 * ctx 可选 userAgent，缺省使用与主脚本一致的可识别 UA。
 */

import { get } from "node:https";

const FEED_GAP_MS = 1500;
const SUMMARY_MAX = 160;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- XML / HTML 文本处理 ---------- */

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™",
  eacute: "é", egrave: "è", ecirc: "ê", aacute: "á", agrave: "à", acirc: "â",
  iacute: "í", oacute: "ó", ocirc: "ô", uacute: "ú", ccedil: "ç", ntilde: "ñ",
  auml: "ä", ouml: "ö", uuml: "ü", szlig: "ß", euro: "€", pound: "£",
};

/** 解码数字实体（&#123; / &#x1F;）与常见命名实体；未知实体原样保留 */
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (m, ent) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      try {
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      } catch {
        return m;
      }
    }
    const v = NAMED_ENTITIES[ent.toLowerCase()];
    return v ?? m;
  });
}

/** XML 文本节点 → 字符串：CDATA 段原样保留，其余部分解码 XML 实体 */
function xmlText(raw) {
  if (raw == null) return "";
  let out = "";
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let last = 0;
  let m;
  while ((m = re.exec(raw))) {
    out += decodeEntities(raw.slice(last, m.index)) + m[1];
    last = re.lastIndex;
  }
  out += decodeEntities(raw.slice(last));
  return out.trim();
}

/** HTML 片段 → 纯文本（块级标签换行、去标签、解码 HTML 实体、压缩空白） */
function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

const oneLine = (s) => s.replace(/\s+/g, " ").trim();

function truncate(s, max = SUMMARY_MAX) {
  const t = oneLine(s);
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** 拆出 <item> 块（RSS 2.0） */
function rssItems(xml) {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
}

/** 取第一个同名标签的文本 */
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? xmlText(m[1]) : "";
}

/** 取全部同名标签的文本 */
function tags(block, name) {
  return [...block.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi"))]
    .map((m) => xmlText(m[1]))
    .filter(Boolean);
}

const RSS_ACCEPT = "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8";

async function fetchXml(ctx, url) {
  const res = await ctx.fetchWithUA(url, { headers: { Accept: RSS_ACCEPT } });
  return res.text();
}

/**
 * ReliefWeb 的 ELB 会对 Node 全局 fetch（undici）客户端一律返回 406，
 * 而 node:https 携带同一个可识别 UA 能正常拿到 200。因此 ReliefWeb RSS
 * 走内置 node:https，其余约定与 fetchWithUA 保持一致：同一 UA、20s 超时、
 * 401/403/429 视为被拒直接失败不绕过、仅跟随同站点重定向。
 */
const DEFAULT_UA = "InfiniteConnectionPreview/0.1 (+https://github.com/schneiderlin/infinite-connection)";

function httpsGetText(url, { userAgent = DEFAULT_UA, redirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const req = get(
      url,
      { headers: { "User-Agent": userAgent, Accept: RSS_ACCEPT }, timeout: 20_000 },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume();
          const next = new URL(res.headers.location, url);
          if (next.hostname !== new URL(url).hostname) {
            reject(new Error(`cross-site redirect to ${next.hostname}`));
            return;
          }
          httpsGetText(next.toString(), { userAgent, redirects: redirects - 1 }).then(resolve, reject);
          return;
        }
        if (status === 401 || status === 403 || status === 429) {
          res.resume();
          reject(new Error(`blocked: HTTP ${status}`));
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        res.setEncoding("utf8");
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

/** 英文日期（"22 Oct 2026"）→ "2026-10-22"；无法解析时原样返回 */
function isoDay(s) {
  const t = Date.parse(`${s} UTC`);
  return Number.isNaN(t) ? s : new Date(t).toISOString().slice(0, 10);
}

function jobKind(typeText, title) {
  const t = `${typeText} ${title}`;
  if (/volunteer/i.test(typeText)) return { category: "志愿者招募", kind: "志愿者" };
  if (/intern/i.test(t)) return { category: "人员招聘", kind: "实习" };
  if (/part[\s-]?time|consult|freelance|temporary/i.test(typeText)) return { category: "人员招聘", kind: "兼职" };
  return { category: "人员招聘", kind: "全职" };
}

function roleOf(ctx, jobType, text) {
  return jobType.category === "志愿者招募" ? ctx.guessVolunteerRole(text) : ctx.guessRole(text);
}

function titleOf(jobType, title, org) {
  return `【${jobType.category === "志愿者招募" ? "志愿者" : "招聘"}】${title} · ${org}`;
}

/* ---------- 来源 1：ReliefWeb · Jobs（公开 RSS） ---------- */

const RELIEFWEB_FEEDS = [
  { url: "https://reliefweb.int/jobs/rss.xml?advanced-search=(C58)", fallbackLocation: "中国" },
  { url: "https://reliefweb.int/jobs/rss.xml?view=unspecified-location", fallbackLocation: "远程/轮岗/不限地点" },
];

/** ReliefWeb RSS 的 <category> 依次混有机构、职能、类型、主题；只认已知类型值 */
const RELIEFWEB_TYPES = /^(job|consultancy|internship|volunteer opportunity|volunteer)$/i;

function parseReliefWebDescription(raw) {
  // raw 已经过 XML 实体解码，此时为 HTML
  const field = (label) => {
    const m = raw.match(new RegExp(`<div[^>]*>\\s*${label}:\\s*([\\s\\S]*?)<\\/div>`, "i"));
    return m ? oneLine(htmlToText(m[1])) : "";
  };
  const organization = field("Organization");
  const country = field("Countr(?:y|ies)");
  const closing = field("Closing date");
  const body = raw.replace(/<div class="(?:tag|date)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ");
  const text = htmlToText(body);
  const summaryMatch = text.match(/Summary:\s*([^\n]+)/i);
  const excerpt = summaryMatch ? summaryMatch[1] : text.split("\n").find((l) => l.length > 40) ?? text;
  return { organization, country, closing, excerpt };
}

function mapReliefWebItem(ctx, block, fallbackLocation) {
  const title = oneLine(tag(block, "title"));
  const link = tag(block, "link");
  const guid = tag(block, "guid") || link;
  if (!title || !/^https:\/\/reliefweb\.int\//.test(link)) return null;

  const desc = parseReliefWebDescription(tag(block, "description"));
  const author = oneLine(tag(block, "author"));
  const categories = tags(block, "category").map(oneLine);
  const org = desc.organization || author || categories[0] || "未知机构";
  const typeText = categories.find((c) => RELIEFWEB_TYPES.test(c)) ?? "Job";
  const fields = categories.filter((c) => c !== org && c !== author && !RELIEFWEB_TYPES.test(c));
  const jobType = jobKind(typeText, title);

  const summary =
    [fields.length ? `职类：${fields.join(" / ")}` : "", desc.excerpt ? truncate(desc.excerpt) : ""]
      .filter(Boolean)
      .join("；") || "点击查看原始招聘详情。";

  return {
    guid,
    item: {
      ...jobType,
      role: roleOf(ctx, jobType, `${fields.join(" ")} ${title}`),
      ...ctx.ageOf(tag(block, "pubDate")),
      title: titleOf(jobType, title, org),
      summary,
      org,
      location: desc.country || fallbackLocation,
      salary: jobType.category === "志愿者招募" ? "志愿服务" : "详见原帖",
      due: desc.closing ? `截止 ${isoDay(desc.closing)}` : "详见原帖",
      sourceName: "ReliefWeb",
      url: link,
    },
  };
}

async function scrapeReliefWeb(ctx) {
  const seen = new Set();
  const out = [];
  const errors = [];
  for (const [i, feed] of RELIEFWEB_FEEDS.entries()) {
    if (out.length >= ctx.perSource) break;
    if (i > 0) await sleep(FEED_GAP_MS);
    let xml;
    try {
      xml = await httpsGetText(feed.url, { userAgent: ctx.userAgent });
    } catch (err) {
      if (/blocked: HTTP (401|403|429)/.test(err.message)) throw err;
      errors.push(`${feed.url}: ${err.message}`);
      continue;
    }
    for (const block of rssItems(xml)) {
      const mapped = mapReliefWebItem(ctx, block, feed.fallbackLocation);
      if (!mapped || seen.has(mapped.guid)) continue;
      seen.add(mapped.guid);
      out.push(mapped.item);
      if (out.length >= ctx.perSource) break;
    }
  }
  if (errors.length === RELIEFWEB_FEEDS.length) throw new Error(errors.join("; "));
  return out;
}

/* ---------- 来源 2：NGO Job Board（公开 RSS） ---------- */

const NGO_JOB_BOARD_FEED = "https://ngojobboard.org/wpjobboard/xml/rss/";

/** WPJobBoard 的岗位类型；其余 <category> 视为职能分类 */
const NGO_TYPES = /^(full[\s-]?time|part[\s-]?time|internship|volunteer|consult(?:ing|ancy)|freelance|temporary|contract)$/i;

/** 只接受站内岗位详情链接；任何 blackhole 陷阱链接直接丢弃（且从不请求条目链接） */
function safeNgoLink(link) {
  if (!link || /blackhole/i.test(link)) return null;
  try {
    const u = new URL(link);
    if (u.protocol !== "https:" || u.hostname !== "ngojobboard.org") return null;
    if (!u.pathname.startsWith("/post/") || /blackhole/i.test(u.search)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function mapNgoItem(ctx, block) {
  const url = safeNgoLink(tag(block, "link"));
  if (!url) return null;
  const company = oneLine(tag(block, "company") || tag(block, "author"));
  let title = oneLine(tag(block, "title"));
  // "New opening at PATH — Head of Philanthropy" → "Head of Philanthropy"
  title = title.replace(/^New opening at\s+.+?\s+[—–-]\s+/i, "");
  if (!title) return null;
  const org = company || "未知机构";

  const categories = tags(block, "category").map(oneLine);
  const typeText = categories.find((c) => NGO_TYPES.test(c)) ?? "";
  const fields = categories.filter((c) => !NGO_TYPES.test(c));
  const jobType = jobKind(typeText, title);
  const location = oneLine(tag(block, "location")) || "详见原帖";

  let excerpt = htmlToText(tag(block, "description"));
  // 部分条目描述以 "标题 | 机构地点" 开头，去掉这段重复信息
  if (excerpt.startsWith(title)) excerpt = excerpt.split("\n").slice(1).join("\n") || excerpt;
  const summary =
    [
      typeText || fields.length ? `类型：${[typeText, ...fields].filter(Boolean).join(" / ")}` : "",
      excerpt ? truncate(excerpt) : "",
    ]
      .filter(Boolean)
      .join("；") || "点击查看原始招聘详情。";

  return {
    guid: tag(block, "guid") || url,
    item: {
      ...jobType,
      role: roleOf(ctx, jobType, `${fields.join(" ")} ${title}`),
      ...ctx.ageOf(tag(block, "pubDate")),
      title: titleOf(jobType, title, org),
      summary,
      org,
      location: /remote/i.test(location) && location.length <= 12 ? "远程办公" : location,
      salary: jobType.category === "志愿者招募" ? "志愿服务" : "详见原帖",
      due: "详见原帖",
      sourceName: "NGO Job Board",
      url,
    },
  };
}

async function scrapeNgoJobBoard(ctx) {
  const xml = await fetchXml(ctx, NGO_JOB_BOARD_FEED);
  const seen = new Set();
  const out = [];
  for (const block of rssItems(xml)) {
    const mapped = mapNgoItem(ctx, block);
    if (!mapped || seen.has(mapped.guid)) continue;
    seen.add(mapped.guid);
    out.push(mapped.item);
    if (out.length >= ctx.perSource) break;
  }
  return out;
}

/* ---------- 导出 ---------- */

export const internationalRssSources = [
  { name: "ReliefWeb", scrape: scrapeReliefWeb },
  { name: "NGO Job Board", scrape: scrapeNgoJobBoard },
];
