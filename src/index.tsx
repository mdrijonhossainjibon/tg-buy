import { config } from 'dotenv';
import mongoose from 'mongoose';
import { Bot } from './bot';
import express, { Request, Response } from 'express';
import NodeCache from 'node-cache';
import cors from 'cors';
import './cron';
import { NOSQL } from 'Database';
config();

// Create a new NodeCache instance with default options
const cache = new NodeCache({ stdTTL: 5, checkperiod: 3 });
const mongoURI = 'mongodb+srv://admin:admin@atlascluster.nei8u.mongodb.net/tg-star';

mongoose.connect(mongoURI).then(() => { console.log('Database connected'); new Bot() }).catch((err) => console.error('Database connection error:', err));

const app = express();
app.use(express.json());
app.use(cors());
app.get('/api/users', async (req: Request, res: Response): Promise<any> => {
    // Check if the list of users is already in the cache
    const cachedUsers = cache.get('users');
    if (cachedUsers) {
      console.log('Cache hit');
      return res.status(200).json(cachedUsers); // Return cached users
    }
  
    try {
      // If not found in cache, fetch all users from the database
      const users = await NOSQL.User.find();
  
      // If no users are found
      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'No users found' });
      }
  
      // Cache the list of users (e.g., for 100 seconds)
      cache.set('users', users);
  
      console.log('Cache miss   nnn');
      return res.status(200).json(users); // Return users from DB
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error' });
    }
  });
  
 
app.get('/api/users/:id', async (req: Request, res: Response) : Promise<any> => {
    const userId = req.params.id;
  
    // First, check if the user data is in the cache
    const cachedUser = cache.get(userId);
    if (cachedUser) {
      console.log('Cache hit');
      return res.status(200).json(cachedUser); // Return cached user
    }
  
    try {
      const user = await NOSQL.User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Cache the user data (e.g., for 100 seconds)
      cache.set(userId, user);
  
      console.log('Cache miss');
      return res.status(200).json(user); // Return user from DB
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error' });
    }
  });


  app.post('/identity/sessions' ,(rq , rep) =>{
    rep.json({
        "api-version": "2.0",
        statusCode: 200,
        message: { success: 'page.header.signUp.message.success' },
 
    });
  })
 
app.listen(8080, () => {
  console.log(`Server is running on http://localhost:${8080}`);
});