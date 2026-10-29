// Read-only integration of the fictional master. Legacy nature cards/wallets never migrate here.
export function canonicalCards(value){
 if(value?.schema_version!==1||!Array.isArray(value.cards)||value.cards.length!==100)throw Error('invalid_catalog');
 const ids=new Set(),names=new Set();
 for(const c of value.cards){const n=Number(c?.id?.slice(3)),rarity=n<=40?'N':n<=70?'R':n<=90?'SR':'SSR';if(!/^AI-\d{3}$/.test(c?.id)||n<1||n>100||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||names.has(c.name.trim())||c.rarity!==rarity||c.fictional!==true||!['pending','review','approved'].includes(c.art_status))throw Error('invalid_catalog');ids.add(c.id);names.add(c.name.trim())}
 return value.cards;
}
export function ownedByID(value,catalog){
 const ids=new Set(catalog.map(c=>c.id)),counts=new Map();const entries=Array.isArray(value)?value:Array.isArray(value?.cards)?value.cards:[];
 for(const entry of entries){const id=typeof entry==='string'?entry:entry?.id;if(ids.has(id))counts.set(id,(counts.get(id)||0)+1)}return counts;
}
const storageKey=()=> 'mushiverse-ai-collection-v1:'+(window.user?.id?'user:'+window.user.id:'guest');
function start(){
 const host=document.getElementById('collection');if(!host||document.getElementById('aiInsectCollection'))return;
 const panel=document.createElement('details');panel.id='aiInsectCollection';
 panel.innerHTML='<summary>🧬 AI昆虫100種の図鑑（準備中）</summary><p>架空の昆虫カードの開発中図鑑です。画像は未承認・ガチャは未接続です。採集記録や既存のカード・コインは変更しません。</p><div class="aiTools"><label>名前・IDで検索<input id="aiInsectSearch" type="search" placeholder="AI-005・名前" /></label><label>レア度<select id="aiInsectRarity"><option value="ALL">すべて</option><option>N</option><option>R</option><option>SR</option><option>SSR</option></select></label></div><p id="aiInsectStatus" role="status">図鑑を開くと読み込みます。</p><div id="aiInsectCards"></div>';
 host.append(panel);let catalog=null,loading=false;
 const status=panel.querySelector('#aiInsectStatus'),list=panel.querySelector('#aiInsectCards'),search=panel.querySelector('input'),select=panel.querySelector('select');
 function render(){
  if(!catalog)return;let counts;try{counts=ownedByID(JSON.parse(localStorage.getItem(storageKey())||'[]'),catalog)}catch{status.textContent='所持データを読み込めません。保存データは変更していません。';list.replaceChildren();return}
  const q=search.value.trim().toLocaleLowerCase('ja'),found=catalog.filter(c=>(select.value==='ALL'||c.rarity===select.value)&&(c.name.toLocaleLowerCase('ja').includes(q)||c.id.toLowerCase().includes(q)));
  status.textContent=found.length+' / 100種類 · 所持 '+counts.size+'種類 · 画像承認 '+catalog.filter(c=>c.art_status==='approved').length+' / 100（ガチャ未接続）';
  list.replaceChildren(...found.map(c=>{const card=document.createElement('article');card.dataset.cardId=c.id;card.className='aiCard ai-'+c.rarity;const id=document.createElement('small');id.textContent=c.id+' · '+c.rarity;const art=document.createElement('div');art.className='aiPlaceholder';art.textContent=c.art_status==='approved'?'画像の接続準備中':'画像未承認';const title=document.createElement('h3');title.textContent=c.name;const owned=document.createElement('p');owned.textContent='所持 '+(counts.get(c.id)||0)+'枚';card.append(id,art,title,owned);return card}));
 }
 async function load(){if(catalog){render();return}if(loading)return;loading=true;status.textContent='読み込み中…';try{const r=await fetch(new URL('../docs/ai_insect_catalog_v1.json',import.meta.url));if(!r.ok)throw Error('unavailable');catalog=canonicalCards(await r.json());render()}catch{status.textContent='AI図鑑を読み込めません。閉じて開くと再試行します。'}finally{loading=false}}
 panel.addEventListener('toggle',()=>{if(panel.open)void load()});search.addEventListener('input',render);select.addEventListener('change',render);
 document.addEventListener('mushiverse:auth-changed',()=>{search.value='';select.value='ALL';render()});window.addEventListener('storage',e=>{if(e.key===storageKey()||e.key===null)render()});
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()}
