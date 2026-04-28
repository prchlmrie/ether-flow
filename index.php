<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EtherFlow — Whale Tracker</title>

  <!-- Bootstrap 5 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- D3.js v7 -->
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <!-- Google Fonts (loaded in CSS) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- Custom styles -->
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- ── Navbar ───────────────────────────── -->
  <nav class="ef-navbar">
    <div class="ef-logo">Ether<span>Flow</span></div>
    <div class="ef-status">
      <div class="ef-status-dot"></div>
      WHALE DETECTION SYSTEM v1.0
    </div>
  </nav>

  <!-- ── Main Layout ──────────────────────── -->
  <div class="ef-main">

    <!-- Stat Cards -->
    <div class="ef-stat-row" id="statsRow">
      <div class="ef-stat">
        <div class="ef-stat-label">Total Transactions</div>
        <div class="ef-stat-value" id="statTotal">—</div>
      </div>
      <div class="ef-stat">
        <div class="ef-stat-label">🐋 Whales Detected</div>
        <div class="ef-stat-value whale" id="statWhales">—</div>
      </div>
      <div class="ef-stat">
        <div class="ef-stat-label">✅ Normal TXNs</div>
        <div class="ef-stat-value normal" id="statNormal">—</div>
      </div>
      <div class="ef-stat">
        <div class="ef-stat-label">Global Median Vol</div>
        <div class="ef-stat-value" id="statMedian">—</div>
      </div>
      <div class="ef-stat">
        <div class="ef-stat-label">Global Std Dev</div>
        <div class="ef-stat-value" id="statStd">—</div>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="row g-3">

      <!-- Left: Input Panel -->
      <div class="col-lg-3">
        <div class="ef-panel">
          <div class="ef-panel-title">// data feed</div>

          <!-- File Upload -->
          <div class="ef-upload-zone" id="uploadZone">
            <input type="file" id="fileInput" accept=".csv,.txt">
            <div class="ef-upload-icon">📂</div>
            <div class="ef-upload-label">
              <strong>Click to upload CSV</strong><br>
              or drag & drop
            </div>
            <div style="font-family:var(--font-mono);font-size:0.58rem;color:var(--text-muted);margin-top:0.4rem;">
              format: timestamp,volume
            </div>
          </div>

          <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-align:center;margin:0.5rem 0;">
            — or paste raw data —
          </div>

          <!-- Textarea -->
          <textarea
            class="ef-textarea"
            id="dataInput"
            placeholder="2024-01-15 09:00:00,12400&#10;2024-01-15 09:01:00,13100&#10;2024-01-15 09:02:00,11800&#10;2024-01-15 09:03:00,980000"
            rows="8"
          ></textarea>

          <!-- Threshold Slider -->
          <div class="ef-slider-wrap">
            <div class="ef-slider-header">
              <span class="ef-slider-title">// detection sensitivity</span>
              <span>
                <span class="ef-slider-val" id="sliderVal">5</span><span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-secondary);">× median</span>
                <span class="ef-slider-label" id="sliderLabel">🐋 WHALE</span>
              </span>
            </div>
            <input
              type="range"
              class="ef-slider"
              id="multiplierSlider"
              min="3"
              max="10"
              step="0.5"
              value="5"
            >
            <div class="ef-slider-ticks">
              <span class="ef-slider-tick">3× Dolphin</span>
              <span class="ef-slider-tick">6× Whale</span>
              <span class="ef-slider-tick">10× Blue Whale</span>
            </div>
          </div>

          <!-- Run Button -->
          <button class="ef-btn" id="runBtn">⚡ RUN DETECTION</button>

          <!-- Error Alert -->
          <div class="ef-alert" id="alertBox"></div>

          <!-- Sample Data Button -->
          <button
            onclick="loadSampleData()"
            style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);background:none;border:none;cursor:pointer;width:100%;text-align:center;margin-top:0.75rem;text-decoration:underline;"
          >
            load sample dataset
          </button>
        </div>

        <!-- Legend -->
        <div class="ef-panel">
          <div class="ef-panel-title">// classification</div>
          <div class="ef-legend" style="flex-direction:column;gap:0.75rem;">
            <div class="ef-legend-item">
              <div class="ef-legend-dot" style="background:#00bfa5;"></div>
              <span>Normal Transaction</span>
            </div>
            <div class="ef-legend-item">
              <div class="ef-legend-dot" style="background:#ffd600;"></div>
              <span>🐬 Dolphin (3–5× median)</span>
            </div>
            <div class="ef-legend-item">
              <div class="ef-legend-dot" style="background:#ff1744;"></div>
              <span>🐋 Whale (5–8× median)</span>
            </div>
            <div class="ef-legend-item">
              <div class="ef-legend-dot" style="background:#ff6d00;"></div>
              <span>🌊 Blue Whale (8×+ median)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Chart + Table -->
      <div class="col-lg-9">

        <!-- Chart -->
        <div class="ef-chart-panel">
          <div class="ef-panel-title">
            // transaction volume — bubble radius = volume magnitude
            <span id="chartSubtitle" style="float:right;color:var(--text-muted);">no data loaded</span>
          </div>

          <!-- Spinner -->
          <div class="ef-spinner" id="spinner">
            <div class="ef-spinner-ring"></div>
            <div class="ef-spinner-text">SCANNING BLOCKCHAIN...</div>
          </div>

          <div id="chart"></div>
        </div>

        <!-- Results Table -->
        <div class="ef-panel" id="tablePanel" style="display:none;">
          <div class="ef-panel-title">
            // anomaly log
            <span id="tableCount" style="float:right;color:var(--whale-red);"></span>
          </div>
          <div class="ef-table-wrap">
            <table class="ef-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Timestamp</th>
                  <th>Volume</th>
                  <th>Window Median</th>
                  <th>Deviation %</th>
                  <th>Z-Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="tableBody"></tbody>
            </table>
          </div>
        </div>

      </div>
    </div><!-- /row -->
  </div><!-- /ef-main -->

  <!-- Tooltip -->
  <div class="ef-tooltip" id="tooltip"></div>

  <!-- app.js -->
  <script src="app.js"></script>
</body>
</html>