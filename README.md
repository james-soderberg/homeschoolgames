# HomeschoolGames.app

Educational games for homeschoolers. Simple, focused, no ads, no accounts.

## Games

- **Circa** — History card game. Guess event dates, closest wins.
- **Map Quiz** — Click the country on the map. Americas, Europe, Asia, Africa.
- **Math Drill** — Click the correct answer. Four operations, three difficulty levels.

## Structure

```
index.html                  ← Home page / game hub
assets/
  css/site.css              ← Shared styles
games/
  circa/index.html
  map-quiz/index.html
  math-drill/index.html
```

## Deployment

This is a static site — no build step needed.

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
