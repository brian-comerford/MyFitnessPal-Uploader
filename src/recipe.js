// Shared recipe logic. Plain ES module with no Node or browser APIs, so the
// build script and the in-browser "Add a recipe" page use the same code.

// Nutrients in the order MyFitnessPal's "Create Food" form asks for them.
export const NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: '', required: true, schema: 'calories' },
  { key: 'fat', label: 'Total Fat', unit: 'g', required: true, schema: 'fatContent' },
  { key: 'saturatedFat', label: 'Saturated Fat', unit: 'g', schema: 'saturatedFatContent' },
  { key: 'transFat', label: 'Trans Fat', unit: 'g', schema: 'transFatContent' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', schema: 'cholesterolContent' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', schema: 'sodiumContent' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
  { key: 'carbohydrates', label: 'Total Carbohydrates', unit: 'g', required: true, schema: 'carbohydrateContent' },
  { key: 'fiber', label: 'Dietary Fiber', unit: 'g', schema: 'fiberContent' },
  { key: 'sugar', label: 'Sugars', unit: 'g', schema: 'sugarContent' },
  { key: 'protein', label: 'Protein', unit: 'g', required: true, schema: 'proteinContent' },
];

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isStringList = (v) => Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString);

// Accepts raw text pasted from a chat: tolerates ```json fences and stray prose
// around a single JSON object.
export function parseRecipeText(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No recipe found. Paste the JSON block your AI gave you.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    throw new Error(`That isn't valid recipe JSON (${err.message}). Ask your AI to resend it.`);
  }
}

// Returns { recipe, errors, warnings }. `recipe` is a cleaned copy with only
// known fields, safe to render.
export function validateRecipe(input) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { recipe: null, errors: ['Recipe must be a JSON object.'], warnings };
  }

  const recipe = {};
  if (isNonEmptyString(input.name)) recipe.name = input.name.trim();
  else errors.push('"name" is required.');

  if (Number.isFinite(input.servings) && input.servings > 0) recipe.servings = input.servings;
  else errors.push('"servings" must be a number greater than 0.');

  if (isStringList(input.ingredients)) recipe.ingredients = input.ingredients.map((s) => s.trim());
  else errors.push('"ingredients" must be a non-empty list of text lines, e.g. "200 g chicken breast".');

  if (input.instructions !== undefined) {
    if (isStringList(input.instructions)) recipe.instructions = input.instructions.map((s) => s.trim());
    else errors.push('"instructions" must be a list of text steps.');
  }

  for (const key of ['description', 'servingSize', 'notes', 'date']) {
    if (input[key] === undefined) continue;
    if (isNonEmptyString(input[key])) recipe[key] = input[key].trim();
    else errors.push(`"${key}" must be text.`);
  }
  if (recipe.date && !/^\d{4}-\d{2}-\d{2}$/.test(recipe.date)) errors.push('"date" must look like 2026-10-22.');

  for (const key of ['prepMinutes', 'cookMinutes']) {
    if (input[key] === undefined) continue;
    if (Number.isFinite(input[key]) && input[key] >= 0) recipe[key] = input[key];
    else errors.push(`"${key}" must be a number of minutes.`);
  }

  if (input.tags !== undefined) {
    if (Array.isArray(input.tags) && input.tags.every(isNonEmptyString)) recipe.tags = input.tags.map((t) => t.trim());
    else errors.push('"tags" must be a list of text.');
  }

  const n = input.nutritionPerServing;
  if (!n || typeof n !== 'object') {
    errors.push('"nutritionPerServing" is required (calories, protein, carbohydrates, fat per serving).');
  } else {
    recipe.nutritionPerServing = {};
    for (const { key, required } of NUTRIENTS) {
      if (n[key] === undefined) {
        if (required) errors.push(`"nutritionPerServing.${key}" is required.`);
        continue;
      }
      if (Number.isFinite(n[key]) && n[key] >= 0) recipe.nutritionPerServing[key] = n[key];
      else errors.push(`"nutritionPerServing.${key}" must be a number (no units).`);
    }
    const unknown = Object.keys(n).filter((k) => !NUTRIENTS.some((x) => x.key === k));
    if (unknown.length) warnings.push(`Ignored unknown nutrients: ${unknown.join(', ')}.`);

    const { calories, protein, carbohydrates, fat } = recipe.nutritionPerServing;
    if ([calories, protein, carbohydrates, fat].every(Number.isFinite) && calories > 0) {
      const fromMacros = 4 * protein + 4 * carbohydrates + 9 * fat;
      if (Math.abs(fromMacros - calories) / calories > 0.15) {
        warnings.push(`Calories (${calories}) don't match the macros (~${Math.round(fromMacros)} kcal). Double-check the numbers.`);
      }
    }
  }

  const unknownTop = Object.keys(input).filter(
    (k) => !['name', 'description', 'servings', 'servingSize', 'prepMinutes', 'cookMinutes', 'ingredients',
      'instructions', 'nutritionPerServing', 'tags', 'notes', 'date'].includes(k),
  );
  if (unknownTop.length) warnings.push(`Ignored unknown fields: ${unknownTop.join(', ')}.`);

  return { recipe: errors.length ? null : recipe, errors, warnings };
}

function formatAmount(value) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

const isoMinutes = (m) => `PT${Math.round(m)}M`;

// schema.org Recipe data. This is what MyFitnessPal's "Add from web" importer reads.
export function recipeJsonLd(recipe, url) {
  const n = recipe.nutritionPerServing;
  const nutrition = { '@type': 'NutritionInformation' };
  if (recipe.servingSize) nutrition.servingSize = recipe.servingSize;
  for (const { key, unit, schema } of NUTRIENTS) {
    if (!schema || n[key] === undefined) continue;
    nutrition[schema] = key === 'calories' ? `${formatAmount(n[key])} calories` : `${formatAmount(n[key])} ${unit}`;
  }
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    recipeYield: `${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}`,
    recipeIngredient: recipe.ingredients,
    nutrition,
  };
  if (url) data.url = url;
  if (recipe.description) data.description = recipe.description;
  if (recipe.date) data.datePublished = recipe.date;
  if (recipe.prepMinutes !== undefined) data.prepTime = isoMinutes(recipe.prepMinutes);
  if (recipe.cookMinutes !== undefined) data.cookTime = isoMinutes(recipe.cookMinutes);
  if (recipe.prepMinutes !== undefined || recipe.cookMinutes !== undefined) {
    data.totalTime = isoMinutes((recipe.prepMinutes || 0) + (recipe.cookMinutes || 0));
  }
  if (recipe.tags) data.keywords = recipe.tags.join(', ');
  if (recipe.instructions) data.recipeInstructions = recipe.instructions.map((text) => ({ '@type': 'HowToStep', text }));
  return data;
}

function copyButton(value, label) {
  return `<button type="button" class="copy" data-copy="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(label)}">Copy</button>`;
}

// Per-serving values laid out to match MyFitnessPal's "Create Food" form.
export function renderNutritionPanel(recipe) {
  const n = recipe.nutritionPerServing;
  const rows = NUTRIENTS.filter(({ key }) => n[key] !== undefined).map(({ key, label, unit }) => {
    const value = formatAmount(n[key]);
    return `<li><span class="label">${label}</span><span class="value">${value}${unit ? ` ${unit}` : ''}</span>${copyButton(value, label)}</li>`;
  });
  const serving = recipe.servingSize || '1 serving';
  return `<ul class="nutrition">
<li><span class="label">Description</span><span class="value">${escapeHtml(recipe.name)}</span>${copyButton(recipe.name, 'name')}</li>
<li><span class="label">Serving size</span><span class="value">${escapeHtml(serving)}</span>${copyButton(serving, 'serving size')}</li>
<li><span class="label">Servings per recipe</span><span class="value">${formatAmount(recipe.servings)}</span>${copyButton(formatAmount(recipe.servings), 'servings')}</li>
${rows.join('\n')}
</ul>`;
}

export function renderRecipeBody(recipe, { pageUrl } = {}) {
  const n = recipe.nutritionPerServing;
  const meta = [
    `${formatAmount(recipe.servings)} serving${recipe.servings === 1 ? '' : 's'}`,
    recipe.servingSize,
    recipe.prepMinutes !== undefined ? `${recipe.prepMinutes} min prep` : null,
    recipe.cookMinutes !== undefined ? `${recipe.cookMinutes} min cook` : null,
  ].filter(Boolean);

  const importSection = pageUrl
    ? `<section class="card">
<h2>Import into MyFitnessPal</h2>
<div class="link-row"><code>${escapeHtml(pageUrl)}</code>${copyButton(pageUrl, 'recipe link')}</div>
<ol class="steps">
<li>Copy the link above.</li>
<li>In the MyFitnessPal app, open <strong>Recipes</strong> → <strong>Create a recipe</strong> → <strong>Add from web</strong>.</li>
<li>Paste the link, check that each ingredient matched the right food, then save.</li>
</ol>
</section>`
    : '';

  return `<header class="recipe-head">
<h1>${escapeHtml(recipe.name)}</h1>
${recipe.description ? `<p class="description">${escapeHtml(recipe.description)}</p>` : ''}
<p class="meta">${meta.map(escapeHtml).join(' · ')}</p>
<p class="macros"><span><strong>${formatAmount(n.calories)}</strong> kcal</span><span><strong>${formatAmount(n.protein)}</strong> g protein</span><span><strong>${formatAmount(n.carbohydrates)}</strong> g carbs</span><span><strong>${formatAmount(n.fat)}</strong> g fat</span></p>
</header>
${importSection}
<section class="card">
<h2>Or create it as a food</h2>
<p class="hint">In MyFitnessPal: <strong>Create a food</strong>, then copy each value into the matching field, top to bottom. Values are per serving.</p>
${renderNutritionPanel(recipe)}
</section>
<section>
<h2>Ingredients</h2>
<ul class="ingredients">${recipe.ingredients.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
</section>
${recipe.instructions ? `<section><h2>Instructions</h2><ol class="instructions">${recipe.instructions.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol></section>` : ''}
${recipe.notes ? `<section><h2>Notes</h2><p>${escapeHtml(recipe.notes)}</p></section>` : ''}`;
}
