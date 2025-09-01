// update-existing-posts.js
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { getPost, updateWordPressPost } = require('./lib/wordpressClient.js');
const { ObjectId } = require('mongodb');

// --- CONFIGURACIÓN DE BANNERS ---
// Define las URLs correctas para los banners.
const BANNER_URL_M2_CORRECTA = 'https://afland.es/wp-content/uploads/2025/08/banner-publicidad-1.jpg';
const BANNER_URL_M3_CORRECTA = 'https://afland.es/wp-content/uploads/2025/08/banner-publicidad-2.jpg';

// Define el HTML completo de los nuevos banners para la inyección.
function createBannersHtml() {
    return `
        <div class="banner-container" style="text-align: center; margin: 30px 0;">
            <a href="#">
                <img src="${BANNER_URL_M2_CORRECTA}" alt="Publicidad de AFland Restaurantes..." style="max-width: 100%; height: auto; margin-bottom: 20px;" />
            </a>
            <a href="#">
                <img src="${BANNER_URL_M3_CORRECTA}" alt="Publicidad de AFland Hoteles, Salas..." style="max-width: 100%; height: auto;" />
            </a>
        </div>
    `;
}

// --- QUERY DE MONGODB ---
// ¡Esta es la corrección final! Ahora busca TODOS los posts con un wordpressPostId,
// sin importar si fueron marcados como corregidos.
const QUERY = {
    wordpressPostId: { $exists: true, $ne: null }
};

async function updatePostBanners() {
    console.log("--- 🚀 INICIANDO ACTUALIZACIÓN DE BANNERS EN POSTS PUBLICADOS ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        const eventsToProcess = await eventsCollection.find(QUERY).toArray();

        if (eventsToProcess.length === 0) {
            console.log("✅ No se encontraron posts para corregir. ¡Trabajo completado!");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} posts para actualizar sus banners.`);

        for (const event of eventsToProcess) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🖼️  Procesando banners para: "${event.name}" (WP ID: ${event.wordpressPostId})`);

            try {
                const wordpressPost = await getPost(event.wordpressPostId);

                if (!wordpressPost) {
                    console.warn(`   ⚠️ No se pudo encontrar el post con ID ${event.wordpressPostId}. Omitiendo.`);
                    continue;
                }

                let originalContent = wordpressPost.content.rendered;

                // 1. Usar una expresión regular para encontrar y eliminar cualquier rastro de banners anteriores.
                const bannerRegex = /<div[^>]*class="banner-container"[^>]*>[\s\S]*?<\/div>/g;
                let contentWithoutOldBanners = originalContent.replace(bannerRegex, '');

                // 2. Si se eliminaron banners, añade los nuevos banners al final del contenido.
                let updatedContent = contentWithoutOldBanners;
                if (originalContent !== contentWithoutOldBanners) {
                    updatedContent += createBannersHtml();
                } else {
                    // Si el post no tenía banners, simplemente los añadimos.
                    updatedContent += createBannersHtml();
                }

                // 3. Actualizar el post en WordPress.
                await updateWordPressPost(event.wordpressPostId, {
                    title: wordpressPost.title.rendered,
                    content: updatedContent
                });

                // 4. Marcar el evento en nuestra base de datos.
                await eventsCollection.updateOne(
                    { _id: new ObjectId(event._id) },
                    { $set: { urlsCorrected: true, correctionDate: new Date() } }
                );

                console.log(`   ✅ Post ${event.wordpressPostId} actualizado en WordPress con los nuevos banners.`);

            } catch (error) {
                console.error(`   ❌ Error actualizando el post "${event.name}":`, error.message);
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal:", error);
    } finally {
        console.log("\n--- ✨ PROCESO FINALIZADO ---");
        process.exit(0);
    }
}

updatePostBanners();