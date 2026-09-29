const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function context() {
  const sandbox = vm.createContext({ console, performance, localStorage: { getItem: () => null, setItem() {} } });
  for (const name of ['data', 'save', 'runtime']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), sandbox);
  return code => vm.runInContext(code, sandbox);
}
test('v2 save migration preserves owned cars, upgrades, parts, and balances', () => {
  const run = context();
  const s = run(`normalizeSave({v:2, coins:4321, gems:38, selectedCar:3, ownedCars:[0,3],
    upgrades:{3:{speed:4}}, parts:{wing:2}, equipped:['wing'], tutorialDone:true})`);
  assert.equal(s.v, 3); assert.equal(s.coins, 4321); assert.equal(s.selectedCar, 3);
  assert.equal(s.upgrades[3].speed, 4); assert.equal(s.upgrades[3].handling, 0);
  assert.equal(s.parts.wing, 2); assert.equal(s.equipped[0], 'wing');
});
test('malformed storage never creates invalid runtime indices or numeric fields', () => {
  const run = context();
  for (const input of ['null', '[]', '42', `({coins:NaN, level:-3, selectedCar:99, selectedRoad:999, parts:null, daily:null,
    upgrades:{0:{speed:Infinity}}, settings:[], ownedCars:[-1,99,'0'], equipped:['wing','wing']})`]) {
    const s = run(`normalizeSave(${input})`);
    assert.equal(s.selectedCar, 0); assert.equal(s.selectedRoad, 0);
    assert.equal(s.level, 1); assert.ok(Number.isFinite(s.coins));
    assert.equal(s.upgrades[0].speed, 0); assert.equal(s.settings.sound, true);
  }
});
test('unknown keys and duplicate equipment cannot enter a save', () => {
  const run = context();
  const s = run(`normalizeSave(JSON.parse('{"parts":{"wing":99,"__proto__":{"polluted":true}},"equipped":["wing","wing","constructor"]}'))`);
  assert.equal(s.parts.wing, 5); assert.equal(s.equipped.length, 1);
  assert.equal(s.parts.polluted, undefined);
});
test('fixed simulation advances equally at 30 / 60 / 90 / 120 Hz', () => {
  const run = context();
  for (const hz of [30, 60, 90, 120]) {
    assert.equal(run(`(() => { let steps = 0; RaceClock.reset(0);
      for(let i=1;i<=${hz}*10;i++) RaceClock.advance(i*1000/${hz}, () => { steps++; });
      return steps; })()`), 600);
  }
});
test('background gaps cannot fast-forward and stopping ends the tick batch', () => {
  const run = context();
  assert.equal(run(`(() => { let n=0; RaceClock.reset(0); RaceClock.advance(60000, () => {n++;}); return n; })()`), 6);
  assert.equal(run(`(() => { let n=0; RaceClock.reset(0); RaceClock.advance(100, () => {n++; return false;}); return n; })()`), 1);
});
test('four lanes and controls fit a 320px phone', () => {
  const layout = context()('RaceLayout.measure(320,568,4,160)');
  assert.ok(layout.roadX >= 20); assert.ok(layout.roadW < 320);
  assert.ok(layout.py + layout.ph < 568 - 160);
});
test('resize preserves relative positions of traffic, pickups and lane changes', () => {
  const run = context();
  const result = run(`(() => { const layout = RaceLayout.measure(430,932,4,150);
    const g = {...layout, px:layout.roadX + layout.laneW, enemies:[{x:layout.roadX+layout.laneW,
      y:200,w:30,h:50,targetX:layout.roadX+layout.laneW*2}],
      coinsArr:[{x:layout.roadX+layout.laneW*1.5,y:300}],items:[],ice:[],scenery:[]};
    RaceLayout.remap(g,RaceLayout.measure(320,568,4,150),932,568);
    return {lane:(g.enemies[0].x-g.roadX)/g.laneW, target:(g.enemies[0].targetX-g.roadX)/g.laneW,
      coin:(g.coinsArr[0].x-g.roadX)/g.laneW}; })()`);
  assert.equal(result.lane, 1); assert.equal(result.target, 2); assert.equal(result.coin, 1.5);
});
