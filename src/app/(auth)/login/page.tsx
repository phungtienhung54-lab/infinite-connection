import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";
import "@/app/platform.css";

export const metadata: Metadata = { title: "登录｜无限连接" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl = "/" } = await searchParams;
  const safeCallbackUrl = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  const session = await auth();
  if (session?.user) redirect(safeCallbackUrl);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>登录</h1>
        <p className="auth-subtitle">登录后参与发布与连接</p>
        <LoginForm callbackUrl={safeCallbackUrl} />
      </div>
    </main>
  );
}
