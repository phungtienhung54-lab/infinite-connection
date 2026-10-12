// scripts/crawler.mjs
import * as cheerio from "cheerio";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// 全局去重集合
const seenUrls = new Set();
const allData = [];

// ==================== 1. 抓取 CFF 网站（HTML 解析） ====================
async function fetchCFF() {
  console.log("📂 开始抓取【北京基业长青】...");
  const targets = [
    { url: "https://www.cfforum.org.cn/category/19", org: "北京基业长青社会组织服务中心", type: "原创成果" },
    { url: "https://www.cfforum.org.cn/category/228", org: "北京基业长青社会组织服务中心", type: "伙伴成果" }
  ];

  for (const target of targets) {
    for (let page = 1; page <= 5; page++) {
      const pageUrl = page === 1 ? target.url : `${target.url}?p=${page}`;
      try {
        const response = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!response.ok) break;
        
        const $ = cheerio.load(await response.text());
        let newCount = 0;

        $('#list-content .list-group-item, .list-group-item').each((i, el) => {
          const title = $(el).find('.title').text().trim() || $(el).find('.media-heading').text().trim();
          const link = $(el).find('a').attr('href');
          if (title && link && link.includes('/Uploads/')) {
            const fullUrl = link.startsWith('http') ? link : `https://www.cfforum.org.cn${link}`;
            if (!seenUrls.has(fullUrl)) {
              seenUrls.add(fullUrl);
              allData.push({
                category: "行业报告",
                title,
                dateText: $(el).find('.time').text().trim(),
                previewUrl: fullUrl,
                downloadUrl: fullUrl,
                org: target.org,
                isFree: true,
                priceText: "免费",
                summary: `【${target.type}】${title}`
              });
              newCount++;
            }
          }
        });
        console.log(`  ✅ CFF第 ${page} 页抓取 ${newCount} 条`);
        if (newCount === 0 && page > 1) break;
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) { break; }
    }
  }
}

// ==================== 2. 抓取 中国发展简报（API 解析） ====================
async function fetchCDB() {
  console.log("📂 开始抓取【中国发展简报】（接口数据）...");
  
  // 类别映射（来源于网页源码）
  const categories = [
    { plateId: "267", category: "行业报告" },
    { plateId: "268", category: "公益工具模板库" },
    { plateId: "269", category: "同行经验文章" },
    { plateId: "270", category: "行业报告" },
    { plateId: "271", category: "公益工具模板库" },
    { plateId: "272", category: "同行经验文章" }
  ];

  for (const cat of categories) {
    console.log(`  🔍 正在抓取分类: ${cat.category} (plateId: ${cat.plateId})`);
    for (let page = 1; page <= 5; page++) {
      try {
        const response = await fetch("https://www.chinadevelopmentbrief.org.cn/library/getData", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          body: new URLSearchParams({
            plateId: cat.plateId,
            pageNum: page.toString(),
            pageSize: "50", // 一次抓取50条，效率极高
            title: "",
            search: "0"
          })
        });

        const res = await response.json();
        if (res.code !== 200 || !res.result || res.result.list.length === 0) break;

        let newCount = 0;
        for (const item of res.result.list) {
          const fullUrl = `https://www.chinadevelopmentbrief.org.cn/news/detail/${item.id}.html`;
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            allData.push({
              category: cat.category,
              title: item.title,
              dateText: "", // 接口未提供日期，留空由前端渲染
              previewUrl: fullUrl,
              downloadUrl: fullUrl,
              org: "中国发展简报",
              isFree: true,
              priceText: "免费",
              summary: `中国发展简报：${item.title}`
            });
            newCount++;
          }
        }
        console.log(`    ✅ 第 ${page} 页抓取 ${newCount} 条真实数据`);
        await new Promise(r => setTimeout(r, 800)); // 礼貌延迟
      } catch (e) {
        console.error(`    ❌ 接口请求失败: ${e.message}`);
        break;
      }
    }
  }
}

async function run() {
  console.log("🚀 开始全自动抓取任务...\n");
  await fetchCFF();
  await fetchCDB();

  const outPath = path.join(process.cwd(), "scripts", "raw-data.json");
  await writeFile(outPath, JSON.stringify(allData, null, 2), "utf8");
  console.log(`\n🎉 抓取任务完成！累计去重后共抓取到 ${allData.length} 条真实数据。`);
  console.log(`📁 已保存至 scripts/raw-data.json`);
}

run();