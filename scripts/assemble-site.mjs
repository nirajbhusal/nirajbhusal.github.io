#!/usr/bin/env node
/**
 * Assemble multi-page HTML into build-src/ for Vite.
 * Home is the hero plus a contents index. Every other section is its own page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publications } from '../src/site/data/publications.js';
import { ABOUT_FOCUS, ABOUT_PARAGRAPHS } from '../src/site/data/about.js';
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
      'Civil servant with 13 years in Nepal’s public service, now in the Office of the Hon. Finance Minister, Ministry of Finance (MoF). GovTech, AI governance, and digital public infrastructure.',
    blurb:
      '13 years in Nepal’s public service, now in the Finance Minister’s office — GovTech, AI governance, and DPI.',
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
    'Niraj Bhusal — civil servant at the Office of the Hon. Finance Minister, Ministry of Finance, Nepal. GovTech · AI Governance · Digital Transformation (DPI). Highlighting the official Ministry of Finance (MoF) Rasuwa Flood Update Portal and personal civic tools.',
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

function lineIcon(body) {
  return `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const SECTION_ICONS = {
  about: lineIcon(
    '<circle cx="12" cy="8" r="3.15"/><path d="M5.25 19.25v-.35c0-2.85 2.55-4.7 6.75-4.7s6.75 1.85 6.75 4.7v.35"/>'
  ),
  built: lineIcon(
    '<path d="M12 3.25 20.25 7.5 12 11.75 3.75 7.5 12 3.25z"/><path d="m3.75 12 8.25 4.25L20.25 12"/><path d="m3.75 16.25 8.25 4.25 8.25-4.25"/>'
  ),
  superintelligence: lineIcon(
    '<path d="M12 3.2 13.15 8.35 18.3 9.5 13.15 10.65 12 15.8 10.85 10.65 5.7 9.5 10.85 8.35z"/><path d="M18.1 14.2 18.7 16.5 21 17.1 18.7 17.7 18.1 20 17.5 17.7 15.2 17.1 17.5 16.5z"/>'
  ),
  experience: lineIcon(
    '<rect x="3.25" y="7.25" width="17.5" height="12" rx="2"/><path d="M9 7.25V6a1.75 1.75 0 0 1 1.75-1.75h2.5A1.75 1.75 0 0 1 15 6v1.25"/><path d="M3.25 12.25h17.5"/>'
  ),
  education: lineIcon(
    '<path d="m3 10 9-4.75L21 10l-9 4.75L3 10z"/><path d="M7.25 12.15v3.85c0 .35 2.1 2.15 4.75 2.15s4.75-1.8 4.75-2.15v-3.85"/><path d="M21 10.25V16"/>'
  ),
  trainings: lineIcon(
    '<circle cx="12" cy="9" r="4.75"/><path d="m9.15 13.15-1.15 6.35L12 16.85l4 2.65-1.15-6.35"/>'
  ),
  speaking: lineIcon(
    '<rect x="9" y="3.25" width="6" height="10.5" rx="3"/><path d="M6.75 11a5.25 5.25 0 0 0 10.5 0"/><path d="M12 16.25v3.5M9.25 19.75h5.5"/>'
  ),
  presentations: lineIcon(
    '<rect x="3.25" y="4" width="17.5" height="11.5" rx="1.6"/><path d="m8 19.75 4-4.15 4 4.15"/><path d="M7.5 8h5.25M7.5 11h3.5"/>'
  ),
  publications: lineIcon(
    '<path d="M5 4.75c2.15-1.15 4.05-.65 7 .85 2.95-1.5 4.85-2 7-.85v13.1c-2.15-1.15-4.05-.65-7 .85-2.95-1.5-4.85-2-7-.85z"/><path d="M12 5.6v13.1"/>'
  ),
  community: lineIcon(
    '<circle cx="9" cy="8.15" r="2.55"/><circle cx="16.1" cy="8.85" r="2.05"/><path d="M3.7 18.85v-.25c0-2.25 2.05-3.75 5.3-3.75s5.3 1.5 5.3 3.75"/><path d="M14.15 14.9c1.55-.3 3.15.2 4.15 1.2.85.85 1.35 1.95 1.35 2.75"/>'
  ),
  media: lineIcon(
    '<circle cx="12" cy="8.75" r="4.6"/><path d="m8.85 12.7-1.2 6.55L12 16.55l4.35 2.7-1.2-6.55"/>'
  ),
  play: lineIcon(
    '<circle cx="12" cy="12" r="8"/><path d="M12 4.15c2.15 2.35 3.25 4.95 3.25 7.85S14.15 17.5 12 19.85c-2.15-2.35-3.25-4.95-3.25-7.85S9.85 6.5 12 4.15"/><path d="M4.35 9.35h15.3M4.35 14.65h15.3"/>'
  ),
  contact: lineIcon(
    '<path d="m3.75 11.35 16.6-7.1-7.35 15.85-2.15-6.6-7.1-2.15z"/><path d="m11 13.5 9.35-9.25"/>'
  ),
};

const ARROW_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>`;

/** Visual order: Projects and Speaking share row 1; Games and Contact share the last row.
 *  Four columns on desktop, so each row is full. Superintelligence is not a section card. */
const CONTENTS_ORDER = [
  { id: 'built', layout: 'feature', hue: 205 },
  { id: 'about', hue: 214 },
  { id: 'experience', hue: 228 },
  { id: 'education', hue: 250 },
  { id: 'trainings', hue: 188 },
  { id: 'speaking', layout: 'wide', hue: 198 },
  { id: 'presentations', hue: 222 },
  { id: 'publications', hue: 266 },
  { id: 'community', hue: 168 },
  { id: 'media', hue: 36 },
  { id: 'play', layout: 'pair', hue: 206 },
  { id: 'contact', layout: 'pair', hue: 212 },
];

function tally(n, singular, plural = `${singular}s`) {
  if (!n) return '';
  return `${n} ${n === 1 ? singular : plural}`;
}

function plainText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const MONTH_INDEX = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function eventTimestamp(meta) {
  const yearMatch = meta.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const monthRe =
    /\b(January|February|March|April|May|June|July|August|September|Sept|Sep|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Oct|Nov|Dec)\b/gi;
  const months = [...meta.matchAll(monthRe)].map((match) => MONTH_INDEX[match[1].toLowerCase()]);
  if (!months.length) return null;
  const month = Math.max(...months);
  let day = 1;
  const range = meta.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\s+[A-Za-z]+\s+20\d{2}/);
  const single = meta.match(/(\d{1,2})\s+[A-Za-z]+\s+20\d{2}/);
  if (range) day = Number(range[2]);
  else if (single) day = Number(single[1]);
  return Date.UTC(Number(yearMatch[1]), month, day);
}

function dateLabel(meta) {
  const head = meta.split('·')[0].trim();
  if (/\b20\d{2}\b/.test(head)) return head;
  if (/\b20\d{2}\b/.test(meta)) return meta.trim();
  return '';
}

function projectNote(name, badge, meta) {
  const label = `${badge} ${meta}`;
  if (name === 'Rasuwa Flood Update Portal' && /official/i.test(label)) {
    return 'Ministry of Finance · Official';
  }
  if (name === 'Rasuwa Flood Update Portal' && /personal civic/i.test(label)) {
    return 'Personal civic project';
  }
  if (name === 'Centralized Email' || name === 'Cabinet Automation') {
    return 'Government system · contributor';
  }
  return badge || meta;
}

function projectPicks() {
  const html = read('sections/built.html');
  const articles = html.match(/<article\b[\s\S]*?<\/article>/g) || [];
  return articles.slice(0, 4).map((article) => {
    const name = plainText((article.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1]);
    const badge = plainText((article.match(/<span class="badge[^"]*">([\s\S]*?)<\/span>/) || [])[1]);
    const meta = plainText((article.match(/<p class="meta">([\s\S]*?)<\/p>/) || [])[1]);
    return { name, note: projectNote(name, badge, meta) };
  }).filter((item) => item.name);
}

function speakingPicks() {
  const html = read('sections/speaking.html');
  const articles = html.match(/<article\b[\s\S]*?<\/article>/g) || [];
  const events = articles.map((article) => {
    const name = plainText((article.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1]);
    const meta = plainText((article.match(/<p class="meta">([\s\S]*?)<\/p>/) || [])[1]);
    return { name, note: dateLabel(meta), time: eventTimestamp(meta) };
  }).filter((item) => item.name && item.time != null);
  events.sort((a, b) => b.time - a.time);
  return events.slice(0, 3).map(({ name, note }) => ({ name, note }));
}

function picksHtml(items) {
  if (!items.length) return '';
  const lis = items
    .map((item) => {
      const note = item.note
        ? `\n            <span class="index-pick-note">${escapeHtml(item.note)}</span>`
        : '';
      return `          <li>
            <span class="index-pick-name">${escapeHtml(item.name)}</span>${note}
          </li>`;
    })
    .join('\n');
  return `\n        <ul class="index-picks">\n${lis}\n        </ul>`;
}

function sectionPicks(id) {
  if (id === 'built') return picksHtml(projectPicks());
  if (id === 'speaking') return picksHtml(speakingPicks());
  return '';
}

function sectionStat(id) {
  if (id === 'superintelligence') return 'Personal essay';
  if (id === 'publications') {
    const n = publications.length;
    if (!n) return '';
    if (n === 1) {
      const type = String(publications[0].type || 'publication').toLowerCase();
      return `1 ${type}`;
    }
    return tally(n, 'publication');
  }

  const file = {
    about: 'sections/about.html',
    built: 'sections/built.html',
    experience: 'sections/experience.html',
    education: 'sections/education.html',
    trainings: 'sections/trainings.html',
    speaking: 'sections/speaking.html',
    presentations: 'sections/presentations.html',
    community: 'sections/community.html',
    media: 'sections/media.html',
    play: 'sections/play.html',
    contact: 'sections/contact.html',
  }[id];
  if (!file) return '';
  const html = read(file);

  if (id === 'about') {
    const focus = html.match(/<aside class="card focus-card">([\s\S]*?)<\/aside>/);
    return tally(focus ? (focus[1].match(/<li>/g) || []).length : 0, 'focus area');
  }
  if (id === 'built') return tally((html.match(/<article\b/g) || []).length, 'project');
  if (id === 'experience') {
    const roles = (html.match(/class="org-name"/g) || []).length;
    const joined = html.match(/Joined the civil service in [A-Za-z]+ (\d{4})/);
    const parts = [];
    if (roles) parts.push(tally(roles, 'posting'));
    if (joined) parts.push(`since ${joined[1]}`);
    return parts.join(' · ');
  }
  if (id === 'education') return tally((html.match(/<article\b/g) || []).length, 'degree');
  if (id === 'trainings') return tally((html.match(/class="chip"/g) || []).length, 'program');
  if (id === 'speaking') return tally((html.match(/class="card event-card"/g) || []).length, 'event');
  if (id === 'presentations') return tally((html.match(/<article\b/g) || []).length, 'deck');
  if (id === 'community') {
    return tally((html.match(/<article\b/g) || []).length, 'community', 'communities');
  }
  if (id === 'media') return tally((html.match(/class="media-card"/g) || []).length, 'listing');
  if (id === 'play') {
    const names = [];
    if (/data-open-game="basketball"/.test(html)) names.push('Basketball');
    if (/id="constellation"/.test(html)) names.push('constellation');
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return names[0] || '';
  }
  if (id === 'contact') return tally((html.match(/class="contact-card"/g) || []).length, 'link');
  return '';
}

function navItemHtml(item, activeSlug, size = 20) {
  const current = item.slug === activeSlug;
  const href = item.slug ? `/${item.slug}/` : '/';
  return `<a href="${href}"${linkAttrs(current)}>${iconSvg(ICONS[item.id] || 'sparkles', size)}<span class="side-label">${item.nav}</span></a>`;
}

const NAV_ITEMS = [
  { id: 'home', slug: '', nav: 'Home' },
  ...PAGES.filter((page) => page.id !== 'superintelligence').map((page) => ({
    id: page.id,
    slug: page.slug,
    nav: page.nav,
  })),
];

function overviewHtml() {
  const byId = new Map(PAGES.map((page) => [page.id, page]));
  const cards = CONTENTS_ORDER.map((slot) => {
    const page = byId.get(slot.id);
    const layout = slot.layout ? ` index-card--${slot.layout}` : '';
    const stat = sectionStat(slot.id);
    const statHtml = stat ? `\n          <span class="index-stat">${escapeHtml(stat)}</span>` : '';
    const icon = SECTION_ICONS[slot.id] || '';
    const picks = sectionPicks(slot.id);
    return `      <a class="index-card${layout}" href="/${page.slug}/" style="--h: ${slot.hue}">
        <span class="index-top">
          <span class="index-icon" aria-hidden="true">${icon}</span>
          <span class="index-intro">
            <span class="sheet-label">◇ ${page.nav.toUpperCase()}</span>
            <h3>${page.heading || page.nav}</h3>
            <p>${page.blurb}</p>
          </span>
        </span>${picks}
        <span class="index-foot">${statHtml}
          <span class="index-arrow" aria-hidden="true">${ARROW_ICON}</span>
        </span>
      </a>`;
  }).join('\n');
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
  return `<aside class="side-nav" id="site-nav" aria-label="Sections">
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

function aboutParagraphsHtml(indent) {
  return ABOUT_PARAGRAPHS.map((paragraph) => `${indent}<p>${escapeHtml(paragraph)}</p>`).join('\n');
}

function focusItemsHtml(indent) {
  return ABOUT_FOCUS.map((item) => {
    if (typeof item === 'string') return `${indent}<li>${escapeHtml(item)}</li>`;
    return `${indent}<li>${escapeHtml(item.before)}<a class="quiet-link" href="${item.href}">${escapeHtml(item.text)}</a></li>`;
  }).join('\n');
}

function aboutPageHtml() {
  return `<section id="about" class="section reveal">
      <p class="sheet-label">◇ SHEET 01 · ABOUT</p>
      <h2>About</h2>
      <div class="about-grid">
        <div class="about-copy">
${aboutParagraphsHtml('          ')}
        </div>
        <aside class="card focus-card">
          <h3>Focus</h3>
          <ul>
${focusItemsHtml('            ')}
          </ul>
        </aside>
      </div>
    </section>`;
}

function homeAboutHtml() {
  return `    <section id="home-about" class="section home-about reveal">
      <p class="sheet-label">◇ ABOUT</p>
      <h2>About</h2>
      <div class="home-about-grid">
        <div class="about-copy home-about-copy">
${aboutParagraphsHtml('          ')}
          <p class="home-about-more"><a href="/about/">More about me →</a></p>
        </div>
        <aside class="home-focus">
          <h3>Focus</h3>
          <ul>
${focusItemsHtml('            ')}
          </ul>
        </aside>
      </div>
    </section>`;
}

function drawerRowHtml(item, activeSlug, group) {
  const href = item.slug ? `/${item.slug}/` : '/';
  const icon = iconSvg(ICONS[item.id] || 'sparkles', 18);
  return `          <a class="md-row" href="${href}" data-nav-label="${escapeHtml(item.nav.toLowerCase())}" data-nav-group="${group}"${linkAttrs(item.slug === activeSlug)}>${icon}<span>${escapeHtml(item.nav)}</span></a>`;
}

function mobileDrawerHtml(activeSlug) {
  const byId = new Map(NAV_ITEMS.map((item) => [item.id, item]));
  const primary = ['home', 'about', 'built', 'speaking', 'publications']
    .map((id) => drawerRowHtml(byId.get(id), activeSlug, 'primary'))
    .join('\n');
  const sections = [
    'experience',
    'education',
    'trainings',
    'presentations',
    'community',
    'media',
    'play',
    'contact',
  ]
    .map((id) => drawerRowHtml(byId.get(id), activeSlug, 'sections'))
    .join('\n');
  return `<nav class="mobile-drawer" id="mobile-nav" aria-label="Menu" aria-hidden="true" tabindex="-1" inert>
      <div class="md-head">
        <label class="md-search">
          <span class="md-search-icon" aria-hidden="true">${iconSvg('search', 18)}</span>
          <input id="md-search" type="search" placeholder="Search" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Search menu" />
        </label>
        <button type="button" class="md-close" id="md-close" aria-label="Close menu">${iconSvg('x', 20)}</button>
      </div>
      <div class="md-scroll">
        <div class="md-group" data-nav-group-wrap="primary">
${primary}
        </div>
        <div class="md-group" data-nav-group-wrap="sections">
          <p class="md-section-label">Sections</p>
${sections}
        </div>
        <p class="md-empty" hidden>No matches</p>
      </div>
      <div class="md-profile">
        <img class="md-avatar" src="/portrait/niraj.webp" alt="" width="36" height="36" />
        <span class="md-profile-text">
          <span class="md-profile-name">Niraj Bhusal</span>
          <span class="md-profile-role">Ministry of Finance, Nepal</span>
        </span>
        <button type="button" class="md-settings-btn" id="md-settings-btn" aria-expanded="false" aria-controls="md-settings" aria-label="Settings">${iconSvg('settings', 18)}</button>
        <div class="md-settings" id="md-settings" hidden>
          ${soundControlHtml('m')}
          ${themeButtonHtml('theme-toggle-m')}
        </div>
      </div>
    </nav>`;
}

function mobileTopHtml() {
  return `<header class="mobile-top">
        <button type="button" id="nav-toggle" class="nav-toggle" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">${iconSvg('menu', 22)}</button>
      </header>`;
}

function headHtml(page, { home }) {
  const url = pageUrl(page.slug);
  const hashLiteral = JSON.stringify(HASH_MAP);
  const introStyle = home
    ? `<style>
    html.is-intro .hero-id,html.is-intro .eyebrow,html.is-intro .hero-name,html.is-intro .hero-posting,html.is-intro .hero-portrait,html.is-intro .tagline,html.is-intro .lede,html.is-intro .hero-chrono,html.is-intro .hero-actions,html.is-intro .home-about,html.is-intro .side-nav,html.is-intro .mobile-top,html.is-intro .games-launcher,html.is-intro #starfield{opacity:0}
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
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,500&display=swap" rel="stylesheet" />
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
    ? `${read('sections/hero.html')}\n${homeAboutHtml()}\n${overviewHtml()}`
    : promoteHeading(
        page.id === 'about'
          ? aboutPageHtml()
          : page.id === 'publications'
            ? publicationsSectionHtml(page)
            : read(`sections/${page.id}.html`)
      );

  return `${headHtml(page, { home })}
<body data-page="${dataPage}">
  <a class="skip-link" href="#content">Skip to content</a>
  <canvas id="starfield" aria-hidden="true"></canvas>
  <div class="app-shell">
    <button type="button" class="nav-scrim" id="nav-scrim" tabindex="-1" aria-label="Close menu"></button>
    ${sidebarHtml(activeSlug)}
    ${mobileDrawerHtml(activeSlug)}
    <div class="shell-main">
      ${mobileTopHtml(activeSlug)}
      <main id="content">
${main}
      </main>
      ${footer}
    </div>
  </div>
${games}
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
