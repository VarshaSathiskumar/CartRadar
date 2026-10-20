import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F7F4',
  card: '#FFFFFF',
  text: '#16221A',
  muted: '#68746C',
  border: '#E1E5DF',
  accent: '#1F8A4C',
  accentText: '#FFFFFF',
  warn: '#B45309',
  warnBg: '#FEF3C7',
  danger: '#B91C1C',
};
const dark: typeof light = {
  bg: '#0E1411',
  card: '#18211C',
  text: '#EAF1EC',
  muted: '#93A399',
  border: '#27332B',
  accent: '#3DBE72',
  accentText: '#07140C',
  warn: '#FBBF24',
  warnBg: '#3A2D0A',
  danger: '#F87171',
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light);
