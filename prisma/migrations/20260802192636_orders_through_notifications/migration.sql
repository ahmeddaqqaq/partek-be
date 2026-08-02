-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "po_number" TEXT NOT NULL,
    "source_type" "PoSourceType" NOT NULL,
    "cart_id" UUID,
    "rfq_id" UUID,
    "bid_id" UUID,
    "client_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "selected_incoterm" "Incoterm" NOT NULL,
    "total_amount_sar" DECIMAL(12,2) NOT NULL,
    "status" "PoStatus" NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_line_items" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "bid_line_item_id" UUID,
    "product_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_sar" DECIMAL(10,2) NOT NULL,
    "line_total_sar" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "po_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_confirmation_snapshots" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "bid_award_snapshot_id" UUID,
    "selected_incoterm" "Incoterm" NOT NULL,
    "total_amount_sar" DECIMAL(12,2) NOT NULL,
    "vat_amount_sar" DECIMAL(10,2) NOT NULL,
    "line_items_json" JSONB NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_by" UUID NOT NULL,

    CONSTRAINT "po_confirmation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "po_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "source_type" "PoSourceType" NOT NULL,
    "selected_incoterm" "Incoterm" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "total_amount_sar" DECIMAL(12,2) NOT NULL,
    "platform_fee_sar" DECIMAL(10,2) NOT NULL,
    "net_vendor_amount_sar" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "previous_status" "OrderStatus" NOT NULL,
    "new_status" "OrderStatus" NOT NULL,
    "changed_by" UUID NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "amount_sar" DECIMAL(12,2) NOT NULL,
    "psp_reference" TEXT NOT NULL,
    "psp_provider" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'initiated',
    "failure_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_disbursements" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "gross_amount_sar" DECIMAL(12,2) NOT NULL,
    "platform_fee_sar" DECIMAL(10,2) NOT NULL,
    "platform_fee_pct" DECIMAL(5,2) NOT NULL,
    "net_amount_sar" DECIMAL(12,2) NOT NULL,
    "psp_reference" TEXT,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'pending',
    "settlement_due_date" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_fee_invoices" (
    "id" UUID NOT NULL,
    "disbursement_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "fee_amount_sar" DECIMAL(10,2) NOT NULL,
    "vat_on_fee_sar" DECIMAL(10,2) NOT NULL,
    "zatca_invoice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_fee_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_agents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "carrier_name" TEXT NOT NULL,
    "agent_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tasks" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "agent_id" UUID,
    "delivery_hash" TEXT,
    "carrier_reference" TEXT,
    "pickup_address" TEXT NOT NULL,
    "delivery_address" TEXT NOT NULL,
    "item_manifest" JSONB NOT NULL,
    "status" "DeliveryTaskStatus" NOT NULL DEFAULT 'assigned',
    "assigned_by" UUID,
    "estimated_delivery" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_delivery" (
    "id" UUID NOT NULL,
    "delivery_task_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "photo_url" TEXT NOT NULL,
    "signature_url" TEXT,
    "recipient_name" TEXT NOT NULL,
    "geolocation_lat" DECIMAL(10,7),
    "geolocation_lng" DECIMAL(10,7),
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zatca_invoices" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_type" "ZatcaInvoiceType" NOT NULL,
    "total_amount_sar" DECIMAL(12,2) NOT NULL,
    "vat_amount_sar" DECIMAL(10,2) NOT NULL,
    "xml_document_url" TEXT NOT NULL,
    "cryptographic_hash" TEXT NOT NULL,
    "zatca_reference" TEXT,
    "submission_status" "ZatcaSubmissionStatus" NOT NULL DEFAULT 'pending',
    "failure_code" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zatca_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason_description" TEXT NOT NULL,
    "photo_evidence_url" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'requested',
    "mediated_by" UUID,
    "resolution_notes" TEXT,
    "refund_amount_sar" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "previous_state" JSONB,
    "new_state" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "message_ar" TEXT NOT NULL,
    "message_en" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_client_id_status_idx" ON "purchase_orders"("client_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_vendor_id_status_idx" ON "purchase_orders"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "po_line_items_po_id_idx" ON "po_line_items"("po_id");

-- CreateIndex
CREATE INDEX "po_confirmation_snapshots_po_id_idx" ON "po_confirmation_snapshots"("po_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_client_id_status_idx" ON "orders"("client_id", "status");

-- CreateIndex
CREATE INDEX "orders_vendor_id_status_idx" ON "orders"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_changed_at_idx" ON "order_status_history"("order_id", "changed_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "vendor_disbursements_vendor_id_status_idx" ON "vendor_disbursements"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "platform_fee_invoices_vendor_id_idx" ON "platform_fee_invoices"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_agents_user_id_key" ON "delivery_agents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_agents_agent_code_key" ON "delivery_agents"("agent_code");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_tasks_delivery_hash_key" ON "delivery_tasks"("delivery_hash");

-- CreateIndex
CREATE INDEX "delivery_tasks_agent_id_status_idx" ON "delivery_tasks"("agent_id", "status");

-- CreateIndex
CREATE INDEX "delivery_tasks_order_id_idx" ON "delivery_tasks"("order_id");

-- CreateIndex
CREATE INDEX "proof_of_delivery_delivery_task_id_idx" ON "proof_of_delivery"("delivery_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "zatca_invoices_invoice_number_key" ON "zatca_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "zatca_invoices_submission_status_idx" ON "zatca_invoices"("submission_status");

-- CreateIndex
CREATE INDEX "return_requests_client_id_status_idx" ON "return_requests"("client_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_bid_line_item_id_fkey" FOREIGN KEY ("bid_line_item_id") REFERENCES "bid_line_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_confirmation_snapshots" ADD CONSTRAINT "po_confirmation_snapshots_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_disbursements" ADD CONSTRAINT "vendor_disbursements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_invoices" ADD CONSTRAINT "platform_fee_invoices_disbursement_id_fkey" FOREIGN KEY ("disbursement_id") REFERENCES "vendor_disbursements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_fee_invoices" ADD CONSTRAINT "platform_fee_invoices_zatca_invoice_id_fkey" FOREIGN KEY ("zatca_invoice_id") REFERENCES "zatca_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_delivery_task_id_fkey" FOREIGN KEY ("delivery_task_id") REFERENCES "delivery_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zatca_invoices" ADD CONSTRAINT "zatca_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
