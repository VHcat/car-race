'use strict';
/* ================= UTILS ================= */
const clamp = (v,a,b)=>v<a?a:v>b?b:v;
const rand = (a,b)=>a+Math.random()*(b-a);
const irand = (a,b)=>Math.floor(rand(a,b+1));
const pick = arr=>arr[Math.floor(Math.random()*arr.length)];
const lerp = (a,b,t)=>a+(b-a)*t;
const todayStr = ()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();};
const fmt = n=>Math.floor(n).toLocaleString('en-US');
function buzz(ms){ try{ if(S.settings.vibrate && navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function seededPick(arr, seed, n){ // deterministic pick n items
  const out=[]; const used=new Set(); let s=seed;
  while(out.length<n && out.length<arr.length){
    s=(Math.imul(s,1103515245)+12345)>>>0;
    const i=s%arr.length;
    if(!used.has(i)){ used.add(i); out.push(arr[i]); }
  }
  return out;
}
const $ = id=>document.getElementById(id);

/* ================= DATA ================= */
const CARS = [
  {id:0, name:'运动跑车', shape:'sport',  speed:5, accel:5, handling:5, nitro:5, price:0,    body:'#e5383b', accent:'#ffffff'},
  {id:1, name:'越野吉普', shape:'jeep',   speed:4, accel:4, handling:6, nitro:4, price:500,  body:'#2a9d3f', accent:'#143d1c'},
  {id:2, name:'出租车',   shape:'taxi',   speed:4, accel:5, handling:7, nitro:4, price:900,  body:'#f7c948', accent:'#1c1c1c'},
  {id:3, name:'F1赛车',   shape:'f1',     speed:8, accel:7, handling:4, nitro:6, price:1500, body:'#3f8cff', accent:'#e5383b'},
  {id:4, name:'皮卡',     shape:'pickup', speed:5, accel:5, handling:5, nitro:5, price:1800, body:'#1fb6c9', accent:'#0e5560'},
  {id:5, name:'怪兽卡车', shape:'monster',speed:3, accel:6, handling:3, nitro:8, price:2400, body:'#8f2fd4', accent:'#ffd60a'},
  {id:6, name:'警车',     shape:'police', speed:6, accel:6, handling:6, nitro:5, price:3200, body:'#eef1f5', accent:'#1c2733'},
  {id:7, name:'肌肉车',   shape:'muscle', speed:7, accel:8, handling:4, nitro:6, price:4200, body:'#ff7b1c', accent:'#1c1c1c'},
  {id:8, name:'黄金超跑', shape:'gold',   speed:9, accel:7, handling:6, nitro:7, price:6800, body:'#f4c430', accent:'#7a5c00'},
  {id:9, name:'装甲战车', shape:'armor',  speed:5, accel:4, handling:5, nitro:9, price:9999, body:'#5c6672', accent:'#2b3138'},
];
const ROADS = [
  {id:0, name:'乡村公路', emoji:'🌾', diff:1, lanes:3, traffic:0.6,  coinMul:1.0, theme:'countryside'},
  {id:1, name:'海边公路', emoji:'🏖️', diff:2, lanes:3, traffic:0.75, coinMul:1.2, theme:'coast'},
  {id:2, name:'高速公路', emoji:'🛣️', diff:2, lanes:4, traffic:0.9,  coinMul:1.3, theme:'highway'},
  {id:3, name:'城市街道', emoji:'🌃', diff:3, lanes:4, traffic:1.1,  coinMul:1.5, theme:'citynight'},
  {id:4, name:'沙漠公路', emoji:'🏜️', diff:4, lanes:3, traffic:1.0,  coinMul:1.8, theme:'desert'},
  {id:5, name:'雪山公路', emoji:'🏔️', diff:5, lanes:3, traffic:1.3,  coinMul:2.2, theme:'snow'},
];
const THEMES = {
  countryside:{ skyTop:'#6db9ee', skyMid:'#aedcf8', skyBot:'#e6f6d4', ground:'#5da257', groundDark:'#4c8a48',
    road:'#4a4e57', shoulder:'#8a7a5c', marking:'#f4f4ef', night:false, weather:null,
    horizon:'hills', hzA:'#3f7d44', hzB:'#57975b', scenery:['tree1','tree2','bush','flower'], cloud:'rgba(255,255,255,.92)' },
  coast:{ skyTop:'#ff8f3c', skyMid:'#ffc06b', skyBot:'#ffe9c2', ground:'#e8c877', groundDark:'#d9b563',
    road:'#4a4e57', shoulder:'#c9a75e', marking:'#f4f4ef', night:false, weather:null, sea:true, sun:true,
    horizon:'sea', hzA:'#2f7fa8', hzB:'#57a8cf', scenery:['palm','palm','rock'], cloud:'rgba(255,236,210,.8)' },
  highway:{ skyTop:'#8fb8de', skyMid:'#c2d8ea', skyBot:'#e2ebf2', ground:'#7a8f6a', groundDark:'#697d5b',
    road:'#3f434c', shoulder:'#9aa0a8', marking:'#f4f4ef', night:false, weather:null,
    horizon:'city', hzA:'#7d93a8', hzB:'#93a9bd', scenery:['pole','tree2','sign'], cloud:'rgba(255,255,255,.85)' },
  citynight:{ skyTop:'#0b1026', skyMid:'#1a2248', skyBot:'#333b63', ground:'#232833', groundDark:'#1c2029',
    road:'#2c3038', shoulder:'#3a404c', marking:'#d8dce4', night:true, weather:'rain', stars:true,
    horizon:'skyline', hzA:'#141a30', hzB:'#0f1426', windows:true, scenery:['lamp','hydrant','cone'] },
  desert:{ skyTop:'#ffcf7a', skyMid:'#ffe6b0', skyBot:'#fff3d6', ground:'#e0b265', groundDark:'#d09f50',
    road:'#57503f', shoulder:'#c49a58', marking:'#f7edd2', night:false, weather:'sand',
    horizon:'dunes', hzA:'#c99b52', hzB:'#b8873f', scenery:['cactus','cactus','skull'], cloud:'rgba(255,240,210,.5)' },
  snow:{ skyTop:'#9dc0dc', skyMid:'#cfe2f0', skyBot:'#eef5fa', ground:'#e8f0f6', groundDark:'#d6e4ee',
    road:'#3c4148', shoulder:'#b9c9d6', marking:'#f4f7fa', night:false, weather:'snow', ice:true,
    horizon:'mountains', hzA:'#8fa8bd', hzB:'#b6c9d8', scenery:['pine','pine','snowman'], cloud:'rgba(255,255,255,.8)' },
};
const ENEMY_TYPES = [
  {name:'compact', w:34, h:54,  sp:[1.0,2.2], weight:3},
  {name:'sedan',   w:36, h:60,  sp:[0.8,2.0], weight:4},
  {name:'suv',     w:40, h:66,  sp:[0.7,1.7], weight:3},
  {name:'sports',  w:34, h:56,  sp:[2.6,3.6], weight:2, changer:true},
  {name:'truck',   w:42, h:88,  sp:[0.3,0.8], weight:2},
  {name:'bus',     w:44, h:110, sp:[0.4,0.9], weight:1},
];
const ENEMY_COLORS = ['#3f8cff','#ff7b1c','#2a9d3f','#8f2fd4','#1fb6c9','#e5383b','#f7c948','#5c6672','#d4548f'];
const SHOP_ITEMS = [
  {id:'magnet', name:'磁铁',   emoji:'🧲', desc:'15秒内自动吸附附近金币',       price:100},
  {id:'shield', name:'保护盾', emoji:'🛡️', desc:'抵挡一次碰撞',                 price:150},
  {id:'fuel',   name:'备用油箱',emoji:'⛽', desc:'立即补充35%油量',              price:80},
  {id:'thunder',name:'雷霆',   emoji:'⚡', desc:'清除屏幕上所有来车',           price:200},
  {id:'x2coin', name:'双倍金币',emoji:'💰', desc:'30秒内金币收益翻倍',           price:250},
  {id:'slowmo', name:'时间减缓',emoji:'⏳', desc:'8秒内来车大幅减速',            price:180},
];
const GEM_ITEMS = [
  {id:'startNitro', name:'氮气胶囊', emoji:'🚀', desc:'下一场比赛满氮气出发',   price:8},
  {id:'coinX2',     name:'幸运金币', emoji:'🍀', desc:'下一场比赛金币 ×2',      price:12},
];
const REWARDS = [
  {day:1, icon:'🪙', amount:100},{day:2, icon:'🪙', amount:150},{day:3, icon:'🧲', amount:1, type:'magnet'},
  {day:4, icon:'🪙', amount:200},{day:5, icon:'🛡️', amount:1, type:'shield'},{day:6, icon:'🪙', amount:300},
  {day:7, icon:'💎', amount:8, gem:true},{day:8, icon:'🪙', amount:250},{day:9, icon:'⛽', amount:2, type:'fuel'},
  {day:10, icon:'🪙', amount:350},{day:11, icon:'⚡', amount:1, type:'thunder'},{day:12, icon:'🪙', amount:400},
  {day:13, icon:'🪙', amount:500},{day:14, icon:'💎', amount:20, gem:true},
];
const DAILY_POOL = [
  {id:'dCoins', stat:'coins', target:150, name:'金币猎人', desc:'今日收集150枚金币', icon:'🪙', rw:{coins:120}},
  {id:'dDist',  stat:'dist',  target:1500,name:'长途车手', desc:'今日行驶1500米',   icon:'📏', rw:{coins:150}},
  {id:'dDodge', stat:'dodge', target:30,  name:'闪避高手', desc:'今日闪避30辆车',   icon:'🏎️', rw:{coins:100}},
  {id:'dNear',  stat:'near',  target:10,  name:'擦身而过', desc:'今日完成10次险胜', icon:'⚡', rw:{gems:3}},
  {id:'dPower', stat:'power', target:3,   name:'道具达人', desc:'今日使用3次道具',  icon:'🧰', rw:{coins:90}},
  {id:'dGames', stat:'games', target:3,   name:'常客车手', desc:'今日完成3场比赛',  icon:'🏁', rw:{coins:80}},
  {id:'dRam',   stat:'ram',   target:6,   name:'氮气狂人', desc:'今日氮气撞飞6辆车',icon:'💥', rw:{gems:3}},
  {id:'dCombo', stat:'combo', target:12,  name:'连击之王', desc:'今日达成12连击',   icon:'🔥', rw:{coins:130}},
];
const ACHIEVEMENTS = [
  {id:'a1',  name:'初次旅行',   desc:'累计行驶500米',      icon:'📏', get:()=>S.totalDistance, target:500,  rw:{coins:100}},
  {id:'a2',  name:'千里之行',   desc:'累计行驶5000米',     icon:'🛣️', get:()=>S.totalDistance, target:5000, rw:{coins:400}},
  {id:'a3',  name:'环游地球',   desc:'累计行驶20000米',    icon:'🌍', get:()=>S.totalDistance, target:20000,rw:{gems:15}},
  {id:'a4',  name:'小储蓄罐',   desc:'累计收集800金币',    icon:'🪙', get:()=>S.totalCoins,    target:800,  rw:{coins:200}},
  {id:'a5',  name:'大富翁',     desc:'累计收集5000金币',   icon:'💰', get:()=>S.totalCoins,    target:5000, rw:{gems:12}},
  {id:'a6',  name:'常客司机',   desc:'参加10场比赛',       icon:'🏁', get:()=>S.totalGames,    target:10,   rw:{coins:150}},
  {id:'a7',  name:'老司机',     desc:'参加50场比赛',       icon:'🎖️', get:()=>S.totalGames,    target:50,   rw:{gems:10}},
  {id:'a8',  name:'闪避艺术家', desc:'累计闪避100辆车',    icon:'🌀', get:()=>S.totalDodge,    target:100,  rw:{coins:250}},
  {id:'a9',  name:'险胜大师',   desc:'累计完成50次险胜',   icon:'⚡', get:()=>S.totalNear,     target:50,   rw:{coins:300}},
  {id:'a10', name:'氮气破坏王', desc:'累计氮气撞飞30辆车', icon:'💥', get:()=>S.totalRam,      target:30,   rw:{gems:8}},
  {id:'a11', name:'道具大师',   desc:'累计使用20次道具',   icon:'🧰', get:()=>S.totalPower,    target:20,   rw:{coins:200}},
  {id:'a12', name:'千米达人',   desc:'单局行驶1500米',     icon:'🏆', get:()=>S.bestDistance,  target:1500, rw:{coins:400}},
  {id:'a13', name:'传奇车手',   desc:'单局行驶4000米',     icon:'👑', get:()=>S.bestDistance,  target:4000, rw:{gems:20}},
  {id:'a14', name:'汽车收藏家', desc:'拥有5辆赛车',        icon:'🚗', get:()=>S.ownedCars.length, target:5, rw:{gems:10}},
];
const LEVEL_TITLES = ['新手司机','马路新秀','街道飞人','漂移舞者','极速狂人','涡轮猎手','秋名山车神','传奇车手','车神'];
const xpNeed = lv=>80+lv*45;
const levelTitle = lv=>LEVEL_TITLES[Math.min(Math.floor((lv-1)/3), LEVEL_TITLES.length-1)];
const STAT_META = [
  {key:'speed',    label:'极速'},
  {key:'accel',    label:'加速'},
  {key:'handling', label:'操控'},
  {key:'nitro',    label:'氮气'},
];

