---
name: Error Handling Philosophy
description: Fail Loud, Never Fake — never silently swallow errors or substitute mock data. Surface all failures visibly.
type: feedback
---

## Error Handling Philosophy: Fail Loud, Never Fake

Prefer a visible failure over a silent fallback.

- Never silently swallow errors to keep things "working"
- Surface all errors — don't substitute placeholder or mock data unless requested
- Fallbacks are acceptable only when disclosed: show a banner, log a warning, annotate the output
- Design for debuggability, not cosmetic stability

**Priority Order:**
1. Works correctly with real data
2. Falls back visibly — clearly signals degraded mode
3. Fails with a clear error message
4. **NEVER:** Silently degrades to look "fine"

**Why:** User has explicitly defined this as a core engineering principle. Applies to all code written across all projects in this workspace.

**How to apply:** Every error boundary, API call, data fetch, and blockchain transaction must follow this hierarchy. No try/catch blocks that swallow errors. No fallback to mock/placeholder data without visible indication. Toast notifications, error banners, console warnings — always surface the failure mode.
