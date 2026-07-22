'use strict';
/* ================= 游戏引擎 ================= */
const Game = {
  g:null, raf:0, paused:false,
  cv:null, ctx:null, W:0, H:0, dpr:1,
  lastTs:0,
  reviveTimeout:0,

  /* ---------- 启动 ---------- */
  start(){
    if(!S.tutorialDone){ Tutorial.show(); return; }
    UI.go.call(UI, 'gameScreen');
    document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('active'));
    this.paused = false;
    this.cv = $('gameCanvas');
    this.ctx = this.cv.getContext('2d');
    this.resize();

    const road = ROADS[S.selectedRoad];
    const car = CARS[S.selectedCar];
    const up = S.upgrades[car.id] || {speed:0, accel:0, handling:0, nitro:0};
    const eff = k=>car[k] + up[k]*.6;
    const laneW = clamp((this.W-56)/road.lanes, 54, 92);
    const roadW = laneW*road.lanes;
    const pw = laneW*.52, ph = pw*1.7;
    const startNitroBuff = S.buffs.startNitro > 0;
    const coinX2Buff = S.buffs.coinX2 > 0;
    /* 改装零件（仅已装备的生效） */
    const wingLv = partLv('wing'), armorLv = partLv('armor'), tankLv = partLv('fueltank');
    const magLv = partLv('magnetp'), chipLv = partLv('coinchip'), turboLv = partLv('turbo'), recLv = partLv('nitrorec');
    const wingOwned = (S.parts.wing||0) > 0;
    const fuelCap = 100 + tankLv*12;

    this.g = {
      road, car, themeKey:road.theme, th:THEMES[road.theme],
      laneCount:road.lanes, laneW, roadW, roadX:(this.W-roadW)/2,
      px: this.W/2 - pw/2, py: this.H - ph - 128, pw, ph,
      pSpeed:0, vx:0, tilt:0,
      maxSpeed: (3.1 + eff('speed')*.5) * (1+turboLv*.04),
      accelRate: .016 + eff('accel')*.0038,
      handling: (2.1 + eff('handling')*.42) * (1-turboLv*.03),
      nitroPower: 1.45 + eff('nitro')*.05,
      nitroDrain: Math.max(13, 30 - eff('nitro')*1.1)/60,
      nitroRegen: recLv*1.2/60,
      fuel:fuelCap, fuelCap, fuelDrain: .017 + road.traffic*.004,
      distance:0, dashScroll:0, coins:0, bonusScore:0, score:0,
      combo:0, comboTimer:0,
      nitro: startNitroBuff ? 100 : 30, nitroActive:false,
      enemies:[], coinsArr:[], items:[], particles:[], floats:[],
      scenery:[], weather:[], ice:[],
      enemyTimer:0, coinTimer:0, itemTimer: irand(300,500), sceneryTimer:0,
      magnetTimer: magLv ? (4+magLv*2)*60 : 0, shield:false, x2Timer:0, slowTimer:0, invincibleTimer:0,
      coinChip: 1 + chipLv*.1,
      armorHits: armorLv ? 1+Math.floor((armorLv-1)/2) : 0,
      wingLv, wingOwned, flyEnergy:100, flying:false, flyAlt:0, flyHeld:false, flyDur:(2+wingLv*.6)*60,
      state:'countdown', countT:3.3, dieT:0, dieReason:'',
      shake:0, timeScale:1,
      reviveUsed:false, coinX2Buff, startNitroBuff,
      dodgeCount:0, nearCount:0, ramCount:0, maxCombo:0,
      lowWarn25:false, lowWarn10:false,
      checkpointNext:500,
      touchTargetX:null, touching:false, moveLeft:false, moveRight:false, nitroHeld:false,
      frame:0,
      hzSeed: (Math.random()*1e9)|0,
    };
    /* 初始 scenery */
    for(let y=-60; y<this.H+80; y+=rand(70,130)){
      this.spawnScenery(y);
    }
    this.buildPuRow();
    this.updateHud(true);
    $('hudCombo').classList.remove('on');
    $('flyBtn').hidden = false;
    $('flyBtn').classList.remove('flying');
    $('flyBtn').classList.toggle('locked', !wingOwned);
    $('touchHint').textContent = wingLv > 0
      ? '👆 左右拖动转向 · 长按 NOS 氮气 · 长按 FLY 飞越来车'
      : wingOwned
        ? '👆 左右拖动转向 · 长按 NOS 氮气 · FLY 需先装备飞翼'
        : '👆 左右拖动控制方向 · 长按 NOS 氮气加速';
    $('touchHint').classList.toggle('on', true);
    const runRef = this.g;
    setTimeout(()=>{ if(this.g === runRef) $('touchHint').classList.remove('on'); }, 3800);
    AudioSys.ensure();
    cancelAnimationFrame(this.raf);
    this.lastTs = performance.now();
    const loop = ts=>{
      if(!this.g) return;
      const dtRaw = clamp((ts - this.lastTs)/16.667, 0, 3);
      this.lastTs = ts;
      if(!this.paused){
        this.update(dtRaw);
        if(!this.g) return;
        this.render();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  restart(){
    document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('active'));
    this.paused = false;
    this.start();
  },

  quit(){
    cancelAnimationFrame(this.raf);
    this.g = null;
    this.paused = false;
    clearTimeout(this.reviveTimeout);
    document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('active'));
    AudioSys.setEngine(0, false);
    UI.go('menuScreen');
  },

  togglePause(){
    if(!this.g || this.g.state==='dying' || this.g.state==='revive') return;
    this.paused = !this.paused;
    $('pauseOverlay').classList.toggle('active', this.paused);
    AudioSys.click();
    if(this.paused) AudioSys.setEngine(0, false);
  },

  /* ---------- 道具栏 ---------- */
  PU_ORDER:['magnet','shield','fuel','thunder','x2coin','slowmo'],
  PU_ICO:{magnet:'🧲', shield:'🛡️', fuel:'⛽', thunder:'⚡', x2coin:'💰', slowmo:'⏳'},
  buildPuRow(){
    const row = $('puRow');
    row.innerHTML = '';
    this.PU_ORDER.forEach((id, i)=>{
      const b = document.createElement('button');
      b.className = 'pu-btn';
      b.id = 'pu-'+id;
      b.title = '快捷键 ' + (i+1);
      b.innerHTML = `${this.PU_ICO[id]}<span class="cnt">0</span>`;
      b.addEventListener('click', ()=>this.usePowerup(id));
      row.appendChild(b);
    });
    this.updatePuRow();
  },
  updatePuRow(){
    if(!this.g) return;
    this.PU_ORDER.forEach(id=>{
      const b = $('pu-'+id);
      if(!b) return;
      const cnt = S.powerups[id]||0;
      b.querySelector('.cnt').textContent = cnt;
      b.classList.toggle('zero', cnt<=0);
      const lit = (id==='magnet'&&this.g.magnetTimer>0)||(id==='x2coin'&&this.g.x2Timer>0)||(id==='slowmo'&&this.g.slowTimer>0);
      b.classList.toggle('lit', lit);
    });
    $('hudShieldIco').classList.toggle('on', this.g.shield);
    $('hudX2').classList.toggle('on', this.g.x2Timer>0);
    $('hudSlow').classList.toggle('on', this.g.slowTimer>0);
    $('hudArmor').classList.toggle('on', this.g.armorHits>0);
    $('hudArmor').textContent = '🦾×' + this.g.armorHits;
  },
  usePowerup(id){
    const g = this.g;
    if(!g || g.state!=='run' || this.paused) return;
    if((S.powerups[id]||0) <= 0){ UI.toast('道具不足，去商店补充！'); return; }
    S.powerups[id]--;
    S.totalPower++;
    feed('power', 1);
    switch(id){
      case 'magnet': g.magnetTimer = 15*60; UI.toast('🧲 磁铁激活！'); AudioSys.pickup(); break;
      case 'shield': g.shield = true; UI.toast('🛡️ 保护盾就绪！'); AudioSys.shield(); break;
      case 'fuel': g.fuel = Math.min(g.fuelCap, g.fuel+35); UI.toast('⛽ 油量 +35%'); AudioSys.fuelUp(); break;
      case 'thunder':
        g.enemies.forEach(e=>{ this.explode(e.x+e.w/2, e.y+e.h/2); g.coins++; g.bonusScore+=10; });
        if(g.enemies.length) feed('coins', g.enemies.length);
        g.enemies = [];
        UI.toast('⚡ 雷霆清场！'); AudioSys.thunder(); g.shake = Math.max(g.shake, 10);
        break;
      case 'x2coin': g.x2Timer = 30*60; UI.toast('💰 双倍金币 30 秒！'); AudioSys.pickup(); break;
      case 'slowmo': g.slowTimer = 8*60; UI.toast('⏳ 时间减缓！'); AudioSys.shield(); break;
    }
    save();
    this.updatePuRow();
  },

  /* ---------- 更新 ---------- */
  update(dtRaw){
    const g = this.g;
    g.frame++;
    const dt = dtRaw * g.timeScale;

    if(g.state==='countdown'){
      g.countT -= dtRaw/60;
      g.dashScroll += 1.4*dtRaw;
      this.scrollScenery(1.4, dtRaw);
      const elapsed = 3.3 - g.countT;
      const lit = elapsed>.25 ? 1:0, lit2 = elapsed>1.05 ? 1:0, lit3 = elapsed>1.85 ? 1:0;
      if(!g.l1 && lit){ g.l1=1; AudioSys.count(); }
      if(!g.l2 && lit2){ g.l2=1; AudioSys.count(); }
      if(!g.l3 && lit3){ g.l3=1; AudioSys.count(); }
      if(elapsed > 2.65 && g.state==='countdown'){
        g.state = 'run';
        if(g.startNitroBuff) S.buffs.startNitro--;
        if(g.coinX2Buff) S.buffs.coinX2--;
        S.totalGames++;
        feed('games', 1);
        save();
        AudioSys.go();
        UI.banner('出发!');
        buzz(30);
      }
      return;
    }

    if(g.state==='dying'){
      g.dieT -= dtRaw;
      this.updateParticles(dt);
      g.shake = Math.max(0, g.shake - .5*dt);
      if(g.dieT <= 0) this.tryReviveOrFinish();
      return;
    }
    if(g.state==='revive') return;

    /* ---- 难度与速度 ---- */
    const difficulty = Math.min(3.2, 1 + g.distance/2500);
    let target = g.maxSpeed * Math.min(difficulty, 2.2);
    /* 氮气 */
    if(g.nitroHeld && g.nitro > 0){
      if(!g.nitroActive){ g.nitroActive = true; AudioSys.nitro(); buzz(20); }
    } else g.nitroActive = false;
    if(g.nitroActive){
      target *= g.nitroPower;
      g.nitro = Math.max(0, g.nitro - g.nitroDrain*100/60*dt);
      if(g.nitro <= 0) g.nitroActive = false;
      if(S.settings.quality==='high' && g.frame%2===0){
        g.particles.push({x:g.px+g.pw*.32+rand(-3,3), y:g.py+g.ph, vx:rand(-.4,.4), vy:rand(2,4),
          life:18, color:'rgba(53,224,255,.8)', size:rand(2,4)});
        g.particles.push({x:g.px+g.pw*.68+rand(-3,3), y:g.py+g.ph, vx:rand(-.4,.4), vy:rand(2,4),
          life:18, color:'rgba(120,200,255,.8)', size:rand(2,4)});
      }
    }
    const acc = g.accelRate * (g.nitroActive ? 2.4 : 1) * dt;
    g.pSpeed += clamp(target - g.pSpeed, -0.14*dt, acc);
    if(g.nitroRegen) g.nitro = Math.min(100, g.nitro + g.nitroRegen*dt);
    $('nitroBtn').classList.toggle('firing', g.nitroActive);
    $('nitroBtn').style.setProperty('--n', g.nitro);

    /* ---- 油量 ---- */
    g.fuel -= g.fuelDrain * (g.pSpeed/g.maxSpeed) * dt * (g.nitroActive?1.25:1);
    if(g.fuel <= 25 && !g.lowWarn25){ g.lowWarn25=true; AudioSys.lowFuel(); UI.toast('⛽ 油量不足，注意检查站补给！'); }
    if(g.fuel <= 10 && !g.lowWarn10){ g.lowWarn10=true; AudioSys.lowFuel(); buzz(60); }
    $('fuelTrack').classList.toggle('low', g.fuel<=25);
    if(g.fuel <= 0){ g.fuel = 0; this.die('fuel'); return; }

    /* ---- 飞行（飞翼装置） ---- */
    if(g.wingLv > 0){
      if(g.flyHeld && !g.flying && g.flyEnergy >= 15){
        g.flying = true;
        AudioSys.takeoff();
        this.addFloat(g.px+g.pw/2, g.py-18, '起飞!', '#f7b731', 15);
        buzz(20);
      }
      if(g.flying && (!g.flyHeld || g.flyEnergy <= 0)) g.flying = false;
      if(g.flying){
        g.flyAlt = Math.min(1, g.flyAlt + .09*dt);
        g.flyEnergy = Math.max(0, g.flyEnergy - 100/g.flyDur*dt);
        g.fuel -= g.fuelDrain*.6*dt;
        if(S.settings.quality==='high' && g.frame%3===0){
          g.particles.push({x:g.px+rand(0,g.pw), y:g.py+g.ph, vx:rand(-.6,.6), vy:rand(3,5),
            life:16, color:'rgba(255,255,255,.5)', size:rand(1.5,3)});
        }
      } else {
        const wasAir = g.flyAlt > .3;
        g.flyAlt = Math.max(0, g.flyAlt - .11*dt);
        if(wasAir && g.flyAlt <= .3){
          g.invincibleTimer = Math.max(g.invincibleTimer, 40);
          AudioSys.land();
          for(let i=0;i<8;i++){
            g.particles.push({x:g.px+rand(0,g.pw), y:g.py+g.ph-4, vx:rand(-2.4,2.4), vy:rand(-1.5,.5),
              life:rand(14,24), color:'rgba(190,190,190,.7)', size:rand(2,4)});
          }
        }
        g.flyEnergy = Math.min(100, g.flyEnergy + .3*dt);
      }
      if(g.fuel <= 0){ g.fuel = 0; this.die('fuel'); return; }
    }

    /* ---- 玩家移动 ---- */
    const prevX = g.px;
    let handling = g.handling;
    if(g.th.ice){
      for(const ic of g.ice){
        if(rectOverlap(g.px, g.py, g.pw, g.ph, ic.x, ic.y, ic.w, ic.h)){
          handling *= .5;
          g.px += rand(-.7,.7)*dt;
          break;
        }
      }
    }
    if(g.touching && g.touchTargetX !== null){
      const tx = clamp(g.touchTargetX - g.pw/2, g.roadX+4, g.roadX+g.roadW-g.pw-4);
      const dx = tx - g.px;
      const adx = Math.abs(dx);
      const factor = adx>40 ? .85 : adx>10 ? .65 : adx>2 ? .45 : .25;
      const f = 1 - Math.pow(1-factor, dt);
      if(adx > .5) g.px += dx*f;
    } else {
      let dir = 0;
      if(g.moveLeft) dir--;
      if(g.moveRight) dir++;
      g.px += dir*handling*dt;
    }
    g.px = clamp(g.px, g.roadX+4, g.roadX+g.roadW-g.pw-4);
    g.vx = g.px - prevX;
    g.tilt = lerp(g.tilt, clamp(g.vx*.05, -.28, .28), .25);

    /* ---- 距离 / 得分 / 检查站 ---- */
    g.distance += g.pSpeed*.6*dt;
    g.dashScroll += g.pSpeed*dt;
    if(g.combo > 0){
      g.comboTimer -= dt;
      if(g.comboTimer <= 0){ g.combo = 0; $('hudCombo').classList.remove('on'); }
    }
    g.score = Math.floor(g.distance*.1 + g.bonusScore);
    if(g.distance >= g.checkpointNext){
      g.checkpointNext += 500;
      g.fuel = Math.min(g.fuelCap, g.fuel + 10);
      const bonus = Math.round(15*g.road.coinMul);
      g.coins += bonus;
      feed('coins', bonus);
      AudioSys.checkpoint();
      UI.banner(`检查站 +⛽ +🪙${bonus}`);
      this.addFloat(g.px+g.pw/2, g.py-30, `+${bonus} 🪙`, '#f7b731', 20);
      buzz(25);
    }

    /* ---- 生成敌车 ---- */
    g.enemyTimer += dt;
    const spawnInt = Math.max(15, 62 - g.road.traffic*18 - (difficulty-1)*9);
    if(g.enemyTimer >= spawnInt){
      g.enemyTimer = 0;
      this.spawnEnemy(difficulty);
      if(difficulty > 1.6 && Math.random() < .3) this.spawnEnemy(difficulty);
    }
    /* ---- 生成金币 ---- */
    g.coinTimer += dt;
    if(g.coinTimer >= Math.max(17, 42 - g.road.coinMul*9)){
      g.coinTimer = 0;
      this.spawnCoins();
    }
    /* ---- 生成道具 ---- */
    g.itemTimer -= dt;
    if(g.itemTimer <= 0){
      g.itemTimer = irand(620, 980);
      const r = Math.random();
      const type = r<.45?'fuel':r<.7?'magnet':r<.9?'shield':'thunder';
      g.items.push({x: g.roadX + rand(24, g.roadW-24), y:-30, type, size:22, t:0});
    }

    /* ---- 敌车运动 / 变道 ---- */
    const slow = g.slowTimer>0 ? .35 : 1;
    for(const e of g.enemies){
      e.y += (g.pSpeed - e.speed)*slow*dt;
      /* 变道决策：跑车追猎玩家车道，其余车辆随机缓变道 */
      if(e.targetX===undefined && e.changeDelay===undefined && e.y > this.H*.08 && e.y < this.H*.46 && Math.random() < e.changeRate*dt){
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
          if(!blocked){ e.dir = nl>cur?1:-1; e.blink = 1; e.blinkFrame = 0; e.changeDelay = 50; e.targetLane = nl; e.pendingX = tx; }
        }
      }
      if(e.blink){
        e.blinkFrame += dt;
        if(e.changeDelay !== undefined){
          e.changeDelay -= dt*slow;
          if(e.changeDelay <= 0){
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
      if(e.y > this.H + 60) return false;
      if(!e.passed && e.y > g.py + g.ph){
        e.passed = true;
        g.dodgeCount++;
        feed('dodge', 1);
        g.bonusScore += 5;
        const gapX = Math.abs((e.x+e.w/2) - (g.px+g.pw/2));
        if(!e.nearDone && gapX < g.laneW*1.12 && e.speed < g.pSpeed && g.flyAlt < .35){
          e.nearDone = true;
          g.combo++;
          g.comboTimer = 220;
          g.maxCombo = Math.max(g.maxCombo, g.combo);
          g.nearCount++;
          feed('near', 1);
          feed('combo', g.combo);
          g.nitro = Math.min(100, g.nitro + 13);
          g.bonusScore += 10*g.combo;
          this.addFloat(e.x+e.w/2, g.py-10, g.combo>=3?`险胜! 连击×${g.combo}`:'险胜!', '#ffd60a', 17);
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

    /* ---- 金币 ---- */
    const magnetR = 160 + (g.nitroActive?50:0);
    for(const c of g.coinsArr){
      c.y += g.pSpeed*dt;
      c.angle += .09*dt;
      if(g.magnetTimer>0 && !c.got){
        const dx = (g.px+g.pw/2)-c.x, dy=(g.py+g.ph/2)-c.y;
        const d = Math.hypot(dx,dy);
        if(d < magnetR && d > 1){ c.x += dx/d*7*dt; c.y += dy/d*7*dt; }
      }
    }
    g.coinsArr = g.coinsArr.filter(c=>c.y < this.H+40 && !c.got);
    /* ---- 道具 ---- */
    for(const p of g.items){ p.y += g.pSpeed*dt; p.t += dt; }
    g.items = g.items.filter(p=>{
      if(p.y > this.H+40) return false;
      if(rectOverlap(g.px, g.py, g.pw, g.ph, p.x-p.size/2, p.y-p.size/2, p.size, p.size)){
        S.powerups[p.type] = (S.powerups[p.type]||0)+1;
        save();
        this.updatePuRow();
        UI.toast(`捡到 ${this.PU_ICO[p.type]} ${p.type==='fuel'?'备用油箱':p.type==='magnet'?'磁铁':p.type==='shield'?'保护盾':'雷霆'}！`);
        AudioSys.pickup();
        buzz(15);
        return false;
      }
      return true;
    });
    /* ---- 金币碰撞 ---- */
    const mult = (g.x2Timer>0?2:1) * (g.coinX2Buff?2:1) * g.coinChip;
    for(const c of g.coinsArr){
      if(!c.got && rectOverlap(g.px, g.py, g.pw, g.ph, c.x-c.size/2, c.y-c.size/2, c.size, c.size)){
        c.got = true;
        g.coins += mult;
        feed('coins', mult);
        g.bonusScore += 3;
        g.combo++;
        g.comboTimer = 220;
        g.maxCombo = Math.max(g.maxCombo, g.combo);
        feed('combo', g.combo);
        g.nitro = Math.min(100, g.nitro + 2);
        AudioSys.coin();
        this.coinBurst(c.x, c.y);
        if(mult>1) this.addFloat(c.x, c.y-14, `+${Number.isInteger(mult)?mult:mult.toFixed(1)}`, '#f7b731', 14);
      }
    }

    /* ---- 计时器 ---- */
    if(g.magnetTimer>0) g.magnetTimer -= dt;
    if(g.x2Timer>0) g.x2Timer -= dt;
    if(g.slowTimer>0) g.slowTimer -= dt;
    if(g.invincibleTimer>0) g.invincibleTimer -= dt;
    if(g.frame%20===0) this.updatePuRow();

    /* ---- 敌车碰撞 ---- */
    if(g.invincibleTimer <= 0 && g.flyAlt < .35){
      for(const e of g.enemies){
        if(rectOverlap(g.px+5, g.py+5, g.pw-10, g.ph-10, e.x+4, e.y+4, e.w-8, e.h-8)){
          if(g.nitroActive){
            this.explode(e.x+e.w/2, e.y+e.h/2);
            g.enemies = g.enemies.filter(o=>o!==e);
            g.ramCount++;
            feed('ram', 1);
            g.coins += 5;
            feed('coins', 5);
            g.bonusScore += 25;
            g.nitro = Math.max(0, g.nitro-8);
            g.shake = Math.max(g.shake, 7);
            this.addFloat(e.x+e.w/2, e.y, '撞飞! +5🪙', '#35e0ff', 16);
            AudioSys.ram();
            buzz(35);
            break;
          } else if(g.armorHits > 0){
            g.armorHits--;
            g.invincibleTimer = 60;
            this.explode(e.x+e.w/2, e.y+e.h/2);
            g.enemies = g.enemies.filter(o=>o!==e);
            g.shake = Math.max(g.shake, 6);
            this.addFloat(g.px+g.pw/2, g.py-20, `🦾 装甲抵挡! 剩余${g.armorHits}次`, '#3ddc84', 14);
            AudioSys.armorHit();
            buzz(45);
            this.updatePuRow();
            break;
          } else if(g.shield){
            g.shield = false;
            g.invincibleTimer = 75;
            this.explode(e.x+e.w/2, e.y+e.h/2);
            g.enemies = g.enemies.filter(o=>o!==e);
            g.shake = Math.max(g.shake, 6);
            UI.toast('🛡️ 保护盾抵挡了撞击！');
            AudioSys.shieldBreak();
            buzz(50);
            this.updatePuRow();
            break;
          } else {
            this.die('crash');
            return;
          }
        }
      }
    }

    /* ---- 环境 ---- */
    this.scrollScenery(g.pSpeed, dt);
    this.updateWeather(dt);
    if(g.th.ice && Math.random() < .003*dt){
      const w = g.laneW*rand(.8,1.4), h = rand(50,90);
      g.ice.push({x: g.roadX + rand(6, g.roadW-w-6), y:-h-20, w, h});
    }
    g.ice = g.ice.filter(ic=>{ ic.y += g.pSpeed*dt; return ic.y < this.H+60; });
    this.updateParticles(dt);
    g.shake = Math.max(0, g.shake - .35*dt);
    AudioSys.setEngine(clamp(g.pSpeed/(g.maxSpeed*2.2), 0, 1), g.nitroActive);

    this.updateHud(false);
  },

  /* ---------- 生成 ---------- */
  spawnEnemy(difficulty){
    const g = this.g;
    /* 可解性：按实际矩形覆盖计算被占车道，至少保留一条空车道 */
    const blocked = new Set();
    for(const e of g.enemies){
      if(e.y < this.H*.42){
        const l0 = Math.max(0, Math.floor((e.x - g.roadX)/g.laneW));
        const l1 = Math.min(g.laneCount-1, Math.floor((e.x + e.w - 1 - g.roadX)/g.laneW));
        for(let l=l0; l<=l1; l++) blocked.add(l);
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
    const w = type.w, h = type.h, y = -h-24;
    const cx = g.roadX + lane*g.laneW + (g.laneW-w)/2;
    /* 横向位置：车道内随机偏移，约 1/3 概率直接压线生成，覆盖所有可选位置 */
    const maxOff = Math.max(4, (g.laneW-w)/2 - 2) * .7;
    let x = cx + rand(-maxOff, maxOff);
    if(Math.random() < .35){
      const side = Math.random()<.5 ? -1 : 1;
      const nl = lane + side;
      if(nl>=0 && nl<g.laneCount && !blocked.has(nl)){
        x = g.roadX + (side>0 ? (lane+1)*g.laneW : lane*g.laneW) - w/2 + rand(-5,5);
      }
    }
    /* 顶部清空（按实际矩形判定，避免压线车互相重叠） */
    if(g.enemies.some(o=>o.y < 130 && rectOverlap(x, y, w, h, o.x, o.y, o.w, o.h))) return;
    const big = type.name==='truck' || type.name==='bus';
    g.enemies.push({
      x, y, w, h, lane,
      speed: rand(type.sp[0], type.sp[1]) + (difficulty-1)*.25,
      color: pick(ENEMY_COLORS),
      type: type.name,
      changer: !!type.changer && difficulty > 1.2,
      changeRate: type.changer ? .012 : (big ? .0025 : .005),
      changeDur: big ? 70 : (type.changer ? 45 : 60),
      passed:false, nearDone:false, blink:0, blinkFrame:0, targetX:undefined, dir:0,
    });
  },
  spawnCoins(){
    const g = this.g;
    const r = Math.random();
    if(r < .55){
      g.coinsArr.push({x: g.roadX + rand(20, g.roadW-20), y:-20, size:15, angle:rand(0,6), got:false});
    } else if(r < .82){
      const x = g.roadX + rand(24, g.roadW-24);
      for(let i=0;i<4;i++) g.coinsArr.push({x, y:-20-i*36, size:15, angle:i*.5, got:false});
    } else {
      const n = 5;
      for(let i=0;i<n;i++){
        const x = g.roadX + 24 + (g.roadW-48)*i/(n-1);
        g.coinsArr.push({x, y:-20-Math.sin(i/(n-1)*Math.PI)*70, size:15, angle:i*.4, got:false});
      }
    }
  },
  spawnScenery(y){
    const g = this.g;
    const side = Math.random()<.5?-1:1;
    const off = rand(26, 90);
    g.scenery.push({
      x: side<0 ? g.roadX - off : g.roadX + g.roadW + off,
      y: y !== undefined ? y : -80,
      side, type: pick(g.th.scenery), s: rand(.75, 1.3),
    });
  },
  scrollScenery(speed, dt){
    const g = this.g;
    for(const s of g.scenery) s.y += speed*.82*dt;
    g.scenery = g.scenery.filter(s=>{
      if(s.y > this.H + 90){
        s.y = -rand(60,140);
        s.side = Math.random()<.5?-1:1;
        const off = rand(26, 90);
        s.x = s.side<0 ? g.roadX - off : g.roadX + g.roadW + off;
        s.type = pick(g.th.scenery);
        s.s = rand(.75, 1.3);
      }
      return true;
    });
  },
  updateWeather(dt){
    const g = this.g;
    const kind = g.th.weather;
    if(!kind) return;
    const cap = S.settings.quality==='high' ? 70 : 26;
    if(g.weather.length < cap && Math.random() < .6){
      if(kind==='rain') g.weather.push({x:rand(0,this.W), y:-20, vy:rand(13,18), vx:-1.6, len:rand(10,20)});
      if(kind==='snow') g.weather.push({x:rand(0,this.W), y:-10, vy:rand(1.2,2.4), ph:rand(0,6), r:rand(1.5,3.2)});
      if(kind==='sand') g.weather.push({x:-10, y:rand(0,this.H), vx:rand(6,11), vy:rand(.5,1.5), r:rand(1,2.4)});
    }
    g.weather = g.weather.filter(w=>{
      if(kind==='rain'){ w.y += w.vy*dt; w.x += w.vx*dt; return w.y < this.H+20; }
      if(kind==='snow'){ w.y += w.vy*dt; w.ph += .05*dt; w.x += Math.sin(w.ph)*.8; return w.y < this.H+10; }
      w.x += w.vx*dt; w.y += w.vy*dt; return w.x < this.W+20;
    });
  },

  /* ---------- 粒子 / 浮字 ---------- */
  explode(x, y){
    const g = this.g;
    const n = S.settings.quality==='high' ? 16 : 8;
    for(let i=0;i<n;i++){
      const a = rand(0, Math.PI*2), sp = rand(1.5, 6);
      g.particles.push({x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:rand(22,42),
        color:pick(['#e5383b','#f7b731','#ffd60a','#ff7b1c','#8a8f98']), size:rand(2.5,5.5)});
    }
  },
  coinBurst(x, y){
    const g = this.g;
    const n = S.settings.quality==='high' ? 6 : 3;
    for(let i=0;i<n;i++){
      g.particles.push({x, y, vx:rand(-2,2), vy:rand(-3.5,-1), life:rand(14,24), color:'#ffd60a', size:rand(1.5,3.5)});
    }
  },
  addFloat(x, y, text, color, size){
    this.g.floats.push({x, y, text, color, size:size||15, life:60, vy:-1.1});
  },
  updateParticles(dt){
    const g = this.g;
    for(const p of g.particles){ p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt; p.size *= Math.pow(.965, dt); }
    g.particles = g.particles.filter(p=>p.life>0);
    if(g.particles.length > 240) g.particles.splice(0, g.particles.length-240);
    for(const f of g.floats){ f.y += f.vy*dt; f.life -= dt; }
    g.floats = g.floats.filter(f=>f.life>0);
  },

  /* ---------- 死亡 / 复活 / 结算 ---------- */
  die(reason){
    const g = this.g;
    g.state = 'dying';
    g.dieReason = reason;
    g.dieT = 55;
    g.timeScale = .22;
    g.shake = 16;
    g.flying = false; g.flyAlt = 0; g.flyHeld = false;
    if(reason==='crash'){
      this.explode(g.px+g.pw/2, g.py+g.ph/2);
      AudioSys.crash();
      buzz([60,40,120]);
    } else {
      AudioSys.lose();
      buzz(80);
    }
    AudioSys.setEngine(0, false);
  },
  tryReviveOrFinish(){
    const g = this.g;
    g.timeScale = 1;
    if(!g.reviveUsed && (S.coins >= 150 || S.gems >= 5)){
      g.state = 'revive';
      $('rvCoinBtn').disabled = S.coins < 150;
      $('rvGemBtn').disabled = S.gems < 5;
      const bar = $('rvTimerBar');
      bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
      $('reviveOverlay').classList.add('active');
      this.reviveTimeout = setTimeout(()=>this.declineRevive(), 6000);
      return;
    }
    this.finishRun();
  },
  revive(mode){
    const g = this.g;
    if(!g || g.state!=='revive') return;
    if(mode==='coins'){ if(S.coins < 150) return; S.coins -= 150; }
    else { if(S.gems < 5) return; S.gems -= 5; }
    clearTimeout(this.reviveTimeout);
    g.reviveUsed = true;
    $('reviveOverlay').classList.remove('active');
    g.enemies.forEach(e=>this.explode(e.x+e.w/2, e.y+e.h/2));
    g.enemies = [];
    g.state = 'run';
    g.invincibleTimer = 130;
    g.fuel = Math.max(g.fuel, 40);
    g.nitro = Math.max(g.nitro, 50);
    g.lowWarn25 = g.fuel<=25; g.lowWarn10 = g.fuel<=10;
    save();
    AudioSys.revive();
    UI.banner('继续冲刺!');
    buzz([30,30,60]);
  },
  declineRevive(){
    const g = this.g;
    if(!g || g.state!=='revive') return;
    clearTimeout(this.reviveTimeout);
    $('reviveOverlay').classList.remove('active');
    this.finishRun();
  },
  finishRun(){
    const g = this.g;
    const dist = Math.floor(g.distance);
    S.totalDistance += dist;
    S.totalCoins += g.coins;
    S.totalDodge += g.dodgeCount;
    S.totalNear += g.nearCount;
    S.totalRam += g.ramCount;
    S.coins += g.coins;
    feed('dist', dist);
    let record = false;
    if(dist > S.bestDistance){ S.bestDistance = dist; record = true; }
    const rk = g.road.id;
    if(dist > (S.bestPerRoad[rk]||0)){ S.bestPerRoad[rk] = dist; record = record || dist>200; }
    const xp = Math.floor(dist/8) + g.coins;
    const ups = UI.grantXp(xp);
    save();

    $('goStamp').textContent = g.dieReason==='fuel' ? '没油了!' : '撞车了!';
    $('goReason').textContent = g.dieReason==='fuel' ? '下次记得在检查站之间捡油桶' : '小心那些不打灯就变道的家伙';
    $('goBest').textContent = fmt(S.bestDistance) + ' m';
    $('goRecord').classList.toggle('on', record);
    $('goXp').textContent = `+${fmt(xp)} 经验` + (ups>0 ? ` · 升级至 LV.${S.level}！` : ` · LV.${S.level} ${levelTitle(S.level)}`);
    this.countUp($('goDist'), dist, ' m');
    this.countUp($('goCoins'), g.coins, '');
    this.countUp($('goScore'), g.score, '');
    const panel = $('goPanel');
    panel.querySelectorAll('.confetti').forEach(c=>c.remove());
    if(record){
      AudioSys.win();
      const colors = ['#e5383b','#ffd60a','#35e0ff','#3ddc84','#a06bff','#f7b731'];
      for(let i=0;i<40;i++){
        const c = document.createElement('i');
        c.className = 'confetti';
        c.style.left = rand(0,100)+'%';
        c.style.background = pick(colors);
        c.style.animationDuration = rand(1.6,3.2)+'s';
        c.style.animationDelay = rand(0,.8)+'s';
        panel.appendChild(c);
        setTimeout(()=>c.remove(), 4200);
      }
    } else AudioSys.lose();
    cancelAnimationFrame(this.raf);
    this.g = null;
    UI.go('gameOverScreen');
  },
  countUp(el, target, suffix){
    const t0 = performance.now();
    const dur = 750;
    const step = ts=>{
      const p = clamp((ts-t0)/dur, 0, 1);
      el.textContent = fmt(target * (1-Math.pow(1-p,3))) + suffix;
      if(p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  /* ---------- HUD ---------- */
  updateHud(force){
    const g = this.g;
    if(!g) return;
    $('hudSpeed').textContent = Math.floor(g.pSpeed*28);
    $('hudDist').textContent = fmt(g.distance);
    $('hudCoins').textContent = fmt(g.coins);
    $('hudScore').textContent = fmt(g.score);
    $('fuelFill').style.width = (g.fuel/g.fuelCap*100) + '%';
    $('fuelNum').textContent = Math.ceil(g.fuel);
    $('nitroBtn').style.setProperty('--n', g.nitro);
    if(g.wingOwned){
      const fb = $('flyBtn');
      fb.style.setProperty('--fe', g.flyEnergy);
      fb.classList.toggle('flying', g.flying);
      fb.classList.toggle('empty', g.flyEnergy < 15);
    }
  },

  /* ---------- 渲染 ---------- */
  render(){
    const g = this.g, c = this.ctx, W = this.W, H = this.H;
    const th = g.th;
    c.save();
    if(g.shake > 0) c.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake));
    const horY = Math.max(84, H*.13);

    /* 天空 */
    const sky = c.createLinearGradient(0,0,0,horY);
    sky.addColorStop(0, th.skyTop); sky.addColorStop(.7, th.skyMid); sky.addColorStop(1, th.skyBot);
    c.fillStyle = sky; c.fillRect(0,0,W,horY);
    if(th.stars){
      c.fillStyle = 'rgba(255,255,255,.8)';
      for(let i=0;i<26;i++){
        const sx = (i*137.5)%W, sy = (i*71.3)%(horY*.8);
        const tw = .4 + .6*Math.abs(Math.sin(g.frame*.02 + i));
        c.globalAlpha = tw*.8;
        c.fillRect(sx, sy, 1.6, 1.6);
      }
      c.globalAlpha = 1;
      c.fillStyle = '#e8ecf5';
      c.beginPath(); c.arc(W*.82, horY*.35, 14, 0, Math.PI*2); c.fill();
      c.fillStyle = th.skyTop;
      c.beginPath(); c.arc(W*.82-6, horY*.35-3, 12, 0, Math.PI*2); c.fill();
    }
    if(th.sun){
      const sx = W*.76, sy = horY*.72;
      const sg = c.createRadialGradient(sx,sy,2,sx,sy,H*.1);
      sg.addColorStop(0,'rgba(255,236,170,.95)'); sg.addColorStop(.4,'rgba(255,190,100,.4)'); sg.addColorStop(1,'rgba(255,190,100,0)');
      c.fillStyle = sg; c.fillRect(sx-H*.1, sy-H*.1, H*.2, H*.2);
      c.fillStyle = '#fff0b8';
      c.beginPath(); c.arc(sx, sy, H*.024, 0, Math.PI*2); c.fill();
    }
    if(th.cloud){
      c.fillStyle = th.cloud;
      for(let i=0;i<3;i++){
        const cx = ((g.frame*.2 + i*W/2.6) % (W+160)) - 80;
        const cy = horY*(.25 + i*.22);
        c.beginPath();
        c.ellipse(cx, cy, 44, 12, 0, 0, Math.PI*2);
        c.ellipse(cx+28, cy+5, 28, 9, 0, 0, Math.PI*2);
        c.fill();
      }
    }
    /* 地平线景观 */
    this.drawHorizon(c, W, horY, th);

    /* 地面 */
    c.fillStyle = th.ground; c.fillRect(0, horY, W, H-horY);
    if(th.sea){
      const seaW = g.roadX - 70;
      const sea = c.createLinearGradient(0, horY, 0, H);
      sea.addColorStop(0, th.hzB); sea.addColorStop(1, th.hzA);
      c.fillStyle = sea; c.fillRect(0, horY, seaW, H-horY);
      c.strokeStyle = 'rgba(255,255,255,.35)';
      c.lineWidth = 2;
      for(let i=0;i<5;i++){
        const wy = horY + ((g.dashScroll*1.2 + i*(H-horY)/5) % (H-horY));
        c.beginPath();
        c.moveTo(8, wy);
        c.quadraticCurveTo(seaW*.3, wy-5, seaW*.55, wy);
        c.stroke();
      }
    }
    /* 地面速度条纹 */
    c.fillStyle = th.groundDark;
    const bandOff = g.dashScroll % 64;
    for(let y = horY - 64 + bandOff; y < H; y += 64){
      c.globalAlpha = .35;
      c.fillRect(0, y, W, 22);
    }
    c.globalAlpha = 1;

    /* 路肩 + 路面 */
    c.fillStyle = th.shoulder;
    c.fillRect(g.roadX-16, horY, g.roadW+32, H-horY);
    const roadG = c.createLinearGradient(0, horY, 0, horY+120);
    roadG.addColorStop(0, th.skyBot);
    roadG.addColorStop(1, th.road);
    c.fillStyle = th.road; c.fillRect(g.roadX, horY, g.roadW, H-horY);
    c.fillStyle = roadG; c.globalAlpha = .8; c.fillRect(g.roadX, horY, g.roadW, 120); c.globalAlpha = 1;
    /* 边线 */
    c.fillStyle = th.marking;
    c.fillRect(g.roadX+2, horY, 3, H-horY);
    c.fillRect(g.roadX+g.roadW-5, horY, 3, H-horY);
    /* 车道虚线 */
    const dashOff = g.dashScroll % 60;
    c.fillStyle = th.marking;
    c.globalAlpha = .8;
    for(let l=1;l<g.laneCount;l++){
      const lx = g.roadX + l*g.laneW - 2;
      for(let y = horY - 60 + dashOff; y < H; y += 60) c.fillRect(lx, y, 4, 30);
    }
    c.globalAlpha = 1;

    /* 冰面 */
    for(const ic of g.ice){
      c.fillStyle = 'rgba(190,225,250,.5)';
      rr(c, ic.x, ic.y, ic.w, ic.h, 14); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillRect(ic.x+8, ic.y+8, ic.w*.3, 3);
    }

    /* 夜景路灯辉光 */
    if(th.night){
      for(const s of g.scenery){
        if(s.type!=='lamp') continue;
        const gl = c.createRadialGradient(s.x, s.y, 4, s.x, s.y, 90*s.s);
        gl.addColorStop(0,'rgba(255,220,130,.22)'); gl.addColorStop(1,'rgba(255,220,130,0)');
        c.fillStyle = gl;
        c.beginPath(); c.arc(s.x, s.y, 90*s.s, 0, Math.PI*2); c.fill();
      }
    }

    /* 路旁景物 */
    for(const s of g.scenery) this.drawScenery(c, s, th);

    /* 金币 */
    for(const co of g.coinsArr){
      c.save();
      c.translate(co.x, co.y);
      const sq = Math.abs(Math.cos(co.angle));
      c.scale(Math.max(.25, sq), 1);
      c.fillStyle = '#c98a12';
      c.beginPath(); c.arc(0,0,co.size/2+1.5,0,Math.PI*2); c.fill();
      c.fillStyle = '#ffd60a';
      c.beginPath(); c.arc(0,0,co.size/2,0,Math.PI*2); c.fill();
      c.fillStyle = '#f7b731';
      c.beginPath(); c.arc(0,0,co.size/2-3.5,0,Math.PI*2); c.fill();
      c.fillStyle = '#8a5c00';
      c.font = `bold ${co.size-5}px 'Racing Sans One','Microsoft YaHei',Arial`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('$', 0, 1);
      c.restore();
    }
    /* 道具 */
    for(const p of g.items){
      c.save();
      c.translate(p.x, p.y + Math.sin(p.t*.08)*3);
      const glowCol = p.type==='fuel' ? '247,183,49' : p.type==='magnet' ? '229,56,59' : p.type==='shield' ? '63,140,255' : '160,107,255';
      const gl = c.createRadialGradient(0,0,4,0,0,p.size+8);
      gl.addColorStop(0,`rgba(${glowCol},.5)`); gl.addColorStop(1,`rgba(${glowCol},0)`);
      c.fillStyle = gl;
      c.beginPath(); c.arc(0,0,p.size+8,0,Math.PI*2); c.fill();
      c.fillStyle = 'rgba(20,24,32,.9)';
      rr(c, -p.size/2, -p.size/2, p.size, p.size, 6); c.fill();
      c.strokeStyle = `rgb(${glowCol})`; c.lineWidth = 2;
      rr(c, -p.size/2, -p.size/2, p.size, p.size, 6); c.stroke();
      c.font = `${p.size-7}px Arial`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(this.PU_ICO[p.type], 0, 1);
      c.restore();
    }

    /* 敌车 */
    for(const e of g.enemies) drawEnemy(c, e);

    /* 玩家车灯光（夜景） */
    if(th.night){
      c.fillStyle = 'rgba(255,240,180,.1)';
      c.beginPath();
      c.moveTo(g.px+g.pw*.2, g.py+4);
      c.lineTo(g.px-g.pw*.5, g.py-g.ph*1.9);
      c.lineTo(g.px+g.pw*.9, g.py-g.ph*1.9);
      c.lineTo(g.px+g.pw*.8, g.py+4);
      c.closePath(); c.fill();
    }
    /* 玩家 */
    const blinkOff = g.invincibleTimer>0 && Math.floor(g.frame/4)%2===0;
    const lift = (g.flyAlt||0) * 46;
    const fsc = 1 + (g.flyAlt||0)*.16;
    if(!blinkOff){
      if(g.flyAlt > .03){
        /* 地面投影阴影 */
        c.fillStyle = `rgba(0,0,0,${.32*(1-g.flyAlt*.4)})`;
        c.beginPath();
        c.ellipse(g.px+g.pw/2, g.py+g.ph-3, g.pw*.6*(1-g.flyAlt*.22), g.pw*.22*(1-g.flyAlt*.22), 0, 0, Math.PI*2);
        c.fill();
      }
      const dx = g.px - (fsc-1)*g.pw/2, dy = g.py - lift - (fsc-1)*g.ph/2;
      const dw = g.pw*fsc, dh = g.ph*fsc;
      /* 飞翼（车体下方） */
      if(g.wingLv > 0){
        const cx = dx+dw/2, wy = dy+dh*.46;
        const spread = dw*(.62 + g.flyAlt*.55);
        c.save();
        c.translate(cx, wy);
        c.rotate(g.tilt*.6);
        c.globalAlpha = .38 + g.flyAlt*.62;
        for(const s of [-1,1]){
          const wg = c.createLinearGradient(s*spread, 0, 0, 0);
          wg.addColorStop(0, 'rgba(247,183,49,.95)');
          wg.addColorStop(1, 'rgba(255,255,255,.9)');
          c.fillStyle = wg;
          c.beginPath();
          c.moveTo(0, -dh*.06);
          c.lineTo(s*spread, dh*.16);
          c.lineTo(s*spread*.72, dh*.3);
          c.lineTo(0, dh*.12);
          c.closePath();
          c.fill();
        }
        if(g.flyAlt > .3){
          c.globalAlpha = .5 + .3*Math.sin(g.frame*.3);
          c.fillStyle = '#ffd60a';
          c.beginPath(); c.arc(-spread, dh*.16, 2.4, 0, Math.PI*2); c.fill();
          c.beginPath(); c.arc(spread, dh*.16, 2.4, 0, Math.PI*2); c.fill();
        }
        c.restore();
        c.globalAlpha = 1;
      }
      drawCar(c, dx, dy, dw, dh, g.car, {tilt:g.tilt, flame:g.nitroActive});
    }
    /* 护盾气泡 */
    if(g.shield){
      c.strokeStyle = 'rgba(63,140,255,.75)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(g.px+g.pw/2, g.py+g.ph/2-lift, g.pw/2+9, g.ph/2+9, 0, 0, Math.PI*2);
      c.stroke();
      c.strokeStyle = 'rgba(63,140,255,.3)';
      c.lineWidth = 7;
      c.beginPath();
      c.ellipse(g.px+g.pw/2, g.py+g.ph/2-lift, g.pw/2+13, g.ph/2+13, 0, 0, Math.PI*2);
      c.stroke();
    }
    /* 磁铁范围 */
    if(g.magnetTimer>0){
      const mr = 160 + (g.nitroActive?50:0);
      c.strokeStyle = 'rgba(229,56,59,.28)';
      c.lineWidth = 2;
      c.setLineDash([6,7]);
      c.lineDashOffset = -g.frame*.5;
      c.beginPath(); c.arc(g.px+g.pw/2, g.py+g.ph/2-lift, mr, 0, Math.PI*2); c.stroke();
      c.setLineDash([]);
    }

    /* 粒子 */
    for(const p of g.particles){
      c.globalAlpha = clamp(p.life/30, 0, 1);
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI*2); c.fill();
    }
    c.globalAlpha = 1;
    /* 浮字 */
    for(const f of g.floats){
      c.globalAlpha = clamp(f.life/40, 0, 1);
      c.font = `bold ${f.size}px 'Racing Sans One','Microsoft YaHei',Arial`;
      c.textAlign = 'center';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(0,0,0,.65)';
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;

    /* 天气 */
    if(th.weather==='rain'){
      c.strokeStyle = 'rgba(170,200,240,.5)';
      c.lineWidth = 1.4;
      c.beginPath();
      for(const w of g.weather){ c.moveTo(w.x, w.y); c.lineTo(w.x+w.vx*1.6, w.y+w.len); }
      c.stroke();
    } else if(th.weather==='snow'){
      c.fillStyle = 'rgba(255,255,255,.9)';
      for(const w of g.weather){ c.beginPath(); c.arc(w.x, w.y, w.r, 0, Math.PI*2); c.fill(); }
    } else if(th.weather==='sand'){
      c.fillStyle = 'rgba(214,170,100,.55)';
      for(const w of g.weather){ c.beginPath(); c.arc(w.x, w.y, w.r, 0, Math.PI*2); c.fill(); }
    }

    /* 速度线 */
    const spdRatio = g.pSpeed/(g.maxSpeed*2.2);
    if(spdRatio > .55 || g.nitroActive){
      const n = S.settings.quality==='high' ? 10 : 5;
      c.strokeStyle = `rgba(255,255,255,${g.nitroActive?.35:.16})`;
      c.lineWidth = 2;
      for(let i=0;i<n;i++){
        const sx = (i%2===0) ? rand(4, g.roadX-24) : rand(g.roadX+g.roadW+24, W-4);
        const sy = rand(0, H);
        const len = rand(30, 90) * (g.nitroActive?1.6:1);
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy+len); c.stroke();
      }
    }

    /* 起步灯 */
    if(g.state==='countdown'){
      const elapsed = 3.3 - g.countT;
      const lx = W/2, ly = Math.max(70, H*.2);
      c.fillStyle = 'rgba(10,12,16,.85)';
      rr(c, lx-86, ly-30, 172, 60, 10); c.fill();
      for(let i=0;i<3;i++){
        const onT = [.25, 1.05, 1.85][i];
        const isGo = elapsed > 2.65;
        c.beginPath();
        c.arc(lx-52+i*52, ly, 17, 0, Math.PI*2);
        c.fillStyle = isGo ? '#3ddc84' : (elapsed>onT ? '#e5383b' : '#2a3140');
        c.fill();
        if(isGo || elapsed>onT){
          c.shadowColor = isGo ? '#3ddc84' : '#e5383b';
          c.shadowBlur = 14;
          c.beginPath(); c.arc(lx-52+i*52, ly, 17, 0, Math.PI*2); c.fill();
          c.shadowBlur = 0;
        }
      }
    }

    /* 低油量 / 氮气 / 减速 晕影 */
    if(g.fuel <= 25 && g.state==='run'){
      const a = (.28 + .14*Math.sin(g.frame*.12)) * (1 - g.fuel/25);
      const v = c.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.75);
      v.addColorStop(0,'rgba(229,56,59,0)'); v.addColorStop(1,`rgba(229,56,59,${a})`);
      c.fillStyle = v; c.fillRect(0,0,W,H);
    }
    if(g.nitroActive){
      const v = c.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.8);
      v.addColorStop(0,'rgba(53,224,255,0)'); v.addColorStop(1,'rgba(53,224,255,.16)');
      c.fillStyle = v; c.fillRect(0,0,W,H);
    }
    if(g.slowTimer>0){
      c.fillStyle = 'rgba(160,107,255,.07)'; c.fillRect(0,0,W,H);
    }
    c.restore();
  },

  drawHorizon(c, W, horY, th){
    const kind = th.horizon;
    const rnd = srand(this.g ? this.g.hzSeed : 1);
    const R = (a,b)=>a + rnd()*(b-a);
    c.fillStyle = th.hzA;
    if(kind==='hills' || kind==='dunes'){
      c.beginPath(); c.moveTo(0,horY);
      for(let x=0;x<=W;x+=W/5){
        c.quadraticCurveTo(x+W/10, horY - (kind==='dunes'?26:38) - Math.sin(x*.02)*10, x+W/5, horY-6);
      }
      c.lineTo(W,horY); c.closePath(); c.fill();
      c.fillStyle = th.hzB;
      c.beginPath(); c.moveTo(0,horY);
      for(let x=0;x<=W;x+=W/3){
        c.quadraticCurveTo(x+W/6, horY-16-Math.cos(x*.03)*8, x+W/3, horY-2);
      }
      c.lineTo(W,horY); c.closePath(); c.fill();
    } else if(kind==='mountains'){
      c.beginPath(); c.moveTo(0,horY);
      let x = 0;
      while(x < W){
        const w = R(90,150);
        c.lineTo(x+w/2, horY-R(34,62));
        c.lineTo(x+w, horY-4);
        x += w;
      }
      c.lineTo(W,horY); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.beginPath();
      c.moveTo(W*.3, horY-44); c.lineTo(W*.33, horY-52); c.lineTo(W*.36, horY-44); c.closePath(); c.fill();
    } else if(kind==='sea'){
      c.fillStyle = th.hzA;
      c.fillRect(0, horY-14, W, 14);
      c.fillStyle = 'rgba(255,255,255,.4)';
      c.fillRect(0, horY-14, W, 2);
    } else if(kind==='city' || kind==='skyline'){
      let x = 0;
      while(x < W){
        const w = R(26,58), h = R(18,58);
        c.fillStyle = th.hzA;
        c.fillRect(x, horY-h, w, h);
        if(th.windows){
          c.fillStyle = 'rgba(255,214,110,.75)';
          for(let wy=horY-h+5; wy<horY-4; wy+=8){
            for(let wx=x+4; wx<x+w-4; wx+=7){
              if(((wx*7+wy*13)|0)%5<2) c.fillRect(wx, wy, 3, 4);
            }
          }
        }
        x += w + R(4,14);
      }
    }
  },

  drawScenery(c, s, th){
    c.save();
    c.translate(s.x, s.y);
    c.scale(s.s, s.s);
    const t = s.type;
    if(t==='tree1'){
      c.fillStyle = '#5b4226'; c.fillRect(-3,0,6,14);
      c.fillStyle = '#2d6a1e';
      c.beginPath(); c.arc(0,-8,15,0,Math.PI*2); c.arc(-9,-2,10,0,Math.PI*2); c.arc(9,-2,10,0,Math.PI*2); c.fill();
    } else if(t==='tree2'){
      c.fillStyle = '#5b4226'; c.fillRect(-2.5,0,5,10);
      c.fillStyle = '#1e6b2e';
      c.beginPath(); c.moveTo(0,-26); c.lineTo(-12,2); c.lineTo(12,2); c.closePath(); c.fill();
    } else if(t==='bush'){
      c.fillStyle = th.groundDark;
      c.beginPath(); c.arc(0,0,9,0,Math.PI*2); c.arc(8,2,7,0,Math.PI*2); c.fill();
    } else if(t==='flower'){
      c.fillStyle = '#f4d35e';
      for(let i=0;i<3;i++){ c.beginPath(); c.arc(-6+i*6, -i*3, 3, 0, Math.PI*2); c.fill(); }
      c.fillStyle = '#e5383b';
      c.beginPath(); c.arc(2,-10,3,0,Math.PI*2); c.fill();
    } else if(t==='palm'){
      c.strokeStyle = '#7a5c33'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(0,10); c.quadraticCurveTo(4,-8,10,-22); c.stroke();
      c.strokeStyle = '#2a9d3f'; c.lineWidth = 3.5;
      for(let i=0;i<5;i++){
        const a = -Math.PI*.15 - i*Math.PI*.18;
        c.beginPath(); c.moveTo(10,-22);
        c.quadraticCurveTo(10+Math.cos(a)*14, -22+Math.sin(a)*14-6, 10+Math.cos(a)*22, -22+Math.sin(a)*22);
        c.stroke();
      }
    } else if(t==='rock'){
      c.fillStyle = '#9a8f80';
      c.beginPath(); c.moveTo(-10,6); c.lineTo(-5,-6); c.lineTo(5,-8); c.lineTo(11,4); c.closePath(); c.fill();
    } else if(t==='pole'){
      c.fillStyle = '#6b7280'; c.fillRect(-2,-30,4,36);
      c.fillRect(-2,-30,12,3);
      c.fillStyle = '#f5e9a8'; c.fillRect(7,-29,5,4);
    } else if(t==='sign'){
      c.fillStyle = '#6b7280'; c.fillRect(-1.5,-20,3,24);
      c.fillStyle = '#2a9d3f'; c.fillRect(-12,-30,24,12);
      c.fillStyle = '#fff'; c.fillRect(-9,-26,18,2);
    } else if(t==='cactus'){
      c.fillStyle = '#2a7d3f';
      rr(c, -4,-24,8,30,4); c.fill();
      rr(c, -13,-16,7,12,3); c.fill();
      rr(c, 6,-12,7,10,3); c.fill();
    } else if(t==='skull'){
      c.fillStyle = '#e8e2d4';
      c.beginPath(); c.arc(0,-4,6,0,Math.PI*2); c.fill();
      c.fillStyle = '#3a352c';
      c.fillRect(-3.5,-6,2.5,2.5); c.fillRect(1,-6,2.5,2.5);
    } else if(t==='pine'){
      c.fillStyle = '#4a3521'; c.fillRect(-2.5,0,5,9);
      c.fillStyle = '#1d5a3a';
      c.beginPath(); c.moveTo(0,-30); c.lineTo(-13,4); c.lineTo(13,4); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.moveTo(0,-30); c.lineTo(-6,-16); c.lineTo(6,-16); c.closePath(); c.fill();
    } else if(t==='snowman'){
      c.fillStyle = '#f4f8fb';
      c.beginPath(); c.arc(0,2,8,0,Math.PI*2); c.arc(0,-9,5.5,0,Math.PI*2); c.fill();
      c.fillStyle = '#ff7b1c'; c.fillRect(0,-10,5,2);
      c.fillStyle = '#1c2733'; c.fillRect(-4,-16,8,3);
    } else if(t==='lamp'){
      c.fillStyle = '#3a404c'; c.fillRect(-2,-34,4,40);
      c.fillRect(-2,-34,14,3);
      c.fillStyle = '#ffd58a'; c.beginPath(); c.arc(11,-30,4,0,Math.PI*2); c.fill();
    } else if(t==='hydrant'){
      c.fillStyle = '#e5383b';
      rr(c, -5,-12,10,16,3); c.fill();
      c.fillRect(-7,-8,14,3);
    } else if(t==='cone'){
      c.fillStyle = '#ff7b1c';
      c.beginPath(); c.moveTo(0,-14); c.lineTo(-7,4); c.lineTo(7,4); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.fillRect(-4,-6,8,3);
    }
    c.restore();
  },

  /* ---------- 尺寸 ---------- */
  resize(){
    const vv = window.visualViewport;
    this.W = vv ? vv.width : innerWidth;
    this.H = vv ? vv.height : innerHeight;
    this.dpr = Math.min(devicePixelRatio||1, 2);
    if(this.cv){
      this.cv.width = this.W*this.dpr;
      this.cv.height = this.H*this.dpr;
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    }
    const g = this.g;
    if(g){
      g.roadX = (this.W - g.roadW)/2;
      g.py = this.H - g.ph - 128;
      g.px = clamp(g.px, g.roadX+4, g.roadX+g.roadW-g.pw-4);
      /* 路面平移后把敌车吸回车道中心线，清除进行中的变道状态 */
      for(const e of g.enemies){
        e.x = g.roadX + e.lane*g.laneW + (g.laneW-e.w)/2;
        e.targetX = undefined; e.pendingX = undefined; e.changeDelay = undefined; e.blink = 0;
      }
    }
  },
};

function rectOverlap(x1,y1,w1,h1,x2,y2,w2,h2){
  return x1 < x2+w2 && x1+w1 > x2 && y1 < y2+h2 && y1+h1 > y2;
}
/* 种子随机数（mulberry32）：同一种子产生同一序列，用于稳定的地平线轮廓 */
function srand(seed){
  let a = seed>>>0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a>>>15, 1 | a);
    t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
    return ((t ^ t>>>14)>>>0)/4294967296;
  };
}
