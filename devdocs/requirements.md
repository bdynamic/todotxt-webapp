# Feature Requirements

Running list of UI/behavior requirements not obvious from code alone. Add entries here as new ones come in.

## Mobile

- Git sync status indicator (`#syncStatusIndicator`): icon only, no text label, under 768px width. Full status still available via `title` tooltip. See `.sync-status-text` in `assets/css/todo.css` / `assets/js/git/ui.js`.
- Todo list rows must never force horizontal page scroll. Long unbroken tokens in a todo's text wrap instead of pushing the row wider than the viewport (`.list-group-item .todo-text` in `assets/css/todo.css`).

## Todo list

- Alternating row shading (zebra striping): every second row a bit lighter, for easier line tracking when scanning a long list. `.list-group-item:nth-child(even)` in `assets/css/todo.css`.
