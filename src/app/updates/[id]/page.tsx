import Image from "next/image";
import { updates } from "@/lib/platform-data";
import { prisma } from "@/lib/db";
import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import Link from "next/link";
import "../../platform.css";

// 详情页同样读取数据库，避免发布后的动态点进去显示“未找到”。
export const dynamic = "force-dynamic";

function readMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function UpdateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const content = await prisma.content.findFirst({
    where: { id, module: "UPDATE", status: "PUBLISHED" },
    include: {
      author: { include: { organization: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (content) {
    const org = content.author.organization?.name ?? content.author.name ?? "公益伙伴";
    const publishedAt = content.publishedAt ?? content.createdAt;
    const metadata = readMetadata(content.metadata);
    const period = [metadata.periodStart, metadata.periodEnd]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" 至 ");

    return (
      <div className="module-page">
        <SiteHeader active="updates" />
        <div className="detail-wrapper">
          <div className="pc-card detail-card">
            <div className="detail-tags">
              {content.fields.map((field) => (
                <span key={field} className="tag tag-green">{field}</span>
              ))}
              <span className="tag tag-blue">{content.subtype}</span>
            </div>

            <h1 className="detail-title">{content.title}</h1>

            <div className="detail-meta">
              发布机构：{org} · {publishedAt.toLocaleDateString("zh-CN")} ·{" "}
              {[content.region, content.city].filter(Boolean).join(" · ") || "全国"}
            </div>

            {content.summary && <p className="preview-summary">{content.summary}</p>}
            <p className="detail-content">{content.body}</p>

            {content.attachments.length > 0 && (
              <div className="published-images">
                {content.attachments.map((attachment) => (
                  <Image
                    key={attachment.id}
                    src={`/api/uploads/${attachment.id}`}
                    width={640}
                    height={400}
                    unoptimized
                    alt={attachment.fileName}
                  />
                ))}
              </div>
            )}

            {content.tags.length > 0 && (
              <div className="detail-hashtags">
                {content.tags.map((tag) => (
                  <span key={tag} className="hashtag">#{tag}# </span>
                ))}
              </div>
            )}

            {period && <div className="detail-meta">项目期：{period}</div>}
          </div>
        </div>
        <PlatformFooter />
      </div>
    );
  }

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