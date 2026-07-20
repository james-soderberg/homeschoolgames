// GET /api/top?board=<key>  ->  top 10 entries for that board.
import { validBoard, json } from './_util.js';

const TOP_SQL =
  'SELECT name, score, hinted, ts FROM scores WHERE board=?1 ORDER BY score DESC, ts ASC LIMIT 10';

export async function onRequestGet({ request, env }) {
  const board = new URL(request.url).searchParams.get('board') || '';
  if (!validBoard(board)) return json([], 400);
  try {
    const { results } = await env.DB.prepare(TOP_SQL).bind(board).all();
    return json(results || []);
  } catch (e) {
    return json([], 500);
  }
}
