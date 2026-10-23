// 基于 cn-division（民政部 2026 版数据）的省/市/区三级联动数据。
// pca.json 结构为 { 省: { 市: [区县...] } }；cn-division 只覆盖大陆 31 个省级行政区，
// 港澳台使用 data/hk-mo-tw.json 的本地快照补充（快照取自 china-division 2.7.0，MIT），
// 保证历史记录与选择器保持一致。
import pcaData from "cn-division/dist/no-code/pca.json";
import hkMoTwData from "@/lib/data/hk-mo-tw.json";

type DivisionTree = Record<string, Record<string, string[]>>;

const divisions: DivisionTree = {
  ...(pcaData as DivisionTree),
  ...(hkMoTwData as DivisionTree),
};

export const provinceNames = Object.keys(divisions);

// 旧版本数据用“市辖区 / 县 / 省直辖县级行政区划”占位表示不是真实城市，
// cn-division 已改用真实的市名，这里保留兼容历史记录中已保存的值。
const groupedCityNames = new Set([
  "市辖区",
  "县",
  "省直辖县级行政区划",
  "自治区直辖县级行政区划",
]);

export function getCities(province: string): string[] {
  return Object.keys(divisions[province] ?? {});
}

export function getAreas(province: string, city: string): string[] {
  return divisions[province]?.[city] ?? [];
}

export function isGroupedCity(city: string): boolean {
  return groupedCityNames.has(city);
}

/** 城市下拉展示名：重庆的“县”只是虚拟层级，展示为“重庆市辖县”。 */
export function cityDisplayName(province: string, city: string): string {
  if (city === "市辖区") return province;
  if (city === "县") return `${province}辖县`;
  return city;
}

/** 省直辖县级市（如海南定安县、新疆石河子市）没有下级，避免拼成“定安县 定安县”。 */
function isSelfCity(province: string, city: string): boolean {
  const areas = getAreas(province, city);
  return areas.length === 1 && areas[0] === city;
}

/** 把三级选择拼成提交给 city 字段的文本。 */
export function composeCity(province: string, city: string, district: string): string {
  if (!city) return district;
  if (isGroupedCity(city)) return district || cityDisplayName(province, city);
  // 直辖市与省同名，只保留区县，避免出现“北京市 北京市 东城区”。
  if (city === province) return district || province;
  if (isSelfCity(province, city)) return city;
  return [cityDisplayName(province, city), district].filter(Boolean).join(" ");
}

/** 从已有的 city 值反解出二级、三级选择，兼容旧数据只存城市名的情形。 */
export function resolveCityValue(province: string, value: string): { city: string; district: string } {
  if (!value) return { city: "", district: "" };
  const cities = getCities(province);
  for (const city of cities) {
    for (const prefix of new Set([city, cityDisplayName(province, city)])) {
      if (value === prefix) return { city, district: "" };
      if (value.startsWith(`${prefix} `)) {
        const rest = value.slice(prefix.length).trim();
        if (getAreas(province, city).includes(rest)) return { city, district: rest };
      }
    }
  }
  for (const city of cities) {
    if (getAreas(province, city).includes(value)) return { city, district: value };
  }
  return { city: "", district: "" };
}
