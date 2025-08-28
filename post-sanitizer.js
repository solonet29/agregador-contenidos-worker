// post-sanitizer.js (VERSIÓN FINAL CON CABECERA)

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updateWordPressPost, uploadImage, deleteWordPressPost } = require('./lib/wordpressClient.js');
const { createSocialImage } = require('./lib/imageGenerator.js');
const showdown = require('showdown');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const readline = require('readline');
const { ObjectId } = require('mongodb');

// Configuración de clientes para la verificación con Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
 * Verifica si un evento está relacionado con el flamenco utilizando Gemini.
 * @param {object} eventData - Datos del evento (artista, nombre, descripción).
 * @returns {Promise<boolean>} Retorna true si es flamenco, false en caso contrario.
 */
async function verifyFlamencoWithGemini(eventData) {
    const prompt = `Analiza la siguiente información de un evento. Responde SÓLO con "flamenco" o "no-flamenco". NO añadas texto adicional.
    
    Nombre: ${eventData.name}
    Artista: ${eventData.artist}
    Descripción: ${eventData.description}
    
    ¿Es este un evento de flamenco?`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();

        if (text.includes('flamenco') && !text.includes('no-flamenco')) {
            return true;
        }
    } catch (error) {
        console.error('Error al verificar el evento con Gemini:', error);
    }
    return false;
}

async function sanitizeOldPosts() {
    console.log('--- INICIANDO SANEADOR DE POSTS ANTIGUOS ---');
    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        const postsToSanitize = await eventsCollection.find({
            wordpressPostId: { $exists: true, $ne: null },
            nightPlan: { $exists: true, $ne: null }
        }).toArray();

        if (postsToSanitize.length === 0) {
            console.log('✅ No se encontraron posts publicados para sanear.');
            return;
        }

        console.log(`⚙️ Se encontraron ${postsToSanitize.length} posts para sanear y actualizar.`);
        const converter = new showdown.Converter();

        for (const event of postsToSanitize) {
            try {
                // --- NUEVO: Verificación de Flamenco ---
                const isFlamenco = await verifyFlamencoWithGemini(event);
                if (!isFlamenco) {
                    console.log('\n--- Evento con contenido dudoso ---');
                    console.log(`Nombre: ${event.name}`);
                    console.log(`Artista: ${event.artist}`);
                    console.log(`Lugar: ${event.venue} en ${event.address}`);
                    console.log('------------------------------------\n');

                    const confirm = await askQuestion('¿Quieres eliminar este post y el evento de la base de datos? (s/n): ');
                    if (confirm) {
                        await deleteWordPressPost(event.wordpressPostId); // Eliminar el post de WordPress
                        await eventsCollection.deleteOne({ _id: new ObjectId(event._id) }); // Eliminar el evento de MongoDB
                        console.log(`🗑️ Post y evento para "${event.name}" eliminados.`);
                    } else {
                        console.log(`⏭️ Evento "${event.name}" no eliminado. Saltando al siguiente.`);
                    }
                    continue; // Saltar al siguiente evento en el bucle
                }

                console.log(`--- Saneando post para: "${event.name}" (Post ID: ${event.wordpressPostId}) ---`);

                // PASO 1: REGENERAR LA IMAGEN
                const imagePath = await createSocialImage(event);

                // PASO 2: SUBIR LA NUEVA IMAGEN
                const newImageId = await uploadImage(imagePath, event.name);
                if (!newImageId) {
                    throw new Error('La subida de la nueva imagen falló.');
                }

                // ==========================================================
                // --- INICIO DE LA MEJORA AÑADIDA ---
                const eventDate = new Date(event.date);
                const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
                const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

                // Se crea la cabecera
                const header = `**Artista:** ${event.artist}\n**Fecha:** ${formattedDate}\n\n---`;
                // ==========================================================

                // --- INICIO DE LA MEJORA DE PIE DE PÁGINA ---
                const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/la-tienda-flamenca-afland/) para encontrar moda y accesorios únicos.

### ¿Quieres ver tu negocio aquí?
[Contacta con nosotros](https://afland.es/contact/) para publicitar tu evento en Duende Finder.
➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})**`;
                // --- FIN DE LA MEJORA DE PIE DE PÁGINA ---

                // Se unen las 3 partes: cabecera + plan de noche existente + footer
                const markdownContent = `${header}\n\n${event.nightPlan}\n\n${footer}`;
                const htmlContent = converter.makeHtml(markdownContent);

                // PASO 4: PREPARAR DATOS Y ACTUALIZAR EL POST EN WORDPRESS
                const updateData = {
                    content: htmlContent,
                    featured_media: newImageId
                };
                await updateWordPressPost(event.wordpressPostId, updateData);
                console.log(`✅ Post para "${event.name}" saneado y actualizado con éxito.`);

            } catch (error) {
                console.error(`❌ Error saneando el evento "${event.name}":`, error.message);
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa para no saturar
        }

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante el saneamiento:', error);
    } finally {
        console.log('--- PROCESO DE SANEAMIENTO FINALIZADO ---');
        rl.close();
    }
}

sanitizeOldPosts();