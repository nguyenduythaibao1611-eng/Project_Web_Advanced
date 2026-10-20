const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const routes = require('./routes');

const app = express();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình View Engine (EJS) và Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Mở thư mục public để chứa CSS/JS
app.use(express.static(path.join(__dirname, 'public')));

// Gắn toàn bộ Routes
app.use('/', routes);

module.exports = app;