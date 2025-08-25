require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { ObjectId } = require('mongodb');
const { publishToWordPress } = require('./lib/wordpressClient.js');
const { uploadImageToWordPress } = require('./afland-publisher.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

const BATCH_SIZE = 4;

/**
 * Genera una imagen para el evento usando un fondo y una fuente personalizados.
 * @param {object} event - El objeto del evento.
 * @returns {Promise<string|null>} - La ruta a la imagen generada o null si hay un error.
 */
async function createEventImage(event) {
    try {
        console.log(`🎨 Creando imagen para el evento: ${event.name}`);
        const templatesDir = path.join(__dirname, 'templates');
        const generatedDir = path.join(__dirname, 'generated_images');
        if (!fs.existsSync(generatedDir)) {
            fs.mkdirSync(generatedDir, { recursive: true });
        }

        const fontPath = path.join(templatesDir, 'Cinzel-Bold.ttf');
        registerFont(fontPath, { family: 'Cinzel' });

        const backgroundNumber = Math.floor(Math.random() * 2) + 1;
        const backgroundPath = path.join(templatesDir, `background${backgroundNumber}.png`);
        const background = await loadImage(backgroundPath);

        const canvas = createCanvas(background.width, background.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(background, 0, 0, background.width, background.height);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const x = canvas.width / 2;

        ctx.font = '72px Cinzel';
        const eventName = event.name;
        ctx.fillText(eventName, x, canvas.height / 2 - 30);

        ctx.font = '48px Cinzel';
        const eventDate = new Date(event.date).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        ctx.fillText(eventDate, x, canvas.height / 2 + 40);

        const outputPath = path.join(generatedDir, `${event._id}.png`);
        const out = fs.createWriteStream(outputPath);
        const stream = canvas.createPNGStream();
        stream.pipe(out);

        await new Promise((resolve, reject) => {
            out.on('finish', resolve);
            out.on('error', reject);
        });

        console.log(`🖼️  Imagen generada con éxito en: ${outputPath}`);
        return outputPath;
    } catch (error) {
        console.error(`❌ Error generando la imagen para el evento ${event._id}:`, error);
        return null;
    }
}

/**
 * Corrige el formato de los enlaces de Google Maps en el texto generado.
 * @param {string} text - El contenido del nightPlan.
 * @returns {string} - El texto con los enlaces formateados.
 */
function formatExistingLinks(text) {
    if (!text) {
        return text;
    }
    const regex = /\* \*\*([^\*]+)\*\*:(.*?\[\1\]\([^)]+\))/g;
    return text.replace(regex, '* **[$1]($3):**$2');
}


/**
 * Procesa eventos que tienen un 'nightPlan' generado pero aún no han sido
 * publicados en WordPress.
 */
async function processPendingContent() {
  console.log('Iniciando el proceso de creación de contenido...');

  try {
    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');
    console.log('Conectado a MongoDB.');

    const eventsToProcess = await eventsCollection.find({
      nightPlan: { $exists: true, $ne: null },
      wordpressPostId: { $exists: false },
      name: { $exists: true, $ne: "" }
    }).limit(BATCH_SIZE).toArray();

    if (eventsToProcess.length === 0) {
      console.log('✅ No hay eventos nuevos con "Plan Noche" para procesar. Finalizando.');
      return;
    }

    console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos para procesar en este lote.`);

    for (const [index, event] of eventsToProcess.entries()) {
      try {
        const imagePath = await createEventImage(event);
        let mediaId = null;
        if (imagePath) {
            mediaId = await uploadImageToWordPress(
                imagePath,
                process.env.WORDPRESS_APP_PASSWORD,
                `Imagen para ${event.name}`,
                event.name
            );
            fs.unlinkSync(imagePath);
        }

        const publicationDate = new Date();
        publicationDate.setHours(publicationDate.getHours() + index + 1);

        const footer = `
---
### ¿Buscas el atuendo perfecto?
Visita nuestra [Tienda Flamenca](https://afland.es/tienda-flamenca/) para encontrar moda y accesorios únicos.

➡️ **[Ver todos los detalles de este evento en Duende Finder](https://buscador.afland.es/?event_id=${event._id})
        `;
        
        // Formatear enlaces en el contenido existente
        const formattedNightPlan = formatExistingLinks(event.nightPlan);
        const finalContent = `${formattedNightPlan}\n\n${footer}`;

        const eventosCategoryId = process.env.WORDPRESS_EVENTS_CATEGORY_ID;

        const postData = {
          title: `Plan de Noche: Disfruta de ${event.name}`,
          content: finalContent,
          status: 'future',
          date: publicationDate.toISOString(),
          categories: [eventosCategoryId],
          featured_media: mediaId
        };

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