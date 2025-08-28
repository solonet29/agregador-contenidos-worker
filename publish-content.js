// publish-content.js (VERSIÓN FINAL Y COMPLETA)

console.log("--- Ejecutando publish-content.js v3 (Depurando Módulos) ---");

require('dotenv').config();
console.log("✅ 1/5: Módulo 'dotenv' cargado.");

const { connectToDatabase } = require('./lib/database.js');
console.log("✅ 2/5: Módulo 'database.js' cargado.");

const { publishToWordPress, uploadImage, deleteWordPressPost } = require('./lib/wordpressClient.js');
console.log("✅ 3/5: Módulo 'wordpressClient.js' cargado.");

const showdown = require('showdown');
console.log("✅ 4/5: Módulo 'showdown' cargado.");

const { createSocialImage } = require('./lib/imageGenerator.js');
console.log("✅ 5/5: Módulo 'imageGenerator.js' cargado.");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const readline = require('readline');

// Configuración de clientes para la verificación con Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("--- Todos los módulos cargados. Iniciando función main() ---");

const BATCH_SIZE = 10;

/**
 * Pide al usuario confirmación por consola.
 * @param {string} query - El mensaje de confirmación.
 * @returns {Promise<boolean>} Retorna true si el usuario confirma.
 */
async function askQuestion(query) {
  return new Promise(resolve => rl.question(query, ans => {
    resolve(ans.toLowerCase() === 's' || ans.toLowerCase() === 'y');
  }));
}

/**
 * Verifica si un evento está relacionado con el flamenco utilizando Gemini.
 * @param {object} eventData - Datos del evento (artista, nombre, descripción).
 * @returns {Promise<boolean>} Retorna true si es flamenco, false en caso contrario.
 */
async function verifyFlamencoWithGemini(eventData) {
  const prompt = `Analiza la siguiente información de un evento. Responde SÓLO con "flamenco" o "no-flamenco". NO añadas texto adicional.
    
    Nombre: ${eventData.name}
    Artista: ${eventData.artist}
    Descripción: ${eventData.description}
    
    ¿Es este un evento de flamenco?`;

  try {
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim().toLowerCase();

    if (text.includes('flamenco') && !text.includes('no-flamenco')) {
      return true;
    }
  } catch (error) {
    console.error('Error al verificar el evento con Gemini:', error);
  }
  return false;
}

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
      // --- PASO DE SANEAMIENTO: Validación de Flamenco (NUEVO) ---
      const isFlamenco = await verifyFlamencoWithGemini(event);
      if (!isFlamenco) {
        console.log('\n--- Evento con contenido dudoso ---');
        console.log(`Nombre: ${event.name}`);
        console.log(`Artista: ${event.artist}`);
        console.log(`Lugar: ${event.venue} en ${event.address}`);
        console.log('------------------------------------\n');

        const confirm = await askQuestion('¿Quieres eliminar este evento de la base de datos? (s/n): ');
        if (confirm) {
          await eventsCollection.deleteOne({ _id: event._id });
          console.log(`🗑️ Evento '${event.name}' eliminado de la base de datos.`);
          continue; // Saltar al siguiente evento en el bucle
        } else {
          console.log(`⏭️ Evento '${event.name}' no eliminado. Se omitirá la publicación.`);
          continue;
        }
      }

      try {
        console.log(`Creando imagen para "${event.name}"...`);
        const imagePath = await createSocialImage(event);

        const imageId = await uploadImage(imagePath, event.name);
        if (!imageId) {
          throw new Error('La subida de la imagen falló, no se puede continuar con el post.');
        }

        const eventDate = new Date(event.date);
        const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' };
        const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

        const header = `**Artista:** ${event.artist}\n**Fecha:** ${formattedDate}\n\n---`;

        const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/la-tienda-flamenca-afland/) para encontrar moda y accesorios únicos.

### ¿Quieres ver tu negocio aquí?
[Contacta con nosotros](https://afland.es/contact/) para publicitar tu evento en Duende Finder.
➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})**`;

        const markdownContent = `${header}\n\n${event.nightPlan}\n\n${footer}`;
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
    rl.close();
  }
}

main();