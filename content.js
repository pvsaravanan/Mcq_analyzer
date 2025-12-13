// FILE: content.js
// This script runs on the matched pages (specified in manifest.json).
// It detects Multiple Choice Questions (MCQs) and requests answers from the background script.

// --- Global variables to store the current states ---
let autoClickNextEnabled = true; // Default to true
let showAnswerBoxEnabled = true; // Default to true for the new toggle

// --- Function to update the auto-click/select behavior ---
function updateAutoBehavior(isEnabled) {
    autoClickNextEnabled = isEnabled;
    console.log(`LMS ContentJS: Auto-select/Auto-click is now ${autoClickNextEnabled ? 'ENABLED' : 'DISABLED'}`);
    // No need to undo selections here; the user has seen the answer already.
}

// --- Function to update the answer box visibility ---
function updateAnswerBoxVisibility(isEnabled) {
    showAnswerBoxEnabled = isEnabled;
    console.log(`LMS ContentJS: Answer box visibility is now ${showAnswerBoxEnabled ? 'ENABLED' : 'DISABLED'}`);
    const box = document.getElementById("lmsGeminiAnswerBox");
    if (box) {
        // Set the display style based on the enabled state
        box.style.display = isEnabled ? 'block' : 'none'; // 'block' is common for a div
    }
}

// --- Listener for storage changes ---
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        if (changes.autoClickNextEnabled) {
            const oldVal = changes.autoClickNextEnabled.oldValue;
            const newVal = changes.autoClickNextEnabled.newValue;
            updateAutoBehavior(newVal);

            // Check if the toggle was just enabled (changed from false to true)
            // This ensures a page reload only occurs when enabling the auto-feature
            if (oldVal === false && newVal === true) {
                console.log("LMS ContentJS: Auto-click/Auto-select enabled. Reloading page...");
                window.location.reload(); // Reload the current page
            }
        }
        if (changes.showAnswerBoxEnabled) {
            const newVal = changes.showAnswerBoxEnabled.newValue;
            updateAnswerBoxVisibility(newVal); // Update visibility immediately
        }
    }
});

// --- Listener for messages from other parts of the extension (e.g., popup) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateAnswerBoxVisibility") {
        updateAnswerBoxVisibility(request.isEnabled);
        sendResponse({status: "visibility updated"}); // Acknowledge message back to popup
    }
    // Add other message handlers here if needed
    return true; // Important: Return true to indicate you wish to send a response asynchronously
});

// --- MCQ Detection Function ---
function getQuestionAndOptions() {
    // Selectors for the main question text element
    const questionSelectors = [
        '.que .qtext',
        '.assessment-question .question-content',
        '.QuestionArea .question-text',
        'div[role="main"] .text_content',
        '#question-text',
    ];
    // Selectors for the individual answer option elements
    const optionSelectors = [
        '.que .answer .r0',
        '.que .answer .r1',
        '.que .answer .specificOptionClass',
        '.answer-option',
        'li.choice-item',
        'label.mcq-option',
        'div.abc-option-class > span'
    ];

    let questionText = null, options = [], questionElement = null;

    // Find the question text element
    for (const selector of questionSelectors) {
        questionElement = document.querySelector(selector);
        if (questionElement?.innerText) {
            questionText = questionElement.innerText.trim();
            break;
        }
    }

    // If no question text found, it's not a detectable MCQ page
    if (!questionText || !questionElement) {
        return null;
    }

    let searchContext = document;
    // Try to narrow search for options to the question's container if possible
    const questionContainer = questionElement.closest('.que, .question_container, .assessment-question, .question-entry');
    if (questionContainer) {
        searchContext = questionContainer;
    }

    // Find option elements within the determined context
    searchContext.querySelectorAll(optionSelectors.join(', ')).forEach(optionEl => {
        const optionText = optionEl.innerText.trim();
        if (optionText && !options.includes(optionText)) {
            options.push(optionText);
        }
    });

    // Fallback: If specific option selectors failed, try finding common elements within a standard answer block
    if (options.length === 0 && questionContainer) {
        const answerBlock = questionContainer.querySelector('.answer, .answer_choices, .question-options, .control');
        if (answerBlock) {
            answerBlock.querySelectorAll('div, li, label').forEach(potentialOption => {
                const optionText = potentialOption.innerText.trim();
                // Basic filtering to avoid irrelevant elements
                if (optionText && optionText.length < 200 && optionText.length > 1 &&
                    !questionText.includes(optionText) &&
                    !options.includes(optionText) &&
                    !potentialOption.querySelector('input[type="submit"], button')
                    )
                {
                    if (potentialOption.tagName === 'LABEL'){
                        options.push(optionText);
                    } else if (!potentialOption.querySelector('input[type="radio"], input[type="checkbox"]')) {
                        options.push(optionText);
                    }
                }
            });
        }
    }

    // Need at least two options to be considered a valid MCQ
    if (options.length < 2) {
        return null;
    }

    console.log("LMS ContentJS: Detected MCQ Data:", { question: questionText, options: options });
    return { question: questionText, options: options };
}

function selectRadioAnswer(correctAnswer) {
    const answerParts = correctAnswer.split('.');
    if (answerParts.length < 2) {
        console.warn("Could not parse answer:", correctAnswer);
        return false;
    }

    const expectedText = correctAnswer.substring(correctAnswer.indexOf('.') + 1).trim();
    const answerContainer = document.querySelector('.answer');
    if (!answerContainer) {
        console.warn("No answer container found.");
        return false;
    }

    const optionBlocks = answerContainer.querySelectorAll('div.r0, div.r1');

    for (const block of optionBlocks) {
        const optionTextDiv = block.querySelector('div.flex-fill.ml-1');
        if (!optionTextDiv) continue;

        const optionText = optionTextDiv.innerText.trim();

        if (optionText.toLowerCase() === expectedText.toLowerCase()) {
            const radioInput = block.querySelector('input[type="radio"]');
            if (radioInput) {
                radioInput.checked = true;
                const event = new Event('change', { bubbles: true });
                radioInput.dispatchEvent(event);

                console.log(`Selected answer radio button for: ${correctAnswer}`);
                return true;
            }
        }
    }
    console.warn(`Could not find a matching radio button for answer: ${correctAnswer}`);
    return false;
}

function clickNextButton() {
    const nextButton = document.querySelector('input.mod_quiz-next-nav.btn.btn-primary[type="submit"][name="next"]');
    if (nextButton) {
      nextButton.click();
      console.log("Next button clicked.");
    } else {
      console.warn("Next button not found.");
    }
}

// --- MCQ Answer Box Display Function ---
function showAnswerBox(initialContentHtml = "Loading...") {
    let box = document.getElementById("lmsGeminiAnswerBox");
    if (!box) {
        // Create the box element if it doesn't exist
        box = document.createElement("div");
        box.id = "lmsGeminiAnswerBox";
        box.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 350px;
            max-height: 450px;
            overflow-y: auto;
            z-index: 99999;
            background: linear-gradient(145deg, #ffffff, #f0f0f0);
            border: 1px solid #cccccc;
            border-radius: 10px;
            padding: 18px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.15);
            cursor: move;
            font-size: 14px;
            line-height: 1.6;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            user-select: none;
            white-space: normal;
        `;
        document.body.appendChild(box);

        // --- Draggable Logic (Attached once on creation) ---
        let isDragging = false, startX, startY, initialX, initialY;
        const header = box.querySelector('.lms-panel-header');
        const dragHandle = header || box;

        dragHandle.onmousedown = (e) => {
            // Prevent drag if clicking on scrollbar (heuristic)
            if (e.target === dragHandle && e.offsetX > dragHandle.clientWidth) {
                return;
            }
            // Prevent drag if clicking on interactive elements inside the box
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = box.getBoundingClientRect();
            initialX = rect.left; initialY = rect.top;
            box.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMove, { passive: false });
            document.addEventListener('mouseup', onMouseUp);
        };
        const onMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            let newX = initialX + e.clientX - startX;
            let newY = initialY + e.clientY - startY;
            const BORDER_MARGIN = 5;
            newX = Math.max(BORDER_MARGIN, Math.min(newX, window.innerWidth - box.offsetWidth - BORDER_MARGIN));
            newY = Math.max(BORDER_MARGIN, Math.min(newY, window.innerHeight - box.offsetHeight - BORDER_MARGIN));
            box.style.left = `${newX}px`; box.style.top = `${newY}px`;
            box.style.right = 'auto'; box.style.bottom = 'auto';
        };
        const onMouseUp = (e) => {
            if (isDragging) {
                isDragging = false;
                box.style.userSelect = '';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        };
        box.ondragstart = () => false;
        // --- End Draggable Logic ---
    }

    // Always update content.
    box.innerHTML = initialContentHtml;

    // Apply visibility setting. This is crucial for *initial* display based on saved state.
    // This line was previously applying after innerHTML was set, which is correct for updates,
    // but the key was to ensure the global `showAnswerBoxEnabled` variable is read *before*
    // any attempt to show the box.
    box.style.display = showAnswerBoxEnabled ? 'block' : 'none';
}

// --- MCQ Response Formatting Function ---
function formatResponseText(rawText) {
    if (typeof rawText !== 'string') {
        console.error("LMS ContentJS: formatResponseText received non-string input:", rawText);
        return `<span style="color: red;">Error: Invalid response format received.</span>`;
    }
    let formattedHtml = "";
    let answerPart = rawText;
    let explanationPart = "";

    const explanationIndex = rawText.toLowerCase().indexOf("explanation:");
    if (explanationIndex !== -1) {
        const boundary = rawText.substring(explanationIndex, explanationIndex + "Explanation:".length);
        const parts = rawText.split(boundary, 2);
        answerPart = parts[0].replace(/Answer:/i, '').trim();
        explanationPart = parts[1]?.trim() || "";
    } else {
        console.warn("LMS ContentJS: 'Explanation:' keyword not found, using fallback split.");
        const lines = rawText.replace(/Answer:/i, '').trim().split('\n');
        answerPart = lines[0]?.trim() || rawText;
        explanationPart = lines.slice(1).join('\n').trim();
    }

    let colorIndex = 0;
    const bgColors = ['#dff0d8', '#fcf8e3'];
    const textColors = ['#3c763d', '#8a6d3b'];

    try {
        explanationPart = explanationPart.replace(/\*\*(.*?)\*\*/g, (match, keyword) => {
            const bgColor = bgColors[colorIndex % bgColors.length];
            const textColor = textColors[colorIndex % textColors.length];
            colorIndex++;
            const sanitizedKeyword = keyword.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<span style="background-color: ${bgColor}; color: ${textColor}; padding: 1px 4px; border-radius: 4px; font-weight: bold; display: inline-block; margin: 0 1px;">${sanitizedKeyword}</span>`;
        });
    } catch (e) {
        console.error("LMS ContentJS: Error during keyword highlighting regex:", e);
    }

    const sanitizedAnswerPart = answerPart.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    formattedHtml = `<b>Answer:</b> ${sanitizedAnswerPart}<br><br><b>Explanation:</b> ${explanationPart}`;
    return formattedHtml;
}


// --- Main Execution Logic ---
// Runs when the content script is injected. Checks ONLY for MCQs now.
(async function () {
    console.log("LMS Answer Box (MCQ Mode): Content script executing.");

    // 1. Get the initial values of both settings when the script loads
    // This MUST happen BEFORE any attempt to create or show the box.
    await new Promise(resolve => {
        chrome.storage.sync.get(['autoClickNextEnabled', 'showAnswerBoxEnabled'], function(data) {
            // Default to true if not explicitly set to false
            autoClickNextEnabled = data.autoClickNextEnabled !== false;
            // Ensure showAnswerBoxEnabled is correctly initialized (default true)
            showAnswerBoxEnabled = data.showAnswerBoxEnabled !== false;
            console.log(`LMS ContentJS: Initial autoClickNextEnabled state: ${autoClickNextEnabled}`);
            console.log(`LMS ContentJS: Initial showAnswerBoxEnabled state: ${showAnswerBoxEnabled}`);
            resolve();
        });
    });

    // Wait briefly for dynamic elements (like question text) to load
    await new Promise(resolve => setTimeout(resolve, 600)); // Small delay

    try {
        // --- Check for MCQ ---
        const mcqData = getQuestionAndOptions();

        if (mcqData) {
            console.log("LMS Answer Box (MCQ Mode): MCQ Question detected.");
            // Show the draggable box with a loading message.
            // Crucially, `showAnswerBox` will now correctly apply `showAnswerBoxEnabled`
            // immediately after creating the box.
            showAnswerBox("🧠 Thinking... Contacting background script...");

            try {
                // Send MCQ data to background for Gemini processing
                console.log("LMS Answer Box (MCQ Mode): Sending 'fetchAnswer' request to background...");
                const response = await chrome.runtime.sendMessage({ action: "fetchAnswer", data: mcqData });

                if (response?.success) {
                    const formattedHtml = formatResponseText(response.answer);
                    // Update content. `showAnswerBox` will re-apply visibility.
                    showAnswerBox(formattedHtml);

                    // Only attempt auto-selection and auto-click if autoClickNextEnabled is true
                    if (autoClickNextEnabled) {
                        const answerMatch = response.answer.match(/Answer:\s*(.*)/i);
                        if (answerMatch && answerMatch[1]) {
                            const selected = selectRadioAnswer(answerMatch[1].trim());
                            if (!selected) {
                                console.warn("Failed to auto-select the radio answer.");
                            } else {
                                // If selection was successful, then auto-click next
                                clickNextButton();
                            }
                        }
                    } else {
                        console.log("Auto-select and Auto-click Next Question are disabled by user preference.");
                    }
                } else {
                    // Display error received from background script
                    const errorMessage = response?.error || "Unknown error from background script.";
                    console.error("LMS ContentJS Error (MCQ): Error from background:", errorMessage);
                    // Still show the box with an error, respecting the showAnswerBoxEnabled setting
                    showAnswerBox(`<span style="color: red;"><b>Error:</b> ${errorMessage}</span>`);
                }
            } catch (error) {
                // Handle errors communicating with the background script
                console.error("LMS ContentJS Error (MCQ): Error communicating with background:", error);
                let displayError = error.message || "Unknown communication error.";
                if (displayError.includes("Could not establish connection") || displayError.includes("Receiving end does not exist")) {
                    displayError = "Could not connect to the background script. Please ensure the extension is enabled correctly and try reloading the page.";
                }
                showAnswerBox(`<span style="color: red;"><b>Connection Error:</b> ${displayError}</span>`);
            }
        } else {
            // No MCQ detected on this page
            console.log("LMS Answer Box (MCQ Mode): No MCQ question detected on this page.");
            // If no MCQ is detected, remove any existing answer box to keep the page clean.
            const existingBox = document.getElementById("lmsGeminiAnswerBox");
            if (existingBox) existingBox.remove();
        }
    } catch (error) {
        // Catch any critical errors during the main execution flow
        console.error("LMS Answer Box (MCQ Mode): Critical error during script execution:", error);
        // Optionally, display a general error message if possible
        // showAnswerBox(`<span style="color: red;"><b>Critical Error:</b> ${error.message}</span>`);
    }
})();