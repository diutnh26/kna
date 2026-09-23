/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      /**
       * The KNĂ palette, named.
       *
       * The five accents read from custom properties registered with
       * @property in index.css, so changing data-ethnicity on the wrapper
       * interpolates every one of them at once. Bone, Ink and Sage are
       * literals: they belong to the product, not to the culture on screen,
       * and holding them still is what keeps a switch from looking like a
       * different website.
       *
       * `<alpha-value>` is required for the slash-opacity syntax to work on
       * a var-backed colour — without it `text-copper/70` silently drops
       * the alpha. Hence rgb(from …) rather than a bare var().
       */
      colors: {
        kteh: 'rgb(from var(--c-kteh) r g b / <alpha-value>)',
        'kteh-hover': 'rgb(from var(--c-kteh-hover) r g b / <alpha-value>)',
        copper: 'rgb(from var(--c-copper) r g b / <alpha-value>)',
        amber: 'rgb(from var(--c-amber) r g b / <alpha-value>)',
        deep: 'rgb(from var(--c-deep) r g b / <alpha-value>)',

        bone: '#F5EDDD',
        ink: '#1A1614',
        'ink-raised': '#241F1C',
        sage: '#8FA37B',
      },
    },
  },
  plugins: [],
};
