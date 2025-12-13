// FILE: popup.js
document.getElementById("reloadPage").addEventListener("click", () => {
  // Find the currently active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Check if a valid tab was found
    if (tabs[0]?.id) {
      // Reload the found tab
      chrome.tabs.reload(tabs[0].id);
      // Close the popup window after clicking the button
      window.close();
    } else {
      // Log an error if the active tab couldn't be identified
      console.error("Could not get active tab ID to reload.");
    }
  });
});