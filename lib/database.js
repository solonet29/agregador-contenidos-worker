
// lib/database.js

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

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
    const db = client.db(DB_NAME);

    console.log(`[Database Helper] Conexión exitosa a la base de datos: "${db.databaseName}"`);

    cachedClient = client;
    cachedDb = db;

    return db;
}

async function closeDatabaseConnection() {
    if (cachedClient) {
        await cachedClient.close();
        cachedClient = null;
        cachedDb = null;
        console.log("[Database Helper] Conexión a la base de datos cerrada.");
    }
}

module.exports = { connectToDatabase, closeDatabaseConnection };
