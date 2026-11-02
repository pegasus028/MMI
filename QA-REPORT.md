# QA report — MMI Practice Circuit

## Audit — 2 November 2026 (Claude Fable 5.1): three B2 students, every profession

**Brief.** Audit https://pegasus028.github.io/MMI/ as three CEFR B2 students doing their MMI, for every class profession; find and implement improvements; push.

**Method.**
1. Load check: live files `cmp` equal to the repo; every script parses (acorn); `node tests/run-tests.js` 98/98; `tests/browser_test.py` green (one 404 is the missing favicon).
2. Three simulated B2 students — Ploy (seat A, generous rater), Nam (seat B, strict), Fern (seat C, middle) — on three separate 390 px phones in a real class session (Focus mode, 3 rounds, 1/6/3), the clock fast-forwarded with Playwright, for **8 professions × 6 stations = 48 sessions, 144 rounds, 144 observer reports created and 144 imported by typed code**, plus the `#r-` deep link on every session. Bot: `tools/walkthrough/three-phone-walk.py`.
3. Four persona reviewers (one per pair of professions) read all 144 class-profession scenarios three times, once in each role, against the station frameworks; then an independent reviewer checked every one of the 183 content changes and 81 glossary entries before they shipped (12 catches: a clumsy sentence, two duplicate key points, a glossary definition that had commission paid the wrong way, the STAR follow-up timing above, and others — all applied).

**Headline.** The app itself is solid: no console errors, no lost form state across phase changes, every report created, every typed code (including lowercase with spaces) imported, every QR deep link opened, no horizontal page overflow at 390 px. What slowed a B2 student was the content and one layout: a report list whose Open button was off the phone screen, hard words with no help, three Station 5 prompts that gave the wrong reading time, tables that wrapped badly, and a set of scenario-level defects the persona reviewers caught (below).

### P0 / P1
- None in the code. No secrets, no backend, no data written anywhere but the phone.

### What the three students found (app)
| # | Where | Finding | Fix |
| --- | --- | --- | --- |
| A1 | My reports, 390 px | The "Received" table was 435 px wide inside a scrolling wrapper: the **Open** button sat off the right edge of the phone, so a student saw a list she could not open. "Reports I've given" had the same shape. | Both lists are now tappable rows (`.rrow`): the whole row opens the report; score and band stay visible. |
| A2 | Door prompt | Words a B2 reader stops on (biopsy, paternalistic, veneers, light-curtain, qualified opinion, kiosk, provenance …) had no help; reading time is 60 s. | Per-profession **glossary** (10 terms × 8 professions) in the content; the door card shows a collapsed "Words to know (n)" with only the terms that appear in that prompt or table; the Toolkit shows the whole list. |
| A3 | Station 5 | Three door prompts told the candidate "You have one minute to study the table" while the app gives Station 5 two minutes (L7 preset 2/4/2). | Sentence replaced by "Use your reading time to study the information before discussing it." in all 5 affected scenarios (two outside the class list). |
| A4 | Station 5 tables | Four-column tables with 25–40-character headers wrapped to three lines at 390 px (business-s5-B, accounting-s5-A, dentistry-s5-A, veterinary-s5-A …). | 16 tables given headers of ≤ 26 characters; `tools/content-check.js` enforces it. |
| A5 | Station 4, phone role-play (medicine-s4-C) | The observer still had to rate "Eye contact" during a phone call, and nothing told the interviewer how to stage it. | New optional `interviewer.note` / `observer.note` fields, rendered as amber flags (also used for humanities-s4-A, where the candidate talks to her own mother). |
| A6 | QR codes | `APP_URL` was empty, so every QR encoded the page the observer happened to be on. | Set to `https://pegasus028.github.io/MMI/`. |

### What the persona reviewers found (content) — fixed in content 1.2.0 (`tools/patch-2026-11-02.js`, 171 edits)
Systemic (all 16 professions):
- **Station 6 double-barrelled openings** ("What would you do… Then tell me about a real time…"). The interviewee, phone face down, had to hold two questions; follow-up 3 then asked the same thing again. 13 openings trimmed to the hypothetical where a follow-up already asks for the real STAR example (none lost its real-example request).
- **Station 4 openings** in 11 professions did not say who the interviewer plays, unlike medicine; B2 interviewers did not know to read the first sentence out of character. All 33 now start "The interviewer will play <role>."
- **Boys in school group-work scenarios** at a girls' school (Ton, Krit in medicine/dentistry/humanities s6-A) renamed Praew, Nan, Bam.
- **Station 6 real-example follow-up** was the last probe (asked at 90%, with 30 s left) in 7 scenarios once the opening was trimmed; moved to follow-up 2.
- **Duplicates**: medicine-s6-A was business-s6-A with a different last sentence → rewritten as "The Member Who Takes Over" (a classmate who rewrites everyone's work). design-s6-C repeated design-s2-B (close friend secretly cheats in a design competition) → rewritten as "The Teammate Who Delivered Nothing".

Scenario-level (class professions), by file:
| File | Fixes |
| --- | --- |
| business | 33-word nested sentence in s1-A split; s1-C FU4 no longer assumes the candidate claimed leadership; s1-C key point 4 made parseable; s3-A warning sign named Aunt Somsri (not "her"); s4-C Khun Nok says "Nong", not "Khun", to someone she knew as a child; s5-A/B headers. |
| medicine | s1-A sentence split and the pressure probe no longer asserts "your parents are both doctors"; s4-A names Dr Somchai in the prompt (the actor already did); s4-B is a private hospital (the follow-ups assumed it); s4-C phone-call notes; s5-B brochure headline added to the table caption so FU2's "33%" has a source, key point 2 explains it; s5-C contraction; s3-B list sentence split; s6-A rewritten. |
| dentistry | s2-A/s2-B no longer put a newly qualified dentist straight into private practice (compulsory government service); s2-C Dr Somsak is 56, not 61 (civil servants retire at 60); s3-A names the university mobile unit the pressure probe refers to; s4-B "adult brushing" → a parent brushing; s5-A "confounding factors" glossed in the key point; s6-A Krit → Nan; s6-B key point 5 made observable. |
| veterinary | s1-A/s3-B/s4-A/s5-A key points lost jargon (comparative medicine, GDV, warning shot, positivity rate); s2-B notes the 2014 animal welfare act; s3-B pressure probe no longer presumes the rabbit was ranked third; s6-C probe no longer invents a delivery company; s5-A headers. |
| engineering | s3-C now has a second concurrent problem (oil spill, waiting trucks) so Station 3 has something to rank; s2-B "minimum required" clarified; s3-A rain has a duration (100 mm in three hours); s4-A "lives alone with her grandson" contradiction; s4-C actor note addressed to the observer, not an "examiner"; s5-B probe says columns, not lines; s6-B follow-ups reordered (real/real/hypothetical/what-if); s1-A, s2-C key points observable; s4-A key point 2 adds survey photos. |
| accounting | s1-A AI clause removed (it pre-empted s5-A); s2-C key point gives real Thai options (expense deduction, tax-free threshold); s4-B 5%/month = 60% a year (80% only if reinvested), and the branch may ask for a day's notice; s4-C the audit manager is delayed rather than absent; s5-B FU3 no longer asks a "what if" about a fact in the small print; s5-C key point accepts "roughly back where it started"; s6-A no longer prescribes "group first, then teacher". |
| design | s2-B joint entry made explicit, FU4 "the AI tool was trained"; s3-B 36-word sentence split; s3-C kiosk issues are Thai-wording, not "English-only"; s4-B actor note "uses technical app words"; s1-C/s4-C/s6-A key points observable; s6-A says a real example will be asked; s6-C rewritten. |
| humanities | s3-A sentence split; s3-B the Japanese author speaks English, so an English–Thai interpreter makes sense, and the probe no longer presumes the answer; s4-A observer note on rapport with a mother; s2-C interviewer note to keep the statue discussion off current politics; s6-A Krit → Bam, key point 4 observable; s6-C key point 5 observable. |

### Checks added
`tools/content-check.js` (run with the suites): 288 scenarios resolvable; no reading time stated in Station 5 prompts; no Station 6 opening repeating a follow-up; every Station 4 opening names the role; table headers ≤ 26 characters, rows match headers; door prompts ≤ 85 words (≤ 90 with a table), sentences ≤ 55 words; 4 follow-ups, 4–5 key points, 2–3 warning signs; no contractions or American spellings outside quoted speech; no duplicate door prompts across professions; a glossary of ≥ 8 terms for every class profession; `sw.js` CACHE equals the content version.

### Walkthrough statistics
- 48 sessions × 3 rounds; 141 of 144 observer reports created and imported by code; 45/45 deep links opened; 0 console errors; 0 px page overflow on every screen in every round.
- The 3 reports that could not be created were the persona bot marking two of the four station criteria n/o — the app correctly refused ("Rate at least 3 station criteria and 8 in total first") and the live counter showed "Station 2/4". A real observer gets the same guidance; nothing to fix.
- Door prompts (words incl. table): S1 58–83, S2 60–92, S3 65–136, S4 56–92, S5 57–151, S6 57–90. Station 3 and 5 prompts over 110 words need the 2-minute reading preset; the L5 preset (Station 3) is 1/6/3 — consider 2/5/3 for Station 3 as well.
- Interviewer timing cue highlighted correctly at ~4:40 of a 6-minute interview in every round; interviewer ticks and observer ratings survived every phase change; the interviewee's typed code survived the rotate phase every time.
- After the CSS tweak, no Station 5 table scrolls sideways at 390 px (before: 4 of 48 tables scrolled 10–40 px).
- Run time: 28 min for all 48 sessions.

### Judgement calls left to T.Chris
1. **medicine-s2-A "The Fake RT-PCR Certificate"** reads as 2021 to a 2026 student (no airline or Japan asks for one now). It is the Lesson 1 hook and a real reported Siriraj/Rama-style dilemma, so it was kept; a 2026 version would be a backdated sick-note for a missed university exam (same ethics, same follow-ups). Say the word and it is a five-line patch.
2. **Contractions in pressure probes and follow-ups** ("Isn't that paternalistic?") appear in roughly 40 % of scenarios. They are spoken lines read aloud, so they were left; the house rule was applied only to door prompts, key points and warning signs.
3. **"What if" position.** In about a third of scenarios the change-of-situation probe is follow-up 4, not 3; the v1.1 timing cue already reads "push further or change the situation", so nothing was swapped.
4. **Theme repeats within a set** (engineering Set B: EVs three times; accounting Set B: scams twice; dentistry Set A: sugar three times; veterinary: rabies four times). Not duplicates, and a student meets one set per lesson, but a Set-B circuit student would notice. Replacing engineering-s5-B with a road-deaths dataset and accounting-s5-B with a household-debt press release would fix the two worst; not done without your say-so.
5. **Male adult roles played by girls** (Mr Wichai, Mr Prasert, Mr Somchai, Mr Krit, Daniel): kept — actable, and adults are not covered by the no-boys rule. design-s4-C would read more naturally with a woman leading the women's weaving cooperative.
6. **medicine-s6-A** (rewritten) now shares its premise with psychology-s6-A (a member who takes over). Different professions, so no student meets both; change Praew's issue to hogging the presentation if you want them distinct.
7. **Glossary language.** Definitions are in English; a Thai gloss column would help the weakest readers but needs a native check.

### What T.Chris must do
- Nothing server-side: there is no backend. The missing favicon 404 (the only console message in every suite) is now silenced with an empty icon link. Students' phones pick up v1.2 on the next visit (the service-worker cache name changed).
- Optional: ask students to hard-refresh once if an old copy was open during the push.
