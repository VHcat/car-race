/* ================= AUDIO (WebAudio synth) ================= */
const AudioSys = {
  ctx:null, master:null, sfxG:null, musG:null, engG:null, engOsc:null, engOsc2:null, engFilter:null,
  musicOn:false, musicTimer:null, mNext:0, mStep:0,
  ensure(){
    if(this.ctx){ if(this.ctx.state==='suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext||window.webkitAudioContext;
    if(!AC) return false;
    try{
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value=.9; this.master.connect(this.ctx.destination);
      this.sfxG = this.ctx.createGain(); this.sfxG.gain.value=.5; this.sfxG.connect(this.master);
      this.musG = this.ctx.createGain(); this.musG.gain.value=.15; this.musG.connect(this.master);
      this.engG = this.ctx.createGain(); this.engG.gain.value=0; this.engG.connect(this.master);
      this.engFilter = this.ctx.createBiquadFilter(); this.engFilter.type='lowpass'; this.engFilter.frequency.value=420;
      this.engOsc = this.ctx.createOscillator(); this.engOsc.type='sawtooth'; this.engOsc.frequency.value=46;
      this.engOsc2 = this.ctx.createOscillator(); this.engOsc2.type='sawtooth'; this.engOsc2.frequency.value=48; this.engOsc2.detune.value=9;
      this.engOsc.connect(this.engFilter); this.engOsc2.connect(this.engFilter); this.engFilter.connect(this.engG);
      this.engOsc.start(); this.engOsc2.start();
    }catch(e){ this.ctx=null; return false; }
    return true;
  },
  ok(){ return this.ctx && S.settings.sound; },
  tone(f, dur, type, vol, slide, delay){
    if(!this.ok()) return;
    const c=this.ctx, t0=c.currentTime+(delay||0);
    const o=c.createOscillator(), g=c.createGain();
    o.type=type||'square'; o.frequency.setValueAtTime(f, t0);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide), t0+dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol||.3, t0+.012);
    g.gain.exponentialRampToValueAtTime(.0001, t0+dur);
    o.connect(g); g.connect(this.sfxG);
    o.start(t0); o.stop(t0+dur+.03);
  },
  noise(dur, vol, freq, q, delay, sweep){
    if(!this.ok()) return;
    const c=this.ctx, t0=c.currentTime+(delay||0);
    const len=Math.max(1, Math.floor(c.sampleRate*dur));
    const buf=c.createBuffer(1,len,c.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    const src=c.createBufferSource(); src.buffer=buf;
    const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.setValueAtTime(freq||800,t0); f.Q.value=q||1;
    if(sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40,freq+sweep), t0+dur);
    const g=c.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(vol||.3, t0+.015);
    g.gain.exponentialRampToValueAtTime(.0001, t0+dur);
    src.connect(f); f.connect(g); g.connect(this.sfxG);
    src.start(t0); src.stop(t0+dur+.03);
  },
  click(){ this.tone(620,.05,'square',.12); },
  coin(){ this.tone(988,.06,'square',.22); this.tone(1319,.11,'square',.22,0,.055); },
  near(){ this.noise(.2,.3,500,1.4,0,1600); },
  crash(){ this.noise(.42,.55,240,.8); this.tone(95,.32,'sawtooth',.4,-55); },
  ram(){ this.noise(.28,.45,340,.8); this.tone(140,.2,'sawtooth',.35,-70); },
  nitro(){ this.tone(190,.4,'sawtooth',.3,720); this.noise(.4,.2,900,1,0,1400); },
  nitroLoopStop(){},
  thunder(){ this.noise(.7,.6,140,.6); this.tone(58,.5,'sawtooth',.4,-25); },
  pickup(){ this.tone(523,.07,'square',.25); this.tone(784,.1,'square',.25,0,.06); },
  shield(){ this.tone(300,.22,'sine',.3,240); },
  shieldBreak(){ this.noise(.3,.4,1200,1.2); this.tone(500,.2,'square',.3,-260); },
  fuelUp(){ this.tone(392,.08,'square',.25); this.tone(523,.08,'square',.25,0,.08); this.tone(659,.13,'square',.25,0,.16); },
  checkpoint(){ this.tone(659,.09,'square',.28); this.tone(880,.09,'square',.28,0,.09); this.tone(1175,.16,'square',.28,0,.18); },
  levelup(){ [523,659,784,1047].forEach((f,i)=>this.tone(f,.14,'square',.3,0,i*.1)); this.noise(.5,.15,3000,1,.4,2000); },
  buy(){ this.tone(784,.06,'square',.25); this.tone(1046,.12,'square',.25,0,.06); },
  count(){ this.tone(440,.13,'square',.3); },
  go(){ this.tone(880,.32,'square',.32); },
  revive(){ this.tone(220,.4,'sawtooth',.3,660); },
  lose(){ [392,330,262,196].forEach((f,i)=>this.tone(f,.16,'triangle',.3,0,i*.13)); },
  win(){ [523,659,784,1047,1319].forEach((f,i)=>this.tone(f,.12,'square',.28,0,i*.08)); },
  lowFuel(){ this.tone(233,.13,'square',.28); this.tone(233,.13,'square',.28,0,.2); },
  spin(){ this.tone(700,.05,'square',.12); },
  /* ---- engine hum ---- */
  setEngine(ratio, nitro){
    if(!this.ctx) return;
    const t=this.ctx.currentTime;
    const on = ratio>0.01;
    const vol = S.settings.sound ? (on ? .045+ratio*.05 : 0) : 0;
    this.engG.gain.setTargetAtTime(vol, t, .08);
    const f = 42 + ratio*135 + (nitro?70:0);
    this.engOsc.frequency.setTargetAtTime(f, t, .06);
    this.engOsc2.frequency.setTargetAtTime(f*1.01+2, t, .06);
    this.engFilter.frequency.setTargetAtTime(300+ratio*700+(nitro?500:0), t, .08);
  },
  /* ---- music sequencer ---- */
  startMusic(){
    if(!this.ensure() || this.musicOn) return;
    if(!S.settings.music) return;
    this.musicOn = true; this.mStep=0; this.mNext=this.ctx.currentTime+.06;
    const stepDur = 60/132/2;
    const bass=[110,0,110,110, 0,110,0,131, 147,0,147,147, 0,165,0,196];
    this.musicTimer = setInterval(()=>{
      if(!this.musicOn) return;
      while(this.mNext < this.ctx.currentTime+.28){
        const st=this.mStep, t=this.mNext, c=this.ctx;
        const b=bass[st];
        if(b){ const o=c.createOscillator(), g=c.createGain();
          o.type='sawtooth'; o.frequency.value=b;
          const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=520;
          g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.5,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+stepDur*.95);
          o.connect(f); f.connect(g); g.connect(this.musG); o.start(t); o.stop(t+stepDur);
        }
        // hat
        const hl=Math.floor(c.sampleRate*.03), hb=c.createBuffer(1,hl,c.sampleRate), hd=hb.getChannelData(0);
        for(let i=0;i<hl;i++) hd[i]=Math.random()*2-1;
        const hs=c.createBufferSource(); hs.buffer=hb;
        const hf=c.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=6500;
        const hg=c.createGain(); hg.gain.setValueAtTime(st%4===2?.28:.14,t); hg.gain.exponentialRampToValueAtTime(.0001,t+.035);
        hs.connect(hf); hf.connect(hg); hg.connect(this.musG); hs.start(t);
        // kick & snare
        if(st%8===0||st%8===4){ const o=c.createOscillator(), g=c.createGain();
          o.type='sine'; o.frequency.setValueAtTime(st%8===0?130:150,t); o.frequency.exponentialRampToValueAtTime(42,t+.09);
          g.gain.setValueAtTime(.9,t); g.gain.exponentialRampToValueAtTime(.0001,t+.12);
          o.connect(g); g.connect(this.musG); o.start(t); o.stop(t+.14);
        }
        this.mNext += stepDur; this.mStep=(this.mStep+1)%16;
      }
    }, 90);
  },
  stopMusic(){ this.musicOn=false; if(this.musicTimer){ clearInterval(this.musicTimer); this.musicTimer=null; } },
};
document.addEventListener('pointerdown', function audioWake(){ AudioSys.ensure(); AudioSys.startMusic(); }, {once:false});
document.addEventListener('keydown', function audioWake2(){ AudioSys.ensure(); AudioSys.startMusic(); }, {once:false});
