// publish-content.js
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { publishToWordPress, uploadImage } = require('./lib/wordpressClient.js');
const showdown = require('showdown');
const { createSocialImage } = require('./lib/imageGenerator.js'); // Importamos el generador de imágenes

const BATCH_SIZE = 4;

async function main() {
  console.log('Iniciando el publicador de contenidos...');
  try {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    // Busca eventos con plan generado que aún no han sido publicados
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
        // --- PASO 1: CREAR IMAGEN ---
        console.log(`🎨 Creando imagen para "${event.name}"...`);
        const imagePath = await createSocialImage(event); // Esta función debe devolver la ruta al archivo .png

        // --- PASO 2: SUBIR IMAGEN A WORDPRESS ---
        const imageId = await uploadImage(imagePath);
        if (!imageId) {
          throw new Error('La subida de la imagen falló, no se puede continuar con el post.');
        }

        // --- PASO 3: PREPARAR CONTENIDO HTML ---
        const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/tienda-flamenca/) para encontrar moda y accesorios únicos.
➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})**`;

        const markdownContent = `${event.nightPlan}\n\n${footer}`;
        const htmlContent = converter.makeHtml(markdownContent);

        // --- PASO 4: PUBLICAR EL POST EN WORDPRESS ---
        const publicationDate = new Date();
        publicationDate.setHours(publicationDate.getHours() + index + 1);

        const postData = {
          title: `Plan de Noche: Disfruta de ${event.name}`,
          content: htmlContent,
          status: 'future',
          date: publicationDate.toISOString(),
          categories: [process.env.WORDPRESS_EVENTS_CATEGORY_ID],
          featured_media: imageId,
        };

        const wordpressResponse = await publishToWordPress(postData);

        // --- PASO 5: ACTUALIZAR NUESTRA BASE DE DATOS ---
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