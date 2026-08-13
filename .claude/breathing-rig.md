# Character Breathing Rig — Maribbit's Blog

## Asset
`src/components/Character.astro` imports `src/assets/character/Character_Standing.svg` (the rigged version, 453×1380 viewBox) via `?raw`. The earlier T-pose and the stale `public/character/` copies were removed — `src/assets/character/` is the single source of truth.

## Anatomical Pivots (in viewBox coordinates, centerline x=226.5)

| Pivot | x | y | Notes |
|---|---|---|---|
| Diaphragm (torso core) | 226.5 | 730 | `Dress` + `Breasts_Upper` |
| Bodice-hem seam (skirt) | 226.5 | 562.978 | `Dress_PleatedHem_Upper` |
| Right shoulder seam | 168.5 | 343.978 | drop-shoulder caps + right lapel |
| Left shoulder seam | 284.5 | 343.978 | drop-shoulder caps + left lapel |
| Right shoulder joint | 116 | 304.014 | whole right arm pendulum |
| Left shoulder joint | 328.999 | 301.477 | whole left arm pendulum |
| Neck base (head) | 226.5 | 290 | `Head` + `Hair_Accessory` |
| Right eye (blink) | 184 | 154 | `Eye_R` |
| Left eye (blink) | 268 | 154 | `Eye_L` |

## 6 Independent Cycles

| Cycle | Period | Shape | Drives |
|---|---|---|---|
| `breathe-torso-core` | 4.8s | scale 1.012×1.010 + -1.6px lift | chest expansion |
| `breathe-skirt` | 5.4s | scale 1.004×1.006 + 0.6px | hem pleats (independent tempo) |
| `breathe-shoulder-r/l` | 4.8s | ±0.9° rotation + lift | drop-shoulder caps |
| `breathe-lapel-r/l` | 4.8s | ±0.6° rotation + lift | lapels swing out on inhale |
| `breathe-arm-r/l` | 4.8s | ±0.55° rotation + lift | whole arm pendulum |
| `breathe-head` | 4.8s | -2.6px translate (no scale) | head rides the chest |

The skirt's 5.4s period intentionally desyncs from the 4.8s body so the hem
breathes a beat behind the chest — looks more organic than synchronized.

## Breath Curve
Asymmetric on every cycle: 0% rest → 34% peak inhale → 46% slight hold → 100% rest. Easing: `cubic-bezier(0.42, 0, 0.4, 1)`. The brief hold at 46% mimics a real breath pause; the slower descent from 46% to 100% mimics the longer exhale.

## Phase Offsets
- Head peaks at 40% (torso peaks at 34%) — the head *follows* the rising ribcage, never *leads* it.
- Skirt pleats peak at 40% with a 5.4s period — slightly behind the chest, then drifts out of phase over time.

## What NOT to Animate Together
- `Head` with any scale — it should only translate, otherwise the face inflates.
- The eye scaleY — that's the JS blink, not the breath.
- The legs — they should stay anchored. Walking/movement is a future rig, not a breath.

## Future Expansion
- Hair sway: separate cycle for the `Hair_Accessory` once you want it to drift on a longer period (8s) like a slow pendulum.
- Body micro-sway: a 7s very-low-amplitude `translateX` on the whole `.character` wrapper would add liveliness without breaking the floor anchor.
- Subtle pupil drift: random `transform: translate` on `Pupil_R/L` every few seconds makes the gaze feel alive.

## Verification
Playwright probe of mid-cycle vs peak-inhale transforms (4.8s cycle, 1.63s delay = 34%):
- Chest scaleX 1.004 → 1.010 (+0.6% widens)
- Head -0.67px → -2.25px lift
- Arms rotation -0.19° → -0.40° swing
- Drop-shoulder caps -0.31° → -0.70° tilt
- Lapels -0.21° → -0.45° swing
- Skirt scaleY 1.001 → 1.006 (+0.5%)

All 6 layers firing independently, on real anatomical pivots.
