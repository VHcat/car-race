/* ================= SAVE ================= */
const SAVE_KEY = 'carRaceSave';
const SAVE_DEF = {
  v:2, coins:200, gems:10, xp:0, level:1,
  selectedCar:0, ownedCars:[0], upgrades:{},
  powerups:{magnet:2, shield:1, fuel:2, thunder:1, x2coin:0, slowmo:0},
  buffs:{startNitro:0, coinX2:0},
  bestDistance:0, bestPerRoad:{},
  totalDistance:0, totalCoins:0, totalGames:0, totalDodge:0, totalNear:0, totalRam:0, totalPower:0,
  achClaimed:{}, daily:{date:'', ids:[], progress:{}, claimed:{}},
  rewardDay:0, lastRewardDate:'', lastSpinDate:'',
  selectedRoad:0, settings:{sound:true, music:true, vibrate:true, quality:'high'},
  tutorialDone:false,
};
let S = null;
function loadSave(){
  let raw = null;
  try{ raw = JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){}
  S = JSON.parse(JSON.stringify(SAVE_DEF));
  if(raw && typeof raw==='object'){
    for(const k in S){
      if(raw[k]!==undefined){
        if(typeof S[k]==='object' && S[k]!==null && !Array.isArray(S[k])) S[k] = Object.assign({}, S[k], raw[k]);
        else S[k] = raw[k];
      }
    }
  }
  if(!Array.isArray(S.ownedCars) || !S.ownedCars.length) S.ownedCars=[0];
  if(!S.ownedCars.includes(S.selectedCar)) S.selectedCar = S.ownedCars[0];
}
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
  if(S.daily.date !== t){
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

