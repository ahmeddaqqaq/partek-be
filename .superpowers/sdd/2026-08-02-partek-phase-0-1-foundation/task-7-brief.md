## Task 7: Schema — Order, payment, delivery, compliance, returns, audit, notifications

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_orders_through_notifications/` (generated)

**Interfaces:**
- Consumes: everything from Tasks 3–6.
- Produces: the remaining 15 models. After this task the schema is complete and `npx prisma validate` passes with no commented-out relations.

- [ ] **Step 1: Uncomment the deferred `poLineItems` relations**

Restore `poLineItems PoLineItem[]` on both `model Product` and `model BidLineItem`.

- [ ] **Step 2: Append the order and payment models**

```prisma
model PurchaseOrder {
  id               String       @id @default(uuid()) @db.Uuid
  poNumber         String       @unique @map("po_number")
  sourceType       PoSourceType @map("source_type")
  cartId           String?      @map("cart_id") @db.Uuid
  rfqId            String?      @map("rfq_id") @db.Uuid
  bidId            String?      @map("bid_id") @db.Uuid
  clientId         String       @map("client_id") @db.Uuid
  vendorId         String       @map("vendor_id") @db.Uuid
  createdBy        String       @map("created_by") @db.Uuid
  selectedIncoterm Incoterm     @map("selected_incoterm")
  totalAmountSar   Decimal      @map("total_amount_sar") @db.Decimal(12, 2)
  status           PoStatus     @default(pending)
  approvedBy       String?      @map("approved_by") @db.Uuid
  approvedAt       DateTime?    @map("approved_at")
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  lineItems     PoLineItem[]
  confirmations PoConfirmationSnapshot[]
  orders        Order[]

  @@index([clientId, status])
  @@index([vendorId, status])
  @@map("purchase_orders")
}

model PoLineItem {
  id            String  @id @default(uuid()) @db.Uuid
  poId          String  @map("po_id") @db.Uuid
  bidLineItemId String? @map("bid_line_item_id") @db.Uuid
  productId     String? @map("product_id") @db.Uuid
  description   String
  quantity      Int
  unitPriceSar  Decimal @map("unit_price_sar") @db.Decimal(10, 2)
  lineTotalSar  Decimal @map("line_total_sar") @db.Decimal(12, 2)

  purchaseOrder PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  bidLineItem   BidLineItem?  @relation(fields: [bidLineItemId], references: [id])
  product       Product?      @relation(fields: [productId], references: [id])

  @@index([poId])
  @@map("po_line_items")
}

model PoConfirmationSnapshot {
  id                    String   @id @default(uuid()) @db.Uuid
  poId                  String   @map("po_id") @db.Uuid
  bidAwardSnapshotId    String?  @map("bid_award_snapshot_id") @db.Uuid
  selectedIncoterm      Incoterm @map("selected_incoterm")
  totalAmountSar        Decimal  @map("total_amount_sar") @db.Decimal(12, 2)
  vatAmountSar          Decimal  @map("vat_amount_sar") @db.Decimal(10, 2)
  lineItemsJson         Json     @map("line_items_json")
  confirmedAt           DateTime @default(now()) @map("confirmed_at")
  confirmedBy           String   @map("confirmed_by") @db.Uuid

  purchaseOrder PurchaseOrder @relation(fields: [poId], references: [id])

  @@index([poId])
  @@map("po_confirmation_snapshots")
}

model Order {
  id                  String       @id @default(uuid()) @db.Uuid
  orderNumber         String       @unique @map("order_number")
  poId                String       @map("po_id") @db.Uuid
  vendorId            String       @map("vendor_id") @db.Uuid
  clientId            String       @map("client_id") @db.Uuid
  createdBy           String       @map("created_by") @db.Uuid
  sourceType          PoSourceType @map("source_type")
  selectedIncoterm    Incoterm     @map("selected_incoterm")
  status              OrderStatus  @default(pending)
  totalAmountSar      Decimal      @map("total_amount_sar") @db.Decimal(12, 2)
  platformFeeSar      Decimal      @map("platform_fee_sar") @db.Decimal(10, 2)
  netVendorAmountSar  Decimal      @map("net_vendor_amount_sar") @db.Decimal(12, 2)
  createdAt           DateTime     @default(now()) @map("created_at")
  updatedAt           DateTime     @updatedAt @map("updated_at")

  purchaseOrder  PurchaseOrder        @relation(fields: [poId], references: [id])
  statusHistory  OrderStatusHistory[]
  payments       Payment[]
  disbursements  VendorDisbursement[]
  deliveryTasks  DeliveryTask[]
  zatcaInvoices  ZatcaInvoice[]
  returnRequests ReturnRequest[]

  @@index([clientId, status])
  @@index([vendorId, status])
  @@map("orders")
}

model OrderStatusHistory {
  id             String      @id @default(uuid()) @db.Uuid
  orderId        String      @map("order_id") @db.Uuid
  previousStatus OrderStatus @map("previous_status")
  newStatus      OrderStatus @map("new_status")
  changedBy      String      @map("changed_by") @db.Uuid
  reason         String?
  changedAt      DateTime    @default(now()) @map("changed_at")

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, changedAt])
  @@map("order_status_history")
}

model Payment {
  id           String        @id @default(uuid()) @db.Uuid
  orderId      String        @map("order_id") @db.Uuid
  paymentType  PaymentType   @map("payment_type")
  amountSar    Decimal       @map("amount_sar") @db.Decimal(12, 2)
  pspReference String        @map("psp_reference")
  pspProvider  String        @map("psp_provider")
  status       PaymentStatus @default(initiated)
  failureCode  String?       @map("failure_code")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")

  order Order @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@map("payments")
}

model VendorDisbursement {
  id                String             @id @default(uuid()) @db.Uuid
  orderId           String             @map("order_id") @db.Uuid
  vendorId          String             @map("vendor_id") @db.Uuid
  grossAmountSar    Decimal            @map("gross_amount_sar") @db.Decimal(12, 2)
  platformFeeSar    Decimal            @map("platform_fee_sar") @db.Decimal(10, 2)
  platformFeePct    Decimal            @map("platform_fee_pct") @db.Decimal(5, 2)
  netAmountSar      Decimal            @map("net_amount_sar") @db.Decimal(12, 2)
  pspReference      String?            @map("psp_reference")
  status            DisbursementStatus @default(pending)
  settlementDueDate DateTime           @map("settlement_due_date")
  completedAt       DateTime?          @map("completed_at")
  createdAt         DateTime           @default(now()) @map("created_at")

  order    Order                 @relation(fields: [orderId], references: [id])
  invoices PlatformFeeInvoice[]

  @@index([vendorId, status])
  @@map("vendor_disbursements")
}

model PlatformFeeInvoice {
  id             String   @id @default(uuid()) @db.Uuid
  disbursementId String   @map("disbursement_id") @db.Uuid
  vendorId       String   @map("vendor_id") @db.Uuid
  feeAmountSar   Decimal  @map("fee_amount_sar") @db.Decimal(10, 2)
  vatOnFeeSar    Decimal  @map("vat_on_fee_sar") @db.Decimal(10, 2)
  zatcaInvoiceId String?  @map("zatca_invoice_id") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at")

  disbursement VendorDisbursement @relation(fields: [disbursementId], references: [id])
  zatcaInvoice ZatcaInvoice?      @relation(fields: [zatcaInvoiceId], references: [id])

  @@index([vendorId])
  @@map("platform_fee_invoices")
}
```

- [ ] **Step 3: Append the delivery, compliance, returns, audit, and notification models**

```prisma
model DeliveryAgent {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @unique @map("user_id") @db.Uuid
  carrierName String   @map("carrier_name")
  agentCode   String   @unique @map("agent_code")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")

  tasks           DeliveryTask[]
  proofOfDelivery ProofOfDelivery[]

  @@map("delivery_agents")
}

model DeliveryTask {
  id                String             @id @default(uuid()) @db.Uuid
  orderId           String             @map("order_id") @db.Uuid
  agentId           String?            @map("agent_id") @db.Uuid
  deliveryHash      String?            @unique @map("delivery_hash")
  carrierReference  String?            @map("carrier_reference")
  pickupAddress     String             @map("pickup_address")
  deliveryAddress   String             @map("delivery_address")
  itemManifest      Json               @map("item_manifest")
  status            DeliveryTaskStatus @default(assigned)
  assignedBy        String?            @map("assigned_by") @db.Uuid
  estimatedDelivery DateTime           @map("estimated_delivery")
  createdAt         DateTime           @default(now()) @map("created_at")
  updatedAt         DateTime           @updatedAt @map("updated_at")

  order Order            @relation(fields: [orderId], references: [id])
  agent DeliveryAgent?   @relation(fields: [agentId], references: [id])
  proof ProofOfDelivery[]

  @@index([agentId, status])
  @@index([orderId])
  @@map("delivery_tasks")
}

model ProofOfDelivery {
  id              String   @id @default(uuid()) @db.Uuid
  deliveryTaskId  String   @map("delivery_task_id") @db.Uuid
  agentId         String   @map("agent_id") @db.Uuid
  photoUrl        String   @map("photo_url")
  signatureUrl    String?  @map("signature_url")
  recipientName   String   @map("recipient_name")
  geolocationLat  Decimal? @map("geolocation_lat") @db.Decimal(10, 7)
  geolocationLng  Decimal? @map("geolocation_lng") @db.Decimal(10, 7)
  capturedAt      DateTime @default(now()) @map("captured_at")

  deliveryTask DeliveryTask  @relation(fields: [deliveryTaskId], references: [id], onDelete: Cascade)
  agent        DeliveryAgent @relation(fields: [agentId], references: [id])

  @@index([deliveryTaskId])
  @@map("proof_of_delivery")
}

model ZatcaInvoice {
  id                 String                @id @default(uuid()) @db.Uuid
  orderId            String                @map("order_id") @db.Uuid
  invoiceNumber      String                @unique @map("invoice_number")
  invoiceType        ZatcaInvoiceType      @map("invoice_type")
  totalAmountSar     Decimal               @map("total_amount_sar") @db.Decimal(12, 2)
  vatAmountSar       Decimal               @map("vat_amount_sar") @db.Decimal(10, 2)
  xmlDocumentUrl     String                @map("xml_document_url")
  cryptographicHash  String                @map("cryptographic_hash")
  zatcaReference     String?               @map("zatca_reference")
  submissionStatus   ZatcaSubmissionStatus @default(pending) @map("submission_status")
  failureCode        String?               @map("failure_code")
  submittedAt        DateTime?             @map("submitted_at")
  createdAt          DateTime              @default(now()) @map("created_at")

  order    Order                @relation(fields: [orderId], references: [id])
  feeInvoices PlatformFeeInvoice[]

  @@index([submissionStatus])
  @@map("zatca_invoices")
}

model ReturnRequest {
  id                String       @id @default(uuid()) @db.Uuid
  orderId           String       @map("order_id") @db.Uuid
  clientId          String       @map("client_id") @db.Uuid
  reasonCode        String       @map("reason_code")
  reasonDescription String       @map("reason_description")
  photoEvidenceUrl  String?      @map("photo_evidence_url")
  status            ReturnStatus @default(requested)
  mediatedBy        String?      @map("mediated_by") @db.Uuid
  resolutionNotes   String?      @map("resolution_notes")
  refundAmountSar   Decimal?     @map("refund_amount_sar") @db.Decimal(12, 2)
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")

  order Order @relation(fields: [orderId], references: [id])

  @@index([clientId, status])
  @@map("return_requests")
}

model AuditLog {
  id            String   @id @default(uuid()) @db.Uuid
  actorId       String   @map("actor_id") @db.Uuid
  entityType    String   @map("entity_type")
  entityId      String   @map("entity_id") @db.Uuid
  action        String
  previousState Json?    @map("previous_state")
  newState      Json?    @map("new_state")
  metadata      Json?
  ipAddress     String   @map("ip_address")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([entityType, entityId])
  @@index([actorId, createdAt])
  @@map("audit_logs")
}

model Notification {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @map("user_id") @db.Uuid
  notificationType String   @map("notification_type")
  titleAr          String   @map("title_ar")
  titleEn          String   @map("title_en")
  messageAr        String   @map("message_ar")
  messageEn        String   @map("message_en")
  entityType       String?  @map("entity_type")
  entityId         String?  @map("entity_id") @db.Uuid
  isRead           Boolean  @default(false) @map("is_read")
  createdAt        DateTime @default(now()) @map("created_at")

  @@index([userId, isRead, createdAt])
  @@map("notifications")
}
```

`AuditLog` has no `updatedAt` field, by design — an append-only table has nothing to update.

- [ ] **Step 4: Migrate**

```bash
npx prisma migrate dev --name orders_through_notifications
```

Expected: fifteen new tables, no validation errors, no remaining commented-out relations.

- [ ] **Step 5: Verify the full schema and count tables**

Run:
```bash
npx prisma validate
docker exec partek-db psql -U partek -d partek -c "\dt" | wc -l
```
Expected: "The schema is valid." and exactly 43 tables — the 42 models plus `_prisma_migrations`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add order, payment, delivery, compliance, returns, audit, notifications

Completes the schema. delivery_tasks.delivery_hash is nullable and
unique: the hash covers agent_id, which does not exist until an agent is
assigned, so it cannot be generated at task creation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

