// generate-content.js
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// const { createSocialImage } = require('./lib/imageGenerator.js'); // Descomentar cuando esté listo

// --- LÓGICA DE GEMINI ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local y aficionado al flamenco.
    Tu tarea es generar una mini-guía para una noche perfecta centrada en un evento de flamenco.
    Sé cercano, usa un lenguaje evocador y estructura el plan en secciones con Markdown (usando ## para los títulos).

    **REGLA MUY IMPORTANTE: Tu respuesta debe empezar DIRECTAMENTE con el primer título en Markdown (##). No incluyas saludos, introducciones o texto conversacional antes de la guía.**

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

async function generateContentForEvent(db, event) {
    console.log(`🔥 Procesando contenido para: "${event.name}"`);
    const prompt = nightPlanPromptTemplate(event);
    const result = await model.generateContent(prompt);
    const nightPlanText = result.response.text();

    if (!nightPlanText || !nightPlanText.includes('##')) {
        throw new Error("La respuesta de la IA para el plan no tiene el formato esperado.");
    }

    // const imagePath = await createSocialImage(event);

    await db.collection('events').updateOne(
        { _id: event._id },
        {
            $set: {
                nightPlan: nightPlanText,
                // socialImagePath: imagePath,
                contentGenerationDate: new Date()
            }
        }
    );
    console.log(`💾 Plan de noche para "${event.name}" guardado.`);
}


async function main() {
    console.log('Iniciando el generador de contenido...');
    try {
        const BATCH_SIZE = 10;
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const eventsToProcess = await eventsCollection.find({
            nightPlan: { $exists: false },
            date: { $gte: today.toISOString().split('T')[0] },
            name: { $exists: true, $ne: "" }
        }).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log('✅ No hay eventos nuevos para generar contenido.');
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para procesar.`);

        for (const event of eventsToProcess) {
            try {
                await generateContentForEvent(db, event);
            } catch (error) {
                console.error(`❌ Error procesando el evento "${event.name}":`, error.message);
            }
        }
    } catch (error) {
        console.error("Ha ocurrido un error fatal en el generador:", error);
    } finally {
        console.log('Proceso de generación finalizado.');
    }
}

main();