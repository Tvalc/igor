---
title: "Same prompt, every AI sprite tool: a blind 2D art test"
summary: "We give the top AI sprite and game art tools the same four prompts, keep the first result from each, and let people rate the outputs without knowing which tool made them."
prompt: "A pixel-art fox adventurer for a 2D platformer: orange fur, green scarf, small leather satchel, 32x32 pixels, side view, transparent background."
tools:
  - makko-ai
  - pixellab
  - scenario
  - layer-ai
  - spritecook
  - ludo-ai
  - god-mode-ai
  - retro-diffusion
  - sprite-ai
status: planned
date: 2026-10-22
---

## The four prompts

Each tool gets the same four prompts, in this order, in one project or session where the tool allows it.

1. **Character:** the prompt above.
2. **Walk cycle:** "The same fox walking to the right: an 8-frame walk cycle as a single sprite sheet, transparent background."
3. **Four directions:** "The same fox standing, seen from the front, back, left and right, transparent background."
4. **Tileset:** "A matching grass-and-dirt platformer tileset in the same pixel-art style: top edge, fill, left and right edges, and corners, 32x32 tiles."

Where a tool has a dedicated mode for a prompt (a sprite-sheet or tileset tool, say), we use it and note which one.

## Protocol

1. A fresh account on each tool's cheapest plan that can do the task. The plan and its price are recorded.
2. Each prompt is pasted verbatim. Reference images are allowed only for prompts 2 to 4, and only the tool's own output from prompt 1.
3. **The first result is kept.** No rerolls, no picking the best of several, no manual edits. If a tool returns several images at once, the first one shown is kept.
4. We record the time each prompt takes and the credits or money it costs.
5. Every output is saved at full size, unedited, and published here.

## How it's scored

Each tool gets a hands-on score out of 10.

**Objective checks (4 points)**, one point each:

- The character has a real transparent background.
- The walk cycle has 8 frames of the same character.
- The four directions are all present and recognisably the same character.
- The tiles repeat without visible seams.

**Blind rating (6 points).** Outputs are shown on a voting page with tool names hidden and the order shuffled per voter. People rate each image from 1 to 5 for quality and fit to the prompt. A tool's average rating across its four outputs is scaled to 6 points. Tool names and averages are revealed only after voting closes, and the raw votes are published so anyone can check the maths.

The hands-on score is blended 50/50 with the facts-based score on each tool's page once results are published.

## Disclosure

Makko is built by the team that runs this site, so this test is designed to be checked: same prompts, first results only, blind rating and every output public. If another tool wins, the rankings will say so.

## Results

Results will be published here with every output attached. Until then, no hands-on scores are shown anywhere on the site.
