'use strict';
// Fuel, boost and flight share one resource update and explicit lifecycle.
const RaceAbilities = {
  update(game, dt, target){
    const g=game.g;
    /* 氮气 */
    if(g.nitroHeld && g.nitro > 0){
      if(!g.nitroActive){ g.nitroActive = true; AudioSys.nitro(); buzz(20); }
    } else g.nitroActive = false;
    if(g.nitroActive){
      target *= g.nitroPower;
      g.nitro = Math.max(0, g.nitro - g.nitroDrain*100/60*dt);
      if(g.nitro <= 0) g.nitroActive = false;
      if(S.settings.quality==='high' && g.frame%2===0){
        g.particles.push({x:g.px+g.pw*.32+rand(-3,3), y:g.py+g.ph, vx:rand(-.4,.4), vy:rand(2,4),
          life:18, color:'rgba(53,224,255,.8)', size:rand(2,4)});
        g.particles.push({x:g.px+g.pw*.68+rand(-3,3), y:g.py+g.ph, vx:rand(-.4,.4), vy:rand(2,4),
          life:18, color:'rgba(120,200,255,.8)', size:rand(2,4)});
      }
    }
    const acc = g.accelRate * (g.nitroActive ? 2.4 : 1) * dt;
    g.pSpeed += clamp(target - g.pSpeed, -0.14*dt, acc);
    if(!g.nitroHeld && !g.flying) g.nitro = Math.min(100, g.nitro + (.025+g.nitroRegen)*dt);
    $('nitroBtn').classList.toggle('firing', g.nitroActive);
    $('nitroBtn').style.setProperty('--n', g.nitro);

    /* ---- 油量 ---- */
    g.fuel -= g.fuelDrain * (g.pSpeed/g.maxSpeed) * dt * (g.nitroActive?1.8:1);
    if(g.fuel <= 25 && !g.lowWarn25){ g.lowWarn25=true; AudioSys.lowFuel(); UI.toast('⛽ 油量不足，注意检查站补给！'); }
    if(g.fuel <= 10 && !g.lowWarn10){ g.lowWarn10=true; AudioSys.lowFuel(); buzz(60); }
    $('fuelTrack').classList.toggle('low', g.fuel<=25);
    if(g.fuel <= 0){ g.fuel = 0; game.die('fuel'); return false; }

    /* ---- 飞行（飞翼装置） ---- */
    if(g.wingLv > 0){
      if(g.flyCd > 0) g.flyCd -= dt;
      if(g.flyHeld && !g.flying && g.flyEnergy >= 30 && g.flyCd <= 0){
        g.flying = true;
        $('flyBtn').classList.remove('attn');
        AudioSys.takeoff();
        game.addFloat(g.px+g.pw/2, g.py-18, '起飞!', '#f7b731', 15);
        buzz(20);
      }
      if(g.flying && (!g.flyHeld || g.flyEnergy <= 0)) g.flying = false;
      if(g.flying){
        g.flyAlt = Math.min(1, g.flyAlt + .09*dt);
        g.flyEnergy = Math.max(0, g.flyEnergy - 100/g.flyDur*dt);
        g.fuel -= g.fuelDrain*.6*dt;
        if(S.settings.quality==='high' && g.frame%3===0){
          g.particles.push({x:g.px+rand(0,g.pw), y:g.py+g.ph, vx:rand(-.6,.6), vy:rand(3,5),
            life:16, color:'rgba(255,255,255,.5)', size:rand(1.5,3)});
        }
      } else {
        const wasAir = g.flyAlt > .3;
        g.flyAlt = Math.max(0, g.flyAlt - .11*dt);
        if(wasAir && g.flyAlt <= .3){
          g.flyCd = 180;
          g.invincibleTimer = Math.max(g.invincibleTimer, 10);
          AudioSys.land();
          for(let i=0;i<8;i++){
            g.particles.push({x:g.px+rand(0,g.pw), y:g.py+g.ph-4, vx:rand(-2.4,2.4), vy:rand(-1.5,.5),
              life:rand(14,24), color:'rgba(190,190,190,.7)', size:rand(2,4)});
          }
        }
        g.flyEnergy = Math.min(100, g.flyEnergy + .12*dt);
      }
      if(g.fuel <= 0){ g.fuel = 0; game.die('fuel'); return false; }
    }

    return true;
  },
};
