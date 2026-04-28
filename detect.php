<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// --- Input Validation ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$raw      = trim($_POST['data']    ?? '');
$multiplier = floatval($_POST['multiplier'] ?? 5.0);

if (empty($raw)) {
    http_response_code(400);
    echo json_encode(['error' => 'No data provided.']);
    exit;
}

// Clamp multiplier to valid range
$multiplier = max(1.0, min(20.0, $multiplier));

// --- Parse CSV (timestamp,volume) ---
$lines  = preg_split('/\r?\n/', $raw);
$points = [];

foreach ($lines as $line) {
    $line = trim($line);
    if ($line === '' || stripos($line, 'timestamp') !== false) continue; // skip header/empty

    $parts = str_getcsv($line);
    if (count($parts) < 2) continue;

    $ts  = trim($parts[0]);
    $vol = floatval(preg_replace('/[^0-9.\-]/', '', $parts[1]));

    if ($vol <= 0) continue;

    $points[] = ['timestamp' => $ts, 'volume' => $vol];
}

if (count($points) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'Need at least 3 valid data rows.']);
    exit;
}

// --- Helper: median of an array ---
function median(array $arr): float {
    sort($arr);
    $n = count($arr);
    $mid = (int)floor($n / 2);
    return ($n % 2 === 0)
        ? ($arr[$mid - 1] + $arr[$mid]) / 2.0
        : $arr[$mid];
}

// --- Helper: mean of an array ---
function mean(array $arr): float {
    return array_sum($arr) / count($arr);
}

// --- Rolling window setup ---
// Use up to last 24 points as the "24-hour" window proxy
$WINDOW = 24;

$volumes = array_column($points, 'volume');
$n       = count($volumes);

// Global stats for reference
$global_mean   = mean($volumes);
$sorted_vols   = $volumes;
sort($sorted_vols);
$global_median = median($sorted_vols);
$variance      = array_sum(array_map(fn($x) => ($x - $global_mean) ** 2, $volumes)) / $n;
$global_std    = sqrt($variance);

// --- Moving Average + Median Detection ---
$results = [];

for ($i = 0; $i < $n; $i++) {
    // Build look-back window (exclude current point)
    $start      = max(0, $i - $WINDOW);
    $window_end = $i; // exclusive: up to but not including current index
    $window_vols = array_slice($volumes, $start, $window_end - $start);

    // If no prior points, use a single-point baseline
    if (count($window_vols) === 0) {
        $window_vols = [$volumes[$i]];
    }

    $win_median = median($window_vols);
    $win_mean   = mean($window_vols);

    // Percentage deviation from window median
    $deviation_pct = ($win_median > 0)
        ? (($volumes[$i] - $win_median) / $win_median) * 100.0
        : 0.0;

    // Z-score for supplemental display
    $win_var = array_sum(array_map(fn($x) => ($x - $win_mean) ** 2, $window_vols)) / count($window_vols);
    $win_std = sqrt($win_var);
    $z_score = ($win_std > 0) ? ($volumes[$i] - $win_mean) / $win_std : 0.0;

    // Whale detection: volume > multiplier × window median
    $threshold_volume = $win_median * $multiplier;
    $is_whale         = ($volumes[$i] >= $threshold_volume);

    // Classify severity
    $severity = 'normal';
    if ($is_whale) {
        $ratio = ($win_median > 0) ? $volumes[$i] / $win_median : 1;
        if ($ratio >= 8)      $severity = 'blue_whale';
        else if ($ratio >= 5) $severity = 'whale';
        else                  $severity = 'dolphin';
    }

    $results[] = [
        'index'            => $i,
        'timestamp'        => $points[$i]['timestamp'],
        'volume'           => $volumes[$i],
        'window_median'    => round($win_median, 4),
        'window_mean'      => round($win_mean, 4),
        'threshold_volume' => round($threshold_volume, 4),
        'deviation_pct'    => round($deviation_pct, 2),
        'z_score'          => round($z_score, 4),
        'is_whale'         => $is_whale,
        'severity'         => $severity,
    ];
}

$whale_count   = count(array_filter($results, fn($r) => $r['is_whale']));
$normal_count  = $n - $whale_count;

echo json_encode([
    'success'       => true,
    'count'         => $n,
    'whale_count'   => $whale_count,
    'normal_count'  => $normal_count,
    'multiplier'    => $multiplier,
    'global_mean'   => round($global_mean, 4),
    'global_median' => round($global_median, 4),
    'global_std'    => round($global_std, 4),
    'window_size'   => $WINDOW,
    'results'       => $results,
]);