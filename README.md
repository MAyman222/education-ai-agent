# Ollama Practice Quiz Coach

This Chrome extension reads visible practice-quiz text and asks a local Ollama model for a suggested answer, explanation, and confidence level. After you review the explanation, **Choose this option on page** can select a matching radio, checkbox, option, or button. It never submits, bypasses access controls, or sends quiz content to a hosted service.

## Setup

1. Install and start [Ollama](https://ollama.com/).
2. Confirm the model exists:

   ```powershell
   ollama list
   ```

3. Optional: create the learning-focused derivative model. Update `FROM` in `Modelfile` if your installed model has a different name:

   ```powershell
   ollama create practice-coach -f Modelfile
   ```

4. Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose this folder.
5. Open a practice quiz, click the extension, and click **Read current page**. Inspect the extracted text and choices, then click **Explain answer**.
6. Set the popup model to `practice-coach` if you created it, or use the exact name from `ollama list`.

## Fixing HTTP 403 from Ollama

The screenshot's HTTP 403 is usually Ollama rejecting the Chrome extension origin. Start Ollama with the extension origin allowed. In PowerShell, stop the existing Ollama server first, then run:

```powershell
$env:OLLAMA_ORIGINS = "chrome-extension://*"
ollama serve
```

If Ollama is already managed by its desktop application, set `OLLAMA_ORIGINS` in the Ollama application's environment before restarting it. You can also temporarily use:

```powershell
$env:OLLAMA_ORIGINS = "*"
ollama serve
```

Use the wildcard only on a trusted laptop because it permits browser origins to call the local API.

## Notes

- The extension uses only `http://localhost:11434/api/generate`.
- Some sites block content scripts or use unusual layouts. In that case, paste the question and choices into the popup.
- The option chooser matches visible option text and intentionally does not click submit/next controls. The student remains responsible for reviewing the explanation and finalizing the practice attempt.
