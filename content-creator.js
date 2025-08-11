// content-creator.js (v8 - Versión Definitiva con Lógica de CTA y Protección de Errores)

// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { publishToAflandBlog, uploadImageToWordPress } = require('./afland-publisher');
const { marked } = require('marked');

// 2. Configuración
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const eventsCollectionName = 'events';
const aflandToken = process.env.AFLAND_API_KEY; // Corregido: lee la variable correcta
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!mongoUri || !geminiApiKey || !aflandToken) {
    throw new Error('Faltan variables de entorno críticas.');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ... (Las funciones de utilidad y el prompt se mantienen igual) ...

async function generateStructuredPost(event) {
    const eventDateFormatted = new Date(event.date).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    let extraContext = '';
    if (event.nightPlan && event.nightPlan.trim() !== '') {
        console.log("   -> ✨ ¡Enriqueciendo post con datos de 'Planear Noche'!");
        extraContext = `
# INFORMACIÓN ADICIONAL PARA ENRIQUECER EL POST
Usa la siguiente guía local para añadir secciones o detalles extra al cuerpo del post. Intégralo de forma natural.
Contenido Adicional:
${event.nightPlan}
`;
    }

    // --- Lógica para la llamada a la acción (CTA) ---
    let callToAction;
    if (event.affiliateLink && event.affiliateLink.trim() !== '') {
        // Si el evento tiene un enlace de afiliado, crea un enlace de compra
        callToAction = `[Compra tus entradas aquí](${event.affiliateLink})`;
    } else {
        // Si no, usa el texto de "Próximamente"
        callToAction = `Entradas disponibles próximamente.`;
    }

    const prompt = `
# CONTEXTO
Eres "Duende", un experto redactor de SEO para el blog "Duende Finder" (afland.es). Tu objetivo es crear un post de blog atractivo sobre un evento de flamenco.
# TONO
Apasionado, evocador y accesible. Usa emojis 💃🎶🔥 de forma natural.
# EVENTO A PROCESAR
- Nombre: ${event.name}
- Artista(s): ${event.artist}
- Fecha: ${eventDateFormatted}
- Hora: ${event.time}
- Lugar: ${event.venue}, ${event.city}
${extraContext}
# TAREA Y REGLAS DE FORMATO
Tu única salida debe ser texto estructurado con las siguientes secciones, separadas por "---".
SLUG:
[Crea un slug corto y optimizado para SEO (4-5 palabras clave).]
---
META_TITLE:
[Crea un título SEO de menos de 60 caracteres.]
---
META_DESC:
[Crea una meta descripción de menos de 155 caracteres.]
---
POST_TITLE:
[Crea un título H1 atractivo para el post.]
---
POST_CONTENT:
[Escribe aquí el cuerpo del post en formato Markdown (300-400 palabras). Usa encabezados H2 (##). 
${event.artist ? `Incluye un enlace interno al artista: [${event.artist}](/artistas/${event.artist.toLowerCase().replace(/ /g, '-')}).` : ''}
Finaliza con una llamada a la acción para el usuario, que debe decir: "${callToAction}".]
`;
    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('❌ Error al generar contenido con Gemini:', error);
        return null;
    }
}

async function updateEventStatus(collection, eventId, status) {
    try {
        await collection.updateOne(
            { _id: new ObjectId(eventId) },
            { $set: { contentStatus: status } }
        );
        console.log(`🎉 Evento con ID: ${eventId} actualizado a estado: ${status}.`);
    } catch (error) {
        console.error(`❌ Error al actualizar el estado del evento ${eventId}:`, error);
    }
}

// 3. Función principal del script
async function runContentCreator() {
    console.log('🚀 Iniciando el creador de contenidos (v8 con lógica de CTA y protección de errores)...');
    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB.');

        const db = client.db(dbName);
        const eventsCollection = db.collection(eventsCollectionName);

        // --- CÁLCULO DE LA FECHA LÍMITE (3 DÍAS EN EL FUTURO) ---
        const today = new Date();
        const threeDaysFromNow = new Date(today.setDate(today.getDate() + 3));
        const minDateString = threeDaysFromNow.toISOString().split('T')[0];

        console.log(`🔎 Buscando eventos pendientes con imagen a partir de: ${minDateString}`);

        // --- LA CONSULTA SÚPER INTELIGENTE CON TODOS LOS FILTROS ---
        const pendingEvents = await eventsCollection.find({
            contentStatus: 'pending',
            imageUrl: { $ne: null },
            date: { $gte: minDateString } // <-- FILTRO DE 3 DÍAS AÑADIDO
        }).sort({
            verified: -1,
            date: 1
        }).limit(5).toArray();
        // --- FIN DE LA CONSULTA ---

        if (pendingEvents.length === 0) {
            console.log('✅ No hay eventos pendientes (que cumplan todos los criterios) por procesar.');
            return;
        }

        console.log(`Encontrados ${pendingEvents.length} eventos prioritarios para procesar.`);

        let publishTime = new Date();
        const timeIncrement = 60 * 60 * 1000;

        for (const event of pendingEvents) {
            console.log(`\n✨ Procesando evento con ID: ${event._id}`);
            const structuredPost = await generateStructuredPost(event);

            if (structuredPost) {
                const parts = structuredPost.split('---');
                const slug = parts[0]?.replace('SLUG:', '').trim();
                const metaTitle = parts[1]?.replace('META_TITLE:', '').trim();
                const metaDesc = parts[2]?.replace('META_DESC:', '').trim();
                const postTitle = parts[3]?.replace('POST_TITLE:', '').trim();
                const markdownContent = parts[4]?.replace('POST_CONTENT:', '').trim();

                if (!slug || !metaTitle || !markdownContent) {
                    console.log('🔴 La IA no devolvió una respuesta estructurada válida. Actualizando a "failed".');
                    await updateEventStatus(eventsCollection, event._id, 'failed');
                    continue;
                }

                const htmlContent = marked(markdownContent);
                let featuredMediaId = null;
                if (event.imageUrl) {
                    featuredMediaId = await uploadImageToWordPress(event.imageUrl, aflandToken);
                }

                publishTime = new Date(publishTime.getTime() + timeIncrement);
                console.log(`⏳ Programando post "${postTitle}" para: ${publishTime.toLocaleString()}`);

                // ... dentro del bucle for (const event of pendingEvents)

                await publishToAflandBlog({
                    title: postTitle,
                    content: htmlContent,
                    slug: slug, // <-- CÓDIGO AÑADIDO: Pasamos el slug a WordPress
                    status: 'future',
                    date: publishTime.toISOString(),
                    meta: {
                        _aioseo_title: metaTitle,
                        _aioseo_description: metaDesc
                    }
                }, aflandToken, featuredMediaId);

                // ...

                await updateEventStatus(eventsCollection, event._id, 'processed');
            } else {
                console.log('🔴 No se pudo generar contenido para el evento. Actualizando a "failed".');
                await updateEventStatus(eventsCollection, event._id, 'failed');
            }
        }
    } catch (error) {
        console.error('❌ Ha ocurrido un error general:', error);
    } finally {
        await client.close();
        console.log('\n✅ Conexión a MongoDB cerrada.');
        console.log('✅ Proceso del creador de contenidos finalizado.');
    }
}

// 6. Ejecución del script
runContentCreator();
