# HomeschoolGames - Game Mechanics & Decisions

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

**Plan:** David vs. Goliath and the Storm chase should each be a new
`HSGQuest.themes.*` (art + tuning), not new engines.

**Two engine modes now exist.** The default is the build-vs-threat model above.
A theme can set **`mode: 'timeline'`** for a single-axis "move a pointer forward/
backward along ordered stops" mechanic instead - `correct()` advances, `wrong()`
retreats (floor 0), reaching the last stop banks a "trip." Used by the Time
Machine (§2d). `init` accepts a `stops` array in this mode; `quest.position()`
returns the current stop index.

---

## 2. Per-game mechanic decisions

| Game | Mechanic | Status |
|---|---|---|
| Bible Quiz | **Noah's Ark** (build vs. flood) | **DONE** |
| Bible Trivia (NEW game) | **Chariot Chase (Exodus)** - full canvas arcade | **DONE** |
| Flag Frenzy | **Around the World in 80 Days** (Fogg vs. Detective Fix) | **DONE** |
| Who Said It? | **Hall of Fame** (collect cartoon portraits) | **DONE** (replaced Time Machine) |
| Math Drill | **Asteroid Math** (full arcade reskin - NOT quest-rail) | **DESIGNED** |
| Circa | unchanged mechanic; getting period-selector + bigger deck | see §3 |

### 2a. Bible Quiz → Noah's Ark - DONE
`HSGQuest.themes.ark`. Wired into `games/bible-quiz/index.html`
(`quest.correct()` on right, `quest.wrong()` on wrong, `quest.endRun()` in
`startRound()`). Behaviour:
- Ark floats on a fixed sea (waves, rain, drifting clouds, bobbing ark).
- **Right answer → lifts the ark up out of the water AND builds the next piece**
  (hammer-tap FX).
- **Wrong answer → the ark sinks lower** toward the waves.
- **Water covering the ark = lose** (run banks, ark plunges + splash). The lose
  threshold is **hidden** - tuning `threatMax: 6`, and a correct answer does
  `threat = max(0, threat-1)`. Only goal shown to the player: "keep the ark
  above water." No flood meter; meters are 🔨 build and 🛟 arks.
- **Finish an ark** (8 pieces) → 🌈 rainbow + sun + animals aboard, counts toward
  the **Arks Built** leaderboard. The payoff scene **lingers ~5s** before resetting
  (both the engine reset timeout and `onComplete` cleanup are 5000ms; during that
  window the rail is "busy" and ignores answers - acceptable because the player is
  reading + clicking Next).
- Rail is wide (~560px) via `game-layout--quest`.

### 2b. Bible Trivia (NEW game) → Chariot Chase (Exodus) - DONE
A **David-vs-Goliath quest-rail theme was built first and scrapped** - a passive
side-rail charge meter felt lame bolted onto a plain quiz. Replaced with a full
**standalone canvas arcade** (à la Dragon Siege), self-contained in
`games/bible-trivia/index.html` (no quest-rail; uses `sfx.js` + `fx.js` only).

The fantasy (historically framed): **Moses leads the Israelites on foot** while
**Pharaoh's four spear-chariots** pursue across the desert. Same 4-option
Bible-trivia deck (people, events, numbers, places, OT & NT).
- **Correct** → the people *surge* ahead (speed lines, dust burst); you gain on the
  army (`gap`↑) and advance toward the sea (`progress`↑).
- **Wrong** → stumble + screen-shake; the army gains (`gap`↓).
- **Dawdling** → a gentle passive `drain` shrinks `gap` while a question waits, so
  reading slowly lets them creep closer (the chase pressure).
- **Win** → `progress` hits 100 → the **Red Sea finale** (scripted, ~6.6s):
  the sea parts → the Israelites cross → the **sea rises to engulf the whole
  screen**, consuming Pharaoh's chariots → the waters recede to reveal the
  **Israelites safe on the far shore** (no violence - the army just sinks/fades).
  Victory overlay + confetti.
- **Lose** → `gap` reaches 0 (army catches up) → a clean **"They caught you!"**
  game-over (no violence), with Correct / Best Streak / % to the Sea.
- Three pace presets (Stroll / Gallop / Full Flight) tune `drain`, `gain`, `loss`,
  and `step`. Best streak persists in `localStorage['bible_trivia_chase_best']`.
- Rendering: parallax desert (pyramids, dunes, scrolling ground); the fleeing crowd
  (`drawWalker`/`drawIsraelites` - Moses with raised staff + a deterministic group);
  Pharaoh's four chariots (`drawRig`/`drawArmy`, galloping horses + spoked wheels +
  spear-bearing riders); a dust particle system; on-canvas 🌊/🐎 meters; and the
  full-screen engulf finale. Scene sized like Dragon Siege (`min(72vh, 680px)`).
- The scrapped goliath theme + its `.gv-*` CSS were removed from
  `quest-rail.js` / `quest-rail.css`.

### 2c. Flag Frenzy → Around the World in 80 Days - DONE
**The storm chase was reskinned to Jules Verne's _Around the World in 80 Days_**
(public domain, 1872): **Phileas Fogg** circles the globe while **Detective Fix**
pursues. Self-contained canvas in `games/flag-frenzy/index.html` (no streak-rail;
uses `sfx.js` + `fx.js`). Name the flag → sail to the next port.

**History / pivot:** first built as an **80-day wager** (a pocket-watch day clock,
a wrong answer = a day-costing mishap, win = reach London ≤ 80 days, with an
"on pace / behind" badge and three difficulty paces). At the user's request this
was **scrapped for an endless streak game** - the day-clock, wager, win/lose-by-days
overlays, pace badge, and difficulty filters were all **removed**. The single design
goal now: **how long a streak (flags in a row) can you build before Fix catches you.**

Current design (DONE):
- **Endless laps.** Reach London (progress ≥ 100) → a **"Around the world! Lap N
  done"** celebration (confetti + flash) → reset the lap and **keep circling**.
  Each lap repositions Fix a little closer and speeds him up (`fixStartFor` /
  `creepFor` / `surgeFor` ramp by lap), so it escalates.
- **Streak is the score.** `correct` → `streak++`, advance one leg (`+step`),
  Fix creeps. A `wrong` answer **resets the streak to 0** but the run continues;
  you can rebuild as long as Fix hasn't caught you. Best streak in the run is banked.
- **Detective Fix is the only fail-state.** A wrong answer is still a **book-accurate
  mishap** (railway ends at Kholby → elephant; opium den; bison; Fort Kearney raid;
  etc.) that **surges Fix closer** (no day cost anymore). When `fixPos ≥ progress`
  → **caught → game over.** Tuned so ~3 quick early misses catch you, more forgiving
  once you've built a lead.
- **Scene** = vintage parchment map: dotted route past the nine book waypoints
  (London → Suez → Bombay → Calcutta → Hong Kong → Yokohama → San Francisco →
  New York → London), a **Fogg token** showing the leg's transport (🚢/🐘/🚂), a
  trailing **🕵️ Fix token**. Canvas HUD: a **🔥 STREAK** panel (top-left), **🌍 Lap N**
  (top-center), and the **Fix "% behind" danger gauge** (top-right). Passing a port
  pops "Arrived in {port}".
- **Layout** is a 100vh flex: header → `play-area` (a **`game-col`** on the left with
  the short map canvas + the question panel, and a persistent **leaderboard rail** on
  the right) → footer. The map canvas flexes to fill; the question panel sizes to its
  content so the page never scrolls on desktop. Mobile (`≤820px`) stacks the rail
  below the game.
- **Streak leaderboard** = the main scoreboard, a **local top-10** in
  `localStorage['atw_streak_board']` (entries `{name, streak, lap}`), shown in the
  right rail. On game-over the overlay **covers the whole `game-col`** (so it always
  fits); if your run cracks the top 10 you **enter your name** (saved to
  `localStorage['atw_name']`), it writes to the board, and your row highlights gold in
  the rail. Header badges show **current streak** + **best**.
- **Flags** render from **vendored SVGs** at `assets/flags/<iso>.svg` (38 files from
  the MIT **flag-icons** set - national flags are factual symbols; see
  `assets/flags/ATTRIBUTION.txt`) for crisp, Wikipedia-style art - emoji blown up to
  hero size was blurry. Each deck entry carries an `iso`. **Clues are opt-in:** the
  blurb is hidden behind a **💡 Need a hint?** button (in a fixed-height slot so the
  reveal doesn't shift the layout) and also reveals on answer; the continent label is
  part of that hint, not always-on. All 38 blurbs were rewritten to be
  geography/landmark hints (not flag-colour restatements, never naming the country).
- The page **title still reads "Around the World in 80 Days"** (the Verne theme +
  route are intact) even though there's no literal 80-day limit now. Listed on the
  home/geography grids as **"Around the World"** (🎩); dir stays `games/flag-frenzy/`.

### 2d. Who Said It? → Hall of Fame collection - DONE (redesigned)
Self-contained in `games/who-said-it/index.html` (does **not** use quest-rail).
**History:** first shipped as a "Time Machine" (timeline rail: forward on right,
knocked back + paradox meter on wrong, paradox-full = timeline collapse). Playtest
verdict: **visuals too busy + gameplay too shallow** (the time machine was paint on
plain MC, knockback was frustrating + repetitive). Scrapped and redesigned around a
**collection** hook instead.

Current mechanic - **collect famous people into a Hall of Fame:**
- Bare-bones quiz on the left (quote → 4 names). The right rail is a **gallery of
  silhouette portraits**, one per person.
- **Right answer → that person's silhouette fills in with their cartoon portrait**
  and joins your Hall of Fame (cell pops + ✨, progress bar advances). The reveal
  card under the quote shows their portrait + era either way, so you always *see*
  who said it (learning reinforcement).
- **Wrong answer → just reveals the answer**, no penalty, no collection. You only
  earn a portrait by getting them right.
- **No lose condition** (the user asked for bare-bones; the collection goal is the
  drive). Quotes are drawn **preferring not-yet-collected people** so you make
  progress; distractors are the 3 era-closest names (by birth year) for plausibility.
- **Persists** in `localStorage['hsg_hof_who-said-it']` (a list of collected names),
  so the Hall of Fame fills up across sessions. "Reset Hall of Fame" clears it.
- **Complete the set (27 people)** → `HSGfx.showSummary` celebration.

Portraits - **`assets/js/portrait.js`** (`HSGPortrait.svg(features)`):
- A **parameterized cartoon-avatar renderer** (no image assets → no licensing
  issues, fully offline). One SVG portrait built from a feature config: `skin`,
  `hair`/`hairStyle`, `facial`/`facialColor`, `hat`, `glasses`, `clothes` (+ tie/
  bowtie/shawl/scarf). Iconic cues make many recognizable: Lincoln = top hat + chin
  beard; Einstein = wild white hair + mustache; Franklin = bald-top + oval glasses;
  Gandhi = bald + round glasses + shawl; Caesar = laurel wreath; Curie = bun, etc.
- The **silhouette** is the same SVG: a `.locked` cell recolors every `.fig` shape to
  one dark fill via CSS (so distinctive headwear still pokes through the shadow) and
  overlays a "?". Unlock = remove `.locked`; fills transition to full colour.
- Per-person feature configs live in the **game's `PEOPLE` array** (also holds each
  person's quote(s), era label, and birth year). Renderer is generic + reusable for
  any future "collect the cast" game.
- **27 people / 30 quotes** (Lincoln, Edison, MLK have two quotes each). Extending =
  add a `PEOPLE` entry with a `face`. Art is good-but-stylized; the iconic figures
  carry it, name plates cover the generic-looking ones. Easy to refine a face by
  tweaking its config or adding a new `hairStyle`/`hat` part to `portrait.js`.

Note: the old **`HSGQuest.themes.timeMachine`** (+ `.tm-*` CSS, + the `mode:'timeline'`
engine path in quest-rail) is now **orphaned** - left in place, harmless, reusable if
another game ever wants a timeline rail. Safe to delete if quest-rail gets trimmed.

Full Who-Said-It idea menu (for reference): Carve the Monument, **Hall of Fame /
Wall of Fame ✅ (built)**, Time Machine (built, then scrapped), Torch Relay, Unfurl
the Scroll, Printing Press, Win the Debate (crowd meter), Build the Great Library,
Light the Marquee, Mint the Collection.

### 2e. Math Drill → Asteroid Math - DESIGNED (its own game, not quest-rail)
A full arcade reskin (like Dragon Siege), NOT the quest rail. Math problems ride
in as **asteroids** drifting toward the ship. **One active problem is shown at a
time, but multiple asteroids are visibly incoming** so the player feels the time
pressure. Answer the active asteroid: correct = blast it; **a wrong answer (or an
asteroid that reaches the ship) deals a hit**. Lives/shields, score, ramping
spawn rate/speed, game over at zero shields.
- **Input:** lean toward "tap the right answer" for the active asteroid (4 chips,
  also A/B/C/D) - matches "answer the wrong one and it hits you" and works on
  touch. (Type-the-number was the alternative.)

---

## 3. Circa - period selector + deck expansion

### 3a. Period selector (DESIGNED, not built)
After clicking **Solo**, the player picks a **time period** (era chips), then
plays with cards from those periods only.
- Doubles as a **difficulty dial** (narrow/dense span = harder, since Circa is
  "pick the closest date") and a **study-focus tool** (drill one era) - strong
  homeschool fit.
- Buckets are **derived from each card's `year`** (no manual tagging):
  Prehistory `<3000BC`, Ancient `3000-500BC`, Classical `500BC-500AD`,
  Medieval `500-1500`, Early Modern `1500-1800`, 1800s, 1900s, 2000s.
- **Multi-select** recommended (combine eras to grow the pool / make combos like
  "the ancient world"). Show a card count on each chip. Default = "All Time"
  (today's behaviour).
- Note: "narrow ≠ always harder" - difficulty comes from card **density**, not
  span (Prehistory is sparse-but-spread = easy; 1900s is dense = hard). Don't
  label eras easy/hard.
- Watch thin pools vs. the 6-card hand - combine eras or shrink the hand for
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
| Ancient (3000-500 BC) | 230 |
| Classical (500 BC-500 AD) | 234 |
| Medieval (500-1500) | 242 |
| Early Modern (1500-1800) | 239 |
| 1800s | 218 |
| 1900s | 298 |
| 2000s (2000-2024) | 153 |

Prehistory (132) and 2000s (153) fall short of 200 on purpose - there aren't 200
distinct, datable prehistoric events, and 2000s is only a 25-year span. Both are
still plenty for a filtered game. `approx` usage is honest (high in deep
antiquity, ~0 in the modern eras).

**The generated deck is saved at `assets/data/circa-deck.json`** (1,746 cards,
sorted by year). It is **NOT yet wired into the game** - `games/circa/index.html`
still has its original inline `const DECK`. Integration notes:
- 1,746 cards is too big to keep inline - load `circa-deck.json` (or convert to a
  JS module `assets/js/circa-deck.js` exposing `window.CIRCA_DECK`, like
  `assets/js/map-data.js`) and replace the inline `DECK`.
- The cards are LLM-generated and only sampled by a human so far - worth a
  skim/spot-check before shipping, especially dates.

---

## 4. Related building blocks already in the repo
- `assets/js/streak-rail.js` / `streak-rail.css` - the animated "Fire Streak"
  counter + local streak leaderboard used by Flag Frenzy, Who Said It?, Math
  Drill, Map Quiz, and Circa (solo). Bible Quiz replaced it with quest-rail.
- Local leaderboards only (localStorage); see the project memory note. Going
  global later = swap the storage layer for Cloudflare KV/D1.
- Home page (`index.html`) is a centered flex-wrap tile grid (no lopsided last
  row); games tagged `game-tile--new` / `game-tile--featured` get badges.

## 5. Open questions to resolve next
- Who Said It? Time Machine: optionally **expand the deck** so each era has 5+
  distinct speakers and the journey can grow to ~8-10 stops (today: 6).
- Circa period selector: final bucket list + multi-select vs single + whether the
  hand auto-shrinks for thin pools.
- Whether to add `category`/`region` tags to the deck (cheap now, enables
  "Science through the ages" style filters later) - currently **not** tagged.
- Human review pass over the generated Circa deck before integration.
