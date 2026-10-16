/**
 * 国内机构官网招聘来源：壹基金、美丽中国支教。
 *
 * 每个来源导出 `{ name, scrape }`，`scrape(ctx)` 接收
 * `{ fetchWithUA, ageOf, guessRole, perSource }`，返回不含 id 的 JobItem 形对象。
 *
 * 约定：
 *   - 只读公开的职位列表 / 职位详情页，不提交、不解析申请表单，不保存邮箱、电话等联系方式；
 *   - 原站没有可确认的发布日期时写 `publishedDays: 36500, time: "发布时间未知"`，
 *     绝不把抓取时间当作发布时间；
 *   - 同一来源内的详情请求间隔 ≥ 1.5s。
 */

const GAP_MS = 1500;
const UNKNOWN_AGE = { publishedDays: 36500, time: "发布时间未知" };
const SUMMARY_MAX = 140;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NAMED_ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  middot: "·",
};

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** 去标签 → 解码实体 → 折叠空白 */
function textOf(html) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t\u00a0\u3000]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** 摘要里去掉联系方式（邮箱 / 电话），不在数据中保存 */
function stripContacts(s) {
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "")
    .replace(/(\+?86[-\s]?)?1[3-9]\d{9}/g, "")
    .replace(/\(?0\d{2,3}\)?[-\s]?\d{7,8}/g, "")
    .replace(/\b400[-\s]?\d{3}[-\s]?\d{4}\b/g, "");
}

function clip(s, max = SUMMARY_MAX) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** 比较职位名时忽略空白、全半角括号与常见标点差异 */
function normTitle(s) {
  return decodeEntities(s)
    .normalize("NFKC")
    .replace(/[\s·・\-—_｜|:：,，.。]/g, "")
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")")
    .toLowerCase();
}

function titlesMatch(listTitle, detailTitle) {
  const a = normTitle(listTitle);
  const b = normTitle(detailTitle);
  if (!a || !b) return false;
  return a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
}

/**
 * 只读取响应体的前缀（直到 `done(text)` 为真或达到 maxBytes），随后取消剩余下载。
 * 美丽中国（Strikingly）详情页动辄数百 KB，且所需 meta / JSON 都在页面开头。
 */
async function readPrefix(res, { maxBytes = 256 * 1024, done = () => false } = {}) {
  if (!res.body?.getReader) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let text = "";
  let bytes = 0;
  try {
    while (bytes < maxBytes) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (done(text)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return text;
}

/* ---------- 壹基金 · 工作机会 ---------- */

const ONE_ORIGIN = "https://onefoundation.cn";
const ONE_ORG = "深圳壹基金公益基金会";
const ONE_SOURCE = "壹基金·工作机会";
const ONE_KIND = { job: "全职", internship: "实习" };

/** 从职位正文中取“工作职责 / 你将负责”段落作为摘要 */
function oneDutySummary(contentText) {
  const lines = contentText.split("\n").map((l) => l.trim()).filter(Boolean);
  const start = lines.findIndex((l) => /^(工作职责|岗位职责|你将负责|主要职责)/.test(l));
  if (start === -1) return "";
  const duties = [];
  for (const line of lines.slice(start + 1)) {
    if (/^(任职要求|任职资格|岗位要求|你能收获|我们提供|福利)/.test(line)) break;
    duties.push(line.replace(/^\d+\s*[.、．]\s*/, ""));
  }
  return duties.length ? `职责：${duties.join("；").replace(/[；;。]+；/g, "；")}` : "";
}

async function scrapeOneFoundation({ fetchWithUA, guessRole, perSource }) {
  const res = await fetchWithUA(`${ONE_ORIGIN}/jobs/`);
  const html = await res.text();

  // 每个 job_form 对应一个岗位类别（全职 / 实习），类别由表单内的 job_type 标明。
  // 只读取其中的职位列表块，不处理表单字段。
  const forms = html.match(/<form[^>]*class="[^"]*job_form[^"]*"[\s\S]*?<\/form>/g) ?? [];
  if (!forms.length) throw new Error("未找到职位列表结构");

  const items = [];
  for (const form of forms) {
    const jobType = form.match(/name="job_type"\s+value="([^"]+)"/)?.[1];
    const kind = ONE_KIND[jobType];
    if (!kind) continue;

    const blocks = form.split(/<div class="folder_wrap">/).slice(1);
    for (const block of blocks) {
      const head = block.match(/<div class="folder_title"[^>]*>/)?.[0] ?? "";
      const href = head.match(/href="(\/jobs\/[0-9a-z]+\/)"/i)?.[1];
      const title = textOf(block.match(/<h5>([\s\S]*?)<\/h5>/)?.[1] ?? head.match(/share-title="([^"]*)"/)?.[1] ?? "");
      if (!href || !title) continue;
      const city = textOf(block.match(/<span class="remark">([\s\S]*?)<\/span>/)?.[1] ?? "");
      const contentHtml = block.match(/<div class="folder_content">([\s\S]*)/)?.[1] ?? "";
      const contentText = textOf(contentHtml.replace(/<\/(p|li|div|h\d)>/gi, "\n"));
      const duty = clip(stripContacts(oneDutySummary(contentText)));
      const stipend = contentText.match(/补贴[:：]\s*([\d.]+\s*元\s*\/\s*(?:天|月))/)?.[1]?.replace(/\s+/g, "");

      items.push({
        category: "人员招聘",
        kind,
        role: guessRole(title),
        ...UNKNOWN_AGE, // 列表与详情页均未提供发布日期
        title: `【招聘】${title} · 壹基金`,
        summary: duty || "点击查看原始招聘详情。",
        org: ONE_ORG,
        location: city || "详见原帖",
        salary: stipend ?? "面议",
        due: "详见原帖",
        sourceName: ONE_SOURCE,
        url: `${ONE_ORIGIN}${href}`,
      });
    }
  }
  return items.slice(0, perSource);
}

/* ---------- 美丽中国支教 · 成为员工 ---------- */

const MLZG_ORIGIN = "http://www.meilizhongguo.org";
const MLZG_ORG = "美丽中国支教";
const MLZG_SOURCE = "美丽中国支教·成为员工";

/** 解析 join-us 页：部门（h2）下的每个卡片 = 职位名（h3）+ 地点 + “查看职位详情”链接 */
function parseMlzgList(html) {
  const jobs = [];
  const sections = html.split(/<li[^>]*id="section-/).slice(1);
  for (const section of sections) {
    const dept = textOf(section.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "");
    const cards = section.split(/data-sorting-index="\d+"/).slice(1);
    for (const card of cards) {
      const link = card.match(/<a[^>]+href="(?:https?:\/\/www\.meilizhongguo\.org)?(\/blog\/([0-9a-z]+))"[^>]*>([\s\S]*?)<\/a>/i);
      if (!link || !/职位详情/.test(textOf(link[3]))) continue;
      const beforeLink = card.slice(0, link.index);
      const h3 = beforeLink.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
      if (!h3) continue;
      const title = textOf(h3[1]).replace(/\s+/g, "");
      const location = textOf(beforeLink.slice(h3.index + h3[0].length)).replace(/\s+/g, "");
      if (!title) continue;
      jobs.push({ dept, title, location, path: link[1] });
    }
  }
  return jobs;
}

function metaContent(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=['"]${key}['"][^>]*>`, "i");
  const tag = html.match(re)?.[0] ?? "";
  const m = tag.match(/content=(['"])([\s\S]*?)\1/);
  return m ? decodeEntities(m[2]).trim() : "";
}

/** 详情页公开的 $S.blogPostData.blogPostMeta（JSON）中取 publishedAt / publicUrl / 标题 */
function parseMlzgDetail(html) {
  const metaJson = html.match(/\$S\.blogPostData\s*=\s*\{"blogPostMeta":\{([\s\S]*?)"socialMediaConfig"/)?.[1] ?? "";
  const jsonStr = (key) => {
    const raw = metaJson.match(new RegExp(`"${key}":("(?:[^"\\\\]|\\\\.)*")`))?.[1];
    if (!raw) return "";
    try {
      return JSON.parse(raw);
    } catch {
      return "";
    }
  };
  const socialTitleRaw = html.match(/"socialMediaConfig":\{[^{}]*?"title":("(?:[^"\\]|\\.)*")/)?.[1];
  let socialTitle = "";
  try {
    socialTitle = socialTitleRaw ? JSON.parse(socialTitleRaw) : "";
  } catch {
    socialTitle = "";
  }
  return {
    title: metaContent(html, "og:title") || socialTitle || textOf(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
    description: metaContent(html, "og:description") || metaContent(html, "description"),
    state: jsonStr("state"),
    publishedAt: jsonStr("publishedAt"),
    publicUrl: jsonStr("publicUrl"),
  };
}

async function scrapeMeiliZhongguo({ fetchWithUA, ageOf, guessRole, perSource }) {
  const res = await fetchWithUA(`${MLZG_ORIGIN}/join-us`);
  const html = await res.text();
  const list = parseMlzgList(html).slice(0, perSource);
  if (!list.length) throw new Error("未找到职位列表结构");

  const items = [];
  const mismatched = [];
  for (const job of list) {
    await sleep(GAP_MS);
    const url = `${MLZG_ORIGIN}${job.path}`;
    let detail = null;
    try {
      const dres = await fetchWithUA(url);
      const prefix = await readPrefix(dres, {
        done: (t) => /og:title/.test(t) && /"publishedAt":/.test(t) && /"socialMediaConfig"/.test(t),
      });
      detail = parseMlzgDetail(prefix);
    } catch (err) {
      if (/blocked: HTTP (401|403|429)/.test(err.message)) throw err;
      detail = null; // 详情不可达：仍保留列表中结构上配对的职位，但发布时间未知
    }

    if (detail?.title && !titlesMatch(job.title, detail.title)) {
      // 列表卡片与详情页标题对不上 → 链接可能错位，丢弃而不是误配
      mismatched.push(`${job.title} ≠ ${detail.title}`);
      continue;
    }
    if (detail?.publicUrl && !detail.publicUrl.endsWith(job.path)) {
      mismatched.push(`${job.title}: ${detail.publicUrl}`);
      continue;
    }

    const confirmed = detail?.title && detail.state === "published" && detail.publishedAt;
    const age = confirmed && !Number.isNaN(new Date(detail.publishedAt).getTime()) ? ageOf(detail.publishedAt) : UNKNOWN_AGE;
    const kind = /实习|intern/i.test(job.title) ? "实习" : /兼职/.test(job.title) ? "兼职" : "全职";
    const desc = detail?.title ? clip(stripContacts(detail.description)) : "";

    items.push({
      category: "人员招聘",
      kind,
      role: guessRole(`${job.title} ${job.dept}`),
      ...age,
      title: `【招聘】${job.title} · ${MLZG_ORG}`,
      summary: [job.dept ? `部门：${job.dept}` : "", desc].filter(Boolean).join("；") || "点击查看原始招聘详情。",
      org: MLZG_ORG,
      location: job.location || "详见原帖",
      salary: "面议",
      due: "详见原帖",
      sourceName: MLZG_SOURCE,
      url,
    });
  }

  if (!items.length && mismatched.length) {
    throw new Error(`详情标题与职位不匹配：${mismatched.join("；")}`);
  }
  return items;
}

export const domesticOrganizationSources = [
  { name: ONE_SOURCE, scrape: scrapeOneFoundation },
  { name: MLZG_SOURCE, scrape: scrapeMeiliZhongguo },
];
