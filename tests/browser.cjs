const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

(async () => {
  const server = spawn(process.execPath, ['tools/serve.cjs'], { cwd:path.join(__dirname,'..'), stdio:'pipe', windowsHide:true });
  let browser;
  try {
    for(let i=0;i<50;i++){
      try { if((await fetch('http://localhost:4173')).ok) break; } catch {}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const edge = process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    browser = await chromium.launch({headless:true, ...(fs.existsSync(edge)?{executablePath:edge}:{})});
    fs.mkdirSync('artifacts',{recursive:true});
    const errors=[];
    for(const [width,height] of [[390,844],[320,568],[430,932],[844,390],[1280,800]]){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true,isMobile:width<900});
      const page=await context.newPage();
      page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
      page.setDefaultTimeout(10000);
      await page.goto('http://localhost:4173');
      await page.waitForFunction(()=>typeof S!=='undefined' && S!==null);
      await page.screenshot({animations:'disabled',path:`artifacts/menu-${width}.png`});
      await page.locator('.pit-start').click();
      await page.locator('.road-card').nth(3).click();
      await page.screenshot({animations:'disabled',path:`artifacts/tracks-${width}.png`});
      await page.evaluate(()=>{S.tutorialDone=true;S.settings.music=false;S.settings.sound=false;Game.start();cancelAnimationFrame(Game.raf);Game.g.state='run';Game.g.invincibleTimer=10000;});
      const layout=await page.evaluate(()=>{
        Game.render();const g=Game.g;
        return {roadX:g.roadX,width:Game.W,roadW:g.roadW,playerBottom:g.py+g.ph,
          controls:document.querySelector('.hud-bottom').getBoundingClientRect().top,
          buttons:[...document.querySelectorAll('.pu-btn')].map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};})};
      });
      assert.ok(layout.roadX>=0 && layout.roadW<=layout.width,`road fit ${width}`);
      for(const b of layout.buttons){assert.ok(b.width>=43 && b.height>=44,`touch target ${width}: ${JSON.stringify(b)}`);assert.ok(b.left>=0 && b.right<=width+1);}
      if(width<height) assert.ok(layout.playerBottom<layout.controls,`car above controls ${width}`);
      await page.evaluate(()=>{for(let i=0;i<140;i++)Game.update(1);Game.g.invincibleTimer=0;$('touchHint').classList.remove('on');Game.render();});
      await page.screenshot({animations:'disabled',path:`artifacts/race-${width}.png`});
      await page.evaluate(()=>{Game.g.moveLeft=true;Game.g.nitroHeld=true;Game.togglePause();});
      assert.equal(await page.evaluate(()=>Game.paused && !Game.g.moveLeft && !Game.g.nitroHeld),true);
      await page.evaluate(()=>{Game.togglePause();Game.quit();});
      for(const screen of ['garageScreen','modScreen','shopScreen','missionScreen','rewardScreen','bankScreen','settingsScreen']){
        await page.evaluate(id=>UI.go(id),screen);
        const overflow=await page.evaluate(()=>document.querySelector('.screen.active').scrollWidth>innerWidth+1);
        assert.equal(overflow,false,`${screen} horizontal overflow ${width}`);
      }
      await context.close();
      console.log(`PASS ${width}×${height}: navigation, track render, controls, pause, all panels`);
    }
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
    const page=await context.newPage();
    page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
    page.setDefaultTimeout(10000);
    await page.goto('http://localhost:4173');
    const start=async options=>page.evaluate(options=>{
      if(Game.g)Game.quit();
      Object.assign(S,{tutorialDone:true,selectedMode:'endless',selectedRoad:0,...options});
      S.settings.sound=false;S.settings.music=false;
      Game.start();cancelAnimationFrame(Game.raf);Game.g.state='run';
    },options||{});
    await start();
    const cdp=await context.newCDPSession(page);
    const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5,force:1}))});
    const initial=await page.evaluate(()=>Game.g.px);
    await touch('touchStart',[[1,100,520]]);
    await page.evaluate(()=>Game.update(1));
    assert.equal(await page.evaluate(()=>Game.g.px),initial,'relative touch must not jump on press');
    await touch('touchMove',[[1,165,520]]);
    await page.evaluate(()=>{for(let i=0;i<8;i++)Game.update(1);});
    assert.ok(await page.evaluate(()=>Game.g.px)>initial+20,'drag steers car');
    const nos=await page.locator('#nitroBtn').boundingBox();
    await touch('touchStart',[[1,165,520],[2,nos.x+nos.width/2,nos.y+nos.height/2]]);
    assert.equal(await page.evaluate(()=>Game.g.touching&&Game.g.nitroHeld),true,'two fingers steer and boost independently');
    await touch('touchEnd',[[2,nos.x+nos.width/2,nos.y+nos.height/2]]);
    assert.equal(await page.evaluate(()=>Game.g.touching&&!Game.g.nitroHeld),true,'lifting boost keeps steering');
    await touch('touchCancel',[]);
    assert.equal(await page.evaluate(()=>Game.g.touching||Game.g.nitroHeld),false,'system cancellation releases controls');
    console.log('PASS real multi-touch: relative drag, steering + NOS, independent release, cancellation');

    await start({parts:{wing:1},equipped:['wing']});
    await page.evaluate(()=>{Game.g.flyHeld=true;Game.g.nitroHeld=true;Game.g.nitro=100;Game.g.enemies=[];Game.g.invincibleTimer=10000;for(let i=0;i<240;i++)Game.update(1);});
    const abilities=await page.evaluate(()=>({energy:Game.g.flyEnergy,flying:Game.g.flying,cooldown:Game.g.flyCd,nitro:Game.g.nitro}));
    assert.ok(abilities.energy<30&&!abilities.flying&&abilities.cooldown>0,'flight drains and enters cooldown even while held');
    assert.ok(abilities.nitro<1,'nitro cannot regenerate into an invincibility loop while held');
    await page.setViewportSize({width:320,height:568});
    await page.waitForTimeout(50);
    assert.ok(await page.evaluate(()=>Game.g.px>=Game.g.roadX&&Game.g.px+Game.g.pw<=Game.g.roadX+Game.g.roadW));
    const fly=await page.locator('#flyBtn').boundingBox();
    assert.ok(fly&&fly.x>=0&&fly.x+fly.width<=320&&fly.y+fly.height<=568);
    await page.setViewportSize({width:390,height:844});
    console.log('PASS flight depletion/cooldown, boost depletion, equipped controls after resize');

    await start({parts:{},equipped:[],coins:200,gems:0,xp:0,level:1});
    await page.evaluate(()=>{Game.g.distance=100;Game.die('crash');for(let i=0;i<56;i++)Game.update(1);});
    assert.equal(await page.evaluate(()=>Game.g.state),'revive');
    await page.locator('#rvCoinBtn').click();
    assert.equal(await page.evaluate(()=>Game.g.reviveUsed&&Game.g.invincibleTimer>0&&Game.g.state==='run'),true);
    assert.equal(await page.evaluate(()=>S.coins),150);
    await page.evaluate(()=>{Game.die('crash');for(let i=0;i<55&&Game.g;i++)Game.update(1);});
    assert.equal(await page.evaluate(()=>UI.current),'gameOverScreen');
    const settled=await page.evaluate(()=>S.coins);
    await page.evaluate(()=>Game.finishRun());
    assert.equal(await page.evaluate(()=>S.coins),settled,'settlement cannot pay twice');
    console.log('PASS collision → paid revive → second collision → settlement, single payout');

    await start();
    const objectives=await page.evaluate(()=>{
      const g=Game.g;g.collectedCoins=25;g.nearCount=5;g.distance=1500;
      RaceDirector.update(Game,1);const first=g.coins;RaceDirector.update(Game,1);
      return {first,second:g.coins,done:g.challenges.filter(c=>c.done).length};
    });
    assert.equal(objectives.done,3);assert.equal(objectives.first,180);assert.equal(objectives.second,180);
    await start();
    await page.evaluate(()=>{const g=Game.g;g.eventIndex=1;g.distance=650;Game.update(1);Game.updateHud(true);$('touchHint').classList.remove('on');Game.render();g.invincibleTimer=10000;});
    assert.equal(await page.evaluate(()=>Game.g.event.id),'works');
    assert.equal(await page.evaluate(()=>Game.g.hazards.length),0,'warning cannot collide');
    await page.screenshot({animations:'disabled',path:'artifacts/event-warning.png'});
    await page.evaluate(()=>{for(let i=0;i<181;i++)Game.update(1);});
    assert.equal(await page.evaluate(()=>Game.g.hazards.length),1,'barrier appears only after warning');
    const hazard=await page.evaluate(()=>{
      const g=Game.g;g.enemies=[];g.pSpeed=0;g.invincibleTimer=0;g.fuel=90;
      g.px=g.roadX+(g.event.lane+.5)*g.laneW-g.pw/2;g.hazards[0].y=g.py;
      RaceDirector.update(Game,1);return {fuel:g.fuel,hits:g.hazardHits,count:g.hazards.length};
    });
    assert.equal(hazard.fuel,82);assert.equal(hazard.hits,1);assert.equal(hazard.count,0);
    console.log('PASS objectives pay once, event warning precedes barrier, barrier penalty resolves once');

    await start({selectedMode:'sprint'});
    const sprint=await page.evaluate(()=>{
      const oldBest=S.bestDistance;
      Game.g.invincibleTimer=100000;
      for(let i=0;i<5405&&Game.g;i++){Game.g.fuel=Game.g.fuelCap;Game.update(1);}
      return {screen:UI.current,stamp:$('goStamp').textContent,best:S.bestSprint[0],oldBest,endless:S.bestDistance};
    });
    assert.equal(sprint.screen,'gameOverScreen');assert.equal(sprint.stamp,'冲刺完成！');
    assert.ok(sprint.best>2000&&sprint.best<9000,`90 second distance agrees with speed in km/h: ${JSON.stringify(sprint)}`);
    assert.equal(sprint.oldBest,sprint.endless);
    await page.waitForTimeout(850);
    await page.screenshot({animations:'disabled',path:'artifacts/sprint-result.png'});
    console.log('PASS full 90 second simulation, sprint completion and separate records');

    for(let road=0;road<6;road++){
      await start({selectedRoad:road,selectedMode:'endless'});
      await page.evaluate(()=>{Game.g.invincibleTimer=10000;for(let i=0;i<600;i++)Game.update(1);$('touchHint').classList.remove('on');Game.render();});
      await page.screenshot({animations:'disabled',path:`artifacts/theme-${road}.png`});
      const counts=await page.evaluate(()=>({weather:Game.g.weather.length,particles:Game.g.particles.length}));
      assert.ok(counts.weather<=70&&counts.particles<=240);
    }
    console.log('PASS all six tracks, weather rendering and bounded effect counts');

    await page.evaluate(()=>{Game.quit();S.selectedMode='sprint';Game.start();Game.g.state='run';Game.togglePause();});
    const pausedTime=await page.evaluate(()=>Game.g.elapsed);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>Game.g.elapsed),pausedTime,'real RAF loop freezes while paused');
    await page.evaluate(()=>{Game.togglePause();Game.g.moveRight=true;Game.g.nitroHeld=true;window.dispatchEvent(new Event('blur'));});
    assert.equal(await page.evaluate(()=>Game.paused&&!Game.g.moveRight&&!Game.g.nitroHeld),true,'blur pauses and releases input');
    await page.evaluate(()=>Game.quit());
    console.log('PASS live animation loop pause and background input release');

    const transactions=await page.evaluate(()=>{
      S.coins=5000;S.gems=50;S.rewardDay=0;S.lastRewardDate='';
      Rewards.claim(REWARDS[0]);const rewarded=S.coins;Rewards.claim(REWARDS[0]);
      const duplicateReward=S.coins;
      S.parts={};S.equipped=[];const part=PARTS.find(p=>p.id==='wing');
      Mod.buy(part);const gems=S.gems;Mod.buy(part);
      const duplicatePart=S.gems;
      S.lastSpinDate='';const beforeBank=S.coins;const random=Math.random;
      try{Math.random=()=>0;Bank.spin(68);}finally{Math.random=random;}
      const persisted=JSON.parse(localStorage.getItem(SAVE_KEY)).coins;
      return {rewarded,duplicateReward,gems,duplicatePart,beforeBank,persisted};
    });
    assert.equal(transactions.rewarded,transactions.duplicateReward,'daily reward can only be claimed once');
    assert.equal(transactions.gems,transactions.duplicatePart,'part cannot be purchased twice');
    assert.equal(transactions.persisted,transactions.beforeBank+680,'bank payout persists before reel animation');
    await page.reload();
    await page.waitForFunction(()=>typeof S!=='undefined'&&S!==null);
    assert.equal(await page.evaluate(()=>S.coins),transactions.persisted,'closing during reel animation preserves payout');
    console.log('PASS daily reward and part purchase guards, atomic bank payout across reload');

    await page.evaluate(()=>{Game.quit();S.coins=987;save();});
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(()=>typeof S!=='undefined'&&S!==null);
    assert.equal(await page.evaluate(()=>S.coins),987,'offline reload preserves save');
    assert.equal(await page.evaluate(()=>UI.current),'menuScreen');
    await page.locator('.pit-start').click();
    await page.locator('.go-bar button').click();
    await page.waitForFunction(()=>Game.g!==null);
    await page.screenshot({animations:'disabled',path:'artifacts/offline-race.png'});
    await context.close();
    console.log('PASS offline reload, save persistence and offline race startup');
    const fileContext=await browser.newContext({viewport:{width:390,height:844}});
    const filePage=await fileContext.newPage();
    filePage.on('pageerror',error=>errors.push(error.message));
    await filePage.goto(require('node:url').pathToFileURL(path.resolve('index.html')).href);
    await filePage.evaluate(()=>{S.settings.sound=false;S.settings.music=false;S.buffs.startNitro=1;});
    await filePage.locator('.pit-start').click();
    await filePage.locator('.go-bar button').click();
    assert.equal(await filePage.locator('#tutorialOverlay').evaluate(el=>el.classList.contains('active')),true);
    for(let i=0;i<3;i++)await filePage.locator('#tutNext').click();
    await filePage.waitForFunction(()=>Game.g?.state==='run');
    assert.equal(await filePage.evaluate(()=>S.totalGames),1);
    assert.equal(await filePage.evaluate(()=>S.buffs.startNitro),0,'start buff is consumed once at green light');
    await fileContext.close();
    console.log('PASS file:// startup, first-run tutorial, countdown and one-time buff consumption');
    assert.deepEqual(errors,[],'browser runtime errors');
    console.log('All browser checks passed; screenshots in artifacts/');
  } finally { if(browser)await browser.close();server.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
