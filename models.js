const mongoose = require('mongoose');

// Esquema de Usuarios (Admins y Managers)
const UserSchema = new mongoose.Schema({
    nombre: String,
    correo: { type: String, unique: true },
    password: String,
    rol: { type: String, enum: ['admin', 'manager'], default: 'manager' }
});

// Esquema de Jugadores y Estadísticas
const PlayerSchema = new mongoose.Schema({
    nombre: String,
    equipo: String,
    categoria: String, // 'bateo' o 'picheo'
    stats: {
        avg: { type: Number, default: 0 },
        hr: { type: Number, default: 0 },
        era: { type: Number, default: 0 }, // Picheo
        so: { type: Number, default: 0 }   // Ponches
    }
});

const User = mongoose.model('User', UserSchema);
const Player = mongoose.model('Player', PlayerSchema);

module.exports = { User, Player };