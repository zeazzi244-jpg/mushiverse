import {apple} from '../../scripts/restore-ios-signing.mjs';

export async function readReviewStatus(get = apple) {
  const app = '6826061606';
  const product = '6837059684';
  const [versions, iap] = await Promise.all([
    get('apps/'+app+'/appStoreVersions?filter[platform]=IOS&limit=5'),
    get('apps/'+app+'/inAppPurchasesV2?filter[productId]=mushiverse.coins.100'),
  ]);
  const item = iap.data.find(entry => entry.id === product);
  if (item?.attributes?.productId !== 'mushiverse.coins.100') throw Error('Unexpected product');
  const releases = await Promise.all(versions.data.map(async version => {
    const build = await get('appStoreVersions/'+encodeURIComponent(version.id)+'/build');
    return {version:version.attributes.versionString, status:version.attributes.appStoreState, build:build.data?.attributes?.version ?? null};
  }));
  return {checkedAt:new Date().toISOString(), releases, product:{id:item.attributes.productId,status:item.attributes.state}};
}
