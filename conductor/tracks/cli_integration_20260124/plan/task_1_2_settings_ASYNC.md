# Task 1_2: Add CLI Settings to package.json

**Phase:** 1
**Sequence:** 2
**Type:** ASYNC
**Agent Assignment:** general-purpose
**Blocking:** No
**Parallel With:** [task_1_1_stream_parser_ASYNC]

---

## Dependencies

**Depends On:**
- [ ] task_0_1_cli_detector (Wave 0 complete)

**Blocks:**
- [ ] task_3_1_chatpanel_cli (needs settings to read config)

**Critical Path:** No

---

## Objective

Add CLI-related VS Code settings to `package.json` contributes.configuration section. These settings control CLI behavior and fallback options.

---

## Implementation Steps

1. [ ] Read current `package.json` configuration section
2. [ ] Add new settings under `claudeAgentSpawner`:
   ```json
   {
     "claudeAgentSpawner.useClaudeCLI": {
       "type": "boolean",
       "default": true,
       "description": "Use installed Claude Code CLI instead of direct API (recommended)"
     },
     "claudeAgentSpawner.cliAllowedTools": {
       "type": "array",
       "default": ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
       "items": { "type": "string" },
       "description": "Tools to auto-approve when using Claude Code CLI"
     },
     "claudeAgentSpawner.cliTimeout": {
       "type": "number",
       "default": 300000,
       "description": "Timeout for CLI operations in milliseconds (default: 5 minutes)"
     }
   }
   ```
3. [ ] Verify settings appear in VS Code settings UI
4. [ ] Add settings access helper function if needed

---

## Verification Requirements

**Type:** SMOKE_TEST

**Requirements:**
- [ ] Settings visible in VS Code Settings UI
- [ ] Default values applied correctly
- [ ] Array setting works for cliAllowedTools
- [ ] Number setting works for cliTimeout

**Acceptance Criteria:**
- ✅ All 3 settings appear in VS Code
- ✅ Descriptions are clear and helpful
- ✅ Defaults are reasonable

**Automation Script:**
```bash
# Verify package.json is valid
node -e "require('./package.json')" && echo "✅ package.json valid"
```

---

## Enhancement Queries

**Query 1 (Priority: low):**
```
VS Code extension contributes.configuration best practices for boolean and array settings
```

---

## Files Modified/Created

- [ ] `package.json` (MODIFY)

---

## Commit Message

```
feat(config): add CLI-related VS Code settings

Add useClaudeCLI, cliAllowedTools, and cliTimeout settings
to package.json for CLI integration configuration.
```

---

## Git Note

```
Task: task_1_2_settings_ASYNC
Summary: Added CLI settings to package.json
Verification: Settings visible in VS Code UI
Context: Parallel with stream parser task
```

---

## Risk Assessment

**Risk Level:** LOW

**Potential Risks:**
- Risk 1: Invalid JSON syntax → Mitigation: Validate before commit

**Critical Blocker:** No

---

## Context Cost Estimate

**Estimated Tokens:** ~2,000 tokens
**Tool Calls:** 2-3 expected
**Agent Session:** Short (10 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** conductor
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** f7dd543
