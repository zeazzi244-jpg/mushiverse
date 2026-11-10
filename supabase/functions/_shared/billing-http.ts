// Bearer-authenticated API: no ambient cookies or credentialed cross-origin requests.
export const billingHeaders = {
 'access-control-allow-origin':'*',
 'access-control-allow-headers':'authorization, x-client-info, apikey, content-type',
 'access-control-allow-methods':'POST, OPTIONS',
 'cache-control':'no-store',
};
export function billingJSON(data:Record<string,unknown>,status:number){
 return new Response(JSON.stringify(data),{status,headers:{...billingHeaders,'content-type':'application/json; charset=utf-8'}});
}
export const billingPreflight=()=>new Response(null,{status:204,headers:billingHeaders});
