"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";

export type AuthFormState = {
  error?: string;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    organizationName?: string[];
    organizationCategory?: string[];
    creditCode?: string[];
  };
};

const registerSchema = z.object({
  accountType: z.enum(["PERSONAL", "ORGANIZATION"]),
  name: z
    .string()
    .trim()
    .min(2, "昵称至少 2 个字符")
    .max(30, "昵称最多 30 个字符"),
  email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .regex(/[a-zA-Z]/, "密码需包含字母")
    .regex(/[0-9]/, "密码需包含数字"),
  organizationName: z.string().trim().optional(),
  organizationCategory: z.string().trim().optional(),
  creditCode: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
}).superRefine((value, context) => {
  if (value.accountType !== "ORGANIZATION") return;
  if (!value.organizationName || value.organizationName.length < 2) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["organizationName"],
      message: "请输入机构全称",
    });
  }
  if (!value.organizationCategory) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["organizationCategory"],
      message: "请选择机构类别",
    });
  }
  if (value.creditCode && !/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(value.creditCode.toUpperCase())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["creditCode"],
      message: "统一社会信用代码应为18位",
    });
  }
});

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    accountType: formData.get("accountType"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName") || undefined,
    organizationCategory: formData.get("organizationCategory") || undefined,
    creditCode: formData.get("creditCode") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const {
    accountType,
    name,
    email,
    password,
    organizationName,
    organizationCategory,
    creditCode,
    contactPhone,
  } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: ["该邮箱已注册，请直接登录"] } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      accountType,
      interests: [],
      organization: accountType === "ORGANIZATION" ? {
        create: {
          name: organizationName!,
          category: organizationCategory!,
          creditCode: creditCode?.toUpperCase() || null,
          contactName: name,
          contactPhone: contactPhone || null,
        },
      } : undefined,
      notifications: {
        create: {
          type: "SYSTEM",
          title: "欢迎加入无限连接",
          message: accountType === "ORGANIZATION"
            ? "机构账号已创建，请完善认证资料。"
            : "个人账号已创建，现在可以发布公益动态和能力内容。",
          href: "/account",
        },
      },
    },
  });

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    return { error: "注册成功，但自动登录失败，请手动登录" };
  }

  redirect("/account");
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const requestedCallbackUrl = String(formData.get("callbackUrl") ?? "/");
  const callbackUrl = requestedCallbackUrl.startsWith("/") && !requestedCallbackUrl.startsWith("//")
    ? requestedCallbackUrl
    : "/";

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "请输入邮箱和密码" };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "邮箱或密码不正确" };
    }
    throw error;
  }

  redirect(callbackUrl);
}

export async function logout() {
  const { signOut } = await import("@/auth");
  await signOut({ redirectTo: "/" });
}
