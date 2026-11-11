export const colors = {
  background: '#F5F7F2',
  surface: '#FFFFFF',
  ink: '#193C31',
  muted: '#74857A',
  primary: '#176650',
  forest: '#113F34',
  lime: '#DCEAAA',
  soft: '#EBF1E4',
  line: '#E4EADF',
  warning: '#9A6728',
  warningBackground: '#FCF0DE',
};

export function rupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}
