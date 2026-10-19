import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { AccountNav } from "@/components/AccountNav";
import "@/app/platform.css";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const [counts, unread] = await Promise.all([
    prisma.content.groupBy({
      by: ["status"],
      where: { authorId: session.user.id },
      _count: true,
    }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);
  const count = Object.fromEntries(counts.map((item) => [item.status, item._count]));
  const isOrganization = session.user.accountType === "ORGANIZATION";

  return (
    <div className="module-page">
      <SiteHeader active="" />
      <main className="account-page">
        <AccountNav active="/account" admin={session.user.role === "ADMIN"} />
        <div className="account-main">
          <section className="account-hero pc-card">
            <span className="user-avatar">{(session.user.organizationName ?? session.user.name ?? "用").slice(0, 1)}</span>
            <div>
              <h1>{session.user.organizationName ?? session.user.name}</h1>
              <p>{isOrganization ? `机构用户 · ${session.user.organizationStatus === "VERIFIED" ? "已认证" : "认证资料审核中"}` : "个人用户"}</p>
            </div>
          </section>

          <section className="account-stats">
            <Link className="pc-card" href="/account/content?status=PUBLISHED"><b>{count.PUBLISHED ?? 0}</b><span>已发布</span></Link>
            <Link className="pc-card" href="/account/content?status=PENDING_REVIEW"><b>{count.PENDING_REVIEW ?? 0}</b><span>待审核</span></Link>
            <Link className="pc-card" href="/account/content?status=DRAFT"><b>{count.DRAFT ?? 0}</b><span>草稿</span></Link>
            <Link className="pc-card" href="/account/notifications"><b>{unread}</b><span>未读消息</span></Link>
          </section>

          <section className="pc-card account-section">
            <h2>发布内容</h2>
            <div className="publish-entry-grid">
              <Link href="/publish/updates">发布项目动态<span>机构和实名个人均可发布</span></Link>
              {isOrganization && <Link href="/publish/funding">发布资金与物资<span>仅限机构间资源合作</span></Link>}
              {isOrganization && <Link href="/publish/jobs">发布招聘岗位<span>提交后进入审核队列</span></Link>}
              <Link href="/publish/tools">发布能力工具<span>课程、模板、报告或经验</span></Link>
            </div>
          </section>
        </div>
      </main>
      <PlatformFooter />
    </div>
  );
}
