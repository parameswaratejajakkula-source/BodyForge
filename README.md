# Body Forge AI

A fitness and diet web app (HTML/CSS/JS, no backend, no login). Data stays in your browser's localStorage.

## Pages
index (landing) → profile → dashboard → analyzer → result, plus workout, diet, progress and ai-chat.

## Works fully standalone
No backend, no database, no login. Open the site and everything works offline: personalised metrics, smart offline coach chat, generated weekly workout + meal plan (plan.html), data backup/restore, print to PDF. An API key is optional and only upgrades chat, photo analysis and plan review.

## How the "AI" works
- **Always on (offline):** BMI, healthy weight range, calories (Mifflin-St Jeor BMR x activity), protein target, goal-based workout/diet plans, rule-based chat fallback.
- **Real AI (optional):** the chat assistant and body-photo analysis call the Anthropic API from `bf-ai.js`. Tap "Enable real AI" in the chat (or accept the prompt in the analyzer) and paste an API key. The key is stored only in this browser.

## Run
Open `index.html` through a local server (ES modules need it), e.g. `python -m http.server`, then visit http://localhost:8000.

## Files
`bf-db.js` local database (window.BF) · `bf-ai.js` metrics + AI helpers (window.BFAI)

## Limits
Not medical advice. Photo analysis is a general visual assessment, not a body-fat measurement. The API key is exposed in the browser, so use it for demos only.
