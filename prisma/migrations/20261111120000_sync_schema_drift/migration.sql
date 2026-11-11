-- Schema-drift catch-up migration.
--
-- The single previously-checked-in migration (20261028142014_fmdb) only
-- captures an early snapshot of schema.prisma. Several models/fields were
-- added to schema.prisma afterwards (the "Changed - Working Logic" branch
-- additions and the four "29 Oct 2026" passes) without ever generating a
-- matching migration. Prisma Client reads schema.prisma directly, so it
-- compiled and ran fine — but every query touching one of these missing
-- tables/columns throws at runtime (P2021 "table does not exist" / P2022
-- "column does not exist"). This migration is purely additive: it creates
-- exactly the tables/columns/indexes/constraints schema.prisma already
-- declares, so no existing data is touched or lost.

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'SENT', 'REVISION_REQUESTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "PaymentStage" AS ENUM ('ADVANCE_60', 'SECOND_25', 'FINAL_15');

-- CreateEnum
CREATE TYPE "MaterialApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentClaimStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RevisionRequestStatus" AS ENUM ('OPEN', 'ADDRESSED');

-- AlterTable: Project (Decision #5 supersede — 60% advance gate)
ALTER TABLE "Project" ADD COLUMN "advancePaymentVerifiedAt" TIMESTAMP(3);

-- AlterTable: Task (assignment/completion timestamps for client-visible delivery view)
ALTER TABLE "Task" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable: CostSheet (Cost Intelligence + MRP visibility additions)
ALTER TABLE "CostSheet" ADD COLUMN "markupPercent" DECIMAL(6,3);
ALTER TABLE "CostSheet" ADD COLUMN "recommendedSellingPrice" DECIMAL(14,4);
ALTER TABLE "CostSheet" ADD COLUMN "recommendedMrp" DECIMAL(14,2);
ALTER TABLE "CostSheet" ADD COLUMN "mrpPublishedAt" TIMESTAMP(3);

-- AlterTable: Invoice (fixed 60/25/15 payment-stage split)
ALTER TABLE "Invoice" ADD COLUMN "paymentStage" "PaymentStage";

-- AlterTable: Supplier (split free-text `contact` into two explicit fields;
-- `contact` itself is left in place rather than dropped, so no historical
-- data is destroyed by this migration — Prisma Client simply stops
-- selecting it since it's no longer in schema.prisma)
ALTER TABLE "Supplier" ADD COLUMN "contactPersonName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "contactPhone" TEXT;
UPDATE "Supplier" SET "contactPersonName" = "contact" WHERE "contact" IS NOT NULL AND "contactPersonName" IS NULL;

-- AlterTable: RawMaterial (lightweight stock monitoring + materials-approval workflow)
ALTER TABLE "RawMaterial" ADD COLUMN "stockOnHand" DECIMAL(14,4) NOT NULL DEFAULT 0;
ALTER TABLE "RawMaterial" ADD COLUMN "reorderThreshold" DECIMAL(14,4);
ALTER TABLE "RawMaterial" ADD COLUMN "approvalStatus" "MaterialApprovalStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "RawMaterial" ADD COLUMN "createdById" TEXT;
ALTER TABLE "RawMaterial" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "RawMaterial" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "RawMaterial" ADD COLUMN "rejectionReason" TEXT;

-- CreateTable: Proposal (CRM proposal/quotation workflow)
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "preparedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "sentAt" TIMESTAMP(3),
    "clientDecisionNotes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StockMovement
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "quantityDelta" DECIMAL(14,4) NOT NULL,
    "reason" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RawMaterialAttachment
CREATE TABLE "RawMaterialAttachment" (
    "id" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterialAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RevisionRequest
CREATE TABLE "RevisionRequest" (
    "id" TEXT NOT NULL,
    "formulationVersionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" "RevisionRequestStatus" NOT NULL DEFAULT 'OPEN',
    "addressedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addressedAt" TIMESTAMP(3),

    CONSTRAINT "RevisionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentClaim
CREATE TABLE "PaymentClaim" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "acknowledgementOrInvoiceNumber" TEXT NOT NULL,
    "status" "PaymentClaimStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "resultingPaymentId" TEXT,

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proposal_leadId_idx" ON "Proposal"("leadId");

-- CreateIndex
CREATE INDEX "Proposal_previousVersionId_idx" ON "Proposal"("previousVersionId");

-- CreateIndex
CREATE INDEX "StockMovement_rawMaterialId_idx" ON "StockMovement"("rawMaterialId");

-- CreateIndex
CREATE INDEX "RawMaterialAttachment_rawMaterialId_idx" ON "RawMaterialAttachment"("rawMaterialId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_idx" ON "Notification"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_recipientId_urgent_isRead_idx" ON "Notification"("recipientId", "urgent", "isRead");

-- CreateIndex
CREATE INDEX "Notification_projectId_idx" ON "Notification"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionRequest_addressedVersionId_key" ON "RevisionRequest"("addressedVersionId");

-- CreateIndex
CREATE INDEX "RevisionRequest_formulationVersionId_idx" ON "RevisionRequest"("formulationVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentClaim_resultingPaymentId_key" ON "PaymentClaim"("resultingPaymentId");

-- CreateIndex
CREATE INDEX "PaymentClaim_invoiceId_idx" ON "PaymentClaim"("invoiceId");

-- CreateIndex
CREATE INDEX "RawMaterial_approvalStatus_idx" ON "RawMaterial"("approvalStatus");

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialAttachment" ADD CONSTRAINT "RawMaterialAttachment_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialAttachment" ADD CONSTRAINT "RawMaterialAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_formulationVersionId_fkey" FOREIGN KEY ("formulationVersionId") REFERENCES "FormulationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionRequest" ADD CONSTRAINT "RevisionRequest_addressedVersionId_fkey" FOREIGN KEY ("addressedVersionId") REFERENCES "FormulationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_resultingPaymentId_fkey" FOREIGN KEY ("resultingPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
