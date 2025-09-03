
// enrich-events.js (Versión con Groq y sin filtro)
// OBJETIVO: Tomar eventos "en bruto" y enriquecerlos con contenido de texto generado por IA.

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const Groq = require('groq-sdk');
const { ObjectId } = require('mongodb');
const showdown = require('showdown');
const config = require('./config.js'); // Importar la configuración central

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY no está definida.');
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Modelo actualizado
const converter = new showdown.Converter();

// --- NUEVO: Helper para gestionar esperas ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Construye el título y el contenido HTML final para el post del blog.
 * @param {object} event - El objeto del evento.
 * @param {string} nightPlanText - El plan de noche en formato Markdown generado por la IA.
 * @returns {{title: string, htmlContent: string}} El título y el contenido en HTML.
 */
function createFinalPostContent(event, nightPlanText) {
    const titleTemplates = [
        `${event.name} en ${event.city}: Tu Noche Flamenca Perfecta`,
        `Guía Completa para ${event.name} en ${event.city}`,
        `Disfruta del Mejor Flamenco: ${event.name} en ${event.city}`,
        `${event.name}: La Experiencia Flamenca Definitiva en ${event.city}`,
        `Noche de Duende: ${event.name} en ${event.city}`
    ];
    const title = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];

    const nightPlanHtml = converter.makeHtml(nightPlanText);
    
    // Usamos los bloques de HTML desde el fichero de configuración
    const introHtml = config.htmlBlocks.postIntro(event);
    const ctaHtml = config.htmlBlocks.ctaBanners;

    // Combinar todo en el contenido final
    const htmlContent = introHtml + nightPlanHtml + ctaHtml;

    return { title, htmlContent };
}

/**
 * Función principal del módulo.
 * Procesa un lote de eventos para enriquecerlos con contenido de texto.
 */
async function enrichEvents() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Buscamos eventos que no tengan plan de noche y tengan fecha futura.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const query = {
        nightPlan: { $exists: false },
        date: { $gte: today.toISOString().split('T')[0] },
        name: { $exists: true, $ne: "" }
    };

    const eventsToProcess = await eventsCollection.find(query).limit(config.ENRICH_BATCH_SIZE).toArray();

    if (eventsToProcess.length === 0) {
        console.log("✅ No se encontraron eventos nuevos para enriquecer con texto.");
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para enriquecer con texto.`);

    for (const event of eventsToProcess) {
        try {
            console.log(`   -> Procesando texto para: "${event.name}"`);

            // El filtro de flamenco ha sido eliminado temporalmente a petición del usuario.

            // 2. Generar plan de noche con reintentos
            const MAX_RETRIES = 3;
            const RETRY_DELAY = 5000; // 5 segundos
            let nightPlanText = "";
            let lastError = null;

            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    const prompt = config.prompts.nightPlan(event);
                    const chatCompletion = await groq.chat.completions.create({
                        messages: [{ role: "user", content: prompt }],
                        model: GROQ_MODEL,
                    });
                    nightPlanText = chatCompletion.choices[0]?.message?.content || "";
                    
                    // Si la respuesta es válida, salimos del bucle
                    if (nightPlanText && nightPlanText.includes('##')) {
                        lastError = null; // Reseteamos el error
                        break;
                    } else {
                        // Si la respuesta no es válida, la tratamos como un error para reintentar
                        throw new Error("La respuesta de la IA para el plan no tiene el formato esperado.");
                    }

                } catch (error) {
                    lastError = error;
                    console.warn(`   ⚠️ Intento ${i + 1}/${MAX_RETRIES} fallido para "${event.name}". Reintentando en ${RETRY_DELAY / 1000}s...`);
                    console.warn(`      Error: ${error.message}`);
                    if (i < MAX_RETRIES - 1) {
                        await delay(RETRY_DELAY);
                    } 
                }
            }

            // Si después de los reintentos sigue habiendo error, lo lanzamos
            if (lastError) {
                throw lastError;
            }

            // 3. Montar el contenido completo del post
            const { title, htmlContent } = createFinalPostContent(event, nightPlanText);

            // 4. Actualizar la base de datos
            const updates = {
                nightPlan: nightPlanText,
                blogPostHtml: htmlContent,
                blogPostTitle: title,
                contentGenerationDate: new Date(),
                status: 'enriched' // Nuevo estado para el pipeline
            };

            await eventsCollection.updateOne({ _id: new ObjectId(event._id) }, { $set: updates });
            console.log(`   💾 Contenido de texto para "${event.name}" guardado.`);

        } catch (error) {
            console.error(`   ❌ Error procesando el texto para el evento "${event.name}":`, error.message);
        }
    }
}

// Exportar la función principal para que el orquestador pueda usarla
module.exports = { enrichEvents };
