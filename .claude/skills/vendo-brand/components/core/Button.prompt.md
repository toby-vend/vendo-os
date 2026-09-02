Vendo's primary action control — a fully-rounded mint pill on dark, with secondary (outlined), ghost (text) and danger variants.

```jsx
<Button variant="primary" onClick={save}>Primary Button</Button>
<Button variant="secondary">Secondary Button</Button>
<Button variant="ghost" size="sm" iconLeft={<Icon name="search" size={16} />}>Filter</Button>
```

- `variant`: `primary` (mint fill, dark label, glow on hover) · `secondary` (hairline border → mint on hover) · `ghost` · `danger`.
- `size`: `sm` · `md` · `lg`. `full` stretches to container width.
- Pair with `Icon` for `iconLeft` / `iconRight`. Labels are Title Case, short, action-first.
