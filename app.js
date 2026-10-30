require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const { checkUser } = require('./middlewares/authMiddleware');
const routes = require('./routes');

const app = express();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Cấu hình View Engine (EJS) và Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Mở thư mục public để chứa CSS/JS
app.use(express.static(path.join(__dirname, 'public')));

// Gán thông tin người dùng đăng nhập vào res.locals và req.user
app.use(checkUser);

// Gắn toàn bộ Routes
app.use('/', routes);

module.exports = app;