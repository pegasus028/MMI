#!/usr/bin/env node
/* Runs the SPEC.md §15 acceptance vectors (v1.1) with Node, no browser.
 * Usage: node tests/run-tests.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const M = require("../js/core.js");
const QR = require("../js/qr.js");
const C = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mmi-content.json"), "utf8"));

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; }
  else { fail++; console.log("FAIL " + name + "\n  got:  " + g + "\n  want: " + w); }
}
const near = (a, b) => a !== null && Math.abs(a - b) < 1e-9;

/* §15.1 report code vectors */
const V = [
  { name: "V1", r: { prof: 0, station: 2, variant: 0, ratings: [1,2,3,4,1,2,3,4,1,2,3,4,1], obsG: 5, intG: 6, flags: 8, looks: 1 },
    code: "822KG-MW571-Q209G", content: 0.5, comm: 0.5, pres: 0.4, pct: 48, band: "Developing", glob: 5.5, globalLabel: "Good" },
  { name: "V2", r: { prof: 15, station: 6, variant: 2, ratings: [4,4,3,0,3,3,2,4,4,4,3,3,0], obsG: 6, intG: 0, flags: 0, looks: 31 },
    code: "FV931-PMJ6R-R07Y8", pct: 81, band: "Strong", glob: 6 },
  { name: "V3", r: { prof: 4, station: 4, variant: 1, ratings: [2,1,2,2,3,2,2,3,2,1,2,3,2], obsG: 3, intG: 2, flags: 33, looks: 2 },
    code: "A6MA9-MK8MT-D88Q0", pct: 34, band: "Developing", glob: 2.5,
    priorities: ["com_empathy", "pr_eye", "com_rapport", "com_clarity"], actions: 5 },
  { name: "V4", r: { prof: 0, station: 1, variant: 0, ratings: [1,0,0,0,1,1,1,4,2,3,3,3,3], obsG: 0, intG: 0, flags: 0, looks: 0 },
    code: "80200-JC9PV-00050", content: 0, comm: 0.25, pres: 0.6, pct: 20, band: "Needs work", glob: null }
];
for (const v of V) {
  const code = M.encodeReport(v.r);
  eq(v.name + " code", code, v.code);
  eq(v.name + " decode", M.decodeReport(code, C.professionOrder.length), v.r);
  const s = M.scoreReport(v.r, C);
  if ("content" in v) eq(v.name + " content", near(s.content, v.content), true);
  if ("comm" in v) eq(v.name + " comm", near(s.comm, v.comm), true);
  if ("pres" in v) eq(v.name + " pres", near(s.pres, v.pres), true);
  eq(v.name + " pct", s.pct, v.pct);
  eq(v.name + " band", s.band ? s.band.label : null, v.band);
  eq(v.name + " glob", s.glob, v.glob);
  if (v.globalLabel) eq(v.name + " globalLabel", s.globalLabel, v.globalLabel);
  if (v.priorities) eq(v.name + " priorities", s.priorities.map((x) => x.c.id), v.priorities);
  if (v.actions) eq(v.name + " actions", s.actions.length, v.actions);
}
eq("V4 glob label", M.scoreReport(V[3].r, C).globalLabel, null);
eq("V1 lowercase + O for 0", M.decodeReport("822kg-mw571-q2o9g"), V[0].r);
eq("bad checksum", M.decodeReport("AAAAA-AAAAA-AAAAB"), null);
eq("wrong length", M.decodeReport("822KG-MW571-Q209"), null);
eq("profession out of range", M.decodeReport(M.encodeReport({ ...V[1].r }), 15), null);

/* v1.1 bands follow the 1–4 scale */
const flat = (n) => ({ prof: 0, station: 1, variant: 0, ratings: Array(13).fill(n), obsG: 0, intG: 0, flags: 0, looks: 0 });
eq("all 2s band", M.scoreReport(flat(2), C).band.label, "Developing");
eq("all 3s band", M.scoreReport(flat(3), C).band.label, "Strong");
eq("all 4s band", M.scoreReport(flat(4), C).band.label, "Outstanding");
eq("all 1s band", M.scoreReport(flat(1), C).band.label, "Needs work");

/* v1.1 calibration notes */
eq("rater gap", M.scoreReport({ ...flat(3), obsG: 6, intG: 3 }, C).raterGap, 3);
eq("no rater gap", M.scoreReport({ ...flat(3), obsG: 5, intG: 4 }, C).raterGap, null);
eq("mismatch high/low", M.scoreReport({ ...flat(4), obsG: 3, intG: 2 }, C).mismatch, true);
eq("mismatch low/high", M.scoreReport({ ...flat(1), obsG: 5, intG: 6 }, C).mismatch, true);
eq("no mismatch", M.scoreReport({ ...flat(3), obsG: 5, intG: 5 }, C).mismatch, false);
eq("self close", M.selfVerdict(5, 5.5, 1.5), "close");
eq("self higher", M.selfVerdict(7, 4, 1.5), "higher");
eq("self lower", M.selfVerdict(2, 5, 1.5), "lower");
eq("self none", M.selfVerdict(0, 5, 1.5), null);

/* v1.1 minimum ratings */
const min = C.settings.minimumRatings;
eq("min ok", M.meetsMinimum([1,2,3,0,1,1,1,1,2,0,0,0,0], min), true);
eq("min too few station", M.meetsMinimum([1,2,0,0,1,1,1,1,1,1,1,0,0], min), false);
eq("min too few total", M.meetsMinimum([1,2,3,4,1,1,1,0,0,0,0,0,0], min), false);

/* §15.2 session codes */
const P = (s) => { const c = M.parseSessionCode(s); return c && [c.hh, c.mm, c.mode, c.station, c.set, c.rounds, c.read, c.interview, c.feedback]; };
eq("0945F2", P("0945F2"), [9, 45, "F", 2, null, 3, 1, 6, 3]);
eq("0945f2", P("0945f2"), [9, 45, "F", 2, null, 3, 1, 6, 3]);
eq("1010CA", P("1010CA"), [10, 10, "C", null, 0, 6, 1, 6, 3]);
eq("0945F23153", P("0945F23153"), [9, 45, "F", 2, null, 3, 1, 5, 3]);
eq("1300C B6173", P("1300C B6173"), [13, 0, "C", null, 1, 6, 1, 7, 3]);
["2460F1", "0945F7", "0945CA316", "0945F245", "0945F2163", "0945CA19", "0945F29999"].forEach((s) => eq("invalid " + s, M.parseSessionCode(s), null));
eq("normalized code", M.parseSessionCode("1300c-b6173").code, "1300CB6173");
eq("make 0905F2", M.makeSessionCode({ hh: 9, mm: 5, mode: "F", station: 2, rounds: 3, read: 1, interview: 6, feedback: 3 }), "0905F2");
eq("make 0905F23153", M.makeSessionCode({ hh: 9, mm: 5, mode: "F", station: 2, rounds: 3, read: 1, interview: 5, feedback: 3 }), "0905F23153");
eq("make 1300CC3173", M.makeSessionCode({ hh: 13, mm: 0, mode: "C", set: 2, rounds: 3, read: 1, interview: 7, feedback: 3 }), "1300CC3173");
eq("make 1300CA4", M.makeSessionCode({ hh: 13, mm: 0, mode: "C", set: 0, rounds: 4, read: 1, interview: 6, feedback: 3 }), "1300CA4");
C.settings.lessonPresets.forEach((p) => {
  const c = { hh: 9, mm: 0, mode: p.mode, station: p.station, set: "ABC".indexOf(p.set), rounds: p.rounds, read: p.read, interview: p.interview, feedback: p.feedback };
  const code = M.makeSessionCode(c);
  eq("preset round-trips: " + p.label, P(code), [9, 0, c.mode, c.mode === "F" ? c.station : null, c.mode === "C" ? c.set : null, c.rounds, c.read, c.interview, c.feedback]);
});

/* §15.3 clock */
const cfg = M.parseSessionCode("0900F2");
[[-30, "before", 1, 30], [0, "read", 1, 60], [59, "read", 1, 1], [60, "interview", 1, 360], [420, "feedback", 1, 180],
 [600, "rotate", 1, 30], [630, "read", 2, 60], [1889, "rotate", 3, 1], [1890, "done", 3, 0]].forEach(([t, ph, r, rem]) => {
  const s = M.sessionAtSeconds(cfg, t);
  eq("clock " + t, [s.phase, s.round, s.remaining], [ph, r, rem]);
});
// sessionAt with a real Date: 09:10:30 local → rotate, round 1
const d = new Date(); d.setHours(9, 10, 30, 0);
eq("clock via Date", M.sessionAt(cfg, d.getTime()).phase, "read");

/* §15.4 rotation and circuit */
const R = (round, size) => Object.entries(M.rolesFor(round, size)).sort().map(([s, r]) => s + ":" + r).join(" ");
eq("size3 r1", R(1, 3), "A:interviewee B:interviewer C:observer");
eq("size3 r2", R(2, 3), "A:observer B:interviewee C:interviewer");
eq("size3 r3", R(3, 3), "A:interviewer B:observer C:interviewee");
eq("size3 r4", R(4, 3), R(1, 3));
eq("size4 r1", R(1, 4), "A:interviewee B:interviewer C:observer D:observer2");
eq("size4 r4 D", M.rolesFor(4, 4).D, "interviewee");
eq("size4 r4 A", M.rolesFor(4, 4).A, "interviewer");
eq("circuit g1-3", [1, 2, 3].map((g) => [1, 2, 3].map((r) => M.circuitStation(g, r)).join("")).join("/"), "123/234/345");
eq("circuit g10 r3", M.circuitStation(10, 3), 6);

/* timing guide */
eq("cue times 6 min", C.interviewer.timingGuide.standard.map((g) => M.fmt(M.cueTime(6, g.atFraction))), ["00:00", "02:00", "03:30", "04:30", "05:30"]);
eq("active cue", M.activeCue(C.interviewer.timingGuide.standard, 360, 130), 1);

/* content integrity: every scenario resolvable */
let missing = 0;
C.professionOrder.forEach((k, i) => {
  const p = C.professions.find((x) => x.key === k);
  if (!p || p.index !== i) missing++;
  for (let st = 1; st <= 6; st++) for (const v of "ABC") if (!p.scenarios.find((s) => s.station === st && s.variant === v)) missing++;
});
eq("all 288 scenarios resolvable", missing, 0);

/* QR encoder builds the hand-off link */
const q = QR.encode("https://pegasus028.github.io/mmi-circuit/#r=822KGMW571Q209G");
eq("qr version", q.version, 4);
eq("qr size", q.size, 33);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
