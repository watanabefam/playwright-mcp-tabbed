# Game Testing with Playwright MCP (Tabbed)

This directory shows how to use `playwright-mcp-tabbed` to test browser-based HTML games from the [games](https://github.com/watanabekidz/games) monorepo.

## Which Games Can Be Tested

| Game | File | Type | Testable? |
|---|---|---|---|
| Tic Tac Toe | `tic-tac-toe/index.html` | HTML/DOM | Full (click cells, read DOM state) |
| Marco Polo RPG | `marco-polo/index.html` | HTML/Canvas 2D | Partial (inject JS, evaluate state, screenshot) |
| Minecraft Clone | `minecraft/minecraft.py` | Python/Ursina 3D | Not a web game — native app |

## Setup

1. Start the MCP server pointing at the games repo:

```
npx playwright-mcp-tabbed
```

2. Set the base URL to the games directory:

```
export PLAYWRIGHT_MCP_BASE_URL="file:///Users/yourname/Documents/GitHub/games"
```

3. Connect your MCP client (Claude Code, Cursor, etc.).

## Testing Tic Tac Toe

Tic Tac Toe is a pure DOM-based game — every cell is a `<div>` in a CSS grid. All interactions work with standard `browser_click` and state reads work with `browser_evaluate`. The game exposes globals like `board`, `boardSize`, `currentPlayer`, and `gameOver` on the window.

### Basic Test: Play a full game

```
// Navigate to Tic Tac Toe
browser_navigate url="tic-tac-toe/index.html"

// Verify the board rendered — 9 cells in 3x3 mode
browser_snapshot

// Click the center cell (3×3 grid, 0-indexed: cell index 4)
browser_click selector=".cell:nth-child(5)"

// Check the status text
browser_evaluate function="() => document.getElementById('status').textContent"

// Play a few more moves:
browser_click selector=".cell:nth-child(1)"   // top-left (index 0)
browser_click selector=".cell:nth-child(9)"   // bottom-right (index 8)

// Check for a winner or draw
browser_evaluate function="() => ({ status: document.getElementById('status').textContent, board: document.getElementById('board').innerHTML.length })"

// Take a screenshot to verify visually
browser_take_screenshot type="png" scale="css"
```

### Test: Switch to 4×4 mode

```
// Click the 4×4 button (has data-size="4")
browser_click selector="[data-size='4']"

// Verify the board changed — now 16 cells
browser_snapshot root_selector="#board"

// Verify by evaluating grid template columns
browser_evaluate function="() => getComputedStyle(document.getElementById('board')).gridTemplateColumns.split(' ').length"
// Returns 4
```

### Test: Play against AI

```
// Click the AI mode button
browser_click selector="[data-mode='ai']"

// Make a move in the center (X moves, then AI responds as O)
browser_click selector=".cell:nth-child(5)"

// Wait for AI response (AI uses setTimeout 200ms)
browser_wait_for timeout=1000

// Read the board state to confirm AI moved
browser_evaluate function="() => { const cells = document.querySelectorAll('.cell'); return [...cells].map(c => c.textContent || '-').join('') }"
```

### Test: Verify game reset

```
browser_click selector="#resetBtn"

// Board should be empty — no cells have text
browser_evaluate function="() => { const cells = document.querySelectorAll('.cell'); return [...cells].every(c => c.textContent === '') }"
// Returns true

// Status should reset
browser_evaluate function="() => document.getElementById('status').textContent"
// Returns "X's turn"
```

## Testing Marco Polo RPG

Marco Polo uses Canvas 2D rendering, so DOM selectors won't work for in-game elements (the player sprite, map, NPCs). Instead, use `browser_evaluate` to read the global `G` state object, and dispatch `KeyboardEvent` for input.

The game's global state is in `G`:
- `G.p` — player position `{x, y}`
- `G.g` — gold
- `G.yr` — current year
- `G.cl` — current location id
- `G.inv` — inventory map `{ itemId: quantity }`
- `G.tl` — timeline events array
- `G.vs` — visited location ids (Set)
- `G.te` — nearby NPC flag (boolean)
- `G.es` — epilogue flag (boolean)

### Check game state

```
// Navigate to Marco Polo
browser_navigate url="marco-polo/index.html"

// Verify game initialized
browser_evaluate function="() => typeof G !== 'undefined' ? 'Game loaded' : 'Not loaded'"

// Read player position and state
browser_evaluate function="() => ({ x: Math.round(G.p.x), y: Math.round(G.p.y), gold: G.g, year: G.yr, location: G.cl })"

// Read inventory (non-zero items)
browser_evaluate function="() => Object.entries(G.inv).filter(([_,q]) => q > 0).map(([id,q]) => id + ' x' + q).join(', ') || 'Empty'"

// Read timeline event count
browser_evaluate function="() => G.tl.length + ' events recorded'"

// Read visited locations
browser_evaluate function="() => [...G.vs].join(', ')"
```

### Simulate keyboard input

```
// Walk right
browser_evaluate function="() => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'d'})); return 'walking right'; }"

// Walk down
browser_evaluate function="() => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'s'})); return 'walking down'; }"

// Walk up and left simultaneously (the game checks KE map)
browser_evaluate function="() => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'w'})); document.dispatchEvent(new KeyboardEvent('keydown', {key:'a'})); return 'walking up-left'; }"

// Release keys
browser_evaluate function="() => { document.dispatchEvent(new KeyboardEvent('keyup', {key:'w'})); document.dispatchEvent(new KeyboardEvent('keyup', {key:'a'})); document.dispatchEvent(new KeyboardEvent('keyup', {key:'d'})); document.dispatchEvent(new KeyboardEvent('keyup', {key:'s'})); return 'keys released'; }"
```

### Interact with NPCs

```
// Press E to interact with a nearby NPC
browser_evaluate function="() => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'e'})); return 'interacted'; }"
```

### Open dialogs and panels

```
// Toggle inventory panel (I key)
browser_evaluate function="() => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'i'})); return 'inventory toggled'; }"

// Toggle timeline panel (L key)
browser_evaluate function="() => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'l'})); return 'log toggled'; }"

// Open trade panel (T key) — only works near a location
browser_evaluate function="() => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'t'})); return 'trade toggled'; }"
```

### Verify game completion

```
// The epilogue triggers when genoa is visited
browser_evaluate function="() => ({ epilogueShown: G.es, visitedCount: G.vs.size, totalGold: G.g })"
```

## Testing Both Games in Parallel (Multi-Tab)

The tabbed architecture lets you run both games simultaneously:

```
// Create tabs for each game
browser_tabs action="new" label="tictactoe"
browser_tabs action="new" label="marcopolo"

// Tab 0: Tic Tac Toe
browser_navigate url="tic-tac-toe/index.html" tab_index=0

// Tab 1: Marco Polo
browser_navigate url="marco-polo/index.html" tab_index=1

// Play Tic Tac Toe in tab 0 while Marco Polo is loaded in tab 1
browser_click selector=".cell:nth-child(5)" tab_index=0
browser_evaluate function="() => ({ gold: G.g, year: G.yr })" tab_index=1
browser_take_screenshot type="png" scale="css" tab_index=1
```

## Best Practices

1. **Use `file://` URLs** for local HTML files — no server needed. Set `PLAYWRIGHT_MCP_BASE_URL` to the repo root so paths like `tic-tac-toe/index.html` just work.
2. **Check console errors** after each navigation: `browser_console_messages level="error"`
3. **Use `browser_snapshot` with `root_selector="#board"`** to scope to the game content area.
4. **Prefer `browser_evaluate`** over screenshots for assertions — it's faster and more precise. Screenshots are for visual confirmation.
5. **For canvas games**, read JavaScript game state directly. You cannot click on canvas-rendered elements — use keyboard events and evaluate JS instead.
6. **The Python Minecraft clone** cannot be tested through Playwright — it's a native Ursina application.
7. **Release keys after keyboard input** — the game tracks key state in the `KE` map. Holding a key can cause unintended continuous movement.
8. **Watch for `setTimeout`** in AI response paths. The Tic Tac Toe AI uses `setTimeout(200)` before moving — use `browser_wait_for` or a short delay after your move.
