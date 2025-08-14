// 1. Módulos y dependencias
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const Groq = require('groq-sdk');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { publishToAflandBlog, uploadImageToWordPress } = require('./afland-publisher');
const { marked } = require('marked');
const path = require('path');
const fs = require('fs');

// 2. Configuración desde variables de entorno
const mongoUri = process.env.MONGO_URI;
const groqApiKey = process.env.GROQ_API_KEY;
const aflandToken = process.env.AFLAND_API_KEY;
const dbName = 'DuendeDB';
const eventsCollectionName = 'events';

const dailyTokenLimit = parseInt(process.env.DAILY_TOKEN_LIMIT) || 500000;
const groqModel = process.env.GROQ_MODEL || 'llama3-8b-8192';

if (!mongoUri || !groqApiKey || !aflandToken) {
    throw new Error('Faltan variables de entorno críticas. Revisa tus secretos de GitHub Actions.');
}

const groq = new Groq({ apiKey: groqApiKey });
let tokensUsedToday = 0;

// 3. Funciones de utilidad (sin cambios)
async function generateStructuredPost(event) {
    const eventDateFormatted = new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let extraContext = '';
    if (event.nightPlan && event.nightPlan.trim() !== '') {
        extraContext = `# INFORMACIÓN ADICIONAL...\n${event.nightPlan}`;
    }
    const prompt = `...`; // El prompt largo no ha cambiado
    try {
        const result = await groq.chat.completions.create({
            model: groqModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        let content = result.choices[0].message.content;
        const cleanedContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        tokensUsedToday += result.usage.total_tokens;
        return cleanedContent;
    } catch (error) {
        console.error('❌ Error al generar contenido con Groq:', error);
        return null;
    }
}

async function updateEventStatus(collection, eventId, status) {
    try {
        await collection.updateOne({ _id: new ObjectId(eventId) }, { $set: { contentStatus: status } });
        console.log(`🎉 Evento con ID: ${eventId} actualizado a estado: ${status}.`);
    } catch (error) {
        console.error(`❌ Error al actualizar el estado del evento ${eventId}:`, error);
    }
}

// REEMPLAZA ESTA FUNCIÓN EN content-creator.js

async function createHeaderImage(eventData) {
    try {
        const templatesDir = path.join(__dirname, 'templates');
        const generatedImagesDir = path.join(__dirname, 'generated_images');
        if (!fs.existsSync(generatedImagesDir)) {
            fs.mkdirSync(generatedImagesDir, { recursive: true });
        }

        const fontPath = path.join(templatesDir, 'Cinzel-Bold.ttf');
        registerFont(fontPath, { family: 'Cinzel' });

        const templates = fs.readdirSync(templatesDir).filter(file => file.endsWith('.png'));
        const randomTemplateFile = templates[Math.floor(Math.random() * templates.length)];
        const templatePath = path.join(templatesDir, randomTemplateFile);
        const background = await loadImage(templatePath);

        const canvas = createCanvas(background.width, background.height);
        const ctx = canvas.getContext('2d');

        // --- PASO ADICIONAL: PINTAR EL FONDO ---
        // Establecemos un color de fondo sólido (un gris muy oscuro, casi negro)
        ctx.fillStyle = '#2c2c2c';
        // Rellenamos todo el lienzo con ese color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // --- FIN DEL PASO ADICIONAL ---

        // Ahora, dibujamos la plantilla (la barra morada) sobre nuestro nuevo fondo sólido
        ctx.drawImage(background, 0, 0, background.width, background.height);

        // Preparamos el color para el texto
        ctx.fillStyle = 'white'; // Volvemos a poner el color blanco para las letras
        ctx.textAlign = 'center';
        const padding = 60;
        ctx.font = '60px Cinzel';
        ctx.fillText(eventData.name, canvas.width / 2, canvas.height / 2);

        const dateText = new Date(eventData.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        const locationText = `${eventData.venue}, ${eventData.city}`;
        const detailsText = `${dateText} | ${locationText}`;

        ctx.font = '24px Cinzel';
        ctx.fillText(detailsText, canvas.width / 2, canvas.height - padding);

        const outputFilename = `header-${eventData._id}.png`;
        const outputPath = path.join(generatedImagesDir, outputFilename);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        console.log(`✅ Imagen de cabecera creada con Canvas en: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error("🔴 Error al crear la imagen de cabecera con Canvas:", error);
        return null;
    }
}

// 4. Función principal del script (ARQUITECTURA DE LOTES)
async function runContentCreator() {
    console.log('🚀 Iniciando creador de contenidos por lotes...');

    // --- LÍNEA CLAVE: Definimos el tamaño del lote ---
    const BATCH_SIZE = 3; // Procesará un máximo de 3 eventos por ejecución. ¡Puedes ajustar este número!

    const client = new MongoClient(mongoUri);

    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB.');

        const db = client.db(dbName);
        const eventsCollection = db.collection(eventsCollectionName);

        const today = new Date();
        const twoDaysFromNow = new Date(new Date().setDate(today.getDate() + 2));
        const minDateString = twoDaysFromNow.toISOString().split('T')[0];

        const eventsToProcess = await eventsCollection.find({
            contentStatus: 'pending',
            imageUrl: { $ne: null },
            date: { $gte: minDateString }
        })
            .sort({ verified: -1, date: 1 })
            .limit(BATCH_SIZE)
            .toArray();

        if (eventsToProcess.length === 0) {
            console.log('✅ No hay eventos pendientes que cumplan los criterios en este lote.');
            return;
        }

        console.log(`📦 Lote de ${eventsToProcess.length} eventos encontrado. Empezando procesamiento...`);

        for (const event of eventsToProcess) {
            await updateEventStatus(eventsCollection, event._id, 'processing');
            console.log(`\n✨ Procesando evento con ID: ${event._id}`);

            const headerImagePath = await createHeaderImage(event);
            if (!headerImagePath) {
                console.log('🔴 No se pudo crear la imagen. Revertiendo para reintentar.');
                await updateEventStatus(eventsCollection, event._id, 'pending');
                continue;
            }

            const structuredPost = await generateStructuredPost(event);
            if (!structuredPost) {
                console.log('🔴 No se pudo generar contenido. Revertiendo para reintentar.');
                await updateEventStatus(eventsCollection, event._id, 'pending');
                continue;
            }

            let parsedPost;
            try {
                parsedPost = JSON.parse(structuredPost);
            } catch (jsonError) {
                console.error('🔴 Error al parsear JSON. Marcando como fallido.', jsonError);
                await updateEventStatus(eventsCollection, event._id, 'failed');
                continue;
            }

            const { slug, meta_title, meta_desc, post_title, post_content } = parsedPost;
            if (!slug || !post_title || !post_content) {
                console.log('🔴 JSON incompleto. Marcando como fallido.');
                await updateEventStatus(eventsCollection, event._id, 'failed');
                continue;
            }

            const htmlContent = marked(post_content);
            const featuredMediaId = await uploadImageToWordPress(headerImagePath, aflandToken);

            if (!featuredMediaId) {
                console.log('🔴 No se pudo subir la imagen. Revertiendo para reintentar.');
                await updateEventStatus(eventsCollection, event._id, 'pending');
                continue;
            }

            // VERSIÓN CORREGIDA
            console.log(`⏳ Publicando post "${post_title}"...`);

            await publishToAflandBlog({
                title: post_title,
                content: htmlContent,
                slug: slug,
                status: 'publish',
                // El featured_media ya no es necesario aquí dentro...
                meta: {
                    _aioseo_title: meta_title,
                    _aioseo_description: meta_desc
                }
            }, aflandToken, featuredMediaId); // <-- ...porque lo pasamos aquí, como tercer argumento

            await updateEventStatus(eventsCollection, event._id, 'processed');
        }

    } catch (error) {
        console.error('❌ Ha ocurrido un error general:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('\n✅ Conexión a MongoDB cerrada.');
        }
        console.log('✅ Proceso del creador de contenidos finalizado.');
    }
}

// 5. Ejecución del script
runContentCreator();