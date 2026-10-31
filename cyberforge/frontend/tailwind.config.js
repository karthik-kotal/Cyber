/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verdict palette shared across the app (values shown are UI colors only;
        // verdicts themselves always come from the backend).
        verdict: {
          knownScam: '#dc2626', // red-600
          suspicious: '#f59e0b', // amber-500
          noReports: '#16a34a', // green-600
          verifiedBusiness: '#2563eb', // blue-600
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
