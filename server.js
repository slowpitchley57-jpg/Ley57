const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const app = express();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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

// 1. DEFINICIÓN DEL MODELO DE FIANZAS (Nueva colección en MongoDB)
const fianzaSchema = new mongoose.Schema({
    folio: { type: String, unique: true, required: true },
    teamName: { type: String, required: true },
    liga: { type: String, required: true }, // easy_femenil, varonil, mixto
    montoAbonado: { type: Number, required: true },
    saldoRestante: { type: Number, required: true },
    fechaHora: { type: String, required: true },
    capturadoPor: { type: String, default: 'Javier Yocupicio' }
});

const Fianza = mongoose.model('Fianza', fianzaSchema);


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
    liga: String,
    categoria: String,
    // CAMPOS DE FINANZAS (Asegúrate de que estén así)
    totalAbonado: { type: Number, default: 0 }, // DEBE SER NUMBER
    historialPagos: { type: Array, default: [] },
    historialPagos: [{
        monto: Number,
        folio: String,
        fecha: { type: Date, default: Date.now }
    }]
});

// --- RUTAS ---

app.post('/api/fianzas/registrar', async (req, res) => {
    try {
        const { teamName, liga, montoAbonado, folio } = req.body;

        if (!teamName || !liga || !montoAbonado) {
            return res.status(400).json({ error: "Todos los campos son obligatorios." });
        }

        // Buscamos el último abono de este equipo para calcular cuánto le falta restando desde los $10,000 iniciales
        const ultimoPago = await Fianza.findOne({ teamName, liga }).sort({ _id: -1 });
        const saldoAnterior = ultimoPago ? ultimoPago.saldoRestante : 10000;
        const nuevoSaldoRestante = saldoAnterior - Number(montoAbonado);

        // Generamos un número de folio único incremental o aleatorio formal
        const nuevoFolio = `L57-FN-${Math.floor(100000 + Math.random() * 900000)}`;

        // Formateamos la fecha y hora actual de la transacción
        const ahora = new Date();
        const fechaHoraActual = ahora.toLocaleDateString('es-MX') + ' | ' + ahora.toLocaleTimeString('es-MX');

        // Guardamos el documento en la carpeta (colección) Fianza
       const nuevoAbono = new Fianza({
    folio: folio.trim(), // Usa el tuyo (REC-928932)
    teamName,
    liga,
    montoAbonado: Number(montoAbonado),
    saldoRestante: nuevoSaldoRestante,
    fechaHora: fechaHoraActual
        });

        await nuevoAbono.save();

        // Respondemos al Administrador con los datos listos para que pinte su PDF de inmediato
        res.status(201).json({
            success: true,
            message: "Abono guardado en la base de datos con éxito.",
            datosPago: nuevoAbono
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor al procesar el abono de fianza." });
    }
});

// ==========================================
// 3. RUTA PARA QUE EL MANAGER CONSULTE SU HISTORIAL
// ==========================================
app.get('/api/fianzas/historial', async (req, res) => {
    try {
        const { teamName, liga } = req.query;
        // Busca todos los registros de la carpeta de fianzas que coincidan con el equipo
        const historial = await Fianza.find({ teamName, liga }).sort({ _id: -1 });
        res.json(historial);
    } catch (error) {
        res.status(500).json({ error: "Error al jalar los folios de la fianza." });
    }
});

// BUSCADOR GENERAL DE FIANZAS POR FOLIO (Cualquier formato)
app.get('/api/fianzas/buscar/:folio', async (req, res) => {
    try {
        // .trim() elimina espacios y .toUpperCase() asegura que no falle por mayúsculas/minúsculas
        const folioBusqueda = req.params.folio.trim();
        
        // Buscamos en la colección Fianza de MongoDB
        const pago = await Fianza.findOne({ 
            folio: { $regex: new RegExp("^" + folioBusqueda + "$", "i") } 
        });
        
        if (!pago) {
            return res.status(404).json({ found: false, error: "El folio ingresado no se encuentra registrado." });
        }
        
        res.json({ found: true, pago });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor al consultar la fianza." });
    }
});

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
app.post('/api/registrar-pago', async (req, res) => {
    const { equipoId, montoAbono } = req.body;

    try {
        // 1. OBTENER Y VALIDAR EQUIPO
        const equipo = await Team.findById(equipoId);
        if (!equipo) return res.status(404).json({ success: false, error: "Equipo no encontrado" });

        // MAPEADO DE LIGAS (Para que el PDF diga el nombre correcto)
        const nombresLigas = {
            'femenil': 'LEY 57 - FEMENIL',
            'varonil': 'ALV SPORT - VARONIL',
            'easy_femenil': 'EASY FEMENIL (LIBRE)',
            'slow_mixto': 'SLOW MIXTO (LIBRE)'
        };
        const nombreLigaReal = nombresLigas[equipo.liga] || 'LIGA LEY 57';

        const abonoLimpio = parseFloat(montoAbono);
        if (isNaN(abonoLimpio) || abonoLimpio <= 0) {
            return res.status(400).json({ success: false, error: "Monto de abono inválido" });
        }

        // 2. ACTUALIZACIÓN DE BASE DE DATOS (PERSISTENCIA TOTAL)
        if (typeof equipo.totalAbonado !== 'number') equipo.totalAbonado = 0;
        if (!equipo.historialPagos) equipo.historialPagos = [];

        equipo.totalAbonado += abonoLimpio;
        const folio = `REC-${Date.now().toString().slice(-6)}`;
        
        equipo.historialPagos.push({
            monto: abonoLimpio,
            folio: folio,
            fecha: new Date()
        });

        // Forzar guardado en MongoDB
        equipo.markModified('totalAbonado');
        equipo.markModified('historialPagos');
        await equipo.save();

        const metaFianza = 10000;
        const saldoPendiente = metaFianza - equipo.totalAbonado;

        // 3. CONFIGURACIÓN DEL ARCHIVO PDF
        const fileName = `factura_${folio}.pdf`;
        const publicPath = path.join(__dirname, 'public', 'recibos');
        const filePath = path.join(publicPath, fileName);

        if (!fs.existsSync(publicPath)) {
            fs.mkdirSync(publicPath, { recursive: true });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // --- DISEÑO DE ÉLITE ---
        doc.rect(0, 0, 600, 842).fill('#ffffff'); 
        doc.rect(0, 0, 20, 842).fill('#1e3a8a'); 

        doc.rect(20, 0, 580, 150).fill('#1e3a8a');
        
        try {
            doc.image('logoalvnegro.jpeg', 50, 35, { width: 85 });
        } catch (e) {
            console.log("Aviso: Logo no encontrado.");
        }

        doc.fillColor('white')
           .font('Helvetica-Bold').fontSize(24).text(nombreLigaReal, 160, 45)
           .fontSize(10).font('Helvetica').text('ADMIN. DE LIGAS DE SOFTBALL PROFESIONAL', 160, 80)
           .text('Hermosillo, Sonora | Unidad Deportiva Ley 57', 160, 95);

        doc.rect(420, 40, 140, 70).lineWidth(2).stroke('white');
        doc.fontSize(9).text('FOLIO DE RECIBO', 430, 55, { align: 'center', width: 120 });
        doc.fontSize(16).font('Helvetica-Bold').text(folio, 430, 75, { align: 'center', width: 120 });

        doc.fillColor('#f1f5f9').fontSize(100).opacity(0.1)
           .text('LEY 57', 100, 350, { rotation: -45 });
        doc.opacity(1);

        doc.fillColor('#1e3a8a').fontSize(14).font('Helvetica-Bold').text('INFORMACIÓN DEL EQUIPO', 60, 190);
        doc.rect(60, 208, 480, 1).fill('#cbd5e1');

        doc.fillColor('#334155').fontSize(11).font('Helvetica')
           .text(`EQUIPO:`, 60, 225).font('Helvetica-Bold').text(equipo.nombre.toUpperCase(), 120, 225)
           .font('Helvetica').text(`LIGA:`, 60, 245).font('Helvetica-Bold').text(equipo.liga.toUpperCase(), 120, 245)
           .font('Helvetica').text(`FECHA:`, 380, 225).font('Helvetica-Bold').text(new Date().toLocaleDateString(), 430, 225);

        const tableTop = 320;
        doc.rect(60, tableTop, 480, 30).fill('#1e3a8a');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
           .text('CONCEPTO', 75, tableTop + 10)
           .text('MÉTODO', 260, tableTop + 10)
           .text('IMPORTE ABONADO', 410, tableTop + 10);

        doc.fillColor('#1e293b').font('Helvetica').fontSize(11)
           .text('Abono a Fianza de Temporada 2026 - 1', 75, tableTop + 50)
           .text('Efectivo/Transf.', 260, tableTop + 50)
           .font('Helvetica-Bold').text(`$${abonoLimpio.toLocaleString('es-MX')}.00`, 410, tableTop + 50);
        
        doc.rect(60, tableTop + 75, 480, 1).fill('#e2e8f0');

        const summaryTop = 500;
        doc.rect(330, summaryTop, 210, 120).fill('#f8fafc').lineWidth(1).stroke('#cbd5e1');
        doc.fillColor('#64748b').fontSize(9).font('Helvetica')
           .text('TOTAL FIANZA:', 345, summaryTop + 20)
           .text('TOTAL ACUMULADO:', 345, summaryTop + 45);
        
        doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
           .text(`$${metaFianza.toLocaleString('es-MX')}.00`, 450, summaryTop + 20)
           .text(`$${equipo.totalAbonado.toLocaleString('es-MX')}.00`, 450, summaryTop + 45);

        doc.rect(345, summaryTop + 70, 180, 1).fill('#cbd5e1');
        doc.fillColor('#dc2626').fontSize(12)
           .text('SALDO REST:', 345, summaryTop + 85)
           .text(`$${saldoPendiente.toLocaleString('es-MX')}.00`, 450, summaryTop + 85);

        const footerY = 720;
        doc.fillColor('#1e3a8a').rect(80, footerY, 160, 1).fill();
        doc.rect(360, footerY, 160, 1).fill();

        doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
           .text('JAVIER YOCUPICIO', 80, footerY + 10, { width: 160, align: 'center' })
           .text('DIRECTOR DE LIGA', 80, footerY + 22, { width: 160, align: 'center' })
           .text('REPRESENTANTE', 360, footerY + 10, { width: 160, align: 'center' })
           .text('FIRMA DE CONFORMIDAD', 360, footerY + 22, { width: 160, align: 'center' });

        doc.end();

        stream.on('finish', () => {
            res.json({ 
                success: true, 
                saldo: saldoPendiente,
                totalAbonado: equipo.totalAbonado,
                folio: folio,
                pdfUrl: `https://ley57.onrender.com/recibos/${fileName}`
            });
        });

    } catch (error) {
        console.error("Error fatal en registro de pago:", error);
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