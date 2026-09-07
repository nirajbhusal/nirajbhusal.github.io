const FACTS = [
  {
    label: 'Civil servant',
    text: 'Niraj Bhusal is a civil servant with the Government of Nepal (since September 2013), focused on public digital systems.',
  },
  {
    label: 'Ministry of Finance',
    text: 'Currently at the Ministry of Finance (Dec 2019 – Present), working on digital transformation, GovTech, and AI use-cases.',
  },
  {
    label: 'GovTech & DPI',
    text: 'Works on GovTech, AI governance, and digital public infrastructure (DPI). Founded the GovTech Nepal community.',
  },
  {
    label: 'Flood bulletin',
    text: 'Built the Rasuwa–Bhotekoshi Flood Bulletin as a personal civic project — not a government website.',
  },
  {
    label: 'MOFCOM · HUST',
    text: 'M.E. Information & Communication Engineering at HUST, China (2021–2023) on a MOFCOM Scholarship nominated by the Government of Nepal.',
  },
  {
    label: 'Gov contributions',
    text: 'Contributions (not ownership claims) include Centralized Email, Cabinet Automation, GIOMS, and early Nagarik App work.',
  },
  {
    label: 'Kathmandu',
    text: 'Based in Kathmandu, Nepal. Contact: niraj.bhusal@icloud.com',
  },
  {
    label: 'OPMCM years',
    text: 'At OPMCM (Jun 2017–Dec 2019), after Ministry of Water Supply and Ministry of Urban Development.',
  },
];

export function initConstellation(canvas, panel) {
  const ctx = canvas.getContext('2d');
  const nodes = FACTS.map((f, i) => {
    const angle = (i / FACTS.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 120 + (i % 2) * 28;
    return {
      ...f,
      x: canvas.width / 2 + Math.cos(angle) * radius,
      y: canvas.height / 2 + Math.sin(angle) * radius,
      r: 7,
      active: false,
    };
  });
  let selected = -1;

  function draw() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = light ? '#efece6' : '#07080e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = light ? 'rgba(26,115,199,0.35)' : 'rgba(59,158,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    nodes.forEach((n, i) => {
      if (i === 0) ctx.moveTo(n.x, n.y);
      else ctx.lineTo(n.x, n.y);
    });
    ctx.closePath();
    ctx.stroke();

    // faint spokes to center
    ctx.strokeStyle = light ? 'rgba(18,20,26,0.08)' : 'rgba(255,255,255,0.06)';
    for (const n of nodes) {
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      ctx.lineTo(n.x, n.y);
      ctx.stroke();
    }

    nodes.forEach((n, i) => {
      const on = i === selected;
      ctx.beginPath();
      ctx.arc(n.x, n.y, on ? n.r + 3 : n.r, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#3b9eff' : light ? '#2a2e3a' : '#d7d9e0';
      ctx.fill();
      if (on) {
        ctx.strokeStyle = 'rgba(59,158,255,0.5)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = light ? '#5c6170' : '#8b8f9c';
      ctx.font = '11px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y + 22);
    });
  }

  function pick(mx, my) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (Math.hypot(mx - n.x, my - n.y) <= n.r + 10) {
        selected = i;
        panel.textContent = n.text;
        draw();
        return;
      }
    }
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    pick((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  });

  draw();
  return { draw };
}
