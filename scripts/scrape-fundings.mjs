import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "src", "lib", "fundings-data.json");

const UA = "InfiniteConnectionPreview/0.1 (+https://github.com/schneiderlin/infinite-connection)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithUA(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function main() {
  console.log("🚀 开始抓取资助模块的真实项目数据...\n");
  
  // 列表页地址
  const urls = [
    { url: "https://www.chinadevelopmentbrief.org.cn/abutment/category/17.html", type: "公益资助" },
    { url: "https://www.chinadevelopmentbrief.org.cn/abutment/category/18.html", type: "招标信息" },
  ];
  
  const allFundings = [];
  const report = [];

  for (let i = 0; i < urls.length; i++) {
    const { url, type } = urls[i];
    console.log(`[${i + 1}/${urls.length}] 正在抓取: ${type}`);

    try {
      const res = await fetchWithUA(url);
      const html = await res.text();
      const $ = cheerio.load(html);
      
      let count = 0;
      
      // 🚨 终极杀器：抓取所有 href 包含 "/abutment/detail/" 的 <a> 标签
      $('a[href*="/abutment/detail/"]').each((idx, element) => {
        if (count >= 20) return; // 最多 20 条

        const $el = $(element);
        const href = $el.attr('href') || '';
        const title = $el.find('.title').text().trim() || $el.text().trim();
        
        // 只要标题太短就跳过（防止抓到无关链接）
        if (!title || title.length < 5 || title.includes("上一篇") || title.includes("下一篇")) return;

        // 尝试找活动时间和地址（可能不在同一个 a 标签里，做个兼容）
        const parent = $el.parent();
        const timeText = parent.find('.desc').text().trim() || parent.text().trim();
        
        // 提取截止日期
        const dateMatch = timeText.match(/(\d{4}-\d{2}-\d{2})/g);
        const endDate = dateMatch && dateMatch.length > 0 ? dateMatch[dateMatch.length - 1] : "长期有效";

        allFundings.push({
          id: `fund-${type === "公益资助" ? "17" : "18"}-${count + 1}`,
          kind: "资助",
          type: type === "公益资助" ? "慈善会/基金会资助" : "政府购买",
          supportType: "资金",
          duration: "6-12个月",
          field: "综合",
          region: "全国",
          title: `【${type}】${title}`,
          summary: `来自中国发展简报`,
          org: "中国发展简报",
          location: "全国",
          amount: "面议",
          amountWan: 0,
          dueDays: 0,
          due: endDate,
          publishedDays: 0,
        });
        count++;
      });

      report.push(`✅ ${type}: ${count} 条真实项目`);
      console.log(`   ✅ 成功提取 ${count} 条`);
    } catch (err) {
      report.push(`❌ ${type}: ${err.message}`);
      console.log(`   ❌ 抓取失败: ${err.message}`);
    }
    
    await sleep(1500);
  }

    // 🚨 去重逻辑：根据 title 去重
  const uniqueFundings = Array.from(
    new Map(allFundings.map(item => [item.title, item])).values()
  );

  const normalized = uniqueFundings.map((j, idx) => ({ id: `fund-scraped-${idx + 1}`, ...j }));
  await writeFile(OUT, JSON.stringify(normalized, null, 2) + "\n", "utf8");

  console.log("\n" + "=".repeat(40));
  console.log(report.join("\n"));
  console.log("=".repeat(40));
  console.log(`📊 共抓取到 ${normalized.length} 条真实项目，已保存到 src/lib/fundings-data.json`);
}

main();