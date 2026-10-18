"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { register, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);
  const [accountType, setAccountType] = useState<"PERSONAL" | "ORGANIZATION">("PERSONAL");

  return (
    <form action={formAction} className="auth-form">
      {state.error && <p className="auth-error">{state.error}</p>}

      <div className="account-type-tabs" role="group" aria-label="账号类型">
        <button
          type="button"
          className={accountType === "PERSONAL" ? "active" : ""}
          onClick={() => setAccountType("PERSONAL")}
        >
          个人用户
        </button>
        <button
          type="button"
          className={accountType === "ORGANIZATION" ? "active" : ""}
          onClick={() => setAccountType("ORGANIZATION")}
        >
          机构用户
        </button>
      </div>
      <input type="hidden" name="accountType" value={accountType} />

      <label className="auth-field">
        <span>昵称</span>
        <input name="name" type="text" required autoComplete="name" placeholder="你的名字或昵称" />
        {state.fieldErrors?.name && (
          <small className="auth-field-error">{state.fieldErrors.name[0]}</small>
        )}
      </label>

      {accountType === "ORGANIZATION" && (
        <div className="organization-register-fields">
          <label className="auth-field">
            <span>机构全称</span>
            <input name="organizationName" type="text" required placeholder="请输入登记证书上的机构名称" />
            {state.fieldErrors?.organizationName && (
              <small className="auth-field-error">{state.fieldErrors.organizationName[0]}</small>
            )}
          </label>
          <label className="auth-field">
            <span>机构类别</span>
            <select name="organizationCategory" required defaultValue="社会服务机构">
              {[
                "基金会",
                "慈善会",
                "社会服务机构",
                "社会团体",
                "企业",
                "其他",
              ].map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="auth-field">
            <span>统一社会信用代码</span>
            <input name="creditCode" type="text" maxLength={18} placeholder="18位，可稍后在认证中心补充" />
            {state.fieldErrors?.creditCode && (
              <small className="auth-field-error">{state.fieldErrors.creditCode[0]}</small>
            )}
          </label>
          <label className="auth-field">
            <span>联系人手机号</span>
            <input name="contactPhone" type="tel" placeholder="仅用于机构联系，不会公开" />
          </label>
        </div>
      )}

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
        {pending ? "注册中…" : accountType === "ORGANIZATION" ? "提交机构入驻" : "注册并登录"}
      </button>

      <p className="auth-switch">
        已有账号？<Link href="/login">直接登录</Link>
      </p>
    </form>
  );
}
