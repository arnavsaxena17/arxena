import React from 'react';

const GoogleSheet = () => {
  return (
    <iframe 
      src="https://docs.google.com/spreadsheets/d/e/2PACX-1vTFW5Q43lfOxIM3DkQU68ROWGR2NKo_syZZxTc-RghjFz1ddSUNZCZddFfYmNCxWH7fjK8Nu5xe35GD/pubhtml?widget=true&embedded=true"
      style={{
        width: '100%',
        height: '600px',
        border: 'none'
      }}
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      allowFullScreen={true}
      title="Google Spreadsheet"
    />
  );
};


export default GoogleSheet;
