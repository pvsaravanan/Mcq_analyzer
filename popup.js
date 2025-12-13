// FILE: popup.js

document.addEventListener('DOMContentLoaded', function() {
    const autoClickNextToggle = document.getElementById('autoClickNextToggle');
    const showAnswerBoxToggle = document.getElementById('showAnswerBoxToggle');

    // Load saved states from Chrome storage
    chrome.storage.sync.get(['autoClickNextEnabled', 'showAnswerBoxEnabled'], function(data) {
        autoClickNextToggle.checked = data.autoClickNextEnabled !== false; // Default to true if not set
        showAnswerBoxToggle.checked = data.showAnswerBoxEnabled !== false; // Default to true if not set
    });

    // Save state when Auto-click Next Question toggle changes
    autoClickNextToggle.addEventListener('change', function() {
        chrome.storage.sync.set({ 'autoClickNextEnabled': this.checked }, function() {
            console.log('Auto-click Next Question setting saved:', autoClickNextToggle.checked);
        });
    });

    // Save state and send message to content script when Display Answer Box toggle changes
    showAnswerBoxToggle.addEventListener('change', function() {
        const isEnabled = this.checked;
        chrome.storage.sync.set({ 'showAnswerBoxEnabled': isEnabled }, function() {
            console.log('Display Answer Box setting saved:', isEnabled);

            // Send a message to the content script in the active tab
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "updateAnswerBoxVisibility",
                        isEnabled: isEnabled
                    }, function(response) {
                        if (chrome.runtime.lastError) {
                            console.error("Error sending message to content script:", chrome.runtime.lastError.message);
                        } else {
                            console.log("Response from content script:", response);
                        }
                    });
                }
            });
        });
    });
});