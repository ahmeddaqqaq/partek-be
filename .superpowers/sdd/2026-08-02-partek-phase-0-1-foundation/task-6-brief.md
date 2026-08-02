## Task 6: Schema — Cart, RFQ, Bid, and snapshot domains

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_cart_rfq_bid/` (generated)

**Interfaces:**
- Consumes: `Client`, `ClientUser` from Task 4; `Product`, `Vehicle` from Task 5.
- Produces: `Cart`, `CartItem`, `Rfq`, `RfqLineItem`, `Bid`, `BidLineItem`, `BidAwardSnapshot`. Task 7 references `Bid.id` and `BidAwardSnapshot.id`.

- [ ] **Step 1: Restore the deferred back-relations from Task 5**

Add back to `model Product`:

```prisma
  cartItems     CartItem[]
  rfqLineItems  RfqLineItem[]
  bidLineItems  BidLineItem[]
  poLineItems   PoLineItem[]
```

Add back to `model Vehicle`:

```prisma
  rfqLineItems RfqLineItem[]
```

`PoLineItem` is defined in Task 7, so leave the `poLineItems` line commented out until then.

- [ ] **Step 2: Append the cart, RFQ, and bid models**

```prisma
model Cart {
  id           String     @id @default(uuid()) @db.Uuid
  clientId     String     @map("client_id") @db.Uuid
  clientUserId String     @map("client_user_id") @db.Uuid
  status       CartStatus @default(active)
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  items CartItem[]

  @@index([clientId, status])
  @@map("carts")
}

model CartItem {
  id                    String      @id @default(uuid()) @db.Uuid
  cartId                String      @map("cart_id") @db.Uuid
  productId             String      @map("product_id") @db.Uuid
  vendorId              String      @map("vendor_id") @db.Uuid
  quantity              Int
  selectedIncoterm      Incoterm    @map("selected_incoterm")
  unitPriceSnapshotSar  Decimal     @map("unit_price_snapshot_sar") @db.Decimal(10, 2)
  addedAt               DateTime    @default(now()) @map("added_at")
  priceLockedUntil      DateTime    @map("price_locked_until")
  isStale               Boolean     @default(false) @map("is_stale")
  stockStatus           StockStatus @default(in_stock) @map("stock_status")

  cart    Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])

  @@index([cartId])
  @@index([priceLockedUntil])
  @@map("cart_items")
}

model Rfq {
  id                   String    @id @default(uuid()) @db.Uuid
  clientId             String    @map("client_id") @db.Uuid
  createdBy            String    @map("created_by") @db.Uuid
  rfqNumber            String    @unique @map("rfq_number")
  preferredDeliveryDate DateTime @map("preferred_delivery_date")
  bidDeadline          DateTime  @map("bid_deadline")
  status               RfqStatus @default(draft)
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  lineItems RfqLineItem[]
  bids      Bid[]
  awards    BidAwardSnapshot[]

  @@index([status, bidDeadline])
  @@index([clientId])
  @@map("rfqs")
}

model RfqLineItem {
  id              String  @id @default(uuid()) @db.Uuid
  rfqId           String  @map("rfq_id") @db.Uuid
  vehicleId       String? @map("vehicle_id") @db.Uuid
  productId       String? @map("product_id") @db.Uuid
  partDescription String  @map("part_description")
  quantity        Int
  specifications  String?

  rfq          Rfq           @relation(fields: [rfqId], references: [id], onDelete: Cascade)
  vehicle      Vehicle?      @relation(fields: [vehicleId], references: [id])
  product      Product?      @relation(fields: [productId], references: [id])
  bidLineItems BidLineItem[]

  @@index([rfqId])
  @@map("rfq_line_items")
}

model Bid {
  id                    String    @id @default(uuid()) @db.Uuid
  rfqId                 String    @map("rfq_id") @db.Uuid
  vendorId              String    @map("vendor_id") @db.Uuid
  anonymousLabel        String    @map("anonymous_label")
  incoterm              Incoterm
  estimatedDeliveryDays Int       @map("estimated_delivery_days")
  notes                 String?
  status                BidStatus @default(submitted)
  submittedAt           DateTime  @default(now()) @map("submitted_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  rfq       Rfq                @relation(fields: [rfqId], references: [id], onDelete: Cascade)
  lineItems BidLineItem[]
  awards    BidAwardSnapshot[]

  @@unique([rfqId, vendorId])
  @@unique([rfqId, anonymousLabel])
  @@index([vendorId, status])
  @@map("bids")
}

model BidLineItem {
  id                String  @id @default(uuid()) @db.Uuid
  bidId             String  @map("bid_id") @db.Uuid
  rfqLineItemId     String  @map("rfq_line_item_id") @db.Uuid
  productId         String? @map("product_id") @db.Uuid
  exwUnitPriceSar   Decimal @map("exw_unit_price_sar") @db.Decimal(10, 2)
  d2dUnitPriceSar   Decimal @map("d2d_unit_price_sar") @db.Decimal(10, 2)
  quantityAvailable Int     @map("quantity_available")

  bid         Bid          @relation(fields: [bidId], references: [id], onDelete: Cascade)
  rfqLineItem RfqLineItem  @relation(fields: [rfqLineItemId], references: [id], onDelete: Cascade)
  product     Product?     @relation(fields: [productId], references: [id])
  poLineItems PoLineItem[]

  @@index([bidId])
  @@map("bid_line_items")
}

model BidAwardSnapshot {
  id               String   @id @default(uuid()) @db.Uuid
  bidId            String   @map("bid_id") @db.Uuid
  rfqId            String   @map("rfq_id") @db.Uuid
  clientId         String   @map("client_id") @db.Uuid
  vendorId         String   @map("vendor_id") @db.Uuid
  selectedIncoterm Incoterm @map("selected_incoterm")
  totalAmountSar   Decimal  @map("total_amount_sar") @db.Decimal(12, 2)
  lineItemsJson    Json     @map("line_items_json")
  awardedAt        DateTime @default(now()) @map("awarded_at")
  awardedBy        String   @map("awarded_by") @db.Uuid

  bid Bid @relation(fields: [bidId], references: [id])
  rfq Rfq @relation(fields: [rfqId], references: [id])

  @@index([rfqId])
  @@map("bid_award_snapshots")
}
```

Two unique constraints on `Bid` matter. `@@unique([rfqId, vendorId])` is the spec's third schema addition — one bid per vendor per RFQ, revised by update. `@@unique([rfqId, anonymousLabel])` is what makes the label allocator in Phase 3c safe under concurrency: two vendors racing to submit cannot both land "Supplier A".

`BidLineItem.poLineItems` references `PoLineItem` from Task 7 — comment it out until then, along with `Product.poLineItems`.

- [ ] **Step 3: Migrate**

```bash
npx prisma migrate dev --name cart_rfq_bid
```

Expected: seven new tables.

- [ ] **Step 4: Verify**

Run: `npx prisma validate && npx tsc --noEmit`
Expected: "The schema is valid", no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add cart, RFQ, bid, and award snapshot domains

Adds unique (rfq_id, vendor_id) so a vendor revises rather than
duplicates a bid, and unique (rfq_id, anonymous_label) so concurrent
submissions cannot collide on the same Supplier label.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

