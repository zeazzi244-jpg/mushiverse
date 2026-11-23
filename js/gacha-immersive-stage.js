/* MUSHIVERSE: immersive gacha stage (presentation only; draw and wallet logic remain unchanged). */
(()=>{'use strict';
const css=`
#mv101Machine.mvImmersive{position:fixed!important;inset:0!important;width:100vw!important;max-width:none!important;height:100dvh!important;margin:0!important;padding:calc(env(safe-area-inset-top) + 56px) 14px calc(env(safe-area-inset-bottom) + 14px)!important;border-radius:0!important;z-index:2147483500!important;overflow-y:auto!important;overscroll-behavior:contain;background:radial-gradient(ellipse at 50% 30%,#295d3c 0%,#09251e 55%,#04130f 100%)!important;color:#f7f2d8!important;box-shadow:none!important;display:flex;flex-direction:column;align-items:center;gap:10px;isolation:isolate}
#mv101Machine.mvImmersive:before{content:"";position:fixed;inset:0;pointer-events:none;background:repeating-conic-gradient(from 0deg at 50% 42%,#eac2680b 0 9deg,transparent 9deg 21deg);animation:mvImmersiveRays 16s linear infinite;z-index:-1}
#mv101Machine.mvImmersive h2{color:#ffdfa0!important;font-size:clamp(22px,5vw,30px)!important;text-shadow:0 0 18px #dba85188}
#mv101Machine.mvImmersive .mvWoodMachine{width:min(100%,min(61dvh,520px))!important;flex:none;box-shadow:0 0 0 2px #f5d78a70,0 0 40px #efbf5688,0 24px 65px #0009!important;animation:mvImmersiveArrival .65s cubic-bezier(.18,.85,.18,1) both}
#mv101Machine.mvImmersive .mvWoodActions{width:min(100%,520px);display:flex;gap:8px}
#mv101Machine.mvImmersive .mvWoodActions button{flex:1;min-width:0}
#mv101Machine.mvImmersive .mvWoodBalance{margin:0}
#mv101Machine.mvImmersive .mvGachaOdds,#mv101Machine.mvImmersive .mvWoodAudio,#mv101Machine.mvImmersive .mvGachaRarityHint{width:min(100%,520px)}
#mv101Machine.mvImmersive .mvWoodMachine img{width:100%!important}
#mvImmersiveOpen{margin:6px auto 10px;padding:12px 20px;border:1px solid #d4af62;border-radius:100px;background:linear-gradient(140deg,#174e39,#2e7653);color:#fff7d6;font-weight:900;min-height:44px;box-shadow:0 4px 12px #08271e35}
#mvImmersiveClose{position:fixed;top:calc(env(safe-area-inset-top) + 9px);right:14px;z-index:2147483550;min-height:44px;padding:9px 16px;border-radius:99px;border:1px solid #f0d99b;background:#0c3429;color:#fff;font-weight:900}
#mvImmersiveInstruction{font-weight:800;color:#fce2a2;letter-spacing:.04em;text-align:center}
#mv101Machine.mvImmersive #mvImmersiveOpen{display:none}
#mv101Machine.mvImmersive .mvWoodCollection{flex:none}
#mv101Machine .mvWoodMachine img{cursor:zoom-in}
#mv101Machine.mvImmersive .mvWoodMachine img{cursor:default}
#mv88Reveal:before,#mv88Reveal:after{content:"";position:fixed;inset:-35%;pointer-events:none;background:repeating-conic-gradient(from 0deg at 50% 50%,transparent 0deg 13deg,#e5d48112 14deg 18deg,transparent 19deg 34deg);animation:mvImmersiveRays 11s linear infinite;z-index:-1}
#mv88Reveal:after{inset:15%;border-radius:50%;background:radial-gradient(circle,transparent 25%,#d2ab4d20 42%,transparent 65%);animation:mvImmersiveBreath 1.6s ease-in-out infinite alternate}
#mv88Reveal .mv88Stage{min-height:min(42dvh,390px)}
#mv88Reveal .mv88Title{text-shadow:0 0 12px #ffe09b,0 0 36px #c29b61}
#mv88Reveal.mv88-SSR .mv88Title,#mv88Reveal.mv103Rare .mv88Title{animation:mvImmersiveBreath .55s ease-in-out infinite alternate;color:#ffe6a1}
@keyframes mvImmersiveRays{to{transform:rotate(360deg)}}@keyframes mvImmersiveArrival{from{transform:scale(.78) translateY(30px);opacity:.4}to{transform:scale(1) translateY(0);opacity:1}}@keyframes mvImmersiveBreath{to{filter:brightness(1.45);transform:scale(1.035)}}
@media(prefers-reduced-motion:reduce){#mv101Machine.mvImmersive:before,#mv101Machine.mvImmersive .mvWoodMachine,#mv88Reveal:before,#mv88Reveal:after,#mv88Reveal.mv88-SSR .mv88Title{animation:none!important}}
`;
function init(){
 const unit=document.getElementById('mv101Machine');if(!unit||unit.dataset.immersiveReady)return;
 const machine=unit.querySelector('.mvWoodMachine');if(!machine)return;
 unit.dataset.immersiveReady='true';
 const style=document.createElement('style');style.id='mvImmersiveStyle';style.textContent=css;document.head.append(style);
 const open=document.createElement('button');open.type='button';open.id='mvImmersiveOpen';open.textContent='✦ 大画面でガチャを回す';open.setAttribute('aria-label','ガチャ筐体を全画面で開く');
 machine.before(open);
 const close=document.createElement('button');close.type='button';close.id='mvImmersiveClose';close.textContent='× 閉じる';close.hidden=true;
 const instruction=document.createElement('p');instruction.id='mvImmersiveInstruction';instruction.textContent='✦ ハンドルを回して運命のカプセルを召喚 ✦';instruction.hidden=true;
 machine.before(instruction);unit.prepend(close);
 let oldOverflow='',lastFocus=null;
 function setOpen(value){
  const was=unit.classList.contains('mvImmersive');if(was===value)return;
  if(value){lastFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
  else{document.body.style.overflow=oldOverflow;}
  unit.classList.toggle('mvImmersive',value);close.hidden=!value;instruction.hidden=!value;
  if(value){unit.scrollTop=0;close.focus({preventScroll:true});}
  else if(lastFocus?.isConnected){lastFocus.focus({preventScroll:true});}
 }
 open.addEventListener('click',()=>setOpen(true));
 machine.querySelector('img')?.addEventListener('click',()=>{if(!unit.classList.contains('mvImmersive'))setOpen(true)});
 close.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&unit.classList.contains('mvImmersive')&&!document.getElementById('mv88Reveal'))setOpen(false)});
 document.querySelectorAll('nav [data-tab]').forEach(tab=>tab.addEventListener('click',()=>{if(tab.dataset.tab!=='gacha')setOpen(false)}));
 // Existing draw and result events stay intact: fullscreen stage remains behind the reveal.
 window.addEventListener('pagehide',()=>setOpen(false));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
const observer=new MutationObserver(()=>{if(document.getElementById('mv101Machine')){init();observer.disconnect()}});
if(!document.getElementById('mv101Machine')){observer.observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true})}
})();