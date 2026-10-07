// FILE: background.js
// Service worker for the LMS MCQ Helper Extension
// Handles API calls to Gemini for MCQ answers.

// --- Constants ---
// WARNING: Storing the API key directly here is insecure for public distribution.
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- Helper: API Error Parsing ---
// Parses potential errors from the Gemini API response for better reporting.
async function parseApiError(response) {
    let errorDetails = `HTTP status ${response.status}`;
    try {
        const errorData = await response.json();
        // Extract the specific error message if available in the expected structure
        errorDetails = errorData?.error?.message || JSON.stringify(errorData);
    } catch (parseError) {
        // If the error response wasn't JSON, try getting raw text
        try {
             errorDetails = await response.text() || errorDetails;
        } catch (textError) {
            // Ignore errors reading the text body if the original request failed badly
        }
    }
    return errorDetails;
}


// --- Function for MCQ Answers ---
// Takes question data, formats a prompt for Gemini, calls the API, and processes the response.
async function fetchAnswerForMCQ(questionData) {
  console.log("LMS BG (MCQ Mode): Preparing MCQ answer fetch.");

  // Validate incoming data
  if (!questionData?.question || !questionData.options?.length) {
      console.error("LMS BG Error (MCQ): Invalid question data received.", questionData);
      return "Error: Invalid or incomplete MCQ data received.";
  }

  const optionsString = questionData.options.join('\n');

  // Construct the prompt specifically for MCQ answering
  // Instructs the AI to choose the best fit from the list and provide a short explanation with keywords.
  const prompt = `Given the following multiple-choice question and options:\n\nQuestion:\n${questionData.question}\n\nOptions:\n${optionsString}\n\nAnalyze the question and the provided options. You MUST choose the single best answer strictly from the options list provided.\n\nInstructions:\n1. Select the option that most accurately answers the question according to your knowledge.\n2. **Important:** If you determine that none of the options are perfectly correct, you must still select the option from the list that represents the *best possible fit*. Do **not** state that none are correct.\n3. State the *full text* of the option you have selected (including the letter/number like 'a.' or '1.' if present).\n4. Provide a very concise explanation (**2-3 lines maximum**) justifying your choice.\n5. Within the explanation, identify the most important **keywords** (key technical terms or concepts) and enclose them in double asterisks, like **this**.\n\nFormat the response exactly like this:\n\nAnswer: [Full text of the chosen best option from the list]\nExplanation: [Your concise 2-3 line explanation with **keywords** marked]`;

  // console.log("LMS BG (MCQ Mode): Sending prompt snippet:", prompt.substring(0, 150) + "..."); // Uncomment for debugging

  try {
    // Make the API call
    const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    // Check for non-successful HTTP statuses
    if (!response.ok) {
        const errorDetails = await parseApiError(response);
        console.error("LMS BG Error (MCQ): API request failed.", errorDetails);
        throw new Error(`API Request Failed: ${errorDetails}`);
    }

    const data = await response.json();
    // console.log("LMS BG (MCQ Mode): Received API response:", data); // Uncomment for debugging

    // Extract the answer text from the expected location in the response
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log("LMS BG (MCQ Mode): Successfully parsed answer.");
        return data.candidates[0].content.parts[0].text.trim();
    }
    // Handle cases where the API blocked the request due to safety filters
    else if (data.promptFeedback?.blockReason) {
        const reason = data.promptFeedback.blockReason;
        console.warn(`LMS BG Warn (MCQ): Prompt blocked by API - ${reason}`);
        return `Error: Blocked by API - ${reason}`;
    }
    // Handle unexpected response structures
    else {
        console.warn("LMS BG Warn (MCQ): Unexpected API response structure.", data);
        return "Error: Could not parse valid answer from API response.";
    }
  } catch (error) {
    // Catch fetch errors (network issues) or errors thrown from response handling
    console.error("LMS BG Error (MCQ): Fetch or processing failed.", error);
    return `Error: ${error.message}`; // Return a formatted error message
  }
}


// --- Message Listener ---
// Listens for messages ONLY from the content script(s).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Log received message for debugging (optional)
  // console.log(`LMS BG: Received action "${request.action}" from tab ${sender.tab?.id}.`);

  // Only handle the "fetchAnswer" action for MCQs
  if (request.action === "fetchAnswer") {
    console.log("LMS BG (MCQ Mode): Processing 'fetchAnswer' action.");
    fetchAnswerForMCQ(request.data)
      .then(answer => {
          // console.log("LMS BG (MCQ Mode): Sending success response back."); // Uncomment for debugging
          sendResponse({ success: true, answer: answer });
      })
      .catch(error => {
          // Catch unexpected errors in the promise chain itself
          console.error("LMS BG Error (MCQ Catch): Unexpected error:", error);
          sendResponse({ success: false, error: error.message || "Unknown MCQ processing error." });
      });
    // **IMPORTANT**: Return true to indicate that sendResponse will be called asynchronously.
    // This keeps the message channel open until the .then() or .catch() executes.
    return true;
  }

  // Ignore other actions (like programming page requests from previous versions)
  console.warn(`LMS BG: Received unhandled action "${request.action}". Ignoring.`);
  return false; // Indicate no asynchronous response is planned for unknown actions
});

// --- Service Worker Lifecycle Events ---
chrome.runtime.onInstalled.addListener(() => {
    console.log("LMS MCQ Helper extension installed or updated.");
});

// Log when the service worker starts (useful for debugging termination issues)
console.log("LMS MCQ Helper Background Service Worker started/restarted.");