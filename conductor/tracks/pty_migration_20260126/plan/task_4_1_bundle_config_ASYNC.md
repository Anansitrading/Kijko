# Task 4_1: Configure Bundling for node-pty Native Bindings

**Phase:** 4
**Sequence:** 1
**Type:** ASYNC
**Parallel With:** [task_4_2]

---

## Dependencies

**Depends On:** task_3_1, task_3_2
**Blocks:** (none - final wave)

---

## Objective

Configure the build system to properly handle node-pty's native bindings in the VSIX package.

---

## Implementation Steps

1. [ ] Mark `node-pty` as external in build config:
   ```javascript
   // If using webpack:
   externals: { 'node-pty': 'commonjs node-pty' }

   // If using esbuild:
   external: ['vscode', 'node-pty']
   ```
2. [ ] Update `.vscodeignore` to include node-pty binaries:
   ```
   !node_modules/node-pty/**
   ```
3. [ ] Verify VSIX package includes native bindings:
   ```bash
   npx vsce package --allow-missing-repository
   npx vsce ls --tree | grep node-pty
   ```
4. [ ] Test extension installs and loads on clean VS Code instance
5. [ ] Add postinstall script if needed for native rebuild

---

## Verification

- [ ] VSIX includes node-pty native bindings
- [ ] Extension loads without "Cannot find module 'node-pty'" error
- [ ] Terminal command works after fresh install from VSIX
- [ ] TypeScript compilation succeeds
