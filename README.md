# HomeschoolGames.app

Educational games for homeschoolers. Simple, focused, no ads, no accounts.

The home page groups games by **subject**; each subject tile opens a page
listing its games. An **All Games** page lists everything in one flat grid.

## Games by subject

**History**
- **Circa** - History card game. A center card is shown; play the card from your hand closest in date.
- **Who Said It?** - Match a famous quote to the person who said it.

**Math**
- **Bridge Run** - Answer math questions to build the bridge and keep running.

**Science**
- **Element Hunter** - Hunt down elements on the periodic table.

**Geography**
- **Map Quiz** - Click the country on the map. Americas, Europe, Asia, Africa.
- **Flag Frenzy** - Identify the country from its flag.

**Typing**
- **Word Racer** - Type a classic Aesop's fable to drive your car past the rivals; faster, cleaner typing wins.
- **Dragon Siege** - Typing defense. Type the word above each foe to strike it down before it reaches your keep. Three realms by word difficulty.

**Spelling**
- **Letter Catch** - Catch falling letters in order to spell each word.
- **Letter Snake** - Steer a snake to eat letters in spelling order.

**Bible**
- **Bible Quiz** - Multiple-choice questions on Scripture, stories, and people.
- **Bible Trivia** - A chariot chase across the desert. Answer questions on people, events, numbers, and places (OT & NT) to outrun Pharaoh's army and reach the Red Sea, which parts for you and closes behind you.

## Structure

```
index.html                  ← Home page - subject tiles
all-games.html              ← Flat list of every game
subjects/                   ← One page per subject
  history.html  math.html  science.html
  geography.html  typing.html  spelling.html  bible.html
assets/
  css/
    site.css                ← Shared styles (incl. game tiles + back button)
    streak-rail.css         ← Streak "fire rail" sidebar
  js/
    sfx.js                  ← Shared sound effects + mute toggle (HSGSound)
    fx.js                   ← Shared confetti / banners / summary (HSGfx)
    streak-rail.js          ← Streak rail + local leaderboard
    map-data.js             ← Map Quiz geography data
    spelling-words.js       ← Shared spelling word lists
games/
  circa/  who-said-it/  bridge-run/  element-hunter/
  map-quiz/  flag-frenzy/  word-racer/  dragon-siege/
  letter-catch/  letter-snake/  bible-quiz/  bible-trivia/
```

Each game is a single self-contained `index.html`. Leaderboards and best
scores are stored locally per device via `localStorage`.

## Deployment

This is a static site - no build step needed.

**Cloudflare Pages:**
1. Push this repo to GitHub
2. Cloudflare Pages → Create project → Connect GitHub repo
3. Build command: (leave blank)
4. Output directory: `/` (root)
5. Deploy

Every push to `main` auto-deploys.

## Development

Open any `.html` file directly in a browser, or use a local server:

```bash
npx serve .
# or
python3 -m http.server 8080
```
