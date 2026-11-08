#!/usr/bin/env python3
"""Build the PR flow review artifact from a data file.

Usage:
    build_artifact.py DATA.json --out-dir DIR [--chunk 8000] [--split-sections]

Writes:
    DIR/artifact.html          full page, for local preview and check_render.py
    DIR/publish/static.html    page without scripts, with <!--PRFR-..--> markers
    DIR/publish/patch-NN.html  one file per marker, in publish order
    DIR/publish/manifest.json  title, description, publish target, sizes and the marker of each patch

The data format is described in references/data-schema.md, the configuration in
references/configuration.md. Exits with status 1 and a list of problems when the data does not
validate or the page links to a host the configured Artifact Manager does not allow.
"""
import argparse
import html
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ASSETS = Path(__file__).resolve().parent.parent / "assets"
SEVERITIES = ("alta", "media", "baja", "nit", "conocido", "ok")
STATES = ("new", "mod", "old", "ext")
STEP_STATES = ("new", "mod", "old")

UI = {
    "es": {
        "kind": "revisión",
        "branch": "Rama", "commit": "Commit", "author": "Autor", "state": "Estado", "ci": "CI", "snapshot": "Foto del",
        "nav_flow": "Flujo y componentes", "nav_components": "Componentes tocados", "nav_review": "Revisión",
        "flow_title_one": "Flujo de la petición y componentes implicados",
        "flow_title_many": "Flujos y componentes implicados",
        "flow_help": "El color de cada cabecera indica si el componente es nuevo, modificado, existente o externo. "
                     "El número de cada paso indica si el paso es nuevo, ha cambiado o ya existía. "
                     "Pulsa un hallazgo para resaltar sus componentes y pasos, o pulsa un paso para ver su detalle.",
        "lg_new": "Nuevo en la PR", "lg_mod": "Modificado", "lg_old": "Existente, reutilizado", "lg_ext": "Externo",
        "components_title": "Componentes tocados",
        "components_sub": "Agrupados por flujo y capa. Las etiquetas remiten a la sección de revisión.",
        "review_title": "Revisión de la PR",
        "checked_title": "Comprobado sin hallazgos", "outside_title": "Fuera del diff",
        "see": "Ver en el diagrama", "thread": "Ver hilo",
        "dt_state": "Estado", "dt_where": "Dónde", "dt_what": "Qué pasa", "dt_impact": "Impacto",
        "dt_fix": "Propuesta", "dt_components": "Componentes", "steps_word": "pasos",
        "step_detail": "Detalle del paso", "step_hint": "Pulsa cualquier paso del diagrama.",
        "aria": "Diagrama de secuencia",
        "sev": {"alta": "Alta", "media": "Media", "baja": "Baja", "nit": "Nit", "conocido": "Conocido", "ok": "Resuelto"},
        "js": {"no_filter": "Sin filtro", "step": "Paso", "related": "Relacionado con:", "components": "Componentes",
               "steps": "Pasos", "no_anchor": "Sin anclaje en el diagrama"},
    },
    "en": {
        "kind": "review",
        "branch": "Branch", "commit": "Commit", "author": "Author", "state": "State", "ci": "CI", "snapshot": "Snapshot of",
        "nav_flow": "Flow and components", "nav_components": "Touched components", "nav_review": "Review",
        "flow_title_one": "Request flow and components involved",
        "flow_title_many": "Flows and components involved",
        "flow_help": "Each header colour tells whether the component is new, modified, existing or external. "
                     "Each step number tells whether the step is new, changed or already existed. "
                     "Click a finding to highlight its components and steps, or click a step to see its detail.",
        "lg_new": "New in the PR", "lg_mod": "Modified", "lg_old": "Existing, reused", "lg_ext": "External",
        "components_title": "Touched components",
        "components_sub": "Grouped by flow and layer. The tags point to the review section.",
        "review_title": "PR review",
        "checked_title": "Checked, no findings", "outside_title": "Outside the diff",
        "see": "Show in the diagram", "thread": "Open thread",
        "dt_state": "State", "dt_where": "Where", "dt_what": "What happens", "dt_impact": "Impact",
        "dt_fix": "Proposal", "dt_components": "Components", "steps_word": "steps",
        "step_detail": "Step detail", "step_hint": "Click any step in the diagram.",
        "aria": "Sequence diagram",
        "sev": {"alta": "High", "media": "Medium", "baja": "Low", "nit": "Nit", "conocido": "Known", "ok": "Resolved"},
        "js": {"no_filter": "No filter", "step": "Step", "related": "Related to:", "components": "Components",
               "steps": "Steps", "no_anchor": "Not anchored in the diagram"},
    },
}

e = html.escape


def split_name(name, width=15, max_lines=3):
    tokens = re.findall(r"[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])|[^A-Za-z0-9]+", name) or [name]
    lines, line = [], ""
    for tok in tokens:
        if line and len(line) + len(tok) > width:
            lines.append(line)
            line = tok.lstrip()
        else:
            line += tok
    if line:
        lines.append(line)
    if len(lines) > max_lines:
        lines = lines[: max_lines - 1] + ["".join(lines[max_lines - 1:])]
    return [s.strip() for s in lines if s.strip()]


def validate_and_resolve(d):
    errs = []
    lang = d.get("lang", "es")
    if lang not in UI:
        errs.append(f"lang must be one of {list(UI)}")
    for key in ("title", "headline", "pr", "diagrams"):
        if key not in d:
            errs.append(f"missing top-level key '{key}'")
    if errs:
        return errs
    for key in ("number", "url"):
        if key not in d["pr"]:
            errs.append(f"pr.{key} is required")

    diagrams = d["diagrams"]
    if not diagrams:
        errs.append("diagrams is empty")
    dg_ids = [dg.get("id") for dg in diagrams]
    if len(set(dg_ids)) != len(dg_ids) or None in dg_ids:
        errs.append("every diagram needs a unique id")
    step_index = {}
    lifeline_index = {}
    for dg in diagrams:
        did = dg.get("id")
        lls = dg.get("lifelines", [])
        ids = [l.get("id") for l in lls]
        if len(set(ids)) != len(ids) or None in ids:
            errs.append(f"diagram {did}: lifeline ids must be unique and present")
        lifeline_index[did] = set(ids)
        for l in lls:
            if l.get("st") not in STATES:
                errs.append(f"diagram {did}: lifeline {l.get('id')} st must be one of {STATES}")
            if "name" not in l:
                errs.append(f"diagram {did}: lifeline {l.get('id')} needs a name")
            l.setdefault("lines", split_name(l.get("name", l.get("id", "?"))))
            l.setdefault("sub", "")
        n = 0
        steps = {}
        for i, m in enumerate(dg.get("messages", [])):
            if "section" in m:
                if m.get("box") and m["box"] not in lifeline_index[did]:
                    errs.append(f"diagram {did}: section '{m['section']}' boxes unknown lifeline {m['box']}")
                continue
            n += 1
            where = f"diagram {did} step {n}" + (f" ({m['id']})" if m.get("id") else "")
            for k in ("from", "to"):
                if m.get(k) not in lifeline_index[did]:
                    errs.append(f"{where}: '{k}' references unknown lifeline {m.get(k)!r}")
            if not m.get("label"):
                errs.append(f"{where}: label is required")
            if m.get("st") not in STEP_STATES:
                errs.append(f"{where}: st must be one of {STEP_STATES}")
            if m.get("id"):
                if m["id"] in steps:
                    errs.append(f"{where}: duplicate step id {m['id']}")
                steps[m["id"]] = n
            steps[n] = n
        step_index[did] = steps

        def resolve(ref, ctx, did=did):
            if ref in step_index[did]:
                return step_index[did][ref]
            errs.append(f"{ctx}: unknown step {ref!r} in diagram {did}")
            return None

        for a in dg.get("activations", []):
            if a.get("lifeline") not in lifeline_index[did]:
                errs.append(f"diagram {did}: activation on unknown lifeline {a.get('lifeline')!r}")
            a["from"] = resolve(a.get("from"), f"diagram {did} activation")
            a["to"] = resolve(a.get("to"), f"diagram {did} activation")

    fids = set()
    for f in d.get("findings", []):
        fid = f.get("id")
        if not fid or fid in fids:
            errs.append(f"finding id missing or duplicated: {fid!r}")
        fids.add(fid)
        if f.get("sev") not in SEVERITIES:
            errs.append(f"finding {fid}: sev must be one of {SEVERITIES}")
        if not f.get("title"):
            errs.append(f"finding {fid}: title is required")
        f.setdefault("status", UI[lang]["sev"].get(f.get("sev"), ""))
        anchors = f.get("anchors")
        if anchors is None and ("lifelines" in f or "steps" in f):
            anchors = [{"lifelines": f.pop("lifelines", []), "steps": f.pop("steps", [])}]
        anchors = anchors or []
        for a in anchors:
            if "diagram" not in a:
                if len(diagrams) == 1:
                    a["diagram"] = diagrams[0]["id"]
                else:
                    errs.append(f"finding {fid}: anchors need 'diagram' when there are several diagrams")
                    continue
            did = a["diagram"]
            if did not in step_index:
                errs.append(f"finding {fid}: unknown diagram {did!r}")
                continue
            for l in a.get("lifelines", []):
                if l not in lifeline_index[did]:
                    errs.append(f"finding {fid}: unknown lifeline {l!r} in diagram {did}")
            a["steps"] = [s for s in (resolve_step(step_index, did, r, fid, errs) for r in a.get("steps", [])) if s]
        f["anchors"] = anchors
        if not anchors:
            print(f"warning: finding {fid} has no anchors, it will not highlight anything", file=sys.stderr)

    for band in d.get("components", []):
        for item in band.get("items", []):
            if item.get("st", "old") not in STATES + ("ghost",):
                errs.append(f"component {item.get('name')}: st must be one of {STATES + ('ghost',)}")
            for t in item.get("findings", []):
                if t not in fids:
                    errs.append(f"component {item.get('name')}: unknown finding {t!r}")
    return errs


def resolve_step(step_index, did, ref, fid, errs):
    if ref in step_index[did]:
        return step_index[did][ref]
    errs.append(f"finding {fid}: unknown step {ref!r} in diagram {did}")
    return None


def render_header(d, u):
    pr = d["pr"]
    eyebrow = []
    if pr.get("ticket"):
        eyebrow.append(e(pr["ticket"]))
    repo = pr["url"].rstrip("/").split("/")[-3] if "/pull/" in pr["url"] else "PR"
    eyebrow.append(f'<a href="{e(pr["url"])}">{e(repo)} #{e(str(pr["number"]))}</a>')
    eyebrow.append(e(d.get("kind", u["kind"])))
    meta = []
    for key, fmt in (("branch", "code"), ("commit", "code"), ("author", None), ("state", None), ("ci", None), ("snapshot", None)):
        if pr.get(key):
            val = f"<code>{e(pr[key])}</code>" if fmt == "code" else e(pr[key])
            sep = " " if key in ("branch", "commit", "snapshot") else ": "
            meta.append(f"<span>{u[key]}{sep}{val}</span>")
    stats = "".join(f'<div class="stat"><b>{e(str(s["value"]))}</b><span>{e(s["label"])}</span></div>' for s in d.get("stats", []))
    nav = [("flow", u["nav_flow"]), ("components", u["nav_components"])]
    nav += [(s["id"], s.get("nav", s["title"])) for s in d.get("sections_before_review", [])]
    nav.append(("review", u["nav_review"]))
    nav += [(s["id"], s.get("nav", s["title"])) for s in d.get("sections_after_review", [])]
    if not d.get("components"):
        nav = [n for n in nav if n[0] != "components"]
    return (
        "<header>\n"
        f'<div class="eyebrow">{" · ".join(eyebrow)}</div>\n'
        f"<h1>{e(d['headline'])}</h1>\n"
        f'<div class="meta">{"".join(meta)}</div>\n'
        + (f'<p class="lead">{d["lead_html"]}</p>\n' if d.get("lead_html") else "")
        + (f'<div class="stats">{stats}</div>\n' if stats else "")
        + "<nav>" + "".join(f'<a href="#{e(i)}">{e(t)}</a>' for i, t in nav) + "</nav>\n"
        "</header>\n"
    )


def render_flow(d, u):
    multi = len(d["diagrams"]) > 1
    title = d.get("flow_title") or (u["flow_title_many"] if multi else u["flow_title_one"])
    intro = d.get("flow_intro_html", "")
    legend = [f'<span><i class="lg-{s}"></i>{u["lg_" + s]}</span>' for s in STATES]
    for dg in d["diagrams"]:
        if dg.get("box_legend"):
            legend.append(f'<span><i class="lg-box"></i>{e(dg["box_legend"])}</span>')
    parts = [
        '<section id="flow">',
        f"<h2>{e(title)}</h2>",
        f'<p class="sub">{intro + " " if intro else ""}{u["flow_help"]}</p>',
        f'<div class="legend">{"".join(legend)}</div>',
        '<div class="chips" id="chips"></div>',
        '<div class="focus-note" id="focus"></div>',
    ]
    for dg in d["diagrams"]:
        parts.append(f'<div class="diagram" id="fig-{e(dg["id"])}">')
        if multi or dg.get("title"):
            if dg.get("title"):
                parts.append(f"<h3>{e(dg['title'])}</h3>")
            if dg.get("sub_html"):
                parts.append(f'<p class="sub">{dg["sub_html"]}</p>')
        aria = dg.get("aria") or f'{u["aria"]}: {dg.get("title") or d["headline"]}'
        parts.append(f'<div class="scroll"><svg class="seq" id="seq-{e(dg["id"])}" role="img" aria-label="{e(aria)}"></svg></div>')
        parts.append(f'<div class="card detail" id="detail-{e(dg["id"])}"><div class="k">{u["step_detail"]}</div><p>{u["step_hint"]}</p></div>')
        parts.append("</div>")
    parts.append("</section>")
    return "\n".join(parts) + "\n"


def render_components(d, u, sev_of):
    bands = d.get("components") or []
    if not bands:
        return ""
    out = ['<section id="components">', f"<h2>{u['components_title']}</h2>",
           f'<p class="sub">{d.get("components_sub_html", u["components_sub"])}</p>', '<div class="layers card">']
    for band in bands:
        out.append(f'<div class="band"><h3>{e(band["band"])}</h3><div class="boxes">')
        for it in band.get("items", []):
            tags = "".join(f'<span class="tag sev-{sev_of[t]}">{e(t)}</span>' for t in it.get("findings", []))
            tags = f'<div class="tags">{tags}</div>' if tags else ""
            desc = f'<span>{it["desc_html"]}</span>' if it.get("desc_html") else ""
            out.append(f'<div class="box {it.get("st", "old")}">{tags}<b>{e(it["name"])}</b>{desc}</div>')
        out.append("</div></div>")
    out += ["</div>", "</section>"]
    return "\n".join(out) + "\n"


def render_custom(sections):
    out = []
    for s in sections:
        out.append(f'<section id="{e(s["id"])}">\n<h2>{e(s["title"])}</h2>\n'
                   + (f'<p class="sub">{s["sub_html"]}</p>\n' if s.get("sub_html") else "")
                   + s.get("html", "") + "\n</section>\n")
    return out


def render_review(d, u, names):
    rv = d.get("review", {})
    out = ['<section id="review">', f"<h2>{u['review_title']}</h2>"]
    if rv.get("sub_html"):
        out.append(f'<p class="sub">{rv["sub_html"]}</p>')
    out.append('<div class="findings">')
    for f in d.get("findings", []):
        rows = []
        if f.get("state_html"):
            rows.append((u["dt_state"], f["state_html"], ""))
        if f.get("where"):
            where = e(f["where"])
            if f.get("url"):
                where += f' · <a href="{e(f["url"])}">{u["thread"]}</a>'
            rows.append((u["dt_where"], where, ' class="mono"'))
        for key, label in (("what_html", "dt_what"), ("impact_html", "dt_impact"), ("fix_html", "dt_fix")):
            if f.get(key):
                rows.append((u[label], f[key], ""))
        anchor_txt = []
        for a in f["anchors"]:
            comp = " ".join(f"<code>{e(names[a['diagram']][l])}</code>" for l in a.get("lifelines", []))
            steps = ", ".join(str(s) for s in a.get("steps", []))
            anchor_txt.append(comp + (f" · {u['steps_word']} {steps}" if steps else ""))
        if anchor_txt:
            rows.append((u["dt_components"], "<br>".join(anchor_txt), ""))
        dl = "".join(f"<dt>{dt}</dt><dd{cls}>{dd}</dd>" for dt, dd, cls in rows)
        btn = f'<button class="btn" data-go="{e(f["id"])}">{u["see"]}</button>' if f["anchors"] else ""
        out.append(
            f'<div class="card finding" style="border-left-color:var(--{f["sev"]})"><div class="top">'
            f'<span class="sevpill sev-{f["sev"]}">{e(f["id"])} · {e(f["status"])}</span><h3>{e(f["title"])}</h3>{btn}</div>'
            f"<dl>{dl}</dl></div>")
    out.append("</div>")
    if rv.get("checked"):
        items = "".join(f"<li>{li}</li>" for li in rv["checked"])
        out.append(f'<div class="card mt"><h3>{u["checked_title"]}</h3><ul>{items}</ul></div>')
    if rv.get("outside_diff_html"):
        out.append(f'<div class="card mt"><h3>{u["outside_title"]}</h3><p style="margin:0">{rv["outside_diff_html"]}</p></div>')
    if rv.get("extra_html"):
        out.append(rv["extra_html"])
    out.append("</section>")
    return "\n".join(out) + "\n"


def js_literal(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def data_statements(d, u):
    findings = [{k: f[k] for k in ("id", "sev", "status", "title", "anchors")} for f in d.get("findings", [])]
    stmts = ["window.PRD=" + js_literal({"ui": u["js"], "multi": len(d["diagrams"]) > 1, "findings": findings, "diagrams": []}) + ";"]
    for i, dg in enumerate(d["diagrams"]):
        head = {"id": dg["id"], "title": dg.get("title", ""), "activations": dg.get("activations", []),
                "lifelines": [{k: l[k] for k in ("id", "name", "lines", "sub", "st")} for l in dg["lifelines"]],
                "messages": []}
        stmts.append("PRD.diagrams.push(" + js_literal(head) + ");")
        keep = ("section", "box", "from", "to", "label", "code", "st", "ret", "detail", "src")
        for m in dg.get("messages", []):
            stmts.append(f"PRD.diagrams[{i}].messages.push(" + js_literal({k: m[k] for k in keep if k in m}) + ");")
    return stmts


def pack(stmts, limit):
    chunks, cur = [], []
    size = 0
    for s in stmts:
        if cur and size + len(s) + 1 > limit:
            chunks.append("\n".join(cur))
            cur, size = [], 0
        cur.append(s)
        size += len(s) + 1
    if cur:
        chunks.append("\n".join(cur))
    return [f"<script>\n{c}\n</script>" for c in chunks]


def config_path():
    if os.environ.get("CHANGE_MAPS_CONFIG"):
        return Path(os.environ["CHANGE_MAPS_CONFIG"]).expanduser()
    base = os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config"
    return Path(base) / "change-maps" / "config.json"


def publish_target():
    path = config_path()
    if not path.is_file():
        return {"kind": "default", "config": str(path)}
    try:
        conf = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        sys.exit(f"{path}: invalid JSON ({error})")
    am = conf.get("artifactManager")
    if not am:
        return {"kind": "default", "config": str(path)}
    if not am.get("url"):
        sys.exit(f"{path}: artifactManager needs a url")
    return {"kind": "artifact-manager", "config": str(path), "url": am["url"].rstrip("/"),
            "skill": am.get("skill", ""), "allowedLinkHosts": am.get("allowedLinkHosts", [])}


def disallowed_links(page, allowed):
    bad = set()
    for url in re.findall(r'href=\\?"(https?://[^"\\]+)', page):
        parts = urlsplit(url)
        rest = (parts.netloc + parts.path).lower()
        if not any(rest == a or rest.startswith(a + "/")
                   for a in (x.lower().rstrip("/") for x in allowed)):
            bad.add(url)
    return sorted(bad)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--chunk", type=int, default=8000, help="max characters per patch (default 8000)")
    ap.add_argument("--split-sections", action="store_true",
                    help="also move every section after the flow into its own patch, to keep static.html small")
    args = ap.parse_args()

    d = json.loads(Path(args.data).read_text(encoding="utf-8"))
    errs = validate_and_resolve(d)
    if errs:
        print("data.json has problems:", file=sys.stderr)
        for x in errs:
            print("  - " + x, file=sys.stderr)
        sys.exit(1)
    u = UI[d.get("lang", "es")]
    sev_of = {f["id"]: f["sev"] for f in d.get("findings", [])}
    names = {dg["id"]: {l["id"]: l["name"] for l in dg["lifelines"]} for dg in d["diagrams"]}

    css = (ASSETS / "style.css").read_text(encoding="utf-8")
    renderer = (ASSETS / "renderer.js").read_text(encoding="utf-8")
    head = (f'<!doctype html>\n<html lang="{d.get("lang", "es")}">\n<head>\n<meta charset="utf-8">\n'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>{e(d["title"])}</title>\n'
            f"<style>\n{css}</style>\n</head>\n<body>\n<div class=\"wrap\">\n")
    tail = "</div>\n"
    fixed = [render_header(d, u), render_flow(d, u)]
    movable = [("components", render_components(d, u, sev_of))]
    movable += [(s["id"], h) for s, h in zip(d.get("sections_before_review", []), render_custom(d.get("sections_before_review", [])))]
    movable.append(("review", render_review(d, u, names)))
    movable += [(s["id"], h) for s, h in zip(d.get("sections_after_review", []), render_custom(d.get("sections_after_review", [])))]
    movable = [(i, h) for i, h in movable if h]

    scripts = pack(data_statements(d, u), args.chunk) + [f"<script>\n{renderer}</script>"]

    out = Path(args.out_dir)
    pub = out / "publish"
    pub.mkdir(parents=True, exist_ok=True)
    for old in pub.glob("patch-*.html"):
        old.unlink()

    full = head + "".join(fixed) + "".join(h for _, h in movable) + tail + "\n".join(scripts) + "\n</body>\n</html>\n"
    (out / "artifact.html").write_text(full, encoding="utf-8")

    target = publish_target()
    if target["kind"] == "artifact-manager" and target["allowedLinkHosts"]:
        bad = disallowed_links(full, target["allowedLinkHosts"])
        if bad:
            print(f"links that {target['url']} does not allow (allowedLinkHosts in {target['config']}):",
                  file=sys.stderr)
            for url in bad:
                print("  - " + url, file=sys.stderr)
            sys.exit(1)

    patches = []
    body_sections = []
    for sid, h in movable:
        if args.split_sections:
            marker = f"<!--PRFR-S-{sid}-->"
            body_sections.append(marker + "\n")
            patches.append((marker, h))
        else:
            body_sections.append(h)
    markers = []
    for i, s in enumerate(scripts, 1):
        marker = f"<!--PRFR-{i:02d}-->"
        markers.append(marker)
        patches.append((marker, s))
    static = head + "".join(fixed) + "".join(body_sections) + tail + "\n".join(markers) + "\n</body>\n</html>\n"
    (pub / "static.html").write_text(static, encoding="utf-8")
    manifest = {"title": d["title"], "description": d.get("description", ""), "target": target,
                "static": "static.html", "static_chars": len(static), "patches": []}
    for i, (marker, content) in enumerate(patches, 1):
        name = f"patch-{i:02d}.html"
        (pub / name).write_text(content, encoding="utf-8")
        manifest["patches"].append({"file": name, "marker": marker, "chars": len(content)})
    (pub / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    if target["kind"] == "artifact-manager":
        print(f"target         Artifact Manager {target['url']}"
              + (f" · load {target['skill']} first" if target["skill"] else ""))
    else:
        print("target         default: a Claude artifact, or the local file (no artifactManager in the config)")
    print(f"artifact.html  {len(full):>7} chars")
    print(f"static.html    {len(static):>7} chars")
    for p in manifest["patches"]:
        print(f"{p['file']}  {p['chars']:>7} chars  replaces {p['marker']}")
    if len(static) > 30000:
        print("warning: static.html is over 30000 chars, consider --split-sections", file=sys.stderr)
    big = [p for p in manifest["patches"] if p["chars"] > max(args.chunk, 9000)]
    for p in big:
        print(f"warning: {p['file']} has {p['chars']} chars, larger than the patch size known to work", file=sys.stderr)


if __name__ == "__main__":
    main()
