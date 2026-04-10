import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { create as createInvoice, collect as collectInvoice } from './service.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public',
    },
  },
});

describe('Invoice Service — Rent Collection Flow', () => {
  let user: any;
  let entity: any;
  let tenant: any;
  let property: any;
  let lease: any;
  let cashAccount: any;
  let incomeAccount: any;

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.bankReconciliationItem.deleteMany();
    await prisma.bankReconciliation.deleteMany();
    await prisma.ownerSettlement.deleteMany();
    await prisma.invoiceRetention.deleteMany();
    await prisma.entry.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.leasePrice.deleteMany();
    await prisma.lease.deleteMany();
    await prisma.property.deleteMany();
    await prisma.ownership.deleteMany();
    await prisma.account.deleteMany();
    await prisma.period.deleteMany();
    await prisma.entity.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    user = await prisma.user.create({
      data: {
        email: `inv-${Date.now()}@test.com`,
        password: await bcrypt.hash('test', 4),
        name: 'Invoice Tester',
        role: 'OPERATOR',
      },
    });

    entity = await prisma.entity.create({
      data: { name: 'Property Owner SA', type: 'COMPANY' },
    });

    tenant = await prisma.entity.create({
      data: { name: 'Tenant Corp', type: 'COMPANY' },
    });

    property = await prisma.property.create({
      data: { entityId: entity.id, name: 'Test Property', type: 'COMMERCIAL' },
    });

    lease = await prisma.lease.create({
      data: {
        propertyId: property.id,
        tenantId: tenant.id,
        currency: 'ARS',
        baseAmount: 15000000n,
        managedBy: 'DIRECT',
        startDate: new Date('2025-01-01'),
      },
    });

    cashAccount = await prisma.account.create({
      data: {
        entityId: entity.id,
        name: 'Efectivo ARS',
        path: `Assets:Cash:ARS:Inv:${Date.now()}`,
        type: 'CASH',
        currency: 'ARS',
        normalBalance: 'DEBIT',
      },
    });

    incomeAccount = await prisma.account.create({
      data: {
        entityId: entity.id,
        name: 'Ingreso Alquiler ARS',
        path: `Income:Rental:ARS:Inv:${Date.now()}`,
        type: 'REVENUE',
        currency: 'ARS',
        normalBalance: 'CREDIT',
      },
    });

    // Ensure today's period exists
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await prisma.period.upsert({
      where: { date: today },
      create: { date: today, status: 'OPEN' },
      update: {},
    });
  });

  it('creates an invoice with retentions and calculates net amount', async () => {
    const invoice = await createInvoice({
      leaseId: lease.id,
      periodMonth: 4,
      periodYear: 2026,
      baseAmount: 15000000n,
      vatAmount: 3150000n, // 21% IVA
      retentions: [
        { concept: 'GANANCIAS', amount: 500000n },
        { concept: 'IIBB', amount: 300000n },
      ],
    });

    expect(invoice.code).toMatch(/^INV-2026-04-/);
    expect(invoice.baseAmount).toBe(15000000n);
    expect(invoice.vatAmount).toBe(3150000n);
    expect(invoice.totalAmount).toBe(18150000n); // base + vat
    expect(invoice.netAmount).toBe(17350000n); // total - retentions
    expect(invoice.retentions).toHaveLength(2);
    expect(invoice.status).toBe('PENDING');
  });

  it('collects an invoice and creates ledger transaction', async () => {
    const invoice = await createInvoice({
      leaseId: lease.id,
      periodMonth: 4,
      periodYear: 2026,
      baseAmount: 10000000n,
    });

    const collected = await collectInvoice(invoice.id, user.id, {
      paymentMethod: 'CASH',
      debitAccountId: cashAccount.id,
      creditAccountId: incomeAccount.id,
    });

    expect(collected.status).toBe('PAID');
    expect(collected.paidAt).toBeTruthy();
    expect(collected.transactions).toHaveLength(1);
    expect(collected.transactions[0].type).toBe('INCOME');

    // Verify double entry was created
    const entries = collected.transactions[0].entries;
    expect(entries).toHaveLength(2);

    const debit = entries.find((e: any) => e.type === 'DEBIT');
    const credit = entries.find((e: any) => e.type === 'CREDIT');
    expect(debit!.amount).toBe(invoice.netAmount);
    expect(credit!.amount).toBe(invoice.netAmount);

    // Verify cached balances
    const cash = await prisma.account.findUnique({ where: { id: cashAccount.id } });
    expect(cash!.debitsPosted).toBe(invoice.netAmount);

    const income = await prisma.account.findUnique({ where: { id: incomeAccount.id } });
    expect(income!.creditsPosted).toBe(invoice.netAmount);
  });

  it('rejects collecting an already paid invoice', async () => {
    const invoice = await createInvoice({
      leaseId: lease.id,
      periodMonth: 3,
      periodYear: 2026,
      baseAmount: 5000000n,
    });

    await collectInvoice(invoice.id, user.id, {
      paymentMethod: 'CASH',
      debitAccountId: cashAccount.id,
      creditAccountId: incomeAccount.id,
    });

    await expect(
      collectInvoice(invoice.id, user.id, {
        paymentMethod: 'CASH',
        debitAccountId: cashAccount.id,
        creditAccountId: incomeAccount.id,
      })
    ).rejects.toThrow();
  });
});
