// image-rescue.js

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { findImageByTitle } = require('./lib/wordpressClient.js'); // Importamos la nueva función
const { ObjectId } = require('mongodb');

// --- CONFIGURACIÓN ---
// Buscamos eventos que tienen una imagen generada pero sin URL (el caso del error).
const QUERY = {
    imageUrl: { $exists: false },
    lastImageUpdate: { $exists: true }
};
const BATCH_SIZE = 50;

async function rescueImages() {
    console.log("--- 🚑 INICIANDO RESCATE DE IMÁGENES ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        console.log("🔎 Buscando eventos huérfanos...");
        const eventsToRescue = await eventsCollection.find(QUERY).limit(BATCH_SIZE).toArray();

        if (eventsToRescue.length === 0) {
            console.log("✅ No se encontraron eventos para rescatar. ¡Trabajo hecho!");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToRescue.length} eventos para procesar en este lote.`);

        for (const event of eventsToRescue) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🔄 Rescatando imagen para: "${event.name}" en "${event.city}"`);

            try {
                // Generamos el título que usamos para la búsqueda en WordPress
                const imageTitle = `${event.name} - ${event.city}`;

                // Buscamos la imagen en WordPress
                const imageData = await findImageByTitle(imageTitle);

                if (imageData && imageData.imageId && imageData.imageUrl) {
                    console.log("   1/2: Imagen encontrada en WordPress. Actualizando la base de datos...");
                    await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        {
                            $set: {
                                imageId: imageData.imageId,
                                imageUrl: imageData.imageUrl
                            }
                        }
                    );
                    console.log(`   ✅ Evento actualizado con éxito. URL: ${imageData.imageUrl}`);
                } else {
                    console.log("   ❌ No se pudo encontrar la imagen en WordPress. Saltando al siguiente evento.");
                }

            } catch (error) {
                console.error(`   ❌ Error al procesar el rescate para "${event.name}":`, error.message);
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal durante el rescate:", error);
    } finally {
        console.log("\n--- ✨ PROCESO DE RESCATE FINALIZADO ---");
        process.exit(0);
    }
}

rescueImages();