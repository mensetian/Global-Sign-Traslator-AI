# Global Sign Translator 🤟

> **Next-Gen Accessibility Tool** powered by **Google Gemini Multimodal AI**.
> Translates Sign Language (ASL) into spoken text in real-time using just a webcam.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue)
![Gemini](https://img.shields.io/badge/Google%20AI-Gemini%202.5-orange)

## 🚀 Overview

Global Sign Translator is a web-based application that uses computer vision and Large Language Models (LLMs) to bridge the communication gap for the Deaf and Hard of Hearing community. 

Unlike traditional classifiers that only recognize static images (A, B, C...), this app uses **Multimodal Analysis** to understand **context, motion, and sentence structure**, allowing for fluid conversation translation.

## ✨ Key Features

*   **Real-Time "Burst Mode" Analysis:** Captures a sequence of 3 frames (approx. 160ms window) to detect motion and dynamic signs, not just static poses.
*   **Contextual Memory:** The AI remembers previous words to construct grammatically correct sentences (e.g., merging "I" + "Want" -> "I want").
*   **Multilingual Support:** Translates ASL directly into **Spanish, English, and Portuguese**.
*   **Privacy First:** All processing is done via secure API calls; images are ephemeral and not stored permanently.
*   **High Performance:** Optimized image downscaling and burst capture for low-latency feedback.

---

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript
*   **Styling:** Tailwind CSS (Neon/Cyberpunk aesthetic)
*   **AI Model:** Google Gemini 2.5 Flash (via `@google/genai` SDK)
*   **Hardware Access:** Native WebRTC (`navigator.mediaDevices`)

---

## 🚦 Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   A Google Cloud API Key with access to **Gemini API**.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/global-sign-translator.git
    cd global-sign-translator
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    The app requires an API Key. In a standard Create React App or Vite environment, ensure your `process.env.API_KEY` is available.
    
    *Example (.env):*
    ```env
    REACT_APP_API_KEY=your_gemini_api_key_here
    # or for Vite
    VITE_API_KEY=your_gemini_api_key_here
    ```

4.  **⚠️ IMPORTANT: Disable Demo Mode**
    By default, the app might be in **DEMO MODE** (simulating translation for testing UI without API costs).
    
    Open `services/geminiService.ts` and change:
    ```typescript
    // Change this to FALSE to use the real Gemini API
    const IS_DEMO_MODE = false; 
    ```

5.  **Run the App**
    ```bash
    npm start
    # or
    npm run dev
    ```

---

## 📖 How It Works (Simplified)

1.  **Capture:** The `CameraFeed` component captures video frames.
2.  **Burst:** Every cycle, the app captures **3 frames** spaced 80ms apart.
3.  **Context:** The app bundles these images with the **current text on screen**.
4.  **Inference:** It sends this payload to Gemini 2.5 Flash.
5.  **Instruction:** The System Prompt tells Gemini to:
    *   Identify the sign in the video.
    *   Decide if it flows from the previous text (merge) or is a new idea (punctuation).
    *   Return the updated sentence.
6.  **Update:** The UI updates with the new translation.

*For a deep dive into the architecture, context management, and optimization strategies, read the [TECHNICAL_DOCS.md](./TECHNICAL_DOCS.md).*

---

## ⚡ Performance Tips

*   **Lighting:** Ensure the signer is well-lit.
*   **Background:** A plain background helps the AI focus on hand movements.
*   **Camera:** A higher frame rate webcam (30fps+) yields better motion detection results.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with ❤️ using Google Gemini API*