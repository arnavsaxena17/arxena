

import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import * as allDataObjects from '../services/data-model-objects';
import { UpdateChat } from '../services/candidate-engagement/update-chat';
import { GmailMessageData } from '../../gmail-sender/services/gmail-sender-objects-types';
import { SendEmailFunctionality, EmailTemplates } from '../utils/send-gmail';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from '../services/candidate-engagement/filter-candidates';
import { StartVideoInterviewChatProcesses } from '../services/candidate-engagement/chat-control-processes/start-video-interview-chat-processes';


@Controller('video-interview-process')
export class VideoInterviewProcessController {
    constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

    @Post('create-video-interview')
    @UseGuards(JwtAuthGuard)
    async createVideoInterviewForCandidate(@Req() request: any): Promise<object> {
        const candidateId = request.body.candidateId;
        const apiToken = request.headers.authorization.split(' ')[1];
        console.log('candidateId to create video-interview:', candidateId);
        const createVideoInterviewResponse = await new StartVideoInterviewChatProcesses(this.workspaceQueryService).createVideoInterviewForCandidate(candidateId, apiToken);
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
            const createVideoInterviewResponse = await new StartVideoInterviewChatProcesses(this.workspaceQueryService).createVideoInterviewForCandidate(candidateId, apiToken);
            const personObj = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByCandidateId(candidateId, apiToken);
            const person = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPersonId(personObj.id, apiToken);
            console.log("Got person:", person);
            const videoInterviewUrl = createVideoInterviewResponse?.data?.createVideoInterview?.interviewLink?.url;
            console.log("This is the video interview link:", videoInterviewUrl);
            const companyName = person?.candidates?.edges
            .filter(edge => edge.node.id === candidateId)
            .map(edge => edge.node.jobs.company.name)[0];
    
            if (videoInterviewUrl) {
                console.log("Going to send email to person:", person);
                const videoInterviewInviteTemplate = await new EmailTemplates().getInterviewInvitationTemplate(person, candidateId, videoInterviewUrl);
                console.log("allDataObjects.recruiterProfile?.email:", allDataObjects.recruiterProfile?.email);
                const emailData: GmailMessageData = {
                    sendEmailFrom: allDataObjects.recruiterProfile?.email,
                    sendEmailTo: person?.email,
                    subject: 'Video Interview - ' + person?.name?.firstName + '<>' + companyName,
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
            const personObj = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByCandidateId(candidateId, apiToken);
            const person = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPersonId(personObj.id, apiToken);
            console.log("Got person:", person);
            const videoInterviewUrl = person?.candidates?.edges[0]?.node?.videoInterview?.edges[0]?.node?.interviewLink?.url;
            console.log("This is the video interview in send-video-interview-to-candidate link:", videoInterviewUrl);
            const companyName = person?.candidates?.edges
            .filter(edge => edge.node.id === candidateId)
            .map(edge => edge.node.jobs.company.name)[0];
    
            if (videoInterviewUrl) {
                const videoInterviewInviteTemplate = await new EmailTemplates().getInterviewInvitationTemplate(person, candidateId, videoInterviewUrl);
                console.log("allDataObjects.recruiterProfile?.email:", allDataObjects.recruiterProfile?.email);
                const emailData: GmailMessageData = {
                    sendEmailFrom: allDataObjects.recruiterProfile?.email,
                    sendEmailTo: person?.email,
                    subject: 'Video Interview - ' + person?.name?.firstName + '<>' + companyName,
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
