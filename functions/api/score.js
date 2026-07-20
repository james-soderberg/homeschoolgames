// POST /api/score  { board, name, score, hinted, ts }
//   -> validates, throttles, inserts, prunes, returns { top:[...10], rank }.
import { validBoard, clampScore, sanitizeName, json } from './_util.js';

const RATE_LIMIT = 10;      // max writes ...
const RATE_WINDOW = 10000;  // ... per 10s per IP
const KEEP_PER_BOARD = 50;  // prune each board to this depth

const TOP_SQL =
  'SELECT name, score, hinted, ts FROM scores WHERE board=?1 ORDER BY score DESC, ts ASC LIMIT 10';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }

  const board = body && body.board;
  if (!validBoard(board)) return json({ error: 'bad board' }, 400);

  const score = clampScore(body.score);
  if (score === null) return json({ error: 'bad score' }, 400);

  const name = sanitizeName(body.name);
  const hinted = body.hinted ? 1 : 0;
  const now = Date.now();
  const ts = (Number.isFinite(body.ts) && body.ts > 0 && body.ts <= now + 60000)
    ? Math.floor(body.ts) : now;

  const DB = env.DB;

  // --- best-effort per-IP throttle ---
  const ip = request.headers.get('cf-connecting-ip') || 'anon';
  try {
    const rl = await DB.prepare('SELECT ts, count FROM rate WHERE ip=?1').bind(ip).first();
    if (rl && (now - rl.ts) < RATE_WINDOW) {
      if (rl.count >= RATE_LIMIT) return json({ error: 'slow down' }, 429);
      await DB.prepare('UPDATE rate SET count = count + 1 WHERE ip=?1').bind(ip).run();
    } else {
      await DB.prepare(
        'INSERT INTO rate (ip, ts, count) VALUES (?1, ?2, 1) ' +
        'ON CONFLICT(ip) DO UPDATE SET ts=?2, count=1'
      ).bind(ip, now).run();
    }
  } catch (e) { /* throttle is best-effort; never block a legit write on it */ }

  try {
    await DB.prepare(
      'INSERT INTO scores (board, name, score, hinted, ts) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(board, name, score, hinted, ts).run();

    // keep each board bounded
    await DB.prepare(
      'DELETE FROM scores WHERE board=?1 AND id NOT IN ' +
      '(SELECT id FROM scores WHERE board=?1 ORDER BY score DESC, ts ASC LIMIT ?2)'
    ).bind(board, KEEP_PER_BOARD).run();

    const rankRow = await DB.prepare(
      'SELECT COUNT(*) AS c FROM scores WHERE board=?1 AND (score > ?2 OR (score = ?2 AND ts < ?3))'
    ).bind(board, score, ts).first();
    const rank = (rankRow ? rankRow.c : 0) + 1;

    const { results } = await DB.prepare(TOP_SQL).bind(board).all();
    return json({ top: results || [], rank: rank <= KEEP_PER_BOARD ? rank : null });
  } catch (e) {
    return json({ error: 'db error' }, 500);
  }
}
