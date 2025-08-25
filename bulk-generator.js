// bulk-generator.js
require('dotenv').config();
const { connectToDatabase } = require('./lib/database.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- CONFIGURACIÓN ---
// Un lote más grande porque es una tarea masiva
const BATCH_SIZE = 20;

// --- LÓGICA DE GEMINI (la misma que ya conocemos) ---
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no está definida.');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const nightPlanPromptTemplate = (event) => `
    Eres "Duende", un conocedor local y aficionado al flamenco...
    (Aquí va el resto de tu prompt, exactamente como lo tienes en generate-night-plan.js)
`;


async function bulkGeneratePlans() {
    console.log('--- INICIANDO LOTE DE CARGA MASIVA ---');

    try {
        const db = await connectToDatabase();
        const eventsCollection = db.collection('events');
        console.log('Conectado a MongoDB.');

        // Preparamos la fecha de hoy para no procesar eventos pasados
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // CAMBIO CLAVE: Buscamos TODOS los eventos futuros sin nightPlan
        const eventsToProcess = await eventsCollection.find({
            nightPlan: { $exists: false },
            date: { $gte: today.toISOString().split('T')[0] }
            name: { $exists: true, $ne: "" }
        }).limit(BATCH_SIZE).toArray();

        if (eventsToProcess.length === 0) {
            console.log('✅ ¡TAREA COMPLETADA! No hay más eventos que necesiten un "Plan Noche".');
            return;
        }

        console.log(`⚙️ Se encontraron ${eventsToProcess.length} eventos. Procesando lote...`);

        for (const event of eventsToProcess) {
            try {
                console.log(`🔥 Generando plan para: "${event.name}"`);
                const prompt = nightPlanPromptTemplate(event);
                const result = await model.generateContent(prompt);
                const generatedContent = result.response.text();

                await eventsCollection.updateOne(
                    { _id: event._id },
                    { $set: { nightPlan: generatedContent } }
                );
                console.log(`💾 Plan para "${event.name}" guardado.`);

            } catch (error) {
                console.error(`❌ Error generando el plan para "${event.name}" (ID: ${event._id}):`, error.message);
            }
        }

    } catch (error) {
        console.error('Ha ocurrido un error fatal durante el proceso de carga masiva:', error);
    } finally {
        console.log('--- LOTE FINALIZADO ---');
    }
}

bulkGeneratePlans();