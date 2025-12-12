# Estimación de Cuota y Costos: Global Sign Translator (Flash Edition)

Este documento detalla el consumo de recursos utilizando el modelo **`gemini-2.5-flash`** con la arquitectura de "Flujo Continuo" optimizada.

> **ESTADO ACTUAL:** Configuración de alta eficiencia. Máxima precisión posible al menor costo.

---

## 1. Desglose por Petición (Request)

El sistema utiliza un sistema de muestreo dinámico que se activa solo después de detectar movimiento y confirmar una pausa.

### A. Costo de Entrada (Input Tokens)
*   **Imágenes:** 4 frames a **480px** (Alta Calidad para precisión de dedos).
    *   Tokenización Multimodal: ~258 tokens por imagen.
    *   4 imágenes x 258 tokens = **1,032 tokens**.
*   **Texto:**
    *   Instrucciones del sistema + Historial de contexto.
    *   Estimación promedio: **~300 tokens**.

**Total por Petición:** ~1,332 Tokens.

### B. Costo de Salida (Output Tokens)
*   La respuesta es un JSON estricto.
*   Estimación promedio: **~30-40 tokens**.

---

## 2. Escenarios de Uso (Free Tier)

El plan gratuito de Google AI Studio es extremadamente generoso para este modelo.

| Límite | Valor | Consumo App | Estado |
| :--- | :--- | :--- | :--- |
| **RPM (Peticiones/min)** | 15 RPM | **~8 - 10 RPM** | **Seguro** ✅ |
| **TPM (Tokens/min)** | 1 Millón TPM | ~13,500 TPM | Muy bajo |
| **RPD (Peticiones/día)** | 1,500 RPD | - | Ver abajo |

### Duración de Uso Gratuito Diario
Gracias al temporizador de "silencio" de 1.5 segundos que actúa como regulador natural:
$$ 1,500 \text{ peticiones} / 9 \text{ RPM} \approx 2 \text{ horas y 45 minutos diarios de conversación continua.} $$

---

## 3. Análisis: Plan de Pago (Pay-as-you-go)

Si necesitas más de 3 horas diarias, el costo es trivial.

**Precios (Gemini 2.5 Flash):**
*   Input: $0.075 / 1M tokens.
*   Output: $0.30 / 1M tokens.

### Costo por Hora de Uso Continuo
1.  **Tokens de Entrada en 1 hora (60 min x 9 RPM):**
    *   540 peticiones x 1,332 tokens = **719,280 tokens**.
    *   Costo Input: ~$0.054 USD.

**Costo Total Estimado:** **~$0.05 - $0.06 USD por hora**.

---

## 4. Resumen de Ingeniería

Hemos logrado un equilibrio ideal:
1.  **Input de Alta Calidad:** Usamos imágenes de 480px (mejor que el estándar 320px) para que el modelo "Flash" vea mejor los detalles.
2.  **Modelo Económico:** Usamos `gemini-2.5-flash` para mantener el costo casi nulo.
3.  **Lógica Inteligente:** El código fuerza la precisión bajando la `temperature` a 0.1 y usando `topK` para evitar alucinaciones.