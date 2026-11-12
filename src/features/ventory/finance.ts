import type { SQLiteDatabase } from 'expo-sqlite';

export const EXPENSE_CATEGORIES = [
  'Operasional',
  'Listrik & Internet',
  'Transportasi',
  'Sewa',
  'Gaji',
  'Lainnya',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ReportPeriod = 'today' | 'week' | 'month';

export type Expense = {
  id: number;
  category: string;
  amount: number;
  note: string;
  expense_date: string;
  created_at: number;
  updated_at: number;
};

export type ExpenseInput = {
  category: ExpenseCategory;
  amount: number;
  note: string;
  expense_date: string;
};

export type FinancialReport = {
  label: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operationalExpenses: number;
  operatingProfit: number;
  transactions: number;
  unitsSold: number;
  expensesCount: number;
  expenseCategories: { category: string; total: number }[];
  recentExpenses: Expense[];
  /** Tren tujuh hari kalender lokal terakhir, terlepas dari filter ringkasan. */
  trend: { day: string; revenue: number; expenses: number }[];
};

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return y >= 2000 && y <= 2100 &&
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function bounds(period: ReportPeriod) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const start = period === 'today'
    ? new Date(y, m, d)
    : period === 'week'
      ? new Date(y, m, d - 6)
      : new Date(y, m, 1);
  const end = new Date(y, m, d + 1);
  return {
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
    startDate: localDateKey(start),
    endDate: localDateKey(end), // exclusive
    label: period === 'today' ? 'Hari ini' : period === 'week' ? '7 hari terakhir' : 'Bulan ini',
  };
}

function assertExpense(input: ExpenseInput): void {
  if (!EXPENSE_CATEGORIES.includes(input.category)) {
    throw new Error('Kategori pengeluaran tidak valid.');
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error('Nominal harus bilangan bulat lebih dari 0.');
  }
  if (input.note.trim().length > 200) {
    throw new Error('Keterangan maksimal 200 karakter.');
  }
  if (!isValidDateKey(input.expense_date)) {
    throw new Error('Tanggal harus valid dengan format YYYY-MM-DD.');
  }
}

export async function saveExpense(
  db: SQLiteDatabase,
  input: ExpenseInput,
  id: number | null = null
): Promise<void> {
  assertExpense(input);
  const now = Math.floor(Date.now() / 1000);
  const note = input.note.trim();
  if (id === null) {
    await db.runAsync(
      `INSERT INTO expenses (category, amount, note, expense_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.category, input.amount, note, input.expense_date, now, now
    );
  } else {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('ID tidak valid.');
    const result = await db.runAsync(
      `UPDATE expenses SET category = ?, amount = ?, note = ?, expense_date = ?, updated_at = ?
       WHERE id = ?`,
      input.category, input.amount, note, input.expense_date, now, id
    );
    if (result.changes !== 1) throw new Error('Pengeluaran tidak ditemukan.');
  }
}

export async function deleteExpense(db: SQLiteDatabase, id: number): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('ID tidak valid.');
  const result = await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
  if (result.changes !== 1) throw new Error('Pengeluaran tidak ditemukan.');
}

type SalesSum = { revenue: number; gross_profit: number; transactions: number };
type UnitsSum = { units: number };
type ExpenseSum = { amount: number; count: number };
type CategorySum = { category: string; total: number };
type SalesTrendRow = { created_at: number; total_amount: number };
type ExpenseTrendRow = { expense_date: string; amount: number };

export async function getFinancialReport(
  db: SQLiteDatabase,
  period: ReportPeriod
): Promise<FinancialReport> {
  const p = bounds(period);
  const today = new Date();
  const trendStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const trendStartDate = localDateKey(trendStart);
  const trendStartUnix = Math.floor(trendStart.getTime() / 1000);

  const [saleTotals, unitTotals, expenseTotals, expenseCategories, recentExpenses, saleTrend, expenseTrend] =
    await Promise.all([
      db.getFirstAsync<SalesSum>(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue,
                COALESCE(SUM(gross_profit), 0) AS gross_profit,
                COUNT(*) AS transactions
         FROM sales WHERE created_at >= ? AND created_at < ?`,
        p.startUnix, p.endUnix
      ),
      db.getFirstAsync<UnitsSum>(
        `SELECT COALESCE(SUM(si.quantity), 0) AS units
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE s.created_at >= ? AND s.created_at < ?`,
        p.startUnix, p.endUnix
      ),
      db.getFirstAsync<ExpenseSum>(
        `SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
         FROM expenses WHERE expense_date >= ? AND expense_date < ?`,
        p.startDate, p.endDate
      ),
      db.getAllAsync<CategorySum>(
        `SELECT category, SUM(amount) AS total FROM expenses
         WHERE expense_date >= ? AND expense_date < ?
         GROUP BY category ORDER BY total DESC`,
        p.startDate, p.endDate
      ),
      db.getAllAsync<Expense>(
        `SELECT * FROM expenses
         WHERE expense_date >= ? AND expense_date < ?
         ORDER BY expense_date DESC, created_at DESC, id DESC LIMIT 100`,
        p.startDate, p.endDate
      ),
      db.getAllAsync<SalesTrendRow>(
        `SELECT created_at, total_amount FROM sales
         WHERE created_at >= ? AND created_at < ?`,
        trendStartUnix, p.endUnix
      ),
      db.getAllAsync<ExpenseTrendRow>(
        `SELECT expense_date, amount FROM expenses
         WHERE expense_date >= ? AND expense_date < ?`,
        trendStartDate, p.endDate
      ),
    ]);

  const trend: FinancialReport['trend'] = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(trendStart.getFullYear(), trendStart.getMonth(), trendStart.getDate() + i);
    return { day: localDateKey(day), revenue: 0, expenses: 0 };
  });
  const trendIndex = new Map(trend.map((day, i) => [day.day, i]));
  for (const item of saleTrend) {
    const index = trendIndex.get(localDateKey(new Date(item.created_at * 1000)));
    if (index !== undefined) trend[index].revenue += item.total_amount;
  }
  for (const item of expenseTrend) {
    const index = trendIndex.get(item.expense_date);
    if (index !== undefined) trend[index].expenses += item.amount;
  }

  const revenue = saleTotals?.revenue ?? 0;
  const grossProfit = saleTotals?.gross_profit ?? 0;
  const operationalExpenses = expenseTotals?.amount ?? 0;
  return {
    label: p.label,
    revenue,
    costOfGoodsSold: revenue - grossProfit,
    grossProfit,
    operationalExpenses,
    operatingProfit: grossProfit - operationalExpenses,
    transactions: saleTotals?.transactions ?? 0,
    unitsSold: unitTotals?.units ?? 0,
    expensesCount: expenseTotals?.count ?? 0,
    expenseCategories,
    recentExpenses,
    trend,
  };
}
