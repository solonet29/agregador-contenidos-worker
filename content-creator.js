require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { ObjectId } = require('mongodb');
const { publishToWordPress } = require('./lib/wordpressClient.js');

const BATCH_SIZE = 4;

async function processPendingContent() {
  console.log('Iniciando el proceso de creación de contenido...');

  try {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    console.log('Conectado a MongoDB.');

    const eventsToProcess = await eventsCollection.find({
      nightPlan: { $exists: true, $ne: null },
      wordpressPostId: { $exists: false }
      name: { $exists: true, $ne: "" }
    }).limit(BATCH_SIZE).toArray();

    if (eventsToProcess.length === 0) {
      console.log('✅ No hay eventos nuevos con "Plan Noche" para procesar. Finalizando.');
      return;
    }

    console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para procesar en este lote.`);

    for (const [index, event] of eventsToProcess.entries()) {
      try {
        const publicationDate = new Date();
        publicationDate.setHours(publicationDate.getHours() + index + 1);

        const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/tienda-flamenca/) para encontrar moda y accesorios únicos.

➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})**
        `;
        const finalContent = `${event.nightPlan}\n\n${footer}`;

        // --- INICIO DE LA CORRECCIÓN ---
        // Leemos el ID de la categoría desde las variables de entorno
        const eventosCategoryId = process.env.WORDPRESS_EVENTS_CATEGORY_ID;

        const postData = {
          title: `Plan de Noche: Disfruta de ${event.name}`,
          content: finalContent,
          status: 'future',
          date: publicationDate.toISOString(),
          // Se añade la categoría al objeto que se envía a WordPress
          categories: [eventosCategoryId]
        };
        // --- FIN DE LA CORRECCIÓN ---

        const wordpressResponse = await publishToWordPress(postData);

        if (!wordpressResponse || !wordpressResponse.id) {
          throw new Error('La respuesta de la API de WordPress no contiene un ID de post.');
        }

        await eventsCollection.updateOne(
          { _id: event._id },
          {
            $set: {
              contentStatus: 'published',
              wordpressPostId: wordpressResponse.id,
              publicationDate: publicationDate,
              blogPostUrl: wordpressResponse.link
            }
          }
        );

        console.log(`✅ Post para "${event.name}" programado con éxito para: ${publicationDate.toLocaleString('es-ES')}`);

      } catch (error) {
        console.error(`❌ Error procesando el evento "${event.name}" (ID: ${event._id}):`, error.message);
      }
    }

  } catch (error) {
    console.error('Ha ocurrido un error fatal durante el proceso:', error);
  } finally {
    console.log('Proceso finalizado.');
  }
}

processPendingContent();