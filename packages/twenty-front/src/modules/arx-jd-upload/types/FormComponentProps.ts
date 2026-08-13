import { type RecruiterDetails } from '../components/ProjectDetailsForm';
import { type ParsedJD } from './ParsedJD';

export type FormComponentProps = {
  parsedJD: ParsedJD | null;
  setParsedJD: (jd: ParsedJD) => void;
  onRecruiterInfoChange?: (recruiterDetails: RecruiterDetails) => void;
};
