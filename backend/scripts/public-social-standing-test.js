// Covers publicSocialStanding(), the buyer-facing view of a creator's social
// standing that GET /api/cooks and GET /api/cooks/:id now return.
//
// Why this exists: the Meta App Review submission told reviewers the verified
// handle and badge tier appear on a creator's public profile, but both public
// endpoints destructured instagram_handle out and never exposed the tier, so no
// screencast could demonstrate the described end-to-end use case. This asserts
// the rules that made it safe to expose:
//
//   - only OAuth-verified handles are published (impersonation guard);
//   - a withheld follower count is null, never 0;
//   - social_oauth_data itself never appears in the payload;
//   - a legacy jsonb STRING scalar row still yields a badge tier.
//
// Pure logic — no database, no network.
// Usage: cd backend; node scripts/public-social-standing-test.js
const { publicSocialStanding } = require('../routes/socialVerify');

let failures = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
}

console.log('publicSocialStanding\n');

// A verified handle is published, with its link and known follower count.
const verified = publicSocialStanding({
  instagram: {
    handle: 'chefada', handle_verified: true,
    follower_count: 12400, follower_count_known: true,
    verified_at: '2026-09-01T00:00:00Z',
  },
});
check('verified handle is published', verified.verified_socials, [{
  platform: 'instagram',
  handle: 'chefada',
  profile_url: 'https://www.instagram.com/chefada/',
  follower_count: 12400,
  verified_at: '2026-09-01T00:00:00Z',
}]);
check('verified handle earns a tier', verified.social_badge_tier, 'rising');

// handle_verified false means we proved account control but NOT which @handle.
// Publishing it would point buyers at an account that may not be theirs.
const unverified = publicSocialStanding({
  instagram: { handle: 'someoneelse', handle_verified: false, follower_count: 900000, follower_count_known: true },
});
check('unverified handle is withheld', unverified.verified_socials, []);

// A withheld count decides nothing — it must not read as zero followers.
const withheld = publicSocialStanding({
  tiktok: { handle: 'ada', handle_verified: true, follower_count: 0, follower_count_known: false },
});
check('withheld count is null, not 0', withheld.verified_socials[0].follower_count, null);
check('withheld count earns no tier', withheld.social_badge_tier, null);

// Rows written by an older deploy hold a jsonb STRING scalar. computeSocialStanding
// iterates Object.entries, so handing it the raw column walks character indices and
// silently drops the tier. Regression guard for that.
const legacy = publicSocialStanding(JSON.stringify({
  instagram: { handle: 'legacy', handle_verified: true, follower_count: 3000, follower_count_known: true },
}));
check('legacy string-scalar row still resolves the handle', legacy.verified_socials.length, 1);
// 3000 is the 'creator' band (>=1k). The point is that it is a tier at all —
// before the fix this row returned null because the raw string was iterated.
check('legacy string-scalar row still earns a tier', legacy.social_badge_tier, 'creator');

// YouTube never reaches profileUrl's switch; it needs the local fallback.
const yt = publicSocialStanding({
  youtube: { handle: 'adacooks', handle_verified: true, subscriber_count: 52000, subscriber_count_known: true },
});
check('youtube gets a profile url', yt.verified_socials[0].profile_url, 'https://www.youtube.com/@adacooks');

// Nothing connected, and the null column an unonboarded cook still has.
check('empty data is safe', publicSocialStanding(null), { verified_socials: [], social_badge_tier: null });

// The payload must never carry the platform user id kept for Meta's deletion callback.
const withUserId = publicSocialStanding({
  instagram: { user_id: '17841400000000000', handle: 'ada', handle_verified: true, follower_count: 10, follower_count_known: true },
});
check('platform user id is not exposed',
  JSON.stringify(withUserId).includes('17841400000000000'), false);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
