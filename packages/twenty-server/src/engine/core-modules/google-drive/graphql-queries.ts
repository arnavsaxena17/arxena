export const graphqlQueryToFindPhoneCalls = `
query FindManyPhoneCalls($filter: PhoneCallFilterInput, $orderBy: [PhoneCallOrderByInput], $lastCursor: String, $limit: Int) {
    phoneCalls(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
        edges {
            node {
                id
                personId
                phoneNumber
                callType
                duration
                timestamp
                recordingAttachmentId
            }
            cursor
        }
        pageInfo {
            hasNextPage
            startCursor 
            endCursor
        }
        totalCount
    }
}`;

export const graphqlQueryToFindSMS = `
query FindManySMS($filter: SMSFilterInput, $orderBy: [SMSOrderByInput], $lastCursor: String, $limit: Int) {
    smsMessages(filter: $filter, orderBy: $orderBy, first: $limit, after: $lastCursor) {
        edges {
            node {
                id
                personId
                phoneNumber
                messageType
                message
                timestamp
            }
            cursor
        }
        pageInfo {
            hasNextPage
            startCursor
            endCursor
        }
        totalCount
    }
}`;

export const graphqlMutationToCreatePhoneCall = `
mutation CreatePhoneCall($input: CreatePhoneCallInput!) {
    createPhoneCall(data: $input) {
        id
        personId
        phoneNumber
        callType
        duration
        timestamp
        recordingAttachmentId
    }
}`;

export const graphqlMutationToCreateSMS = `
mutation CreateSMS($input: CreateSMSInput!) {
    createSMS(data: $input) {
        id
        personId 
        phoneNumber
        messageType
        message
        timestamp
    }
}`;

export const graphqlMutationToUpdatePhoneCall = `
mutation UpdatePhoneCall($id: ID!, $input: UpdatePhoneCallInput!) {
    updatePhoneCall(id: $id, data: $input) {
        id
        personId
        phoneNumber
        callType
        duration
        timestamp
        recordingAttachmentId
    }
}`;

export const graphqlMutationToUpdateSMS = `
mutation UpdateSMS($id: ID!, $input: UpdateSMSInput!) {
    updateSMS(id: $id, data: $input) {
        id
        personId
        phoneNumber
        messageType
        message
        timestamp
    }
}`;
