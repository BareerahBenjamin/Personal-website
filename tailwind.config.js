/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        bbs: ['"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [
    equire('@tailwindcss/typography'),
  ],
}
