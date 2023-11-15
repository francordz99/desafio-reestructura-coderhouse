import express from 'express';
import session from 'express-session';
import FileStore from 'session-file-store';
import { engine } from 'express-handlebars';
import ProductManager from './dao/filesystem/ProductManager.js';
import bodyParser from 'body-parser';
import cartFunctions from './dao/filesystem/cartFunctions.js';
import http from 'http';
import socketIo from 'socket.io';
import mongoose from 'mongoose';
import { connectDB } from './src/config/dbConnect';
import ProductsManager from './dao/mongodb/productManager.js';
import MessageManager from './dao/mongodb/messageManager.js';
import { CartManager } from './dao/mongodb/cartManager.js';
import ProductModel from './dao/models/productModel.js';
import { viewsRouter } from './src/routes/views.routes.js';
import { sessionsRouter } from './src/routes/sessions.routes.js';
import bcrypt from 'bcrypt';
import passport from 'passport';
import { initializePassport } from './src/config/passport.config.js';
import { config } from './src/config/config.js';
import path from 'path';

const app = express();
const port = 8080;
const server = http.createServer(app);
const io = socketIo(server);
const cartRouter = express.Router();

import productRoutes from './src/routes/products.routes';
import cartsRoutes from './src/routes/carts.routes.js';
import messageRoutes from './src/routes/messages.routes';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/api/carts', cartRouter);
app.use('/products', productRoutes);
app.use('/carts', cartsRoutes);
app.use(bodyParser.json());

app.engine('.hbs', engine({ extname: '.hbs' }));
app.set('view engine', '.hbs');
app.set('views', './views');

// MongoDB

connectDB();

// Conexion Session / MongoStore

const fileStorage = FileStore(session);

app.use(session({
    store: MongoStore.create({
        ttl: 60,
        mongoUrl: config.mongo.url,
        retries: 0,
    }),
    secret: config.server.secretSession,
    resave: true,
    saveUninitialized: true
}));

// Passport

initializePassport();
app.use(passport.initialize());
app.use(passport.session());

// Socket IO

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('addProduct', (product) => {
        try {
            const productManager = new ProductManager('./dao/filesystem/products.json');
            productManager.addProduct(product);

            io.emit('updateProducts');
        } catch (error) {
            console.error(error);
        }
    });

    socket.on('deleteProduct', (productId) => {
        try {
            const productManager = new ProductManager('./dao/filesystem/products.json');
            productManager.deleteProduct(productId);

            io.emit('updateProducts');
        } catch (error) {
            console.error(error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Rutas Handlebars

app.get('/', async (req, res) => {
    try {
        const productsManager = new ProductsManager();
        const products = await productsManager.readProductsFromDatabase();
        res.render('products', { products });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).send('Error interno del servidor');
    }
});

app.use(viewsRouter);
app.use("/api/sessions", sessionsRouter);

app.get("/carts", (req, res) => {
    res.render('carts');
});

// Rutas mensajes

app.get('/api/messages', async (req, res) => {
    try {
        const messages = await messageManager.getAllMessages();
        res.json(messages);
    } catch (error) {
        res.status(500).send('Error al obtener los mensajes.');
    }
});

app.post('/api/messages', async (req, res) => {
    const { sender, message } = req.body;
    try {
        await messageManager.addMessage(sender, message);
        res.status(201).send('Mensaje agregado correctamente.');
    } catch (error) {
        res.status(500).send('Error al agregar el mensaje.');
    }
});

// Rutas de products

app.get('/products', async (req, res) => {
    try {
        const productManager = new ProductsManager();
        const { limit } = req.query;
        const products = await productManager.getProducts();

        if (limit) {
            const limitedProducts = products.slice(0, parseInt(limit));
            res.json(limitedProducts);
        } else {
            res.json(products);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los productos.' });
    }
});

app.get('/products/:pid', async (req, res) => {
    try {
        const productManager = new ProductsManager();
        const { pid } = req.params;
        const product = await productManager.getProductById(parseInt(pid));

        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ error: 'Producto no encontrado o inexistente.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el producto.' });
    }
});

app.post('/products', async (req, res) => {
    try {
        const productManager = new ProductsManager();
        const { title, description, code, price, stock, category, thumbnails } = req.body;

        if (!title || !description || !code || !price || !stock || !category) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
        }

        const newProduct = {
            title,
            description,
            code,
            price: Number(price),
            status: true,
            stock: Number(stock),
            category,
            thumbnails: thumbnails || [],
        };

        await productManager.addProduct(newProduct);

        io.emit('updateProducts');

        res.status(201).json({ message: 'Producto agregado con éxito.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al agregar el producto.' });
    }
});

app.put('/products/:pid', async (req, res) => {
    try {
        const productManager = new ProductsManager();
        const { pid } = req.params;
        const updatedFields = req.body;

        const product = await productManager.getProductById(parseInt(pid));

        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado o inexistente.' });
        }

        delete updatedFields.id;

        await productManager.updateProduct(parseInt(pid), updatedFields);
        io.emit('updateProducts');
        res.json({ message: 'Producto actualizado con éxito.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el producto.' });
    }
});

app.delete('/products/:pid', async (req, res) => {
    try {
        const productManager = new ProductsManager();
        const { pid } = req.params;

        const product = await productManager.getProductById(parseInt(pid));

        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado o inexistente.' });
        }

        await productManager.deleteProduct(parseInt(pid));

        io.emit('updateProducts');
        res.json({ message: 'Producto eliminado con éxito.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar el producto.' });
    }
});

// Rutas del carrito

cartRouter.post('/', (req, res) => {
    try {

        const newCart = {
            products: []
        };

        addCartToStorage(newCart);

        io.emit('updateCarts');

        res.status(201).json({ message: 'Carrito creado con éxito.', cart: newCart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el carrito.' });
    }
});

cartRouter.get('/:cid', (req, res) => {
    try {
        const { cid } = req.params;
        const cart = cartFunctions.getCartById(cid);

        if (!cart) {
            return res.status(404).json({ error: 'Carrito no encontrado o inexistente.' });
        }

        res.json(cart.products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los productos del carrito.' });
    }
});

cartRouter.post('/:cid/product/:pid', (req, res) => {
    try {
        const { cid, pid } = req.params;

        cartFunctions.addProductToCart(cid, pid);
        io.emit('updateCarts');

        res.json({ message: 'Producto agregado al carrito con éxito.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al agregar el producto al carrito.' });
    }
});

// Arrancar el server
server.listen(port, () => {
    console.log(`Servidor Express escuchando en el puerto ${port}`);
});

export { ProductsManager, MessageManager, CartManager };
