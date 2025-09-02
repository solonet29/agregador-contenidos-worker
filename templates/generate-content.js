// content-creator.js (VERSIÓN CON GROQ)

console.log("--- Ejecutando content-creator.js v3.1 (con Groq y sin filtro) ---");
require('dotenv').config();
const { connectToDatabase } = require('../lib/database.js');
const Groq = require('groq-sdk');
const readline = require('readline');
const { ObjectId } = require('mongodb');
const showdown = require('showdown');

// --- LÓGICA DE GROQ ---
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY no está definida.');
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Modelo actualizado
const converter = new showdown.Converter();

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

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Pide al usuario confirmación por consola.
 * @param {string} query - El mensaje de confirmación.
 * @returns {Promise<boolean>} Retorna true si el usuario confirma.
 */
async function askQuestion(query) {
    return new Promise(resolve => rl.question(query, ans => {
        resolve(ans.toLowerCase() === 's' || ans.toLowerCase() === 'y');
    }));
}

/**
 * Construye el título y el contenido HTML final para el post del blog.
 * @param {object} event - El objeto del evento.
 * @param {string} nightPlanText - El plan de noche en formato Markdown generado por la IA.
 * @returns {{title: string, htmlContent: string}} El título y el contenido en HTML.
 */
function createFinalPostContent(event, nightPlanText) {
    const title = `${event.name} en ${event.city}: Guía para una Noche Flamenca Inolvidable`;
    const nightPlanHtml = converter.makeHtml(nightPlanText);
    const introHtml = `
        <p>El flamenco es más que un espectáculo; es una experiencia que envuelve todos los sentidos. Si tienes la suerte de asistir a la actuación de <strong>${event.artist || event.name}</strong> en <strong>${event.venue}</strong>, te hemos preparado una guía para que tu velada sea redonda, desde las tapas previas hasta la última copa.</p>
        <p>Descubre cómo vivir una noche flamenca completa en ${event.city}.</p>
    `;
    const htmlContent = introHtml + nightPlanHtml;
    return { title, htmlContent };
}

async function generateContentForEvent(db, event) {
    console.log(`🔥 Procesando contenido para: "${event.name}"`);

    // El filtro de flamenco ha sido eliminado temporalmente a petición del usuario.

    const prompt = nightPlanPromptTemplate(event);
    const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: GROQ_MODEL,
    });
    const nightPlanText = chatCompletion.choices[0]?.message?.content || "";

    if (!nightPlanText || !nightPlanText.includes('##')) {
        throw new Error("La respuesta de la IA para el plan no tiene el formato esperado.");
    }

    const { title, htmlContent } = createFinalPostContent(event, nightPlanText);

    await db.collection('events').updateOne(
        { _id: new ObjectId(event._id) },
        {
            $set: {
                nightPlan: nightPlanText,
                blogPostHtml: htmlContent,
                blogPostTitle: title,
                contentGenerationDate: new Date()
            }
        }
    );
    console.log(`💾 Contenido completo y plan de noche para "${event.name}" guardado.`);
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
        rl.close();
    }
}

main();