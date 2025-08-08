// content-creator.js

/**
 * Script autónomo para el proyecto "Duende Finder".
 * Busca eventos con 'contentStatus: "pending"',
 * genera contenido de blog optimizado para SEO con la API de Gemini
 * y lo publica en el blog de afland.es.
 */

// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { publishToAflandBlog, uploadImageToWordPress } = require('./afland-publisher');
const { marked } = require('marked'); // <-- Importamos la librería para convertir Markdown

// 2. Configuración
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const eventsCollectionName = 'events';
const aflandToken = process.env.WORDPRESS_APP_PASSWORD; // Usamos la variable correcta
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!mongoUri || !geminiApiKey || !aflandToken) {
    throw new Error('Faltan variables de entorno críticas para MongoDB, Gemini o WordPress/Afland.');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Genera un post estructurado para el blog utilizando la API de Gemini.
 * @param {object} event - El documento del evento de la base de datos.
 * @returns {string} El texto estructurado del post generado, o null en caso de error.
 */
async function generateStructuredPost(event) {
    const eventDateFormatted = new Date(event.date).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const prompt = `
# CONTEXTO
Eres "Duende", un experto redactor de SEO y marketing de contenidos para el blog de flamenco "Duende Finder" (afland.es). Tu objetivo es crear un post de blog atractivo y profesional sobre un evento de flamenco.

# TONO
Apasionado, evocador y respetuoso con la tradición, pero accesible para un público amplio. Usa emojis 💃🎶🔥 de forma natural.

# EVENTO A PROCESAR
- Nombre: ${event.name}
- Artista(s): ${event.artist}
- Fecha: ${eventDateFormatted}
- Hora: ${event.time}
- Lugar: ${event.venue}, ${event.city}
- URL original: ${event.sourceUrl}
- Descripción base: ${event.description}

# TAREA Y REGLAS DE FORMATO
Tu única salida debe ser texto estructurado con las siguientes secciones, separadas por "---". No añadas ningún otro texto o comentario.

SLUG:
[Crea un slug corto y optimizado para SEO (4-5 palabras clave separadas por guiones). Ejemplo: ${event.artist.toLowerCase().replace(/ /g, '-')}-${event.city.toLowerCase().replace(/ /g, '-')}-${event.date}]
---
META_TITLE:
[Crea un título SEO de menos de 60 caracteres, atractivo y con las palabras clave principales.]
---
META_DESC:
[Crea una meta descripción de menos de 155 caracteres, persuasiva y con una llamada a la acción.]
---
POST_TITLE:
[Crea un título H1 atractivo y creativo para el post del blog.]
---
POST_CONTENT:
[Escribe aquí el cuerpo del post en formato Markdown (300-400 palabras).
- Usa encabezados H2 (##) para las secciones.
- Usa párrafos cortos.
- Incluye de forma natural un enlace interno al artista con este formato: [${event.artist}](/artistas/${event.artist.toLowerCase().replace(/ /g, '-')}).
- Incluye un llamado a la acción al final, invitando a comprar entradas o a visitar la fuente original.]
`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error('❌ Error al generar contenido con Gemini:', error);
        return null;
    }
}

/**
 * Actualiza el estado de un evento en la base de datos.
 * @param {object} collection - La colección de eventos de MongoDB.
 * @param {ObjectId} eventId - El ID del evento a actualizar.
 * @param {string} status - El nuevo estado ('processed' o 'failed').
 */
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
    console.log('🚀 Iniciando el creador de contenidos (v3 con renderizado HTML)...');
    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB.');

        const db = client.db(dbName);
        const eventsCollection = db.collection(eventsCollectionName);

        const pendingEvents = await eventsCollection.find({ contentStatus: 'pending' }).limit(5).toArray();

        if (pendingEvents.length === 0) {
            console.log('✅ No hay eventos pendientes por procesar.');
            return;
        }

        console.log(`🔎 Encontrados ${pendingEvents.length} eventos pendientes.`);

        // Lógica para programar los posts con un intervalo de tiempo
        let publishTime = new Date();
        const timeIncrement = 60 * 60 * 1000; // Incremento de 1 hora

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
                
                // Convertimos el contenido de Markdown a HTML
                const htmlContent = marked(markdownContent);
                
                let featuredMediaId = null;
                if (event.imageUrl) {
                    featuredMediaId = await uploadImageToWordPress(event.imageUrl, aflandToken);
                }
                
                // Incrementamos la hora para el siguiente post
                publishTime = new Date(publishTime.getTime() + timeIncrement);
                console.log(`⏳ Programando post "${postTitle}" para: ${publishTime.toLocaleString()}`);

                await publishToAflandBlog({
                    title: postTitle,
                    content: htmlContent,
                    slug: slug,
                    status: 'future', // Programamos el post para el futuro
                    date: publishTime.toISOString(), // Indicamos la fecha de publicación
                    meta: { 
                        _aioseo_title: metaTitle,
                        _aioseo_description: metaDesc
                    }
                }, aflandToken, featuredMediaId);

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