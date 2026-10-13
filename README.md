# KSU Kabba - Student Registration 2026/2027

Static site (GitHub Pages) + Google Apps Script backend that saves to Google Sheets.

## Structure
- `index.html`, `css/style.css`, `js/` (app.js, lga.js, config.js), `assets/` - the website
- `apps-script/Code.gs` - backend (paste into Apps Script; not served by GitHub)

## Setup
1. Apps Script: paste `apps-script/Code.gs`, run `authorize` once, then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone). Copy the `/exec` URL.
2. Paste that URL into `js/config.js`.
3. GitHub: repo Settings > Pages > Deploy from a branch > `main` / `(root)`.
4. After changing `Code.gs`, deploy a **New version** (the URL stays the same).

## Documents
Uploads are saved to Google Drive (folder `KSU Kabba Student Credentials 2026-2027`, one subfolder per JAMB number); links are stored in the sheet. Run `authorize` once after updating `Code.gs` so Drive permission is granted.
