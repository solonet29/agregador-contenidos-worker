// update-existing-posts.js
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updatePost, getPost } = require('./lib/wordpressClient.js');
const { ObjectId } = require('mongodb');

// --- CONFIGURACIÓN DE BANNERS ---
// Define las URLs de los banners que necesitas reemplazar.
const BANNER_URL_M2_INCORRECTA = 'http://afland.es/wp-content/uploads/2025/08/banner_publicidad_restaurantes.jpg';
const BANNER_URL_M3_INCORRECTA = 'http://afland.es/wp-content/uploads/2025/08/banner_publicidad_hoteles.jpg';

// Define las URLs correctas para los banners.
const BANNER_URL_M2_CORRECTA = 'https://afland.es/wp-content/uploads/2025/08/banner_publicidad_restaurantes.jpg';
const BANNER_URL_M3_CORRECTA = 'https://afland.es/wp-content/uploads/2025/08/banner_publicidad_hoteles.jpg';

// --- FUNCIÓN PRINCIPAL DE CORRECCIÓN ---
async function fixBannerUrls() {
    console.log("--- 🚀 INICIANDO CORRECCIÓN PUNTUAL DE URLs DE BANNERS EN POSTS EXISTENTES ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // La consulta ahora busca todos los eventos que tienen un campo image_id.
        const query = {
            image_id: { $exists: true, $ne: null }
        };

        const eventsToProcess = await eventsCollection.find(query).toArray();

        if (eventsToProcess.length === 0) {
            console.log("✅ No se encontraron posts para verificar.");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} posts para procesar.`);

        for (const event of eventsToProcess) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🔄 Procesando post para el evento: "${event.name}" (ID de WordPress: ${event.blogPostId})`);

            try {
                // 1. Obtener el contenido actual del post de WordPress.
                const wordpressPost = await getPost(event.blogPostId);

                if (!wordpressPost) {
                    console.warn(`   ⚠️ No se pudo encontrar el post con ID ${event.blogPostId}. Omitiendo.`);
                    continue;
                }

                let originalContent = wordpressPost.content.rendered;
                let updatedContent = originalContent;
                let changesMade = false;

                // 2. Reemplazar las URLs incorrectas por las correctas.
                const newContent = updatedContent.replace(
                    new RegExp(BANNER_URL_M2_INCORRECTA, 'g'),
                    BANNER_URL_M2_CORRECTA
                );

                const finalContent = newContent.replace(
                    new RegExp(BANNER_URL_M3_INCORRECTA, 'g'),
                    BANNER_URL_M3_CORRECTA
                );

                if (originalContent !== finalContent) {
                    changesMade = true;
                    updatedContent = finalContent;
                }

                // 3. Solo actualizar si hubo cambios.
                if (changesMade) {
                    await updatePost(event.blogPostId, wordpressPost.title.rendered, updatedContent);
                    console.log(`   ✅ URLs corregidas y post ${event.blogPostId} actualizado exitosamente.`);

                    // 4. Marcar en la base de datos que este post ya ha sido corregido.
                    await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        { $set: { urlsCorrected: true, correctionDate: new Date() } }
                    );
                } else {
                    console.log(`   🔍 No se encontraron URLs incorrectas en este post. No se requiere corrección.`);
                }

            } catch (error) {
                console.error(`   ❌ Error al procesar el post "${event.name}":`, error.message);
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal:", error);
    } finally {
        console.log("\n--- ✨ PROCESO DE CORRECCIÓN FINALIZADO ---");
        process.exit(0);
    }
}

fixBannerUrls();