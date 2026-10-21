# Quiz Coach 0.10.0

## Install or update

Project folder: C:\Users\ayman\Documents\Codex\2026-10-20\new-chat\AI-agent-fixed

1. Open chrome://extensions. Reload the extension if it uses this folder. Otherwise choose Developer mode, Load unpacked, then this folder.
2. Refresh the quiz webpage. This removes readers injected by older versions.
3. Open Quiz Coach and choose Open study window beside the quiz.
4. Click Allow read. Each opening starts locked. Choose a model from your running local server.
5. Click Scan all questions. The list includes recognised questions below the viewport. A count is a detection count, not a correctness score.
6. Click Start / continue. The extension attempts selection/text entry, scrolling and recognised Next controls.
7. Independently enable Allow submit if you want Check, Reveal, Submit answer or Finish controls clicked. A native form-submitting Next also requires this permission.
8. Pause to explain an answer. Lock & clear or close the study window to revoke access and clear the session.

The extension uses your existing Ollama/OpenAI-compatible local model server. A cloned or duplicated model is unnecessary. Refresh models to discover what running servers expose. It cannot load arbitrary model files directly from disk.

## Changes in 0.10.0

- Local reference retrieval now uses a small, source-linked CS/SE foundation set (JavaScript, testing, databases, access control, graph traversal and ML security). It is a starter set, not a comprehensive knowledge base.
- Add .txt/.md course notes under Answer quality & sources > Local study reference library. Up to eight files, 400 KB per file and 200,000 characters per file. Notes remain stored locally until removed; relevant excerpts are sent to the selected model only after Allow read. Imported notes can cover other subjects.
- A recognised Ollama CUDA runner failure triggers one CPU retry. Later requests to that model use CPU recovery for the worker lifetime. This does not change global Ollama settings or download another model. CPU operation can be slower. Other HTTP errors remain explicit.
- Read-only/hidden code editor textareas no longer prevent MCQ detection. Code sample text is retained; editor measurement/gutter noise is excluded.
- Next arrows including ❯ are recognised; form-submitting navigation still requires Allow submit.
- Immediate incorrect feedback pauses the runner where the website exposes a recognised result. JavaScriptQuiz has an adapter for the visible red/green result styles observed during testing.


- Native radios, hidden radios with visible labels, numbered buttons, ARIA buttons/options and pointer-based custom choice tiles are detected.
- A custom MCQ is not duplicated as a second plain-text question.
- Short-answer fields are searched through deeper wrappers, with support for contenteditable editors and empty placeholder decorations.
- Scan all questions exposes recognised questions and whether an answer is already present.
- Uncertain model answers are kept in session history for review; other detected questions continue. Such a run ends with a review message and does not finish/submit the unresolved quiz.
- Zero detections pauses with an unsupported-controls message. It no longer declares the quiz finished.
- Written term questions request a concise term, with supporting detail kept separate. Clearly visible Expected answer / Correct answer text can be supplied to the model as page evidence.
- Existing text is protected. Stale question identities and unconfirmed selections are rejected.

## Privacy

No automatic content scripts or permanent quiz-site permissions are declared. Reading starts only after Allow read and uses a per-opening token scoped to the tab. Closing/locking clears captured answers, references, history and submission permission. A running session may follow same-origin navigation; a different origin locks reading. Opening another UI for the same tab ends its previous session.

Reference passages are session-only. Optional Wikipedia lookup has separate permission, resets off each opening, and sends question keywords to Wikipedia. Local server settings determine logging, retention and whether processing is actually local. Known cloud-tagged models are excluded.

## Limits

The detector does not support every site's markup, cross-origin frames, shadow DOM or canvas-based controls. Read-only quiz previews may expose the choices but provide no selectable controls. Ambiguous navigation and rejected page entry pause instead of claiming success. A click is not verification of correctness. A correct website result requires explicit website feedback.

No factual accuracy rate has been established for your model or course. The earlier 100-question integration fixture used mocked model replies; it was not 100 real correct answers. Reliable course notes/references can improve alignment with expected terminology, but neither model confidence nor agreement between two passes proves correctness.

## Validation

Run the automated Node suites from this folder:

    node test-all.cjs

The worker/provider/session tests mock Chrome APIs and model HTTP. They include a 100-question mixed-format workflow, submission gates, cancellation, history and navigation authorization.

For actual browser DOM tests:

    node tests/browser-server.cjs

Open http://127.0.0.1:8766/tests/browser-content.html. This runs production content.js, choices.js, flow.js and runner.js against real DOM controls, with the extension message bridge and model responses mocked. The browser suite was observed passing: custom buttons/div tiles, hidden radios, read-only failures, placeholder editors, scanning 15 deeply nested/offscreen written questions, stale/revoked requests, and automatic scrolling/selection across 13 custom MCQs. This is not a test of Thea's actual HTML or model factual accuracy.

For manual extension practice fixtures:

    node tests/serve.cjs

Open http://127.0.0.1:8765 and choose scrolling, Next, full-page Next or incorrect-feedback mode. Keep the terminal open; Ctrl+C stops the fixture server.

## Actual public tests, 20 October 2026

No user account was used. A public W3Schools JavaScript question was read, qwen3.5:9b returned <script>, and the browser selected it and advanced to Question 2. Browser automation performed the live click; the extension itself was not installed in that test browser. The production reader was separately tested on a reproduction of the observed form structure.

On JavaScriptQuiz, the live qwen3.5:9b model (CPU, reasoning disabled, without retrieved references) predicted 1 for the empty-array/boolean-coercion question. The site marked 1 red and 0 green. That was a real, confident wrong answer. No broad accuracy percentage is justified.

The initial GPU request failed with CUDA shared object initialization failed and exit 0xc0000409. A CPU request completed successfully. A later reference/reasoning benchmark was blocked by automatic approval review due to an unexpected, unverified external telemetry connection. Its result is not reported and further live-model benchmarking was not resumed. No telemetry destination or payload was verified and no such connection was approved.

The 100-question workflow still uses mocked model responses. Separate real-browser DOM checks passed for the two public quiz structures, custom controls, code preservation, 15 nested/offscreen written fields, a 13-question scrolling run, and continuing past an uncertain question. The model responses in those DOM checks are mocked. These results do not establish factual accuracy, comprehensive site compatibility or ChatGPT-equivalent knowledge.
