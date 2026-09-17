/**
 * The additive half of a schema change, and only the additive half.
 *
 * `prisma db push` applies a schema whole or not at all. When one change
 * in it would lose data Prisma refuses, correctly, and NOTHING lands:
 * every new table and every new column behind that one change stays
 * missing, on that deploy and on every deploy after it. The database
 * falls further behind the code every time, silently, and the only
 * symptom is one endpoint answering 500 while the rest of the site looks
 * fine. That is what happened to this one: `GeoProfile.accountId` has
 * been missing since the game got its own accounts.
 *
 * So this exists to apply what is safe and leave what is not.
 *
 * ADD COLUMN, CREATE TABLE, CREATE INDEX and ADD CONSTRAINT cannot
 * destroy anything: the worst a failure does is leave the database
 * exactly as it was. DROP, RENAME, a type change and SET NOT NULL can,
 * so none of them is ever run here, whatever the schema says. Prisma's
 * own diff often puts both in one ALTER TABLE, so the actions inside one
 * are split and filtered rather than the whole statement being thrown
 * away for the company it keeps.
 *
 * Nothing here ever passes --accept-data-loss, and nothing here ever
 * runs a statement it has not first proved to be additive.
 */

const { spawnSync } = require('node:child_process');

/** Statements that can only ever add. Anything else is left alone. */
const ADDITIVE_STATEMENT = /^\s*(CREATE\s+(TABLE|UNIQUE\s+INDEX|INDEX|TYPE|SEQUENCE|SCHEMA)\b|COMMENT\s+ON\b)/i;
/** Actions inside an ALTER TABLE that can only ever add. */
const ADDITIVE_ACTION = /^\s*ADD\s+(COLUMN\b|CONSTRAINT\b)/i;
const ALTER_TABLE = /^\s*ALTER\s+TABLE\s+((?:"[^"]*"|[\w.]+)(?:\s*\.\s*(?:"[^"]*"|[\w.]+))?)\s+([\s\S]+)$/i;

/**
 * Split on a separator that is not inside brackets or a quoted string.
 *
 * Splitting naively is how a default containing the separator, say
 * DEFAULT 'a;b', turns one statement into two half-statements. Neither
 * half can destroy anything - the first fails as a syntax error, the
 * second matches nothing and is skipped - but a boot log full of
 * syntax errors hides the real one, so it is worth getting right.
 */
function splitTop(text, sep) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of text) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** The actions inside one ALTER TABLE. */
function splitActions(text) {
  return splitTop(text, ',');
}

/** Statements in a SQL script, comments and blank lines dropped. */
function statements(sql) {
  const withoutComments = String(sql)
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  return splitTop(withoutComments, ';')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The additive statements of a script, rewritten where an ALTER TABLE
 * mixes additions with something destructive. Returns
 * { apply: string[], skip: string[] }.
 */
function additiveOnly(sql) {
  const apply = [];
  const skip = [];
  for (const statement of statements(sql)) {
    if (ADDITIVE_STATEMENT.test(statement)) {
      // A CREATE cannot carry a DROP, but a belt-and-braces check costs
      // nothing and this is running against somebody's live data.
      if (/\bDROP\b/i.test(statement)) skip.push(statement);
      else apply.push(statement);
      continue;
    }
    const alter = ALTER_TABLE.exec(statement);
    if (!alter) {
      skip.push(statement);
      continue;
    }
    const [, table, body] = alter;
    const actions = splitActions(body);
    const safe = actions.filter((a) => ADDITIVE_ACTION.test(a) && !/\bDROP\b/i.test(a));
    if (!safe.length) {
      skip.push(statement);
      continue;
    }
    const unsafe = actions.filter((a) => !safe.includes(a));
    if (unsafe.length) {
      // Only the destructive half is named as not run. Printing the
      // whole statement here would say the additions were skipped too,
      // when they are three lines above under APPLIED, and somebody
      // reading a deploy log has no other way to know which it was.
      skip.push(`ALTER TABLE ${table} ${unsafe.join(', ').trim()}`);
    }
    // IF NOT EXISTS so a re-run is a no-op rather than an error. Prisma
    // does not emit it and a deploy may well run this twice.
    const idempotent = safe.map((a) => a.replace(/^\s*ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/i, 'ADD COLUMN IF NOT EXISTS '));
    apply.push(`ALTER TABLE ${table} ${idempotent.join(', ').trim()}`);
  }
  return { apply, skip };
}

/** The SQL that would bring the database up to the schema. Read only. */
function pendingSql(env = process.env) {
  const diff = spawnSync(
    'npx',
    ['prisma', 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
    { encoding: 'utf8', env }
  );
  return diff.status === 0 ? String(diff.stdout || '') : '';
}

/** Run one statement. Returns { ok, error }. */
function execute(statement, env = process.env) {
  const run = spawnSync('npx', ['prisma', 'db', 'execute', '--url', env.DATABASE_URL, '--stdin'], {
    input: `${statement};`,
    encoding: 'utf8',
    env,
  });
  return { ok: run.status === 0, error: run.status === 0 ? '' : String(run.stderr || run.stdout || '').trim() };
}

/**
 * Bring the database as far forward as can be done without destroying
 * anything. Returns what it did.
 */
function repair(env = process.env) {
  const sql = pendingSql(env);
  if (!sql.trim()) return { pending: '', applied: [], failed: [], skipped: [] };
  const { apply, skip } = additiveOnly(sql);
  const applied = [];
  const failed = [];
  for (const statement of apply) {
    const { ok, error } = execute(statement, env);
    if (ok) applied.push(statement);
    else failed.push({ statement, error });
  }
  return { pending: sql.trim(), applied, failed, skipped: skip };
}

module.exports = { additiveOnly, splitTop, splitActions, statements, pendingSql, execute, repair };
