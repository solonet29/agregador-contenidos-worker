// post-updater.js

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updateWordPressPost } = require('./lib/wordpressClient.js');
const { ObjectId } = require('mongodb');

// --- CONFIGURACIÓN ---
// Buscamos eventos que ya tienen un blogPostId y un imageId.
const QUERY = {
    blogPostId: { $exists: true, $ne: null },
    imageId: { $exists: true, $ne: null }
};
const BATCH_SIZE = 50;

async function updatePosts() {
    console.log("--- 🔄 INICIANDO ACTUALIZADOR DE POSTS ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        console.log("🔎 Buscando eventos con posts y nuevas imágenes...");
        const eventsToUpdate = await eventsCollection.find(QUERY).limit(BATCH_SIZE).toArray();

        if (eventsToUpdate.length === 0) {
            console.log("✅ No se encontraron posts para actualizar. ¡Trabajo hecho!");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToUpdate.length} posts para procesar en este lote.`);

        for (const event of eventsToUpdate) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🖼️ Actualizando post para el evento: "${event.name}"`);

            try {
                // Preparamos los datos para la actualización.
                // Usamos el imageId del evento.
                const updateData = {
                    featured_media: event.imageId
                };

                // Llamamos a la función de la API de WordPress para actualizar el post.
                // Usamos el blogPostId del evento.
                const result = await updateWordPressPost(event.blogPostId, updateData);

                if (result) {
                    console.log(` ✅ Post actualizado en WordPress con éxito.`);
                    await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        { $set: { postImageUpdated: true } }
                    );
                    console.log(` ✅ Estado del evento actualizado en MongoDB.`);
                }
            } catch (error) {
                console.error(` ❌ Error al procesar el post de "${event.name}":`, error.message);
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal durante la actualización de posts:", error);
    } finally {
        console.log("\n--- ✨ PROCESO DE ACTUALIZACIÓN FINALIZADO ---");
        process.exit(0);
    }
}

updatePosts();