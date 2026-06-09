const ALLOWED_INTERVALS = new Set(['1s', '1m', '5m', '1h']);
const SYMBOL_RE = /^[A-Z0-9]{5,20}$/;
const BINANCE_HOSTS = [
    'https://api.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com'
];

async function fetchFromBinance(symbol, interval, limit) {
    for (const host of BINANCE_HOSTS) {
        try {
            const url = new URL(`${host}/api/v3/klines`);
            url.searchParams.set('symbol', symbol);
            url.searchParams.set('interval', interval);
            url.searchParams.set('limit', String(limit));

            const response = await fetch(url);
            const data = await response.json();
            if (response.ok && Array.isArray(data)) {
                return data;
            }
        } catch (_) { /* try next host */ }
    }
    return null;
}

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const symbol = String(req.query.symbol || '').toUpperCase();
    const interval = String(req.query.interval || '1m');
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 40));

    if (!SYMBOL_RE.test(symbol) || !ALLOWED_INTERVALS.has(interval)) {
        return res.status(400).json({ error: 'Invalid symbol or interval' });
    }

    const data = await fetchFromBinance(symbol, interval, limit);
    if (!data) {
        return res.status(502).json({ error: 'Binance API unavailable' });
    }

    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
    return res.status(200).json(data);
};
