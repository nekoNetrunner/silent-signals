Create a print-ready A1 portrait scientific poster, 594 × 841 mm, 7016 × 9933 pixels at 300 dpi. Use the exact title and the final text below. Use three columns on white ground, deep green #2e7d32, thin grey rules and flat scientific diagrams. Place the problem, biology and graph in column 1. Draw a seven-cell schematic with Delta on the central signaling cell engaging Notch on the six adjacent receiving cells. Label the receivers inhibited and identify the local contact. Put the systems table and four-step method in column 2. Reserve four empty, captioned chart frames in column 3 in the order F5, F6, F7, F8. The actual Matplotlib exports will be inserted later. Leave the interiors empty. Do not invent plots, ticks or axis values. Finish with the findings, limitations and a reference strip. Set text large enough for poster viewing. Keep all numbers, units and sample sizes as supplied.

# SILENT SIGNALS: Beeping Maximal Independent Sets for Energy-Aware Wireless Sensor Clustering

## The problem

A wireless sensor can collect its neighbors’ readings and forward them together. If too many nearby sensors volunteer, their work overlaps. If nobody volunteers nearby, readings go uncollected. We tested whether a short exchange of anonymous beeps can spread collectors across the network, how long that takes and whether more readings arrive before batteries run out.

## The biological idea

As the fruit fly develops, Delta on a signaling cell engages Notch on nearby receiving cells. The interaction inhibits those cells from adopting the same sensory precursor fate. This helps space cells that later give rise to bristles. Real contacts change over time, and cell protrusions can reach beyond immediate neighbors. The computing model borrows the idea of local inhibition. Its sensors exchange timed binary signals, and its mathematical rules come from distributed algorithms. Sources [1, 2].

## The graph

A dot represents a sensor and a line represents a radio link. A maximal independent set chooses heads so neighboring sensors never both lead and every other sensor has a neighboring head. A separate service test follows readings all the way to the sink.

## The systems

LEACH volunteers make a local random decision. Its energy-weighted control makes a depleted sensor less likely to volunteer. Afek’s election follows a common timetable. The published Jeavons–Scott–Xu reference changes its probability after hearing activity or silence. EcoBeep adds a probability floor, a bias toward stronger batteries and a confirmation exchange. During service it can replace weak heads. Fixed roles and an all-knowing greedy selector anchor the comparison. Each arm uses the same packet and energy rules after election. Only a controlled switch of one feature supports a claim about that feature.

| System | Required knowledge | Communication | Spacing condition |
|---|---|---|---|
| Fixed / P0 | Assigned IDs | Fixed roles | Unconstrained |
| LEACH / P1 | Epoch and eligibility | Local draw, setup packets | Unconstrained |
| Weighted LEACH / P2 | P1 plus own battery | Weighted draw, setup packets | Unconstrained |
| Greedy / P3 | Whole graph | Central choice | Valid on finite simple graph |
| Afek / P4 | N, D, clock | Two exchanges per step | Reliable channel, completed election |
| Published feedback / JSX | Own probability, clock | Two local exchanges | Reliable channel, completed election |
| EcoBeep / P5 | Battery, reference, clock | Three exchanges with confirmation | Reliable ideal channel, completed static election |

## The method

Every arm sees the same map, initial batteries and reporting schedule. A separate observer checks the final heads against the original links. The seven-day service experiment counts readings that reach the sink and the time at which sensors die. Energy comes from the time each radio transmits, listens or idles. We compare whole deployments in pairs, retain failed elections and use the original population to count reporting opportunities after batteries run out. The slower clock for real packets includes advertisements, join requests, schedules and aggregated uploads.

1. Generate a seeded network and starting batteries.
2. Elect heads and independently check coverage and spacing.
3. Associate members, collect readings and debit radio time.
4. Compare paired deployments, uncertainty and failure counts.

## Findings

- Against a random set of the same size, EcoBeep reduced the median uncovered share by 16 percentage points.
- EcoBeep finished sooner than the global Afek schedule. The published two-exchange local-feedback reference finished sooner than EcoBeep.
- Unequal-battery EcoBeep delivered more reports than weighted LEACH, while weighted LEACH delayed the first battery death.

## Four chart captions

**F5 · Coverage.** At 100 sensors, uniformly placing exactly EcoBeep’s number of heads left a median 16% uncovered. EcoBeep covered every sensor in these 50 pairs. E3, e3_coverage_scaling.csv, rgg-100-8-full-0-directional-ideal.

**F6 · Spacing.** Holding the head count fixed, uniform placement added a median 0.778 adjacent head pairs per head. The paired 95% interval was 0.714–0.800. E3, e3_coverage_scaling.csv, rgg-100-8-full-0-directional-ideal.

**F7 · Election time.** Median election times were 80 physical slots for Afek at M=1, 33 for EcoBeep and 22 for published local feedback across 50 deployments. E4, e4_headtohead.csv, rgg-100-8-full-0-directional-ideal.

**F8 · Lifetime.** In six unequal-battery pairs, weighting within EcoBeep delayed first death by 10.5 minutes and advanced last death by 102.3 minutes. E5, e5_lifetime.csv, rgg-100-8-heterogeneous-0-directional-ideal.

## Limits

The ideal radio can detect a neighbor while transmitting. Actual radios, interference and moving sensors could change the rankings. Six main lifetime deployments per battery profile and three per sensitivity arm limit precision. Guaranteed spacing requires reliable links and local completion. Hardware lifetime and sensing-area coverage remain unmeasured.

## References

[1] Afek et al., Science, 2011. [2] Cohen et al., Developmental Cell, 2010. [3] Heinzelman et al., HICSS, 2000. [4] Jeavons, Scott and Xu, Distributed Computing, 2016. [5] Casteigts et al., Information and Computation, 2019. [6] Espressif, ESP32 Series Datasheet v5.3.

