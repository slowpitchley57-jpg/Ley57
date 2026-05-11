const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs'); // Necesario para guardar el archivo
const path = require('path');
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
// --- MODELOS (Sincronizados con tus carpetas de MongoDB) ---

// Mongoose usa el tercer parámetro para saber el nombre exacto de la colección
const Team = mongoose.model('Team', new mongoose.Schema({ 
    nombre: String, 
    categoria: String, 
    liga: String,
    g: { type: Number, default: 0 }, 
    p: { type: Number, default: 0 },
    ca: { type: Number, default: 0 }, 
    ce: { type: Number, default: 0 } 
}), 'teams'); // <--- Coincide con tu carpeta 'teams'

const Game = mongoose.model('Game', new mongoose.Schema({ 
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
}), 'games'); // <--- Coincide con tu carpeta 'games'

const Player = mongoose.model('Player', new mongoose.Schema({ 
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
}), 'players'); // <--- Coincide con tu carpeta 'players'

const Config = mongoose.model('Config', new mongoose.Schema({ 
    permitirAltas: Boolean 
}), 'configs'); // <--- Coincide con tu carpeta 'configs'

const User = mongoose.model('User', new mongoose.Schema({ 
    correo: String, 
    pass: String, 
    rol: String, 
    equipo: String 
}), 'users'); // <--- CORRECCIÓN CLAVE: En tu captura se llama 'users', NO 'usuarios'

const teamSchema = new mongoose.Schema({
    nombre: String,
    liga: String, // 'femenil', 'varonil', etc.
    // Configuración de la Fianza
    fianzaTotal: { type: Number, default: 10000 },
    totalAbonado: { type: Number, default: 0 },
    historialPagos: [{
        fecha: { type: Date, default: Date.now },
        monto: Number,
        folio: String
    }]
});
// --- RUTAS ---

app.post('/api/login', async (req, res) => {
    try {
        const { correo, pass } = req.body;
        
        if (!correo || !pass) {
            return res.status(400).json({ error: "Faltan datos" });
        }

        // Buscamos ignorando espacios y mayúsculas
        const user = await User.findOne({ 
            correo: correo.trim().toLowerCase(), 
            pass: pass.trim() 
        });

        if (user) {
            res.json({ 
                correo: user.correo, 
                rol: user.rol, 
                equipo: user.equipo || "" 
            });
        } else {
            // Si no existe, mandamos 401 (Credenciales incorrectas), NO 500
            res.status(401).json({ error: "Usuario no encontrado" });
        }
    } catch (e) {
        console.error("Error en Login:", e);
        res.status(500).json({ error: "Error interno del servidor" });
    }
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
// Ruta para obtener equipos filtrados por liga
app.get('/teams', async (req, res) => {
    try {
        const { liga } = req.query; // Captura lo que mandamos (?liga=femenil)
        const filtro = liga ? { liga: liga } : {}; 
        const equipos = await Team.find(filtro);
        res.json(equipos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
const PDFDocument = require('pdfkit');

app.post('/api/registrar-pago', async (req, res) => {
    const { equipoId, montoAbono } = req.body;

    try {
        const equipo = await Team.findById(equipoId);
        if (!equipo) return res.status(404).json({ success: false, error: "Equipo no encontrado" });

        // Validar e inicializar campos para evitar el error de 'push'
        if (!equipo.historialPagos) equipo.historialPagos = [];
        if (!equipo.totalAbonado) equipo.totalAbonado = 0;

        const abonoLimpio = parseFloat(montoAbono);
        equipo.totalAbonado += abonoLimpio;
        
        // Asumiendo fianza de 10,000 si no existe el campo
        const metaFianza = equipo.fianzaTotal || 10000;
        const saldoPendiente = metaFianza - equipo.totalAbonado;
        const folio = `F-${Date.now().toString().slice(-6)}`;

        equipo.historialPagos.push({ monto: abonoLimpio, folio: folio, fecha: new Date() });
        await equipo.save();

        // --- ENCABEZADO CON COLOR (AZUL OSCURO) ---
        doc.rect(0, 0, 600, 150).fill('#1e3a8a'); 
        
        // Espacio para Logo (Si tienes el archivo, descomenta la línea de abajo)
        // doc.image('public/img/logo_liga.png', 50, 30, { width: 80 });
        
        doc.fillColor('white')
           .fontSize(25).text('LIGA LEY 57', 150, 45)
           .fontSize(10).text('COMPROBANTE OFICIAL DE PAGO - FIANZA', 150, 75)
           .fontSize(10).text('Hermosillo, Sonora, México', 150, 90);

        // Cuadro de Folio (Derecha)
        doc.rect(400, 40, 150, 70).stroke('white');
        doc.fontSize(10).text('FOLIO DE FACTURA', 410, 55);
        doc.fontSize(16).text(folio, 410, 75, { weight: 'bold' });

        // --- CUERPO DE LA FACTURA ---
        doc.fillColor('#1f2937').fontSize(14).text('DETALLES DEL CLIENTE / EQUIPO', 50, 180);
        doc.rect(50, 195, 500, 2).fill('#e5e7eb'); // Línea divisoria

        doc.fontSize(11).fillColor('black');
        doc.text(`EQUIPO: ${equipo.nombre.toUpperCase()}`, 50, 210);
        doc.text(`LIGA: ${equipo.liga.toUpperCase()}`, 50, 225);
        doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleDateString()}`, 350, 210);

        // --- TABLA DE CONCEPTOS ---
        const tableTop = 280;
        doc.rect(50, tableTop, 500, 25).fill('#f3f4f6');
        doc.fillColor('#111827').fontSize(10);
        doc.text('DESCRIPCIÓN', 60, tableTop + 8);
        doc.text('MONTO ABONADO', 400, tableTop + 8);

        // Fila de datos
        doc.fillColor('black').text(`Abono a cuenta de fianza de temporada`, 60, tableTop + 40);
        doc.fontSize(12).text(`$${abonoLimpio.toLocaleString()}`, 400, tableTop + 40, { weight: 'bold' });
        doc.rect(50, tableTop + 60, 500, 1).fill('#f3f4f6');

        // --- RESUMEN FINANCIERO (TOTALES) ---
        const footerTop = 450;
        doc.rect(300, footerTop, 250, 100).fill('#f9fafb');
        
        doc.fillColor('black').fontSize(10).text('Meta Total de Fianza:', 310, footerTop + 15);
        doc.text(`$${metaFianza.toLocaleString()}`, 480, footerTop + 15);

        doc.text('Total Acumulado:', 310, footerTop + 35);
        doc.text(`$${equipo.totalAbonado.toLocaleString()}`, 480, footerTop + 35);

        doc.fillColor('red').fontSize(12).text('SALDO PENDIENTE:', 310, footerTop + 65, { weight: 'bold' });
        doc.text(`$${saldoPendiente.toLocaleString()}`, 460, footerTop + 65);

        // --- PIE DE PÁGINA Y FIRMAS ---
        doc.fillColor('black').fontSize(9).text('Este documento sirve como comprobante legal de ingreso para la participación en el torneo.', 50, 650, { align: 'center' });
        
        // Líneas de firma
        doc.text('__________________________', 80, 750);
        doc.text('Javier Yocupicio', 80, 765, { align: 'left', width: 150 });
        doc.fontSize(7).text('Director General / Admin', 80, 775);

        doc.text('__________________________', 350, 750);
        doc.text('Representante del Equipo', 350, 765, { align: 'left', width: 150 });

        doc.end();

        // Esperar a que el archivo se termine de escribir
        stream.on('finish', () => {
            res.json({ 
                success: true, 
                mensaje: "Pago guardado y PDF generado", 
                saldo: saldoPendiente,
                folio: folio,
                pdfUrl: `https://ley57.onrender.com/recibos/${fileName}` // URL para descargar
            });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.use('/recibos', express.static(path.join(__dirname, 'public/recibos')));

// Configuración y Utilidades
app.get('/api/config', async (req, res) => res.json(await Config.findOne() || { permitirAltas: true }));
app.post('/api/config', async (req, res) => {
    await Config.findOneAndUpdate({}, { permitirAltas: req.body.permitirAltas }, { upsert: true });
    res.json({ ok: true });
});

app.delete('/api/equipos/:id', async (req, res) => { await Team.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
app.delete('/api/players/:id', async (req, res) => { await Player.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
app.delete('/api/games/:id', async (req, res) => { await Game.findByIdAndDelete(req.params.id); res.json({ ok: true }); });

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Multiliga Pro activo en puerto ${PORT}`);
});