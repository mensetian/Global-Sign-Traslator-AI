# Global Sign Translator 🤟

> **Next-Gen Accessibility Tool** powered by **Google Gemini Multimodal AI**.
> Translates Sign Language (ASL) into spoken text in real-time using just a webcam.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue)
![Gemini](https://img.shields.io/badge/Google%20AI-Gemini%202.5%20Flash-orange)

Google AI Studio: https://ai.studio/apps/drive/1LsNrxOIlHoZ2JK9W_GGyjra0KHWk2MFd

## 🚀 Overview

Global Sign Translator is a web-based application that uses computer vision and Large Language Models (LLMs) to bridge the communication gap for the Deaf and Hard of Hearing community. 

Unlike traditional classifiers that only recognize static images (A, B, C...), this app uses **Multimodal Analysis** to understand **context, motion, and sentence structure**, allowing for fluid conversation translation.

## ✨ Key Features

*   **Real-Time "Continuous Flow" Analysis:** Uses a smart 1.5s silence timer to detect when a sign is finished before sending data, ensuring complete sentence capture.
*   **Contextual Memory:** The AI remembers previous words to construct grammatically correct sentences (e.g., merging "I" + "Want" -> "I want").
*   **Multilingual Support:** Translates ASL directly into **Spanish, English, and Portuguese**.
*   **Privacy First:** All processing is done via secure API calls; images are ephemeral and not stored permanently.
*   **High Precision Mode:** Optimized inputs (480px resolution) and strict temperature settings to maximize accuracy.

---

## 🛠️ Tech Stack & Model Selection

*   **Frontend:** React 19, TypeScript
*   **Styling:** Tailwind CSS (Neon/Cyberpunk aesthetic)
*   **AI Model:** Google Gemini 2.5 Flash (via `@google/genai` SDK)
*   **Hardware Access:** Native WebRTC (`navigator.mediaDevices`)

### 🧠 Why Gemini 2.5 Flash?

We deliberately chose **`gemini-2.5-flash`** as our core engine. Here is the engineering reasoning:

1.  **Cost Efficiency:** At ~$0.05/hour of continuous use, it is 50x cheaper than Pro models, making accessible technology affordable for everyone.
2.  **Latency is King:** For a real-time translator, the user experience depends on immediate feedback. The "Flash" model family is architected for **high throughput**.
3.  **Precision Engineering:** We compensate for the smaller model size by feeding it higher resolution images (480px) and using strict temperature controls (0.1) to prevent hallucinations.

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

4.  **Run the App**
    ```bash
    npm start
    # or
    npm run dev
    ```

---

## ⚡ Performance Tips

*   **Lighting:** Ensure the signer is well-lit.
*   **Background:** A plain background helps the AI focus on hand movements.
*   **Camera:** The app automatically requests 480px resolution for better finger tracking.

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