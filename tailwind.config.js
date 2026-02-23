/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#0ea5e9',
                    dark: '#0284c7',
                },
                secondary: '#6366f1',
                accent: '#f43f5e',
                dark: '#0f172a',
            }
        },
    },
    plugins: [],
}
