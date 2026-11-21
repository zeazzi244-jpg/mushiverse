import {apple} from '../../scripts/restore-ios-signing.mjs';

export async function readReviewStatus(get = apple) {
  const app = '6826061606';
  const product = '6837059684';
  const [versions, iap] = await Promise.all([
    get('apps/'+app+'/appStoreVersions?filter[platform]=IOS&limit=5'),
    get('inAppPurchases/'+product),
  ]);
  if (iap.data?.attributes?.productId !== 'mushiverse.coins.100') throw Error('Unexpected product');
  const releases = await Promise.all(versions.data.map(async version => {
    const build = await get('appStoreVersions/'+encodeURIComponent(version.id)+'/build');
    return {version:version.attributes.versionString, status:version.attributes.appStoreState, build:build.data?.attributes?.version ?? null};
  }));
  return {checkedAt:new Date().toISOString(), releases, product:{id:iap.data.attributes.productId,status:iap.data.attributes.state}};
}
