# Task 0_1: Install node-pty and Configure Build

**Phase:** 0
**Sequence:** 1
**Type:** SEQUENTIAL
**Blocking:** Yes

---

## Dependencies

**Depends On:** (none - prerequisite)
**Blocks:** task_1_1, task_1_2, task_2_1

---

## Objective

Install `node-pty` as a dependency and update TypeScript/build configuration to support native bindings.

---

## Implementation Steps

1. [ ] Run `npm install node-pty`
2. [ ] Run `npm install --save-dev @types/node-pty` (if available, otherwise create minimal types)
3. [ ] Update `tsconfig.json` to ensure native module resolution works
4. [ ] Verify `node-pty` can be imported without errors: create a test script that spawns a simple command
5. [ ] Add `node-pty` to `.vscodeignore` exclusion patterns for native bindings:
   ```
   !node_modules/node-pty/**
   ```
6. [ ] Verify `npm run compile` succeeds

---

## Verification

- [ ] `node-pty` listed in `package.json` dependencies
- [ ] TypeScript compilation succeeds
- [ ] Can `require('node-pty')` without runtime error

---

## Notes

- node-pty requires native compilation (C++ bindings via N-API)
- node-pty is NOT thread safe - keep PTY in main extension host thread
- Same library VS Code uses for its own integrated terminal
