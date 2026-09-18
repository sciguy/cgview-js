# CGView rendering benchmark

Status: complete. 2/2 scenarios completed.

Chromium 151.0.7922.34; Node v24.21.0; Linux 6.8.0-138-generic (x64).

2 measured rounds after 1 warm-ups; 6 interaction frames; 600 x 600 CSS pixels at DPR 1.

Bundle SHA-256: `67d706d918f4f6bb460c9326ead88a4fe5315e76f4c8efe6b6c094ce67f1bd55`. Revision: `f2ace3428288d997a2ce2a076aaa207dcb304243`.

Times are milliseconds. Fast and export draw measure synchronous Canvas rendering; export draw excludes SVG serialization and file encoding. Full draw includes progressive scheduling. Frame intervals include browser presentation opportunities and host scheduling. These are not GPU-completion measurements. Instrumented profiles run separately from primary timings.

| Scenario | Zoom | Visible features | Fast median | Fast p90 | Full median | Full p90 | Export median | Frame median | Frame p90 | Interaction CPU median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1000000-circular-arc | 1 | 1000000 | 145.50 | 148.30 | 2410.30 | 2495.20 | 2281.10 | 133.30 | 150.00 | 132.20 |
| 1000000-circular-arc | 10 | 92815 | 37.90 | 39.30 | 293.10 | 296.30 | 245.80 | 16.70 | 33.40 | 22.50 |
| 1000000-circular-arc | 1000 | 978 | 1.40 | 2.00 | 8.00 | 8.50 | 1.60 | 16.60 | 16.70 | 1.70 |
| 1000000-linear-arc | 1 | 1000000 | 130.00 | 141.00 | 1912.30 | 1929.40 | 1822.70 | 133.30 | 133.40 | 130.20 |
| 1000000-linear-arc | 10 | 116668 | 42.70 | 43.80 | 275.10 | 302.70 | 202.30 | 50.00 | 50.10 | 40.20 |
| 1000000-linear-arc | 1000 | 1168 | 1.10 | 2.10 | 5.60 | 6.10 | 1.50 | 16.70 | 16.70 | 1.20 |

## Setup

Times are milliseconds. Load plus active draws waits only for already-started progressive work; it does not establish first-render completion because loading schedules an asynchronous transition. Heap observations are MiB of JavaScript heap without forced collection; they exclude Canvas and GPU memory.

| Scenario | Generate | Create viewer | Load synchronous | Load + active draws | Heap after load |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1000000-circular-arc | 187.00 | 31.00 | 2761.80 | 2761.90 | 472.95 |
| 1000000-linear-arc | 164.70 | 27.20 | 2632.60 | 2632.60 | 472.94 |
