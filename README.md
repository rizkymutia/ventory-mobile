<div align="center">

# dagangin.

**Offline-first sales and inventory management for small businesses.**

A mobile-first point-of-sale (POS) and stock management app built with **Expo**, **React Native**, **TypeScript**, and **SQLite**.

[![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.88-087EA4?logo=react&logoColor=white)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/Storage-Local%20SQLite-003B57?logo=sqlite&logoColor=white)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**Project stage:** Functional MVP · Active development · Not yet a production release

</div>

## Overview

**Ventory** helps Indonesian micro and small business owners record sales, manage product stock, and see basic business performance without depending on an internet connection.

Instead of separating sales notes and inventory records, the app connects them: a completed sale is saved locally and its items are deducted from stock in the **same database transaction**.

> The app interface is in Bahasa Indonesia. Monetary values are displayed in Indonesian rupiah (IDR).

## Features

| Module | Current implementation | Status |
| --- | --- | --- |
| Dashboard | Daily revenue, gross profit, transaction count, units sold, inventory value, low-stock alerts, and recent sales | ✅ Available |
| Products | Add, view, search, edit, and delete products; SKU, purchase/selling prices, stock, and minimum stock | ✅ Available |
| Sales | Product selection, cart, quantity adjustments, checkout confirmation, and recent transaction history | ✅ Available |
| Inventory deduction | Validates available stock and deducts quantities when a sale is recorded | ✅ Available |
| Local persistence | SQLite database stored on the device; no cloud connection required for core flows | ✅ Available |
| Financial reports | Date-based summaries, charts, and period comparisons | 🚧 Planned |
| Operating expenses | Expense categories and create/edit/delete records | 🚧 Planned |
| Backup and sync | Export/import, cloud backup, and multi-device synchronization | 🚧 Planned |
| Authentication | User accounts and protected access | 🚧 Planned |

**Accounting note:** The displayed gross profit is calculated from recorded selling prices minus recorded product purchase costs. It is **not** net profit: operating expenses, taxes, discounts, returns, and other adjustments are not yet included.

## How it works

1. **Add products** with their names, prices, starting stock, and low-stock thresholds.
2. **Create a sale** by choosing products and quantities.
3. **Confirm checkout.** Ventory verifies stock availability, saves the sale and its line items, and decreases inventory inside one SQLite transaction.
4. **Review the dashboard.** Daily totals and stock warnings are recalculated from stored records whenever the dashboard is opened.

For example, selling 2 units of an item priced at Rp75,000 each, with a purchase cost of Rp60,000, records **Rp150,000 revenue**, **Rp30,000 gross profit**, and a **2-unit stock deduction**.

## Tech stack

| Layer | Technology |
| --- | --- |
| Mobile UI | React Native, React 19, TypeScript |
| Framework | Expo SDK 58 |
| Navigation | Expo Router, native tabs |
| Persistence | `expo-sqlite` |
| Icons | `@expo/vector-icons` and platform-native tab symbols |
| Platforms | Android / iOS development through Expo Go (native flows) |

### Data model

- `products`: product details, SKU, cost, selling price, current stock, and minimum stock.
- `sales`: transaction timestamp, total revenue, and recorded gross profit.
- `sale_items`: product name, quantity, unit price, unit cost, and line total captured at the time of sale.

Using stored item price/cost snapshots means existing sales retain their original recorded values when a product price changes later.

## Getting started

### Prerequisites

- **Node.js 22.13+ (22.x)** or **24.3+ (24.x)**; Node.js 24 LTS is recommended
- npm
- Expo Go on an Android/iOS device, or a supported simulator/emulator

### Install and run

```bash
git clone https://github.com/rizkymutia/ventory-mobile.git
cd ventory-mobile
npm ci
npx expo start --clear
```

Scan the development server's QR code using **Expo Go**. For a physical device, the computer and phone typically need to be on the same network.

**Windows PowerShell tip:** If your system blocks `npm.ps1` or `npx.ps1`, use `npm.cmd ci` and `npx.cmd expo start --clear` instead.

### Type-check

```bash
npx tsc --noEmit
```

The repository uses Expo Router typed routes; starting the Expo development server regenerates route types when needed.

## Project structure

```text
src/
├── app/
│   ├── _layout.tsx         # SQLite provider + app navigation
│   ├── index.tsx           # Live dashboard
│   ├── penjualan.tsx       # Sales and transaction history
│   ├── produk.tsx          # Product CRUD and stock
│   ├── laporan.tsx         # Reports placeholder
│   └── lainnya.tsx         # Additional modules placeholder
├── components/
│   ├── app-tabs.tsx        # Native tab navigation
│   └── app-tabs.web.tsx    # Web-specific tab implementation
└── features/
    └── dagangin/
        ├── database.ts     # SQLite schema and initialization
        ├── sales.ts        # Sales, stock updates, and summary queries
        ├── screen.tsx      # Shared screen components
        └── theme.ts       # Design tokens
```

## Current limitations

- **Local-only storage:** Business data remains on the device. There is no automatic cloud backup; uninstalling or clearing app data can remove records.
- **Native-first checkout:** The sale-saving flow uses SQLite's exclusive transaction API and is currently intended for Expo Go on Android/iOS; web checkout is not supported by this implementation.
- **No authentication or multi-user access** in the current MVP.
- **Stock adjustments are not yet audited** as separate stock-movement records, and expenses/returns are not yet modeled.
- **Not production-hardened:** Automated tests, data export/restore, and distribution builds are future work.

## Roadmap

- [x] Core UI and five-tab navigation
- [x] Product CRUD with local SQLite storage
- [x] Sales entry, transaction history, and automatic stock deduction
- [x] Dashboard using stored sales and inventory data
- [ ] Expense tracking and categories
- [ ] Period-based financial reports and charts
- [ ] Stock movement history and adjustment audit
- [ ] Backup / restore and data migration safeguards
- [ ] Automated tests and release-readiness checks
- [ ] Optional authentication and cloud synchronization

See [Issues](https://github.com/rizkymutia/ventory-mobile/issues) for upcoming development tasks.

## Development status

The initial MVP was implemented locally before the repository was made public. Subsequent features will be developed in dedicated branches and documented through commits, pull requests, and milestones.

To report a bug or suggest an improvement, [open an issue](https://github.com/rizkymutia/ventory-mobile/issues/new).

## License

Distributed under the [MIT License](LICENSE).
