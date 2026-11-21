import { McpServer } from "npm:@modelcontextprotocol/sdk@1.26.0/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.26.0/server/webStandardStreamableHttp.js";
import { z } from "npm:zod@3.25.76";
import cards from "./cards.json" with { type: "json" };

Deno.serve(async (req) => {
  const server = new McpServer({ name: "mushiverse-guide", version: "1.0.0" });
  server.registerTool("search_insects", {
    description: "ムシバースの架空昆虫カードを名前・レア度・生息地で探し、公開画像のURLを返します。",
    inputSchema: { query: z.string().trim().min(1).max(100), offset: z.number().int().nonnegative().default(0) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ query, offset }) => {
    const normalize = (s: string) => s.normalize("NFKC").toLowerCase();
    const words = normalize(query).split(/\s+/);
    const matches = cards.filter(card => {
      const fields = [card.name, card.id, card.rarity, card.habitat].map(normalize);
      return words.every(word => fields.some(field => field.includes(word)));
    });
    return { content: [{ type: "text", text: JSON.stringify({ total: matches.length, offset, cards: matches.slice(offset, offset + 10) }) }] };
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
});
