KPI / metric tile — the "results" pattern. Oversized mint number, uppercase muted label, optional up-and-to-the-right delta.

```jsx
<StatCard value="200%" label="Traffic Increase" delta="+34%" />
<StatCard value="£23.8K" label="Ad Spend (30d)" breakdown="Meta £14.2k · Google £9.6k" />
```

- `value` carries the visual weight (mint, 40px, weight 800). `label` is UPPERCASE.
- `delta` + `deltaTone` show a coloured arrow chip. `breakdown` adds a secondary line.
- `variant`: `glass` (product) · `solid` (marketing).
