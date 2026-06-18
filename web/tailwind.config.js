/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // 设计系统色板：深空蓝主色 + 青柠绿强调色
      colors: {
        // 深空蓝背景层级
        space: {
          900: '#0B1220', // 主背景
          800: '#0F172A', // 次背景
          700: '#1E293B', // 卡片背景
          600: '#334155', // 边框/分割
        },
        // 青柠绿强调色
        lime: {
          400: '#A3E635',
          500: '#84CC16',
        },
      },
      fontFamily: {
        // 标题显示字体
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        // 正文字体
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        // 等宽字体（代码预览）
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
