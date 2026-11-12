// Data contoh untuk pengembangan UI. Belum merupakan penyimpanan transaksi.
export type Product = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minimumStock: number;
};
export type Sale = {
  id: string;
  productId: string;
  quantity: number;
  priceAtSale: number;
  costAtSale: number;
  daysAgo: number;
};
export const products: Product[] = [
  { id: 'kopi', name: 'Kopi Susu Botol', unit: 'botol', stock: 24, minimumStock: 10 },
  { id: 'keripik', name: 'Keripik Singkong', unit: 'bungkus', stock: 18, minimumStock: 8 },
  { id: 'sambal', name: 'Sambal Bawang', unit: 'botol', stock: 5, minimumStock: 8 },
  { id: 'teh', name: 'Teh Melati', unit: 'botol', stock: 30, minimumStock: 10 },
  { id: 'cookies', name: 'Cookies Cokelat', unit: 'bungkus', stock: 4, minimumStock: 6 },
];
export const sales: Sale[] = [
  { id: 'DG-0001', productId: 'kopi', quantity: 3, priceAtSale: 15000, costAtSale: 8500, daysAgo: 6 },
  { id: 'DG-0002', productId: 'sambal', quantity: 4, priceAtSale: 25000, costAtSale: 15000, daysAgo: 5 },
  { id: 'DG-0003', productId: 'keripik', quantity: 5, priceAtSale: 12000, costAtSale: 7000, daysAgo: 4 },
  { id: 'DG-0004', productId: 'cookies', quantity: 6, priceAtSale: 18000, costAtSale: 11000, daysAgo: 3 },
  { id: 'DG-0005', productId: 'kopi', quantity: 5, priceAtSale: 15000, costAtSale: 8500, daysAgo: 2 },
  { id: 'DG-0006', productId: 'teh', quantity: 10, priceAtSale: 8000, costAtSale: 3500, daysAgo: 1 },
  { id: 'DG-0007', productId: 'sambal', quantity: 3, priceAtSale: 25000, costAtSale: 15000, daysAgo: 0 },
  { id: 'DG-0008', productId: 'kopi', quantity: 2, priceAtSale: 15000, costAtSale: 8500, daysAgo: 0 },
];
export const expenses = [
  { id: 'E-001', label: 'Transportasi', amount: 15000 },
  { id: 'E-002', label: 'Listrik', amount: 20000 },
];
export const summary = {
  revenue: sales.reduce((sum, sale) => sum + sale.quantity * sale.priceAtSale, 0),
  cogs: sales.reduce((sum, sale) => sum + sale.quantity * sale.costAtSale, 0),
  expenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
  transactionCount: sales.length,
};
export const profit = summary.revenue - summary.cogs - summary.expenses;
export const lowStock = products.filter((product) => product.stock <= product.minimumStock);
export const ranking = products
  .map((product) => ({
    ...product,
    sold: sales.filter((sale) => sale.productId === product.id).reduce((sum, sale) => sum + sale.quantity, 0),
  }))
  .sort((a, b) => b.sold - a.sold);
export const dailySales = Array.from({ length: 7 }, (_, index) => {
  const daysAgo = 6 - index;
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    label: date.toLocaleDateString('id-ID', { weekday: 'short' }),
    amount: sales.filter((sale) => sale.daysAgo === daysAgo).reduce((sum, sale) => sum + sale.quantity * sale.priceAtSale, 0),
  };
});
