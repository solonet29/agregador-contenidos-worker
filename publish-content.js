// publish-content.js (VERSIÓN DE DEPURACIÓN)
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { publishToWordPress, uploadImage } = require('./lib/wordpressClient.js');
const showdown = require('showdown');
const { createSocialImage } = require('./lib/imageGenerator.js');

const BATCH_SIZE = 12;

async function main() {
  console.log('Iniciando el publicador de contenidos...');
  try {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    const eventsToPublish = await eventsCollection.find({
      nightPlan: { $exists: true, $ne: null },
      wordpressPostId: { $exists: false },
      name: { $exists: true, $ne: "" }
    }).limit(BATCH_SIZE).toArray();

    if (eventsToPublish.length === 0) {
      console.log('✅ No hay contenido nuevo para publicar en WordPress.');
      return;
    }

    console.log(`⚙️ Se encontraron ${eventsToPublish.length} eventos para publicar.`);
    const converter = new showdown.Converter();

    for (const [index, event] of eventsToPublish.entries()) {
      try {
        console.log(`--- Procesando evento: "${event.name}" ---`);
        const imagePath = await createSocialImage(event);
        const imageId = await uploadImage(imagePath, event.name);
        if (!imageId) {
          throw new Error('La subida de la imagen falló, no se puede continuar con el post.');
        }

        const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/tienda-flamenca/) para encontrar moda y accesorios únicos.
➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})**`;

        const markdownContent = `${event.nightPlan}\n\n${footer}`;
        const htmlContent = converter.makeHtml(markdownContent);

        const publicationDate = new Date();
        publicationDate.setHours(publicationDate.getHours() + index + 1);

        // ==========================================================
        // --- INICIO DE LA DEPURACIÓN ---
        console.log("--- DEPURANDO LA CATEGORÍA ---");
        const categoryIdAsString = process.env.WORDPRESS_EVENTS_CATEGORY_ID;
        console.log(`1. Valor leído de .env (debería ser "96"): -> ${categoryIdAsString}`);
        console.log(`2. Tipo de dato leído de .env (debería ser "string"): -> ${typeof categoryIdAsString}`);

        const categoryIdAsNumber = parseInt(categoryIdAsString, 10);
        console.log(`3. Valor después de parseInt (debería ser 96): -> ${categoryIdAsNumber}`);
        console.log(`4. Tipo de dato después de parseInt (debería ser "number"): -> ${typeof categoryIdAsNumber}`);
        // --- FIN DE LA DEPURACIÓN ---
        // ==========================================================

        const postData = {
          title: `Plan de Noche: Disfruta de ${event.name}`,
          content: htmlContent,
          status: 'future',
          date: publicationDate.toISOString(),
          categories: [categoryIdAsNumber],
          featured_media: imageId,
        };

        console.log('5. Objeto final que se envía a WordPress:');
        console.log(JSON.stringify(postData, null, 2));
        console.log("---------------------------------");


        const wordpressResponse = await publishToWordPress(postData);

        await eventsCollection.updateOne(
          { _id: event._id },
          { $set: { contentStatus: 'published', wordpressPostId: wordpressResponse.id, publicationDate: publicationDate, blogPostUrl: wordpressResponse.link } }
        );

        console.log(`✅ Post para "${event.name}" programado con éxito.`);

      } catch (error) {
        console.error(`❌ Error procesando el evento "${event.name}":`, error.message);
      }
    }

  } catch (error) {
    console.error('Ha ocurrido un error fatal en el publicador:', error);
  } finally {
    console.log('Proceso de publicación finalizado.');
  }
}

// Añade esta línea al final
module.exports = { runPublishingBatch: main }; // Exportamos la función 'main' con un nombre más claro