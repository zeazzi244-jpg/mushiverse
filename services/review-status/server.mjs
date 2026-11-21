import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {readReviewStatus} from './status.mjs';

const server = new McpServer({name:'mushiverse-operations', version:'1.0.0'});
server.registerTool('review_status', {
  description:'ムシバースのiOSビルドとガチャコイン100のApple審査状況を取得します。',
  annotations:{readOnlyHint:true,openWorldHint:true},
}, async () => ({content:[{type:'text',text:JSON.stringify(await readReviewStatus())}]}));
await server.connect(new StdioServerTransport());
