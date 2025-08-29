// update-existing-posts.js (El "Revisor de Contenido")
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updatePost, getPost } = require('./lib/wordpressClient.js'); // Necesitamos getPost y updatePost
const { ObjectId } = require('mongodb');

// --- CONFIGURACIÓN DE BANNERS ---
// Reemplaza estas URLs con las que obtuviste de la biblioteca de medios de WordPress.
const BANNER_URL_M2 = 'https://afland.es/wp-content/uploads/2025/08/banner_publicidad_restaurantes.jpg';
const BANNER_URL_M3 = 'https://afland.es/wp-content/uploads/2025/08/banner_publicidad_hoteles.jpg';

// --- FUNCIÓN PARA GENERAR EL HTML DE LOS BANNERS ---
function createBannersHtml() {
    return `
        <div class="banner-container" style="text-align: center; margin: 30px 0;">
            <a href="#">
                <img src="${BANNER_URL_M2}" alt="Publicidad de AFland Restaurantes..." style="max-width: 100%; height: auto; margin-bottom: 20px;" />
            </a>
            <a href="#">
                <img src="${BANNER_URL_M3}" alt="Publicidad de AFland Hoteles, Salas..." style="max-width: 100%; height: auto;" />
            </a>
        </div>
    `;
}

// --- FUNCIÓN PRINCIPAL DE ACTUALIZACIÓN ---
async function updatePostsWithBanners() {
    console.log("--- 🚀 INICIANDO INYECCIÓN DE BANNERS EN POSTS EXISTENTES ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // La consulta busca los eventos que ya han sido publicados en WordPress
        // pero que no tienen nuestra bandera 'hasBanners' para evitar duplicados.
        const query = {
            blogPostId: { $exists: true, $ne: null },
            hasBanners: { $exists: false }
        };
        const eventsToUpdate = await eventsCollection.find(query).toArray();

        if (eventsToUpdate.length === 0) {
            console.log("✅ No se encontraron posts para actualizar con banners.");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToUpdate.length} posts para actualizar.`);
        const bannersHtml = createBannersHtml();

        for (const event of eventsToUpdate) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🔄 Procesando post para el evento: "${event.name}"`);

            try {
                // 1. OBTENER el contenido actual del post de WordPress usando su ID.
                const wordpressPost = await getPost(event.blogPostId);

                if (!wordpressPost) {
                    console.warn(`   ⚠️ No se pudo encontrar el post con ID ${event.blogPostId}. Omitiendo.`);
                    continue;
                }

                // 2. MODIFICAR el contenido: Inyectar los banners al final del contenido existente.
                const updatedContent = wordpressPost.content.rendered + bannersHtml;

                // 3. ENVIAR la actualización a WordPress. Usamos el título original y el nuevo contenido.
                await updatePost(event.blogPostId, wordpressPost.title.rendered, updatedContent);

                // 4. ACTUALIZAR la base de datos para no procesar este evento de nuevo.
                await eventsCollection.updateOne(
                    { _id: new ObjectId(event._id) },
                    { $set: { hasBanners: true, lastUpdate: new Date() } }
                );

                console.log(`   ✅ Post ${event.blogPostId} actualizado exitosamente.`);

            } catch (error) {
                console.error(`   ❌ Error al inyectar banners en el post "${event.name}":`, error.message);
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal:", error);
    } finally {
        console.log("\n--- ✨ PROCESO FINALIZADO ---");
        process.exit(0);
    }
}

updatePostsWithBanners();