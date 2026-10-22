import { escapeHtml, parseRecipeText, renderRecipeBody, slugify, validateRecipe } from './recipe.js';

const config = JSON.parse(document.getElementById('site-config').textContent);
const input = document.getElementById('recipe-input');
const messages = document.getElementById('add-messages');
const actions = document.getElementById('add-actions');
const saveLink = document.getElementById('save-link');
const futureUrl = document.getElementById('future-url');
const preview = document.getElementById('preview');

function uniqueSlug(name) {
  const base = slugify(name) || 'recipe';
  let slug = base;
  for (let i = 2; config.existing.includes(slug); i++) slug = `${base}-${i}`;
  return slug;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function show(list, kind) {
  return list.map((m) => `<p class="msg ${kind}">${escapeHtml(m)}</p>`).join('');
}

function update() {
  actions.hidden = true;
  preview.innerHTML = '';
  const text = input.value.trim();
  if (!text) {
    messages.innerHTML = '';
    return;
  }
  let data;
  try {
    data = parseRecipeText(text);
  } catch (err) {
    messages.innerHTML = show([err.message], 'error');
    return;
  }
  const { recipe, errors, warnings } = validateRecipe(data);
  messages.innerHTML = show(errors, 'error') + show(warnings, 'warning');
  if (!recipe) return;

  if (!recipe.date) recipe.date = today();
  const slug = uniqueSlug(recipe.name);
  const params = new URLSearchParams({
    filename: `recipes/${slug}.json`,
    value: `${JSON.stringify(recipe, null, 2)}\n`,
    message: `Add recipe: ${recipe.name}`,
  });
  saveLink.href = `https://github.com/${config.repo}/new/${config.branch}?${params}`;
  futureUrl.textContent = `${config.siteUrl}recipes/${slug}/`;
  actions.hidden = false;
  preview.innerHTML = `<h2 class="preview-title">Preview</h2>${renderRecipeBody(recipe)}`;
}

input.addEventListener('input', update);

// Agents can also hand over a link like .../add/#recipe=<url-encoded JSON>.
const hash = new URLSearchParams(location.hash.slice(1)).get('recipe');
if (hash) {
  input.value = hash;
  update();
}
