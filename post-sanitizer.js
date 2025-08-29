// post-sanitizer.js (VERSIÓN 4 - LA HERRAMIENTA DEFINITIVA)

require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { updateWordPressPost, uploadImage, deleteWordPressPost } = require('./lib/wordpressClient.js');
const { createSocialImage } = require('./lib/imageGenerator.js');
const { ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const showdown = require('showdown');

// --- CONFIGURACIÓN DE IA ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const converter = new showdown.Converter();

// --- ANÁLISIS DE FLAGS DE LÍNEA DE COMANDOS ---
const args = process.argv.slice(2);
const flags = {
    dryRun: args.includes('--dry-run'),
    regenerateImages: args.includes('--regenerate-images'),
    deleteNonFlamenco: args.includes('--delete-non-flamenco')
};

// --- LÓGICA DE GENERACIÓN DE CONTENIDO (IMPORTADA DE CONTENT-CREATOR) ---

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

    Usa un tono inspirador y práctico.
`;

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
    const prompt = `En el contexto de una agenda cultural de música en España, analiza la siguiente información y determina si se trata de un evento de flamenco. Considera que nombres de artistas como 'Argentina' o 'Arcángel' son cantaores de flamenco muy conocidos, aunque el nombre pueda parecer genérico. Responde SÓLO con "flamenco" o "no-flamenco".

    Nombre del evento: ${eventData.name}
    Artista: ${eventData.artist}
    Descripción: ${eventData.description}`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();
        return text.includes('flamenco') && !text.includes('no-flamenco');
    } catch (error) {
        console.error('Error al verificar el evento con Gemini:', error);
        return false;
    }
}

async function sanitizePosts() {
    console.log('--- INICIANDO SANEADOR DE POSTS (V4 - DEFINITIVA) ---');
    if (flags.dryRun) console.log('⚠️  MODO SIMULACIÓN ACTIVADO (--dry-run). No se realizarán cambios reales.');

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');

        const query = {
            wordpressPostId: { $exists: true },
            $or: [
                { blogPostHtml: { $exists: false } },
                { nightPlan: { $exists: false } }
            ]
        };
        const postsToSanitize = await eventsCollection.find(query).toArray();

        if (postsToSanitize.length === 0) {
            console.log('✅ No se encontraron posts que necesiten saneamiento. ¡El sistema está consistente!');
            return;
        }

        console.log(`⚙️ Se encontraron ${postsToSanitize.length} posts para regenerar y sanear.`);

        for (const event of postsToSanitize) {
            console.log(`\n-----------------------------------------------------`);
            console.log(`Analizando evento: "${event.name}" (WP ID: ${event.wordpressPostId})`);

            const isFlamenco = await verifyFlamencoWithGemini(event);
            if (!isFlamenco) {
                console.warn(`[!] Este evento no parece ser de flamenco.`);
                if (flags.deleteNonFlamenco) {
                    if (!flags.dryRun) {
                        await deleteWordPressPost(event.wordpressPostId);
                        await eventsCollection.deleteOne({ _id: new ObjectId(event._id) });
                        console.log(`🗑️ Post y evento eliminados.`);
                    } else {
                        console.log(`[SIMULACIÓN] Se eliminaría el post y el evento.`);
                    }
                } else {
                    console.log(`⏭️  Omitiendo. Para borrar, usa el flag --delete-non-flamenco.`);
                }
                continue;
            }

            try {
                let nightPlanText = event.nightPlan;
                let blogPostTitle = event.blogPostTitle;
                let blogPostHtml = event.blogPostHtml;

                if (!nightPlanText) {
                    console.log('   -> No se encontró nightPlan. Llamando a Gemini para generarlo...');
                    if (!flags.dryRun) {
                        const prompt = nightPlanPromptTemplate(event);
                        const result = await geminiModel.generateContent(prompt);
                        nightPlanText = result.response.text();
                    } else {
                        nightPlanText = "[SIMULACIÓN] Contenido del plan de noche generado por Gemini.";
                    }
                }

                if (!blogPostHtml) {
                    console.log('   -> No se encontró blogPostHtml. Generando contenido final...');
                    const { title, htmlContent } = createFinalPostContent(event, nightPlanText);
                    blogPostTitle = title;
                    blogPostHtml = htmlContent;
                }

                if (!flags.dryRun) {
                    await eventsCollection.updateOne(
                        { _id: new ObjectId(event._id) },
                        { $set: { nightPlan: nightPlanText, blogPostTitle: blogPostTitle, blogPostHtml: blogPostHtml } }
                    );
                } else {
                    console.log(`   [SIMULACIÓN] Se guardaría el contenido regenerado en la BBDD.`);
                }

                const updateData = {
                    title: blogPostTitle,
                };

                const footer = `
                <hr>
                <h3>¿Buscas el atuendo perfecto?</h3>
                <p>Visita nuestra <a href="https://afland.es/la-tienda-flamenca-afland/">Tienda Flamenca</a> para encontrar moda y accesorios únicos.</p>
                <p>➡️ <strong><a href="https://buscador.afland.es/?event_id=${event._id}">Ver todos los detalles de este evento en Duende Finder</a></strong></p>`;

                updateData.content = blogPostHtml + footer;

                if (flags.regenerateImages) {
                    console.log(` regenerating image...`);
                    const imagePath = await createSocialImage(event);
                    const newImageId = await uploadImage(imagePath, event.name);
                    if (newImageId) {
                        updateData.featured_media = newImageId;
                    }
                }

                if (!flags.dryRun) {
                    await updateWordPressPost(event.wordpressPostId, updateData);
                    console.log(`✅ Post actualizado en WordPress con el contenido regenerado.`);
                } else {
                    console.log(`   [SIMULACIÓN] Se actualizaría el post en WordPress.`);
                }

            } catch (error) {
                console.error(`❌ Error saneando el evento "${event.name}":`, error.message);
            }
        }
        console.log(`\n--- PROCESO DE SANEAMIENTO FINALIZADO ---`);

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante el saneamiento:', error);
    } finally {
        process.exit(0);
    }
}

sanitizePosts();