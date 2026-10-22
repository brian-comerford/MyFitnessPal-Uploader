# Instructions for AI assistants

Paste the block below into ChatGPT (Settings → Personalization → Custom instructions,
or a Project's instructions) or Claude (a Project's instructions). After that you can
just say **"save this recipe"** in a chat about a meal.

---

When I ask you to save a recipe or meal to MyFitnessPal, produce a recipe in this
exact JSON format, inside a single ```json code block:

```json
{
  "name": "Chicken Burrito Bowl",
  "description": "One short sentence.",
  "servings": 4,
  "servingSize": "1 bowl",
  "prepMinutes": 10,
  "cookMinutes": 25,
  "ingredients": [
    "454 g boneless skinless chicken breast",
    "185 g uncooked long-grain white rice"
  ],
  "instructions": ["Step one.", "Step two."],
  "nutritionPerServing": {
    "calories": 474, "fat": 7.4, "saturatedFat": 1.3, "cholesterol": 83, "sodium": 875,
    "carbohydrates": 64, "fiber": 8, "sugar": 4, "protein": 36
  },
  "tags": ["dinner"]
}
```

Rules:
- Required: `name`, `servings`, `ingredients`, and `nutritionPerServing` with at least
  `calories`, `protein`, `carbohydrates`, `fat`. Everything else is optional.
- Each ingredient is one line: **amount, unit, then a plain food name** a food database
  would recognise ("150 g frozen sweet corn", not "a handful of corn"). Prefer grams.
  State raw vs cooked and drained where it matters. No "to taste" items.
- Nutrition values are **per serving**, plain numbers with no units: grams for
  fat/carbs/protein/fiber/sugar, milligrams for sodium/cholesterol/potassium. Make sure
  calories ≈ 4×protein + 4×carbs + 9×fat.
- Allowed nutrient keys: calories, fat, saturatedFat, transFat, cholesterol, sodium,
  potassium, carbohydrates, fiber, sugar, protein.

How to deliver it:
- **If you can commit to the GitHub repo `brian-comerford/MyFitnessPal-Uploader`:**
  add the file `recipes/<name-in-lowercase-with-dashes>.json` on the `main` branch, also
  set `"date"` to today (YYYY-MM-DD), then tell me the link
  `https://brian-comerford.github.io/MyFitnessPal-Uploader/recipes/<same-name>/`
  (live about a minute after the commit).
- **Otherwise:** give me the JSON block and tell me to open
  https://brian-comerford.github.io/MyFitnessPal-Uploader/add/ and paste it in.
