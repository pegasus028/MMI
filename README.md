# MMI Practice Circuit

In-class practice app for Multiple Mini Interviews: a synced class clock, rotating trio roles, interviewer prompts, an observer checklist and feedback reports that travel by QR code. Satriwithaya EP · M6 · T.Chris. Version 1.2.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page. Edit `MMI_CONFIG` here (below). |
| `app.css` | Styles (light and dark). |
| `js/core.js` | Session codes, clock, rotation, report codes, scoring. No DOM; also runs in Node. |
| `js/qr.js` | QR code generator (no third-party code). |
| `js/app.js` | The interface. |
| `mmi-content.json` | All content: stations, 288 scenarios, criteria, feedback text, presets, glossaries. |
| `mmi-content.schema.json` | JSON Schema for the content file. |
| `sw.js` | Offline cache, so a dropped Wi-Fi doesn't stop a lesson. |
| `tests/run-tests.js` | SPEC §15 vectors in Node: `node tests/run-tests.js` |
| `tests/browser_test.py` | Browser checks (Playwright), run against a local server on port 8765. |
| `tools/content-check.js` | Content rules (SPEC §8, §18): `node tools/content-check.js` |
| `SPEC.md`, `CHANGES.md`, `DECISIONS.md`, `QA-REPORT.md` | Specification, v1.1 review and changes, build decisions, audit reports. |
| `tools/` | Dated content patch scripts and the three-phone walkthrough bot. |

## Deploy to GitHub Pages

The app is live at **https://pegasus028.github.io/MMI/** (repository `pegasus028/MMI`, branch `main`, root folder). `APP_URL` in `index.html` is set to that address so QR codes always point at the live site.

To ship a change: edit, run the tests (below), bump `CACHE` in `sw.js` (for example `mmi-circuit-v1.2.1`) so phones pick up the new version, then push to `main`. GitHub Pages serves the new files within a minute or two.

Content changes go in `mmi-content.json` only (the UI files hold no wording). Patch scripts that changed content are kept in `tools/` with the date in the name.

The app shares the `mmi.*` storage keys with the earlier classroom build. If both live on `pegasus028.github.io`, reports saved in one appear in the other.

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
node tools/content-check.js                 # content rules over all 288 scenarios
python3 -m http.server 8765 &               # from this folder
python3 tests/browser_test.py               # 864 role renders, sync, hand-off, widths, themes, no-storage
python3 tools/walkthrough/three-phone-walk.py   # three simulated B2 students, every class profession x station (~30 min)
```
