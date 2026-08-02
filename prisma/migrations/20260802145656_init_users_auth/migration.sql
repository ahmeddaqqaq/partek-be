-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'vendor', 'client', 'delivery_agent');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ar', 'en');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('pending', 'approved', 'rejected', 'info_required', 'suspended');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('submitter', 'approver', 'escalation_manager');

-- CreateEnum
CREATE TYPE "BrandType" AS ENUM ('oem', 'aftermarket');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('active', 'converted', 'abandoned');

-- CreateEnum
CREATE TYPE "Incoterm" AS ENUM ('exw', 'd2d');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('in_stock', 'out_of_stock');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('draft', 'open', 'closed', 'awarded', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('submitted', 'awarded', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "PoSourceType" AS ENUM ('rfq', 'direct');

-- CreateEnum
CREATE TYPE "PoStatus" AS ENUM ('pending', 'approved', 'rejected', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'preparing', 'ready_pickup', 'in_transit', 'delivered', 'completed', 'returned', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('collection', 'refund');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('initiated', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('pending', 'initiated', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "DeliveryTaskStatus" AS ENUM ('assigned', 'pickup_confirmed', 'in_transit', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "ZatcaInvoiceType" AS ENUM ('standard', 'credit_note');

-- CreateEnum
CREATE TYPE "ZatcaSubmissionStatus" AS ENUM ('pending', 'submitted', 'accepted', 'rejected', 'retry');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('requested', 'under_review', 'approved', 'rejected', 'pickup_scheduled', 'received', 'refunded');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "preferred_language" "Language" NOT NULL DEFAULT 'en',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
