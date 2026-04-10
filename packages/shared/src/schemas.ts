import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.string().min(1),
});

// ─── Entity ──────────────────────────────────────────────────────────────────

export const createEntitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['COMPANY', 'PERSON', 'FIRM', 'THIRD_PARTY']),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

export const updateEntitySchema = createEntitySchema.partial();

// ─── Ownership ───────────────────────────────────────────────────────────────

export const createOwnershipSchema = z.object({
  entityId: z.string().uuid(),
  ownerId: z.string().uuid(),
  percentage: z.number().int().min(1).max(10000),
  validFrom: z.string().datetime().optional(),
});

export const updateOwnershipSchema = createOwnershipSchema.partial();

// ─── Account ─────────────────────────────────────────────────────────────────

export const createAccountSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1),
  path: z.string().min(1),
  type: z.enum(['CASH', 'BANK', 'RECEIVABLE', 'PAYABLE', 'EQUITY', 'REVENUE', 'EXPENSE']),
  currency: z.enum(['ARS', 'USD']),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  bankName: z.string().optional(),
  bankAccountNum: z.string().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

// ─── Period ──────────────────────────────────────────────────────────────────

export const closePeriodSchema = z.object({
  closingNotes: z.string().optional(),
});

// ─── Ledger / Transaction ────────────────────────────────────────────────────

const transactionEntrySchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(['DEBIT', 'CREDIT']),
  amount: z.string().min(1),
  description: z.string().optional(),
});

export const createTransactionSchema = z.object({
  periodId: z.string().uuid(),
  description: z.string().min(1),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'BANK_FEE', 'ADJUSTMENT']),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']).optional(),
  checkNumber: z.string().optional(),
  bankReference: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
  entries: z.array(transactionEntrySchema).min(2),
});

export const reverseTransactionSchema = z.object({
  reason: z.string().min(1),
});

// ─── Property ────────────────────────────────────────────────────────────────

export const createPropertySchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

// ─── Lease ───────────────────────────────────────────────────────────────────

export const createLeaseSchema = z.object({
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  currency: z.enum(['ARS', 'USD']),
  baseAmount: z.string().min(1),
  managedBy: z.enum(['DIRECT', 'THIRD_PARTY']).optional(),
  thirdPartyEntityId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateLeaseSchema = createLeaseSchema.partial();

// ─── Lease Price ─────────────────────────────────────────────────────────────

export const createLeasePriceSchema = z.object({
  leaseId: z.string().uuid(),
  amount: z.string().min(1),
  validFrom: z.string().datetime(),
});

// ─── Invoice ─────────────────────────────────────────────────────────────────

const retentionSchema = z.object({
  concept: z.string().min(1),
  amount: z.string().min(1),
  notes: z.string().optional(),
});

export const createInvoiceSchema = z.object({
  leaseId: z.string().uuid(),
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2000),
  baseAmount: z.string().min(1),
  vatAmount: z.string().optional(),
  retentions: z.array(retentionSchema).optional(),
  notes: z.string().optional(),
});

export const collectInvoiceSchema = z.object({
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
  checkNumber: z.string().optional(),
  bankReference: z.string().optional(),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
  notes: z.string().optional(),
});

// ─── Settlement ──────────────────────────────────────────────────────────────

export const createSettlementSchema = z.object({
  entityId: z.string().uuid(),
  periodFrom: z.string().datetime(),
  periodTo: z.string().datetime(),
  currency: z.enum(['ARS', 'USD']),
  notes: z.string().optional(),
});

export const approveSettlementSchema = z.object({});

// ─── Reconciliation ─────────────────────────────────────────────────────────

export const createReconciliationSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string().datetime(),
  bankBalance: z.string().min(1),
  notes: z.string().optional(),
});

export const createReconciliationItemSchema = z.object({
  description: z.string().min(1),
  bankAmount: z.string().min(1),
  externalRef: z.string().optional(),
  importedFrom: z.string().optional(),
  notes: z.string().optional(),
});

export const matchReconciliationItemSchema = z.object({
  transactionId: z.string().uuid(),
});

export const globalizeItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  groupLabel: z.string().min(1),
});
