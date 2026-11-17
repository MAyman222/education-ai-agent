# Working-version preservation

This is the independent LOCAL-MODEL-ONLY repository in AI-agent-fixed.
Do not add cloud AI/API-key features unless explicitly requested for this project.
The sibling AI-agent-improvements is a separate independent repository, not a
feature worktree to merge here. Use ../quiz-coach-local-feature for future worktrees.

The user has confirmed that Quiz Coach v0.11.0 works for their current practice workflow.
Preserve the `v0.11.0` tag and `stable/v0.11.0` branch as the baseline. Do not move,
overwrite, delete, or rewrite those references without an explicit user request.
This is a rollback point, not a claim of universal site compatibility or answer accuracy.

Before changing application code, create a feature branch in a separate Git worktree.
Leave the main folder used by Chrome unchanged while developing. Check for existing
uncommitted work before branching or switching. Never discard the user's changes.

Run `node test-all.cjs` for application changes. Add meaningful regression checks for
new failures. Report separately which tests use doubles and which run in a browser;
do not describe mocked answers as measured model accuracy.

Preserve the separate Allow read / Allow submit grants, per-opening revocation,
same-origin boundaries, Pause, and protection against overwriting existing answers.
Do not use signed-in accounts or private quiz pages for testing without explicit consent.

Keep secrets, model weights, private notes, captures and browser profiles out of Git.
Prepare a reviewable change and explain validation before integrating a feature into main.
Do not publish the repository or push to a remote unless the user requests it.
