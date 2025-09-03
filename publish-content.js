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

    // --- CAMBIO 1: Usamos la nueva variable de config para el lote de publicación ---
    const eventsToPublish = await eventsCollection.find(query).limit(config.PUBLISH_BATCH_SIZE).toArray();

    if (eventsToPublish.length === 0) {
        console.log('✅ No hay contenido nuevo para publicar en WordPress.');
        return;
    }

    console.log(`⚙️ Se encontraron ${eventsToPublish.length} eventos para publicar.`);

    for (const event of eventsToPublish) { // Eliminado 'index' porque ya no lo necesitamos
        try {
            // --- BLOQUEO: Marcar el evento como 'publishing' para evitar duplicados ---
            await eventsCollection.updateOne({ _id: event._id }, { $set: { status: 'publishing' } });

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

            const postData = {
                title: event.blogPostTitle,
                content: finalHtmlContent,
                status: 'publish', 
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
                        publicationDate: new Date(),
                        blogPostUrl: wordpressResponse.link,
                        featuredImageId: imageId,
                        featuredImageUrl: imageUrl
                    }
                }
            );

            console.log(`   ✅ Post para "${event.name}" publicado. URL: ${wordpressResponse.link}`);

        } catch (error) {
            console.error(`   ❌ Error procesando la publicación de "${event.name}":`, error.message);
            // --- DESBLOQUEO: Si algo falla, revertir el estado a 'enriched' ---
            await eventsCollection.updateOne({ _id: event._id }, { $set: { status: 'enriched' } });
        }
    }
}

// Exportar la función principal
module.exports = { publishPosts };