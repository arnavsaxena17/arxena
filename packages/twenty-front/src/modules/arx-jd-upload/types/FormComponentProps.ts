import { RecruiterDetails } from '../components/ProjectDetailsForm';
import { ParsedJD } from './ParsedJD';

export type FormComponentProps = {
  parsedJD: ParsedJD | null;
  setParsedJD: (jd: ParsedJD) => void;
  onRecruiterInfoChange?: (recruiterDetails: RecruiterDetails) => void;
};
