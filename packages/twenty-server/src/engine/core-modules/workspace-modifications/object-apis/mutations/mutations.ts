
export const mutations = {
  createObject: `
        mutation CreateOneObjectMetadataItem($input: CreateOneObjectInput!) {
            createOneObject(input: $input) {
                id
                dataSourceId
                nameSingular
                namePlural
                labelSingular
                labelPlural
                description
                icon
                isCustom
                isActive
                createdAt
                updatedAt
                labelIdentifierFieldMetadataId
                imageIdentifierFieldMetadataId
            }
        }
    `,
  createRelation: `
        mutation CreateOneRelationMetadata($input: CreateOneRelationMetadataInput!) {
            createOneRelationMetadata(input: $input) {
                id
                relationType
                fromObjectMetadataId
                toObjectMetadataId
                fromFieldMetadataId
                toFieldMetadataId
                createdAt
                updatedAt
            }
        }
    `,

  createField: `
        mutation CreateOneFieldMetadataItem($input: CreateOneFieldMetadataInput!) {
            createOneField(input: $input) {
                id
                type
                name
                label
                description
                icon
                isCustom
                isActive
                isNullable
                createdAt
                updatedAt
                defaultValue
                options
            }
        }
    `,
  createVideoInterviewModel: `
    mutation CreateOneVideoInterviewModel($input: VideoInterviewModelCreateInput!) {
        createVideoInterviewModel(data: $input) {
            id
            name
            country
            language
            createdAt
            updatedAt
        }
    }
`,

  createVideoInterviewTemplate: `
    mutation CreateOneVideoInterviewTemplate($input: VideoInterviewTemplateCreateInput!) {
        createVideoInterviewTemplate(data: $input) {
            id
            name
            videoInterviewModelId
            jobId
            introduction
            instructions
            createdAt
            updatedAt
        }
    }
`,
  createArxEnrichments: `
        mutation CreateOneCandidateEnrichment($input: CandidateEnrichmentCreateInput!) {
            createCandidateEnrichment(data: $input) {
          id
          name
          position
          createdAt
          updatedAt
        }
      }`,
};
