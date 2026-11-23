/* Presentation effects for MUSHIVERSE gacha. Never determines results or charges coins. */
(()=>{'use strict';
const style=document.createElement('style');style.id='mvGachaSpectacleStyle';style.textContent=`
#mv88Reveal{--mvSpectacleColor:#83e9b8}
#mv88Reveal[data-phase="2"]{--mvSpectacleColor:#9cdeff}
#mv88Reveal[data-phase="3"]{--mvSpectacleColor:#efc97b}
#mv88Reveal.mv88-R{--mvSpectacleColor:#7dc5ff}
#mv88Reveal.mv88-SR{--mvSpectacleColor:#d0a2ff}
#mv88Reveal.mv88-SSR{--mvSpectacleColor:#ffe17d}
#mv88Reveal .mv88Stage{perspective:850px;isolation:isolate}
#mv88Reveal .mv88Stage:before{content:"";position:absolute;inset:12% 8%;border:2px solid var(--mvSpectacleColor);opacity:.45;border-radius:50%;box-shadow:0 0 36px var(--mvSpectacleColor),inset 0 0 45px #8afbd633;animation:mvSpectacleOrbit 4.8s linear infinite;transform:rotateX(66deg)}
#mv88Reveal .mv88Stage:after{content:"";position:absolute;bottom:9%;left:17%;right:17%;height:18px;border-radius:50%;background:var(--mvSpectacleColor);filter:blur(23px);opacity:.55;animation:mvSpectacleGlow 1.4s ease-in-out infinite alternate}
#mv88Reveal .mv88Capsule{font-size:clamp(95px,24vw,145px);z-index:2;transform-style:preserve-3d;text-shadow:0 0 32px var(--mvSpectacleColor);filter:drop-shadow(0 0 15px var(--mvSpectacleColor))}
#mv88Reveal[data-phase="2"] .mv88Capsule{animation:mvSpectacleCharge .8s ease-in-out infinite alternate}
#mv88Reveal[data-phase="3"] .mv88Capsule{animation:mvSpectacleAwaken 1.25s ease-in-out infinite}
#mv88Reveal .mv88Wait,#mv88Reveal .mvAwakeningLabel{z-index:2}
#mv88Reveal .mvSpectacleParticles{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1}
#mv88Reveal .mvSpectacleParticle{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:50%;background:var(--mvSpectacleColor);box-shadow:0 0 12px 3px var(--mvSpectacleColor);opacity:0;animation:mvSpectacleFly var(--d) ease-in-out var(--delay) infinite}
#mv88Reveal .mvSpectacleBurst{position:absolute;inset:10%;border:4px solid var(--mvSpectacleColor);border-radius:50%;box-shadow:0 0 42px var(--mvSpectacleColor);animation:mvSpectacleBurst .75s ease-out both;pointer-events:none}
#mv88Reveal .mv88Results{grid-template-columns:repeat(auto-fit,minmax(min(125px,38vw),1fr));align-content:start;gap:12px}
#mv88Reveal .mv88Card{position:relative;box-shadow:0 5px 25px #0008;animation:mvSpectacleCard .6s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--card-index,0) * 75ms)}
#mv88Reveal .mv88Card::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(115deg,transparent 12%,#ffffff38 45%,transparent 60%);transform:translateX(-150%);animation:mvSpectacleShine 2.5s ease-in-out calc(var(--card-index,0) * 95ms) 1}
#mv88Reveal .mv88Card-SSR{border-color:#f9d574;box-shadow:0 0 20px #efbd57b0,0 9px 25px #0009}
#mv88Reveal .mv88Card-SR{border-color:#ce92fd;box-shadow:0 0 16px #a15ee588,0 9px 25px #0009}
#mv88Reveal .mv88Card strong{font-size:21px;text-shadow:0 0 10px currentColor}
#mv88Reveal .mv88Results:not([hidden]){animation:mvSpectacleResult .4s ease-out both}
#mv88Reveal.mv88-SSR:not([data-phase="1"]) .mv88Inner{filter:drop-shadow(0 0 22px #d2a94b55)}
@keyframes mvSpectacleOrbit{from{transform:rotateX(66deg) rotate(0)}to{transform:rotateX(66deg) rotate(360deg)}}
@keyframes mvSpectacleGlow{to{opacity:.95;filter:blur(32px)}}
@keyframes mvSpectacleCharge{from{transform:scale(.89) rotate(-14deg)}to{transform:scale(1.15) rotate(14deg)}}
@keyframes mvSpectacleAwaken{0%,100%{transform:scale(.9) rotate(-5deg)}50%{transform:scale(1.22) rotate(5deg)}}
@keyframes mvSpectacleFly{0%{opacity:0;transform:translate3d(0,25px,0) scale(.3)}22%{opacity:.85}100%{opacity:0;transform:translate3d(var(--dx),-115px,0) scale(1.1)}}
@keyframes mvSpectacleBurst{from{transform:scale(.15);opacity:1}to{transform:scale(1.7);opacity:0}}
@keyframes mvSpectacleCard{from{opacity:0;transform:translateY(55px) rotateY(85deg) scale(.8)}to{opacity:1;transform:translateY(0) rotateY(0) scale(1)}}
@keyframes mvSpectacleShine{0%,30%{transform:translateX(-150%)}90%,100%{transform:translateX(150%)}}
@keyframes mvSpectacleResult{from{opacity:.45;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
@media(max-width:390px){#mv88Reveal .mv88Results{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){#mv88Reveal .mv88Stage:before,#mv88Reveal .mv88Stage:after,#mv88Reveal .mv88Capsule,#mv88Reveal .mvSpectacleParticle,#mv88Reveal .mvSpectacleBurst,#mv88Reveal .mv88Card,#mv88Reveal .mv88Card::before,#mv88Reveal .mv88Results{animation:none!important;transition:none!important}}
`;document.head.append(style);
const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const mounted=new WeakMap();
function decorate(overlay){
 const stage=overlay.querySelector('.mv88Stage'),results=overlay.querySelector('.mv88Results');
 const prior=mounted.get(overlay);
 if(prior&&prior.stage===stage&&prior.results===results)return;
 if(prior){prior.cleanup();mounted.delete(overlay);overlay.querySelectorAll('.mvSpectacleParticles,.mvSpectacleBurst').forEach(node=>node.remove());}
 delete overlay.dataset.spectacleReady;
 // The reveal can mount in stages; retry on the next DOM mutation until both nodes exist.
 if(!stage||!results)return;
 overlay.dataset.spectacleReady='true';
 if(!reduce()){
  const field=document.createElement('div');field.className='mvSpectacleParticles';field.setAttribute('aria-hidden','true');
  for(let i=0;i<24;i++){
   const p=document.createElement('i');p.className='mvSpectacleParticle';
   p.style.setProperty('--x',((i*37+11)%97)+'%');
   p.style.setProperty('--y',((i*23+29)%83)+'%');
   p.style.setProperty('--s',(2+i%4*2)+'px');
   p.style.setProperty('--dx',((i*19)%120-60)+'px');
   p.style.setProperty('--d',(1.8+(i%5)*.3)+'s');
   p.style.setProperty('--delay',(-i*.14)+'s');
   field.append(p);
  }
  stage.prepend(field);
 }
 let burstDone=false;
 let previousCards=[];
 const sync=()=>{
  const cards=[...results.querySelectorAll('.mv88Card')];
  cards.forEach((card,i)=>card.style.setProperty('--card-index',String(i)));
  // Some draw paths replace cards without hiding the results container first.
  // Treat an empty result set or a wholly replaced card set as a new reveal.
  if(results.hidden||cards.length===0|| (previousCards.length>0&&cards.length>0&&!cards.some(card=>previousCards.includes(card))))burstDone=false;
  previousCards=cards;
  if(results.hidden)return;
  // Do not fire before any cards have actually been rendered.
  if(!burstDone&&cards.length&&!reduce()){
   burstDone=true;const flash=document.createElement('div');flash.className='mvSpectacleBurst';flash.setAttribute('aria-hidden','true');overlay.append(flash);
   flash.addEventListener('animationend',()=>flash.remove(),{once:true});
   // Backgrounded WebViews may suppress animationend; never leave a stale flash.
   window.setTimeout(()=>flash.remove(),1500);
  }
 };
 const observer=new MutationObserver(sync);observer.observe(results,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});sync();
 const cleanup=()=>{observer.disconnect();removal.disconnect();window.removeEventListener('pagehide',cleanup);};
 const removal=new MutationObserver(()=>{if(!overlay.isConnected){cleanup();mounted.delete(overlay)}});// The overlay is nested inside the app root, not a direct body child.
 removal.observe(document.body,{childList:true,subtree:true});
 mounted.set(overlay,{stage,results,cleanup});
 window.addEventListener('pagehide',cleanup,{once:true});
}
function scan(){const overlay=document.getElementById('mv88Reveal');if(overlay)decorate(overlay)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
function start(){scan();const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true})}
})();