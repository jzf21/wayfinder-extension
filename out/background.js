let currentStep = 0;
let navigationSteps = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_NAVIGATION") {
    navigationSteps = message.steps.steps;
    currentStep = 0;
    executeStep();
  }
});

async function executeStep() {
  if (currentStep >= navigationSteps.length) {
    alert("Navigation complete!");
    return;
  }

  const step = navigationSteps[currentStep];
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  switch (step.action) {
    case "open_browser":
      currentStep++;
      executeStep();
      break;

    case "navigate":
      chrome.tabs.update(tab.id, { url: step.url });
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          currentStep++;
          executeStep();
        }
      });
      break;

    default:
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: highlightAndExecuteStep,
        args: [step],
      });
  }
}

function highlightAndExecuteStep(step) {
  // This function runs in the context of the web page
  function getElement(selector) {
    if (selector.startsWith("id:")) {
      return document.getElementById(selector.slice(3));
    } else if (selector.startsWith("css:")) {
      return document.querySelector(selector.slice(4));
    }
    return null;
  }

  const element = getElement(step.selector);
  if (!element) {
    alert(`Cannot find element for step: ${step.description}`);
    return;
  }

  // Add highlight effect
  const originalBackground = element.style.backgroundColor;
  const originalOutline = element.style.outline;
  element.style.backgroundColor = "#ffeb3b";
  element.style.outline = "2px solid #ffc107";
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  // Show tooltip
  const tooltip = document.createElement("div");
  tooltip.style.cssText = `
    position: fixed;
    background: #333;
    color: white;
    padding: 8px;
    border-radius: 4px;
    z-index: 10000;
    max-width: 200px;
  `;
  tooltip.textContent = step.description;
  document.body.appendChild(tooltip);

  // Position tooltip near element
  const rect = element.getBoundingClientRect();
  tooltip.style.top = `${rect.bottom + 5}px`;
  tooltip.style.left = `${rect.left}px`;

  // Execute step action
  setTimeout(() => {
    if (step.action === "search") {
      element.value = step.input_text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (step.action === "click") {
      element.click();
    }

    // Remove highlight and tooltip after action
    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
      element.style.outline = originalOutline;
      tooltip.remove();
      chrome.runtime.sendMessage({ type: "STEP_COMPLETE" });
    }, 1000);
  }, 1000);
}
