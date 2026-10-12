// scripts/seed-tools.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RAW_DATA_PATH = path.join(ROOT, "scripts", "raw-data.json");
const OUT = path.join(ROOT, "src", "lib", "tools-data.json");

const CATEGORY_ICONS = {
  "培训课程": { icon: "🎓", color: "#e8f5e9" },
  "行业沙龙会议": { icon: "🎤", color: "#fdf6ec" },
  "公益工具模板库": { icon: "🧰", color: "#e3f2fd" },
  "行业报告": { icon: "📊", color: "#f3e5f5" },
  "行业标准": { icon: "📋", color: "#fce4ec" },
  "同行经验文章": { icon: "📝", color: "#e0f2f1" },
  "国际经验": { icon: "🌏", color: "#e8eaf6" },
};

// 智能分类逻辑：根据标题关键词自动归类
function classify(title) {
  if (title.includes("标准") || title.includes("办法") || title.includes("规定") || title.includes("法律")) return "行业标准";
  if (title.includes("年刊") || title.includes("报告") || title.includes("手册") || title.includes("汇编")) return "行业报告";
  if (title.includes("文章") || title.includes("经验") || title.includes("案例")) return "同行经验文章";
  if (title.includes("培训") || title.includes("课程")) return "培训课程";
  if (title.includes("沙龙") || title.includes("研讨会") || title.includes("会议")) return "行业沙龙会议";
  if (title.includes("工具") || title.includes("模板")) return "公益工具模板库";
  if (title.includes("国际") || title.includes("全球")) return "国际经验";
  return "行业报告"; // 默认归类
}

function makeId(cat, title, url) {
  return "tool-" + createHash("sha1").update(`${cat}|${title}|${url}`).digest("hex").slice(0, 12);
}

function buildOne(item) {
  const cat = classify(item.title); // 根据标题自动分类
  const meta = CATEGORY_ICONS[cat] || { icon: "📦", color: "#f5f5f5" };
  
  return {
    id: makeId(cat, item.title, item.previewUrl),
    category: cat,
    title: item.title,
    url: item.previewUrl,
    summary: item.summary,
    org: item.org,
    isFree: item.isFree,
    priceText: item.priceText,
    tags: [cat, item.isFree ? "免费" : "商业付费"],
    icon: meta.icon,
    color: meta.color,
    domain: "",
    format: "",
    period: "",
    dateText: item.dateText,
    locationText: "",
    sourceName: item.org,
    downloadUrl: item.downloadUrl || item.previewUrl,
    publishDate: new Date().toISOString().slice(0, 10),
    publishedDays: 0,
  };
}

async function main() {
  console.log("🌱 开始读取爬取到的原始数据...\n");
  
  let rawData = [];
  try {
    const fileContent = await readFile(RAW_DATA_PATH, "utf8");
    rawData = JSON.parse(fileContent);
  } catch (e) {
    console.error("❌ 读取 raw-data.json 失败，请先运行 node scripts/crawler.mjs 抓取数据！");
    process.exit(1);
  }

  // 映射并分类
  const tools = rawData.map(item => buildOne(item));
  
  // 统计各分类数量
  const stats = {};
  for (const t of tools) stats[t.category] = (stats[t.category] || 0) + 1;
  console.log("📊 数据分类统计：");
  for (const [k, v] of Object.entries(stats)) console.log(`  - ${k}: ${v} 条`);

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(tools, null, 2) + "\n", "utf8");
  console.log(`\n✅ 共 ${tools.length} 条真实数据，已映射到 src/lib/tools-data.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });