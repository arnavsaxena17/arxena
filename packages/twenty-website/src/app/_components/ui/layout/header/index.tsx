import { desc } from 'drizzle-orm';

import { findOne } from '@/database/database';
import { githubStarsModel } from '@/database/model';

export const AppHeader = async () => {
  const _githubStars = await findOne(
    githubStarsModel,
    desc(githubStarsModel.timestamp),
  );

  return (
    <>
      {/* <HeaderDesktop numberOfStars={githubStars?.[0]?.numberOfStars} /> */}
      {/* <HeaderMobile numberOfStars={githubStars?.[0]?.numberOfStars} /> */}
    </>
  );
};
