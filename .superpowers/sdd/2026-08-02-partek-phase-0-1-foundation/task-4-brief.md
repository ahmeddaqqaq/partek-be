## Task 4: Schema — Vendor, Client, and Location domains

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_vendor_client_location/` (generated)

**Interfaces:**
- Consumes: `User`, `VendorStatus`, `ClientStatus`, `OrgRole` from Task 3.
- Produces: `Vendor`, `Client`, `ClientUser`, `Location`, `DocumentType`, `VendorDocument`, and the two join models. Tasks 5–7 reference `Vendor.id`, `Client.id`, and `ClientUser.id`.

- [ ] **Step 1: Append the vendor, client, and location models**

```prisma
model Vendor {
  id              String       @id @default(uuid()) @db.Uuid
  userId          String       @map("user_id") @db.Uuid
  companyNameAr   String       @map("company_name_ar")
  companyNameEn   String       @map("company_name_en")
  crNumber        String       @unique @map("cr_number")
  vatNumber       String?      @map("vat_number")
  status          VendorStatus @default(pending)
  approvedBy      String?      @map("approved_by") @db.Uuid
  approvedAt      DateTime?    @map("approved_at")
  rejectionReason String?      @map("rejection_reason")
  platformFeePct  Decimal?     @map("platform_fee_pct") @db.Decimal(5, 2)
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  documents VendorDocument[]
  locations VendorLocation[]

  @@index([status])
  @@map("vendors")
}

model DocumentType {
  id         String  @id @default(uuid()) @db.Uuid
  nameAr     String  @map("name_ar")
  nameEn     String  @map("name_en")
  isRequired Boolean @default(false) @map("is_required")
  isActive   Boolean @default(true) @map("is_active")

  documents VendorDocument[]

  @@map("document_types")
}

model VendorDocument {
  id             String    @id @default(uuid()) @db.Uuid
  vendorId       String    @map("vendor_id") @db.Uuid
  documentTypeId String    @map("document_type_id") @db.Uuid
  fileUrl        String    @map("file_url")
  expiryDate     DateTime? @map("expiry_date")
  isValid        Boolean   @default(false) @map("is_valid")
  uploadedBy     String    @map("uploaded_by") @db.Uuid
  validatedBy    String?   @map("validated_by") @db.Uuid
  uploadedAt     DateTime  @default(now()) @map("uploaded_at")

  vendor       Vendor       @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  documentType DocumentType @relation(fields: [documentTypeId], references: [id])

  @@index([vendorId])
  @@map("vendor_documents")
}

model Location {
  id          String  @id @default(uuid()) @db.Uuid
  name        String
  addressLine String  @map("address_line")
  lat         Decimal @db.Decimal(10, 7)
  lng         Decimal @db.Decimal(10, 7)

  vendorLocations VendorLocation[]
  clientLocations ClientLocation[]

  @@map("locations")
}

model VendorLocation {
  id         String @id @default(uuid()) @db.Uuid
  vendorId   String @map("vendor_id") @db.Uuid
  locationId String @map("location_id") @db.Uuid

  vendor   Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  location Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([vendorId, locationId])
  @@map("vendor_locations")
}

model Client {
  id              String       @id @default(uuid()) @db.Uuid
  companyNameAr   String       @map("company_name_ar")
  companyNameEn   String       @map("company_name_en")
  crNumber        String       @unique @map("cr_number")
  vatNumber       String?      @map("vat_number")
  status          ClientStatus @default(pending)
  approvedBy      String?      @map("approved_by") @db.Uuid
  approvedAt      DateTime?    @map("approved_at")
  rejectionReason String?      @map("rejection_reason")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  clientUsers ClientUser[]
  locations   ClientLocation[]

  @@index([status])
  @@map("clients")
}

model ClientUser {
  id        String   @id @default(uuid()) @db.Uuid
  clientId  String   @map("client_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  orgRole   OrgRole  @map("org_role")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([clientId, userId])
  @@map("client_users")
}

model ClientLocation {
  id         String @id @default(uuid()) @db.Uuid
  clientId   String @map("client_id") @db.Uuid
  locationId String @map("location_id") @db.Uuid

  client   Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  location Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([clientId, locationId])
  @@map("client_locations")
}
```

`Vendor.userId`, `Vendor.approvedBy`, `VendorDocument.uploadedBy`, `VendorDocument.validatedBy`, `Client.approvedBy`, and `ClientUser.userId` are intentionally plain `@db.Uuid` columns rather than Prisma relations. Declaring six named back-relations on `User` for fields that are only ever read by ID adds noise to every `User` query for no benefit. Referential integrity for these is added as foreign keys in Task 8.

- [ ] **Step 2: Migrate**

```bash
npx prisma migrate dev --name vendor_client_location
```

Expected: nine new tables. No errors.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): add vendor, client, and location domains

Adds vendors.platform_fee_pct as the per-vendor override the
disbursement fee calculation needs; the source requirements gave
platform_fee_pct no origin.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

