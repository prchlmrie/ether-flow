<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    exit(json_encode(['error' => 'Method not allowed.']));
}

$raw = trim($_POST['data'] ?? '');
$multiplier = floatval($_POST['multiplier'] ?? 5.0);

if (empty($raw)) {
    exit(json_encode(['error' => 'No data provided.']));
}

$lines = preg_split('/\r?\n/', $raw);
$points = [];

foreach ($lines as $line) {
    $parts = str_getcsv($line);
    if (count($parts) < 2) continue;
    $points[] = ['timestamp' => $parts[0], 'volume' => floatval($parts[1])];
}

function median($arr) {
    if (empty($arr)) return 0;
    sort($arr);
    $n = count($arr);
    $mid = (int)floor($n / 2);
    return ($n % 2 === 0) ? ($arr[$mid - 1] + $arr[$mid]) / 2.0 : $arr[$mid];
}

$volumes = array_column($points, 'volume');
$n = count($volumes);
$WINDOW = 24;
$results = [];

for ($i = 0; $i < $n; $i++) {
    $start = max(0, $i - $WINDOW);
    $window_vols = array_slice($volumes, $start, $i - $start);
    if (empty($window_vols)) $window_vols = [$volumes[$i]];

    $win_median = median($window_vols);
    $is_whale = ($volumes[$i] >= $win_median * $multiplier);
    
    $severity = 'normal';
    if ($is_whale) {
        $ratio = $volumes[$i] / ($win_median ?: 1);
        if ($ratio >= 8) $severity = 'blue_whale';
        else if ($ratio >= 5) $severity = 'whale';
        else $severity = 'dolphin';
    }

    $results[] = [
        'index' => $i,
        'timestamp' => $points[$i]['timestamp'],
        'volume' => $volumes[$i],
        'window_median' => $win_median,
        'is_whale' => $is_whale,
        'severity' => $severity,
        'deviation_pct' => ($win_median > 0) ? round((($volumes[$i] - $win_median) / $win_median) * 100, 2) : 0,
        'z_score' => 0 // Simplified for live performance
    ];
}

echo json_encode([
    'success' => true,
    'global_median' => median($volumes),
    'whale_count' => count(array_filter($results, fn($r) => $r['is_whale'])),
    'results' => $results
]);