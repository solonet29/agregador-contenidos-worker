// content-creator.js

/**
 * Script autónomo para el proyecto "Duende Finder".
 * Se encarga de buscar eventos con 'contentStatus: "pending"',
 * generar contenido para redes sociales con la API de Gemini
 * y publicar en el blog de afland.es.
 */

// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// Importamos las dos funciones necesarias del módulo de publicación
const { publishToAflandBlog, uploadImageToWordPress } = require('./afland-publisher');

// 2. Configuración
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'DuendeDB';
const eventsCollectionName = 'events';

const aflandToken = process.env.AFLAND_API_KEY;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Genera un post para el blog utilizando la API de Gemini.
 * @param {object} event - El documento del evento de la base de datos.
 * @returns {string} El texto del post generado, o null en caso de error.
 */
async function generatePost(event) {
    const prompt = `Crea una entrada de blog detallada y atractiva sobre el evento: ${JSON.stringify(event)}. La entrada debe incluir un título, una descripción y un llamado a la acción al final. El tono debe ser formal y optimizado para SEO.`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        return text;
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
    console.log('🚀 Iniciando el creador de contenidos...');

    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB.');

        const db = client.db(dbName);
        const eventsCollection = db.collection(eventsCollectionName);

        // 4. Búsqueda de eventos pendientes
        const pendingEvents = await eventsCollection
            .find({ contentStatus: 'pending' })
            .limit(5)
            .toArray();

        if (pendingEvents.length === 0) {
            console.log('✅ No hay eventos pendientes por procesar.');
            return;
        }

        console.log(`🔎 Encontrados ${pendingEvents.length} eventos pendientes.`);

        // 5. Procesamiento de eventos
        for (const event of pendingEvents) {
            console.log(`\n✨ Procesando evento con ID: ${event._id}`);

            const generatedPost = await generatePost(event);

            if (generatedPost) {
                const [postTitle, ...postContentArray] = generatedPost.split('\n');
                const postContent = postContentArray.join('\n').trim();

                let featuredMediaId = null;
                // Lógica NUEVA: Si el evento tiene una URL de imagen, la subimos a WordPress
                if (event.imageUrl) {
                    featuredMediaId = await uploadImageToWordPress(event.imageUrl, aflandToken);
                } else {
                    console.log('🖼️ No se encontró URL de imagen para el evento.');
                }

                await publishToAflandBlog(postTitle, postContent, aflandToken, featuredMediaId);

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


