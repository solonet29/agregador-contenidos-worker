// bulk-generator.js
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- CONFIGURACIÓN ---
const BATCH_SIZE = 20;

// --- LÓGICA DE GEMINI ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Plantilla del Prompt (versión corregida y completa)
const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local y aficionado al flamenco.
    Tu tarea es generar una mini-guía para una noche perfecta centrada en un evento de flamenco.
    Sé cercano, usa un lenguaje evocador y estructura el plan en secciones con Markdown (usando ## para los títulos).

    **Instrucción clave sobre enlaces:** Cuando recomiendes un lugar (bar, restaurante, etc.), si encuentras un enlace de Google Maps, formatea el enlace directamente en el nombre del lugar.
    Ejemplo CORRECTO: **[Nombre del Lugar](URL de Google Maps):** Descripción...
    Ejemplo INCORRECTO: **Nombre del Lugar:** Descripción... [Nombre del Lugar](URL de Google Maps)

    EVENTO:
    - Nombre: ${event.name}
    - Artista: ${event.artist}
    - Lugar: ${event.venue}, ${event.city}
    ESTRUCTURA DE LA GUÍA:
    1.  **Un Pellizco de Sabiduría:** Aporta un dato curioso o una anécdota sobre el artista, el lugar o algún palo del flamenco relacionado.
    2.  **Calentando Motores (Antes del Espectáculo):** Recomienda 1 o 2 bares de tapas o restaurantes cercanos al lugar del evento, describiendo el ambiente.
    3.  **El Templo del Duende (El Espectáculo):** Describe brevemente qué se puede esperar del concierto, centrando en la emoción.
    4.  **Para Alargar la Magia (Después del Espectáculo):** Sugiere un lugar cercano para tomar una última copa en un ambiente relajado.

    Usa un tono inspirador y práctico.
`;


async function bulkGeneratePlans() {
    console.log('--- INICIANDO LOTE DE CARGA MASIVA ---');

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');
        console.log('Conectado a MongoDB.');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Buscamos TODOS los eventos futuros sin nightPlan
        const eventsToProcess = await eventsCollection.find({
            nightPlan: { $exists: false },
            date: { $gte: today.toISOString().split('T')[0] }, // <-- AQUÍ FALTABA UNA COMA
            name: { $exists: true, $ne: "" }
        }).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log('✅ ¡TAREA COMPLETADA! No hay más eventos que necesiten un "Plan Noche".');
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos. Procesando lote...`);

        for (const event of eventsToProcess) {
            try {
                console.log(`🔥 Generando plan para: "${event.name}"`);
                const prompt = nightPlanPromptTemplate(event);
                const result = await model.generateContent(prompt);
                const generatedContent = result.response.text();

                await eventsCollection.updateOne(
                    { _id: event._id },
                    { $set: { nightPlan: generatedContent } }
                );
                console.log(`💾 Plan para "${event.name}" guardado.`);

            } catch (error) {
                console.error(`❌ Error generando el plan para "${event.name}" (ID: ${event._id}):`, error.message);
            }
        }

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante el proceso de carga masiva:', error);
    } finally {
        console.log('--- LOTE FINALIZADO ---');
    }
}

bulkGeneratePlans();