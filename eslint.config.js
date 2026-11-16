import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from 'eslint-config-next';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      '.next/',
      'out/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'dist/',
      'build/',
      'public/pdf.worker.min.mjs',
      '*.config.*',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-vars': 'off',
      'react/no-unescaped-entities': 'off',
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-unused-expressions': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'warn',
    },
  }
);
