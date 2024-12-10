
import axios from 'axios';
import { NOSQL } from 'Database';
import TelegramBot, { CallbackQuery, Message, SendMessageOptions } from 'node-telegram-bot-api';
import NodeCache from 'node-cache';
import { bot } from 'main.bot';

interface BinancePriceResponse {
    symbol: string;
    price: string;
  }

  // Initialize cache with a TTL (time-to-live) of 60 seconds
const cache = new NodeCache({ stdTTL: 60 });

  const fetchTonPrice = async (): Promise<number | null> => {
    // Check if the price is already cached
    const cachedPrice = cache.get<number>('TON_PRICE');
    if (cachedPrice) {
      console.log('Returning cached TON price.');
      return cachedPrice;
    }
  
    try {
      // Fetch the price from Binance API
      const response = await axios.get<BinancePriceResponse>('https://api.binance.com/api/v3/ticker/price', {
        params: { symbol: 'TONUSDT' },
      });
  
      // Parse the price and cache it
      const price = parseFloat(response.data.price);
      cache.set('TON_PRICE', price);
      console.log('Fetched new TON price from Binance.');
      return price;
    } catch (error) {
      console.error('Error fetching TON price:', (error as Error).message);
      return null;
    }
  }

// List of wallet addresses
const wallets = [
    'UQC9iB-II08-TibX2pFXxd_M-FAMhavwKVeJnGStPsJ6BRpE',
];

// Function to randomly select a wallet
function getRandomWallet(wallets : any[]) {
    const randomIndex = Math.floor(Math.random() * wallets.length); // Generate random index
    return wallets[randomIndex]; // Return wallet at the random index
}
 


const backButton = [
    {
        text: '↩️ Return',
        callback_data: 'main_menu', // callback_data for the back button
    }
];


// bot.sendMessage( '709148502', `Approve transfer?  To:   @mdrijonhossainjibon   Amount: ⭐️ 500` ,{  reply_markup :  { inline_keyboard: [
//     [
//       { text: '✅ Approve', callback_data: `approve_${'transferId'}` },
//       { text: '❌ Reject', callback_data: `reject_${'transferId'}` }
//     ]
//   ]} })   
//   bot.sendMessage(709148502, "Your transfer request has been sent for admin approval.");

   
 
  

export class Bot {
    private bot = bot
    private NOSQL = NOSQL

    constructor( ) {
       this.NOSQL = NOSQL
     this.initializeCommands();
    }
    
    private initializeCommands() {
        this.bot.onText(/\/start(?: (.+))?/, this.startCommand.bind(this));
        this.bot.onText(/\/referral/, this.referralCommand.bind(this));
        this.bot.onText(/\/products/, this.productsCommand.bind(this));
        this.bot.onText(/\/balance/, this.balanceCommand.bind(this));
        this.bot.onText(/\/withdraw/, this.withdrawCommand.bind(this));
        this.bot.onText(/\/buy_stars/, this.buyStarsCommand.bind(this)); // New command
        this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
        this.bot.on('message',this.handleMessage.bind(this));
        this.getBotUserame();
    }
 
    public sendMessage (chatid: TelegramBot.ChatId, text: string,options? : TelegramBot.SendMessageOptions){
        this.bot.sendMessage(chatid , text, options);
    }
    private async buyStarsCommand(msg: Message) {
        const chatId = msg.chat.id;

        this.bot.sendMessage(chatId, 'Enter the number of stars you want to buy (minimum: 50 stars):', {
            reply_markup: { force_reply: true },
        }).then((sentMessage) => {
            const replyListener = this.bot.onReplyToMessage(
                sentMessage.chat.id,
                sentMessage.message_id,
                async (reply) => {
                    const stars = parseInt(reply.text || '0', 10);

                    if (isNaN(stars) || stars < 50) {
                        this.bot.sendMessage(chatId, '⚠️ Please enter a valid number of stars (minimum: 50).');
                        return;
                    }

                    const user = await NOSQL.User.findOne({ telegramId: String(msg.from?.id) });
                    if (user) {
                        const costPerStar = 0.0027; // Example cost per star in TON
                        const totalCost = stars * costPerStar;
                        const network = 'TON';
                        const address = 'UQCDz6e7hfExr-VaDV0OJEWoAtL1q4TsNNSIRCLb2bc4K0wf'; // Example address
                        const memo = Math.floor(Math.random() * 1e10); // Generate a unique memo ID

                        // Send invoice message
                         await this.sendInvoiceWithPayUrl(chatId, msg.from?.username || 'user', stars, totalCost, network, address, memo);
                    } else {
                        this.bot.sendMessage(chatId, '⚠️ You are not registered. Please restart the bot with /start.');
                    }

                    this.bot.removeReplyListener(replyListener); // Clean up listener
                }
            );
        });
    }


     private convertToTON(usdAmount : number, tonPrice : number) {
        // Calculate the amount of TON
        const tonAmount = usdAmount / tonPrice;
        return tonAmount;
    }

    private async sendInvoiceWithPayUrl(chatId: number, username: string | undefined, stars: number, amount: number, network: "TON", address: string, memo: number) {
        // Constructing the TON payment URL
        const totalCostNanoTON = Number(amount * 1e9).toFixed(0); // Convert nanoTON to TON with 9 decimals
 
        const tonUrl = `ton://transfer/${address}?amount=${totalCostNanoTON}&text=${memo}`;

        const message = `@${username}, the invoice is valid for 30 minutes ⏳\n\n` +
            `${stars} Stars ⭐️ for the account @${username} ✨\n\n` +
            `Payment details:\n\n` +
            `Network: ${network} 🌐\n` +
            `Amount: \`${amount.toFixed(9)}\` 💰 \n` + // Convert nanoTON to TON with 9 decimals
            `Address: \`${address}\` 🏠\n\n` +  // Monospace for the address with house emoji
            `Add comment (memo) to transaction \`${memo}\` ✏️\n\n` +  // Monospace for the memo with pencil emoji
            `‼️ Send the exact (!) amount to the specified address. ⚠️ Be sure to include a comment when transferring, otherwise, the payment will not be successful. ❌\n\n` +
            `If you have any problems, please contact support 📞.`;
            await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ url: tonUrl, text: '👉 Pay In App' }, { text: '↩️ Return', callback_data: 'main_menu' }]] } });
             await this.NOSQL.Invoice.create({ chatId ,   quantity : stars ,  totalPrice : totalCostNanoTON , address , username });
             
    }

 


    private async demoproductsCommand(msg: Message) {
        const welcomeMessage = `✨ Welcome!\n\nVia this bot, you can purchase Telegram stars without KYC verification and cheaper than in the app.\n\n❗️Enter the number of stars you want to buy to continue (minimum: 50 stars):`;
    
        // Send welcome message with inline buttons and force reply
        const sentMessage  = await this.bot.sendMessage(msg.chat.id, welcomeMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⭐️ Buy Stars", callback_data: "view_products" }, backButton[0]],
                ],
                force_reply : true
            },
              
        });
    
        // Listen for the reply
        const replyListener = this.bot.onReplyToMessage(
            sentMessage.chat.id,
            sentMessage.message_id,
            async (reply) => {
                const stars = parseInt(reply.text || "0", 10);
    
                // Validate user input
                if (isNaN(stars) || stars < 50) {
                    this.bot.sendMessage(msg.chat.id, "⚠️ Please enter a valid number of stars (minimum: 50).");
                    return;
                }
    
                try {
                    // Fetch TON price in USD
                    const tonPrice = await fetchTonPrice();
                    if (!tonPrice) {
                        this.bot.sendMessage(msg.chat.id, "⚠️ Unable to fetch TON price. Please try again later.");
                        return;
                    }
    
                    const costPerStarUSD = 0.018;
                    const costPerStar = costPerStarUSD / tonPrice;
                    const totalCost = stars * costPerStar;
    
                    // Fetch user and process the purchase
                    const user = await NOSQL.User.findOne({ telegramId: String(msg.chat?.id) });
                    if (!user) {
                        this.bot.sendMessage(msg.chat.id, "⚠️ You are not registered. Please restart the bot with /start.");
                        return;
                    }
    
                    // Add purchase record to the user
                     
                    await user.save();
    
                    // Send invoice with payment URL
                    await this.sendInvoiceWithPayUrl(
                        msg.chat.id,
                        msg.chat.username as string,
                        stars,
                        totalCost,
                        "TON",
                        getRandomWallet(wallets),
                        msg.chat.id
                    );
    
                } catch (error) {
                    this.bot.sendMessage(msg.chat.id, "⚠️ An error occurred while processing your request. Please try again later.");
                    console.error("Error in processing purchase:", error);
                } finally {
                    // Remove listener after processing
                    this.bot.removeReplyListener(replyListener);
                }
            }
        );
    }
    



    private async productsCommand(msg: Message) {
        const products = await NOSQL.Product.find({});
    
        // Define emoji buttons for products with discount
        const productButtons = products.map((product) => {
            // Check if the product has a discount
            const discount = 0 ; // Assuming `product.discount` contains the discount percentage
            const discountText = discount > 0 ? `🔥`: ''; // Add discount emoji and text if applicable
    
            return {
                text: `${ product.name } ⭐️ - $${product.price}${discountText}`,
                callback_data: `buy_${product._id}`,
            };
        });
    
        // Define how many products per row (in this case, 1 product per row)
        const productsPerRow = 1;
    
        // Divide the products into multiple rows dynamically
        const keyboardLayout = [];
        for (let i = 0; i < productButtons.length; i += productsPerRow) {
            keyboardLayout.push(productButtons.slice(i, i + productsPerRow));
        }
    
        // Adding a title to the message to make it more informative
        const titleMessage = "<b> ⭐️ Buy Stars </b>";
    
        // Define the "Back" button that will send users back to the main menu
        
    
        // Combine the product buttons with the back button at the bottom
        const fullKeyboardLayout = [...keyboardLayout, backButton];
    
        // Send the message with the inline keyboard
        this.bot.sendMessage(msg.chat.id, titleMessage, {
            parse_mode: 'HTML', // Using HTML for formatting
            reply_markup: {
                inline_keyboard: fullKeyboardLayout,
            },
        });
    }
    




    private async deleteMessage(msg: Message) {
        try {
            await this.bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (error: any) {
            console.log(error.message)
        }
    }



    private async startCommand(msg: Message, match: RegExpExecArray | null) {
        const referrerId = match?.[1];
        const userId = msg.from?.id;

        if (!userId) return;  // Early exit if there's no user ID

        // Find or create the user
        let user = await NOSQL.User.findOne({ telegramId: String(userId) });
        if (!user) {
            user =  new NOSQL.User({ telegramId: String(userId) });

            // Handle referrer logic if available
            if (referrerId) {
                const referrer = await NOSQL.User.findOne({ telegramId: referrerId });
                if (referrer) {
                    referrer.referrals_uid = user.telegramId;  // Add user to referrer's referrals list
                    await referrer.save();
                }
            }
            await user.save();
        }

        // Send welcome message and prompt for star purchase
        const welcomeMessage = `✨ Welcome!\n\nVia this bot you can purchase Telegram stars without KYC verification and cheaper than in the app.\n\n❗️Enter the number of stars you want to buy to continue (minimum: 50 stars):`;
        const sentMessage = await this.bot.sendMessage(msg.chat.id, welcomeMessage, {
            reply_to_message_id : msg.message_id, reply_markup : { inline_keyboard :  [ [{ text: "⭐️ Buy Stars", callback_data: "view_products" } , backButton[0] ] ] , force_reply : true }
        });


         // Listen for the reply to the message
         const replyListener = this.bot.onReplyToMessage(
            sentMessage.chat.id,
            sentMessage.message_id,
            async (reply) => {
                const stars = parseInt(reply.text || '0', 10);

                // Validate the stars input
                if (isNaN(stars) || stars < 50) {
                    this.bot.sendMessage(msg.chat.id, '⚠️ Please enter a valid number of stars (minimum: 50).');
                    return;
                }

                // TON price in USD
                const tonPrice = await fetchTonPrice() || 0; // Price of 1 TON in USD
                const costPerStarUSD = 0.018; // USD price per star (50 stars = 0.80 USD)

                // Calculate cost per star in TON
                const costPerStar = costPerStarUSD / tonPrice;  // Price of one star in TON

                // Calculate total cost in TON
                const totalCost = stars * costPerStar;

                // Find user again and process purchase
                const user = await NOSQL.User.findOne({ telegramId: String(msg.from?.id) });
                if (user) {
                    // Add purchase record to the user
                    
                    await user.save();

                    // Send invoice with payment URL
                    await this.sendInvoiceWithPayUrl( msg.chat.id,  msg.chat.username as string, stars, totalCost, 'TON', getRandomWallet(wallets), msg.chat.id );
                } else {
                    this.bot.sendMessage(msg.chat.id, '⚠️ You are not registered. Please restart the bot with /start.');
                }

                // Remove reply listener after processing the response
                this.bot.removeReplyListener(replyListener);
            }
        );
       
    }



    private async showMainMenu(msg: Message) {
        const mainMenuKeyboard = [
            [
                { text: "🔑 User Account", callback_data: "user_account" },
                { text: "⚙️ Settings", callback_data: "settings" },
            ],
            [
                { text: "⭐️ Buy Stars", callback_data: "view_products" },
                { text: "🧾 Invoice History", callback_data: "invoice_history" },  // Invoice History Button
            ],
            backButton
        ];



        // Send the main menu with the Invoice History option
        this.bot.sendMessage(msg.chat.id, "Welcome to the Main Menu! Choose an option:", {
         
            reply_markup: {
                inline_keyboard: mainMenuKeyboard,
            }
        });
    }







    private async showInvoiceHistory(msg: Message) {
        // Example invoice data (this can be fetched from a database)
        const invoices = await this.NOSQL.Invoice.find({ chatId: msg.chat.id });
      
        // Create inline keyboard buttons for each invoice
        const invoiceKeyboard = invoices.map((invoice) => {
            let statusEmoji = '';
            
            // Add emojis based on the invoice status
            switch (invoice.status) {
                case 'paid':
                    statusEmoji = '✅'; // Green check for paid invoices
                    break;
                case 'pending':
                    statusEmoji = '⏳'; // Hourglass for pending invoices
                    break;
                case 'cancelled':
                    statusEmoji = '❌'; // Cross for cancelled invoices
                    break;
                default:
                    statusEmoji = '⚪'; // Default (neutral) emoji
            }
    
            return {
                text: `🌟 ${invoice.quantity} ${statusEmoji}`,
                callback_data: `invoice_${invoice.id}`,
            };
        });
    
        // Add the back button
        const keyboard = [
            ...invoiceKeyboard, // Append the invoice buttons
           
        ];
    
        // Send the invoice list with buttons to the user
        this.bot.sendMessage(msg.chat.id, "Here is your invoice history:", {
            reply_markup: {
                inline_keyboard: [keyboard  ,  backButton ], // Wrap the entire keyboard in an array
            },
        });
    }
    




    private async showInvoiceDetails(msg: Message, invoiceId: string) {
        // Fetch invoice details based on the invoice ID
        const invoices = [
            {
                id: "INV12345",
                date: "2024-12-09",
                amount: "$50.00",
                status: "Paid",
                description: "Subscription for December"
            },
            {
                id: "INV12346",
                date: "2024-11-25",
                amount: "$75.00",
                status: "Unpaid",
                description: "Product Purchase"
            }
        ];

        const invoice = invoices.find(i => i.id === invoiceId);

        if (invoice) {
            // Send the invoice details to the user
            this.bot.sendMessage(msg.chat.id,
                `Invoice ID: ${invoice.id}\nDate: ${invoice.date}\nAmount: ${invoice.amount}\nStatus: ${invoice.status}\nDescription: ${invoice.description}`);
        } else {
            this.bot.sendMessage(msg.chat.id, "Invoice not found.");
        }
    }




    private async referralCommand(msg: Message) {
        const referralLink = `https://t.me/${'this.options.username'}?start=${msg.from?.id}`;
        this.bot.sendMessage(msg.chat.id, `Share your referral link: ${referralLink}`);
    }

    // private async productsCommand(msg: Message) {
    //     const products = await Product.find({});
    //     const buttons = products.map((product) => ({
    //         text: `${product.name} - $${product.price}`,
    //         callback_data: `buy_${product._id}`,
    //     }));

    //     this.bot.sendMessage(msg.chat.id, 'Choose a product:', {
    //         reply_markup: { inline_keyboard: [buttons] },
    //     });
    // }








    private async handleUserAccount(msg: Message) {
        // Retrieve user data from your database or session
        const userId = msg.chat.id;  // Telegram user ID
        const user = await NOSQL.User.findOne({ telegramId: userId });
 
        // If the user does not exist in the database
        if (!user) {
            this.bot.sendMessage(msg.chat.id, "Sorry, we couldn't find your account. Please register first.");
            return;
        }

        // Create a message with the user's account information in HTML format
        const accountInfo = `
            <b>🔑 Your User Account</b>:
            \n<b>👤 Username</b>: ${msg.chat.username || 'N/A'}
            \n<b>📧 Email</b>: ${'N/A'}
            \n<b>🔢 Account Level</b>: ${0}
            \n<b>⚙️ Status</b>: ${'N/A'}
            \n<b>🔗 Referral UID</b>: ${'N/A'}
        `;



        // Combine the product buttons with the back button at the bottom
        const fullKeyboardLayout = [backButton];

        // Send the account details in HTML format with an inline keyboard
        this.bot.sendMessage(msg.chat.id, accountInfo, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: fullKeyboardLayout }
        });
    }



    private async balanceCommand(msg: Message) {
        const user = await NOSQL.User.findOne({ telegramId: String(msg.from?.id) });
        if (user) {
            this.bot.sendMessage(msg.chat.id, `Your balance is: $${user.balance}`);
        } else {
            this.bot.sendMessage(msg.chat.id, 'You are not registered.');
        }
    }

    private async withdrawCommand(msg: Message) {
        const user = await NOSQL.User.findOne({ telegramId: String(msg.from?.id) });
        if (user && user.balance >= 10) {
            user.balance = 0;
            await user.save();
            this.bot.sendMessage(msg.chat.id, 'Your withdrawal request has been submitted.');
        } else {
            this.bot.sendMessage(msg.chat.id, 'You need at least $10 to withdraw.');
        }
    }

    private async getBotUserame() {
        ///console.log(await this.bot.getMe())
    }


    private async handleCallbackQuery(query: CallbackQuery) {
        const chatId = query.message?.chat.id;
        const data = query.data;
        const msg = query.message;

        if (!chatId || !data) return;

        if (data.startsWith('buy_')) {
            const productId = data.split('_')[1];
            const product = await NOSQL.Product.findById(productId);

            if (product) {
                const user = await NOSQL.User.findOne({ telegramId: String(query.from.id) });
                if (user) {
                     
                    const amount = Number(product.name.split(' ')[0]);
                    const selectedWallet = getRandomWallet(wallets);
                    const tonPrice = await fetchTonPrice();
                    if (tonPrice === null) return;
                    const ton = this.convertToTON(product.price , tonPrice as number)

                    this.sendInvoiceWithPayUrl(chatId,msg?.chat.username,amount, ton ,'TON' , selectedWallet , chatId);
                }
            }
        }

        if (data === 'main_menu') {

            await this.deleteMessage(msg as any)
            await this.showMainMenu(msg as any);  // Show the main menu
        }
        if (data === 'user_account') {
            await this.deleteMessage(msg as any)
            await this.handleUserAccount(msg as any);  // Show the main menu
        }
        if (data === 'view_products') {
            await this.deleteMessage(msg as any)
            await this.demoproductsCommand(msg as any)
        }

        if (data.startsWith('invoice_')) {
            const invoiceId = data.split('_')[1];  // Extract invoice ID
            await this.showInvoiceHistory(msg as any );
        }

        
  
        if (data.startsWith('approve_')) {
            const txhash = data.split('_')[1];  // Extract invoice ID
           
            const tx = await this.NOSQL.Transaction.findOne({ txhash });
            if (!tx)  return;
            await this.deleteMessage(msg as any);
            tx.status = 'paid';
            await tx.save()
            bot.sendMessage(tx.payload, `✅ Your transfer of ⭐️ ${tx.quantity} to <a href="tg://user?id=${tx.payload}">${tx.payload}</a> has been approved.`, { parse_mode: 'HTML' , reply_markup : { inline_keyboard : [backButton]} });
            await bot.sendMessage(chatId ,`✅ Request ID \`${tx.id}\` has been approved.` ,{ reply_markup : { inline_keyboard : [ backButton ]}});
        }

        if (data.startsWith('reject_')) {
            const txhash = data.split('_')[1];  // Extract invoice ID
           
            const tx = await this.NOSQL.Transaction.findOne({ txhash });
            if (!tx)  return;
            tx.status = 'cancelled';
            await tx.save()
            await this.deleteMessage(msg as any);
            await bot.sendMessage(tx.payload ,`❌ Request ID\`${tx.id}\` has been approved.` ,{ reply_markup : { inline_keyboard : [ backButton ]}});
            await bot.sendMessage(chatId ,`❌ Request ID\`${tx.id}\` has been approved.` ,{ reply_markup : { inline_keyboard : [ backButton ]}});
        }
  
    } 



    private async handleMessage (msg : Message){
         // console.log(msg)
    }
}

 