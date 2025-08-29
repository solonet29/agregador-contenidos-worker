// enrich-events.js (El "Jefe de Producción")
const BANNER_URL_M2 = 'https://afland.es/wp-content/uploads/2025/08/banner-publicidad-1.jpg'; // Reemplaza con tu URL real
const BANNER_URL_M3 = 'https://afland.es/wp-content/uploads/2025/08/banner-publicidad-2.jpg'; // Reemplaza con tu URL real

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { createFinderImage } = require('./lib/imageGenerator.js');
const { uploadImage } = require('./lib/wordpressClient.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ObjectId } = require('mongodb');
const showdown = require('showdown');
const fs = require('fs').promises;

// --- CONFIGURACIÓN ---
const BATCH_SIZE = 50; // Hacemos lotes más pequeños ya que cada evento hace más trabajo (imagen + texto)

// --- LÓGICA DE IA Y CONTENIDO (traída de content-creator) ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const converter = new showdown.Converter();

const nightPlanPromptTemplate = (event) => `...`; // (El prompt completo de nightPlan va aquí)
function createFinalPostContent(event, nightPlanText) { /* ... (La función completa va aquí) ... */ }
async function verifyFlamencoWithGemini(eventData) { /* ... (La función completa de verificación va aquí) ... */ }


async function enrichAll() {
    console.log("--- 🚀 INICIANDO SUPER SCRIPT DE ENRIQUECIMIENTO TOTAL ---");

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        // Buscamos eventos "en bruto": que no tengan ni imagen ni plan de noche.
        const query = {
            $or: [
                { imageUrl: { $exists: false } },
                { nightPlan: { $exists: false } }
            ]
        };
        const eventsToProcess = await eventsCollection.find(query).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log("✅ No se encontraron eventos nuevos para enriquecer.");
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos en este lote para procesar.`);

        for (const event of eventsToProcess) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`🎨📝 Procesando evento completo: "${event.name}"`);

            let updates = {};
            let imagePath = null;

            try {
                // --- 1. PROCESO DE IMAGEN (si es necesario) ---
                if (!event.imageUrl) {
                    console.log("   -> Creando imagen...");
                    imagePath = await createFinderImage(event);
                    const wordpressResponse = await uploadImage(imagePath, `${event.name} - ${event.city}`);
                    if (!wordpressResponse) throw new Error("La subida de imagen a WordPress falló.");

                    updates.imageUrl = wordpressResponse.source_url;
                    updates.imageId = wordpressResponse.id;
                    updates.lastImageUpdate = new Date();
                    console.log("   ✅ Imagen creada y subida.");
                }

                // --- 2. PROCESO DE TEXTO (si es necesario) ---
                if (!event.nightPlan) {
                    console.log("   -> Creando contenido de texto...");
                    const isFlamenco = await verifyFlamencoWithGemini(event);
                    if (!isFlamenco) {
                        console.log("   ⚠️  Evento no flamenco. Omitiendo y marcando para posible borrado.");
                        // Podríamos marcarlo para borrarlo luego o borrarlo aquí directamente
                        await eventsCollection.deleteOne({ _id: new ObjectId(event._id) });
                        continue; // Saltar al siguiente evento
                    }

                    const prompt = nightPlanPromptTemplate(event);
                    const result = await model.generateContent(prompt);
                    const nightPlanText = result.response.text();

                    const { title, htmlContent } = createFinalPostContent(event, nightPlanText);

                    updates.nightPlan = nightPlanText;
                    updates.blogPostTitle = title;
                    updates.blogPostHtml = htmlContent;
                    console.log("   ✅ Contenido de texto creado.");
                }

                // --- 3. ACTUALIZACIÓN FINAL EN BBDD ---
                if (Object.keys(updates).length > 0) {
                    await eventsCollection.updateOne({ _id: new ObjectId(event._id) }, { $set: updates });
                    console.log("   💾 Base de datos actualizada con todo el contenido enriquecido.");
                }

            } catch (error) {
                console.error(`   ❌ Error procesando el evento "${event.name}":`, error.message);
            } finally {
                if (imagePath) await fs.unlink(imagePath).catch(e => console.error(e));
            }
        }

    } catch (error) {
        console.error("Ha ocurrido un error fatal:", error);
    } finally {
        console.log("\n--- ✨ LOTE DE ENRIQUECIMIENTO FINALIZADO ---");
        process.exit(0);
    }
}

// Para que el código sea completo y portable, pego aquí las funciones que necesita
// (en una implementación más grande, estas estarían en sus propios módulos e importadas)

function createFinalPostContent(event, nightPlanText) {
    const title = `${event.name} en ${event.city}: Guía para una Noche Flamenca Inolvidable`;
    const nightPlanHtml = converter.makeHtml(nightPlanText);
    const introHtml = `
        <p>El flamenco es más que un espectáculo; es una experiencia que envuelve todos los sentidos. Si tienes la suerte de asistir a la actuación de <strong>${event.artist || event.name}</strong> en <strong>${event.venue}</strong>, te hemos preparado una guía para que tu velada sea redonda, desde las tapas previas hasta la última copa.</p>
        <p>Descubre cómo vivir una noche flamenca completa en ${event.city}.</p>
    `;
    const htmlContent = introHtml + nightPlanHtml;
    return { title, htmlContent };
}

async function verifyFlamencoWithGemini(eventData) {
    const prompt = `Eres un experto clasificador para una web de flamenco. Tu criterio debe ser inclusivo con artistas que fusionan el flamenco con otros géneros (como soul o jazz), pero sin llegar al pop mainstream. Si un evento o artista tiene una fuerte conexión con el flamenco, clasifícalo como "flamenco". Artistas como Pitingo, Argentina o Arcángel son de interés para el público flamenco.

    Analiza la siguiente información y responde SÓLO con "flamenco" o "no-flamenco".

    Nombre del evento: ${eventData.name}
    Artista: ${eventData.artist}
    Descripción: ${eventData.description}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();
        return text.includes('flamenco') && !text.includes('no-flamenco');
    } catch (error) {
        console.error('Error al verificar el evento con Gemini:', error);
        return false;
    }
}

const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local y aficionado al flamenco.
    Tu tarea es generar una mini-guía para una noche perfecta centrada en un evento de flamenco.
    Sé cercano, usa un lenguaje evocador y estructura el plan en secciones con Markdown (usando ## para los títulos).

    **REGLA MUY IMPORTANTE: Tu respuesta debe empezar DIRECTAMENTE con el primer título en Markdown (##). No incluyas saludos, introducciones o texto conversacional antes de la guía.**

    EVENTO:
    - Nombre: ${event.name}
    - Artista: ${event.artist}
    - Lugar: ${event.venue}, ${event.city}
    ESTRUCTURA DE LA GUÍA:
    1.  **Un Pellizco de Sabiduría:** Aporta un dato curioso o una anécdota sobre el artista, el lugar o algún palo del flamenco relacionado.
    2.  **Calentando Motores (Antes del Espectáculo):** Recomienda 1 o 2 bares de tapas o restaurantes cercanos al lugar del evento, describiendo el ambiente.
    3.  **El Templo del Duende (El Espectáculo):** Describe brevemente qué se puede esperar del concierto, centrando en la emoción.
    4.  **Para Alargar la Magia (Después del Espectáculo):** Sugiere un lugar cercano para tomar una última copa en un ambiente relajado.
    5.  **Anúnciate Aquí:** Añade un pequeño apartado final con el título '¿Quieres ver tu negocio aquí?' y un texto que enlace a la página de contacto 'https://afland.es/contact/' para publicitar un negocio.

    Usa un tono inspirador y práctico.
`;

enrichAll();