# AI development loop

This repository is wired for the Cursor AI feature-development workflow:

**idea → specification interview → explicit human approval → issue created and marked ready → autonomous build/test/fix cycle → draft pull request → independent final review → human merge**

Global commands (installed in your Cursor config, not copied into this repo):

- `/ai-bootstrap` — set up or refresh this project adapter
- `/ai-spec` — turn an idea into an approved-ready specification
- `/ai-build` — implement one `agent-ready` GitHub issue as a draft PR
- `/ai-review` — independently review a draft PR
- `/ai-status` — summarise loop state for an issue/PR

Project adapter files:

- [`AI_LOOP.md`](../../AI_LOOP.md) — package manager, commands, CI, architecture, risks
- [`.cursor/rules/ai-loop-governance.mdc`](../../.cursor/rules/ai-loop-governance.mdc) — binding safety rules

---

## What the loop does

It keeps feature work scoped, reviewable, and human-controlled:

1. An agent interviews and drafts a precise specification.
2. A human explicitly approves the completed specification.
3. After that approval, the spec agent may create the GitHub issue and apply `agent-ready`.
4. A builder agent implements only that issue, runs checks, performs available browser verification, and uses a fresh internal reviewer when available.
5. The builder opens a draft pull request (or escalates after two unsuccessful internal correction rounds).
6. A human inspects and tests the draft PR.
7. A separate reviewer agent checks the exact PR commit in a fresh chat.
8. Corrections may loop a limited number of times.
9. A human merges. Agents never merge or enable auto-merge.

Human boundaries that never move:

- A human explicitly approves the completed specification.
- A human explicitly starts `/ai-build`.
- A human decides whether to merge.
- Agents never merge or enable auto-merge.

---

## Run `/ai-bootstrap`

In a Cursor Agent chat on this repo:

```text
/ai-bootstrap
```

That command inspects the repository and creates/updates:

- `AI_LOOP.md`
- `.cursor/rules/ai-loop-governance.mdc`
- `docs/ai-loop/README.md`

It may also create GitHub workflow labels when `gh` is authenticated. It must not change product features, package scripts, or CI workflows as part of bootstrap.

---

## Run `/ai-spec`

1. Open a **fresh** Agent chat.
2. Run `/ai-spec` with your feature idea.
3. The agent reads `AI_LOOP.md` and runs a specification interview (problem, scope, acceptance criteria, non-goals, test plan, risks).

Do not start implementation from the spec chat.

---

## Explicit specification approval

Only a human may approve.

Review the spec for:

- Correct product intent
- Clear acceptance criteria
- Explicit non-goals
- Sensible manual / browser verification journeys
- No hidden scope (refactors, iBus refreshes, deploy changes, etc.)

Edit the spec until you are willing to treat it as binding, then **explicitly approve** it in the `/ai-spec` conversation (for example: “I approve this specification”).

### After approval: issue + `agent-ready`

After that explicit approval, the **spec agent may**:

1. Create the GitHub issue that embeds or links the approved specification.
2. Apply the **`agent-ready`** label.

The agent must never apply `agent-ready` without explicit human approval of the complete specification. You may still create or label the issue yourself if you prefer.

---

## Run `/ai-build`

1. Open a **fresh** Agent chat (not the spec chat).
2. Ensure the working tree is clean (or stop and clean up unrelated work yourself).
3. Run:

```text
/ai-build #ISSUE_NUMBER
```

### Autonomous build cycle

The builder should:

1. Implement only the approved issue.
2. Run every relevant automated check from `AI_LOOP.md` (typically `typecheck`, `lint`, `test`, and `build` when relevant).
3. Perform available browser verification against the issue test plan and journeys in `AI_LOOP.md`.
4. Diagnose and fix failures autonomously.
5. Before opening a PR, use a fresh read-only **internal** reviewer subagent when available.
6. Address internal must-fix findings and re-verify (at most **two** internal correction rounds).
7. Open/update a **draft** pull request after convergence — or escalate after two unsuccessful correction rounds.
8. Never merge or enable auto-merge.

Do not claim a check or browser test passed unless it actually ran successfully. If the env, API key, or browser tools are unavailable, record that verification as pending.

---

## Test the draft PR

Manually verify acceptance criteria in the browser (and relevant device widths). Use the journeys listed in `AI_LOOP.md` when the change touches them.

Check CI on the PR. Missing required CI is not a pass.

---

## Run `/ai-review`

1. Open **another fresh** Agent chat (not the build chat — independence matters).
2. Run:

```text
/ai-review PR #PR_NUMBER
```

The final reviewer must:

- Review the exact current PR commit
- Stay read-only (no edits, pushes, merges, or auto-merge)
- Compare the PR against the approved specification and governance rules

Independence exists so implementation assumptions are not rubber-stamped by the same chat that wrote the code.

---

## Correction rounds

If final review finds issues:

1. Label/state moves to `loop-changes-requested` (as used by the loop commands).
2. Address findings with `/ai-build PR #PR_NUMBER` in a build chat.
3. Review the new commit again with `/ai-review`.
4. After **two unsuccessful** correction rounds, stop and escalate for human review (`needs-human-review` / `loop-stuck` as appropriate).

The same two-round limit applies to the builder’s internal reviewer cycle before the draft PR opens.

---

## Why agents never merge

Merge is a release decision: product sign-off, residual risk, secrets, deploy readiness, and timing. Agents may prepare and verify; only a human merges, and auto-merge must stay off.

---

## Why humans approve specs and merge PRs

- Spec approval locks scope before code exists.
- Merge approval locks what ships.
- High-risk areas (secrets, TfL proxy routes, iBus data, misleading schedule/ghost UX, deploy/CI) always need human judgement.

---

## GitHub workflow labels

| Label | Meaning |
| --- | --- |
| `agent-ready` | Spec approved; issue may be built (human or post-approval spec agent) |
| `blocked` | Blocked until human clears a dependency |
| `loop-changes-requested` | Reviewer requested corrections |
| `loop-approved` | Independent review approved current commit |
| `needs-human-review` | Escalation for product/security/infra or failed corrections |
| `loop-stuck` | Loop cannot progress without human unblock |

---

## Normal workflow checklist

1. Run `/ai-spec` in a fresh Agent chat.
2. Answer the specification questions.
3. Explicitly approve the complete specification.
4. The spec agent creates the GitHub issue and applies `agent-ready`.
5. Run `/ai-build #ISSUE_NUMBER` in a fresh chat.
6. The builder implements, runs automated checks, performs available browser verification, fixes failures, and uses a fresh internal reviewer when available.
7. The builder opens a draft pull request after convergence, or escalates after two unsuccessful correction rounds.
8. Manually inspect and test the draft pull request.
9. Run `/ai-review PR #PR_NUMBER` in another fresh chat.
10. Address any final `loop-changes-requested` findings with `/ai-build PR #PR_NUMBER`.
11. Review the new commit again.
12. A human performs final checks and merges.

---

## Remove this project-specific setup

Delete:

- `AI_LOOP.md`
- `.cursor/rules/ai-loop-governance.mdc`
- `docs/ai-loop/` (this folder)

Optionally delete the workflow labels from GitHub. Do not delete the global Cursor commands unless you want them removed everywhere.
