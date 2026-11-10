// Read-only integration of the fictional master. Legacy nature cards/wallets never migrate here.
export function canonicalCards(value){
 if(value?.schema_version!==1||!Array.isArray(value.cards)||value.cards.length!==100)throw Error('invalid_catalog');
 const ids=new Set(),names=new Set();
 for(const c of value.cards){const n=typeof c?.id==='string'?Number(c.id.slice(3)):NaN,rarity=n<=40?'N':n<=70?'R':n<=90?'SR':'SSR';if(!/^AI-\d{3}$/.test(c?.id)||n<1||n>100||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||names.has(c.name.trim())||c.rarity!==rarity||c.fictional!==true||!['pending','review','approved'].includes(c.art_status))throw Error('invalid_catalog');ids.add(c.id);names.add(c.name.trim())}
 return value.cards;
}
export function ownedByID(value,catalog){
 const ids=new Set(catalog.map(c=>c.id)),counts=new Map();const entries=Array.isArray(value)?value:Array.isArray(value?.cards)?value.cards:[];
 for(const entry of entries){const id=typeof entry==='string'?entry:entry?.id;if(ids.has(id))counts.set(id,(counts.get(id)||0)+1)}return counts;
}
const storageKey=()=> 'mushiverse-ai-collection-v1:'+(window.user?.id?'user:'+window.user.id:'guest');
function start(){
 const host=document.getElementById('mv90Gacha');if(!host||document.getElementById('aiInsectCollection'))return;
 const panel=document.createElement('details');panel.id='aiInsectCollection';
 panel.innerHTML='<summary>所持しているAI昆虫カード</summary><p>ガチャで獲得したカードだけが表示されます。</p><div class="aiTools"><label>名前・IDで検索<input id="aiInsectSearch" type="search" placeholder="AI-005・名前" /></label><label>レア度<select id="aiInsectRarity"><option value="ALL">すべて</option><option>N</option><option>R</option><option>SR</option><option>SSR</option></select></label></div><p id="aiInsectStatus" role="status">図鑑を開くと読み込みます。</p><div id="aiInsectCards"></div>';
 panel.open=true;host.append(panel);let catalog=null,loading=false;
 const walletKey=()=> 'mushiverse-v77-game:'+(window.user?.id?'user:'+window.user.id:'guest');
 const catalogURL=new URL('../docs/ai_insect_catalog_v1.json',import.meta.url);
 async function fetchCatalog(){const response=await fetch(catalogURL);if(!response.ok)throw Error('unavailable');return canonicalCards(await response.json())}
 function prepareDrawPool(cards){
  if(cards.some(c=>c.art_status==='pending'))return;
  const pool=Object.fromEntries(['N','R','SR','SSR'].map(r=>[r,Object.freeze(cards.filter(c=>c.rarity===r).map(c=>Object.freeze({id:c.id,name:c.name})))]));
  Object.defineProperty(window,'MushiverseIllustratedCards',{value:Object.freeze(pool)});
 }
 document.addEventListener('mushiverse:gacha-drawn',render);
 const status=panel.querySelector('#aiInsectStatus'),list=panel.querySelector('#aiInsectCards'),search=panel.querySelector('input'),select=panel.querySelector('select');
 function render(){
  if(!catalog)return;let counts;try{counts=ownedByID(JSON.parse(localStorage.getItem(storageKey())||'[]'),catalog);for(const [id,n] of ownedByID(JSON.parse(localStorage.getItem(walletKey())||'{}'),catalog))counts.set(id,(counts.get(id)||0)+n)}catch{status.textContent='所持データを読み込めません。保存データは変更していません。';list.replaceChildren();return}
  const q=search.value.trim().toLocaleLowerCase('ja'),found=catalog.filter(c=>counts.has(c.id)&&(select.value==='ALL'||c.rarity===select.value)&&(c.name.toLocaleLowerCase('ja').includes(q)||c.id.toLowerCase().includes(q)));
  status.textContent='所持 '+counts.size+'種類 / '+catalog.length+'種類';
  if(!found.length){const empty=document.createElement('p');empty.textContent=counts.size?'条件に一致する所持カードがありません。':'まだカードを持っていません。ガチャで獲得したカードがここに表示されます。';list.replaceChildren(empty);return}
  list.replaceChildren(...found.map(c=>{const card=document.createElement('article');card.dataset.cardId=c.id;card.className='aiCard ai-'+c.rarity;const id=document.createElement('small');id.textContent=c.id+' · '+c.rarity;const art=document.createElement('div');art.className='aiPlaceholder';art.textContent='画像準備中';if(c.art_status!=='pending'){const img=document.createElement('img');img.src=new URL('./ai-insects/'+c.id+'.webp',import.meta.url).href;img.alt=c.name;img.loading='lazy';img.width=480;img.height=720;img.style.cssText='display:block;width:100%;height:auto';art.style.padding='0';img.addEventListener('error',()=>{art.textContent='画像を読み込めませんでした'},{once:true});art.replaceChildren(img)}const title=document.createElement('h3');title.textContent=c.name;const owned=document.createElement('p');owned.textContent='所持 '+(counts.get(c.id)||0)+'枚';card.append(id,art,title,owned);return card}));
 }
 async function load(){if(catalog){render();return}if(loading)return;loading=true;status.textContent='読み込み中…';try{catalog=await fetchCatalog();prepareDrawPool(catalog);render()}catch{status.textContent='AI図鑑を読み込めません。ガチャまたはAI昆虫カードのタブを開き直すと再試行します。'}finally{loading=false}}
 document.getElementById('mv90GachaTab')?.addEventListener('click',()=>{panel.open=true;void load()});
 document.querySelector('nav.nav [data-tab="gacha"]')?.addEventListener('click',()=>{if(!catalog)void load()});
 window.addEventListener('online',()=>{if(!catalog)void load()});
 panel.addEventListener('toggle',()=>{if(panel.open)void load()});search.addEventListener('input',render);select.addEventListener('change',render);
 document.addEventListener('mushiverse:auth-changed',()=>{search.value='';select.value='ALL';render()});window.addEventListener('storage',e=>{if(e.key===storageKey()||e.key===walletKey()||e.key===null)render()});
 void load();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}
