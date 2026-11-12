import { DemoLabel, Header, Screen, StageNote } from '../features/ventory/screen';
export default function ReportsScreen() {
  return <Screen><Header title="Laporan usaha" subtitle="Pahami hasil usaha dari catatan sehari-hari." /><StageNote icon="bar-chart-outline" title="Laporan mengikuti transaksi" description="Tahap berikutnya menghubungkan penjualan, HPP, dan pengeluaran dengan laporan periode. Laba operasional serta arus kas akan ditampilkan secara terpisah." /><DemoLabel /></Screen>;
}
