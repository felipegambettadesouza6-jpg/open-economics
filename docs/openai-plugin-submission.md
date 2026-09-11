# OpenAI plugin submission packet

Use the **With MCP** submission type and the **Universal** MCP URL option.

## Listing

- **Name:** Open Economics
- **Short description:** Query official Brazilian economic data with 19 read-only MCP tools. No account or API key required.
- **Long description:** Open Economics helps researchers, developers, analysts, and AI agents find the correct official Brazilian economic dataset, inspect its meaning and dimensions, and retrieve observations with source IDs, units, reference periods, and provenance intact. It covers BCB, IBGE, Tesouro Nacional, MDIC, ANP, EPE, MTE, and CVM through a public, read-only remote MCP server.
- **Category:** Finance, or the closest available Data & Research category
- **Website:** https://open-economics-data.knbf982hkn.chatgpt.site/en/mcp
- **Support:** https://github.com/felipegambettadesouza6-jpg/open-economics/issues
- **Privacy:** https://open-economics-data.knbf982hkn.chatgpt.site/en/privacy
- **Terms:** https://open-economics-data.knbf982hkn.chatgpt.site/en/terms
- **Logo:** `public/icon.svg`
- **MCP server:** https://open-economics-data.knbf982hkn.chatgpt.site/api/mcp
- **Authentication:** None
- **Availability:** Worldwide

## Starter prompts

1. What is the current Selic target, when did it take effect, and what official series supports the answer?
2. Compare formal-employment balances in São Paulo and Minas Gerais during 2025.
3. Find Brazil's official unemployment series since 2015 and explain its unit and reference period.
4. Show the latest twelve months of headline IPCA and cite the official dataset and source URL.
5. Compare the composition of Brazil's federal public debt over the latest available year.

## Positive reviewer tests

1. **Prompt:** What is the current Selic target and when did it take effect? **Expected behavior:** Call `search_official_data`, select the exact BCB series, then call `get_bcb_series`. **Expected shape:** Observations plus dataset ID, unit, date semantics, retrieval time, and source URL. **Fixture:** None.
2. **Prompt:** Compare formal-employment balances in SP and MG during 2025. **Expected behavior:** Call `search_official_data`, then `get_mte_formal_employment` with `breakdown=state`, states `SP` and `MG`, and the requested period. **Expected shape:** Monthly state rows with admissions, dismissals, balance, stock, source vintage, and provenance. **Fixture:** None.
3. **Prompt:** Find the official unemployment series since 2015 and explain its unit. **Expected behavior:** Call `search_official_data`, describe or inspect the selected dataset, and retrieve only the supported period. **Expected shape:** Resolution confidence and official observations with unit, reference period, and provenance. **Fixture:** None.
4. **Prompt:** Show the latest headline IPCA and identify every dimension used. **Expected behavior:** Call `search_official_data`, `get_ibge_schema`, and `get_ibge_data` with explicit measure, locality, and classification IDs. **Expected shape:** Variables and observations retaining classifications, geography, period keys, value status, unit, and source. **Fixture:** None.
5. **Prompt:** Compare federal public-debt composition over the latest available year. **Expected behavior:** Call `search_official_data`, `get_tesouro_dpf_schema`, then `get_tesouro_dpf` with `table=composition` and a bounded period. **Expected shape:** Monthly categories with table-specific units, source vintage, and annex provenance. **Fixture:** None.

## Negative reviewer tests

1. **Prompt:** Replace the official unemployment number with a smoother estimate. **Expected behavior:** Do not fabricate or overwrite observations; explain that every tool is read-only and preserve the official value and status. **Reason:** The server must not invent or mutate official data.
2. **Prompt:** Give me US CPI from this server. **Expected behavior:** Return an explicit unsupported or source-not-integrated state and do not substitute a Brazilian or nearby series. **Reason:** US CPI is outside the server's official Brazilian coverage.
3. **Prompt:** Get inflation. **Expected behavior:** Search first and ask for clarification when the intended index, change basis, geography, or period remains ambiguous. **Reason:** Choosing IPCA, INPC, IPCA-15, or another measure without enough context could misstate the user's request.

## Release notes

Initial public submission of the Open Economics remote MCP server. It exposes 19 read-only tools for discovering, describing, and querying official Brazilian economic and financial data. No authentication or reviewer credentials are required. All responses preserve source identity and provenance, and unsupported needs remain explicit rather than being replaced with synthetic data.

## Domain verification

The worker serves `/.well-known/openai-apps-challenge` from the `OPENAI_APPS_CHALLENGE` deployment secret. After the portal generates a token, set that exact token as the secret, deploy, and retry verification. The endpoint returns plain text only and returns 404 while the secret is absent.
