## Task 5: Schema — Catalog domain

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_catalog/` (generated)

**Interfaces:**
- Consumes: `Vendor` from Task 4; `BrandType`, `ImportJobStatus` from Task 3.
- Produces: `Category`, `VehicleMake`, `VehicleModel`, `Vehicle`, `Brand`, `Product`, `PartNumber`, `ProductImage`, `ProductVehicleCompatibility`, `ProductImportJob`. Tasks 6–7 reference `Product.id` and `Vehicle.id`.

- [ ] **Step 1: Append the catalog models**

```prisma
model Category {
  id        String   @id @default(uuid()) @db.Uuid
  nameAr    String   @map("name_ar")
  nameEn    String   @map("name_en")
  parentId  String?  @map("parent_id") @db.Uuid
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  products Product[]

  @@index([parentId])
  @@map("categories")
}

model VehicleMake {
  id      String  @id @default(uuid()) @db.Uuid
  nameAr  String  @map("name_ar")
  nameEn  String  @map("name_en")
  logoUrl String? @map("logo_url")

  models   VehicleModel[]
  vehicles Vehicle[]

  @@map("vehicle_makes")
}

model VehicleModel {
  id     String @id @default(uuid()) @db.Uuid
  makeId String @map("make_id") @db.Uuid
  nameAr String @map("name_ar")
  nameEn String @map("name_en")

  make     VehicleMake @relation(fields: [makeId], references: [id], onDelete: Cascade)
  vehicles Vehicle[]

  @@index([makeId])
  @@map("vehicle_models")
}

model Vehicle {
  id      String  @id @default(uuid()) @db.Uuid
  makeId  String  @map("make_id") @db.Uuid
  modelId String  @map("model_id") @db.Uuid
  trim    String?
  year    Int     @db.SmallInt
  vin     String?

  make          VehicleMake                   @relation(fields: [makeId], references: [id])
  model         VehicleModel                  @relation(fields: [modelId], references: [id])
  compatibility ProductVehicleCompatibility[]
  rfqLineItems  RfqLineItem[]

  @@index([makeId, modelId, year])
  @@map("vehicles")
}

model Brand {
  id        String    @id @default(uuid()) @db.Uuid
  nameAr    String    @map("name_ar")
  nameEn    String    @map("name_en")
  brandType BrandType @map("brand_type")

  products Product[]

  @@map("brands")
}

model Product {
  id               String   @id @default(uuid()) @db.Uuid
  vendorId         String   @map("vendor_id") @db.Uuid
  categoryId       String   @map("category_id") @db.Uuid
  brandId          String?  @map("brand_id") @db.Uuid
  oemPartNumber    String?  @map("oem_part_number")
  nameAr           String   @map("name_ar")
  nameEn           String   @map("name_en")
  descriptionAr    String?  @map("description_ar")
  descriptionEn    String?  @map("description_en")
  exwPriceSar      Decimal? @map("exw_price_sar") @db.Decimal(10, 2)
  d2dPriceSar      Decimal? @map("d2d_price_sar") @db.Decimal(10, 2)
  stockQuantity    Int      @default(0) @map("stock_quantity")
  weightKg         Decimal? @map("weight_kg") @db.Decimal(10, 3)
  lengthCm         Decimal? @map("length_cm") @db.Decimal(10, 2)
  widthCm          Decimal? @map("width_cm") @db.Decimal(10, 2)
  heightCm         Decimal? @map("height_cm") @db.Decimal(10, 2)
  isActive         Boolean  @default(true) @map("is_active")
  qualityValidated Boolean  @default(false) @map("quality_validated")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  category      Category                      @relation(fields: [categoryId], references: [id])
  brand         Brand?                        @relation(fields: [brandId], references: [id])
  partNumbers   PartNumber[]
  images        ProductImage[]
  compatibility ProductVehicleCompatibility[]
  cartItems     CartItem[]
  rfqLineItems  RfqLineItem[]
  bidLineItems  BidLineItem[]
  poLineItems   PoLineItem[]

  @@index([vendorId, isActive])
  @@index([categoryId])
  @@index([oemPartNumber])
  @@map("products")
}

model PartNumber {
  id         String @id @default(uuid()) @db.Uuid
  productId  String @map("product_id") @db.Uuid
  partNumber String @map("part_number")
  source     String

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([partNumber])
  @@map("part_numbers")
}

model ProductImage {
  id        String   @id @default(uuid()) @db.Uuid
  productId String   @map("product_id") @db.Uuid
  imageUrl  String   @map("image_url")
  isHero    Boolean  @default(false) @map("is_hero")
  sortOrder Int      @default(0) @map("sort_order") @db.SmallInt
  createdAt DateTime @default(now()) @map("created_at")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@map("product_images")
}

model ProductVehicleCompatibility {
  id        String @id @default(uuid()) @db.Uuid
  productId String @map("product_id") @db.Uuid
  vehicleId String @map("vehicle_id") @db.Uuid

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  vehicle Vehicle @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  @@unique([productId, vehicleId])
  @@map("product_vehicle_compatibility")
}

model ProductImportJob {
  id             String          @id @default(uuid()) @db.Uuid
  vendorId       String          @map("vendor_id") @db.Uuid
  uploadedBy     String          @map("uploaded_by") @db.Uuid
  fileUrl        String          @map("file_url")
  status         ImportJobStatus @default(pending)
  totalRows      Int             @default(0) @map("total_rows")
  succeededRows  Int             @default(0) @map("succeeded_rows")
  failedRows     Int             @default(0) @map("failed_rows")
  errorReportUrl String?         @map("error_report_url")
  startedAt      DateTime?       @map("started_at")
  completedAt    DateTime?       @map("completed_at")
  createdAt      DateTime        @default(now()) @map("created_at")

  @@index([vendorId, status])
  @@map("product_import_jobs")
}
```

The `@@index([makeId, modelId, year])` on `Vehicle` exists specifically for the import resolver, which looks vehicles up by make + model + year on every row.

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name catalog
```

Expected: ten new tables. The `Product` model references `CartItem`, `RfqLineItem`, `BidLineItem`, and `PoLineItem`, which do not exist yet — **this will fail validation.** Remove those four back-relation lines from `Product` and the `rfqLineItems` line from `Vehicle` before migrating, then restore them in Task 6 Step 1 where their counterparts are defined.

- [ ] **Step 3: Verify**

Run: `npx prisma validate && npx tsc --noEmit`
Expected: "The schema is valid" and no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): add catalog domain

Indexes vehicles on (make_id, model_id, year) for the bulk import
resolver, which matches on exactly those three fields per row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

