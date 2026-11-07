const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createPaidDrawController({storage,getUserID,transport,enabled,environment='Production',randomUUID=()=>crypto.randomUUID(),withLock}){
 let busy=false;
 const key=id=>'mushiverse-paid-draw-pending-v1:'+environment+':'+id;
 function pending(id=getUserID()){
  if(!id)return null;const text=storage.getItem(key(id));if(!text)return null;
  const value=JSON.parse(text);if(!value||!uuid.test(value.draw_id)||![1,10].includes(value.count))throw Error('invalid_pending_draw');return value;
 }
 return {pending,async draw(count){
  if(!enabled())throw Error('paid_draws_disabled');if(busy)throw Error('draw_in_progress');
  if(![1,10].includes(count)||!['Sandbox','Production'].includes(environment))throw Error('invalid_draw');
  const id=getUserID();if(!id)throw Error('unauthorized');if(!withLock)throw Error('locking_unavailable');
  busy=true;
  try{return await withLock(key(id),async()=>{
   if(getUserID()!==id)throw Error('account_changed');
   let operation=pending(id);if(operation&&operation.count!==count)throw Error('pending_draw_exists');
   if(!operation){operation={draw_id:randomUUID(),count};if(!uuid.test(operation.draw_id))throw Error('invalid_draw_id');storage.setItem(key(id),JSON.stringify(operation))}
   // Persist before sending, so a lost response can only replay the same draw ID.
   const response=await transport(operation,id);
   if(getUserID()!==id)throw Error('account_changed');
   if(response.status===409&&['insufficient_balance','refund_review_required'].includes(response.data?.error)){
    storage.removeItem(key(id));throw Error(response.data.error);
   }
   const data=response.data;
   if(response.status!==200||data?.ok!==true||data.draw_id!==operation.draw_id||data.count!==count||data.environment!==environment||!Number.isSafeInteger(data.balance)||data.balance<0||!Array.isArray(data.results)||data.results.length!==count)throw Error('draw_confirmation_pending');
   for(const card of data.results){const expected=card?.card_id<=40?'N':card?.card_id<=70?'R':card?.card_id<=90?'SR':'SSR';if(!Number.isInteger(card?.card_id)||card.card_id<1||card.card_id>100||card.catalog_version!==1||card.rarity!==expected)throw Error('invalid_draw_results')}
   storage.removeItem(key(id));return data;
  })}finally{busy=false}
 }};
}
