// Shared validation/sanitation for the leaderboard Functions.
// Files prefixed with "_" are not routed by Pages, so this is import-only.

const BOARD_RE = /^hsg_lb_[a-z0-9-]+(?:__[a-z0-9-]+)?$/;
const SCORE_CAP = 100000000; // generous universal ceiling (cents/feet/points/wpm)

// Compact kid-facing blocklist; substring match on letters only.
const PROFANITY = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dick', 'piss', 'bastard',
  'nigger', 'nigga', 'faggot', 'fag', 'whore', 'slut', 'retard', 'nazi',
  'rape', 'penis', 'vagina', 'boobs', 'sex', 'porn'
];

export function validBoard(b) {
  return typeof b === 'string' && b.length <= 80 && BOARD_RE.test(b);
}

// Coerce to a non-negative integer within the cap; null if implausible.
export function clampScore(s) {
  const n = Math.floor(Number(s));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, SCORE_CAP);
}

function isProfane(s) {
  const low = s.toLowerCase().replace(/[^a-z]/g, '');
  return PROFANITY.some(function (w) { return low.indexOf(w) !== -1; });
}

// Mirror of streak-rail.js formatName: strip to letters/numbers/space/'/-,
// collapse to "First L.", cap at 18. Falls back to Anonymous when empty/blocked.
export function sanitizeName(raw) {
  let s = (raw == null ? '' : String(raw)).replace(/\s+/g, ' ').trim();
  s = s.replace(/[^\p{L}\p{N}'\- ]/gu, '').trim();
  if (!s) return 'Anonymous';
  const cap = function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; };
  const parts = s.split(' ');
  let out = parts.length === 1
    ? cap(parts[0])
    : cap(parts[0]) + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
  if (out.length > 18) out = out.slice(0, 18);
  return isProfane(out) ? 'Anonymous' : out;
}

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
