// post-sanitizer.js
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

        // Buscamos todos los eventos que ya hayan sido publicados
        const postsToSanitize = await eventsCollection.find({
            contentStatus: 'published',
            wordpressPostId: { $exists: true }
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

                // 1. Regenerar la imagen con la nueva lógica
                const imagePath = await createSocialImage(event);

                // 2. Subir la NUEVA imagen a WordPress
                const newImageId = await uploadImage(imagePath, event.name);
                if (!newImageId) {
                    throw new Error('La subida de la nueva imagen falló.');
                }

                // 3. Regenerar el contenido HTML
                const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/tienda-flamenca/) para encontrar moda y accesorios únicos.
➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})**`;
                const markdownContent = `${event.nightPlan}\n\n${footer}`;
                const htmlContent = converter.makeHtml(markdownContent);

                // 4. Preparar los datos para la ACTUALIZACIÓN
                const updateData = {
                    content: htmlContent,
                    featured_media: newImageId // Usamos el ID de la nueva imagen
                    // No incluimos categoría o título si no queremos cambiarlos
                };

                // 5. Llamar a la nueva función para actualizar el post
                await updateWordPressPost(event.wordpressPostId, updateData);

            } catch (error) {
                console.error(`❌ Error saneando el evento "${event.name}":`, error.message);
            }
            // Pausa para no saturar el servidor
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante el saneamiento:', error);
    } finally {
        console.log('--- PROCESO DE SANEAMIENTO FINALIZADO ---');
    }
}

sanitizeOldPosts();