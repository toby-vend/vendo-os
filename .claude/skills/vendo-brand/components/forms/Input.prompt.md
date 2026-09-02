Dark text input. Mint focus ring, optional label, leading icon and error state.

```jsx
<Input label="Work email" type="email" placeholder="you@company.com" />
<Input icon={<Icon name="search" size={16} />} placeholder="Search clients…" />
<Input label="Budget" error="Required" />
```

- `label`, `hint`, `error`, `icon` are all optional. Passes through native input props.
