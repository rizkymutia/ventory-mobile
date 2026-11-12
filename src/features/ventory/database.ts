import type { SQLiteDatabase } from 'expo-sqlite';

export type Product = {
  id: number;
  name: string;
  sku: string | null;
  purchase_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
};

// Migration additive: tabel produk lama dan datanya dipertahankan.
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0),
      sku TEXT UNIQUE,
      purchase_price INTEGER NOT NULL DEFAULT 0 CHECK(purchase_price >= 0),
      selling_price INTEGER NOT NULL DEFAULT 0 CHECK(selling_price >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
      min_stock INTEGER NOT NULL DEFAULT 0 CHECK(min_stock >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_amount INTEGER NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
      gross_profit INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
      unit_cost INTEGER NOT NULL CHECK(unit_cost >= 0),
      line_total INTEGER NOT NULL CHECK(line_total >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
  `);
}
