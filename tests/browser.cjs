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
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://localhost:4173');
      await page.waitForFunction(()=>typeof S!=='undefined' && S!==null);
      await page.screenshot({path:`artifacts/menu-${width}.png`});
      await page.locator('.pit-start').click();
      await page.locator('.road-card').nth(3).click();
      await page.screenshot({path:`artifacts/tracks-${width}.png`});
      await page.evaluate(()=>{S.tutorialDone=true;S.settings.music=false;S.settings.sound=false;Game.start();cancelAnimationFrame(Game.raf);Game.g.state='run';});
      const layout=await page.evaluate(()=>{
        Game.render();const g=Game.g;
        return {roadX:g.roadX,width:Game.W,roadW:g.roadW,playerBottom:g.py+g.ph,
          controls:document.querySelector('.hud-bottom').getBoundingClientRect().top,
          buttons:[...document.querySelectorAll('.pu-btn')].map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};})};
      });
      assert.ok(layout.roadX>=0 && layout.roadW<=layout.width,`road fit ${width}`);
      for(const b of layout.buttons){assert.ok(b.width>=43 && b.height>=44,`touch target ${width}: ${JSON.stringify(b)}`);assert.ok(b.left>=0 && b.right<=width+1);}
      if(width<height) assert.ok(layout.playerBottom<layout.controls,`car above controls ${width}`);
      await page.evaluate(()=>{for(let i=0;i<140;i++)Game.update(1);Game.render();});
      await page.screenshot({path:`artifacts/race-${width}.png`});
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
    assert.deepEqual(errors,[],'browser runtime errors');
    console.log('Browser smoke checks passed; screenshots in artifacts/');
  } finally { if(browser)await browser.close();server.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
