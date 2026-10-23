import type { Config } from 'tailwindcss'

// Tokens de la guía de estilo (docs/especificacion.md → "Guía de estilo").
// No agregar colores ni tamaños que no estén en la guía.
const bounce = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: { 900: '#1D1133', 800: '#2A1A4A' },
        brand: { 600: '#6520A0', 400: '#9B5CF0' },
        surface: { DEFAULT: '#FFFFFF', alt: '#F3EEFB' },
        ink: { DEFAULT: '#1A1030', muted: '#6B6283' },
        'on-night': { DEFAULT: '#FFFFFF', muted: '#C9BEE6' },
        sun: '#FFD23F',
        vote: '#FF4F8B',
        sky: '#2EC4E6',
        success: '#3DDC84',
        danger: '#FF5A5F',
        medal: { gold: '#FFC233', silver: '#C7CEDB', bronze: '#D98A4E' },
      },
      fontFamily: {
        display: ['"Lilita One"', 'system-ui', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['40px', { lineHeight: '1.1', letterSpacing: '0.02em' }],
        'page-title-sm': ['28px', { lineHeight: '1.1', letterSpacing: '0.02em' }],
        'section-title': ['24px', { lineHeight: '1.2' }],
        'card-title': ['18px', { lineHeight: '1.3', fontWeight: '800' }],
        body: ['16px', { lineHeight: '1.5', fontWeight: '600' }],
        secondary: ['14px', { lineHeight: '1.4', fontWeight: '600' }],
        label: ['12px', { lineHeight: '1.2', fontWeight: '800' }],
        'vote-card': ['28px', { lineHeight: '1' }],
        'vote-winner': ['48px', { lineHeight: '1' }],
        'rank-position': ['32px', { lineHeight: '1' }],
        'winner-title': ['48px', { lineHeight: '1.1' }],
      },
      borderWidth: { 3: '3px', 6: '6px' },
      borderRadius: { card: '20px', btn: '14px', img: '12px' },
      boxShadow: {
        btn: '0 6px 0 #1A1030',
        'btn-sm': '0 4px 0 #1A1030',
        'btn-pressed': '0 2px 0 #1A1030',
        card: '0 8px 0 rgba(0,0,0,0.35)',
      },
      opacity: { 6: '0.06', 45: '0.45', 92: '0.92' },
      maxWidth: { modal: '480px' },
      aspectRatio: { card: '16 / 10' },
      backgroundImage: {
        party: 'linear-gradient(160deg, #1D1133 0%, #3A1670 55%, #6520A0 100%)',
      },
      transitionTimingFunction: { bounce },
      keyframes: {
        pop: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.25)' },
        },
        'enter-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-in': {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        // Sugiere que el cajón oculto se puede desplegar hacia la derecha.
        nudge: {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(4px)' },
        },
        beat: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0.45' },
        },
        confetti: {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        pop: `pop 200ms ${bounce}`,
        // backwards: al terminar no retiene el transform, así funciona el hover que sube la tarjeta.
        'enter-up': 'enter-up 250ms ease-out backwards',
        'bounce-in': `bounce-in 250ms ${bounce} both`,
        'fade-in': 'fade-in 200ms ease-out both',
        nudge: `nudge 800ms ${bounce} infinite`,
        beat: 'beat 1.2s ease-in-out infinite',
        confetti: 'confetti 2.4s ease-in 1 forwards',
      },
    },
  },
  plugins: [],
} satisfies Config
