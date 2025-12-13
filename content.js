// FILE: content.js
// This script runs on the matched pages (specified in manifest.json).
// It detects Multiple Choice Questions (MCQs) and requests answers from the background script.

// --- MCQ Detection Function ---
// Tries to find elements typical of a Multiple Choice Question page.
// Returns { question, options } object if MCQ detected, otherwise null.
function getQuestionAndOptions() {
    // console.log("LMS ContentJS: Checking for MCQ elements..."); // Uncomment for debugging
    // Selectors for the main question text element
    const questionSelectors = [
        '.que .qtext',                          // Moodle specific?
        '.assessment-question .question-content', // General assessment structure
        '.QuestionArea .question-text',         // Another common pattern
        'div[role="main"] .text_content',         // Canvas structure?
        '#question-text',                       // Specific ID
    ];
    // Selectors for the individual answer option elements
    const optionSelectors = [
        '.que .answer .r0',                     // Moodle options
        '.que .answer .r1',
        '.que .answer .specificOptionClass',    // Placeholder - Replace if known
        '.answer-option',                       // General option class
        'li.choice-item',                       // Options in list items
        'label.mcq-option',                     // Options associated with labels
        'div.abc-option-class > span'           // Example nested selector
    ];

    let questionText = null, options = [], questionElement = null;

    // Find the question text element
    for (const selector of questionSelectors) {
        questionElement = document.querySelector(selector);
        if (questionElement?.innerText) {
            questionText = questionElement.innerText.trim();
            // console.log(`LMS ContentJS: Found MCQ question text using: ${selector}`); // Uncomment for debugging
            break;
        }
    }

    // If no question text found, it's not a detectable MCQ page
    if (!questionText || !questionElement) {
         // console.log("LMS ContentJS: MCQ Question text not found."); // Uncomment for debugging
         return null;
    }

    let searchContext = document; // Search whole document by default
    // Try to narrow search for options to the question's container if possible
    const questionContainer = questionElement.closest('.que, .question_container, .assessment-question, .question-entry'); // Common containers
    if (questionContainer) {
         searchContext = questionContainer;
         // console.log("LMS ContentJS: Searching for MCQ options within container:", questionContainer); // Uncomment for debugging
    } else {
        // console.log("LMS ContentJS: No question container found, searching document for options."); // Uncomment for debugging
    }

    // Find option elements within the determined context
    searchContext.querySelectorAll(optionSelectors.join(', ')).forEach(optionEl => {
        const optionText = optionEl.innerText.trim();
        // Add if text found and not already included
        if (optionText && !options.includes(optionText)) {
            options.push(optionText);
        }
    });

    // Fallback: If specific option selectors failed, try finding common elements within a standard answer block
    // This helps catch options that might not match the specific selectors above
    if (options.length === 0 && questionContainer) {
        const answerBlock = questionContainer.querySelector('.answer, .answer_choices, .question-options, .control'); // Common answer block classes/IDs
        if (answerBlock) {
            // console.log("LMS ContentJS: Trying MCQ option fallback search within:", answerBlock); // Uncomment for debugging
            answerBlock.querySelectorAll('div, li, label').forEach(potentialOption => { // Look for common option tags
                const optionText = potentialOption.innerText.trim();
                // Basic filtering to avoid irrelevant elements like submission buttons or feedback text
                if (optionText && optionText.length < 200 && optionText.length > 1 && // Avoid empty/very short strings
                    !questionText.includes(optionText) && // Avoid including parts of the question itself
                    !options.includes(optionText) && // Avoid duplicates
                    !potentialOption.querySelector('input[type="submit"], button') // Avoid buttons within the element
                   )
                {
                     // More specific checks might be needed here depending on structure
                     // If it's a label, it's highly likely an option
                     if (potentialOption.tagName === 'LABEL'){
                         options.push(optionText);
                     }
                     // If it's a simple div/li without inputs, might be an option (heuristic)
                     else if (!potentialOption.querySelector('input[type="radio"], input[type="checkbox"]')) {
                         options.push(optionText);
                     }
                }
            });
        }
    }

    // Need at least two options to be considered a valid MCQ
    if (options.length < 2) {
         // console.log("LMS ContentJS: Did not find sufficient MCQ options."); // Uncomment for debugging
         return null;
    }

    console.log("LMS ContentJS: Detected MCQ Data:", { question: questionText, options: options });
    return { question: questionText, options: options };
}

// --- MCQ Answer Box Display Function ---
// Creates or updates the draggable box used to display MCQ answers.
function showAnswerBox(initialContentHtml = "Loading...") {
    let box = document.getElementById("lmsGeminiAnswerBox");
    if (!box) {
        // Create the box element if it doesn't exist
        box = document.createElement("div");
        box.id = "lmsGeminiAnswerBox";
        // Apply styles using cssText for conciseness and better default look
        box.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 350px;
            max-height: 450px; /* Slightly taller */
            overflow-y: auto;
            z-index: 99999; /* High z-index */
            background: linear-gradient(145deg, #ffffff, #f0f0f0); /* Subtle gradient */
            border: 1px solid #cccccc;
            border-radius: 10px; /* Softer corners */
            padding: 18px; /* More padding */
            box-shadow: 0 6px 18px rgba(0,0,0,0.15); /* Enhanced shadow */
            cursor: move;
            font-size: 14px;
            line-height: 1.6; /* Improved readability */
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; /* Nicer font stack */
            color: #333;
            user-select: none; /* Prevent text selection during drag */
            white-space: normal; /* Allow HTML rendering */
        `;
        document.body.appendChild(box);

        // --- Draggable Logic (Attached once on creation) ---
        let isDragging = false, startX, startY, initialX, initialY;
        // Use header for dragging if exists, otherwise whole box
        const header = box.querySelector('.lms-panel-header'); // Assuming a header might be added later
        const dragHandle = header || box; // Drag the whole box if no specific header

        dragHandle.onmousedown = (e) => {
            // Prevent drag initiation on scrollbar or interactive elements within
             if (e.target !== dragHandle && window.getComputedStyle(e.target).overflowY === 'auto' && e.offsetX > e.target.clientWidth) return;
             if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'TEXTAREA') return; // Don't drag on controls

            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = box.getBoundingClientRect(); // Use getBoundingClientRect for fixed elements
            initialX = rect.left; initialY = rect.top;
            box.style.userSelect = 'none'; // Disable selection during drag
            document.addEventListener('mousemove', onMouseMove, { passive: false });
            document.addEventListener('mouseup', onMouseUp);
        };
        const onMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault(); // Prevent default page scroll/selection during drag
            let newX = initialX + e.clientX - startX;
            let newY = initialY + e.clientY - startY;
            const BORDER_MARGIN = 5; // Keep box somewhat on screen
            newX = Math.max(BORDER_MARGIN, Math.min(newX, window.innerWidth - box.offsetWidth - BORDER_MARGIN));
            newY = Math.max(BORDER_MARGIN, Math.min(newY, window.innerHeight - box.offsetHeight - BORDER_MARGIN));
            box.style.left = `${newX}px`; box.style.top = `${newY}px`;
            box.style.right = 'auto'; box.style.bottom = 'auto'; // Ensure left/top positioning takes precedence
        };
        const onMouseUp = (e) => {
            if (isDragging) {
                isDragging = false;
                box.style.userSelect = ''; // Re-enable selection after drag
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        };
        box.ondragstart = () => false; // Prevent default browser drag behavior
        // --- End Draggable Logic ---
    }
    // Update the box content (expects HTML)
    box.innerHTML = initialContentHtml;
}

// --- MCQ Response Formatting Function ---
// Takes the raw text response from the background script (for MCQs) and formats it with HTML.
function formatResponseText(rawText) {
    // Basic validation
    if (typeof rawText !== 'string') {
        console.error("LMS ContentJS: formatResponseText received non-string input:", rawText);
        return `<span style="color: red;">Error: Invalid response format received.</span>`;
    }
    let formattedHtml = "";
    let answerPart = rawText; // Default if splitting fails
    let explanationPart = "";

    // Split the response into Answer and Explanation parts, case-insensitive search
    const explanationIndex = rawText.toLowerCase().indexOf("explanation:");
    if (explanationIndex !== -1) {
        // Find the actual boundary while preserving case for splitting
        const boundary = rawText.substring(explanationIndex, explanationIndex + "Explanation:".length);
        const parts = rawText.split(boundary, 2); // Split only into two parts
        answerPart = parts[0].replace(/Answer:/i, '').trim(); // Remove "Answer:" prefix, ignore case
        explanationPart = parts[1]?.trim() || ""; // Get the part after "Explanation:", handle if empty
    } else {
        // Fallback: If "Explanation:" isn't found, assume first line is answer, rest is explanation
        console.warn("LMS ContentJS: 'Explanation:' keyword not found, using fallback split.");
        const lines = rawText.replace(/Answer:/i, '').trim().split('\n');
        answerPart = lines[0]?.trim() || rawText; // Assume first line is answer
        explanationPart = lines.slice(1).join('\n').trim(); // Rest is explanation
    }

    // --- Keyword Highlighting Logic ---
    let colorIndex = 0;
    // Define colors (can be customized)
    const bgColors = ['#dff0d8', '#fcf8e3']; // Light green, Light orange/yellowish
    const textColors = ['#3c763d', '#8a6d3b']; // Corresponding text colors for contrast

    // Replace markdown bold (**keyword**) with styled spans, alternating colors
    // Use a try-catch block for safety during regex replacement
    try {
        explanationPart = explanationPart.replace(/\*\*(.*?)\*\*/g, (match, keyword) => {
            const bgColor = bgColors[colorIndex % bgColors.length];
            const textColor = textColors[colorIndex % textColors.length];
            colorIndex++;
            // Basic sanitation to prevent injecting unwanted HTML via keyword content
            const sanitizedKeyword = keyword.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<span style="background-color: ${bgColor}; color: ${textColor}; padding: 1px 4px; border-radius: 4px; font-weight: bold; display: inline-block; margin: 0 1px;">${sanitizedKeyword}</span>`;
        });
    } catch (e) {
        console.error("LMS ContentJS: Error during keyword highlighting regex:", e);
        // Fallback: If regex fails, use the explanation part without highlights
    }
    // --- End of Highlighting Logic ---

    // Construct the final HTML with bold labels and line breaks
    // Ensure answerPart is also sanitized slightly for safety
    const sanitizedAnswerPart = answerPart.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    formattedHtml = `<b>Answer:</b> ${sanitizedAnswerPart}<br><br><b>Explanation:</b> ${explanationPart}`;
    return formattedHtml;
}


// --- Main Execution Logic ---
// Runs when the content script is injected. Checks ONLY for MCQs now.
(async function () {
  console.log("LMS Answer Box (MCQ Mode): Content script executing.");
  // Wait briefly for dynamic elements (like question text) to load
  await new Promise(resolve => setTimeout(resolve, 600)); // Small delay

  try {
      // --- Check for MCQ ---
      const mcqData = getQuestionAndOptions();

      if (mcqData) {
          // --- MCQ Detected ---
          console.log("LMS Answer Box (MCQ Mode): MCQ Question detected.");
          // Show the draggable box with a loading message
          showAnswerBox("🧠 Thinking... Contacting background script...");

          try {
              // Send MCQ data to background for Gemini processing
              console.log("LMS Answer Box (MCQ Mode): Sending 'fetchAnswer' request to background...");
              const response = await chrome.runtime.sendMessage({ action: "fetchAnswer", data: mcqData });
              // console.log("LMS ContentJS: Received MCQ response from background:", response); // Uncomment for debugging

              if (response?.success) {
                  // Format and display the successful MCQ answer
                  console.log("LMS Answer Box (MCQ Mode): Received successful answer from background.");
                  const formattedHtml = formatResponseText(response.answer);
                  showAnswerBox(formattedHtml);
              } else {
                  // Display error received from background script
                  const errorMessage = response?.error || "Unknown error from background script.";
                  console.error("LMS ContentJS Error (MCQ): Error from background:", errorMessage);
                  showAnswerBox(`<span style="color: red;"><b>Error:</b> ${errorMessage}</span>`);
              }
          } catch (error) {
              // Handle errors communicating with the background script
              console.error("LMS ContentJS Error (MCQ): Error communicating with background:", error);
              let displayError = error.message || "Unknown communication error.";
               // Provide more helpful messages for common communication errors
               if (displayError.includes("Could not establish connection") || displayError.includes("Receiving end does not exist")) {
                   displayError = "Could not connect to the background script. Please ensure the extension is enabled correctly and try reloading the page.";
               }
              showAnswerBox(`<span style="color: red;"><b>Connection Error:</b> ${displayError}</span>`);
          }
      } else {
          // No MCQ detected on this page
          console.log("LMS Answer Box (MCQ Mode): No MCQ question detected on this page.");
          // Optionally, remove any previous answer box if needed
          // const existingBox = document.getElementById("lmsGeminiAnswerBox");
          // if (existingBox) existingBox.remove();
      }
  } catch (error) {
      // Catch any critical errors during the main execution flow
      console.error("LMS Answer Box (MCQ Mode): Critical error during script execution:", error);
      // Optionally, display a general error message if possible
      // showAnswerBox(`<span style="color: red;"><b>Critical Error:</b> ${error.message}</span>`);
  }
})();