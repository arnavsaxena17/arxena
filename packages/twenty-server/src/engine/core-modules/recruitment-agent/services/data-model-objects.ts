export interface candidateProfileType {
    first_name: any;
    status: string;
    name: string;
    phoneNumber: string;
    email: string;
    input: string; // Add the 'input' property
  }

export interface jobProfileType {
    job_name: any;
    company_name: string;
    company_description_oneliner: string;
    
  }

export interface userMessageType { 
  phoneNumber: any; 
  messages: { [x: string]: any; }[]; 
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

export const candidateProfile:candidateProfileType = {
  name: 'John Doe',
  first_name: 'John',
  email: 'panda@panda.com',
  input: "",
  phoneNumber: "918411937769",
  status: ""
}
export const jobProfile:jobProfileType = {
  job_name: 'HR Leadership',
  company_name: 'John',
  company_description_oneliner: "one of the india's largest waste management companies",
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

// Create an array of candidateProfile objects
export const candidateProfiles: candidateProfileType[] = [
  {
    name: 'John Doe',
    first_name: 'John',
    email: 'panda@panda.com',
    input: "",
    phoneNumber: "918411937769",
    status: ""
  },
  {
    name: 'Alice Johnson',
    first_name: 'Alice',
    email: 'alice@example.com',
    input: "",
    phoneNumber: "9199999999",
    status: ""
  },
  {
    name: 'Bob Smith',
    first_name: 'Bob',
    email: 'bob@smith.com',
    input: "",
    phoneNumber: "9188888888",
    status: ""
  }
];


// Create an array of jobProfile objects
export const jobProfiles: jobProfileType[] = [
  {
    job_name: 'HR Leadership',
    company_name: 'John',
    company_description_oneliner: "one of India's largest waste management companies",
  },
  {
    job_name: 'Software Developer',
    company_name: 'Tech Innovations',
    company_description_oneliner: "leading the way in technology solutions",
  },
  {
    job_name: 'Marketing Manager',
    company_name: 'Creative Minds',
    company_description_oneliner: "at the forefront of digital marketing strategies",
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