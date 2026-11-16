import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDB, insertProduct, first } from './helpers/sqlite-adapter.mjs';
import { saveSale } from '../src/features/ventory/sales.ts';
import {
  saveExpense, deleteExpense, getFinancialReport, isValidDateKey, localDateKey,
} from '../src/features/ventory/finance.ts';

test('laba operasional: omzet - HPP - pengeluaran (tanpa double counting stok)', async () => {
  const db = await createTestDB();
  try {
    const id = await insertProduct(db);
    await saveSale(db, [{ productId: id, quantity: 2 }]);
    await saveExpense(db, {
      category: 'Listrik & Internet', amount: 10_000, note: 'Listrik',
      expense_date: localDateKey(new Date()),
    });
    const report = await getFinancialReport(db, 'today');
    assert.equal(report.revenue, 150_000);
    assert.equal(report.costOfGoodsSold, 120_000);
    assert.equal(report.grossProfit, 30_000);
    assert.equal(report.operationalExpenses, 10_000);
    assert.equal(report.operatingProfit, 20_000);
    assert.equal(report.transactions, 1);
    assert.equal(report.unitsSold, 2);
    assert.equal(report.expensesCount, 1);
    assert.equal(report.trend.length, 7);
    assert.equal(report.trend.at(-1).revenue, 150_000);
    assert.equal(report.trend.at(-1).expenses, 10_000);
  } finally { db.close(); }
});

test('edit lalu hapus pengeluaran langsung mengubah laba laporan', async () => {
  const db = await createTestDB();
  try {
    const day = localDateKey(new Date());
    await saveExpense(db, { category: 'Operasional', amount: 10_000, note: 'Awal', expense_date: day });
    const row = await first(db, 'SELECT id FROM expenses LIMIT 1');
    await saveExpense(db, { category: 'Sewa', amount: 12_000, note: 'Koreksi', expense_date: day }, row.id);
    const updated = await getFinancialReport(db, 'today');
    assert.equal(updated.operationalExpenses, 12_000);
    assert.equal(updated.operatingProfit, -12_000);
    await deleteExpense(db, row.id);
    const deleted = await getFinancialReport(db, 'today');
    assert.equal(deleted.operationalExpenses, 0);
    assert.equal(deleted.expensesCount, 0);
  } finally { db.close(); }
});

test('validasi tanggal kalender, jumlah, kategori dan id', async () => {
  const db = await createTestDB();
  try {
    assert.equal(isValidDateKey('2026-02-29'), false);
    assert.equal(isValidDateKey('2028-02-29'), true);
    const base = { category: 'Operasional', amount: 1000, note: '', expense_date: '2026-11-16' };
    await assert.rejects(saveExpense(db, { ...base, amount: 0 }), /Nominal/);
    await assert.rejects(saveExpense(db, { ...base, amount: 1.5 }), /Nominal/);
    await assert.rejects(saveExpense(db, { ...base, category: 'Invalid' }), /Kategori/);
    await assert.rejects(saveExpense(db, { ...base, note: 'x'.repeat(201) }), /200/);
    await assert.rejects(saveExpense(db, { ...base, expense_date: '2026-02-29' }), /Tanggal/);
    await assert.rejects(deleteExpense(db, 999), /tidak ditemukan/);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM expenses')).n, 0);
  } finally { db.close(); }
});

test('filter hari ini, 7 hari, bulan ini mengelompokkan tanggal secara lokal', async () => {
  const db = await createTestDB();
  try {
    const today = new Date();
    const dayKey = localDateKey(today);
    const yesterday = localDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
    await saveExpense(db, { category: 'Gaji', amount: 20_000, note: '', expense_date: dayKey });
    await saveExpense(db, { category: 'Sewa', amount: 9_000, note: '', expense_date: yesterday });
    const daily = await getFinancialReport(db, 'today');
    const weekly = await getFinancialReport(db, 'week');
    const monthly = await getFinancialReport(db, 'month');
    assert.equal(daily.operationalExpenses, 20_000);
    assert.equal(weekly.operationalExpenses, 29_000);
    assert.equal(monthly.operationalExpenses, today.getDate() === 1 ? 20_000 : 29_000);
    assert.equal(weekly.expenseCategories.length, 2);
  } finally { db.close(); }
});
