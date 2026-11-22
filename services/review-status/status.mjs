import {appleCoinPacks} from '../../supabase/functions/_shared/apple-coin-transaction-policy.mjs';
import {apple} from '../../scripts/restore-ios-signing.mjs';

export async function readReviewStatus(get = apple) {
  const app = '6826061606';
  const productIds = Object.keys(appleCoinPacks);
  const productsQuery = new URLSearchParams({
    'filter[productId]': productIds.join(','),
    limit: '50',
  });
  const [versions, iap] = await Promise.all([
    get('apps/'+app+'/appStoreVersions?filter[platform]=IOS&limit=5'),
    get('apps/'+app+'/inAppPurchasesV2?'+productsQuery),
  ]);
  if (!Array.isArray(iap.data) || iap.links?.next) throw Error('Incomplete in-app purchase status');
  const states = new Map(iap.data.map(({attributes}) => [attributes.productId, attributes.state]));
  const products = productIds.map(id => ({id, status:states.get(id) ?? 'NOT_REGISTERED'}));
  const releases = await Promise.all(versions.data.map(async version => {
    const build = await get('appStoreVersions/'+encodeURIComponent(version.id)+'/build');
    return {version:version.attributes.versionString, status:version.attributes.appStoreState, build:build.data?.attributes?.version ?? null};
  }));
  return {checkedAt:new Date().toISOString(), releases, product:products.find(({id}) => id === 'mushiverse.coins.100'), products};
}
