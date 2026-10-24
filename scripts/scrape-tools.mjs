#!/usr/bin/env node
/**
 * 能力工具抓取脚本（预览用）
 *
 * 业务规则：
 *   - 只收录面向公益组织 / 社工机构 / 公益从业者的学习资源、工具模板、
 *     培训课程与行业资料；
 *   - 不收录商业广告、招生销售页、与公益能力建设无关的新闻；
 *   - 与既有 src/lib/tools-data.json 合并去重，绝不覆盖已有真实记录。
 *
 * 来源：
 *   1. 恩友财务（cwgzmb / cwplmb）—— 财务工作模板与披露模板
 *   2. 深圳国际公益学院 · 公益网校 —— 公开课程
 *   3. 中国慈善联合会 · 人才培养 / 培训动态 —— 培训与沙龙
 *   4. CFF 长青文献图书馆（若页面提供 .listRight 列表则增量补录，
 *      历史 CFF 报告已存在于 tools-data.json，保留不动）
 *
 * 用法：node --use-env-proxy scripts/scrape-tools.mjs
 * 输出：src/lib/tools-data.json（与既有记录合并）
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "src/lib/tools-data.json");
const UA = "InfiniteConnectionPreview/0.1 (+https://github.com/schneiderlin/infinite-connection)";
const GAP_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) =>
  String(value ?? "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hashId = (value) => createHash("sha1").update(value).digest("hex").slice(0, 12);

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(`${dateStr}T00:00:00+08:00`).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / 86_400_000));
}

async function request(url, label = url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(25_000),
        redirect: "follow",
      });
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        throw new Error(`blocked: HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(1_000 * attempt);
    }
  }
  throw new Error(`${label}: ${lastError?.message ?? lastError}`);
}

function inferDomain(text) {
  const t = String(text ?? "");
  if (/财务|会计|预算|报销|税务|出纳|审计|内控/.test(t)) return "财务";
  if (/筹款|募捐|捐赠|资助方/.test(t)) return "筹款";
  if (/传播|品牌|媒体|公关|舆情/.test(t)) return "传播";
  if (/团队|人力|治理|理事会|秘书长|领导力|战略|组织发展/.test(t)) return "团队管理";
  if (/项目|计划书|设计思维|评估|监测|逻辑模型|利益相关方/.test(t)) return "项目管理";
  if (/学位|学历|硕士|博士/.test(t)) return "学位课程";
  return "综合素养";
}

function makeTool({
  title,
  url,
  summary,
  org,
  category,
  field,
  format = "",
  period = "",
  dateText = "",
  locationText = "",
  isFree = true,
  priceText = "免费",
  icon = "📦",
  color = "#e8f5e9",
  sourceName = org,
  publishDate = "",
}) {
  return {
    id: `tool-${hashId(url)}`,
    // 新抓取记录默认待审，人工审核改为 PUBLISHED 后才会在前端展示。
    status: "PENDING",
    category,
    title: clean(title).slice(0, 180),
    url,
    summary: clean(summary).slice(0, 220),
    org,
    isFree,
    priceText,
    tags: [category, field, isFree ? "免费" : "付费"].filter(Boolean),
    icon,
    color,
    domain: field,
    format,
    period,
    dateText,
    locationText,
    sourceName,
    downloadUrl: url,
    publishDate,
    publishedDays: daysSince(publishDate),
  };
}

function normalizeUrl(value) {
  return String(value ?? "")
    .trim()
    .replace(/^http:\/\//i, "https://")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function titleKey(item) {
  return `${clean(item.org)}|${clean(item.title)}`.toLowerCase();
}


/* ---------- 来源 1：恩友财务 · 模板库 ---------- */

const NFRIEND_PAGES = [
  {
    url: "http://www.nfriend.org/cwgzmb.html",
    label: "财务工作模板",
    summary: "恩友财务提供的社会组织财务工作模板",
  },
  {
    url: "http://www.nfriend.org/cwplmb.html",
    label: "财务披露模板",
    summary: "恩友财务提供的公益组织财务信息披露模板",
  },
];

async function scrapeNfriend() {
  const items = [];
  for (const page of NFRIEND_PAGES) {
    const res = await request(page.url, page.label);
    const html = await res.text();
    const $ = cheerio.load(html);
    $("a").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!/\/file\/|youku\.com/i.test(href)) return;
      const title = clean($(el).text());
      if (!title || title.length < 2) return;
      const url = new URL(href, page.url).href;
      const isVideo = /youku\.com|视频/i.test(`${href} ${title}`);
      items.push(
        makeTool({
          title,
          url,
          summary: `${page.summary}${isVideo ? "（填报指南视频）" : "（可直接下载）"}`,
          org: "北京恩友财务",
          category: isVideo ? "培训课程" : "公益工具模板库",
          field: "财务",
          format: isVideo ? "线上" : "下载",
          locationText: isVideo ? "线上" : "",
          icon: isVideo ? "🎓" : "📋",
          color: isVideo ? "#e8f5e9" : "#fdf6ec",
          sourceName: "恩友财务",
        }),
      );
    });
    await sleep(GAP_MS);
  }
  return items;
}

/* ---------- 来源 2：深圳国际公益学院 · 公益网校 ---------- */

async function scrapeCGPI() {
  const url = "https://poa.cgpi.org.cn/course/explore";
  const res = await request(url, "公益网校");
  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];
  $(".course-item").each((_, el) => {
    const anchor = $(el).find(".title a").first();
    const title = clean(anchor.text());
    const href = anchor.attr("href");
    if (!title || !href) return;
    const priceText = clean($(el).find(".course-price-widget").text()) || "免费";
    const isFree = /免费|free/i.test(priceText) && !/¥|￥|\d+元/.test(priceText);
    items.push(
      makeTool({
        title,
        url: new URL(href, url).href,
        summary: `深圳国际公益学院公益网校公开课${isFree ? "，可免费学习" : ""}`,
        org: "深圳国际公益学院",
        category: "培训课程",
        field: inferDomain(title),
        format: "线上",
        locationText: "线上",
        isFree,
        priceText: isFree ? "免费" : priceText,
        icon: "🎓",
        color: "#e8f5e9",
        sourceName: "公益网校",
      }),
    );
  });
  await sleep(GAP_MS);
  return items;
}

/* ---------- 来源 3：中国慈善联合会 · 培训动态 ---------- */

// 新闻宣传稿特征：结业 / 活动报道 / 政策解读，不是可报名的课程，不能归入“培训课程”。
const NEWS_RELEASE_PATTERN =
  /圆满结束|顺利举办|圆满落幕|圆满收官|圆满完成|成功举办|顺利举行|圆满举行|顺利召开|圆满召开|结业|开班|解读|宣贯|新闻稿|宣传报道|举办$/;

function inferTrainingCategory(title) {
  if (/沙龙|圆桌|研讨会|交流会|论坛|年会/.test(title)) return "行业沙龙会议";
  return NEWS_RELEASE_PATTERN.test(title) ? "其他" : "培训课程";
}

async function scrapeCharityAlliance() {
  const url = "https://www.charityalliance.org.cn/dl/xOqNx-252B.html";
  const res = await request(url, "中慈联培训动态");
  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];
  $("a[href*='/ds/']").each((_, el) => {
    const raw = clean($(el).text());
    const dateMatch = raw.match(/(20\d{2})-(\d{2})-(\d{2})\s*$/);
    if (!dateMatch) return;
    const title = clean(raw.replace(/(20\d{2})-(\d{2})-(\d{2})\s*$/, ""));
    if (title.length < 8) return;
    const href = $(el).attr("href");
    if (!href) return;
    const publishDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const category = inferTrainingCategory(title);
    const online = /线上|在线|直播/.test(title);
    items.push(
      makeTool({
        title,
        url: new URL(href, url).href,
        summary: `中国慈善联合会培训动态：${title}`,
        org: "中国慈善联合会",
        category,
        field: inferDomain(title),
        format: online ? "线上" : "线下",
        dateText: publishDate.replace(/-/g, "."),
        locationText: online ? "线上" : "",
        icon: category === "行业沙龙会议" ? "☕" : "🎓",
        color: category === "行业沙龙会议" ? "#e3f2fd" : "#e8f5e9",
        sourceName: "中国慈善联合会",
        publishDate,
      }),
    );
  });
  await sleep(GAP_MS);
  return items;
}

/* ---------- 来源 4：CFF 长青文献图书馆（页面若仍有列表结构） ---------- */

async function scrapeCFF() {
  const pages = [
    "https://www.cfforum.org.cn/category/166",
    "https://www.cfforum.org.cn/category/332",
  ];
  const items = [];
  for (const url of pages) {
    const res = await request(url, "CFF 长青文献图书馆");
    const html = await res.text();
    const $ = cheerio.load(html);
    $(".listRight a").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!/\.pdf($|\?)/i.test(href)) return;
      const title = clean($(el).text());
      if (!title) return;
      items.push(
        makeTool({
          title,
          url: new URL(href, url).href,
          summary: `CFF 长青文献图书馆资料：${title}`,
          org: "北京基业长青社会组织服务中心",
          category: "行业报告",
          field: inferDomain(title),
          format: "下载",
          icon: "📊",
          color: "#f3e5f5",
          sourceName: "CFF 长青文献图书馆",
        }),
      );
    });
    await sleep(GAP_MS);
  }
  return items;
}

/* ---------- 抓取编排 ---------- */

const sources = [
  { name: "恩友财务", scrape: scrapeNfriend },
  { name: "深圳国际公益学院·公益网校", scrape: scrapeCGPI },
  { name: "中国慈善联合会·培训", scrape: scrapeCharityAlliance },
  { name: "CFF 长青文献图书馆", scrape: scrapeCFF },
];

/* ---------- 合并输出 ---------- */

async function main() {
  console.log("🚀 开始抓取能力工具模块的真实数据...\n");

  let existing = [];
  try {
    existing = JSON.parse(await readFile(OUT, "utf8"));
    console.log(`已有记录：${existing.length} 条（将保留并增量合并）`);
  } catch {
    console.log("未找到既有 tools-data.json，将从空列表开始。");
  }

  const fresh = [];
  for (const [i, src] of sources.entries()) {
    if (i > 0) await sleep(GAP_MS);
    try {
      const items = await src.scrape();
      console.log(`✅ ${src.name}: ${items.length} 条`);
      fresh.push(...items);
    } catch (error) {
      console.log(`❌ ${src.name}: ${error.message}`);
    }
  }

  const seenUrls = new Set(
    existing.map((item) => normalizeUrl(item.url)).filter(Boolean),
  );
  const seenTitles = new Set(existing.map((item) => titleKey(item)).filter(Boolean));
  const added = [];

  for (const item of fresh) {
    if (!item.url || !item.title) continue;
    const urlKey = normalizeUrl(item.url);
    const key = titleKey(item);
    if (seenUrls.has(urlKey) || seenTitles.has(key)) {
      console.log(`  - 已存在，跳过：${item.title}`);
      continue;
    }
    seenUrls.add(urlKey);
    seenTitles.add(key);
    added.push(item);
  }

  const merged = [...existing, ...added];
  await writeFile(OUT, JSON.stringify(merged, null, 2) + "\n", "utf8");

  const bySource = {};
  for (const item of added) {
    const name = item.sourceName || item.org || "未知来源";
    bySource[name] = (bySource[name] ?? 0) + 1;
  }
  console.log("\n新增来源统计：", bySource);
  console.log(`\n📊 本次新增 ${added.length} 条，合计 ${merged.length} 条`);
  console.log(`✅ 已合并写入 ${path.relative(ROOT, OUT)}`);
}

await main();

