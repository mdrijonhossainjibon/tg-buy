import { Document } from "mongoose";

// User Schema Interface
export  interface IUser extends Document {
    telegramId: string;
    referrals_uid: string | null;
    balance: number;
    timestamp: Date;
}

// Product Schema Interface
export  interface IProduct extends Document {
    name: string;
    price: number;
    timestamp: Date;
}

// Transaction Schema Interface
export  interface ITransaction extends Document {
    txhash?: string;
    amount: number;
    quantity : number;
    fromAddress: string;
    toAddress: string;
    payload: string;
    status: 'pending' | 'paid' | 'cancelled';
    timestamp: Date;
}

// Invoice Schema Interface
export  interface IInvoice extends Document {
    chatId: string; // reference to User
    productId: string | null;
    username : string;
    address : string;
    quantity: number;
    totalPrice: number;
    status: 'pending' | 'paid' | 'cancelled';
    expires: Date;
    createdAt: Date;
    updatedAt: Date;
}