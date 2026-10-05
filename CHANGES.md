# MMI Practice Circuit — v1.1 review and changes

5 Oct 2026 · Review of the v1.0 package (SPEC.md, mmi-content.json, reference build) and the changes made in v1.1.

**Compatibility:** report codes, session codes, storage keys and the scoring formula are unchanged. A code made on v1.0 opens on v1.1 with the same percentage. Only band labels, minimum-rating rules and new optional features differ.

## What the review found

| # | Area | Finding |
| --- | --- | --- |
| 1 | Scoring | Bands did not match the 1–4 scale. A candidate rated "Developing" on every criterion scored 33% and was labelled **Needs work**; "Good" on every criterion scored 67% and was only **Satisfactory**. The report contradicted the observer's own ratings. |
| 2 | Scoring | A report could be created from any 5 ratings, for example 5 presence ratings and no station criteria, although station skills carry 50% of the score. |
| 3 | Scoring | Peer raters (friends in the same trio) tend to be lenient and inconsistent. Nothing in v1.0 flagged when the two global ratings disagreed, or when the checklist and the global rating told opposite stories. |
| 4 | Process | The observer had to rate 13 criteria, tick 5 key points and watch for 6 red flags during a 6-minute interview, in one undifferentiated form. |
| 5 | Process | The 3-minute feedback phase had no order. The interviewee spoke last, if at all, and then had to type a 15-character code by hand. |
| 6 | Process | The interviewer's timing guide was static text. Interviewers had to do the arithmetic against the clock themselves. |
| 7 | Prompts | The timing line "Follow-up 3: change the situation ('what if…')" matched only 146 of 288 scenarios (51%); the rest use follow-up 3 to probe deeper. |
| 8 | Prompts | Station 5 door prompts plus tables run up to 147 words (15 scenarios over 110). One minute of reading is tight for B2 readers; the Teacher tab gave no warning. |
| 9 | Guidance | Interviewers could hear the observer's numbers before choosing their own global rating, which anchors it. |
| 10 | Teacher | Lesson settings lived only in a README table; the teacher had to set seven fields by hand each lesson, with no check that the plan fits a 50-minute lesson. |

Content checks that passed: all 288 scenarios have 4 follow-ups, a pressure probe, 5 key points and 2–3 warning signs; every Station 4 scenario has an actor; Station 5 Set C scenarios are claim-evaluation tasks without tables by design.

## Changes in v1.1

### Scoring
- **Bands follow the scale** (`settings.bands`): Outstanding ≥85 · Strong ≥67 · Satisfactory ≥50 · Developing ≥33 · Needs work <33. All 2s → Developing, all 3s → Strong, mostly 4s → Outstanding. The percentage formula is untouched; only labels move.
- **Stricter minimum** (`settings.minimumRatings`): at least 3 of the 4 station criteria and 8 of 13 criteria in total. A live counter shows progress toward it.
- **Calibration notes** on every report (`settings.calibration`), without changing any score:
  - the two global ratings differ by 3 or more points;
  - checklist ≥67% but global ≤3, or checklist <33% but global ≥5.
- **Self-rating** (optional): the interviewee rates herself 1–7 before opening the report. The report compares it with the raters' average and gives one line of advice. Stored as an extra `self` field in `mmi.reports`; older builds ignore it.
- **Rater guidance**: a calibration note under the global scale ("most practice answers sit between 3 and 5") and an honesty line for observers.

### Process
- **QR hand-off**: the observer's report screen shows a QR code. The interviewee scans it with the phone camera; the app opens, asks for her self-rating and saves the report. Typing the code still works.
- **Join by QR**: the projector shows a QR code that opens the app with the session code filled in.
- **Feedback order** (`observer.feedbackGuide`): Interviewee self-assesses → Interviewer gives a rating, a strength and a target → Observer reads the report → code transfer. Shown on every role screen and live on the projector ("Now: Interviewer …").
- **Observer form in two passes** (`observer.scoringGuide`): "During the interview" (station criteria, key points, red flags) and "At the bell" (communication, presence, global ratings, comments). Unrated rows look unrated.
- **Live interviewer cues**: the current timing line is highlighted as the interview runs.

### Prompts and guidance
- Timing line for follow-up 3 now reads "push further or change the situation".
- New interviewer conduct line: choose your global rating before hearing the observer's scores.
- Role phase instructions for the feedback phase rewritten to match the feedback order.

### Teacher tab
- One-tap **lesson presets** for Lessons 2–8 (`settings.lessonPresets`), highlighted when active.
- Warnings when a plan runs past 40 minutes of a 50-minute lesson, and when Station 5 tables get only 1 minute of reading.

### My reports
- **Concerns across reports**: red flags counted over all reports; repeated concerns are marked as a pattern.

## Files changed
- `mmi-content.json` → 1.1.0 (all changes above that involve text or thresholds live here)
- `mmi-content.schema.json` → requires the new fields
- `SPEC.md` → §17 lists the normative v1.1 changes; V3's band is now Developing
