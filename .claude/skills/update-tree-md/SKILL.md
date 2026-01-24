---
name: update-tree.md
description: Regenerates TREE.md after filesystem changes (new files/folders, moves, deletions). Uses tree command with exclusions for node_modules, .next, dist, build artifacts, git files, etc. Invoked automatically at the end of sequences that modify structure (IMPLEMENT, EDIT, after commit-orchestrator or write operations).
priority: low (final cleanup step in sequences)
triggers: none (called only by classifier sequences)
---

# Update TREE.md – Clean Project Tree Regenerator

Goal: Keep TREE.md accurate, compact, and developer-focused. Never include heavy/irrelevant folders.

## Exclusions (hard-coded – always apply)
node_modules
.next
dist
build
coverage
.cache
.tmp
.vercel
.output
target          # Rust / wasm if any
*.log
.DS_Store
Thumbs.db
.git
.gitignore      # we show the tree, not the ignore file itself

## Process (strict)
1. Run shell command to generate clean tree:
   tree -a -I 'node_modules|.next|dist|build|coverage|.cache|.tmp|.vercel|.output|target|*.log|.DS_Store|Thumbs.db|.git' --dirsfirst
2. Capture output
3. Format as markdown code block with header:
   # Project Structure (last updated: YYYY-MM-DD HH:MM)
   <clean tree="" output="" here="">

4. Replace entire content of TREE.md with this new version. No extra commentary in the file.

5. Clean up: `shell "rm temp-tree.txt"`

## Tool calls sequence (when invoked)

1. shell "tree -a -I 'node_modules|.next|dist|build|coverage|.cache|.tmp|.vercel|.output|target|*.log|.DS_Store|Thumbs.db|.git' --dirsfirst > temp-tree.txt"
2. read "temp-tree.txt"
3. Format content → add timestamp header
4. write "TREE.md" "<formatted markdown content>"
5. shell "rm temp-tree.txt"

## Output Format (when skill finishes)
TREE.md has been regenerated and is now up-to-date.
Relevant excerpt:

<show first ~20-30 lines of the new tree for quick confirmation>

No other text. Return control to the parent sequence.