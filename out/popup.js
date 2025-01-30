document
  .getElementById("startNavigation")
  .addEventListener("click", async () => {
    const stepsJson = document.getElementById("stepsInput").value;
    try {
      const steps = JSON.parse(stepsJson);
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      chrome.runtime.sendMessage({
        type: "START_NAVIGATION",
        steps,
        tabId: tab.id,
      });
    } catch (error) {
      alert("Invalid JSON format");
    }
  });
