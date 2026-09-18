# CGView rendering benchmark

Status: complete. 2/2 scenarios completed.

Chromium 151.0.7922.34; Node v24.21.0; Linux 6.8.0-138-generic (x64).

3 measured rounds after 1 warm-ups; 6 interaction frames; 600 x 600 CSS pixels at DPR 1.

Bundle SHA-256: `67d706d918f4f6bb460c9326ead88a4fe5315e76f4c8efe6b6c094ce67f1bd55`. Revision: `f2ace3428288d997a2ce2a076aaa207dcb304243`.

Times are milliseconds. Fast and export draw measure synchronous Canvas rendering; export draw excludes SVG serialization and file encoding. Full draw includes progressive scheduling. Frame intervals include browser presentation opportunities and host scheduling. These are not GPU-completion measurements. Instrumented profiles run separately from primary timings.

| Scenario | Zoom | Visible features | Fast median | Fast p90 | Full median | Full p90 | Export median | Frame median | Frame p90 | Interaction CPU median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10000-circular-arc | 1 | 10000 | 2.90 | 3.20 | 31.10 | 31.30 | 7.70 | 16.70 | 16.70 | 3.40 |
| 10000-circular-arc | 10 | 930 | 2.00 | 2.60 | 10.30 | 11.40 | 2.20 | 16.70 | 16.70 | 1.70 |
| 10000-circular-arc | 1000 | 10 | 0.70 | 0.70 | 2.90 | 3.60 | 0.50 | 16.70 | 16.70 | 0.60 |
| 10000-linear-arc | 1 | 10000 | 3.20 | 3.60 | 22.40 | 23.60 | 8.70 | 16.70 | 16.70 | 2.90 |
| 10000-linear-arc | 10 | 1168 | 1.70 | 2.20 | 7.30 | 7.40 | 2.30 | 16.70 | 16.70 | 1.70 |
| 10000-linear-arc | 1000 | 12 | 0.70 | 0.70 | 3.40 | 3.40 | 0.70 | 16.60 | 16.70 | 0.50 |

## Setup

Times are milliseconds. Load plus active draws waits only for already-started progressive work; it does not establish first-render completion because loading schedules an asynchronous transition. Heap observations are MiB of JavaScript heap without forced collection; they exclude Canvas and GPU memory.

| Scenario | Generate | Create viewer | Load synchronous | Load + active draws | Heap after load |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10000-circular-arc | 7.30 | 30.40 | 48.30 | 48.40 | 12.85 |
| 10000-linear-arc | 4.60 | 27.70 | 46.20 | 46.40 | 12.81 |
