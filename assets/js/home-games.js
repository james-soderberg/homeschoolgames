// Shared game list for the homepage (order here = order on the page).
// `lb` = the leaderboard score unit (see UNITS in streak-rail.js); games without a
// leaderboard (flag-frenzy, slingshot) omit it and are skipped by the rail.
const GAMES = [
  { key:'who-said-it',   name:'Who Said It?',     href:'games/who-said-it/index.html',  subject:'History',   emoji:'🎙️', blurb:'Guess who spoke the famous words.',  photo:'assets/img/home/shots/who-said-it.jpg', featured:true, badge:'★ Most Popular', lb:'wall24' },
  { key:'circa',         name:'Circa',           href:'games/circa/index.html',        subject:'History',   emoji:'🏛️', blurb:'Put history in order, card by card.', photo:'assets/img/home/shots/circa.jpg', lb:'streak' },
  { key:'dragon-siege',  name:'Dragon Siege',     href:'games/dragon-siege/index.html', subject:'Typing',    emoji:'🐉', blurb:'Type fast to defend the keep.',      photo:'assets/img/home/shots/dragon-siege.jpg', lb:'streak' },
  { key:'type-invaders', name:'Independence Day',    href:'games/type-invaders/index.html',subject:'Typing',    emoji:'🛸', blurb:'Type to blast aliens off the White House.', photo:'assets/img/home/shots/type-invaders.jpg', lb:'streak' },
  { key:'slingshot',     name:'Gravity Slingshot', href:'games/slingshot/index.html',    subject:'Astronomy', emoji:'🪐', blurb:'Use gravity to reach the planets.', photo:'assets/img/home/shots/slingshot.jpg', badge:'✦ New' },
  { key:'who-painted-it',name:'Who Painted It?',  href:'games/who-painted-it/index.html', subject:'Art',      emoji:'🎨', blurb:'Name the artist behind the masterpiece.', photo:'assets/img/home/shots/who-painted-it.jpg', badge:'✦ New', lb:'art20' },
  { key:'grammar-express',name:'Grammar Express', href:'games/grammar-express/index.html', subject:'Grammar', emoji:'🚂', blurb:'Guard the train by naming each part of speech.', photo:'assets/img/home/shots/grammar-express.jpg', badge:'✦ New', lb:'points' },
  { key:'word-racer',    name:'Word Racer',       href:'games/word-racer/index.html',   subject:'Typing',    emoji:'🏎️', blurb:'Type fast to win the race.',         photo:'assets/img/home/shots/word-racer.jpg', lb:'wpm' },
  { key:'letter-snake',  name:'Letter Snake',     href:'games/letter-snake/index.html', subject:'Spelling',  emoji:'🐍', blurb:'Spell words as you slither.',        photo:'assets/img/home/shots/letter-snake.jpg', lb:'length' },
  { key:'roots',         name:'Roots',            href:'games/roots/index.html',        subject:'Vocabulary', emoji:'🧩', blurb:'Forge words from Greek & Latin roots.', photo:'assets/img/home/shots/roots.jpg', badge:'✦ New', lb:'streak' },
  { key:'bible-trivia',  name:'The Exodus Journey', href:'games/bible-trivia/index.html', subject:'Bible Trivia', emoji:'📜', blurb:'From slavery in Egypt to the Promised Land.', photo:'assets/img/home/shots/bible-trivia.jpg', lb:'streak' },
  { key:'register',      name:'Register',         href:'games/register/index.html',     subject:'Math',      emoji:'🛒', blurb:'Run the shop and make the change.', photo:'assets/img/home/shots/register.jpg', badge:'✦ New', lb:'takings' },
  { key:'bridge-run',    name:'Bridge Run',       href:'games/bridge-run/index.html',   subject:'Math',      emoji:'🌉', blurb:'Solve the gap and sprint across.',   photo:'assets/img/home/shots/bridge-run.jpg', lb:'streak' },
  { key:'flag-frenzy',   name:'Around the World', href:'games/flag-frenzy/index.html',  subject:'Flag Identification', emoji:'🚩', blurb:'Race through the flags of the world.',photo:'assets/img/home/shots/flag-frenzy.jpg' },
  { key:'map-quiz',      name:'Map Quiz',         href:'games/map-quiz/index.html',     subject:'Geography', emoji:'🗺️', blurb:'Find every country on the map.',     photo:'assets/img/home/shots/map-quiz.jpg', lb:'mapscore' },
  { key:'element-hunter',name:'Element Hunter',   href:'games/element-hunter/index.html',subject:'Science',  emoji:'🧪', blurb:'Hunt down the periodic table.',      photo:'assets/img/home/shots/element-hunter.jpg', lb:'streak' },
  { key:'food-web',      name:'Keep the Habitat Alive', href:'games/food-web/index.html', subject:'Biology',   emoji:'🦊', blurb:'Hunt to survive, but keep the whole habitat in balance.', photo:'assets/img/home/shots/food-web.jpg', badge:'✦ New', lb:'points' },
  { key:'bible-quiz',    name:"Paul's Journey",   href:'games/bible-quiz/index.html',   subject:'Passage Identification', emoji:'📖', blurb:'Test how well you know scripture.',  photo:'assets/img/home/shots/bible-quiz.jpg', lb:'streak' },
  { key:'letter-catch',  name:'Letter Catch',     href:'games/letter-catch/index.html', subject:'Spelling',  emoji:'🪣', blurb:'Catch letters to spell the word.',   photo:'assets/img/home/shots/letter-catch.jpg', lb:'streak' },
  { key:'tightrope',     name:'Tightrope',        href:'games/tightrope/index.html',    subject:'Math',      emoji:'🎪', blurb:'Balance a value on the number line.', photo:'assets/img/home/shots/tightrope.jpg', lb:'rounds' },
];

// Board key <-> game/level helpers for the homepage rail. Board keys look like
// `hsg_lb_<gameId>` or `hsg_lb_<gameId>__<level>`. Secret-game boards (redline,
// flappy-dragonling, slide-puzzle, type-invaders' arcade, checkpoints) are NOT in
// GAMES, so they're skipped automatically.
const LB_BY_ID = {};
GAMES.forEach(function (g) { if (g.lb) LB_BY_ID[g.key] = g; });
const LB_SKIP_LEVELS = { arcade: true };   // secret levels on otherwise-public games
// Games consolidated to a single board: only their one canonical board counts on the
// rail; retired per-difficulty boards (tightrope now scales automatically) are dropped.
const LB_ONLY_LEVEL = { tightrope: 'survived' };

// Nicer labels for common level keys; anything else is Title-Cased.
const LB_LEVEL_LABELS = {
  '': '', all: 'All', best: 'Best', journey: 'Journey', einstein: 'Einstein',
  impossible: 'Impossible', solomon: 'Solomon', americas: 'Americas', europe: 'Europe',
  asia: 'Asia', africa: 'Africa', oceania: 'Oceania', world: 'World',
  bills: 'Bills & Coins', fewest: 'Fewest Pieces', tax: 'Sales Tax', expert: 'Expert',
  common: 'Common', nonmetal: 'Nonmetals', noble: 'Noble Gases', alkali: 'Alkali',
  alkaline: 'Alkaline Earth', transition: 'Transition', post: 'Post-transition'
};
function lbTitleCase(s) { return s.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
// Parse a board key -> { game, level, levelLabel } or null if not a public game board.
function lbResolve(board) {
  if (typeof board !== 'string' || board.indexOf('hsg_lb_') !== 0) return null;
  var rest = board.slice(7);                 // strip 'hsg_lb_'
  var sep = rest.indexOf('__');
  var id = sep < 0 ? rest : rest.slice(0, sep);
  var level = sep < 0 ? '' : rest.slice(sep + 2);
  var game = LB_BY_ID[id];
  if (!game || LB_SKIP_LEVELS[level]) return null;
  // Consolidated games: keep only the one canonical board, and show no level chip.
  if (LB_ONLY_LEVEL.hasOwnProperty(id)) {
    if (level !== LB_ONLY_LEVEL[id]) return null;
    return { game: game, level: level, levelLabel: '' };
  }
  var label = LB_LEVEL_LABELS.hasOwnProperty(level) ? LB_LEVEL_LABELS[level] : lbTitleCase(level);
  return { game: game, level: level, levelLabel: label };
}
