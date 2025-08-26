// post-sanitizer.js (VERSIÓN FINAL CON CABECERA)
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updateWordPressPost, uploadImage } = require('./lib/wordpressClient.js');
const { createSocialImage } = require('./lib/imageGenerator.js');
const showdown = require('showdown');

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
                console.log(`--- Saneando post para: "${event.name}" (Post ID: ${event.wordpressPostId}) ---`);

                // PASO 1: REGENERAR LA IMAGEN
                const imagePath = await createSocialImage(event);

                // PASO 2: SUBIR LA NUEVA IMAGEN
                const newImageId = await uploadImage(imagePath, event.name);
                if (!newImageId) {
                    throw new Error('La subida de la nueva imagen falló.');
                }

                // PASO 3: RE-FORMATEAR EL CONTENIDO COMPLETO

                // ==========================================================
                // --- INICIO DE LA MEJORA AÑADIDA ---
                const eventDate = new Date(event.date);
                const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
                const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

                // Se crea la cabecera
                const header = `**Artista:** ${event.artist}\n**Fecha:** ${formattedDate}\n\n---`;
                // --- FIN DE LA MEJORA AÑADIDA ---
                // ==========================================================

                const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/tienda-flamenca/) para encontrar moda y accesorios únicos.
➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})**`;

                // Se unen las 3 partes: cabecera + plan de noche existente + footer
                const markdownContent = `${header}\n\n${event.nightPlan}\n\n${footer}`;
                const htmlContent = converter.makeHtml(markdownContent);

                // PASO 4: PREPARAR DATOS Y ACTUALIZAR EL POST EN WORDPRESS
                const updateData = {
                    content: htmlContent,
                    featured_media: newImageId
                };
                await updateWordPressPost(event.wordpressPostId, updateData);

            } catch (error) {
                console.error(`❌ Error saneando el evento "${event.name}":`, error.message);
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa para no saturar
        }

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante el saneamiento:', error);
    } finally {
        console.log('--- PROCESO DE SANEAMIENTO FINALIZADO ---');
    }
}

sanitizeOldPosts();