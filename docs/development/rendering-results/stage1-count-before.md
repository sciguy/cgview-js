# CGView rendering benchmark

Status: complete. 4/4 scenarios completed.

Chromium 151.0.7922.34; Node v24.21.0; Linux 6.8.0-138-generic (x64).

15 measured rounds after 3 warm-ups; 12 interaction frames; 600 x 600 CSS pixels at DPR 1.

Bundle SHA-256: `a116e4c5d9bf6dbdb84b0eb97c45b6a57fb552623cbadbc1dc7d92228bcc79b9`. Revision: `f2ace3428288d997a2ce2a076aaa207dcb304243`.

Times are milliseconds. Fast and export draw measure synchronous Canvas rendering; export draw excludes SVG serialization and file encoding. Full draw includes progressive scheduling. Frame intervals include browser presentation opportunities and host scheduling. These are not GPU-completion measurements. Instrumented profiles run separately from primary timings.

| Scenario | Zoom | Visible features | Fast median | Fast p90 | Full median | Full p90 | Export median | Frame median | Frame p90 | Interaction CPU median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1000000-circular-arc | 10 | 92815 | 31.50 | 33.40 | 291.90 | 304.00 | 253.50 | 33.30 | 33.40 | 23.80 |
| 1000000-circular-arrow | 10 | 92815 | 35.70 | 37.60 | 367.40 | 389.50 | 318.20 | 33.30 | 33.40 | 29.50 |
| 1000000-linear-arc | 10 | 116668 | 49.00 | 51.80 | 309.80 | 336.00 | 242.80 | 50.00 | 50.10 | 42.10 |
| 1000000-linear-arrow | 10 | 116668 | 39.20 | 44.50 | 390.20 | 400.10 | 345.60 | 33.40 | 50.00 | 35.10 |

## Setup

Times are milliseconds. Heap observations are MiB of JavaScript heap without forced collection; they exclude Canvas and GPU memory.

| Scenario | Generate | Create viewer | Load synchronous | Load settled | Heap after load |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1000000-circular-arc | 191.10 | 30.80 | 2625.20 | 2625.20 | 476.16 |
| 1000000-circular-arrow | 200.20 | 26.40 | 2704.60 | 2704.60 | 476.05 |
| 1000000-linear-arc | 164.60 | 26.70 | 2667.00 | 2667.10 | 472.77 |
| 1000000-linear-arrow | 191.80 | 28.40 | 2686.00 | 2686.10 | 476.05 |
