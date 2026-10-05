"""Browser checks for SPEC §15.5 (run with a local server on :8765)."""
import json, sys, datetime
from playwright.sync_api import sync_playwright
BASE = "http://localhost:8765/index.html"
C = json.load(open("mmi-content.json"))
errors = []
results = {}

def watch(page, tag):
    page.on("pageerror", lambda e: errors.append(f"{tag}: pageerror {e}"))
    page.on("console", lambda m: errors.append(f"{tag}: console {m.text}") if m.type == "error" and "fonts" not in m.text else None)

with sync_playwright() as p:
    b = p.chromium.launch()

    # 1. All 288 scenarios × 3 roles in free practice
    ctx = b.new_context(viewport={"width": 390, "height": 800})
    page = ctx.new_page(); watch(page, "scenarios")
    page.goto(BASE); page.wait_for_selector("#setup")
    bad = []
    count = 0
    for key in C["professionOrder"]:
        page.evaluate("k=>localStorage.setItem('mmi.setup',JSON.stringify({name:'T',prof:k,group:1,size:3,seat:'A',code:''}))", key)
        page.goto(BASE); page.wait_for_selector("#rolebody")
        prof = next(x for x in C["professions"] if x["key"] == key)
        for st in range(1, 7):
            page.click(f'.stationpick button[data-st="{st}"]')
            for v in range(3):
                page.click(f'[data-var="{v}"]')
                for rnd, role in [(1, "interviewee"), (3, "interviewer"), (2, "observer")]:
                    page.select_option("#man-round", str(rnd))
                    if role == "interviewer":
                        cp = page.query_selector("#cand-prof")
                        if cp and cp.input_value() != key: page.select_option("#cand-prof", key)
                    info = page.evaluate("""()=>({who:document.querySelector('.role .who').textContent,
                      actor:!!document.querySelector('#rolebody .actor'), table:!!document.querySelector('#rolebody .card-door table'),
                      len:document.querySelector('#rolebody').textContent.length, st:document.querySelector('.door .num b').textContent})""")
                    sc = next(s for s in prof["scenarios"] if s["station"] == st and s["variant"] == "ABC"[v])
                    count += 1
                    if info["len"] < 200 or info["st"] != str(st): bad.append((key, st, v, role, "empty"))
                    if role == "interviewer" and (st == 4) != info["actor"]: bad.append((key, st, v, role, "actor"))
                    if role == "interviewee" and st == 5 and ("data" in sc["interviewee"]) != info["table"]: bad.append((key, st, v, role, "table"))
    results["scenario renders"] = count
    results["scenario problems"] = bad[:10]

    # 2. Session mode: hidden before start, phase sync, observer state kept across phase change
    ctx2 = b.new_context(viewport={"width": 390, "height": 800})
    pages = []
    t0 = datetime.datetime(2026, 10, 6, 9, 59, 50)
    ctx2.clock.install(time=t0)
    for seat in "ABC":
        pg = ctx2.new_page(); watch(pg, "session " + seat)
        pg.goto(BASE); pg.wait_for_selector("#setup, #rolebody")
        pg.evaluate("s=>localStorage.setItem('mmi.setup',JSON.stringify({name:s,prof:'medicine',group:3,size:3,seat:s,code:'1000F2'}))", seat)
        pg.reload(); pg.wait_for_selector("#rolebody")
        pages.append(pg)
    A, B_, Cc = pages
    results["before: roles"] = [pg.text_content(".role .who") for pg in pages]
    results["before: prompt hidden"] = A.query_selector(".card-door") is None
    ctx2.clock.run_for(15000)
    results["read: phases"] = [pg.text_content("#ck-ph") for pg in pages]
    results["read: interviewee sees door"] = A.query_selector(".card-door .stem") is not None
    # observer (C) rates during read, scrolls, then interview starts
    Cc.click('label[for="c0-3"]'); Cc.click('label[for="c1-2"]'); Cc.click('label[for="c2-4"]')
    Cc.evaluate("window.scrollTo(0,600)"); y0 = Cc.evaluate("Math.round(document.querySelector('#obs').getBoundingClientRect().top)")
    ctx2.clock.run_for(60000)
    results["interview: phases"] = [pg.text_content("#ck-ph") for pg in pages]
    results["observer kept ratings"] = Cc.evaluate("[...document.querySelectorAll('input[data-crit]:checked')].map(i=>i.id)")
    results["observer kept scroll"] = Cc.evaluate("Math.round(document.querySelector('#obs').getBoundingClientRect().top)") == y0
    results["interviewee phone-down"] = "Phone down" in A.text_content("#rolebody")
    # interviewer cue highlight at 2:10
    ctx2.clock.run_for(130000)
    results["interviewer active cue"] = B_.evaluate("(document.querySelector('#cues span.now')||{}).textContent")
    # finish ratings & create report in feedback phase
    for i, v in [(3, 3), (4, 3), (5, 2), (6, 3), (7, 4), (8, 3), (9, 2)]:
        Cc.click(f'label[for="c{i}-{v}"]')
    Cc.click('label[for="og-5"]'); Cc.click('label[for="intg-4"]')
    Cc.click('input[data-look="0"]'); Cc.click('input[data-flag="3"]')
    ctx2.clock.run_for(240000)
    results["feedback: phases"] = [pg.text_content("#ck-ph") for pg in pages]
    Cc.click("#obs button[type=submit]")
    code = Cc.text_content("#code").strip()
    results["report code"] = code
    results["qr drawn"] = Cc.query_selector(".qrbox svg") is not None
    obs_pct = Cc.text_content(".rep .stat b")
    # interviewee imports in feedback screen with self rating
    A.click('label[for="self-4"]')
    A.fill("#imp-code", code.lower().replace("0", "o"))
    A.click("#imp button[type=submit]")
    results["import msg"] = A.text_content("#imp-msg")
    A.click("#go-rep")
    results["pct match"] = (A.text_content(".rep .stat b"), obs_pct)
    results["calibration shown"] = A.query_selector(".calib") is not None and "rated yourself" in A.text_content(".calib")
    results["concern shown"] = A.query_selector(".alert") is not None

    # 3. Deep link import on a fresh phone
    ctx3 = b.new_context(viewport={"width": 360, "height": 740}, color_scheme="dark")
    pg = ctx3.new_page(); watch(pg, "deeplink")
    pg.goto(BASE + "#r-" + code.replace("-", "")); pg.wait_for_selector("#pend")
    pg.click('label[for="pself-6"]'); pg.click("#pend button[type=submit]")
    results["deeplink pct"] = pg.text_content(".rep .stat b")
    results["dark 360 overflow (report)"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
    pg.goto(BASE + "#s-0945F2"); pg.wait_for_selector("#setup")
    results["session deeplink prefill"] = pg.input_value("#su-code")

    # 4. widths and themes on every tab
    over = {}
    for scheme in ["light", "dark"]:
        cx = b.new_context(viewport={"width": 360, "height": 740}, color_scheme=scheme)
        pg = cx.new_page(); watch(pg, "width " + scheme)
        pg.goto(BASE); pg.wait_for_selector("#setup")
        over[scheme + " setup"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        pg.click("#setup button[type=submit]"); pg.wait_for_selector("#rolebody")
        for st in [4, 5]:
            pg.click(f'.stationpick button[data-st="{st}"]')
            for rnd in ["1", "2", "3"]:
                pg.select_option("#man-round", rnd)
                over[f"{scheme} s{st} r{rnd}"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        for tab in ["toolkit", "reports", "teacher"]:
            pg.click(f'.tab[data-tab="{tab}"]')
            over[f"{scheme} {tab}"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
            if tab == "teacher":
                pg.click('[data-preset="6"]')
                results["mock preset code"] = pg.text_content(".proj .code")
                over[f"{scheme} teacher circuit"] = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        if scheme == "dark":
            pg.click('.tab[data-tab="station"]'); pg.click('.stationpick button[data-st="1"]'); pg.select_option("#man-round", "2")
            pg.screenshot(path="/tmp/claude-0/-home-claude/8987c863-3495-582c-90db-a568711dbee6/scratchpad/observer-dark.png", full_page=True)
        cx.close()
    results["overflow px (all should be 0)"] = {k: v for k, v in over.items() if v}

    # 5. keyboard: rate with arrow keys
    cx = b.new_context(viewport={"width": 1280, "height": 900})
    pg = cx.new_page(); watch(pg, "keyboard")
    pg.goto(BASE); pg.wait_for_selector("#setup"); pg.click("#setup button[type=submit]")
    pg.select_option("#man-round", "2")
    pg.focus("#c0-0"); pg.keyboard.press("ArrowRight"); pg.keyboard.press("ArrowRight")
    results["keyboard rating"] = pg.evaluate("document.querySelector('input[name=c0]:checked').value")
    pg.screenshot(path="/tmp/claude-0/-home-claude/8987c863-3495-582c-90db-a568711dbee6/scratchpad/observer-desktop.png", full_page=False)
    pg.click('.tab[data-tab="teacher"]')
    pg.screenshot(path="/tmp/claude-0/-home-claude/8987c863-3495-582c-90db-a568711dbee6/scratchpad/teacher.png", full_page=False)

    # 6. storage blocked
    cx = b.new_context(viewport={"width": 390, "height": 800})
    cx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
    pg = cx.new_page(); watch(pg, "nostorage")
    pg.goto(BASE); pg.wait_for_selector("#setup"); pg.click("#setup button[type=submit]"); pg.wait_for_selector("#rolebody")
    pg.click('.tab[data-tab="reports"]'); pg.fill("#imp2-code", code); pg.click("#imp2 button[type=submit]")
    results["no-storage import works"] = pg.query_selector(".rep") is not None

    # 7. content load failure shows Retry
    cx = b.new_context()
    pg = cx.new_page()
    pg.route("**/mmi-content.json", lambda r: r.abort())
    pg.goto(BASE); pg.wait_for_selector("#retry")
    results["load failure retry"] = True
    b.close()

print(json.dumps(results, indent=1, ensure_ascii=False))
print("ERRORS:", errors[:20], len(errors))
