import { updates } from "@/lib/platform-data";
import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import Link from "next/link";
import "../../platform.css";

export default async function UpdateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = updates.find((u) => u.id === id);

  if (!item) {
    return (
      <div className="module-page">
        <SiteHeader active="updates" />
        <div className="detail-not-found">
          <h2>未找到该动态</h2>
          <Link href="/updates" className="card-link">
            ← 返回项目动态列表
          </Link>
        </div>
        <PlatformFooter />
      </div>
    );
  }

  return (
    <div className="module-page">
      <SiteHeader active="updates" />
      <div className="detail-wrapper">
        <div className="pc-card detail-card">
          <div className="detail-tags">
            <span className="tag tag-green">{item.field}</span>
            <span className="tag tag-rating">⭐ {item.rating.toFixed(1)}</span>
          </div>

          <h1 className="detail-title">{item.title}</h1>

          <div className="detail-meta">
            发布机构：{item.org} · {item.time} · {item.location}
          </div>

          <p className="detail-content">{item.content}</p>

          {item.hashtags.length > 0 && (
            <div className="detail-hashtags">
              {item.hashtags.map((h) => (
                <span key={h} className="hashtag">#{h}# </span>
              ))}
            </div>
          )}

          <div className="detail-stats">
            <span>👍 {item.likes}</span>
            <span>💬 {item.comments}</span>
            <span>↗ {item.shares}</span>
            <span>🤝 {item.helps}</span>
          </div>
        </div>
      </div>
      <PlatformFooter />
    </div>
  );
}