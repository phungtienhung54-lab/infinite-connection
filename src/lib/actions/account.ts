"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(30),
  bio: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  wechat: z.string().trim().max(50).optional(),
  organizationName: z.string().trim().max(100).optional(),
  organizationShortName: z.string().trim().max(30).optional(),
  website: z.string().trim().url().optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional(),
});

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    bio: formData.get("bio") || undefined,
    phone: formData.get("phone") || undefined,
    wechat: formData.get("wechat") || undefined,
    organizationName: formData.get("organizationName") || undefined,
    organizationShortName: formData.get("organizationShortName") || undefined,
    website: formData.get("website") ?? "",
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return;

  const value = parsed.data;
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: value.name,
      bio: value.bio || null,
      phone: value.phone || null,
      wechat: value.wechat || null,
      organization: session.user.accountType === "ORGANIZATION" && value.organizationName ? {
        update: {
          name: value.organizationName,
          shortName: value.organizationShortName || null,
          website: value.website || null,
          description: value.description || null,
          verificationStatus: "PENDING",
        },
      } : undefined,
    },
  });
  revalidatePath("/account");
  revalidatePath("/account/profile");
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user) return;
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/account/notifications");
}
