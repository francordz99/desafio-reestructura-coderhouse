import mongoose, { Schema } from 'mongoose';

const productsCollection = "products";

const productSchema = new Schema({
    title: String,
    description: String,
    price: Number,
    thumbnail: String,
    code: String,
    stock: Number,
    category: String
});

const ProductModel = mongoose.model(productsCollection, productSchema);

export default ProductModel;
