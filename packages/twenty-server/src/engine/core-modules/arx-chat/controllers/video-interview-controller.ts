
import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from '../services/data-model-objects';
import { FacebookWhatsappChatApi } from '../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import CandidateEngagementArx from '../services/candidate-engagement/check-candidate-engagement';
import { IncomingWhatsappMessages } from '../services/whatsapp-api/incoming-messages';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../services/candidate-engagement/update-chat';
import { StageWiseClassification } from '../services/llm-agents/get-stage-wise-classification';
import { OpenAIArxMultiStepClient } from '../services/llm-agents/arx-multi-step-client';
import { ToolsForAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-tool-calling';
import { axiosRequest } from '../utils/arx-chat-agent-utils';
import * as allGraphQLQueries from '../services/candidate-engagement/graphql-queries-chatbot';
import { shareJDtoCandidate } from '../services/llm-agents/tool-calls-processing';
import { checkIfResponseMessageSoundsHumanLike } from '../services/llm-agents/human-or-bot-type-response-classification';
import twilio from 'twilio';
import { GmailMessageData } from '../../gmail-sender/services/gmail-sender-objects-types';
import { SendEmailFunctionality, EmailTemplates } from '../services/candidate-engagement/send-gmail';
import { CalendarEventType } from '../../calendar-events/services/calendar-data-objects-types';
import { CalendarEmailService } from '../services/candidate-engagement/calendar-email';
import moment from 'moment-timezone';
import axios from 'axios';
import { WhatsappTemplateMessages } from '../services/whatsapp-api/facebook-whatsapp/template-messages';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { EmailService } from 'src/engine/integrations/email/email.service';






@Controller('video-interview-process')
export class VideoInterviewController {
    constructor(private readonly workspaceQueryService: any) {}

    @Post('create-video-interview')
    @UseGuards(JwtAuthGuard)
    async createVideoInterviewForCandidate(@Req() request: any): Promise<object> {
        const candidateId = request.body.candidateId;
        const apiToken = request.headers.authorization.split(' ')[1];
        console.log('candidateId to create video-interview:', candidateId);
        const createVideoInterviewResponse = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).createVideoInterviewForCandidate(candidateId, apiToken);
        console.log("createVideoInterviewResponse:", createVideoInterviewResponse);
        return createVideoInterviewResponse;
    }

    @Post('create-video-interview-send-to-candidate')
    @UseGuards(JwtAuthGuard)
    async createVideoInterviewSendToCandidate(@Req() request: any): Promise<object> {
        const { workspace } = await this.workspaceQueryService.tokenService.validateToken(request);
        console.log("workspace:", workspace);
        const apiToken = request.headers.authorization.split(' ')[1];
        try {
            const candidateId = request.body.candidateId;
            console.log('candidateId to create video-interview:', candidateId);
            const createVideoInterviewResponse = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).createVideoInterviewForCandidate(candidateId, apiToken);
            const personObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByCandidateId(candidateId, apiToken);
            const person = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPersonId(personObj.id, apiToken);
            console.log("Got person:", person);
            const videoInterviewUrl = createVideoInterviewResponse?.data?.createAIInterviewStatus?.interviewLink?.url;
            console.log("This is the video interview link:", videoInterviewUrl);

            if (videoInterviewUrl) {
                console.log("Going to send email to person:", person);
                const videoInterviewInviteTemplate = await new EmailTemplates().getInterviewInvitationTemplate(person, videoInterviewUrl);
                console.log("allDataObjects.recruiterProfile?.email:", allDataObjects.recruiterProfile?.email);
                const emailData: GmailMessageData = {
                    sendEmailFrom: allDataObjects.recruiterProfile?.email,
                    sendEmailTo: person?.email,
                    subject: 'Video Interview - ' + person?.name?.firstName + '<>' + person?.candidates.edges[0].node.jobs.companies.name,
                    message: videoInterviewInviteTemplate,
                };
                console.log("This is the email Data from createVideo Interview Send To Candidate:", emailData);
                const sendVideoInterviewLinkResponse = await new SendEmailFunctionality().sendEmailFunction(emailData, apiToken);
                console.log("sendVideoInterviewLinkResponse::", sendVideoInterviewLinkResponse);
                return sendVideoInterviewLinkResponse || {};
            } else {
                return createVideoInterviewResponse;
            }
        } catch (error) {
            console.error('Error in createVideoInterviewSendToCandidate:', error);
            throw new Error('Failed to create and send video interview');
        }
    }

    @Post('send-video-interview-to-candidate')
    @UseGuards(JwtAuthGuard)
    async sendVideoInterviewSendToCandidate(@Req() request: any): Promise<object> {
        const apiToken = request.headers.authorization.split(' ')[1];
        const { workspace } = await this.workspaceQueryService.tokenService.validateToken(request);
        console.log("workspace:", workspace);
        try {
            let sendVideoInterviewLinkResponse;
            const candidateId = request?.body?.candidateId;
            const personObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByCandidateId(candidateId, apiToken);
            const person = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).getPersonDetailsByPersonId(personObj.id, apiToken);
            console.log("Got person:", person);
            const videoInterviewUrl = person?.candidates?.edges[0]?.node?.aIInterviewStatus?.edges[0]?.node?.interviewLink?.url;
            console.log("This is the video interview in send-video-interview-to-candidate link:", videoInterviewUrl);

            if (videoInterviewUrl) {
                const videoInterviewInviteTemplate = await new EmailTemplates().getInterviewInvitationTemplate(person, videoInterviewUrl);
                console.log("allDataObjects.recruiterProfile?.email:", allDataObjects.recruiterProfile?.email);
                const emailData: GmailMessageData = {
                    sendEmailFrom: allDataObjects.recruiterProfile?.email,
                    sendEmailTo: person?.email,
                    subject: 'Video Interview - ' + person?.name?.firstName + '<>' + person?.candidates.edges[0].node.jobs.companies.name,
                    message: videoInterviewInviteTemplate,
                };
                console.log("This is the email Data sendVideoInterviewSendToCandidate:", emailData);
                sendVideoInterviewLinkResponse = await new SendEmailFunctionality().sendEmailFunction(emailData, apiToken);
                console.log("sendVideoInterviewLinkResponse::", sendVideoInterviewLinkResponse);
                return sendVideoInterviewLinkResponse || {};
            } else {
                return sendVideoInterviewLinkResponse;
            }
        } catch (error) {
            console.error('Error in sendVideoInterviewSendToCandidate:', error);
            throw new Error('Failed to create and send video interview');
        }
    }
}
