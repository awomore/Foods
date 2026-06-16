const express  = require('express');
const router   = express.Router();
const { sql }  = require('../supabase/db');
const { authenticate } = require('../middleware/auth');
const { notifyAndPush } = require('../services/push');
const crypto   = require('crypto');

const REFERRAL_REWARD_NGN = 2000;

function generateCode(userId) {
  return 'FOODS-' + crypto.createHash('sha256')
    .update(userId + Date.now())
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
}

// GET /api/referrals/my  — get or create caller's referral code + stats
router.get('/my', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    let [user] = await sql`SELECT referral_code FROM users WHERE id = ${userId}`;
    if (!user.referral_code) {
      const code = generateCode(userId);
      await sql`UPDATE users SET referral_code = ${code} WHERE id = ${userId}`;
      user = { referral_code: code };
    }

    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'signed_up')  AS total_signups,
        COUNT(*) FILTER (WHERE status = 'qualified')  AS qualified,
        COUNT(*) FILTER (WHERE status = 'rewarded')   AS rewarded,
        COALESCE(SUM(reward_amount) FILTER (WHERE status = 'rewarded'), 0) AS total_earned
      FROM cook_referrals
      WHERE referrer_id = ${userId}
    `;

    const pending = await sql`
      SELECT id, status, signed_up_at FROM cook_referrals
      WHERE referrer_id = ${userId}
      ORDER BY created_at DESC LIMIT 20
    `;

    res.json({
      referral_code: user.referral_code,
      share_url: `https://foodsbyme.com/join?ref=${user.referral_code}`,
      reward_per_referral: REFERRAL_REWARD_NGN,
      currency: 'NGN',
      stats: {
        total_signups: parseInt(stats.total_signups ?? 0),
        qualified:     parseInt(stats.qualified ?? 0),
        rewarded:      parseInt(stats.rewarded ?? 0),
        total_earned:  parseFloat(stats.total_earned ?? 0),
      },
      referrals: pending,
    });
  } catch (err) {
    console.error('GET /referrals/my:', err);
    res.status(500).json({ error: 'Could not load referrals' });
  }
});

// POST /api/referrals/track  — called during signup with ?ref=CODE
// Records that a new user signed up via a referral code
router.post('/track', async (req, res) => {
  try {
    const { ref_code, new_user_id } = req.body;
    if (!ref_code || !new_user_id) return res.status(400).json({ error: 'Missing params' });

    const [referrer] = await sql`
      SELECT id FROM users WHERE referral_code = ${ref_code} AND id != ${new_user_id}
    `;
    if (!referrer) return res.json({ tracked: false });

    await sql`
      INSERT INTO cook_referrals (referrer_id, referred_id, referral_code, status, signed_up_at)
      VALUES (${referrer.id}, ${new_user_id}, ${ref_code}, 'signed_up', NOW())
      ON CONFLICT (referral_code) DO NOTHING
    `;

    // Notify referrer
    notifyAndPush(
      referrer.id,
      'referral_signup',
      'Someone joined via your link!',
      `A new cook signed up with your referral code. Keep sharing to earn ₦${REFERRAL_REWARD_NGN.toLocaleString()}.`,
      { type: 'referral_signup', new_user_id }
    ).catch(() => {});

    res.json({ tracked: true });
  } catch (err) {
    console.error('POST /referrals/track:', err);
    res.status(500).json({ error: 'Tracking failed' });
  }
});

// POST /api/referrals/qualify/:referral_id  — admin marks a referral as qualified (first order placed)
router.post('/qualify/:referral_id', authenticate, async (req, res) => {
  try {
    const [ref] = await sql`
      UPDATE cook_referrals
      SET status = 'qualified', qualified_at = NOW()
      WHERE id = ${req.params.referral_id} AND status = 'signed_up'
      RETURNING *
    `;
    if (!ref) return res.status(404).json({ error: 'Referral not found or already qualified' });

    // Immediately reward: credit wallet
    const { walletApi } = require('../services/wallet');
    await walletApi?.credit?.(ref.referrer_id, REFERRAL_REWARD_NGN, 'referral_reward').catch(() => {});

    await sql`
      UPDATE cook_referrals
      SET status = 'rewarded', reward_amount = ${REFERRAL_REWARD_NGN}, rewarded_at = NOW()
      WHERE id = ${ref.id}
    `;

    notifyAndPush(
      ref.referrer_id,
      'referral_rewarded',
      `You earned ₦${REFERRAL_REWARD_NGN.toLocaleString()}!`,
      'Your referral qualified and your reward has been added to your wallet.',
      { type: 'referral_rewarded', amount: REFERRAL_REWARD_NGN }
    ).catch(() => {});

    res.json({ rewarded: true, amount: REFERRAL_REWARD_NGN });
  } catch (err) {
    res.status(500).json({ error: 'Qualify failed' });
  }
});

module.exports = router;
