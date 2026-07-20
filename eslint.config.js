// @ts-check
import tseslint from 'typescript-eslint';

/**
 * Flat config. The load-bearing rule is the import boundary that keeps `cutout-engine/` DOM-free
 * (docs/02 §7): it must not import from designer/ or reference DOM globals. Enforced via
 * no-restricted-imports here; a stricter graph rule can be added later.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'test/golden/expected/**'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // `_`-prefixed args mark intentionally-unused params (stubs, interface conformance).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        // No raw HTML injection anywhere (docs/11 §3 — XSS discipline).
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'No innerHTML — render user/catalog text as text nodes (docs/11 §3).',
        },
      ],
    },
  },
  {
    // Plain JS (config, scripts) is not part of the TS project — lint untyped.
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // cutout-engine must stay pure (docs/02 §7): no DOM, no sibling UI imports.
    files: ['src/cutout-engine/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/designer/**', '**/media/**'] }],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'cutout-engine is DOM-free; inject the canvas (docs/02 §7).' },
        { name: 'document', message: 'cutout-engine is DOM-free; inject the canvas (docs/02 §7).' },
      ],
    },
  },
);
