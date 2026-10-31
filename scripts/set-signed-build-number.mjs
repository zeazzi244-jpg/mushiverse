import {readFileSync,writeFileSync} from 'node:fs';

// Assign a unique, monotonically increasing CFBundleVersion for signed CI archives.
// The existing TestFlight build 139 must never be overwritten.
export function assignBuildNumber(project, runNumber, attempt) {
 const run=Number(runNumber),retry=Number(attempt);
 if(!Number.isSafeInteger(run)||run<1||!Number.isSafeInteger(retry)||retry<1||retry>=100)throw Error('invalid_ci_run_identity');
 const build=140+run*100+retry;
 if(!Number.isSafeInteger(build)||build>2147483647)throw Error('build_number_out_of_range');
 let count=0;
 const updated=project.replace(/CURRENT_PROJECT_VERSION = [0-9]+;/g,()=>{count++;return 'CURRENT_PROJECT_VERSION = '+build+';'});
 if(count!==2)throw Error('unexpected_xcode_build_settings_count:'+count);
 return {updated,build};
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 const path=process.argv[2]||'ios/App/App.xcodeproj/project.pbxproj';
 const {updated,build}=assignBuildNumber(readFileSync(path,'utf8'),process.env.GITHUB_RUN_NUMBER,process.env.GITHUB_RUN_ATTEMPT);
 writeFileSync(path,updated);console.log('Signed archive build number: '+build);
}
