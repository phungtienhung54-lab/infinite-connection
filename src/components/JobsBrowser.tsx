"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { filterGroups, type JobItem } from "@/lib/platform-data";
import scrapedJobs from "@/lib/jobs-scraped.json";
import { TypeTabs, FilterRow, SearchInput, EmptyState } from "./platform-ui";

const initialJobs = (scrapedJobs as unknown as JobItem[]).map((job) => ({
  ...job,
  id: String(job.id),
}));
type JobCategory = NonNullable<JobItem["category"]>;

const jobTabs = [{ label: "人员招聘" }, { label: "志愿者招募" }];

const scrapedJobStats = [
  { label: "当前收录岗位", value: String(initialJobs.length) },
  {
    label: "30天内新增",
    value: String(initialJobs.filter((job) => job.publishedDays <= 30).length),
  },
  { label: "收录机构", value: String(new Set(initialJobs.map((job) => job.org)).size) },
  {
    label: "线上/远程岗位",
    value: String(
      initialJobs.filter(
        (job) => job.location.includes("远程") || job.location.includes("线上"),
      ).length,
    ),
  },
];

const latestJobs = [...initialJobs]
  .sort((a, b) => a.publishedDays - b.publishedDays)
  .slice(0, 3);

const kindTagClass: Record<string, string> = {
  全职: "tag-green",
  兼职: "tag-orange",
  实习: "tag-blue",
  志愿者: "tag-blue",
};

function jobCategory(job: JobItem): JobCategory {
  return job.category ?? (job.kind === "志愿者" ? "志愿者招募" : "人员招聘");
}

function regionMatch(category: JobCategory, region: string, location: string): boolean {
  if ((category === "人员招聘" && region === "全国") || region === "全部") return true;
  if (region === "线上") return location.includes("线上") || location.includes("远程");
  const shortRegion = region.replace(/特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市$/, "");
  return location.includes(region) || location.includes(shortRegion);
}

export function JobsBrowser() {
  const [items] = useState<JobItem[]>(initialJobs);
  const [category, setCategory] = useState<JobCategory>("人员招聘");
  const [kind, setKind] = useState("全部");
  const [role, setRole] = useState("全部");
  const [servicePeriod, setServicePeriod] = useState("全部");
  const [region, setRegion] = useState("全国");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    return items
      .filter(
        (j) =>
          jobCategory(j) === category &&
          (category !== "人员招聘" || kind === "全部" || j.kind === kind) &&
          (role === "全部" || j.role === role) &&
          (category !== "志愿者招募" || servicePeriod === "全部" || j.servicePeriod === servicePeriod) &&
          regionMatch(category, region, j.location) &&
          (!q || j.title.includes(q) || j.org.includes(q) || j.summary.includes(q)),
      )
      .sort((a, b) => a.publishedDays - b.publishedDays);
  }, [items, category, kind, role, servicePeriod, region, search]);

  const resetFilters = (nextCategory = category) => {
    setKind("全部");
    setRole("全部");
    setServicePeriod("全部");
    setRegion(nextCategory === "人员招聘" ? "全国" : "全部");
    setSearch("");
  };

  const changeCategory = (next: string) => {
    const nextCategory = next as JobCategory;
    setCategory(nextCategory);
    resetFilters(nextCategory);
  };

  return (
    <div className="module-body">
      <div className="module-main">
        <div className="section-banner">
          <span className="banner-icon">💼</span>
          <div>
            <div className="banner-title">公益行业招聘</div>
            <div className="banner-sub">全职 / 兼职 / 实习岗位 · 需机构入驻审核</div>
          </div>
          <span style={{ flex: 1 }} />
          <Link className="btn-primary" href="/publish/jobs">
            ＋ 发布招聘
          </Link>
        </div>

        <TypeTabs tabs={jobTabs} active={category} onChange={changeCategory} />

        <div className="filter-panel">
          {category === "人员招聘" ? (
            <>
              <div className="pc-card filter-box">
                <FilterRow label="类型" options={filterGroups.jobKinds} active={kind} onChange={setKind} />
              </div>
              <div className="pc-card filter-box">
                <FilterRow label="职能" options={filterGroups.jobRoles} active={role} onChange={setRole} />
              </div>
              <div className="pc-card filter-box">
                <FilterRow label="地域" options={filterGroups.jobRegions} active={region} onChange={setRegion}>
                  <SearchInput value={search} onChange={setSearch} placeholder="搜索岗位关键词…" />
                </FilterRow>
              </div>
            </>
          ) : (
            <>
              <div className="pc-card filter-box">
                <FilterRow
                  label="服务周期"
                  options={filterGroups.volunteerPeriods}
                  active={servicePeriod}
                  onChange={setServicePeriod}
                />
              </div>
              <div className="pc-card filter-box">
                <FilterRow
                  label="服务领域"
                  options={filterGroups.volunteerFields}
                  active={role}
                  onChange={setRole}
                />
              </div>
              <div className="pc-card filter-box">
                <FilterRow
                  label="地域"
                  options={filterGroups.volunteerRegions}
                  active={region}
                  onChange={setRegion}
                >
                  <SearchInput value={search} onChange={setSearch} placeholder="搜索志愿服务关键词…" />
                </FilterRow>
              </div>
            </>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState onReset={() => resetFilters()} />
        ) : (
          <div className="card-grid-2">
            {filtered.map((j) => (
              <article key={j.id} className="pc-card content-card">
                <div className="card-head">
                  <span className={`tag ${kindTagClass[j.kind] ?? "tag-green"}`}>{j.kind}</span>
                  <span className="tag tag-pink">{j.role}</span>
                </div>
                <h3 className="card-title">{j.title}</h3>
                <p className="card-summary">{j.summary}</p>
                <div className="card-meta">
                  <span className="item">🏛 {j.org}</span>
                  <span className="item">📍 {j.location}</span>
                  <span className="item">💼 {j.salary}</span>
                  {j.sourceName && (
                    <span className="item">
                      📰 {j.sourceName}
                      {j.time ? ` · ${j.time}` : ""}
                    </span>
                  )}
                </div>
                <div className="card-foot">
                  <span className="stat">📅 {j.due}</span>
                  {j.url ? (
                    <a className="card-link" href={j.url} target="_blank" rel="noreferrer">
                      去原站投递 →
                    </a>
                  ) : (
                    <a className="card-link" href="#">
                      投递简历 →
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <aside className="module-aside">
        <div className="aside-card">
          <h2 className="aside-title">🆕 最新发布</h2>
          <ul className="urgent-list">
            {latestJobs.map((job) => (
              <li key={job.id}>
                {job.url ? (
                  <a className="u-title" href={job.url} target="_blank" rel="noreferrer">
                    {job.title}
                  </a>
                ) : (
                  <span className="u-title">{job.title}</span>
                )}
                <span className="u-org">
                  {job.org} · {job.location}
                </span>
                <span className="u-due">
                  {job.publishedDays === 0 ? "今天发布" : `${job.publishedDays}天前发布`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="aside-card">
          <h2 className="aside-title">📊 招聘数据</h2>
          <div className="stat-rows">
            {scrapedJobStats.map((s, i) => (
              <div key={s.label} className="stat-row">
                <span>{s.label}</span>
                <span className={`value sv-${i % 4}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

    </div>
  );
}
