"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { UpdateItem } from "@/lib/platform-data";
import {
  FilterRow,
  SearchInput,
  EmptyState,
} from "./platform-ui";
import { ContentActions } from "./ContentActions";


const sorts = [
  { key: "new", label: "最新发布" },
  { key: "rating", label: "评分最高" },
  { key: "hot", label: "互动最多" },
];

const fieldTagClass: Record<string, string> = {
  生态环保: "tag-green",
  乡村教育: "tag-blue",
  残障融合: "tag-orange",
  儿童保护: "tag-purple",
  老龄关怀: "tag-rose",
  医疗健康: "tag-red",
};

const avatarTones = ["av-green", "av-blue", "av-orange", "av-purple", "av-rose", "av-teal"];

function avatarTone(org: string): string {
  let h = 0;
  for (const ch of org) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return avatarTones[h % avatarTones.length];
}

export function UpdatesBrowser({
  items,
  fieldOptions: baseFieldOptions = [],
  regionOptions: baseRegionOptions = [],
}: {
  items: UpdateItem[];
  fieldOptions?: string[];
  regionOptions?: string[];
}) {
  // 右侧栏展示数据必须在组件内部写死，不引用 platform-data 中的示例热门项目。
  const platformStats = [
    { label: "在线项目", value: "0", tone: "green" },
    { label: "累计动态", value: "0", tone: "orange" },
    { label: "活跃机构", value: "0", tone: "blue" },
    { label: "参与用户", value: "0", tone: "purple" },
  ];

  const hotProjects = [
    { rank: 1, title: "测试-XXX基金会", meta: "互动 0 · 评分 0.0" },
    { rank: 2, title: "项目1", meta: "互动 0 · 评分 0.0" },
    { rank: 3, title: "项目2", meta: "互动 0 · 评分 0.0" },
    { rank: 4, title: "项目3", meta: "互动 0 · 评分 0.0" },
    { rank: 5, title: "项目4", meta: "互动 0 · 评分 0.0" },
  ];

  const [field, setField] = useState("全部");
  const [region, setRegion] = useState("全部");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("new");
  const [poster, setPoster] = useState<"全部" | "机构" | "个人">("全部");

  // 基础词表 + 数据库实际值合并：既完整平铺，也不遗漏内容里自定义的领域/地域。
  const fieldOptions = useMemo(
    () => Array.from(new Set([
      ...baseFieldOptions,
      ...items.flatMap((item) => (item.fields?.length ? item.fields : [item.field])).filter(Boolean),
    ])),
    [baseFieldOptions, items],
  );
  const regionOptions = useMemo(
    () => Array.from(new Set([
      ...baseRegionOptions,
      ...items.map((item) => item.region).filter(Boolean),
    ])),
    [baseRegionOptions, items],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    let list = items.filter(
      (u) =>
        (field === "全部" || (u.fields?.length ? u.fields.includes(field) : u.field === field)) &&
        (region === "全部" || u.region === region) &&
        (poster === "全部" || u.posterType === poster) &&
        (!q ||
          u.title.includes(q) ||
          u.org.includes(q) ||
          u.content.includes(q) ||
          u.hashtags.some((h) => h.includes(q))),
    );
    if (sort === "new") {
      // 数据库内容可能有较久之前发布的，这里只调整顺序，不做时间过滤，避免老内容被隐藏。
      list = [...list].sort((a, b) => a.publishedHours - b.publishedHours);
      return list;
    }
    const by = {
      rating: (a: UpdateItem, b: UpdateItem) => b.rating - a.rating,
      hot: (a: UpdateItem, b: UpdateItem) =>
        b.likes + b.comments + b.shares + b.helps
        - (a.likes + a.comments + a.shares + a.helps),
    }[sort];
    return [...list].sort(by);
  }, [items, field, region, search, sort, poster]);

  const resetFilters = () => {
    setField("全部");
    setRegion("全部");
    setSearch("");
    setPoster("全部");
  };

  return (
    <div className="module-body">
      <div className="module-main">
        <div className="filter-panel">
          <div className="pc-card filter-box">
            <FilterRow label="领域" options={fieldOptions} active={field} onChange={setField} />
          </div>
          <div className="pc-card filter-box">
            <FilterRow label="地域" options={regionOptions} active={region} onChange={setRegion} />
          </div>
          <div className="pc-card filter-box">
            <div className="filter-row">
              <span className="filter-label">筛选</span>
              <div className="feed-tabs" aria-label="动态排序与发布者筛选">
                {sorts.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={sort === item.key ? "active" : ""}
                    onClick={() => setSort(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={poster === "机构" ? "active" : ""}
                  onClick={() => setPoster(poster === "机构" ? "全部" : "机构")}
                >
                  只看组织
                </button>
                <button
                  type="button"
                  className={poster === "个人" ? "active" : ""}
                  onClick={() => setPoster(poster === "个人" ? "全部" : "个人")}
                >
                  只看个人
                </button>
                <SearchInput value={search} onChange={setSearch} placeholder="搜索项目名称、机构、关键词…" />
              </div>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <div className="feed-list">
            {filtered.map((u) => (
              <article key={u.id} className="pc-card feed-card">
                <div className="card-head">
                  {(u.fields?.length ? u.fields.slice(0, 2) : [u.field]).map((fieldTag, index) => (
                    <span key={`${fieldTag}-${index}`} className={`tag ${fieldTagClass[fieldTag] ?? "tag-green"}`}>
                      {fieldTag}
                    </span>
                  ))}
                  {u.rating > 0 && <span className="tag tag-rating">⭐ {u.rating.toFixed(1)}</span>}
                  <span className="spacer" />
                  <span className="card-time">{u.time}更新</span>
                </div>

                <div className="feed-author">
                  <span className={`avatar ${avatarTone(u.org)}`} aria-hidden="true">
                    {u.org.slice(0, 1)}
                  </span>
                  <div className="feed-author-text">
                    <span className="feed-org">
                      {u.org}
                      <span className="verified" title="已认证机构">✔</span>
                    </span>
                    <span className="feed-sub">
                      {u.time} · {u.source}
                    </span>
                  </div>
                </div>

                <h3 className="card-title">{u.title}</h3>
                <p className="feed-content">
                  {u.content}
                  {u.hashtags.map((h) => (
                    <span key={h} className="hashtag">
                      {" "}
                      #{h}#
                    </span>
                  ))}
                </p>

                {u.images && u.images.length > 0 ? (
                  <div className={`feed-images count-${Math.min(u.images.length, 3)}`}>
                    {u.images.map((image) => (
                      <Image
                        key={image.id}
                        src={`/api/uploads/${image.id}`}
                        width={800}
                        height={520}
                        unoptimized
                        alt={image.fileName}
                      />
                    ))}
                  </div>
                ) : u.media ? (
                  <div className={`feed-media cover-${u.media.tone}`}>
                    <span className="media-icon" aria-hidden="true">
                      {u.media.icon}
                    </span>
                    <span className="media-caption">{u.media.caption}</span>
                  </div>
                ) : null}

                <div className="card-meta feed-meta-row">
                  <span className="item">📍 {u.location}</span>
                  <span className="item">🕐 项目期：{u.period}</span>
                  <Link href={`/updates/${u.id}`} className="card-link">
                    进入项目主页 →
                  </Link>
                </div>

                <ContentActions
                  key={`${u.id}:${u.likes}:${u.isLiked}:${u.helps}:${u.isHelped}`}
                  contentId={u.id}
                  title={u.title}
                  text={u.content}
                  href={`/updates/${u.id}`}
                  likesCount={u.likes}
                  commentsCount={u.comments}
                  shares={u.shares}
                  helpsCount={u.helps}
                  isLiked={u.isLiked}
                  isHelped={u.isHelped}
                />
              </article>
            ))}
          </div>
        )}
      </div>

      <aside className="module-aside">
        <Link className="publish-btn" href="/publish/updates">
          ✏️ 我要发布
        </Link>

        <div className="aside-card">
          <h2 className="aside-title">📊 平台动态数据</h2>
          <div className="stats-grid">
            {platformStats.map((s) => (
              <div key={s.label} className={`stat-box tone-${s.tone}`}>
                <div className="value">{s.value}</div>
                <div className="label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="aside-card">
          <h2 className="aside-title">🔥 热门项目 TOP 5</h2>
          <ol className="hot-list">
            {hotProjects.map((p) => (
              <li key={p.rank}>
                <span className="rank-badge">{p.rank}</span>
                <div>
                  <div className="hot-title">{p.title}</div>
                  <div className="hot-meta">{p.meta}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>

    </div>
  );
}
