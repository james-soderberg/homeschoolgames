# HomeschoolGames — Game Mechanics & Decisions

> Working doc for the "give each quiz game a purposeful mechanism" initiative and
> the Circa period-selector / deck expansion. Written so another agent can pick
> up where this left off. Status tags: **DONE** (built + committed),
> **DATA-READY** (assets generated, not wired in), **DESIGNED** (agreed, not
> built), **TBD** (open question).

---

## 1. The Quest-Rail engine (DONE)

Files: `assets/js/quest-rail.js`, `assets/css/quest-rail.css`.

A reusable **"build vs. threat"** mechanic that lives in a game's right rail
(replaces the streak counter). It is **theme-driven** so each game is mostly an
art/tuning swap.

```js
const quest = HSGQuest.init({
  gameId: 'bible-quiz',
  gameName: 'Bible Quiz',
  theme: HSGQuest.themes.ark,
  mount: document.getElementById('questRail'),
  boardMount: '.quest-board'   // optional extra leaderboard mounts (menu/end screens)
});
quest.correct();  // one right answer  -> build a piece (+ theme-specific lift)
quest.wrong();    // one wrong answer  -> threat advances
quest.endRun();   // bank the current run (e.g. on "Start Over")
```

A **theme** supplies: `buildGoal`, `threatMax` (hidden lose threshold),
`threatRelief`, labels, and the render hooks `buildScene(host)`,
`render(host, state)`, `onComplete(host)`, `onFail(host)`. State is
`{ build, threat, run, buildGoal, threatMax }`.

- Leaderboard ("most built in a run") is local, stored at
  `localStorage['hsg_quest_<gameId>']`, top 10, name shown as "First L.".
- Reuses `.hsg-rail` / `.hsg-board*` / `.hsg-overlay` / `.hsg-modal` styles from
  `streak-rail.css`, so games that use quest-rail still link `streak-rail.css`.
- For a wide rail that pushes the question column off-centre, add
  `game-layout--quest` to the game's `.game-layout` div (see Bible Quiz).

**Plan:** David vs. Goliath, the Storm chase, and the Time Machine should each be
a new `HSGQuest.themes.*` (art + tuning), not new engines.

---

## 2. Per-game mechanic decisions

| Game | Mechanic | Status |
|---|---|---|
| Bible Quiz | **Noah's Ark** (build vs. flood) | **DONE** |
| Bible Trivia (NEW game) | **David vs. Goliath** | **DESIGNED** |
| Flag Frenzy | **Around-the-World + Storm chase** | **DESIGNED** |
| Who Said It? | **Time Machine** | **DESIGNED** (penalty/lose side TBD) |
| Math Drill | **Asteroid Math** (full arcade reskin — NOT quest-rail) | **DESIGNED** |
| Circa | unchanged mechanic; getting period-selector + bigger deck | see §3 |

### 2a. Bible Quiz → Noah's Ark — DONE
`HSGQuest.themes.ark`. Wired into `games/bible-quiz/index.html`
(`quest.correct()` on right, `quest.wrong()` on wrong, `quest.endRun()` in
`startRound()`). Behaviour:
- Ark floats on a fixed sea (waves, rain, drifting clouds, bobbing ark).
- **Right answer → lifts the ark up out of the water AND builds the next piece**
  (hammer-tap FX).
- **Wrong answer → the ark sinks lower** toward the waves.
- **Water covering the ark = lose** (run banks, ark plunges + splash). The lose
  threshold is **hidden** — tuning `threatMax: 6`, and a correct answer does
  `threat = max(0, threat-1)`. Only goal shown to the player: "keep the ark
  above water." No flood meter; meters are 🔨 build and 🛟 arks.
- **Finish an ark** (8 pieces) → 🌈 rainbow + sun + animals aboard, counts toward
  the **Arks Built** leaderboard. The payoff scene **lingers ~5s** before resetting
  (both the engine reset timeout and `onComplete` cleanup are 5000ms; during that
  window the rail is "busy" and ignores answers — acceptable because the player is
  reading + clicking Next).
- Rail is wide (~560px) via `game-layout--quest`.

### 2b. Bible Trivia (NEW game) → David vs. Goliath — DESIGNED
A new general-Bible-trivia game (characters, events, numbers, OT/NT), same
4-option format as the other quizzes. Rail shows Goliath looming, David below.
- **Correct** → David winds the sling / gathers a smooth stone (charge meter, ~5
  stones to a shot).
- **Wrong** → Goliath takes a heavy step closer (and you drop a loaded stone).
- **Payoff** → full charge = land the shot, Goliath topples; a bigger giant steps
  up next round.
- **Lose** → Goliath reaches David before you land a shot (streak/run resets).
Needs: a trivia question deck + a `goliath` quest-rail theme.

### 2c. Flag Frenzy → Around-the-World + Storm chase — DESIGNED
Fly leg to leg; each correct lands you in the next country (passport/journey).
The **bad thing** = a **planet-swallowing storm front chasing you around the
globe**: correct answers outrun it, wrong answers let it gain **and** turn the
plane back a stop. If the storm catches you, the run ends. (Combines the
"go-backwards" idea with the chase.)

### 2d. Who Said It? → Time Machine — DESIGNED (penalty TBD)
Each correct **charges the machine and jumps an era**, matching the quote periods
(Ancient → Founding → Modern → present day); reach the present to "complete a
trip." **Open question:** the penalty / lose side — e.g. wrong answers drain the
power core / strand you in the wrong era / a paradox meter fills. Decide before
building.

Full Who-Said-It idea menu (for reference): Carve the Monument, Wall of Fame,
**Time Machine ✅**, Torch Relay, Unfurl the Scroll, Printing Press, Win the
Debate (crowd meter), Build the Great Library, Light the Marquee, Mint the
Collection.

### 2e. Math Drill → Asteroid Math — DESIGNED (its own game, not quest-rail)
A full arcade reskin (like Dragon Siege), NOT the quest rail. Math problems ride
in as **asteroids** drifting toward the ship. **One active problem is shown at a
time, but multiple asteroids are visibly incoming** so the player feels the time
pressure. Answer the active asteroid: correct = blast it; **a wrong answer (or an
asteroid that reaches the ship) deals a hit**. Lives/shields, score, ramping
spawn rate/speed, game over at zero shields.
- **Input:** lean toward "tap the right answer" for the active asteroid (4 chips,
  also A/B/C/D) — matches "answer the wrong one and it hits you" and works on
  touch. (Type-the-number was the alternative.)

---

## 3. Circa — period selector + deck expansion

### 3a. Period selector (DESIGNED, not built)
After clicking **Solo**, the player picks a **time period** (era chips), then
plays with cards from those periods only.
- Doubles as a **difficulty dial** (narrow/dense span = harder, since Circa is
  "pick the closest date") and a **study-focus tool** (drill one era) — strong
  homeschool fit.
- Buckets are **derived from each card's `year`** (no manual tagging):
  Prehistory `<3000BC`, Ancient `3000–500BC`, Classical `500BC–500AD`,
  Medieval `500–1500`, Early Modern `1500–1800`, 1800s, 1900s, 2000s.
- **Multi-select** recommended (combine eras to grow the pool / make combos like
  "the ancient world"). Show a card count on each chip. Default = "All Time"
  (today's behaviour).
- Note: "narrow ≠ always harder" — difficulty comes from card **density**, not
  span (Prehistory is sparse-but-spread = easy; 1900s is dense = hard). Don't
  label eras easy/hard.
- Watch thin pools vs. the 6-card hand — combine eras or shrink the hand for
  small selections.

### 3b. Deck expansion (DATA-READY)
Goal was ~200 cards per era. Generated via background agents (one per era),
each validated (schema, year bounds, ASCII, dupes, spot-checked dates), then
merged with the existing 170 cards and title-deduped.

**Card schema (unchanged):**
`{ "title": "2-6 words", "desc": "one sentence", "year": <int, negative=BC>, "approx": <bool> }`

**Result: 1,746 cards.** Per era:

| Era | Cards |
|---|---|
| Prehistory (<3000 BC) | 132 |
| Ancient (3000–500 BC) | 230 |
| Classical (500 BC–500 AD) | 234 |
| Medieval (500–1500) | 242 |
| Early Modern (1500–1800) | 239 |
| 1800s | 218 |
| 1900s | 298 |
| 2000s (2000–2024) | 153 |

Prehistory (132) and 2000s (153) fall short of 200 on purpose — there aren't 200
distinct, datable prehistoric events, and 2000s is only a 25-year span. Both are
still plenty for a filtered game. `approx` usage is honest (high in deep
antiquity, ~0 in the modern eras).

**The generated deck is saved at `assets/data/circa-deck.json`** (1,746 cards,
sorted by year). It is **NOT yet wired into the game** — `games/circa/index.html`
still has its original inline `const DECK`. Integration notes:
- 1,746 cards is too big to keep inline — load `circa-deck.json` (or convert to a
  JS module `assets/js/circa-deck.js` exposing `window.CIRCA_DECK`, like
  `assets/js/map-data.js`) and replace the inline `DECK`.
- The cards are LLM-generated and only sampled by a human so far — worth a
  skim/spot-check before shipping, especially dates.

---

## 4. Related building blocks already in the repo
- `assets/js/streak-rail.js` / `streak-rail.css` — the animated "Fire Streak"
  counter + local streak leaderboard used by Flag Frenzy, Who Said It?, Math
  Drill, Map Quiz, and Circa (solo). Bible Quiz replaced it with quest-rail.
- Local leaderboards only (localStorage); see the project memory note. Going
  global later = swap the storage layer for Cloudflare KV/D1.
- Home page (`index.html`) is a centered flex-wrap tile grid (no lopsided last
  row); games tagged `game-tile--new` / `game-tile--featured` get badges.

## 5. Open questions to resolve next
- Who Said It? Time Machine **penalty/lose mechanic**.
- Circa period selector: final bucket list + multi-select vs single + whether the
  hand auto-shrinks for thin pools.
- Whether to add `category`/`region` tags to the deck (cheap now, enables
  "Science through the ages" style filters later) — currently **not** tagged.
- Human review pass over the generated Circa deck before integration.
