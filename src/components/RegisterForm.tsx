"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <form action={formAction} className="auth-form">
      {state.error && <p className="auth-error">{state.error}</p>}

      <label className="auth-field">
        <span>昵称</span>
        <input name="name" type="text" required autoComplete="name" placeholder="你的名字或昵称" />
        {state.fieldErrors?.name && (
          <small className="auth-field-error">{state.fieldErrors.name[0]}</small>
        )}
      </label>

      <label className="auth-field">
        <span>邮箱</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.org"
        />
        {state.fieldErrors?.email && (
          <small className="auth-field-error">{state.fieldErrors.email[0]}</small>
        )}
      </label>

      <label className="auth-field">
        <span>密码</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="至少 8 位，包含字母和数字"
        />
        {state.fieldErrors?.password && (
          <small className="auth-field-error">{state.fieldErrors.password[0]}</small>
        )}
      </label>

      <button className="btn-primary auth-submit" type="submit" disabled={pending}>
        {pending ? "注册中…" : "注册并登录"}
      </button>

      <p className="auth-switch">
        已有账号？<Link href="/login">直接登录</Link>
      </p>
    </form>
  );
}
