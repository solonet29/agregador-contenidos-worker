
require('dotenv').config();
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('./lib/database.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuración ---
const BATCH_SIZE = 50;

// Lógica de Gemini
if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no está definida.');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Plantilla del Prompt
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

/**
 * Función principal para encontrar eventos sin nightPlan y generarlos.
 */
async function generateMissingPlans() {
    console.log("Iniciando el proceso de generación de planes de noche...");
    let db;
    try {
        db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // Lógica de Fechas: 3 días desde ahora
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        console.log(`Buscando eventos sin nightPlan a partir de: ${threeDaysFromNow.toISOString()}`);

        // Consulta a la Base de Datos
        const eventsToProcess = await eventsCollection.find({
            nightPlan: { $exists: false },
            date: { $gt: threeDaysFromNow },
            name: { $exists: true, $ne: "" }
        })
            .sort({ date: 1 })
            .limit(BATCH_SIZE)
            .toArray();

        if (eventsToProcess.length === 0) {
            console.log("No se encontraron eventos que necesiten un plan de noche. Finalizando.");
            return;
        }

        console.log(`Se encontraron ${eventsToProcess.length} eventos para procesar.`);

        // Procesamiento del Lote
        for (const event of eventsToProcess) {
            try {
                console.log(`--- Procesando evento: "${event.name}" (ID: ${event._id}) ---`);

                const prompt = nightPlanPromptTemplate(event);
                const result = await model.generateContent(prompt);
                const generatedContent = result.response.text();

                // Actualiza el documento en MongoDB
                const updateResult = await eventsCollection.updateOne(
                    { _id: event._id },
                    { $set: { nightPlan: generatedContent } }
                );

                if (updateResult.modifiedCount > 0) {
                    console.log(`✅ Plan de noche para "${event.name}" generado y guardado correctamente.`);
                } else {
                    console.warn(`⚠️ No se pudo actualizar el evento "${event.name}".`);
                }

            } catch (error) {
                console.error(`❌ Error procesando el evento ${event._id} ("${event.name}"):`, error);
                // El bucle continúa con el siguiente evento
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal en la función principal:", error);
    } finally {
        // En un escenario real, podríamos querer cerrar la conexión si no se reutiliza más.
        // Por ahora, lo dejamos abierto según el patrón del helper.
        console.log("Proceso de generación finalizado.");
    }
}

// Ejecutar la función principal
// Añade esta línea al final
module.exports = { generateMissingPlans };
