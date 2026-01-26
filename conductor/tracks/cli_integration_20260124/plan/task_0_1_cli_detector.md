# Task 0_1: Create CLI Detector Module

**Phase:** 0
**Sequence:** 1
**Type:** SEQUENTIAL
**Agent Assignment:** general-purpose
**Blocking:** Yes
**Parallel With:** []

---

## Dependencies

**Depends On:**
- (none - prerequisite task)

**Blocks:**
- [ ] task_2_1_extension_init (needs CLI detection)
- [ ] task_3_1_chatpanel_cli (needs fallback logic)

**Critical Path:** Yes

---

## Objective

Create `src/cliDetector.ts` module to detect Claude Code CLI installation, version, and authentication status. This is a prerequisite for all CLI integration work.

---

## Implementation Steps

1. [ ] Create `src/cliDetector.ts` file
2. [ ] Define `ClaudeCodeInfo` interface:
   - `installed: boolean`
   - `version: string | null`
   - `path: string | null`
   - `authenticated: boolean`
   - `authMethod: 'oauth' | 'apikey' | 'none'`
3. [ ] Implement `detectClaudeCode()` async function:
   - Use `which claude` (Unix) or `where claude` (Windows)
   - Run `claude --version` with timeout
   - Check `~/.claude/settings.json` for auth status
4. [ ] Handle errors gracefully (return `installed: false`)
5. [ ] Add JSDoc documentation

---

## Verification Requirements

**Type:** INTEGRATION_TEST

**Requirements:**
- [ ] Function returns correct info when CLI installed
- [ ] Function returns `installed: false` when CLI not found
- [ ] Works on Windows, macOS, Linux
- [ ] Timeout prevents hanging (5 second max)

**Acceptance Criteria:**
- ✅ `detectClaudeCode()` returns `ClaudeCodeInfo` object
- ✅ No exceptions thrown when CLI not installed
- ✅ Cross-platform path detection works

**Automation Script:**
```bash
npm run compile && node -e "
const { detectClaudeCode } = require('./out/cliDetector');
detectClaudeCode().then(info => {
    console.log('CLI Detection Result:', JSON.stringify(info, null, 2));
    process.exit(info.installed ? 0 : 1);
});
"
```

---

## Enhancement Queries

**Query 1 (Priority: high):**
```
Best practices for cross-platform CLI detection in Node.js VS Code extensions 2026
```

---

## Files Modified/Created

- [ ] `src/cliDetector.ts` (CREATE)

---

## Commit Message

```
feat(cli): add Claude Code CLI detection module

Implement cliDetector.ts with detectClaudeCode() function
to check CLI installation, version, and auth status.
```

---

## Git Note

```
Task: task_0_1_cli_detector
Summary: Created CLI detection module
Verification: Cross-platform detection tested
Context: Prerequisite for all CLI integration work
```

---

## Risk Assessment

**Risk Level:** LOW

**Potential Risks:**
- Risk 1: Different CLI names on different platforms → Mitigation: Check common variations
- Risk 2: Settings file format changes → Mitigation: Handle parse errors gracefully

**Critical Blocker:** No

---

## Context Cost Estimate

**Estimated Tokens:** ~3,000 tokens
**Tool Calls:** 3-5 expected
**Agent Session:** Short (10-15 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** conductor
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** 199e03d
