import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const SHORTLIST_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

const textField = (name: string, label: string) => ({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
    name,
  }),
  type: FieldType.TEXT,
  name,
  label,
  description: 'Shortlists for Client',
  icon: 'IconInputSearch',
});

export default defineObject({
  universalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'shortlist',
  namePlural: 'shortlists',
  labelSingular: 'Shortlist',
  labelPlural: 'Shortlists',
  icon: 'IconChecklist',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    SHORTLIST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: SHORTLIST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    textField('fullName', 'Full Name'),
    textField('age', 'Age'),
    textField('yearsOfExperience', 'Years of Experience'),
    textField('educationalQualifications', 'Educational Qualifications'),
    textField('universityCollege', 'University College'),
    textField('currentJobTitle', 'Current Job Title'),
    textField('currentCompany', 'Current Company'),
    textField('currentLocation', 'Current Location'),
    textField('currentRoleDescription', 'Current Role Description'),
    textField('reportsTo', 'Reports To'),
    textField('functionsReportingTo', 'Functions Reporting To'),
    textField('reasonForLeaving', 'reason For Leaving'),
    textField('currentSalary', 'Current Salary'),
    textField('expectedSalary', 'Expected Salary'),
    textField('noticePeriod', 'Notice Period'),
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'candidate',
      }),
      type: FieldType.RELATION,
      name: 'candidate',
      label: 'Candidate',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'shortlists',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'candidateId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'project',
      }),
      type: FieldType.RELATION,
      name: 'project',
      label: 'Project',
      icon: 'IconTie',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'shortlists',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'projectId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'cvSents',
      }),
      type: FieldType.RELATION,
      name: 'cvSents',
      label: 'CVSents',
      icon: 'IconSend',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'shortlists',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'cvSentsId',
      },
    },
  ],
});
