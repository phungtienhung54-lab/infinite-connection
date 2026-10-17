import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "src", "lib", "fundings-data.json");

// 使用常见的浏览器 UA 防封
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithUA(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ============ 1. 省份映射（对齐前端 filterGroups.fundingRegions） ============
function normalizeRegion(regionStr) {
  if (!regionStr || regionStr === "全国") return "全国";
  const regionMap = {
    "北京": "北京市", "天津": "天津市", "上海": "上海市", "重庆": "重庆市",
    "河北": "河北省", "山西": "山西省", "辽宁": "辽宁省", "吉林": "吉林省",
    "黑龙江": "黑龙江省", "江苏": "江苏省", "浙江": "浙江省", "安徽": "安徽省",
    "福建": "福建省", "江西": "江西省", "山东": "山东省", "河南": "河南省",
    "湖北": "湖北省", "湖南": "湖南省", "广东": "广东省", "海南": "海南省",
    "四川": "四川省", "贵州": "贵州省", "云南": "云南省", "陕西": "陕西省",
    "甘肃": "甘肃省", "青海": "青海省", "台湾": "台湾省",
    "内蒙古": "内蒙古自治区", "广西": "广西壮族自治区", "西藏": "西藏自治区",
    "宁夏": "宁夏回族自治区", "新疆": "新疆维吾尔自治区",
    "香港": "香港特别行政区", "澳门": "澳门特别行政区",
  };
  if (/省|市|自治区|特别行政区/.test(regionStr)) return regionStr;
  return regionMap[regionStr] || "全国";
}

// ============ 更精准的领域分类：核心关键词 ============

// 每个分类只保留真实会出现在政府采购标题里的核心词，按"精准度"从高到低排列
const FIELD_KEYWORDS = [
  { field: "乡村教育", keywords: ["山区教育","山区", "乡村小学", "乡村教育"] },
  { field: "医疗健康", keywords: ["医院", "医疗", "疾控", "卫生", "康复"] },
  { field: "生态环保", keywords: ["环保", "生态", "环境", "海洋", "绿化","湿地"] },
  { field: "老龄关怀", keywords: ["老龄关怀", "养老", "老龄", "老年"] },
  { field: "儿童保护", keywords: ["儿童", "青少年", "少年"] },
  { field: "社区营造", keywords: ["社区", "街道", "社会工作", "帮扶"] },
  { field: "文化传承", keywords: ["文化", "艺术", "非遗", "文物", "文化传承"] },
  { field: "女性关怀", keywords: ["女性关怀", "妇女", "女性", "妇联"] },
  { field: "残障融合", keywords: ["残障", "残疾", "孤独症", "康复中心"] },
  { field: "人才培育", keywords: ["人才培育","人才", "培训", "就业"] },
  { field: "心理健康", keywords: ["心理", "精神卫生","心理健康"] },
];

// 工程/服务类"模糊词"：命中这些词时，不要强行归入教育/医疗
const CONSTRUCTION_WORDS = [
  "消防", "救援", "改造", "修缮", "装修", "维修",
  "沥青", "路面", "值班室", "基建", "维保", "外包",
];

function normalizeField(title) {
  const isConstruction = CONSTRUCTION_WORDS.some(word => title.includes(word));

  // 按顺序遍历分类（顺序 = 优先级）
  for (const { field, keywords } of FIELD_KEYWORDS) {
    const matched = keywords.some(word => title.includes(word));
    if (!matched) continue;

    // 工程类 + 教育/医疗 => 归"其他"（避免"消防大队学校改造"被误判）
    if (isConstruction && (field === "乡村教育" || field === "医疗健康")) {
      continue;
    }
    return field;
  }

  return "其他";
}
// ============ 主流程 ============
async function main() {
  console.log("🚀 开始抓取 中国政府采购网 - 邀请招标公告...\n");
  const allFundings = [];

  // 抓取前 5 页
  for (let page = 1; page <= 5; page++) {
    const pageSuffix = page === 1 ? "index.htm" : `index_${page - 1}.htm`;
    const url = `http://www.ccgp.gov.cn/cggg/zygg/yqzbgg/${pageSuffix}`;

    console.log(`📄 抓取第 ${page} 页: ${url}`);

    try {
      const res = await fetchWithUA(url);
      const html = await res.text();
      const $ = cheerio.load(html);
      let pageCount = 0;

      $('ul.c_list_bid > li').each((idx, el) => {
        const $el = $(el);
        const $link = $el.find('a').first();
        const title = $link.text().trim();
        let href = $link.attr('href') || '';

        if (!title || title.length < 5) return;

        // 补全绝对路径
        if (href.startsWith('/')) {
          href = `http://www.ccgp.gov.cn${href}`;
        } else if (!href.startsWith('http')) {
          href = `http://www.ccgp.gov.cn/cggg/zygg/yqzbgg/${href}`;
        }

        const fullText = $el.text().replace(title, '').trim();

        // 修正正则，避免抓取到"采购人"脏数据
        const dateMatch = fullText.match(/发布时间[：:]\s*(\d{4}-\d{2}-\d{2})/);
        const locMatch = fullText.match(/地域[：:]\s*([\u4e00-\u9fa5]{2,10})/);
        const orgMatch = fullText.match(/采购人[：:]\s*([^\s]+)/);

        const publishDate = dateMatch ? dateMatch[1] : "";
        const rawLocation = locMatch ? locMatch[1] : "全国";
        const org = orgMatch ? orgMatch[1] : "中国政府采购网";

        const finalLocation = normalizeRegion(rawLocation);
        const finalField = normalizeField(title);

        allFundings.push({
          id: `ccgp-${page}-${idx}`,
          kind: "资助",
          type: "政府购买",
          supportType: "资金",
          duration: "6-12个月",
          field: finalField,
          region: finalLocation,
          title: `【政府采购】${title}`,
          summary: `采购人：${org} | 发布时间：${publishDate}`,
          org: org,
          location: finalLocation,
          amount: "面议",
          amountWan: 0,
          dueDays: 0,
          due: "长期有效",
          publishedDays: 0,
          url: href,
        });
        pageCount++;
      });

      console.log(`   ✅ 本页抓取 ${pageCount} 条`);
      if (pageCount === 0) {
        console.log(`   ⚠️ 本页无数据，停止翻页。`);
        break;
      }

      // 政府采购网反爬较严，每次翻页间隔至少 3 秒
      await sleep(3000);

    } catch (err) {
      console.log(`   ❌ 第 ${page} 页抓取失败: ${err.message}`);
      break;
    }
  }

  // ============ 合并历史数据 + 全量清洗 ============
  let existingData = [];
  try {
    const existingRaw = await readFile(OUT, "utf8");
    existingData = JSON.parse(existingRaw);
    console.log(`\n📂 读取到 ${existingData.length} 条历史数据`);
  } catch (e) {
    console.log("\n⚠️ 没有找到历史数据，将创建新文件");
  }

  // 合并新旧数据
  const combinedData = [...existingData, ...allFundings];

  // 对合并后的所有数据（含历史）重新计算 field 和 region，实现历史数据自动修复
  const cleanedData = combinedData.map((item) => {
    const rawTitle = item.title.replace(/^【.*?】/, '');
    return {
      ...item,
      field: normalizeField(rawTitle),
      region: normalizeRegion(item.region),
      location: normalizeRegion(item.location),
    };
  });

  // 自动去重（根据标题）
  const uniqueFundings = Array.from(
    new Map(cleanedData.map(item => [item.title, item])).values()
  );

  // 重新分配 ID，防止冲突
  const finalData = uniqueFundings.map((item, idx) => ({
    ...item,
    id: `fund-merged-${idx + 1}`,
  }));

  await writeFile(OUT, JSON.stringify(finalData, null, 2) + "\n", "utf8");
  console.log(`\n📊 合并完成！去重后共 ${finalData.length} 条数据，已保存到 src/lib/fundings-data.json`);
}

main();