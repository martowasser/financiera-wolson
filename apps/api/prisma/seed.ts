import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // --- Users ---
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.create({
    data: { username: 'admin', password: hashedPassword, name: 'Administrador', role: 'ADMIN' },
  });
  const mariana = await prisma.user.create({
    data: { username: 'mariana', password: hashedPassword, name: 'Mariana', role: 'OPERATOR' },
  });
  const secretaria2 = await prisma.user.create({
    data: { username: 'secretaria', password: hashedPassword, name: 'Segunda Secretaria', role: 'OPERATOR' },
  });
  const alberto = await prisma.user.create({
    data: { username: 'alberto', password: hashedPassword, name: 'Alberto', role: 'VIEWER' },
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

  // Cuentas corrientes de socios (OWNER_CURRENT) — una por (socio, moneda)
  const ccAlbertoARS = await prisma.account.create({
    data: { entityId: albertoEntity.id, name: 'CC Alberto ARS', path: 'OwnerCurrent:Alberto:ARS', type: 'OWNER_CURRENT', currency: 'ARS', normalBalance: 'DEBIT' },
  });
  const ccAlbertoUSD = await prisma.account.create({
    data: { entityId: albertoEntity.id, name: 'CC Alberto USD', path: 'OwnerCurrent:Alberto:USD', type: 'OWNER_CURRENT', currency: 'USD', normalBalance: 'DEBIT' },
  });
  const ccJ27ARS = await prisma.account.create({
    data: { entityId: socioJ27.id, name: 'CC J27 ARS', path: 'OwnerCurrent:J27:ARS', type: 'OWNER_CURRENT', currency: 'ARS', normalBalance: 'DEBIT' },
  });
  const ccN23ARS = await prisma.account.create({
    data: { entityId: socioN23.id, name: 'CC N23 ARS', path: 'OwnerCurrent:N23:ARS', type: 'OWNER_CURRENT', currency: 'ARS', normalBalance: 'DEBIT' },
  });

  // Sociedad members: cuentas asociadas a cada sociedad con su % (bps)
  // DA S.A. — Alberto 50% / J27 50% + banco propio al 0%
  await prisma.sociedadMember.createMany({
    data: [
      { sociedadId: sociedadDA.id, accountId: ccAlbertoARS.id, percentBps: 5000 },
      { sociedadId: sociedadDA.id, accountId: ccJ27ARS.id, percentBps: 5000 },
      { sociedadId: sociedadDA.id, accountId: daBank.id, percentBps: 0 },
    ],
  });
  // MR Inversiones — Alberto 40% / J27 35% / N23 25% + banco propio al 0%
  await prisma.sociedadMember.createMany({
    data: [
      { sociedadId: sociedadMR.id, accountId: ccAlbertoARS.id, percentBps: 4000 },
      { sociedadId: sociedadMR.id, accountId: ccJ27ARS.id, percentBps: 3500 },
      { sociedadId: sociedadMR.id, accountId: ccN23ARS.id, percentBps: 2500 },
      { sociedadId: sociedadMR.id, accountId: mrBank.id, percentBps: 0 },
    ],
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

  // --- Demo enrichment (for fuzzy search palette demo) ---
  // WARNING: This data is for demo only and will not exist in production.
  const demoEntityData: { name: string; type: 'PERSON' | 'COMPANY' | 'THIRD_PARTY'; taxId: string }[] = [
    { name: 'Gonzalez María Elena', type: 'PERSON', taxId: '27-12345001-1' },
    { name: 'Gonzalez Roberto', type: 'PERSON', taxId: '20-12345002-2' },
    { name: 'Rodríguez Hnos S.R.L.', type: 'COMPANY', taxId: '30-12345003-3' },
    { name: 'Rodríguez Patricia', type: 'PERSON', taxId: '27-12345004-4' },
    { name: 'Fernández Carlos Alberto', type: 'PERSON', taxId: '20-12345005-5' },
    { name: 'Fernández Silvana', type: 'PERSON', taxId: '27-12345006-6' },
    { name: 'López Ana María', type: 'PERSON', taxId: '27-12345007-7' },
    { name: 'López Diego', type: 'PERSON', taxId: '20-12345008-8' },
    { name: 'Martínez Laura', type: 'PERSON', taxId: '27-12345009-9' },
    { name: 'Martínez Sebastián', type: 'PERSON', taxId: '20-12345010-0' },
    { name: 'Sánchez Pablo', type: 'PERSON', taxId: '20-12345011-1' },
    { name: 'Sánchez Carolina', type: 'PERSON', taxId: '27-12345012-2' },
    { name: 'Pérez Mónica', type: 'PERSON', taxId: '27-12345013-3' },
    { name: 'Pérez Gustavo', type: 'PERSON', taxId: '20-12345014-4' },
    { name: 'Gómez Andrea', type: 'PERSON', taxId: '27-12345015-5' },
    { name: 'Gómez Ricardo', type: 'PERSON', taxId: '20-12345016-6' },
    { name: 'Díaz Verónica', type: 'PERSON', taxId: '27-12345017-7' },
    { name: 'Díaz Fernando', type: 'PERSON', taxId: '20-12345018-8' },
    { name: 'Romero Lucía', type: 'PERSON', taxId: '27-12345019-9' },
    { name: 'Romero Martín', type: 'PERSON', taxId: '20-12345020-0' },
    { name: 'Álvarez Benítez S.A.', type: 'COMPANY', taxId: '30-12345021-1' },
    { name: 'Inversiones Belgrano S.A.', type: 'COMPANY', taxId: '30-12345022-2' },
    { name: 'Fideicomiso Palermo Norte', type: 'COMPANY', taxId: '30-12345023-3' },
    { name: 'Inmobiliaria Recoleta S.R.L.', type: 'COMPANY', taxId: '30-12345024-4' },
    { name: 'Grupo Villa Urquiza', type: 'COMPANY', taxId: '30-12345025-5' },
    { name: 'Constructora Caballito S.A.', type: 'COMPANY', taxId: '30-12345026-6' },
    { name: 'Administración San Telmo', type: 'THIRD_PARTY', taxId: '30-12345027-7' },
    { name: 'Administración Núñez', type: 'THIRD_PARTY', taxId: '30-12345028-8' },
    // NOTE: Companies below are kept as COMPANY without SociedadMember entries on purpose —
    // they represent businesses in the system that are NOT partnerships/sociedades (tenants,
    // suppliers, etc.). The `/entities?onlySociedades=true` filter keeps them out of the
    // "Nuevo Movimiento → Sociedad" dropdown.
    { name: 'Acosta Cristina', type: 'PERSON', taxId: '27-12345029-9' },
    { name: 'Ruiz Sergio Daniel', type: 'PERSON', taxId: '20-12345030-0' },
    { name: 'Silva Patricia Mariel', type: 'PERSON', taxId: '27-12345031-1' },
    { name: 'Herrera Juan Pablo', type: 'PERSON', taxId: '20-12345032-2' },
    { name: 'Castro Verónica', type: 'PERSON', taxId: '27-12345033-3' },
    { name: 'Ortiz Hernán', type: 'PERSON', taxId: '20-12345034-4' },
    { name: 'Núñez Florencia', type: 'PERSON', taxId: '27-12345035-5' },
    { name: 'Morales Walter', type: 'PERSON', taxId: '20-12345036-6' },
    { name: 'Kowalski Hnos S.R.L.', type: 'COMPANY', taxId: '30-12345037-7' },
    { name: 'Almada Jorge Oscar', type: 'PERSON', taxId: '20-12345038-8' },
    { name: 'Distribuidora Olivos S.A.', type: 'COMPANY', taxId: '30-12345039-9' },
    { name: 'Servicios Colegiales S.R.L.', type: 'COMPANY', taxId: '30-12345040-0' },
  ];
  await prisma.entity.createMany({ data: demoEntityData });
  console.log(`Demo entities created: ${demoEntityData.length}`);

  // Create past periods (monthly) for richer transaction history
  const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const pastPeriods: { id: string; monthIdx: number; year: number }[] = [];
  for (let back = 1; back <= 5; back++) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - back);
    d.setDate(15);
    d.setHours(0, 0, 0, 0);
    const p = await prisma.period.create({ data: { date: d, status: 'CLOSED', closedAt: new Date() } });
    pastPeriods.push({ id: p.id, monthIdx: d.getMonth(), year: d.getFullYear() });
  }
  pastPeriods.push({ id: period.id, monthIdx: today.getMonth(), year: today.getFullYear() });

  // Demo transactions — varied descriptions for fuzzy-search coverage.
  type TxnTemplate = {
    type: 'INCOME' | 'EXPENSE' | 'BANK_FEE';
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK';
    descBuilder: (m: string) => string;
    debitAccountId: string;
    creditAccountId: string;
    amountMin: bigint;
    amountMax: bigint;
  };
  const templates: TxnTemplate[] = [
    { type: 'INCOME', paymentMethod: 'CASH', descBuilder: (m) => `Cobro alquiler Local Esmeralda - ${m}`, debitAccountId: cashARS.id, creditAccountId: rentalIncomeARS.id, amountMin: 12000000n, amountMax: 18000000n },
    { type: 'INCOME', paymentMethod: 'BANK_TRANSFER', descBuilder: (m) => `Cobro alquiler Oficina 301 - ${m}`, debitAccountId: bancoCredicoop.id, creditAccountId: rentalIncomeARS.id, amountMin: 18000000n, amountMax: 22000000n },
    { type: 'INCOME', paymentMethod: 'CASH', descBuilder: (m) => `Cobro cochera 15 Parking Centro - ${m}`, debitAccountId: cashARS.id, creditAccountId: rentalIncomeARS.id, amountMin: 4500000n, amountMax: 5500000n },
    { type: 'EXPENSE', paymentMethod: 'BANK_TRANSFER', descBuilder: (m) => `ABL Edificio Centro - ${m}`, debitAccountId: expenseABL.id, creditAccountId: bancoCredicoop.id, amountMin: 3000000n, amountMax: 5500000n },
    { type: 'EXPENSE', paymentMethod: 'BANK_TRANSFER', descBuilder: (m) => `Ingresos Brutos - ${m}`, debitAccountId: expenseIIBB.id, creditAccountId: bancoProvincia.id, amountMin: 800000n, amountMax: 1500000n },
    { type: 'EXPENSE', paymentMethod: 'BANK_TRANSFER', descBuilder: (m) => `Pago expensas Depto 4B - ${m}`, debitAccountId: daExpense.id, creditAccountId: daBank.id, amountMin: 1800000n, amountMax: 2800000n },
    { type: 'EXPENSE', paymentMethod: 'CHECK', descBuilder: (m) => `Honorarios administración - ${m}`, debitAccountId: mrExpense.id, creditAccountId: mrBank.id, amountMin: 600000n, amountMax: 1200000n },
    { type: 'EXPENSE', paymentMethod: 'BANK_TRANSFER', descBuilder: (m) => `Reparaciones Local Esmeralda - ${m}`, debitAccountId: daExpense.id, creditAccountId: daBank.id, amountMin: 500000n, amountMax: 3500000n },
    { type: 'EXPENSE', paymentMethod: 'BANK_TRANSFER', descBuilder: (m) => `Seguros propiedades - ${m}`, debitAccountId: mrExpense.id, creditAccountId: mrBank.id, amountMin: 900000n, amountMax: 1400000n },
    { type: 'EXPENSE', paymentMethod: 'CASH', descBuilder: (m) => `Servicios generales Parking Centro - ${m}`, debitAccountId: daExpense.id, creditAccountId: cashARS.id, amountMin: 200000n, amountMax: 800000n },
    { type: 'BANK_FEE', paymentMethod: 'BANK_TRANSFER', descBuilder: (m) => `Gastos bancarios Credicoop - ${m}`, debitAccountId: expenseBankFees.id, creditAccountId: bancoCredicoop.id, amountMin: 150000n, amountMax: 400000n },
    { type: 'BANK_FEE', paymentMethod: 'BANK_TRANSFER', descBuilder: (m) => `Gastos bancarios Provincia - ${m}`, debitAccountId: expenseBankFees.id, creditAccountId: bancoProvincia.id, amountMin: 100000n, amountMax: 300000n },
    { type: 'INCOME', paymentMethod: 'CASH', descBuilder: (m) => `Ingreso comisión inmobiliaria - ${m}`, debitAccountId: cashARS.id, creditAccountId: rentalIncomeARS.id, amountMin: 2000000n, amountMax: 4000000n },
  ];

  const balanceDelta = new Map<string, { debit: bigint; credit: bigint }>();
  function addDelta(accountId: string, field: 'debit' | 'credit', amount: bigint) {
    const cur = balanceDelta.get(accountId) ?? { debit: 0n, credit: 0n };
    cur[field] += amount;
    balanceDelta.set(accountId, cur);
  }

  const DEMO_TXN_COUNT = 200;
  let seqBase = 4; // existing 3 txns consumed TXN-000001..000003
  for (let i = 0; i < DEMO_TXN_COUNT; i++) {
    const tmpl = templates[i % templates.length];
    const periodSlot = pastPeriods[i % pastPeriods.length];
    const monthLabel = `${MONTH_NAMES[periodSlot.monthIdx]} ${periodSlot.year}`;
    const range = tmpl.amountMax - tmpl.amountMin;
    // Deterministic amount so seeds are reproducible.
    const amount = tmpl.amountMin + (BigInt(i) * 13n) % (range + 1n);
    const code = `TXN-${String(seqBase + i).padStart(6, '0')}`;
    await prisma.transaction.create({
      data: {
        periodId: periodSlot.id,
        code,
        description: tmpl.descBuilder(monthLabel),
        type: tmpl.type,
        paymentMethod: tmpl.paymentMethod,
        createdById: mariana.id,
        entries: {
          create: [
            { accountId: tmpl.debitAccountId, type: 'DEBIT', amount, description: tmpl.descBuilder(monthLabel) },
            { accountId: tmpl.creditAccountId, type: 'CREDIT', amount, description: tmpl.descBuilder(monthLabel) },
          ],
        },
      },
    });
    addDelta(tmpl.debitAccountId, 'debit', amount);
    addDelta(tmpl.creditAccountId, 'credit', amount);
  }

  for (const [accountId, delta] of balanceDelta) {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        debitsPosted: { increment: delta.debit },
        creditsPosted: { increment: delta.credit },
      },
    });
  }

  console.log('Seed completed successfully!');
  console.log(`Users: admin, mariana, secretaria, alberto (password: admin123)`);
  console.log(`Entities: ${financiera.name}, ${sociedadDA.name}, ${sociedadMR.name}, and ${demoEntityData.length} demo entities`);
  console.log(`Properties: 4 properties with 4 active leases`);
  console.log(`Transactions: 3 base + ${DEMO_TXN_COUNT} demo across ${pastPeriods.length} periods`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
