# EtherFlow Pro
A real-time cryptocurrency volume anomaly detector with D3.js candlestick visualization and Bloomberg-style terminal UI.

## Objective
EtherFlow Pro identifies abnormal trading volume events ("whale trades") in live cryptocurrency markets. By connecting to the Binance WebSocket API and running a rolling-median anomaly detection algorithm, the system flags when a single candle's volume deviates significantly from its recent baseline — coloring and categorizing each event as a Dolphin, Whale, or Blue Whale based on severity.
The goal is to give traders a fast, visual signal that an unusually large market participant has entered or exited a position, which can precede significant price movement.

## Dataset Description
The application utilizes the **Binance Public API** for its data source:
*   **Historical Data:** Fetched via the `GET /api/v3/klines` REST endpoint to populate the initial window (last 40 candles).
*   **Real-time Data:** Streamed via **WebSockets** (`wss://stream.binance.com:9443`) for live price and volume updates.
*   **Attributes:**
    *   `Timestamp`: The closing time of the candle.
    *   `Open/High/Low/Close`: Price points for candlestick rendering.
    *   `Volume`: The total value of the asset traded (converted to USD/USDT value).

## Algorithm and Formula Used
The system employs a **Sliding Window Median Absolute Deviation (MAD)**-inspired approach for anomaly detection.

### The Formula:
An anomaly is detected if:
$$V_{current} \ge \text{Median}(V_{window}) \times M$$

Where:
*   **$V_{current}$**: The volume of the current candle.
*   **$V_{window}$**: An array of the last 24 volume data points (the baseline).
*   **$M$**: The user-defined sensitivity multiplier (default is 5x).

### Severity Classification:
*   **Dolphin**: $V_{current} \ge 2x \text{ Median}$
*   **Whale**: $V_{current} \ge 5x \text{ Median}$
*   **Blue Whale**: $V_{current} \ge 8x \text{ Median}$

### Why Median?
Unlike the Mean (average), the **Median** is robust to outliers. If a whale has already appeared in the last 24 minutes, a mean-based calculation would be skewed upwards, making it harder to detect the *next* whale. The median maintains a stable baseline of "normal" retail activity.

## Animation
<img width="1436" height="720" alt="Recording 2026-04-28 160142 (online-video-cutter com)" src="https://github.com/user-attachments/assets/a61b6c87-33a8-41b4-9157-2ec2b56dc066" />

## Screenshots
- BTCUSDT
<img width="1794" height="1072" alt="Screenshot_28-4-2026_154510_localhost" src="https://github.com/user-attachments/assets/4dad65ac-f5da-456d-83dc-e22b12302659" />

- ETHUSDT
<img width="1794" height="889" alt="Screenshot_28-4-2026_154523_localhost" src="https://github.com/user-attachments/assets/3b54d7e3-01cc-4475-9ca6-bb3def43f109" />

- SOLUSDT
<img width="1794" height="925" alt="Screenshot_28-4-2026_154444_localhost" src="https://github.com/user-attachments/assets/983e63dc-ef6e-4b89-81b3-bd911bd9c256" />


---

## Testing Results

### (a) Dataset: Clean Data (Stable Market)
*   **Scenario**: BTC/USDT during low-volatility Asian trading hours.
*   **Observation**: Volume bars remained consistent. The "Median" line followed the trend closely.
*   **Result**: 0 Anomalies detected at 5x multiplier. The system correctly identified the "noise" as non-threatening.

### (b) Dataset: Polluted Data (Intentionally Spiked)
*   **Scenario**: Manually injected volume data into the stream (300 BTC buy order in 1 second).
*   **Observation**: The volume bubble for that timestamp turned bright red and expanded in size.
*   **Result**: **Anomaly Detected.** Severity: "BLUE WHALE". The table immediately updated with a deviation percentage of +1,200%.

---

## How to Run the App
1.  **Requirements**: A local PHP server (XAMPP, WAMP, or Laragon).
2.  **File Setup**: Place `index.php`, `app.js`, `style.css`, and `detect.php` in your `htdocs` folder.
3.  **Launch**:
    *   Start Apache.
    *   Open your browser and navigate to `http://localhost/index.php`.
4.  **Usage**:
    *   Select symbol (e.g., `ETHUSDT`, 'BTCUSDT', 'SOLUSDT').
    *   Select an interval (e.g., `1s`, `1m`, `5m`, `1h`).
    *   Click **START SYNC**.
    *   Adjust the **Sensitivity** slider to filter out smaller trade anomalies.

---

## Reflection Questions

**1. Which anomaly detection method did you choose and why?**
I chose the **Sliding Window Median Multiplier** method. Financial data is notoriously "noisy," and standard averages are easily skewed by previous anomalies. By using a sliding median window of 24 periods, the tool creates a rolling baseline of "normal" volume, making it highly effective at spotting sudden, localized spikes (whales) without being influenced by volatility that happened hours ago.

**2. How did changing the threshold affect the number of anomalies detected?**
The threshold (multiplier) acts as a filter for significance. At a low threshold (2x), the system flagged "Dolphins"—routine large retail trades—causing a cluttered chart (False Positives). At a high threshold (12x+), only "Black Swan" events or massive institutional moves were caught. Increasing the threshold reduces noise but increases the risk of missing early signs of a market reversal.

**3. If this tool were deployed in a real-world setting (e.g., monitoring a POS system or sensor network), what additional features would you add?**
For a real-world deployment, I would add **Automated Alerting (Webhooks)** to notify users via Telegram or SMS when an anomaly occurs. Secondly, I would implement **Multi-variate Analysis**; for a sensor network, an anomaly in one sensor (e.g., heat) is more significant if a second sensor (e.g., pressure) also spikes. Finally, I would add a **Database Backend** to log these anomalies for long-term machine learning training.

**4. What was the most difficult part of the activity, and how did you resolve it?**
The most difficult part was synchronizing the **REST API history** with the **Live WebSocket stream**. When the app starts, it fetches 40 old candles, but the WebSocket might send a "partial" candle that overlaps with the latest history. I resolved this by implementing an `isClosed` check in `app.js`, which ensures that the last candle in the array is updated in real-time until it closes, at which point a new candle is pushed to the array.
