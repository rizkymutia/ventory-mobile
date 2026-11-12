import type { SQLiteDatabase } from 'expo-sqlite';
import type { Product } from './database';

export type CartLine = { productId: number; quantity: number };

export type SaleHistory = {
  id: number;
  total_amount: number;
  gross_profit: number;
  created_at: number;
  items_summary: string;
};

export type DashboardStats = {
  todayRevenue: number;
  todayGrossProfit: number;
  todayTransactions: number;
  todayUnits: number;
  allProducts: number;
  lowStockCount: number;
  inventoryCost: number;
  lowStockProducts: { id: number; name: string; stock: number; min_stock: number }[];
  recentSales: SaleHistory[];
};

export function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function formatSaleTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export async function listAvailableProducts(db: SQLiteDatabase): Promise<Product[]> {
  return db.getAllAsync<Product>(
    'SELECT * FROM products ORDER BY name COLLATE NOCASE, id ASC'
  );
}

export async function listSales(db: SQLiteDatabase, limit = 15): Promise<SaleHistory[]> {
  return db.getAllAsync<SaleHistory>(
    `SELECT s.id, s.total_amount, s.gross_profit, s.created_at,
      COALESCE((SELECT GROUP_CONCAT(si.product_name || ' ×' || si.quantity, ', ')
                FROM sale_items si WHERE si.sale_id = s.id), '') AS items_summary
     FROM sales s ORDER BY s.created_at DESC, s.id DESC LIMIT ?`,
    limit
  );
}

/** Simpan transaksi dan kurangi seluruh stok dalam SATU transaksi atomik.
 * Khusus native (Expo Go Android/iOS): withExclusiveTransactionAsync belum tersedia di web.
 */
export async function saveSale(db: SQLiteDatabase, cart: CartLine[]): Promise<number> {
  if (!cart.length) throw new Error('Keranjang masih kosong.');

  const seen = new Set<number>();
  for (const line of cart) {
    if (!Number.isSafeInteger(line.productId) || line.productId <= 0 ||
        !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error('Produk atau jumlah tidak valid.');
    }
    if (seen.has(line.productId)) throw new Error('Produk ganda dalam keranjang.');
    seen.add(line.productId);
  }

  let savedId = 0;
  const now = Math.floor(Date.now() / 1000);

  await db.withExclusiveTransactionAsync(async (tx) => {
    // Total baru disimpan setelah semua item berhasil diproses.
    const inserted = await tx.runAsync(
      'INSERT INTO sales (total_amount, gross_profit, created_at) VALUES (0, 0, ?)',
      now
    );
    savedId = inserted.lastInsertRowId;
    let total = 0;
    let grossProfit = 0;

    for (const line of cart) {
      const product = await tx.getFirstAsync<Product>(
        'SELECT * FROM products WHERE id = ?', line.productId
      );
      if (!product) throw new Error('Ada produk yang sudah tidak tersedia. Muat ulang daftar produk.');
      if (product.stock < line.quantity) {
        throw new Error(`Stok ${product.name} tidak cukup (tersisa ${product.stock}).`);
      }

      const lineTotal = product.selling_price * line.quantity;
      const lineProfit = (product.selling_price - product.purchase_price) * line.quantity;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(lineProfit) ||
          !Number.isSafeInteger(total + lineTotal) ||
          !Number.isSafeInteger(grossProfit + lineProfit)) {
        throw new Error('Total transaksi terlalu besar.');
      }

      // Guard stok SQL mencegah angka negatif saat ada pembaruan stok lain.
      const updated = await tx.runAsync(
        `UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND stock >= ?`,
        line.quantity, product.id, line.quantity
      );
      if (updated.changes !== 1) {
        throw new Error(`Stok ${product.name} berubah. Silakan perbarui keranjang.`);
      }

      await tx.runAsync(
        `INSERT INTO sale_items
          (sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        savedId, product.id, product.name, line.quantity,
        product.selling_price, product.purchase_price, lineTotal
      );
      total += lineTotal;
      grossProfit += lineProfit;
    }

    await tx.runAsync(
      'UPDATE sales SET total_amount = ?, gross_profit = ? WHERE id = ?',
      total, grossProfit, savedId
    );
  });

  return savedId;
}

/** Statistik harian mengikuti zona waktu lokal perangkat, tersimpan sebagai Unix UTC. */
export async function getDashboardStats(db: SQLiteDatabase): Promise<DashboardStats> {
  const now = new Date();
  const dayStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
  const dayEnd = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() / 1000);

  const [daily, units, stock, lowStockProducts, recentSales] = await Promise.all([
    db.getFirstAsync<{ revenue: number; gross_profit: number; transactions: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue,
              COALESCE(SUM(gross_profit), 0) AS gross_profit,
              COUNT(*) AS transactions
       FROM sales WHERE created_at >= ? AND created_at < ?`,
      dayStart, dayEnd
    ),
    db.getFirstAsync<{ units: number }>(
      `SELECT COALESCE(SUM(si.quantity), 0) AS units
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.created_at >= ? AND s.created_at < ?`,
      dayStart, dayEnd
    ),
    db.getFirstAsync<{ total_products: number; low_stock: number; inventory_cost: number }>(
      `SELECT COUNT(*) AS total_products,
              COALESCE(SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END), 0) AS low_stock,
              COALESCE(SUM(stock * purchase_price), 0) AS inventory_cost
       FROM products`
    ),
    db.getAllAsync<{ id: number; name: string; stock: number; min_stock: number }>(
      `SELECT id, name, stock, min_stock FROM products
       WHERE stock <= min_stock ORDER BY stock ASC, name COLLATE NOCASE LIMIT 5`
    ),
    listSales(db, 5),
  ]);

  return {
    todayRevenue: daily?.revenue ?? 0,
    todayGrossProfit: daily?.gross_profit ?? 0,
    todayTransactions: daily?.transactions ?? 0,
    todayUnits: units?.units ?? 0,
    allProducts: stock?.total_products ?? 0,
    lowStockCount: stock?.low_stock ?? 0,
    inventoryCost: stock?.inventory_cost ?? 0,
    lowStockProducts,
    recentSales,
  };
}
