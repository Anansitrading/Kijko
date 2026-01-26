# Task 4_2: Cleanup Old Spawn Code

**Phase:** 4
**Sequence:** 2
**Type:** ASYNC
**Parallel With:** [task_4_1]

---

## Dependencies

**Depends On:** task_3_2 (dual mode working)
**Blocks:** (none - final wave)

---

## Objective

Remove dead code from the old spawn()-based approach now that PTY is the primary path. Keep headless spawn as a fallback for `-p` mode.

---

## Implementation Steps

1. [ ] In `chatPanel.ts`:
   - Remove inline `execSync('which claude')` path detection (use shared utility)
   - Remove duplicate `ensureValidToken` function (now in `oauthRefresh.ts`)
   - Clean up excessive debug logging (keep OUTPUT channel, reduce noise)
2. [ ] In `cliManager.ts`:
   - Keep for headless/print mode spawning only
   - Remove redundant path detection code
3. [ ] Update `extension.ts`:
   - Remove auto-open chat panel on activation (terminal is cleaner)
   - Add terminal auto-open instead (optional, configurable)
4. [ ] Remove unused imports across all modified files
5. [ ] Run `npm run compile` to verify no broken references

---

## Verification

- [ ] No TypeScript compilation errors
- [ ] Headless mode still works via chatPanel
- [ ] Interactive PTY terminal works
- [ ] No unused imports or dead code remaining
- [ ] Extension activates cleanly
