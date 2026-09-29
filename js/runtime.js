'use strict';

// The simulation always advances at 60 Hz, independently of display refresh rate.
// A bounded accumulator prevents a background tab from fast-forwarding a run.
const RaceClock = {
  step: 1000 / 60,
  accumulator: 0,
  last: 0,
  reset(now = performance.now()) { this.last = now; this.accumulator = 0; },
  advance(now, update) {
    this.accumulator += Math.min(100, Math.max(0, now - this.last));
    this.last = now;
    while (this.accumulator + 1e-7 >= this.step) {
      this.accumulator -= this.step;
      if (update(1) === false) { this.accumulator = 0; break; }
    }
  },
};

const RaceLayout = {
  measure(width, height, lanes, dock = 150) {
    const laneW = Math.min(88, Math.max(36, (width - 76) / lanes));
    const roadW = laneW * lanes;
    const pw = laneW * .49;
    const ph = pw * 1.7;
    const landscape=width>height && height<=540;
    return { laneW, roadW, roadX: (width - roadW) / 2, pw, ph,
      py: landscape ? height-ph-38 : Math.max(height * .38, height - dock - ph - 26) };
  },
  remap(g, next, oldHeight, height) {
    const oldX = g.roadX, oldW = g.roadW, oldLane = g.laneW;
    const mapX = x => next.roadX + (x - oldX) / oldW * next.roadW;
    const ratio = next.laneW / oldLane;
    const center = mapX(g.px + g.pw / 2);
    const dy = next.py - g.py;
    for (const e of g.enemies) {
      e.x = mapX(e.x); e.w *= ratio; e.h *= ratio; e.y += dy;
      for (const key of ['targetX', 'pendingX', 'startX']) {
        if (Number.isFinite(e[key])) e[key] = mapX(e[key]);
      }
    }
    for (const list of [g.coinsArr, g.items, g.ice]) {
      for (const item of list) {
        item.x = mapX(item.x); item.y += dy;
        if (item.w) item.w *= ratio;
      }
    }
    for (const item of g.scenery) { item.x = mapX(item.x); item.y *= height / oldHeight; }
    for (const hazard of g.hazards || []) hazard.y += dy;
    Object.assign(g, next);
    g.px = clamp(center - g.pw / 2, g.roadX + 4, g.roadX + g.roadW - g.pw - 4);
    g.touching = false; g.touchTargetX = null;
  },
};
