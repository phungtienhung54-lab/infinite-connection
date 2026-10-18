"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export function LoginForm({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {state.error && <p className="auth-error">{state.error}</p>}

      <label className="auth-field">
        <span>邮箱</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.org"
        />
      </label>

      <label className="auth-field">
        <span>密码</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="输入密码"
        />
      </label>

      <button className="btn-primary auth-submit" type="submit" disabled={pending}>
        {pending ? "登录中…" : "登录"}
      </button>

      <p className="auth-switch">
        还没有账号？<Link href="/register">免费注册</Link>
      </p>
    </form>
  );
}
