// Refuses to let a WRITE test run against the production database.
//
// The test harnesses in this directory create users, cook profiles and orders and
// mutate rows. They were only ever safe because backend/.env pointed at a
// development database — which is not obvious from reading them, and stopped
// being a safe assumption the moment anyone repointed .env at production.
//
// Production is the Railway Postgres service, reached over its public proxy
// (*.proxy.rlwy.net) or its private domain (*.railway.internal). Read-only
// scripts (jsonb-encoding-audit, schema-drift-check) do NOT call this and can be
// pointed anywhere.
//
// Override deliberately with ALLOW_PRODUCTION_WRITES=1 if you really mean it.

const PRODUCTION_HOST_PATTERNS = [
  /\.proxy\.rlwy\.net$/i,
  /\.railway\.internal$/i,
  /\.railway\.app$/i,
];

// Exported so callers that manage their own connections (sync-dev-schema, which
// holds a production handle and a dev handle at once) can judge a host without
// going through the DATABASE_URL-shaped check above.
function isProductionHost(host) {
  return PRODUCTION_HOST_PATTERNS.some(re => re.test(host));
}

function assertNotProduction(scriptName = 'this script') {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set — refusing to run.');
    process.exit(1);
  }

  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    console.error('DATABASE_URL is not a parseable URL — refusing to run.');
    process.exit(1);
  }

  const isProduction = PRODUCTION_HOST_PATTERNS.some(re => re.test(host));
  if (!isProduction) return host;

  if (process.env.ALLOW_PRODUCTION_WRITES === '1') {
    console.warn(`\n!!  ${scriptName} is WRITING TO PRODUCTION (${host}) — ALLOW_PRODUCTION_WRITES=1 is set.\n`);
    return host;
  }

  console.error(
    `\nRefusing to run: ${scriptName} writes to the database, and ${host} is production.\n` +
    `It creates users/profiles and mutates rows — that must not touch production data.\n\n` +
    `Point DATABASE_URL at a development database, or set ALLOW_PRODUCTION_WRITES=1 if\n` +
    `you genuinely intend to write to production.\n`
  );
  process.exit(1);
}

module.exports = { assertNotProduction, isProductionHost };
