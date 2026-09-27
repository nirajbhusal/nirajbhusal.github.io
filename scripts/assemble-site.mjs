#!/usr/bin/env node
/**
 * Assemble multi-page HTML into build-src/ for Vite.
 * Home keeps the Enter gate and hero. Every other section is its own page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  title: 'Niraj Bhusal — GovTech • AI Governance • Digital Public Infrastructure',
  description:
    'Niraj Bhusal — civil servant at the Office of the Hon. Finance Minister, Ministry of Finance, Nepal. GovTech • AI Governance • Digital Public Infrastructure. Highlighting the official Ministry of Finance (MoF) Rasuwa Flood Update Portal and personal civic tools.',
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
  community: '/community/',
  media: '/media/',
  play: '/games/',
  games: '/games/',
  contact: '/contact/',
  hero: '/',
};

const REDIRECTS = [
  { from: 'built', to: '/projects/', label: 'Projects' },
  { from: 'trainings', to: '/training/', label: 'Training' },
];

function read(rel) {
  return fs.readFileSync(path.join(site, rel), 'utf8').trim();
}

function stripGate(html) {
  return html.replaceAll(' data-gate-inert', '').replaceAll(' inert', '');
}

function promoteHeading(html) {
  return html.replace('<h2>', '<h1 class="page-title">').replace('</h2>', '</h1>');
}

function pageUrl(slug) {
  return slug ? `${ORIGIN}/${slug}/` : `${ORIGIN}/`;
}

function navHtml(activeSlug, locked) {
  const inert = locked ? ' data-gate-inert inert' : '';
  const links = PAGES.map((page) => {
    const current = page.slug === activeSlug;
    const attrs = current ? ' class="active" aria-current="page"' : '';
    return `    <a href="/${page.slug}/"${attrs}>${page.nav}</a>`;
  }).join('\n');
  return `  <nav id="site-nav" class="nav" aria-label="Primary"${inert}>\n${links}\n  </nav>`;
}

function overviewHtml() {
  const cards = PAGES.map(
    (page) => `      <a class="card index-card" href="/${page.slug}/">
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

function headHtml(page) {
  const url = pageUrl(page.slug);
  const hashLiteral = JSON.stringify(HASH_MAP);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script>
    try {
      if (localStorage.getItem("theme") === "light") {
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch (e) {}
  </script>
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
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
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
</head>`;
}

function documentFor(page, { home }) {
  const locked = home;
  const header = locked ? read('partials/header.html') : stripGate(read('partials/header.html'));
  const games = locked ? read('partials/games.html') : stripGate(read('partials/games.html'));
  const footer = locked ? read('partials/footer.html') : stripGate(read('partials/footer.html'));
  const gate = home ? `  ${read('partials/gate.html')}\n` : '';
  const overlayInert = locked ? ' data-gate-inert inert' : '';
  const mainInert = locked ? ' data-gate-inert inert' : '';
  const bodyClass = home ? ' class="gate-locked"' : '';
  const dataPage = home ? 'home' : page.slug;
  const main = home
    ? `${read('sections/hero.html')}\n${overviewHtml()}`
    : promoteHeading(read(`sections/${page.id}.html`));

  return `${headHtml(page)}
<body${bodyClass} data-page="${dataPage}">
${gate}  <canvas id="starfield" aria-hidden="true"></canvas>
  <div id="nebula" class="nebula" aria-hidden="true"></div>
  <div id="nav-overlay" class="nav-overlay" hidden${overlayInert}></div>

${header}

${navHtml(home ? '' : page.slug, locked)}

${games}

  <main${mainInert}>
${main}
  </main>

${footer}
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
