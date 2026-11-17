# Keep a working version while improving Quiz Coach

This applies only to the independent local-only repository in AI-agent-fixed.
AI-agent-improvements is a different Local + API project. Do not routinely merge them.

The `v0.11.0` tag and `stable/v0.11.0` branch identify the working baseline confirmed
by the user. Keep these references at their original commit. Git records snapshots;
it does not prevent future bugs by itself.

## Develop in a separate folder

From this repository, create a branch and a second working folder:

```powershell
git status
git worktree add ../quiz-coach-local-feature -b local-improvement main
```

Make changes in `quiz-coach-local-feature`. Continue using the original folder in Chrome
until the new version has passed its checks. Load the development folder as a separate
unpacked extension when testing; enable only the extension being tested on the page.

Run the regression suite inside the development folder:

```powershell
node test-all.cjs
git diff
git add <changed-files>
git commit -m "Describe the improvement"
```

The Node suite uses page/model test doubles. Use the browser fixtures documented in
README.md for interaction checks. Public-site and model-accuracy checks are separate.

## Integrate a reviewed improvement

After validation and user review, return to the original folder:

```powershell
git status
git merge --ff-only local-improvement
```

Reload the extension and refresh the quiz page. If fast-forward is unavailable, review
the divergence instead of forcing an overwrite. Give later working releases their own
version tags; do not reuse `v0.11.0`.

## Recover the baseline without discarding work

Create a separate copy of the baseline:

```powershell
git worktree add --detach ../AI-agent-baseline v0.11.0
```

Load `AI-agent-baseline` in Chrome to use that snapshot. Existing development work stays
intact. Avoid `git reset --hard` or other commands that discard uncommitted files.

## Remote backup

The public local-only repository is https://github.com/MAyman222/education-ai-agent.
The origin remote points there; the Local + API project is separate. Publications must
append to the existing GitHub main history, with a saved baseline and no force-push.
The initial local snapshot was created independently of GitHub: fetch and reconcile
histories before the first command-line push from this folder. Connected GitHub tools
can publish a new commit directly on the existing remote main without rewriting history.
Review git ls-files and check for private information before each publication.
