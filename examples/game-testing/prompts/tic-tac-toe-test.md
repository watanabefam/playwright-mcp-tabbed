# Tic Tac Toe Test Prompt

Use this prompt to instruct an AI agent to test the Tic Tac Toe game.

```
Test the Tic Tac Toe game at {GAME_PATH} using playwright-mcp-tabbed:

1. Navigate to the game
2. Verify the board renders with 9 cells (3x3 mode)
3. Play a game: X clicks center (cell index 4), O clicks top-left (index 0), X clicks bottom-right (index 8)
4. Verify the status text updates correctly after each move ("X's turn" -> "O's turn" -> "X wins!")
5. Switch to 4x4 mode by clicking [data-size="4"] and verify 16 cells
6. Switch to AI mode by clicking [data-mode="ai"], make a move, and verify the AI responded
7. Click the reset button (#resetBtn) and verify the board clears (all cells empty, status back to "X's turn")
8. Report any console errors
```

Replace `{GAME_PATH}` with the path to `tic-tac-toe/index.html` before running.
