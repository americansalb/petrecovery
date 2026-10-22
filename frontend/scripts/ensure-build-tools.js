#!/usr/bin/env node
/**
 * Make sure the build-time tools are installed before `next build`.
 *
 * tailwindcss, postcss and autoprefixer are devDependencies: they turn the
 * CSS into plain CSS during the build and nothing at runtime loads them.
 * Keeping them out of `dependencies` keeps their sub-packages (braces,
 * micromatch, chokidar) out of `npm audit --omit=dev`, which
 * scripts/audit-gate.js fails closed on.
 *
 * An install run with NODE_ENV=production skips devDependencies. If the
 * host's build did that, install them here so the build cannot fail on a
 * missing tailwindcss. When they are already present this does nothing.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const BUILD_TOOLS = ['tailwindcss', 'postcss', 'autoprefixer'];
const root = path.join(__dirname, '..');

function missingTools() {
  return BUILD_TOOLS.filter((name) => {
    try {
      require.resolve(`${name}/package.json`, { paths: [root] });
      return false;
    } catch {
      return true;
    }
  });
}

const missing = missingTools();
if (missing.length) {
  console.log(`Build tools not installed (${missing.join(', ')}); installing devDependencies.`);
  execFileSync('npm', ['install', '--include=dev', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
  const still = missingTools();
  if (still.length) {
    console.error(`Still missing after install: ${still.join(', ')}`);
    process.exit(1);
  }
}
