"""Three-phone B2 student walkthrough (tools/walkthrough/three-phone-walk.py).
Run from the repo root with a local server: python3 -m http.server 8765 &  then  python3 tools/walkthrough/three-phone-walk.py
No live data is touched: the app has no backend and each phone is a fresh browser context.

Three-phone B2 student walkthrough of the MMI Practice Circuit, every class profession x every station.
Phones: Ploy (seat A, generous rater), Nam (seat B, strict rater), Fern (seat C, middle).
Focus mode, 3 rounds, timings 1/6/3, clock fast-forwarded with Playwright's clock API.
"""
import json, sys, datetime, random, glob, collections, time
from playwright.sync_api import sync_playwright
BASE = "http://localhost:8765/index.html"
import os
C = json.load(open(os.path.join(os.path.dirname(__file__), "..", "..", "mmi-content.json")))
CHROME = os.environ.get("CHROME") or (glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome") + [None])[0]
random.seed(7)
PERSONAS = {"A": ("Ploy", [2,3,3,4,3,3,2,3]), "B": ("Nam", [1,2,2,3,2,2,3,2]), "C": ("Fern", [2,2,3,3,3,2,3,3])}
findings = []        # (severity, where, text)
seen = set()
def F(sev, where, text):
    k = (sev, text[:80])
    if k in seen: return
    seen.add(k); findings.append((sev, where, text))
errors = []
stats = collections.Counter()
timings = collections.defaultdict(list)

def mkpage(ctx, tag):
    p = ctx.new_page()
    p.on("pageerror", lambda e: errors.append(f"{tag}: pageerror {e}"))
    p.on("console", lambda m: errors.append(f"{tag}: {m.text}") if m.type == "error" and "fonts" not in m.text and "404" not in m.text else None)
    return p

def chk(p, sel):
    r = p.evaluate("(s)=>{const e=document.querySelector(s);if(!e)return 'missing';e.click();return e.checked}", sel)
    if r == "missing": raise RuntimeError("missing " + sel)

def overflow(p):
    return p.evaluate("Math.max(0, document.documentElement.scrollWidth - innerWidth)")

def setup(p, name, prof, group, seat, code):
    p.set_default_timeout(20000)
    p.goto(BASE); p.wait_for_selector("#boot", state="detached", timeout=15000)
    if p.query_selector("#edit"): p.click("#edit")
    p.wait_for_selector("#setup")
    p.fill("#su-name", name); p.select_option("#su-group", str(group))
    if p.select_option("#su-prof", prof) == []: F("P2", "setup", f"profession {prof} not selectable for group {group}")
    p.select_option("#su-size", "3"); p.select_option("#su-seat", seat); p.fill("#su-code", code)
    p.click("#setup button[type=submit]")
    err = p.text_content("#su-err") if p.query_selector("#su-err") else ""
    if err: F("P1", "setup", f"session code {code} rejected: {err}")
    p.wait_for_selector("#rolebody")

def tick(pages, ms):
    for p in pages: p.clock.fast_forward(ms)
    for p in pages: p.wait_for_timeout(350)

def role_of(p): return p.text_content(".role .who").strip()
def phase_of(p): return p.text_content("#ck-ph").strip()

def rate_observer(p, persona, during):
    """during=True: station criteria + key points + flags. else: comm, presence, globals, comments."""
    name, dist = persona
    rng = range(0, 4) if during else range(4, 13)
    for i in rng:
        v = random.choice(dist)
        if random.random() < 0.08: v = 0  # n/o sometimes
        chk(p, f'#c{i}-{v}')
    if during:
        for i in range(5):
            if random.random() < 0.6: chk(p, f'[data-look="{i}"]')
        if random.random() < 0.15: chk(p, '[data-flag="3"]')
    else:
        chk(p, f'#og-{random.choice([3,4,5])}')
        chk(p, f'#intg-{random.choice([3,4,5,6])}')
        p.fill("#ob-strength", "You answered the question first and gave one clear example.")
        p.fill("#ob-work", "Try to name the people affected before you decide.")

def run_session(b, prof, st, cfgcode, hh, mm):
    tag = f"{prof}-s{st}"
    ctxs = [b.new_context(viewport={"width": 390, "height": 844}) for _ in range(3)]
    pages = []
    start = datetime.datetime(2026, 11, 3, hh, mm, 0) - datetime.timedelta(seconds=90)
    for ctx, seat in zip(ctxs, "ABC"):
        ctx.clock.install(time=start)
        p = mkpage(ctx, f"{tag}-{seat}")
        setup(p, PERSONAS[seat][0], prof, 1, seat, cfgcode)
        pages.append(p)
    # before phase
    for p, seat in zip(pages, "ABC"):
        ph = phase_of(p)
        if ph.lower().startswith("start") is False and "wait" not in ph.lower() and "before" not in ph.lower() and "starts" not in ph.lower():
            stats["before_label:" + ph] += 1
        if overflow(p): F("P2", tag, f"overflow before start on seat {seat}: {overflow(p)}px")
    codes = {}
    for rnd in (1, 2, 3):
        # --- READ ---
        tick(pages, 90_000 if rnd == 1 else 30_000 + 1000)
        roles = {seat: role_of(p) for seat, p in zip("ABC", pages)}
        inv = {v: k for k, v in roles.items()}
        if set(inv) != {"Interviewee", "Interviewer", "Observer"}:
            F("P1", tag, f"round {rnd} roles {roles}"); break
        pe, pi, po = pages["ABC".index(inv["Interviewee"])], pages["ABC".index(inv["Interviewer"])], pages["ABC".index(inv["Observer"])]
        for p in pages:
            if "read" not in phase_of(p).lower(): F("P1", tag, f"r{rnd} phase expected reading, got {phase_of(p)}")
        door = pe.query_selector("#rolebody .card-door")
        if not door: F("P1", tag, f"r{rnd} interviewee has no door card in reading phase")
        else:
            words = len(door.text_content().split())
            timings[f"door_words_s{st}"].append(words)
            if st == 5 and pe.query_selector("#rolebody table"):
                tw = pe.evaluate("()=>{const t=document.querySelector('#rolebody .tbl-wrap');return t?[t.scrollWidth,t.clientWidth]:null}")
                if tw and tw[0] > tw[1] + 2: stats["s5_table_scrolls"] += 1
        if not pi.query_selector("#rolebody .say"): F("P1", tag, f"r{rnd} interviewer has no opening question")
        if st == 4 and not pi.query_selector("#rolebody .actor"): F("P1", tag, f"r{rnd} S4 interviewer has no actor card")
        if not po.query_selector("#obs"): F("P1", tag, f"r{rnd} observer has no form")
        # scenario variant check
        lab = pe.text_content("#rolebody .card-door .label")
        if f"Scenario {'ABC'[rnd-1]}" not in lab: F("P1", tag, f"r{rnd} interviewee sees '{lab}' not Scenario {'ABC'[rnd-1]}")
        hint = pe.text_content("#role-hint")
        if not hint.strip(): F("P3", tag, f"r{rnd} empty role hint in reading phase for interviewee")
        # --- INTERVIEW ---
        tick(pages, 60_000)
        for p in pages:
            if "interview" not in phase_of(p).lower(): F("P1", tag, f"r{rnd} phase expected interview, got {phase_of(p)}")
        if "Phone down" not in pe.text_content("#rolebody"): F("P2", tag, f"r{rnd} interviewee interview view lacks 'Phone down'")
        # interviewer ticks follow-ups across time, global rating
        for i in range(4):
            tick(pages, 70_000)
            chk(pi, f'[data-ask="{i}"]')
        now = pi.evaluate("()=>{const n=document.querySelector('#cues .now');return n?n.textContent:''}")
        if not now: F("P2", tag, f"r{rnd} interviewer timing cue not highlighted at ~4:40")
        chk(pi, f"#ig-{random.choice([3,4,5])}")
        rate_observer(po, PERSONAS[inv['Observer']], True)
        prog = po.text_content("#obs-prog")
        tick(pages, 80_000)  # -> feedback
        # --- FEEDBACK ---
        for p in pages:
            if "feedback" not in phase_of(p).lower(): F("P1", tag, f"r{rnd} phase expected feedback, got {phase_of(p)}")
        # ticked follow-ups must survive phase change (no re-render)
        if not pi.is_checked('[data-ask="0"]'): F("P1", tag, f"r{rnd} interviewer ticks lost at phase change")
        if po.query_selector("#c0-0") is None: F("P1", tag, f"r{rnd} observer form lost at feedback")
        if not any(po.is_checked(f"#c0-{v}") for v in range(1, 5)) and not po.is_checked("#c0-0"): F("P1", tag, f"r{rnd} observer ratings lost at phase change")
        rate_observer(po, PERSONAS[inv['Observer']], False)
        po.click("#obs button[type=submit]")
        msg = po.text_content("#obs-msg") if po.query_selector("#obs-msg") else ""
        code_el = po.query_selector("#code")
        if not code_el:
            F("P1", tag, f"r{rnd} observer could not create report: {msg} / {prog}"); continue
        code = code_el.text_content().strip(); codes[rnd] = code
        if not po.query_selector(".qrbox svg"): F("P1", tag, f"r{rnd} no QR drawn")
        pct = po.text_content(".rep .stat b")
        stats["reports"] += 1
        if overflow(po): F("P2", tag, f"r{rnd} observer report overflow {overflow(po)}px")
        # interviewee: self-rate + type code during feedback
        tick(pages, 60_000)
        if not pe.query_selector("#imp-code"): F("P1", tag, f"r{rnd} interviewee has no code field in feedback"); continue
        chk(pe, f"#self-{random.choice([3,4,5])}")
        # B2 student types code from the observer's screen, sometimes lowercase/with spaces
        typed = code.lower().replace("-", " ") if rnd == 2 else code
        pe.fill("#imp-code", typed); pe.click("#imp button[type=submit]")
        m = pe.text_content("#imp-msg")
        if "Saved" not in m: F("P1", tag, f"r{rnd} interviewee import failed for '{typed}': {m}")
        # rotate: code field must survive
        tick(pages, 120_000)  # into rotate
        for p in pages:
            if "rotat" not in phase_of(p).lower() and rnd < 3: F("P1", tag, f"r{rnd} expected rotate, got {phase_of(p)}")
        if rnd < 3 and not pe.query_selector("#imp-code"): F("P2", tag, f"r{rnd} interviewee view re-rendered during rotate")
    # --- DONE ---
    tick(pages, 35_000)
    for p in pages:
        if "done" not in phase_of(p).lower() and "finish" not in phase_of(p).lower() and phase_of(p) != "00:00":
            stats["done_label:" + phase_of(p)] += 1
    # My reports on each phone
    for p, seat in zip(pages, "ABC"):
        p.click("#tab-reports"); p.wait_for_selector("#imp2")
        n = p.evaluate("()=>document.querySelectorAll('[data-open]').length")
        g = p.evaluate("()=>document.querySelectorAll('[data-showg]').length")
        if n != 1: F("P1", tag, f"seat {seat} has {n} received reports (expected 1)")
        if g != 1: F("P1", tag, f"seat {seat} has {g} given reports (expected 1)")
        if overflow(p): F("P2", tag, f"My reports overflow {overflow(p)}px")
        p.click("[data-open]"); p.wait_for_selector(".rep")
        if not p.query_selector(".rep .calib") and random.random() < 0: pass
        # progress table shows this station
        txt = p.text_content("#app")
        if "Follow-up actions" not in txt: F("P2", tag, f"report lacks follow-up actions")
    # QR deep link: phone A opens phone C's code via #r-
    code = codes.get(1)
    if code:
        p = pages[0]
        p.goto(BASE + "#r-" + code.replace("-", "")); p.wait_for_selector("#boot", state="detached")
        p.wait_for_timeout(300)
        if p.query_selector("#pend"):
            stats["deeplink_pending"] += 1
        elif p.query_selector(".rep"):
            stats["deeplink_direct"] += 1
        else: F("P1", tag, "deep link #r- did not open a report")
    for ctx in ctxs: ctx.close()

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME) if CHROME else pw.chromium.launch()
    t0 = time.time()
    profs = C["classList"]
    hh, mm = 9, 0
    for prof in profs:
        for st in range(1, 7):
            code = f"{hh:02d}{mm:02d}F{st}"
            try: run_session(b, prof, st, code, hh, mm)
            except Exception as e: F("P0", f"{prof}-s{st}", f"bot crashed: {type(e).__name__}: {str(e)[:300]}")
            print(prof, st, round(time.time()-t0), flush=True)
            mm += 1
            if mm == 60: hh, mm = hh + 1, 0
        print(prof, "done", round(time.time() - t0), "s", flush=True)
    b.close()
print(json.dumps({"stats": stats, "door_words": {k: [min(v), round(sum(v)/len(v)), max(v)] for k, v in timings.items()}}, indent=1))
print("FINDINGS", len(findings))
for f in findings: print(" ", *f)
print("ERRORS", len(errors)); [print(" ", e) for e in errors[:20]]
