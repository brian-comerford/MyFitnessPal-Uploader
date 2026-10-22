// Builds the static site into _site/ from the JSON files in recipes/.
// Usage: node scripts/build.mjs   (SITE_URL, GITHUB_REPOSITORY, BRANCH are set by the Pages workflow)
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, recipeJsonLd, renderRecipeBody, slugify, validateRecipe } from '../src/recipe.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '_site');
const recipesDir = path.join(root, 'recipes');

const siteUrl = (process.env.SITE_URL || 'http://localhost:8000').replace(/\/+$/, '') + '/';
const repo = process.env.GITHUB_REPOSITORY || 'brian-comerford/MyFitnessPal-Uploader';
const branch = process.env.BRANCH || 'main';

function page({ title, depth, body, head = '', scripts = [] }) {
  const base = depth ? '../'.repeat(depth) : './';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${base}assets/style.css">
${head}
</head>
<body>
<nav class="top"><a href="${base}">My Recipes</a><a href="${base}add/">+ Add recipe</a></nav>
<main>
${body}
</main>
<script type="module" src="${base}assets/app.js"></script>
${scripts.map((s) => `<script type="module" src="${base}assets/${s}"></script>`).join('\n')}
</body>
</html>
`;
}

const jsonForScript = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

async function loadRecipes() {
  const files = (await readdir(recipesDir)).filter((f) => f.endsWith('.json')).sort();
  const recipes = [];
  const problems = [];
  for (const file of files) {
    const slug = file.slice(0, -'.json'.length);
    if (slug !== slugify(slug)) problems.push(`${file}: file name must be lowercase-with-dashes, e.g. ${slugify(slug)}.json`);
    let data;
    try {
      data = JSON.parse(await readFile(path.join(recipesDir, file), 'utf8'));
    } catch (err) {
      problems.push(`${file}: invalid JSON (${err.message})`);
      continue;
    }
    const { recipe, errors, warnings } = validateRecipe(data);
    for (const w of warnings) console.warn(`warning: ${file}: ${w}`);
    if (errors.length) problems.push(...errors.map((e) => `${file}: ${e}`));
    else recipes.push({ slug, recipe });
  }
  if (problems.length) {
    console.error(problems.map((p) => `error: ${p}`).join('\n'));
    process.exit(1);
  }
  return recipes.sort((a, b) => (b.recipe.date || '').localeCompare(a.recipe.date || '') || a.recipe.name.localeCompare(b.recipe.name));
}

function indexPage(recipes) {
  const items = recipes.map(({ slug, recipe }) => {
    const n = recipe.nutritionPerServing;
    return `<li><a href="recipes/${slug}/"><span class="name">${escapeHtml(recipe.name)}</span><span class="sub">${Math.round(n.calories)} kcal · ${Math.round(n.protein)} g protein${recipe.date ? ` · ${recipe.date}` : ''}</span></a></li>`;
  });
  const body = `<h1>My Recipes</h1>
<p class="hint">Recipes saved from AI chats, ready to import into MyFitnessPal.</p>
${items.length ? `<ul class="recipe-list">${items.join('')}</ul>` : '<p>No recipes yet. <a href="add/">Add one</a>.</p>'}`;
  return page({ title: 'My Recipes', depth: 0, body });
}

function recipePage(slug, recipe) {
  const url = `${siteUrl}recipes/${slug}/`;
  const head = `<link rel="canonical" href="${escapeHtml(url)}">
${recipe.description ? `<meta name="description" content="${escapeHtml(recipe.description)}">` : ''}
<script type="application/ld+json">${jsonForScript(recipeJsonLd(recipe, url))}</script>`;
  return page({ title: recipe.name, depth: 2, head, body: renderRecipeBody(recipe, { pageUrl: url }) });
}

function addPage(recipes) {
  const config = { siteUrl, repo, branch, existing: recipes.map((r) => r.slug) };
  const body = `<h1>Add a recipe</h1>
<p class="hint">Paste the recipe block your AI gave you. You'll see a preview, then save it to your site with one tap on GitHub.</p>
<textarea id="recipe-input" rows="8" placeholder='{"name": "...", "servings": 4, ...}' spellcheck="false"></textarea>
<div id="add-messages"></div>
<div id="add-actions" hidden>
<a id="save-link" class="button" target="_blank" rel="noopener">Save to my site on GitHub</a>
<p class="hint">On GitHub, tap <strong>Commit changes</strong>. About a minute later the recipe will be live at <code id="future-url"></code></p>
</div>
<div id="preview"></div>
<script id="site-config" type="application/json">${jsonForScript(config)}</script>`;
  return page({ title: 'Add a recipe', depth: 1, body, scripts: ['add.js'] });
}

async function write(rel, content) {
  const file = path.join(outDir, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

const recipes = await loadRecipes();
await rm(outDir, { recursive: true, force: true });
await cp(path.join(root, 'site'), outDir, { recursive: true });
await cp(path.join(root, 'src', 'recipe.js'), path.join(outDir, 'assets', 'recipe.js'));
await write('index.html', indexPage(recipes));
await write('add/index.html', addPage(recipes));
for (const { slug, recipe } of recipes) await write(`recipes/${slug}/index.html`, recipePage(slug, recipe));
await write('recipes.json', JSON.stringify(recipes.map(({ slug, recipe }) => ({ slug, url: `${siteUrl}recipes/${slug}/`, name: recipe.name })), null, 2));
await write('.nojekyll', '');
console.log(`Built ${recipes.length} recipe(s) into _site/ for ${siteUrl}`);
