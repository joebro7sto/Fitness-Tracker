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

## GitHub Pages: step-by-step to publish updates

Use this checklist any time you change code and want the website to update.

1. **Commit your local changes**
   ```bash
   git add .
   git commit -m "Describe your update"
   ```
2. **Push the branch to GitHub**
   ```bash
   git push origin <your-branch>
   ```
3. **Open a Pull Request** from your branch into `main` on GitHub.
4. **Merge the Pull Request** after review.
5. **Confirm GitHub Pages source** in repo settings:
   - Go to **Settings → Pages**
   - Set source to **Deploy from a branch**
   - Branch should be **main** (root)
6. **Wait for deployment**
   - Check **Actions** tab for Pages build/deploy completion.
7. **Hard refresh on phone/Safari**
   - Close old tab and reopen the site URL.
   - If needed, clear website data in iOS Safari settings.

### If updates still do not appear

- Make sure the PR was merged into the same branch GitHub Pages deploys from.
- Verify you are opening the correct Pages URL for this repository.
- If using a Home Screen shortcut, remove and re-add it after deploy.
- This project appends a version query string to CSS/JS imports in `index.html` to reduce stale-cache issues after deploy.
