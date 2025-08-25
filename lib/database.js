// lib/database.js
// VERSIÓN CON LOG DE DEPURACIÓN

const { MongoClient } = require('mongodb');

// Leemos las dos variables de entorno necesarias
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

// Comprobamos que ambas variables existan
if (!MONGO_URI) {
    throw new Error('Define la variable de entorno MONGO_URI en tu archivo .env');
}
if (!DB_NAME) {
    throw new Error('Define la variable de entorno DB_NAME en tu archivo .env');
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        return cachedDb;
    }

    const client = new MongoClient(MONGO_URI);
    await client.connect();

    // Le decimos explícitamente a qué base de datos conectarnos.
    const db = client.db(DB_NAME);

    // ==========================================================
    // --- AQUÍ ESTÁ EL LOG DE DEPURACIÓN QUE AÑADIMOS ---
    console.log(`[Database Helper] Conexión exitosa a la base de datos: "${db.databaseName}"`);
    // ==========================================================

    cachedClient = client;
    cachedDb = db;

    return db;
}

module.exports = { connectToDatabase };