# Documentación Técnica: Global Sign Translator

Este documento describe la arquitectura técnica, el flujo de datos y las decisiones de ingeniería detrás del **Global Sign Translator**. El sistema utiliza Inteligencia Artificial Multimodal (Visión + Texto) para traducir lengua de señas en tiempo real, optimizado para el modelo **Gemini 2.5 Flash**.

---

## 1. Arquitectura General

La aplicación es una Single Page Application (SPA) construida con **React 19** y **TypeScript**. No utiliza un backend tradicional; toda la lógica de procesamiento reside en el cliente (navegador), comunicándose directamente con la API de **Google GenAI SDK**.

### Componentes Principales

1.  **`App.tsx`**: Controlador principal (Orquestador). Gestiona el ciclo de vida de captura, la máquina de estados y la lógica de "silencio" (1.5s) para determinar el fin de una frase.
2.  **`CameraFeed.tsx`**: Abstracción del hardware. Maneja el stream de video (`getUserMedia`), el análisis de movimiento con MediaPipe (solo para triggers) y la captura de alta fidelidad.
3.  **`geminiService.ts`**: Capa de servicio. Construye el payload para la API y aplica configuraciones estrictas de inferencia para maximizar la precisión del modelo Flash.
4.  **`ResultsDisplay.tsx`**: Capa de presentación. Renderiza los resultados con animaciones y estados de confianza.

---

## 2. Estrategia de Captura: "Muestreo Temporal Dinámico"

A diferencia de versiones anteriores que usaban ráfagas fijas, la versión actual utiliza un **Buffer Circular Dinámico** para capturar la evolución completa del gesto.

### Flujo de Captura (`App.tsx`)
Mientras el usuario realiza señas (detectado por velocidad > umbral):
1.  Se acumulan frames en un buffer temporal (`sessionFramesRef`).
2.  El buffer mantiene los últimos ~25 frames (aprox. 1-2 segundos de historia).
3.  Al detectar una pausa sostenida (1.5 segundos), se dispara el análisis.

### Algoritmo de Selección (4-Frame Sampling)
Para optimizar el contexto temporal sin saturar la ventana de contexto del modelo, el sistema selecciona matemáticamente **4 frames representativos** del buffer:
1.  **Inicio (0%):** Comienzo del gesto.
2.  **Desarrollo Temprano (33%):** Transición.
3.  **Desarrollo Tardío (66%):** Punto de máxima extensión o forma.
4.  **Final (100%):** Postura final antes del reposo.

Esto permite a Gemini entender la trayectoria del movimiento (Parámetro "Movement" del ASL) mejor que una sola foto.

---

## 3. Optimización de Alta Fidelidad

Para compensar el uso de un modelo más ligero (Flash) frente a un modelo Pro, hemos aumentado la calidad de la entrada visual.

### Especificaciones de Imagen (`CameraFeed.tsx`)
*   **Resolución:** **480px de ancho** (Aumentado desde 320px).
    *   *Razón:* Flash necesita más píxeles para distinguir configuraciones de dedos complejas (ej. diferencia entre 'M', 'N' y 'T').
*   **Compresión JPEG:** Calidad **0.7** (70%).
    *   *Razón:* Menos artefactos de compresión alrededor de los dedos para mejorar la detección de bordes.

---

## 4. Configuración del Modelo (Precision Engineering)

En `geminiService.ts`, forzamos al modelo `gemini-2.5-flash` a comportarse de manera determinista y analítica, evitando la "creatividad" habitual de los LLMs.

### Parámetros de Inferencia
*   **`temperature: 0.1`**: Valor extremadamente bajo. Fuerza al modelo a elegir la traducción más probable estadísticamente, eliminando alucinaciones.
*   **`topK: 32`**: Restringe el vocabulario de salida a las 32 opciones más probables.
*   **`topP: 0.8`**: Nucleus sampling estricto.

### Prompt de Sistema (System Instructions)
Instruimos al modelo para analizar explícitamente los **5 Parámetros del ASL**:
1.  **Handshape** (Forma de la mano).
2.  **Orientation** (Orientación de la palma).
3.  **Location** (Ubicación respecto al cuerpo).
4.  **Movement** (Trayectoria).
5.  **Non-Manual Markers** (Expresión facial).

---

## 5. Gestión de Contexto (Memoria Semántica)

Para lograr frases coherentes, el sistema envía el contexto previo junto con las nuevas imágenes.

*   **Input Visual:** 4 imágenes (Payload actual).
*   **Input Textual:** "Previous Context: [Texto acumulado]".

**Regla de Fusión:** Si la nueva seña complementa gramaticalmente a la anterior (ej. "Yo" -> "Quiero"), el modelo devuelve la frase unida ("Yo quiero"). Si detecta un cambio de tema, añade puntuación.

---

## 6. Manejo de Errores y Cuotas

1.  **Backoff Exponencial:** Si la API devuelve `429` (Too Many Requests), la UI muestra una alerta amarilla y el sistema pausa la captura por 10 segundos.
2.  **Filtro de Ruido:** Si la traducción resultante es "..." o vacía (significando que el modelo no vio una seña clara), el sistema la descarta y no actualiza la UI, manteniendo la experiencia limpia.

---

## 7. Stack Tecnológico

*   **Frontend Library:** React 19.
*   **AI SDK:** `@google/genai` (v1.32.0).
*   **Visión Computacional (Cliente):** MediaPipe Tasks Vision (para detección de *presencia* de manos y cálculo de velocidad, no para traducción).
*   **Visión Computacional (Servidor):** Gemini 2.5 Flash Multimodal.
*   **Estilos:** Tailwind CSS.

---

**Autor:** Equipo de Ingeniería Global Sign Translator.