# MyFitnessPal Uploader

A personal recipe site on GitHub Pages that puts recipes from AI chats (ChatGPT, Claude)
into MyFitnessPal in a couple of taps.

**Site:** https://brian-comerford.github.io/MyFitnessPal-Uploader/

MyFitnessPal has no public API, so nothing here logs in to MFP. Instead, every recipe gets
its own page with standard [schema.org Recipe](https://schema.org/Recipe) data, which
MFP's **Add from web** recipe importer reads. Each page also has a tap-to-copy nutrition
panel for MFP's **Create a food** form.

## Using it

1. Paste the block in [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) into your ChatGPT or Claude
   custom/project instructions (one time).
2. In a chat about a meal, say **"save this recipe"**. The AI gives you a JSON block.
3. Open the site's **+ Add recipe** page, paste it, check the preview, and tap
   **Save to my site on GitHub** → **Commit changes**.
4. About a minute later the recipe page is live. On it, tap **Copy** next to the link, then in
   the MFP app: **Recipes → Create a recipe → Add from web**, paste, check the ingredient
   matches, and save.

## How it works

- `recipes/*.json` — one file per recipe (format in AI_INSTRUCTIONS.md).
- `src/recipe.js` — validation and rendering, shared by the build and the Add page.
- `scripts/build.mjs` — builds the static site into `_site/`; fails on invalid recipes.
- `site/` — static assets (CSS, scripts).
- `.github/workflows/pages.yml` — builds and deploys on every push to `main`.

Run locally with `npm run serve`, then open http://localhost:8000.
