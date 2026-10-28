import {billingJSON as json,billingPreflight} from './billing-http.ts';
import { readJSONBody, type AuthenticatedAccount } from './apple-credit-handler.ts';

export function createPaidDrawHandler(deps: {
  authenticate: (bearer: string) => Promise<AuthenticatedAccount | null>;
  enabled: () => boolean; environment: () => string;
  draw: (drawID: string, count: number, account: AuthenticatedAccount, environment: string) => Promise<Record<string, unknown>>;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return billingPreflight();
    if (request.method !== 'POST') return json({error:'method_not_allowed'},405);
    const bearer=request.headers.get('authorization')??'';
    if (bearer.length>8192||!/^Bearer\s+\S+$/i.test(bearer)) return json({error:'unauthorized'},401);
    try {
      const account=await deps.authenticate(bearer);if(!account)return json({error:'unauthorized'},401);
      if(!deps.enabled())return json({error:'paid_draws_disabled'},503);
      const environment=deps.environment();if(!['Sandbox','Production'].includes(environment))return json({error:'unavailable'},503);
      let body: Record<string, unknown>;
      try{body=await readJSONBody(request,5000,1024)}catch{return json({error:'invalid_request'},400)}
      if(typeof body.draw_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.draw_id)||![1,10].includes(body.count as number))return json({error:'invalid_draw'},400);
      const current=await deps.authenticate(bearer);
      if(!current||current.id!==account.id||current.sessionID!==account.sessionID)return json({error:'unauthorized'},401);
      if(!deps.enabled())return json({error:'paid_draws_disabled'},503);
      // Ignore any caller supplied user_id, cost, environment, balance, rarity or result.
      const result=await deps.draw(body.draw_id,body.count as number,current,environment);
      if(result.ok===false){
        if(!['refund_review_required','insufficient_balance'].includes(result.reason as string))return json({error:'draw_unavailable'},503);
        return json({error:result.reason},409);
      }
      if(result.ok!==true||!Array.isArray(result.results))return json({error:'draw_unavailable'},503);
      return json({...result,draw_id:body.draw_id,count:body.count,environment},200);
    }catch{return json({error:'draw_unavailable'},503)}
  };
}
