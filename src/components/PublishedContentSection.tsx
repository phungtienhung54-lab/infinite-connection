import Image from "next/image";
import type { ContentModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HelpContactButton } from "@/components/HelpContactButton";

export async function PublishedContentSection({ module }: { module: ContentModule }) {
  const contents = await prisma.content.findMany({
    where: { module, status: "PUBLISHED" },
    include: {
      author: { include: { organization: true } },
      attachments: { take: 3, orderBy: { createdAt: "asc" } },
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });
  if (contents.length === 0) return null;

  return (
    <section className="published-section">
      <header><h2>社区发布</h2><p>以下内容由用户提交并经平台审核后发布</p></header>
      <div className="published-content-list">
        {contents.map((content) => (
          <article key={content.id} className="pc-card published-content-card">
            <div className="card-head">
              <span className="tag tag-green">{content.subtype}</span>
              {content.fields.slice(0, 2).map((field) => <span key={field} className="tag tag-blue">{field}</span>)}
              <span className="spacer" />
              <time>{content.publishedAt?.toLocaleDateString("zh-CN")}</time>
            </div>
            <div className="feed-author">
              <span className="avatar av-green">{(content.author.organization?.name ?? content.author.name ?? "用").slice(0, 1)}</span>
              <div className="feed-author-text">
                <strong>{content.author.organization?.name ?? content.author.name}</strong>
                <span className="feed-sub">{content.author.accountType === "ORGANIZATION" ? "机构发布" : "个人公益"}</span>
              </div>
            </div>
            <h3>{content.title}</h3>
            {content.summary && <p className="preview-summary">{content.summary}</p>}
            <p className="published-body">{content.body}</p>
            {content.attachments.length > 0 && (
              <div className="published-images">
                {content.attachments.map((attachment) => (
                  <Image key={attachment.id} src={`/api/uploads/${attachment.id}`} width={320} height={200} unoptimized alt={attachment.fileName} />
                ))}
              </div>
            )}
            <div className="card-meta">📍 {[content.region, content.city].filter(Boolean).join(" · ") || "全国"}{content.tags.length > 0 && ` · ${content.tags.map((tag) => `#${tag}`).join(" ")}`}</div>
            {module === "UPDATE" && (
              <div className="feed-actions published-feed-actions">
                <span className="feed-action">↗ 分享</span>
                <span className="feed-action">💬 评论</span>
                <span className="feed-action">👍 点赞</span>
                <HelpContactButton contentId={content.id} />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
