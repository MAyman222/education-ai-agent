function clean(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function collectQuestion() {
  const selected = window.getSelection()?.toString();
  if (selected && selected.trim().length > 10) {
    return { question: clean(selected), options: [] };
  }

  const candidates = [
    "main", "[role='main']", "article", "form",
    "[class*='question']", "[id*='question']"
  ];
  const container = candidates
    .map((selector) => document.querySelector(selector))
    .find((element) => element && clean(element.innerText).length > 20);
  const root = container || document.body;
  const question = clean(root.innerText).slice(0, 12000);
  const options = [...root.querySelectorAll(
    "label, [role='option'], input[type='radio'], input[type='checkbox']"
  )]
    .map((element) => clean(element.labels?.[0]?.innerText || element.innerText || element.value))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 50);

  return { question, options };
}

function normalized(text) {
  return clean(text).toLowerCase().replace(/^[a-z0-9]+[.)]\s*/, "");
}

function chooseAnswer(answer) {
  const target = normalized(answer);
  if (!target) {
    return { chosen: false, reason: "The model returned an empty answer." };
  }

  const controls = [...document.querySelectorAll(
    "label, [role='option'], input[type='radio'], input[type='checkbox'], button"
  )];
  const match = controls.find((element) => {
    const label = element.labels?.[0];
    const text = label?.innerText || element.innerText || element.value;
    return normalized(text) === target || normalized(text).includes(target);
  });
  if (!match) {
    return { chosen: false, reason: `No page option matched "${answer}".` };
  }

  const control = match.matches("input") ? match : match.querySelector("input");
  if (control) {
    control.click();
  } else {
    match.click();
  }
  return { chosen: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "collect-question") {
    sendResponse(collectQuestion());
  }
  if (message?.type === "choose-answer") {
    sendResponse(chooseAnswer(message.answer));
  }
  return true;
});
