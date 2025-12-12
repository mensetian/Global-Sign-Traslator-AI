# Technical Documentation: Global Sign Translator

This document outlines the technical architecture, data flow, and engineering decisions behind the **Global Sign Translator**. The system utilizes Multimodal Artificial Intelligence (Vision + Text) to translate sign language in real-time, optimized for the **Gemini 2.5 Flash** model.

---

## 1. General Architecture

The application is a Single Page Application (SPA) built with **React 19** and **TypeScript**. It does not use a traditional backend; all processing logic resides on the client (browser), communicating directly with the **Google GenAI SDK** API.

### Core Components

1.  **`App.tsx`**: Main Controller (Orchestrator). Manages the capture lifecycle, state machine, and "silence" logic (1.5s) to determine the end of a sentence.
2.  **`CameraFeed.tsx`**: Hardware Abstraction. Handles the video stream (`getUserMedia`), motion analysis with MediaPipe (strictly for triggers), and high-fidelity frame capture.
3.  **`geminiService.ts`**: Service Layer. Constructs the API payload and applies strict inference configurations to maximize Flash model precision.
4.  **`ResultsDisplay.tsx`**: Presentation Layer. Renders results with animations and confidence states.

---

## 2. Capture Strategy: "Dynamic Temporal Sampling"

Unlike previous versions that used fixed bursts, the current version employs a **Dynamic Circular Buffer** to capture the full evolution of a gesture.

### Capture Flow (`App.tsx`)
While the user is signing (detected by velocity > threshold):
1.  Frames are accumulated in a temporary buffer (`sessionFramesRef`).
2.  The buffer maintains the last ~25 frames (approx. 1-2 seconds of history).
3.  Upon detecting a sustained pause (1.5 seconds), analysis is triggered.

### Selection Algorithm (4-Frame Sampling)
To optimize temporal context without saturating the model's context window, the system mathematically selects **4 representative frames** from the buffer:
1.  **Start (0%):** Beginning of the gesture.
2.  **Early Development (33%):** Transition.
3.  **Late Development (66%):** Point of maximum extension or shape.
4.  **End (100%):** Final posture before rest.

This allows Gemini to understand the trajectory of the movement (ASL "Movement" Parameter) better than a single snapshot.

---

## 3. High Fidelity Optimization

To compensate for using a lighter model (Flash) versus a Pro model, we have increased the quality of visual input.

### Image Specifications (`CameraFeed.tsx`)
*   **Resolution:** **480px width** (Increased from 320px).
    *   *Reasoning:* Flash requires more pixels to distinguish complex finger configurations (e.g., the difference between 'M', 'N', and 'T').
*   **JPEG Compression:** Quality **0.7** (70%).
    *   *Reasoning:* Fewer compression artifacts around fingers to improve edge detection.

---

## 4. Model Configuration (Precision Engineering)

In `geminiService.ts`, we force the `gemini-2.5-flash` model to behave deterministically and analytically, avoiding the typical "creativity" of LLMs.

### Inference Parameters
*   **`temperature: 0.1`**: Extremely low value. Forces the model to choose the statistically most probable translation, eliminating hallucinations.
*   **`topK: 32`**: Restricts the output vocabulary to the 32 most likely options.
*   **`topP: 0.8`**: Strict nucleus sampling.

### System Prompt (System Instructions)
We instruct the model to explicitly analyze the **5 ASL Parameters**:
1.  **Handshape** (Shape of the hand).
2.  **Orientation** (Palm orientation).
3.  **Location** (Location relative to the body).
4.  **Movement** (Trajectory/Path).
5.  **Non-Manual Markers** (Facial expression).

---

## 5. Context Management (Semantic Memory)

To achieve coherent sentences, the system sends previous context along with new images.

*   **Visual Input:** 4 images (Current Payload).
*   **Text Input:** "Previous Context: [Accumulated text]".

**Merge Rule:** If the new sign grammatically complements the previous one (e.g., "I" -> "Want"), the model returns the merged phrase ("I want"). If it detects a topic change, it adds punctuation.

---

## 6. Error & Quota Handling

1.  **Exponential Backoff:** If the API returns `429` (Too Many Requests), the UI shows a yellow alert, and the system pauses capture for 10 seconds.
2.  **Noise Filter:** If the resulting translation is "..." or empty (meaning the model did not see a clear sign), the system discards it and does not update the UI, maintaining a clean experience.

---

## 7. Tech Stack

*   **Frontend Library:** React 19.
*   **AI SDK:** `@google/genai` (v1.32.0).
*   **Computer Vision (Client):** MediaPipe Tasks Vision (for hand *presence* detection and velocity calculation, not for translation).
*   **Computer Vision (Server):** Gemini 2.5 Flash Multimodal.
*   **Styling:** Tailwind CSS.

---

**Author:** Global Sign Translator Engineering Team.