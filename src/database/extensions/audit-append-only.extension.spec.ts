import { PrismaService } from '../prisma.service';
import { AuditAppendOnlyError } from './audit-append-only.extension';

describe('auditAppendOnly extension', () => {
  let prisma: PrismaService;
  let actorId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `ext-${crypto.randomUUID()}@partek.test`,
        passwordHash: 'x',
        role: 'admin',
      },
    });
    actorId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const seedLog = () =>
    prisma.audited.auditLog.create({
      data: {
        actorId,
        entityType: 'User',
        entityId: actorId,
        action: 'created',
        ipAddress: '127.0.0.1',
      },
    });

  it('permits create', async () => {
    const log = await seedLog();
    expect(log.id).toBeDefined();
    expect(log.action).toBe('created');
  });

  it('permits findMany', async () => {
    await seedLog();
    const logs = await prisma.audited.auditLog.findMany({ where: { actorId } });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('throws on update', async () => {
    const log = await seedLog();
    await expect(
      prisma.audited.auditLog.update({
        where: { id: log.id },
        data: { action: 'tampered' },
      }),
    ).rejects.toThrow(AuditAppendOnlyError);
  });

  it('throws on delete', async () => {
    const log = await seedLog();
    await expect(
      prisma.audited.auditLog.delete({ where: { id: log.id } }),
    ).rejects.toThrow(AuditAppendOnlyError);
  });

  it('throws on updateMany, deleteMany, and upsert', async () => {
    await expect(
      prisma.audited.auditLog.updateMany({
        where: { actorId },
        data: { action: 'tampered' },
      }),
    ).rejects.toThrow(AuditAppendOnlyError);

    await expect(
      prisma.audited.auditLog.deleteMany({ where: { actorId } }),
    ).rejects.toThrow(AuditAppendOnlyError);

    await expect(
      prisma.audited.auditLog.upsert({
        where: { id: crypto.randomUUID() },
        create: {
          actorId,
          entityType: 'User',
          entityId: actorId,
          action: 'created',
          ipAddress: '127.0.0.1',
        },
        update: { action: 'tampered' },
      }),
    ).rejects.toThrow(AuditAppendOnlyError);
  });

  it('still blocks the base client, via the database trigger', async () => {
    // The extension only guards `prisma.audited`. Code reaching for the base
    // client skips it entirely -- this asserts the Task 8 trigger is a real
    // second layer rather than a claim, so a bypass fails loudly either way.
    const log = await seedLog();

    await expect(
      prisma.auditLog.update({
        where: { id: log.id },
        data: { action: 'tampered' },
      }),
    ).rejects.toThrow(/append-only/);

    await expect(
      prisma.auditLog.delete({ where: { id: log.id } }),
    ).rejects.toThrow(/append-only/);
  });

  it('leaves other models mutable', async () => {
    const category = await prisma.audited.category.create({
      data: { nameAr: 'فئة', nameEn: 'Category' },
    });
    const updated = await prisma.audited.category.update({
      where: { id: category.id },
      data: { nameEn: 'Renamed' },
    });
    expect(updated.nameEn).toBe('Renamed');
  });
});
