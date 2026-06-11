/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1D6AE5',
        secondary: '#0EA5A0',
        warning: '#F59E0B',
        danger: '#EF4444',
        success: '#10B981',
        bg: '#F4F6FA',
        surface: '#FFFFFF',
        border: '#E8ECF2',
        text: '#1A1A2E',
        subtext: '#8A94A6',
        disabled: '#C8CDD6',
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
