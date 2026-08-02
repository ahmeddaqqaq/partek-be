import { Prisma } from '@prisma-client';

export class AuditAppendOnlyError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    super(
      `audit_logs is append-only: "${operation}" is not permitted. ` +
        'Audit entries are immutable by design.',
    );
    this.name = 'AuditAppendOnlyError';
    this.operation = operation;
  }
}

const FORBIDDEN = [
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
] as const;

export const auditAppendOnly = Prisma.defineExtension({
  name: 'auditAppendOnly',
  query: {
    auditLog: {
      $allOperations({ operation, args, query }) {
        if ((FORBIDDEN as readonly string[]).includes(operation)) {
          return Promise.reject(new AuditAppendOnlyError(operation));
        }
        return query(args);
      },
    },
  },
});
