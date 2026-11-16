import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDB, insertProduct, first } from './helpers/sqlite-adapter.mjs';
import { saveSale, listSales, getDashboardStats } from '../src/features/ventory/sales.ts';

test('penjualan dua produk mengurangi stok, mencatat harga historis dan laba dengan benar', async () => {
  const db = await createTestDB();
  try {
    const a = await insertProduct(db);
    const b = await insertProduct(db, {
      name: 'Minyak', sku: 'MY-002', purchase_price: 12_000, selling_price: 18_000,
      stock: 8, min_stock: 3,
    });
    const saleId = await saveSale(db, [{ productId: a, quantity: 2 }, { productId: b, quantity: 3 }]);
    const sale = await first(db, 'SELECT * FROM sales WHERE id = ?', saleId);
    assert.equal(sale.total_amount, 204_000);
    assert.equal(sale.gross_profit, 48_000);
    assert.equal((await first(db, 'SELECT stock FROM products WHERE id = ?', a)).stock, 18);
    assert.equal((await first(db, 'SELECT stock FROM products WHERE id = ?', b)).stock, 5);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM sale_items')).n, 2);
    assert.equal((await first(db, 'SELECT unit_price FROM sale_items WHERE product_id = ?', a)).unit_price, 75_000);
    const history = await listSales(db);
    assert.equal(history.length, 1);
    assert.match(history[0].items_summary, /Beras/);
  } finally { db.close(); }
});

test('stok tidak cukup: seluruh transaksi rollback, termasuk stok produk lain', async () => {
  const db = await createTestDB();
  try {
    const a = await insertProduct(db);
    const b = await insertProduct(db, { name: 'Kopi', sku: 'KP', stock: 1 });
    await assert.rejects(
      saveSale(db, [{ productId: a, quantity: 2 }, { productId: b, quantity: 3 }]),
      /tidak cukup/
    );
    assert.equal((await first(db, 'SELECT stock FROM products WHERE id = ?', a)).stock, 20);
    assert.equal((await first(db, 'SELECT stock FROM products WHERE id = ?', b)).stock, 1);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM sales')).n, 0);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM sale_items')).n, 0);
  } finally { db.close(); }
});

test('input keranjang tidak valid dan duplikat ditolak sebelum menulis ke database', async () => {
  const db = await createTestDB();
  try {
    const id = await insertProduct(db);
    await assert.rejects(saveSale(db, []), /kosong/);
    await assert.rejects(saveSale(db, [{ productId: id, quantity: 0 }]), /tidak valid/);
    await assert.rejects(saveSale(db, [{ productId: id, quantity: 1.5 }]), /tidak valid/);
    await assert.rejects(saveSale(db, [{ productId: id, quantity: 1 }, { productId: id, quantity: 1 }]), /ganda/);
    await assert.rejects(saveSale(db, [{ productId: 9999, quantity: 1 }]), /tidak tersedia/);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM sales')).n, 0);
  } finally { db.close(); }
});

test('kesalahan SQL di tengah transaksi tidak meninggalkan data parsial', async () => {
  const db = await createTestDB();
  try {
    const id = await insertProduct(db);
    await db.execAsync(`CREATE TRIGGER stop_sale_item BEFORE INSERT ON sale_items
       BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;`);
    await assert.rejects(saveSale(db, [{ productId: id, quantity: 1 }]), /simulated failure/);
    assert.equal((await first(db, 'SELECT stock FROM products WHERE id = ?', id)).stock, 20);
    assert.equal((await first(db, 'SELECT COUNT(*) AS n FROM sales')).n, 0);
  } finally { db.close(); }
});

test('dashboard memuat hasil SQLite aktual, bukan data demo', async () => {
  const db = await createTestDB();
  try {
    const id = await insertProduct(db, { stock: 6, min_stock: 5 });
    await saveSale(db, [{ productId: id, quantity: 2 }]);
    const stats = await getDashboardStats(db);
    assert.equal(stats.todayRevenue, 150_000);
    assert.equal(stats.todayGrossProfit, 30_000);
    assert.equal(stats.todayTransactions, 1);
    assert.equal(stats.todayUnits, 2);
    assert.equal(stats.allProducts, 1);
    assert.equal(stats.lowStockCount, 1);
    assert.equal(stats.lowStockProducts[0].stock, 4);
  } finally { db.close(); }
});
