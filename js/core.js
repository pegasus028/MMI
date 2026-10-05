/* MMI Practice Circuit — core logic (no DOM).
 * Session codes, synchronized clock, role rotation, report codes and scoring.
 * Works in the browser (window.MMICore) and in Node (require('./core.js')).
 * The algorithms follow SPEC.md §7, §9 and §10 exactly; see tests/run-tests.js.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MMICore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SEATS = ["A", "B", "C", "D"];
  const SETS = "ABC";
  const ROTATE_SEC = 30;
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (s) => {
    s = Math.max(0, Math.ceil(s));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  };

  /* ---------- §7.1 session code ---------- */
  function parseSessionCode(raw) {
    const s = String(raw == null ? "" : raw).toUpperCase().replace(/[^0-9A-Z]/g, "");
    const m = s.match(/^(\d{2})(\d{2})([FC])([1-6A-C])(\d*)$/);
    if (!m) return null;
    const hh = +m[1], mm = +m[2];
    if (hh > 23 || mm > 59) return null;
    const mode = m[3], p = m[4], suf = m[5];
    if (mode === "F" && !/^[1-6]$/.test(p)) return null;
    if (mode === "C" && !/^[A-C]$/.test(p)) return null;
    if (![0, 1, 4].includes(suf.length)) return null;
    const rounds = suf.length ? +suf[0] : mode === "F" ? 3 : 6;
    const read = suf.length === 4 ? +suf[1] : 1;
    const interview = suf.length === 4 ? +suf[2] : 6;
    const feedback = suf.length === 4 ? +suf[3] : 3;
    if (rounds < 1 || rounds > 6 || read < 1 || read > 3 || interview < 2 || interview > 9 || feedback < 1 || feedback > 5) return null;
    return {
      hh, mm, mode,
      station: mode === "F" ? +p : null,
      set: mode === "C" ? SETS.indexOf(p) : null,
      rounds, read, interview, feedback, code: s
    };
  }

  function makeSessionCode(c) {
    let s = pad(c.hh) + pad(c.mm) + c.mode + (c.mode === "F" ? c.station : SETS[c.set]);
    const defRounds = c.mode === "F" ? 3 : 6;
    const defTimes = c.read === 1 && c.interview === 6 && c.feedback === 3;
    if (!defTimes) s += "" + c.rounds + c.read + c.interview + c.feedback;
    else if (c.rounds !== defRounds) s += c.rounds;
    return s;
  }

  /* ---------- §7.2 clock ---------- */
  function phases(cfg) {
    return [
      ["read", "Reading time", cfg.read * 60],
      ["interview", "Interview", cfg.interview * 60],
      ["feedback", "Feedback", cfg.feedback * 60],
      ["rotate", "Rotate", ROTATE_SEC]
    ];
  }
  function roundLength(cfg) {
    return phases(cfg).reduce((a, p) => a + p[2], 0);
  }
  /** Clock state t seconds after the session start (t may be negative). */
  function sessionAtSeconds(cfg, t) {
    if (t < 0) return { phase: "before", label: "Starts in", remaining: -t, total: -t, elapsed: 0, round: 1 };
    const ph = phases(cfg);
    const len = roundLength(cfg);
    const k = Math.floor(t / len);
    if (k >= cfg.rounds) return { phase: "done", label: "Session complete", remaining: 0, total: 1, elapsed: 1, round: cfg.rounds };
    let w = t - k * len;
    for (const [key, label, dur] of ph) {
      if (w < dur) return { phase: key, label, remaining: dur - w, total: dur, elapsed: w, round: k + 1 };
      w -= dur;
    }
    return { phase: "rotate", label: "Rotate", remaining: 0, total: ROTATE_SEC, elapsed: ROTATE_SEC, round: k + 1 };
  }
  function sessionStart(cfg, now) {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), cfg.hh, cfg.mm, 0, 0).getTime();
  }
  function sessionAt(cfg, now) {
    if (now == null) now = Date.now();
    return sessionAtSeconds(cfg, (now - sessionStart(cfg, now)) / 1000);
  }

  /* Free practice: one round of read → interview → feedback, no rotate. */
  function localClockAt(t, running, timings) {
    const c = timings || { read: 1, interview: 6, feedback: 3 };
    const ph = [["read", "Reading time", c.read * 60], ["interview", "Interview", c.interview * 60], ["feedback", "Feedback", c.feedback * 60]];
    const total = ph.reduce((a, p) => a + p[2], 0);
    if (!running && t === 0) return { phase: "idle", label: "Ready", remaining: c.read * 60, total: 1, elapsed: 0 };
    if (t >= total) return { phase: "done", label: "Round finished", remaining: 0, total: 1, elapsed: 1, finished: true };
    for (const [k, l, d] of ph) {
      if (t < d) return { phase: k, label: l, remaining: d - t, total: d, elapsed: t, paused: !running };
      t -= d;
    }
    return { phase: "done", label: "Round finished", remaining: 0, total: 1, elapsed: 1, finished: true };
  }

  /* ---------- §7.3–7.4 rotation ---------- */
  const ROLE_IDS = ["interviewee", "interviewer", "observer", "observer2"];
  /** Returns {A:'interviewee', B:'interviewer', ...} for the round. */
  function rolesFor(round, size) {
    const out = {};
    const base = (round - 1) % size;
    for (let i = 0; i < size; i++) out[SEATS[(base + i) % size]] = ROLE_IDS[i];
    return out;
  }
  function seatFor(roles, roleId) {
    return Object.keys(roles).find((k) => roles[k] === roleId) || "";
  }
  function circuitStation(group, round) {
    return ((group - 1) + (round - 1)) % 6 + 1;
  }

  /* ---------- §10 report code ---------- */
  const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  function encodeReport(r) {
    const f = [[1, 2], [r.prof, 4], [r.station - 1, 3], [r.variant, 2]];
    r.ratings.forEach((v) => f.push([v, 3]));
    f.push([r.obsG, 3], [r.intG, 3], [r.flags, 6], [r.looks, 5]);
    let n = 0n;
    for (const [v, b] of f) n = (n << BigInt(b)) | BigInt(v);
    const ck = n % 31n;
    n = (n << 5n) | ck;
    n = n << 3n;
    let s = "";
    for (let i = 0; i < 15; i++) { s = B32[Number(n & 31n)] + s; n >>= 5n; }
    return s.slice(0, 5) + "-" + s.slice(5, 10) + "-" + s.slice(10);
  }
  function normalizeReportCode(code) {
    return String(code == null ? "" : code).toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  }
  function decodeReport(code, professionCount) {
    const pc = professionCount == null ? 16 : professionCount;
    const s = normalizeReportCode(code);
    if (s.length !== 15) return null;
    let n = 0n;
    for (const ch of s) {
      const i = B32.indexOf(ch);
      if (i < 0) return null;
      n = (n << 5n) | BigInt(i);
    }
    n >>= 3n;
    const ck = n & 31n;
    n >>= 5n;
    if (n % 31n !== ck) return null;
    const take = (b) => { const v = Number(n & ((1n << BigInt(b)) - 1n)); n >>= BigInt(b); return v; };
    const looks = take(5), flags = take(6), intG = take(3), obsG = take(3);
    const ratings = [];
    for (let i = 0; i < 13; i++) ratings.unshift(take(3));
    const variant = take(2), station = take(3) + 1, prof = take(4), ver = take(2);
    if (ver !== 1 || station > 6 || variant > 2 || prof >= pc || ratings.some((v) => v > 4) || obsG > 7 || intG > 7) return null;
    return { prof, station, variant, ratings, obsG, intG, flags, looks };
  }

  /* ---------- §9 scoring ---------- */
  function criteriaFor(C, station) {
    return [...C.stations[station - 1].observer.stationCriteria, ...C.observer.communicationCriteria, ...C.observer.presenceCriteria];
  }
  function bandFor(C, pct) {
    if (pct === null) return null;
    return C.settings.bands.find((b) => pct >= b.minPct) || null;
  }
  function globalLabel(C, glob) {
    if (glob === null) return null;
    return C.settings.globalScale.levels[String(Math.round(glob - 0.01))] || null;
  }
  function popcount(n) { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; }

  function scoreReport(r, C) {
    const crit = criteriaFor(C, r.station);
    const part = (a, b) => {
      const v = r.ratings.slice(a, b).filter((x) => x > 0);
      return v.length ? (v.reduce((s, x) => s + x, 0) / v.length - 1) / 3 : null;
    };
    const W = C.settings.weights;
    const content = part(0, 4), comm = part(4, 8), pres = part(8, 13);
    const parts = [[content, W.station], [comm, W.communication], [pres, W.presence]].filter((p) => p[0] !== null);
    const w = parts.reduce((s, p) => s + p[1], 0);
    const pct = parts.length ? Math.round(parts.reduce((s, p) => s + p[0] * p[1], 0) / w * 100) : null;
    const gl = [r.obsG, r.intG].filter((x) => x > 0);
    const glob = gl.length ? gl.reduce((a, b) => a + b, 0) / gl.length : null;

    const items = crit.map((c, i) => ({ c, v: r.ratings[i], i }));
    const rated = items.filter((x) => x.v > 0);
    const strengths = rated.filter((x) => x.v === 4).slice(0, 4);
    if (!strengths.length) {
      const top = [...rated].sort((a, b) => b.v - a.v || a.i - b.i)[0];
      if (top && top.v >= 3) strengths.push(top);
    }
    const priorities = rated.filter((x) => x.v <= 2).sort((a, b) => a.v - b.v || a.i - b.i);
    if (priorities.length < 2) {
      rated.filter((x) => x.v === 3).sort((a, b) => a.i - b.i).slice(0, 2 - priorities.length).forEach((x) => priorities.push(x));
    }
    const flagList = C.observer.redFlags.filter((f) => r.flags & (1 << f.bit));
    const actions = [];
    flagList.forEach((f) => actions.push(f.followUpAction));
    priorities.slice(0, 3).forEach((x) => actions.push(x.c.feedback.followUpAction));
    actions.push(C.observer.redoActionTemplate
      .replace("{station}", r.station)
      .replace("{nextVariantLetter}", SETS[(r.variant + 1) % 3]));

    // Calibration notes (v1.1). They never change pct or glob.
    const K = C.settings.calibration || {};
    let raterGap = null;
    if (r.obsG > 0 && r.intG > 0 && Math.abs(r.obsG - r.intG) >= (K.raterGap || 3)) raterGap = Math.abs(r.obsG - r.intG);
    const mismatch = pct !== null && glob !== null &&
      ((pct >= (K.checklistHighPct ?? 67) && glob <= (K.globalLowMax ?? 3)) ||
       (pct < (K.checklistLowPct ?? 33) && glob >= (K.globalHighMin ?? 5)));

    return {
      content, comm, pres, pct, glob,
      band: bandFor(C, pct),
      globalLabel: globalLabel(C, glob),
      items, strengths, priorities: priorities.slice(0, 4),
      flagList, actions: actions.slice(0, 5),
      looksCount: popcount(r.looks & 31),
      raterGap, mismatch
    };
  }

  /** v1.1 minimum before a report can be created. */
  function meetsMinimum(ratings, min) {
    const m = min || { station: 0, total: 5 };
    const st = ratings.slice(0, 4).filter((x) => x > 0).length;
    const total = ratings.filter((x) => x > 0).length;
    return st >= m.station && total >= m.total;
  }

  /** v1.1 self-rating comparison: 'higher' | 'lower' | 'close' | null */
  function selfVerdict(self, glob, gap) {
    if (!self || glob === null || glob === undefined) return null;
    const d = self - glob;
    if (Math.abs(d) < (gap || 1.5)) return "close";
    return d > 0 ? "higher" : "lower";
  }

  /** Timing lines: time = round(interviewMin*60*atFraction/30)*30 */
  function cueTime(interviewMin, atFraction) {
    return Math.round(interviewMin * 60 * atFraction / 30) * 30;
  }

  /** Index of the timing cue that applies `elapsed` seconds into the phase. */
  function activeCue(guide, phaseSec, elapsed) {
    let idx = -1;
    guide.forEach((g, i) => { if (elapsed >= Math.round(phaseSec * g.atFraction / 30) * 30) idx = i; });
    return idx;
  }

  return {
    SEATS, SETS, ROTATE_SEC, ROLE_IDS, B32, pad, fmt,
    parseSessionCode, makeSessionCode, phases, roundLength, sessionAtSeconds, sessionAt, sessionStart, localClockAt,
    rolesFor, seatFor, circuitStation,
    encodeReport, decodeReport, normalizeReportCode,
    criteriaFor, bandFor, globalLabel, scoreReport, meetsMinimum, selfVerdict, cueTime, activeCue, popcount
  };
});
