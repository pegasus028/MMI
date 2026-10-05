/* MMI Practice Circuit v1.1 — user interface.
 * All on-screen content comes from mmi-content.json; this file holds only UI chrome.
 * Logic lives in core.js (window.MMICore); QR codes come from qr.js (window.MMIQR).
 */
(function () {
  "use strict";
  const M = window.MMICore, QR = window.MMIQR, CONFIG = window.MMI_CONFIG || {};
  const app = document.getElementById("app");
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const { fmt, pad } = M;

  /* ---------- storage: localStorage with an in-memory fallback ---------- */
  const MEM = {};
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) { /* storage blocked */ }
      return Object.prototype.hasOwnProperty.call(MEM, k) ? MEM[k] : d;
    },
    set(k, v) {
      MEM[k] = v;
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* kept in memory */ }
    }
  };

  /* ---------- content ---------- */
  let C, PROFS, PROF = {}, SCN = {}, ROLE = {}, U;
  function indexContent(c) {
    C = c; U = c.uiText; PROFS = c.professionOrder;
    c.professions.forEach((p) => {
      PROF[p.key] = p;
      p.scenarios.forEach((s) => { SCN[p.key + "|" + s.station + "|" + s.variant] = s; });
    });
    c.roles.forEach((r) => { ROLE[r.id] = r; });
  }
  const letter = (v) => "ABC"[v];
  const profLabel = (k) => (PROF[k] ? PROF[k].label : k);
  const scenario = (prof, st, v) => SCN[prof + "|" + st + "|" + letter(v)];
  const station = (n) => C.stations[n - 1];
  const levelLabel = (n) => C.settings.ratingScale[String(n)].label;
  const globalLevel = (n) => C.settings.globalScale.levels[String(n)];
  const T = () => C.settings.timingsDefault;

  /* ---------- state ---------- */
  const S = {
    tab: "station", setup: null, editing: false, showAll: false,
    manualStation: null, manualRound: null, variantOverride: null, candProf: null,
    local: { running: false, startedAt: 0, offset: 0 },
    drafts: {}, made: {}, asked: {}, intG: {},
    lastKey: "", lastRound: null, sound: false, warned: {},
    teacherForm: null, viewReport: null, showGiven: null, tkStation: null, tkProf: null,
    pending: null, flash: "", prefillCode: ""
  };
  function sessionCfg() { return S.setup && S.setup.code ? M.parseSessionCode(S.setup.code) : null; }
  function localClock() {
    const L = S.local, t = T();
    let el = L.offset + (L.running ? (Date.now() - L.startedAt) / 1000 : 0);
    const c = M.localClockAt(el, L.running, { read: t.readMin, interview: t.interviewMin, feedback: t.feedbackMin });
    if (c.finished && L.running) { L.offset = (t.readMin + t.interviewMin + t.feedbackMin) * 60; L.running = false; }
    return c;
  }
  function current() {
    const cfg = sessionCfg(), su = S.setup;
    let st, round, variant, clock;
    if (cfg) {
      clock = M.sessionAt(cfg); round = clock.round;
      st = cfg.mode === "F" ? cfg.station : M.circuitStation(su.group, round);
      variant = cfg.mode === "F" ? (round - 1) % 3 : cfg.set;
    } else {
      st = S.manualStation || 1; round = S.manualRound || st; variant = 0; clock = localClock();
    }
    if (S.manualStation && cfg) st = S.manualStation;
    if (S.variantOverride !== null) variant = S.variantOverride;
    const roles = M.rolesFor(round, su.size);
    const role = roles[su.seat];
    const prof = role === "interviewee" ? su.prof : (S.candProf || su.prof);
    return { cfg, st, round, variant, clock, roles, role, prof, interviewMin: cfg ? cfg.interview : T().interviewMin, feedbackMin: cfg ? cfg.feedback : T().feedbackMin };
  }
  const draftKey = (cur) => [cur.round, cur.st, cur.variant, cur.prof].join("|");

  /* ---------- sound & wake lock ---------- */
  let AC = null;
  function beep(times, freq) {
    if (!S.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = AC.createOscillator(), g = AC.createGain();
        o.frequency.value = freq; o.connect(g); g.connect(AC.destination);
        const t0 = AC.currentTime + i * 0.32;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
        o.start(t0); o.stop(t0 + 0.27);
      }
    } catch (e) { /* no audio */ }
  }
  function phaseBeep(phase) {
    if (phase === "interview") beep(1, 880);
    else if (phase === "read" || phase === "feedback" || phase === "done") beep(2, 880);
    else if (phase === "rotate") beep(3, 520);
  }
  let wakeLock = null;
  async function keepAwake() {
    try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) { /* ignored */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.setup) keepAwake(); });

  /* ---------- small view helpers ---------- */
  const profOptions = (sel, all) => {
    const keys = all ? PROFS : C.classList.concat(C.classList.includes(sel) ? [] : [sel]);
    return keys.map((k) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(profLabel(k))}</option>`).join("");
  };
  const appUrl = () => CONFIG.APP_URL || (location.origin + location.pathname);
  const qrSVG = (text, title) => { try { return QR.toSVG(text, { title }); } catch (e) { return ""; } };
  function seg(name, values, checked, labelFn, attrs, aria) {
    return `<div class="seg${values.length === 7 ? " g7" : ""}" role="radiogroup" aria-label="${esc(aria)}">${values.map((n) => {
      const id = name + "-" + n;
      return `<input type="radio" name="${name}" id="${id}" value="${n}" ${attrs || ""} ${checked === n ? "checked" : ""}><label for="${id}" ${labelFn.title ? `title="${esc(labelFn.title(n))}"` : ""} class="${n === 0 ? "na" : ""}">${esc(labelFn(n))}</label>`;
    }).join("")}</div>`;
  }
  const fwBlock = (stn) => `<div class="fw sc${stn.number}">${stn.interviewee.framework.steps.map((s) => `<div><b>${esc(s.label)}</b><span class="small">${esc(s.text)}</span></div>`).join("")}</div>`;
  function dataTable(d) {
    if (!d) return "";
    return `<figure style="margin:0" class="panel"><figcaption class="label">${esc(d.caption)}</figcaption>
      <div class="tbl-wrap"><table><thead><tr>${d.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${d.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "n" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="small muted">Small print: ${esc(d.smallPrint)}</p></figure>`;
  }
  const doorCard = (st, v, sc) => `<div class="card-door sc${st}"><p class="label">On the door · Scenario ${letter(v)}: ${esc(sc.title)}</p><p class="stem">${esc(sc.interviewee.doorPrompt)}</p>${dataTable(sc.interviewee.data)}</div>`;
  function fbGuide(feedbackMin) {
    const sec = feedbackMin * 60;
    return `<ol class="fbguide" data-sec="${sec}">${C.observer.feedbackGuide.map((g) => `<li data-at="${Math.round(sec * g.atFraction)}"><span class="mini muted tnum">${fmt(Math.round(sec * g.atFraction))}</span><b>${esc(g.who)}</b><span>${esc(g.text)}</span></li>`).join("")}</ol>`;
  }
  function selfRate(name, val) {
    return `<div class="selfrate"><span class="label">Rate yourself first (optional)</span>${seg(name, [1, 2, 3, 4, 5, 6, 7], val, Object.assign((n) => String(n), { title: globalLevel }), "", "Self-rating")}
      <span class="small muted" id="${name}-lab">${val ? val + " · " + esc(globalLevel(val)) : esc(C.settings.globalScale.prompt)}</span></div>`;
  }
  async function copy(text, msgEl, selectEl) {
    try { await navigator.clipboard.writeText(text); if (msgEl) { msgEl.className = "small okmsg"; msgEl.textContent = "Copied."; } }
    catch (e) {
      if (msgEl) { msgEl.className = "small err"; msgEl.textContent = U.copyFailed; }
      if (selectEl) { try { const r = document.createRange(); r.selectNodeContents(selectEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e2) { /* ignore */ } }
    }
  }

  /* ---------- tabs ---------- */
  function setTab(t) {
    S.tab = t;
    $$(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    S.lastKey = ""; render(); window.scrollTo(0, 0);
  }
  $$(".tab").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const tabs = $$(".tab"), i = tabs.indexOf(b), n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); setTab(n.dataset.tab);
    });
  });
  function render() {
    if (S.tab === "station") return renderStation();
    if (S.tab === "toolkit") return renderToolkit();
    if (S.tab === "reports") return renderReports();
    if (S.tab === "teacher") return renderTeacher();
  }

  /* ---------- setup (§4.1) ---------- */
  function renderSetup() {
    const su = S.setup || { name: "", prof: C.groups[0].profession, group: 1, size: 3, seat: "A", code: "" };
    const code = S.prefillCode || su.code || "";
    const showAll = S.showAll || !C.classList.includes(su.prof);
    const t = T();
    app.innerHTML = `
    <section class="panel">
      <div><p class="label">Before the first station</p><h2>Join your group</h2></div>
      <p class="muted">Pick your group and seat. Your seat letter decides your role in each round: roles rotate so everyone plays interviewee, interviewer and observer.</p>
      <form id="setup" class="grid-form" novalidate>
        <label class="field"><span class="label">Your nickname</span><input id="su-name" value="${esc(su.name)}" maxlength="24" placeholder="e.g. Ploy" autocomplete="nickname"></label>
        <label class="field"><span class="label">Group number</span><select id="su-group">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${su.group === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label>
        <div class="field"><label class="label" for="su-prof">Your profession</label><select id="su-prof">${profOptions(su.prof, showAll)}</select>
          <label class="row small"><input type="checkbox" id="su-all" ${showAll ? "checked" : ""}> Show all professions</label></div>
        <label class="field"><span class="label">Group size</span><select id="su-size"><option value="3" ${su.size === 3 ? "selected" : ""}>3 students</option><option value="4" ${su.size === 4 ? "selected" : ""}>4 students</option></select></label>
        <label class="field"><span class="label">Your seat</span><select id="su-seat">${M.SEATS.map((s) => `<option value="${s}" ${su.seat === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label class="field"><span class="label">Class session code (optional)</span><input id="su-code" value="${esc(code)}" placeholder="from the board, e.g. 0945F2" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
        <div class="row" style="grid-column:1/-1"><button class="btn primary" type="submit">Go to my station</button><span id="su-err" class="small err" role="alert"></span></div>
      </form>
    </section>
    <section class="panel">
      <h3>How a round works</h3>
      <div class="timeline"><b>${t.readMin} min</b><span><strong>Reading time.</strong> The interviewee reads the door prompt and plans. The interviewer reads the examiner notes.</span>
      <b>${t.interviewMin} min</b><span><strong>Interview.</strong> The interviewer asks the opening question and follow-ups. The observer scores the checklist.</span>
      <b>${t.feedbackMin} min</b><span><strong>Feedback.</strong> The interviewee speaks first. The interviewer gives one strength and one target. The observer shares the report by QR code or report code.</span>
      <b>${t.rotateSec} s</b><span><strong>Rotate.</strong> Roles move one seat. With a class code, every group's timer changes at the same moment.</span></div>
    </section>`;
    const sizeSel = $("#su-size"), seatSel = $("#su-seat"), profSel = $("#su-prof"), grpSel = $("#su-group");
    const syncSeats = () => { const n = +sizeSel.value; Array.from(seatSel.options).forEach((o, i) => { o.disabled = i >= n; }); if (M.SEATS.indexOf(seatSel.value) >= n) seatSel.value = "A"; };
    sizeSel.addEventListener("change", syncSeats); syncSeats();
    grpSel.addEventListener("change", () => {
      const g = C.groups.find((x) => x.group === +grpSel.value);
      if (g) {
        if (!$("#su-all").checked && !C.classList.includes(g.profession)) { $("#su-all").checked = true; profSel.innerHTML = profOptions(g.profession, true); }
        profSel.value = g.profession;
        sizeSel.value = String(g.size); syncSeats();
      }
    });
    $("#su-all").addEventListener("change", (e) => { S.showAll = e.target.checked; const v = profSel.value; profSel.innerHTML = profOptions(v, S.showAll); });
    $("#setup").addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = $("#su-code").value.trim();
      const parsed = raw ? M.parseSessionCode(raw) : null;
      if (raw && !parsed) { $("#su-err").textContent = U.invalidSessionCode; $("#su-code").focus(); return; }
      S.setup = { name: $("#su-name").value.trim().slice(0, 24), prof: profSel.value, group: +grpSel.value, size: +sizeSel.value, seat: seatSel.value, code: parsed ? parsed.code : "" };
      store.set("mmi.setup", S.setup);
      S.editing = false; S.prefillCode = ""; S.manualStation = null; S.variantOverride = null; S.candProf = null; S.lastKey = "";
      render(); keepAwake();
    });
  }

  /* ---------- station (§4.2, §8) ---------- */
  function viewKey(cur) {
    const ph = cur.clock.phase;
    const grp = ph === "before" ? "before" : ph === "read" || ph === "idle" ? "read" : ph === "interview" ? "interview" : "post";
    return [S.tab, cur.st, cur.round, cur.variant, cur.prof, cur.role, cur.role === "interviewee" ? grp : ""].join("|");
  }
  function renderStation() {
    if (!S.setup || S.editing) return renderSetup();
    let cur = current();
    S.lastRound = cur.round;
    S.lastKey = viewKey(cur);
    const su = S.setup, stn = station(cur.st), sc = scenario(cur.prof, cur.st, cur.variant), cfg = cur.cfg;
    const rotation = Object.keys(cur.roles).sort().map((seat) => `<span class="${seat === su.seat ? "me" : ""}">${seat} · ${esc(ROLE[cur.roles[seat]].label)}</span>`).join("");
    const sessionLine = cfg
      ? `Class session <b class="tnum">${esc(cfg.code)}</b> · ${cfg.mode === "F" ? `all groups on Station ${cfg.station}` : `circuit, Set ${letter(cfg.set)}`} · ${cfg.rounds} rounds`
      : "Free practice · your device keeps time";
    app.innerHTML = `
    <div class="clock" id="clock"><span class="ph" id="ck-ph">—</span><div class="meta"><div class="label" id="ck-round"></div><div class="small muted" id="ck-hint"></div></div><span class="tm" id="ck-tm" aria-live="off">--:--</span><div class="prog" id="ck-prog"></div></div>
    <div class="row small muted" style="justify-content:space-between">
      <span>${sessionLine}</span>
      <span class="row">
        ${cfg ? "" : `<button class="btn ghost" id="lc-start" type="button">Start</button><button class="btn ghost" id="lc-reset" type="button">Reset</button>`}
        <button class="btn ghost" id="snd" type="button" aria-pressed="${S.sound}">${S.sound ? "Sound on" : "Sound off"}</button>
        <button class="btn ghost" id="edit" type="button" aria-label="Edit setup">${esc(su.name || "Me")} · Group ${su.group} · Seat ${su.seat} ✎</button>
      </span>
    </div>
    <section class="door sc${cur.st}">
      <div class="num"><span>Station</span><b>${cur.st}</b></div>
      <div class="info">
        <p class="label">${esc(stn.skill)} · ${esc(profLabel(cur.prof))}</p>
        <h2>${esc(stn.name)}</h2>
        <div class="row" style="justify-content:space-between">
          <div class="stationpick" role="group" aria-label="Choose station">${C.stations.map((s) => `<button type="button" class="sc${s.number}" data-st="${s.number}" aria-pressed="${s.number === cur.st}" title="${esc(s.name)}" aria-label="Station ${s.number}: ${esc(s.name)}">${s.number}</button>`).join("")}</div>
          <div class="row"><span class="label">Scenario</span><div class="chips" role="group" aria-label="Scenario">${[0, 1, 2].map((i) => `<button type="button" class="chip" data-var="${i}" aria-pressed="${i === cur.variant}">${letter(i)}${i === 2 ? " · hard" : ""}</button>`).join("")}</div></div>
        </div>
        ${cfg ? "" : `<div class="row small"><label class="row" for="man-round"><span class="label">Round</span></label><select id="man-round">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === cur.round ? "selected" : ""}>${n}</option>`).join("")}</select><span class="muted">Round decides who plays which role.</span></div>`}
      </div>
    </section>
    <section class="role"><div><p class="label" style="color:inherit;opacity:.75">Round ${cur.round} · your role</p><div class="who">${esc(ROLE[cur.role].label)}</div></div><div class="rot" aria-label="Roles this round">${rotation}</div></section>
    <p class="hint" id="role-hint"></p>
    <div id="rolebody"></div>`;
    const body = $("#rolebody");
    if (cur.role === "interviewee") body.innerHTML = viewInterviewee(cur, stn, sc);
    else if (cur.role === "interviewer") body.innerHTML = viewInterviewer(cur, stn, sc);
    else body.innerHTML = viewObserver(cur, stn, sc);
    wireStation(cur, stn, sc);
    tick(true);
  }

  function viewInterviewee(cur, stn, sc) {
    const ph = cur.clock.phase;
    const fwName = stn.interviewee.framework.name;
    if (ph === "before") {
      return `<div class="two"><section class="panel center" style="justify-content:center;padding-block:28px"><p class="label">Waiting for the class clock</p><h2>The prompt appears when reading time starts.</h2><p class="muted">Sit facing your interviewer.</p></section>
        <section class="panel"><h3>Remember: ${esc(fwName)}</h3>${fwBlock(stn)}</section></div>`;
    }
    if (ph === "read" || ph === "idle") {
      return `<div class="two"><section class="sect">${doorCard(cur.st, cur.variant, sc)}</section>
        <section class="panel"><h3>Plan with: ${esc(fwName)}</h3>${fwBlock(stn)}<p class="small muted">Note 2–3 key points. When the interview starts, put your phone face down.</p></section></div>`;
    }
    if (ph === "interview") {
      return `<section class="panel center" style="padding-block:28px"><p class="label">Interview in progress</p><h2>Phone down. Look at your interviewer.</h2>
        <p class="muted">Answer first, then explain. Think aloud. It's fine to pause.</p>
        <details style="width:100%;text-align:left"><summary>Show the prompt again</summary><div>${doorCard(cur.st, cur.variant, sc)}</div></details></section>`;
    }
    return `<div class="two"><section class="panel"><h3>Feedback time</h3>
        ${fbGuide(cur.feedbackMin)}
        <form id="imp" class="sect" novalidate>
          ${selfRate("self", 0)}
          <label class="field"><span class="label">Report code from your observer</span><input id="imp-code" placeholder="XXXXX-XXXXX-XXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
          <div class="row"><button class="btn primary" type="submit">Save report</button></div>
        </form>
        <p id="imp-msg" class="small" role="status"></p></section>
        <section class="panel"><h3>Reflect in one minute</h3><ul class="list">${C.observer.reflectionPrompts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        <details><summary>See the prompt again</summary><div>${doorCard(cur.st, cur.variant, sc)}</div></details></section></div>`;
  }

  function viewInterviewer(cur, stn, sc) {
    const key = draftKey(cur), asked = S.asked[key] || 0, ig = S.intG[key] || 0;
    const iv = sc.interviewer, isActor = !!iv.actor;
    const guide = isActor ? C.interviewer.timingGuide.roleplay : C.interviewer.timingGuide.standard;
    const conduct = ROLE.interviewer.conduct || [];
    return `
    <div class="row"><label class="row" for="cand-prof"><span class="label">Interviewee's profession</span></label><select id="cand-prof">${profOptions(cur.prof, true)}</select></div>
    <div class="two">
      <section class="sect">
        ${isActor ? `<div class="actor"><p class="label" style="color:var(--s4)">You are acting · stay in character</p><h3>${esc(iv.actor.role)}</h3><p>${esc(iv.actor.brief)}</p>
          <p class="label">Your lines</p><ul class="list">${iv.actor.lines.map((l) => `<li><strong>"${esc(l)}"</strong></li>`).join("")}</ul>
          <p class="label">How to react</p><p class="small">${esc(iv.actor.howToReact)}</p></div>` : ""}
        <div class="panel"><p class="label">${isActor ? "Read aloud, out of character · then say your first line" : "Opening question · read aloud"}</p><p class="say">${esc(iv.openingQuestion)}</p>
          <p class="label">${isActor ? "After the role-play: follow-ups" : "Follow-up probes · tick as you ask"}</p>
          <ul class="checks">${iv.followUps.map((f, i) => `<li><label><input type="checkbox" data-ask="${i}" ${asked & (1 << i) ? "checked" : ""}><span>${esc(f)}</span></label></li>`).join("")}</ul>
          <p class="label">Pressure probe</p><div class="flag" style="border-left-color:var(--signal);background:color-mix(in srgb,var(--signal) 10%,var(--surface))">${esc(iv.pressureProbe)}</div></div>
        <details><summary>What the candidate sees on the door</summary><div>${doorCard(cur.st, cur.variant, sc)}</div></details>
      </section>
      <section class="sect">
        <div class="panel"><h3>Your timing</h3>
          <div class="cues" id="cues" data-sec="${cur.interviewMin * 60}">${guide.map((g, i) => `<b data-cue="${i}" data-at="${M.cueTime(cur.interviewMin, g.atFraction)}">${fmt(M.cueTime(cur.interviewMin, g.atFraction))}</b><span data-cue="${i}">${esc(g.text)}</span>`).join("")}</div>
          <ul class="list small muted">${conduct.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
        <div class="panel"><h3>A strong answer includes</h3><ul class="list">${sc.observer.keyPoints.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
          <p class="label">Warning signs</p>${sc.observer.warningSigns.map((r) => `<div class="flag small">${esc(r)}</div>`).join("")}</div>
        <div class="panel"><h3>Your global rating</h3><p class="small muted">${esc(C.settings.globalScale.prompt)} ${esc(C.settings.globalScale.calibrationNote || "")}</p>
          ${seg("ig", [1, 2, 3, 4, 5, 6, 7], ig, Object.assign((n) => String(n), { title: globalLevel }), "", "Interviewer global rating")}
          <p class="small" id="ig-label">${ig ? `${ig} · ${esc(globalLevel(ig))}` : "1 Unsuitable … 4 Satisfactory … 7 Outstanding"}</p>
          <p class="small muted">At the bell, tell the observer your number.</p></div>
        <div class="panel"><h3>Feedback order</h3>${fbGuide(cur.feedbackMin)}</div>
      </section>
    </div>`;
  }

  function draftFor(cur) {
    const key = draftKey(cur);
    if (!S.drafts[key]) S.drafts[key] = { ratings: Array(13).fill(0), obsG: 0, intG: S.intG[key] || 0, flags: 0, looks: 0, strength: "", work: "" };
    return [key, S.drafts[key]];
  }
  function ratingRow(c, i, val) {
    const lab = (n) => (n ? String(n) : C.settings.ratingScale["0"].label);
    lab.title = (n) => levelLabel(n) + " — " + C.settings.ratingScale[String(n)].meaning;
    return `<div class="crit"><div><strong id="cl-${i}">${esc(c.label)}</strong></div>
      ${seg("c" + i, [0, 1, 2, 3, 4], val, lab, `data-crit="${i}"`, c.label)}
      <div class="anch"><span>1 · ${esc(c.anchors["1"])}</span><span style="text-align:right">4 · ${esc(c.anchors["4"])}</span></div></div>`;
  }
  function viewObserver(cur, stn, sc) {
    const [key, d] = draftFor(cur);
    if (S.made[key]) return observerReport(cur, key, sc);
    const crit = M.criteriaFor(C, cur.st);
    const W = C.settings.weights, RS = C.settings.ratingScale;
    const grp = (title, weight, from, to) => `<div class="panel"><div class="grp-h"><h3>${title}</h3><span class="small muted">${Math.round(weight * 100)}% of score</span></div>${crit.slice(from, to).map((c, j) => ratingRow(c, from + j, d.ratings[from + j])).join("")}</div>`;
    const legend = `<div class="legend">${[1, 2, 3, 4].map((n) => `<span><b>${n}</b> ${esc(RS[n].label)}${n === 2 || n === 3 ? ": " + esc(RS[n].meaning) : ""}</span>`).join("")}<span><b>${esc(RS[0].label)}</b> ${esc(RS[0].meaning)}</span></div>`;
    const isO2 = cur.role === "observer2";
    const SG = C.observer.scoringGuide;
    const globalSeg = (name, field, val, aria) => seg(name, [1, 2, 3, 4, 5, 6, 7], val, Object.assign((n) => String(n), { title: globalLevel }), `data-g="${field}"`, aria);
    return `
    <div class="row"><label class="row" for="cand-prof"><span class="label">Interviewee's profession</span></label><select id="cand-prof">${profOptions(cur.prof, true)}</select>
      ${isO2 ? `<span class="small muted">You also keep time and call the 1-minute warning.</span>` : ""}</div>
    <p class="small"><strong>${esc(SG.honesty)}</strong></p>
    <div class="progress" id="obs-prog" aria-live="polite"></div>
    <form id="obs" class="two" novalidate>
      <section class="sect">
        <div class="sect-h"><h3>During the interview</h3><p class="small muted">${esc(SG.during)}</p></div>
        ${legend}
        ${grp(`Station ${cur.st} · ${esc(stn.name)}`, W.station, 0, 4)}
        <div class="panel"><h3>Did you hear these?</h3><p class="small muted">Scenario ${letter(cur.variant)}: ${esc(sc.title)}. Tick each point the candidate made.</p>
          <ul class="checks keep">${sc.observer.keyPoints.slice(0, 5).map((l, i) => `<li><label><input type="checkbox" data-look="${i}" ${d.looks & (1 << i) ? "checked" : ""}><span>${esc(l)}</span></label></li>`).join("")}</ul></div>
        <div class="panel"><h3>Red flags</h3><p class="small muted">In a real MMI, one serious concern can outweigh a good score.</p>
          <ul class="checks keep">${C.observer.redFlags.map((f) => `<li><label><input type="checkbox" data-flag="${f.bit}" ${d.flags & (1 << f.bit) ? "checked" : ""}><span>${esc(f.label)}</span></label></li>`).join("")}</ul></div>
      </section>
      <section class="sect">
        <div class="sect-h"><h3>At the bell</h3><p class="small muted">${esc(SG.atBell)}</p></div>
        ${grp("Communication &amp; English", W.communication, 4, 8)}
        ${grp("Presence", W.presence, 8, 13)}
        <div class="panel"><h3>Global ratings</h3>
          <p class="small muted">${esc(C.settings.globalScale.prompt)} ${esc(C.settings.globalScale.calibrationNote || "")}</p>
          <p class="label">Your rating (observer)</p>${globalSeg("og", "obsG", d.obsG, "Observer global rating")}
          <p class="label">Interviewer's rating (ask them)</p>${globalSeg("intg", "intG", d.intG, "Interviewer global rating")}
          <p class="small muted">${[1, 2, 3, 4, 5, 6, 7].map((n) => n + " " + esc(globalLevel(n))).join(" · ")}</p></div>
        <div class="panel"><h3>Your comments</h3>
          ${C.observer.commentFields.map((f) => `<label class="field"><span class="label">${esc(f.label)}</span><textarea id="ob-${f.id}" data-note="${f.id}" rows="2">${esc(d[f.id] || "")}</textarea></label>`).join("")}
          <p class="small muted">Comments stay on this phone. They are not in the report code.</p></div>
        <div class="row"><button class="btn signal" type="submit">Create report</button><span class="small err" id="obs-msg" role="alert"></span></div>
      </section>
    </form>`;
  }
  function obsProgress(d) {
    const min = C.settings.minimumRatings;
    const st = d.ratings.slice(0, 4).filter((x) => x > 0).length, tot = d.ratings.filter((x) => x > 0).length;
    const ok = M.meetsMinimum(d.ratings, min);
    const el = $("#obs-prog"); if (!el) return;
    el.innerHTML = `<span>Station <b class="${st >= min.station ? "ok" : ""}">${st}/4</b></span><span>All criteria <b class="${tot >= min.total ? "ok" : ""}">${tot}/13</b></span><span>Key points <b>${M.popcount(d.looks)}/5</b></span><span>Globals <b>${(d.obsG ? 1 : 0) + (d.intG ? 1 : 0)}/2</b></span><span class="small ${ok ? "okmsg" : "muted"}">${ok ? "Ready to create the report" : esc(U.rateMinimum)}</span>`;
  }

  /* ---------- report (§9) ---------- */
  function scenarioOf(r) { return scenario(PROFS[r.prof], r.station, r.variant); }
  function concernText(sc) {
    const txt = U.concernBanner.replace("{flags}", sc.flagList.map((f) => f.label).join("; "));
    const i = txt.indexOf(". ");
    return i > 0 ? `<strong>${esc(txt.slice(0, i + 1))}</strong> ${esc(txt.slice(i + 2))}` : esc(txt);
  }
  function globText(sc) { return sc.glob === null ? U.notScored : (Math.round(sc.glob * 10) / 10) + "/7"; }
  function calibrationNotes(r, sc) {
    const out = [];
    if (sc.raterGap) out.push(U.raterGap.replace("{gap}", sc.raterGap));
    if (sc.mismatch) out.push(U.checklistGlobalMismatch);
    const v = M.selfVerdict(r.self, sc.glob, C.settings.calibration.selfGap);
    if (v) out.push(`You rated yourself ${r.self}/7 · raters ${globText(sc)}. ` + U["self" + v[0].toUpperCase() + v.slice(1)]);
    return out;
  }
  function reportHTML(r, opts) {
    opts = opts || {};
    const sc = M.scoreReport(r, C), stn = station(r.station), scn = scenarioOf(r);
    const m = (x) => (x === null ? U.notScored : Math.round(x * 100) + "%");
    const meter = (x) => `<div class="meter" role="img" aria-label="${m(x)}"><i style="width:${x === null ? 0 : Math.round(x * 100)}%"></i></div>`;
    const dots = (n) => `<span class="dots" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
    const notes = opts.notes || {};
    const calib = calibrationNotes(r, sc);
    return `<div class="rep">
      <div class="door sc${r.station}"><div class="num"><span>Station</span><b>${r.station}</b></div><div class="info"><p class="label">${esc(profLabel(PROFS[r.prof]))} · Scenario ${letter(r.variant)}${opts.date ? ` · ${esc(opts.date)}` : ""}</p><h3>${esc(stn.name)}: ${esc(scn.title)}</h3></div></div>
      ${sc.flagList.length ? `<div class="alert" role="note">${concernText(sc)}</div>` : ""}
      <div class="rep-top">
        <div class="stat"><span class="label">Station score</span><b>${sc.pct === null ? esc(U.notScored) : sc.pct + "%"}</b>${sc.band ? `<span class="pill ${sc.band.tone}">${esc(sc.band.label)}</span>` : ""}</div>
        <div class="stat"><span class="label">Global rating</span><b>${esc(globText(sc))}</b><span class="small muted">${sc.glob === null ? esc(U.globalNotGiven) : esc(sc.globalLabel)}</span></div>
        <div class="stat"><span class="label">Key points heard</span><b>${sc.looksCount}/${Math.min(5, scn.observer.keyPoints.length)}</b><span class="small muted">from the scenario checklist</span></div>
      </div>
      ${calib.length ? `<div class="calib"><p class="label">Check the scoring together</p><ul class="list">${calib.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      <div class="panel"><div class="grp-h"><h3>Breakdown</h3><span class="small muted">weighted ${Math.round(C.settings.weights.station * 100)} / ${Math.round(C.settings.weights.communication * 100)} / ${Math.round(C.settings.weights.presence * 100)}</span></div>
        <div class="grid-form">
          <div class="field"><span class="label">Station skills · ${m(sc.content)}</span>${meter(sc.content)}</div>
          <div class="field"><span class="label">Communication &amp; English · ${m(sc.comm)}</span>${meter(sc.comm)}</div>
          <div class="field"><span class="label">Presence · ${m(sc.pres)}</span>${meter(sc.pres)}</div>
        </div>
        <div class="tbl-wrap"><table><tbody>${sc.items.map((x) => `<tr><td>${esc(x.c.label)}</td><td style="white-space:nowrap">${dots(x.v)} <span class="small muted">${esc(levelLabel(x.v))}</span></td></tr>`).join("")}</tbody></table></div></div>
      <div class="two">
        <div class="panel"><h3>What worked</h3>${sc.strengths.length ? `<ul class="list">${sc.strengths.map((x) => `<li>${esc(x.c.feedback.whenHigh)}</li>`).join("")}</ul>` : `<p class="muted">${esc(U.noStrengths)}</p>`}
          ${notes.strength ? `<p class="note small"><strong>Observer:</strong> ${esc(notes.strength)}</p>` : ""}</div>
        <div class="panel"><h3>Work on next</h3>${sc.priorities.length ? `<ul class="list">${sc.priorities.map((x) => `<li><strong>${esc(x.c.label)}.</strong> ${esc(x.c.feedback.whenLow)}</li>`).join("")}</ul>` : ""}
          ${notes.work ? `<p class="note small"><strong>Observer:</strong> ${esc(notes.work)}</p>` : ""}</div>
      </div>
      <div class="panel"><h3>Follow-up actions</h3><ol class="list">${sc.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ol></div>
    </div>`;
  }
  function reportText(r, code, notes) {
    const sc = M.scoreReport(r, C), stn = station(r.station), scn = scenarioOf(r);
    const lines = [
      `MMI report · Station ${r.station} ${stn.name} · ${profLabel(PROFS[r.prof])} · Scenario ${letter(r.variant)}: ${scn.title}`,
      `Station score: ${sc.pct === null ? U.notScored : sc.pct + "%"} (${sc.band ? sc.band.label : U.notScored}) · Global: ${sc.glob === null ? U.globalNotGiven : globText(sc)}`,
      sc.flagList.length ? `Concern: ${sc.flagList.map((f) => f.label).join("; ")}` : "",
      `What worked: ${sc.strengths.map((x) => x.c.feedback.whenHigh).join(" ") || U.noStrengths}`,
      sc.priorities.length ? `Work on: ${sc.priorities.map((x) => x.c.label + " – " + x.c.feedback.whenLow).join(" ")}` : "",
      `Actions: ${sc.actions.map((a, i) => (i + 1) + ". " + a).join(" ")}`,
      code ? `Report code: ${code}` : ""
    ];
    if (notes && notes.strength) lines.push(`Observer – ${C.observer.commentFields[0].label}: ${notes.strength}`);
    if (notes && notes.work) lines.push(`Observer – ${C.observer.commentFields[1].label}: ${notes.work}`);
    return lines.filter(Boolean).join("\n");
  }
  function handoff(code) {
    const url = appUrl() + "#r-" + code.replace(/-/g, "");
    return `<div class="handoff"><div class="qrbox">${qrSVG(url, "QR code for report " + code)}</div>
      <div class="sect"><p class="label">Show this to the interviewee</p><div class="codebox" id="code">${esc(code)}</div><p class="small muted">${esc(U.scanHint)}</p></div></div>`;
  }
  function observerReport(cur, key, sc) {
    const r = S.made[key];
    return `<section class="panel" style="gap:16px">
      <div class="row" style="justify-content:space-between"><h2>Report code</h2><button class="btn ghost" id="edit-rep" type="button">Edit ratings</button></div>
      ${handoff(r.code)}
      <div class="row"><button class="btn" id="copy-code" type="button">Copy code</button><button class="btn" id="copy-text" type="button">Copy report as text</button><span class="small" id="copy-msg" role="status"></span></div>
      <div class="panel"><h3>Feedback order</h3>${fbGuide(cur.feedbackMin)}</div>
      ${reportHTML(r, { notes: r.notes })}
    </section>`;
  }

  /* ---------- reports storage (§6, §11) ---------- */
  const getReports = () => store.get("mmi.reports", []);
  const getGiven = () => store.get("mmi.given", []);
  const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  function importCode(raw, self) {
    const r = M.decodeReport(raw, PROFS.length);
    if (!r) return { ok: false };
    const code = M.encodeReport(r);
    const list = getReports();
    const ex = list.find((x) => x.code === code);
    if (ex) { if (self && !ex.self) { ex.self = self; store.set("mmi.reports", list); } }
    else {
      const entry = Object.assign({ code, date: today() }, r);
      if (self) entry.self = self;
      list.unshift(entry); store.set("mmi.reports", list);
    }
    return { ok: true, code, r };
  }
  function sendGradebook(r, code, cur, sc) {
    if (!CONFIG.GRADEBOOK_URL) return;
    try {
      const body = { date: new Date().toISOString(), group: S.setup.group, observerSeat: S.setup.seat, round: cur.round, sessionCode: S.setup.code || "", code,
        prof: PROFS[r.prof], station: r.station, variant: letter(r.variant), pct: sc.pct, glob: sc.glob, flags: r.flags };
      fetch(CONFIG.GRADEBOOK_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) }).catch(() => {});
    } catch (e) { /* fire and forget */ }
  }

  /* ---------- station wiring ---------- */
  function wireSeg(name, onPick) { $$(`input[name="${name}"]`).forEach((c) => c.addEventListener("change", () => onPick(+c.value))); }
  function wireStation(cur, stn, sc) {
    $("#edit").onclick = () => { S.editing = true; render(); };
    $("#snd").onclick = () => { S.sound = !S.sound; if (S.sound) beep(1, 660); const b = $("#snd"); b.textContent = S.sound ? "Sound on" : "Sound off"; b.setAttribute("aria-pressed", String(S.sound)); };
    $$(".stationpick button").forEach((b) => { b.onclick = () => { S.manualStation = +b.dataset.st; S.variantOverride = null; render(); }; });
    $$("[data-var]").forEach((b) => { b.onclick = () => { S.variantOverride = +b.dataset.var; render(); }; });
    const mr = $("#man-round"); if (mr) mr.onchange = () => { S.manualRound = +mr.value; render(); };
    const ls = $("#lc-start");
    if (ls) {
      const upd = () => { ls.textContent = S.local.running ? "Pause" : (S.local.offset > 0 ? "Resume" : "Start"); };
      upd();
      ls.onclick = () => {
        if (S.local.running) { S.local.offset += (Date.now() - S.local.startedAt) / 1000; S.local.running = false; }
        else {
          const tot = (T().readMin + T().interviewMin + T().feedbackMin) * 60;
          if (S.local.offset >= tot) { S.local.offset = 0; S.warned = {}; }
          S.local.startedAt = Date.now(); S.local.running = true; keepAwake();
        }
        upd(); tick(false);
      };
      $("#lc-reset").onclick = () => { S.local = { running: false, startedAt: 0, offset: 0 }; S.warned = {}; S.lastKey = ""; render(); };
    }
    const cp = $("#cand-prof"); if (cp) cp.onchange = () => { S.candProf = cp.value; render(); };
    const key = draftKey(cur);
    $$("[data-ask]").forEach((c) => { c.onchange = () => { S.asked[key] = (S.asked[key] || 0) ^ (1 << +c.dataset.ask); }; });
    wireSeg("ig", (v) => { S.intG[key] = v; $("#ig-label").textContent = v + " · " + globalLevel(v); });

    const imp = $("#imp");
    if (imp) {
      let self = 0;
      wireSeg("self", (v) => { self = v; $("#self-lab").textContent = v + " · " + globalLevel(v); });
      imp.onsubmit = (e) => {
        e.preventDefault();
        const res = importCode($("#imp-code").value, self);
        const msg = $("#imp-msg");
        if (res.ok) {
          msg.className = "small okmsg";
          msg.innerHTML = `Saved. <button class="btn ghost" id="go-rep" type="button">Open the report</button>`;
          $("#go-rep").onclick = () => { S.viewReport = res.code; setTab("reports"); };
        } else { msg.className = "small err"; msg.textContent = U.invalidReportCode; }
      };
    }

    const obs = $("#obs");
    if (obs) {
      const d = S.drafts[key];
      obsProgress(d);
      obs.addEventListener("change", (e) => {
        const t = e.target;
        if (t.dataset.crit !== undefined) d.ratings[+t.dataset.crit] = +t.value;
        else if (t.dataset.g) d[t.dataset.g] = +t.value;
        else if (t.dataset.look !== undefined) d.looks ^= 1 << +t.dataset.look;
        else if (t.dataset.flag !== undefined) d.flags ^= 1 << +t.dataset.flag;
        obsProgress(d);
      });
      $$("[data-note]").forEach((ta) => { ta.oninput = () => { d[ta.dataset.note] = ta.value; }; });
      obs.onsubmit = (e) => {
        e.preventDefault();
        if (!M.meetsMinimum(d.ratings, C.settings.minimumRatings)) { $("#obs-msg").textContent = U.rateMinimum; return; }
        const r = { prof: PROFS.indexOf(cur.prof), station: cur.st, variant: cur.variant, ratings: d.ratings.slice(), obsG: d.obsG, intG: d.intG, flags: d.flags, looks: d.looks };
        const code = M.encodeReport(r);
        const notes = { strength: d.strength || "", work: d.work || "" };
        S.made[key] = Object.assign({}, r, { code, notes });
        const given = getGiven().filter((g) => g.code !== code);
        given.unshift({ code, date: new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), notes });
        store.set("mmi.given", given.slice(0, 40));
        sendGradebook(r, code, cur, M.scoreReport(r, C));
        render();
        const rb = $("#rolebody"); if (rb) window.scrollTo({ top: rb.getBoundingClientRect().top + window.scrollY - 80 });
      };
    }
    const er = $("#edit-rep"); if (er) er.onclick = () => { delete S.made[key]; render(); };
    const cc = $("#copy-code");
    if (cc) {
      const r = S.made[key];
      cc.onclick = () => copy(r.code, $("#copy-msg"), $("#code"));
      $("#copy-text").onclick = () => copy(reportText(r, r.code, r.notes), $("#copy-msg"));
    }
  }

  /* ---------- clock tick ---------- */
  let lastPhase = "";
  function updateLiveGuides(phase, elapsed) {
    const cues = $("#cues");
    if (cues) {
      const marks = $$("b[data-cue]", cues);
      let idx = -1;
      if (phase === "interview") marks.forEach((b, i) => { if (elapsed >= +b.dataset.at) idx = i; });
      else if (phase === "feedback" || phase === "rotate" || phase === "done") idx = marks.length;
      $$("[data-cue]", cues).forEach((el) => { const i = +el.dataset.cue; el.classList.toggle("now", i === idx && phase === "interview"); el.classList.toggle("past", i < idx); });
    }
    $$(".fbguide").forEach((ol) => {
      let idx = -1;
      if (phase === "feedback") $$("li", ol).forEach((li, i) => { if (elapsed >= +li.dataset.at) idx = i; });
      $$("li", ol).forEach((li, i) => li.classList.toggle("now", i === idx));
    });
  }
  function tick(force) {
    if (S.tab === "teacher") return teacherTick(force);
    if (S.tab !== "station" || !S.setup || S.editing || !C) return;
    let cur = current();
    if (S.lastRound !== null && cur.round !== S.lastRound) {
      if (S.variantOverride !== null) { S.variantOverride = null; cur = current(); }
      S.lastRound = cur.round;
    }
    const c = cur.clock, pk = c.phase + "|" + cur.round;
    if (!force) {
      if (lastPhase && pk !== lastPhase && c.phase !== "idle" && c.phase !== "before") phaseBeep(c.phase);
      if (c.phase === "interview" && c.remaining <= 60 && !S.warned[pk]) { S.warned[pk] = 1; beep(1, 1200); }
      lastPhase = pk;
      if (viewKey(cur) !== S.lastKey) { renderStation(); return; }
    } else {
      if (c.phase === "interview" && c.remaining <= 60) S.warned[pk] = 1;
      lastPhase = pk;
    }
    const el = $("#clock"); if (!el) return;
    el.className = "clock ph-" + c.phase + (c.phase === "interview" && c.remaining <= 60 ? " warn" : "");
    $("#ck-ph").textContent = c.label;
    $("#ck-tm").textContent = c.phase === "done" ? "00:00" : fmt(c.remaining);
    $("#ck-round").textContent = cur.cfg ? `Round ${cur.round} of ${cur.cfg.rounds}` : `Round ${cur.round} · free practice`;
    $("#ck-hint").textContent = c.paused ? "Paused" : (C.settings.clockHints[c.phase] || "");
    $("#ck-prog").style.width = (c.phase === "before" || c.phase === "idle" ? 0 : Math.min(100, (c.elapsed / c.total) * 100)) + "%";
    const rh = $("#role-hint"); if (rh) rh.textContent = ROLE[cur.role].phaseInstructions[c.phase] || "";
    updateLiveGuides(c.phase, c.elapsed || 0);
  }

  /* ---------- toolkit (§4.3) ---------- */
  function renderToolkit() {
    const st = S.tkStation || 1, pk = S.tkProf || (S.setup ? S.setup.prof : C.classList[0]), stn = station(st), ii = stn.interviewee;
    app.innerHTML = `
    <section class="panel"><p class="label">Toolkit</p><h2>Frameworks, phrases and vocabulary</h2>
      <div class="stationpick" role="group" aria-label="Choose station">${C.stations.map((s) => `<button type="button" class="sc${s.number}" data-tk="${s.number}" aria-pressed="${s.number === st}" aria-label="Station ${s.number}: ${esc(s.name)}" title="${esc(s.name)}">${s.number}</button>`).join("")}</div></section>
    <section class="door sc${st}"><div class="num"><span>Station</span><b>${st}</b></div><div class="info"><p class="label">${esc(stn.skill)}</p><h2>${esc(stn.name)}</h2><p>${esc(stn.purpose)}</p></div></section>
    <section class="panel"><h3>Framework: ${esc(ii.framework.name)}</h3>${fwBlock(stn)}</section>
    <div class="two">
      <section class="panel"><h3>Phrase bank</h3><ul class="phrases">${ii.phraseBank.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>
      <section class="sect">
        <div class="panel"><h3>Grammar focus</h3><p>${esc(ii.grammarFocus)}</p></div>
        <div class="panel"><h3>Common traps</h3>${ii.traps.map((t) => `<div class="flag small">${esc(t)}</div>`).join("")}</div>
        <div class="panel"><h3>What the assessor scores</h3><ul class="list">${stn.observer.stationCriteria.map((c) => `<li><strong>${esc(c.label)}</strong>: ${esc(c.anchors["4"])}</li>`).join("")}</ul></div>
      </section>
    </div>
    <section class="panel"><div class="row" style="justify-content:space-between"><h3>Profession vocabulary</h3><label class="sr" for="tk-prof">Profession</label><select id="tk-prof">${profOptions(pk, true)}</select></div>
      <div class="vocab">${PROF[pk].vocabulary.map((w) => `<div><b>${esc(w.term)} <span class="small muted">${esc(w.pos)}</span></b><span class="small">${esc(w.def)}</span><em>${esc(w.example)}</em></div>`).join("")}</div></section>
    <section class="panel"><h3>Ten rules for MMI day</h3><div class="vocab">${C.interviewee.generalRules.map((g) => `<div><b>${esc(g.title)}</b><span class="small">${esc(g.text)}</span></div>`).join("")}</div></section>`;
    $$("[data-tk]").forEach((b) => { b.onclick = () => { S.tkStation = +b.dataset.tk; renderToolkit(); }; });
    $("#tk-prof").onchange = (e) => { S.tkProf = e.target.value; renderToolkit(); };
  }

  /* ---------- my reports (§11) ---------- */
  function pendingCard() {
    const r = M.decodeReport(S.pending, PROFS.length);
    return `<section class="panel"><p class="label">${esc(U.reportReceived)}</p><h2>Station ${r.station} · ${esc(station(r.station).name)}</h2>
      <form id="pend" class="sect" novalidate>${selfRate("pself", 0)}
        <div class="row"><button class="btn primary" type="submit">Open my report</button><button class="btn ghost" type="button" id="pend-skip">Skip</button></div></form></section>`;
  }
  function renderReports() {
    const list = getReports(), given = getGiven();
    if (S.pending) {
      app.innerHTML = pendingCard();
      let self = 0;
      wireSeg("pself", (v) => { self = v; $("#pself-lab").textContent = v + " · " + globalLevel(v); });
      const finish = (sv) => { const res = importCode(S.pending, sv); S.pending = null; S.viewReport = res.ok ? res.code : null; renderReports(); window.scrollTo(0, 0); };
      $("#pend").onsubmit = (e) => { e.preventDefault(); finish(self); };
      $("#pend-skip").onclick = () => finish(0);
      return;
    }
    if (S.showGiven) {
      const g = given.find((x) => x.code === S.showGiven), r = M.decodeReport(S.showGiven, PROFS.length);
      if (g && r) {
        app.innerHTML = `<section class="panel"><button class="btn ghost" id="back" type="button">← All reports</button>${handoff(g.code)}${reportHTML(r, { notes: g.notes, date: g.date })}</section>`;
        $("#back").onclick = () => { S.showGiven = null; renderReports(); };
        return;
      }
      S.showGiven = null;
    }
    const sel = S.viewReport ? list.find((x) => x.code === S.viewReport) : null;
    let summary = "";
    if (list.length) {
      const byStation = C.stations.map((s) => { const rs = list.filter((r) => r.station === s.number).map((r) => M.scoreReport(r, C).pct).filter((x) => x !== null); return { s, best: rs.length ? Math.max(...rs) : null, n: list.filter((r) => r.station === s.number).length }; });
      const gen = [...C.observer.communicationCriteria, ...C.observer.presenceCriteria].map((c, j) => {
        const vals = list.map((r) => r.ratings[4 + j]).filter((x) => x > 0);
        return { c, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, j };
      }).filter((x) => x.avg !== null).sort((a, b) => a.avg - b.avg || a.j - b.j);
      const flagCounts = C.observer.redFlags.map((f) => ({ f, n: list.filter((r) => r.flags & (1 << f.bit)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
      summary = `<section class="panel"><div class="grp-h"><h3>Progress across stations</h3><span class="small muted">best score at each station</span></div>
        <div class="tbl-wrap"><table class="plan"><tbody>${byStation.map((x) => `<tr class="sc${x.s.number}"><td class="st">${x.s.number}</td><td>${esc(x.s.name)}</td><td style="width:38%">${x.best === null ? `<span class="small muted">${esc(U.stationNotYet)}</span>` : `<div class="meter"><i style="width:${x.best}%;background:var(--sc)"></i></div>`}</td><td class="n">${x.best === null ? "" : x.best + "%"}</td><td class="small muted">${x.n ? x.n + " report" + (x.n > 1 ? "s" : "") : ""}</td></tr>`).join("")}</tbody></table></div>
        ${gen.length ? `<p class="label">Your three priorities across all stations</p><ol class="list">${gen.slice(0, 3).map((x) => `<li><strong>${esc(x.c.label)}</strong> (average ${x.avg.toFixed(1)}/4). ${esc(x.c.feedback.whenLow)}</li>`).join("")}</ol>` : ""}
        ${flagCounts.length ? `<p class="label">${esc(U.concernsHeading)}</p><ul class="list">${flagCounts.map((x) => `<li>${esc(x.f.label)} <span class="pill ${x.n > 1 ? "bad" : "warn"}">×${x.n}</span></li>`).join("")}</ul><p class="small muted">${esc(U.concernsNote)}</p>` : ""}
      </section>`;
    }
    app.innerHTML = `
    <section class="panel"><p class="label">My reports</p><h2>Feedback I've received</h2>
      ${S.flash ? `<p class="small err" role="alert">${esc(S.flash)}</p>` : ""}
      <form id="imp2" class="row" novalidate><label class="sr" for="imp2-code">Report code</label><input id="imp2-code" class="field" style="flex:1;min-width:0;padding:9px 10px;border:1.5px solid var(--line);border-radius:8px;background:var(--surface)" placeholder="Type a report code" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn primary" type="submit">Add report</button></form>
      <p class="small" id="imp2-msg" role="status"></p>
      <p class="small muted">${esc(U.storageNote)}</p></section>
    ${sel ? `<section class="panel"><div class="row" style="justify-content:space-between"><button class="btn ghost" id="back" type="button">← All reports</button><div class="row"><button class="btn" id="cp-sel" type="button">Copy report as text</button><span class="small" id="cp-msg" role="status"></span></div></div>${reportHTML(sel, { date: sel.date })}</section>` :
      `${summary}
      <section class="panel"><h3>Received (${list.length})</h3>${list.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Station</th><th>Scenario</th><th>Score</th><th><span class="sr">Open</span></th></tr></thead><tbody>${list.map((r) => {
        const sc = M.scoreReport(r, C);
        return `<tr><td>${esc(r.date)}</td><td>${r.station} · ${esc(station(r.station).name)}</td><td>${letter(r.variant)} · ${esc(scenarioOf(r).title)}</td><td class="n">${sc.pct === null ? esc(U.notScored) : sc.pct + "%"} ${sc.band ? `<span class="pill ${sc.band.tone}">${esc(sc.band.label)}</span>` : ""}${sc.flagList.length ? ' <span class="pill bad">concern</span>' : ""}</td><td><button class="btn ghost" type="button" data-open="${r.code}">Open</button></td></tr>`;
      }).join("")}</tbody></table></div>` : `<p class="muted">${esc(U.noReportsYet)}</p>`}</section>
      <section class="panel"><h3>Reports I've given as observer (${given.length})</h3>${given.length ? `<div class="tbl-wrap"><table><tbody>${given.map((g) => `<tr><td>${esc(g.date)}</td><td class="n" style="font-family:var(--f-sign);font-size:1.15rem;letter-spacing:.06em">${esc(g.code)}</td><td><button class="btn ghost" type="button" data-showg="${esc(g.code)}">Show</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">${esc(U.noGivenYet)}</p>`}</section>`}`;
    S.flash = "";
    $("#imp2").onsubmit = (e) => {
      e.preventDefault();
      const res = importCode($("#imp2-code").value, 0);
      if (res.ok) { S.viewReport = res.code; renderReports(); window.scrollTo(0, 0); }
      else { const m = $("#imp2-msg"); m.className = "small err"; m.textContent = U.invalidReportCode; }
    };
    $$("[data-open]").forEach((b) => { b.onclick = () => { S.viewReport = b.dataset.open; renderReports(); window.scrollTo(0, 0); }; });
    $$("[data-showg]").forEach((b) => { b.onclick = () => { S.showGiven = b.dataset.showg; renderReports(); window.scrollTo(0, 0); }; });
    const bk = $("#back"); if (bk) bk.onclick = () => { S.viewReport = null; renderReports(); };
    const cs = $("#cp-sel"); if (cs) cs.onclick = () => copy(reportText(sel, sel.code), $("#cp-msg"));
  }

  /* ---------- teacher (§13) ---------- */
  function teacherDefaults() {
    const d = new Date(Date.now() + 120000);
    const t = T();
    return { hh: d.getHours(), mm: d.getMinutes(), mode: "F", station: 1, set: 0, rounds: 3, read: t.readMin, interview: t.interviewMin, feedback: t.feedbackMin };
  }
  function teacherWarnings(t) {
    const out = [];
    const total = M.roundLength(t) * t.rounds;
    if (total > C.settings.lessonWarnMinutes * 60) out.push(U.lessonTooLong.replace("{total}", fmt(total)).replace("{lesson}", C.settings.lessonMinutes));
    if (t.read < 2 && ((t.mode === "F" && t.station === 5) || (t.mode === "C" && t.set !== 2))) out.push(U.readingTight);
    return out;
  }
  function renderTeacher() {
    const saved = S.teacherForm || (function () { const p = M.parseSessionCode(store.get("mmi.teacher", "")); return p ? Object.assign({}, p, { station: p.station || 1, set: p.set === null ? 0 : p.set }) : null; })();
    const t = saved || teacherDefaults();
    S.teacherForm = t;
    const opt = (arr, v) => arr.map(([val, lab]) => `<option value="${val}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("");
    const code = M.makeSessionCode(t);
    const roundLen = M.roundLength(t);
    const start = new Date(); start.setHours(t.hh, t.mm, 0, 0);
    const end = new Date(start.getTime() + roundLen * t.rounds * 1000);
    const warns = teacherWarnings(t);
    const r3 = (i) => M.rolesFor(i, 3), r4 = (i) => M.rolesFor(i, 4);
    const joinUrl = appUrl() + "#s-" + code;
    app.innerHTML = `
    <section class="panel"><p class="label">Teacher</p><h2>Run the class clock</h2>
      <p class="muted">Every student device that enters the session code follows the same clock, so all groups change phase and rotate together. Project this screen.</p>
      <div class="sect"><span class="label">Lesson presets</span><div class="presets">${C.settings.lessonPresets.map((p, i) => { const on = p.mode === t.mode && (p.mode === "F" ? p.station === t.station : "ABC".indexOf(p.set) === t.set) && p.rounds === t.rounds && p.read === t.read && p.interview === t.interview && p.feedback === t.feedback; return `<button class="btn ghost" type="button" data-preset="${i}" aria-pressed="${on}">${esc(p.label)}</button>`; }).join("")}</div></div>
      <form id="tf" class="grid-form" novalidate>
        <label class="field"><span class="label">Start time</span><input type="time" id="t-start" value="${pad(t.hh)}:${pad(t.mm)}"></label>
        <label class="field"><span class="label">Mode</span><select id="t-mode">${opt([["F", "Focus: all groups, one station"], ["C", "Circuit: groups rotate stations"]], t.mode)}</select></label>
        ${t.mode === "F" ? `<label class="field"><span class="label">Station</span><select id="t-station">${opt(C.stations.map((s) => [s.number, s.number + " · " + s.name]), t.station)}</select></label>`
          : `<label class="field"><span class="label">Scenario set</span><select id="t-set">${opt([[0, "A"], [1, "B"], [2, "C · hard"]], t.set)}</select></label>`}
        <label class="field"><span class="label">Rounds</span><select id="t-rounds">${opt([1, 2, 3, 4, 5, 6].map((n) => [n, n]), t.rounds)}</select></label>
        <label class="field"><span class="label">Reading (min)</span><select id="t-read">${opt([1, 2, 3].map((n) => [n, n]), t.read)}</select></label>
        <label class="field"><span class="label">Interview (min)</span><select id="t-int">${opt([2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, n]), t.interview)}</select></label>
        <label class="field"><span class="label">Feedback (min)</span><select id="t-fb">${opt([1, 2, 3, 4, 5].map((n) => [n, n]), t.feedback)}</select></label>
        <div class="row" style="align-self:end"><button class="btn signal" type="button" id="t-soon">Start in 1 minute</button></div>
      </form>
      <p class="small muted">Each round: ${t.read} + ${t.interview} + ${t.feedback} min + ${M.ROTATE_SEC} s rotate = ${fmt(roundLen)}. ${t.rounds} rounds end at ${pad(end.getHours())}:${pad(end.getMinutes())}.</p>
      ${warns.map((w) => `<p class="small warnline">${esc(w)}</p>`).join("")}
    </section>
    <section class="proj" id="proj">
      <div class="join"><div class="sect center"><span class="label" style="color:inherit;opacity:.7">Session code</span><span class="code">${esc(code)}</span></div>
        <div class="qr" title="Scan to join this session">${qrSVG(joinUrl, "QR code to join session " + code)}</div></div>
      <div class="phase" id="pj-ph">—</div>
      <div class="big" id="pj-tm">--:--</div>
      <div class="bar2"><i id="pj-bar"></i></div>
      <div style="font-family:var(--f-sign);font-size:clamp(1.1rem,2.6vw,1.8rem);letter-spacing:.06em" id="pj-round"></div>
      <div style="font-size:clamp(.95rem,2vw,1.3rem);opacity:.85" id="pj-roles"></div>
      <div class="now" id="pj-now"></div>
      <div class="row" style="justify-content:center"><button class="btn signal" id="pj-full" type="button">Full screen</button><button class="btn" id="pj-snd" type="button" aria-pressed="${S.sound}">${S.sound ? "Sound on" : "Sound off"}</button></div>
    </section>
    <div class="two">
      <section class="panel"><h3>Role rotation</h3><div class="tbl-wrap"><table><thead><tr><th>Round</th><th>Seat A</th><th>Seat B</th><th>Seat C</th><th class="muted">Seat D*</th></tr></thead><tbody>
        ${Array.from({ length: t.rounds }, (_, i) => `<tr><td class="n">${i + 1}</td>${["A", "B", "C"].map((s) => `<td>${esc(ROLE[r3(i + 1)[s]].label)}</td>`).join("")}<td class="small muted">${esc(ROLE[r4(i + 1).D].label)}</td></tr>`).join("")}</tbody></table></div>
        <p class="small muted">*Groups of 4 rotate through 4 roles. Set 4 rounds so every member interviews.</p></section>
      <section class="panel"><h3>${t.mode === "F" ? "Scenario per round" : "Station per group"}</h3><div class="tbl-wrap">
        ${t.mode === "F" ? `<table><thead><tr><th>Round</th><th>Station</th><th>Scenario</th></tr></thead><tbody>${Array.from({ length: t.rounds }, (_, i) => `<tr><td class="n">${i + 1}</td><td>${t.station} · ${esc(station(t.station).name)}</td><td>${letter(i % 3)}${i % 3 === 2 ? " · hard" : ""}</td></tr>`).join("")}</tbody></table>`
          : `<table class="plan"><thead><tr><th>Group</th>${Array.from({ length: t.rounds }, (_, i) => `<th>R${i + 1}</th>`).join("")}</tr></thead><tbody>${C.groups.map((g) => `<tr><td class="n">${g.group}</td>${Array.from({ length: t.rounds }, (_, i) => { const s = M.circuitStation(g.group, i + 1); return `<td class="st sc${s}">${s}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`}
      </div></section>
    </div>`;
    const save = (f) => { S.teacherForm = f; store.set("mmi.teacher", M.makeSessionCode(f)); renderTeacher(); };
    $("#tf").addEventListener("change", () => {
      const [h, m] = ($("#t-start").value || "00:00").split(":").map(Number);
      const mode = $("#t-mode").value;
      const f = { hh: h || 0, mm: m || 0, mode, station: $("#t-station") ? +$("#t-station").value : t.station, set: $("#t-set") ? +$("#t-set").value : t.set,
        rounds: +$("#t-rounds").value, read: +$("#t-read").value, interview: +$("#t-int").value, feedback: +$("#t-fb").value };
      if (mode !== t.mode) f.rounds = mode === "F" ? 3 : 6;
      save(f);
    });
    const soon = () => { const d = new Date(Date.now() + 60000); if (d.getSeconds() > 0 || d.getMilliseconds() > 0) d.setMinutes(d.getMinutes() + 1); return { hh: d.getHours(), mm: d.getMinutes() }; };
    $("#t-soon").onclick = () => save(Object.assign({}, S.teacherForm, soon()));
    $$("[data-preset]").forEach((b) => {
      b.onclick = () => {
        const p = C.settings.lessonPresets[+b.dataset.preset];
        save(Object.assign({}, S.teacherForm, { mode: p.mode, station: p.station, set: "ABC".indexOf(p.set), rounds: p.rounds, read: p.read, interview: p.interview, feedback: p.feedback }));
      };
    });
    $("#pj-full").onclick = () => { const p = $("#proj"); try { if (document.fullscreenElement) document.exitFullscreen(); else if (p.requestFullscreen) p.requestFullscreen().catch(() => {}); } catch (e) { /* ignored */ } keepAwake(); };
    $("#pj-snd").onclick = () => { S.sound = !S.sound; if (S.sound) beep(1, 660); const b = $("#pj-snd"); b.textContent = S.sound ? "Sound on" : "Sound off"; b.setAttribute("aria-pressed", String(S.sound)); };
    teacherTick(true);
  }
  let lastTPhase = "";
  function teacherTick(force) {
    const t = S.teacherForm; if (!t || !$("#pj-tm")) return;
    const c = M.sessionAt(t);
    const colors = { read: "var(--ph-read)", interview: "var(--ph-int)", feedback: "var(--ph-fb)", rotate: "var(--ph-rot)", before: "transparent", done: "transparent" };
    const ph = $("#pj-ph"); ph.textContent = c.label; ph.style.background = colors[c.phase];
    $("#pj-tm").textContent = c.phase === "done" ? "00:00" : fmt(c.remaining);
    $("#pj-bar").style.width = (c.phase === "before" ? 0 : Math.min(100, (c.elapsed / c.total) * 100)) + "%";
    $("#pj-round").textContent = c.phase === "done" ? "All rounds finished" : `Round ${c.round} of ${t.rounds}${t.mode === "F" ? ` · Station ${t.station} · Scenario ${letter((c.round - 1) % 3)}` : " · circuit"}`;
    const r3 = M.rolesFor(c.round, 3);
    $("#pj-roles").textContent = c.phase === "done" ? "" : `Interviewee: Seat ${M.seatFor(r3, "interviewee")} · Interviewer: Seat ${M.seatFor(r3, "interviewer")} · Observer: Seat ${M.seatFor(r3, "observer")}`;
    let now = C.settings.clockHints[c.phase] || "";
    if (c.phase === "feedback") {
      const sec = t.feedback * 60; let step = null;
      C.observer.feedbackGuide.forEach((g) => { if (c.elapsed >= Math.round(sec * g.atFraction)) step = g; });
      if (step) now = `<b>Now: ${esc(step.who)}</b> · ${esc(step.text)}`;
      else now = esc(now);
    } else now = esc(now);
    const pn = $("#pj-now"); if (pn.innerHTML !== now) pn.innerHTML = now;
    const pk = c.phase + "|" + c.round;
    if (lastTPhase && pk !== lastTPhase && !force && c.phase !== "before") phaseBeep(c.phase);
    if (c.phase === "interview" && c.remaining <= 60 && !S.warned["t" + pk]) { S.warned["t" + pk] = 1; if (!force) beep(1, 1200); }
    lastTPhase = pk;
  }

  /* ---------- deep links: #r-<report code> and #s-<session code> ---------- */
  function handleHash() {
    const h = location.hash || "";
    let m = h.match(/^#r-([0-9A-Za-z]{15})$/);
    if (m) {
      const r = M.decodeReport(m[1], PROFS.length);
      if (!r) { S.flash = U.deepLinkInvalid; S.tab = "reports"; }
      else {
        const code = M.encodeReport(r);
        if (getReports().some((x) => x.code === code)) { S.viewReport = code; S.pending = null; }
        else S.pending = code;
        S.tab = "reports";
      }
      clearHash(); return true;
    }
    m = h.match(/^#s-([0-9A-Za-z]{6,10})$/);
    if (m) {
      const cfg = M.parseSessionCode(m[1]);
      if (cfg) {
        if (S.setup) { S.setup.code = cfg.code; store.set("mmi.setup", S.setup); S.manualStation = null; S.variantOverride = null; }
        else S.prefillCode = cfg.code;
        S.tab = "station";
      }
      clearHash(); return true;
    }
    return false;
  }
  function clearHash() { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignored */ } }
  window.addEventListener("hashchange", () => { if (C && handleHash()) setTab(S.tab); });

  /* ---------- boot ---------- */
  async function boot() {
    app.innerHTML = `<section class="loading"><p class="label">Loading stations…</p></section>`;
    try {
      const res = await fetch("mmi-content.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      indexContent(await res.json());
    } catch (e) {
      app.innerHTML = `<section class="panel center loading"><h2>The station content didn't load.</h2><p class="muted">Check the Wi-Fi, then try again.</p><button class="btn primary" type="button" id="retry">Retry</button></section>`;
      $("#retry").onclick = boot;
      return;
    }
    S.setup = store.get("mmi.setup", null);
    if (S.setup && !PROF[S.setup.prof]) S.setup = null;
    handleHash();
    setTab(S.tab);
    if (S.setup) keepAwake();
    if (!window.__mmiTimer) window.__mmiTimer = setInterval(() => tick(false), 250);
  }
  try {
    if ("serviceWorker" in navigator && location.protocol === "https:" && window.top === window.self) navigator.serviceWorker.register("sw.js").catch(() => {});
  } catch (e) { /* no service worker here */ }
  boot();
})();
