const express = require('express');
const path = require('path');
const pool = require('./config/database');
const session = require('express-session');
const QRCode = require('qrcode'); // Certifique-se de instalar o pacote QRCode
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Configurando a view engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Servindo arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota para a página principal
app.get('/', async (req, res) => {
  if (req.session.user) {
    try {
      const result = await pool.query('SELECT * FROM comercial WHERE usuario = $1', [req.session.user]);
      if (result.rows.length > 0) {
        const comercialData = result.rows[0];
        // Renderizar a página principal com o nome do usuário
        res.render('index', { usuario: comercialData.usuario });
      } else {
        res.redirect('/login');
      }
    } catch (err) {
      console.error('Erro ao consultar o banco de dados:', err);
      res.status(500).send('Erro ao consultar o banco de dados');
    }
  } else {
    res.redirect('/login');
  }
});

app.get('/produtos', (req, res) => {
  res.sendFile(path.join(__dirname, 'produtos.json'));
});

app.get('/analise', (req, res) => {
  if (req.session.user) {
    res.render('analise', { mensagem: null, qrCodeUrl: null, usuario: req.session.user, skuValidationData: [] });
  } else {
    res.redirect('/login');
  }
});

app.post('/analise', async (req, res) => {
  const { sku } = req.body;
  const usuarioLogado = req.session.user; // Obtém o usuário logado

  if (!usuarioLogado) {
    return res.redirect('/login'); // Redireciona se não houver usuário logado
  }

  try {
    // Consultar a tabela logs4 para verificar se o SKU pertence ao usuário logado
    const logs4Result = await pool.query(
      'SELECT * FROM logs4 WHERE sku = $1 AND usuario = $2',
      [sku, usuarioLogado]
    );

    let mensagem = 'SKU inválido';
    let qrCodeUrl = null;
    let skuValidationData = []; // Inicializa a variável para garantir que sempre exista

    if (logs4Result.rows.length > 0) {
      // SKU pertence ao usuário logado, verificar se é válido
      mensagem = 'Usuário autenticado';

      // Gerar QR Code se SKU for válido
      const qrCodeData = `SKU: ${sku}`;
      qrCodeUrl = await QRCode.toDataURL(qrCodeData);

      // Inserir na tabela sku_validation2
      await pool.query(
        'INSERT INTO sku_validation2 (usuario, sku, acao) VALUES ($1, $2, $3)',
        [usuarioLogado, sku, 'Autenticado']
      );

      // Consultar a tabela sku_validation3
      const skuValidation3Result = await pool.query('SELECT * FROM sku_validation3');
      skuValidationData = skuValidation3Result.rows; // Preenche a variável com os dados da tabela
    }

    // Renderiza a view com os dados necessários
    res.render('analise', { mensagem, qrCodeUrl, usuario: usuarioLogado, skuValidationData });
  } catch (err) {
    console.error('Erro ao consultar o banco de dados:', err);
    res.render('analise', { mensagem: 'Erro ao consultar o banco de dados', qrCodeUrl: null, usuario: usuarioLogado, skuValidationData: [] });
  }
});

app.get('/login', async (req, res) => {
  try {
    let qrCodeUrl = '';
    let qrCodeData = '';
    if (req.session.user) {
      const result = await pool.query('SELECT * FROM comercial WHERE usuario = $1', [req.session.user]);
      if (result.rows.length > 0) {
        const comercialData = result.rows[0];
        qrCodeData = `SKU: ${comercialData.sku}`;
        qrCodeUrl = await QRCode.toDataURL(qrCodeData);
      }
    }
    res.render('login', { comercial: [], error: null, qrCodeUrl, qrCodeData });
  } catch (err) {
    console.error('Erro ao consultar o banco de dados:', err);
    res.status(500).send('Erro ao consultar o banco de dados');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM comercial WHERE usuario = $1 AND senha = $2', [username, password]);
    if (result.rows.length > 0) {
      req.session.user = username;
      const userId = result.rows[0].id;

      // Inserir registro na tabela logs4
      await pool.query(
        'INSERT INTO logs4 (comercial_id, usuario, cliente, sku, acao) VALUES ($1, $2, $3, $4, $5)',
        [userId, username, result.rows[0].cliente, result.rows[0].sku, 'Autenticado']
      );

      // Redirecionar para a página principal após o login bem-sucedido
      res.redirect('/');
    } else {
      res.render('login', { error: 'Usuário ou senha incorretos.' });
    }
  } catch (err) {
    console.error('Erro ao processar o login:', err);
    res.status(500).send('Erro ao processar o login');
  }
});

app.get('/relacoes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM produtos');
    res.render('relacoes', { usuario: 'Admin', produtos: result.rows });
  } catch (err) {
    console.error('Erro ao consultar o banco de dados:', err);
    res.status(500).send('Erro ao consultar o banco de dados');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
