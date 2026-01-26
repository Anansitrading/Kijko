# Task 1_1: Create Stream Parser Module

**Phase:** 1
**Sequence:** 1
**Type:** ASYNC
**Agent Assignment:** general-purpose
**Blocking:** No
**Parallel With:** [task_1_2_settings_ASYNC]

---

## Dependencies

**Depends On:**
- [ ] task_0_1_cli_detector (Wave 0 complete)

**Blocks:**
- [ ] task_2_1_cli_manager (needs parser for JSON output)

**Critical Path:** Yes

---

## Objective

Create `src/streamParser.ts` module to parse `--output-format stream-json` output from Claude Code CLI. This parser converts streaming JSON lines into structured events.

---

## Implementation Steps

1. [ ] Create `src/streamParser.ts` file
2. [ ] Define `StreamJsonEvent` interface:
   - `type: 'init' | 'text' | 'tool_use' | 'tool_result' | 'complete' | 'error'`
   - `content?: string`
   - `tool?: { name: string; input: any; }`
   - `result?: any`
3. [ ] Implement `parseStreamJson(line: string): StreamJsonEvent | null`
   - Parse JSON lines from CLI output
   - Handle `assistant` messages → extract text content
   - Handle `tool_use` events → extract tool name and input
   - Handle `tool_result` events → extract result
   - Handle `result` events → mark complete
   - Fallback to plain text for non-JSON lines
4. [ ] Add unit tests for each event type
5. [ ] Add JSDoc documentation

---

## Verification Requirements

**Type:** TDD

**Requirements:**
- [ ] Write tests FIRST for each event type
- [ ] Parse valid JSON events correctly
- [ ] Handle malformed JSON gracefully (no exceptions)
- [ ] Return null for empty lines
- [ ] 90%+ code coverage

**Acceptance Criteria:**
- ✅ All event types parsed correctly
- ✅ Non-JSON lines return text event
- ✅ Empty lines return null
- ✅ No exceptions on malformed input

**Automation Script:**
```bash
npm run compile && npm test -- --grep "streamParser"
```

---

## Enhancement Queries

**Query 1 (Priority: high):**
```
Claude Code CLI --output-format stream-json event types and schema 2026
```

---

## Files Modified/Created

- [ ] `src/streamParser.ts` (CREATE)
- [ ] `src/test/streamParser.test.ts` (CREATE)

---

## Commit Message

```
feat(cli): add stream-json output parser

Implement streamParser.ts to parse Claude Code CLI
--output-format stream-json events into structured data.
```

---

## Git Note

```
Task: task_1_1_stream_parser_ASYNC
Summary: Created stream JSON parser with TDD
Verification: Unit tests pass, 90%+ coverage
Context: Parallel with settings task
```

---

## Risk Assessment

**Risk Level:** MEDIUM

**Potential Risks:**
- Risk 1: CLI output format changes → Mitigation: Flexible parsing, fallback to text
- Risk 2: Large JSON objects → Mitigation: Stream line-by-line, don't buffer

**Critical Blocker:** No

---

## Context Cost Estimate

**Estimated Tokens:** ~4,000 tokens
**Tool Calls:** 5-8 expected
**Agent Session:** Medium (20-30 min)

---

## Status Tracking

**Status:** [x] Complete
**Assigned Agent:** conductor
**Started:** 2026-01-24
**Completed:** 2026-01-24
**Checkpoint SHA:** f7dd543
