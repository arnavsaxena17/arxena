// interface Template {
//   id: string;
//   name: string;
//   components: {
//     type: string;
//     text: string;
//   }[];
//   language: string;
//   status: string;
// }


// const [templates, setTemplates] = useState<string[]>([]);


// useEffect(() => {
//   const loadTemplates = async () => {
//     const fetchedTemplates = await fetchAllTemplates();
//     // Extract template names from the fetched data
//     const templateNames = fetchedTemplates
//       .filter(template => template.status === 'APPROVED')
//       .map(template => template.name);
//     setTemplates(templateNames);
//   };
  
//   loadTemplates();
// }, []);



// const [templatePreviews, setTemplatePreviews] = useState<{ [key: string]: string }>({});

// useEffect(() => {
//   const loadTemplatePreviews = async () => {
//     const fetchedTemplates = await fetchAllTemplates();
//     const previews: { [key: string]: string } = {};
    
//     fetchedTemplates.forEach(template => {
//       const bodyComponent = template.components.find(comp => comp.type === 'BODY');
//       if (bodyComponent) {
//         previews[template.name] = bodyComponent.text;
//       }
//     });
    
//     setTemplatePreviews(previews);
//   };
  
//   loadTemplatePreviews();
// }, []);

// export const getTemplatePreview = (templateName: string): string => {
//   if (!templateName) return 'Select a template to see preview';
  
//   return templatePreviews[templateName] || 'Template preview not available';
// };


  
//   export const templates = [
//     'recruitment',
//     'application',
//     'application02',
//     'share_video_interview_link_direct',
//     'application03_any_source_passive_chat_any',
//     'rejection_template',
//     'follow_up'
//   ];
  
//   export const getTemplatePreview = (templateName: string): string => {
//     switch (templateName) {
//       case 'recruitment':
//         return `Dear [Candidate Name],
  
//         My name is [Recruiter Name], [Job Title] at [Company Name], [Company Description]. I am reaching out to you regarding the [Position Name] position for [Location].`;

//       case 'application':
//         return `Dear [Candidate Name],
  
//         Thank you for your time earlier. Please let me know your availability for the next steps.`;

//       case 'application03_any_source_passive_chat_any':
//         return `Hey [Candidate Name],

//         This is [Recruiter Name], [Job Title] at [Company Name], [Company Description].

//         I got your resume previously on [Resume Source] for the role of [Position Name] for [Company Name] based out of [Location]. 

//         Wanted to speak to you in regards your interests in the new role. Would you be available for a short call sometime [Proposed Date]?`;
      
//       case 'application_any_source_passive_chat_any_company':
//         return `Hey [Candidate Name],

//         This is [Recruiter Name], [Job Title] at [Company Name], [Company Description].

//         I got your resume on [Resume Source] for the role of [Position Name] for [Company Name] based out of [Location]. 

//         Wanted to speak to you in regards your interests in the new role. Would you be available for a short call sometime [Proposed Date]?`;

//       case 'walkin_meeting_scheduling':
//         return `Hi [Candidate Name],

//         Further to your application, we liked your candidature and wish to move forward and schedule an in-person meeting with the client at [Meeting Time] on [Meeting Date] in [Office Location].
        
//         Would you be able to visit the office on [Meeting Date]?
        
//         Best regards,
//         [Recruiter Name]`;
//       case 'startchat':
//         return `Hey Raju,

//         This is Arnav Saxena, Director at Arxena Inc, a Pune focussed recruitment agency.

//         I got your application earlier on Apna Jobs for the role of Customer Service Associate for PhonePe's BPO based out of Kharadi, Pune. 

//         Wanted to speak to you in regards your interests in this new role. Would you be keen on taking this forward?
//         `;
      
      
//       case 'ask_references_interested_candidate':
//         return `Hi Raju,

//         Subsequent to your interest, would any of your friends/ references also be good for the above role of Sales Manager at Luthra Group?`;

//       case 'application02':
//         return `Dear [Candidate Name],
  
//         I hope this message finds you well. I am following up to check on your availability for the next steps regarding the [Position Name] position in [Location]. Kindly update me when you get a chance.`;
  
//       case 'share_video_interview_link_direct':
//         return `Dear [Candidate Name],
  
//         Please complete your video interview within the next 10 mins. Here's your link: [Interview Link]
//         The interview will take approximately 15 mins and include 3-4 questions.`;

//       case 'rejection_template':
//         return `Hi [Candidate Name],
  
//         Further to your profile discussed last week, we discussed internally and believe that your profile won't be a good fit.
//         Will reach out to you in the future with relevant roles.`;
        
//       case 'follow_up':
//         return `Hi [Candidate Name],
  
//         Following up on our discussion from [Date]. Would you be available [Proposed Date] for a quick chat?
        
//         Best regards,
//         [Recruiter Name]`;
        
//       default:
//         return 'Select a template to see preview';
//     }
//   };


// async function fetchAllTemplates() {
//   try {
//     let allTemplates: any[] = [];
//     let nextPageUrl = 'https://graph.facebook.com/v21.0/201570686381881/message_templates';
    
//     while (nextPageUrl) {
//       const response = await axios.get(nextPageUrl, {
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': 'Bearer YOUR_TOKEN'
//         }
//       });
      
//       allTemplates = [...allTemplates, ...response.data.data];
      
//       // Check if there's a next page
//       nextPageUrl = response.data.paging?.next || null;
//     }
    
//     return allTemplates;
//   } catch (error) {
//     console.error('Error fetching templates:', error);
//     return [];
//   }
// }