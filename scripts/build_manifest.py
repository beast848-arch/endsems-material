#!/usr/bin/env python3
"""Rebuild manifest.json from the PDFs in materials/.

The site reads manifest.json to know which files exist. GitHub Actions runs
this on every push, so adding a PDF to the right folder is all it takes.
Run it locally with:  python3 scripts/build_manifest.py
"""
import datetime
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATEGORIES = ["pyq-solutions", "notes", "model-papers"]


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def title_from(filename):
    """model-paper-1.pdf -> 'Model paper 1', pyq-solutions-2019-2024.pdf -> 'PYQ solutions 2019–2024'."""
    stem = pathlib.Path(filename).stem
    stem = re.sub(r"(?<=\d)-(?=\d)", "–", stem)  # keep year ranges together
    words = [w for w in re.split(r"[-_\s]+", stem) if w]
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        if lw in ("pyq", "pyqs"):
            out.append("PYQ" + ("s" if lw == "pyqs" else ""))
        elif any(c.isupper() for c in w[1:]) or w.isupper():
            out.append(w)  # keep acronyms and names as written
        elif i == 0:
            out.append(w[:1].upper() + w[1:])
        else:
            out.append(lw)
    return " ".join(out) or filename


def last_updated(path):
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", str(path)],
            cwd=ROOT, capture_output=True, text=True, check=True,
        ).stdout.strip()
        if out:
            return out
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    mtime = path.stat().st_mtime
    return datetime.datetime.fromtimestamp(mtime, datetime.timezone.utc).isoformat(timespec="seconds")


def main():
    subjects = json.loads((ROOT / "subjects.json").read_text(encoding="utf-8"))["subjects"]
    manifest = {
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "subjects": {},
    }
    for subject in subjects:
        entry = {}
        for cat in CATEGORIES:
            folder = ROOT / "materials" / subject["id"] / cat
            files = []
            if folder.is_dir():
                pdfs = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() == ".pdf"]
                for p in sorted(pdfs, key=lambda p: natural_key(p.name)):
                    files.append({
                        "title": title_from(p.name),
                        "file": p.relative_to(ROOT).as_posix(),
                        "size": p.stat().st_size,
                        "updated": last_updated(p),
                    })
            entry[cat] = files
        manifest["subjects"][subject["id"]] = entry

    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(len(v) for s in manifest["subjects"].values() for v in s.values())
    print(f"manifest.json: {total} file(s) across {len(subjects)} subjects")


if __name__ == "__main__":
    main()
