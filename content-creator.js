
const mongoose = require('mongoose');
const Event = require('./models/Event'); // Asegúrate de que la ruta al modelo Event sea correcta
const { publishToWordPress } = require('./wordpressClient'); // Cliente de WordPress
require('dotenv').config();

// --- CONFIGURACIÓN ---
const BATCH_SIZE = 5;
const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Conecta a la base de datos MongoDB.
 */
async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB.');
}

/**
 * Procesa los eventos con contenido pendiente y los programa en WordPress.
 * Funciona en lotes para ser compatible con entornos serverless.
 */
async function processPendingContent() {
  console.log('Iniciando el proceso de creación de contenido...');

  try {
    await connectDB();

    // 1. Buscar eventos pendientes en la base de datos
    const eventsToProcess = await Event.find({
      contentStatus: 'pending',
      contentForPost: { $exists: true, $ne: null }
    }).limit(BATCH_SIZE);

    if (eventsToProcess.length === 0) {
      console.log('No hay eventos pendientes para procesar. Finalizando.');
      return;
    }

    console.log(`Se encontraron ${eventsToProcess.length} eventos para procesar en este lote.`);

    // 2. Procesar cada evento del lote
    for (const [index, event] of eventsToProcess.entries()) {
      try {
        // 3. Calcular la fecha de publicación futura incremental
        const publicationDate = new Date();
        publicationDate.setHours(publicationDate.getHours() + index + 1);

        // 4. Crear el contenido final con el footer
        const footer = `
---
Visita nuestra [Tienda Flamenca](https://afland.es/tienda-flamenca/) para encontrar moda y accesorios únicos.
[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})
        `;
        const finalContent = `${event.contentForPost}

${footer}`;

        // 5. Preparar los datos para la API de WordPress
        const postData = {
          title: `Plan de Noche: Disfruta de ${event.title}`,
          content: finalContent,
          status: 'future',
          date: publicationDate.toISOString(),
          // Aquí podrías añadir categorías, etiquetas, etc. si fuera necesario
          // categories: [1, 2],
          // tags: 'flamenco, evento, Madrid'
        };

        // 6. Publicar en WordPress
        const wordpressResponse = await publishToWordPress(postData);

        if (!wordpressResponse || !wordpressResponse.id) {
            throw new Error('La respuesta de la API de WordPress no contiene un ID de post.');
        }

        // 7. Actualizar el estado del evento en MongoDB
        event.contentStatus = 'published';
        event.wordpressPostId = wordpressResponse.id;
        event.publicationDate = publicationDate;
        await event.save();

        console.log(`✅ Post para "${event.title}" programado con éxito para: ${publicationDate.toLocaleString('es-ES')}`);

      } catch (error) {
        console.error(`❌ Error procesando el evento "${event.title}" (ID: ${event._id}):`, error.message);
        // Opcional: Marcar el evento como fallido para no reintentarlo indefinidamente
        // event.contentStatus = 'failed';
        // await event.save();
      }
    }

  } catch (error) {
    console.error('Ha ocurrido un error fatal durante el proceso:', error);
  } finally {
    // 8. Cerrar la conexión a la base de datos
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB. Proceso finalizado.');
  }
}

// --- EJECUCIÓN ---
// Esta parte se puede llamar desde un endpoint de Vercel, un cron job, o directamente.
processPendingContent();
