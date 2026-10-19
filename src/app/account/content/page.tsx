import { redirect } from "next/navigation";
import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deleteContent, restoreContent } from "@/lib/actions/content";
import { moduleLabel } from "@/lib/publishing";
import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { AccountNav } from "@/components/AccountNav";
import "@/app/platform.css";

const statusLabels: Record<ContentStatus, string> = {
  DRAFT: "草稿",
  PENDING_REVIEW: "待审核",
  PUBLISHED: "已发布",
  REJECTED: "已驳回",
  UNPUBLISHED: "已下架",
  DELETED: "已删除",
};
const editSlug = { UPDATE: "updates", FUNDING: "funding", JOB: "jobs", TOOL: "tools" } as const;

export default async function ContentManagementPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { status } = await searchParams;
  const allowed = Object.keys(statusLabels) as ContentStatus[];
  const activeStatus = allowed.includes(status as ContentStatus) ? status as ContentStatus : undefined;
  const contents = await prisma.content.findMany({
    where: { authorId: session.user.id, ...(activeStatus ? { status: activeStatus } : {}) },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="module-page">
      <SiteHeader active="" />
      <main className="account-page">
        <AccountNav active="/account/content" admin={session.user.role === "ADMIN"} />
        <section className="account-main pc-card account-section">
          <h1>内容管理</h1>
          <div className="content-status-tabs">
            <Link href="/account/content" className={!activeStatus ? "active" : ""}>全部</Link>
            {allowed.map((item) => <Link key={item} href={`/account/content?status=${item}`} className={activeStatus === item ? "active" : ""}>{statusLabels[item]}</Link>)}
          </div>
          <div className="managed-content-list">
            {contents.length === 0 && <p className="account-empty">这里还没有内容。</p>}
            {contents.map((content) => (
              <article key={content.id}>
                <div><span className="tag tag-green">{moduleLabel[content.module]}</span><span className={`status-badge status-${content.status.toLowerCase()}`}>{statusLabels[content.status]}</span></div>
                <h2>{content.title}</h2>
                <p>更新于 {content.updatedAt.toLocaleDateString("zh-CN")}</p>
                {content.rejectionReason && <p className="rejection-reason">审核意见：{content.rejectionReason}</p>}
                <div className="managed-actions">
                  {["DRAFT", "REJECTED"].includes(content.status) && <Link href={`/publish/${editSlug[content.module]}?id=${content.id}`}>继续编辑</Link>}
                  {content.status === "DELETED" ? (
                    <form action={restoreContent.bind(null, content.id)}><button type="submit">恢复</button></form>
                  ) : (
                    <form action={deleteContent.bind(null, content.id)}><button type="submit">删除</button></form>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
