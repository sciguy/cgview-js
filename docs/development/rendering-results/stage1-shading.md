# CGView rendering benchmark

Status: complete. 4/4 scenarios completed.

Chromium 151.0.7922.34; Node v24.21.0; Linux 6.8.0-138-generic (x64).

3 measured rounds after 1 warm-ups; 6 interaction frames; 600 x 600 CSS pixels at DPR 1.

Bundle SHA-256: `67d706d918f4f6bb460c9326ead88a4fe5315e76f4c8efe6b6c094ce67f1bd55`. Revision: `f2ace3428288d997a2ce2a076aaa207dcb304243`.

Times are milliseconds. Fast and export draw measure synchronous Canvas rendering; export draw excludes SVG serialization and file encoding. Full draw includes progressive scheduling. Frame intervals include browser presentation opportunities and host scheduling. These are not GPU-completion measurements. Instrumented profiles run separately from primary timings.

| Scenario | Zoom | Visible features | Fast median | Fast p90 | Full median | Full p90 | Export median | Frame median | Frame p90 | Interaction CPU median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10000-circular-arc | 1 | 10000 | 2.30 | 2.60 | 96.40 | 100.50 | 51.10 | 16.60 | 16.70 | 1.70 |
| 10000-circular-arc | 10 | 930 | 1.70 | 1.70 | 15.30 | 16.00 | 5.90 | 16.60 | 16.70 | 1.50 |
| 10000-circular-arc | 1000 | 10 | 0.50 | 0.60 | 4.40 | 4.50 | 0.60 | 16.60 | 16.80 | 0.60 |
| 10000-circular-arrow | 1 | 10000 | 2.10 | 2.20 | 114.90 | 120.20 | 93.80 | 16.70 | 16.70 | 2.80 |
| 10000-circular-arrow | 10 | 930 | 2.30 | 2.40 | 18.60 | 18.70 | 7.50 | 16.60 | 16.70 | 2.10 |
| 10000-circular-arrow | 1000 | 10 | 0.70 | 0.90 | 4.80 | 4.90 | 0.60 | 16.70 | 16.70 | 0.70 |
| 10000-linear-arc | 1 | 10000 | 1.70 | 1.80 | 77.80 | 78.50 | 48.50 | 16.60 | 16.80 | 1.80 |
| 10000-linear-arc | 10 | 1168 | 1.10 | 1.20 | 13.70 | 13.90 | 6.70 | 16.70 | 16.70 | 1.30 |
| 10000-linear-arc | 1000 | 12 | 0.50 | 0.60 | 3.30 | 3.50 | 0.50 | 16.70 | 16.70 | 0.70 |
| 10000-linear-arrow | 1 | 10000 | 2.30 | 2.40 | 101.60 | 101.60 | 87.70 | 16.70 | 16.80 | 2.60 |
| 10000-linear-arrow | 10 | 1168 | 1.60 | 1.70 | 17.40 | 18.20 | 8.70 | 16.70 | 16.70 | 1.60 |
| 10000-linear-arrow | 1000 | 12 | 0.50 | 0.50 | 2.80 | 3.00 | 0.60 | 16.70 | 16.70 | 0.50 |

## Setup

Times are milliseconds. Load plus active draws waits only for already-started progressive work; it does not establish first-render completion because loading schedules an asynchronous transition. Heap observations are MiB of JavaScript heap without forced collection; they exclude Canvas and GPU memory.

| Scenario | Generate | Create viewer | Load synchronous | Load + active draws | Heap after load |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10000-circular-arc | 4.40 | 31.30 | 34.20 | 34.20 | 11.85 |
| 10000-circular-arrow | 6.60 | 27.20 | 37.00 | 37.00 | 11.82 |
| 10000-linear-arc | 4.30 | 26.60 | 36.20 | 36.30 | 11.80 |
| 10000-linear-arrow | 5.10 | 30.60 | 35.50 | 35.70 | 11.80 |
