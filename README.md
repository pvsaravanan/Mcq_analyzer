# LMS MCQ Helper

A Chrome extension (Manifest V3) that detects multiple-choice questions on Saveetha LMS pages, asks Google Gemini for the best answer, and shows the answer with a short explanation in a draggable box on the page.

## Features

- Detects the question and options on Moodle quiz pages
- Gets an answer and a 2–3 line explanation from Gemini, with keywords highlighted
- Shows the result in a draggable box
- Optional: selects the suggested answer and clicks **Next** automatically
- Popup switches to turn the answer box and auto-click on or off

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension configuration and the LMS sites it runs on |
| `content.js` | Reads the question from the page, shows the answer box, and handles auto-select / auto-next |
| `background.js` | Sends the question to the Gemini API and returns the response |
| `popup.html` / `popup.js` | Settings popup with the two switches |
| `style.css` | Scrollbar styles for the answer box |

## Installation

1. Clone or download this repository.
2. Set your Gemini API key in `GEMINI_API_KEY` at the top of `background.js`.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and select this folder.

## Usage

1. Open a quiz page on one of the supported LMS sites.
2. The answer box appears in the top-right corner after the question is detected. Drag it anywhere.
3. Click the extension icon to change the settings:
   - **Auto-click Next Question**: selects the suggested option and moves to the next question (on by default)
   - **Display Answer Box**: shows or hides the answer box (on by default)

## Supported sites

- `lms.saveetha.in`
- `lms2.eee.saveetha.in`
- `lms2.cse.saveetha.in`
- `lms2.ai.saveetha.in`
- `training.saveetha.in`

To add more sites, edit `content_scripts.matches` in `manifest.json` and reload the extension.

## Notes

- AI answers can be wrong. Check them before relying on them.
- Don't commit a real API key to a public repository.
- Check your institution's academic integrity policy before using this on graded assessments.
