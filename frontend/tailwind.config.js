/** @type {import('tailwindcss').Config} */
export default {
  // CRITICAL: Tells Tailwind where to find and scan your component files 
  // for classes, so it knows which CSS to generate.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  
  // NOTE: We are NOT using the native Tailwind dark mode system.
  // The dark mode is controlled entirely by your custom CSS variables 
  // and the [data-theme='dark'] selector.
  // If you were using the native dark mode (e.g., dark:bg-black), 
  // you would set darkMode: 'class', or darkMode: 'media'.
  
  theme: {
    extend: {
      // You can define custom colors, fonts, etc., here if needed later.
    },
  },
  plugins: [],
}