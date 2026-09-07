# Open Economics real-demand benchmark

This benchmark measures how much realistic Brazilian economic-information
demand Open Economics can satisfy. It is intentionally not generated from the
current Open Economics catalog.

## Independence rules

- Demand concepts may not reference Open Economics indicator IDs.
- A missing implementation remains a valid benchmark case; it is never removed
  merely to improve the score.
- Official institutions are provenance constraints, not roadmap buckets.
- Coverage work is prioritized by weighted benchmark lift, semantic risk,
  reliability, and maintenance cost.
- Scores are reported by underlying demand case and domain. Rephrasing the same
  need cannot make weak coverage look broad.
- Boundary cases reward explicit limitations rather than fabricated forecasts,
  causal claims, or silently substituted data.

The first version contains 96 independently selected concepts with six real
workflows each, 96 manually written discovery holdouts that are never indexed,
plus 24 complex cross-source, multidimensional, vintage, and boundary cases:
696 tasks in total. Portuguese and English prompts represent
citizens, developers, economists, journalists, businesses, and policymakers.

## What is graded

1. **Discovery:** the correct concept appears at rank 1 and rank 3.
2. **Selection:** frequency, unit, adjustment, geography, dimensions, and
   reference-period semantics match the request.
3. **Retrieval:** requested observations or records are returned without silent
   substitution or invented values.
4. **Meaning:** methodology, stock/flow status, transformations, revisions, and
   comparability caveats are preserved.
5. **Provenance:** official publisher, source identifiers and URLs, reference
   period, release/retrieval timestamps, and freshness state are present.
6. **Reliability:** failures are explicit; stale data and upstream outages are
   distinguishable.
7. **Agent behavior:** MCP tool selection, arguments, follow-up IDs, and compact
   structured results are correct for direct, indirect, and negative prompts.

Primary scores are demand-weighted and macro-averaged by domain. Raw task pass
rate is secondary because large families and generated phrasings must not drown
out smaller but important domains.

## Grounding

The model follows statistical structures used by the IBGE Aggregates API and
SDMX (datasets, measures, dimensions, members, attributes, observations), while
its demand inventory spans official domains exposed by BCB, IBGE, Tesouro,
MTE, MDIC, CVM, energy, agriculture, population, and environmental publishers.
This grounding does not imply that all sources should be implemented, or in any
particular order.

Generate the committed benchmark artifacts with:

```bash
npm run benchmark:generate
```
