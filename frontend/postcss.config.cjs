// This file should be renamed to postcss.config.cjs for compatibility with Vite + ESM
module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('autoprefixer'),
  ],
}; 