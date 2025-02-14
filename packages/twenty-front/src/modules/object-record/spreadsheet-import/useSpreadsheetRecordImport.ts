import { isNonEmptyString } from '@sniptt/guards';
import { IconComponent, useIcons } from 'twenty-ui';
import lavenstein from 'js-levenshtein';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { getSpreadSheetValidation } from '@/object-record/spreadsheet-import/util/getSpreadSheetValidation';
import { useSpreadsheetImport } from '@/spreadsheet-import/hooks/useSpreadsheetImport';
import { SpreadsheetOptions, Validation } from '@/spreadsheet-import/types';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { isDefined } from '~/utils/isDefined';
import { useFindManyRecords } from '../hooks/useFindManyRecords';
import { Job } from '@/activities/chats/types/front-chat-types';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';

const firstName = 'Firstname';
const lastName = 'Lastname';

export const useSpreadsheetRecordImport = (objectNameSingular: string) => {
  const { openSpreadsheetImport } = useSpreadsheetImport<any>();
  const { enqueueSnackBar } = useSnackBar();
  const { getIcon } = useIcons();

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });
  const fields = objectMetadataItem.fields.filter(x => x.isActive && !x.isSystem && x.name !== 'createdAt' && (x.type !== FieldMetadataType.Relation || x.toRelationMetadata)).sort((a, b) => a.name.localeCompare(b.name));

  const splitFullName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    return { firstName, lastName };
  };

  const templateFields: {
    icon: IconComponent;
    label: string;
    key: string;
    fieldType: {
      type: 'input' | 'checkbox';
    };
    validations?: Validation[];
  }[] = [];
  for (const field of fields) {
    if (field.type === FieldMetadataType.FullName) {
      templateFields.push({
        icon: getIcon(field.icon),
        label: `${firstName} (${field.label})`,
        key: `${firstName} (${field.name})`,
        fieldType: {
          type: 'input',
        },
        validations: getSpreadSheetValidation(field.type, `${firstName} (${field.label})`),
      });
      templateFields.push({
        icon: getIcon(field.icon),
        label: `${lastName} (${field.label})`,
        key: `${lastName} (${field.name})`,
        fieldType: {
          type: 'input',
        },
        validations: getSpreadSheetValidation(field.type, `${lastName} (${field.label})`),
      });
    } else if (field.type === FieldMetadataType.Relation) {
      templateFields.push({
        icon: getIcon(field.icon),
        label: field.label + ' (ID)',
        key: field.name,
        fieldType: {
          type: 'input',
        },
        validations: getSpreadSheetValidation(field.type, field.label + ' (ID)'),
      });
    } else {
      templateFields.push({
        icon: getIcon(field.icon),
        label: field.label,
        key: field.name,
        fieldType: {
          type: 'input',
        },
        validations: getSpreadSheetValidation(field.type, field.label),
      });
    }
  }

  const { createManyRecords } = useCreateManyRecords({
    objectNameSingular,
  });

  const { createManyRecords: createManyPeopleRecords } = useCreateManyRecords({
    objectNameSingular: 'person',
  });

  // const fetchActiveJobs = async () => {
  //   try {
  //     const response = await fetch('/api/get-active-jobs'); // Adjust the endpoint as needed
  //     const jobs = await response.json();
  //     return jobs;
  //   } catch (error) {
  //     console.error('Error fetching active jobs:', error);
  //     return [];
  //   }
  // };

  const { records: activeJobs } = useFindManyRecords({
    objectNameSingular: CoreObjectNameSingular.Job,
    filter: {
      isActive: { eq: true },
    },
  });

  const findBestMatchingJob = (jobName: string, jobs: any[]) => {
    console.log('These are the jobs that we found:', jobs);
    console.log('These are the jobName that we found:', jobName);
    let bestMatch = null;
    let lowestDistance = Infinity;
    const threshold = 15;

    const normalizedJobName = jobName.toLowerCase().trim();
    console.log('normalizedJobName::', normalizedJobName);

    for (const job of jobs) {
      const normalizedName = job.name.toLowerCase().trim();
      const distance = lavenstein(normalizedJobName, normalizedName);
      console.log('This is the distance::', distance, 'for job::', job, 'and normalizedJobName::', normalizedJobName, 'and normalizedName::', normalizedName);
      if (distance < lowestDistance && distance <= threshold) {
        lowestDistance = distance;
        bestMatch = job;
      }
    }
    console.log('This is the best match::', bestMatch);
    return bestMatch;
  };

  const openRecordSpreadsheetImport = (options?: Omit<SpreadsheetOptions<any>, 'fields' | 'isOpen' | 'onClose'>) => {
    openSpreadsheetImport({
      ...options,
      onSubmit: async data => {
        const createInputs = data.validData.map(record => {
          const fieldMapping: Record<string, any> = {};
          for (const field of fields) {
            const value = record[field.name];

            switch (field.type) {
              case FieldMetadataType.Boolean:
                fieldMapping[field.name] = value === 'true' || value === true;
                break;
              case FieldMetadataType.Number:
              case FieldMetadataType.Numeric:
                fieldMapping[field.name] = Number(value);
                break;
              case FieldMetadataType.Phone:
                if (value && typeof value === 'string') {
                  // Transform phone number here
                  const phoneNumber = value.startsWith('+') ? value : `+91${value}`;
                  fieldMapping[field.name] = phoneNumber;
                }
                break;
              case FieldMetadataType.Currency:
                if (value !== undefined) {
                  fieldMapping[field.name] = {
                    amountMicros: Number(value),
                    currencyCode: 'USD',
                  };
                }
                break;
              case FieldMetadataType.Link:
                if (value !== undefined) {
                  fieldMapping[field.name] = {
                    label: field.name,
                    url: value || null,
                  };
                }
                break;
              case FieldMetadataType.Relation:
                if (isDefined(value) && (isNonEmptyString(value) || value !== false)) {
                  if (field.name.includes('job') && activeJobs && typeof value === 'string') {
                    const matchedJob = findBestMatchingJob(value, activeJobs);
                    console.log('This si the matched job', matchedJob);
                    if (matchedJob) {
                      console.log('Setting field :', field.name + 'Id', matchedJob.id);
                      fieldMapping[field.name + 'Id'] = matchedJob.id;
                    } else {
                      console.warn(`No matching job found for: ${value}`);
                    }
                  } else {
                    fieldMapping[field.name + 'Id'] = value;
                  }
                }

                // if (isDefined(value) && (isNonEmptyString(value) || value !== false)) {
                //   fieldMapping[field.name + 'Id'] = value;
                // }
                break;
              case FieldMetadataType.FullName:
                if (isDefined(record[`${firstName} (${field.name})`] || record[`${lastName} (${field.name})`])) {
                  fieldMapping[field.name] = {
                    firstName: record[`${firstName} (${field.name})`] || '',
                    lastName: record[`${lastName} (${field.name})`] || '',
                  };
                }
                break;
              default:
                fieldMapping[field.name] = value;
                break;
            }
          }
          return fieldMapping;
        });
        try {
          console.log('These are the create Inputs::, ', createInputs);
          if (objectNameSingular === 'candidate') {
            const personInputs = createInputs.map((input) => {
              if (input.name && typeof input.name === 'string') {
                const nameParts = input.name.trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
          
                return {
                  ...input,
                  name: { firstName, lastName },
                  phone: input.phoneNumber || '',
                };
              }
              return input;
            });
            console.log("These are the personInputs::", personInputs);
          
            // First create person records
            const createdPersonRecords = await createManyPeopleRecords(personInputs);
            console.log('These are the created person records::', createdPersonRecords);
            // Then map the person IDs to candidate records
            const candidateInputsWithPersonIds = createInputs.map((input, index) => ({
              ...input,
              peopleId: createdPersonRecords[index].id
            }));

            console.log('These are the candidateInputsWithPersonIds::', candidateInputsWithPersonIds);
          
            // Create candidate records with person IDs
            const createdRecords = await createManyRecords(candidateInputsWithPersonIds);
            console.log('These are the created records::', createdRecords);
          }
        } catch (error: any) {
          enqueueSnackBar(error?.message || 'Something went wrong', {
            variant: SnackBarVariant.Error,
          });
        }
      },
      fields: templateFields,
    });
  };

  return { openRecordSpreadsheetImport };
};
