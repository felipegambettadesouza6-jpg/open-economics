# Install Open Economics in Cline

Open Economics is a hosted, read-only MCP server. It requires no API key,
account, environment variables, package installation, or local process.

In Cline, open **MCP Servers → Remote Servers**, then use:

- **Server name:** `open-economics`
- **Server URL:** `https://open-economics-data.knbf982hkn.chatgpt.site/api/mcp`
- **Transport:** `Streamable HTTP`

For manual configuration, add this entry to Cline's MCP settings JSON:

```json
{
  "mcpServers": {
    "open-economics": {
      "type": "streamableHttp",
      "url": "https://open-economics-data.knbf982hkn.chatgpt.site/api/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

After saving, confirm that Cline shows 19 tools. Start with
`search_official_data` when the exact official dataset is unknown.

