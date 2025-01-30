chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STEP_COMPLETE") {
    chrome.runtime.sendMessage({ type: "NEXT_STEP" });
  }
});
