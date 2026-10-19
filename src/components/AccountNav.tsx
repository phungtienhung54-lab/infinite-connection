import Link from "next/link";

const items = [
  { href: "/account", label: "账号首页" },
  { href: "/account/content", label: "内容管理" },
  { href: "/account/notifications", label: "消息通知" },
  { href: "/account/profile", label: "账号资料" },
];

export function AccountNav({ active, admin }: { active: string; admin?: boolean }) {
  return (
    <aside className="account-nav pc-card">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={active === item.href ? "active" : ""}>
          {item.label}
        </Link>
      ))}
      {admin && <Link href="/admin/review">内容审核</Link>}
    </aside>
  );
}
