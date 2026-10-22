/* Endsems material: renders the subject list and each subject's files
   from subjects.json (hand-edited) and manifest.json (built from materials/). */

const CATEGORIES = [
  {
    id: "pyq-solutions",
    name: "PYQ solutions",
    short: "PYQ solutions",
    desc: "Worked solutions to the previous-year question papers.",
    slots: ["PYQ solutions"],
  },
  {
    id: "notes",
    name: "Notes",
    short: "notes",
    desc: "Unit-wise notes made from the lecture notes and slides.",
    slots: ["Notes"],
  },
  {
    id: "model-papers",
    name: "Model papers",
    short: "model papers",
    desc: "Practice papers in the exam pattern, weighted toward topics that keep coming up in the PYQs.",
    slots: ["Model paper 1", "Model paper 2", "Model paper 3"],
  },
];
const TOTAL = CATEGORIES.reduce((n, c) => n + c.slots.length, 0);

const app = document.getElementById("app");
const titleBlock = document.getElementById("title-block");
let data = null;
let firstRender = true;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fileUrl = (path) => path.split("/").map(encodeURIComponent).join("/");

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso, withYear = false) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const opts = { day: "numeric", month: "short" };
  if (withYear || d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-IN", opts);
}

function filesFor(subjectId) {
  const s = (data.manifest.subjects && data.manifest.subjects[subjectId]) || {};
  const out = {};
  for (const c of CATEGORIES) out[c.id] = s[c.id] || [];
  return out;
}

function readyCount(subjectId) {
  const f = filesFor(subjectId);
  return CATEGORIES.reduce((n, c) => n + Math.min(f[c.id].length, c.slots.length), 0);
}

function rod(filled, total = TOTAL, delayBase = 0) {
  const band = 18, h = 14, tip = 10;
  const w = tip + total * band + 2;
  let s = `<svg class="rod" viewBox="0 0 ${w} ${h + 2}" width="${w}" height="${h + 2}" aria-hidden="true">`;
  s += `<path class="tip" d="M1 ${1 + h / 2} L${tip + 1} 1 V${h + 1} Z"/>`;
  for (let i = 0; i < total; i++) {
    const on = i < filled;
    s += `<rect class="band${on ? " on" : ""}" x="${tip + 1 + i * band}" y="1" width="${band}" height="${h}" style="--d:${delayBase + i * 70}"/>`;
  }
  return s + "</svg>";
}

/* ---------- Views ---------- */

function renderHome() {
  const { site, subjects } = data.config;
  document.title = site.title;

  const rows = subjects
    .map((s, i) => {
      const n = readyCount(s.id);
      return `<li><a href="#/${esc(s.id)}">
        <span class="name">${esc(s.name)}</span>
        ${rod(n, TOTAL, i * 60)}
        <span class="count">${n} of ${TOTAL}</span>
        <span class="go" aria-hidden="true">›</span>
      </a></li>`;
    })
    .join("");

  const recent = [];
  for (const s of subjects) {
    const f = filesFor(s.id);
    for (const c of CATEGORIES) for (const file of f[c.id]) recent.push({ ...file, subject: s, cat: c });
  }
  recent.sort((a, b) => new Date(b.updated) - new Date(a.updated));

  const recentHtml = recent.length
    ? `<ul class="recent">${recent
        .slice(0, 6)
        .map(
          (r) => `<li>
            <span><a href="${fileUrl(r.file)}" target="_blank" rel="noopener">${esc(r.title)}</a>
            <span class="where">${esc(r.subject.name)}, ${esc(r.cat.short)}</span></span>
            <time datetime="${esc(r.updated)}">${formatDate(r.updated)}</time>
          </li>`
        )
        .join("")}</ul>`
    : `<p class="empty-note">Nothing uploaded yet. New files show up here as soon as they're added.</p>`;

  app.innerHTML = `
    <header class="hero">
      <h1>${esc(site.title)}</h1>
      <p>PYQ solutions, notes and three model papers for each of our ${subjects.length} subjects. Pick a subject to open its files.</p>
    </header>

    <section class="block" aria-labelledby="subjects-h">
      <h2 id="subjects-h">Subjects</h2>
      <div class="register-head" aria-hidden="true"><span>Subject</span><span>Files ready</span></div>
      <ul class="register">${rows}</ul>
    </section>

    <section class="block" aria-labelledby="recent-h">
      <h2 id="recent-h">Recently updated</h2>
      ${recentHtml}
    </section>`;
}

function fileRow(file) {
  const url = fileUrl(file.file);
  const name = file.file.split("/").pop();
  return `<li class="file">
    <div>
      <div class="title">${esc(file.title)}</div>
      <div class="meta"><span>${formatSize(file.size)}</span><span>Updated ${formatDate(file.updated)}</span></div>
    </div>
    <div class="actions">
      <a class="btn primary" href="${url}" target="_blank" rel="noopener">Open</a>
      <a class="btn" href="${url}" download="${esc(name)}">Download</a>
    </div>
  </li>`;
}

function pendingRow(slotName) {
  return `<li class="file pending">
    <div class="title">${esc(slotName)}</div>
    <div class="meta">Not added yet</div>
  </li>`;
}

function renderSubject(subject) {
  document.title = `${subject.name} · ${data.config.site.title}`;
  const f = filesFor(subject.id);
  const n = readyCount(subject.id);

  const sections = CATEGORIES.map((c) => {
    const files = f[c.id];
    const have = Math.min(files.length, c.slots.length);
    const missing = c.slots.slice(files.length);
    return `<section class="category" aria-labelledby="h-${c.id}">
      <div class="cat-head">
        <h2 id="h-${c.id}">${esc(c.name)}</h2>
        <span class="count">${have} of ${c.slots.length}</span>
      </div>
      <p class="cat-desc">${esc(c.desc)}</p>
      <ul class="files">
        ${files.map(fileRow).join("")}
        ${missing.map(pendingRow).join("")}
      </ul>
    </section>`;
  }).join("");

  const summary =
    n === 0 ? "Nothing added yet" : n === TOTAL ? `All ${TOTAL} files ready` : `${n} of ${TOTAL} files ready`;

  app.innerHTML = `
    <a class="back" href="#/"><span aria-hidden="true">‹</span> All subjects</a>
    <header class="subject-head">
      <h1>${esc(subject.name)}</h1>
      <div class="summary">${rod(n)}<span>${summary}</span></div>
    </header>
    ${sections}`;
}

function renderNotFound(id) {
  document.title = data.config.site.title;
  app.innerHTML = `
    <a class="back" href="#/"><span aria-hidden="true">‹</span> All subjects</a>
    <header class="subject-head"><h1>Subject not found</h1></header>
    <p class="status" style="margin-top:16px">There's no subject at “${esc(id)}”. Go back to all subjects and pick one from the list.</p>`;
}

function renderTitleBlock() {
  const { site, subjects } = data.config;
  const ready = subjects.reduce((n, s) => n + readyCount(s.id), 0);
  const repo = site.repo || "";
  const updated = data.manifest.generated ? formatDate(data.manifest.generated, true) : "—";
  titleBlock.innerHTML = `
    <div class="tb-cell full"><span class="tb-label">Project</span><span class="tb-value big">${esc(site.title)}</span></div>
    <div class="tb-cell full"><span class="tb-label">For</span><span class="tb-value">${esc(site.subtitle || "")}</span></div>
    <div class="tb-cell half"><span class="tb-label">Files ready</span><span class="tb-value">${ready} of ${subjects.length * TOTAL}</span></div>
    <div class="tb-cell half"><span class="tb-label">Last built</span><span class="tb-value">${esc(updated)}</span></div>
    ${
      repo
        ? `<div class="tb-cell full"><span class="tb-label">Source</span><span class="tb-value"><a href="${esc(repo)}">${esc(repo.replace(/^https?:\/\//, ""))}</a></span></div>`
        : ""
    }`;
}

function route() {
  if (!data) return;
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, "")).trim();
  const animate = firstRender;
  app.classList.toggle("animate", animate);

  if (!id) renderHome();
  else {
    const subject = data.config.subjects.find((s) => s.id === id);
    subject ? renderSubject(subject) : renderNotFound(id);
  }

  if (!firstRender) {
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
  firstRender = false;
}

async function load() {
  try {
    const [config, manifest] = await Promise.all(
      ["subjects.json", "manifest.json"].map((u) =>
        fetch(u, { cache: "no-cache" }).then((r) => {
          if (!r.ok) throw new Error(`${u}: ${r.status}`);
          return r.json();
        })
      )
    );
    data = { config, manifest };
    renderTitleBlock();
    route();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p class="status">The file list didn't load. If you opened index.html straight from your computer, open the site through its GitHub Pages link instead, then reload.</p>`;
  }
}

window.addEventListener("hashchange", route);
load();
