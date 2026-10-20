const $ = (id) => document.getElementById(id);

function setStatus(message, error = false) {
  $("status").textContent = message;
  $("status").style.color = error ? "#c62828" : "";
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) throw new Error("No active tab is available.");
  return tabs[0];
}

let suggestedAnswer = "";

$("read").addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    const data = await chrome.tabs.sendMessage(tab.id, { type: "collect-question" });
    $("question").value = data.question || "";
    $("options").value = (data.options || []).join("\n");
    setStatus("Read the current page. Check the extracted text before asking.");
  } catch (error) {
    setStatus(`Could not read this page: ${error.message}`, true);
  }
});

$("solve").addEventListener("click", async () => {
  const question = $("question").value.trim();
  if (!question) {
    setStatus("Enter a question or read a page first.", true);
    return;
  }
  $("result").hidden = true;
  setStatus("Asking your local Ollama model...");
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: $("model").value.trim() || "llama3.2:latest",
        stream: false,
        format: "json",
        prompt: [
          "You are a careful practice-quiz coach.",
          "Answer the supplied question for learning, not for hidden or automatic submission.",
          "Handle multiple choice, true/false, short answer, matching, and scenario questions.",
          "Use only the supplied text and general knowledge. If the question is ambiguous, say so.",
          "For multiple choice or true/false, answer must be exactly the visible option text, with no letter prefix or extra words, so it can be selected on the page.",
          "For short answer, matching, or scenario questions, provide the concise answer in the answer field.",
          "Return JSON with exactly these string fields: answer, explanation, confidence.",
          `Question/page text:\n${question}`,
          `Answer choices:\n${$("options").value.trim() || "(none supplied)"}`
        ].join("\n\n")
      })
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
    const payload = await response.json();
    const result = JSON.parse(payload.response);
    $("answer").textContent = result.answer || "No answer returned.";
    $("explanation").textContent = result.explanation || "No explanation returned.";
    $("confidence").textContent = result.confidence || "Not provided.";
    suggestedAnswer = result.answer || "";
    $("choose").disabled = !suggestedAnswer;
    $("result").hidden = false;
    setStatus("Review the answer and explanation before responding on the site.");
  } catch (error) {
    const hint = error.message.includes("HTTP 403")
      ? "Allow the extension origin with OLLAMA_ORIGINS, then restart Ollama."
      : "Is Ollama running and is the model name correct?";
    setStatus(`Request failed: ${error.message}. ${hint}`, true);
  }
});

$("choose").addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "choose-answer",
      answer: suggestedAnswer
    });
    if (!result?.chosen) {
      setStatus(result?.reason || "Could not find a matching option.", true);
      return;
    }
    setStatus("Option selected on the page. Nothing was submitted.");
  } catch (error) {
    setStatus(`Could not choose the option: ${error.message}`, true);
  }
});
