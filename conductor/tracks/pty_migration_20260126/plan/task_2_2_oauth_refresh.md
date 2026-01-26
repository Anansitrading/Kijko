# Task 2_2: OAuth Token Auto-Refresh

**Phase:** 2
**Sequence:** 2
**Type:** SEQUENTIAL

---

## Dependencies

**Depends On:** task_2_1
**Blocks:** task_3_1, task_3_2

---

## Objective

Ensure OAuth token in `~/.claude/.credentials.json` is valid before spawning Claude CLI via PTY. Tokens expire after ~8-12 hours; the PTY can't prompt for re-auth interactively.

---

## Implementation Steps

1. [ ] Create `src/oauthRefresh.ts` module (extract from chatPanel.ts `ensureValidToken`)
2. [ ] Function `ensureValidToken()`:
   - Read `~/.claude/.credentials.json`
   - Check `claudeAiOauth.expiresAt` vs `Date.now()` (with 60s buffer)
   - If expired: POST to `https://console.anthropic.com/api/oauth/token` with:
     ```json
     {
       "grant_type": "refresh_token",
       "refresh_token": "<from credentials>",
       "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
     }
     ```
   - Update credentials file with new `accessToken`, `refreshToken`, `expiresAt`
3. [ ] Call `ensureValidToken()` in `claudeTerminal.ts` `open()` before `pty.spawn()`
4. [ ] Call `ensureValidToken()` in `chatPanel.ts` `_processWithCLI()` before spawn
5. [ ] Show VS Code warning if refresh fails: "Claude token expired. Run `claude login` to re-authenticate."

---

## Verification

- [ ] With expired token, refresh happens automatically and CLI spawns successfully
- [ ] With valid token, no refresh call is made
- [ ] With invalid refresh token, user gets clear error message
- [ ] TypeScript compilation succeeds
