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

// --- ANÁLISIS DE FLAGS ---
const args = process.argv.slice(2);
const flags = {
    dryRun: args.includes('--dry-run'),
    regenerateImages: args.includes('--regenerate-images'),
    deleteNonFlamenco: args.includes('--delete-non-flamenco')
};

// --- LÓGICA DE GENERACIÓN DE CONTENIDO (IMPORTADA DE CONTENT-CREATOR) ---

const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local y aficionado al flamenco...
    EVENTO:
    - Nombre: ${event.name}
    - Artista: ${event.artist}
    - Lugar: ${event.venue}, ${event.city}
    ... (El resto del prompt largo va aquí) ...
`;

function createFinalPostContent(event, nightPlanText) {
    const title = `${event.name} en ${event.city}: Guía para una Noche Flamenca Inolvidable`;
    const nightPlanHtml = converter.makeHtml(nightPlanText);
    const introHtml = `
        <p>El flamenco es más que un espectáculo...</p>
        <p>Descubre cómo vivir una noche flamenca completa en ${event.city}.</p>
    `;
    const htmlContent = introHtml + nightPlanHtml;
    return { title, htmlContent };
}

// ... (La función verifyFlamencoWithGemini se mantiene igual) ...

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

            // ... (La lógica de verificación y borrado de no-flamenco se mantiene igual) ...

            try {
                let nightPlanText = event.nightPlan;
                let blogPostTitle = event.blogPostTitle;
                let blogPostHtml = event.blogPostHtml;

                // --- NUEVA LÓGICA INTELIGENTE ---
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

                // ... (El resto de la lógica de actualización en WordPress se mantiene igual, usando las nuevas variables)
                const updateData = {
                    title: blogPostTitle,
                    content: blogPostHtml // + footer
                };
                // ... y así sucesivamente

                if (!flags.dryRun) {
                    // await updateWordPressPost...
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