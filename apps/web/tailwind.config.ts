import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F17',
        surface: '#111827',
        surfaceBorder: '#1F2937',
        brand: {
          blue: '#0070BA',
          lightBlue: '#003087',
          accent: '#00CFDE',
        },
      },
    },
  },
  plugins: [],
};
export default config;
