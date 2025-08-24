// CAMBIO: Se elimina mongoose y se importa el helper y ObjectId
const { connectToDatabase } = require('./lib/database');
const { ObjectId } = require('mongodb');
const { publishToWordPress } = require('./lib/wordpressClient'); // Asumimos que está en /lib
require('dotenv').config();

// --- CONFIGURACIÓN ---
const BATCH_SIZE = 5;

/**
 * Procesa eventos que tienen un 'nightPlan' generado pero aún no han sido
 * publicados en WordPress.
 */
async function processPendingContent() {
  console.log('Iniciando el proceso de creación de contenido...');

  try {
    // CAMBIO: Usamos nuestro helper para conectar, no la función de Mongoose
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    console.log('Conectado a MongoDB.');

    // 1. CAMBIO: La consulta ahora busca eventos con 'nightPlan' pero sin 'wordpressPostId'
    const eventsToProcess = await eventsCollection.find({
      nightPlan: { $exists: true, $ne: null },
      wordpressPostId: { $exists: false } // La mejor forma de saber que no ha sido publicado
    }).limit(BATCH_SIZE).toArray();

    if (eventsToProcess.length === 0) {
      console.log('✅ No hay eventos nuevos con "Plan Noche" para procesar. Finalizando.');
      return;
    }

    console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para procesar en este lote.`);

    // 2. Procesar cada evento del lote
    for (const [index, event] of eventsToProcess.entries()) {
      try {
        // 3. Calcular la fecha de publicación futura incremental
        const publicationDate = new Date();
        publicationDate.setHours(publicationDate.getHours() + index + 1);

        // 4. Crear el contenido final con el footer
        const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/tienda-flamenca/) para encontrar moda y accesorios únicos.

➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})**
        `;
        // CAMBIO: Leemos el contenido desde event.nightPlan
        const finalContent = `${event.nightPlan}\n\n${footer}`;

        // 5. Preparar los datos para la API de WordPress
        const postData = {
          title: `Plan de Noche: Disfruta de ${event.name}`, // Usamos event.name que es el campo correcto
          content: finalContent,
          status: 'future',
          date: publicationDate.toISOString(),
        };

        // 6. Publicar en WordPress
        const wordpressResponse = await publishToWordPress(postData);

        if (!wordpressResponse || !wordpressResponse.id) {
          throw new Error('La respuesta de la API de WordPress no contiene un ID de post.');
        }

        // 7. CAMBIO: Actualizar el estado del evento en MongoDB usando updateOne
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
        // Podríamos añadir un estado de 'failed' aquí si quisiéramos
        // await eventsCollection.updateOne({ _id: event._id }, { $set: { contentStatus: 'failed' } });
      }
    }

  } catch (error) {
    console.error('Ha ocurrido un error fatal durante el proceso:', error);
  } finally {
    // CAMBIO: La desconexión la maneja el helper, ya no es necesaria aquí.
    console.log('Proceso finalizado.');
  }
}

// --- EJECUCIÓN ---
processPendingContent();