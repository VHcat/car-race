'use strict';

const MenuScene = {
  running:false, raf:0, last:0, t:0,
  start(){
    this.cv = $('menuCanvas'); this.ctx = this.cv.getContext('2d');
    this.resize();
    if(this.running) return;
    this.running = true; this.last = performance.now();
    const loop = ts => {
      if(!this.running) return;
      this.t += Math.min(50, ts - this.last); this.last = ts;
      this.draw(); this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  stop(){ this.running = false; cancelAnimationFrame(this.raf); },
  resize(){
    const bounds = this.cv.getBoundingClientRect();
    this.W = bounds.width; this.H = bounds.height;
    const dpr = S.settings.quality === 'low' ? 1 : Math.min(devicePixelRatio || 1, 2);
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr;
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  },
  draw(){
    const c = this.ctx, W = this.W, H = this.H;
    c.clearRect(0,0,W,H);
    const glow = c.createRadialGradient(W*.6,H*.48,10,W*.6,H*.48,W*.65);
    glow.addColorStop(0,'#49623d66'); glow.addColorStop(1,'#18291b00');
    c.fillStyle = glow; c.fillRect(0,0,W,H);
    c.save(); c.translate(W*.58,H*.45); c.rotate(.62);
    const roadW = W*.56;
    c.fillStyle = '#2c392b'; c.fillRect(-roadW/2,-H,roadW,H*3);
    c.fillStyle = '#151f19'; c.fillRect(-roadW/2+6,-H,roadW-12,H*3);
    c.strokeStyle = '#cadf9c50'; c.lineWidth = 1;
    for(const x of [-roadW/2+13,roadW/2-13]){
      c.beginPath(); c.moveTo(x,-H); c.lineTo(x,H*2); c.stroke();
    }
    c.strokeStyle = '#c2d29935'; c.lineWidth = 2; c.setLineDash([18,23]);
    c.lineDashOffset = S.settings.reducedMotion ? 0 : -this.t*.022;
    c.beginPath(); c.moveTo(0,-H); c.lineTo(0,H*2); c.stroke(); c.setLineDash([]);
    const cw = Math.min(82,W*.23), ch = cw*1.85;
    c.shadowColor = '#000a'; c.shadowBlur = 25; c.shadowOffsetY = 16;
    drawCar(c,-cw/2+roadW*.18,-ch/2,cw,ch,CARS[S.selectedCar],{});
    c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.fillStyle = '#e8ffbe12'; c.beginPath();
    c.moveTo(-cw*.22+roadW*.18,-ch/2); c.lineTo(-cw*.65+roadW*.18,-H);
    c.lineTo(cw*.65+roadW*.18,-H); c.lineTo(cw*.22+roadW*.18,-ch/2); c.fill();
    c.restore();
    const fade = c.createLinearGradient(0,0,0,H);
    fade.addColorStop(0,'#101714'); fade.addColorStop(.23,'#10171400');
    fade.addColorStop(.77,'#10171400'); fade.addColorStop(1,'#101714');
    c.fillStyle=fade; c.fillRect(0,0,W,H);
    c.strokeStyle='#a8c58035'; c.lineWidth=1;
    for(const [x,y] of [[W*.13,H*.43],[W*.9,H*.3],[W*.86,H*.78]]){
      c.beginPath(); c.moveTo(x-4,y); c.lineTo(x+4,y); c.moveTo(x,y-4); c.lineTo(x,y+4); c.stroke();
    }
  },
};

const TrackPreview = {
  draw(canvas, road){
    const W=216,H=220,c=canvas.getContext('2d'),th=THEMES[road.theme];
    canvas.width=W;canvas.height=H;
    const sky=c.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,th.skyTop);sky.addColorStop(.55,th.skyBot);sky.addColorStop(.56,th.ground);sky.addColorStop(1,th.groundDark);
    c.fillStyle=sky;c.fillRect(0,0,W,H);
    c.fillStyle=th.hzA;
    c.beginPath();c.moveTo(0,H*.6);
    for(let i=0;i<=8;i++) c.lineTo(i*W/8,H*(.35+Math.sin(i*1.7+road.id)*.1));
    c.lineTo(W,H*.65);c.closePath();c.fill();
    if(th.night){
      for(let i=0;i<8;i++){
        const y=45+(i*23)%45;c.fillStyle='#172139';c.fillRect(i*30,y,23,90);
        c.fillStyle='#ead67f';for(let j=0;j<3;j++)c.fillRect(i*30+5,y+9+j*16,3,5);
      }
    }
    if(th.sea){c.fillStyle='#418c9f';c.fillRect(0,126,75,H);}
    c.fillStyle=th.shoulder;c.beginPath();c.moveTo(98,118);c.lineTo(116,118);c.lineTo(190,H);c.lineTo(30,H);c.fill();
    c.fillStyle=th.road;c.beginPath();c.moveTo(100,118);c.lineTo(114,118);c.lineTo(182,H);c.lineTo(38,H);c.fill();
    c.strokeStyle=th.marking;c.lineWidth=2;c.setLineDash([10,12]);c.beginPath();c.moveTo(107,120);c.lineTo(110,H);c.stroke();c.setLineDash([]);
    for(let i=0;i<3;i++) RaceRenderer.drawScenery(c,{x:i%2?195:22,y:140+i*22,s:.9,type:th.scenery[i%th.scenery.length]},th);
  },
};
