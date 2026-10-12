// 西北人才网岗位抓取脚本（修复版）
// 运行：node scripts/scrape-xbrc.js
// 依赖：Node 18+（内置 fetch）

import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "src", "lib", "jobs-data.json");

const BASE_URL = "https://www.xbrc.com.cn";
const API_URL = `${BASE_URL}/proxyapi/home/index/searchPost`;
const SOURCE_NAME = "西北人才网";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://www.xbrc.com.cn/personjob"
};

const PAGE_SIZE = 20;
const MAX_PAGES = 25;
const DELAY_MS = 3000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* =========================================================================
 * 通用工具
 * ========================================================================= */

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(sourceName, url) {
  const h = createHash("sha1").update(`${sourceName}|${url}`).digest("hex").slice(0, 12);
  return `job-${h}`;
}

function calcDaysAgo(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / 86400000));
}

function formatTime(dateStr) {
  const days = calcDaysAgo(dateStr);
  if (days === 0) return "今天发布";
  if (days === 1) return "昨天发布";
  if (days < 7) return `${days}天前发布`;
  if (days < 30) return `${Math.floor(days / 7)}周前发布`;
  return `${Math.floor(days / 30)}个月前发布`;
}

/* =========================================================================
 * 职能分类（role）—— 只基于 title 判断，summary 作为兜底
 * ========================================================================= */

const ROLE_RULES = [
  // 1. 高级管理（优先，因为"项目经理""总监"可能同时命中"项目"）
  [/总监|主任|负责人|高级管理|总经理|总助|校长|院长|副总|经理助理|总经理助理/, "高级管理"],

  // 2. 财务
  [/财务|会计|出纳|审计|税务|总账|成本会计|投资顾问|资金/, "财务"],

  // 3. 人力资源/行政（只匹配明确的 HR/行政岗，避免"招聘"一词误伤）
  [/人事专员|人事助理|人力资源|hr\b|招聘专员|招聘助理|薪酬|绩效专员|行政专员|行政助理|行政文员|综合专员|前台|文员/, "人力资源/行政"],

  // 4. 传播/运营
  [/传播|品牌|媒体|新媒体|短视频|主播|广告|设计|文案|电商|客服|运营|宣传|企宣|策划|拍摄|剪辑|直播/, "传播/运营"],

  // 5. 销售/市场
  [/销售|促销|招商|业务员|客户经理|置业顾问|导购|营业员|店长|外贸|市场|营销|中介|渠道/, "销售/市场"],

  // 6. 技术/生产（岗位名称里带明确技术词）
  [/工程师|技术员|技工|操作工|普工|焊工|电工|钳工|机修|数控|cnc|注塑|质检|qa\b|qc\b|测试|工艺|研发|生产|装配|冲压|喷涂|磨工|车工|铣工|设备|智能制造|信息化|仪表|电气|化工|机械|钻井|采气|修井|油气|化验|分析|研发人员|司炉|维修|保养|管道|结构|暖通|土建|施工/, "技术/生产"],

  // 7. 物流运输
  [/司机|配送|分拣|装卸|仓管|物流|快递|骑手|船务|海员|货运|叉车|仓储/, "物流运输"],

  // 8. 餐饮/服务
  [/餐饮|服务员|厨师|后厨|传菜|收银|保洁|客房|洗碗|前厅|领班|接待|乘务|站务|茶酒|面点|凉菜|炒灶|学徒|宾客服务/, "餐饮/服务"],

  // 9. 安保/服务（新增分类）
  [/保安|安检|辅警|安保|消防|反恐|秩序维护/, "安保/服务"],

  // 10. 医疗/护理
  [/护理|护工|月嫂|产康|口腔|医美|药师|化验员|医生|护士|保育|母婴|康复/, "医疗/护理"],

  // 11. 教育
  [/老师|教辅|幼师|招生|教育|培训|讲师|教师/, "教育"],

  // 12. 公益/志愿
  [/志愿|公益|社工/, "公益/志愿"],

  // 13. 项目官员（放在最后，避免误伤"项目经理"等管理岗）
  [/项目|program|project|officer|项目官员|项目主管|区域经理/, "项目官员"],
];

function guessRole(title = "", summary = "") {
  const t = String(title).toLowerCase();

  // 先匹配 title
  for (const [re, role] of ROLE_RULES) {
    if (re.test(t)) return role;
  }

  // title 没命中，再用 summary（剔除干扰词）
  const cleanSummary = String(summary)
    .toLowerCase()
    .replace(/招聘要求|应聘须知|招聘邮箱|有意向者|联系人|联系方式|岗位职责|任职要求|工作内容|薪资待遇/g, " ");

  for (const [re, role] of ROLE_RULES) {
    if (re.test(cleanSummary)) return role;
  }

  return "其他";
}

/* =========================================================================
 * 职位类型（kind）—— 只基于 title，不看 description
 * ========================================================================= */

function normalizeJobType(title = "") {
  const t = String(title);
  if (/志愿/.test(t)) {
    return { category: "志愿者招募", kind: "志愿者" };
  }
  if (/实习|intern|见习/i.test(t)) {
    return { category: "人员招聘", kind: "实习" };
  }
  if (/兼职|part[\s-]?time|小时工|计时工|临时工|日结/i.test(t)) {
    return { category: "人员招聘", kind: "兼职" };
  }
  return { category: "人员招聘", kind: "全职" };
}

/* =========================================================================
 * 字段标准化
 * ========================================================================= */

function normalizeLocation(area = "") {
  if (!area) return "详见原帖";
  const parts = String(area)
    .split(/[\/·]/)
    .map(s => s.trim())
    .filter(Boolean);

  // 去重相邻重复（如"北京市/北京市/东城区" → "北京市/东城区"）
  const dedup = [];
  for (const p of parts) {
    if (dedup[dedup.length - 1] !== p) dedup.push(p);
  }

  // 补全省级（如果只有"兰州市"这种市级，前面加上省）
  const PROVINCE_MAP = {
    "兰州市": "甘肃省",
    "嘉峪关市": "甘肃省",
    "金昌市": "甘肃省",
    "白银市": "甘肃省",
    "天水市": "甘肃省",
    "武威市": "甘肃省",
    "张掖市": "甘肃省",
    "平凉市": "甘肃省",
    "酒泉市": "甘肃省",
    "庆阳市": "甘肃省",
    "定西市": "甘肃省",
    "陇南市": "甘肃省",
    "临夏回族自治州": "甘肃省",
    "甘南藏族自治州": "甘肃省",
    "银川市": "宁夏回族自治区",
    "石嘴山市": "宁夏回族自治区",
    "吴忠市": "宁夏回族自治区",
    "固原市": "宁夏回族自治区",
    "中卫市": "宁夏回族自治区",
    "西宁市": "青海省",
    "海东市": "青海省",
    "乌鲁木齐市": "新疆维吾尔自治区",
    "克拉玛依市": "新疆维吾尔自治区",
    "吐鲁番市": "新疆维吾尔自治区",
    "哈密市": "新疆维吾尔自治区",
  };

  if (dedup.length === 1 && PROVINCE_MAP[dedup[0]]) {
    dedup.unshift(PROVINCE_MAP[dedup[0]]);
  }

  return dedup.join("·") || "详见原帖";
}

/**
 * 从 qualifications 或 positionDescription 里提取薪资
 * 例如："薪资待遇：大专4800元/月、本科4800-5500元/月"
 *      "薪资待遇：7000-9000元"
 *      "薪资待遇：7 万元- 10 万元/年"
 */
function extractSalaryFromText(text = "") {
  if (!text) return null;
  const t = stripHtml(text);

  // 模式 1：7 万元- 10 万元/年 或 7万-10万
  let m = t.match(/(\d+(?:\.\d+)?)\s*万?\s*[-~到至]\s*(\d+(?:\.\d+)?)\s*万\s*\/?\s*年/);
  if (m) return `${m[1]}-${m[2]}万/年`;

  // 模式 2：7000-9000元 或 7000~9000元/月
  m = t.match(/(\d{3,6})\s*[-~到至]\s*(\d{3,6})\s*元/);
  if (m) {
    const low = parseInt(m[1], 10);
    const high = parseInt(m[2], 10);
    // 如果数字较大，转成 K
    if (low >= 1000) return `${Math.round(low / 1000)}-${Math.round(high / 1000)}K/月`;
    return `${low}-${high}元/月`;
  }

  // 模式 3：5000元/月
  m = t.match(/(\d{3,6})\s*元\s*\/?\s*月/);
  if (m) {
    const v = parseInt(m[1], 10);
    if (v >= 1000) return `${Math.round(v / 1000)}K/月`;
    return `${v}元/月`;
  }

  return null;
}

/* =========================================================================
 * 岗位映射
 * ========================================================================= */

function mapJobItem(item) {
  const rawTitle = item.positionName || "未知岗位";
  const org = item.companyName || "未知单位";
  const rawDesc = stripHtml(item.positionDescription || "");
  const rawQual = stripHtml(item.qualifications || "");
  const summary = rawDesc || rawQual || "点击查看原始招聘详情。";

  // 薪资
  let salary = "面议";
  if (item.expectedSalary && item.expectedSalary > 0) {
    salary = `${item.expectedSalary}K/月`;
  } else {
    // 从描述里提取
    const extracted = extractSalaryFromText(rawQual) || extractSalaryFromText(rawDesc);
    if (extracted) salary = extracted;
  }

  const location = normalizeLocation(item.workArea || [item.province, item.city].filter(Boolean).join("/"));
  const due = item.endTime ? item.endTime.split(" ")[0] : "详见原帖";
  const url = `${BASE_URL}/personjob/detail?id=${item.id}`;

  const jobType = normalizeJobType(rawTitle);

  return {
    id: makeId(SOURCE_NAME, url),
    category: jobType.category,
    kind: jobType.kind,
    role: guessRole(rawTitle, summary),
    publishedDays: calcDaysAgo(item.publicTime),
    time: formatTime(item.publicTime),
    title: `【招聘】${rawTitle} · ${org}`,
    summary: summary.slice(0, 300),
    org,
    location,
    salary,
    due,
    sourceName: SOURCE_NAME,
    url,
    // 额外字段，供前端筛选使用
    extra: {
      education: item.highEducation || item.lowEducation || "",
      experience: item.workExperience || "",
      welfare: item.enterpriseWelfareStr || "",
      recruitNum: item.recruitNum || 1,
      viewNum: item.viewNum || 0,
      industry: item.industryId || "",
    },
  };
}

/* =========================================================================
 * 抓取逻辑
 * ========================================================================= */

async function fetchPage(pageNum) {
  const params = new URLSearchParams({
    time: "",
    enterpriseWelfare: "",
    positionCategory: "0",
    type: "1",
    pageSize: String(PAGE_SIZE),
    pageNum: String(pageNum),
  });

  const url = `${API_URL}?${params.toString()}`;
  console.log(`  -> 请求: ${url}`);

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (json.status !== 200) throw new Error(`API 返回错误: ${json.msg}`);

  return json.data;
}

/* =========================================================================
 * 去重
 * ========================================================================= */

function dedupe(jobs) {
  const map = new Map();
  for (const j of jobs) {
    if (!j) continue;
    // 用 url 作为主键去重（同一岗位多次抓取会命中）
    const key = j.url;
    if (!map.has(key)) {
      map.set(key, j);
    }
  }
  return [...map.values()];
}

/* =========================================================================
 * 校验 & 统计
 * ========================================================================= */

function reportStats(jobs) {
  const total = jobs.length || 1;

  const byRole = {};
  const byKind = {};
  const bySource = {};

  for (const j of jobs) {
    byRole[j.role] = (byRole[j.role] || 0) + 1;
    byKind[j.kind] = (byKind[j.kind] || 0) + 1;
    bySource[j.sourceName] = (bySource[j.sourceName] || 0) + 1;
  }

  console.log("\n📊 来源分布：");
  for (const [k, v] of Object.entries(bySource)) {
    console.log(`  - ${k}: ${v}`);
  }

  console.log("\n📊 岗位类型（kind）分布：");
  for (const [k, v] of Object.entries(byKind)) {
    console.log(`  - ${k}: ${v} (${Math.round((v / total) * 100)}%)`);
  }

  console.log("\n📊 职能（role）分布：");
  for (const [k, v] of Object.entries(byRole).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((v / total) * 100);
    console.log(`  - ${k}: ${v} (${pct}%)`);
    if (pct > 50 && k !== "其他") {
      console.warn(`    ⚠️ role "${k}" 占比过高，请检查分类规则`);
    }
  }

  const bad = jobs.filter(j => !j.title || !j.org || !j.url);
  if (bad.length) {
    console.warn(`\n⚠️ 有 ${bad.length} 条缺少 title/org/url`);
  }
}

/* =========================================================================
 * 主流程
 * ========================================================================= */

async function main() {
  console.log("🚀 开始抓取西北人才网岗位数据...\n");

  const allJobs = [];
  let currentPage = 1;
  let totalPages = 1;

  while (currentPage <= MAX_PAGES && currentPage <= totalPages) {
    console.log(`[第 ${currentPage} 页] 正在抓取...`);

    try {
      const data = await fetchPage(currentPage);
      totalPages = data.pages || 1;
      const list = data.list || [];

      if (!list.length) {
        console.log(`  本页无数据，提前结束。`);
        break;
      }

      const mapped = list.map(mapJobItem);
      allJobs.push(...mapped);

      console.log(`  ✅ 获取 ${list.length} 条 | 总计 ${data.total} 条 | 共 ${totalPages} 页`);

      if (!data.hasNextPage) {
        console.log(`  已到最后一页，停止抓取。`);
        break;
      }
    } catch (err) {
      console.error(`  ❌ 抓取失败: ${err.message}`);
      break;
    }

    currentPage++;
    if (currentPage <= MAX_PAGES && currentPage <= totalPages) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n📊 共抓取 ${allJobs.length} 条（去重前）`);

  // 去重
  const deduped = dedupe(allJobs);
  console.log(`📊 去重后 ${deduped.length} 条`);

  // 按发布时间从新到旧排序
  deduped.sort((a, b) => (a.publishedDays ?? 999) - (b.publishedDays ?? 999));

  // 统计
  reportStats(deduped);

  // 写入
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(deduped, null, 2) + "\n", "utf8");
  console.log(`\n📁 已保存到 ${path.relative(ROOT, OUT)}`);
}

main().catch(err => {
  console.error("💥 抓取失败:", err);
  process.exit(1);
});