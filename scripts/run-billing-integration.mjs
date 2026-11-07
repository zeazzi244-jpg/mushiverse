// Only the disposable stack in staging/supabase/config.toml is supported.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const cli=process.env.SUPABASE_BIN||'supabase';
const config=readFileSync('staging/supabase/config.toml','utf8');
if(!config.includes('project_id = "mushiverse-billing-integration"'))throw Error('unexpected_local_project');
const status=JSON.parse(execFileSync(cli,['--workdir','staging','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const url=new URL(status.API_URL);
if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.port!=='54321')throw Error('integration_requires_loopback_stack');
if(!status.ANON_KEY||!status.SERVICE_ROLE_KEY)throw Error('local_credentials_unavailable');
execFileSync('docker',['exec','-i','supabase_db_mushiverse-billing-integration','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:readFileSync('supabase/sql/coin-wallet-v2.sql'),stdio:['pipe','ignore','pipe']});
// Only child-process memory receives disposable keys; no env file, console or artifact.
const result=spawnSync('npx',['--no-install','deno','test','--no-config','--node-modules-dir=manual','--allow-env=SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY','--allow-net=127.0.0.1:54321','tests/integration/billing.test.ts'],{
 stdio:'inherit',env:{...process.env,SUPABASE_URL:status.API_URL,SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY},
});process.exitCode=result.status??1;
