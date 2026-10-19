import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { markNotificationRead } from "@/lib/actions/account";
import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { AccountNav } from "@/components/AccountNav";
import "@/app/platform.css";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const notifications = await prisma.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="module-page">
      <SiteHeader active="" />
      <main className="account-page">
        <AccountNav active="/account/notifications" admin={session.user.role === "ADMIN"} />
        <section className="account-main pc-card account-section">
          <h1>消息通知</h1>
          <div className="notification-list">
            {notifications.length === 0 && <p className="account-empty">暂无消息。</p>}
            {notifications.map((item) => (
              <article key={item.id} className={item.readAt ? "" : "unread"}>
                <div><strong>{item.title}</strong><time>{item.createdAt.toLocaleString("zh-CN")}</time></div>
                <p>{item.message}</p>
                <div>{item.href && <Link href={item.href}>查看详情</Link>}{!item.readAt && <form action={markNotificationRead.bind(null, item.id)}><button type="submit">标记已读</button></form>}</div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
