/* ═══════════════════════════════════════════
   EtherFlow — app.js
   D3.js Bubble Chart + PHP fetch integration
═══════════════════════════════════════════ */

'use strict';

// ── State ─────────────────────────────────
let lastResults = null;
let lastMultiplier = 5;

// ── DOM Refs ──────────────────────────────
const dataInput       = document.getElementById('dataInput');
const fileInput       = document.getElementById('fileInput');
const uploadZone      = document.getElementById('uploadZone');
const multiplierSlider= document.getElementById('multiplierSlider');
const sliderVal       = document.getElementById('sliderVal');
const sliderLabel     = document.getElementById('sliderLabel');
const runBtn          = document.getElementById('runBtn');
const alertBox        = document.getElementById('alertBox');
const spinner         = document.getElementById('spinner');
const tooltip         = document.getElementById('tooltip');
const tablePanel      = document.getElementById('tablePanel');
const tableBody       = document.getElementById('tableBody');
const tableCount      = document.getElementById('tableCount');
const chartSubtitle   = document.getElementById('chartSubtitle');

// ── Slider label logic ────────────────────
multiplierSlider.addEventListener('input', () => {
  const v = parseFloat(multiplierSlider.value);
  sliderVal.textContent = v;
  if (v <= 4)       sliderLabel.textContent = '🐬 DOLPHIN';
  else if (v <= 7)  sliderLabel.textContent = '🐋 WHALE';
  else              sliderLabel.textContent = '🌊 BLUE WHALE';

  // Re-run detection live if we have data
  if (lastResults) runDetection();
});

// ── File Upload ───────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));

uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) readFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) readFile(fileInput.files[0]);
});

function readFile(file) {
  const reader = new FileReader();
  reader.onload = e => { dataInput.value = e.target.result.trim(); };
  reader.readAsText(file);
}

// ── Run Button ────────────────────────────
runBtn.addEventListener('click', runDetection);

async function runDetection() {
  const raw = dataInput.value.trim();
  if (!raw) { showError('No data provided. Paste CSV data or upload a file.'); return; }

  hideError();
  showSpinner(true);
  runBtn.disabled = true;

  const multiplier = parseFloat(multiplierSlider.value);

  try {
    const formData = new FormData();
    formData.append('data', raw);
    formData.append('multiplier', multiplier);

    const res = await fetch('detect.php', { method: 'POST', body: formData });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const json = await res.json();

    if (json.error) { showError(json.error); return; }

    lastResults   = json;
    lastMultiplier = multiplier;

    updateStats(json);
    renderChart(json);
    renderTable(json);

  } catch (err) {
    showError('Failed to reach detect.php. Is XAMPP/Laragon running? ' + err.message);
  } finally {
    showSpinner(false);
    runBtn.disabled = false;
  }
}

// ── Update Stat Cards ─────────────────────
function updateStats(json) {
  document.getElementById('statTotal').textContent  = json.count;
  document.getElementById('statWhales').textContent = json.whale_count;
  document.getElementById('statNormal').textContent = json.normal_count;
  document.getElementById('statMedian').textContent = formatVol(json.global_median);
  document.getElementById('statStd').textContent    = formatVol(json.global_std);
  chartSubtitle.textContent = `${json.count} transactions · ${json.whale_count} anomalies`;
}

// ── D3 Bubble Chart ───────────────────────
function renderChart(json) {
  const container = document.getElementById('chart');
  container.innerHTML = '';

  const results = json.results;
  if (!results || results.length === 0) return;

  // Dimensions
  const margin = { top: 20, right: 20, bottom: 60, left: 70 };
  const totalW  = container.clientWidth || 800;
  const totalH  = 360;
  const W = totalW - margin.left - margin.right;
  const H = totalH - margin.top  - margin.bottom;

  const svg = d3.select('#chart')
    .append('svg')
    .attr('width',  totalW)
    .attr('height', totalH)
    .attr('id', 'mainSvg');

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // ── Scales ─────────────────────────────
  const xVals = results.map((_, i) => i);
  const xScale = d3.scaleLinear()
    .domain([0, results.length - 1])
    .range([0, W]);

  const maxVol = d3.max(results, d => d.volume);
  const yScale = d3.scaleLinear()
    .domain([0, maxVol * 1.15])
    .range([H, 0]);

  // Bubble radius: sqrt scaling so area is proportional to volume
  const rScale = d3.scaleSqrt()
    .domain([0, maxVol])
    .range([3, Math.min(W, H) * 0.18]);

  // ── Gridlines ──────────────────────────
  g.append('g')
    .attr('class', 'ef-gridlines')
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-W).tickFormat(''))
    .selectAll('line')
    .style('stroke', 'var(--border)')
    .style('stroke-dasharray', '2,4');

  g.select('.ef-gridlines .domain').remove();

  // ── Axes ───────────────────────────────
  // X axis
  const xAxisG = g.append('g')
    .attr('class', 'ef-axis')
    .attr('transform', `translate(0,${H})`)
    .call(
      d3.axisBottom(xScale)
        .ticks(Math.min(results.length, 10))
        .tickFormat(i => {
          const pt = results[Math.round(i)];
          if (!pt) return '';
          // Show short timestamp
          const ts = pt.timestamp;
          // Try to extract time portion
          const match = ts.match(/(\d{2}:\d{2})/);
          return match ? match[1] : String(Math.round(i));
        })
    );

  xAxisG.selectAll('text')
    .style('fill', 'var(--text-secondary)')
    .style('font-family', 'var(--font-mono)')
    .style('font-size', '0.58rem')
    .attr('transform', 'rotate(-35)')
    .attr('text-anchor', 'end');

  xAxisG.select('.domain').style('stroke', 'var(--border)');
  xAxisG.selectAll('line').style('stroke', 'var(--border)');

  // Y axis
  const yAxisG = g.append('g')
    .attr('class', 'ef-axis')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => formatVolShort(d)));

  yAxisG.selectAll('text')
    .style('fill', 'var(--text-secondary)')
    .style('font-family', 'var(--font-mono)')
    .style('font-size', '0.58rem');

  yAxisG.select('.domain').style('stroke', 'var(--border)');
  yAxisG.selectAll('line').style('stroke', 'var(--border)');

  // Y label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -H / 2).attr('y', -55)
    .attr('text-anchor', 'middle')
    .style('fill', 'var(--text-muted)')
    .style('font-family', 'var(--font-mono)')
    .style('font-size', '0.6rem')
    .text('TRANSACTION VOLUME');

  // ── Median line ─────────────────────────
  const medianLine = d3.line()
    .x((d, i) => xScale(i))
    .y(d  => yScale(d.window_median))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(results)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(0,229,255,0.25)')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('d', medianLine);

  g.append('text')
    .attr('x', W - 2)
    .attr('y', yScale(results[results.length - 1].window_median) - 6)
    .attr('text-anchor', 'end')
    .style('fill', 'rgba(0,229,255,0.4)')
    .style('font-family', 'var(--font-mono)')
    .style('font-size', '0.55rem')
    .text('rolling median');

  // ── Bubbles ─────────────────────────────
  // Draw normal first (bottom layer)
  const normalPts = results.filter(d => !d.is_whale);
  const whalePts  = results.filter(d =>  d.is_whale);

  // Normal bubbles
  g.selectAll('.bubble-normal')
    .data(normalPts)
    .enter()
    .append('circle')
    .attr('class', 'bubble-normal')
    .attr('cx', d => xScale(d.index))
    .attr('cy', d => yScale(d.volume))
    .attr('r',  d => Math.max(4, rScale(d.volume) * 0.5))
    .attr('fill', 'rgba(0,191,165,0.6)')
    .attr('stroke', 'rgba(0,191,165,0.9)')
    .attr('stroke-width', 0.8)
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => showTooltip(event, d))
    .on('mouseleave', hideTooltip);

  // Whale / Dolphin bubbles (glow rings first)
  whalePts.forEach(d => {
    const cx = xScale(d.index);
    const cy = yScale(d.volume);
    const r  = rScale(d.volume);
    const color = severityColor(d.severity);

    // Outer glow ring
    g.append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', r * 1.35)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1)
      .attr('opacity', 0.2);

    // Main whale bubble
    g.append('circle')
      .attr('class', 'bubble-whale')
      .datum(d)
      .attr('cx', cx).attr('cy', cy)
      .attr('r', r)
      .attr('fill', color)
      .attr('fill-opacity', 0.25)
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mousemove', (event, d) => showTooltip(event, d))
      .on('mouseleave', hideTooltip);

    // Emoji label for whales
    if (r > 20) {
      g.append('text')
        .attr('x', cx).attr('y', cy + 4)
        .attr('text-anchor', 'middle')
        .style('font-size', Math.min(r * 0.55, 22) + 'px')
        .style('pointer-events', 'none')
        .style('user-select', 'none')
        .text(severityEmoji(d.severity));
    }
  });
}

// ── Tooltip ───────────────────────────────
function showTooltip(event, d) {
  const cls = d.is_whale ? `ef-tooltip-${d.severity === 'blue_whale' ? 'whale' : d.severity}` : 'ef-tooltip-normal';
  const title = d.is_whale
    ? `${severityEmoji(d.severity)} ${d.severity.replace('_', ' ').toUpperCase()}`
    : '✅ NORMAL TRANSACTION';

  tooltip.innerHTML = `
    <div class="ef-tooltip-title ${cls}">${title}</div>
    <div class="ef-tooltip-row"><span class="ef-tooltip-key">Timestamp</span><span class="ef-tooltip-val">${d.timestamp}</span></div>
    <div class="ef-tooltip-row"><span class="ef-tooltip-key">Volume</span><span class="ef-tooltip-val">${formatVol(d.volume)}</span></div>
    <div class="ef-tooltip-row"><span class="ef-tooltip-key">Window Median</span><span class="ef-tooltip-val">${formatVol(d.window_median)}</span></div>
    <div class="ef-tooltip-row"><span class="ef-tooltip-key">Deviation</span><span class="ef-tooltip-val" style="color:${d.is_whale ? severityColor(d.severity) : 'var(--teal)'}">+${d.deviation_pct}%</span></div>
    <div class="ef-tooltip-row"><span class="ef-tooltip-key">Z-Score</span><span class="ef-tooltip-val">${d.z_score.toFixed(2)}σ</span></div>
  `;

  tooltip.classList.add('visible');
  moveTooltip(event);
}

function moveTooltip(event) {
  const x = event.clientX + 14;
  const y = event.clientY - 10;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

// ── Table ─────────────────────────────────
function renderTable(json) {
  const whales = json.results.filter(r => r.is_whale);
  tableCount.textContent = `${whales.length} anomalies detected`;
  tablePanel.style.display = 'block';

  // Show all, whales at top
  const sorted = [
    ...json.results.filter(r => r.is_whale).sort((a,b) => b.deviation_pct - a.deviation_pct),
    ...json.results.filter(r => !r.is_whale)
  ];

  tableBody.innerHTML = sorted.map(r => `
    <tr class="${r.is_whale ? (r.severity === 'blue_whale' ? 'row-whale' : 'row-dolphin') : ''}">
      <td>${r.index + 1}</td>
      <td>${r.timestamp}</td>
      <td>${formatVol(r.volume)}</td>
      <td>${formatVol(r.window_median)}</td>
      <td style="color:${r.is_whale ? severityColor(r.severity) : 'var(--teal)'}">
        +${r.deviation_pct}%
      </td>
      <td>${r.z_score.toFixed(2)}σ</td>
      <td>
        ${r.is_whale
          ? `<span class="badge-${r.severity.replace('_','-')}">${severityEmoji(r.severity)} ${r.severity.replace('_',' ').toUpperCase()}</span>`
          : '<span style="color:var(--teal);font-size:0.6rem;">✅ NORMAL</span>'
        }
      </td>
    </tr>
  `).join('');
}

// ── Sample Data ───────────────────────────
function loadSampleData() {
  const base = [
    12400, 13100, 11800, 12900, 14200, 11500, 13800, 12100,
    13300, 12700, 11900, 13600, 12300, 14100, 12800, 13000,
    11700, 12600, 13400, 12200, 14000, 11600, 13200, 12500,
    980000,   // 🐋 WHALE — ~79x median
    13100, 12800, 11900, 14300, 12400, 13700, 12000, 14500,
    13300, 12100, 13800, 12700, 11800, 13500, 12300, 14000,
    67000,    // 🐬 Dolphin — ~5.3x median
    13200, 12600, 11700, 14100, 12900, 13400, 12100, 14200,
    11500, 13600, 12200, 13900, 12500, 14300, 11900, 13100,
    2100000,  // 🌊 BLUE WHALE — massive spike
    12800, 13500, 12100, 14100
  ];

  const start = new Date('2024-01-15T09:00:00');
  const lines = base.map((v, i) => {
    const ts = new Date(start.getTime() + i * 60000);
    const pad = n => String(n).padStart(2, '0');
    const label = `${ts.getFullYear()}-${pad(ts.getMonth()+1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
    return `${label},${v}`;
  });

  dataInput.value = lines.join('\n');
}

// ── Helpers ───────────────────────────────
function severityColor(sev) {
  if (sev === 'blue_whale') return '#ff6d00';
  if (sev === 'whale')      return '#ff1744';
  if (sev === 'dolphin')    return '#ffd600';
  return '#00bfa5';
}

function severityEmoji(sev) {
  if (sev === 'blue_whale') return '🌊';
  if (sev === 'whale')      return '🐋';
  if (sev === 'dolphin')    return '🐬';
  return '✅';
}

function formatVol(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return Number(n).toFixed(0);
}

function formatVolShort(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return String(Math.round(n));
}

function showError(msg) {
  alertBox.textContent = '⚠ ' + msg;
  alertBox.classList.add('active');
}

function hideError() {
  alertBox.classList.remove('active');
}

function showSpinner(on) {
  spinner.classList.toggle('active', on);
}