import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/RegisterForm";
import "@/app/platform.css";

export const metadata: Metadata = { title: "注册｜无限连接" };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>注册</h1>
        <p className="auth-subtitle">用邮箱创建账号，无需邮箱验证</p>
        <RegisterForm />
      </div>
    </main>
  );
}
