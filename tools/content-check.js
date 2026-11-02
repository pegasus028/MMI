#!/usr/bin/env node
/* Content rules from SPEC §8 and §18, checked over mmi-content.json. Run: node tools/content-check.js
 * Exit code 1 on any failure. Add a rule here whenever an audit finds a new class of defect. */
const fs = require("fs"), path = require("path");
const C = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mmi-content.json"), "utf8"));
const fails = [];
const fail = (m) => fails.push(m);
const wc = (s) => String(s).trim().split(/\s+/).length;
const all = []; C.professions.forEach((p) => p.scenarios.forEach((s) => all.push([p, s])));

if (all.length !== 288) fail("expected 288 scenarios, got " + all.length);
for (const [p, s] of all) {
  const iv = s.interviewer, ie = s.interviewee, ob = s.observer;
  if (s.station === 5 && /one minute|two minutes/i.test(ie.doorPrompt)) fail(s.id + ": Station 5 door prompt states a reading time");
  if (s.station === 6) {
    const hasFU = iv.followUps.some((f) => /^tell me about (a|the) (real )?time|^tell me about the most difficult/i.test(f));
    if (hasFU && /tell me about a real time/i.test(iv.openingQuestion)) fail(s.id + ": Station 6 opening repeats a follow-up's real-example request");
    const norm = (x) => x.toLowerCase().replace(/[^a-z ]/g, "").trim();
    iv.followUps.forEach((f, i) => { if (norm(f) && iv.openingQuestion.toLowerCase().replace(/[^a-z ]/g, "").includes(norm(f))) fail(s.id + ": follow-up " + (i + 1) + " is contained in the opening"); });
  }
  if (s.station === 4) {
    if (!iv.actor) fail(s.id + ": Station 4 without actor");
    if (!/^The interviewer will play /.test(iv.openingQuestion)) fail(s.id + ": Station 4 opening must start 'The interviewer will play …'");
  } else if (iv.actor) fail(s.id + ": actor outside Station 4");
  if (s.station !== 5 && ie.data) fail(s.id + ": data table outside Station 5");
  if (ie.data) {
    ie.data.columns.forEach((c) => { if (c.length > 26) fail(s.id + ": table header over 26 characters: " + c); });
    if (ie.data.rows.some((r) => r.length !== ie.data.columns.length)) fail(s.id + ": row length differs from header count");
    if (wc(ie.doorPrompt) > 90) fail(s.id + ": Station 5 door prompt over 90 words (" + wc(ie.doorPrompt) + ")");
  } else if (wc(ie.doorPrompt) > 85) fail(s.id + ": door prompt over 85 words (" + wc(ie.doorPrompt) + ")");
  ie.doorPrompt.split(/(?<=[.?!])\s+/).forEach((sent) => { if (wc(sent) > 55) fail(s.id + ": door-prompt sentence over 55 words"); });
  if (iv.followUps.length !== 4) fail(s.id + ": needs 4 follow-ups");
  if (ob.keyPoints.length < 4 || ob.keyPoints.length > 5) fail(s.id + ": needs 4–5 key points");
  if (ob.warningSigns.length < 2 || ob.warningSigns.length > 3) fail(s.id + ": needs 2–3 warning signs");
  ob.keyPoints.forEach((k, i) => { if (/\b(mature thinking|shows maturity|shows good judgement)\b/i.test(k) && !/[:(]|e\.g\.|such as/.test(k)) fail(s.id + ": key point " + (i + 1) + " is a judgement, not an observable behaviour: " + k); });
  const nonDialogue = [ie.doorPrompt, ...ob.keyPoints, ...ob.warningSigns].join(" ").replace(/'[^']*'/g, "");
  if (/\b(don't|doesn't|isn't|aren't|can't|won't|didn't|wasn't|haven't|hasn't)\b/.test(nonDialogue)) fail(s.id + ": contraction outside quoted speech in door prompt, key points or warning signs");
  if (/\b(color|center|organiz|realiz|favorit|behavior)\b/i.test([ie.doorPrompt, iv.openingQuestion, ...iv.followUps, ...ob.keyPoints].join(" "))) fail(s.id + ": American spelling");
  if (iv.note !== undefined && typeof iv.note !== "string") fail(s.id + ": interviewer.note must be a string");
  if (ob.note !== undefined && typeof ob.note !== "string") fail(s.id + ": observer.note must be a string");
}
/* duplicates across professions */
const byTitle = {}, byDoor = {};
for (const [, s] of all) { (byTitle[s.title] = byTitle[s.title] || []).push(s.id); const k = s.interviewee.doorPrompt.slice(0, 80); (byDoor[k] = byDoor[k] || []).push(s.id); }
for (const k in byDoor) if (byDoor[k].length > 1) fail("duplicate door prompt: " + byDoor[k].join(", "));
/* glossary for every class profession */
for (const key of C.classList) {
  const p = C.professions.find((x) => x.key === key);
  if (!p) { fail("classList profession missing: " + key); continue; }
  if (!p.glossary || p.glossary.length < 8) fail(key + ": glossary missing or under 8 terms");
  (p.glossary || []).forEach((g) => { if (!g.term || !g.def) fail(key + ": glossary entry without term/def"); });
}
/* meta */
if (!/^\d+\.\d+\.\d+$/.test(C.meta.version)) fail("meta.version not semver");
const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8").match(/CACHE = "mmi-circuit-v([\d.]+)"/);
if (!sw) fail("sw.js CACHE not found"); else if (sw[1] !== C.meta.version) fail("sw.js CACHE " + sw[1] + " differs from content version " + C.meta.version);

console.log(fails.length ? fails.join("\n") : "content-check: 288 scenarios, all rules pass (content " + C.meta.version + ")");
process.exit(fails.length ? 1 : 0);
