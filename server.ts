import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simulação de Banco de Dados (em memória para este exemplo)
  // Em um app real, usaríamos Firestore ou um DB SQL.
  let db = {
    usuarios: [
      { login: "admin", senha: "123", nome: "Administrador", perfil: "admin", ativo: true },
      { login: "operador1", senha: "123", nome: "Operador 01", perfil: "operador", ativo: true }
    ],
    motoboys: [],
    relatorio_semanal: [],
    pagamentos: []
  };

  // --- API ROUTES ---

  app.post("/api/login", (req, res) => {
    const { login, senha } = req.body;
    const user = db.usuarios.find(u => u.login === login && u.senha === senha);
    
    if (!user) return res.json({ ok: false, msg: "Usuário ou senha incorretos." });
    if (!user.ativo) return res.json({ ok: false, msg: "Usuário inativo." });

    res.json({
      ok: true,
      user: { login: user.login, nome: user.nome, perfil: user.perfil }
    });
  });

  app.get("/api/motoboys", (req, res) => {
    res.json(db.motoboys);
  });

  app.post("/api/motoboys", (req, res) => {
    const motoboy = req.body;
    db.motoboys.push({ ...motoboy, ativo: true, atualizadoEm: new Date().toISOString() });
    res.json({ ok: true });
  });

  app.get("/api/available-weeks", (req, res) => {
    const weeks = [...new Set(db.pagamentos.map(p => p.weekId))];
    res.json(weeks);
  });

  app.get("/api/payments", (req, res) => {
    const { weekId, login, perfil } = req.query;
    let filtered = db.pagamentos.filter(p => p.weekId === weekId);
    
    if (perfil !== "admin") {
      filtered = filtered.filter(p => p.loginResponsavel === login);
    }
    
    res.json(filtered);
  });

  app.post("/api/import", (req, res) => {
    const { payload, user } = req.body;
    const { weekId, rows } = payload;

    // Remove registros anteriores do usuário (ou tudo se admin)
    db.pagamentos = db.pagamentos.filter(p => {
      const isWeek = p.weekId === weekId;
      const isOwner = user.perfil === "admin" || p.loginResponsavel === user.login;
      return !(isWeek && isOwner);
    });

    rows.forEach(r => {
      const motoboy = db.motoboys.find(m => m.id === r.id || m.nome === r.nome);
      db.pagamentos.push({
        weekId,
        id: r.id,
        nome: r.nome,
        pix: motoboy?.pix || "",
        valorPagar: r.valorEntregas,
        status: "PENDENTE",
        pagoEm: "",
        pagoPor: "",
        loginResponsavel: user.login,
        nomeResponsavel: user.nome
      });
    });

    res.json({ ok: true });
  });

  app.post("/api/set-paid", (req, res) => {
    const { weekId, id, status, user } = req.body;
    const pay = db.pagamentos.find(p => p.weekId === weekId && p.id === id);

    if (!pay) return res.status(404).json({ ok: false, msg: "Não encontrado" });
    
    if (user.perfil !== "admin" && pay.loginResponsavel !== user.login) {
      return res.status(403).json({ ok: false, msg: "Acesso negado" });
    }

    pay.status = status;
    pay.pagoEm = status === "PAGO" ? new Date().toISOString() : "";
    pay.pagoPor = status === "PAGO" ? user.nome : "";

    res.json({ ok: true });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
