// image-enricher.js

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { createFinderImage } = require('./lib/imageGenerator.js');
const { uploadImage } = require('./lib/wordpressClient.js'); // Esta función debe ser modificada
const { ObjectId } = require('mongodb'); // Usamos ObjectId para trabajar con los IDs de MongoDB
const fs = require('fs').promises; // Usamos la versión de promesas de fs

// --- CONFIGURACIÓN ---
// Ahora la query busca específicamente eventos sin una URL de imagen
const QUERY = { lastImageUpdate: { $exists: false } };
const BATCH_SIZE = 200;

async function enrichImages() {
    console.log("--- 🚀 INICIANDO ENRIQUECEDOR DE IMÁGENES ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        console.log("🔎 Buscando eventos para enriquecer...");
        const eventsToProcess = await eventsCollection.find(QUERY).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log("✅ No se encontraron eventos que necesiten una nueva imagen. ¡Trabajo hecho!");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos en este lote para procesar.`);

        for (const event of eventsToProcess) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🎨 Procesando evento: "${event.name}" en "${event.city}"`);

            let imagePath = null;
            try {
                // 1. Crear la imagen localmente
                console.log("   1/4: Creando imagen con Sharp...");
                imagePath = await createFinderImage(event);
                if (!imagePath) throw new Error("La creación de la imagen falló.");

                // 2. Subir la imagen a WordPress y obtener el ID y la URL
                console.log("   2/4: Subiendo imagen a WordPress...");
                const imageTitle = `${event.name} - ${event.city}`;
                const uploadResponse = await uploadImage(imagePath, imageTitle);
                if (!uploadResponse || !uploadResponse.imageId || !uploadResponse.imageUrl) {
                    throw new Error("La subida a WordPress falló o no devolvió los datos correctos.");
                }

                console.log(`   ✅ Imagen subida con éxito. ID: ${uploadResponse.imageId}, URL: ${uploadResponse.imageUrl}`);

                // 3. Actualizar la base de datos con los campos correctos
                console.log("   3/4: Actualizando la base de datos...");
                await eventsCollection.updateOne(
                    { _id: new ObjectId(event._id) },
                    {
                        $set: {
                            imageId: uploadResponse.imageId,
                            imageUrl: uploadResponse.imageUrl,
                            lastImageUpdate: new Date()
                        }
                    }
                );

                console.log(`   ✅ Evento actualizado en MongoDB.`);

            } catch (error) {
                console.error(`   ❌ Error procesando el evento "${event.name}":`, error.message);
            } finally {
                // 4. Limpiar la imagen temporal
                if (imagePath) {
                    try {
                        await fs.unlink(imagePath);
                        console.log(`   4/4: Imagen temporal eliminada.`);
                    } catch (cleanupError) {
                        console.error(`   ⚠️ Error al eliminar la imagen temporal ${imagePath}:`, cleanupError.message);
                    }
                }
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal durante el enriquecimiento:", error);
    } finally {
        console.log("\n--- ✨ PROCESO DE ENRIQUECIMIENTO FINALIZADO ---");
        process.exit(0);
    }
}

enrichImages();