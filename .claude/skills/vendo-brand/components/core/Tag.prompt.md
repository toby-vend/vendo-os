Pill chip for service labels ("Paid Social Advertising") and selectable filter rows.

```jsx
<Tag>Marketing Services</Tag>
<Tag variant="outline" active onClick={pick}>Website Design</Tag>
<Tag variant="solid" active>Item 2</Tag>
```

- `variant`: `outline` (default) · `solid`. `active` is the selected state (mint).
- Pass `onClick` to make it a selectable filter chip.
