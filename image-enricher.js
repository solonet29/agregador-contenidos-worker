// image-enricher.js

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { createFinderImage } = require('./lib/imageGenerator.js');
const { uploadImage } = require('./lib/wordpressClient.js');
const { ObjectId } = require('mongodb');
const fs = require('fs').promises; // Usamos la versión de promesas de fs

// --- CONFIGURACIÓN ---
// Para la primera ejecución, dejamos la query abierta para que procese todos.
// En el futuro, podríamos cambiarla a: { imageUrl: { $exists: false } }
const QUERY = {};
const BATCH_SIZE = 100; // Procesará eventos en lotes de 100 para no sobrecargar

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
                console.log("   1/4: Creando imagen con Sharp...");
                imagePath = await createFinderImage(event);
                if (!imagePath) throw new Error("La creación de la imagen falló.");

                // 2. Subir la imagen a WordPress
                console.log("   2/4: Subiendo imagen a WordPress...");
                const imageTitle = `${event.name} - ${event.city}`;
                const imageId = await uploadImage(imagePath, imageTitle);
                if (!imageId) throw new Error("La subida a WordPress falló.");

                // uploadImage devuelve el ID, pero necesitamos la URL.
                // Asumimos que el wordpressClient podría devolver más datos o construimos la URL.
                // Por ahora, nos centramos en actualizar el campo en la BBDD.
                // NOTA: Para obtener la URL final, necesitaríamos modificar uploadImage o hacer otra llamada.
                // De momento, guardaremos una marca de que la imagen se ha procesado.
                // En una futura mejora, guardaremos la URL completa.

                // 3. Actualizar la base de datos
                console.log("   3/4: Actualizando la base de datos...");
                // Aquí deberíamos guardar la URL final de la imagen. 
                // Por ahora, actualizaremos un campo para saber que se ha procesado.
                await eventsCollection.updateOne(
                    { _id: new ObjectId(event._id) },
                    {
                        $set: {
                            // En el futuro, aquí iría: imageUrl: wordpressResponse.source_url
                            imageGenerated: true,
                            lastImageUpdate: new Date()
                        }
                    }
                );

                console.log(`   ✅ Evento actualizado en MongoDB.`);

            } catch (error) {
                console.error(`   ❌ Error procesando el evento "${event.name}":`, error.message);
            } finally {
                // 4. Limpiar la imagen temporal
                if (imagePath) {
                    try {
                        await fs.unlink(imagePath);
                        console.log(`   4/4: Imagen temporal eliminada.`);
                    } catch (cleanupError) {
                        console.error(`   ⚠️ Error al eliminar la imagen temporal ${imagePath}:`, cleanupError.message);
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