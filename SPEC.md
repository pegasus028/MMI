# MMI Practice Circuit — Build Specification

Version 1.1 · 5 Oct 2026 · Owner: T.Chris (Christopher Mah), Satriwithaya School English Program (SWEP), Bangkok
Built by: Claude (v1.1 build in this package). §17 lists the v1.1 changes; where §17 and an earlier section differ, §17 wins.
Companion files: `mmi-content.json` (all content), `mmi-content.schema.json` (its JSON Schema) and `reference/mmi-circuit.html` (a working reference build with the content embedded; use it to check behaviour, but where it differs from this spec, the spec wins)

---

## 0. Instructions to the builder

1. Build exactly what this spec describes. Where something is not specified, choose the simplest behaviour that fits the classroom described in §1, and list your choice in a `DECISIONS.md` file.
2. **All on-screen content comes from `mmi-content.json`.** This covers scenarios, prompts, frameworks, phrases, criteria, feedback text, rules and labels. Do not write, paraphrase or "improve" any of it. The UI chrome (button labels, headings and short instructions named in this spec) is the only copy you write.
3. The algorithms in §7–§10 are normative. Implement them exactly and make the test vectors in §15 pass. Report codes and session codes must stay compatible with the existing classroom app.
4. Deliver:
    - `index.html`
    - any JS/CSS files
    - `mmi-content.json` (copied unchanged)
    - `README.md` with deployment steps
    - a test file that runs the §15 vectors with Node, without a browser

---

## 1. Purpose and users

The app guides in-class practice for **Multiple Mini Interviews (MMIs)**: the circuit of short, separately scored interview stations used in Thai university admissions. It is used mainly in medicine, dentistry and veterinary Portfolio/international rounds, and similar skills are tested in business, engineering and humanities interviews.

| User | Device | What they do |
| --- | --- | --- |
| Students | Their own phone (360–430 px wide), sometimes a laptop | Join a group, see their role each round, run a station, score a peer, receive and keep feedback reports |
| Teacher | Laptop on a classroom projector | Starts a synchronized class clock, projects the session code and countdown, sees the rotation plan |

The class has 30 students (female, aged 17–18, CEFR B2–C1) in **10 trios**. Each trio shares one target profession:

| Group | Profession key | | Group | Profession key |
| --- | --- | --- | --- | --- |
| 1 | business | | 6 | veterinary |
| 2 | business | | 7 | engineering |
| 3 | medicine | | 8 | accounting |
| 4 | medicine | | 9 | design |
| 5 | dentistry | | 10 | humanities |

This mapping is in `groups[]` in the JSON. Lessons are 50 minutes, and practice blocks run 3 rounds.

### How one round works

| Phase | Default length | Interviewee | Interviewer | Observer |
| --- | --- | --- | --- | --- |
| Reading | 1 min | Reads the "door" prompt and plans | Reads opening question, probes, actor brief | Reads the key points to listen for |
| Interview | 6 min | Answers | Asks questions, or acts a character (Station 4) | Scores the checklist live |
| Feedback | 3 min | Listens, then imports the report code | Gives a 1–7 global rating plus one strength and one target | Creates the report and shows the code |
| Rotate | 30 s | — | — | — |

Roles move one seat each round, so in 3 rounds every trio member plays every role once.

---

## 2. Technical constraints

- **Static site.** It must run from GitHub Pages (`https://pegasus028.github.io/<repo>/`) with no server.
    - Use vanilla JS, or React 18 UMD from cdnjs with no build step.
    - Third-party code is limited to fonts and, if used, React. Load nothing else from third parties.
- **Content loading.** `fetch('mmi-content.json')` at startup.
    - Show a loading state while it loads.
    - If loading fails, show a clear error with a Retry button.
- **Offline.** After the first load the app must keep working if Wi-Fi drops: the clock, the scoring and the reports. A service worker is optional.
- **No accounts and no backend in Phase 1.** Persistence is `localStorage` only.
    - Wrap every read and write in try/catch.
    - The app must still work, in memory, when storage is unavailable.
- **Layout and themes.** Mobile-first: usable at 360 px wide with no horizontal scrolling. Support light and dark themes through `prefers-color-scheme`.
- **Supported browsers:** current Safari on iOS, Chrome on Android, and Chrome/Edge on desktop. `BigInt` is allowed.
- **Accessibility.** All controls must be reachable by keyboard and have visible focus. Ratings must be real radio inputs with labels. Respect `prefers-reduced-motion`.
- **Language.** The UI is in English.

---

## 3. Glossary

| Term | Meaning |
| --- | --- |
| Station | One of 6 fixed interview types, numbered 1–6 for every profession (`stations[]`). |
| Scenario | A specific prompt for one profession × station. There are 3 per pair: variants A and B (standard) and C (hard). |
| Seat | A student's letter in the group: A, B, C (or D in an exceptional group of 4). |
| Role | Interviewee, Interviewer, Observer (and Observer 2 in a group of 4). Assigned from the seat and round number. |
| Round | One full cycle of the four phases. Rounds are numbered from 1. |
| Session | A teacher-run block of rounds that starts at a fixed clock time and is shared through a session code. |
| Free practice | No session code. The device runs its own timer, for example at home. |
| Report code | A 15-character code that carries an observer's full scoring to the interviewee's phone. |

---

## 4. Screens and navigation

There are four tabs in a persistent top bar: **Station**, **Toolkit**, **My reports** and **Teacher**. The app opens on Station.

### 4.1 Setup (shown inside Station until completed; reopened by an edit button)

| Field | Control | Rule |
| --- | --- | --- |
| Nickname | text, max 24 characters | Optional |
| Profession | select | Shows the professions in `classList` by default, labelled from `professions[].label`. A "Show all professions" checkbox reveals every entry in `professionOrder`. |
| Group | select, 1–12 | Required |
| Group size | select: 3 (default) or 4 | Seat D is enabled only when the size is 4 |
| Seat | select: A, B, C, (D) | Required |
| Session code | text | Optional. Validated with §7.1. On error, show: "That session code isn't valid. Check the board: it looks like 0945F2 or 1010CA." |

The setup is saved to `localStorage["mmi.setup"]`. The Station header shows "<nickname> · Group n · Seat X" with an edit button.

### 4.2 Station screen (top to bottom)

1. **Clock strip.**
    - Phase label, colour-coded (Reading / Interview / Feedback / Rotate / Starts in / Session complete / Ready).
    - "Round r of N" (or "Round r · free practice").
    - A one-line hint for the current phase.
    - A large mm:ss countdown and a progress bar.
    - In the last 60 s of Interview, the countdown turns red.
2. **Session line.**
    - With a session code: "Class session <code> · all groups on Station s · N rounds" or "Class session <code> · circuit, Set X · N rounds".
    - Without one: "Free practice · your device keeps time", with Start/Pause/Resume and Reset buttons.
    - A Sound on/off toggle.
3. **Door placard.**
    - Large station number on the station colour (§12), plus the station `name` and `skill`.
    - Profession label.
    - Station picker buttons 1–6.
    - Scenario chips A, B and "C · hard".
    - In free practice only, a Round select (1–6) with the note "Round decides who plays which role."
4. **Role banner.**
    - "Round r · your role", then the role name in large type.
    - A rotation strip showing every seat and its role, with the student's own seat highlighted.
5. **Role body.** One of §8.1–§8.3.

### 4.3 Toolkit tab

- **Station picker (1–6).** For the chosen station show:
    - `purpose`
    - `interviewee.framework` (name plus step cards)
    - `phraseBank`
    - `grammarFocus`
    - `traps`
    - "What the assessor scores": each of `observer.stationCriteria[]`, shown as its label plus its level-4 anchor
- **Vocabulary.** A profession select (defaults to the student's own) shows all 15 `vocabulary[]` cards: term, part of speech, definition and example.
- **"Ten rules for MMI day"** from `interviewee.generalRules[]`.

### 4.4 My reports tab — see §11. Teacher tab — see §13.

---

## 5. Data model (from `mmi-content.json`)

Read the whole schema in `mmi-content.schema.json`. These are the paths the app uses:

| Path | Use |
| --- | --- |
| `settings.timingsDefault` | readMin 1, interviewMin 6, feedbackMin 3, rotateSec 30 |
| `settings.ratingScale["0".."4"]` | Labels for the 1–4 criterion scale; 0 = "n/o" (not observed) |
| `settings.globalScale` | Prompt and 7 level labels for global ratings |
| `settings.weights` | station 0.5, communication 0.3, presence 0.2 |
| `settings.bands[]` | Score band labels and tones, highest `minPct` first |
| `professionOrder[]` | **Fixed index order** (0–15) used in report codes. Never reorder. It is full: a 17th profession would need a new report-code version. |
| `classList[]` | Professions shown in the dropdown by default |
| `groups[]` | Group → profession, used to pre-select the profession after a group is chosen (the student can still change it) |
| `settings.clockHints` | The one-line hint in the clock strip, per phase (`before`, `read`, `interview`, `feedback`, `rotate`, `done`, `idle`) |
| `uiText` | Fixed UI messages: placeholders for null scores (`notScored`, `globalNotGiven`, `stationNotYet`), empty states, validation errors, the concern banner (`{flags}` placeholder), the storage note and the copy-failure message. Use these strings verbatim. |
| `roles[].phaseInstructions` | Role-specific hint text per phase (same 7 keys). Shown at the top of the role body. Role ids: `interviewee`, `interviewer`, `observer`, `observer2`. |
| `roles[id=interviewer].conduct[]` | Interviewer conduct reminders |
| `interviewer.timingGuide.standard / roleplay` | Timing lines (`atFraction` × interview length, rounded to 30 s) |
| `interviewee.generalRules[]` | Ten rules for the Toolkit |
| `stations[n-1]` | Station name, skill, purpose, interviewee guidance and `observer.stationCriteria[4]` |
| `observer.communicationCriteria[4]`, `observer.presenceCriteria[5]` | General criteria |
| `observer.redFlags[6]` | Red-flag checkboxes. `bit` is the bit index in the report code. |
| `observer.redoActionTemplate` | The final follow-up action in every report |
| `professions[k].scenarios[]` | 18 per profession. Find one by `station` and `variant`. |
| scenario `.interviewee.doorPrompt`, `.interviewee.data?` | Shown to the interviewee. `data` is a table with caption, columns, rows and smallPrint. |
| scenario `.interviewer.openingQuestion`, `.followUps[4]`, `.pressureProbe`, `.actor?` | Interviewer prompts. `actor` is present only for Station 4. |
| scenario `.observer.keyPoints[4–5]`, `.warningSigns[2–3]` | The observer's listen-for list and the interviewer's warning signs |

Each criterion object has `id`, `label`, `anchors["1"]`, `anchors["4"]`, and `feedback.whenLow`, `feedback.whenHigh` and `feedback.followUpAction`.

**The 13 criteria, in index order:** the station's 4 `stationCriteria` (indexes 0–3), then the 4 `communicationCriteria` (4–7), then the 5 `presenceCriteria` (8–12). This order is used by the scoring and by the report code.

---

## 6. Local state and storage keys

| Key | Value |
| --- | --- |
| `mmi.setup` | `{name, prof, group, size, seat, code}` |
| `mmi.reports` | Array of received reports, newest first: `{code, date, prof, station, variant, ratings[13], obsG, intG, flags, looks}`. De-duplicate by `code`. |
| `mmi.given` | Array (max 40) of reports this device created as observer: `{code, date, notes:{strength, work}}`. These keys match the existing classroom app, which shares the same origin on pegasus028.github.io, so keep them unchanged. |
| `mmi.teacher` | The teacher's last session code string |

In-memory only (lost on reload, by design):

- observer drafts, keyed by `round|station|variant|profession`
- the interviewer's ticked follow-ups and global rating
- scenario and station overrides

---

## 7. Session code and the synchronized clock

### 7.1 Session code grammar

```
code     = HH MM mode param [suffix]
HH       = 00–23,  MM = 00–59      (local start time today, seconds = 0)
mode     = "F" (focus: every group on one station) | "C" (circuit: groups rotate stations)
param    = station digit 1–6 when mode F;  scenario set letter A|B|C when mode C
suffix   = "" | R | R r i f
R        = rounds 1–6        (default 3 for F, 6 for C)
r        = reading minutes 1–3, i = interview minutes 2–9, f = feedback minutes 1–5   (defaults 1, 6, 3)
```

Parsing rules:

- Uppercase the input and strip every non-alphanumeric character.
- The suffix must be exactly 0, 1 or 4 digits; any other length is invalid. Each digit must be within its range. This strict rule is normative, and the reference app now follows it.
- Store the normalized string.

`makeCode` (Teacher tab) produces the **shortest** valid form:

- Omit the suffix when the rounds and timings are all defaults.
- Write `R` alone when only the rounds differ.
- Otherwise write all four digits.

### 7.2 Clock algorithm (normative)

```
phases(cfg) = [ ["read","Reading time",read*60], ["interview","Interview",interview*60],
                ["feedback","Feedback",feedback*60], ["rotate","Rotate",30] ]
roundLen    = sum of the four durations (seconds)
start       = today at HH:MM:00 local time
t           = (now - start) / 1000
if t < 0                 → {phase:"before", label:"Starts in", remaining:-t, round:1}
k = floor(t / roundLen)
if k >= rounds           → {phase:"done", label:"Session complete", remaining:0, round:rounds}
w = t - k*roundLen; walk the phases subtracting durations until w < duration
                         → {phase, label, remaining: duration - w, elapsed: w, round: k+1}
```

- Every device computes this independently from its own clock; phone clocks are network-synced. There is no pause in session mode: to restart, the teacher issues a new code.
- Tick every 250 ms. Display `ceil(remaining)` as mm:ss.
- **Sounds** (WebAudio). They are off by default; the toggle needs a user gesture.
    - Interview starts: 1 beep at 880 Hz.
    - Reading or Feedback starts: 2 beeps at 880 Hz.
    - Rotate starts: 3 beeps at 520 Hz.
    - Session complete (`done`): 2 beeps at 880 Hz.
    - 60 s left in Interview: 1 beep at 1200 Hz, once per round.
    - Never beep on first render or on a re-render.
- **Wake lock.** Request `navigator.wakeLock` after setup and ignore any failure.

**Free practice clock.** One round of Reading → Interview → Feedback using the default timings and no Rotate phase.

- Start/Pause/Resume/Reset buttons.
- Before Start the state is "Ready" (phase `idle`).
- When the round ends: phase `done`, label "Round finished".

### 7.3 Resolving round, station and scenario

| Mode | Round | Station | Scenario variant |
| --- | --- | --- | --- |
| Session F | from the clock | `param` | `(round-1) mod 3` → A, B, C |
| Session C | from the clock | `((group-1) + (round-1)) mod 6 + 1` | the set letter in `param`, the same every round |
| Free practice | Round select; defaults to the station number | Picked by the student, default 1 | A, unless a chip is chosen |

- **Station override.** A student may press a station button at any time. Pressing one also clears any scenario override. The station override persists until setup is edited.
- **Scenario override.** A student may tap a scenario chip. The override is cleared automatically when the round number changes.

### 7.4 Role rotation (normative)

```
names(3) = [Interviewee, Interviewer, Observer]
names(4) = [Interviewee, Interviewer, Observer, Observer 2]
base     = (round - 1) mod size
role of seat SEATS[(base + i) mod size] = names[i]          SEATS = [A,B,C,D]
```

Round 1: A interviews, B asks and C observes. Round 2: B, C and A. Round 3: C, A and B.

### 7.5 Interviewee's profession for the other roles

The interviewer and observer screens show a select, "Interviewee's profession". It defaults to the student's own profession. With the current single-profession groups it rarely changes, but it must exist for mixed groups. The interviewee always sees her own profession.

---

## 8. Role screens

The role body re-renders when the station, round, variant, profession or role changes. For the interviewee it also re-renders when the phase changes. **The interviewer and observer bodies must not re-render on phase changes**, because a re-render would lose scroll position and form state. Only the clock strip updates every tick.

### 8.1 Interviewee

| Phase | Shows |
| --- | --- |
| before (session not started) | "The prompt appears when reading time starts." plus the station framework. **The prompt must stay hidden.** |
| read / idle | The **door card**: "On the door · Scenario X: title", `doorPrompt` in large text, and the data table if present (caption, table, "Small print: …"). Beside it: "Plan with: <framework name>", the framework step cards, and "Note 2–3 key points. When the interview starts, put your phone face down." |
| interview | A centred panel: "Phone down. Look at your interviewer." plus "Answer first, then explain. Think aloud. It's fine to pause." A collapsed "Show the prompt again" disclosure holds the door card. |
| feedback / rotate / done | "Feedback time" with a report-code input and a **Save report** button (§10–§11), the three `observer.reflectionPrompts`, and a collapsed door card. |

### 8.2 Interviewer

The interviewer screen has two columns on desktop and one on a phone. It shows:

- The "Interviewee's profession" select.
- **Actor card** (Station 4 only). "You are acting · stay in character", then:
    - `actor.role` as a heading
    - `actor.brief`
    - "Your lines": the `actor.lines` in bold quotes
    - "How to react": `actor.howToReact`
- **Opening question · read aloud**: `openingQuestion` in a highlighted call-out. In Station 4 the heading is "Read aloud, out of character · then say your first line". The interviewer reads `openingQuestion` as an instruction to the candidate, then begins the role-play with `actor.lines[0]`.
- **Follow-up probes · tick as you ask**: 4 checkboxes. Ticked items are struck through. In Station 4 the heading is "After the role-play: follow-ups".
- **Pressure probe**: `pressureProbe`.
- **Your timing**: lines from `interviewer.timingGuide.standard` (or `.roleplay` for Station 4). Each line shows its time, computed as `round(interviewMin*60*atFraction/30)*30` and formatted mm:ss. `interviewMin` is the session's interview length, or 6 in free practice. Below them, the `conduct` lines.
- **A strong answer includes**: `observer.keyPoints`. **Warning signs**: `observer.warningSigns`.
- **Your global rating**: a 1–7 segmented radio group showing the `globalScale` label of the choice, with the note "At the bell, tell the observer your number."
- **What the candidate sees on the door**: a collapsed disclosure with the door card.

### 8.3 Observer (and Observer 2)

The observer screen is a form with two columns on desktop and one on a phone:

- **Rating rows.** Three groups:
    - "Station n · <name>" (50% of score): `stationCriteria`
    - "Communication & English" (30%)
    - "Presence" (20%)
- Each criterion row has:
    - its label
    - a 5-option segmented radio: n/o, 1, 2, 3, 4 (default n/o = 0)
    - two anchor captions: "1 · `anchors.1`" and "4 · `anchors.4`"
    - the generic meanings of levels 2 and 3 from `settings.ratingScale`, shown as tooltips or a legend
- **Did you hear these?** Checkboxes for the first 5 `keyPoints`. Bit i of `looks` = key point i.
- **Red flags.** 6 checkboxes from `observer.redFlags`, with the note "In a real MMI, one serious concern can outweigh a good score."
- **Global ratings.** "Your rating (observer)" 1–7 and "Interviewer's rating (ask them)" 1–7, with the `globalScale` prompt and labels.
- **Comments.** The two text areas from `observer.commentFields`. These stay local and are **not** in the code.
- **Create report.** Requires `settings.minimumRatings` (v1.1: 3 station criteria and 8 in total). Otherwise show `uiText.rateMinimum`.

After **Create report** the form is replaced by:

- "Show this to the interviewee", then the **report code** in large monospaced-figure type that can be selected
- buttons: Copy code, Copy report as text, Edit ratings (which returns to the filled form)
- the full report (§9)

Save `{code, date, notes:{strength, work}}` to `mmi.given`. Observer 2 (role id `observer2`) sees the same screen and produces a second report, with the extra note "You also keep time and call the 1-minute warning."

---

## 9. Scoring and feedback (normative)

Let `r.ratings[0..12]` hold values 0–4, where 0 = not observed and is excluded.

```
part(a,b)   = let v = the ratings at indexes a..b-1 that are > 0
              null if v is empty, else ( (sum(v) / count(v)) - 1 ) / 3      ← compute exactly in this order
content     = part(0,4);  comm = part(4,8);  pres = part(8,13)
parts       = [[content,0.5],[comm,0.3],[pres,0.2]] with null parts removed, kept in this order
pct         = null if parts is empty, else
              round( (Σ part×weight, summed left to right) / (Σ weight, summed left to right) × 100 )
glob        = mean of obsG and intG, counting only values > 0; null if both are 0
band        = first settings.bands entry with pct >= minPct
globalLabel = globalScale.levels[ round(glob - 0.01) ]           (so 5.5 → "Good")
strengths   = the rated criteria with v = 4, in index order, max 4; if none, the single highest-rated criterion
              (ties → lowest index) if it is ≥ 3
priorities  = the criteria with v ≤ 2, sorted by v then index; if fewer than 2, add v = 3 criteria by index until there are 2; max 4
actions     = [followUpAction of each checked red flag] + [feedback.followUpAction of the first 3 priorities]
              + [redoActionTemplate with {station} and {nextVariantLetter} = letter of (variant+1) mod 3]
              → keep the first 5
```

Floating-point order matters: other formulas differ from the reference by 1 point in about 2% of rating combinations (see V4).

When a value is null, show `uiText.notScored` for pct, `uiText.globalNotGiven` for glob, and `uiText.noStrengths` when there are no strengths. A pct of null has no band pill.

**Report layout:**

1. Door placard: the station, profession label, "Scenario X" (with the date, if known), and the station name plus scenario title.
2. If any red flag is checked, a red **Concern raised** banner listing the flag labels, followed by: "In a real MMI this could outweigh a good score."
3. Three stat tiles:
    - **Station score**: pct with a band pill
    - **Global rating**: `glob` to 1 decimal place, "/7", and the label
    - **Key points heard**: `popcount(looks) / min(5, keyPoints.length)`
4. Breakdown: three meters (station skills, communication & English, presence), then a table of all 13 criteria with 4-dot indicators and rating labels.
5. **What worked**: the `feedback.whenHigh` of each strength.
6. **Work on next**: for each priority, its label in bold plus `feedback.whenLow`.
7. Observer comments, if present (observer's device only).
8. **Follow-up actions**: a numbered list.

**Copy report as text.** One line each, blank lines removed:

```
MMI report · Station n <name> · <profession label> · Scenario X: <title>
Station score: <pct>% (<band>) · Global: <glob>/7
Concern: <flags; joined>                        (only if any)
What worked: <whenHigh texts joined by space>
Work on: <label – whenLow …>
Actions: 1. … 2. …
Report code: <code>
```

The observer's comments are added at the end when the observer's device copies the report.

---

## 10. Report code (normative; must stay compatible)

The code packs the fields below, most significant first, into a BigInt:

| Field | Bits | Value |
| --- | --- | --- |
| version | 2 | 1 |
| profession index | 4 | index in `professionOrder` (0–15) |
| station − 1 | 3 | 0–5 |
| variant | 2 | 0 = A, 1 = B, 2 = C |
| ratings[0..12] | 13 × 3 | 0–4 each |
| obsG | 3 | 0–7 (0 = not given) |
| intG | 3 | 0–7 |
| flags | 6 | bit i = red flag i |
| looks | 5 | bit i = key point i |

That makes 67 bits.

```
n   = fields packed MSB-first        (n = (n << bits) | value for each field)
ck  = n mod 31
n   = (n << 5) | ck                  → 72 bits
n   = n << 3                         → 75 bits, encoded as 15 Crockford base32 characters, MSB first
alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
display  = XXXXX-XXXXX-XXXXX
```

**Decode:**

1. Uppercase the code, strip non-alphanumerics, then map O→0 and I or L→1.
2. Require exactly 15 characters, all in the alphabet.
3. Reverse the encoding steps and verify the checksum.
4. Ignore the 3 low padding bits; encoders always write them as 0.
5. Reject the code (`null`) if any of these hold: version ≠ 1, station > 6, variant > 2, profession index ≥ the length of `professionOrder`, any rating > 4, or obsG/intG > 7.

On import, re-encode the decoded fields to get the canonical code used for de-duplication. A wrong code shows: "That code doesn't match. Check each character with your observer."

---

## 11. My reports

- **Code input.** "Type a report code" plus **Add report**. A valid code is saved to `mmi.reports` with today's date (`en-GB`, e.g. "5 Oct") and opens the report.
- **Progress across stations.** A table of stations 1–6 showing each station's best pct as a meter in the station colour, with the number of reports.
- **Your three priorities across all stations.** Average each of the 9 general criteria (indexes 4–12) over every report, counting only values > 0. Show the 3 lowest averages as "<label> (average x.x/4). <whenLow>".
- **Received list.** Columns: date · station · scenario letter and title · pct with band pill (plus a "concern" pill if any flags) · Open.
- **Reports I've given as observer.** Date · code · Show. Show re-renders that report with its comments.
- Note under the list: "Reports are saved on this device only. Use 'Copy report as text' to keep them somewhere else."

---

## 12. Visual design

The design is wayfinding signage: each station is a coloured "door placard". Keep the existing classroom app's identity:

| Token | Light | Dark |
| --- | --- | --- |
| Ground / surface / ink / muted / line | #F2F4F1 / #FFFFFF / #16212A / #58646D / #D3D9D4 | #11171B / #1A2227 / #E6ECE9 / #9AA7AE / #2D383F |
| Signal (warnings, highlights) | #E39B12 | #F2B23A |
| Station 1–6 | #2459C2 · #8B3A9C · #1C855A · #CC4F27 · #0E7884 · #A87508 | #6E9BF0 · #C27FD2 · #4DC48F · #F08460 · #45B9C6 · #E0AE3E |
| Phase: reading / interview / feedback / rotate | #4C5B66 · #1C855A · #B9770A · #CC4F27 | #8A9AA5 · #4DC48F · #F2B23A · #F08460 |
| Semantic good / warn / bad | #1C855A · #B9770A · #C23B2E | #4DC48F · #F2B23A · #F07468 |

- **Type:** Barlow Condensed (600/700) for numbers, labels and headings; Public Sans for body text (Google Fonts, with system fallbacks).
- **Station placard numerals:** about 3.6 rem.
- **Teacher countdown:** `clamp(4rem, 18vw, 14rem)`.
- **Tap targets:** at least 44 px.
- **Flashing:** the "Rotate" phase label may pulse unless the user prefers reduced motion.

---

## 13. Teacher tab

**Form controls:**

- start time (a time input)
- mode (Focus / Circuit)
- station 1–6 (Focus) or scenario set A, B or "C · hard" (Circuit)
- rounds 1–6 (switching mode resets this to the default: 3 for Focus, 6 for Circuit)
- reading 1–3 min, interview 2–9 min, feedback 1–5 min
- **Start in 1 minute**: sets the start time to the next whole minute that is at least 60 s away

Show a summary line: "Each round: r + i + f min + 30 s rotate = mm:ss. N rounds end at HH:MM."

**Projector panel.** Dark background, centred, with a Full screen button (`requestFullscreen`, failure ignored) and a Sound toggle. It shows:

- "Session code" and the code in a high-contrast pill
- the phase label (coloured) and the giant countdown
- a progress bar
- "Round r of N · Station s · Scenario X" (Focus) or "Round r of N · circuit"
- "Interviewee: Seat _ · Interviewer: Seat _ · Observer: Seat _"

**Tables:**

- **Role rotation:** round × seats A, B, C, plus a muted D column for a group of 4.
- **Focus mode:** round → station → scenario letter.
- **Circuit mode:** a grid of groups 1–10 × rounds showing station numbers in station colours.

Persist the form as `mmi.teacher` (the code string).

Recommended lesson settings (for the README):

| Lesson | Settings |
| --- | --- |
| Station 1 | Focus · 1 · 3 rounds · 1/6/3 |
| Station 2 | Focus · 2 · 3 rounds · 1/5/3 |
| Station 6 | Focus · 6 · 3 rounds · 1/6/3 |
| Station 3 | Focus · 3 · 3 rounds · 1/6/3 |
| Station 4 | Focus · 4 · 3 rounds · 1/6/3 |
| Station 5 | Focus · 5 · 3 rounds · 2/4/2 |
| Mock MMI | Circuit · Set C · 3 rounds · 1/7/3 |

---

## 14. Optional Phase 2: class gradebook (build only if `CONFIG.GRADEBOOK_URL` is set)

- When set, the observer's **Create report** also sends a POST to a Google Apps Script web app.
    - Use `Content-Type: text/plain` to avoid a CORS preflight.
    - Send the body `{date, group, observerSeat, round, sessionCode, code, prof, station, variant, pct, glob, flags}`.
    - Fire and forget, and never block the UI.
- The script appends one row per report to a Sheet.
- A Teacher-tab "Class results" view is out of scope for Phase 1.
- Note for the README: after changing the Apps Script, deploy a **new version** (Deploy → Manage deployments → New version). Saving alone does not update the `/exec` URL.

---

## 15. Acceptance tests

### 15.1 Report code vectors (profession indexes follow `professionOrder`: medicine = 0, business = 4, humanities = 15)

| # | Input | Expected code | Expected scoring |
| --- | --- | --- | --- |
| V1 | prof 0, station 2, variant 0, ratings [1,2,3,4,1,2,3,4,1,2,3,4,1], obsG 5, intG 6, flags 8 (bit 3), looks 1 | `822KG-MW571-Q209G` | content 0.5, comm 0.5, pres 0.4, pct 48 (Developing), glob 5.5 → "Good" |
| V2 | prof 15, station 6, variant 2, ratings [4,4,3,0,3,3,2,4,4,4,3,3,0], obsG 6, intG 0, flags 0, looks 31 | `FV931-PMJ6R-R07Y8` | pct 81 (Strong), glob 6 |
| V3 | prof 4, station 4, variant 1, ratings [2,1,2,2,3,2,2,3,2,1,2,3,2], obsG 3, intG 2, flags 33 (bits 0 and 5), looks 2 | `A6MA9-MK8MT-D88Q0` | pct 34 (Developing; was Needs work in v1.0), glob 2.5; priorities in order: com_empathy, pr_eye, com_rapport, com_clarity; 5 actions |
| V4 | prof 0, station 1, variant 0, ratings [1,0,0,0,1,1,1,4,2,3,3,3,3], obsG 0, intG 0, flags 0, looks 0 | `80200-JC9PV-00050` | content 0, comm 0.25, pres 0.6, **pct 20** (a mean-of-terms formula wrongly gives 19), glob null → "not given" |

Each code must decode back to its input exactly. A lowercased code with 0 typed as O must also decode. `AAAAA-AAAAA-AAAAB` must decode to `null`.

### 15.2 Session codes

| Input | Result |
| --- | --- |
| `0945F2` | 09:45, Focus, station 2, 3 rounds, 1/6/3 |
| `0945f2` | Same as above (case-insensitive) |
| `1010CA` | 10:10, Circuit, set A, 6 rounds, 1/6/3 |
| `0945F23153` | 09:45, Focus, station 2, 3 rounds, interview 5 |
| `1300C B6173` | 13:00, Circuit, set B, 6 rounds, 1/7/3 |
| `2460F1`, `0945F7`, `0945CA316`, `0945F245`, `0945F2163`, `0945CA19`, `0945F29999` | Invalid |
| makeCode(09:05, F, 2, 3 rounds, 1/6/3) | `0905F2` |
| makeCode(09:05, F, 2, 3 rounds, 1/5/3) | `0905F23153` |
| makeCode(13:00, C, set C, 3 rounds, 1/7/3) | `1300CC3173` |
| makeCode(13:00, C, set A, 4 rounds, defaults) | `1300CA4` |

### 15.3 Clock (`0900F2`; seconds after 09:00:00 → phase, round, remaining)

| Seconds | Phase | Round | Remaining |
| --- | --- | --- | --- |
| −30 | before | 1 | 30 |
| 0 | read | 1 | 60 |
| 59 | read | 1 | 1 |
| 60 | interview | 1 | 360 |
| 420 | feedback | 1 | 180 |
| 600 | rotate | 1 | 30 |
| 630 | read | 2 | 60 |
| 1889 | rotate | 3 | 1 |
| 1890 | done | 3 | 0 |

### 15.4 Rotation and circuit

- **Size 3:** round 1 → A Interviewee, B Interviewer, C Observer; round 2 → B, C, A; round 3 → C, A, B; round 4 = round 1.
- **Size 4:** round 1 → A, B, C, D (D = Observer 2); round 4 → D Interviewee, A Interviewer.
- **Circuit station:** groups 1–3 × rounds 1–3 = `123 / 234 / 345`; group 10, round 3 → station 6.

### 15.5 Behaviour checklist

- [ ] Three phones with seats A/B/C and the same code show Interviewee, Interviewer and Observer in round 1, and all change phase within 1 s of each other.
- [ ] The interviewee cannot see the door prompt before the session starts.
- [ ] An observer mid-way through a form keeps all ratings and scroll position across a phase change.
- [ ] A report created on the observer's phone and imported by code on the interviewee's phone shows the same scores.
- [ ] All 288 scenarios render for every role without errors. Station 4 always shows an actor card; Station 5 shows a table where `data` exists.
- [ ] No horizontal scrolling at 360 px in either theme; ratings work with the keyboard alone.
- [ ] With `localStorage` blocked, the app still runs (reports kept in memory).
- [ ] No console errors.

---

## 16. Content summary (for orientation only)

| Station | Name | Interviewee framework |
| --- | --- | --- |
| 1 | Motivation & Insight | Spark · Steps · Reality · Fit |
| 2 | Ethical Dilemma | Problem · People · Principles · Possibilities · Decision |
| 3 | Problem Solving | Triage thinking: Risk · Facts · Rank · Act · Tell · Review |
| 4 | Communication Role-play | H.E.A.R.: Hello · Explore · Acknowledge · Respond |
| 5 | Data & Critical Thinking | Describe · Doubt · Decide |
| 6 | Teamwork & Reflection | S.T.A.R. + L |

The pack contains 16 professions × 6 stations × 3 scenarios = 288 scenarios, plus 15 vocabulary items per profession. Eight professions are in the class list: business, medicine, dentistry, veterinary, engineering, accounting, design and humanities. The other 8 are kept for future cohorts.

---

## 17. Version 1.1 changes (normative)

Report codes (§10), session codes (§7.1), the clock (§7.2), rotation (§7.4), storage keys (§6) and the score formula (§9) are unchanged. CHANGES.md gives the reasons.

### 17.1 Content additions (`mmi-content.json` 1.1.0)

| Path | Use |
| --- | --- |
| `settings.bands` | New thresholds 85 / 67 / 50 / 33 / 0, aligned to the 1–4 scale |
| `settings.minimumRatings` | `{station: 3, total: 8}`: minimum before Create report |
| `settings.calibration` | Thresholds for calibration notes (§17.3) |
| `settings.globalScale.calibrationNote` | Shown under every global-rating control |
| `settings.lessonPresets[]` | Teacher-tab one-tap presets |
| `settings.lessonMinutes`, `settings.lessonWarnMinutes` | 50 and 40: the Teacher-tab length warning |
| `observer.feedbackGuide[]` | Feedback-phase order: `atFraction` × feedback length, `who`, `text` |
| `observer.scoringGuide` | `during`, `atBell`, `honesty` lines on the observer form |
| `uiText` | New strings: `raterGap`, `checklistGlobalMismatch`, `selfPrompt`, `selfHigher`, `selfLower`, `selfClose`, `scanHint`, `reportReceived`, `deepLinkInvalid`, `lessonTooLong`, `readingTight`, `concernsHeading`, `concernsNote` |

### 17.2 Observer form
Two sections. **During the interview**: rating legend, station criteria, key points, red flags. **At the bell**: Communication & English, Presence, both global ratings, comments, Create report. A sticky counter shows station criteria rated, total rated, key points ticked and global ratings given. An n/o choice is styled as unrated.

### 17.3 Calibration notes (shown in the report, never change pct or glob)
- `raterGap`: obsG > 0, intG > 0 and |obsG − intG| ≥ `calibration.raterGap`.
- `checklistGlobalMismatch`: (pct ≥ `checklistHighPct` and glob ≤ `globalLowMax`) or (pct < `checklistLowPct` and glob ≥ `globalHighMin`).
- Self-rating: if the report has `self` (1–7) and glob is not null, d = self − glob. |d| < `selfGap` → `selfClose`; d > 0 → `selfHigher`; d < 0 → `selfLower`.

### 17.4 Self-rating and storage
`mmi.reports` entries may carry `self` (1–7). The interviewee's feedback screen and the deep-link screen offer an optional 1–7 self-rating before the report opens. Importing a code that already exists adds `self` if it was missing.

### 17.5 Deep links and QR codes
- `#r-<15 code characters>` imports a report (self-rating screen first; an existing code just opens). Invalid → `uiText.deepLinkInvalid` on My reports.
- `#s-<session code>` fills the session code (into setup, or the saved setup if one exists).
- The hash is cleared after handling. The token uses only letters, digits and `-`.
- QR codes are generated in-app (byte mode, level M, `js/qr.js`) from `CONFIG.APP_URL` or, if empty, the page address. The observer report screen and "Reports I've given" show the report QR; the projector shows the join QR.

### 17.6 Live guides
- Interviewer timing lines: the current line (by elapsed interview time) is highlighted; earlier lines are muted.
- Feedback guide: the current step is highlighted during the feedback phase on every role screen, and the projector shows "Now: <who> · <text>".
- The interviewee body re-renders only between phase groups (before / read / interview / feedback–rotate–done), so a half-typed report code survives the Rotate phase.

### 17.7 Teacher tab
- Preset buttons from `settings.lessonPresets`; the matching preset is shown as pressed.
- Warnings: total plan length > `lessonWarnMinutes` → `uiText.lessonTooLong` ({total} mm:ss, {lesson}); reading 1 min with Station 5 in Focus, or in a Circuit with Set A or B → `uiText.readingTight`.

### 17.8 My reports
"Concerns raised in your reports": each red flag that appears in any report, with its count; a count above 1 is marked in the bad tone. Followed by `uiText.concernsNote`.

### 17.9 Additional test vectors
| Ratings (all 13 equal) | Band |
| --- | --- |
| all 1 | Needs work (0%) |
| all 2 | Developing (33%) |
| all 3 | Strong (67%) |
| all 4 | Outstanding (100%) |

Calibration: flat 3s with obsG 6, intG 3 → raterGap 3. Flat 4s with globals 3 and 2 → mismatch. Self 5 vs glob 5.5 → close; 7 vs 4 → higher; 2 vs 5 → lower. Minimum: station 3 + total 8 passes; station 2 or total 7 fails.
