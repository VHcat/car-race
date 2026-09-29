'use strict';

// Run content owns objectives and scheduled events, never the frame loop or wallet.
const RaceDirector = {
  modes:{endless:{name:'无尽公路',desc:'穿越车流，刷新最远纪录'},sprint:{name:'90 秒冲刺',desc:'限时跑得更远，完赛额外 +100'}},
  events:[
    {id:'coins',name:'黄金路线',hint:'跟随金色路线，连续收集金币',color:'#e8cf87'},
    {id:'works',name:'前方施工',hint:'避开标记车道，飞翼可越过路障',color:'#ffab6b'},
    {id:'wind',name:'顺风路段',hint:'极速 +15% · 氮气缓慢恢复',color:'#7de2cf'},
  ],
  init(g){
    Object.assign(g,{mode:S.selectedMode,elapsed:0,collectedCoins:0,challengeBonus:0,
      challenges:[{id:'coins',name:'收集 25 金币',target:25,reward:40,done:false},
        {id:'near',name:'完成 5 次险胜',target:5,reward:60,done:false},
        {id:'distance',name:'行驶 1500 米',target:1500,reward:80,done:false}],
      event:null,eventIndex:0,eventNext:650,eventCount:0,hazards:[],hazardHits:0,windBoost:false});
  },
  progress(g,challenge){
    return challenge.id==='coins'?g.collectedCoins:challenge.id==='near'?g.nearCount:g.distance;
  },
  update(game,dt){
    const g=game.g;
    g.elapsed+=dt/60;
    for(const challenge of g.challenges){
      if(!challenge.done && this.progress(g,challenge)>=challenge.target){
        challenge.done=true;g.challengeBonus+=challenge.reward;g.coins+=challenge.reward;
        game.addFloat(g.px+g.pw/2,g.py-28,`挑战完成 +${challenge.reward}`,'#d4f879',16);
        UI.toast(`✓ ${challenge.name} · 奖励 ${challenge.reward} 金币`);AudioSys.checkpoint();
      }
    }
    if(g.mode==='sprint' && g.elapsed>=90){g.dieReason='complete';game.finishRun();return false;}
    if(!g.event && g.distance>=g.eventNext){
      const definition=this.events[g.eventIndex%this.events.length];
      g.event={...definition,lane:(g.eventIndex+1)%g.laneCount,warning:180,remaining:600,timer:0};
      g.eventIndex++;g.eventNext=g.distance+1700;
      UI.banner(`${definition.name} · 即将进入`);
    }
    g.windBoost=false;
    if(g.event){
      const event=g.event;
      if(event.warning>0){
        event.warning-=dt;
        if(event.warning<=0){
          g.eventCount++;UI.banner(event.name);AudioSys.checkpoint();
          if(event.id==='works') g.hazards.push({lane:event.lane,y:-55,h:30,hit:false});
        }
      }else{
        event.remaining-=dt;event.timer+=dt;
        if(event.id==='wind') {g.windBoost=true;g.nitro=Math.min(100,g.nitro+.06*dt);}
        if(event.id==='coins' && event.timer>=14){
          event.timer=0;
          g.coinsArr.push({x:g.roadX+(event.lane+.5)*g.laneW,y:-25,size:17,angle:0,got:false});
        }
        if(event.remaining<=0){g.event=null;g.windBoost=false;}
      }
    }
    for(const hazard of g.hazards){
      hazard.y+=g.pSpeed*dt;
      const x=g.roadX+hazard.lane*g.laneW+g.laneW*.12;
      if(!hazard.hit && g.flyAlt<.35 && g.invincibleTimer<=0 &&
        rectOverlap(g.px+5,g.py+5,g.pw-10,g.ph-10,x,hazard.y,g.laneW*.76,hazard.h)){
        hazard.hit=true;
        if(g.shield){g.shield=false;AudioSys.shieldBreak();}
        else if(g.nitroActive){g.nitro=Math.max(0,g.nitro-10);AudioSys.ram();}
        else{g.fuel=Math.max(0,g.fuel-8);g.pSpeed*=.65;g.hazardHits++;AudioSys.armorHit();}
        g.invincibleTimer=30;g.shake=5;game.explode(x+g.laneW*.38,hazard.y);
        game.addFloat(g.px+g.pw/2,g.py-20,'路障！','#ffab6b',16);
      }
    }
    g.hazards=g.hazards.filter(h=>h.y<game.H+50 && !h.hit);
    return true;
  },
  reservedLane(g){
    if(g.event && ['works','coins'].includes(g.event.id)) return g.event.lane;
    return g.hazards.length?g.hazards[0].lane:-1;
  },
  hud(g){
    const pending=g.challenges.find(challenge=>!challenge.done);
    $('hudChallenge').textContent=pending ? `${pending.name}  ${Math.min(pending.target,Math.floor(this.progress(g,pending)))}/${pending.target}` : '✓ 本局挑战全部完成';
    const event=$('hudEvent');
    event.hidden=!g.event;
    if(g.event){
      event.style.setProperty('--event-color',g.event.color);
      event.textContent=g.event.warning>0?`${g.event.name} · ${Math.ceil(g.event.warning/60)}s 后进入`:`${g.event.name} · ${g.event.hint}`;
    }
    $('hudTimer').hidden=g.mode!=='sprint';
    if(g.mode==='sprint'){
      const seconds=Math.max(0,Math.ceil(90-g.elapsed));
      $('hudTimer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
      $('hudTimer').classList.toggle('urgent',seconds<=15);
    }
  },
  draw(c,g,W,H){
    if(g.event?.id==='works' && g.event.warning>0){
      const x=g.roadX+g.event.lane*g.laneW;
      c.fillStyle='#ffae581b';c.fillRect(x,Math.max(84,H*.13),g.laneW,H);
      c.fillStyle='#ffbf72';c.font='bold 12px sans-serif';c.textAlign='center';
      c.fillText('⚠ 施工',x+g.laneW/2,H*.32);
    }
    if(g.event?.id==='coins'){
      c.strokeStyle='#ead48970';c.lineWidth=2;c.setLineDash([4,14]);
      c.beginPath();const x=g.roadX+(g.event.lane+.5)*g.laneW;
      c.moveTo(x,Math.max(84,H*.13));c.lineTo(x,H);c.stroke();c.setLineDash([]);
    }
    for(const hazard of g.hazards){
      const x=g.roadX+(hazard.lane+.12)*g.laneW,w=g.laneW*.76;
      c.fillStyle='#1e2225';c.fillRect(x,hazard.y,w,hazard.h);
      c.save();c.beginPath();c.rect(x,hazard.y,w,hazard.h);c.clip();
      c.strokeStyle='#f5aa59';c.lineWidth=9;
      for(let i=-30;i<w+30;i+=20){c.beginPath();c.moveTo(x+i,hazard.y);c.lineTo(x+i+30,hazard.y+30);c.stroke();}c.restore();
      c.fillStyle='#fff1c3';c.fillRect(x+3,hazard.y-5,5,5);c.fillRect(x+w-8,hazard.y-5,5,5);
    }
    if(g.windBoost){
      c.strokeStyle='#a3f7df66';c.lineWidth=2;
      for(let i=0;i<4;i++){
        const x=g.roadX+(i%2?g.roadW+23:-23),y=(g.dashScroll*1.6+i*H/4)%H;
        c.beginPath();c.moveTo(x-6,y+8);c.lineTo(x,y);c.lineTo(x+6,y+8);c.stroke();
      }
    }
  },
};
