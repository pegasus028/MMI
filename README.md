# MMI Practice Circuit

In-class practice app for Multiple Mini Interviews: a synced class clock, rotating trio roles, interviewer prompts, an observer checklist and feedback reports that travel by QR code. Satriwithaya EP · M6 · T.Chris. Version 1.1.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page. Edit `MMI_CONFIG` here (below). |
| `app.css` | Styles (light and dark). |
| `js/core.js` | Session codes, clock, rotation, report codes, scoring. No DOM; also runs in Node. |
| `js/qr.js` | QR code generator (no third-party code). |
| `js/app.js` | The interface. |
| `mmi-content.json` | All content: stations, 288 scenarios, criteria, feedback text, presets. |
| `mmi-content.schema.json` | JSON Schema for the content file. |
| `sw.js` | Offline cache, so a dropped Wi-Fi doesn't stop a lesson. |
| `tests/run-tests.js` | SPEC §15 vectors in Node: `node tests/run-tests.js` |
| `tests/browser_test.py` | Browser checks (Playwright), run against a local server on port 8765. |
| `SPEC.md`, `CHANGES.md`, `DECISIONS.md` | Specification, v1.1 review and changes, build decisions. |

## Deploy to GitHub Pages

1. Create a repository under `pegasus028`, for example `mmi-circuit`.
2. Upload every file and folder in this package to the repository root, keeping the `js/` and `tests/` folders.
3. Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save.
4. Open `https://pegasus028.github.io/mmi-circuit/` after a minute.
5. In `index.html`, set `APP_URL` to that address so the QR codes always point to the live site:

```html
window.MMI_CONFIG = { APP_URL: "https://pegasus028.github.io/mmi-circuit/", GRADEBOOK_URL: "" };
```

The app shares the `mmi.*` storage keys with the earlier classroom build. If both live on `pegasus028.github.io`, reports saved in one appear in the other.

When you change `mmi-content.json` or the code, also change `CACHE` in `sw.js` (for example `mmi-circuit-v1.1.1`) so phones pick up the new version.

## Running a lesson

1. Teacher tab → tap the lesson preset → **Start in 1 minute** → **Full screen** on the projector.
2. Students scan the QR on the projector (or type the session code) and pick group and seat.
3. The clock does the rest: reading → interview → feedback → rotate, three times.
4. In feedback, the observer shows the report QR; the interviewee scans it with the phone camera.

Students move one seat letter each lesson (A → B → C) so nobody always gets Scenario C in round 3.

| Lesson | Preset | Settings |
| --- | --- | --- |
| 2 | Station 1 | Focus · 1 · 3 rounds · 1/6/3 |
| 3 | Station 2 | Focus · 2 · 3 rounds · 1/5/3 |
| 4 | Station 6 | Focus · 6 · 3 rounds · 1/6/3 |
| 5 | Station 3 | Focus · 3 · 3 rounds · 1/6/3 |
| 6 | Station 4 | Focus · 4 · 3 rounds · 1/6/3 |
| 7 | Station 5 | Focus · 5 · 3 rounds · 2/4/2 |
| 8 | Mock MMI | Circuit · Set C · 3 rounds · 1/7/3 |

## Optional class gradebook (SPEC §14)

Set `GRADEBOOK_URL` to an Apps Script web-app URL and each observer's report is also sent as one row. A minimal script for a Google Sheet:

```javascript
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  SpreadsheetApp.getActive().getSheetByName("Reports").appendRow([
    new Date(), d.date, d.group, d.observerSeat, d.round, d.sessionCode, d.code,
    d.prof, d.station, d.variant, d.pct, d.glob, d.flags
  ]);
  return ContentService.createTextOutput("ok");
}
```

Deploy as a web app (Execute as: Me · Access: Anyone). After every script change: Deploy → Manage deployments → pencil → **New version** → Deploy. Saving alone does not update the `/exec` URL.

## Tests

```bash
node tests/run-tests.js                     # 98 checks: codes, scoring, clock, rotation, content, QR
python3 -m http.server 8765 &               # from this folder
python3 tests/browser_test.py               # 864 role renders, sync, hand-off, widths, themes, no-storage
```
