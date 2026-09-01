# Legacy effects and formula inventory

Source commit: `9f2a83d3996207bf6886d80949561c96e1bc175d` on `bug/pulse-position`.

The source files and SHA-256 commitments in [source-hashes.sha256](./source-hashes.sha256) are normative for legacy reproduction. This document is an index, not a substitute for the frozen source.

## Migration classification

| Effect | Runtime | Classification | Preservation target |
| --- | --- | --- | --- |
| FlyingLines | Canvas2D worker | intentional-fix | Preserve visual point-cloud/proximity-line identity; fix timing, lifecycle, boundary, duplicated-pair, string-distance and velocity defects. |
| DroopingLines | Canvas2D worker | intentional-fix | Preserve the `tan`/`atan` deformation and visual character while fixing shared runtime defects. |
| Pulse | Canvas2D worker | intentional-fix | Preserve the exact discovered parametric formula and presets; redefine timing deterministically. |
| Spiral | Canvas2D worker | intentional-fix | Preserve exact formula and visual identity; fix lifecycle/timing. |
| Spiral2 | Canvas2D worker | intentional-fix | Preserve exact formula difference from Spiral. |
| Spiral3 | Canvas2D worker | intentional-fix | Preserve exact formula difference from Spiral2. |
| SpiralFlyingLines | Canvas2D worker | intentional-fix | Preserve polar construction; fix timer/random/lifecycle semantics. |
| FlyingLinesGL | Three.js/WebGL | archive-only | Preserve source/reference only until the shared simulation and renderer contracts exist. |
| FlyingCubesGL | Three.js/WebGL R&D | archive-only | Preserve intact as a notebook; extract only a separately approved coherent experiment. |

## Shared 2D particle template

`FlyingPoints` creates `particlesCount` object records. Each particle starts with:

```text
x = Math.random() * width
y = Math.random() * height
velocity = random(-particleMaxVelocity, +particleMaxVelocity)
velocityX = velocity
velocityY = velocity
life = Math.random() * particleLife * 60
```

`position()` applies `getPosition()` independently to each axis, then adds velocity. `reCalculateLife()` decrements life per frame, respawns with uncontrolled randomness, and increments click-fade `start` by `0.0001` per frame. These exact per-frame and coupled-axis behaviors are evidence, not desired Bindfly 2 semantics.

## FlyingLines

For every particle `i`, legacy code updates life/position and compares it to every `j`:

```text
distance = sqrt((x_j - x_i)^2 + (y_j - y_i)^2).toFixed(3)
connect when distance < lineLength
opacity = 1 - distance / lineLength
```

The non-click variant visits both directed pair orders and self-pairs. The click variant applies the same neighborhood rule plus a frame-based start fade.

## DroopingLines

DroopingLines retains the FlyingLines connection rule but changes one coordinate before measuring:

```text
without addByClick: x_i' = tan(x_i), y_i' = y_i
with addByClick:    x_i' = x_i,      y_i' = atan(y_i)
```

This is a distinct original formula, not a rendering backend.

## Pulse

Initialization:

```text
a = 2.6
radius = min(width, height) / 2
maxParticles = properties.maxParticles || 100
particleSpacing = 2π / maxParticles
numArms = properties.numArms || 2
```

Per-particle update:

```text
if a > 2.9: back = true
if a < 2.65: back = false
a += back ? 1 : -1
a += back ? -0.000005 : +0.000005

arm = floor(i / maxParticles)
angle = particleSpacing * i + arm * π / numArms
distance = radius * (angle / (2π)) * 2

y_i = positionY + tan(distance) * weight * cos(angle * exp(a)) * atan(a)
x_i = positionX - distance * cos(a)
```

Connections use unique `j > i` pairs and the same `lineLength` opacity rule.

## Spiral

Shared construction:

```text
a starts at 2.6
radius = min(width, height) / 2
maxParticles = properties.maxParticles || 100
particleSpacing = 2π / maxParticles
numArms = properties.numArms || 2
preAngle = π / (numArms * maxParticles)

a += 0.999995 * (back ? 1 : -1)
angle = particleSpacing * i + i * preAngle
distance = radius * (angle / (2π)) * 2
```

Spiral coordinates:

```text
x_i = positionX + distance * cos(angle * exp(a)) * sin(a)
y_i = positionY - distance * cos(a)
```

## Spiral2

Spiral2 changes only the x modulation from `sin(a)` to `atan(a)`:

```text
x_i = positionX + distance * cos(angle * exp(a)) * atan(a)
y_i = positionY - distance * cos(a)
```

## Spiral3

Spiral3 keeps Spiral2's x formula and changes y:

```text
x_i = positionX + distance * cos(angle * exp(a)) * atan(a)
y_i = positionY - distance * cos(sin(a))
```

## SpiralFlyingLines

Each particle is assigned a point on an incrementally changing polar path:

```text
x_i = positionX + spiralRadius * cos(spiralAngle * 0.5)
y_i = positionY + spiralRadius * sin(spiralAngle * 0.5)
spiralAngle += or -= 0.1
spiralRadius += or -= 0.05 unless a fixed radius is configured
```

It draws from each point to even-indexed particles with random opacity. Every `20,000 ms`, an unmanaged interval appends four cloned particles. Both the random color and timer behavior need explicit new semantics.

## FlyingLinesGL

The archived 3D line experiment normalizes positions:

```text
x = particle.x / particle.w * 3
y = particle.y / particle.h * 3
z = particle.z / particle.d * 3
```

It compares unique `j > i` pairs in three dimensions and connects when:

```text
distance3D < lineLength / width * 2
```

Velocity components are stored as strings because initialization uses `toFixed(2)`. Current visible routes fail before construction because the async loader is passed as a constructor.

## FlyingCubesGL

This file mixes multiple experimental concerns: particle-driven cubes, procedural 2D and 3D textures, Mandelbrot variants, noise/normal/displacement maps, refraction render targets, custom shader/material experiments and many abandoned branches. Its file hash is the preservation contract. It is not a coherent effect to clean up wholesale.

