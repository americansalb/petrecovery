/**
 * Process gate: NO undefined identifiers on the render surfaces.
 *
 * This is the test that would have caught the two crashes that reached
 * production because nothing linted for undefined references:
 *   - `Dog is not defined`  (a missing icon import crashed the add-pet wizard)
 *   - `Pill is not defined` (the medication-icon fallback referenced an
 *      unimported icon and crashed for any unmapped icon token)
 *
 * It runs ESLint's `no-undef` + `react/jsx-no-undef` over pages, layouts and
 * components only, with its own minimal config. Scoped deliberately: a precise
 * correctness gate, not a style linter that would fail on the wider codebase.
 */

const path = require('path');
const { ESLint } = require('eslint');

const ROOT = path.resolve(__dirname, '..');

test('render surfaces (pages, layouts, components) have no undefined identifiers', async () => {
  const eslint = new ESLint({
    cwd: ROOT,
    useEslintrc: false,
    errorOnUnmatchedPattern: false,
    overrideConfig: {
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
      env: { browser: true, node: true, es2021: true },
      plugins: ['react'],
      settings: { react: { version: '18' } },
      rules: {
        'no-undef': 'error',
        'react/jsx-no-undef': 'error',
        'react/jsx-uses-vars': 'error',
        'react/jsx-uses-react': 'error',
      },
    },
  });

  const results = await eslint.lintFiles([
    'app/**/page.js', 'app/**/layout.js', 'app/**/error.js', 'app/**/loading.js',
    'app/components/**/*.js', 'app/components/**/*.jsx',
    'components/**/*.js', 'components/**/*.jsx',
  ]);

  const GATED = new Set(['no-undef', 'react/jsx-no-undef']);
  const failures = [];
  for (const r of results) {
    if (/__tests__|\.test\./.test(r.filePath)) continue;
    for (const m of r.messages) {
      if (m.severity === 2 && GATED.has(m.ruleId)) {
        failures.push(`${path.relative(ROOT, r.filePath)}:${m.line}  ${m.ruleId}  ${m.message}`);
      }
    }
  }

  if (failures.length) {
    throw new Error(
      `Undefined identifier(s) on render surfaces — these crash the page at runtime:\n  ${failures.join('\n  ')}`
    );
  }
}, 120000);
