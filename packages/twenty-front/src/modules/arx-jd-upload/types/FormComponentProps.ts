import { RecruiterDetails } from '../components/JobDetailsForm';
import { ParsedJD } from './ParsedJD';

export type FormComponentProps = {
  parsedJD: ParsedJD;
  setParsedJD: (jd: ParsedJD) => void;
  onRecruiterInfoChange?: (recruiterDetails: RecruiterDetails) => void;
};
