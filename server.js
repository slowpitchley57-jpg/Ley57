const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Solo una vez
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());


// SOLUCIÓN DE EMERGENCIA: Conexión directa
mongoose.connect('mongodb+srv://rosasvillah_db_user:GhnkehSpQQGFwU3K@ley57.y2bgblz.mongodb.net/LEY57?retryWrites=true&w=majority')
    .then(() => console.log("✅ Conectado a MongoDB LEY57"))
    .catch(err => console.log("❌ Error de conexión:", err));
    
// --- MODELOS ---
const Config = mongoose.model('Config', { permitirAltas: Boolean });
const User = mongoose.model('User', { correo: String, pass: String, rol: String, equipo: String });
const Team = mongoose.model('Team', { 
    nombre: String, categoria: String, 
    g: { type: Number, default: 0 }, p: { type: Number, default: 0 },
    ca: { type: Number, default: 0 }, ce: { type: Number, default: 0 } 
});
const Game = mongoose.model('Game', { local: String, visita: String, fecha: String, hora: String, resultado: { type: String, default: "0-0" }, status: { type: String, default: "pendiente" } });
const Player = mongoose.model('Player', { 
    nombre: String, equipo: String, fechaNacimiento: String, categoria: String,
    jj: { type: Number, default: 0 }, vb: { type: Number, default: 0 }, 
    h: { type: Number, default: 0 }, hr: { type: Number, default: 0 }, 
    avg: { type: Number, default: 0 }
});

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
app.get('/api/equipos', async (req, res) => res.json(await Team.find()));
app.post('/api/equipos', async (req, res) => {
    const e = new Team(req.body); await e.save(); res.json(e);
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
    const { equipo } = req.query;
    const filter = equipo ? { equipo: equipo.split(' (')[0].trim() } : {};
    res.json(await Player.find(filter));
});
app.post('/api/players', async (req, res) => {
    const p = new Player(req.body); await p.save(); res.json(p);
});
// BUSCA ESTA RUTA EN TU SERVER.JS Y REEMPLÁZALA TODA
app.put('/api/players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Obtenemos los valores actuales de la base de datos por si el admin solo editó uno
        const jugadoraPrevia = await Player.findById(id);
        
        if (!jugadoraPrevia) return res.status(404).json({ error: "No existe" });

        // Combinamos lo que ya había con lo nuevo que manda el Admin
        // Usamos Number() para asegurar que no se guarden como texto
        const nuevosDatos = {
            jj: req.body.jj !== undefined ? Number(req.body.jj) : jugadoraPrevia.jj,
            vb: req.body.vb !== undefined ? Number(req.body.vb) : jugadoraPrevia.vb,
            h: req.body.h !== undefined ? Number(req.body.h) : jugadoraPrevia.h,
            hr: req.body.hr !== undefined ? Number(req.body.hr) : jugadoraPrevia.hr
        };

        // RE-CALCULAR EL AVG (H / VB)
        nuevosDatos.avg = nuevosDatos.vb > 0 ? (nuevosDatos.h / nuevosDatos.vb) : 0;

        const actualizado = await Player.findByIdAndUpdate(id, nuevosDatos, { new: true });
        
        console.log(`✅ Stats actualizadas para: ${actualizado.nombre} - AVG: ${actualizado.avg}`);
        res.json({ ok: true, data: actualizado });
    } catch (error) {
        console.error("Error al actualizar:", error);
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
app.get('/api/games', async (req, res) => res.json(await Game.find()));
app.post('/api/games', async (req, res) => {
    const g = new Game(req.body); await g.save(); res.json(g);
});
app.post('/api/games/resultado', async (req, res) => {
    const { id, sL, sV, ganador, perdedor } = req.body;
    await Game.findByIdAndUpdate(id, { resultado: `${sL}-${sV}`, status: 'finalizado' });
    await Team.findOneAndUpdate({ nombre: ganador }, { $inc: { g: 1, ca: sL, ce: sV } });
    await Team.findOneAndUpdate({ nombre: perdedor }, { $inc: { p: 1, ca: sV, ce: sL } });
    res.json({ ok: true });
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

// REEMPLAZA TU app.listen POR ESTE:
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
    console.log(`📡 Esperando peticiones de la Liga Ley 57...`);
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