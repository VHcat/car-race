'use strict';
let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();installPrompt=event;$('installRow').hidden=false;
});
$('installBtn').addEventListener('click',async()=>{
  if(!installPrompt) return;
  const prompt=installPrompt;installPrompt=null;
  await prompt.prompt();await prompt.userChoice;$('installRow').hidden=true;
});
window.addEventListener('appinstalled',()=>{$('installRow').hidden=true;});
if('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol)){
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{
    $('offlineStatus').textContent='离线资源已就绪 · 进度保存在当前设备';
  }).catch(()=>{
    $('offlineStatus').textContent='进度保存在当前设备 · 联网可重新准备离线资源';
  });
}
