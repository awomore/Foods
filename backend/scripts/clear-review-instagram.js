// Clears the App Review account's Instagram link so Connected Accounts shows
// "Connect" again before a screencast take. Completing the grant on camera
// re-links it, so this has to run before every take.
//
//   DATABASE_URL=<Railway DATABASE_PUBLIC_URL> NODE_ENV=production \
//     node scripts/clear-review-instagram.js
//
// Use DATABASE_PUBLIC_URL: Railway's DATABASE_URL is postgres.railway.internal
// and does not resolve off-network.

const REVIEW_IG_USER_ID = '27179655281710088';
const API = process.env.API_URL || 'https://foodsbyme-api-production.up.railway.app';

(async () => {
  const { sql } = require('../supabase/db');
  const { deleteInstagramConnection } = require('../routes/socialVerify');

  const before = await sql`
    SELECT user_id, instagram_handle FROM cook_profiles
    WHERE social_oauth_data -> 'instagram' ->> 'user_id' = ${REVIEW_IG_USER_ID}
  `;
  console.log('linked before:', before);

  console.log('result:', await deleteInstagramConnection(REVIEW_IG_USER_ID));

  // Check through the public API rather than trusting the write.
  for (const { user_id } of before) {
    const res = await fetch(`${API}/api/cooks/${user_id}`);
    const body = await res.text();
    console.log(`GET /api/cooks/${user_id} -> ${res.status}; mentions foodsbyme_ig: ${body.includes('foodsbyme_ig')}`);
  }

  await sql.end();
  process.exit(0); // the routes module leaves timers running
})().catch(err => { console.error(err); process.exit(1); });
