-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_makes" (
    "id" UUID NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "logo_url" TEXT,

    CONSTRAINT "vehicle_makes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_models" (
    "id" UUID NOT NULL,
    "make_id" UUID NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "make_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "trim" TEXT,
    "year" SMALLINT NOT NULL,
    "vin" TEXT,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "brand_type" "BrandType" NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "brand_id" UUID,
    "oem_part_number" TEXT,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "exw_price_sar" DECIMAL(10,2),
    "d2d_price_sar" DECIMAL(10,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "weight_kg" DECIMAL(10,3),
    "length_cm" DECIMAL(10,2),
    "width_cm" DECIMAL(10,2),
    "height_cm" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "quality_validated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_numbers" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "part_number" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "part_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_hero" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_vehicle_compatibility" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,

    CONSTRAINT "product_vehicle_compatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_import_jobs" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'pending',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "succeeded_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "error_report_url" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "vehicle_models_make_id_idx" ON "vehicle_models"("make_id");

-- CreateIndex
CREATE INDEX "vehicles_make_id_model_id_year_idx" ON "vehicles"("make_id", "model_id", "year");

-- CreateIndex
CREATE INDEX "products_vendor_id_is_active_idx" ON "products"("vendor_id", "is_active");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_oem_part_number_idx" ON "products"("oem_part_number");

-- CreateIndex
CREATE INDEX "part_numbers_part_number_idx" ON "part_numbers"("part_number");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_vehicle_compatibility_product_id_vehicle_id_key" ON "product_vehicle_compatibility"("product_id", "vehicle_id");

-- CreateIndex
CREATE INDEX "product_import_jobs_vendor_id_status_idx" ON "product_import_jobs"("vendor_id", "status");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "vehicle_makes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "vehicle_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_numbers" ADD CONSTRAINT "part_numbers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_vehicle_compatibility" ADD CONSTRAINT "product_vehicle_compatibility_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_vehicle_compatibility" ADD CONSTRAINT "product_vehicle_compatibility_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
