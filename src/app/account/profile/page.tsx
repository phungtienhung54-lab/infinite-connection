import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateProfile } from "@/lib/actions/account";
import { SiteHeader } from "@/components/SiteHeader";
import { PlatformFooter } from "@/components/PlatformFooter";
import { AccountNav } from "@/components/AccountNav";
import "@/app/platform.css";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, include: { organization: true } });
  return (
    <div className="module-page">
      <SiteHeader active="" />
      <main className="account-page">
        <AccountNav active="/account/profile" admin={session.user.role === "ADMIN"} />
        <section className="account-main pc-card account-section">
          <h1>{user.accountType === "ORGANIZATION" ? "机构资料与认证" : "个人资料"}</h1>
          <form action={updateProfile} className="profile-form">
            <label><span>显示名称</span><input name="name" required defaultValue={user.name ?? ""} /></label>
            <label><span>个人简介</span><textarea name="bio" rows={3} defaultValue={user.bio ?? ""} /></label>
            <label><span>联系电话</span><input name="phone" defaultValue={user.phone ?? ""} /><small>默认不公开</small></label>
            <label><span>微信号</span><input name="wechat" defaultValue={user.wechat ?? ""} /><small>默认不公开</small></label>
            {user.organization && <>
              <label><span>机构全称</span><input name="organizationName" required defaultValue={user.organization.name} /></label>
              <label><span>机构简称</span><input name="organizationShortName" defaultValue={user.organization.shortName ?? ""} /></label>
              <label><span>统一社会信用代码</span><input value={user.organization.creditCode ?? "未填写"} disabled /></label>
              <label><span>机构官网</span><input name="website" type="url" defaultValue={user.organization.website ?? ""} /></label>
              <label><span>机构简介</span><textarea name="description" rows={6} defaultValue={user.organization.description ?? ""} /></label>
              <p className="verification-notice">认证状态：{user.organization.verificationStatus === "VERIFIED" ? "已认证" : user.organization.verificationStatus === "REJECTED" ? "需补充资料" : "审核中"}。修改机构资料后将重新进入审核。</p>
            </>}
            <button className="btn-primary" type="submit">保存资料</button>
          </form>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
