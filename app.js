'use strict';

let socket = null;
let dataPoints = [];
const MAX_POINTS = 40;
const BINANCE_HOSTS = [
    'https://api.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com'
];
const startBtn = document.getElementById('startBtn');
const multiplierSlider = document.getElementById('multiplierSlider');
const connectionStatus = document.getElementById('connectionStatus');
const statusDot = document.getElementById('statusDot');

if (window.location.protocol === 'file:') {
    connectionStatus.textContent = 'RUN npm run dev';
    statusDot.style.background = 'var(--whale-red)';
}

function mapKlines(data) {
    return data.map(d => ({
        time: new Date(d[0]).toLocaleTimeString(),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]) * parseFloat(d[4]),
        isClosed: true
    }));
}

function klinesUrls(symbol, interval) {
    const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval,
        limit: String(MAX_POINTS)
    });
    const query = params.toString();
    return [
        `/api/klines?${query}`,
        ...BINANCE_HOSTS.map(host => `${host}/api/v3/klines?${query}`)
    ];
}

async function fetchHistory(s, i) {
    connectionStatus.textContent = 'LOADING HISTORY...';

    for (const url of klinesUrls(s, i)) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!Array.isArray(data)) continue;
            dataPoints = mapKlines(data);
            analyzeAnomalies();
            return;
        } catch (err) {
            console.warn('Klines source failed:', url, err);
        }
    }

    console.error('History fail: unable to reach Binance');
    connectionStatus.textContent = 'HISTORY FETCH FAILED';
    statusDot.style.background = 'var(--whale-red)';
}

function initStream() {
    const symbol = document.getElementById('symbolInput').value.trim().toUpperCase();
    const interval = document.getElementById('intervalInput').value;

    if (socket) socket.close();
    document.getElementById('assetLabel').textContent = symbol.replace('USDT', '');
    connectionStatus.textContent = 'SYNCING...';
    statusDot.style.background = 'var(--text-secondary)';

    fetchHistory(symbol, interval);

    socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`);

    socket.onopen = () => {
        connectionStatus.textContent = 'LIVE';
        statusDot.style.background = 'var(--accent)';
    };

    socket.onerror = () => {
        connectionStatus.textContent = 'STREAM ERROR';
        statusDot.style.background = 'var(--whale-red)';
    };

    socket.onclose = () => {
        if (connectionStatus.textContent === 'LIVE') {
            connectionStatus.textContent = 'DISCONNECTED';
        }
        statusDot.style.background = 'var(--text-secondary)';
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        const k = msg.k;
        
        // Update live price display
        const currentPrice = parseFloat(k.c);
        const livePriceEl = document.getElementById('livePriceDisplay');
        livePriceEl.textContent = `$${currentPrice.toLocaleString()}`;
        livePriceEl.style.color = currentPrice >= parseFloat(k.o) ? 'var(--accent)' : 'var(--whale-red)';

        const currentPoint = {
            time: new Date(k.t).toLocaleTimeString(),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: currentPrice,
            volume: parseFloat(k.v) * currentPrice,
            isClosed: k.x
        };

        // Update the last point in real-time or push new closed candle
        if (dataPoints.length > 0 && !dataPoints[dataPoints.length-1].isClosed) {
            dataPoints[dataPoints.length-1] = currentPoint;
        } else {
            dataPoints.push(currentPoint);
        }

        if (dataPoints.length > MAX_POINTS) dataPoints.shift();

        // Update volatility display
        const vol = ((currentPoint.high - currentPoint.low) / currentPoint.low * 100).toFixed(2);
        document.getElementById('volatilityIndicator').textContent = `VOL: ${vol}%`;

        analyzeAnomalies();
    };
}

function median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function detectAnomalies(points, multiplier) {
    const WINDOW = 24;
    const volumes = points.map(d => d.volume);
    const results = [];

    for (let i = 0; i < volumes.length; i++) {
        const start = Math.max(0, i - WINDOW);
        let windowVols = volumes.slice(start, i);
        if (!windowVols.length) windowVols = [volumes[i]];

        const winMedian = median(windowVols);
        const isWhale = volumes[i] >= winMedian * multiplier;

        let severity = 'normal';
        if (isWhale) {
            const ratio = volumes[i] / (winMedian || 1);
            if (ratio >= 8) severity = 'blue_whale';
            else if (ratio >= 5) severity = 'whale';
            else severity = 'dolphin';
        }

        results.push({
            index: i,
            timestamp: points[i].time,
            volume: volumes[i],
            window_median: winMedian,
            is_whale: isWhale,
            severity,
            deviation_pct: winMedian > 0
                ? Math.round(((volumes[i] - winMedian) / winMedian) * 10000) / 100
                : 0,
            z_score: 0
        });
    }

    return results;
}

function analyzeAnomalies() {
    if (dataPoints.length < 5) return;
    const multiplier = parseFloat(multiplierSlider.value);
    renderChart(detectAnomalies(dataPoints, multiplier));
}

function renderChart(results) {
    const container = document.getElementById('dual-chart');
    container.innerHTML = '';
    const w = container.clientWidth;
    const h = 630;
    const margin = { top: 20, right: 20, bottom: 48, left: 60 };
    const chartHeight = (h - 100);

    const svg = d3.select("#dual-chart").append("svg").attr("width", w).attr("height", h);

    // X Scale
    const x = d3.scaleBand()
        .domain(d3.range(dataPoints.length))
        .range([margin.left, w - margin.right])
        .padding(0.3);

    // Price Scale (Top 70%)
    const yPrice = d3.scaleLinear()
        .domain([d3.min(dataPoints, d => d.low), d3.max(dataPoints, d => d.high)])
        .range([chartHeight * 0.7, margin.top]);

    // Volume Scale (Bottom 30%) — leave room for timestamp axis
    const yVol = d3.scaleLinear()
        .domain([0, d3.max(results, d => d.volume)])
        .range([h - margin.bottom, chartHeight * 0.75]);

    // --- DRAW CANDLESTICKS ---
    const candles = svg.selectAll(".candle")
        .data(dataPoints)
        .enter().append("g");

    // Wicks (Lines)
    candles.append("line")
        .attr("x1", (d, i) => x(i) + x.bandwidth() / 2)
        .attr("x2", (d, i) => x(i) + x.bandwidth() / 2)
        .attr("y1", d => yPrice(d.high))
        .attr("y2", d => yPrice(d.low))
        .attr("stroke", d => d.close >= d.open ? "var(--teal)" : "var(--whale-red)");

    // Bodies (Rects)
    candles.append("rect")
        .attr("x", (d, i) => x(i))
        .attr("y", d => yPrice(Math.max(d.open, d.close)))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.max(2, Math.abs(yPrice(d.open) - yPrice(d.close))))
        .attr("fill", d => d.close >= d.open ? "var(--teal)" : "var(--whale-red)")
        .attr("opacity", 0.8);

    // --- DRAW VOLUME LINE ---
    const volumeLine = d3.line()
        .x((d, i) => x(i) + x.bandwidth() / 2)
        .y(d => yVol(d.volume))
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(results)
        .attr("fill", "none")
        .attr("stroke", "var(--cyan)")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.5)
        .attr("d", volumeLine);

    // --- DRAW VOLUME BUBBLES ---
    svg.selectAll(".bubble")
        .data(results)
        .enter().append("circle")
        .attr("cx", (d, i) => x(i) + x.bandwidth() / 2)
        .attr("cy", d => yVol(d.volume))
        .attr("r", d => d.is_whale ? 12 : 4)
        .attr("fill", d => {
            if (d.severity === 'blue_whale') return 'var(--whale-orange)';
            if (d.is_whale) return 'var(--whale-red)';
            return 'var(--cyan)';
        })
        .attr("stroke", d => d.is_whale ? (d.severity === 'blue_whale' ? 'var(--whale-orange)' : 'var(--whale-red)') : 'none')
        .attr("stroke-width", d => d.is_whale ? 1.5 : 0)
        .attr("stroke-opacity", 0.4)
        .attr("opacity", d => d.is_whale ? 1 : 0.6);

    // --- DRAW TIMESTAMP AXIS ---
    // Show a tick every N candles to avoid crowding
    const tickEvery = Math.ceil(dataPoints.length / 10);
    const tickIndices = dataPoints
        .map((d, i) => i)
        .filter(i => i % tickEvery === 0 || i === dataPoints.length - 1);

    const axisY = h - margin.bottom + 10;

    // Axis baseline
    svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", w - margin.right)
        .attr("y1", h - margin.bottom + 2)
        .attr("y2", h - margin.bottom + 2)
        .attr("stroke", "var(--border-bright)")
        .attr("stroke-width", 1);

    // Tick marks + labels
    tickIndices.forEach(i => {
        const cx = x(i) + x.bandwidth() / 2;
        const label = dataPoints[i].time;

        // Short tick
        svg.append("line")
            .attr("x1", cx).attr("x2", cx)
            .attr("y1", h - margin.bottom + 2)
            .attr("y2", h - margin.bottom + 7)
            .attr("stroke", "var(--border-bright)")
            .attr("stroke-width", 1);

        // Timestamp text
        svg.append("text")
            .attr("x", cx)
            .attr("y", axisY + 16)
            .attr("text-anchor", "middle")
            .attr("font-family", "'Share Tech Mono', monospace")
            .attr("font-size", "9px")
            .attr("fill", "var(--text-secondary)")
            .attr("letter-spacing", "0.04em")
            .text(label);
    });

    updateTable(results);
}

function updateTable(results) {
    const whales = results.filter(r => r.is_whale).reverse();
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = whales.map(r => `
        <tr style="color: ${r.severity === 'blue_whale' ? 'var(--whale-orange)' : 'var(--whale-red)'}">
            <td>${r.timestamp}</td>
            <td>$${Math.round(r.volume).toLocaleString()}</td>
            <td>+${r.deviation_pct}%</td>
            <td><strong>${r.severity.toUpperCase()}</strong></td>
        </tr>
    `).join('');
}

multiplierSlider.addEventListener('input', () => {
    document.getElementById('sliderVal').textContent = multiplierSlider.value;
    if (dataPoints.length >= 5) analyzeAnomalies();
});

startBtn.addEventListener('click', initStream);