// GET /api/recent?boards=<n>&rows=<m>
//   -> the most recently-active boards, each with its top <m> entries.
//      Powers the homepage "running leaderboard" rail (mini-boards, newest-active
//      board first). Returns a flat, already-ordered array; the client groups by
//      board (order is preserved: last_ts desc, then rank asc).
import { json } from './_util.js';

const SQL =
  'WITH recent_boards AS (' +
  '  SELECT board, MAX(ts) AS last_ts FROM scores GROUP BY board ORDER BY last_ts DESC LIMIT ?1' +
  '), ranked AS (' +
  '  SELECT s.board, s.name, s.score, s.hinted, s.ts, rb.last_ts,' +
  '         ROW_NUMBER() OVER (PARTITION BY s.board ORDER BY s.score DESC, s.ts ASC) AS rn' +
  '  FROM scores s JOIN recent_boards rb ON rb.board = s.board' +
  ') SELECT board, name, score, hinted, ts, last_ts, rn FROM ranked WHERE rn <= ?2 ' +
  'ORDER BY last_ts DESC, rn ASC';

const clampInt = (v, def, min, max) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
};

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  const boards = clampInt(p.get('boards'), 30, 1, 60);   // how many recently-active boards
  const rows = clampInt(p.get('rows'), 5, 1, 10);        // top entries per board
  try {
    const { results } = await env.DB.prepare(SQL).bind(boards, rows).all();
    return json(results || []);
  } catch (e) {
    return json([], 500);
  }
}
