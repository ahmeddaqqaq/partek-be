## Task 20: Deterministic development seed

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: the complete schema, `PasswordService` hashing conventions.
- Produces: four known accounts (one per role) that the e2e test in Task 21 and the whole of Phase 3 rely on, plus reference data.

- [ ] **Step 1: Write `prisma/seed.ts`**

```ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, BrandType } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

/** Shared across every seeded account. Development only. */
const SEED_PASSWORD = 'Partek!Dev2026';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const accounts = [
    { email: 'admin@partek.sa', role: UserRole.admin },
    { email: 'vendor@partek.sa', role: UserRole.vendor },
    { email: 'client@partek.sa', role: UserRole.client },
    { email: 'driver@partek.sa', role: UserRole.delivery_agent },
  ];

  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: { ...account, passwordHash, preferredLanguage: 'en' },
    });
  }

  const documentTypes = [
    { nameAr: 'السجل التجاري', nameEn: 'Commercial Registration', isRequired: true },
    { nameAr: 'شهادة ضريبة القيمة المضافة', nameEn: 'VAT Certificate', isRequired: true },
    { nameAr: 'رخصة البلدية', nameEn: 'Municipality License', isRequired: false },
    { nameAr: 'شهادة الآيبان', nameEn: 'IBAN Certificate', isRequired: true },
  ];
  for (const type of documentTypes) {
    const existing = await prisma.documentType.findFirst({
      where: { nameEn: type.nameEn },
    });
    if (!existing) await prisma.documentType.create({ data: type });
  }

  const categories = [
    { nameAr: 'المحرك', nameEn: 'Engine' },
    { nameAr: 'الفرامل', nameEn: 'Brakes' },
    { nameAr: 'التعليق', nameEn: 'Suspension' },
    { nameAr: 'الكهرباء', nameEn: 'Electrical' },
  ];
  for (const category of categories) {
    const existing = await prisma.category.findFirst({
      where: { nameEn: category.nameEn, parentId: null },
    });
    if (!existing) await prisma.category.create({ data: category });
  }

  const brands = [
    { nameAr: 'تويوتا الأصلية', nameEn: 'Toyota Genuine', brandType: BrandType.oem },
    { nameAr: 'بوش', nameEn: 'Bosch', brandType: BrandType.aftermarket },
    { nameAr: 'دينسو', nameEn: 'Denso', brandType: BrandType.aftermarket },
  ];
  for (const brand of brands) {
    const existing = await prisma.brand.findFirst({ where: { nameEn: brand.nameEn } });
    if (!existing) await prisma.brand.create({ data: brand });
  }

  const makes = [
    { nameAr: 'تويوتا', nameEn: 'Toyota', models: ['Hilux', 'Land Cruiser', 'Camry'] },
    { nameAr: 'نيسان', nameEn: 'Nissan', models: ['Patrol', 'Sunny'] },
    { nameAr: 'إيسوزو', nameEn: 'Isuzu', models: ['D-Max'] },
  ];
  for (const make of makes) {
    let record = await prisma.vehicleMake.findFirst({ where: { nameEn: make.nameEn } });
    record ??= await prisma.vehicleMake.create({
      data: { nameAr: make.nameAr, nameEn: make.nameEn },
    });

    for (const modelName of make.models) {
      let model = await prisma.vehicleModel.findFirst({
        where: { makeId: record.id, nameEn: modelName },
      });
      model ??= await prisma.vehicleModel.create({
        data: { makeId: record.id, nameAr: modelName, nameEn: modelName },
      });

      for (const year of [2022, 2023, 2024, 2025]) {
        const exists = await prisma.vehicle.findFirst({
          where: { makeId: record.id, modelId: model.id, year },
        });
        if (!exists) {
          await prisma.vehicle.create({
            data: { makeId: record.id, modelId: model.id, year },
          });
        }
      }
    }
  }

  const counts = {
    users: await prisma.user.count(),
    documentTypes: await prisma.documentType.count(),
    categories: await prisma.category.count(),
    brands: await prisma.brand.count(),
    vehicles: await prisma.vehicle.count(),
  };

  console.log('Seed complete:', counts);
  console.log(`All seeded accounts use the password: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Every insert is idempotent, so `npm run db:seed` can be re-run without duplicating rows. The production guard is there because `db:seed` against the wrong `DATABASE_URL` would otherwise create four known-password admin accounts in production.

- [ ] **Step 2: Run the seed**

```bash
npm run db:seed
```

Expected: `Seed complete: { users: 4, documentTypes: 4, categories: 4, brands: 3, vehicles: 24 }`.

- [ ] **Step 3: Verify idempotency**

```bash
npm run db:seed
```

Expected: identical counts. Any increase means an insert is not idempotent.

- [ ] **Step 4: Verify a seeded account can log in**

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@partek.sa","password":"Partek!Dev2026"}' | head -c 200
```

Expected: JSON containing `accessToken`, `refreshToken`, and a `user` object with `"role":"admin"` and no `passwordHash`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add idempotent development seed

Four known-role accounts plus reference data. Every insert is an upsert
or find-then-create so re-running never duplicates. Refuses to run when
NODE_ENV=production -- seeding the wrong DATABASE_URL would otherwise
create known-password admin accounts in production.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

