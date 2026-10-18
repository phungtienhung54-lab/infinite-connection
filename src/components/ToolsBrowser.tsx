"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toolTabs, filterGroups } from "@/lib/platform-data";
import rawTools from "@/lib/tools-data.json";
import {
  TypeTabs,
  FilterRow,
  SearchInput,
  ListMeta,
  EmptyState,
} from "./platform-ui";

/* ---------- 原始数据 → ToolItem 适配 ---------- */

type RawTool = (typeof rawTools)[number];

type ToolItem = {
  id: string;
  category: string;
  field: string;
  forms: string[];
  duration: string;
  title: string;
  summary: string;
  tone: string;
  icon: string;
  priceTag: string;
  meta: string;
  price?: string;
  action: string;
  publishedDays: number;
  downloads: number;
  rating: number;
  url: string;
};

const TONE_MAP: Record<string, string> = {
  "#e8f5e9": "green",
  "#fdf6ec": "orange",
  "#e3f2fd": "blue",
  "#f3e5f5": "purple",
  "#fce4ec": "pink",
  "#e0f2f1": "teal",
  "#e8eaf6": "indigo",
};

function adapt(raw: RawTool): ToolItem {
  const metaParts = [raw.dateText, raw.locationText].filter(Boolean);
  return {
    id: String(raw.id),
    category: raw.category,
    field: raw.domain || "",
    forms: raw.format ? [raw.format] : [],
    duration: raw.period || "",
    title: raw.title,
    summary: raw.summary,
    tone: TONE_MAP[raw.color || ""] || "green",
    icon: raw.icon || "📦",
    priceTag: raw.isFree ? "免费" : "商业付费",
    meta: metaParts.join(" · "),
    price: raw.isFree ? "" : raw.priceText,
    action: raw.isFree ? "立即获取" : "立即报名",
    publishedDays: raw.publishedDays ?? 0,
    downloads: 0,
    rating: 5,
    url: raw.url,
  };
}

const tools: ToolItem[] = (rawTools as RawTool[]).map(adapt);

/* ---------- 排序选项 ---------- */

const sorts = [
  { key: "new", label: "最新发布" },
  { key: "downloads", label: "下载最多" },
  { key: "rating", label: "评分最高" },
];

/* ---------- 各栏目筛选配置 ---------- */

const defaultFilters = {
  fields: filterGroups.toolFields,
  forms: filterGroups.toolForms,
  showDuration: false,
};

const tabFilters: Record<string, { fields: string[]; forms: string[]; showDuration: boolean }> = {
  培训课程: { ...defaultFilters, showDuration: true },
  行业沙龙会议: {
    fields: filterGroups.toolSalonFields,
    forms: filterGroups.toolSalonForms,
    showDuration: false,
  },
};

/* ---------- 组件 ---------- */

export function ToolsBrowser() {
  const [tab, setTab] = useState("全部");
  const [field, setField] = useState("全部");
  const [form, setForm] = useState("全部");
  const [duration, setDuration] = useState("全部");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("new");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  const filters = tabFilters[tab] ?? defaultFilters;

  const filtered = useMemo(() => {
    const q = search.trim();
    const list = tools.filter(
      (t) =>
        (tab === "全部" || t.category === tab) &&
        (field === "全部" || t.field === field) &&
        (form === "全部" || t.forms.includes(form)) &&
        (duration === "全部" || t.duration === duration) &&
        (!q || t.title.includes(q) || t.summary.includes(q)),
    );
    const by = {
      new: (a: ToolItem, b: ToolItem) => a.publishedDays - b.publishedDays,
      downloads: (a: ToolItem, b: ToolItem) => b.downloads - a.downloads,
      rating: (a: ToolItem, b: ToolItem) => b.rating - a.rating,
    }[sort];
    return [...list].sort(by);
  }, [tab, field, form, duration, search, sort]);

  const toggle = (
    set: Set<string>,
    setSet: (s: Set<string>) => void,
    id: string,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  };

  const resetFilters = () => {
    setTab("全部");
    setField("全部");
    setForm("全部");
    setDuration("全部");
    setSearch("");
  };

  const changeTab = (next: string) => {
    setTab(next);
    setField("全部");
    setForm("全部");
    setDuration("全部");
  };

  return (
    <div className="module-body full">
      <div className="module-main">
        <div className="section-banner publish-section-banner">
          <div><div className="banner-title">公益能力资源</div><div className="banner-sub">分享课程、模板、报告与同行经验</div></div>
          <span style={{ flex: 1 }} />
          <Link className="btn-primary" href="/publish/tools">＋ 发布能力内容</Link>
        </div>
        <TypeTabs
          tabs={toolTabs.map((t) => {
            const count =
              t.label === "全部"
                ? tools.length
                : tools.filter((x) => x.category === t.label).length;
            return { ...t, count: String(count) };
          })}
          active={tab}
          onChange={changeTab}
        />

        <div className="filter-panel">
          <div className="pc-card filter-box">
            <FilterRow
              label="领域"
              options={filters.fields}
              active={field}
              onChange={setField}
            />
          </div>
          <div className="pc-card filter-box">
            <FilterRow
              label="形式"
              options={filters.forms}
              active={form}
              onChange={setForm}
            >
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="搜索工具、文章、报告…"
              />
            </FilterRow>
          </div>
          {filters.showDuration && (
            <div className="pc-card filter-box">
              <FilterRow
                label="学习周期"
                options={filterGroups.toolDurations}
                active={duration}
                onChange={setDuration}
              />
            </div>
          )}
        </div>

        <ListMeta
          total={tools.length}
          unit="件能力工具"
          shown={filtered.length}
          sorts={sorts}
          activeSort={sort}
          onSort={setSort}
        />

        {filtered.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <div className="card-grid-3">
            {filtered.map((t) => (
              <article key={t.id} className="pc-card tool-card">
                <div className={`tool-cover cover-${t.tone}`}>
                  <span aria-hidden="true">{t.icon}</span>
                </div>
                <div className="tool-body">
                  <div className="card-head">
                    <span className="tag tag-green">{t.category}</span>
                    <span
                      className={`tag ${
                        t.priceTag === "免费" ? "tag-green" : "tag-pink"
                      }`}
                    >
                      {t.priceTag === "免费"
                        ? "🆓 免费"
                        : `💴 ${t.priceTag}`}
                    </span>
                  </div>
                  <h3 className="card-title">{t.title}</h3>
                  {t.meta && <div className="tool-meta">{t.meta}</div>}
                  <p className="card-summary">{t.summary}</p>
                  <div className="tool-foot">
                    <button
                      className={`tool-action${t.price ? "" : " outline"}`}
                      type="button"
                      onClick={() => toggle(downloaded, setDownloaded, t.id)}
                    >
                      {downloaded.has(t.id) && t.action.includes("下载")
                        ? "✓ 已下载"
                        : t.action}
                    </button>
                    {t.price ? (
                      <span className="tool-extra">{t.price}</span>
                    ) : (
                      <button
                        type="button"
                        className={`tool-fav${favs.has(t.id) ? " active" : ""}`}
                        onClick={() => toggle(favs, setFavs, t.id)}
                      >
                        {favs.has(t.id) ? "★ 已收藏" : "⭐ 收藏"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
