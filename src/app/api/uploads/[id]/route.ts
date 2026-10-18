import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createDownloadUrl } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { content: { select: { status: true } } },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });

  const canRead = attachment.content?.status === "PUBLISHED"
    || attachment.ownerId === session?.user?.id
    || session?.user?.role === "ADMIN";
  if (!canRead) return new NextResponse("Forbidden", { status: 403 });

  return NextResponse.redirect(await createDownloadUrl(attachment.objectKey));
}
