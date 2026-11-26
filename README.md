# Silent Signals

**Start here** · [Plain-language report](Silent%20Signals%20-%20Reader%20Report.pdf) · [Quick guide](START_HERE.md) · [A1 poster](poster/Silent%20Signals%20-%20A1%20Poster.pdf)

The seven full-run CSVs are losslessly compressed for GitHub. Run `python restore_results.py` once after cloning to restore them and check their SHA-256 hashes. The offline simulator opens directly from `viz/simulator.html`.

**Beeping maximal independent sets for energy-aware wireless sensor clustering**

Open `viz/simulator.html` to explore an election or read `START_HERE.md` for a two-minute walkthrough. The illustrated report and A1 poster are included with this project.

## 1. Summary

EcoBeep spaced leaders well on reliable links and completed elections faster than the published global schedule in the main comparison. The published local-feedback baseline finished faster still. In six paired deployments with unequal batteries, EcoBeep delivered more of the offered workload than residual-energy-weighted LEACH while reaching the first battery death earlier. Its own energy weighting delayed the first death and shortened the time to the last death relative to the bias-off twin. See sections 8 and 9 for sample sizes, units and intervals.

## 2. Research question

A group of wireless sensors needs local collectors, called heads. Can the sensors choose heads locally so every sensor has a nearby collector, neighboring collectors avoid duplicating work, batteries last and the readings arrive? These are four separately measurable goals. A seed fixes a deployment so each competing rule faces the same map and starting batteries.

## 3. Biology and the graph abstraction

In developing fruit flies, Delta on a signaling cell activates Notch in a receiving cell. This interaction can inhibit another nearby cell from adopting the sensory organ precursor fate. Precursors later give rise to sensory organs including bristles. Contacts can vary over time and extend across several cell diameters. Afek and colleagues drew inspiration from this spacing process for a binary distributed algorithm. The probabilities used here belong to the graph algorithms. [Afek et al.](https://web.math.princeton.edu/~nalon/PDFS/misbios.pdf) · [Cohen et al.](https://doi.org/10.1016/j.devcel.2010.06.006)

A graph has a vertex for each live sensor and an edge for each neighboring pair. An independent set contains no adjacent vertices. It is maximal when adding any remaining vertex would break independence. Equivalently, every outside vertex then has a neighbor in the set. This gives one-hop *topological* coverage. The service simulation separately checks association and sink delivery. On A—B—C, both {B} and {A,C} are maximal even though their sizes differ.

## 4. Protocols and controls

| ID | How a sensor earns the role | Information and spacing conditions |
|---|---|---|
| P0 | The first floor(n/5) sensor IDs serve for life | Provisioned roles. No spacing guarantee. |
| P1 | LEACH uses a rising threshold for eligible sensors in each 20-round epoch | Local round, epoch and eligibility. Random placement can leave holes. |
| P2 | Residual-energy-weighted LEACH multiplies P1's threshold by own remaining / rated full energy | A specified energy-aware control. It can change the number of heads. |
| P3 | Central greedy takes living vertices in increasing original degree, then ID | Full graph knowledge, free oracle computation. A finite simple undirected graph suffices for an MIS. |
| P4 | Afek's 2011 two-exchange global schedule | Common upper bounds N and D, synchronized slots, reliable links, sender-side collision detection. At the research constant M=1, finite exhaustion is possible. |
| JSX | Jeavons–Scott–Xu Algorithm 1, two exchanges | Anonymous local feedback, initially 0.5, halve on a neighbor signal and double on silence up to 1. No positive floor. On its reliable synchronous model the authors prove logarithmic expected time. |
| P5 | EcoBeep adds battery weighting, a floor, provisional confirmation and final announcement | Starts at 1. Uses local battery, provisioned reference and Boolean observations. Static local completion on reliable ideal links gives separated, covering heads. Erasures or half-duplex collision misses can break spacing. |

P4 uses N equal to the next power of two above or equal to max(2,n), D=N by default. For phase i from 0 through log2(D), probability is 2^i/D and each phase has 1+floor(M log2 N) steps. Table 1 states M symbolically. The high-probability O(log N log D) result assumes its reliable synchronous model and a sufficiently large constant. M=1,2,4 are study settings. The recorded scheduled length and the observer's last decision answer different timing questions. The separate tighter-D arm grants an oracle degree bound. [Afek et al., Table 1](https://web.math.princeton.edu/~nalon/PDFS/misbios.pdf) · [Jeavons, Scott and Xu, Algorithm 1](https://people.maths.ox.ac.uk/scott/Papers/feedback.pdf)

P1/P2 use T=1/(L−r mod L) for eligible sensors and zero otherwise. P2 further multiplies by the local rated-energy fraction, capped at 1. Each winner becomes ineligible for the rest of the epoch. The initial static P1/P2 comparison is a fresh election. E3 adds four analysis-only controls. It uses the paired P5 head count k to set uniform or energy-weighted probabilities summing to k, or samples exactly k without replacement. The controls receive k only in E3. [Original LEACH, sections 5.1–5.4](https://pdos.csail.mit.edu/archive/decouto/papers/heinzelman00.pdf)

## 5. Architecture

- `src/core.js` owns graph generation, observation, keyed draws, disjoint radio-mode accounting and the synchronous elections. Each slot samples all intents before delivery and commits after delivery. The channel uses the adjacency matrix with receiver-first semantics and sparse neighbor lists.
- `src/service.js` schedules identifiable packets, energy debits, deadlines, maintenance and precise within-interval battery crossings. The synthetic sink at (0.5, 1.5) is directly reachable from every living head.
- `experiments/batch.js` produces one long-format CSV per experiment. `experiments/run_all.py` runs the seven experiments and plotting. `analysis.py`, `figures.py` and `verify_results.py` read the CSV evidence. The browser embeds the same election source so fixes apply to both entry points after rebuilding.
- `configs/default.yaml` and `DECISIONS.md` give configuration and estimands. `ARCHIVE_AUDIT.md` records why a new engine and new measurements were necessary. `analysis/verification.json` records run counts and hashes.

## 6. Windows installation

The offline simulator, report and poster are ready to open after extracting the ZIP. Re-running the numerical study requires Python 3.12 and Node.js 24 on PATH. The tested Windows build was 26300, with Python 3.12.14 and Node.js 24.22.3. In PowerShell, from the extracted project folder, run:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pytest -q -s
.\run_all.ps1 -Smoke
.\run_all.ps1
```

If local PowerShell script execution is restricted, the equivalent commands use `.\.venv\Scripts\python.exe -m experiments.run_all --smoke` and `.\.venv\Scripts\python.exe -m experiments.run_all`. A nonstandard Node installation can be supplied via the NODE_EXE environment variable. The PS driver also accepts STUDY_PYTHON. This revision uses JavaScript for the shared numerical engine and Python for orchestration, inference, plots and independent fixtures.

## 7. Methods and energy checks

The geometric radius is sqrt(d/(πn)) in a unit square. Edges near the boundary are less numerous, so d is a target. Graph hashes, realized mean degree and isolates are retained. Other layouts include the open grid, line, clique, recursive tree, clustered and sparse geometric graphs and a power-of-two XOR butterfly pattern. A fresh loss draw is keyed to the absolute slot and directed edge. In symmetric mode both directions share the edge draw. Four random half-duplex slot pairs emulate each exchange needing sender feedback. Announcement uses one slot. A trace can retain true sender IDs for auditing. [Casteigts et al.](https://arxiv.org/abs/1607.02951)

At 3.3 V, with a 240 mA transmitter for 5 ms and 20 mA idle for the remaining 35 ms, a beep consumes 3.3 × (240 × 0.005 + 20 × 0.035) = **6.27 mJ**. A scheduled 100 mA listener consumes **13.20 mJ** in 40 ms even on silence. An idle sensor consumes **2.64 mJ** in the same slot. A full 2,000 mAh, 3.3 V battery is modeled as **23,760 J**. The datasheet TX condition is 802.11b, 1 Mbps, +19.5 dBm, 3.3 V and 25 °C at the RF port, with 50% duty in the measurement. RX is represented by 100 mA, idle by the 20 mA low end of 80 MHz modem sleep. Radio ratios differ across real boards. Simultaneous ideal sender feedback has no separately measured power debit. No extra sleep, CPU, aggregation or sensor sampling energy is assigned. [Espressif ESP32 Series Datasheet v5.3, power modes and Table 5-4](https://documentation.espressif.com/esp32_datasheet_en.pdf)

Static trials use the observer independently of protocol ID. An empty live graph has undefined fractions. A headless nonempty graph has orphan rate 1. E5/E7 use a seven-day clock, one 32-byte reading from each living source every 60 seconds, re-clustering every 300 seconds and 24 framing bytes per packet. Uploads and fixed 32-byte aggregates use 1 Mbps. All transmitting heads have a direct sink link. Fixed-denominator service counts 1,007,900 opportunities per 100-sensor deployment. A busy setup can drop a generated report. Energy and service continue through repairs. A missing head stops serving immediately. Members rediscover reachable heads at association; the simulator supplies no free death notification to nodes. Maintenance details and event priorities appear in DECISIONS.md.

## 8. Results from the full run

Each row below concerns geometric networks with 100 sensors and degree target 8. Static rows use full batteries, seed numbers 0–49 and the reliable ideal channel unless specified. “Unequal” means independent uniform starting fractions from 0.3 to 1. E5 seed numbers are 0–5 and E7 seed numbers 0–2. Results from smoke batteries are excluded. Intervals are 95%. The paired bootstrap uses deployment seeds, and binary rates use exact binomial intervals. Per-scenario outputs for both energy profiles and all sizes are in `analysis/inference.csv`. [Exact binomial method](https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/exacbici.htm)

| Experiment and CSV under results/ | Observation and uncertainty |
|---|---|
| E1 · e1_setup_cost.csv | Of 50 deployments, median P1 setup was 33 slots (30.5–37), P5 156.5 (153.5–160), P4 201 (196.5–206). P5 associated a median 100/100 sensors (100–100), P1 29/100 (26.5–33). P5 used 756 mJ per sensor at setup (746–770), P1 138 (121–156). |
| E2 · e2_correctness.csv | P5 returned an MIS in 50/50 deployments, exact interval 92.89–100%. P1 did so in 0/50, interval 0–7.11%. MIS validity is a comparison metric for LEACH. |
| E3 · e3_coverage_scaling.csv | Over 50 pairs, P5 left 16 percentage points fewer sensors uncovered than uniform selection with exactly the same head count (14–18 points). It also removed a median 0.778 adjacent pairs per head (0.714–0.800). |
| E4 · e4_headtohead.csv | P4 at M=1, P5 and JSX took median 80, 33 and 22 slots respectively. The median P4/P5 paired ratio was 2.25 (2.17–2.52), difference 45 slots (39–47), 50/50 pairs successful. P4/JSX was 3.50 (3.25–3.83). |
| E5 · e5_lifetime.csv | In six unequal-battery pairs, P5 delivered 21.09 percentage points more fixed service than P2 (20.91–21.57) and reached its first death 49.33 minutes earlier (47.05–64.14 earlier). JSX delivered 3.21 points more than P5 (3.09–3.46). |
| E6 · e6_loss_ablation.csv | With 10% independent directional erasure, adjacent heads occurred in 50/50 P5 confirmation trials (92.89–100%) and 50/50 without confirmation. Domination failed in 0/50 in the confirmation arm (0–7.11%). |
| E7 · e7_sensitivity.csv | Across three unequal-battery deployments, disabling rotation alone increased fixed service by a paired median 3.00 points (2.91–3.22). Half-duplex service had an arm median 23.92% (23.07–24.56), compared with 26.61% (26.46–27.22) in the ideal arm. |

## 9. Wins, ties and losses

Spacing matters independently of the head budget. The E3 exact-count control puts the same number of collectors on each map, yet the median control leaves 16 of 100 sensors uncovered. In E1, cheap native LEACH setup also associates fewer sensors. Election-only and setup-complete timings answer different operational questions.

Local feedback predates EcoBeep. JSX already outperforms the global schedule in E4. EcoBeep's extra confirmation slot, different initial probability, floor and weighting all distinguish it from JSX. For unequal starting batteries the isolated E4 bias-off / bias-on median time ratio was 1.00 (0.91–1.10, 50 pairs). There is no clear static election-time gain from weighting in this stratum.

During unequal-battery service, isolating energy weighting within EcoBeep delayed first death by a median 10.51 minutes (4.48–20.58), delayed half death by 24.35 minutes (11.72–41.56) and brought the last death forward by 102.27 minutes (58.07–150.03 earlier), six pairs. With equal starting batteries the same weighting brought first death forward by 8.47 minutes (5.14–9.29 earlier). Batteries that start equal diverge as radios take on different jobs. Against JSX as a complete system, P5 reached first death 28.07 minutes earlier (20.69–36.64 earlier) with unequal batteries. E5 measures the net effect of those configurations; the isolated bias comparison supports attribution to weighting.

E6 distinguishes two failure mechanisms. Adjacent contenders can miss each other twice. Even a sensor that stayed silent can miss a winner's final announcement and contend again later beside an already-finished head. Static heads have finished their tasks and may no longer defend the neighborhood. Confirmation sees only provisional contenders in its own exchange. The two-node forced-loss test demonstrates possibility; E6 measures frequency.

## 10. Limits

These are simulations of stationary sensors on known link graphs. Ideal synchronization, collision feedback, fixed radio current, an omnireachable sink and an ideal collision-free packet schedule simplify the physical network. Actual interference, sensing-area coverage, channel acquisition, multihop sink routing and board measurements were **NOT RUN**. The service ranking is specific to the common workload, busy-drop policy and idle current. Only six independent deployments per main lifetime arm and three per sensitivity arm were simulated. Exact intervals at extreme counts still allow unseen failures. Finite plots across network sizes cannot establish a theorem.

## 11. Reproduction and finding evidence

```powershell
.\.venv\Scripts\python.exe -m experiments.run_all --smoke --out smoke-check
.\.venv\Scripts\python.exe -m experiments.verify_results smoke --replica smoke-check
.\.venv\Scripts\python.exe -m experiments.run_all --data-only --out full-check
.\.venv\Scripts\python.exe -m experiments.verify_results . --replica full-check
.\.venv\Scripts\python.exe -m experiments.run_all --plots-only
.\.venv\Scripts\python.exe -m experiments.highlights
.\.venv\Scripts\python.exe -m experiments.e4_headtohead
Start-Process .\viz\simulator.html
```

CSV rows identify the experiment, scenario, paired deployment, protocol, variant, seed, settings, graph hash, metric, units and status. A raw file can contain multiple metric rows per run. Count distinct run IDs for denominators. E2 node/edge rows supply F1. E5 death rows supply F8. Undefined fractions are NA. Gini at first death includes dead sensors at zero. Endpoint columns keep observed times or administrative times with explicit event flags. Kaplan–Meier median rows mark unreached results NA. Paired endpoint differences use restricted times through the common horizon. F8 plots the fraction of the original sensors still alive, a different quantity from time to first death.

For a quick numerical lookup, use `analysis/highlights.json`. Use `analysis/inference.csv` for contrasts, denominators and intervals and `analysis/verification.json` for identities and independent checks. Figure sources and both output formats are under `figures/`. The poster's final words and standalone artwork prompt are under `poster/`.

## 12. References

The numerical baseline specifications are Afek et al. (2011), Table 1, Heinzelman et al. (2000), sections 5.1–5.4, and Jeavons, Scott and Xu (2016), Algorithm 1. Energy-aware LEACH variants have a wider literature; this study's P2 is the explicit rated-energy control in section 4. [Afek](https://doi.org/10.1126/science.1193210) · [LEACH](https://doi.org/10.1109/HICSS.2000.926982) · [Local feedback](https://doi.org/10.1007/s00446-016-0269-8) · [Fan and Song](https://doi.org/10.1109/SENSORCOMM.2007.60)

Additional background covers biological contacts, distributed graph theory and radio emulation. [Cohen et al.](https://doi.org/10.1016/j.devcel.2010.06.006) · [Függer et al.](https://pubmed.ncbi.nlm.nih.gov/41253101/) · [Luby](https://doi.org/10.1137/0215074) · [Alon, Babai and Itai](https://www.sciencedirect.com/science/article/pii/0196677486900192) · [Casteigts et al.](https://arxiv.org/abs/1607.02951)

Manufacturer and reproduction references cover current consumption, statistical intervals and Windows commands. [ESP32 Series Datasheet](https://documentation.espressif.com/esp32_datasheet_en.pdf) · [NIST exact intervals](https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/exacbici.htm) · [Python virtual environments](https://docs.python.org/3.12/library/venv.html) · [PowerShell automatic variables](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_automatic_variables)

