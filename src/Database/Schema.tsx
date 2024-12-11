import { Schema,  model } from "mongoose";
import { IInvoice, IProduct, ITransaction, IUser } from "./types";
import crypto from 'crypto';



// User Schema
export   const UserSchema = new Schema<IUser>({
    telegramId: { type: String, required: true, unique: true },
    referrals_uid: { type: String, default: null },
    balance: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
});

// Product Schema
export  const ProductSchema = new Schema<IProduct>({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
});

// Transaction Schema
export  const TransactionSchema = new Schema<ITransaction>({
    txhash: { type: String , unique : true },
    amount: { type: Number, required: true },
    quantity : { type: Number, required: true },
    fromAddress: { type: String  },
    toAddress: { type: String },
    payload: { type: String  },
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
    timestamp: { type: Date, default: Date.now },
});

// Invoice Schema
export  const InvoiceSchema = new Schema<IInvoice>({
    chatId: { type: String, required: true }, // reference to User
    productId:  { tyepe :String },
    address : String,
    username : String,
    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
    expires: { type: Date }, // Set manually in middleware
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
 
InvoiceSchema.pre('save', function (next) {
    if (!this.expires) {
      this.expires = new Date(this.createdAt.getTime() + 5 * 60 * 1000); // 5 minutes from createdAt
    }
    if (this.productId) {
        const  productId  = crypto.randomBytes(5).toString('hex')
    }
    next();
  });