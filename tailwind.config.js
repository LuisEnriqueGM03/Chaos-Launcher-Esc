/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lava: {
          bg: '#0a0606',
          sidebar: '#110808',
          card: '#1a0d0d',
          border: '#331010',
          hover: '#261111',
          red: '#ff1e1e',
          crimson: '#dc143c',
          fire: '#ff5500',
          orange: '#ff7700',
          amber: '#ffaa00',
        },
        chaos: {
          dark: '#0a0606',
          card: '#140a0a',
          border: '#2b1010',
          red: '#ff2222',
          orange: '#ff6600',
          green: '#22c55e',
        }
      },
      boxShadow: {
        'neon-red': '0 0 20px rgba(255, 30, 30, 0.5)',
        'neon-fire': '0 0 25px rgba(255, 85, 0, 0.55)',
        'neon-amber': '0 0 25px rgba(255, 170, 0, 0.55)',
        'neon-green': '0 0 20px rgba(34, 197, 94, 0.45)',
        'minecraft-btn': 'inset -2px -4px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.25)',
      },
      animation: {
        'lava-flow': 'lavaFlow 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        lavaFlow: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '0.25' },
          '50%': { transform: 'scale(1.1) rotate(2deg)', opacity: '0.45' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 15px rgba(255, 40, 40, 0.8))' },
          '50%': { opacity: '0.85', filter: 'drop-shadow(0 0 5px rgba(255, 40, 40, 0.3))' },
        }
      }
    },
  },
  plugins: [],
}
