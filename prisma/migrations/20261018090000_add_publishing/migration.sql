-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'ORGANIZATION');
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "ContentModule" AS ENUM ('UPDATE', 'FUNDING', 'JOB', 'TOOL');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED', 'DELETED');
CREATE TYPE "NotificationType" AS ENUM ('REVIEW_RESULT', 'CONTACT_REQUEST', 'VERIFICATION', 'COMMENT', 'SUBSCRIPTION', 'SYSTEM');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'PERSONAL',
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "category" TEXT NOT NULL,
  "creditCode" TEXT,
  "legalRepresentative" TEXT,
  "establishedAt" TIMESTAMP(3),
  "contactName" TEXT,
  "contactPhone" TEXT,
  "registrationRegion" TEXT,
  "website" TEXT,
  "description" TEXT,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "officialRating" TEXT,
  "certificateKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Content" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "module" "ContentModule" NOT NULL,
  "subtype" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "body" TEXT NOT NULL,
  "fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "region" TEXT,
  "city" TEXT,
  "metadata" JSONB NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "contentId" TEXT,
  "objectKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_userId_key" ON "Organization"("userId");
CREATE UNIQUE INDEX "Organization_creditCode_key" ON "Organization"("creditCode");
CREATE INDEX "Content_authorId_status_idx" ON "Content"("authorId", "status");
CREATE INDEX "Content_module_status_publishedAt_idx" ON "Content"("module", "status", "publishedAt");
CREATE UNIQUE INDEX "Attachment_objectKey_key" ON "Attachment"("objectKey");
CREATE INDEX "Attachment_ownerId_createdAt_idx" ON "Attachment"("ownerId", "createdAt");
CREATE INDEX "Attachment_contentId_idx" ON "Attachment"("contentId");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Content" ADD CONSTRAINT "Content_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
