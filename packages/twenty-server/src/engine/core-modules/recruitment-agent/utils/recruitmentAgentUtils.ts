
import axios from "axios";
import *  as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/data-model-objects'; 


export function sortWhatsAppMessages(peopleData: allDataObjects.People) {
    // console.log("This is the people data:", JSON.stringify(peopleData));
    const sortedPeopleData = peopleData; // Deep copy to avoid mutating the original data
    sortedPeopleData?.edges?.forEach(personEdge => {
      personEdge?.node?.candidates?.edges.forEach(candidateEdge => {
        candidateEdge?.node?.whatsappMessages?.edges.sort((a, b) => {
          // Sorting in descending order by the createdAt timestamp
          return new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime();
        });
      });
    });
    console.log("Candidates have been sorted by the latest WhatsApp message")
    return sortedPeopleData;
  }

  
  export function getContentTypeFromFileName(filename:string){
    const extension = filename?.split('.').pop()?.toLowerCase() ?? '';

    let contentType;

    switch (extension) {
        case 'doc':
            contentType = 'application/msword';
            break;
        case 'docx':
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
        case 'pdf':
            contentType = 'application/pdf';
            break;
        default:
            contentType = 'application/octet-stream'; // Default content type if none match
    }
    return contentType

}

  export async function axiosRequest(data: string) {
    const response = await axios.request({
        method: 'post',
        url: process.env.GRAPHQL_URL,
        headers: {
            'authorization': 'Bearer ' + process.env.TWENTY_JWT_SECRET,
            'content-type': 'application/json',
        },
        data: data
    });
    return response;
}