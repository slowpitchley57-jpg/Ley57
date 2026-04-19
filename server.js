const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Solo una vez
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

app.use(cors({
    origin: [
        'https://slowpitchley57-jpg.github.io', // Tu dominio de la captura
        'http://localhost:5500',               // Para que puedas probar local
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));


// SOLUCIÓN DE EMERGENCIA: Conexión directa
mongoose.connect('mongodb+srv://rosasvillah_db_user:GhnkehSpQQGFwU3K@ley57.y2bgblz.mongodb.net/LEY57?retryWrites=true&w=majority')
    .then(() => console.log("✅ Conectado a MongoDB LEY57"))
    .catch(err => console.log("❌ Error de conexión:", err));
// --- MODELOS ACTUALIZADOS ---

// Agregamos liga a los equipos para saber si son de LEY 57 o ALV SPORT
const Team = mongoose.model('Team', { 
    nombre: String, 
    categoria: String, 
    liga: { type: String, default: "femenil" }, // "femenil" (Ley 57) o "varonil" (ALV Sport)
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
    liga: { type: String, default: "femenil" }, // Identificador de liga
    resultado: { type: String, default: "0-0" }, 
    status: { type: String, default: "pendiente" } 
});

// Agregamos liga a los jugadores
const Player = mongoose.model('Player', { 
    nombre: String, 
    equipo: String, 
    fechaNacimiento: String, 
    categoria: String,
    liga: { type: String, default: "femenil" }, // Identificador de liga
    jj: { type: Number, default: 0 }, 
    vb: { type: Number, default: 0 }, 
    h: { type: Number, default: 0 }, 
    avg: { type: Number, default: 0 },
    dobles: { type: Number, default: 0 }, // Agregar este
    triples: { type: Number, default: 0 }, // Agregar este
    hr: { type: Number, default: 0 },
    k: { type: Number, default: 0 },      // Agregar este
    rbi: { type: Number, default: 0 }
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
function mostrarNombreAdmin() {
    const sesion = localStorage.getItem('userLogueado');
    if (sesion) {
        const user = JSON.parse(sesion);
        // Convierte "javier@ley57.com" en "JAVIER"
        const nombreSimple = user.correo.split('@')[0].toUpperCase();
        
        const elemento = document.getElementById('nombreUsuarioActivo');
        if (elemento) {
            elemento.innerText = nombreSimple;
        }
    } else {
        // Si no hay sesión, manda al login (Seguridad)
        window.location.href = 'index.html';
    }
}


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
    if (liga) filtro.liga = liga; // ESTO ES LO QUE FALTA
    
    const players = await Player.find(filtro);
    res.json(players);
});
app.post('/api/players', async (req, res) => {
    // Buscamos al equipo para saber su liga antes de guardar al jugador
    const equipoInfo = await Team.findOne({ nombre: req.body.equipo });
    const ligaDelEquipo = equipoInfo ? equipoInfo.liga : "femenil";
    
    const nuevoPlayer = new Player({
        ...req.body,
        liga: ligaDelEquipo // Así se guarda automáticamente en la liga correcta
    });
    await nuevoPlayer.save();
    res.json(nuevoPlayer);
});
// BUSCA ESTA RUTA EN TU SERVER.JS Y REEMPLÁZALA TODA
app.put('/api/players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const jugadoraPrevia = await Player.findById(id);
        if (!jugadoraPrevia) return res.status(404).json({ error: "No existe" });

        const nuevosDatos = {
            // Agregamos el nombre por si el Admin lo edita
            nombre: req.body.nombre !== undefined ? req.body.nombre.toUpperCase() : jugadoraPrevia.nombre,
            equipo: req.body.equipo !== undefined ? req.body.equipo : jugadoraPrevia.equipo,
            
            // Stats numéricas
            jj: req.body.jj !== undefined ? Number(req.body.jj) : jugadoraPrevia.jj,
            vb: req.body.vb !== undefined ? Number(req.body.vb) : jugadoraPrevia.vb,
            h: req.body.h !== undefined ? Number(req.body.h) : jugadoraPrevia.h,
            dobles: req.body.dobles !== undefined ? Number(req.body.dobles) : jugadoraPrevia.dobles,
            triples: req.body.triples !== undefined ? Number(req.body.triples) : jugadoraPrevia.triples,
            hr: req.body.hr !== undefined ? Number(req.body.hr) : jugadoraPrevia.hr,
            rbi: req.body.rbi !== undefined ? Number(req.body.rbi) : jugadoraPrevia.rbi,
            k: req.body.k !== undefined ? Number(req.body.k) : jugadoraPrevia.k
        };

        // Recalcular AVG siempre
        nuevosDatos.avg = nuevosDatos.vb > 0 ? (nuevosDatos.h / nuevosDatos.vb) : 0;

        const actualizado = await Player.findByIdAndUpdate(id, nuevosDatos, { new: true });
        res.json({ ok: true, data: actualizado });
    } catch (error) {
        res.status(500).json({ error: "Error interno" });
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
    const g = new Game(req.body); await g.save(); res.json(g);
});
// En tu servidor (Node.js)
app.post('/api/games/resultado', async (req, res) => {
    try {
        const { id, sL, sV, ganador, perdedor } = req.body;
        
        // ACTUALIZAMOS EL RESULTADO Y EL STATUS
        const juegoActualizado = await Game.findByIdAndUpdate(id, {
            resultado: `${sL}-${sV}`,
            ganador,
            perdedor,
            status: "finalizado" // <--- ESTO ES LO QUE TE FALTA
        }, { new: true });

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
// Actualización total de jugadora (Admin)
app.put('/api/players/:id', async (req, res) => {
    try {
        // Recibimos todo el objeto (nombre, equipo, fecha, stats)
        const actualizada = await Player.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(actualizada);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar jugadora" });
    }
});

// REEMPLAZA TU app.listen POR ESTE:
const PORT = process.env.PORT || 3000;


app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
    console.log(`📡 Esperando peticiones de la Liga Ley 57...`);
});