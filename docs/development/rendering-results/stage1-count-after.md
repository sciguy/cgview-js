# CGView rendering benchmark

Status: complete. 4/4 scenarios completed.

Chromium 151.0.7922.34; Node v24.21.0; Linux 6.8.0-138-generic (x64).

15 measured rounds after 3 warm-ups; 12 interaction frames; 600 x 600 CSS pixels at DPR 1.

Bundle SHA-256: `67d706d918f4f6bb460c9326ead88a4fe5315e76f4c8efe6b6c094ce67f1bd55`. Revision: `f2ace3428288d997a2ce2a076aaa207dcb304243`.

Times are milliseconds. Fast and export draw measure synchronous Canvas rendering; export draw excludes SVG serialization and file encoding. Full draw includes progressive scheduling. Frame intervals include browser presentation opportunities and host scheduling. These are not GPU-completion measurements. Instrumented profiles run separately from primary timings.

| Scenario | Zoom | Visible features | Fast median | Fast p90 | Full median | Full p90 | Export median | Frame median | Frame p90 | Interaction CPU median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1000000-circular-arc | 10 | 92815 | 37.00 | 38.70 | 290.90 | 306.60 | 245.50 | 33.40 | 50.00 | 32.50 |
| 1000000-circular-arrow | 10 | 92815 | 34.50 | 36.30 | 353.60 | 400.70 | 301.30 | 33.30 | 33.40 | 24.90 |
| 1000000-linear-arc | 10 | 116668 | 45.10 | 47.80 | 277.60 | 287.40 | 199.30 | 50.00 | 50.00 | 40.80 |
| 1000000-linear-arrow | 10 | 116668 | 42.80 | 44.10 | 384.10 | 399.40 | 333.20 | 33.40 | 50.00 | 36.40 |

## Setup

Times are milliseconds. Load plus active draws waits only for already-started progressive work; it does not establish first-render completion because loading schedules an asynchronous transition. Heap observations are MiB of JavaScript heap without forced collection; they exclude Canvas and GPU memory.

| Scenario | Generate | Create viewer | Load synchronous | Load + active draws | Heap after load |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1000000-circular-arc | 191.00 | 39.30 | 2681.40 | 2681.50 | 472.83 |
| 1000000-circular-arrow | 162.70 | 27.10 | 2722.60 | 2722.70 | 472.96 |
| 1000000-linear-arc | 189.30 | 27.50 | 2601.90 | 2602.00 | 472.94 |
| 1000000-linear-arrow | 196.90 | 26.70 | 2538.40 | 2538.50 | 476.45 |
