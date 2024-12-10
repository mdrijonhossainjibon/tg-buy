import mongoose, { model } from "mongoose";
import { InvoiceSchema, ProductSchema, TransactionSchema, UserSchema } from "./Schema";
import { IInvoice, IProduct, ITransaction, IUser } from "./types";

 

// Model definitions
const User = model<IUser>("User", UserSchema);
const Product = model<IProduct>("Product", ProductSchema);
const Transaction = model<ITransaction>("Transaction", TransactionSchema);
const Invoice = model<IInvoice>("Invoice", InvoiceSchema);

export const NOSQL = { User, Product, Transaction, Invoice };
 