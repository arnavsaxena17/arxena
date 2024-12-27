// import * as deliveryManagementTypes from './types/delivery-management.types';


// // Test utilities
// import { expect } from 'chai';
// import chaiAsPromised from 'chai-as-promised';

// chai.use(chaiAsPromised);
// import { mock, spy, SinonSpy } from 'sinon';
// import { CandidateDashboard, RecruiterDashboard, ClientDashboard } from './delivery-dashboards.service';
// import { CandidateManagementSystem } from './delivery-management.service';
// import { newFieldsToCreate } from '../candidate-sourcing/services/candidate.service';

// describe('CandidateManagementSystem', () => {
//  let cms: deliveryManagementTypes.CandidateManagementSystem;

//  beforeEach(() => {
//    cms = new CandidateManagementSystem();
//  });

//  describe('ShortlistingManager', () => {
//    it('should shortlist a candidate', async () => {
//      const candidateId = 'candidate123';
//      await cms.shortlistingManager.shortlistCandidate(candidateId);
//      const candidate = cms.candidates.get(candidateId);
//      expect(candidate).to.not.be.undefined;
//      expect(candidate!.status).to.equal(deliveryManagementTypes.CandidateStatus.SHORTLISTED);
//    });

//    it('should notify recruiter when candidate is shortlisted', () => {
//      const notifySpy: SinonSpy = spy(deliveryManagementTypes.NotificationService, 'sendNotification');
//      cms.shortlistingManager.shortlistCandidate('candidate123');
//      expect(notifySpy.calledOnce).to.be.true;
//    });
//  });

// describe('InterviewManager', () => {
//    it('should schedule interview only if all participants are available', async () => {
//      const mockTimeSlot: deliveryManagementTypes.TimeSlot = {
//        startTime: new Date().toISOString().substring(11, 16),
//        endTime: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString().substring(11, 16),
//        status: 'available'
//      };
//      const scheduleRequest: deliveryManagementTypes.InterviewRequest = {
//        candidateId: 'candidate123',
//        interviewers: ['interviewer1'],
//        round: 1,
//        duration: 60,
//        mode: 'online',
//        preferredSlots: [mockTimeSlot],
//        dateTimeStart: new Date(),
//        dateTimeEnd: new Date(),
//      };

//      const interview = await cms.interviewManager.scheduleInterview(
//        scheduleRequest.candidateId,
//        'client123',
//        1
//      );

//      expect(interview.scheduledTime).to.not.be.null;
//      expect(interview.status).to.equal('scheduled');
//    });
//  });

//  describe('AssessmentManager', () => {
//    it('should track assessment completion status', () => {
//      const assessment = cms.assessmentManager.initiateAssessment('candidate123');
//      cms.assessmentManager.trackAssessmentProgress(assessment.id);
//      expect(assessment.status).to.equal('pending');
//    });
//  });

//  describe('OfferManager', () => {
//    it('should require all documents before proceeding with offer', () => {
//      const offerStatus = cms.offerManager.initiateOffer('candidate123');
//      expect(offerStatus.canProceed).to.be.false;
//      cms.offerManager.collectDocuments('candidate123');
//      expect(offerStatus.canProceed).to.be.true;
//    });
//  });
// });

// describe('ClientDashboard', () => {
//  it('should filter candidates based on stakeholder permissions', () => {
//    const dashboard = new ClientDashboard();
//    const stakeholder: deliveryManagementTypes.ClientStakeholder = {
//      id: 'stakeholder1',
//      role: deliveryManagementTypes.ClientRole.TECHNICAL_INTERVIEWER,
//      permissions: {
//        canProvideFeedback: true,
//        canScheduleInterviews: true,
//        canViewSalaryDetails: true,
//        canApproveOffers: true,
//        canViewDocuments: true
//      }
//    };

//    const candidates = dashboard.viewCandidatePipeline({
//      status: [deliveryManagementTypes.CandidateStatus.INTERVIEW_PROCESS]
//    });

//    expect(candidates.length).to.be.greaterThan(0);
//    candidates.forEach(candidate => {
//      expect(candidate.currentStatus.status).to.equal(deliveryManagementTypes.CandidateStatus.INTERVIEW_PROCESS);
//    });
//  });
// });

// describe('CandidateDashboard', () => {
//  it('should show correct stage progression', () => {
//    const dashboard = new CandidateDashboard();
//    const status = dashboard.viewApplicationStatus();
//    expect(status.progress).to.be.a('number');
//    expect(status.completedMilestones).to.be.an('array');
//  });

//  it('should validate document uploads', async () => {
//    const dashboard = new CandidateDashboard();
//    const invalidDoc = new File([], 'test.xyz');
//    await expect(
//      dashboard.uploadDocuments(deliveryManagementTypes.DocumentType.SALARY_SLIP, invalidDoc)
//    ).to.be.false;
//  });
// });

// describe('ReportGeneration', () => {
//  it('should generate accurate metrics', () => {
//    const recruiterDashboard = new RecruiterDashboard();
//    const report = recruiterDashboard.generateReports(deliveryManagementTypes.ReportType.PIPELINE_METRICS);
   
//    expect(report.metrics).to.be.an('array');
//    expect(report.metrics[0].value).to.be.a('number');
//    expect(report.metrics[0].trend).to.be.a('number');
//  });
// });

// // function spy removed as it is imported from sinon
