import schedule from 'node-schedule';

// Define your function that needs to be executed
const yourFunction = () => {
    const now = new Date();
    const formattedTime = now.toLocaleString('en-US', { hour12: false });
    console.log(`Current time: ${formattedTime}`);
    console.log('Function is executed every 5 seconds');
};

export function startSchedulingAgent() {
// Schedule your function to be called every 5 minutes
    const job = schedule.scheduleJob('*/5 * * * * *', yourFunction);
    console.log('Scheduler started');    
}

