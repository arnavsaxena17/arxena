import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import {
    LinkedInEducation,
    LinkedInPeopleSearchResult,
    LinkedInSearchResult,
    LinkedInWorkExperience,
} from '../../../linkedin-search/types/linkedin-search-response.type';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { TransformationContext } from './base-data-source-transformer.service';
import {
    LinkedInSearchTransformerService,
    TransformedCandidateForTable,
} from './linkedin-search-transformer.service';

type RecruiterPrimaryRole = {
  role: string;
  company: string;
  location: string | null;
  source: 'current_positions' | 'work_experience';
};

@Injectable()
export class LinkedInRecruiterPeopleTransformerService extends LinkedInSearchTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'linkedin_recruiter_people';
  }

  override transformToUserProfile(
    candidateData: LinkedInSearchResult,
    context: TransformationContext,
  ): UserProfile {
    const peopleData = candidateData as LinkedInPeopleSearchResult;
    const userProfile = super.transformToUserProfile(candidateData, context);

    this.applyRecruiterNormalization(peopleData, userProfile);

    return userProfile;
  }

  override transformSearchResultsToTableFormat(
    searchResults: LinkedInSearchResult[],
    jobId: string,
    jobName = 'LinkedIn Recruiter Search Results',
  ): TransformedCandidateForTable[] {
    return searchResults.map((result, index) => {
      const peopleResult = result as LinkedInPeopleSearchResult;
      const timestamp = new Date().toISOString();
      const peopleId = `people_${peopleResult.id}_${Date.now()}_${index}`;
      const userProfile = this.transformToUserProfile(result, {
        jobId,
        jobName,
        userId: 'linkedin_recruiter_search_user',
        dataSource: 'linkedin_search',
        timestamp,
      });
      const primaryRole = this.resolvePrimaryRole(peopleResult);

      return {
        ...userProfile,
        __isFetched: true,
        tempId: peopleResult.id,
        phoneNumber: userProfile.phoneNumber || '',
        email: userProfile.emailAddress || '',
        linkedinUrl:
          peopleResult.public_profile_url ||
          peopleResult.profile_url ||
          userProfile.linkedinUrl ||
          '',
        hiringNaukriUrl: userProfile.linkedinSpecificData?.hiringNaukriUrl || '',
        resdexNaukriUrl: '',
        displayPicture:
          peopleResult.profile_picture_url ||
          (typeof userProfile.displayPicture === 'string'
            ? userProfile.displayPicture
            : '') ||
          '',
        status: 'No Status',
        candConversationStatus: 'No Conversation',
        startChat: false,
        stopChat: false,
        startChatCompleted: false,
        startVideoInterviewChat: false,
        startVideoInterviewChatCompleted: false,
        startMeetingSchedulingChat: false,
        startMeetingSchedulingChatCompleted: false,
        engagementStatus: false,
        messagingChannel: 'linkedin',
        chatCount: 0,
        lastEngagementChatControl: 'startChat',
        whatsappMessages: { edges: [] },
        emailMessages: { edges: [] },
        otherFields: {},
        candidateReminders: { edges: [] },
        jobs: { id: jobId, name: jobName },
        people: { id: peopleId },
        attachments: { edges: [] },
        videoInterview: { edges: [] },
        whatsappProvider: 'application03',
        input: '',
        clientInterview: undefined,
        remarks: '',
        name:
          peopleResult.name ||
          userProfile.fullName ||
          `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
          'Unknown',
        headline: peopleResult.headline || userProfile.linkedinHeadline || '',
        profilePictureUrl:
          peopleResult.profile_picture_url ||
          (typeof userProfile.displayPicture === 'string'
            ? userProfile.displayPicture
            : '') ||
          '',
        networkDistance: peopleResult.network_distance || 'UNKNOWN',
        premium: peopleResult.premium || false,
        verified: peopleResult.verified || false,
        sharedConnectionsCount: peopleResult.shared_connections_count,
        followersCount: peopleResult.followers_count,
        keywordsMatch: peopleResult.keywords_match || '',
        jobTitle:
          primaryRole?.role ||
          userProfile.jobTitle ||
          this.extractRecruiterJobTitleFromHeadline(peopleResult.headline) ||
          'Not specified',
        company:
          primaryRole?.company ||
          userProfile.jobCompanyName ||
          this.extractRecruiterCompanyFromHeadline(peopleResult.headline) ||
          'Not specified',
        location:
          primaryRole?.location ||
          peopleResult.location ||
          userProfile.locationName ||
          'Not specified',
        peopleId: null,
        updatedAt: timestamp,
        createdAt: timestamp,
      };
    });
  }

  private applyRecruiterNormalization(
    candidateData: LinkedInPeopleSearchResult,
    userProfile: UserProfile,
  ): void {
    const fullName =
      candidateData.name ||
      `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim();

    if (fullName) {
      userProfile.fullName = fullName;
    }

    const primaryRole = this.resolvePrimaryRole(candidateData);

    if (primaryRole) {
      userProfile.jobTitle = primaryRole.role;
      userProfile.profileTitle = primaryRole.role;
      userProfile.jobCompanyName = primaryRole.company;
      userProfile.locationName = primaryRole.location || userProfile.locationName;
    }

    if (candidateData.skills?.length) {
      const skillNames = candidateData.skills
        .map((skill) => skill.name)
        .filter(Boolean);

      if (skillNames.length > 0) {
        userProfile.skills = skillNames.join(', ');
        userProfile.keySkills = skillNames.join(', ');
      }
    }

    if (candidateData.education?.length) {
      userProfile.education = candidateData.education.map((education) =>
        this.mapEducation(education),
      );
    }

    if (candidateData.industry) {
      userProfile.industry = candidateData.industry;
      userProfile.industries = [{ name: candidateData.industry, is_primary: true }];
    }

    const totalMonths = this.calculateTotalExperienceMonths(candidateData);

    if (totalMonths > 0) {
      userProfile.experienceStats = {
        totalYearsExperience: {
          years: Math.floor(totalMonths / 12),
          months: totalMonths % 12,
        },
        currentSalary: {
          type: null,
          ctc: null,
        },
      };
      userProfile.inferredYearsExperience = Number(
        (totalMonths / 12).toFixed(1),
      );
    }

    userProfile.linkedinSpecificData = {
      ...userProfile.linkedinSpecificData,
      recruiterPrimaryRoleSource: primaryRole?.source,
      connectionsCount: candidateData.connections_count,
      followersCount: candidateData.followers_count,
      interestLikelihood: candidateData.interestLikelihood,
      hiddenCandidate: candidateData.hiddenCandidate,
      recruiterCandidateId: candidateData.recruiter_candidate_id,
      summary: (candidateData as LinkedInPeopleSearchResult & { summary?: string })
        .summary,
      certifications: candidateData.certifications ?? [],
    };
  }

  private resolvePrimaryRole(
    candidateData: LinkedInPeopleSearchResult,
  ): RecruiterPrimaryRole | null {
    const currentPosition = candidateData.current_positions?.find(
      (position) => position.role || position.company,
    );

    if (currentPosition) {
      return {
        role: currentPosition.role,
        company: currentPosition.company,
        location: currentPosition.location,
        source: 'current_positions',
      };
    }

    const currentExperience = candidateData.work_experience?.find(
      (experience) => !experience.end && (experience.role || experience.company),
    );

    if (currentExperience) {
      return {
        role: currentExperience.role,
        company: currentExperience.company,
        location: candidateData.location,
        source: 'work_experience',
      };
    }

    return null;
  }

  private mapEducation(education: LinkedInEducation) {
    return {
      institute: {
        name: education.school || education.school_details?.name || null,
        type: null,
        location: education.school_details?.location || null,
        profiles: education.school_details?.url ? [education.school_details.url] : [],
        website: education.school_details?.url || null,
      },
      degrees: education.degree || null,
      start_date: this.formatLinkedInDate(education.start),
      end_date: this.formatLinkedInDate(education.end),
      gpa: null,
      majors: education.field_of_study ? [education.field_of_study] : [],
      minors: [],
      locations: education.school_details?.location || null,
    };
  }

  private calculateTotalExperienceMonths(
    candidateData: LinkedInPeopleSearchResult,
  ): number {
    const ranges = [
      ...(candidateData.current_positions || []).map((position) => ({
        start: position.start,
        end: position.end,
      })),
      ...(candidateData.work_experience || []).map(
        (experience: LinkedInWorkExperience) => ({
          start: experience.start,
          end: experience.end,
        }),
      ),
    ];

    return ranges.reduce((total, range) => {
      const startMonth = this.toMonthIndex(range.start);
      const endMonth = this.toMonthIndex(range.end) ?? this.toMonthIndexFromDate(new Date());

      if (startMonth === null || endMonth < startMonth) {
        return total;
      }

      return total + (endMonth - startMonth + 1);
    }, 0);
  }

  private formatLinkedInDate(date?: { year: number; month?: number }): string | null {
    if (!date?.year) {
      return null;
    }

    return `${date.year}-${String(date.month ?? 1).padStart(2, '0')}-01`;
  }

  private toMonthIndex(date?: { year: number; month?: number }): number | null {
    if (!date?.year) {
      return null;
    }

    return date.year * 12 + ((date.month ?? 1) - 1);
  }

  private toMonthIndexFromDate(date: Date): number {
    return date.getUTCFullYear() * 12 + date.getUTCMonth();
  }

  private extractRecruiterJobTitleFromHeadline(headline?: string): string | null {
    if (!headline) return null;

    const patterns = [/^([^|]+)/, /^([^-]+)/, /^([^@]+)/];

    for (const pattern of patterns) {
      const match = headline.match(pattern);

      if (match?.[1]) {
        const title = match[1].trim();

        if (title && title.length < 100) {
          return title;
        }
      }
    }

    return headline.length > 100 ? `${headline.substring(0, 100)}...` : headline;
  }

  private extractRecruiterCompanyFromHeadline(headline?: string): string | null {
    if (!headline) return null;

    const patterns = [
      /at\s+([^|]+)/i,
      /@\s+([^|]+)/i,
      /\|\s*([^|]+)/,
      /-\s*([^-]+)$/,
    ];

    for (const pattern of patterns) {
      const match = headline.match(pattern);

      if (match?.[1]) {
        const company = match[1].trim();

        if (company && company.length < 100) {
          return company;
        }
      }
    }

    return null;
  }
}
