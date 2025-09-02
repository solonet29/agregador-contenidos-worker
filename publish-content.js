
// publish-content.js (Refactorizado como Módulo)
// OBJETIVO: Tomar eventos enriquecidos, crear su imagen final y publicarlos en WordPress.

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { publishToWordPress, uploadImage } = require('./lib/wordpressClient.js');
const { createPostImage } = require('./lib/imageGenerator.js');
const config = require('./config.js'); // Importar la configuración central

/**
 * Función principal del módulo.
 * Procesa un lote de eventos para publicarlos en WordPress.
 */
async function publishPosts() {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Buscamos eventos que fueron enriquecidos por el paso anterior
    const query = {
        status: 'enriched',
        wordpressPostId: { $exists: false }
    };

    const eventsToPublish = await eventsCollection.find(query).limit(config.BATCH_SIZE).toArray();

    if (eventsToPublish.length === 0) {
        console.log('✅ No hay contenido nuevo para publicar en WordPress.');
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToPublish.length} eventos para publicar.`);

    for (const [index, event] of eventsToPublish.entries()) {
        try {
            console.log(`   -> Publicando: "${event.blogPostTitle}"`);

            // 1. Crear y subir la imagen social para el post
            console.log(`      -> 1/3: Creando imagen social...`);
            const imagePath = await createPostImage(event);
            const imageUploadResponse = await uploadImage(imagePath, event.name);
            if (!imageUploadResponse || !imageUploadResponse.imageId) {
                throw new Error('La subida de la imagen a WordPress falló.');
            }
            const imageId = imageUploadResponse.imageId;
            const imageUrl = imageUploadResponse.imageUrl;

            // 2. Preparar el contenido final del post
            console.log(`      -> 2/3: Preparando contenido final...`);
            const footer = config.htmlBlocks.postFooter(event);
            const finalHtmlContent = event.blogPostHtml + footer;

            // Programar la publicación para el futuro para no publicar todo de golpe
            const publicationDate = new Date();
            publicationDate.setHours(publicationDate.getHours() + index + 1);

            const postData = {
                title: event.blogPostTitle,
                content: finalHtmlContent,
                status: 'future', // Publicar en el futuro
                date: publicationDate.toISOString(),
                categories: [config.WORDPRESS_EVENTS_CATEGORY_ID],
                featured_media: imageId,
            };

            // 3. Publicar en WordPress y actualizar la BBDD
            console.log(`      -> 3/3: Publicando en WordPress...`);
            const wordpressResponse = await publishToWordPress(postData);

            await eventsCollection.updateOne(
                { _id: event._id },
                {
                    $set: {
                        status: 'published',
                        wordpressPostId: wordpressResponse.id,
                        publicationDate: publicationDate,
                        blogPostUrl: wordpressResponse.link,
                        featuredImageId: imageId,
                        featuredImageUrl: imageUrl // <-- CAMPO AÑADIDO
                    }
                }
            );

            console.log(`   ✅ Post para "${event.name}" programado. URL: ${wordpressResponse.link}`);

        } catch (error) {
            console.error(`   ❌ Error procesando la publicación de "${event.name}":`, error.message);
        }
    }
}

// Exportar la función principal
module.exports = { publishPosts };
