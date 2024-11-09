import * as allDataObjects from '../../../services/data-model-objects';

export class WhatsappTemplateMessages{


    getTemplateMessageObj(sendTemplateMessageObj: allDataObjects.sendWhatsappTemplateMessageObjectType) {
        const templateMessageObj = JSON.stringify({
          messaging_product: 'whatsapp',
          to: sendTemplateMessageObj.recipient,
          type: 'template',
          template: {
            name: sendTemplateMessageObj.template_name,
            language: {
              code: 'en',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: sendTemplateMessageObj.candidateFirstName, },
                  { type: 'text', text: sendTemplateMessageObj.recruiterName, },
                  { type: 'text', text: sendTemplateMessageObj.recruiterJobTitle, },
                  { type: 'text', text: sendTemplateMessageObj.recruiterCompanyName, },
                  { type: 'text', text: sendTemplateMessageObj.recruiterCompanyDescription, },
                  { type: 'text', text: sendTemplateMessageObj.jobPositionName, },
                  { type: 'text', text: sendTemplateMessageObj.jobLocation, },
                ],
              },
            ],
          },
        });
        // console.log("This is the template message object created:", templateMessageObj)
        return templateMessageObj;
      }
    
    
      getUpdatedUtilityMessageObj(sendTemplateMessageObj: allDataObjects.sendWhatsappUtilityMessageObjectType) {
        let templateMessageObj;
        console.log("Going to get utiltiy messages")
        const templates = ['recruitment', 'application', 'application02','share_video_interview_link_with_start_link','share_video_interview_link_direct','rejection_template','follow_up'];
        switch (sendTemplateMessageObj.template_name) {
          case 'share_video_interview_link_with_start_link':
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj.candidateFirstName },
                      { type: 'text', text: "10 mins" },
                      { type: 'text', text: sendTemplateMessageObj.videoInterviewLink },
                      { type: 'text', text: "15 mins" },
                      { type: 'text', text: "3-4 questions" },
                    ],
                  },
                  {
                    "type": "BUTTONS",
                    "buttons": [
                      {
                          "type": "URL",
                          "text": "Start Interview",
                          "url": "https://arxena.com/video-interview/1ebf22e0-7865-44c7-b266-c0d08121f4c1/{{1}}",
                          "example": [
                              "https://arxena.com/video-interview/1ebf22e0-7865-44c7-b266-c0d08121f4c1"
                          ]
                      }
                  ]
                }
                ],
              },
            });
            break;
          case 'share_video_interview_link_direct':
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj.candidateFirstName },
                      { type: 'text', text: "10 mins" },
                      { type: 'text', text: sendTemplateMessageObj.videoInterviewLink },
                      { type: 'text', text: "15 mins" },
                      { type: 'text', text: "3-4 questions" },
                    ],
                  },
                ],
              },
            });
            break;


          case 'recruitment':
            // First template example
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj.candidateFirstName },
                      { type: 'text', text: sendTemplateMessageObj.recruiterName },
                      { type: 'text', text: sendTemplateMessageObj.recruiterJobTitle },
                      { type: 'text', text: sendTemplateMessageObj.recruiterCompanyName },
                      { type: 'text', text: sendTemplateMessageObj.recruiterCompanyDescription },
                      { type: 'text', text: sendTemplateMessageObj.jobPositionName },
                      { type: 'text', text: sendTemplateMessageObj.descriptionOneliner },
                      { type: 'text', text: sendTemplateMessageObj.jobLocation },
                    ],
                  },
                ],
              },
            });
            break;
          case 'application03':
            // First template example
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: {
                  code: 'en',
                },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj.candidateFirstName, },
                      { type: 'text', text: sendTemplateMessageObj.recruiterName, },
                      { type: 'text', text: sendTemplateMessageObj.recruiterJobTitle, },
                      { type: 'text', text: sendTemplateMessageObj.recruiterCompanyName, },
                      { type: 'text', text: sendTemplateMessageObj.recruiterCompanyDescription, },
                      { type: 'text', text: sendTemplateMessageObj.jobPositionName, },
                      { type: 'text', text: sendTemplateMessageObj.descriptionOneliner, },
                      { type: 'text', text: sendTemplateMessageObj.jobLocation, },
                    ],
                  },
                ],
              },
            });
            // console.log("This is the template message object created:", templateMessageObj)
    
          break;
     
          case 'rejection_template':
            // First template example
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: {
                  code: 'en',
                },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj.candidateFirstName, },
                      { type: 'text', text: "your profile discussed last week", },
                      { type: 'text', text: "internally", },
                      { type: 'text', text: "believe that your profile won't be a good fit", },
                    ],
                  },
                ],
              },
            });
            // console.log("This is the template message object created:", templateMessageObj)
    
          break;
    
    
          case 'follow_up':
            // First template example
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj.candidateFirstName },
                      { type: 'text', text: sendTemplateMessageObj.discussionDate || "earlier" },
                      { type: 'text', text: sendTemplateMessageObj.nextStep || "next steps" },
                      { type: 'text', text: sendTemplateMessageObj.availableDate || "tomorrow for a quick chat?" },
                      { type: 'text', text: sendTemplateMessageObj.recruiterName },
                    ],
                  },
                ],
              },
            });
            break;
    
    
    
            
          case 'application':
            // Second template example
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj?.candidateFirstName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterJobTitle, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterCompanyName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterCompanyDescription, },
                      { type: 'text', text: sendTemplateMessageObj?.jobCode, },
                      { type: 'text', text: sendTemplateMessageObj?.jobPositionName, },
                      { type: 'text', text: sendTemplateMessageObj?.companyName, },
                      { type: 'text', text: sendTemplateMessageObj?.jobLocation, },
                    ],
                  },
                ],
              },
            });
            break;
    
          case 'application':
            // Second template example
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: {
                  code: 'en',
                },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj?.candidateFirstName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterJobTitle, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterCompanyName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterCompanyDescription, },
                      { type: 'text', text: sendTemplateMessageObj?.jobPositionName, },
                      { type: 'text', text: sendTemplateMessageObj?.jobLocation, },
                    ],
                  },
                ],
              },
            });
          break;
    
          case 'application02':
            // Third template example
            templateMessageObj = JSON.stringify({
              messaging_product: 'whatsapp',
              to: sendTemplateMessageObj.recipient,
              type: 'template',
              template: {
                name: sendTemplateMessageObj.template_name,
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: sendTemplateMessageObj?.candidateFirstName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterJobTitle, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterCompanyName, },
                      { type: 'text', text: sendTemplateMessageObj?.recruiterCompanyDescription, },
                      { type: 'text', text: sendTemplateMessageObj?.jobCode, },
                      { type: 'text', text: sendTemplateMessageObj?.jobPositionName, },
                      { type: 'text', text: sendTemplateMessageObj?.companyName, },
                      { type: 'text', text: sendTemplateMessageObj?.jobLocation, },
                    ],
                  },
                ],
              },
            });
            break;
          default:
            throw new Error(`Unknown template: ${sendTemplateMessageObj.template_name}`);
        }
        return templateMessageObj;
        }
        
    
        generateMessage(templateName: string, data: allDataObjects.sendWhatsappUtilityMessageObjectType): string {
          
          switch (templateName) {
            case 'recruitment':
              return this.generateRecruitmentMessage(data);
            case 'application':
              return this.generateApplicationMessage(data);
            case 'application02':
              return this.generateApplication02Message(data);
            case 'rejection_template':
              return this.generateRejectionMessage(data);
            default:
              return 'Invalid template name';
          }
        }    
        generateRecruitmentMessage(data: allDataObjects.sendWhatsappUtilityMessageObjectType): string {
          return `Dear ${data.candidateFirstName},\n\n` +
            `My name is ${data.recruiterName}, ${data.recruiterJobTitle} at ${data.recruiterCompanyName}, ${data.recruiterCompanyDescription}. ` +
            `I am reaching out to you regarding the ${data.jobPositionName} position for ${data.jobLocation}. ` +
            `Job Code: ${data.jobCode}\n${data.descriptionOneliner}\n`;
        }
      
        generateApplicationMessage(data: allDataObjects.sendWhatsappUtilityMessageObjectType): string {
          return `Dear ${data.candidateFirstName},\n\n` +
            `Thank you for your time earlier on ${data.discussionDate}. ` +
            `Please let me know your availability for the next steps ${data.nextStep}.\n`;
        }
      
        generateApplication02Message(data: allDataObjects.sendWhatsappUtilityMessageObjectType): string {
          return `Dear ${data.candidateFirstName},\n\n` +
            `I hope this message finds you well. I am following up to check on your availability for the next steps regarding the ` +
            `${data.jobPositionName} position in ${data.jobLocation}. Kindly update me when you get a chance.\n`;
        }
        generateRejectionMessage(data: allDataObjects.sendWhatsappUtilityMessageObjectType): string {
          console.log("This is the data for rejection message", data)
          return `Hi  ${data.candidateFirstName},
            Further to your profile discussed last week, we discussed internally and believe that your profile won't be a good fit.
            Will reach out to you in the future with relevant roles.`
        }

        // { type: 'text', text: "your profile discussed last week", },
        // { type: 'text', text: "internally", },
        // { type: 'text', text: "believe that your profile won't be a good fit", },

        getUtilityMessageObj(sendTemplateMessageObj: allDataObjects.sendWhatsappUtilityMessageObjectType) {
        const templateMessageObj = JSON.stringify({
          messaging_product: 'whatsapp',
          to: sendTemplateMessageObj.recipient,
          type: 'template',
          template: {
            name: sendTemplateMessageObj.template_name,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: sendTemplateMessageObj.candidateFirstName,
                  },
                  {
                    type: 'text',
                    text: sendTemplateMessageObj.recruiterName,
                  },
                  {
                    type: 'text',
                    text: sendTemplateMessageObj.recruiterJobTitle,
                  },
                  {
                    type: 'text',
                    text: sendTemplateMessageObj.recruiterCompanyName,
                  },
                  {
                    type: 'text',
                    text: sendTemplateMessageObj.recruiterCompanyDescription,
                  },
                  // {
                  //   type: 'text',
                  //   text: sendTemplateMessageObj.jobCode,
                  // },
                  {
                    type: 'text',
                    text: sendTemplateMessageObj.jobPositionName,
                  },
                  {
                    type: 'text',
                    text: sendTemplateMessageObj.descriptionOneliner,
                  },
                  {
                    type: 'text',
                    text: sendTemplateMessageObj.jobLocation,
                  },
                ],
              },
            ],
          },
        });
        return templateMessageObj;
        }
}
