# Quota & Cost Estimation: Global Sign Translator (Flash Edition)

This document details resource consumption using the **`gemini-2.5-flash`** model with the optimized "Continuous Flow" architecture.

> **CURRENT STATUS:** High-efficiency configuration. Maximum possible precision at the lowest cost.

---

## 1. Breakdown per Request

The system uses a dynamic sampling system that triggers only after detecting movement and confirming a pause.

### A. Input Cost (Input Tokens)
*   **Images:** 4 frames at **480px** (High Quality for finger precision).
    *   Multimodal Tokenization: ~258 tokens per image.
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

The Google AI Studio free tier is extremely generous for this model.

| Limit | Value | App Consumption | Status |
| :--- | :--- | :--- | :--- |
| **RPM (Requests/min)** | 15 RPM | **~8 - 10 RPM** | **Safe** ✅ |
| **TPM (Tokens/min)** | 1 Million TPM | ~13,500 TPM | Very Low |
| **RPD (Requests/day)** | 1,500 RPD | - | See below |

### Daily Free Usage Duration
Thanks to the 1.5-second "silence" timer acting as a natural regulator:
$$ 1,500 \text{ requests} / 9 \text{ RPM} \approx 2 \text{ hours and 45 minutes of continuous conversation daily.} $$

---

## 3. Analysis: Pay-as-you-go Plan

If you require more than 3 hours daily, the cost is trivial.

**Pricing (Gemini 2.5 Flash):**
*   Input: $0.075 / 1M tokens.
*   Output: $0.30 / 1M tokens.

### Cost per Hour of Continuous Usage
1.  **Input Tokens in 1 hour (60 min x 9 RPM):**
    *   540 requests x 1,332 tokens = **719,280 tokens**.
    *   Input Cost: ~$0.054 USD.

**Total Estimated Cost:** **~$0.05 - $0.06 USD per hour**.

---

## 4. Engineering Summary

We have achieved an ideal balance:
1.  **High-Quality Input:** We use 480px images (better than the standard 320px) so the "Flash" model sees details better.
2.  **Economical Model:** We use `gemini-2.5-flash` to keep costs near zero.
3.  **Smart Logic:** The code forces precision by lowering `temperature` to 0.1 and using `topK` to prevent hallucinations.