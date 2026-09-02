Surface container. `glass` (translucent + 40px blur + hairline) is the product-dashboard register; `solid` is the sage marketing panel.

```jsx
<Card variant="glass" hover>
  <h3>Channel performance</h3>
</Card>
<Card variant="solid" padding="var(--space-6)">…</Card>
```

- `variant`: `glass` · `solid` · `bare`. `hover` lifts border + shadow.
- Radius is always `--radius-lg` (20px). No coloured left-border accents.
