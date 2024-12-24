import { useRecoilValue } from 'recoil';

import { currentUserState } from '@/auth/states/currentUserState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { usePrefetchedData } from '@/prefetch/hooks/usePrefetchedData';
import { PrefetchKey } from '@/prefetch/types/PrefetchKey';
import { AppPath } from '@/types/AppPath';
import { isDefined } from '~/utils/isDefined';

export const useDefaultHomePagePath = () => {
  console.log("process.env.NODE_ENV:", process.env.NODE_ENV)

  const currentUser = useRecoilValue(currentUserState);
  const { objectMetadataItem: companyObjectMetadataItem } =
    useObjectMetadataItem({
      objectNameSingular: CoreObjectNameSingular.Company,
    });
  const { records } = usePrefetchedData(PrefetchKey.AllViews);

  if (!isDefined(currentUser)) {
    if (location.pathname.includes("video-interview") && !location.pathname.includes("video-interview-review")) {
      return { defaultHomePagePath: location.pathname };
    }
    console.log("currentUser is not defined and hence going to signinup")
    return { defaultHomePagePath: AppPath.SignInUp };
  }

  const companyViewId = records.find(
    (view: any) => view?.objectMetadataId === companyObjectMetadataItem.id,
  )?.id;

  return {
    defaultHomePagePath:
      '/objects/companies' + (companyViewId ? `?view=${companyViewId}` : ''),
  };
};
