import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import iconv from "iconv-lite";
import * as cheerio from "cheerio";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "src", "lib", "fundings-data.json");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithGBK(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  // 🚨 核心修复：页面使用 GBK 编码，必须强制解码
  return iconv.decode(Buffer.from(buffer), "gbk");
}

// 🚨 新增：根据发布人名称推断所在省份
function guessRegionFromOrg(orgName) {
  if (!orgName) return "全国";
  // 直辖市
  if (orgName.includes("北京")) return "北京市";
  if (orgName.includes("上海")) return "上海市";
  if (orgName.includes("天津")) return "天津市";
  if (orgName.includes("重庆")) return "重庆市";
  
  const cityMap = {
    "杭州": "浙江省", "宁波": "浙江省", "温州": "浙江省", "嘉兴": "浙江省",
    "广州": "广东省", "深圳": "广东省", "珠海": "广东省", "东莞": "广东省",
    "成都": "四川省", "绵阳": "四川省",
    "武汉": "湖北省", "长沙": "湖南省",
    "南京": "江苏省", "苏州": "江苏省", "无锡": "江苏省", "常州": "江苏省",
    "西安": "陕西省", "郑州": "河南省", "济南": "山东省", "青岛": "山东省",
    "合肥": "安徽省", "福州": "福建省", "厦门": "福建省",
    "昆明": "云南省", "贵阳": "贵州省", "南宁": "广西壮族自治区",
    "兰州": "甘肃省", "太原": "山西省", "石家庄": "河北省", "唐山": "河北省",
    "沈阳": "辽宁省", "大连": "辽宁省", "哈尔滨": "黑龙江省",
    "长春": "吉林省", "南昌": "江西省", "呼和浩特": "内蒙古自治区",
    "银川": "宁夏回族自治区", "西宁": "青海省", "乌鲁木齐": "新疆维吾尔自治区",
    "拉萨": "西藏自治区", "海口": "海南省", "三亚": "海南省",
  };
  
  for (const [city, province] of Object.entries(cityMap)) {
    if (orgName.includes(city)) return province;
  }
  return "全国";
}

// 领域自动分类
function normalizeField(title, summary) {
  const text = `${title} ${summary}`;
  if (/教育|学校|学生|支教|教师|大学|助学|儿童|青少年/.test(text)) return "乡村教育";
  if (/医疗|医院|健康|疾控|卫生|康复|心理/.test(text)) return "医疗健康";
  if (/环保|生态|绿化|污染|气候|环境|碳|海洋/.test(text)) return "生态环保";
  if (/养老|老人|老龄|老年/.test(text)) return "老龄关怀";
  if (/社区|街道|乡村建设|帮扶|基层/.test(text)) return "社区营造";
  if (/文化|艺术|非遗|文物|图书/.test(text)) return "文化传承";
  if (/女性|妇女|妈妈|妇联/.test(text)) return "女性关怀";
  if (/残障|残疾|心智|孤独症|盲|聋/.test(text)) return "残障融合";
  if (/人才|培训|就业/.test(text)) return "人才培育";
  return "其他";
}

async function main() {
  console.log("🚀 开始抓取 支付宝公益 - 项目列表...\n");

  const allFundings = [];

  // 抓取前 32 页
  for (let page = 1; page <= 32; page++) {
    const url = `https://love.alipay.com/donate/itemList.htm?page=${page}&donateType=&itemClassified=1&orderType=gmt_create_desc&donateShowName=`;
    console.log(`📄 抓取第 ${page} 页: ${url}`);

    try {
      const html = await fetchWithGBK(url);
      const $ = cheerio.load(html);
      let pageCount = 0;

      // 解析列表项
      $(".donate-item-default-li").each((idx, el) => {
        const $el = $(el);
        
        const $titleLink = $el.find(".donate-item-default-title a").first();
        const title = $titleLink.text().trim();
        let detailUrl = $titleLink.attr("href") || "";

        if (!title || title.length < 2) return;

        // 补全绝对路径
        if (detailUrl.startsWith("/")) {
          detailUrl = `https://love.alipay.com${detailUrl}`;
        }

        // 提取摘要
        const $desc = $el.find(".donate-item-default-desc").clone();
        $desc.find("a").remove();
        const summary = $desc.text().trim().substring(0, 150) || "点击查看详情";

        // 提取发布人
        const fullText = $el.text();
        const orgMatch = fullText.match(/发\s*布\s*人[：:]\s*([^\s]+)/);
        const org = orgMatch ? orgMatch[1].trim() : "支付宝公益";

        // 🚨 核心修改：根据发布人推断地域
        const finalRegion = guessRegionFromOrg(org);

        // 提取已募善款
        const amountText = $el.find(".donate-list-info em").text().trim();
        const amountWan = parseFloat(amountText) || 0;

        // 提取参捐人数
        const donorMatch = $el.find(".donate-item-default-dd").text().match(/参捐人数[：:]\s*(\d+)/);
        const donorCount = donorMatch ? parseInt(donorMatch[1]) : 0;

        // 提取项目时间
        const timeMatch = fullText.match(/项目时间[：:]\s*([^\s]+)/);
        const duration = timeMatch ? timeMatch[1].trim() : "长期有效";

        const finalField = normalizeField(title, summary);

        allFundings.push({
          id: `alipay-${page}-${idx}`,
          kind: "资助",
          type: "慈善会/基金会资助",
          supportType: "资金",
          duration: duration,
          field: finalField,
          region: finalRegion, // 👈 使用推断后的省份
          title: `【支付宝公益】${title}`,
          summary: summary,
          org: org,
          location: finalRegion, // 👈 使用推断后的省份
          amount: amountWan > 0 ? `${amountWan.toFixed(2)}元` : "面议",
          amountWan: amountWan,
          dueDays: 0,
          due: "长期有效",
          publishedDays: 0,
          url: detailUrl,
          donorCount: donorCount,
        });
        pageCount++;
      });

      console.log(`   ✅ 本页抓取 ${pageCount} 条`);
      await sleep(2000);
    } catch (err) {
      console.log(`   ❌ 第 ${page} 页抓取失败: ${err.message}`);
    }
  }

  // 合并历史数据
  let existingData = [];
  try {
    const existingRaw = await readFile(OUT, "utf8");
    existingData = JSON.parse(existingRaw);
    console.log(`\n📂 读取到 ${existingData.length} 条历史数据`);
  } catch (e) {
    console.log("\n⚠️ 没有找到历史数据，将创建新文件");
  }

  const combinedData = [...existingData, ...allFundings];

  // 去重
  const uniqueFundings = Array.from(
    new Map(combinedData.map((item) => [item.title, item])).values()
  );

  const finalData = uniqueFundings.map((item, idx) => ({
    ...item,
    id: `fund-merged-${idx + 1}`,
  }));

  await writeFile(OUT, JSON.stringify(finalData, null, 2) + "\n", "utf8");
  console.log(`\n📊 合并完成！去重后共 ${finalData.length} 条数据，已保存到 src/lib/fundings-data.json`);
}

main();