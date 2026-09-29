'use strict';

// One pointer owns steering. The other thumb can hold an ability independently.
const Input = {
  steering: null, originX: 0, carX: 0, releases:[],
  clear(){
    this.steering = null;
    this.releases.forEach(release=>release());
    const g = Game.g;
    if(g) Object.assign(g, {moveLeft:false, moveRight:false, nitroHeld:false,
      flyHeld:false, touching:false, touchTargetX:null});
  },
  x(event){
    const rect = $('gameCanvas').getBoundingClientRect();
    return (event.clientX - rect.left) * Game.W / rect.width;
  },
  bind(){
    const canvas = $('gameCanvas');
    canvas.addEventListener('pointerdown', e => {
      const g = Game.g;
      if(!g || g.state !== 'run' || Game.paused || this.steering !== null || e.button > 0) return;
      e.preventDefault();
      this.steering = e.pointerId;
      this.originX = this.x(e); this.carX = g.px + g.pw / 2;
      canvas.setPointerCapture(e.pointerId);
      g.touching = true;
      g.touchTargetX = S.settings.control === 'direct' ? this.originX : this.carX;
    });
    canvas.addEventListener('pointermove', e => {
      const g = Game.g;
      if(!g || Game.paused || e.pointerId !== this.steering) return;
      g.touchTargetX = S.settings.control === 'direct' ? this.x(e) : this.carX + (this.x(e) - this.originX) * 1.25;
    });
    const release = e => {
      if(e.pointerId !== this.steering) return;
      this.steering = null;
      if(Game.g){ Game.g.touching = false; Game.g.touchTargetX = null; }
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => canvas.addEventListener(type, release));
    this.hold($('nitroBtn'), 'nitroHeld');
    this.hold($('flyBtn'), 'flyHeld');
    document.addEventListener('keydown', e => {
      const g = Game.g;
      if(!g || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if([' ', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      const key = e.key.toLowerCase();
      if((key === 'escape' || key === 'p') && !e.repeat){ Game.togglePause(); return; }
      if(Game.paused || g.state !== 'run') return;
      if(key === 'arrowleft' || key === 'a') g.moveLeft = true;
      if(key === 'arrowright' || key === 'd') g.moveRight = true;
      if([' ', 'arrowup', 'w'].includes(key)) g.nitroHeld = true;
      if(['f', 'shift'].includes(key)) g.flyHeld = true;
      const index = '123456'.indexOf(key);
      if(index >= 0 && !e.repeat) Game.usePowerup(Game.PU_ORDER[index]);
    });
    document.addEventListener('keyup', e => {
      const g = Game.g;
      if(!g) return;
      const key = e.key.toLowerCase();
      if(['arrowleft', 'a'].includes(key)) g.moveLeft = false;
      if(['arrowright', 'd'].includes(key)) g.moveRight = false;
      if([' ', 'arrowup', 'w'].includes(key)) g.nitroHeld = false;
      if(['f', 'shift'].includes(key)) g.flyHeld = false;
    });
  },
  hold(button, property){
    let owner = null;
    this.releases.push(()=>{owner=null;});
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      const g = Game.g;
      if(!g || Game.paused || g.state !== 'run' || owner !== null) return;
      if(property === 'flyHeld' && !g.wingLv){ UI.toast('在改装车间装备飞翼后可起飞'); return; }
      owner = e.pointerId;
      button.setPointerCapture(owner);
      g[property] = true;
    });
    const release = e => {
      if(owner !== e.pointerId) return;
      owner = null;
      if(Game.g) Game.g[property] = false;
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, release));
    button.addEventListener('contextmenu', e => e.preventDefault());
  },
};

function suspendGame(){
  Input.clear();
  if(Game.g && !Game.paused && ['run', 'countdown', 'revive'].includes(Game.g.state)) Game.togglePause();
  AudioSys.stopMusic();
  AudioSys.setEngine(0, false);
}
window.addEventListener('blur', suspendGame);
document.addEventListener('visibilitychange', () => {
  if(document.hidden){ suspendGame(); MenuScene.stop(); Garage.close(); }
  else if(UI.current === 'menuScreen') MenuScene.start();
  else if(UI.current === 'garageScreen') Garage.open();
});
window.addEventListener('pagehide', () => { suspendGame(); save(); });
let resizeFrame = 0;
function onResize(){
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if(MenuScene.running) MenuScene.resize();
    Game.resize();
  });
}
window.addEventListener('resize', onResize);
if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
$('pauseBtn').addEventListener('click', e => { Game.togglePause(); e.currentTarget.blur(); });
$('gameCanvas').addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerdown', () => AudioSys.ensure(), {once:true});
loadSave();
document.body.classList.toggle('reduced-motion', S.settings.reducedMotion);
ensureDaily();
Input.bind();
MenuScene.start();
UI.updateMenu();
UI.updateWallets();
