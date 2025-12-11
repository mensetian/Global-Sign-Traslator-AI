# Documentación Técnica: Global Sign Translator

Este documento describe la arquitectura técnica, el flujo de datos y las decisiones de ingeniería detrás del **Global Sign Translator**. El sistema utiliza Inteligencia Artificial Multimodal (Visión + Texto) para traducir lengua de señas en tiempo real.

---

## 1. Arquitectura General

La aplicación es una Single Page Application (SPA) construida con **React 19** y **TypeScript**. No utiliza un backend tradicional; toda la lógica de procesamiento reside en el cliente (navegador), comunicándose directamente con la API de **Google Gemini 1.5/2.5 Flash**.

### Componentes Principales

1.  **`App.tsx`**: Controlador principal (Orquestador). Gestiona el ciclo de vida de captura, el estado de la aplicación (Idle, Analyzing, Success) y la memoria de contexto.
2.  **`CameraFeed.tsx`**: Abstracción del hardware. Maneja el stream de video (`getUserMedia`), los permisos y la optimización de imágenes antes del envío.
3.  **`geminiService.ts`**: Capa de servicio. Construye el payload para la API, gestiona el Prompt Engineering y maneja errores de red/cuota.
4.  **`ResultsDisplay.tsx`**: Capa de presentación. Renderiza los resultados con animaciones y estados de confianza.

---

## 2. Estrategia de Captura: "Burst Mode" (Ráfaga)

Para solucionar el problema de la detección de movimiento (señas dinámicas vs. estáticas), el sistema no envía una sola foto. Implementa una estrategia de **Muestreo Temporal**.

### Flujo de Captura
En `App.tsx`, el ciclo de procesamiento (`processFrame`) ejecuta la siguiente secuencia:

1.  **Frame T0**: Captura imagen inicial.
2.  *Wait 80ms*: Espera optimizada.
3.  **Frame T1**: Captura imagen intermedia.
4.  *Wait 80ms*: Espera final.
5.  **Frame T2**: Captura imagen final.

*Nota:* Se redujo el tiempo de espera de 120ms a **80ms**. Esto genera una ventana de observación de ~160ms, ideal para detectar movimiento en señas rápidas sin introducir latencia excesiva que afecte la experiencia en tiempo real.

### Payload Multimodal
Las 3 imágenes se envían juntas en una sola solicitud a Gemini. Esto permite al modelo ver la "película" del gesto (aprox. 160-200ms de acción efectiva) y diferenciar entre:
*   Mano quieta (Seña estática).
*   Mano moviéndose de A a B (Seña dinámica).

---

## 3. Optimización de Rendimiento (Latencia)

Dado que enviamos 3 imágenes por ciclo, el ancho de banda es crítico. Se aplican optimizaciones agresivas en `CameraFeed.tsx` **antes** de enviar los datos:

*   **Redimensionamiento (Downscaling):** El video (idealmente 720p/1080p) se dibuja en un Canvas de **320px de ancho**.
    *   *Razón:* 320px es suficiente para que Gemini detecte dedos y posturas. Resoluciones mayores aumentan la latencia de subida sin mejorar significativamente la precisión semántica.
*   **Compresión JPEG:** Se utiliza calidad `0.5` (50%).
    *   *Razón:* Balance óptimo entre artefactos de compresión y tamaño de archivo (payload ligero).

---

## 4. Gestión de Contexto (Memoria Semántica)

Para lograr frases coherentes ("Hola" + "Yo" + "Quiero" -> "Hola, yo quiero..."), el sistema mantiene un estado de memoria.

### Lógica de "Prompt Engineering" (`geminiService.ts`)
El prompt enviado a Gemini incluye:
1.  **Input Visual:** Las 3 imágenes de la ráfaga.
2.  **Input Textual (Contexto):** El texto traducido hasta el momento (`previousContext`).

### Reglas del Sistema (System Instructions)
El modelo sigue reglas estrictas para evitar alucinaciones y "mezclas" incorrectas:

*   **APPEND vs MERGE:**
    *   Si la nueva seña tiene sentido gramatical con lo anterior, se fusiona.
    *   Si es una idea nueva, se separa con puntuación (punto seguido).
*   **Anti-Repetición:** Si el usuario mantiene la mano levantada (mismo gesto que el ciclo anterior), el modelo devuelve el contexto sin cambios (HOLD).
*   **Corrección:** Detección de gestos de negación (sacudir cabeza/mano) para borrar la última palabra.

---

## 5. Manejo de Errores y Cuotas

La API de Gemini tiene límites de velocidad (Rate Limits). La aplicación maneja robustamente los errores `429` (Too Many Requests):

1.  Detecta el error en `geminiService`.
2.  `App.tsx` entra en estado `isRateLimited`.
3.  La UI muestra una alerta "API Limit reached".
4.  El sistema pausa automáticamente el ciclo de captura por 10 segundos (Backoff) antes de reintentar, protegiendo la cuota del usuario.

---

## 6. Stack Tecnológico

*   **Frontend Library:** React 19.
*   **AI SDK:** `@google/genai` (SDK oficial para Gemini 1.5/2.5).
*   **Estilos:** Tailwind CSS (Diseño responsivo y efectos neón).
*   **Build Tool:** Vite (implícito en el entorno).

## 7. Modo Demo vs Producción

En `geminiService.ts`, existe una constante `IS_DEMO_MODE`.
*   **TRUE:** Simula respuestas predefinidas basadas en tiempo para grabar videos promocionales sin gastar API.
*   **FALSE:** Conecta a la API real para uso en producción.

---

**Autor:** Equipo de Ingeniería Global Sign Translator.