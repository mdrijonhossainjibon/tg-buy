import axios from 'axios';


import { NOSQL } from 'Database';
import { IInvoice } from 'Database/types';
import { bot } from 'main.bot';
import cron from 'node-cron';
import { SendMessageOptions } from 'node-telegram-bot-api';
import TonWeb from 'tonweb';

const tonweb = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC'));


cron.schedule('*/10 * * * * *', async () => {
    console.log('Running scheduled task to check expired invoices...');

    try {
        // Find all invoices that are still pending
        const pendingInvoices = await NOSQL.Invoice.find({ status: 'pending' });

        if (!pendingInvoices || pendingInvoices.length === 0) return;

        // Loop through each pending invoice
        for (const invoice of pendingInvoices) {
            if (new Date(invoice.expires) < new Date()) {
                invoice.status = 'cancelled'; // Mark as cancelled
                invoice.updatedAt = new Date();
                await invoice.save();
                console.log(`Invoice ${invoice._id} has expired and marked as cancelled.`);
            } else {
                // Process pending transactions
                await PendingTX(invoice);
            }
        }
    } catch (error) {
        console.error('Error in scheduled task:', error);
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

