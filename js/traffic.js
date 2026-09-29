'use strict';
// Lane reservations keep generated traffic and signalled lane changes readable.
const RaceTraffic = {
  canChange(g, car, lane){
    if(lane===RaceDirector.reservedLane(g)) return false;
    const occupied=new Set([car.lane,lane]);
    for(const other of g.enemies){
      if(other===car || Math.abs(other.y-car.y)>Math.max(160,g.pSpeed*45)) continue;
      if(other.lane===lane || other.targetLane===lane && other.blink) return false;
      occupied.add(other.lane);
      if(other.blink) occupied.add(other.targetLane);
    }
    const reserved=RaceDirector.reservedLane(g);
    if(reserved>=0) occupied.add(reserved);
    return occupied.size<g.laneCount;
  },
  update(game, dt){
    const g=game.g;
    /* ---- 敌车运动 / 变道 ---- */
    const slow = g.slowTimer>0 ? .35 : 1;
    for(const e of g.enemies){
      // Short landscape screens still provide at least ~1.3 s of visible warning.
      const closingSpeed=Math.min(g.pSpeed-e.speed,Math.max(1.5,(g.py-100)/80));
      e.y += closingSpeed*slow*dt;
      /* 变道决策：跑车追猎玩家车道，其余车辆随机缓变道 */
      if(e.targetX===undefined && e.changeDelay===undefined && e.y > game.H*.08 && e.y < Math.min(game.H*.46,g.py-150) && Math.random() < e.changeRate*dt){
        const cur = e.lane;
        let nl;
        if(e.changer){
          const pLane = Math.floor((g.px + g.pw/2 - g.roadX)/g.laneW);
          nl = cur + (pLane > cur ? 1 : pLane < cur ? -1 : (Math.random()<.5?-1:1));
        } else {
          nl = cur + (Math.random()<.5?-1:1);
        }
        if(nl<0) nl = cur+1; if(nl>=g.laneCount) nl = cur-1;
        if(nl>=0 && nl<g.laneCount && nl!==cur){
          const tx = g.roadX + nl*g.laneW + (g.laneW-e.w)/2 + rand(-8,8);
          const blocked = g.enemies.some(o=>o!==e && Math.abs(o.x-tx)<e.w && Math.abs(o.y-e.y)<e.h+90);
          if(!blocked && this.canChange(g,e,nl)){ e.dir = nl>cur?1:-1; e.blink = 1; e.blinkFrame = 0; e.changeDelay = 60; e.targetLane = nl; e.pendingX = tx; }
        }
      }
      if(e.blink){
        e.blinkFrame += dt;
        if(e.changeDelay !== undefined){
          e.changeDelay -= dt*slow;
          if(e.changeDelay <= 0){
            if(!this.canChange(g,e,e.targetLane)){
              e.changeDelay=undefined;e.pendingX=undefined;e.blink=0;
              continue;
            }
            e.targetX = clamp(e.pendingX, g.roadX+2, g.roadX+g.roadW-e.w-2);
            e.startX = e.x; e.changeT = 0;
            e.changeDelay = undefined;
          }
        }
      }
      if(e.targetX !== undefined){
        /* 定时 S 曲线漂移：缓起缓收，给玩家反应时间 */
        e.changeT += dt*slow;
        const p = Math.min(1, e.changeT / e.changeDur);
        const s = p*p*(3-2*p);
        e.x = e.startX + (e.targetX - e.startX)*s;
        if(p >= 1){ e.x = e.targetX; e.targetX = undefined; e.blink = 0; e.lane = e.targetLane; }
      }
    }
    /* 通过判定 + 险胜 */
    g.enemies = g.enemies.filter(e=>{
      if(e.y > game.H + 60) return false;
      if(!e.passed && e.y > g.py + g.ph){
        e.passed = true;
        g.dodgeCount++;
        feed('dodge', 1);
        g.bonusScore += 5;
        const gapX = Math.abs((e.x+e.w/2) - (g.px+g.pw/2));
        const edgeGap=gapX-(e.w+g.pw)/2;
        if(!e.nearDone && edgeGap >= -2 && edgeGap < 22 && e.speed < g.pSpeed && g.flyAlt < .35){
          e.nearDone = true;
          g.combo++;
          g.comboTimer = 220;
          g.maxCombo = Math.max(g.maxCombo, g.combo);
          g.nearCount++;
          feed('near', 1);
          feed('combo', g.combo);
          g.nitro = Math.min(100, g.nitro + 13);
          g.bonusScore += 10*g.combo;
          game.addFloat(e.x+e.w/2, g.py-10, g.combo>=3?`险胜! 连击×${g.combo}`:'险胜!', '#ffd60a', 17);
          AudioSys.near();
          buzz(12);
          g.shake = Math.max(g.shake, 2.5);
          const hc = $('hudCombo');
          if(g.combo >= 3){
            hc.textContent = `🔥 连击 ×${g.combo}`;
            hc.classList.remove('on'); void hc.offsetWidth; hc.classList.add('on');
          }
        }
      }
      return true;
    });

  },
  spawn(game, difficulty){
    const g = game.g;
    /* 可解性：按实际矩形覆盖计算被占车道，至少保留一条空车道 */
    const blocked = new Set();
    const reserved=RaceDirector.reservedLane(g);
    if(reserved>=0) blocked.add(reserved);
    for(const e of g.enemies){
      if(e.y < game.H*.42){
        const l0 = Math.max(0, Math.floor((e.x - g.roadX)/g.laneW));
        const l1 = Math.min(g.laneCount-1, Math.floor((e.x + e.w - 1 - g.roadX)/g.laneW));
        for(let l=l0; l<=l1; l++) blocked.add(l);
        if(e.blink && Number.isInteger(e.targetLane)) blocked.add(e.targetLane);
      }
    }
    if(blocked.size >= g.laneCount-1) return;
    const free = [];
    for(let l=0; l<g.laneCount; l++) if(!blocked.has(l)) free.push(l);
    const lane = pick(free);
    /* 加权选车型 */
    const pool = [];
    ENEMY_TYPES.forEach(t=>{ for(let i=0;i<t.weight;i++) pool.push(t); });
    const type = pick(pool);
    const scale = g.laneW / 80;
    const w = type.w*scale, h = type.h*scale, y = -h-24;
    const cx = g.roadX + lane*g.laneW + (g.laneW-w)/2;
    /* Keep traffic inside its declared lane to preserve the free-lane guarantee. */
    const maxOff = Math.max(4, (g.laneW-w)/2 - 2) * .7;
    let x = cx + rand(-maxOff, maxOff);
    /* 顶部清空（按实际矩形判定，避免压线车互相重叠） */
    if(g.enemies.some(o=>o.y < 130 && rectOverlap(x, y, w, h, o.x, o.y, o.w, o.h))) return;
    const big = type.name==='truck' || type.name==='bus';
    g.enemies.push({
      x, y, w, h, lane,
      speed: rand(type.sp[0], type.sp[1]) + (difficulty-1)*.25,
      color: pick(ENEMY_COLORS),
      type: type.name,
      changer: !!type.changer && difficulty > 2.0,
      changeRate: type.changer ? .012 : (big ? .0025 : .005),
      changeDur: big ? 70 : (type.changer ? 45 : 60),
      passed:false, nearDone:false, blink:0, blinkFrame:0, targetX:undefined, dir:0,
    });
  },
};
