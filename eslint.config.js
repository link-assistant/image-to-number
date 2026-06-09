import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        // Node.js 18+ globals
        fetch: 'readonly',
        AbortController: 'readonly',
        // Runtime-specific globals
        Bun: 'readonly',
        Deno: 'readonly',
      },
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // Code quality rules
      'no-unused-vars': 'error',
      'no-console': 'off', // Allow console in this project
      'no-debugger': 'error',

      // Best practices
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-duplicate-imports': 'error',

      // ES6+ features
      'arrow-body-style': ['error', 'as-needed'],
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',

      // Async/await
      'no-async-promise-executor': 'error',
      'require-await': 'warn',

      // Comments and documentation
      'spaced-comment': ['error', 'always', { markers: ['/'] }],

      // Complexity rules - reasonable thresholds for maintainability
      complexity: ['warn', 15],
      'max-depth': ['warn', 5],
      'max-lines-per-function': [
        'warn',
        {
          max: 150,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-params': ['warn', 6],
      'max-statements': ['warn', 60],
      'max-lines': ['error', 1500],
    },
  },
  {
    // Test files have different requirements
    files: ['tests/**/*.mjs', '**/*.test.mjs'],
    rules: {
      'require-await': 'off', // Async functions without await are common in tests
    },
  },
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      'coverage/**',
      'dist/**',
      '**/dist/**',
      '**/out/**',
      '*.min.js',
      '.eslintcache',
      // Scratch/experiment scripts are not held to lint standards.
      'experiments/**',
      // Case study raw data files (downloaded from external sources)
      'docs/case-studies/*/data/**',
    ],
  },
];
