
// enrich-events.js (Refactorizado como Módulo)
// OBJETIVO: Tomar eventos "en bruto" y enriquecerlos con contenido de texto generado por IA.

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ObjectId } = require('mongodb');
const showdown = require('showdown');
const config = require('./config.js'); // Importar la configuración central

// --- INICIALIZACIÓN DE SERVICIOS ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const converter = new showdown.Converter();

/**
 * Construye el título y el contenido HTML final para el post del blog.
 * @param {object} event - El objeto del evento.
 * @param {string} nightPlanText - El plan de noche en formato Markdown generado por la IA.
 * @returns {{title: string, htmlContent: string}} El título y el contenido en HTML.
 */
function createFinalPostContent(event, nightPlanText) {
    const title = `${event.name} en ${event.city}: Guía para una Noche Flamenca Inolvidable`;
    const nightPlanHtml = converter.makeHtml(nightPlanText);
    
    // Usamos los bloques de HTML desde el fichero de configuración
    const introHtml = config.htmlBlocks.postIntro(event);
    const ctaHtml = config.htmlBlocks.ctaBanners;

    // Combinar todo en el contenido final
    const htmlContent = introHtml + nightPlanHtml + ctaHtml;

    return { title, htmlContent };
}

/**
 * Verifica si un evento está relacionado con el flamenco utilizando Gemini.
 * @param {object} eventData - Datos del evento (artista, nombre, descripción).
 * @returns {Promise<boolean>} Retorna true si es flamenco, false en caso contrario.
 */
async function verifyFlamencoWithGemini(eventData) {
    // Usamos el prompt desde el fichero de configuración
    const prompt = config.prompts.verifyFlamenco(eventData);
    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();
        return text.includes('flamenco') && !text.includes('no-flamenco');
    } catch (error) {
        // Si la API falla (ej. clave inválida), lanzamos el error para que el proceso principal lo capture
        console.error(`   ❌ Error en la llamada a la API de Gemini para el evento "${eventData.name}".`);
        throw error; 
    }
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

    const eventsToProcess = await eventsCollection.find(query).limit(config.BATCH_SIZE).toArray();

    if (eventsToProcess.length === 0) {
        console.log("✅ No se encontraron eventos nuevos para enriquecer con texto.");
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para enriquecer con texto.`);

    for (const event of eventsToProcess) {
        try {
            console.log(`   -> Procesando texto para: "${event.name}"`);

            // 1. Verificar si es flamenco
            const isFlamenco = await verifyFlamencoWithGemini(event);
            if (!isFlamenco) {
                console.warn(`   ⚠️  El evento "${event.name}" ha sido clasificado como NO flamenco. Eliminando.`);
                await eventsCollection.deleteOne({ _id: new ObjectId(event._id) });
                continue; // Saltar al siguiente evento
            }

            // 2. Generar plan de noche
            const prompt = config.prompts.nightPlan(event);
            const result = await model.generateContent(prompt);
            const nightPlanText = result.response.text();

            if (!nightPlanText || !nightPlanText.includes('##')) {
                throw new Error("La respuesta de la IA para el plan no tiene el formato esperado.");
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
