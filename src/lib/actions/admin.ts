"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { moduleHref } from "@/lib/publishing";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

export async function approveContent(contentId: string) {
  await requireAdmin();
  const now = new Date();
  const content = await prisma.$transaction(async (tx) => {
    const updated = await tx.content.updateMany({
      where: { id: contentId, status: "PENDING_REVIEW" },
      data: {
        status: "PUBLISHED",
        reviewedAt: now,
        publishedAt: now,
        rejectionReason: null,
      },
    });
    if (updated.count !== 1) throw new Error("内容不存在或已被处理");
    return tx.content.findUniqueOrThrow({ where: { id: contentId } });
  });
  await prisma.notification.create({
    data: {
      userId: content.authorId,
      type: "REVIEW_RESULT",
      title: "审核通过",
      message: `“${content.title}”已发布。`,
      href: moduleHref[content.module],
    },
  });
  revalidatePath("/admin/review");
  revalidatePath("/account/content");
  revalidatePath(moduleHref[content.module]);
}

export async function rejectContent(contentId: string, formData: FormData) {
  await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim() || "内容需要补充或修改";
  const content = await prisma.$transaction(async (tx) => {
    const updated = await tx.content.updateMany({
      where: { id: contentId, status: "PENDING_REVIEW" },
      data: { status: "REJECTED", reviewedAt: new Date(), rejectionReason: reason },
    });
    if (updated.count !== 1) throw new Error("内容不存在或已被处理");
    return tx.content.findUniqueOrThrow({ where: { id: contentId } });
  });
  await prisma.notification.create({
    data: {
      userId: content.authorId,
      type: "REVIEW_RESULT",
      title: "内容需要修改",
      message: `“${content.title}”未通过审核：${reason}`,
      href: "/account/content",
    },
  });
  revalidatePath("/admin/review");
  revalidatePath("/account/content");
}
