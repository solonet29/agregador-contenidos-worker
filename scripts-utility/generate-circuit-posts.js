// scripts-utility/generate-circuit-posts.js
// Script para generar posts de WordPress para circuitos o festivales, agrupados por provincia.

require('dotenv').config();
const { connectToDatabase, closeDatabaseConnection } = require('../lib/database.js');
const { publishToWordPress } = require('../lib/wordpressClient.js');
const config = require('../config.js'); // For WordPress category ID and other configs
const Groq = require('groq-sdk'); // Import Groq SDK
const showdown = require('showdown'); // For Markdown to HTML conversion

// --- INICIALIZACIÓN DE SERVICIOS ---
if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY no está definida.');
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Model used in enrich-events.js
const converter = new showdown.Converter(); // Markdown to HTML converter

async function main() {
    console.log("🚀 Iniciando la generación de posts para Circuitos/Festivales...");

    const db = await connectToDatabase();
    const eventsCollection = db.collection('events');

    try {
        // --- PASO 1: Obtener y agrupar eventos por provincia ---
        console.log("⚙️ Buscando eventos de circuitos/festivales y agrupándolos por provincia...");
        
        const circuitEvents = await eventsCollection.find({
            // Filter by the specific circuit name
            name: { $regex: "Circuito Andaluz de Peñas", $options: "i" }, // Case-insensitive match
            // Assuming category ID 101 for "peñas flamencas"
            categories: config.WORDPRESS_EVENTS_CATEGORY_ID, // Assuming WORDPRESS_EVENTS_CATEGORY_ID is 101
            // Only consider events that have been enriched and published
            status: 'published', // Ensure events have blogPostHtml and featuredImageUrl
            province: { $exists: true, $ne: null } // Ensure province field exists
        }).toArray();

        if (circuitEvents.length === 0) {
            console.log("✅ No se encontraron eventos para los circuitos/festivales especificados.");
            return;
        }

        const eventsByProvince = circuitEvents.reduce((acc, event) => {
            if (event.province) {
                if (!acc[event.province]) {
                    acc[event.province] = [];
                }
                acc[event.province].push(event);
            }
            return acc;
        }, {});

        console.log(`✅ Eventos agrupados por ${Object.keys(eventsByProvince).length} provincias.`);

        // --- PASO 2: Generar y publicar posts por provincia ---
        for (const province in eventsByProvince) {
            console(`
--- Procesando provincia: ${province} ---`);
            const eventsInProvince = eventsByProvince[province];

            // --- Sub-Paso 2.1: Generar contenido con GROQ ---
            console.log(`   -> Generando contenido para ${province} con GROQ...`);
            
            const prompt = config.prompts.circuitPostPrompt(province, eventsInProvince);
            let groqGeneratedMarkdown = "";
            try {
                const chatCompletion = await groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: GROQ_MODEL,
                });
                groqGeneratedMarkdown = chatCompletion.choices[0]?.message?.content || "";
            } catch (groqError) {
                console.error(`   ❌ Error al generar contenido con GROQ para ${province}:`, groqError.message);
                continue; // Skip to next province if GROQ call fails
            }

            if (!groqGeneratedMarkdown) {
                console.warn(`   ⚠️ GROQ no generó contenido para ${province}. Saltando esta provincia.`);
                continue;
            }

            let postHtmlContent = converter.makeHtml(groqGeneratedMarkdown);
            
            // --- Sub-Paso 2.2: Incrustar imágenes de eventos ---
            // The prompt is designed to include placeholders for event descriptions.
            // We need to replace those placeholders or ensure the prompt generates
            // the full content including image tags.
            // For now, let's assume the prompt generates the text, and we append images.
            
            // This part needs careful consideration based on the exact output of the GROQ prompt.
            // If GROQ generates the full structure including event sections, we might need to parse it.
            // For simplicity, I'll append images after the GROQ content for each event.
            
            for (const event of eventsInProvince) {
                if (event.featuredImageUrl) {
                    // Find the section for this event in the generated HTML and append the image
                    // This is a simplified approach. A more complex regex or HTML parser might be needed
                    // if the GROQ output structure is very specific.
                    const eventSectionRegex = new RegExp(`<h3>${event.name}</h3>`, 'i');
                    if (postHtmlContent.match(eventSectionRegex)) {
                        postHtmlContent = postHtmlContent.replace(eventSectionRegex, 
                            `<h3>${event.name}</h3>\n<img src="${event.featuredImageUrl}" alt="${event.name}" style="max-width: 100%; height: auto;">`
                        );
                    }
                }
            }


            // --- Sub-Paso 2.3: Publicar en WordPress ---
            console.log(`   -> Publicando post para ${province} en WordPress...`);
            const postData = {
                title: `Circuito Andaluz de Peñas en ${province}: ¡No te lo pierdas!`, // Dynamic title
                content: postHtmlContent,
                status: 'publish',
                categories: [config.WORDPRESS_EVENTS_CATEGORY_ID], // Use existing category or define a new one for circuits
            };

            const wordpressResponse = await publishToWordPress(postData);
            console.log(`   ✅ Post para ${province} publicado. URL: ${wordpressResponse.link}`);
        }

    } catch (error) {
        console.error('❌ Ha ocurrido un error fatal en la generación de posts de circuitos:', error);
    } finally {
        await closeDatabaseConnection();
        console.log("✅ Conexión a la base de datos cerrada. Proceso finalizado.");
    }
}

main();