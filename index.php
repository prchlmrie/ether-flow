<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EtherFlow Pro — Live Candlestick Whale Tracker</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <nav class="ef-navbar">
        <div class="ef-logo">Ether<span>Flow</span> <small style="font-size:0.55rem; font-weight:500; color:var(--purple-bright); letter-spacing:0.08em;">PRO</small></div>
        <div class="ef-status">
            <div class="ef-status-dot" id="statusDot"></div>
            <span id="connectionStatus">SYSTEM READY</span>
        </div>
    </nav>

    <div class="ef-main">
        <div class="row g-3">

            <!-- LEFT SIDEBAR -->
            <div class="col-lg-2">

                <!-- Live Price Card -->
                <div class="ef-stat" style="border-left: 4px solid var(--purple); margin-bottom: 15px;">
                    <div class="ef-stat-label">Live <span id="assetLabel">BTC</span> Price</div>
                    <div class="ef-stat-value" id="livePriceDisplay">$0.00</div>
                </div>

                <!-- Coin Selector -->
                <div class="ef-panel" style="margin-bottom: 1rem;">
                    <div class="ef-panel-title">// select asset</div>
                    <div class="ef-coin-selector">
                        <button class="ef-coin-btn active" data-symbol="BTCUSDT" onclick="selectCoin(this)">
                            <div class="ef-coin-icon btc">&#8383;</div>
                            <div class="ef-coin-info">
                                <div class="ef-coin-name">Bitcoin</div>
                                <div class="ef-coin-pair">BTC / USDT</div>
                            </div>
                            <span class="ef-coin-badge">&#9679;</span>
                        </button>
                        <button class="ef-coin-btn" data-symbol="ETHUSDT" onclick="selectCoin(this)">
                            <div class="ef-coin-icon eth">&#926;</div>
                            <div class="ef-coin-info">
                                <div class="ef-coin-name">Ethereum</div>
                                <div class="ef-coin-pair">ETH / USDT</div>
                            </div>
                            <span class="ef-coin-badge">&#9679;</span>
                        </button>
                        <button class="ef-coin-btn" data-symbol="SOLUSDT" onclick="selectCoin(this)">
                            <div class="ef-coin-icon sol">&#9678;</div>
                            <div class="ef-coin-info">
                                <div class="ef-coin-name">Solana</div>
                                <div class="ef-coin-pair">SOL / USDT</div>
                            </div>
                            <span class="ef-coin-badge">&#9679;</span>
                        </button>
                    </div>
                </div>

                <!-- Market Config Panel -->
                <div class="ef-panel">
                    <div class="ef-panel-title">// market config</div>
                    <label class="ef-slider-title">Trading Pair</label>
                    <input type="text" id="symbolInput" class="ef-textarea" style="min-height: 40px; margin-bottom:10px;" value="BTCUSDT">
                    
                    <label class="ef-slider-title">Timeframe</label>
                    <select id="intervalInput" class="ef-textarea" style="min-height: 40px;">
                        <option value="1s">1 Second</option>
                        <option value="1m" selected>1 Minute</option>
                        <option value="5m">5 Minutes</option>
                        <option value="1h">1 Hour</option>
                    </select>

                    <button class="ef-btn mt-3" id="startBtn">START SYNC</button>
                    
                    <div class="ef-slider-wrap mt-4">
                        <div class="ef-slider-header">
                            <span class="ef-slider-title">Sensitivity</span>
                            <span class="ef-slider-val" id="sliderVal">5</span>
                        </div>
                        <input type="range" class="ef-slider" id="multiplierSlider" min="2" max="15" step="0.5" value="5">
                    </div>
                </div>
            </div>

            <!-- MAIN CHART AREA -->
            <div class="col-lg-10">
                <div class="ef-chart-panel" style="height: 680px;">
                    <div class="ef-panel-title">
                        // live hlc chart + anomaly overlay
                        <span id="volatilityIndicator" style="float:right; color:var(--accent)">VOL: 0.00%</span>
                    </div>
                    <div id="dual-chart" style="min-height: 620px;"></div>
                </div>

                <div class="ef-panel">
                    <div class="ef-panel-title">// whale activity log</div>
                    <div class="ef-table-wrap">
                        <table class="ef-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Volume ($)</th>
                                    <th>Deviation</th>
                                    <th>Alert Type</th>
                                </tr>
                            </thead>
                            <tbody id="tableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <script>
    function selectCoin(btn) {
        document.querySelectorAll('.ef-coin-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const symbol = btn.dataset.symbol;
        document.getElementById('symbolInput').value = symbol;
        document.getElementById('assetLabel').textContent = symbol.replace('USDT', '');
    }
    </script>
    <script src="app.js"></script>
</body>
</html>