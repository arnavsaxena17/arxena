export interface candidateProfileType {
    first_name: any;
    id: string;
    jobsId: string;
    status: string;
    job: jobProfileType;
    phoneNumber: string;
    email: string;
    responsibleWorkspaceMemberId: string;
    input: string; // Add the 'input' property
  }
  export interface sendwhatsappTextMessageType {
    recipient: string;
    text: string;
  }

  export interface sendWhatsappTemplateMessageObjectType {
    template_name: string;
    recipient: string;
    recruiterName: string;
    candidateFirstName: string;
    recruiterJobTitle: string;
    recruiterCompanyName: string;
    recruiterCompanyDescription: string;
    jobPositionName: string;
    jobLocation: string;
  }
  

export type candidateInfoType = {
    candidateId: string;
    jobsId: string;
    responsibleWorkspaceMemberId: string;
};


export interface companyInfoType {
  name : string;
  descriptionOneliner : string;


}

export interface jobProfileType {
    name: any;
    jobLocation: string;
    company : companyInfoType
    
  }


export interface userMessageType { 
  phoneNumber: any; 
  messages: { [x: string]: any; }[]; 
}

export interface chatMessageType { 
  messages: { [x: string]: any; }[]; 
  phoneNumberFrom: any; 
  phoneNumberTo: any; 
  messageType : string;

}

export interface candidateChatMessageType { 
  candidateProfile : candidateProfileType;
  candidateFirstName: string;
  messages: { [x: string]: any; }[]; 
  phoneNumberFrom: any; 
  phoneNumberTo: any; 
  messageType : string;

}


export interface recruiterProfileType {
    job_title: any;
    job_company_name: any;
    company_description_oneliner: any;
    first_name: any;
    status: string;
    name: string;
    email: string;
    phone: string;
    input: string; // Add the 'input' property
  }

export const jobProfile:jobProfileType = {
    name: 'HR Leadership',
    company: {
      name: "SR Wastes Management",
      descriptionOneliner: "one of the india's largest waste management companies"
    },
    jobLocation: 'Mumbai'
  
  }
  
export const candidateProfile:candidateProfileType = {
  first_name: 'Christoph',
  id: '12d2232a-e79b-41c8-b56c-c186abb7fdea',
  jobsId: '5643d1e6-0415-4327-b871-918e7cd699d5',
  status: 'string',
  job: jobProfile,
  phoneNumber: '+919820297156',
  email: 'christoph.calisto@linkedin.com',
  responsibleWorkspaceMemberId: '20202020-0687-4c41-b707-ed1bfca972a7',
  input: 'string', // Add the 'input' property
}
export const recruiterProfile:recruiterProfileType = {
  name: 'Arnav Doe',
  first_name: 'Arnav',
  phone: "918411937769",
  email: 'arnav@arxena.com',
  input: "",
  status: "",
  job_title: "Director",
  job_company_name: "Arxena Inc",
  company_description_oneliner: "a US Based Recruitment Company"
}

export const candidateProfiles: candidateProfileType[] = [
  {
    first_name: 'Christoph',
    id: '12d2232a-e79b-41c8-b56c-c186abb7fdea',
    jobsId: '5643d1e6-0415-4327-b871-918e7cd699d5',
    status: 'string',
    job: jobProfile,
    phoneNumber: '+919820297156',
    email: 'christoph.calisto@linkedin.com',
    responsibleWorkspaceMemberId: '20202020-0687-4c41-b707-ed1bfca972a7',
    input: 'string',
  },
  {
    first_name: 'Alice',
    id: '3e8a41d7-92b0-4c35-8178-6105c4dd3f09',
    jobsId: '6f35f262-b7de-4872-a7b9-ea34e79bc6b5',
    status: 'string',
    phoneNumber: '+123456789',
    email: 'alice@example.com',
    responsibleWorkspaceMemberId: '30303030-0687-4c41-b707-ed1bfca972a7',
    input: 'string',
    job: jobProfile,
  },
  {
    first_name: 'John',
    id: '8b4e45cf-0e9d-4a6d-baa1-4f331826d1a7',
    jobsId: '98f4abfb-34c3-4f33-b628-54a0b5d92155',
    status: 'string',
    phoneNumber: '+987654321',
    email: 'john@example.com',
    responsibleWorkspaceMemberId: '40404040-0687-4c41-b707-ed1bfca972a7',
    input: 'string',
    job: jobProfile,

  }
];
// Create an array of jobProfile objects
export const jobProfiles: jobProfileType[] = [
  {
    name: 'HR Leadership',
    company: {
      name: "SR Wastes Management",
      descriptionOneliner: "one of the india's largest waste management companies"
    },
    jobLocation: 'Mumbai'
  },
  {
    name: 'Software Developer',
    company: {
      name: "SR Wastes Management",
      descriptionOneliner: "one of the india's largest waste management companies"
    },
    jobLocation: 'Mumbai'
  },
  {
    name: 'Marketing Manager',
    company: {
      name: "SR Wastes Management",
      descriptionOneliner: "one of the india's largest waste management companies"
    },
    jobLocation: 'Mumbai'
  }
];

// Create an array of recruiterProfile objects
export const recruiterProfiles: recruiterProfileType[] = [
  {
    name: 'Arnav Saxena',
    first_name: 'Arnav',
    phone: "918411937769",
    email: 'arnav@arxena.com',
    input: "",
    status: "",
    job_title: "Director",
    job_company_name: "Arxena Inc",
    company_description_oneliner: "a US Based Recruitment Company"
  },
  {
    // Add another recruiterProfile object with different details
    name: 'Andrew Simoes',
    first_name: 'Jane',
    phone: "1234567890",
    email: 'jane@company.com',
    input: "",
    status: "",
    job_title: "Recruitment Manager",
    job_company_name: "Tech Innovations",
    company_description_oneliner: "Innovating the future of shared services"
  },
  {
    // Add another recruiterProfile object with different details
    name: 'Nupur Mehta',
    first_name: 'Nupur',
    phone: "1234567890",
    email: 'jane@company.com',
    input: "",
    status: "",
    job_title: "Recruitment Manager",
    job_company_name: "Tech Innovations",
    company_description_oneliner: "Innovating the future of pharma"
  },
];
