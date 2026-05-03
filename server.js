const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Solo una vez
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: [
        'https://slowpitchley57-jpg.github.io', // Tu dominio de la captura
        'http://localhost:5500',               // Para que puedas probar local
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));


// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://rosasvillah_db_user:GhnkehSpQQGFwU3K@ley57.y2bgblz.mongodb.net/LEY57?retryWrites=true&w=majority')
    .then(() => console.log("✅ Conectado a MongoDB LEY57"))
    .catch(err => console.log("❌ Error de conexión:", err));
// --- MODELOS ACTUALIZADOS ---

// Agregamos liga a los equipos para saber si son de LEY 57 o ALV SPORT
const Team = mongoose.model('Team', { 
    nombre: String, 
    categoria: String, 
    liga: String, // Ahora recibirá: "femenil", "varonil", "easy_femenil" o "slow_mixto"
    g: { type: Number, default: 0 }, 
    p: { type: Number, default: 0 },
    ca: { type: Number, default: 0 }, 
    ce: { type: Number, default: 0 } 
});

// Agregamos liga a los juegos para que el rol no se mezcle
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

// Agregamos liga a los jugadores
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

// Los modelos de Config y User se quedan igual, ya que el Admin es el mismo para ambas
const Config = mongoose.model('Config', { permitirAltas: Boolean });
const User = mongoose.model('User', { correo: String, pass: String, rol: String, equipo: String });

// --- RUTAS ---

// Login
app.post('/api/login', async (req, res) => {
    const { correo, pass } = req.body;
    const user = await User.findOne({ correo, pass });
    if (user) {
        // Mandamos todos los datos del usuario incluyendo su equipo fijo
        res.json({ 
            correo: user.correo, 
            rol: user.rol, 
            equipo: user.equipo 
        });
    } else {
        res.status(401).json({ error: "Acceso denegado" });
    }
});


// Config
app.get('/api/config', async (req, res) => res.json(await Config.findOne() || { permitirAltas: true }));
app.post('/api/config', async (req, res) => {
    await Config.findOneAndUpdate({}, { permitirAltas: req.body.permitirAltas }, { upsert: true });
    res.json({ ok: true });
});

// Equipos (CRUD)
app.get('/api/equipos', async (req, res) => {
    const { liga } = req.query;
    const filtro = liga ? { liga } : {};
    const equipos = await Team.find(filtro);
    res.json(equipos);
});
// El POST de equipos y juegos debe recibir el campo 'liga' del body
app.post('/api/equipos', async (req, res) => {
    const nuevoEquipo = new Team(req.body);
    await nuevoEquipo.save();
    res.json(nuevoEquipo);
});
app.put('/api/equipos/:id', async (req, res) => {
    await Team.findByIdAndUpdate(req.params.id, req.body);
    res.json({ ok: true });
});
app.delete('/api/equipos/:id', async (req, res) => {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// Jugadores (CRUD)
app.get('/api/players', async (req, res) => {
    const { equipo, liga } = req.query;
    let filtro = {};
    if (equipo) filtro.equipo = equipo;
    if (liga) filtro.liga = liga;
    
    const players = await Player.find(filtro);
    res.json(players);
});
app.get('/api/players/:id', async (req, res) => {
    try {
        const player = await Player.findById(req.params.id);
        if (!player) return res.status(404).json({ error: "No encontrado" });
        res.json(player);
    } catch (err) {
        res.status(500).json({ error: "Error al buscar jugador" });
    }
});
app.post('/api/players', async (req, res) => {
    try {
        // Buscamos la liga a la que pertenece el equipo seleccionado
        const equipoInfo = await Team.findOne({ nombre: req.body.equipo });
        
        // Si el equipo existe, toma su liga; si no, por seguridad lo deja vacío para que tú lo asignes
        const ligaDelEquipo = equipoInfo ? equipoInfo.liga : req.body.liga;
        
        const nuevoPlayer = new Player({
            ...req.body,
            liga: ligaDelEquipo 
        });
        
        await nuevoPlayer.save();
        res.json(nuevoPlayer);
    } catch (error) {
        res.status(500).json({ error: "Error al registrar jugador" });
    }
});
// PUT jugador/pitcher - actualizacion completa
app.put('/api/players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const playerPrevio = await Player.findById(id);
        if (!playerPrevio) return res.status(404).json({ error: "No existe" });

        const nuevosDatos = {
            nombre: req.body.nombre !== undefined ? req.body.nombre.toUpperCase() : playerPrevio.nombre,
            equipo: req.body.equipo !== undefined ? req.body.equipo : playerPrevio.equipo,
            posicion: req.body.posicion !== undefined ? req.body.posicion : playerPrevio.posicion,
            esPitcher: req.body.esPitcher !== undefined ? req.body.esPitcher : playerPrevio.esPitcher,
            jj: req.body.jj !== undefined ? Number(req.body.jj) : playerPrevio.jj,
            vb: req.body.vb !== undefined ? Number(req.body.vb) : playerPrevio.vb,
            h: req.body.h !== undefined ? Number(req.body.h) : playerPrevio.h,
            dobles: req.body.dobles !== undefined ? Number(req.body.dobles) : playerPrevio.dobles,
            triples: req.body.triples !== undefined ? Number(req.body.triples) : playerPrevio.triples,
            hr: req.body.hr !== undefined ? Number(req.body.hr) : playerPrevio.hr,
            rbi: req.body.rbi !== undefined ? Number(req.body.rbi) : playerPrevio.rbi,
            k: req.body.k !== undefined ? Number(req.body.k) : playerPrevio.k,
            bb: req.body.bb !== undefined ? Number(req.body.bb) : playerPrevio.bb,
            avg: req.body.avg !== undefined ? Number(req.body.avg) : playerPrevio.avg,
            slg: req.body.slg !== undefined ? Number(req.body.slg) : playerPrevio.slg,
            obp: req.body.obp !== undefined ? Number(req.body.obp) : playerPrevio.obp,
            jp: req.body.jp !== undefined ? Number(req.body.jp) : playerPrevio.jp,
            ip: req.body.ip !== undefined ? Number(req.body.ip) : playerPrevio.ip,
            so_pitcher: req.body.so_pitcher !== undefined ? Number(req.body.so_pitcher) : playerPrevio.so_pitcher,
            cl: req.body.cl !== undefined ? Number(req.body.cl) : playerPrevio.cl,
            cr: req.body.cr !== undefined ? Number(req.body.cr) : playerPrevio.cr,
            bb_pitcher: req.body.bb_pitcher !== undefined ? Number(req.body.bb_pitcher) : playerPrevio.bb_pitcher,
            era: req.body.era !== undefined ? Number(req.body.era) : playerPrevio.era,
            whip: req.body.whip !== undefined ? Number(req.body.whip) : playerPrevio.whip,
            wp: req.body.wp !== undefined ? Number(req.body.wp) : playerPrevio.wp,
            blq: req.body.blq !== undefined ? Number(req.body.blq) : playerPrevio.blq
        };

        const actualizado = await Player.findByIdAndUpdate(id, nuevosDatos, { new: true });
        res.json({ ok: true, data: actualizado });
    } catch (error) {
        console.error("Error en PUT player:", error);
        res.status(500).json({ error: "Error interno" });
    }
});

// Endpoint para pitchers
app.get('/api/pitchers', async (req, res) => {
    const { liga } = req.query;
    let filtro = { esPitcher: true };
    if (liga) filtro.liga = liga;
    const pitchers = await Player.find(filtro);
    res.json(pitchers);
});

// Endpoint para leaders/top stats
app.get('/api/leaders', async (req, res) => {
    try {
        const { liga, cat, limit } = req.query;
        let filtro = {};
        if (liga) filtro.liga = liga;
        const l = parseInt(limit) || 5;

        let field, sortDir;
        switch (cat) {
            case 'avg': field = 'avg'; sortDir = -1; break;
            case 'hr': field = 'hr'; sortDir = -1; break;
            case 'dobles': field = 'dobles'; sortDir = -1; break;
            case 'triples': field = 'triples'; sortDir = -1; break;
            case 'rbi': field = 'rbi'; sortDir = -1; break;
            case 'k': field = 'k'; sortDir = -1; break;
            case 'bb': field = 'bb'; sortDir = -1; break;
            case 'slg': field = 'slg'; sortDir = -1; break;
            case 'obp': field = 'obp'; sortDir = -1; break;
            case 'era': field = 'era'; sortDir = 1; break;
            case 'so_pitcher': field = 'so_pitcher'; sortDir = -1; break;
            case 'whip': field = 'whip'; sortDir = 1; break;
            case 'ip': field = 'ip'; sortDir = -1; break;
            case 'jp': field = 'jp'; sortDir = -1; break;
            case 'wp': field = 'wp'; sortDir = -1; break;
            case 'blq': field = 'blq'; sortDir = -1; break;
            default: field = 'avg'; sortDir = -1;
        }

        const players = await Player.find(filtro).sort({ [field]: sortDir }).limit(l);
        res.json({ categoria: cat, leaders: players.map(p => ({
            nombre: p.nombre,
            equipo: p.equipo,
            liga: p.liga,
            valor: p[field] || 0,
            esPitcher: p.esPitcher
        }))});
    } catch (error) {
        res.status(500).json({ error: "Error al obtener leaders" });
    }
});

// Endpoint para juegos EN VIVO
app.get('/api/games/live', async (req, res) => {
    try {
        const now = new Date();
        const games = await Game.find({ status: 'en_vivo' });
        res.json(games);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener juegos en vivo" });
    }
});

// Actualizar juego en vivo
app.put('/api/games/:id/live', async (req, res) => {
    try {
        const { localScore, visitaScore, inning } = req.body;
        const game = await Game.findByIdAndUpdate(req.params.id, {
            isLive: true,
            status: 'en_vivo',
            liveScore: { local: localScore, visita: visitaScore },
            inning: inning
        }, { new: true });
        res.json({ ok: true, game });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar juego en vivo" });
    }
});

// Finalizar juego en vivo
app.put('/api/games/:id/end-live', async (req, res) => {
    try {
        const { sL, sV, ganador, perdedor } = req.body;
        const game = await Game.findByIdAndUpdate(req.params.id, {
            isLive: false,
            status: 'finalizado',
            resultado: `${sL}-${sV}`,
            ganador: ganador,
            perdedor: perdedor,
            liveScore: {}
        }, { new: true });
        res.json({ ok: true, game });
    } catch (error) {
        res.status(500).json({ error: "Error al finalizar juego" });
    }
});
// Ruta para limpiar todos los juegos finalizados
app.delete('/api/games/clear/history', async (req, res) => {
    try {
        await Game.deleteMany({ status: 'finalizado' });
        res.json({ ok: true, mensaje: "Historial de la semana borrado" });
    } catch (err) {
        res.status(500).json({ error: "Error al limpiar" });
    }
});
app.delete('/api/players/:id', async (req, res) => {
    await Player.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});
// RUTA PARA ELIMINAR JUEGOS DE LA BASE DE DATOS
app.delete('/api/games/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await Game.findByIdAndDelete(id);
        
        if (eliminado) {
            console.log(`✅ Juego ${id} eliminado correctamente`);
            res.json({ ok: true, mensaje: "Juego borrado" });
        } else {
            res.status(404).json({ error: "No se encontró el juego" });
        }
    } catch (error) {
        console.error("❌ Error al borrar juego:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});
// RUTA PARA DESCARGAR EXCEL (CSV) DE JUEGOS
app.get('/api/games/download', async (req, res) => {
    try {
        const games = await Game.find();
        let csv = "Fecha,Hora,Local,Visita,Resultado,Ganador,Status\n"; // Encabezados
        
        games.forEach(g => {
            csv += `${g.fecha},${g.hora},${g.local},${g.visita},${g.resultado || 'N/A'},${g.ganador || 'N/A'},${g.status}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=historial_ley57.csv');
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).json({ error: "Error al generar archivo" });
    }
});

// Juegos
app.get('/api/games', async (req, res) => {
    const { liga } = req.query;
    const filtro = liga ? { liga } : {};
    const juegos = await Game.find(filtro);
    res.json(juegos);
});
app.post('/api/games', async (req, res) => {
    const g = new Game({
        local: req.body.local,
        visita: req.body.visita,
        fecha: req.body.fecha,
        hora: req.body.hora,
        liga: req.body.liga,
        resultado: req.body.resultado || "0-0",
        status: req.body.status || "pendiente",
        streaming: req.body.streaming || "",
        isLive: false,
        liveScore: { local: 0, visita: 0 },
        inning: ""
    });
    await g.save(); res.json(g);
});
// En tu servidor (Node.js)
app.post('/api/games/resultado', async (req, res) => {
    try {
        const { id, sL, sV, ganador, perdedor, streaming } = req.body;
        const updateData = {
            resultado: `${sL}-${sV}`,
            ganador,
            perdedor,
            status: "finalizado",
            isLive: false
        };
        if (streaming) updateData.streaming = streaming;
        const juegoActualizado = await Game.findByIdAndUpdate(id, updateData, { new: true });
        res.json({ message: "Juego finalizado con éxito", juegoActualizado });
    } catch (error) {
        console.error("Error al finalizar juego:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});
// Ruta para cambiar contraseña desde el Manager
app.put('/api/users/update-password', async (req, res) => {
    try {
        const { correo, nuevaPass } = req.body;
        const actualizado = await User.findOneAndUpdate(
            { correo: correo },
            { pass: nuevaPass },
            { new: true }
        );
        if (actualizado) {
            res.json({ ok: true, mensaje: "Contraseña actualizada" });
        } else {
            res.status(404).json({ error: "Usuario no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// Ruta para ver todos los usuarios (Solo para el Desarrollador)
app.get('/api/dev/usuarios', async (req, res) => {
    try {
        const usuarios = await User.find({}, { pass: 1, correo: 1, equipo: 1, rol: 1 });
        res.json(usuarios);
    } catch (error) {
        res.status(500).send("Error al obtener usuarios");
    }
});

// REEMPLAZA TU app.listen POR ESTE:
const PORT = process.env.PORT || 3000;


app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
    console.log(`📡 Esperando peticiones de la Liga Ley 57...`);
});

