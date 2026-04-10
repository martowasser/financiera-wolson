import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // --- Users ---
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.create({
    data: { email: 'admin@financiera.com', password: hashedPassword, name: 'Administrador', role: 'ADMIN' },
  });
  const mariana = await prisma.user.create({
    data: { email: 'mariana@financiera.com', password: hashedPassword, name: 'Mariana', role: 'OPERATOR' },
  });
  const secretaria2 = await prisma.user.create({
    data: { email: 'secretaria@financiera.com', password: hashedPassword, name: 'Segunda Secretaria', role: 'OPERATOR' },
  });
  const alberto = await prisma.user.create({
    data: { email: 'alberto@financiera.com', password: hashedPassword, name: 'Alberto', role: 'VIEWER' },
  });

  // --- Entities ---
  const financiera = await prisma.entity.create({
    data: { name: 'La Financiera', type: 'FIRM', taxId: '30-12345678-9', notes: 'Empresa principal' },
  });
  const albertoEntity = await prisma.entity.create({
    data: { name: 'Alberto Pérez', type: 'PERSON', taxId: '20-11111111-1' },
  });
  const socioJ27 = await prisma.entity.create({
    data: { name: 'Juan Rodríguez (J27)', type: 'PERSON', taxId: '20-22222222-2' },
  });
  const socioN23 = await prisma.entity.create({
    data: { name: 'Néstor García (N23)', type: 'PERSON', taxId: '20-33333333-3' },
  });
  const sociedadDA = await prisma.entity.create({
    data: { name: 'DA S.A.', type: 'COMPANY', taxId: '30-44444444-4', notes: 'Sociedad de Alberto y Juan' },
  });
  const sociedadMR = await prisma.entity.create({
    data: { name: 'MR Inversiones S.R.L.', type: 'COMPANY', taxId: '30-55555555-5', notes: 'Sociedad de Alberto, Juan y Néstor' },
  });
  const inquilino1 = await prisma.entity.create({
    data: { name: 'Comercial Esmeralda S.A.', type: 'COMPANY', taxId: '30-66666666-6' },
  });
  const inquilino2 = await prisma.entity.create({
    data: { name: 'María López', type: 'PERSON', taxId: '27-77777777-7' },
  });
  const inquilino3 = await prisma.entity.create({
    data: { name: 'Tech Solutions S.R.L.', type: 'COMPANY', taxId: '30-88888888-8' },
  });
  const adminExterna = await prisma.entity.create({
    data: { name: 'Administraciones Norte', type: 'THIRD_PARTY', taxId: '30-99999999-9', notes: 'Administrador externo que rinde alquileres' },
  });

  // --- Ownerships ---
  // DA S.A.: Alberto 50%, Juan 50%
  await prisma.ownership.createMany({
    data: [
      { entityId: sociedadDA.id, ownerId: albertoEntity.id, percentage: 5000 },
      { entityId: sociedadDA.id, ownerId: socioJ27.id, percentage: 5000 },
    ],
  });
  // MR Inversiones: Alberto 40%, Juan 35%, Néstor 25%
  await prisma.ownership.createMany({
    data: [
      { entityId: sociedadMR.id, ownerId: albertoEntity.id, percentage: 4000 },
      { entityId: sociedadMR.id, ownerId: socioJ27.id, percentage: 3500 },
      { entityId: sociedadMR.id, ownerId: socioN23.id, percentage: 2500 },
    ],
  });
  // La Financiera: Alberto 100%
  await prisma.ownership.create({
    data: { entityId: financiera.id, ownerId: albertoEntity.id, percentage: 10000 },
  });

  // --- Accounts ---
  // Financiera accounts
  const cashARS = await prisma.account.create({
    data: { entityId: financiera.id, name: 'Efectivo Pesos', path: 'Assets:Cash:ARS', type: 'CASH', currency: 'ARS', normalBalance: 'DEBIT' },
  });
  const cashUSD = await prisma.account.create({
    data: { entityId: financiera.id, name: 'Efectivo Dólares', path: 'Assets:Cash:USD', type: 'CASH', currency: 'USD', normalBalance: 'DEBIT' },
  });

  // Bank accounts - Financiera
  const bancoCredicoop = await prisma.account.create({
    data: { entityId: financiera.id, name: 'Banco Credicoop', path: 'Assets:Bank:Credicoop:ARS', type: 'BANK', currency: 'ARS', normalBalance: 'DEBIT', bankName: 'Credicoop', bankAccountNum: '191-0001234-5' },
  });
  const bancoProvincia = await prisma.account.create({
    data: { entityId: financiera.id, name: 'Banco Provincia', path: 'Assets:Bank:Provincia:ARS', type: 'BANK', currency: 'ARS', normalBalance: 'DEBIT', bankName: 'Banco Provincia', bankAccountNum: '014-0005678-9' },
  });

  // DA S.A. accounts
  const daBank = await prisma.account.create({
    data: { entityId: sociedadDA.id, name: 'Banco DA S.A.', path: 'Assets:Bank:DA:Credicoop:ARS', type: 'BANK', currency: 'ARS', normalBalance: 'DEBIT', bankName: 'Credicoop', bankAccountNum: '191-0009876-5' },
  });
  const daExpense = await prisma.account.create({
    data: { entityId: sociedadDA.id, name: 'Gastos DA S.A.', path: 'Expense:General:DA:ARS', type: 'EXPENSE', currency: 'ARS', normalBalance: 'DEBIT' },
  });
  const daRevenue = await prisma.account.create({
    data: { entityId: sociedadDA.id, name: 'Ingresos DA S.A.', path: 'Income:Rental:DA:ARS', type: 'REVENUE', currency: 'ARS', normalBalance: 'CREDIT' },
  });

  // MR Inversiones accounts
  const mrBank = await prisma.account.create({
    data: { entityId: sociedadMR.id, name: 'Banco MR Inversiones', path: 'Assets:Bank:MR:Provincia:ARS', type: 'BANK', currency: 'ARS', normalBalance: 'DEBIT', bankName: 'Banco Provincia', bankAccountNum: '014-0001111-1' },
  });
  const mrExpense = await prisma.account.create({
    data: { entityId: sociedadMR.id, name: 'Gastos MR Inversiones', path: 'Expense:General:MR:ARS', type: 'EXPENSE', currency: 'ARS', normalBalance: 'DEBIT' },
  });
  const mrRevenue = await prisma.account.create({
    data: { entityId: sociedadMR.id, name: 'Ingresos MR Inversiones', path: 'Income:Rental:MR:ARS', type: 'REVENUE', currency: 'ARS', normalBalance: 'CREDIT' },
  });

  // Income accounts
  const rentalIncomeARS = await prisma.account.create({
    data: { entityId: financiera.id, name: 'Ingresos Alquiler Pesos', path: 'Income:Rental:ARS', type: 'REVENUE', currency: 'ARS', normalBalance: 'CREDIT' },
  });
  const rentalIncomeUSD = await prisma.account.create({
    data: { entityId: financiera.id, name: 'Ingresos Alquiler Dólares', path: 'Income:Rental:USD', type: 'REVENUE', currency: 'USD', normalBalance: 'CREDIT' },
  });

  // Expense accounts
  const expenseABL = await prisma.account.create({
    data: { entityId: financiera.id, name: 'ABL', path: 'Expense:Tax:ABL:ARS', type: 'EXPENSE', currency: 'ARS', normalBalance: 'DEBIT' },
  });
  const expenseIIBB = await prisma.account.create({
    data: { entityId: financiera.id, name: 'Ingresos Brutos', path: 'Expense:Tax:IIBB:ARS', type: 'EXPENSE', currency: 'ARS', normalBalance: 'DEBIT' },
  });
  const expenseBankFees = await prisma.account.create({
    data: { entityId: financiera.id, name: 'Gastos Bancarios', path: 'Expense:Bank:Fees:ARS', type: 'EXPENSE', currency: 'ARS', normalBalance: 'DEBIT' },
  });

  // Receivable accounts for tenants
  const receivableEsmeralda = await prisma.account.create({
    data: { entityId: inquilino1.id, name: 'Cuenta Corriente Esmeralda', path: 'Receivable:Tenant:Esmeralda:ARS', type: 'RECEIVABLE', currency: 'ARS', normalBalance: 'DEBIT' },
  });
  const receivableLopez = await prisma.account.create({
    data: { entityId: inquilino2.id, name: 'Cuenta Corriente López', path: 'Receivable:Tenant:Lopez:USD', type: 'RECEIVABLE', currency: 'USD', normalBalance: 'DEBIT' },
  });

  // --- Properties ---
  const prop1 = await prisma.property.create({
    data: { entityId: sociedadDA.id, name: 'Local Esmeralda 1234', address: 'Esmeralda 1234, CABA', type: 'COMMERCIAL' },
  });
  const prop2 = await prisma.property.create({
    data: { entityId: sociedadMR.id, name: 'Depto 4B - Edificio Centro', address: 'Av. Corrientes 5678, 4B, CABA', type: 'APARTMENT' },
  });
  const prop3 = await prisma.property.create({
    data: { entityId: sociedadMR.id, name: 'Oficina 301 - Torre Norte', address: 'Av. Libertador 9012, 3er piso, CABA', type: 'OFFICE', notes: 'Administrada por tercero' },
  });
  const prop4 = await prisma.property.create({
    data: { entityId: financiera.id, name: 'Cochera 15 - Parking Centro', address: 'Tucumán 456, Subsuelo, CABA', type: 'PARKING' },
  });

  // --- Leases ---
  const lease1 = await prisma.lease.create({
    data: {
      propertyId: prop1.id,
      tenantId: inquilino1.id,
      currency: 'ARS',
      baseAmount: 15000000n, // $150,000 ARS
      managedBy: 'DIRECT',
      startDate: new Date('2025-01-01'),
      priceHistory: {
        create: [
          { amount: 12000000n, validFrom: new Date('2025-01-01'), validUntil: new Date('2025-06-30') },
          { amount: 15000000n, validFrom: new Date('2025-07-01') },
        ],
      },
    },
  });

  const lease2 = await prisma.lease.create({
    data: {
      propertyId: prop2.id,
      tenantId: inquilino2.id,
      currency: 'USD',
      baseAmount: 80000n, // USD 800
      managedBy: 'DIRECT',
      startDate: new Date('2025-03-01'),
      priceHistory: {
        create: { amount: 80000n, validFrom: new Date('2025-03-01') },
      },
    },
  });

  const lease3 = await prisma.lease.create({
    data: {
      propertyId: prop3.id,
      tenantId: inquilino3.id,
      currency: 'ARS',
      baseAmount: 20000000n, // $200,000 ARS
      managedBy: 'THIRD_PARTY',
      thirdPartyEntityId: adminExterna.id,
      startDate: new Date('2024-06-01'),
      notes: 'Rendido por Administraciones Norte',
      priceHistory: {
        create: { amount: 20000000n, validFrom: new Date('2024-06-01') },
      },
    },
  });

  const lease4 = await prisma.lease.create({
    data: {
      propertyId: prop4.id,
      tenantId: inquilino1.id,
      currency: 'ARS',
      baseAmount: 5000000n, // $50,000 ARS
      managedBy: 'DIRECT',
      startDate: new Date('2025-06-01'),
      priceHistory: {
        create: { amount: 5000000n, validFrom: new Date('2025-06-01') },
      },
    },
  });

  // --- Period + Sample Transactions ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const period = await prisma.period.create({
    data: { date: today, status: 'OPEN' },
  });

  // Sample transaction 1: Rent collection in cash ARS
  const txn1 = await prisma.transaction.create({
    data: {
      periodId: period.id,
      code: 'TXN-000001',
      description: 'Cobro alquiler Local Esmeralda - Abril 2026',
      type: 'INCOME',
      paymentMethod: 'CASH',
      createdById: mariana.id,
      entries: {
        create: [
          { accountId: cashARS.id, type: 'DEBIT', amount: 15000000n, description: 'Cobro efectivo' },
          { accountId: rentalIncomeARS.id, type: 'CREDIT', amount: 15000000n, description: 'Ingreso alquiler Esmeralda' },
        ],
      },
    },
  });

  // Update cached balances
  await prisma.account.update({ where: { id: cashARS.id }, data: { debitsPosted: 15000000n } });
  await prisma.account.update({ where: { id: rentalIncomeARS.id }, data: { creditsPosted: 15000000n } });

  // Sample transaction 2: ABL payment from bank for DA S.A.
  const txn2 = await prisma.transaction.create({
    data: {
      periodId: period.id,
      code: 'TXN-000002',
      description: 'ABL Edificio Centro - DA S.A.',
      type: 'EXPENSE',
      paymentMethod: 'BANK_TRANSFER',
      createdById: mariana.id,
      entries: {
        create: [
          { accountId: daExpense.id, type: 'DEBIT', amount: 4500000n, description: 'ABL edificio' },
          { accountId: daBank.id, type: 'CREDIT', amount: 4500000n, description: 'Pago banco DA' },
        ],
      },
    },
  });

  await prisma.account.update({ where: { id: daExpense.id }, data: { debitsPosted: 4500000n } });
  await prisma.account.update({ where: { id: daBank.id }, data: { creditsPosted: 4500000n } });

  // Sample transaction 3: Bank fee
  const txn3 = await prisma.transaction.create({
    data: {
      periodId: period.id,
      code: 'TXN-000003',
      description: 'Gastos bancarios Credicoop - Marzo 2026',
      type: 'BANK_FEE',
      paymentMethod: 'BANK_TRANSFER',
      createdById: mariana.id,
      entries: {
        create: [
          { accountId: expenseBankFees.id, type: 'DEBIT', amount: 250000n, description: 'Comisiones y gastos' },
          { accountId: bancoCredicoop.id, type: 'CREDIT', amount: 250000n, description: 'Débito banco' },
        ],
      },
    },
  });

  await prisma.account.update({ where: { id: expenseBankFees.id }, data: { debitsPosted: 250000n } });
  await prisma.account.update({ where: { id: bancoCredicoop.id }, data: { creditsPosted: 250000n } });

  console.log('Seed completed successfully!');
  console.log(`Users: admin, mariana, secretaria, alberto (password: admin123)`);
  console.log(`Entities: ${financiera.name}, ${sociedadDA.name}, ${sociedadMR.name}, and more`);
  console.log(`Properties: 4 properties with 4 active leases`);
  console.log(`Transactions: 3 sample transactions for today`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
