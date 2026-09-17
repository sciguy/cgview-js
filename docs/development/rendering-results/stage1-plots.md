# CGView rendering benchmark

Status: complete. 2/2 scenarios completed.

Chromium 151.0.7922.34; Node v24.21.0; Linux 6.8.0-138-generic (x64).

3 measured rounds after 1 warm-ups; 6 interaction frames; 600 x 600 CSS pixels at DPR 1.

Bundle SHA-256: `67d706d918f4f6bb460c9326ead88a4fe5315e76f4c8efe6b6c094ce67f1bd55`. Revision: `f2ace3428288d997a2ce2a076aaa207dcb304243`.

Times are milliseconds. Fast and export draw measure synchronous Canvas rendering; export draw excludes SVG serialization and file encoding. Full draw includes progressive scheduling. Frame intervals include browser presentation opportunities and host scheduling. These are not GPU-completion measurements. Instrumented profiles run separately from primary timings.

| Scenario | Zoom | Visible features | Fast median | Fast p90 | Full median | Full p90 | Export median | Frame median | Frame p90 | Interaction CPU median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10000-circular-arc | 1 | 10000 | 22.60 | 24.10 | 71.10 | 72.10 | 28.40 | 16.70 | 33.40 | 22.40 |
| 10000-circular-arc | 10 | 875 | 3.50 | 3.60 | 14.10 | 14.20 | 4.20 | 16.70 | 16.70 | 3.50 |
| 10000-circular-arc | 1000 | 9 | 0.80 | 0.90 | 4.50 | 4.50 | 1.10 | 16.60 | 16.70 | 0.90 |
| 10000-linear-arc | 1 | 10000 | 20.00 | 21.20 | 62.50 | 63.10 | 28.50 | 16.70 | 33.30 | 20.10 |
| 10000-linear-arc | 10 | 1168 | 4.80 | 4.80 | 16.10 | 16.20 | 6.10 | 16.60 | 16.70 | 4.60 |
| 10000-linear-arc | 1000 | 12 | 0.50 | 0.50 | 3.30 | 3.40 | 0.70 | 16.70 | 16.70 | 0.60 |

## Setup

Times are milliseconds. Load plus active draws waits only for already-started progressive work; it does not establish first-render completion because loading schedules an asynchronous transition. Heap observations are MiB of JavaScript heap without forced collection; they exclude Canvas and GPU memory.

| Scenario | Generate | Create viewer | Load synchronous | Load + active draws | Heap after load |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10000-circular-arc | 66.50 | 33.20 | 112.70 | 112.80 | 46.68 |
| 10000-linear-arc | 66.40 | 28.40 | 114.60 | 114.60 | 46.69 |
