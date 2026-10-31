import {apple} from './repair-ios-signing.mjs';
const version=process.env.SIGNED_BUILD_NUMBER;
if(!/^\d+$/.test(version||''))throw Error('Missing signed build number');
const apps=await apple('apps?filter%5BbundleId%5D=com.rikuto.mushiverse');
const appID=apps.data?.[0]?.id;
if(!appID)throw Error('App not found');
for(let attempt=0;attempt<18;attempt++){
 const result=await apple('builds?filter%5Bapp%5D='+appID+'&filter%5Bversion%5D='+version+'&limit=10');
 const build=result.data?.[0];
 if(build){
  const state=build.attributes.processingState;
  console.log(JSON.stringify({buildNumber:version,buildID:build.id,processingState:state}));
  if(state==='FAILED'||state==='INVALID')throw Error('Apple processing rejected this build');
  if(state==='VALID'){
   const detail=await apple('builds/'+build.id+'/buildBetaDetail');
   const groups=await apple('builds/'+build.id+'/betaGroups');
   console.log(JSON.stringify({buildNumber:version,betaState:detail.data?.attributes,
    assignedBetaGroups:groups.data?.map(g=>({id:g.id,isInternalGroup:g.attributes?.isInternalGroup})),
    deviceInstallationVerified:false}));
   process.exit(0);
  }
 }else console.log('Build '+version+' not yet visible in App Store Connect');
 await new Promise(resolve=>setTimeout(resolve,20000));
}
console.log('Upload submitted; processing still pending after observation window.');
