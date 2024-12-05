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
        mutation CreateOneRelationMetadata($input: CreateOneRelationInput!) {
            createOneRelation(input: $input) {
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
    `
};