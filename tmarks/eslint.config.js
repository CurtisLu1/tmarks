import js from '@eslint/js';
import globals from 'globals';
import next from '@next/eslint-plugin-next';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      '.next',
      'out',
      '.deploy',
      'dist',
      'dist-ssr',
      'build',
      '**/*.config.js',
      '**/*.config.ts',
      'vite.config.ts',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {
      '@next/next': next,
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...next.configs['core-web-vitals'].rules,
    },
  },
);
