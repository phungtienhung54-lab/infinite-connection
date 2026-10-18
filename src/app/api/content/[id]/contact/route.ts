import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "请登录后查看联系方式" }, { status: 401 });
  }

  const { id } = await params;
  const content = await prisma.content.findFirst({
    where: { id, module: "UPDATE", status: "PUBLISHED" },
    select: { metadata: true },
  });
  if (!content) return NextResponse.json({ error: "内容不存在" }, { status: 404 });

  const metadata = content.metadata as Prisma.JsonObject;
  const phone = typeof metadata.contactPhone === "string" ? metadata.contactPhone : "";
  const wechat = typeof metadata.contactWechat === "string" ? metadata.contactWechat : "";
  if (!phone && !wechat) {
    return NextResponse.json({ error: "发布者暂未提供联系方式" }, { status: 404 });
  }

  return NextResponse.json({ phone, wechat });
}
