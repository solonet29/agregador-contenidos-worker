// publish-content.js (VERSIÓN CORREGIDA Y SIMPLIFICADA)

console.log("--- Ejecutando publish-content.js v4 (Sincronizado) ---");

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { publishToWordPress, uploadImage } = require('./lib/wordpressClient.js');
const { createSocialImage } = require('./lib/imageGenerator.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// NOTA: Se eliminan los módulos 'readline' y 'showdown' porque ya no son necesarios aquí.

console.log("--- Módulos cargados. Iniciando función main() ---");

const BATCH_SIZE = 10;

async function main() {
  console.log('Iniciando el publicador de contenidos...');
  let dbClient;
  try {
    const { db, client } = await connectToDatabase();
    dbClient = client; // Guardar cliente para cerrarlo en finally
    const eventsCollection = db.collection('events');

    const eventsToPublish = await eventsCollection.find({
      // Buscamos directamente los campos que necesitamos para publicar
      blogPostTitle: { $exists: true, $ne: "" },
      blogPostHtml: { $exists: true, $ne: "" },
      wordpressPostId: { $exists: false }
    }).limit(BATCH_SIZE).toArray();

    if (eventsToPublish.length === 0) {
      console.log('✅ No hay contenido nuevo para publicar en WordPress.');
      return;
    }

    console.log(`⚙️ Se encontraron ${eventsToPublish.length} eventos para publicar.`);

    for (const [index, event] of eventsToPublish.entries()) {
      try {
        console.log(`\nProcessing event: "${event.blogPostTitle}"`);

        console.log(`1/4: Creando imagen para "${event.name}"...`);
        const imagePath = await createSocialImage(event);

        console.log(`2/4: Subiendo imagen a WordPress...`);
        const imageId = await uploadImage(imagePath, event.name);
        if (!imageId) {
          throw new Error('La subida de la imagen falló, no se puede continuar con el post.');
        }

        // --- CAMBIO CLAVE ---
        // Ya no reconstruimos el contenido. Usamos directamente lo que generó content-creator.js
        const postTitle = event.blogPostTitle;
        const postContent = event.blogPostHtml;

        // Se añade el footer directamente al contenido que ya existe
        const footer = `
                <hr>
                <h3>¿Buscas el atuendo perfecto?</h3>
                <p>Visita nuestra <a href="https://afland.es/la-tienda-flamenca-afland/">Tienda Flamenca</a> para encontrar moda y accesorios únicos.</p>
                <p>➡️ <strong><a href="https://buscador.afland.es/?event_id=${event._id}">Ver todos los detalles de este evento en Duende Finder</a></strong></p>`;

        const finalHtmlContent = postContent + footer;

        const publicationDate = new Date();
        publicationDate.setHours(publicationDate.getHours() + index + 1);

        const categoryIdAsNumber = parseInt(process.env.WORDPRESS_EVENTS_CATEGORY_ID, 10);

        const postData = {
          title: postTitle,
          content: finalHtmlContent,
          status: 'future',
          date: publicationDate.toISOString(),
          categories: [categoryIdAsNumber],
          featured_media: imageId,
        };

        console.log(`3/4: Publicando post en WordPress...`);
        const wordpressResponse = await publishToWordPress(postData);

        console.log(`4/4: Actualizando evento en la base de datos...`);
        await eventsCollection.updateOne(
          { _id: event._id },
          { $set: { contentStatus: 'published', wordpressPostId: wordpressResponse.id, publicationDate: publicationDate, blogPostUrl: wordpressResponse.link } }
        );

        console.log(`✅ Post para "${event.name}" programado con éxito. URL: ${wordpressResponse.link}`);

      } catch (error) {
        console.error(`❌ Error procesando el evento "${event.name}":`, error.message);
      }
    }

  } catch (error) {
    console.error('Ha ocurrido un error fatal en el publicador:', error);
  } finally {
    // Se elimina rl.close() y se añade el cierre de la conexión a la BBDD si es necesario
    console.log('Proceso de publicación finalizado.');
  }
}

main();