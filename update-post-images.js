// update-post-images.js

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { createFinderImage } = require('./lib/imageGenerator.js');
const { uploadImage, updateWordPressPost } = require('./lib/wordpressClient.js');
const { ObjectId } = require('mongodb');
const fs = require('fs').promises;

// Query: Busca eventos que SÍ tienen un post en WordPress y SÍ tienen una imagen nueva generada,
// pero que AÚN NO hemos marcado como actualizados.
const QUERY = {
    wordpressPostId: { $exists: true },
    imageId: { $exists: true },
    postImageUpdated: { $exists: false }
};
const BATCH_SIZE = 100;

async function updatePostImages() {
    console.log("--- 🚀 INICIANDO ACTUALIZADOR DE IMÁGENES DE POSTS PUBLICADOS ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        const eventsToUpdate = await eventsCollection.find(QUERY).limit(BATCH_SIZE).toArray();

        if (eventsToUpdate.length === 0) {
            console.log("✅ No se encontraron más posts para actualizar. ¡Trabajo completado!");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToUpdate.length} posts en este lote para actualizar su imagen.`);

        for (const event of eventsToUpdate) {
            try {
                console.log(`\n-----------------------------------------------------`);
                console.log(`🖼️  Actualizando imagen para: "${event.blogPostTitle || event.name}" (WP ID: ${event.wordpressPostId})`);

                // Preparamos los datos para la actualización en WordPress.
                // Solo necesitamos enviarle el ID de la nueva imagen destacada.
                const updateData = {
                    featured_media: event.imageId
                };

                // Actualizamos el post en WordPress
                await updateWordPressPost(event.wordpressPostId, updateData);

                // Marcamos el evento en nuestra base de datos para no volver a procesarlo
                await eventsCollection.updateOne(
                    { _id: new ObjectId(event._id) },
                    { $set: { postImageUpdated: true } }
                );

                console.log(`   ✅ Post actualizado en WordPress con la nueva imagen.`);

            } catch (error) {
                console.error(`   ❌ Error actualizando el post "${event.blogPostTitle || event.name}":`, error.message);
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal:", error);
    } finally {
        console.log("\n--- ✨ LOTE DE ACTUALIZACIÓN FINALIZADO ---");
        process.exit(0);
    }
}

updatePostImages();