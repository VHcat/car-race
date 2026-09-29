'use strict';
// Canvas presentation is isolated from simulation and persistence.
const RaceRenderer = {
  /* ---------- 渲染 ---------- */
  render(){
    const g = this.g, c = this.ctx, W = this.W, H = this.H;
    const th = g.th;
    c.save();
    if(g.shake > 0 && !S.settings.reducedMotion) c.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake));
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
    RaceRenderer.drawHorizon.call(this, c, W, horY, th);

    /* 地面 */
    c.fillStyle = th.ground; c.fillRect(0, horY, W, H-horY);
    if(th.sea){
      const seaW = Math.max(16, g.roadX - 12);
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
    // Fine asphalt flecks use world scroll, so they do not shimmer between frames.
    if(S.settings.quality === 'high'){
      c.fillStyle = th.night ? '#ffffff09' : '#0000000d';
      for(let i=0; i<170; i++){
        const x=g.roadX+(i*47.73)%g.roadW;
        const y=horY+((i*83.31+g.dashScroll)%(H-horY));
        c.fillRect(x,y,1.2,2.4);
      }
      const shade=c.createLinearGradient(g.roadX,0,g.roadX+g.roadW,0);
      shade.addColorStop(0,'#00000025');shade.addColorStop(.15,'#00000000');
      shade.addColorStop(.85,'#00000000');shade.addColorStop(1,'#00000025');
      c.fillStyle=shade;c.fillRect(g.roadX,horY,g.roadW,H-horY);
    }
    // Alternating curb stones and reflective roadside posts give readable speed cues.
    for(let y=horY-40+g.dashScroll%40; y<H; y+=40){
      c.fillStyle=th.night?'#74c9c466':'#e9ebd8bb';
      c.fillRect(g.roadX-7,y,5,20);c.fillRect(g.roadX+g.roadW+2,y,5,20);
      c.fillStyle=th.night?'#283e47':'#574e43';
      c.fillRect(g.roadX-7,y+20,5,20);c.fillRect(g.roadX+g.roadW+2,y+20,5,20);
    }
    for(let y=horY-140+g.dashScroll%140; y<H; y+=140){
      c.fillStyle='#e7e9d7';c.fillRect(g.roadX-18,y,4,17);c.fillRect(g.roadX+g.roadW+14,y,4,17);
      c.fillStyle='#eaab50';c.fillRect(g.roadX-18,y+2,4,4);c.fillRect(g.roadX+g.roadW+14,y+2,4,4);
    }
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
    RaceDirector.draw(c,g,W,H);
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
    for(const s of g.scenery) RaceRenderer.drawScenery(c, s, th);

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
    for(const e of g.enemies){
      if(e.y+e.h < horY){
        c.fillStyle='#ffcf76';c.beginPath();c.moveTo(e.x+e.w/2,horY+14);
        c.lineTo(e.x+e.w/2-4,horY+7);c.lineTo(e.x+e.w/2+4,horY+7);c.fill();
      }
      drawEnemy(c, e);
    }

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
    if(!S.settings.reducedMotion && (spdRatio > .55 || g.nitroActive)){
      const n = S.settings.quality==='high' ? 10 : 5;
      c.strokeStyle = `rgba(255,255,255,${g.nitroActive?.35:.16})`;
      c.lineWidth = 2;
      for(let i=0;i<n;i++){
        const sx = (i%2===0) ? 5+(i*13)%Math.max(8,g.roadX-16) : W-5-(i*13)%Math.max(8,g.roadX-16);
        const sy = (i*97+g.dashScroll*2)%H;
        const len = (30+i*7) * (g.nitroActive?1.6:1);
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

};
