import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "src", "lib", "fundings-data.json");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithUA(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ============ 1. 关键词映射（按优先级从具体到泛化） ============
const FIELD_KEYWORDS = [
  { field: "残障融合", keywords: ["残障", "心智障碍", "脊髓损伤", "盲童", "盲杖", "聋", "融合教育", "孤独症", "自闭症", "残疾"] },
  { field: "心理健康", keywords: ["心理", "精神", "抑郁", "精康", "郁金香", "安宁", "临终关怀", "舒缓", "戒毒", "禁毒"] },
  { field: "老龄关怀", keywords: ["养老", "老龄", "老年", "老人", "银龄", "认知症", "记忆包裹", "十方缘", "助老", "乐龄", "失独", "助餐"] },
  { field: "女性关怀", keywords: ["女性", "妇女", "妈妈", "女童", "姐妹", "恒爱", "绿芽", "反家暴", "万家无暴", "女生加油", "独抚母亲", "花蕾", "春柳", "潮汐"] },
  { field: "医疗健康", keywords: ["医疗", "医院", "健康", "护理", "罕见病", "康复", "烧烫伤", "眼科", "眼睛", "大病", "白血病", "早产", "尘肺", "听障", "爱耳", "安宁疗护"] },
  { field: "生态环保", keywords: ["环保", "生态", "气候", "河流", "长江", "净水", "零废弃", "垃圾", "减塑", "自然", "点绿", "守潮", "劲草", "涓流", "无塑", "环境", "绿色"] },
  { field: "儿童保护", keywords: ["事实孤儿", "困境儿童", "服刑人员", "留守儿童", "流动儿童", "未成年人", "护童", "护苗", "女童保护", "儿童安全", "预防伤害", "孤儿", "弱童", "反暴力", "彩虹村", "穿墙引线"] },
  { field: "女性关怀", keywords: ["女性", "妇女", "妈妈", "女童", "姐妹", "恒爱", "绿芽", "反家暴", "万家无暴", "女生加油", "独抚母亲", "花蕾", "春柳", "潮汐", "反暴力"] },
  { field: "生态环保", keywords: ["环保", "生态", "气候", "河流", "长江", "净水", "零废弃", "垃圾", "减塑", "自然", "点绿", "守潮", "劲草", "涓流", "无塑", "环境", "绿色", "无毒网购"] },
  { field: "老龄关怀", keywords: ["养老", "老龄", "老年", "老人", "银龄", "认知症", "记忆包裹", "十方缘", "助老", "乐龄", "失独", "助餐", "关爱失独"] },
  { field: "医疗健康", keywords: ["医疗", "医院", "健康", "护理", "罕见病", "康复", "烧烫伤", "眼科", "眼睛", "大病", "白血病", "早产", "尘肺", "听障", "爱耳", "安宁疗护", "联爱"] },
];

// ============ 2. 省份推断 ============
function guessRegionFromOrg(orgName) {
  if (!orgName) return "全国";
  if (orgName.includes("北京")) return "北京市";
  if (orgName.includes("上海")) return "上海市";
  if (orgName.includes("天津")) return "天津市";
  if (orgName.includes("重庆")) return "重庆市";

  const provinceKeywords = {
    "浙江": "浙江省", "江苏": "江苏省", "广东": "广东省", "山东": "山东省",
    "河南": "河南省", "四川": "四川省", "湖北": "湖北省", "湖南": "湖南省",
    "河北": "河北省", "福建": "福建省", "安徽": "安徽省", "江西": "江西省",
    "陕西": "陕西省", "山西": "山西省", "辽宁": "辽宁省", "吉林": "吉林省",
    "黑龙江": "黑龙江省", "云南": "云南省", "贵州": "贵州省", "甘肃": "甘肃省",
    "青海": "青海省", "海南": "海南省", "台湾": "台湾省",
    "内蒙古": "内蒙古自治区", "广西": "广西壮族自治区", "西藏": "西藏自治区",
    "宁夏": "宁夏回族自治区", "新疆": "新疆维吾尔自治区",
    "香港": "香港特别行政区", "澳门": "澳门特别行政区",
  };
  for (const [kw, province] of Object.entries(provinceKeywords)) {
    if (orgName.includes(kw)) return province;
  }

  const cityMap = {
    "杭州": "浙江省", "宁波": "浙江省", "温州": "浙江省",
    "广州": "广东省", "深圳": "广东省", "珠海": "广东省",
    "成都": "四川省", "武汉": "湖北省", "长沙": "湖南省",
    "南京": "江苏省", "苏州": "江苏省", "无锡": "江苏省",
    "西安": "陕西省", "郑州": "河南省", "济南": "山东省",
    "合肥": "安徽省", "福州": "福建省", "厦门": "福建省",
    "昆明": "云南省", "贵阳": "贵州省", "南宁": "广西壮族自治区",
    "兰州": "甘肃省", "太原": "山西省", "石家庄": "河北省",
    "沈阳": "辽宁省", "大连": "辽宁省", "哈尔滨": "黑龙江省",
    "长春": "吉林省", "南昌": "江西省", "呼和浩特": "内蒙古自治区",
    "银川": "宁夏回族自治区", "西宁": "青海省", "乌鲁木齐": "新疆维吾尔自治区",
    "拉萨": "西藏自治区", "海口": "海南省", "三亚": "海南省",
    "安康": "陕西省", "监利": "湖北省", "宜昌": "湖北省",
    "泰安": "山东省", "温州": "浙江省", "成都": "四川省",
  };
  for (const [city, province] of Object.entries(cityMap)) {
    if (orgName.includes(city)) return province;
  }

  return "全国";
}

// ============ 3. 领域分类 ============
function normalizeField(title) {
  const text = title;
  for (const { field, keywords } of FIELD_KEYWORDS) {
    if (keywords.some((kw) => text.includes(kw))) {
      return field;
    }
  }
  return "其他";
}

// ============ 4. 清洗标题 + 拆分机构名 ============
function splitTitleAndOrg(fullText) {
  // 先把换行、制表符、连续空格全部替换成单个空格
  const cleaned = fullText.replace(/\s+/g, " ").trim();
  // 尝试剥离结尾的机构名
  const orgMatch = cleaned.match(/([\u4e00-\u9fa5]{4,}(?:中心|基金会|协会|联合会|促进会|社工|研究院|事务所|俱乐部|服务社|发展中心|慈善会|学会|委员会|事业部|研究所))$/);
  if (orgMatch && cleaned.length > orgMatch[0].length) {
    return {
      title: cleaned.replace(orgMatch[0], "").trim(),
      org: orgMatch[0],
    };
  }
  return { title: cleaned, org: "南都公益基金会 · 好公益平台" };
}

// ============ 5. 主流程 ============
async function main() {
  console.log("🚀 开始抓取 南都基金会 - 好公益平台（前十页）...\n");

  const allFundings = [];

  for (let page = 1; page <= 10; page++) {
    const url = page === 1
      ? "https://www.haogongyi.org.cn/category/229"
      : `https://www.haogongyi.org.cn/category/229?page=${page}`;
    console.log(`📄 抓取第 ${page} 页: ${url}`);

    try {
      const html = await fetchWithUA(url);
      const $ = cheerio.load(html);
      let pageCount = 0;

      $('a[href*="/content/"]').each((idx, el) => {
        const $el = $(el);
        let href = $el.attr("href") || "";
        const fullText = $el.text().trim();

        if (!href.includes("/content/")) return;
        if (!fullText || fullText.length < 3 || fullText.length > 300) return;

        if (href.startsWith("/")) {
          href = `https://www.haogongyi.org.cn${href}`;
        }

        const idMatch = href.match(/\/content\/(\d+)/);
        const projectId = idMatch ? idMatch[1] : `${page}-${idx}`;

        const { title, org } = splitTitleAndOrg(fullText);
        if (!title || title.length < 2) return;

        const finalRegion = guessRegionFromOrg(org);
        const finalField = normalizeField(title);

        allFundings.push({
          id: `hgy-${projectId}`,
          kind: "资助",
          type: "公益项目伙伴招募",
          supportType: "资金",
          duration: "1-2年",
          field: finalField,
          region: finalRegion,
          title: `【好公益平台】${title}`,
          summary: "",
          org: org,
          location: finalRegion,
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
      await sleep(2000);
    } catch (err) {
      console.log(`   ❌ 第 ${page} 页抓取失败: ${err.message}`);
    }
  }

  // ============ 本次抓取内部去重 ============
  const uniqueNew = Array.from(
    new Map(allFundings.map((item) => [item.title, item])).values()
  );
  console.log(`\n🧹 本次抓取内部去重: ${allFundings.length} → ${uniqueNew.length} 条`);

  // ============ 读取历史数据 ============
  let existingData = [];
  try {
    const existingRaw = await readFile(OUT, "utf8");
    existingData = JSON.parse(existingRaw);
    console.log(`📂 读取到 ${existingData.length} 条历史数据`);
  } catch (e) {
    console.log("⚠️ 没有找到历史数据，将创建新文件");
  }

  // ============ 关键：只删除旧的好公益平台数据，保留其他类型 ============
  const otherData = existingData.filter(
    (item) => item.type !== "公益项目伙伴招募"
  );
  console.log(`🔍 保留其他类型数据: ${otherData.length} 条（删除了 ${existingData.length - otherData.length} 条旧好公益数据）`);

  // ============ 合并 ============
  const combinedData = [...otherData, ...uniqueNew];

  // 最终去重（防止标题冲突）
  const uniqueFundings = Array.from(
    new Map(combinedData.map((item) => [item.title, item])).values()
  );

  const finalData = uniqueFundings.map((item, idx) => ({
    ...item,
    id: `fund-merged-${idx + 1}`,
  }));

  await writeFile(OUT, JSON.stringify(finalData, null, 2) + "\n", "utf8");
  console.log(`\n📊 合并完成！共 ${finalData.length} 条数据`);
  console.log(`   其中：好公益平台 ${uniqueNew.length} 条，其他类型 ${otherData.length} 条`);
}

main();