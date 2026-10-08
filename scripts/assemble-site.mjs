#!/usr/bin/env node
/**
 * Assemble multi-page HTML into build-src/ for Vite.
 * Home is the hero plus a contents index. Every other section is its own page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publications } from '../src/site/data/publications.js';
import { iconSvg } from '../src/site/icons.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'src', 'site');
const buildSrc = path.join(root, 'build-src');
const ORIGIN = 'https://nirajbhusal.github.io';

const PAGES = [
  {
    id: 'about',
    slug: 'about',
    nav: 'About',
    title: 'About — Niraj Bhusal',
    description:
      'About Niraj Bhusal, a civil servant at the Office of the Hon. Finance Minister, Ministry of Finance, Nepal, working on GovTech, AI governance, and digital public infrastructure.',
    blurb:
      'Civil servant at the Ministry of Finance, working across GovTech, AI governance, and digital public infrastructure.',
  },
  {
    id: 'built',
    slug: 'projects',
    nav: 'Projects',
    heading: 'Projects',
    title: 'Projects — Niraj Bhusal',
    description:
      'Projects Niraj Bhusal has shipped or contributed to, including the official Ministry of Finance Rasuwa Flood Update Portal and a personal civic flood bulletin.',
    blurb:
      'The official MoF Rasuwa Flood Update Portal, a personal civic bulletin, and government systems he has contributed to.',
  },
  {
    id: 'superintelligence',
    slug: 'superintelligence',
    nav: 'Superintelligence',
    heading: 'Preparing Government for Superintelligence',
    title: 'Preparing Government for Superintelligence — Niraj Bhusal',
    description:
      'A personal view by Niraj Bhusal on why governments, including Nepal, should start preparing for advanced AI and possible superintelligence. Not an official position of the Government of Nepal.',
    blurb:
      'A personal view on why governments, including Nepal, should start preparing for advanced AI and superintelligence.',
  },
  {
    id: 'experience',
    slug: 'experience',
    nav: 'Experience',
    title: 'Experience — Niraj Bhusal',
    description:
      'Niraj Bhusal’s civil service since 2013, including the Office of the Hon. Finance Minister, the Office of the Prime Minister, and earlier ministry postings.',
    blurb:
      'Civil service since 2013 — the Finance Minister’s office, OPMCM, Water Supply, and Urban Development.',
  },
  {
    id: 'education',
    slug: 'education',
    nav: 'Education',
    title: 'Education — Niraj Bhusal',
    description:
      'Niraj Bhusal’s education: an M.E. in Information and Communication Engineering at HUST, China, and a BICT from Tribhuvan University.',
    blurb: 'M.E. in Information and Communication Engineering at HUST, and BICT from Tribhuvan University.',
  },
  {
    id: 'trainings',
    slug: 'training',
    nav: 'Training',
    heading: 'Training',
    title: 'Training — Niraj Bhusal',
    description:
      'Training Niraj Bhusal has completed in AI governance, digital transformation, and public-sector technology.',
    blurb: 'AI governance, digital transformation, and public-sector technology courses and fellowships.',
  },
  {
    id: 'speaking',
    slug: 'speaking',
    nav: 'Speaking',
    title: 'Speaking — Niraj Bhusal',
    description:
      'Talks, panels, and training sessions by Niraj Bhusal, including Digital Nepal Conclave 2026 and the JCI Nepal Area B conference.',
    blurb: 'Talks and panels, from Digital Nepal Conclave 2026 to training sessions and regional summits.',
  },
  {
    id: 'presentations',
    slug: 'presentations',
    nav: 'Presentations',
    title: 'Presentations — Niraj Bhusal',
    description:
      'Slide decks by Niraj Bhusal, including Data From Disaster at Digital Nepal Conclave 2026 and AI: Aim, Act, Achieve for JCI Nepal.',
    blurb: 'Slide decks, including Data From Disaster and AI: Aim, Act, Achieve.',
  },
  {
    id: 'publications',
    slug: 'publications',
    nav: 'Publications',
    heading: 'Papers &amp; Publications',
    title: 'Papers & Publications — Niraj Bhusal',
    description:
      'Papers and magazine articles by Niraj Bhusal, including Government Services in Our Pocket in NEFport Issue 66 from the Nepal Economic Forum.',
    blurb:
      'Magazine writing, including an article in NEFport on digital public services and digital democracy.',
  },
  {
    id: 'community',
    slug: 'community',
    nav: 'Community',
    title: 'Community — Niraj Bhusal',
    description:
      'Communities Niraj Bhusal has founded or led, including GovTech Nepal, GDG Dang, TechSathi, and Google Crowdsource.',
    blurb: 'GovTech Nepal, GDG Dang, TechSathi, Google Crowdsource, and TheirWorld.',
  },
  {
    id: 'media',
    slug: 'media',
    nav: 'Media',
    heading: 'Awards &amp; Media',
    title: 'Awards & Media — Niraj Bhusal',
    description:
      'Awards, news coverage, and speaking mentions for Niraj Bhusal, including reporting on the 2026 flood response and Digital Nepal Conclave.',
    blurb: 'Awards, news coverage, and speaking mentions, including the 2026 flood response.',
  },
  {
    id: 'play',
    slug: 'games',
    nav: 'Games',
    title: 'Games — Niraj Bhusal',
    description: 'A quiet basketball game and a clickable constellation of facts on Niraj Bhusal’s personal site.',
    blurb: 'A quiet basketball game and a constellation of facts.',
  },
  {
    id: 'contact',
    slug: 'contact',
    nav: 'Contact',
    title: 'Contact — Niraj Bhusal',
    description:
      'Reach Niraj Bhusal through the Contact action, LinkedIn, X, and links to the official and personal Rasuwa flood portals.',
    blurb: 'Reach him through the Contact action, LinkedIn, X, and the flood portals.',
  },
];

const HOME = {
  slug: '',
  title: 'Niraj Bhusal — GovTech · AI Governance · Digital Transformation (DPI)',
  description:
    'Niraj Bhusal — civil servant at the Office of the Hon. Finance Minister, Ministry of Finance, Nepal. GovTech · AI Governance · Digital Transformation (DPI). Now exploring how governments can prepare for superintelligence. Highlighting the official Ministry of Finance (MoF) Rasuwa Flood Update Portal and personal civic tools.',
};

const HASH_MAP = {
  about: '/about/',
  built: '/projects/',
  projects: '/projects/',
  experience: '/experience/',
  education: '/education/',
  trainings: '/training/',
  training: '/training/',
  speaking: '/speaking/',
  presentations: '/presentations/',
  publications: '/publications/',
  community: '/community/',
  media: '/media/',
  play: '/games/',
  games: '/games/',
  contact: '/contact/',
  superintelligence: '/superintelligence/',
  hero: '/',
};

const ICONS = {
  home: 'house',
  about: 'user',
  built: 'grid',
  superintelligence: 'sparkles',
  experience: 'briefcase',
  education: 'grad',
  trainings: 'book',
  speaking: 'mic',
  presentations: 'presentation',
  publications: 'file',
  community: 'users',
  media: 'award',
  play: 'gamepad',
  contact: 'mail',
};

const TAB_SLUGS = new Set(['projects', 'speaking', 'publications']);

const THEME_BOOT = `(function () {
  try {
    var params = new URLSearchParams(location.search);
    var override = params.get("daypart");
    var valid = override === "morning" || override === "afternoon" || override === "evening" || override === "night";
    var hour = new Date().getHours();
    var part = hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 16 ? "afternoon" : hour >= 16 && hour < 19 ? "evening" : "night";
    if (valid) part = override;
    var saved = localStorage.getItem("theme");
    var mode = saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
    var palette = valid ? part : mode === "light" ? "afternoon" : mode === "dark" ? "night" : part;
    var theme = palette === "morning" || palette === "afternoon" ? "light" : "dark";
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-daypart", part);
    root.setAttribute("data-palette", palette);
    root.setAttribute("data-theme-mode", mode);
    root.style.colorScheme = theme;
    if (localStorage.getItem("nb-sidebar") === "collapsed") root.setAttribute("data-sidebar", "collapsed");
  } catch (e) {}
})();`;

const INTRO_BOOT = `(function () {
  try {
    if (document.body && document.body.getAttribute("data-page") !== "home") return;
  } catch (e) {}
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var intro = "";
  var seen = false;
  try {
    intro = new URLSearchParams(location.search).get("intro") || "";
    seen = sessionStorage.getItem("nb-intro-seen") === "1";
  } catch (e) {}
  var root = document.documentElement;
  if (reduce) {
    if (intro === "1" || (intro !== "0" && !seen)) root.classList.add("is-intro-fade");
    return;
  }
  if (intro === "1" || (intro !== "0" && !seen)) root.classList.add("is-intro");
})();`;

const REDIRECTS = [
  { from: 'built', to: '/projects/', label: 'Projects' },
  { from: 'trainings', to: '/training/', label: 'Training' },
];

function read(rel) {
  return fs.readFileSync(path.join(site, rel), 'utf8').trim();
}

function promoteHeading(html) {
  return html.replace('<h2>', '<h1 class="page-title">').replace('</h2>', '</h1>');
}

function pageUrl(slug) {
  return slug ? `${ORIGIN}/${slug}/` : `${ORIGIN}/`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function publicationVenue(item) {
  if (item.publication) return item.publication;
  let line = item.venue || '';
  if (item.issue) line += `${line ? ', ' : ''}Issue ${item.issue}`;
  if (item.issueTitle) line += ` — “${item.issueTitle}”`;
  return line;
}

function publicationCitation(item) {
  const pages = item.pages
    ? /^pp\.?\s/i.test(item.pages)
      ? item.pages
      : `pp. ${item.pages}`
    : '';
  return [item.author, publicationVenue(item), item.publisher, item.date, pages]
    .filter(Boolean)
    .join(' · ');
}

function publicationsSectionHtml(page) {
  const numbered = PAGES.filter((item) => item.id !== 'superintelligence');
  const sheet = String(numbered.indexOf(page) + 1).padStart(2, '0');
  const cards = publications
    .map((item) => {
      const badge = escapeHtml(item.type || 'Publication');
      const title = escapeHtml(item.title || 'Untitled');
      const citation = escapeHtml(publicationCitation(item));
      const description = item.description ? `\n          <p>${escapeHtml(item.description)}</p>` : '';
      const link = item.url
        ? `\n          <div class="card-actions">
            <a class="btn btn-primary" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.linkLabel || 'Read')}</a>
          </div>`
        : '';
      return `        <article class="card event-card">
          <span class="badge">${badge}</span>
          <h3>${title}</h3>
          <p class="meta">${citation}</p>${description}${link}
        </article>`;
    })
    .join('\n');

  return `<section id="publications" class="section reveal">
      <p class="sheet-label">◇ SHEET ${sheet} · PUBLICATIONS</p>
      <h2>${page.heading || page.nav}</h2>
      <div class="event-grid">
${cards}
      </div>
    </section>`;
}

function linkAttrs(current) {
  return current ? ' aria-current="page"' : '';
}

function navItemHtml(item, activeSlug, size = 20) {
  const current = item.slug === activeSlug;
  const href = item.slug ? `/${item.slug}/` : '/';
  return `<a href="${href}"${linkAttrs(current)}>${iconSvg(ICONS[item.id] || 'sparkles', size)}<span class="side-label">${item.nav}</span></a>`;
}

const NAV_ITEMS = [
  { id: 'home', slug: '', nav: 'Home' },
  ...PAGES.map((page) => ({ id: page.id, slug: page.slug, nav: page.nav })),
];

function overviewHtml() {
  const cards = PAGES.map(
    (page) => `      <a class="card index-card" href="/${page.slug}/">
        <span class="index-icon" aria-hidden="true">${iconSvg(ICONS[page.id] || 'sparkles', 20)}</span>
        <span class="sheet-label">◇ ${page.nav.toUpperCase()}</span>
        <h3>${page.heading || page.nav}</h3>
        <p>${page.blurb}</p>
      </a>`
  ).join('\n');
  return `    <section id="sections" class="section home-index reveal">
      <p class="sheet-label">◇ CONTENTS</p>
      <h2>Sections</h2>
      <div class="index-grid">
${cards}
      </div>
    </section>`;
}

function themeIcons() {
  return ['sunrise', 'sun', 'sunset', 'moon']
    .map(
      (name) =>
        `<span class="theme-ico theme-ico-${name}">${iconSvg(name, 20)}</span>`
    )
    .join('');
}

function soundControlHtml(suffix) {
  const id = (name) => (suffix ? `${name}-${suffix}` : name);
  return `<div class="sound-control" role="group" aria-label="Ambient sound volume">
        <button type="button" id="${id('sound-vol-down')}" class="sound-vol-btn" aria-label="Decrease volume" title="Volume down">−</button>
        <button type="button" id="${id('sound-toggle')}" class="sound-toggle" aria-pressed="false" aria-label="Sound off" title="Ambient sound" data-vol-level="0">
          <span class="sound-icon" aria-hidden="true">
            <svg class="sound-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 10v4h3l4 3V7L7 10H4z"/>
              <path class="sound-wave sound-wave-1" d="M14.5 9.5a3.5 3.5 0 0 1 0 5"/>
              <path class="sound-wave sound-wave-2" d="M16.8 7.5a6.5 6.5 0 0 1 0 9"/>
              <line class="sound-mute-slash" x1="4" y1="4" x2="20" y2="20"/>
            </svg>
          </span>
          <span class="sound-label">Vol</span>
        </button>
        <button type="button" id="${id('sound-vol-up')}" class="sound-vol-btn" aria-label="Increase volume" title="Volume up">+</button>
      </div>`;
}

function themeButtonHtml(id) {
  return `<button type="button" id="${id}" class="theme-cycle" aria-label="Theme: Auto" title="Auto">
        ${themeIcons()}
        <span class="theme-cycle-label"></span>
      </button>`;
}

function sidebarHtml(activeSlug) {
  const home = activeSlug === '';
  const links = NAV_ITEMS.map((item) => `        ${navItemHtml(item, activeSlug)}`).join('\n');
  return `<aside class="side-nav" aria-label="Sections">
      <div class="side-brand">
        <a class="brand-lockup" href="/"${home ? ' aria-current="page"' : ''} aria-label="Niraj Bhusal, home">
          <span class="logo-mark">NB</span>
          <span class="wordmark">Niraj Bhusal</span>
        </a>
        <button type="button" id="sidebar-collapse" class="icon-btn side-collapse" aria-pressed="false" aria-label="Collapse sidebar" title="Collapse sidebar">${iconSvg('panel', 20)}</button>
      </div>
      <nav class="side-links" aria-label="Primary">
${links}
      </nav>
      <div class="side-foot">
        ${soundControlHtml('')}
        ${themeButtonHtml('theme-toggle')}
      </div>
    </aside>`;
}

function mobileTopHtml(activeSlug) {
  const home = activeSlug === '';
  return `<header class="mobile-top">
        <a class="brand-lockup" href="/"${home ? ' aria-current="page"' : ''}>
          <span class="logo-mark">NB</span>
          <span class="wordmark">Niraj Bhusal</span>
        </a>
        <div class="mobile-tools">
          ${soundControlHtml('m')}
          ${themeButtonHtml('theme-toggle-m')}
        </div>
      </header>`;
}

function tabBarHtml(activeSlug) {
  const primary = NAV_ITEMS.filter((item) => item.slug === '' || TAB_SLUGS.has(item.slug));
  const links = primary
    .map((item) => `      ${navItemHtml(item, activeSlug, 22)}`)
    .join('\n');
  const moreCurrent = activeSlug && !TAB_SLUGS.has(activeSlug);
  return `<nav class="tab-bar" aria-label="Sections">
${links}
      <button type="button" id="more-tab" aria-expanded="false" aria-controls="more-sheet"${moreCurrent ? ' aria-current="page"' : ''}>${iconSvg('ellipsis', 22)}<span>More</span></button>
    </nav>`;
}

function moreSheetHtml(activeSlug) {
  const rest = NAV_ITEMS.filter((item) => item.slug && !TAB_SLUGS.has(item.slug));
  const links = rest
    .map((item) => `        ${navItemHtml(item, activeSlug)}`)
    .join('\n');
  return `<div class="more-layer" id="more-sheet" hidden>
      <button type="button" class="more-scrim" aria-label="Close menu" data-more-close></button>
      <div class="more-panel" role="dialog" aria-modal="true" aria-label="More sections">
${links}
      </div>
    </div>`;
}

function headHtml(page, { home }) {
  const url = pageUrl(page.slug);
  const hashLiteral = JSON.stringify(HASH_MAP);
  const introStyle = home
    ? `<style>
    html.is-intro .hero-id,html.is-intro .eyebrow,html.is-intro .hero-name,html.is-intro .hero-posting,html.is-intro .hero-portrait,html.is-intro .tagline,html.is-intro .si-pill,html.is-intro .lede,html.is-intro .hero-chrono,html.is-intro .hero-actions,html.is-intro .side-nav,html.is-intro .mobile-top,html.is-intro .tab-bar,html.is-intro .games-launcher,html.is-intro #starfield{opacity:0}
    html.is-intro-fade body::after{content:"";position:fixed;inset:0;z-index:80;background:var(--bg,#0b1220);pointer-events:none;animation:nb-veil .45s ease forwards}
    @keyframes nb-veil{to{opacity:0}}
  </style>`
    : '';
  const introBoot = home ? `<script>${INTRO_BOOT}</script>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>${THEME_BOOT}</script>
  <title>${page.title}</title>
  <meta name="description" content="${page.description}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:title" content="${page.title}" />
  <meta property="og:description" content="${page.description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  ${introStyle}
  <script>
    (function () {
      var map = ${hashLiteral};
      var hash = (location.hash || "").replace(/^#/, "").toLowerCase();
      if (!map[hash]) return;
      var target = map[hash];
      var path = location.pathname.replace(/\\/index\\.html$/, "");
      if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
      var norm = target === "/" ? "/" : target.replace(/\\/$/, "");
      if (path !== norm) location.replace(target);
    })();
  </script>
  ${introBoot}
</head>`;
}

function documentFor(page, { home }) {
  const activeSlug = home ? '' : page.slug;
  const dataPage = home ? 'home' : page.slug;
  const games = read('partials/games.html');
  const footer = read('partials/footer.html');
  const main = home
    ? `${read('sections/hero.html')}\n${overviewHtml()}`
    : promoteHeading(
        page.id === 'publications' ? publicationsSectionHtml(page) : read(`sections/${page.id}.html`)
      );

  return `${headHtml(page, { home })}
<body data-page="${dataPage}">
  <a class="skip-link" href="#content">Skip to content</a>
  <canvas id="starfield" aria-hidden="true"></canvas>
  <div class="app-shell">
    ${sidebarHtml(activeSlug)}
    <div class="shell-main">
      ${mobileTopHtml(activeSlug)}
      <main id="content">
${main}
      </main>
      ${footer}
    </div>
  </div>
${games}
${tabBarHtml(activeSlug)}
${moreSheetHtml(activeSlug)}
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`;
}

function linkInto(buildDir, name, target) {
  const dest = path.join(buildDir, name);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.symlinkSync(target, dest);
}

function main() {
  fs.rmSync(buildSrc, { recursive: true, force: true });
  fs.mkdirSync(buildSrc, { recursive: true });
  linkInto(buildSrc, 'src', path.join(root, 'src'));
  linkInto(buildSrc, 'public', path.join(root, 'public'));

  const homeHtml = documentFor(HOME, { home: true });
  fs.writeFileSync(path.join(buildSrc, 'index.html'), homeHtml);
  fs.writeFileSync(path.join(root, 'index.source.html'), homeHtml);

  for (const page of PAGES) {
    const dir = path.join(buildSrc, page.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), documentFor(page, { home: false }));
  }

  for (const redirect of REDIRECTS) {
    const dir = path.join(buildSrc, redirect.from);
    fs.mkdirSync(dir, { recursive: true });
    const target = `${ORIGIN}${redirect.to}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redirecting to ${redirect.label}…</title>
  <link rel="canonical" href="${target}" />
  <meta http-equiv="refresh" content="0; url=${redirect.to}" />
  <script>location.replace(${JSON.stringify(redirect.to)});</script>
</head>
<body>
  <p><a href="${redirect.to}">${redirect.label}</a></p>
</body>
</html>
`;
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }

  console.log(`assembled ${PAGES.length + 1} pages into ${buildSrc}`);
}

main();
