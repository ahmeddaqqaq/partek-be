-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "client_user_id" UUID NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "selected_incoterm" "Incoterm" NOT NULL,
    "unit_price_snapshot_sar" DECIMAL(10,2) NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price_locked_until" TIMESTAMP(3) NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "stock_status" "StockStatus" NOT NULL DEFAULT 'in_stock',

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "rfq_number" TEXT NOT NULL,
    "preferred_delivery_date" TIMESTAMP(3) NOT NULL,
    "bid_deadline" TIMESTAMP(3) NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_line_items" (
    "id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "product_id" UUID,
    "part_description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "specifications" TEXT,

    CONSTRAINT "rfq_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "anonymous_label" TEXT NOT NULL,
    "incoterm" "Incoterm" NOT NULL,
    "estimated_delivery_days" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_line_items" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "rfq_line_item_id" UUID NOT NULL,
    "product_id" UUID,
    "exw_unit_price_sar" DECIMAL(10,2) NOT NULL,
    "d2d_unit_price_sar" DECIMAL(10,2) NOT NULL,
    "quantity_available" INTEGER NOT NULL,

    CONSTRAINT "bid_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_award_snapshots" (
    "id" UUID NOT NULL,
    "bid_id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "selected_incoterm" "Incoterm" NOT NULL,
    "total_amount_sar" DECIMAL(12,2) NOT NULL,
    "line_items_json" JSONB NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awarded_by" UUID NOT NULL,

    CONSTRAINT "bid_award_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carts_client_id_status_idx" ON "carts"("client_id", "status");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_price_locked_until_idx" ON "cart_items"("price_locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_rfq_number_key" ON "rfqs"("rfq_number");

-- CreateIndex
CREATE INDEX "rfqs_status_bid_deadline_idx" ON "rfqs"("status", "bid_deadline");

-- CreateIndex
CREATE INDEX "rfqs_client_id_idx" ON "rfqs"("client_id");

-- CreateIndex
CREATE INDEX "rfq_line_items_rfq_id_idx" ON "rfq_line_items"("rfq_id");

-- CreateIndex
CREATE INDEX "bids_vendor_id_status_idx" ON "bids"("vendor_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bids_rfq_id_vendor_id_key" ON "bids"("rfq_id", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_rfq_id_anonymous_label_key" ON "bids"("rfq_id", "anonymous_label");

-- CreateIndex
CREATE INDEX "bid_line_items_bid_id_idx" ON "bid_line_items"("bid_id");

-- CreateIndex
CREATE INDEX "bid_award_snapshots_rfq_id_idx" ON "bid_award_snapshots"("rfq_id");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_line_items" ADD CONSTRAINT "bid_line_items_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_line_items" ADD CONSTRAINT "bid_line_items_rfq_line_item_id_fkey" FOREIGN KEY ("rfq_line_item_id") REFERENCES "rfq_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_line_items" ADD CONSTRAINT "bid_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_award_snapshots" ADD CONSTRAINT "bid_award_snapshots_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_award_snapshots" ADD CONSTRAINT "bid_award_snapshots_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
