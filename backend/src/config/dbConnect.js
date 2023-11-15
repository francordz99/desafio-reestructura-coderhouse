import mongoose from 'mongoose';
import { config } from './config';

const connectDB = async () => {
    try {
        await mongoose.connect(config.mongo.url);
        console.log("Base de datos conectada");
    } catch (error) {
        console.log(`Error Al Conectar A MongoDB ${error.message}`);
    }
}

export { connectDB };


