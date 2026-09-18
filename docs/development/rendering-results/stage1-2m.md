# CGView rendering benchmark

Status: complete. 1/1 scenarios completed.

Chromium 151.0.7922.34; Node v24.21.0; Linux 6.8.0-138-generic (x64).

3 measured rounds after 1 warm-ups; 6 interaction frames; 600 x 600 CSS pixels at DPR 1.

Bundle SHA-256: `a116e4c5d9bf6dbdb84b0eb97c45b6a57fb552623cbadbc1dc7d92228bcc79b9`. Revision: `f2ace3428288d997a2ce2a076aaa207dcb304243`.

Times are milliseconds. Fast and export draw measure synchronous Canvas rendering; export draw excludes SVG serialization and file encoding. Full draw includes progressive scheduling. Frame intervals include browser presentation opportunities and host scheduling. These are not GPU-completion measurements. Instrumented profiles run separately from primary timings.

| Scenario | Zoom | Visible features | Fast median | Fast p90 | Full median | Full p90 | Export median | Frame median | Frame p90 | Interaction CPU median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2000000-circular-arc | 1 | 2000000 | 256.10 | 256.50 | 5068.00 | 5075.30 | 4757.30 | 250.00 | 266.70 | 253.70 |
| 2000000-circular-arc | 10 | 185637 | 47.60 | 49.40 | 597.10 | 644.20 | 536.30 | 49.90 | 50.10 | 42.60 |
| 2000000-circular-arc | 1000 | 1945 | 1.80 | 2.00 | 10.50 | 10.70 | 2.40 | 16.70 | 16.70 | 1.50 |

## Setup

Times are milliseconds. Load plus active draws waits only for already-started progressive work; it does not establish first-render completion because loading schedules an asynchronous transition. Heap observations are MiB of JavaScript heap without forced collection; they exclude Canvas and GPU memory.

| Scenario | Generate | Create viewer | Load synchronous | Load + active draws | Heap after load |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2000000-circular-arc | 363.10 | 30.00 | 6378.70 | 6378.80 | 1066.54 |
