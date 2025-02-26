let currentStep = 0;
let navigationSteps = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_NAVIGATION") {
    navigationSteps = message.steps.steps;
    currentStep = 0;
    executeStep();
  } else if (message.type === "STEP_COMPLETE") {
    currentStep++;
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

      // Listen for STEP_COMPLETE message
      const messageListener = (message) => {
        if (message.type === "STEP_COMPLETE") {
          chrome.runtime.onMessage.removeListener(messageListener);
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          waitForPageLoad(tab.id);
        }
      };
      chrome.runtime.onMessage.addListener(messageListener);

      // Listener for tab navigation
      const tabUpdateListener = (tabId, info) => {
        if (tabId === tab.id && info.status === "complete") {
          chrome.runtime.onMessage.removeListener(messageListener);
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          currentStep++;
          executeStep();
        }
      };
      chrome.tabs.onUpdated.addListener(tabUpdateListener);

      // Timeout to prevent hanging
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        currentStep++;
        executeStep();
      }, 10000); // 10 seconds timeout
  }
}

function waitForPageLoad(tabId) {
  chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, info) {
    if (tabIdUpdated === tabId && info.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      currentStep++;
      executeStep();
    }
  });
}

function highlightAndExecuteStep(step) {
  function getElement(selector) {
    if (selector.startsWith("id:")) {
      return document.getElementById(selector.slice(3));
    } else if (selector.startsWith("css:")) {
      return document.querySelector(selector.slice(4));
    }
    return null;
  }

  function waitForElement(selector, retries = 10, interval = 500) {
    return new Promise((resolve, reject) => {
      const element = getElement(selector);
      if (element) {
        resolve(element);
        return;
      }

      let retryCount = 0;
      const intervalId = setInterval(() => {
        retryCount++;
        const element = getElement(selector);
        if (element) {
          clearInterval(intervalId);
          resolve(element);
        } else if (retryCount >= retries) {
          clearInterval(intervalId);
          reject(new Error(`Element not found: ${selector}`));
        }
      }, interval);
    });
  }

  waitForElement(step.selector)
    .then((element) => {
      // Highlight element
      const originalBackground = element.style.backgroundColor;
      const originalOutline = element.style.outline;
      element.style.backgroundColor = "#ffeb3b";
      element.style.outline = "2px solid #ffc107";
      element.scrollIntoView({ behavior: "smooth", block: "center" });

      // Tooltip
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

      const rect = element.getBoundingClientRect();
      tooltip.style.top = `${rect.bottom + 5}px`;
      tooltip.style.left = `${rect.left}px`;

      // Execute action
      setTimeout(() => {
        if (step.action === "search") {
          element.value = step.input_text;
          element.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (step.action === "click") {
          element.click();
        }

        // Cleanup and notify
        setTimeout(() => {
          element.style.backgroundColor = originalBackground;
          element.style.outline = originalOutline;
          tooltip.remove();
          chrome.runtime.sendMessage({ type: "STEP_COMPLETE" });
        }, 1000);
      }, 1000);
    })
    .catch((error) => {
      alert(`Error: ${error.message}`);
      chrome.runtime.sendMessage({ type: "STEP_COMPLETE" });
    });
}
