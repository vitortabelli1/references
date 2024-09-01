exports.renderHomePage = (req, res) => {
    res.render('index', { title: 'Home Page', admin: 'admin', message: 'Hello from EJS!' });
  };
  