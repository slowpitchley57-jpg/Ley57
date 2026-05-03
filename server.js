const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- CONFIGURACIÓN DE CORS (UNIFICADA) ---
app.use(cors()); // Esto permite conexiones desde cualquier origen, ideal para arreglar errores de acceso
app.use(express.json());

// --- CONEXIÓN A MONGO ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://rosasvillah_db_user:GhnkehSpQQGFwU3K@ley57.y2bgblz.mongodb.net/LEY57?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Conectado a MongoDB LEY57"))
    .catch(err => console.log("❌ Error de conexión:", err));

// --- MODELOS ---

const Team = mongoose.model('Team', { 
    nombre: String, 
    categoria: String, 
    liga: String,
    g: { type: Number, default: 0 }, 
    p: { type: Number, default: 0 },
    ca: { type: Number, default: 0 }, 
    ce: { type: Number, default: 0 } 
});

const Game = mongoose.model('Game', { 
    local: String, 
    visita: String, 
    fecha: String, 
    hora: String, 
    liga: String,
    resultado: { type: String, default: "0-0" }, 
    status: { type: String, default: "pendiente" },
    ganador: { type: String, default: "" },
    perdedor: { type: String, default: "" },
    streaming: { type: String, default: "" },
    isLive: { type: Boolean, default: false },
    liveScore: { local: { type: Number, default: 0 }, visita: { type: Number, default: 0 } },
    inning: { type: String, default: "" }
});

const Player = mongoose.model('Player', { 
    nombre: String, 
    equipo: String, 
    fechaNacimiento: String, 
    categoria: String,
    liga: String,
    posicion: { type: String, default: "" },
    jj: { type: Number, default: 0 }, 
    vb: { type: Number, default: 0 }, 
    h: { type: Number, default: 0 }, 
    avg: { type: Number, default: 0 },
    dobles: { type: Number, default: 0 },
    triples: { type: Number, default: 0 }, 
    hr: { type: Number, default: 0 },
    k: { type: Number, default: 0 },
    rbi: { type: Number, default: 0 },
    bb: { type: Number, default: 0 },
    slg: { type: Number, default: 0 },
    obp: { type: Number, default: 0 },
    esPitcher: { type: Boolean, default: false },
    jp: { type: Number, default: 0 },
    ip: { type: Number, default: 0 },
    so_pitcher: { type: Number, default: 0 },
    cl: { type: Number, default: 0 },
    cr: { type: Number, default: 0 },
    bb_pitcher: { type: Number, default: 0 },
    era: { type: Number, default: 0 },
    whip: { type: Number, default: 0 },
    wp: { type: Number, default: 0 },
    blq: { type: Number, default: 0 }
});

const Config = mongoose.model('Config', { permitirAltas: Boolean });
const User = mongoose.model('User', { correo: String, pass: String, rol: String, equipo: String });

// --- RUTAS ---

// Login
app.post('/api/login', async (req, res) => {
    const { correo, pass } = req.body;
    try {
        const user = await User.findOne({ correo, pass });
        if (user) {
            res.json({ correo: user.correo, rol: user.rol, equipo: user.equipo });
        } else {
            res.status(401).json({ error: "Acceso denegado" });
        }
    } catch (e) { res.status(500).json(e); }
});

// Config
app.get('/api/config', async (req, res) => res.json(await Config.findOne() || { permitirAltas: true }));
app.post('/api/config', async (req, res) => {
    await Config.findOneAndUpdate({}, { permitirAltas: req.body.permitirAltas }, { upsert: true });
    res.json({ ok: true });
});

// Equipos
app.get('/api/equipos', async (req, res) => {
    const { liga } = req.query;
    const filtro = liga ? { liga } : {};
    res.json(await Team.find(filtro));
});

app.post('/api/equipos', async (req, res) => {
    const nuevo = new Team(req.body);
    await nuevo.save();
    res.json(nuevo);
});

app.put('/api/equipos/:id', async (req, res) => {
    await Team.findByIdAndUpdate(req.params.id, req.body);
    res.json({ ok: true });
});

app.delete('/api/equipos/:id', async (req, res) => {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// Jugadores
app.get('/api/players', async (req, res) => {
    const { equipo, liga } = req.query;
    let filtro = {};
    if (equipo) filtro.equipo = equipo;
    if (liga) filtro.liga = liga;
    res.json(await Player.find(filtro));
});

// Busca la ruta app.post('/api/players', ...) y reemplázala por esta versión mejorada
app.post('/api/players', async (req, res) => {
    try {
        // Buscamos la info del equipo para saber su liga
        const equipoInfo = await Team.findOne({ nombre: req.body.equipo });
        
        // Prioridad: 1. Liga del equipo encontrado, 2. Liga enviada en el body, 3. Femenil por defecto
        const ligaFinal = equipoInfo ? equipoInfo.liga : (req.body.liga || "femenil");
        
        const nuevoPlayer = new Player({
            ...req.body,
            liga: ligaFinal 
        });
        
        await nuevoPlayer.save();
        res.json(nuevoPlayer);
    } catch (error) {
        console.error("Error al registrar:", error);
        res.status(500).json({ error: "Error al registrar jugador/pitcher" });
    }
});

app.put('/api/players/:id', async (req, res) => {
    try {
        const actualizado = await Player.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json({ ok: true, data: actualizado });
    } catch (e) { res.status(500).json(e); }
});

app.delete('/api/players/:id', async (req, res) => {
    await Player.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// Leaders (Estadísticas para las páginas rosa/verde/azul)
app.get('/api/leaders', async (req, res) => {
    try {
        const { liga, cat, limit } = req.query;
        let filtro = {};
        if (liga) filtro.liga = liga;
        const l = parseInt(limit) || 5;
        
        // Mapeo de campos y dirección de orden
        const sorts = { 'era': 1, 'whip': 1 }; // Estos se ordenan de menor a mayor
        const sortDir = sorts[cat] || -1; // El resto de mayor a menor

        const leaders = await Player.find(filtro).sort({ [cat]: sortDir }).limit(l);
        res.json({ categoria: cat, leaders });
    } catch (e) { res.status(500).json(e); }
});

// Juegos
app.get('/api/games', async (req, res) => {
    const { liga, status } = req.query;
    let filtro = {};
    if (liga) filtro.liga = liga;
    if (status) filtro.status = status;
    res.json(await Game.find(filtro));
});

app.post('/api/games', async (req, res) => {
    const g = new Game(req.body);
    await g.save();
    res.json(g);
});

app.post('/api/games/resultado', async (req, res) => {
    try {
        const { id, sL, sV, ganador, perdedor } = req.body;
        const actualizado = await Game.findByIdAndUpdate(id, {
            resultado: `${sL}-${sV}`,
            ganador, perdedor,
            status: "finalizado",
            isLive: false
        }, { new: true });
        res.json(actualizado);
    } catch (e) { res.status(500).json(e); }
});

app.delete('/api/games/:id', async (req, res) => {
    await Game.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// Usuarios
app.put('/api/users/update-password', async (req, res) => {
    const { correo, nuevaPass } = req.body;
    await User.findOneAndUpdate({ correo }, { pass: nuevaPass });
    res.json({ ok: true });
});

app.get('/api/dev/usuarios', async (req, res) => {
    res.json(await User.find());
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
});