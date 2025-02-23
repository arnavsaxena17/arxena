
const candidateActions = [
    "Candidate has sent CV",
    "Candidate has sent chat Message",
    "Candidate has attended interview",
    "Candidate has shared document",
    "Candidate has joined the company"
]

const recruiterActions = [
    "Recruiter has screened the candidate CV",
    "Recruiter has screened the candidate CV and rejected the CV",
    "Recruiter has screened the candidate CV and shortlisted the CV",
    "Recruiter has scheduled the candidate CV, shortlisted it and sent it to the client",
    "Recruiter has finished sending the CVs to client",
    "Recruiter has shortlisted the candidate",
    "Recruiter has offered the candidate"
]

const systemActions = [
    "A candidate profile has been shared added.",
    "A candidate has been rejected.",
    "Candidate has been scheduled for an interview.",
    "A candidate has been rejected.",
    "A candidate has been scheduled for an interview.",
    "A candidate has been rejected.",
    "A candidate has been scheduled for an interview.",
    "A candidate has been rejected.",
    "A account has been created.",
    "A candidate has been shortlisted.",
    "A candidate has been offered"
]

const clientActions = [
    "Client has scheduled an interview",
    "Client has rejected the candidate",
    "Client has shortlisted the candidate",
    "Client has offered the candidate"
]

const timeAwareActionsRecruiter = [
    "when more than 1 day has passed since, candidate has not replied to recruiter"
]


function processAction(action){
    if (action){

        runSystemAction(action)
    }
    return 
}

function runSystemAction(action){
    console.log("Running system action: ", action)
}