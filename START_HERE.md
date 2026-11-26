# Start here

**To see the idea in two minutes**, double-click `viz/simulator.html`. It works from an extracted folder without an internet connection. Each dot represents a battery-powered sensor. A line connects two sensors within communication range. A gold diamond is a sensor that volunteered to collect other sensors' readings.

1. Leave **Geometric**, **100 sensors** and **seed 0** selected. A seed identifies a repeatable deployment.
2. Click **Compare**. The left side runs EcoBeep and the right side runs Afek's original schedule on the same map. Click **Play**. Cyan rings show transmissions. Each side freezes at its own finish time.
3. Click **+1 slot** to advance 40 simulated milliseconds. A logical step may require several slots. Drag the timeline backward to revisit a decision. Hover over a dot to read its battery and chance of volunteering.
4. Select **Full setup**. After the heads have been chosen, the radios still need to advertise, join and receive schedules. The elapsed time includes that work.
5. Set **Beep / packet loss** to 10%. Review **Adjacent pairs** after completion. Even after a confirmation exchange, neighboring sensors can both end up as heads. Click **Reset** to repeat a run with the current settings.

**What to read.** The illustrated report explains the results in everyday language. The README gives the experimental details and reproduction commands. ARCHIVE_AUDIT.md explains which assumptions changed after checking the supplied ZIP.

## A three-sensor example

Imagine a row of three sensors, A—B—C. A can hear B, B can hear both neighbors, and C can hear B. Choosing B alone covers everyone. Choosing both A and C also covers everyone. Either choice is a valid *maximal independent set*. Choosing A alone leaves C without a head. Choosing A and B puts two heads next to each other.

The experiment checks those two questions separately. It then asks a third one: did the readings actually arrive at the collection station? A reachable head might die, miss an advertisement or be busy when a report is due.

## Reading the results

- **Median** is the middle result across deployments. A paired difference first compares two protocols on the same deployment, then takes the middle of those differences.
- **Delivery** is credited per original source reading at the collection station. A packet can carry several readings. The fixed seven-day denominator also counts the reporting opportunities of sensors that died early.
- **First death**, **half dead** and **last death** describe different points in a network's life. The data keep a flag when an endpoint was still unreached at the cutoff.
- **95% interval** describes uncertainty across the sampled deployments under the simulation model. Six lifetime deployments leave considerable uncertainty about other deployment conditions.
- **Power** is how fast a radio uses energy. **Energy** is what it spends over time. A quiet radio can still spend energy listening for a neighbor.
- The **smoke** folder contains a quick wiring check with smaller batteries. The **results** and **figures** folders contain the full study.

Keyboard shortcuts: Space plays or pauses, right arrow advances one slot, R resets, C compares, 1–5 selects a protocol and Esc closes the side drawers. Drag the canvas to pan, scroll to zoom and click Fit to restore the view.
