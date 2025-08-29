// post-sanitizer.js (V6 - MODO INYECCIÓN HTML)

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updateWordPressPost } = require('./lib/wordpressClient.js');
const { ObjectId } = require('mongodb');

// NOTA: No se requiere @google/generative-ai ni showdown. Es independiente.

// --- ANÁLISIS DE FLAGS DE LÍNEA DE COMANDOS ---
const args = process.argv.slice(2);
const flags = {
    dryRun: args.includes('--dry-run')
};

async function injectCta() {
    console.log('--- INICIANDO SCRIPT DE INYECCIÓN DE CTA ---');
    if (flags.dryRun) console.log('⚠️  MODO SIMULACIÓN ACTIVADO (--dry-run). No se realizarán cambios reales.');

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // --- BLOQUE HTML A INYECTAR ---
        // Pega aquí las URLs de las imágenes horizontales que acabas de subir a WordPress
        const ctaBlockHtml = `
            <hr>
            <h2>¿Quieres ver tu negocio aquí?</h2>
            <p>Destaca tu bar, restaurante, hotel o tienda ante miles de aficionados al flamenco. <a href="https://afland.es/contact/" target="_blank" rel="noopener">Contacta con nosotros</a> y descubre nuestras opciones de patrocinio.</p>
            
            <img src="URL_DE_TU_IMAGEN_HORIZONTAL_1" alt="Publicidad para restaurantes y tablaos flamencos" style="width:100%; height:auto; margin:10px 0; border:1px solid #ddd; border-radius:4px; aspect-ratio: 16/9; object-fit: cover;">
            
            <img src="URL_DE_TU_IMAGEN_HORIZONTAL_2" alt="Publicidad para hoteles y alojamientos con encanto" style="width:100%; height:auto; margin:10px 0; border:1px solid #ddd; border-radius:4px; aspect-ratio: 16/9; object-fit: cover;">
        `;

        // Query para encontrar posts que ya tienen contenido pero NO tienen nuestro nuevo bloque
        const query = {
            wordpressPostId: { $exists: true },
            blogPostHtml: { $exists: true, $not: /¿Quieres ver tu negocio aquí?/i }
        };
        const postsToUpdate = await eventsCollection.find(query).toArray();

        if (postsToUpdate.length === 0) {
            console.log('✅ No se encontraron posts para actualizar. Parece que todos tienen ya la llamada a la acción.');
            return;
        }

        console.log(`⚙️ Se encontraron ${postsToUpdate.length} posts para inyectar la llamada a la acción.`);

        for (const event of postsToUpdate) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`Procesando: "${event.blogPostTitle}" (WP ID: ${event.wordpressPostId})`);

            try {
                // Unimos el contenido existente con nuestro nuevo bloque
                const newHtmlContent = event.blogPostHtml + ctaBlockHtml;

                // El footer final ("Ver todos los detalles...") se añade en el momento de la publicación.
                // Aquí solo nos centramos en el cuerpo principal del post.
                const finalContentForWordPress = newHtmlContent;

                if (!flags.dryRun) {
                    // Actualizamos la base de datos primero para que sea consistente
                    await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        { $set: { blogPostHtml: newHtmlContent } }
                    );

                    // Preparamos los datos para WordPress (solo actualizamos el contenido)
                    const updateData = {
                        content: finalContentForWordPress
                    };

                    await updateWordPressPost(event.wordpressPostId, updateData);
                    console.log(`✅ CTA inyectado con éxito.`);
                } else {
                    console.log(`[SIMULACIÓN] Se inyectaría el bloque de CTA en este post.`);
                }

            } catch (error) {
                console.error(`❌ Error actualizando el evento "${event.name}":`, error.message);
            }
        }
        console.log(`\n--- PROCESO DE INYECCIÓN FINALIZADO ---`);

    } catch (error) {
        console.error('Ha ocurrido un error fatal:', error);
    } finally {
        process.exit(0);
    }
}

injectCta();