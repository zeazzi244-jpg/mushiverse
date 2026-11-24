/* Deluxe reveal layer. Effects only: cannot charge, select rarities or change rewards. */
(()=>{'use strict';
const tr=(ja,en)=>document.documentElement.lang==='en'?en:ja;
const CSS=`
#mv88Reveal{--deluxe:#7affe3}
#mv88Reveal[data-variant="0"]{--deluxe:#86ffb1}
#mv88Reveal[data-variant="1"]{--deluxe:#9ad6ff}
#mv88Reveal[data-variant="2"]{--deluxe:#ffc677}
#mv88Reveal[data-variant="3"]{--deluxe:#c3b5ff}
#mv88Reveal.mv88-R{--deluxe:#73c6ff}
#mv88Reveal.mv88-SR{--deluxe:#e4a6ff}
#mv88Reveal.mv88-SSR{--deluxe:#ffe58b}
#mv88Reveal .mvDeluxeBackdrop{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:-1;background:radial-gradient(ellipse 70% 50% at 50% 56%,color-mix(in srgb,var(--deluxe) 21%,transparent),transparent 70%)}
#mv88Reveal .mvDeluxeBackdrop::before,#mv88Reveal .mvDeluxeBackdrop::after{content:"";position:absolute;inset:-80%;background:repeating-conic-gradient(from 0deg,transparent 0 16deg,color-mix(in srgb,var(--deluxe) 20%,transparent) 17deg 19deg,transparent 21deg 36deg);animation:mvDeluxeSpin 35s linear infinite}
#mv88Reveal .mvDeluxeBackdrop::after{animation-direction:reverse;animation-duration:22s;opacity:.35;filter:blur(18px)}
#mv88Reveal .mvDeluxeChapter{position:relative;margin:0 auto 12px;max-width:390px;display:flex;align-items:center;justify-content:center;gap:8px;z-index:2}
#mv88Reveal .mvDeluxeChapter span{width:22px;height:5px;display:block;border-radius:10px;background:#ffffff40;transition:width .35s ease,background .35s ease;box-shadow:0 0 0 transparent}
#mv88Reveal .mvDeluxeChapter span.mvDeluxeActive{width:64px;background:var(--deluxe);box-shadow:0 0 15px var(--deluxe)}
#mv88Reveal .mvDeluxeChapter span.mvDeluxeDone{background:#dafbdf}
#mv88Reveal .mvDeluxeSceneLabel{font-weight:900;font-size:clamp(13px,3.4vw,17px);letter-spacing:.12em;color:var(--deluxe);text-shadow:0 0 18px var(--deluxe);text-align:center;min-height:1.7em;margin:0 auto 12px}
#mv88Reveal .mvDeluxePortal{position:absolute;inset:10% 2%;border-radius:50%;pointer-events:none;box-shadow:inset 0 0 85px color-mix(in srgb,var(--deluxe) 20%,transparent);background:repeating-conic-gradient(from 0deg,transparent 0deg 25deg,color-mix(in srgb,var(--deluxe) 24%,transparent) 26deg 27deg,transparent 28deg 44deg);-webkit-mask-image:radial-gradient(ellipse,transparent 20%,black 48%,transparent 71%);mask-image:radial-gradient(ellipse,transparent 20%,black 48%,transparent 71%);animation:mvDeluxeSpin 14s linear infinite;z-index:0}
#mv88Reveal .mvDeluxeGlyphs{position:absolute;inset:0;pointer-events:none;z-index:1}
#mv88Reveal .mvDeluxeGlyph{position:absolute;left:var(--lx);top:var(--ly);font-size:var(--fs);color:var(--deluxe);filter:drop-shadow(0 0 8px var(--deluxe));opacity:.8;animation:mvDeluxeRune var(--dur) ease-in-out var(--delay) infinite alternate}
#mv88Reveal .mvDeluxeCapsuleGlow{position:absolute;width:clamp(155px,50vw,250px);aspect-ratio:1;border-radius:50%;top:50%;left:50%;transform:translate(-50%,-55%);pointer-events:none;z-index:1;background:radial-gradient(circle,#ffffff77 0%,color-mix(in srgb,var(--deluxe) 80%,transparent) 12%,transparent 67%);filter:blur(25px);animation:mvDeluxePulse 1.2s ease-in-out infinite alternate}
#mv88Reveal[data-phase="3"] .mvDeluxePortal{animation-duration:3s;filter:brightness(1.7)}
#mv88Reveal.mv103Rare .mvDeluxeBackdrop{filter:saturate(1.6)}
#mv88Reveal .mvDeluxeFinal{font-weight:1000;letter-spacing:.1em;font-size:clamp(16px,5vw,27px);margin:10px auto;color:#fff1c0;text-shadow:0 0 22px var(--deluxe);text-align:center;animation:mvDeluxeFinal .55s ease-out both}
#mv88Reveal.mv88-SSR .mvDeluxeFinal{background:linear-gradient(115deg,#fff7c4,#f7c04c,#fff,#e3ae47);background-clip:text;-webkit-background-clip:text;color:transparent}
#mv88Reveal .mvDeluxeResultCount{font-weight:750;color:#d3ede2;letter-spacing:.08em;font-size:13px;margin:5px 0 10px}
#mv88Reveal .mvDeluxeSpotlight{position:fixed;inset:0;background:radial-gradient(circle at 50% 40%,#ffffffdb 0%,color-mix(in srgb,var(--deluxe) 45%,transparent) 25%,transparent 65%);pointer-events:none;z-index:10;animation:mvDeluxeFlash .85s ease-out forwards}
#mv88Reveal .mv88Results .mv88Card{transform-origin:50% 90%;backface-visibility:hidden}
#mv88Reveal .mv88Results .mv88Card:focus-visible{outline:3px solid #fff}
#mv88Reveal .mv88Results .mv88Card-SSR{background:linear-gradient(135deg,#462f0b,#6f4d12,#100e05);border-width:3px}
#mv88Reveal .mv88Results .mv88Card-SR{background:linear-gradient(135deg,#34204a,#271739,#0b0a1e)}
#mv88Reveal .mv88Results .mv88Card-R{background:linear-gradient(135deg,#113e57,#0e2135)}
#mv88Reveal .mv88Results .mv88Card-N{background:linear-gradient(135deg,#193a31,#0d2520)}
#mv88Reveal .mv88Results .mv88Card>strong{position:relative;z-index:2}
#mv88Reveal .mv88Results .mv88Card::after{content:"✦";position:absolute;right:9px;top:5px;color:#ffe9a9;opacity:.5}
#mv88Reveal .mv88Results .mv88Card-SSR::after{content:"✦ LEGEND ✦";font-size:10px;letter-spacing:.04em;opacity:1}
@keyframes mvDeluxeSpin{to{transform:rotate(360deg)}}
@keyframes mvDeluxeRune{from{opacity:.15;transform:translateY(8px) rotate(-15deg) scale(.75)}to{opacity:1;transform:translateY(-15px) rotate(15deg) scale(1.25)}}
@keyframes mvDeluxePulse{to{filter:blur(40px) brightness(1.5);opacity:.65}}
@keyframes mvDeluxeFinal{from{opacity:0;transform:translateY(30px) scale(.7)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes mvDeluxeFlash{0%{opacity:.95}100%{opacity:0}}
@media(prefers-reduced-motion:reduce){#mv88Reveal .mvDeluxeBackdrop::before,#mv88Reveal .mvDeluxeBackdrop::after,#mv88Reveal .mvDeluxePortal,#mv88Reveal .mvDeluxeGlyph,#mv88Reveal .mvDeluxeCapsuleGlow,#mv88Reveal .mvDeluxeFinal,#mv88Reveal .mvDeluxeSpotlight{animation:none!important}#mv88Reveal .mvDeluxeSpotlight{display:none}#mv88Reveal .mvDeluxeChapter span{transition:none}}
`;
function build(overlay){
 if(overlay.dataset.deluxeReady)return;
 overlay.dataset.deluxeReady='1';
 const inner=overlay.querySelector('.mv88Inner');
 const stage=overlay.querySelector('.mv88Stage');
 const result=overlay.querySelector('.mv88Results');
 const title=overlay.querySelector('.mv88Title');
 if(!inner||!stage||!result||!title)return;
 const reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const backdrop=document.createElement('div');backdrop.className='mvDeluxeBackdrop';backdrop.setAttribute('aria-hidden','true');overlay.prepend(backdrop);
 const chapter=document.createElement('div');chapter.className='mvDeluxeChapter';chapter.setAttribute('aria-hidden','true');
 for(let i=0;i<3;i++){const dot=document.createElement('span');chapter.append(dot)}
 title.after(chapter);
 const label=document.createElement('div');label.className='mvDeluxeSceneLabel';label.setAttribute('aria-live','off');chapter.after(label);
 const portal=document.createElement('div');portal.className='mvDeluxePortal';portal.setAttribute('aria-hidden','true');stage.prepend(portal);
 const glow=document.createElement('div');glow.className='mvDeluxeCapsuleGlow';glow.setAttribute('aria-hidden','true');stage.prepend(glow);
 if(!reduced){
  const glyphs=document.createElement('div');glyphs.className='mvDeluxeGlyphs';glyphs.setAttribute('aria-hidden','true');
  for(let i=0;i<12;i++){
   const p=document.createElement('span');p.className='mvDeluxeGlyph';p.textContent=i%3===0?'✧':i%3===1?'✦':'✳';
   p.style.setProperty('--lx', (5+(i*47)%86)+'%');p.style.setProperty('--ly',(7+(i*29)%74)+'%');
   p.style.setProperty('--fs',(12+(i%5)*5)+'px');
   p.style.setProperty('--dur',(1.5+(i%4)*.45)+'s');
   p.style.setProperty('--delay',(-i*.22)+'s');glyphs.append(p);
  }
  stage.prepend(glyphs);
 }
 const final=document.createElement('div');final.className='mvDeluxeFinal';final.hidden=true;
 const count=document.createElement('div');count.className='mvDeluxeResultCount';count.hidden=true;
 result.before(final,count);
 let completed=false,seenPhase='',revealTimer=null;
 const rootObserver=new MutationObserver(sync);
 function sync(){
  const done=!result.hidden;
  const phase=overlay.dataset.phase||'0';
  if(done){
   if(completed)return;completed=true;
   const cards=[...result.querySelectorAll('.mv88Card')];
   const rarity=cards.some(x=>x.classList.contains('mv88Card-SSR'))?'SSR':cards.some(x=>x.classList.contains('mv88Card-SR'))?'SR':cards.some(x=>x.classList.contains('mv88Card-R'))?'R':'N';
   final.textContent=rarity==='SSR'?tr('✦ 幻の存在、降臨 ✦','✦ A legendary presence awakens ✦'):rarity==='SR'?tr('✦ 希少な輝きを発見 ✦','✦ A rare brilliance discovered ✦'):cards.length===10?tr('✦ 10連召喚、完了 ✦','✦ Ten summons complete ✦'):tr('✦ 新たな仲間を発見 ✦','✦ A new companion discovered ✦');
   count.textContent=tr(cards.length+'枚のカードを獲得',cards.length+(cards.length===1?' card obtained':' cards obtained'));
   final.hidden=false;count.hidden=false;chapter.hidden=true;label.hidden=true;
   if(!reduced){
    const flash=document.createElement('div');flash.className='mvDeluxeSpotlight';flash.setAttribute('aria-hidden','true');overlay.append(flash);
    flash.addEventListener('animationend',()=>flash.remove(),{once:true});
   }
   return;
  }
  if(phase===seenPhase)return;seenPhase=phase;
  chapter.hidden=false;label.hidden=false;
  const current=Math.min(3,Math.max(1,Number(phase)||1));
  [...chapter.children].forEach((dot,i)=>{dot.className=i+1<current?'mvDeluxeDone':i+1===current?'mvDeluxeActive':''});
  label.textContent=current===1?tr('Ⅰ · 森の扉、起動','Ⅰ · The forest gate opens'):current===2?tr('Ⅱ · 星のエネルギー集中','Ⅱ · Starlight gathers'):tr('Ⅲ · 幻想昆虫の羽化','Ⅲ · A mythical insect emerges');
 }
 rootObserver.observe(overlay,{subtree:true,attributes:true,attributeFilter:['data-phase','hidden'],childList:true});
 sync();
 const cleanObserver=new MutationObserver(()=>{if(!overlay.isConnected){cleanObserver.disconnect();rootObserver.disconnect();if(revealTimer)clearTimeout(revealTimer)}});
 cleanObserver.observe(document.body,{childList:true});
}
function start(){
 let obs;
 function scan(){const overlay=document.getElementById('mv88Reveal');if(overlay)build(overlay)}
 scan();obs=new MutationObserver(scan);obs.observe(document.body,{childList:true});
 window.addEventListener('pagehide',()=>obs.disconnect(),{once:true});
}
const s=document.createElement('style');s.id='mvDeluxeEffects';s.textContent=CSS;document.head.append(s);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
