/**
 * 中国公共招聘网（job.mohrss.gov.cn）来源
 *
 * 接口：公开 GET 列表页
 *   http://job.mohrss.gov.cn/cjobs/jobinfolist/listJobinfolist?pageNo=1&orderType=time&textfield=<关键词>
 * 列表数据以 HTML 实体编码的 JSON 放在 `<input id="findjoblist" value="...">` 中。
 *
 * 约定：
 *   - 关键词仅限“社会工作”“社工”“公益”，每个关键词只请求第一页，请求间隔 ≥ 1.5s；
 *   - 按 acb200（岗位编号）去重，总数不超过 ctx.perSource；
 *   - 只按白名单字段构造输出，绝不保留联系人（aae004）、电话（aae005）、地址等联系信息，
 *     岗位描述中出现的电话/联系方式片段也会被剔除；
 *   - 列表接口的日期字段（s_aae395~398、s_ctime、s_uptime）没有页面标注说明其含义，
 *     不能确定是“发布时间”，因此统一使用“发布时间未知”；
 *   - 只纳入公益行业 / 社会服务语义明确的岗位（见 isSocialService）。
 */

const SOURCE_NAME = "中国公共招聘网";
const LIST_URL = "http://job.mohrss.gov.cn/cjobs/jobinfolist/listJobinfolist";
const DETAIL_URL = "http://job.mohrss.gov.cn/cjobs/jobinfolist/cb21/showgw?id=";
const KEYWORDS = ["社会工作", "社工", "公益"];
const GAP_MS = 1500;
const UNKNOWN_AGE = { publishedDays: 36500, time: "发布时间未知" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** 从列表页 HTML 中取出 findjoblist 的 JSON 数组 */
export function parseFindJobList(html) {
  const tag = html.match(/<input\b[^>]*\bid=["']findjoblist["'][^>]*>/i)?.[0];
  if (!tag) throw new Error("findjoblist not found");
  const raw = tag.match(/\bvalue="([^"]*)"/i)?.[1] ?? tag.match(/\bvalue='([^']*)'/i)?.[1];
  if (raw == null) throw new Error("findjoblist value missing");
  const text = decodeEntities(raw).trim();
  if (!text) return [];
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("findjoblist is not an array");
  return data;
}

const str = (v) => (v == null ? "" : String(v).trim());

/* ---------- 社会服务语义判定 ---------- */

// 单位名称明确属于公益 / 社会服务机构
const ORG_STRONG =
  /社会工作|社工|公益|慈善|基金会|志愿|社区发展|社区服务|社会服务|社会组织|救助|福利院|助残|残疾人|红十字|促进会/;
// 岗位名称明确为社会工作岗位（“公益/志愿/慈善”字样单独出现不足以判定，需单位同时满足 ORG_STRONG）
const TITLE_SOCIAL = /社会工作|社工/;
const TITLE_CHARITY = /公益|志愿|慈善/;
// 描述中明确的社会服务内容
const DESC_SOCIAL =
  /社会工作(?!者优先)|社工证|社会工作师|个案|小组工作|社区矫正|社区服务|长者|老年人|残疾|残障|青少年|儿童服务|心理慰藉|情绪疏导|困境|救助|公益|志愿服务/;
// 工种（aca111_）为社会工作专业人员
const OCC_SOCIAL = /社会工作/;
// 单位明显不属于社会服务（例如口腔诊所招“社工”实为营销）
const ORG_DENY =
  /口腔|门诊|医美|美容|整形|房地产|置业|地产|保险|金融|投资|证券|贷款|婚恋|红娘|旅游|人力资源有限公司|劳务|汽车|销售|卫生|医院|诊所|体育|教育科技|培训/;

function isSocialService(j) {
  const title = str(j.aca112);
  const org = str(j.aab004);
  const desc = str(j.acb22a);
  const occ = str(j.aca111_);
  if (ORG_DENY.test(org)) return false;
  if (ORG_STRONG.test(org) && (TITLE_SOCIAL.test(title) || TITLE_CHARITY.test(title) || DESC_SOCIAL.test(desc) || OCC_SOCIAL.test(occ) || /社会工作|社工|公益|慈善|基金会|志愿/.test(org))) {
    return true;
  }
  if (!TITLE_SOCIAL.test(title)) return false;
  return OCC_SOCIAL.test(occ) || DESC_SOCIAL.test(desc);
}

/* ---------- 字段映射 ---------- */

/** 剔除描述中可能夹带的联系人 / 电话 / 邮箱 / 微信等信息 */
function sanitizeDescription(text) {
  return str(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[。；;！!？?\n])/)
    .filter((seg) => !/联系|电话|手机|微信|邮箱|e-?mail|QQ|扣扣|致电|热线|咨询人/i.test(seg))
    .join("")
    .replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}/g, "")
    .replace(/0\d{2,3}[-\s]?\d{7,8}/g, "")
    .replace(/\d{7,}/g, "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "")
    .trim();
}

function truncate(text, n) {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

function salaryOf(j) {
  const min = Number(j.acb241) || 0;
  const max = Number(j.acb242) || 0;
  if (min > 0 && max > min) return `${min}-${max}元/月`;
  if (min > 0) return `${min}元以上/月`;
  if (max > 0) return `${max}元以下/月`;
  return "面议";
}

function locationOf(j) {
  const area = str(j.area_);
  const district = str(j.aab302);
  if (!area && !district) return "全国";
  if (!area || area === district || district.startsWith(area)) return district || area;
  if (!district) return area;
  return `${area}·${district}`;
}

function kindOf(title) {
  if (/实习|见习|intern/i.test(title)) return "实习";
  if (/兼职|part[\s-]?time/i.test(title)) return "兼职";
  return "全职";
}

function toJobItem(j, ctx) {
  const title = str(j.aca112) || "未命名岗位";
  const org = str(j.aab004) || "未知单位";
  const occupation = str(j.aca111_);
  const desc = truncate(sanitizeDescription(j.acb22a), 120);
  const summary =
    [occupation ? `工种：${occupation}` : "", desc ? `岗位描述：${desc}` : ""].filter(Boolean).join("；") ||
    "点击查看原始招聘详情。";
  return {
    category: "人员招聘",
    kind: kindOf(title),
    role: ctx.guessRole(`${title} ${occupation}`),
    ...UNKNOWN_AGE,
    title: `【招聘】${title} · ${org}`,
    summary,
    org,
    location: locationOf(j),
    salary: salaryOf(j),
    due: "详见原帖",
    sourceName: SOURCE_NAME,
    url: `${DETAIL_URL}${encodeURIComponent(str(j.acb200))}`,
  };
}

/* ---------- 抓取 ---------- */

async function scrapePublicJobs(ctx) {
  const limit = Math.max(0, Number(ctx.perSource) || 0);
  const seen = new Set();
  const items = [];
  const errors = [];
  for (const [i, keyword] of KEYWORDS.entries()) {
    if (items.length >= limit) break;
    if (i > 0) await sleep(GAP_MS);
    const url = `${LIST_URL}?pageNo=1&orderType=time&textfield=${encodeURIComponent(keyword)}`;
    let list;
    try {
      const res = await ctx.fetchWithUA(url);
      list = parseFindJobList(await res.text());
    } catch (err) {
      if (/blocked/.test(err.message)) throw err; // 401/403/429：整个来源停止，不绕过
      errors.push(`${keyword}: ${err.message}`);
      continue;
    }
    for (const j of list) {
      if (items.length >= limit) break;
      const id = str(j?.acb200);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (!isSocialService(j)) continue;
      items.push(toJobItem(j, ctx));
    }
  }
  if (items.length === 0 && errors.length === KEYWORDS.length) {
    throw new Error(errors.join("; "));
  }
  return items;
}

export const publicJobSources = [{ name: SOURCE_NAME, scrape: scrapePublicJobs }];
