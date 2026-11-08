#!/usr/bin/env python3
"""Render the built artifact in headless Chrome and report layout problems.

Usage:
    check_render.py DIR/artifact.html [--finding E1]

Checks, at desktop width (1400 px):
  - JavaScript errors while rendering
  - message labels that run into the finding badge column on the right of a diagram
  - lifeline header lines wider than their box
and at phone width (390 px):
  - horizontal scroll of the page outside the diagram's own scroll box

Saves screenshots next to the artifact: shot-desktop.png, shot-finding.png (filtered by the
first finding, or --finding) and shot-mobile.png. Exit status 1 when a problem is found.
Set CHROME_PATH when Chrome is not in its default macOS location or on PATH.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PRE = "<script>window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(String(e.message))});</script>"
CHECK = r"""<script>
(function(){
 function run(){
  var out={errors:window.__errs||[],labels:[],headers:[],page:{scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth}};
  document.querySelectorAll('svg.seq').forEach(function(svg){
   var vb=svg.viewBox.baseVal,limit=vb.width-90;
   svg.querySelectorAll('text.lbl').forEach(function(t){var b=t.getBBox();
    if(b.x+b.width>limit)out.labels.push({diagram:svg.id,step:+t.getAttribute('data-n'),text:t.textContent,right:Math.round(b.x+b.width),limit:Math.round(limit)})});
   svg.querySelectorAll('g.ll').forEach(function(g){var r=g.querySelector('rect.hd').getBBox();
    g.querySelectorAll('text.hdt,text.hds').forEach(function(t){var b=t.getBBox();
     if(b.width>r.width-6)out.headers.push({diagram:svg.id,lifeline:g.getAttribute('data-id'),text:t.textContent,width:Math.round(b.width),max:Math.round(r.width-6)})})});
  });
  var pre=document.createElement('pre');pre.id='render-check';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
 }
 if(document.readyState==='complete')setTimeout(run,50);else window.addEventListener('load',function(){setTimeout(run,50)});
})();
</script>"""


def find_chrome():
    cands = [os.environ.get("CHROME_PATH"),
             "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
             "/Applications/Chromium.app/Contents/MacOS/Chromium",
             shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser")]
    for c in cands:
        if c and Path(c).exists():
            return c
    sys.exit("Chrome not found. Set CHROME_PATH.")


def chrome(binary, args, profile):
    base = [binary, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
            "--no-default-browser-check", f"--user-data-dir={profile}", "--virtual-time-budget=4000"]
    return subprocess.run(base + args, capture_output=True, text=True, timeout=90)


def dump(binary, url, width, profile):
    r = chrome(binary, [f"--window-size={width},1000", "--dump-dom", url], profile)
    m = re.search(r'<pre id="render-check">(.*?)</pre>', r.stdout, re.S)
    if not m:
        sys.exit(f"render check did not run at width {width}. Chrome stderr:\n{r.stderr[-2000:]}")
    import html as h
    return json.loads(h.unescape(m.group(1)))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("artifact")
    ap.add_argument("--finding", help="finding id for the filtered screenshot (default: first finding)")
    args = ap.parse_args()

    src = Path(args.artifact).resolve()
    page = src.read_text(encoding="utf-8")
    binary = find_chrome()
    with tempfile.TemporaryDirectory() as tmp:
        probe = Path(tmp) / "probe.html"
        probe.write_text(page.replace("<head>", "<head>\n" + PRE, 1).replace("</body>", CHECK + "\n</body>", 1), encoding="utf-8")
        profile = Path(tmp) / "profile"
        desk = dump(binary, probe.as_uri(), 1400, profile)
        mob = dump(binary, probe.as_uri(), 390, profile)

        m = re.search(r'"findings":\[\{"id":"([^"]+)"', page)
        fid = args.finding or (m.group(1) if m else None)
        chrome(binary, ["--window-size=1400,2600", f"--screenshot={src.parent / 'shot-desktop.png'}", src.as_uri()], profile)
        if fid:
            chrome(binary, ["--window-size=1400,1800", f"--screenshot={src.parent / 'shot-finding.png'}", src.as_uri() + f"#f={fid}"], profile)
        chrome(binary, ["--window-size=390,2400", f"--screenshot={src.parent / 'shot-mobile.png'}", src.as_uri()], profile)

    problems = 0
    for err in desk["errors"]:
        problems += 1
        print(f"JS error: {err}")
    for l in desk["labels"]:
        problems += 1
        print(f"label overflow  {l['diagram']} step {l['step']}: ends at {l['right']}, limit {l['limit']}  \"{l['text']}\"")
    for hd in desk["headers"]:
        problems += 1
        print(f"header overflow {hd['diagram']} lifeline {hd['lifeline']}: \"{hd['text']}\" is {hd['width']}px, box allows {hd['max']}px")
    if mob["page"]["scrollWidth"] > mob["page"]["innerWidth"] + 1:
        problems += 1
        print(f"mobile: page scrolls horizontally ({mob['page']['scrollWidth']}px in a {mob['page']['innerWidth']}px viewport)")
    print(f"screenshots: {src.parent}/shot-desktop.png" + (f", shot-finding.png (#f={fid})" if fid else "") + ", shot-mobile.png")
    print("OK, no layout problems" if not problems else f"{problems} problem(s)")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
