# Estimación de Cuota y Costos: Global Sign Translator

Este documento detalla el consumo de recursos de la API de Google Gemini (modelo `gemini-2.5-flash`) basado en la arquitectura actual de la aplicación (Ráfaga de 3 imágenes + Detección de manos en cliente).

---

## 1. Desglose por Petición (Request)

Cada vez que la aplicación detecta manos y decide traducir, envía una "Petición". Esta petición se compone de:

### A. Costo de Entrada (Input Tokens)
*   **Imágenes:** Enviamos 3 imágenes (frames) por petición.
    *   Gemini 2.5 Flash consume aproximadamente **258 tokens por imagen** estándar.
    *   3 imágenes x 258 tokens = **774 tokens**.
*   **Texto (Prompt + Contexto):**
    *   Instrucciones del sistema + Historial de contexto breve + JSON Schema.
    *   Estimación promedio: **~300 tokens**.

**Total por Petición:** ~1,074 Tokens.

### B. Costo de Salida (Output Tokens)
*   La respuesta es un JSON pequeño (`{"traduccion": "...", "confianza": "..."}`).
*   Estimación promedio: **~40 tokens**.

---

## 2. Escenarios de Uso

### Escenario A: Usuario inactivo (Sin manos en cámara)
Gracias a la implementación de **MediaPipe** en el cliente:
*   **Consumo:** 0 Tokens.
*   **Peticiones:** 0 RPM (Requests Per Minute).
*   **Costo:** $0.00.

### Escenario B: Usuario activo (Haciendo señas continuamente)
La aplicación tiene un retraso de seguridad (`minimumDelay`) de 2.5 segundos + tiempo de inferencia (~1s).
*   **Frecuencia:** Aprox. 1 petición cada 3.5 - 4 segundos.
*   **Ritmo (RPM):** ~15 a 17 Peticiones por minuto.

---

## 3. Análisis: Plan Gratuito (Free Tier)

El plan gratuito de Google AI Studio tiene límites estrictos.

| Límite | Valor | Consumo de la App (Activa) | Estado |
| :--- | :--- | :--- | :--- |
| **RPM (Peticiones/min)** | 15 RPM | ~15-17 RPM | **Al límite** (La app pausa si se excede) |
| **TPM (Tokens/min)** | 1 Millón TPM | ~18,000 TPM | Seguro (Muy por debajo) |
| **RPD (Peticiones/día)** | 1,500 RPD | - | Ver cálculo abajo |

### ¿Cuánto tiempo puedo usar la app gratis al día?
Con un límite de 1,500 peticiones al día y un ritmo de 15 peticiones por minuto:
$$ 1,500 \text{ peticiones} / 15 \text{ RPM} = 100 \text{ minutos} $$

**Conclusión Free Tier:** Puedes usar la aplicación de forma continua durante **1 hora y 40 minutos al día** sin pagar nada. Si excedes las 15 peticiones en un solo minuto, la app mostrará la alerta amarilla y pausará 10 segundos.

---

## 4. Análisis: Plan de Pago (Pay-as-you-go)

Si vinculas una cuenta de facturación de Google Cloud, los límites de RPM aumentan drásticamente (a miles) y pagas por uso.

**Precios Estimados (Gemini 1.5/2.5 Flash):**
*   **Input (Imágenes/Texto):** $0.075 USD por 1 millón de tokens.
*   **Output (Respuesta):** $0.30 USD por 1 millón de tokens.

### Costo por Hora de Uso Continuo
1.  **Tokens de Entrada en 1 hora:**
    *   15 RPM x 60 min = 900 peticiones.
    *   900 peticiones x 1,074 tokens = **966,600 tokens**.
    *   Costo Input: ~$0.072 USD.
2.  **Tokens de Salida en 1 hora:**
    *   900 peticiones x 40 tokens = 36,000 tokens.
    *   Costo Output: ~$0.00001 USD (despreciable).

**Costo Total Estimado:** **$0.07 - $0.08 USD por hora** de traducción continua.

---

## 5. Resumen Ejecutivo

*   **Para Desarrollo/Hobby:** El plan gratuito es suficiente (permite ~1.5 horas de uso diario). La protección contra errores 429 implementada en la app gestiona los picos de uso.
*   **Para Producción Comercial:** El costo es extremadamente bajo. Con $1.00 USD podrías dar servicio de traducción continua durante aproximadamente **12 a 13 horas**.

### Recomendaciones para Optimizar
1.  **Ajustar `minimumDelay`:** Si subes el retraso en `App.tsx` de 2500ms a 4000ms, bajarás las RPM a ~12, asegurando que nunca toques el límite gratuito, aunque la traducción se sentirá un poco menos fluida.
2.  **Modo de Espera:** La detección de manos de MediaPipe es la mayor optimización actual, ahorrando el 100% de la cuota cuando el usuario no está firmando activamente.
