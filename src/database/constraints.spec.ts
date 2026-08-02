import { PrismaService } from './prisma.service';

describe('database constraints', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a product with neither price', async () => {
    const category = await prisma.category.create({
      data: { nameAr: 'فئة', nameEn: 'Category' },
    });

    await expect(
      prisma.product.create({
        data: {
          vendorId: crypto.randomUUID(),
          categoryId: category.id,
          nameAr: 'قطعة',
          nameEn: 'Part',
          stockQuantity: 1,
        },
      }),
    ).rejects.toThrow(/products_at_least_one_price/);
  });

  it('rejects a second hero image on the same product', async () => {
    const category = await prisma.category.create({
      data: { nameAr: 'فئة', nameEn: 'Category' },
    });
    const product = await prisma.product.create({
      data: {
        vendorId: crypto.randomUUID(),
        categoryId: category.id,
        nameAr: 'قطعة',
        nameEn: 'Part',
        exwPriceSar: '100.00',
        stockQuantity: 1,
      },
    });

    await prisma.productImage.create({
      data: { productId: product.id, imageUrl: 'a.jpg', isHero: true },
    });

    await expect(
      prisma.productImage.create({
        data: { productId: product.id, imageUrl: 'b.jpg', isHero: true },
      }),
    ).rejects.toThrow();
  });

  it('permits many non-hero images on the same product', async () => {
    const category = await prisma.category.create({
      data: { nameAr: 'فئة', nameEn: 'Category' },
    });
    const product = await prisma.product.create({
      data: {
        vendorId: crypto.randomUUID(),
        categoryId: category.id,
        nameAr: 'قطعة',
        nameEn: 'Part',
        d2dPriceSar: '120.00',
        stockQuantity: 1,
      },
    });

    await prisma.productImage.create({
      data: { productId: product.id, imageUrl: 'a.jpg', isHero: false },
    });
    await prisma.productImage.create({
      data: { productId: product.id, imageUrl: 'b.jpg', isHero: false },
    });

    const count = await prisma.productImage.count({
      where: { productId: product.id },
    });
    expect(count).toBe(2);
  });

  it('rejects UPDATE on audit_logs', async () => {
    const user = await prisma.user.create({
      data: {
        email: `audit-${crypto.randomUUID()}@partek.test`,
        passwordHash: 'x',
        role: 'admin',
      },
    });
    const log = await prisma.auditLog.create({
      data: {
        actorId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'created',
        ipAddress: '127.0.0.1',
      },
    });

    await expect(
      prisma.$executeRaw`UPDATE audit_logs SET action = 'tampered' WHERE id = ${log.id}::uuid`,
    ).rejects.toThrow(/append-only/);
  });

  it('rejects DELETE on audit_logs', async () => {
    const user = await prisma.user.create({
      data: {
        email: `audit-${crypto.randomUUID()}@partek.test`,
        passwordHash: 'x',
        role: 'admin',
      },
    });
    const log = await prisma.auditLog.create({
      data: {
        actorId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'created',
        ipAddress: '127.0.0.1',
      },
    });

    await expect(
      prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${log.id}::uuid`,
    ).rejects.toThrow(/append-only/);
  });

  it('rejects a direct purchase order with no cart', async () => {
    await expect(
      prisma.purchaseOrder.create({
        data: {
          poNumber: `PO-${crypto.randomUUID()}`,
          sourceType: 'direct',
          clientId: crypto.randomUUID(),
          vendorId: crypto.randomUUID(),
          createdBy: crypto.randomUUID(),
          selectedIncoterm: 'exw',
          totalAmountSar: '500.00',
        },
      }),
    ).rejects.toThrow(/purchase_orders_source_type_integrity/);
  });

  it('rejects an rfq purchase order carrying an rfq but no bid', async () => {
    await expect(
      prisma.purchaseOrder.create({
        data: {
          poNumber: `PO-${crypto.randomUUID()}`,
          sourceType: 'rfq',
          rfqId: crypto.randomUUID(),
          clientId: crypto.randomUUID(),
          vendorId: crypto.randomUUID(),
          createdBy: crypto.randomUUID(),
          selectedIncoterm: 'd2d',
          totalAmountSar: '500.00',
        },
      }),
    ).rejects.toThrow(/purchase_orders_source_type_integrity/);
  });

  it('permits a direct purchase order that carries a cart', async () => {
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${crypto.randomUUID()}`,
        sourceType: 'direct',
        cartId: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        vendorId: crypto.randomUUID(),
        createdBy: crypto.randomUUID(),
        selectedIncoterm: 'exw',
        totalAmountSar: '500.00',
      },
    });

    expect(po.id).toBeDefined();
  });

  it('rejects a vehicle whose model belongs to a different make', async () => {
    const toyota = await prisma.vehicleMake.create({
      data: { nameAr: 'تويوتا', nameEn: 'Toyota' },
    });
    const honda = await prisma.vehicleMake.create({
      data: { nameAr: 'هوندا', nameEn: 'Honda' },
    });
    const civic = await prisma.vehicleModel.create({
      data: { makeId: honda.id, nameAr: 'سيفيك', nameEn: 'Civic' },
    });

    await expect(
      prisma.vehicle.create({
        data: { makeId: toyota.id, modelId: civic.id, year: 2020 },
      }),
    ).rejects.toThrow(/vehicles_model_belongs_to_make/);
  });

  it('permits a vehicle whose model belongs to its make', async () => {
    const make = await prisma.vehicleMake.create({
      data: { nameAr: 'تويوتا', nameEn: 'Toyota' },
    });
    const model = await prisma.vehicleModel.create({
      data: { makeId: make.id, nameAr: 'كامري', nameEn: 'Camry' },
    });

    const vehicle = await prisma.vehicle.create({
      data: { makeId: make.id, modelId: model.id, year: 2020 },
    });

    expect(vehicle.id).toBeDefined();
  });
});
