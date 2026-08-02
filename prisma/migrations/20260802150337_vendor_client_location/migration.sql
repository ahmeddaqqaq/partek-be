-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name_ar" TEXT NOT NULL,
    "company_name_en" TEXT NOT NULL,
    "cr_number" TEXT NOT NULL,
    "vat_number" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "platform_fee_pct" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_documents" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "is_valid" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" UUID NOT NULL,
    "validated_by" UUID,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_locations" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,

    CONSTRAINT "vendor_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "company_name_ar" TEXT NOT NULL,
    "company_name_en" TEXT NOT NULL,
    "cr_number" TEXT NOT NULL,
    "vat_number" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_users" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_role" "OrgRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_locations" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,

    CONSTRAINT "client_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendors_cr_number_key" ON "vendors"("cr_number");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE INDEX "vendor_documents_vendor_id_idx" ON "vendor_documents"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_locations_vendor_id_location_id_key" ON "vendor_locations"("vendor_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_cr_number_key" ON "clients"("cr_number");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE UNIQUE INDEX "client_users_client_id_user_id_key" ON "client_users"("client_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_locations_client_id_location_id_key" ON "client_locations"("client_id", "location_id");

-- AddForeignKey
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_locations" ADD CONSTRAINT "vendor_locations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_locations" ADD CONSTRAINT "vendor_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_locations" ADD CONSTRAINT "client_locations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_locations" ADD CONSTRAINT "client_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
