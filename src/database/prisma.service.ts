import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma-client';
import { auditAppendOnly } from './extensions/audit-append-only.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * The audit-guarded client. Repositories that touch audit_logs MUST use
   * this rather than `this` directly — the base client bypasses the
   * append-only extension (the database trigger still catches it, but the
   * error is far less legible).
   */
  readonly audited: ReturnType<PrismaService['buildAudited']>;

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL as string,
      }),
    });
    this.audited = this.buildAudited();
  }

  private buildAudited() {
    return this.$extends(auditAppendOnly);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
