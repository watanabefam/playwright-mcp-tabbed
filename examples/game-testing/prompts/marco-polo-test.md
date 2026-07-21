# Marco Polo Test Prompt

Use this prompt to instruct an AI agent to test the Marco Polo RPG.

```
Test the Marco Polo RPG at {GAME_PATH} using playwright-mcp-tabbed:

1. Navigate to the game
2. Verify the game loaded by checking the G global is defined
3. Read the initial state: player position (G.p), gold (G.g), current year (G.yr), and current location (G.cl)
4. Simulate keyboard input (WASD) to move the player in each direction
5. Read the updated position after movement to confirm it changed
6. Check inventory via G.inv and timeline via G.tl
7. Press I and L keys to open/close the inventory and timeline panels
8. Read all console messages and report any errors
9. Take a screenshot for visual verification
```

Replace `{GAME_PATH}` with the path to `marco-polo/index.html` before running.
