const express = require('express');
const router = express.Router();
const exampleController = require('../controllers/exampleController');

// Rota para a página inicial
router.get('/', exampleController.renderHomePage);

module.exports = router;
