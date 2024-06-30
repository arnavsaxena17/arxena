// src/FileUpload.js
import React, { useState } from "react";

const FileUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleFileUpload = () => {
    if (selectedFile) {
      // You can handle file upload here, for example:
      // Create a FormData object and send it to your server
      const formData = new FormData();
      formData.append("file", selectedFile);

      // Simulate file upload process
      console.log("File to upload:", selectedFile);

      // You can use fetch or axios to send the formData to your backend
      // Example using fetch:
      // fetch('your-upload-endpoint', {
      //   method: 'POST',
      //   body: formData,
      // })
      // .then(response => response.json())
      // .then(data => console.log(data))
      // .catch(error => console.error('Error:', error));
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleFileUpload}>Upload</button>
    </div>
  );
};

export default FileUpload;
