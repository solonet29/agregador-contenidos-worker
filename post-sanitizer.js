// post-sanitizer.js (VERSIÓN CORREGIDA FINAL)

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updateWordPressPost, uploadImage, deleteWordPressPost } = require('./lib/wordpressClient.js');
const { createSocialImage } = require('./lib/imageGenerator.js');
const { ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURACIÓN DE IA ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// --- ANÁLISIS DE FLAGS DE LÍNEA DE COMANDOS ---
const args = process.argv.slice(2);
const flags = {
    dryRun: args.includes('--dry-run'),
    regenerateImages: args.includes('--regenerate-images'),
    deleteNonFlamenco: args.includes('--delete-non-flamenco')
};

/**
 * VERSIÓN MEJORADA Y SINCRONIZADA
 * Verifica si un evento está relacionado con el flamenco utilizando Gemini.
 * @param {object} eventData - Datos del evento (artista, nombre, descripción).
 * @returns {Promise<boolean>} Retorna true si es flamenco, false en caso contrario.
 */
async function verifyFlamencoWithGemini(eventData) {
    const prompt = `En el contexto de una agenda cultural de música en España, analiza la siguiente información y determina si se trata de un evento de flamenco. Considera que nombres de artistas como 'Argentina' o 'Arcángel' son cantaores de flamenco muy conocidos, aunque el nombre pueda parecer genérico. Responde SÓLO con "flamenco" o "no-flamenco".

    Nombre del evento: ${eventData.name}
    Artista: ${eventData.artist}
    Descripción: ${eventData.description}`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();
        return text.includes('flamenco') && !text.includes('no-flamenco');
    } catch (error) {
        console.error('Error al verificar el evento con Gemini:', error);
        return false; // Asumir que no es flamenco si hay un error
    }
}

async function sanitizePosts() {
    console.log('--- INICIANDO SANEADOR DE POSTS (MODO PROFESIONAL) ---');
    if (flags.dryRun) console.log('⚠️  MODO SIMULACIÓN ACTIVADO (--dry-run). No se realizarán cambios reales.');

    try {
        // --- LÍNEA CORREGIDA ---
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        const query = {
            wordpressPostId: { $exists: true, $ne: null },
            blogPostHtml: { $exists: true, $ne: "" } // Buscamos los que tienen el contenido bueno en la DB
        };
        const postsToSanitize = await eventsCollection.find(query).toArray();

        if (postsToSanitize.length === 0) {
            console.log('✅ No se encontraron posts que cumplan los criterios para sanear.');
            return;
        }

        console.log(`⚙️ Se encontraron ${postsToSanitize.length} posts para analizar.`);
        let sanitizedCount = 0;
        let deletedCount = 0;

        for (const event of postsToSanitize) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`Analizando evento: "${event.name}" (WP ID: ${event.wordpressPostId})`);

            const isFlamenco = await verifyFlamencoWithGemini(event);

            if (!isFlamenco) {
                console.warn(`[!] Este evento no parece ser de flamenco.`);
                if (flags.deleteNonFlamenco) {
                    if (!flags.dryRun) {
                        await deleteWordPressPost(event.wordpressPostId);
                        await eventsCollection.deleteOne({ _id: new ObjectId(event._id) });
                        console.log(`🗑️ Post y evento eliminados.`);
                    } else {
                        console.log(`[SIMULACIÓN] Se eliminaría el post y el evento.`);
                    }
                    deletedCount++;
                } else {
                    console.log(`⏭️  Omitiendo. Para borrar, usa el flag --delete-non-flamenco.`);
                }
                continue;
            }

            // --- Lógica de Saneamiento para posts de Flamenco ---
            try {
                const updateData = {};

                // 1. Contenido: Usar la fuente de la verdad
                const footer = `
                <hr>
                <h3>¿Buscas el atuendo perfecto?</h3>
                <p>Visita nuestra <a href="https://afland.es/la-tienda-flamenca-afland/">Tienda Flamenca</a> para encontrar moda y accesorios únicos.</p>
                <p>➡️ <strong><a href="https://buscador.afland.es/?event_id=${event._id}">Ver todos los detalles de este evento en Duende Finder</a></strong></p>`;
                updateData.content = event.blogPostHtml + footer;
                updateData.title = event.blogPostTitle;

                // 2. Imagen (Opcional)
                if (flags.regenerateImages) {
                    console.log(` regenerating image...`);
                    const imagePath = await createSocialImage(event);
                    const newImageId = await uploadImage(imagePath, event.name);
                    if (newImageId) {
                        updateData.featured_media = newImageId;
                    }
                }

                // 3. Actualizar en WordPress
                if (!flags.dryRun) {
                    await updateWordPressPost(event.wordpressPostId, updateData);
                    console.log(`✅ Post actualizado en WordPress.`);
                } else {
                    console.log(`[SIMULACIÓN] Se actualizaría el post con el contenido correcto y el título.`);
                    if (flags.regenerateImages) console.log(`[SIMULACIÓN] Se regeneraría y asignaría una nueva imagen.`);
                }
                sanitizedCount++;

            } catch (error) {
                console.error(`❌ Error saneando el evento "${event.name}":`, error.message);
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Pausa breve
        }

        console.log(`\n--- PROCESO DE SANEAMIENTO FINALIZADO ---`);
        console.log(`Posts Saneados: ${sanitizedCount}`);
        console.log(`Posts/Eventos No-Flamenco Eliminados: ${deletedCount}`);


    } catch (error) {
        console.error('Ha ocurrido un error fatal durante el saneamiento:', error);
    } finally {
        process.exit(0);
    }
}

sanitizePosts();