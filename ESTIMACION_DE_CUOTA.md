# Quota & Cost Estimation: Global Sign Translator (Gemini 3 Edition)

This document details resource consumption using the **`gemini-3-flash-preview`** model with the optimized "Continuous Flow" architecture.

---

## 1. Breakdown per Request

The system uses a dynamic sampling system that triggers only after detecting movement and confirming a pause.

### A. Input Cost (Input Tokens)
*   **Images:** 4 frames at **480px** (High Quality for finger precision).
    *   Multimodal Tokenization: ~258 tokens per image (Gemini 3 architecture).
    *   4 images x 258 tokens = **1,032 tokens**.
*   **Text:**
    *   System instructions + Context history.
    *   Average estimate: **~300 tokens**.

**Total per Request:** ~1,332 Tokens.

### B. Output Cost (Output Tokens)
*   The response is a strict JSON.
*   Average estimate: **~30-40 tokens**.

---

## 2. Usage Scenarios (Free Tier)

The Google AI Studio free tier for Gemini 3 Flash Preview is designed for testing and individual use.

| Limit | Value | App Consumption | Status |
| :--- | :--- | :--- | :--- |
| **RPM (Requests/min)** | 15 RPM | **~8 - 10 RPM** | **Safe** ✅ |
| **TPM (Tokens/min)** | 1 Million TPM | ~13,500 TPM | Very Low |
| **RPD (Requests/day)** | 1,500 RPD | - | High Capacity |

---

## 3. Pay-as-you-go Plan (Estimated)

If usage exceeds free tier limits, the "Flash" family remains the most cost-effective option.

**Standard Pricing (Gemini 3 Flash):**
*   Input: ~$0.075 / 1M tokens.
*   Output: ~$0.30 / 1M tokens.

### Cost per Hour of Continuous Usage
1.  **Input Tokens in 1 hour (60 min x 9 RPM):**
    *   540 requests x 1,332 tokens = **719,280 tokens**.
    *   Input Cost: ~$0.054 USD.

**Total Estimated Cost:** **~$0.05 - $0.06 USD per hour**.

---

## 4. Engineering Summary

We have achieved an ideal balance:
1.  **Upgraded Intelligence:** Using **Gemini 3 Flash Preview** provides better contextual reasoning.
2.  **High-Quality Input:** 480px images ensure the model has enough detail for precise handshape detection.
3.  **Smart Logic:** The system pauses for 1.5s to ensure a full gesture is captured, regulating API calls naturally.