/* ================= SAVE ================= */
const SAVE_KEY = 'carRaceSave';
const SAVE_DEF = {
  v:3, coins:200, gems:10, xp:0, level:1,
  selectedCar:0, ownedCars:[0], upgrades:{},
  parts:{}, equipped:[],
  powerups:{magnet:2, shield:1, fuel:2, thunder:1, x2coin:0, slowmo:0},
  buffs:{startNitro:0, coinX2:0},
  bestDistance:0, bestPerRoad:{}, bestSprint:{}, selectedMode:'endless',
  totalDistance:0, totalCoins:0, totalGames:0, totalDodge:0, totalNear:0, totalRam:0, totalPower:0,
  achClaimed:{}, daily:{date:'', ids:[], progress:{}, claimed:{}},
  rewardDay:0, lastRewardDate:'', lastSpinDate:'',
  selectedRoad:0, settings:{sound:true, music:true, vibrate:true, quality:'high', control:'relative', reducedMotion:false},
  tutorialDone:false,
};
let S = null;
function loadSave(){
  let raw = null;
  try{ raw = JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){}
  S = normalizeSave(raw);
}

// Validate each persisted field; never merge untrusted objects into live state.
function normalizeSave(raw){
  const result = JSON.parse(JSON.stringify(SAVE_DEF));
  const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const number = (value, fallback = 0, max = 1e12) =>
    typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, max) : fallback;
  const count = (value, fallback = 0, max = 1e9) => Math.floor(number(value, fallback, max));
  const source = obj(raw);
  for(const key of Object.keys(result)){
    if(typeof result[key] === 'number') result[key] = number(source[key], result[key]);
    if(typeof result[key] === 'boolean' && typeof source[key] === 'boolean') result[key] = source[key];
    if(typeof result[key] === 'string' && typeof source[key] === 'string') result[key] = source[key].slice(0, 40);
  }
  result.v = 3;
  result.level = Math.max(1, count(source.level, 1, 10000));
  result.rewardDay = count(source.rewardDay, 0, 14);
  result.ownedCars = [...new Set([0, ...(Array.isArray(source.ownedCars) ? source.ownedCars : [])])]
    .filter(id => Number.isInteger(id) && CARS.some(c => c.id === id));
  result.selectedCar = result.ownedCars.includes(source.selectedCar) ? source.selectedCar : 0;
  result.selectedRoad = ROADS.some(r => r.id === source.selectedRoad) ? source.selectedRoad : 0;
  result.selectedMode = source.selectedMode === 'sprint' ? 'sprint' : 'endless';
  for(const car of CARS){
    const up = obj(obj(source.upgrades)[car.id]);
    result.upgrades[car.id] = {};
    for(const {key} of STAT_META) result.upgrades[car.id][key] = count(up[key], 0, 5);
  }
  for(const part of PARTS) result.parts[part.id] = count(obj(source.parts)[part.id], 0, part.maxLv);
  result.equipped = [...new Set(Array.isArray(source.equipped) ? source.equipped : [])]
    .filter(id => PARTS.some(p => p.id === id) && result.parts[id] > 0).slice(0, partSlots(result.level));
  for(const key of ['powerups', 'buffs']){
    for(const id of Object.keys(result[key])) result[key][id] = count(obj(source[key])[id], result[key][id]);
  }
  for(const road of ROADS) result.bestPerRoad[road.id] = count(obj(source.bestPerRoad)[road.id]);
  for(const road of ROADS) result.bestSprint[road.id] = count(obj(source.bestSprint)[road.id]);
  for(const a of ACHIEVEMENTS) result.achClaimed[a.id] = obj(source.achClaimed)[a.id] === true;
  const daily = obj(source.daily);
  result.daily.date = typeof daily.date === 'string' ? daily.date.slice(0, 40) : '';
  result.daily.ids = [...new Set(Array.isArray(daily.ids) ? daily.ids : [])]
    .filter(id => DAILY_POOL.some(m => m.id === id)).slice(0, 3);
  for(const m of DAILY_POOL){
    result.daily.progress[m.stat] = number(obj(daily.progress)[m.stat]);
    result.daily.claimed[m.id] = obj(daily.claimed)[m.id] === true;
  }
  const settings = obj(source.settings);
  for(const key of ['sound', 'music', 'vibrate', 'reducedMotion']){
    if(typeof settings[key] === 'boolean') result.settings[key] = settings[key];
  }
  result.settings.quality = settings.quality === 'low' ? 'low' : 'high';
  result.settings.control = settings.control === 'direct' ? 'direct' : 'relative';
  return result;
}
/* 已装备零件等级；未装备或未拥有返回 0 */
function partLv(id){ return S.equipped.includes(id) ? (S.parts[id]||0) : 0; }
let saveWarned = false;
function save(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
  catch(e){
    if(!saveWarned){
      saveWarned = true;
      if(typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ 存档写入失败，进度可能无法保存！');
    }
  }
}

/* ================= STATS / EVENTS ================= */
function ensureDaily(){
  const t = todayStr();
  if(S.daily.date !== t || S.daily.ids.length !== 3){
    S.daily = {date:t, ids:[], progress:{}, claimed:{}};
    const seed = hashStr(t);
    S.daily.ids = seededPick(DAILY_POOL, seed, 3).map(m=>m.id);
    save();
  }
}
function feed(stat, val){
  ensureDaily();
  const p = S.daily.progress;
  if(stat==='combo'){ p.combo = Math.max(p.combo||0, val); }
  else p[stat] = (p[stat]||0) + val;
}
function feedMax(stat, val){ ensureDaily(); const p=S.daily.progress; p[stat]=Math.max(p[stat]||0, val); }
