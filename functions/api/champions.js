// GET /api/champions?boards=<key1,key2,...>
// Returns the top 3 entries (gold/silver/bronze) for each requested board, so
// the homepage can tally per-player medal counts across the "champion" boards
// (the hardest level of each game + every game without levels). The client does
// the per-player aggregation so it can also render a per-game breakdown.
import { validBoard, json } from './_util.js';

const MAX_BOARDS = 48;

export async function onRequestGet({ request, env }) {
  const raw = new URL(request.url).searchParams.get('boards') || '';
  const boards = raw.split(',').map(function (b) { return b.trim(); })
    .filter(function (b) { return b && validBoard(b); });
  // de-dupe, cap
  const seen = {}, list = [];
  for (const b of boards) { if (!seen[b]) { seen[b] = 1; list.push(b); } if (list.length >= MAX_BOARDS) break; }
  if (!list.length) return json([], 400);
  try {
    const placeholders = list.map(function (_, i) { return '?' + (i + 1); }).join(',');
    // Top 3 per board by score (ties broken by earliest timestamp), via a window
    // function — SQLite/D1 supports ROW_NUMBER() OVER (PARTITION BY ...).
    const sql =
      'SELECT board, name, score, ts, rank FROM (' +
      '  SELECT board, name, score, ts,' +
      '    ROW_NUMBER() OVER (PARTITION BY board ORDER BY score DESC, ts ASC) AS rank' +
      '  FROM scores WHERE board IN (' + placeholders + ')' +
      ') WHERE rank <= 3';
    const { results } = await env.DB.prepare(sql).bind(...list).all();
    return json(results || []);
  } catch (e) {
    return json([], 500);
  }
}
