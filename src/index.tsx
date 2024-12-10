import { config } from 'dotenv';
import mongoose from 'mongoose';
import { Bot } from './bot';
import TonWeb from 'tonweb';
import axios from 'axios';
import { NOSQL } from 'Database';
import './cron';
config();


const mongoURI = 'mongodb://localhost:27017/tg-star';

mongoose.connect(mongoURI).then(() => {
    console.log('Database connected');
    new Bot()// Initialize bot
}).catch((err) => console.error('Database connection error:', err));


const walletAddress = 'UQC9iB-II08-TibX2pFXxd_M-FAMhavwKVeJnGStPsJ6BRpE';


 


function convertToTON(usdAmount : number, tonPrice : number) {
    // Calculate the amount of TON
    const tonAmount = usdAmount / tonPrice;
    return tonAmount;
}

