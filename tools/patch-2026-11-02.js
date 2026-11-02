#!/usr/bin/env node
/* Content patch for mmi-content.json, 2 Nov 2026 audit (QA-REPORT.md).
 * Run once from the repo root: node tools/patch-2026-11-02.js
 * Every replacement must match exactly once; the script aborts otherwise and writes nothing.
 */
const fs = require("fs");
const F = "mmi-content.json";
const C = JSON.parse(fs.readFileSync(F, "utf8"));
if (C.meta.version !== "1.1.0") { console.error("expected content 1.1.0, got " + C.meta.version); process.exit(1); }
const S = {}; C.professions.forEach((p) => p.scenarios.forEach((s) => { S[s.id] = s; }));
let n = 0;
const get = (o, path) => path.split(".").reduce((a, k) => a[k], o);
const setPath = (o, path, v) => { const ks = path.split("."); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
/* set(id, "interviewer.followUps.2", "new text") — replaces a whole field, must exist */
function set(id, path, v) { const s = S[id]; if (!s) throw Error("no " + id); if (get(s, path) === undefined) throw Error(id + " missing " + path); setPath(s, path, v); n++; }
/* rep(id, path, old, new) — substring replace, exactly one match */
function rep(id, path, a, b) { const s = S[id]; if (!s) throw Error("no " + id); const cur = get(s, path); if (typeof cur !== "string") throw Error(id + " " + path + " not a string"); const c = cur.split(a).length - 1; if (c !== 1) throw Error(c + " matches in " + id + " " + path + " for: " + a); setPath(s, path, cur.replace(a, () => b)); n++; }
/* add(id, path, value) — new optional field */
function add(id, path, v) { const s = S[id]; if (!s) throw Error("no " + id); if (get(s, path) !== undefined) throw Error(id + " already has " + path); setPath(s, path, v); n++; }

/* ---------- 1. Systemic: Station 5 "one minute" vs the 2-minute reading time ---------- */
for (const id of Object.keys(S)) {
  const s = S[id];
  if (s.station === 5 && /one minute/i.test(s.interviewee.doorPrompt)) {
    rep(id, "interviewee.doorPrompt", /You have one minute to (study|read) (the table|the information|it)[^.]*\./.exec(s.interviewee.doorPrompt)[0], "Use your reading time to study the information before discussing it.");
  }
}

/* ---------- 2. Systemic: Station 6 double-barrelled openings ----------
 * Where the opening ends with "Then tell me about a real time …" / ", and tell me about a real time …"
 * AND a follow-up already asks "Tell me about a (real) time …", the opening keeps only its hypothetical part. */
for (const id of Object.keys(S)) {
  const s = S[id]; if (s.station !== 6) continue;
  const o = s.interviewer.openingQuestion;
  const hasFU = s.interviewer.followUps.some((f) => /^tell me about (a|the) (real )?time/i.test(f) || /^tell me about the most difficult/i.test(f));
  if (!hasFU) continue;
  let m = o.match(/^(.*?[.?])\s+Then tell me about a real time .*$/);
  if (!m) m = o.match(/^(.*?), and tell me about a real time .*$/);
  if (!m) continue;
  let head = m[1].trim();
  if (!/[.?]$/.test(head)) head += "?";
  set(id, "interviewer.openingQuestion", head);
}

/* 2b. The real-example follow-up carries Station 6; when it sits last (asked at 90%) move it to follow-up 2 */
for (const id of Object.keys(S)) {
  const s = S[id]; if (s.station !== 6) continue;
  const fu = s.interviewer.followUps;
  const i = fu.findIndex((f) => /^tell me about (a|the) (real )?time/i.test(f));
  if (i === 3 && !/tell me about a (real )?time|real example|real experience|a time you|a time when/i.test(s.interviewer.openingQuestion)) {
    const star = fu[3]; const rest = fu.slice(0, 3);
    set(id, "interviewer.followUps", [rest[0], star, rest[1], rest[2]]);
  }
}

/* ---------- 3. Systemic: Station 4 openings name the role the interviewer plays ---------- */
for (const id of Object.keys(S)) {
  const s = S[id]; if (s.station !== 4 || !s.interviewer.actor) continue;
  const o = s.interviewer.openingQuestion;
  if (/interviewer will play/i.test(o)) continue;
  const who = s.interviewer.actor.role.split(",")[0].trim();
  const bare = new RegExp("^Please (go (in )?and |begin (the conversation|speaking) with |)(speak to |talk to |)" + who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.$");
  set(id, "interviewer.openingQuestion", "The interviewer will play " + who + ". " + (bare.test(o) ? "Please begin when you are ready." : o));
}

/* ---------- 4. Data table headers that wrap to three lines on a phone (class professions) ---------- */
set("dentistry-s5-A", "interviewee.data.columns", ["Region", "Sugary drinks/day", "Decay (%)", "Dentists per 10,000"]);
set("veterinary-s5-A", "interviewee.data.columns", ["Province", "Samples tested", "Rabies positive", "Dogs vaccinated (est.)"]);
set("business-s5-A", "interviewee.data.columns", ["Leadership after founder", "Firms", "Yearly growth", "Still open after 10 yrs"]);
set("business-s5-B", "interviewee.data.columns", ["Year", "Arrivals (m)", "Spend per visitor (baht)", "Total spend (bn baht)"]);
set("accounting-s5-A", "interviewee.data.columns", ["Task", "Using AI now", "Plan by 2028", "Time saved"]);
set("accounting-s5-B", "interviewee.data.columns", ["Year", "Cases", "Total lost (m baht)", "Avg loss (baht)"]);
set("accounting-s5-C", "interviewee.data.columns", ["Year", "Fund return", "Bank deposit rate"]);
set("engineering-s5-A", "interviewee.data.columns", ["Room size", "Condition", "Cut after 10 min", "After 60 min"]);
set("engineering-s5-B", "interviewee.data.columns", ["Year", "New EVs (Bangkok)", "Dry-season PM2.5 (µg/m³)"]);
set("design-s5-B", "interviewee.data.columns", ["Design spend/year", "Companies", "Sales growth"]);
set("humanities-s5-B", "interviewee.data.columns", ["Faculty", "Starting salary (baht)", "Replies"]);
set("psychology-s5-A", "interviewee.data.columns", ["Hours/day (self-reported)", "Students", "High anxiety (%)"]);
set("law-s5-B", "interviewee.data.columns", ["Period", "Reported cases", "Avg loss per case (baht)"]);
set("music-s5-B", "interviewee.data.columns", ["Monthly listeners", "Share of artists", "Est. monthly income"]);
set("undecided-s5-A", "interviewee.data.columns", ["Faculty", "Graduates who replied", "Avg starting salary (baht)"]);
set("undecided-s5-B", "interviewee.data.columns", ["Group", "Students", "Average GPA", "Study hrs/week (reported)"]);

/* ---------- 5. Business ---------- */
set("business-s1-A", "interviewee.doorPrompt", "You are applying to a Faculty of Business or Management in Bangkok. Many applicants say they want to be 'an entrepreneur' or 'a CEO' without knowing what managers actually do. The interviewer wants to understand what genuinely draws you to business and management, and what you have done to explore it. She will also ask how realistic your picture of a manager's working life in Thailand is.");
set("business-s1-C", "interviewer.followUps.3", "Most applicants claim to be good leaders. Prove that you are, with one example, in one minute.");
set("business-s1-C", "observer.keyPoints.3", "Turns the comparison into a strength, e.g. explains what a degree offers (theory, a network, feedback) that running a shop alone cannot");
set("business-s3-A", "observer.warningSigns.0", "Spends most of Aunt Somsri's savings immediately on ads or equipment");
rep("business-s4-C", "interviewer.actor.lines.0", "Khun, it's nice", "Nong, it's nice");

/* ---------- 6. Medicine ---------- */
set("medicine-s1-A", "interviewee.doorPrompt", "You are applying to a six-year Doctor of Medicine programme. Many healthcare professionals help patients every day: nurses, pharmacists, physiotherapists, medical technologists and public health officers. The interviewer wants to understand why you have chosen to become a doctor specifically, and what you have done to test this choice. You will also be asked what you believe makes a good doctor in Thailand today.");
set("medicine-s1-A", "interviewer.pressureProbe", "Most candidates tell me medicine was 'their own choice'. Convince me your family had nothing to do with it.");
rep("medicine-s4-A", "interviewee.doorPrompt", "but the senior doctor has not yet reviewed it", "but the senior doctor, Dr Somchai, has not yet reviewed it");
rep("medicine-s4-B", "interviewee.doorPrompt", "You are a junior doctor in an outpatient clinic.", "You are a junior doctor in the outpatient clinic of a private hospital.");
add("medicine-s4-C", "interviewer.note", "Phone role-play: sit back to back or turn away so the candidate cannot see your face. Tell the observer to rate 'Eye contact' as n/o.");
add("medicine-s4-C", "observer.note", "This is a phone call. Rate 'Eye contact' as n/o; listen for tone of voice and pauses instead.");
rep("medicine-s5-B", "interviewee.data.caption", "Cardiolex vs generic statin: 12-month results", "Brochure headline: 'Cardiolex cuts heart attacks by 33%!' — Cardiolex vs generic statin, 12-month results");
set("medicine-s5-B", "observer.keyPoints.1", "Notes that 2 vs 3 heart attacks is a difference of only one patient, so the '33% reduction' is a relative figure that could easily be chance");
rep("medicine-s5-C", "observer.keyPoints.0", "we don't know", "we do not know");
/* medicine-s6-A was a copy of business-s6-A with a boy in a school science-fair group; now a different teamwork problem */
set("medicine-s6-A", "title", "The Member Who Takes Over");
set("medicine-s6-A", "interviewee.doorPrompt", "You are in a group of four preparing a science fair project on PM2.5 in Bangkok schools. The deadline is in one week. One member, Praew, has rewritten everyone else's sections without asking, deleted two classmates' graphs and told the group chat, 'Just let me finish it, I know what the judges want.' The other two members are upset and have stopped replying.");
set("medicine-s6-A", "interviewer.openingQuestion", "What would you do in this situation?");
set("medicine-s6-A", "interviewer.followUps", [
  "What might be behind Praew's behaviour, apart from arrogance?",
  "How would you get the two silent members back into the project?",
  "Tell me about a real time you worked in a team where one person tried to control everything. What did you do?",
  "Looking back, what would you do differently, and how would this experience help you on a hospital ward team?"
]);
set("medicine-s6-A", "interviewer.pressureProbe", "Praew's work is probably better than the others'. In a hospital, shouldn't the most competent person simply take charge?");
set("medicine-s6-A", "observer.keyPoints", [
  "Suggests speaking to Praew privately first, acknowledging her effort before raising the problem",
  "Considers possible causes such as anxiety about the result, a bad experience with group work or pressure at home",
  "Proposes a practical reset, e.g. a short meeting with clear roles, agreed deadlines and a rule about changing others' work",
  "Gives a real STAR example with a specific action they personally took and an honest result",
  "Links the lesson to clinical teams: competence does not replace respect for roles, and silent colleagues are a safety risk"
]);
set("medicine-s6-A", "observer.warningSigns", [
  "Lets Praew finish the project alone because it is easier",
  "Confronts Praew in the group chat in front of everyone",
  "Cannot give a real example, or the example makes them the hero with no reflection"
]);

rep("medicine-s3-B", "interviewee.doorPrompt", "At 2 a.m., five things happen at once: (1) a nurse reports a diabetic patient's blood sugar is very low; (2) a mother calls about a child with a mild rash; (3) a relative complains loudly about the noise on the ward; (4) the lab says a patient's potassium result is dangerously high; (5) the director's LINE message asks for tomorrow's bed report.", "At 2 a.m., five things happen at once. (1) A nurse reports a diabetic patient's blood sugar is very low. (2) A mother calls about a child with a mild rash. (3) A relative complains loudly about the noise on the ward. (4) The lab says a patient's potassium result is dangerously high. (5) The director's LINE message asks for tomorrow's bed report.");

/* ---------- 7. Dentistry ---------- */
rep("dentistry-s2-A", "interviewee.doorPrompt", "You are a newly qualified dentist in a private clinic in Thonglor.", "You have been working for two years as a dentist at a private clinic in Thonglor.");
rep("dentistry-s2-B", "interviewee.doorPrompt", "You have just started working at a busy private dental chain in Bangkok.", "After finishing your government service, you have just joined a busy private dental chain in Bangkok.");
rep("dentistry-s2-C", "interviewee.doorPrompt", "Dr Somsak, 61,", "Dr Somsak, 56,");
rep("dentistry-s3-A", "interviewee.doorPrompt", "You are the only dentist on a one-day mobile dental unit", "You are the only dentist on your university's one-day mobile dental unit");
rep("dentistry-s4-B", "observer.keyPoints.2", "fluoride toothpaste, adult brushing", "fluoride toothpaste, and a parent brushing the child's teeth");
set("dentistry-s5-A", "observer.keyPoints.1", "Identifies other factors that could explain the pattern (confounders): access to dentists, income, fluoride toothpaste, brushing habits");
rep("dentistry-s6-A", "interviewee.doorPrompt", "Fah and Krit,", "Fah and Nan,");
rep("dentistry-s6-A", "interviewer.followUps.0", "Fah's or Krit's?", "Fah's or Nan's?");
set("dentistry-s6-B", "observer.keyPoints.4", "Says what would tell them it was time to change direction, e.g. an agreed number of attempts, honest advice from a tutor, a fixed deadline");

/* ---------- 8. Veterinary ---------- */
set("veterinary-s1-A", "observer.keyPoints.0", "Gives a specific reason beyond 'I love animals', such as working out what is wrong when the patient cannot speak, how diseases differ between species, or public health");
rep("veterinary-s2-B", "observer.keyPoints.3", "(traffic, rabies, conflict)", "(traffic, rabies, conflict), and notes that abandoning a pet is already an offence under the 2014 Animal Welfare Act");
set("veterinary-s3-B", "observer.keyPoints.0", "Identifies the dog with a swollen stomach (possibly twisted) and the cat that cannot urinate (blocked bladder) as life-threatening emergencies");
set("veterinary-s3-B", "interviewer.pressureProbe", "You did not treat the rabbit as an emergency. Most people think rabbits matter less than dogs. Are you just following that bias?");
set("veterinary-s4-A", "observer.keyPoints.0", "Prepares her with a warning sentence such as 'I'm afraid the news is not good' and checks what she already understands");
set("veterinary-s5-A", "observer.keyPoints.0", "Works out the share of samples that were positive: Province C 4% vs Province D about 12% and Province A 10%");
set("veterinary-s6-C", "interviewer.pressureProbe", "You have explained the circumstances very well. But whose fault was it really?");

/* ---------- 9. Engineering ---------- */
set("engineering-s1-A", "observer.keyPoints.4", "Says they would accept another branch and gives one concrete way they would make it work");
rep("engineering-s2-B", "interviewee.doorPrompt", "which is the minimum required by the official standard", "which is the lowest test temperature the official standard requires");
set("engineering-s2-C", "observer.keyPoints.0", "Names specific harm to the farmers: crops, water, health and lost income");
rep("engineering-s3-A", "interviewee.doorPrompt", "Heavy rain, around 100 mm, is forecast", "Heavy rain, around 100 mm in three hours, is forecast");
rep("engineering-s3-C", "interviewee.doorPrompt", "assign an experienced worker to watch the machine.", "assign an experienced worker to watch the machine. Meanwhile a forklift has leaked oil across the loading bay, where two trucks are waiting.");
set("engineering-s3-C", "observer.keyPoints.4", "Deals with the oil slip hazard and the waiting trucks as well as the press, in a stated order, and documents the decision");
rep("engineering-s4-A", "interviewer.actor.brief", "you live alone with your grandson", "you live with only your eight-year-old grandson");
rep("engineering-s4-A", "observer.keyPoints.1", "checking vibration records", "checking vibration records and the pre-construction survey photos of neighbouring houses");
rep("engineering-s4-C", "interviewer.actor.howToReact", "accept it quickly (an examiner should note this)", "accept it quickly, then tell the observer afterwards: agreeing to the unsafe beams is a red flag");
rep("engineering-s5-B", "interviewer.pressureProbe", "Both lines go in the right direction.", "Both columns move in the right direction.");
set("engineering-s6-B", "interviewer.followUps", [
  "In your real example, how did you feel, and how did you deal with those feelings?",
  "What did you change afterwards, and did it work?",
  "In the bridge example, how would you find out why it failed?",
  "What if you had no time to rebuild before the next deadline?"
]);

/* ---------- 10. Accounting ---------- */
rep("accounting-s1-A", "interviewee.doorPrompt", "and some people believe AI will soon do most bookkeeping", "and few know what accountants do beyond bookkeeping");
set("accounting-s2-C", "observer.keyPoints.3", "Offers practical help: claiming legitimate expenses or the flat-rate expense deduction, checking the tax-free threshold, getting advice from a professional");
rep("accounting-s4-B", "interviewee.doorPrompt", "You cannot legally refuse to give him his own money.", "You cannot refuse to give him his own money, although the branch can ask for one day's notice for a cash withdrawal this large.");
set("accounting-s4-B", "observer.keyPoints.1", "Explains the risk with simple numbers, e.g. 5% a month is 60% a year, or about 80% if the profits are reinvested, far above any safe investment");
rep("accounting-s4-C", "interviewee.doorPrompt", "You have been sent to explain this to the managing director, Khun Nat, who needs the report for a bank loan next week.", "Your audit manager is delayed, so you must start the meeting with the managing director, Khun Nat, who needs the report for a bank loan next week.");
rep("accounting-s4-C", "observer.keyPoints.1", "without evidence", "without evidence, and leaves detailed negotiation to the manager");
set("accounting-s5-B", "interviewer.followUps.2", "The small print says the way cases are counted changed in 2025. How does that affect your conclusion?");
set("accounting-s5-C", "observer.keyPoints.1", "Points out that after the two losing years, 1,000 baht invested in 2021 would be roughly back where it started by 2025 (about 1,030 baht), before the 2% yearly fee");
set("accounting-s6-A", "observer.keyPoints.0", "Decides to report the error, says who they would tell (group and/or teacher) and gives a reason for the order");

/* ---------- 11. Design ---------- */
set("design-s1-C", "observer.keyPoints.4", "Names something specific this faculty offers that YouTube and AI cannot: studio critique, mentors, industry projects, peers");
rep("design-s2-B", "interviewee.doorPrompt", "You and your friend Mint enter a national poster competition on PM2.5 awareness.", "You and your friend Mint enter a national poster competition on PM2.5 awareness together.");
rep("design-s2-B", "interviewee.doorPrompt", "Your poster is shortlisted", "Your joint poster is shortlisted");
set("design-s2-B", "interviewer.followUps.3", "What if the AI tool was trained on artworks by real Thai illustrators who were never asked or paid?");
rep("design-s3-B", "interviewee.doorPrompt", "The printer has jammed and half the posters are missing, one prototype has broken in transport, a teammate is stuck in traffic with the projector, and a journalist has asked to interview you in one hour.", "The printer has jammed and half the posters are missing. One prototype has broken in transport, and a teammate is stuck in traffic with the projector. A journalist has asked to interview you in one hour.");
set("design-s3-C", "observer.keyPoints.1", "Identifies likely issues: small text, formal or complex Thai wording, too many steps, no audio, poor placement");
set("design-s3-C", "observer.keyPoints.2", "Suggests cheap fixes that can be tested quickly: bigger buttons, simpler Thai wording, a volunteer helper, paper backup");
rep("design-s4-B", "interviewer.actor.howToReact", "uses English words or grabs the phone", "uses technical app words or grabs the phone");
set("design-s4-C", "observer.keyPoints.4", "Asks what the community actually wants before proposing solutions");
rep("design-s6-A", "interviewee.doorPrompt", "and the deadline is close.", "and the deadline is close. You will be asked for a real example from your own experience.");
set("design-s6-A", "observer.keyPoints.4", "Says what was good about the other person's idea, in their own words");
/* design-s6-C duplicated the s2-B setup (a close friend secretly cheats in a design competition) */
set("design-s6-C", "title", "The Teammate Who Delivered Nothing");
set("design-s6-C", "interviewee.doorPrompt", "You are the leader of a four-person team creating a campaign for a university design competition. Two days before submission, your teammate Fah, who was responsible for the illustrations, has delivered almost nothing and keeps saying 'tomorrow'. The other two members want her name removed from the entry. Fah is your close friend.");
set("design-s6-C", "interviewer.followUps", [
  "How would you start the conversation with Fah?",
  "Tell me about a real time you had to say something uncomfortable to a friend or teammate.",
  "What do you tell the other two team members?",
  "What if Fah says she has been ill all week and begs you to keep her name on the entry?"
]);
set("design-s6-C", "interviewer.pressureProbe", "There are only two days left. Wouldn't a good leader just quietly do the illustrations herself without making a fuss?");
set("design-s6-C", "observer.keyPoints", [
  "Checks the facts first: what Fah has actually produced and how much illustration work remains",
  "Speaks to Fah privately and gives her the chance to explain",
  "Plans practical action for the deadline: splitting the illustration work, simplifying the campaign, asking for an extension",
  "Balances loyalty to a friend with fairness to the two members who did the work",
  "Links the hypothetical to a real personal experience with honest reflection"
]);
set("design-s6-C", "observer.warningSigns", [
  "Does all the illustrations herself and says nothing to protect the friendship",
  "Removes Fah's name without speaking to her",
  "Cannot give any real example in the final follow-up"
]);

/* ---------- 12. Humanities ---------- */
add("humanities-s2-C", "interviewer.note", "Keep the discussion on evidence and principles. Do not name a country or discuss current politics.");
rep("humanities-s3-A", "interviewee.doorPrompt", "Work has stopped, the contractor says each day of delay costs millions of baht, local residents want the station opened, and a history group is already posting about it online.", "Work has stopped. The contractor says each day of delay costs millions of baht, and local residents want the station opened. A history group is already posting about it online.");
rep("humanities-s3-B", "interviewee.doorPrompt", "a famous Japanese author is due to speak to 300 people. Her flight is delayed by 90 minutes, the Thai-English interpreter has called in sick,", "a famous Japanese author is due to give a talk in English to 300 people. Her flight is delayed by 90 minutes, the English–Thai interpreter has called in sick,");
set("humanities-s3-B", "interviewer.pressureProbe", "You seem to be focusing on the interpreter. Surely the audience is the real priority, isn't it?");
add("humanities-s4-A", "observer.note", "The candidate is talking to her own mother, so for 'Builds rapport' rate the warmth and timing of the opening, not whether she introduces herself.");
rep("humanities-s6-A", "interviewee.doorPrompt", "One member, Krit,", "One member, Bam,");
rep("humanities-s6-A", "interviewer.followUps.2", "both Krit and Fah", "both Bam and Fah");
set("humanities-s6-A", "observer.keyPoints.3", "Restates each side's view fairly before suggesting a way forward");
set("humanities-s6-C", "observer.keyPoints.4", "Gives at least one reason the country's real position exists (economy, history, politics) before criticising it");

/* ---------- 13. Glossaries for the class professions (shown under the door prompt and in the Toolkit) ---------- */
const G = {
  business: [["stern", "strict and serious"], ["conglomerate", "a very large company that owns many different businesses, e.g. CP or ThaiBev"], ["consultancy", "a company that gives expert advice to other businesses"], ["survivorship bias", "judging only by the people who succeeded, because the ones who failed are not counted"], ["selection effect", "the people in a group were chosen in a way that makes the result unfair"], ["greenwashing", "making a business look more environmentally friendly than it really is"], ["confidentiality agreement", "a signed promise not to share a company's private information"], ["proportionate", "the right size for the situation, not too much or too little"], ["commission", "a percentage of each sale that the seller pays to the platform or agent"], ["profit margin", "the share of the price that is profit after costs"]],
  medicine: [["biopsy", "taking a small piece of tissue from the body to test for disease"], ["paternalistic", "treating an adult like a child by deciding for them 'for their own good'"], ["dialysis", "a machine treatment that cleans the blood when the kidneys fail"], ["caesarean", "an operation to deliver a baby through the mother's abdomen"], ["potassium", "a mineral in the blood; a very high level can stop the heart"], ["statin", "a medicine that lowers cholesterol"], ["referral centre", "a big hospital that takes the most serious cases from smaller ones"], ["anecdote", "one person's story, not scientific evidence"], ["safety-netting", "telling a patient which warning signs mean they must come back"], ["comorbidity", "another illness a patient has at the same time"], ["RT-PCR", "a laboratory test that detects a virus's genetic material, e.g. for COVID-19"]],
  dentistry: [["veneers", "thin covers glued to the front of teeth to change their shape or colour"], ["tremor", "shaking of the hands that a person cannot control"], ["abrasive", "rough; wears away a surface when rubbed"], ["enamel", "the hard outer layer of a tooth"], ["shade", "the exact colour of a tooth, measured on a dentist's colour scale"], ["confounding factor", "a hidden factor that could explain a pattern"], ["rip someone off", "charge far too much"], ["general anaesthetic", "medicine that makes a patient fully unconscious for treatment"], ["CAD/CAM", "computer design and machine-made crowns in the clinic"], ["sealant", "a protective coating painted on back teeth"]],
  veterinary: [["slaughterhouse", "a place where farm animals are killed for meat"], ["residue", "a small amount of a substance, e.g. a drug, left behind in meat"], ["surveillance", "organised, continuous checking and recording of disease cases"], ["straining", "pushing hard with effort"], ["rota", "a timetable of who does what, when"], ["resuscitation", "trying to restart breathing and the heart"], ["euthanasia", "ending an animal's life painlessly to stop suffering"], ["euphemism", "a soft word used instead of a direct one, e.g. 'put to sleep'"], ["zoonosis", "a disease that passes from animals to people"], ["biosecurity", "rules that stop disease entering or leaving a farm"]],
  engineering: [["light-curtain", "an invisible beam across a machine opening that stops the machine if a hand passes through"], ["subsidence", "the ground slowly sinking, in Bangkok mainly because groundwater was pumped out"], ["bypass", "sending something around a safety or treatment step so that the step is skipped"], ["stern", "strict and serious"], ["idling", "the engine running while the car is not moving"], ["foreman", "the worker in charge of a group of workers on site"], ["stamping press", "a machine that cuts and shapes metal sheets with great force"], ["piling", "driving long concrete or steel posts into the ground to hold up a building"], ["safety factor", "the extra strength added to a design beyond the expected load"], ["root cause", "the real reason a problem keeps happening"]],
  accounting: [["reconcile", "check that the company's own records match the bank's records and explain any difference"], ["qualified opinion", "an audit report saying the auditor could not confirm part of the accounts"], ["clean opinion", "an audit report saying the accounts are fair"], ["diversified portfolio", "investments spread across many companies or types so one failure does not lose everything"], ["CFO", "the company's most senior finance manager"], ["VAT return", "the monthly form reporting sales tax to the Revenue Department"], ["cherry-picking", "showing only the figures that support your claim"], ["Revenue Department", "the Thai government tax office"], ["inventory", "the stock of goods a company holds"], ["inducement", "money or a favour offered to make someone break a rule"]],
  design: [["kiosk", "a small self-service machine or booth, e.g. a touch-screen for hospital check-in"], ["cooperative", "a business owned and run jointly by its members, who share the profits"], ["privileged position", "having advantages, e.g. money, that others do not"], ["non-negotiable", "cannot be changed or discussed"], ["generative AI", "software that creates images or text from a written request"], ["UX/UI", "user experience / user interface: how a product feels and looks to use"], ["crit", "a session where designers' work is criticised by tutors and peers"], ["trademark", "a legally protected name, logo or symbol"], ["prototype", "an early working model of a product"], ["brief", "the client's written description of what a design must do"]],
  humanities: [["curator", "a person who looks after and chooses the objects in a museum collection"], ["low-lying", "land close to sea or river level that floods first"], ["dual pricing", "charging locals and foreigners different prices for the same thing"], ["provenance", "the documented history of who owned an object"], ["consecutive interpreting", "the speaker pauses and the interpreter translates each part"], ["growth mindset", "the belief that ability grows with effort and practice"], ["migrant", "a person who has moved to another country to live or work"], ["evacuate", "move people out of a dangerous place"], ["polished", "finished and improved to a high standard"], ["repatriation", "returning an object or person to its home country"]]
};
for (const key of Object.keys(G)) {
  const p = C.professions.find((x) => x.key === key); if (!p) throw Error("no profession " + key);
  if (p.glossary) throw Error("glossary exists " + key);
  p.glossary = G[key].map(([term, def]) => ({ term, def })); n++;
}

/* ---------- 14. Meta ---------- */
C.meta.version = "1.2.0";
C.meta.date = "2026-11-02";
C.meta.notes.push("v1.2.0 (2 Nov 2026): B2 student walkthrough fixes — see QA-REPORT.md. Added optional scenario notes (interviewer.note, observer.note) and per-profession glossary for the class professions.");

fs.writeFileSync(F, JSON.stringify(C, null, 1));
console.log(n + " edits applied; content " + C.meta.version);
