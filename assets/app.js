/* Endsems Material
   Reads subjects.json (hand-edited) and manifest.json (built from materials/)
   and renders four views: Subjects, Files, Recent, Saved, plus a page per subject. */

const TYPES = [
  {
    id: "notes", name: "Notes", one: "Notes", badge: "Notes", color: "var(--green)", lower: "notes",
    desc: "Notes made from the lecture slides, one PDF per module or unit.",
    slots: ["Notes"],
  },
  {
    id: "pyq-solutions", name: "PYQ solutions", one: "PYQ solution", badge: "PYQ", color: "var(--navy)", lower: "PYQ solutions",
    desc: "Worked solutions to the previous-year question papers.",
    slots: ["PYQ solutions"],
  },
  {
    id: "model-papers", name: "Model papers", one: "Model paper", badge: "Model paper", color: "var(--olive)", lower: "model papers",
    desc: "Practice papers in the exam pattern, weighted toward topics that keep coming up in the PYQs.",
    slots: ["Model paper 1", "Model paper 2", "Model paper 3"],
  },
];
const KIND_COLOR = { Theory: "var(--brown)", Lab: "var(--teal)", Drawing: "var(--plum)" };
const SORTS = [
  { id: "default", name: "Course order" },
  { id: "az", name: "A to Z" },
  { id: "newest", name: "Newest first" },
];
const TAGS_SHOWN = 3;

const $ = (id) => document.getElementById(id);
const app = $("app");
const qInput = $("q");

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const state = {
  data: null,
  query: "",
  types: new Set(),
  kinds: new Set(),
  sort: "default",
  saved: new Set(store.get("endsems:saved", [])),
  expanded: new Set(),
  lastView: null,
  pyq: { section: "all", exam: "all" },
};
const EXAMS = [
  { id: "Cycle Test 1", name: "CT 1" },
  { id: "Cycle Test 2", name: "CT 2" },
  { id: "Mid-sem", name: "Mid-sem" },
  { id: "End-sem", name: "End-sem" },
];
const sectionName = (s) => (s && s.length === 1 ? `Section ${s}` : "Section not stated");
const sectionRank = (s) => (s === "A" ? 0 : s === "B" ? 1 : 2);

/* ---------- helpers ---------- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fileUrl = (path) => path.split("/").map(encodeURIComponent).join("/");

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
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
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const ICON = {
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>',
  files: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/></svg>',
  pages: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5h9.5v14H8z"/><path d="M5.5 6.5v14h9.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
};

/* ---------- data ---------- */

function subjects() { return state.data.config.subjects; }
function subjectById(id) { return subjects().find((s) => s.id === id); }
function filesOf(subjectId) {
  const s = state.data.manifest.subjects?.[subjectId] || {};
  const out = {};
  for (const t of TYPES) out[t.id] = (s[t.id] || []).map((f) => ({ ...f, type: t, subject: subjectById(subjectId), key: "f:" + f.file }));
  return out;
}
function allFiles() {
  const out = [];
  subjects().forEach((s, si) => {
    const f = filesOf(s.id);
    TYPES.forEach((t) => f[t.id].forEach((file, i) => out.push({ ...file, order: si * 10000 + TYPES.indexOf(t) * 1000 + i })));
  });
  return out;
}
function latest(subjectId) {
  const f = filesOf(subjectId);
  let best = null;
  for (const t of TYPES) for (const file of f[t.id]) if (!best || new Date(file.updated) > new Date(best)) best = file.updated;
  return best;
}

function words() { return state.query.toLowerCase().split(/\s+/).filter(Boolean); }
function hay(...parts) { return parts.flat().filter(Boolean).join(" ").toLowerCase(); }
function fileMatches(f) {
  const w = words();
  if (!w.length) return true;
  const exam = EXAMS.find((e) => e.id === f.exam);
  const text = hay(f.title, f.label, f.tags || [], f.subject.name, f.subject.short, f.type.name, f.type.one,
    f.year ? String(f.year) : "", f.section ? sectionName(f.section) : "", f.exam || "", exam ? [exam.name, exam.name.replace(" ", "")] : "");
  return w.every((x) => text.includes(x));
}
function subjectMatches(s) {
  const w = words();
  if (!w.length) return true;
  const f = filesOf(s.id);
  const text = hay(s.name, s.short, s.kind, TYPES.map((t) => f[t.id].map((x) => [x.title, x.label, x.tags || []])));
  return w.every((x) => text.includes(x));
}

function sortFiles(list) {
  const l = [...list];
  if (state.sort === "az") l.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  else if (state.sort === "newest") l.sort((a, b) => new Date(b.updated) - new Date(a.updated) || a.order - b.order);
  else l.sort((a, b) => a.order - b.order);
  return l;
}

/* ---------- saved ---------- */

function toggleSaved(key) {
  state.saved.has(key) ? state.saved.delete(key) : state.saved.add(key);
  store.set("endsems:saved", [...state.saved]);
}

/* ---------- cards ---------- */

function saveButton(key, label) {
  const on = state.saved.has(key);
  return `<button class="save" type="button" data-save="${esc(key)}" aria-pressed="${on}" aria-label="${on ? "Remove" : "Save"} ${esc(label)}">${ICON.bookmark}</button>`;
}

function tagList(key, tags, extraClass = "") {
  if (!tags.length) return "";
  const open = state.expanded.has(key);
  const shown = open ? tags : tags.slice(0, TAGS_SHOWN);
  const rest = tags.length - shown.length;
  return `<ul class="tags ${extraClass}">${shown.map((t) => (typeof t === "string" ? `<li>${esc(t)}</li>` : `<li class="${t.cls || ""}">${esc(t.text)}</li>`)).join("")}${
    rest > 0 ? `<li class="more"><button type="button" data-expand="${esc(key)}" aria-label="Show ${rest} more topics">+${rest}</button></li>` : ""
  }</ul>`;
}

function subjectCard(s) {
  const f = filesOf(s.id);
  const total = TYPES.reduce((n, t) => n + f[t.id].length, 0);
  const when = latest(s.id);
  const meta = total ? `${esc(s.kind)} · updated ${formatDate(when)}` : `${esc(s.kind)} · nothing added yet`;
  const tags = TYPES.map((t) => ({ text: `${t.name} ${f[t.id].length}`, cls: f[t.id].length ? "" : "zero" }));
  return `<li class="card" style="--c:${KIND_COLOR[s.kind] || "var(--brown)"}">
    <div class="card-head">
      <h3 class="card-title"><a class="card-link" href="#/s/${esc(s.id)}">${esc(s.name)}</a></h3>
      <span class="badge">${esc(s.kind)}</span>
      ${saveButton("s:" + s.id, s.name)}
    </div>
    <p class="meta">${meta}</p>
    <p class="links">${ICON.files}${plural(total, "file", "files")}</p>
    ${tagList("s:" + s.id, tags)}
  </li>`;
}

function fileCard(f, { showSubject = true } = {}) {
  const bits = [];
  if (f.pages) bits.push(plural(f.pages, "page", "pages"));
  bits.push(formatSize(f.size));
  const meta = [showSubject ? f.subject.short || f.subject.name : null, f.label || null, f.inferred ? "section inferred" : null].filter(Boolean).join(" · ") || `Updated ${formatDate(f.updated)}`;
  return `<li class="card" style="--c:${f.type.color}">
    <div class="card-head">
      <h3 class="card-title"><a class="card-link" href="${fileUrl(f.file)}" target="_blank" rel="noopener">${esc(f.title)}</a></h3>
      <span class="badge">${esc(f.type.badge)}</span>
      ${saveButton(f.key, f.title)}
    </div>
    <p class="meta">${esc(meta)}</p>
    <p class="links">${ICON.pages}${esc(bits.join(" · "))}</p>
    ${tagList(f.key, f.tags || [])}
  </li>`;
}

function pendingCard(name, type) {
  return `<li class="card pending" style="--c:${type.color}">
    <div class="card-head"><h3 class="card-title">${esc(name)}</h3></div>
    <p class="meta">Not added yet</p>
  </li>`;
}

/* ---------- views ---------- */

function noteLine(text) {
  const clear = state.query || state.types.size || state.kinds.size
    ? `<button type="button" data-clear>Clear search and filters</button>` : "";
  return `<div class="view-note"><span>${text}</span>${clear}</div>`;
}

function emptyBox(lines) {
  return `<div class="empty">${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
}

function noMatch() {
  return emptyBox([
    `Nothing matches${state.query ? ` “${esc(state.query)}”` : " these filters"}.`,
    `<button type="button" data-clear>Clear search and filters</button>`,
  ]);
}

function renderSubjects() {
  let list = subjects().filter((s) => (!state.kinds.size || state.kinds.has(s.kind)) && subjectMatches(s));
  if (state.sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort === "newest") list = [...list].sort((a, b) => new Date(latest(b.id) || 0) - new Date(latest(a.id) || 0));
  const total = allFiles().length;
  app.innerHTML =
    noteLine(`${plural(list.length, "subject", "subjects")} · ${plural(total, "file", "files")} in total`) +
    (list.length ? `<ul class="grid">${list.map(subjectCard).join("")}</ul>` : noMatch());
}

function renderFileList(view) {
  let list = allFiles().filter((f) => (!state.types.size || state.types.has(f.type.id)) && fileMatches(f));
  if (view === "recent") {
    list = [...list].sort((a, b) => new Date(b.updated) - new Date(a.updated)).slice(0, 24);
  } else list = sortFiles(list);

  const any = allFiles().length;
  if (!any) {
    app.innerHTML = emptyBox([
      "No files yet.",
      "Notes, PYQ solutions and model papers show up here as soon as they're added to the repository.",
    ]);
    return;
  }
  const label = view === "recent" ? "Most recently added or updated" : plural(list.length, "file", "files");
  app.innerHTML = noteLine(label) + (list.length ? `<ul class="grid">${list.map((f) => fileCard(f)).join("")}</ul>` : noMatch());
}

function renderSaved() {
  const subs = subjects().filter((s) => state.saved.has("s:" + s.id) && subjectMatches(s));
  const files = sortFiles(allFiles().filter((f) => state.saved.has(f.key) && (!state.types.size || state.types.has(f.type.id)) && fileMatches(f)));
  if (!subs.length && !files.length) {
    const nothingSaved = ![...state.saved].length;
    app.innerHTML = nothingSaved
      ? emptyBox(["Nothing saved yet.", "Tap the bookmark on any subject or file to keep it here. Saved items stay on this device."])
      : noMatch();
    return;
  }
  let html = noteLine(`${plural(subs.length + files.length, "saved item", "saved items")} on this device`);
  if (subs.length) html += `<section class="section" style="margin-top:8px"><div class="section-head"><h2>Subjects</h2></div><ul class="grid">${subs.map(subjectCard).join("")}</ul></section>`;
  if (files.length) html += `<section class="section"><div class="section-head"><h2>Files</h2></div><ul class="grid">${files.map((f) => fileCard(f)).join("")}</ul></section>`;
  app.innerHTML = html;
}

function chipRow(label, key, options) {
  if (options.length < 2) return "";
  const cur = state.pyq[key];
  const all = [{ id: "all", name: key === "section" ? "All sections" : "All exams" }, ...options];
  return `<div class="chips" role="group" aria-label="${esc(label)}">${all.map((o) =>
    `<button class="chip" type="button" data-pyq="${key}" data-val="${esc(o.id)}" aria-pressed="${cur === o.id}">${esc(o.name)}</button>`).join("")}</div>`;
}

function pyqBlock(files) {
  const secIds = [...new Set(files.map((f) => f.section || "-"))].sort((a, b) => sectionRank(a) - sectionRank(b));
  const exIds = EXAMS.filter((e) => files.some((f) => f.exam === e.id));
  if (!secIds.includes(state.pyq.section)) state.pyq.section = "all";
  if (!exIds.some((e) => e.id === state.pyq.exam)) state.pyq.exam = "all";
  const list = files.filter((f) =>
    (state.pyq.section === "all" || (f.section || "-") === state.pyq.section) &&
    (state.pyq.exam === "all" || f.exam === state.pyq.exam));
  const chips = chipRow("Filter by section", "section", secIds.map((id) => ({ id, name: id === "-" ? "Not stated" : sectionName(id) }))) +
    chipRow("Filter by exam", "exam", exIds);
  if (!list.length) return chips + emptyBox(["No papers match these choices."]);
  const years = [...new Set(list.map((f) => f.year || 0))].sort((a, b) => b - a);
  return chips + years.map((y) => {
    const group = list.filter((f) => (f.year || 0) === y)
      .sort((a, b) => sectionRank(a.section) - sectionRank(b.section) || (a.order || 9) - (b.order || 9) || a.title.localeCompare(b.title));
    return `<h3 class="year-head">${y ? esc(String(y)) : "Other"}<span>${plural(group.length, "paper", "papers")}</span></h3>
      <ul class="grid">${group.map((x) => fileCard(x, { showSubject: false })).join("")}</ul>`;
  }).join("");
}

function renderSubject(s) {
  const f = filesOf(s.id);
  const total = TYPES.reduce((n, t) => n + f[t.id].length, 0);
  const filtering = !!(state.query || state.types.size);
  const counts = TYPES.map((t) => `${f[t.id].length} ${t.lower}`).join(" · ");

  const sections = TYPES.filter((t) => !state.types.size || state.types.has(t.id)).map((t) => {
    const list = sortFiles(f[t.id].map((x, i) => ({ ...x, order: i })).filter(fileMatches));
    const pending = filtering ? [] : t.slots.slice(f[t.id].length);
    if (filtering && !list.length) return "";
    const grouped = t.id === "pyq-solutions" && list.some((x) => x.year);
    const items = list.map((x) => fileCard(x, { showSubject: false })).join("") + pending.map((n) => pendingCard(n, t)).join("");
    const body = grouped ? pyqBlock(list) : `<ul class="grid">${items}</ul>`;
    return `<section class="section" aria-labelledby="h-${t.id}">
      <div class="section-head"><h2 id="h-${t.id}">${esc(t.name)}</h2><span class="n">${plural(f[t.id].length, grouped ? "paper" : "file", grouped ? "papers" : "files")}</span></div>
      <p class="section-desc">${esc(grouped ? "Worked solutions to previous-year papers, grouped by year. Filter by section or exam." : t.desc)}</p>
      ${body}
    </section>`;
  }).join("");

  app.innerHTML = `
    <a class="back" href="#/">${ICON.back} All subjects</a>
    <header class="subject-head" style="--c:${KIND_COLOR[s.kind] || "var(--brown)"}">
      <div class="row"><h1>${esc(s.name)}</h1><span class="badge">${esc(s.kind)}</span>${saveButton("s:" + s.id, s.name)}</div>
      <p class="meta">${total ? counts : "Nothing added yet"}</p>
    </header>
    ${sections || noMatch()}`;
}

/* ---------- chrome: tabs, menus, footer ---------- */

function currentRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")).trim();
  if (!h) return { view: "subjects" };
  if (h.startsWith("s/")) return { view: "subject", id: h.slice(2) };
  if (["files", "recent", "saved"].includes(h)) return { view: h };
  if (subjectById(h)) return { view: "subject", id: h }; // old links
  return { view: "missing", id: h };
}

function placeScribble(animate) {
  const nav = document.querySelector(".tabs");
  const svg = $("scribble");
  const active = nav.querySelector('.tab[aria-current="page"]');
  if (!active) { svg.style.opacity = 0; return; }
  const range = document.createRange();
  range.selectNodeContents(active);
  const r = range.getBoundingClientRect();
  const n = nav.getBoundingClientRect();
  const padX = Math.max(12, r.height * 0.75), padY = Math.max(6, r.height * 0.36);
  Object.assign(svg.style, {
    left: `${r.left - n.left - padX}px`,
    top: `${r.top - n.top - padY}px`,
    width: `${r.width + padX * 2}px`,
    height: `${r.height + padY * 2}px`,
    opacity: 1,
  });
  if (animate) { svg.classList.remove("draw"); void svg.getBoundingClientRect(); svg.classList.add("draw"); }
}

function updateTabs(view) {
  const tabView = view === "subject" || view === "missing" ? "subjects" : view;
  document.querySelectorAll(".tab").forEach((t) => {
    if (t.dataset.view === tabView) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
  placeScribble(state.lastView !== null && state.lastView !== tabView);
  state.lastView = tabView;
}

function filterMenu(view) {
  const useKinds = view === "subjects";
  const opts = useKinds
    ? [...new Set(subjects().map((s) => s.kind))].map((k) => ({ id: k, name: k, color: KIND_COLOR[k] }))
    : TYPES.map((t) => ({ id: t.id, name: t.name, color: t.color }));
  const set = useKinds ? state.kinds : state.types;
  $("filter-menu").innerHTML =
    `<p class="menu-title">${useKinds ? "Kind of subject" : "Kind of file"}</p>` +
    opts.map((o) => `<button class="menu-item" type="button" role="menuitemcheckbox" aria-checked="${set.has(o.id)}" data-filter="${esc(o.id)}" data-set="${useKinds ? "kinds" : "types"}">
      <span class="check">${ICON.check}</span><span class="swatch" style="--c:${o.color}"></span>${esc(o.name)}</button>`).join("") +
    (set.size ? `<hr class="menu-sep"><button class="menu-item clear" type="button" data-clear-filters="${useKinds ? "kinds" : "types"}">Clear filters</button>` : "");
  const c = $("filter-count");
  c.hidden = !set.size;
  c.textContent = set.size;
}

function sortMenu() {
  $("sort-menu").innerHTML = `<p class="menu-title">Sort by</p>` + SORTS.map((s) =>
    `<button class="menu-item radio" type="button" role="menuitemradio" aria-checked="${state.sort === s.id}" data-sort="${s.id}"><span class="check">${ICON.check}</span>${esc(s.name)}</button>`
  ).join("");
  $("sort-btn").setAttribute("aria-label", `Sort: ${SORTS.find((s) => s.id === state.sort).name}`);
}

function closeMenus(except) {
  for (const [btn, menu] of [["filter-btn", "filter-menu"], ["sort-btn", "sort-menu"]]) {
    if (btn === except) continue;
    $(menu).hidden = true;
    $(btn).setAttribute("aria-expanded", "false");
  }
}
function toggleMenu(btn, menu) {
  const open = $(menu).hidden;
  closeMenus(btn);
  $(menu).hidden = !open;
  $(btn).setAttribute("aria-expanded", String(open));
}

function renderFooter() {
  const { site } = state.data.config;
  const total = allFiles().length;
  const built = state.data.manifest.generated ? formatDate(state.data.manifest.generated, true) : "";
  $("foot").innerHTML = `<span>${esc(site.subtitle || "")} · ${plural(total, "file", "files")} · last updated ${esc(built)}</span>
    <a href="${esc(site.repo)}">Source on GitHub</a>`;
}

/* ---------- render ---------- */

function render({ fromRoute = false } = {}) {
  if (!state.data) return;
  const route = currentRoute();
  updateTabs(route.view);
  filterMenu(route.view === "subjects" ? "subjects" : "files");
  sortMenu();

  if (route.view === "subjects") { document.title = state.data.config.site.title; renderSubjects(); }
  else if (route.view === "files") { document.title = `Files · ${state.data.config.site.title}`; renderFileList("files"); }
  else if (route.view === "recent") { document.title = `Recent · ${state.data.config.site.title}`; renderFileList("recent"); }
  else if (route.view === "saved") { document.title = `Saved · ${state.data.config.site.title}`; renderSaved(); }
  else if (route.view === "subject") {
    const s = subjectById(route.id);
    if (s) { document.title = `${s.name} · ${state.data.config.site.title}`; renderSubject(s); }
    else renderMissing(route.id);
  } else renderMissing(route.id);

  if (fromRoute) {
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
}

function renderMissing(id) {
  app.innerHTML = `<a class="back" href="#/">${ICON.back} All subjects</a>` +
    emptyBox([`There's no page at “${esc(id)}”.`, `Go back to all subjects and pick one from the list.`]);
}

/* ---------- events ---------- */

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-save],[data-expand],[data-clear],[data-filter],[data-clear-filters],[data-sort],[data-pyq]");
  if (!t) {
    if (!e.target.closest(".menu-wrap")) closeMenus();
    return;
  }
  if (t.dataset.save) {
    e.preventDefault();
    toggleSaved(t.dataset.save);
    const on = state.saved.has(t.dataset.save);
    document.querySelectorAll(`[data-save="${CSS.escape(t.dataset.save)}"]`).forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", b.getAttribute("aria-label").replace(/^(Save|Remove)/, on ? "Remove" : "Save"));
    });
    if (currentRoute().view === "saved") render();
  } else if (t.dataset.expand) {
    state.expanded.add(t.dataset.expand);
    render();
  } else if (t.hasAttribute("data-clear")) {
    state.query = ""; qInput.value = ""; state.types.clear(); state.kinds.clear();
    render();
  } else if (t.dataset.filter) {
    const set = state[t.dataset.set];
    set.has(t.dataset.filter) ? set.delete(t.dataset.filter) : set.add(t.dataset.filter);
    render();
    $("filter-menu").hidden = false;
  } else if (t.dataset.clearFilters) {
    state[t.dataset.clearFilters].clear();
    render();
  } else if (t.dataset.pyq) {
    state.pyq[t.dataset.pyq] = t.dataset.val;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  } else if (t.dataset.sort) {
    state.sort = t.dataset.sort;
    store.set("endsems:sort", state.sort);
    closeMenus();
    render();
  }
});

$("filter-btn").addEventListener("click", () => toggleMenu("filter-btn", "filter-menu"));
$("sort-btn").addEventListener("click", () => toggleMenu("sort-btn", "sort-menu"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenus();
  if (e.key === "/" && document.activeElement !== qInput && !e.target.closest("input,textarea")) { e.preventDefault(); qInput.focus(); }
});

qInput.addEventListener("input", () => { state.query = qInput.value.trim(); render(); });

$("about-btn").addEventListener("click", () => {
  const d = $("about");
  if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
});

const toTop = $("to-top");
toTop.addEventListener("click", () => { window.scrollTo({ top: 0 }); qInput.focus({ preventScroll: true }); });
window.addEventListener("scroll", () => { toTop.hidden = window.scrollY < 500; }, { passive: true });
window.addEventListener("resize", () => placeScribble(false));
window.addEventListener("hashchange", () => render({ fromRoute: true }));

/* ---------- load ---------- */

async function load() {
  state.sort = SORTS.some((s) => s.id === store.get("endsems:sort")) ? store.get("endsems:sort") : "default";
  try {
    const [config, manifest] = await Promise.all(
      ["subjects.json", "manifest.json"].map((u) =>
        fetch(u, { cache: "no-cache" }).then((r) => {
          if (!r.ok) throw new Error(`${u}: ${r.status}`);
          return r.json();
        })
      )
    );
    state.data = { config, manifest };
    if (config.site?.repo) $("repo-link").href = config.site.repo;
    renderFooter();
    render();
    if (document.fonts?.ready) document.fonts.ready.then(() => placeScribble(false));
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p class="status">The file list didn't load. If you opened index.html straight from your computer, open the site through its GitHub Pages link instead, then reload.</p>`;
  }
}

const mq = window.matchMedia("(max-width: 640px)");
const setPlaceholder = () => { qInput.placeholder = mq.matches ? "Search" : "Search subjects, notes, topics"; };
mq.addEventListener?.("change", setPlaceholder);
setPlaceholder();

load();
