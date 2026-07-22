'use strict';
/* ================= UI 总控 ================= */
const UI = {
  current: 'menuScreen',
  go(id){
    if(this.current === id) return;
    if(this.current === 'garageScreen') Garage.close();
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $(id).classList.add('active');
    this.current = id;
    AudioSys.click();
    if(id==='menuScreen'){ MenuScene.start(); this.updateMenu(); } else MenuScene.stop();
    if(id==='roadScreen') this.updateRoad();
    if(id==='garageScreen') Garage.open();
    if(id==='shopScreen') Shop.render();
    if(id==='bankScreen') Bank.render();
    if(id==='rewardScreen') Rewards.render();
    if(id==='missionScreen') Missions.render();
    if(id==='settingsScreen') Settings.render();
  },
  toast(msg){
    const wrap = $('toastWrap');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(), 260); }, 1600);
    while(wrap.children.length > 3) wrap.firstChild.remove();
  },
  banner(msg){
    const b = $('bannerEl');
    b.textContent = msg;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  },
  confirm(msg, onOk){
    $('confirmMsg').textContent = msg;
    const ok = $('confirmOk');
    const clone = ok.cloneNode(true);
    ok.parentNode.replaceChild(clone, ok);
    clone.addEventListener('click', ()=>{ this.closeConfirm(); onOk(); });
    $('confirmOverlay').classList.add('active');
  },
  closeConfirm(){ $('confirmOverlay').classList.remove('active'); },

  updateMenu(){
    $('menuCoins').textContent = fmt(S.coins);
    $('menuGems').textContent = fmt(S.gems);
    $('menuLv').textContent = 'LV.' + S.level;
    $('menuTitle').textContent = levelTitle(S.level);
    $('menuXpBar').style.width = clamp(S.xp / xpNeed(S.level) * 100, 0, 100) + '%';
    const road = ROADS[S.selectedRoad];
    const best = S.bestPerRoad[road.id] || 0;
    $('menuTrackName').textContent = `${road.name} · 最佳 ${fmt(best)}m`;
    ensureDaily();
    $('rewardDot').hidden = !(S.rewardDay < 14 && S.lastRewardDate !== todayStr());
    $('missionDot').hidden = !Missions.anyClaimable();
  },
  updateRoad(){
    $('roadCoins').textContent = fmt(S.coins);
    const grid = $('roadGrid');
    grid.innerHTML = '';
    ROADS.forEach(r=>{
      const th = THEMES[r.theme];
      const best = S.bestPerRoad[r.id] || 0;
      const card = document.createElement('div');
      card.className = 'road-card' + (S.selectedRoad===r.id ? ' selected' : '');
      card.innerHTML = `
        <div class="rc-scene" style="background:linear-gradient(180deg, ${th.skyTop}, ${th.skyBot} 58%, ${th.ground} 58%, ${th.groundDark})">
          <i class="rc-dash"></i><span class="rc-emoji">${r.emoji}</span>
        </div>
        <div class="rc-body">
          <div class="rc-name">${r.name}</div>
          <div class="rc-meta">
            <span class="rc-stars">${'★'.repeat(r.diff)}${'☆'.repeat(5-r.diff)}</span>
            <span>🪙×${r.coinMul}</span>
            <span>${r.lanes}车道</span>
          </div>
          <div class="rc-best">最佳纪录 <b>${fmt(best)} m</b></div>
        </div>`;
      card.addEventListener('click', ()=>{ S.selectedRoad = r.id; save(); this.updateRoad(); AudioSys.click(); });
      grid.appendChild(card);
    });
    const buffs = $('buffRow');
    buffs.innerHTML = '';
    if(S.buffs.startNitro > 0) buffs.insertAdjacentHTML('beforeend', `<span class="buff-chip">🚀 满氮出发 ×${S.buffs.startNitro}</span>`);
    if(S.buffs.coinX2 > 0) buffs.insertAdjacentHTML('beforeend', `<span class="buff-chip">🍀 金币翻倍 ×${S.buffs.coinX2}</span>`);
  },
  updateWallets(){
    ['menuCoins','roadCoins','garageCoins','shopCoins','bankCoins','rewardCoins','missionCoins'].forEach(id=>{
      const el = $(id); if(el) el.textContent = fmt(S.coins);
    });
    const g = $('shopGems'); if(g) g.textContent = fmt(S.gems);
    const gm = $('menuGems'); if(gm) gm.textContent = fmt(S.gems);
  },
  grantXp(amount){
    S.xp += amount;
    let ups = 0, totalBonus = 0;
    while(S.xp >= xpNeed(S.level)){
      S.xp -= xpNeed(S.level);
      S.level++;
      ups++;
      const bonus = 80 * S.level;
      S.coins += bonus;
      totalBonus += bonus;
      if(S.level % 3 === 0) S.gems += 5;
    }
    if(ups > 0){
      AudioSys.levelup();
      this.toast(`🎉 升级！LV.${S.level} · ${levelTitle(S.level)}  奖励 🪙${totalBonus}`);
    }
    return ups;
  },
};

/* ================= 主菜单动态场景 ================= */
const MenuScene = {
  running:false, raf:0, last:0, scroll:0, t:0,
  clouds:[], passers:[], puffs:[],
  cv:null, ctx:null, W:0, H:0,
  start(){
    this.cv = $('menuCanvas');
    this.ctx = this.cv.getContext('2d');
    this.resize();
    if(!this.clouds.length){
      for(let i=0;i<5;i++) this.clouds.push({x:Math.random()*this.W, y:this.H*rand(.06,.3), s:rand(.6,1.3), v:rand(.08,.25)});
    }
    if(this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = ts=>{
      if(!this.running) return;
      const dt = clamp((ts - this.last)/16.667, 0, 3);
      this.last = ts;
      this.t += dt*16.667;
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  stop(){ this.running = false; cancelAnimationFrame(this.raf); },
  resize(){
    const dpr = Math.min(devicePixelRatio||1, 2);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W*dpr; this.cv.height = this.H*dpr;
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  },
  draw(dt){
    const c = this.ctx, W = this.W, H = this.H;
    const horY = H*.42;
    /* 黄昏天空 */
    const sky = c.createLinearGradient(0,0,0,horY);
    sky.addColorStop(0,'#14213d'); sky.addColorStop(.55,'#31456e'); sky.addColorStop(.85,'#c96f3b'); sky.addColorStop(1,'#f5af19');
    c.fillStyle = sky; c.fillRect(0,0,W,horY);
    /* 落日 */
    const sunX = W*.72, sunY = horY - H*.045;
    const sg = c.createRadialGradient(sunX,sunY,4,sunX,sunY,H*.14);
    sg.addColorStop(0,'rgba(255,214,120,.95)'); sg.addColorStop(.35,'rgba(255,170,80,.5)'); sg.addColorStop(1,'rgba(255,170,80,0)');
    c.fillStyle = sg; c.fillRect(sunX-H*.15, sunY-H*.15, H*.3, H*.3);
    c.fillStyle = '#ffd58a';
    c.beginPath(); c.arc(sunX, sunY, H*.028, 0, Math.PI*2); c.fill();
    /* 云 */
    c.fillStyle = 'rgba(255,220,190,.5)';
    this.clouds.forEach(cl=>{
      cl.x += cl.v*dt;
      if(cl.x > W+80) cl.x = -80;
      c.beginPath();
      c.ellipse(cl.x, cl.y, 46*cl.s, 13*cl.s, 0, 0, Math.PI*2);
      c.ellipse(cl.x+30*cl.s, cl.y+5*cl.s, 30*cl.s, 10*cl.s, 0, 0, Math.PI*2);
      c.fill();
    });
    /* 远山剪影 */
    c.fillStyle = '#1d2c47';
    c.beginPath(); c.moveTo(0,horY);
    for(let x=0;x<=W;x+=W/6){
      c.lineTo(x + W/12, horY - H*.05 - Math.sin(x*.013+2)*H*.03);
      c.lineTo(x + W/6, horY - H*.015);
    }
    c.lineTo(W,horY); c.closePath(); c.fill();
    /* 地面 */
    c.fillStyle = '#17202c'; c.fillRect(0,horY,W,H-horY);
    c.fillStyle = 'rgba(255,255,255,.03)';
    for(let i=0;i<8;i++) c.fillRect(0, horY + (H-horY)*i/8, W, 1);
    /* 公路（透视梯形） */
    const roadTopW = W*.09, roadBotW = W*.72;
    const cx = W*.5;
    c.fillStyle = '#262c36';
    c.beginPath();
    c.moveTo(cx-roadTopW/2, horY); c.lineTo(cx+roadTopW/2, horY);
    c.lineTo(cx+roadBotW/2, H); c.lineTo(cx-roadBotW/2, H);
    c.closePath(); c.fill();
    /* 路缘警示条 */
    c.strokeStyle = '#f7b731'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx-roadTopW/2, horY); c.lineTo(cx-roadBotW/2, H); c.stroke();
    c.beginPath(); c.moveTo(cx+roadTopW/2, horY); c.lineTo(cx+roadBotW/2, H); c.stroke();
    /* 滚动虚线 */
    this.scroll = (this.scroll + dt*7) % 60;
    c.strokeStyle = 'rgba(244,244,239,.85)';
    for(let i=0;i<12;i++){
      const p = (i*60 + this.scroll*3)/ (H-horY+120);
      if(p<0 || p>1) continue;
      const y = horY + p*(H-horY);
      const wAt = lerp(roadTopW, roadBotW, p);
      const hh = lerp(2, 26, p*p);
      c.lineWidth = lerp(1, 5, p);
      c.beginPath();
      c.moveTo(cx, y); c.lineTo(cx, y+hh);
      c.stroke();
      void wAt;
    }
    /* 偶尔掠过的车灯 */
    if(Math.random() < .004*dt && this.passers.length < 2){
      this.passers.push({p:0, lane:Math.random()<.5?-1:1, v:rand(.004,.007)});
    }
    this.passers = this.passers.filter(pa=>{
      pa.p += pa.v*dt;
      if(pa.p > 1) return false;
      const y = horY + pa.p*(H-horY);
      const wAt = lerp(roadTopW, roadBotW, pa.p);
      const x = cx + pa.lane*wAt*.28;
      const s = lerp(.25, 1, pa.p);
      c.fillStyle = 'rgba(255,240,180,'+(.8*pa.p)+')';
      c.beginPath(); c.arc(x-8*s, y, 4*s, 0, Math.PI*2); c.arc(x+8*s, y, 4*s, 0, Math.PI*2); c.fill();
      c.fillStyle = 'rgba(20,24,32,'+(.9*pa.p)+')';
      c.fillRect(x-13*s, y-20*s, 26*s, 20*s);
      return true;
    });
    /* 玩家车（底部居中，微颤 + 大灯光晕） */
    const car = CARS[S.selectedCar];
    const cw = clamp(W*.13, 54, 84), ch = cw*1.72;
    const carX = cx - cw/2, carY = H - ch - H*.06 + Math.sin(this.t*.004)*2;
    const hg = c.createRadialGradient(cx, carY, 4, cx, carY, ch*.9);
    hg.addColorStop(0,'rgba(255,240,180,.28)'); hg.addColorStop(1,'rgba(255,240,180,0)');
    c.fillStyle = hg;
    c.beginPath(); c.ellipse(cx, carY - ch*.2, cw*1.1, ch*.8, 0, 0, Math.PI*2); c.fill();
    drawCar(c, carX, carY, cw, ch, car, {sparkle:this.t*.002});
    /* 尾气 */
    if(Math.random() < .12*dt) this.puffs.push({x:cx + rand(-6,6), y:carY+ch+2, r:rand(2,4), a:.5});
    this.puffs = this.puffs.filter(p=>{
      p.y += .6*dt; p.r += .12*dt; p.a -= .02*dt;
      if(p.a <= 0) return false;
      c.fillStyle = `rgba(160,170,185,${p.a})`;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI*2); c.fill();
      return true;
    });
  },
};

/* ================= 车库 ================= */
const Garage = {
  idx:0, raf:0, running:false,
  open(){
    this.idx = S.selectedCar;
    this.render();
    if(!this.running){
      this.running = true;
      const loop = ts=>{
        if(!this.running) return;
        drawCarPreview($('garageCanvas'), CARS[this.idx], ts);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
  },
  close(){ this.running = false; cancelAnimationFrame(this.raf); },
  nav(d){ this.idx = (this.idx + d + CARS.length) % CARS.length; this.render(); AudioSys.click(); },
  ups(carId){ return S.upgrades[carId] || (S.upgrades[carId] = {speed:0, accel:0, handling:0, nitro:0}); },
  render(){
    const car = CARS[this.idx];
    const owned = S.ownedCars.includes(car.id);
    const up = this.ups(car.id);
    $('gCarName').textContent = car.name;
    $('gOwnTag').textContent = owned ? (S.selectedCar===car.id ? '✓ 当前驾驶' : '已拥有') : `售价 🪙 ${fmt(car.price)}`;
    const box = $('gStats');
    box.innerHTML = '';
    STAT_META.forEach(sm=>{
      const base = car[sm.key], lvl = up[sm.key];
      const eff = (base + lvl*.6).toFixed(1);
      const cost = 150*(lvl+1);
      const maxed = lvl >= 5;
      const row = document.createElement('div');
      row.className = 'g-stat';
      row.innerHTML = `
        <label>${sm.label}</label>
        <div class="g-bar"><i style="width:${base*10}%"></i><em style="left:${base*10}%;width:${lvl*6}%"></em></div>
        <span class="g-val">${eff}</span>
        <button class="g-up" ${maxed||!owned||S.coins<cost?'disabled':''} data-k="${sm.key}">
          ${maxed ? 'MAX' : '▲ 🪙'+cost}
        </button>`;
      box.appendChild(row);
    });
    box.querySelectorAll('.g-up').forEach(btn=>{
      btn.addEventListener('click', ()=>this.upgrade(btn.dataset.k));
    });
    const dots = $('gDots');
    dots.innerHTML = '';
    CARS.forEach((c,i)=>{
      const d = document.createElement('span');
      d.className = 'g-dot' + (i===this.idx?' active':'');
      d.addEventListener('click', ()=>{ this.idx = i; this.render(); });
      dots.appendChild(d);
    });
    const btn = $('gActionBtn');
    if(owned){
      btn.innerHTML = S.selectedCar===car.id ? '<span>✓ 已选择</span>' : '<span>选择驾驶</span>';
      btn.className = 'rbtn ' + (S.selectedCar===car.id ? '' : 'rbtn-green');
    } else {
      btn.innerHTML = `<span>购买 🪙 ${fmt(car.price)}</span>`;
      btn.className = 'rbtn rbtn-gold';
    }
    UI.updateWallets();
  },
  upgrade(key){
    const car = CARS[this.idx];
    const up = this.ups(car.id);
    const lvl = up[key];
    const cost = 150*(lvl+1);
    if(lvl >= 5 || S.coins < cost) return;
    S.coins -= cost;
    up[key] = lvl+1;
    save();
    AudioSys.buy();
    UI.toast(`🔧 ${car.name} ${STAT_META.find(m=>m.key===key).label} +0.6`);
    this.render();
  },
  action(){
    const car = CARS[this.idx];
    const owned = S.ownedCars.includes(car.id);
    if(owned){
      S.selectedCar = car.id;
      save();
      AudioSys.click();
      UI.toast(`🚗 已选择 ${car.name}`);
      this.render();
    } else {
      if(S.coins < car.price){ UI.toast('金币不足！去跑几圈赚点钱吧'); return; }
      S.coins -= car.price;
      S.ownedCars.push(car.id);
      S.selectedCar = car.id;
      save();
      AudioSys.win();
      buzz([30,40,60]);
      UI.toast(`🎉 购入新车：${car.name}！`);
      this.render();
    }
  },
};

/* ================= 商店 ================= */
const Shop = {
  render(){
    const box = $('shopScroll');
    box.innerHTML = '<div class="shop-sec">🧰 竞速道具</div><div class="shop-grid" id="shopGrid1"></div>' +
                    '<div class="shop-sec">💎 增益卡</div><div class="shop-grid" id="shopGrid2"></div>';
    const g1 = $('shopGrid1'), g2 = $('shopGrid2');
    SHOP_ITEMS.forEach(it=>{
      const cnt = S.powerups[it.id] || 0;
      const el = document.createElement('div');
      el.className = 'shop-card';
      el.innerHTML = `
        <div class="sc-ico">${it.emoji}</div>
        <div class="sc-name">${it.name}</div>
        <div class="sc-desc">${it.desc}</div>
        <div class="sc-own">库存 ×${cnt}</div>
        <button class="sc-buy" ${S.coins<it.price?'disabled':''}>🪙 ${it.price}</button>`;
      el.querySelector('.sc-buy').addEventListener('click', ()=>this.buyPowerup(it));
      g1.appendChild(el);
    });
    GEM_ITEMS.forEach(it=>{
      const cnt = S.buffs[it.id] || 0;
      const el = document.createElement('div');
      el.className = 'shop-card gem-card';
      el.innerHTML = `
        <div class="sc-ico">${it.emoji}</div>
        <div class="sc-name">${it.name}</div>
        <div class="sc-desc">${it.desc}</div>
        <div class="sc-own">持有 ×${cnt}</div>
        <button class="sc-buy" ${S.gems<it.price?'disabled':''}>💎 ${it.price}</button>`;
      el.querySelector('.sc-buy').addEventListener('click', ()=>this.buyBuff(it));
      g2.appendChild(el);
    });
    UI.updateWallets();
  },
  buyPowerup(it){
    if(S.coins < it.price){ UI.toast('金币不足！'); return; }
    S.coins -= it.price;
    S.powerups[it.id] = (S.powerups[it.id]||0) + 1;
    save(); AudioSys.buy();
    UI.toast(`购入 ${it.emoji} ${it.name}`);
    this.render();
  },
  buyBuff(it){
    if(S.gems < it.price){ UI.toast('钻石不足！完成任务和签到可获得钻石'); return; }
    S.gems -= it.price;
    S.buffs[it.id] = (S.buffs[it.id]||0) + 1;
    save(); AudioSys.buy();
    UI.toast(`购入 ${it.emoji} ${it.name}，下场比赛生效`);
    this.render();
  },
};

/* ================= 银行（老虎机） ================= */
const Bank = {
  spinning:false,
  SYMBOLS:['🍀','🔔','⭐','7️⃣','🪙','🏆'],
  render(){
    $('freeBadge').hidden = !(S.lastSpinDate !== todayStr());
    UI.updateWallets();
  },
  spin(bet){
    if(this.spinning) return;
    const free = bet===68 && S.lastSpinDate !== todayStr();
    if(!free && S.coins < bet){ UI.toast('金币不足！'); return; }
    if(free){ S.lastSpinDate = todayStr(); UI.toast('🎁 使用今日免费一转！'); }
    else S.coins -= bet;
    save();
    this.spinning = true;
    AudioSys.click();
    const reels = [ $('reel0'), $('reel1'), $('reel2') ];
    reels.forEach(r=>{ r.classList.remove('win'); r.classList.add('spin'); });
    $('bankResult').textContent = '';
    const spinIv = setInterval(()=>{ reels.forEach(r=>r.textContent = pick(this.SYMBOLS.concat(['🎁','💰']))); AudioSys.spin(); }, 90);
    /* 权重决定结果 */
    const roll = Math.random()*100;
    let faces, rewardText, apply;
    if(roll < 2){
      faces = ['💰','💰','💰'];
      const w = bet*10;
      rewardText = `🎉 头奖！+🪙${fmt(w)}`;
      apply = ()=>{ S.coins += w; };
    } else if(roll < 12){
      const s = pick(this.SYMBOLS);
      faces = [s,s,s];
      const w = bet*3;
      rewardText = `🎊 三连！+🪙${fmt(w)}`;
      apply = ()=>{ S.coins += w; };
    } else if(roll < 37){
      const s = pick(this.SYMBOLS); let o = pick(this.SYMBOLS);
      while(o===s) o = pick(this.SYMBOLS);
      faces = Math.random()<.5 ? [s,s,o] : [o,s,s];
      const w = Math.floor(bet*1.5);
      rewardText = `✨ 小赢！+🪙${fmt(w)}`;
      apply = ()=>{ S.coins += w; };
    } else if(roll < 55){
      const s = pick(this.SYMBOLS); let o = pick(this.SYMBOLS), p = pick(this.SYMBOLS);
      while(o===s) o = pick(this.SYMBOLS);
      while(p===s||p===o) p = pick(this.SYMBOLS);
      faces = [s,o,p];
      rewardText = `😐 保本，返还 🪙${fmt(bet)}`;
      apply = ()=>{ S.coins += bet; };
    } else if(roll < 70){
      const s = pick(this.SYMBOLS); let o = pick(this.SYMBOLS);
      while(o===s) o = pick(this.SYMBOLS);
      faces = [s,'🎁',o];
      const item = pick(SHOP_ITEMS.slice(0,4));
      rewardText = `🎁 中奖！获得 ${item.emoji}${item.name}`;
      apply = ()=>{ S.powerups[item.id] = (S.powerups[item.id]||0)+1; };
    } else {
      const arr = this.SYMBOLS.slice();
      faces = [arr.splice(irand(0,arr.length-1),1)[0], arr.splice(irand(0,arr.length-1),1)[0], arr.splice(irand(0,arr.length-1),1)[0]];
      rewardText = '😢 谢谢参与，下次好运！';
      apply = ()=>{};
    }
    /* 依次停轮 */
    reels.forEach((r,i)=>{
      setTimeout(()=>{
        r.classList.remove('spin');
        r.textContent = faces[i];
        AudioSys.click();
        if(i===2){
          clearInterval(spinIv);
          apply();
          const won = rewardText.includes('+') || rewardText.includes('中奖');
          const breakEven = rewardText.includes('保本');
          if(won){ reels.forEach(x=>x.classList.add('win')); AudioSys.win(); buzz([30,50,30,50,80]); }
          else if(breakEven){ AudioSys.click(); }
          else AudioSys.lose();
          $('bankResult').textContent = rewardText;
          save();
          this.spinning = false;
          this.render();
        }
      }, 650 + i*380);
    });
  },
};

/* ================= 签到 ================= */
const Rewards = {
  render(){
    UI.updateWallets();
    const grid = $('rewardGrid');
    grid.innerHTML = '';
    const today = todayStr();
    REWARDS.forEach(r=>{
      const claimed = r.day <= S.rewardDay;
      const ready = r.day === S.rewardDay+1 && S.lastRewardDate !== today;
      const el = document.createElement('div');
      el.className = 'rw-cell' + (claimed?' claimed':'') + (ready?' ready':'');
      el.innerHTML = `
        <span class="d">第${r.day}天</span>
        <span class="i">${r.icon}</span>
        <span class="a">${r.gem ? r.amount : r.type ? '×'+r.amount : r.amount}</span>`;
      if(ready) el.addEventListener('click', ()=>this.claim(r));
      grid.appendChild(el);
    });
  },
  claim(r){
    if(r.gem) S.gems += r.amount;
    else if(r.type) S.powerups[r.type] = (S.powerups[r.type]||0) + r.amount;
    else S.coins += r.amount;
    S.rewardDay = r.day;
    S.lastRewardDate = todayStr();
    save();
    AudioSys.buy(); buzz(40);
    UI.toast(`🎁 第${r.day}天签到成功！${r.icon} ×${r.amount}`);
    this.render();
  },
};

/* ================= 任务 / 成就 ================= */
const Missions = {
  tab:'daily',
  setTab(t){ this.tab = t; $('tabDaily').classList.toggle('active', t==='daily'); $('tabPerm').classList.toggle('active', t==='perm'); this.render(); AudioSys.click(); },
  anyClaimable(){
    ensureDaily();
    const dailyOk = S.daily.ids.some(id=>{
      const m = DAILY_POOL.find(x=>x.id===id);
      return m && !S.daily.claimed[id] && (S.daily.progress[m.stat]||0) >= m.target;
    });
    const achOk = ACHIEVEMENTS.some(a=>!S.achClaimed[a.id] && a.get() >= a.target);
    return dailyOk || achOk;
  },
  render(){
    ensureDaily();
    UI.updateWallets();
    const list = $('missionList');
    list.innerHTML = '';
    if(this.tab==='daily'){
      S.daily.ids.forEach(id=>{
        const m = DAILY_POOL.find(x=>x.id===id);
        if(!m) return;
        const prog = S.daily.progress[m.stat]||0;
        const done = prog >= m.target;
        const claimed = !!S.daily.claimed[id];
        list.appendChild(this.item(m.icon, m.name, m.desc, prog, m.target, claimed, done,
          this.rwText(m.rw), ()=>this.claimDaily(id)));
      });
      $('missionReset').textContent = '每日任务在每天 0 点刷新';
    } else {
      ACHIEVEMENTS.forEach(a=>{
        const prog = a.get();
        const done = prog >= a.target;
        const claimed = !!S.achClaimed[a.id];
        list.appendChild(this.item(a.icon, a.name, a.desc, prog, a.target, claimed, done,
          this.rwText(a.rw), ()=>this.claimAch(a.id)));
      });
      $('missionReset').textContent = '';
    }
  },
  rwText(rw){ return rw.gems ? `💎${rw.gems}` : `🪙${rw.coins}`; },
  item(icon, name, desc, prog, target, claimed, done, rwText, onClaim){
    const el = document.createElement('div');
    el.className = 'm-item';
    const pct = clamp(prog/target*100, 0, 100);
    el.innerHTML = `
      <span class="mi">${icon}</span>
      <div class="m-info">
        <div class="m-name">${name}</div>
        <div class="m-desc">${desc}（${fmt(Math.min(prog,target))}/${fmt(target)}）</div>
        <div class="m-bar"><i style="width:${pct}%"></i></div>
      </div>
      <button class="m-claim" ${!done||claimed?'disabled':''}>${claimed?'✓ 已领':done?'领取 '+rwText:rwText}</button>`;
    el.querySelector('.m-claim').addEventListener('click', onClaim);
    return el;
  },
  grant(rw){
    if(rw.coins) S.coins += rw.coins;
    if(rw.gems) S.gems += rw.gems;
  },
  claimDaily(id){
    const m = DAILY_POOL.find(x=>x.id===id);
    if(!m || S.daily.claimed[id] || (S.daily.progress[m.stat]||0) < m.target) return;
    S.daily.claimed[id] = true;
    this.grant(m.rw);
    save(); AudioSys.buy(); buzz(40);
    UI.toast(`✅ 完成任务「${m.name}」 ${this.rwText(m.rw)}`);
    this.render();
  },
  claimAch(id){
    const a = ACHIEVEMENTS.find(x=>x.id===id);
    if(!a || S.achClaimed[id] || a.get() < a.target) return;
    S.achClaimed[id] = true;
    this.grant(a.rw);
    save(); AudioSys.buy(); buzz(40);
    UI.toast(`🏅 达成成就「${a.name}」 ${this.rwText(a.rw)}`);
    this.render();
  },
};

/* ================= 设置 ================= */
const Settings = {
  render(){
    $('swSound').classList.toggle('on', S.settings.sound);
    $('swMusic').classList.toggle('on', S.settings.music);
    $('swVibrate').classList.toggle('on', S.settings.vibrate);
    $('qHigh').classList.toggle('active', S.settings.quality==='high');
    $('qLow').classList.toggle('active', S.settings.quality==='low');
  },
  toggle(key, btnId){
    S.settings[key] = !S.settings[key];
    save();
    $(btnId).classList.toggle('on', S.settings[key]);
    if(key==='music'){
      if(S.settings.music) AudioSys.startMusic();
      else AudioSys.stopMusic();
    }
    AudioSys.click();
  },
  quality(q){
    S.settings.quality = q;
    save();
    this.render();
    AudioSys.click();
  },
  confirmReset(){
    UI.confirm('确定要清空所有游戏进度吗？此操作无法撤销！', ()=>{
      try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
      location.reload();
    });
  },
};

/* ================= 新手引导 ================= */
const Tutorial = {
  step:0,
  steps:[
    {ico:'👆', title:'车辆控制', body:'<b>触屏</b>：手指左右拖动，赛车紧跟指尖<br><b>键盘</b>：A / D 或 ← → 转向'},
    {ico:'⛽', title:'油量与检查站', body:'油量会持续消耗，<b>耗尽即失败</b><br>每 500 米经过检查站自动补油<br>路上捡 ⛽ 道具也能回油'},
    {ico:'🚀', title:'氮气与连击', body:'<b>长按 NOS</b> 释放氮气：加速、撞飞来车、得分翻倍<br>近距离<b>险胜</b>超车可充氮气并叠加连击'},
  ],
  show(){
    this.step = 0;
    this.paint();
    $('tutorialOverlay').classList.add('active');
  },
  paint(){
    const st = this.steps[this.step];
    $('tutIco').textContent = st.ico;
    $('tutStep').textContent = `${this.step+1} / ${this.steps.length}`;
    $('tutTitle').textContent = st.title;
    $('tutBody').innerHTML = st.body;
    $('tutDots').innerHTML = this.steps.map((_,i)=>`<span class="g-dot ${i===this.step?'active':''}" style="width:8px;height:8px"></span>`).join('');
    $('tutNext').innerHTML = this.step === this.steps.length-1 ? '<span>🏁 开始比赛！</span>' : '<span>下一步 ›</span>';
  },
  next(){
    AudioSys.click();
    if(this.step < this.steps.length-1){ this.step++; this.paint(); }
    else{
      $('tutorialOverlay').classList.remove('active');
      S.tutorialDone = true;
      save();
      Game.start();
    }
  },
};
