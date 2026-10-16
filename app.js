const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const movieRoutes = require('./routes/movieRoutes');

const app = express();

// Cấu hình View Engine (EJS) và Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Mở thư mục public để chứa CSS/JS
app.use(express.static(path.join(__dirname, 'public')));

// Gắn Route (Giữ gốc '/' để link /popular hoạt động như bạn đã test)
app.use('/', movieRoutes);

module.exports = app;