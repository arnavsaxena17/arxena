// import schedule from 'node-schedule';

// // Define your function that needs to be executed
// const yourFunction = () => {
//     const now = new Date();
//     const formattedTime = now.toLocaleString('en-US', { hour12: false });
//     console.log(`Current time: ${formattedTime}`);
//     console.log('Function is executed every 5 seconds');
// };

// export function startSchedulingAgent() {
// // Schedule your function to be called every 5 minutes
//     const job = schedule.scheduleJob('*/5 * * * * *', yourFunction);
//     console.log('Scheduler started');    
// }

import checkCandidateEngagement from '../candidateEngagement/checkCandidateEngagement';


import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  @Cron('*/20 * * * * *')
  handleCron() {
    // this.logger.log("Evert 5 seconds check Candidate Engagement is called");
    checkCandidateEngagement();
  }
}