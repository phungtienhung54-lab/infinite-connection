import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { approveContent, rejectContent } from "@/lib/actions/admin";
import { moduleLabel } from "@/lib/publishing";
import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import "@/app/platform.css";

export default async function ReviewPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") notFound();
  const contents = await prisma.content.findMany({ where: { status: "PENDING_REVIEW" }, include: { author: { include: { organization: true } }, attachments: true }, orderBy: { submittedAt: "asc" } });
  return (
    <div className="module-page">
      <SiteHeader active="" />
      <main className="review-page">
        <header><span className="home-eyebrow">管理后台</span><h1>内容审核</h1><p>共 {contents.length} 条待审核内容</p></header>
        {contents.length === 0 && <div className="pc-card account-empty">当前没有待审核内容。</div>}
        {contents.map((content) => (
          <article key={content.id} className="pc-card review-card">
            <div className="card-head"><span className="tag tag-green">{moduleLabel[content.module]}</span><span>{content.subtype}</span><span className="spacer" /><span>{content.author.organization?.name ?? content.author.name}</span></div>
            <h2>{content.title}</h2>
            {content.summary && <p className="preview-summary">{content.summary}</p>}
            <p className="preview-body">{content.body}</p>
            <div className="card-meta">{content.fields.join(" · ")} · {[content.region, content.city].filter(Boolean).join(" · ") || "全国"} · {content.attachments.length} 个附件</div>
            <div className="review-actions">
              <form action={approveContent.bind(null, content.id)}><button className="btn-primary" type="submit">审核通过并发布</button></form>
              <form action={rejectContent.bind(null, content.id)}><input name="reason" required placeholder="填写驳回原因" /><button type="submit" className="btn-ghost">驳回修改</button></form>
            </div>
          </article>
        ))}
      </main>
      <PlatformFooter />
    </div>
  );
}
