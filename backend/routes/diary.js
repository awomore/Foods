const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

function resolveUserId(req) {
  if (!req.headers.authorization) return null;
  try {
    const jwt = require('jsonwebtoken');
    const token = req.headers.authorization.replace('Bearer ', '');
    return jwt.verify(token, process.env.JWT_SECRET).id;
  } catch { return null; }
}

// ── GET /api/diary/global ───────────────────────────────────────────────────
router.get('/global', async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const userId = resolveUserId(req);

    const posts = await sql`
      SELECT
        cdp.id, cdp.cook_id, cdp.body, cdp.photo_url, cdp.photo_urls, cdp.video_url,
        cdp.post_type, cdp.title, cdp.linked_item_id, cdp.share_count, cdp.view_count, cdp.created_at,
        cp.display_name AS cook_name, cp.username AS cook_username,
        u.avatar_url AS cook_avatar,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id)::int AS like_count,
        (SELECT COUNT(*) FROM diary_comments WHERE post_id = cdp.id AND deleted_at IS NULL)::int AS comment_count,
        ${userId
          ? sql`EXISTS(SELECT 1 FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id AND user_id = ${userId})`
          : sql`false`
        } AS user_liked,
        ${userId
          ? sql`EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id = cdp.id AND user_id = ${userId})`
          : sql`false`
        } AS user_bookmarked,
        mi.title AS linked_item_title,
        mi.unit_price AS linked_item_price,
        COALESCE(mi.photos, '{}') AS linked_item_photos
      FROM cook_diary_posts cdp
      JOIN cook_profiles cp ON cp.id = cdp.cook_id
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN menu_items mi ON mi.id = cdp.linked_item_id
      WHERE cdp.status = 'published'
        AND (cdp.scheduled_at IS NULL OR cdp.scheduled_at <= NOW())
      ORDER BY cdp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    res.json({ posts });
  } catch (err) {
    console.error('GET /diary/global:', err);
    res.status(500).json({ error: 'Failed to fetch global feed' });
  }
});

// ── GET /api/diary/feed ─────────────────────────────────────────────────────
router.get('/feed', authenticate, async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const userId = req.user.id;

    const posts = await sql`
      SELECT
        cdp.id, cdp.cook_id, cdp.body, cdp.photo_url, cdp.photo_urls, cdp.video_url,
        cdp.post_type, cdp.title, cdp.linked_item_id, cdp.share_count, cdp.view_count, cdp.created_at,
        cp.display_name AS cook_name, cp.username AS cook_username,
        u.avatar_url AS cook_avatar,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id)::int AS like_count,
        (SELECT COUNT(*) FROM diary_comments WHERE post_id = cdp.id AND deleted_at IS NULL)::int AS comment_count,
        EXISTS(SELECT 1 FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id AND user_id = ${userId}) AS user_liked,
        EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id = cdp.id AND user_id = ${userId}) AS user_bookmarked,
        mi.title AS linked_item_title,
        mi.unit_price AS linked_item_price,
        COALESCE(mi.photos, '{}') AS linked_item_photos
      FROM cook_diary_posts cdp
      JOIN cook_profiles cp ON cp.id = cdp.cook_id
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN menu_items mi ON mi.id = cdp.linked_item_id
      WHERE cdp.cook_id IN (SELECT cook_id FROM follows WHERE customer_id = ${userId})
        AND cdp.status = 'published'
        AND (cdp.scheduled_at IS NULL OR cdp.scheduled_at <= NOW())
      ORDER BY cdp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    res.json({ posts });
  } catch (err) {
    console.error('GET /diary/feed:', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// ── GET /api/diary/my-posts ─────────────────────────────────────────────────
// Cook's own posts across all statuses (with analytics counts)
router.get('/my-posts', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const posts = await sql`
      SELECT
        cdp.*,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id)::int AS like_count,
        (SELECT COUNT(*) FROM diary_comments WHERE post_id = cdp.id AND deleted_at IS NULL)::int AS comment_count,
        (SELECT COUNT(*) FROM orders WHERE source_post_id = cdp.id)::int AS orders_generated,
        mi.title AS linked_item_title,
        mi.unit_price AS linked_item_price,
        COALESCE(mi.photos, '{}') AS linked_item_photos
      FROM cook_diary_posts cdp
      LEFT JOIN menu_items mi ON mi.id = cdp.linked_item_id
      WHERE cdp.cook_id = ${cookId}
        ${status ? sql`AND cdp.status = ${status}` : sql``}
      ORDER BY cdp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    res.json({ posts });
  } catch (err) {
    console.error('GET /diary/my-posts:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// ── GET /api/diary/analytics ────────────────────────────────────────────────
router.get('/analytics', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const [summary] = await sql`
      SELECT
        COUNT(*)::int AS total_posts,
        COALESCE(SUM(view_count), 0)::int AS total_reach,
        COALESCE(SUM(share_count), 0)::int AS total_shares,
        (
          SELECT COUNT(*) FROM likes l
          JOIN cook_diary_posts p2 ON p2.id = l.target_id AND l.target_type = 'diary_post'
          WHERE p2.cook_id = ${cookId}
        )::int AS total_likes,
        (
          SELECT COUNT(*) FROM diary_comments dc
          JOIN cook_diary_posts p3 ON p3.id = dc.post_id
          WHERE p3.cook_id = ${cookId} AND dc.deleted_at IS NULL
        )::int AS total_comments,
        (
          SELECT COUNT(*) FROM orders o
          WHERE o.source_post_id IN (SELECT id FROM cook_diary_posts WHERE cook_id = ${cookId})
        )::int AS total_orders_generated
      FROM cook_diary_posts
      WHERE cook_id = ${cookId} AND status = 'published'
    `;

    const top_posts = await sql`
      SELECT
        cdp.id, cdp.body, cdp.post_type, cdp.title, cdp.photo_url, cdp.photo_urls, cdp.created_at,
        cdp.view_count, cdp.share_count,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id)::int AS like_count,
        (SELECT COUNT(*) FROM diary_comments WHERE post_id = cdp.id AND deleted_at IS NULL)::int AS comment_count
      FROM cook_diary_posts cdp
      WHERE cdp.cook_id = ${cookId} AND cdp.status = 'published'
      ORDER BY (
        cdp.view_count + cdp.share_count * 3 +
        (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id) * 2
      ) DESC
      LIMIT 5
    `;

    res.json({ summary, top_posts });
  } catch (err) {
    console.error('GET /diary/analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ── GET /api/diary/cook/:cookId ──────────────────────────────────────────────
router.get('/cook/:cookId', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = resolveUserId(req);

    const posts = await sql`
      SELECT
        cdp.id, cdp.cook_id, cdp.body, cdp.photo_url, cdp.photo_urls, cdp.video_url,
        cdp.post_type, cdp.title, cdp.linked_item_id, cdp.share_count, cdp.view_count, cdp.created_at,
        cp.display_name AS cook_name, cp.username AS cook_username,
        u.avatar_url AS cook_avatar,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id)::int AS like_count,
        (SELECT COUNT(*) FROM diary_comments WHERE post_id = cdp.id AND deleted_at IS NULL)::int AS comment_count,
        ${userId
          ? sql`EXISTS(SELECT 1 FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id AND user_id = ${userId})`
          : sql`false`
        } AS user_liked,
        ${userId
          ? sql`EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id = cdp.id AND user_id = ${userId})`
          : sql`false`
        } AS user_bookmarked,
        mi.title AS linked_item_title,
        mi.unit_price AS linked_item_price,
        COALESCE(mi.photos, '{}') AS linked_item_photos
      FROM cook_diary_posts cdp
      JOIN cook_profiles cp ON cp.id = cdp.cook_id
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN menu_items mi ON mi.id = cdp.linked_item_id
      WHERE cdp.cook_id = ${req.params.cookId}
        AND cdp.status = 'published'
        AND (cdp.scheduled_at IS NULL OR cdp.scheduled_at <= NOW())
      ORDER BY cdp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    res.json({ posts });
  } catch (err) {
    console.error('GET /diary/cook/:cookId:', err);
    res.status(500).json({ error: 'Failed to fetch diary' });
  }
});

// ── POST /api/diary ─────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const {
      body, photo_url, photo_urls, video_url,
      post_type = 'kitchen_story', status = 'published',
      scheduled_at, linked_item_id, title,
    } = req.body;

    if (!body?.trim()) return res.status(400).json({ error: 'Post body required' });

    const validTypes = ['dish_reveal', 'kitchen_story', 'behind_the_scenes', 'flash_sale', 'weekly_menu'];
    const validStatuses = ['draft', 'scheduled', 'published'];
    if (!validTypes.includes(post_type)) return res.status(400).json({ error: 'Invalid post_type' });
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'scheduled' && !scheduled_at) return res.status(400).json({ error: 'scheduled_at required for scheduled posts' });

    const [post] = await sql`
      INSERT INTO cook_diary_posts (
        cook_id, body, photo_url, photo_urls, video_url,
        post_type, status, scheduled_at, linked_item_id, title
      ) VALUES (
        ${cookId}, ${body.trim()}, ${photo_url ?? null},
        ${photo_urls ?? []}, ${video_url ?? null},
        ${post_type}, ${status}, ${scheduled_at ?? null},
        ${linked_item_id ?? null}, ${title?.trim() ?? null}
      )
      RETURNING *
    `;

    if (status === 'published') {
      const followers = await sql`
        SELECT customer_id FROM follows WHERE cook_id = ${cookId} AND notify_diary_post = true
      `;
      if (followers.length > 0) {
        const [cookInfo] = await sql`SELECT display_name FROM cook_profiles WHERE id = ${cookId}`;
        const cookName = cookInfo?.display_name ?? 'Your cook';
        const typeLabel = post_type.replace(/_/g, ' ');
        for (const f of followers) {
          await sql`
            INSERT INTO notifications (user_id, type, title, body, data)
            VALUES (
              ${f.customer_id}, 'diary_post',
              ${cookName + ' shared a ' + typeLabel},
              ${body.slice(0, 100)},
              ${{ cook_id: cookId, post_id: post.id }}::jsonb
            )
          `;
        }
      }
    }

    res.status(201).json({ post });
  } catch (err) {
    console.error('POST /diary:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ── PATCH /api/diary/:id ─────────────────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { body, photo_url, photo_urls, video_url, post_type, status, scheduled_at, linked_item_id, title } = req.body;

    const existing = await sql`
      SELECT id FROM cook_diary_posts WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
    `;
    if (!existing.length) return res.status(404).json({ error: 'Post not found' });

    const [post] = await sql`
      UPDATE cook_diary_posts SET
        body           = COALESCE(${body?.trim() ?? null}, body),
        photo_url      = COALESCE(${photo_url ?? null}, photo_url),
        photo_urls     = CASE WHEN ${photo_urls ?? null}::text[] IS NOT NULL THEN ${photo_urls ?? []} ELSE photo_urls END,
        video_url      = COALESCE(${video_url ?? null}, video_url),
        post_type      = COALESCE(${post_type ?? null}, post_type),
        status         = COALESCE(${status ?? null}, status),
        scheduled_at   = COALESCE(${scheduled_at ?? null}, scheduled_at),
        linked_item_id = COALESCE(${linked_item_id ?? null}, linked_item_id),
        title          = COALESCE(${title?.trim() ?? null}, title)
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    res.json({ post });
  } catch (err) {
    console.error('PATCH /diary/:id:', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// ── POST /api/diary/:id/bookmark ─────────────────────────────────────────────
router.post('/:id/bookmark', authenticate, async (req, res) => {
  try {
    const existing = await sql`
      SELECT id FROM post_bookmarks WHERE user_id = ${req.user.id} AND post_id = ${req.params.id}
    `;
    if (existing.length) {
      await sql`DELETE FROM post_bookmarks WHERE user_id = ${req.user.id} AND post_id = ${req.params.id}`;
      res.json({ bookmarked: false });
    } else {
      await sql`
        INSERT INTO post_bookmarks (user_id, post_id)
        VALUES (${req.user.id}, ${req.params.id})
        ON CONFLICT DO NOTHING
      `;
      res.json({ bookmarked: true });
    }
  } catch (err) {
    console.error('POST /diary/:id/bookmark:', err);
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
});

// ── POST /api/diary/:id/share ─────────────────────────────────────────────────
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    const { platform } = req.body;
    await sql`UPDATE cook_diary_posts SET share_count = share_count + 1 WHERE id = ${req.params.id}`;
    await sql`
      INSERT INTO post_shares (user_id, post_id, platform)
      VALUES (${req.user.id}, ${req.params.id}, ${platform ?? null})
    `;
    res.json({ shared: true });
  } catch (err) {
    console.error('POST /diary/:id/share:', err);
    res.status(500).json({ error: 'Failed to log share' });
  }
});

// ── POST /api/diary/:id/like ─────────────────────────────────────────────────
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const existing = await sql`
      SELECT id FROM likes WHERE user_id = ${req.user.id} AND target_type = 'diary_post' AND target_id = ${req.params.id}
    `;
    if (existing.length) {
      await sql`DELETE FROM likes WHERE user_id = ${req.user.id} AND target_type = 'diary_post' AND target_id = ${req.params.id}`;
    } else {
      await sql`INSERT INTO likes (user_id, target_type, target_id) VALUES (${req.user.id}, 'diary_post', ${req.params.id}) ON CONFLICT DO NOTHING`;
    }
    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM likes WHERE target_type = 'diary_post' AND target_id = ${req.params.id}`;
    res.json({ liked: !existing.length, like_count: Number(count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ── GET /api/diary/:postId/comments ─────────────────────────────────────────
router.get('/:postId/comments', async (req, res) => {
  try {
    const userId = resolveUserId(req);

    const comments = await sql`
      SELECT dc.*,
             u.full_name  AS author_name,
             u.username   AS author_username,
             u.avatar_url AS author_avatar,
             (SELECT COUNT(*) FROM likes WHERE target_type = 'comment' AND target_id = dc.id)::int AS like_count,
             ${userId
               ? sql`EXISTS(SELECT 1 FROM likes WHERE target_type = 'comment' AND target_id = dc.id AND user_id = ${userId})`
               : sql`false`
             } AS user_liked
      FROM diary_comments dc
      JOIN users u ON u.id = dc.user_id
      WHERE dc.post_id = ${req.params.postId}
        AND dc.deleted_at IS NULL
      ORDER BY dc.created_at ASC
      LIMIT 100
    `;
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ── POST /api/diary/:postId/comments ────────────────────────────────────────
router.post('/:postId/comments', authenticate, async (req, res) => {
  try {
    const { body, mentions } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Comment body required' });

    const [comment] = await sql`
      INSERT INTO diary_comments (post_id, user_id, body, mentions)
      VALUES (${req.params.postId}, ${req.user.id}, ${body.trim()}, ${JSON.stringify(mentions ?? [])}::jsonb)
      RETURNING *
    `;
    const [enriched] = await sql`
      SELECT dc.*, u.full_name AS author_name, u.username AS author_username, u.avatar_url AS author_avatar,
             0::int AS like_count, false AS user_liked
      FROM diary_comments dc
      JOIN users u ON u.id = dc.user_id
      WHERE dc.id = ${comment.id}
    `;

    // Notify the cook who owns the post (skip self-comments)
    const [post] = await sql`
      SELECT cdp.cook_id, cp.user_id AS cook_user_id, cp.display_name
      FROM cook_diary_posts cdp
      JOIN cook_profiles cp ON cp.id = cdp.cook_id
      WHERE cdp.id = ${req.params.postId}
    `;
    if (post && post.cook_user_id !== req.user.id) {
      const commenter = await sql`SELECT full_name FROM users WHERE id = ${req.user.id}`;
      const name = commenter[0]?.full_name ?? 'Someone';
      await sql`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          ${post.cook_user_id}, 'post_comment',
          ${name + ' commented on your post'},
          ${body.trim().slice(0, 100)},
          ${{ cook_id: post.cook_id, post_id: req.params.postId }}::jsonb
        )
      `;
    }

    res.status(201).json({ comment: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ── POST /api/diary/comments/:commentId/like ────────────────────────────────
router.post('/comments/:commentId/like', authenticate, async (req, res) => {
  try {
    const existing = await sql`
      SELECT id FROM likes WHERE user_id = ${req.user.id} AND target_type = 'comment' AND target_id = ${req.params.commentId}
    `;
    if (existing.length) {
      await sql`DELETE FROM likes WHERE user_id = ${req.user.id} AND target_type = 'comment' AND target_id = ${req.params.commentId}`;
    } else {
      await sql`INSERT INTO likes (user_id, target_type, target_id) VALUES (${req.user.id}, 'comment', ${req.params.commentId}) ON CONFLICT DO NOTHING`;
    }
    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM likes WHERE target_type = 'comment' AND target_id = ${req.params.commentId}`;
    res.json({ liked: !existing.length, like_count: Number(count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle comment like' });
  }
});

// ── DELETE /api/diary/comments/:commentId ───────────────────────────────────
router.delete('/comments/:commentId', authenticate, async (req, res) => {
  try {
    await sql`
      UPDATE diary_comments SET deleted_at = NOW()
      WHERE id = ${req.params.commentId} AND user_id = ${req.user.id}
    `;
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ── POST /api/diary/:id/view ─────────────────────────────────────────────────
// Fire-and-forget: increment view_count once per user per post session.
router.post('/:id/view', authenticate, async (req, res) => {
  try {
    await sql`UPDATE cook_diary_posts SET view_count = view_count + 1 WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// ── DELETE /api/diary/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Forbidden' });

    await sql`DELETE FROM cook_diary_posts WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}`;
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ── GET /api/diary — public posts, optionally filtered by cook_id ─────────────
router.get('/', async (req, res) => {
  try {
    const { cook_id, limit = 20, offset = 0 } = req.query;
    const userId = resolveUserId(req);

    const posts = await sql`
      SELECT
        cdp.id, cdp.cook_id, cdp.body, cdp.photo_url, cdp.photo_urls, cdp.video_url,
        cdp.post_type, cdp.title, cdp.linked_item_id, cdp.share_count, cdp.view_count, cdp.created_at,
        cp.display_name AS cook_name, cp.username AS cook_username, u.avatar_url AS cook_avatar,
        (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id)::int AS like_count,
        (SELECT COUNT(*) FROM diary_comments WHERE post_id = cdp.id AND deleted_at IS NULL)::int AS comment_count,
        ${userId
          ? sql`EXISTS(SELECT 1 FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id AND user_id = ${userId})`
          : sql`false`
        } AS user_liked,
        mi.title AS linked_item_title, mi.unit_price AS linked_item_price,
        COALESCE(mi.photos, '{}') AS linked_item_photos
      FROM cook_diary_posts cdp
      JOIN cook_profiles cp ON cp.id = cdp.cook_id
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN menu_items mi ON mi.id = cdp.linked_item_id
      WHERE cdp.status = 'published'
        AND (cdp.scheduled_at IS NULL OR cdp.scheduled_at <= NOW())
        AND (${cook_id ? sql`cdp.cook_id = ${cook_id}` : sql`TRUE`})
      ORDER BY cdp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    res.json({ posts });
  } catch (err) {
    console.error('GET /diary:', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

module.exports = router;
