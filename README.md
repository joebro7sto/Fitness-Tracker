# Fitness Tracker

Mobile-first workout logging web app with:

- Calendar home screen with workout day highlighting only when at least one exercise set is logged.
- Per-day notes.
- Muscle groups: chest, back, biceps, triceps, shoulders, forearms, abs, quads, hamstrings, calves, misc.
- Add exercises per muscle group and reuse them in future sessions.
- Add and remove sets for each exercise with reps and weight.
- Top-left menu with sections for Settings, PR's, and Progress.
- Settings: change highlighted day accent color.
- PR's: per-muscle-group personal record cards showing highest weight, reps, and date.
- Progress: monthly workout-day summary.
- Persistent storage using browser `localStorage`.

## Run locally

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.
