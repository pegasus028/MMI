# Build decisions

Choices made where SPEC.md left room, in the order they come up.

1. **Vanilla JS, no build step.** Three scripts (`core.js`, `qr.js`, `app.js`) load in order. `core.js` and `qr.js` are UMD so the Node tests use the same code as the browser.
2. **Role ids, not labels, in logic.** `rolesFor()` returns `interviewee / interviewer / observer / observer2`; labels come from `roles[].label`.
3. **Role hint above the role body.** `phaseInstructions` sit in their own line that updates every tick, so the interviewer and observer bodies never re-render on a phase change (§8).
4. **Interviewee re-render by phase group.** Feedback, Rotate and Done share one view so a half-typed code survives the Rotate phase.
5. **Storage fallback.** Every read and write is wrapped; an in-memory copy is kept, so with storage blocked the app still saves and lists reports for the session.
6. **Setup.** Choosing a group pre-selects its profession and size from `groups[]`. If the group's profession is outside `classList`, "Show all professions" turns on.
7. **Free-practice timings** use `settings.timingsDefault`. Pressing Start after "Round finished" starts a fresh round.
8. **Interviewee's profession select** lists all 16 professions, since mixed groups may include ones outside the class list.
9. **Interviewer → observer.** On a shared device the interviewer's rating pre-fills the observer's "Interviewer's rating"; on separate phones the observer asks, as specified.
10. **QR codes.** Generated in-app (byte mode, level M, versions 1–10; checked by decoding with OpenCV). Report links use `#r-CODE` and session links `#s-CODE`: plain tokens survive hosts that strip `key=value` hashes.
11. **Deep-link import** asks for the self-rating first, then opens the report. A code already on the phone opens directly.
12. **Projector panel** stays dark in both themes, as §13 requires. The top bar uses the same dark ground. Below 480 px the brand name hides so the four tabs fit on one line.
13. **Unrated rows.** The default n/o choice is styled as a muted fill, so a fresh form doesn't look fully rated.
14. **Observer 2** sees the same form plus the timekeeping note; its report is independent.
15. **Service worker** registers only on https and outside frames; it serves cached files first and refreshes them in the background. Bump `CACHE` in `sw.js` on each release.
16. **Gradebook** (§14) is built and stays off until `GRADEBOOK_URL` is set; it posts with `no-cors` and `text/plain`, fire and forget.
17. **Teacher form** restores from `mmi.teacher` (the last code string). Changing mode resets rounds to 3 (Focus) or 6 (Circuit).
