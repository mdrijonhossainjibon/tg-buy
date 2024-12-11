import axios from 'axios';


import { NOSQL } from 'Database';
import { IInvoice } from 'Database/types';
import { bot } from 'main.bot';
import NodeCache from 'node-cache';
import cron from 'node-cron';
import { SendMessageOptions } from 'node-telegram-bot-api';
import TonWeb from 'tonweb';

const tonweb = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC'));

const myCache = new NodeCache({ stdTTL: 60 * 5  ,checkperiod : 5 });


cron.schedule('*/3 * * * * *', async () => {
    console.log('Running scheduled task to check expired invoices...');

    try {
        // Check cache first for pending invoices
        let pendingInvoices : any[] | undefined = myCache.get('pendingInvoices');

        if (!pendingInvoices) {
            console.log('Cache miss: Fetching pending invoices from database...');

            // Find all invoices that are still pending
            pendingInvoices = await NOSQL.Invoice.find({ status: 'pending' });

            if (!pendingInvoices || pendingInvoices.length === 0) {
                console.log('No pending invoices found.');
                return;
            }
            const invoicesPlain = pendingInvoices.map(invoice => invoice.toObject());
            // Store the invoices in cache for future use (expires in 30 minutes)
            myCache.set('pendingInvoices', invoicesPlain);
        } else {
            console.log('Cache hit: Using cached pending invoices.');
        }

        // Loop through each pending invoice
        for (const invoice of pendingInvoices) {
            if (new Date(invoice.expires) < new Date()) {
               
                await NOSQL.Invoice.findOneAndUpdate({ _id : invoice._id  } ,{ status : 'cancelled'  , updatedAt : new Date()  } ,{ new : true });
                console.log(`Invoice ${invoice._id} has expired and marked as cancelled.`);
            } else {
                // Process pending transactions
                await PendingTX(invoice);
                console.log(`Processing pending transaction for invoice ${invoice._id}.`);
            }
        }
    } catch (error) {
      console.log(error)
    }
});


const PendingTX = async (invoice: IInvoice) => {
    try {
        const transactions = await tonweb.getTransactions(invoice.address, 5);

        for (let tx of transactions) {
            const type = tx.in_msg.msg_data['@type'];
            const text = tx.in_msg.msg_data.text;
            const amount = tx.in_msg.value;
            const txhash = tx.transaction_id.hash;
            const fromAddress = tx.in_msg.source;
            const toAddress = tx.in_msg.destination;
            const payload = decoded(type, text);

            // Validate the amount
            if (Number(amount) !== invoice.totalPrice) {
                console.log(`Transaction ${txhash} does not meet the required amount of ${invoice.totalPrice} TON. Skipping...`);
                continue;
            }

            // Validate payload
            if (invoice.chatId !== payload) {
                console.log(`Payload mismatch for transaction ${txhash}. Skipping...`);
                continue;
            }

            // Fetch wallet data
            const response = await axios.get(`https://api.ton.cat/v2/contracts/address/${toAddress}`);
            const wallet = response.data.wallet;
            const rev = wallet.alternative_addresses[wallet.contract];

            if (rev === invoice.address) {
                const existingTransaction = await NOSQL.Transaction.findOne({ txhash });
                if (!existingTransaction) {
                    console.log(`New deposit detected for txhash: ${txhash}`);

                    const newTransaction = await NOSQL.Transaction.create({
                        txhash,
                        amount: tonweb.utils.fromNano(amount),
                        fromAddress,
                        toAddress,
                        payload,
                        status: 'pending',
                        quantity: invoice.quantity,
                    });

                    sendTransactionHash(payload as string, txhash);
                    sendApprovalRequest('1997564705', newTransaction.txhash as string, `User wants to buy ${invoice.quantity} stars ⭐️✨`, invoice.username);
                    handleReferral(payload as any, tonweb.utils.fromNano(amount) , invoice.quantity );
                    invoice.status = 'paid';
                    await invoice.save();
                } else {
                    console.log(`Transaction ${txhash} already exists in the database.`);
                }
            }
        }
    } catch (error) {
        console.error('Error in PendingTX:', error);
    }
};



export async function handleReferral(newUserId: number, amount: string , starsBought : number) {
    try {
      const user = await NOSQL.User.findOne({ telegramId: newUserId });

      if (!user) {
        console.error("User not found");
        return;
      }
  
      const referrer = await NOSQL.User.findOne({ telegramId : user.referrals_uid });
   

      if (!referrer) {
        console.error("Referrer not found");
        return;
      }
  
      // Calculate 10% bonus
      const bonus = parseFloat(amount) * 0.1;
  
      // Add bonus to referrer's account balance
      referrer.balance = (referrer.balance || 0) + bonus; // Assuming `balance` field exists
      await referrer.save();
  
     const usersinfo =  await bot.getChat(newUserId)
      // Send message to referrer
      bot.sendMessage( referrer.telegramId as any,  `💸 Your Frinds @${usersinfo.username || usersinfo.first_name } bought  ${starsBought.toFixed(2)} ⭐! A commission of  10% has been applied to your referrer's balance.`);
      bot.sendMessage( newUserId as any,  `💬 You bought  ${starsBought.toFixed(2)} ⭐! Thank you for your purchase!` );
    } catch (error) {
      console.error("Error handling referral:", error);
    }
  }
    

async function sendTransactionHash(chatId: string, txHash: string) {
    try {
        const messageText = `🔗 *Transaction Hash*: \`${txHash}\`\n\n✅ Click the button below to view the transaction on the blockchain explorer.`;

        const options: SendMessageOptions = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '🌐 View Transaction',
                            url: `https://tonviewer.com/transaction/${txHash}`
                        }
                    ]
                ]
            }
        };

        await bot.sendMessage(chatId, messageText, options);
        console.log('Transaction hash message sent successfully.');
    } catch (error) {
        console.error('Error sending transaction hash:', error);
    }
}



async function sendApprovalRequest(adminChatId: string, requestId: string, requestDetails: string, username: string) {
    try {
        const messageText = `🚨 *Approval Required*\n\n👤 *Username*:  \`@${username}\` \n🌟 *Request ID*: \`${requestId}\`\n🛒 *Details*: ${requestDetails} 💫\n\n⚡ Please take action below:`;

        const options: SendMessageOptions = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: `approve_${requestId}` },
                        { text: '❌ Reject', callback_data: `reject_${requestId}` }
                    ]
                ]
            }
        };

        await bot.sendMessage(adminChatId, messageText, options);
        console.log('Approval request sent to admin.');
    } catch (error) {
        console.error('Error sending approval request:', error);
    }
}





const decoded = (type: 'msg.dataRaw' | 'msg.dataText', encodedText: string) => {

    if (!encodedText) return;

    const decodedData = Buffer.from(encodedText, 'base64').toString('utf-8');

    if (type === 'msg.dataRaw') {
        const numberPattern = /\d+/;  // This will match any sequence of digits
        const extractedNumber = decodedData.match(numberPattern);
        if (extractedNumber) {
            return extractedNumber[0]
        } else {
            return 'No number found.'
        }
    }

    return decodedData;
}

