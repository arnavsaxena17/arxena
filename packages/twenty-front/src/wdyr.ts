import whyDidYouRender from '@welldone-software/why-did-you-render';
import React from 'react';
import { useRecoilTransactionObserver_UNSTABLE } from 'recoil';

if (process.env.NODE_ENV === 'development') {
  whyDidYouRender(React, {
    include: [
      /JobPage/,
      /TopBar/,
      /ViewBar/,
      /Jobs/,
    ],
    trackAllPureComponents: true,
    titleColor: 'green',
    diffNameColor: 'aqua',
  });
}


export const RecoilLogger = () => {
  useRecoilTransactionObserver_UNSTABLE(({ snapshot, previousSnapshot }) => {
    console.log('🔄 Recoil transaction observed', { snapshot, previousSnapshot });
    for (const node of snapshot.getNodes_UNSTABLE({ isModified: true })) {
      const prev = previousSnapshot.getLoadable(node).contents;
      const next = snapshot.getLoadable(node).contents;
      // Avoid logging massive objects if needed
      console.log('[Recoil change]', node.key, { prev, next });
    }
  });
  return null;
};