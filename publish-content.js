// publish-content.js (VERSIÓN DE DEPURACIÓN DE MÓDULOS)

console.log("--- Ejecutando publish-content.js v3 (Depurando Módulos) ---");

require('dotenv').config();
console.log("✅ 1/5: Módulo 'dotenv' cargado.");

const { connectToDatabase } = require('./lib/database.js');
console.log("✅ 2/5: Módulo 'database.js' cargado.");

const { publishToWordPress, uploadImage } = require('./lib/wordpressClient.js');
console.log("✅ 3/5: Módulo 'wordpressClient.js' cargado.");

const showdown = require('showdown');
console.log("✅ 4/5: Módulo 'showdown' cargado.");

const { createSocialImage } = require('./lib/imageGenerator.js');
console.log("✅ 5/5: Módulo 'imageGenerator.js' cargado.");

console.log("--- Todos los módulos cargados. Iniciando función main() ---");

const BATCH_SIZE = 10;

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
        console.log(`Creando imagen para "${event.name}"...`);
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

        const categoryIdAsNumber = parseInt(process.env.WORDPRESS_EVENTS_CATEGORY_ID, 10);

        const postData = {
          title: `Plan de Noche: Disfruta de ${event.name}`,
          content: htmlContent,
          status: 'future',
          date: publicationDate.toISOString(),
          categories: [categoryIdAsNumber],
          featured_media: imageId,
        };

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

main();