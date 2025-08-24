// lib/database.js
// ACTUALIZACIÓN FINAL: Usa MONGO_URI y también DB_NAME

const { MongoClient } = require('mongodb');

// Leemos las dos variables de entorno necesarias
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME; // <-- AÑADIDO

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


    // CAMBIO CLAVE: Le decimoccccc  cs explícitamente a qué base de datos coonectarnos.
    const db = client.db(DB_NAME);

    cachedClient = client;
    cachedDb = db;

    return db;
}

module.exports = { connectToDatabase };