// post-sanitizer.js (VERSIÓN 3 - CAPAZ DE REGENERAR CONTENIDO)

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updateWordPressPost, uploadImage, deleteWordPressPost } = require('./lib/wordpressClient.js');
const { createSocialImage } = require('./lib/imageGenerator.js');
const { ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const showdown = require('showdown'); // Re-añadimos showdown

// --- CONFIGURACIÓN DE IA ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const converter = new showdown.Converter();

// --- ANÁLISIS DE FLAGS ---
const args = process.argv.slice(2);
const flags = {
    dryRun: args.includes('--dry-run'),
    regenerateImages: args.includes('--regenerate-images'),
    deleteNonFlamenco: args.includes('--delete-non-flamenco')
};

/**
 * Lógica copiada de content-creator.js para generar contenido si falta.
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


async function verifyFlamencoWithGemini(eventData) {
    const prompt = `En el contexto de una agenda cultural de música en España, analiza la siguiente información y determina si se trata de un evento de flamenco... Responde SÓLO con "flamenco" o "no-flamenco". ...`; // Prompt acortado por brevedad
    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();
        return text.includes('flamenco') && !text.includes('no-flamenco');
    } catch (error) {
        console.error('Error al verificar el evento con Gemini:', error);
        return false;
    }
}

async function sanitizePosts() {
    console.log('--- INICIANDO SANEADOR DE POSTS (V3 - CON REGENERACIÓN) ---');
    if (flags.dryRun) console.log('⚠️  MODO SIMULACIÓN ACTIVADO (--dry-run). No se realizarán cambios reales.');

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // --- NUEVA QUERY ---
        // Buscamos posts publicados a los que les FALTA el contenido HTML.
        const query = {
            wordpressPostId: { $exists: true },
            blogPostHtml: { $exists: false }
        };
        const postsToSanitize = await eventsCollection.find(query).toArray();

        if (postsToSanitize.length === 0) {
            console.log('✅ No se encontraron posts huérfanos para regenerar. ¡El sistema parece estar consistente!');
            return;
        }

        console.log(`⚙️ Se encontraron ${postsToSanitize.length} posts "huérfanos" para regenerar y sanear.`);

        for (const event of postsToSanitize) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`Analizando evento huérfano: "${event.name}" (WP ID: ${event.wordpressPostId})`);

            // ... (La lógica de verificación y borrado de no-flamenco se mantiene igual)

            try {
                // --- PASO 1: GENERAR EL CONTENIDO QUE FALTA ---
                console.log('   -> No se encontró blogPostHtml. Generando contenido...');
                // Asumimos que si no hay HTML, tampoco hay título bueno. Usamos nightPlan que sí debería existir.
                if (!event.nightPlan) {
                    console.error(`   [!] Error crítico: el evento no tiene nightPlan para regenerar el contenido. Omitiendo.`);
                    continue;
                }
                const { title, htmlContent } = createFinalPostContent(event, event.nightPlan);

                if (!flags.dryRun) {
                    // Guardamos el contenido recién creado en nuestra BBDD para consistencia
                    await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        { $set: { blogPostTitle: title, blogPostHtml: htmlContent } }
                    );
                } else {
                    console.log(`   [SIMULACIÓN] Se generaría y guardaría el contenido en la BBDD.`);
                }


                // --- PASO 2: PREPARAR Y ACTUALIZAR EL POST ---
                const updateData = {};
                const footer = `<hr>...`; // Footer acortado por brevedad
                updateData.content = htmlContent + footer;
                updateData.title = title;

                // Lógica de regeneración de imagen (opcional)
                if (flags.regenerateImages) {
                    // ... (se mantiene igual)
                }

                if (!flags.dryRun) {
                    await updateWordPressPost(event.wordpressPostId, updateData);
                    console.log(`✅ Post actualizado en WordPress con el contenido regenerado.`);
                } else {
                    console.log(`   [SIMULACIÓN] Se actualizaría el post en WordPress con el contenido recién generado.`);
                }

            } catch (error) {
                console.error(`❌ Error saneando el evento "${event.name}":`, error.message);
            }
        }
        console.log(`\n--- PROCESO DE SANEAMIENTO FINALIZADO ---`);

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante el saneamiento:', error);
    } finally {
        process.exit(0);
    }
}

sanitizePosts();