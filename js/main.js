'use strict';
/* ================= 初始化 & 全局输入 ================= */

/* ---- 键盘 ---- */
document.addEventListener('keydown', e=>{
  const g = Game.g;
  if(!g) return;
  if(e.key==='ArrowLeft' || e.key==='a' || e.key==='A') g.moveLeft = true;
  if(e.key==='ArrowRight' || e.key==='d' || e.key==='D') g.moveRight = true;
  if(e.key===' ' || e.key==='ArrowUp' || e.key==='w' || e.key==='W'){ g.nitroHeld = true; e.preventDefault(); }
  if(e.key==='Escape' || e.key==='p' || e.key==='P') Game.togglePause();
  const idx = '123456'.indexOf(e.key);
  if(idx >= 0) Game.usePowerup(Game.PU_ORDER[idx]);
});
document.addEventListener('keyup', e=>{
  const g = Game.g;
  if(!g) return;
  if(e.key==='ArrowLeft' || e.key==='a' || e.key==='A') g.moveLeft = false;
  if(e.key==='ArrowRight' || e.key==='d' || e.key==='D') g.moveRight = false;
  if(e.key===' ' || e.key==='ArrowUp' || e.key==='w' || e.key==='W') g.nitroHeld = false;
});

/* ---- 触屏 / 鼠标转向（位置跟随） ---- */
const gameCanvas = $('gameCanvas');
gameCanvas.addEventListener('touchstart', e=>{
  e.preventDefault();
  const g = Game.g;
  if(!g || g.state!=='run') return;
  g.touchTargetX = e.touches[0].clientX;
  g.touching = true;
}, {passive:false});
gameCanvas.addEventListener('touchmove', e=>{
  e.preventDefault();
  const g = Game.g;
  if(!g) return;
  g.touchTargetX = e.touches[0].clientX;
}, {passive:false});
gameCanvas.addEventListener('touchend', e=>{
  e.preventDefault();
  const g = Game.g;
  if(!g) return;
  g.touching = false;
  g.touchTargetX = null;
}, {passive:false});
gameCanvas.addEventListener('mousedown', e=>{
  const g = Game.g;
  if(!g || g.state!=='run') return;
  g.touchTargetX = e.clientX;
  g.touching = true;
});
gameCanvas.addEventListener('mousemove', e=>{
  const g = Game.g;
  if(g && g.touching) g.touchTargetX = e.clientX;
});
window.addEventListener('mouseup', ()=>{
  const g = Game.g;
  if(g){ g.touching = false; g.touchTargetX = null; }
});

/* ---- 氮气按钮（长按） ---- */
const nitroBtn = $('nitroBtn');
nitroBtn.addEventListener('pointerdown', e=>{
  e.preventDefault();
  const g = Game.g;
  if(g && g.state==='run') g.nitroHeld = true;
});
['pointerup','pointerleave','pointercancel'].forEach(ev=>{
  nitroBtn.addEventListener(ev, ()=>{
    const g = Game.g;
    if(g) g.nitroHeld = false;
  });
});
nitroBtn.addEventListener('contextmenu', e=>e.preventDefault());

/* ---- 暂停按钮 ---- */
$('pauseBtn').addEventListener('click', ()=>Game.togglePause());

/* ---- 尺寸 ---- */
function onResize(){
  if(MenuScene.running) MenuScene.resize();
  Game.resize();
}
window.addEventListener('resize', onResize);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', onResize);
}

/* ---- 切后台自动暂停 ---- */
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && Game.g && UI.current==='gameScreen' && !Game.paused &&
     (Game.g.state==='run' || Game.g.state==='countdown')){
    Game.togglePause();
  }
});

/* ---- 禁止下拉刷新 / 长按菜单 ---- */
document.addEventListener('touchmove', e=>{
  if(UI.current==='gameScreen' && Game.g) e.preventDefault();
}, {passive:false});
document.addEventListener('contextmenu', e=>e.preventDefault());
document.addEventListener('gesturestart', e=>e.preventDefault());

/* ---- 启动 ---- */
loadSave();
ensureDaily();
MenuScene.start();
UI.updateMenu();
UI.updateWallets();
