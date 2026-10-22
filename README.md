# Endsems material

PYQ solutions, notes and model papers for our end-semester subjects, published with GitHub Pages.

**Site:** https://beast848-arch.github.io/endsems-material/

## Where files go

Each subject has its own folder under `materials/`, with three folders inside:

```
materials/
  surveying/
    pyq-solutions/   ← solved previous-year papers
    notes/           ← notes from lecture notes and slides
    model-papers/    ← model paper 1, 2 and 3
```

| Folder | Subject |
| --- | --- |
| `concrete-technology` | Concrete Technology and Construction |
| `hydraulics-fluid-machinery` | Hydraulics and Fluid Machinery |
| `surveying` | Surveying |
| `mechanics-of-solids` | Mechanics of Solids |
| `survey-laboratory` | Survey Laboratory |
| `building-planning-drawing` | Building Planning and Drawing |
| `construction-techniques-equipment` | Construction Techniques and Equipment |
| `engineering-geology` | Engineering Geology |

## Adding a PDF

1. On GitHub, open the right folder, for example `materials/surveying/notes/`.
2. Click **Add file → Upload files**, drop the PDF in, and commit.
3. The site rebuilds by itself and the file appears within a couple of minutes.

The file name becomes the title on the site, so name files the way you want them shown:

| File name | Shows as |
| --- | --- |
| `pyq-solutions-2019-2024.pdf` | PYQ solutions 2019–2024 |
| `unit-1-notes.pdf` | Unit 1 notes |
| `model-paper-2.pdf` | Model paper 2 |

Files are listed in name order, so number them if order matters. Only `.pdf` files are shown. GitHub's upload limit through the browser is 25 MB per file.

## Adding or renaming a subject

Edit `subjects.json`. Each subject needs an `id` (its folder name under `materials/`) and a `name`. Then create the matching folder.

## How it works

- `index.html` and `assets/` are the site. It's plain HTML, CSS and JavaScript with no build tools.
- `subjects.json` lists the subjects.
- `manifest.json` lists the PDFs. It's rebuilt from the `materials/` folder by `scripts/build_manifest.py` on every push, so you never need to edit it by hand.
- `.github/workflows/deploy.yml` runs that script and publishes the site to GitHub Pages.

To preview locally, run `python3 scripts/build_manifest.py`, then `python3 -m http.server` in this folder and open http://localhost:8000. Opening `index.html` directly as a file won't load the file list.

## One-time setup

In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
