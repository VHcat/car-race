'use strict';
/* ================= 车辆绘制（纯 Canvas 程序化造型） ================= */

function rr(ctx, x, y, w, h, r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

/* 绘制玩家车辆（车头朝上）。o: {tilt, flame, ghost} */
function drawCar(ctx, x, y, w, h, car, o){
  o = o || {};
  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  if(o.tilt) ctx.rotate(o.tilt);
  if(o.ghost) ctx.globalAlpha *= .45;

  /* 氮气尾焰 */
  if(o.flame){
    const fl = h * (0.45 + Math.random()*0.4);
    const g = ctx.createLinearGradient(0, h/2, 0, h/2 + fl);
    g.addColorStop(0, 'rgba(190,240,255,.95)');
    g.addColorStop(.35, 'rgba(53,224,255,.75)');
    g.addColorStop(1, 'rgba(53,120,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w*.24, h/2 - 3);
    ctx.quadraticCurveTo(-w*.14, h/2 + fl*.55, 0, h/2 + fl);
    ctx.quadraticCurveTo(w*.14, h/2 + fl*.55, w*.24, h/2 - 3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.translate(-w/2, -h/2);
  const sh = car.shape;

  /* 地面阴影 */
  ctx.fillStyle = 'rgba(0,0,0,.26)';
  ctx.beginPath();
  ctx.ellipse(w/2 + 2, h/2 + 3, w*.6, h*.53, 0, 0, Math.PI*2);
  ctx.fill();

  /* 车轮 */
  const ww = sh==='monster' ? w*.24 : sh==='f1' ? w*.2 : w*.17;
  const wh = sh==='monster' ? h*.24 : h*.19;
  const stance = sh==='monster'||sh==='f1' ? w*.1 : w*.05;
  ctx.fillStyle = '#14171c';
  rr(ctx, -stance, h*.13, ww, wh, ww*.3); ctx.fill();
  rr(ctx, w + stance - ww, h*.13, ww, wh, ww*.3); ctx.fill();
  rr(ctx, -stance, h*.66, ww, wh, ww*.3); ctx.fill();
  rr(ctx, w + stance - ww, h*.66, ww, wh, ww*.3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(-stance + ww*.3, h*.13 + wh*.3, ww*.4, wh*.4);
  ctx.fillRect(w + stance - ww*.7, h*.13 + wh*.3, ww*.4, wh*.4);

  /* 车体 */
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, car.body);
  bg.addColorStop(1, shade(car.body, -26));
  ctx.fillStyle = bg;
  if(sh==='f1'){
    ctx.beginPath();
    ctx.moveTo(w*.28, 0); ctx.lineTo(w*.72, 0);
    ctx.lineTo(w*.66, h*.3); ctx.lineTo(w*.86, h*.42);
    ctx.lineTo(w*.8, h*.86); ctx.lineTo(w*.9, h);
    ctx.lineTo(w*.1, h); ctx.lineTo(w*.2, h*.86);
    ctx.lineTo(w*.14, h*.42); ctx.lineTo(w*.34, h*.3);
    ctx.closePath(); ctx.fill();
  } else if(sh==='armor'){
    rr(ctx, w*.06, 0, w*.88, h, w*.1); ctx.fill();
  } else if(sh==='jeep' || sh==='pickup' || sh==='monster'){
    rr(ctx, w*.05, h*.02, w*.9, h*.97, w*.14); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(w*.16, h);
    ctx.quadraticCurveTo(w*.02, h*.72, w*.06, h*.34);
    ctx.quadraticCurveTo(w*.12, 0, w*.5, 0);
    ctx.quadraticCurveTo(w*.88, 0, w*.94, h*.34);
    ctx.quadraticCurveTo(w*.98, h*.72, w*.84, h);
    ctx.closePath(); ctx.fill();
  }

  /*  racing 条纹（肌肉/运动/黄金） */
  if(sh==='muscle' || sh==='sport' || sh==='gold'){
    ctx.fillStyle = sh==='gold' ? 'rgba(255,255,255,.5)' : car.accent;
    ctx.globalAlpha *= .85;
    ctx.fillRect(w*.4, h*.03, w*.08, h*.94);
    ctx.fillRect(w*.53, h*.03, w*.08, h*.94);
    ctx.globalAlpha /= .85;
  }

  /* 挡风玻璃 / 座舱 */
  ctx.fillStyle = 'rgba(120,190,235,.95)';
  if(sh==='armor'){
    ctx.fillStyle = '#1c222b';
    ctx.fillRect(w*.24, h*.24, w*.52, h*.06);
  } else if(sh==='f1'){
    ctx.beginPath();
    ctx.ellipse(w*.5, h*.42, w*.14, h*.1, 0, 0, Math.PI*2);
    ctx.fill();
  } else if(sh==='jeep' || sh==='monster'){
    rr(ctx, w*.18, h*.26, w*.64, h*.2, w*.05); ctx.fill();
    ctx.fillStyle = 'rgba(60,130,180,.9)';
    rr(ctx, w*.18, h*.56, w*.64, h*.13, w*.05); ctx.fill();
  } else if(sh==='pickup'){
    rr(ctx, w*.16, h*.24, w*.68, h*.18, w*.06); ctx.fill();
    ctx.fillStyle = shade(car.body, -40);
    rr(ctx, w*.12, h*.5, w*.76, h*.4, w*.05); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(w*.16, h*.54, w*.68, h*.32);
  } else if(sh==='police' || sh==='taxi'){
    rr(ctx, w*.17, h*.26, w*.66, h*.2, w*.07); ctx.fill();
    ctx.fillStyle = 'rgba(60,130,180,.9)';
    rr(ctx, w*.17, h*.56, w*.66, h*.13, w*.06); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(w*.2, h*.34);
    ctx.quadraticCurveTo(w*.24, h*.16, w*.5, h*.15);
    ctx.quadraticCurveTo(w*.76, h*.16, w*.8, h*.34);
    ctx.lineTo(w*.74, h*.42);
    ctx.quadraticCurveTo(w*.5, h*.38, w*.26, h*.42);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(60,130,180,.85)';
    rr(ctx, w*.22, h*.58, w*.56, h*.12, w*.06); ctx.fill();
  }

  /* 车顶装置 */
  if(sh==='taxi'){
    ctx.fillStyle = '#14171c';
    rr(ctx, w*.34, h*.46, w*.32, h*.09, 2); ctx.fill();
    ctx.fillStyle = '#f7c948';
    ctx.fillRect(w*.4, h*.48, w*.2, h*.05);
  } else if(sh==='police'){
    ctx.fillStyle = '#e5383b'; ctx.fillRect(w*.26, h*.47, w*.2, h*.07);
    ctx.fillStyle = '#3f8cff'; ctx.fillRect(w*.54, h*.47, w*.2, h*.07);
  } else if(sh==='jeep'){
    ctx.fillStyle = shade(car.body, -35);
    ctx.beginPath(); ctx.arc(w*.5, h*.52, w*.13, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w*.5, h*.52, w*.13, 0, Math.PI*2); ctx.stroke();
  } else if(sh==='monster'){
    ctx.fillStyle = '#ffd60a';
    for(let i=0;i<4;i++) ctx.fillRect(w*(.24+i*.17), h*.2, w*.07, h*.045);
  } else if(sh==='armor'){
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    const rv = [[.2,.12],[.8,.12],[.2,.88],[.8,.88],[.5,.5]];
    rv.forEach(p=>{ ctx.beginPath(); ctx.arc(w*p[0], h*p[1], w*.035, 0, Math.PI*2); ctx.fill(); });
  }

  /* 尾翼 */
  if(sh==='sport' || sh==='f1' || sh==='gold' || sh==='muscle'){
    ctx.fillStyle = sh==='f1' ? car.accent : shade(car.body, -45);
    rr(ctx, w*.04, h*.9, w*.92, h*.09, w*.04); ctx.fill();
    if(sh==='f1'){
      ctx.fillStyle = shade(car.body, -30);
      rr(ctx, w*.1, h*.01, w*.8, h*.06, w*.03); ctx.fill();
    }
  }

  /* 大灯 / 尾灯 */
  ctx.fillStyle = '#fff7c2';
  ctx.beginPath(); ctx.ellipse(w*.26, h*.055, w*.09, h*.028, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(w*.74, h*.055, w*.09, h*.028, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(w*.18, h*.965, w*.16, h*.03);
  ctx.fillRect(w*.66, h*.965, w*.16, h*.03);

  /* 黄金车闪光 */
  if(sh==='gold' && o.sparkle !== undefined){
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const sp = o.sparkle;
    for(let i=0;i<3;i++){
      const a = sp + i*2.1;
      const sx = w*.5 + Math.cos(a)*w*.3, sy = h*.5 + Math.sin(a*1.3)*h*.32;
      ctx.beginPath();
      ctx.arc(sx, sy, w*.035, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}

/* 敌车（车头朝下） */
function drawEnemy(ctx, e){
  ctx.save();
  ctx.translate(e.x + e.w/2, e.y + e.h/2);
  ctx.rotate(Math.PI);
  ctx.translate(-e.w/2, -e.h/2);
  const w = e.w, h = e.h;

  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath();
  ctx.ellipse(w/2 + 2, h/2 + 3, w*.6, h*.53, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle = '#14171c';
  rr(ctx, -w*.03, h*.14, w*.16, h*.16, 2); ctx.fill();
  rr(ctx, w*.87, h*.14, w*.16, h*.16, 2); ctx.fill();
  rr(ctx, -w*.03, h*.68, w*.16, h*.16, 2); ctx.fill();
  rr(ctx, w*.87, h*.68, w*.16, h*.16, 2); ctx.fill();

  const truckLike = e.type==='truck' || e.type==='bus';
  if(truckLike){
    /* 货箱 */
    ctx.fillStyle = e.type==='bus' ? shade(e.color, -15) : '#b9c2cc';
    rr(ctx, w*.06, h*.3, w*.88, h*.68, w*.08); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
    if(e.type==='bus'){
      ctx.fillStyle = 'rgba(120,190,235,.9)';
      for(let i=0;i<3;i++){ rr(ctx, w*.14, h*(.36+i*.18), w*.72, h*.1, 2); ctx.fill(); }
    } else {
      ctx.strokeRect(w*.12, h*.36, w*.76, h*.56);
    }
    /* 驾驶室 */
    const cg = ctx.createLinearGradient(0, 0, 0, h*.32);
    cg.addColorStop(0, e.color); cg.addColorStop(1, shade(e.color, -25));
    ctx.fillStyle = cg;
    rr(ctx, w*.08, 0, w*.84, h*.32, w*.1); ctx.fill();
    ctx.fillStyle = 'rgba(120,190,235,.95)';
    rr(ctx, w*.16, h*.16, w*.68, h*.12, 2); ctx.fill();
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, e.color); bg.addColorStop(1, shade(e.color, -28));
    ctx.fillStyle = bg;
    if(e.type==='sports'){
      ctx.beginPath();
      ctx.moveTo(w*.18, h);
      ctx.quadraticCurveTo(w*.02, h*.7, w*.08, h*.3);
      ctx.quadraticCurveTo(w*.16, 0, w*.5, 0);
      ctx.quadraticCurveTo(w*.84, 0, w*.92, h*.3);
      ctx.quadraticCurveTo(w*.98, h*.7, w*.82, h);
      ctx.closePath(); ctx.fill();
    } else {
      rr(ctx, w*.06, 0, w*.88, h, w*.16); ctx.fill();
    }
    ctx.fillStyle = 'rgba(120,190,235,.92)';
    ctx.beginPath();
    ctx.moveTo(w*.2, h*.32);
    ctx.quadraticCurveTo(w*.25, h*.15, w*.5, h*.14);
    ctx.quadraticCurveTo(w*.75, h*.15, w*.8, h*.32);
    ctx.lineTo(w*.74, h*.4);
    ctx.quadraticCurveTo(w*.5, h*.36, w*.26, h*.4);
    ctx.closePath(); ctx.fill();
    if(e.type==='suv'){
      ctx.fillStyle = 'rgba(60,130,180,.85)';
      rr(ctx, w*.2, h*.58, w*.6, h*.12, 2); ctx.fill();
    }
  }
  /* 大灯（朝下所以画在底部） */
  ctx.fillStyle = THEMES[Game && Game.g ? Game.g.themeKey : 'countryside'].night ? '#fffbe0' : '#f5e9a8';
  ctx.beginPath(); ctx.arc(w*.24, h*.95, w*.08, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(w*.76, h*.95, w*.08, 0, Math.PI*2); ctx.fill();

  /* 转向灯（变道预告） */
  if(e.blink && Math.floor(e.blinkFrame/8)%2===0){
    ctx.fillStyle = '#ffb020';
    const side = e.dir>0 ? 1 : 0;
    ctx.beginPath(); ctx.arc(side ? w*.95 : w*.05, h*.25, w*.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(side ? w*.95 : w*.05, h*.75, w*.1, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* 颜色加深/变亮 */
function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  let r = (n>>16)+amt, g = ((n>>8)&255)+amt, b = (n&255)+amt;
  r = clamp(r,0,255); g = clamp(g,0,255); b = clamp(b,0,255);
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}

/* 车库预览（含旋转展台） */
function drawCarPreview(canvas, car, t){
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W/2, cy = H*.82;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, .3);
  ctx.strokeStyle = 'rgba(255,214,10,.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 11]);
  ctx.lineDashOffset = -t*.025;
  ctx.beginPath(); ctx.arc(0, 0, W*.44, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.beginPath(); ctx.arc(0, 0, W*.37, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  const cw = W*.4, ch = cw*1.72;
  const bob = Math.sin(t*.0028)*2.5;
  drawCar(ctx, cx - cw/2, cy - ch - 8 + bob, cw, ch, car, {sparkle: t*.002});
}
